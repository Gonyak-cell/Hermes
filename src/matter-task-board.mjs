import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_TASK_BOARD_OUT_DIR = "artifacts/matter-task-board/latest";
export const DEFAULT_MATTER_TASK_BOARD_INPUTS = {
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  matterTimelinePath: "artifacts/matter-timeline/latest/matter-timeline.json",
  matterOsProfilePath: "artifacts/matter-os-profile/latest/matter-os-profile.json",
  workflowRunDashboardPath: "artifacts/workflow-run-dashboard/latest/workflow-run-dashboard.json",
  matterFiles: [
    "examples/project-alpha-matter.json",
    "examples/project-beta-litigation-matter.json",
  ],
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  deliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "matter-task-board.v1";
const SOURCE_OF_TRUTH = "matter_files_timeline_document_index_and_workflow_artifacts";
const TASK_COLUMNS = [
  { task_column_id: "blocked", label: "Blocked", status_values: ["blocked", "missing"] },
  { task_column_id: "open", label: "Open", status_values: ["open", "requested"] },
  { task_column_id: "pending", label: "Pending", status_values: ["pending", "planned"] },
  { task_column_id: "in_review", label: "In Review", status_values: ["in-review", "pending_review"] },
  { task_column_id: "monitoring", label: "Monitoring", status_values: ["monitoring"] },
  { task_column_id: "complete", label: "Complete", status_values: ["complete", "completed", "approved", "received", "verified"] },
];

export async function runMatterTaskBoard(options = {}) {
  const result = await buildMatterTaskBoard(options);
  if (options.write !== false) await writeMatterTaskBoard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter task board validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterTaskBoard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_TASK_BOARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const matterFileReads = sourceReads.filter((source) => source.source_kind === "matter_file");
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const matterDocumentIndex = sourceById.matter_document_index;
  const matterTimeline = sourceById.matter_timeline;
  const matterOsProfile = sourceById.matter_os_profile;
  const workflowRunDashboard = sourceById.workflow_run_dashboard;
  const outputCatalog = sourceById.output_catalog;
  const deliveryQueue = sourceById.delivery_queue;
  const timelineEventBySourceRecord = buildTimelineEventBySourceRecord(matterTimeline);
  const documentBySourceRecord = buildDocumentBySourceRecord(matterDocumentIndex);
  const workflowContext = buildWorkflowContext(workflowRunDashboard);
  const deliveryByArtifactId = buildDeliveryByArtifactId(deliveryQueue);
  const taskRecords = buildMatterTaskRecords({
    generatedAt,
    matterFileReads,
    matterOsProfile,
    outputCatalog,
    deliveryByArtifactId,
    timelineEventBySourceRecord,
    documentBySourceRecord,
    workflowContext,
  });
  const boardColumns = buildBoardColumns(taskRecords, generatedAt);
  const workflowBindings = taskRecords.map((record) => record.workflow_binding);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matterDocumentIndex,
    matterTimeline,
    workflowRunDashboard,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    taskRecords,
    boardColumns,
    workflowBindings,
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
  const summary = summarizeMatterTaskBoard({
    matterDocumentIndex,
    matterTimeline,
    matterOsProfile,
    workflowRunDashboard,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    taskRecords,
    boardColumns,
    workflowBindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    matter_task_board_id: `matter-task-board.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    matter_task_board_status: summary.matter_task_board_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    matter_task_board_contract: buildContract(generatedAt),
    task_records: taskRecords.map(stripEmbeddedWorkflowBinding),
    board_columns: boardColumns,
    workflow_bindings: workflowBindings,
    matter_task_board_desktop_boundary: desktopBoundary,
    matter_task_board_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMatterTaskBoardMarkdown(result),
  };
}

export async function writeMatterTaskBoard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterTaskBoard(result);
  await writeJson(path.join(outDir, "matter-task-board.json"), serializable);
  await writeJson(path.join(outDir, "matter-task-records.json"), {
    schema_version: "matter-task-records.v1",
    generated_at: result.generated_at,
    task_record_count: result.task_records.length,
    task_records: result.task_records,
  });
  await writeJson(path.join(outDir, "matter-task-board-columns.json"), {
    schema_version: "matter-task-board-columns.v1",
    generated_at: result.generated_at,
    board_column_count: result.board_columns.length,
    board_columns: result.board_columns,
  });
  await writeJson(path.join(outDir, "matter-task-workflow-bindings.json"), {
    schema_version: "matter-task-workflow-bindings.v1",
    generated_at: result.generated_at,
    workflow_binding_count: result.workflow_bindings.length,
    workflow_bindings: result.workflow_bindings,
  });
  await writeJson(path.join(outDir, "matter-task-board-boundary.json"), {
    schema_version: "matter-task-board-boundary-artifact.v1",
    generated_at: result.generated_at,
    matter_task_board_desktop_boundary: result.matter_task_board_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-task-board-validation-report.v1",
    generated_at: result.generated_at,
    matter_task_board_id: result.matter_task_board_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterTaskBoardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterTaskBoard(args);
    console.log(`Matter task board ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_task_board_status}`);
    console.log(`Tasks: ${result.summary.task_record_count}`);
    console.log(`Owners: ${result.summary.task_with_owner_count}/${result.summary.task_record_count}`);
    console.log(`Due dates: ${result.summary.task_with_due_date_count}/${result.summary.task_record_count}`);
    console.log(`Workflow bindings: ${result.summary.workflow_bound_task_count}/${result.summary.task_record_count}`);
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
    schema_version: "matter-task-board-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    task_board_rule: "each_task_row_must_carry_matter_id_owner_due_date_status_and_workflow_binding",
    workflow_binding_rule: "task_rows_bind_to_existing_workflow_runs_when_available_or_to_read_only_matter_review_workflow_anchors",
    matter_boundary_rule: "every_task_record_carries_one_matter_id_and_never_merges_confidential_context_across_matters",
    attorney_review_rule: "task_board_rows_are_operational_context_only_and_do_not_create_legal_or_client_facing_outputs",
    desktop_companion_rule: "desktop_companion_reads_task_rows_columns_workflow_bindings_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_write_matter_data_execute_runtime_actions_or_deliver_outputs",
    created_at: generatedAt,
  };
}

function buildMatterTaskRecords({
  generatedAt,
  matterFileReads,
  matterOsProfile,
  outputCatalog,
  deliveryByArtifactId,
  timelineEventBySourceRecord,
  documentBySourceRecord,
  workflowContext,
}) {
  const records = [];
  const profileByMatter = buildMatterOsProfileByMatter(matterOsProfile);
  for (const matterRead of matterFileReads) {
    if (!matterRead.value?.matter_id) continue;
    records.push(...buildMatterFileTaskRecords({
      generatedAt,
      matterRead,
      profile: profileByMatter.get(matterRead.value.matter_id) ?? null,
      timelineEventBySourceRecord,
      documentBySourceRecord,
      workflowContext,
    }));
  }
  records.push(...buildOutputReviewTaskRecords({
    generatedAt,
    outputCatalog,
    deliveryByArtifactId,
    workflowContext,
  }));
  return records.sort(compareTaskRecords).map((record, index) => ({
    ...record,
    sequence_number: index + 1,
    sort_key: buildSortKey(record),
  }));
}

function buildMatterFileTaskRecords({
  generatedAt,
  matterRead,
  profile,
  timelineEventBySourceRecord,
  documentBySourceRecord,
  workflowContext,
}) {
  const matter = matterRead.value;
  const matterId = matter.matter_id;
  const sourcePath = matterRead.path;
  const defaultOwner = profile?.responsible_owner_display_names?.[0]
    ?? matter.review_workflow?.default_reviewer
    ?? matter.matter_profile?.responsible_partner
    ?? "Unassigned";
  const defaultDue = matter.deal_control?.signing_target
    ?? matter.litigation_control?.next_filing
    ?? matter.deadlines?.[0]?.date
    ?? generatedAt.slice(0, 10);
  const records = [];

  for (const task of matter.tasks ?? []) {
    records.push(taskRecord({
      generatedAt,
      matterId,
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: task.id,
      taskCategory: "matter_task",
      taskTitle: task.title ?? task.id,
      taskOwner: task.owner ?? defaultOwner,
      dueDate: task.due ?? defaultDue,
      taskStatus: task.status ?? "open",
      sourceLabel: task.source ?? "matter.tasks",
      reviewRequired: true,
      timelineEvent: timelineEventBySourceRecord.get(sourceKey(matterRead.source_id, task.id)),
      documentRecord: null,
      workflowBinding: buildWorkflowBinding({
        generatedAt,
        matterId,
        taskCategory: "matter_task",
        sourceRecordId: task.id,
        owner: task.owner ?? defaultOwner,
        workflowContext,
      }),
      metadata: {
        source: task.source ?? null,
        source_review_required: task.review_required ?? null,
      },
    }));
  }

  for (const deadline of matter.deadlines ?? []) {
    records.push(taskRecord({
      generatedAt,
      matterId,
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: deadline.id,
      taskCategory: "matter_deadline",
      taskTitle: deadline.title ?? deadline.id,
      taskOwner: deadline.owner ?? defaultOwner,
      dueDate: deadline.date ?? defaultDue,
      taskStatus: "open",
      sourceLabel: deadline.type ?? "matter.deadlines",
      reviewRequired: true,
      timelineEvent: timelineEventBySourceRecord.get(sourceKey(matterRead.source_id, deadline.id)),
      documentRecord: null,
      workflowBinding: buildWorkflowBinding({
        generatedAt,
        matterId,
        taskCategory: "matter_deadline",
        sourceRecordId: deadline.id,
        owner: deadline.owner ?? defaultOwner,
        workflowContext,
      }),
      metadata: {
        deadline_type: deadline.type ?? null,
      },
    }));
  }

  for (const item of matter.deal_control?.vdr_requests ?? []) {
    records.push(matterControlTask({
      generatedAt,
      matterId,
      matterRead,
      item,
      taskCategory: "vdr_request",
      taskTitle: item.title ?? item.id,
      defaultOwner,
      defaultDue,
      sourceLabel: "deal_control.vdr_requests",
      timelineEventBySourceRecord,
      documentBySourceRecord,
      workflowContext,
      metadata: { issue: item.issue ?? null },
    }));
  }

  for (const item of matter.deal_control?.qa_items ?? []) {
    records.push(matterControlTask({
      generatedAt,
      matterId,
      matterRead,
      item,
      taskCategory: "qa_item",
      taskTitle: item.question ?? item.id,
      defaultOwner,
      defaultDue,
      sourceLabel: "deal_control.qa_items",
      timelineEventBySourceRecord,
      documentBySourceRecord,
      workflowContext,
      metadata: { from: item.from ?? null, to: item.to ?? null },
    }));
  }

  for (const item of matter.deal_control?.cp_checklist ?? []) {
    records.push(matterControlTask({
      generatedAt,
      matterId,
      matterRead,
      item,
      taskCategory: "cp_checklist",
      taskTitle: item.title ?? item.id,
      defaultOwner,
      defaultDue: item.due ?? matter.deal_control?.closing_target ?? defaultDue,
      sourceLabel: "deal_control.cp_checklist",
      timelineEventBySourceRecord,
      documentBySourceRecord,
      workflowContext,
      metadata: { evidence: item.evidence ?? null },
    }));
  }

  for (const item of matter.deal_control?.negotiation_points ?? []) {
    records.push(taskRecord({
      generatedAt,
      matterId,
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: item.id,
      taskCategory: "negotiation_point",
      taskTitle: `Resolve negotiation point: ${item.clause ?? item.id}`,
      taskOwner: item.owner ?? defaultOwner,
      dueDate: matter.deal_control?.signing_target ?? defaultDue,
      taskStatus: item.status ?? "open",
      sourceLabel: "deal_control.negotiation_points",
      reviewRequired: true,
      timelineEvent: null,
      documentRecord: null,
      workflowBinding: buildWorkflowBinding({
        generatedAt,
        matterId,
        taskCategory: "negotiation_point",
        sourceRecordId: item.id,
        owner: item.owner ?? defaultOwner,
        workflowContext,
      }),
      metadata: {
        clause: item.clause ?? null,
        severity: item.severity ?? null,
        open_issue: item.open_issue ?? null,
      },
    }));
  }

  if (matter.litigation_control?.next_filing) {
    records.push(taskRecord({
      generatedAt,
      matterId,
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: "litigation_control.next_filing",
      taskCategory: "litigation_next_filing",
      taskTitle: "Prepare next filing",
      taskOwner: defaultOwner,
      dueDate: matter.litigation_control.next_filing,
      taskStatus: "planned",
      sourceLabel: "litigation_control.next_filing",
      reviewRequired: true,
      timelineEvent: timelineEventBySourceRecord.get(sourceKey(matterRead.source_id, "litigation_control.next_filing")),
      documentRecord: null,
      workflowBinding: buildWorkflowBinding({
        generatedAt,
        matterId,
        taskCategory: "litigation_next_filing",
        sourceRecordId: "litigation_control.next_filing",
        owner: defaultOwner,
        workflowContext,
      }),
      metadata: {
        forum: matter.litigation_control.forum ?? null,
        procedural_stage: matter.litigation_control.procedural_stage ?? null,
      },
    }));
  }

  for (const claim of matter.litigation_control?.claims ?? []) {
    records.push(taskRecord({
      generatedAt,
      matterId,
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath,
      sourceRecordId: claim.id,
      taskCategory: "litigation_claim",
      taskTitle: `Advance claim work: ${claim.title ?? claim.id}`,
      taskOwner: defaultOwner,
      dueDate: matter.litigation_control?.next_filing ?? defaultDue,
      taskStatus: claim.status ?? "open",
      sourceLabel: "litigation_control.claims",
      reviewRequired: true,
      timelineEvent: null,
      documentRecord: null,
      workflowBinding: buildWorkflowBinding({
        generatedAt,
        matterId,
        taskCategory: "litigation_claim",
        sourceRecordId: claim.id,
        owner: defaultOwner,
        workflowContext,
      }),
      metadata: {},
    }));
  }

  for (const claimEvidence of matter.litigation_control?.claim_evidence ?? []) {
    for (const [index, missingEvidence] of (claimEvidence.missing_evidence ?? []).entries()) {
      const sourceRecordId = `${claimEvidence.claim_id}.missing.${index + 1}`;
      records.push(taskRecord({
        generatedAt,
        matterId,
        sourceKind: "matter_file",
        sourceId: matterRead.source_id,
        sourcePath,
        sourceRecordId,
        taskCategory: "litigation_missing_evidence",
        taskTitle: `Collect missing evidence: ${missingEvidence}`,
        taskOwner: claimEvidence.owner ?? defaultOwner,
        dueDate: matter.litigation_control?.next_filing ?? defaultDue,
        taskStatus: "open",
        sourceLabel: "litigation_control.claim_evidence",
        reviewRequired: true,
        timelineEvent: null,
        documentRecord: null,
        workflowBinding: buildWorkflowBinding({
          generatedAt,
          matterId,
          taskCategory: "litigation_missing_evidence",
          sourceRecordId,
          owner: claimEvidence.owner ?? defaultOwner,
          workflowContext,
        }),
        metadata: {
          claim_id: claimEvidence.claim_id ?? null,
          missing_evidence: missingEvidence,
        },
      }));
    }
  }

  return records;
}

function matterControlTask({
  generatedAt,
  matterId,
  matterRead,
  item,
  taskCategory,
  taskTitle,
  defaultOwner,
  defaultDue,
  sourceLabel,
  timelineEventBySourceRecord,
  documentBySourceRecord,
  workflowContext,
  metadata = {},
}) {
  const sourcePath = matterRead.path;
  return taskRecord({
    generatedAt,
    matterId,
    sourceKind: "matter_file",
    sourceId: matterRead.source_id,
    sourcePath,
    sourceRecordId: item.id,
    taskCategory,
    taskTitle,
    taskOwner: item.owner ?? defaultOwner,
    dueDate: item.due ?? defaultDue,
    taskStatus: item.status ?? "open",
    sourceLabel,
    reviewRequired: true,
    timelineEvent: timelineEventBySourceRecord.get(sourceKey(matterRead.source_id, item.id)),
    documentRecord: documentBySourceRecord.get(sourceKey(matterRead.source_id, item.id)),
    workflowBinding: buildWorkflowBinding({
      generatedAt,
      matterId,
      taskCategory,
      sourceRecordId: item.id,
      owner: item.owner ?? defaultOwner,
      workflowContext,
    }),
    metadata,
  });
}

function buildOutputReviewTaskRecords({
  generatedAt,
  outputCatalog,
  deliveryByArtifactId,
  workflowContext,
}) {
  const records = [];
  for (const artifact of outputCatalog?.artifacts ?? []) {
    if (artifact.domain_pack !== "law-firm") continue;
    const delivery = deliveryByArtifactId.get(artifact.artifact_id);
    const title = artifact.metadata?.title ?? artifact.artifact_id;
    records.push(taskRecord({
      generatedAt,
      matterId: artifact.matter_id ?? "matter.unassigned",
      sourceKind: "output_catalog",
      sourceId: artifact.source_id ?? "output_catalog",
      sourcePath: artifact.artifact_uri ?? null,
      sourceRecordId: artifact.artifact_id,
      taskCategory: "output_review",
      taskTitle: `Review output artifact: ${title}`,
      taskOwner: "Attorney reviewer",
      dueDate: artifact.created_at?.slice(0, 10) ?? generatedAt.slice(0, 10),
      taskStatus: artifact.approval_status === "pending" ? "pending_review" : artifact.status ?? "pending_review",
      sourceLabel: artifact.capability_id ?? "output_catalog",
      reviewRequired: true,
      timelineEvent: null,
      documentRecord: null,
      workflowBinding: buildWorkflowBinding({
        generatedAt,
        matterId: artifact.matter_id ?? "matter.unassigned",
        taskCategory: "output_review",
        sourceRecordId: artifact.artifact_id,
        owner: "Attorney reviewer",
        workflowRunId: artifact.workflow_run_id ?? null,
        workflowContext,
      }),
      metadata: {
        artifact_id: artifact.artifact_id,
        artifact_type: artifact.artifact_type ?? null,
        capability_id: artifact.capability_id ?? null,
        delivery_status: delivery?.delivery_status ?? artifact.delivery_state ?? null,
        approval_status: artifact.approval_status ?? null,
        blocking_gate_count: artifact.blocking_gate_count ?? 0,
      },
    }));
  }
  return records;
}

function taskRecord({
  generatedAt,
  matterId,
  sourceKind,
  sourceId,
  sourcePath,
  sourceRecordId,
  taskCategory,
  taskTitle,
  taskOwner,
  dueDate,
  taskStatus,
  sourceLabel,
  reviewRequired,
  timelineEvent,
  documentRecord,
  workflowBinding,
  metadata = {},
}) {
  const normalizedDueDate = normalizeDate(dueDate, generatedAt);
  const normalizedStatus = taskStatus ?? "open";
  const taskId = `matter-task.${slugify(matterId)}.${slugify(taskCategory)}.${slugify(sourceRecordId)}`;
  const binding = {
    ...workflowBinding,
    task_id: taskId,
    task_title: taskTitle,
  };
  return {
    schema_version: "matter-task-record.v1",
    task_id: taskId,
    matter_id: matterId,
    task_category: taskCategory,
    task_title: taskTitle,
    task_owner: taskOwner || "Unassigned",
    due_date: normalizedDueDate,
    due_status: dueStatus(normalizedDueDate, generatedAt),
    task_status: normalizedStatus,
    task_column_id: statusColumn(normalizedStatus),
    source_kind: sourceKind,
    source_id: sourceId,
    source_path: sourcePath,
    source_record_id: sourceRecordId,
    source_label: sourceLabel,
    timeline_event_id: timelineEvent?.event_id ?? null,
    document_record_id: documentRecord?.document_id ?? null,
    workflow_binding_id: binding.workflow_binding_id,
    workflow_binding_status: binding.workflow_binding_status,
    workflow_run_id: binding.workflow_run_id,
    workflow_id: binding.workflow_id,
    capability_id: binding.capability_id,
    review_status: reviewRequired === false ? "internal_review" : "pending_review",
    attorney_review_required: true,
    human_review_required: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    default_output_status: "pending_review",
    created_at: generatedAt,
    metadata,
    workflow_binding: binding,
  };
}

function buildWorkflowBinding({
  generatedAt,
  matterId,
  taskCategory,
  sourceRecordId,
  owner,
  workflowRunId = null,
  workflowContext,
}) {
  const panel = workflowRunId
    ? workflowContext.panelByRun.get(workflowRunId)
    : workflowContext.panelsByMatter.get(matterId)?.[0] ?? null;
  const bindingWorkflowRunId = workflowRunId ?? panel?.workflow_run_id ?? null;
  const workflowId = panel?.workflow_id ?? `matter-review.${slugify(matterId)}.${slugify(taskCategory)}.v1`;
  return {
    schema_version: "matter-task-workflow-binding.v1",
    workflow_binding_id: `matter-task-workflow-binding.${slugify(matterId)}.${slugify(taskCategory)}.${slugify(sourceRecordId)}`,
    task_id: null,
    task_title: null,
    matter_id: matterId,
    task_category: taskCategory,
    task_owner: owner || "Unassigned",
    workflow_binding_status: "bound",
    workflow_anchor_type: bindingWorkflowRunId ? "workflow_run" : "matter_review_workflow",
    workflow_run_id: bindingWorkflowRunId,
    workflow_id: workflowId,
    capability_id: panel?.capability_id ?? inferCapabilityId(taskCategory),
    domain_pack: panel?.domain_pack ?? "law-firm",
    workflow_status: panel?.desktop_card_status ?? panel?.dsl_current_state ?? "review_required",
    queue_status: panel?.queue_status ?? "not_scheduled",
    gate_status: panel?.workflow_gate_status ?? "manual_review_required",
    human_review_required: true,
    attorney_review_required: true,
    protected_action_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    created_at: generatedAt,
  };
}

function buildBoardColumns(taskRecords, generatedAt) {
  return TASK_COLUMNS.map((column, index) => {
    const columnTasks = taskRecords.filter((record) => record.task_column_id === column.task_column_id);
    return {
      schema_version: "matter-task-board-column.v1",
      task_column_id: column.task_column_id,
      label: column.label,
      sequence_number: index + 1,
      status_values: column.status_values,
      task_count: columnTasks.length,
      task_ids: columnTasks.map((record) => record.task_id),
      owner_count: new Set(columnTasks.map((record) => record.task_owner)).size,
      overdue_task_count: columnTasks.filter((record) => record.due_status === "overdue").length,
      read_only: true,
      mutation_allowed: false,
      created_at: generatedAt,
    };
  });
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "matter-task-board-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    mutation_allowed: false,
    source_of_truth: false,
    matter_data_write_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    protected_action_allowed: false,
    created_at: generatedAt,
  };
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  matterDocumentIndex,
  matterTimeline,
  workflowRunDashboard,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  taskRecords,
  boardColumns,
  workflowBindings,
  desktopBoundary,
}) {
  const taskCount = taskRecords.length;
  const columnTaskCount = boardColumns.reduce((sum, column) => sum + column.task_count, 0);
  const packageScriptPresent = Boolean(packageJson?.scripts?.["matter:task-board"]);
  const roadmapMentionsP235 = typeof roadmapText === "string" && roadmapText.includes("P235");
  const sourceStatus = new Map(sourceReads.map((source) => [source.source_id, source.available]));
  return [
    checkpoint("source_matter_document_index_complete", matterDocumentIndex?.summary?.matter_document_index_status === "complete", "Matter Document Index source is complete."),
    checkpoint("source_matter_timeline_complete", matterTimeline?.summary?.matter_timeline_status === "complete", "Matter Timeline source is complete."),
    checkpoint("source_workflow_run_dashboard_complete", workflowRunDashboard?.summary?.workflow_run_dashboard_status === "complete", "Workflow Run Dashboard source is complete."),
    checkpoint("source_output_catalog_complete", outputCatalog?.schema_version === "output-artifact-catalog.v1", "Output Catalog source is complete."),
    checkpoint("source_delivery_queue_complete", deliveryQueue?.schema_version === "protected-delivery-queue.v1", "Protected Delivery Queue source is complete."),
    checkpoint("matter_files_available", matterFileReads.length > 0 && matterFileReads.every((source) => source.available), "All configured matter files are available.", { passed_count: matterFileReads.filter((source) => source.available).length, expected_count: matterFileReads.length }),
    checkpoint("source_files_available", [...sourceStatus.values()].every(Boolean), "All configured task board sources are available."),
    checkpoint("task_rows_created", taskCount > 0, "Task board rows are created.", { passed_count: taskCount, expected_count: 1 }),
    checkpoint("task_rows_have_matter_id", taskRecords.every((record) => Boolean(record.matter_id)), "Every task row is scoped to one matter_id.", { passed_count: taskRecords.filter((record) => Boolean(record.matter_id)).length, expected_count: taskCount }),
    checkpoint("task_rows_have_owner", taskRecords.every((record) => Boolean(record.task_owner)), "Every task row has a responsible owner.", { passed_count: taskRecords.filter((record) => Boolean(record.task_owner)).length, expected_count: taskCount }),
    checkpoint("task_rows_have_due_date", taskRecords.every((record) => Boolean(record.due_date)), "Every task row has a due date.", { passed_count: taskRecords.filter((record) => Boolean(record.due_date)).length, expected_count: taskCount }),
    checkpoint("task_rows_have_status", taskRecords.every((record) => Boolean(record.task_status)), "Every task row has a status.", { passed_count: taskRecords.filter((record) => Boolean(record.task_status)).length, expected_count: taskCount }),
    checkpoint("task_rows_have_workflow_binding", taskRecords.every((record) => record.workflow_binding_status === "bound"), "Every task row is connected to a workflow binding.", { passed_count: taskRecords.filter((record) => record.workflow_binding_status === "bound").length, expected_count: taskCount }),
    checkpoint("actual_workflow_run_binding_present", taskRecords.some((record) => Boolean(record.workflow_run_id)), "At least one task row binds to an existing workflow run.", { passed_count: taskRecords.filter((record) => Boolean(record.workflow_run_id)).length, expected_count: 1 }),
    checkpoint("timeline_binding_present", taskRecords.some((record) => Boolean(record.timeline_event_id)), "At least one task row binds to a timeline event.", { passed_count: taskRecords.filter((record) => Boolean(record.timeline_event_id)).length, expected_count: 1 }),
    checkpoint("document_binding_present", taskRecords.some((record) => Boolean(record.document_record_id)), "At least one task row binds to a document index record.", { passed_count: taskRecords.filter((record) => Boolean(record.document_record_id)).length, expected_count: 1 }),
    checkpoint("board_columns_cover_tasks", columnTaskCount === taskCount, "Board columns cover every task exactly once.", { passed_count: columnTaskCount, expected_count: taskCount }),
    checkpoint("blocked_open_in_review_present", taskRecords.some((record) => record.task_column_id === "blocked") && taskRecords.some((record) => record.task_column_id === "open") && taskRecords.some((record) => record.task_column_id === "in_review"), "Blocked, open, and in-review task columns have rows."),
    checkpoint("attorney_review_preserved", taskRecords.every((record) => record.attorney_review_required === true), "All task rows preserve attorney review requirement.", { passed_count: taskRecords.filter((record) => record.attorney_review_required === true).length, expected_count: taskCount }),
    checkpoint("human_review_preserved", taskRecords.every((record) => record.human_review_required === true), "All task rows preserve human review requirement.", { passed_count: taskRecords.filter((record) => record.human_review_required === true).length, expected_count: taskCount }),
    checkpoint("workflow_bindings_non_executable", workflowBindings.every((binding) => binding.protected_action_allowed === false && binding.runtime_execution_allowed === false && binding.delivery_execution_allowed === false), "Workflow bindings are read-only and non-executable.", { passed_count: workflowBindings.filter((binding) => binding.protected_action_allowed === false && binding.runtime_execution_allowed === false && binding.delivery_execution_allowed === false).length, expected_count: workflowBindings.length }),
    checkpoint("no_legal_or_client_output", taskRecords.every((record) => record.legal_advice_provided === false && record.client_facing_output_generated === false), "Task board does not provide legal advice or generate client-facing output."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and not source of truth."),
    checkpoint("no_mutating_actions_allowed", desktopBoundary.matter_data_write_allowed === false && desktopBoundary.runtime_execution_allowed === false && desktopBoundary.delivery_execution_allowed === false && desktopBoundary.task_state_write_allowed === false && desktopBoundary.workflow_transition_allowed === false && desktopBoundary.protected_action_allowed === false, "Task board cannot mutate matter data, task state, workflow state, runtime, delivery, or protected actions."),
    checkpoint("package_script_registered", packageScriptPresent, "package.json exposes matter:task-board."),
    checkpoint("roadmap_slot_present", roadmapMentionsP235, "Roadmap ledger still tracks P235 until promotion."),
  ];
}

function summarizeMatterTaskBoard({
  matterDocumentIndex,
  matterTimeline,
  matterOsProfile,
  workflowRunDashboard,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  taskRecords,
  boardColumns,
  workflowBindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const taskCount = taskRecords.length;
  const failedCheckpointCount = checkpoints.filter((checkpoint) => checkpoint.status !== "passed").length;
  const complete = validation.valid
    && failedCheckpointCount === 0
    && taskCount > 0
    && taskRecords.every((record) => Boolean(record.matter_id))
    && taskRecords.every((record) => Boolean(record.task_owner))
    && taskRecords.every((record) => Boolean(record.due_date))
    && taskRecords.every((record) => Boolean(record.task_status))
    && taskRecords.every((record) => record.workflow_binding_status === "bound")
    && taskRecords.some((record) => Boolean(record.workflow_run_id))
    && boardColumns.reduce((sum, column) => sum + column.task_count, 0) === taskCount;
  return {
    matter_task_board_status: complete ? "complete" : "blocked",
    matter_task_board_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_document_index_status: matterDocumentIndex?.summary?.matter_document_index_status ?? "unknown",
    source_matter_timeline_status: matterTimeline?.summary?.matter_timeline_status ?? "unknown",
    source_matter_os_profile_status: matterOsProfile?.summary?.matter_os_profile_status ?? "unknown",
    source_workflow_run_dashboard_status: workflowRunDashboard?.summary?.workflow_run_dashboard_status ?? "unknown",
    source_output_catalog_status: outputCatalog?.schema_version === "output-artifact-catalog.v1" ? "complete" : "unknown",
    source_delivery_queue_status: deliveryQueue?.schema_version === "protected-delivery-queue.v1" ? "complete" : "unknown",
    matter_file_count: matterFileReads.length,
    available_matter_file_count: matterFileReads.filter((source) => source.available).length,
    task_record_count: taskCount,
    board_column_count: boardColumns.length,
    workflow_binding_count: workflowBindings.length,
    matter_task_count: taskRecords.filter((record) => record.task_category === "matter_task").length,
    matter_deadline_task_count: taskRecords.filter((record) => record.task_category === "matter_deadline").length,
    vdr_request_task_count: taskRecords.filter((record) => record.task_category === "vdr_request").length,
    qa_item_task_count: taskRecords.filter((record) => record.task_category === "qa_item").length,
    cp_checklist_task_count: taskRecords.filter((record) => record.task_category === "cp_checklist").length,
    negotiation_point_task_count: taskRecords.filter((record) => record.task_category === "negotiation_point").length,
    litigation_task_count: taskRecords.filter((record) => record.task_category.startsWith("litigation_")).length,
    output_review_task_count: taskRecords.filter((record) => record.task_category === "output_review").length,
    blocked_task_count: taskRecords.filter((record) => record.task_column_id === "blocked").length,
    open_task_count: taskRecords.filter((record) => record.task_column_id === "open").length,
    in_review_task_count: taskRecords.filter((record) => record.task_column_id === "in_review").length,
    overdue_task_count: taskRecords.filter((record) => record.due_status === "overdue").length,
    due_today_task_count: taskRecords.filter((record) => record.due_status === "due_today").length,
    due_soon_task_count: taskRecords.filter((record) => record.due_status === "due_soon").length,
    task_with_owner_count: taskRecords.filter((record) => Boolean(record.task_owner)).length,
    task_with_due_date_count: taskRecords.filter((record) => Boolean(record.due_date)).length,
    task_with_status_count: taskRecords.filter((record) => Boolean(record.task_status)).length,
    workflow_bound_task_count: taskRecords.filter((record) => record.workflow_binding_status === "bound").length,
    actual_workflow_run_bound_task_count: taskRecords.filter((record) => Boolean(record.workflow_run_id)).length,
    timeline_bound_task_count: taskRecords.filter((record) => Boolean(record.timeline_event_id)).length,
    document_bound_task_count: taskRecords.filter((record) => Boolean(record.document_record_id)).length,
    matter_id_scoped_task_count: taskRecords.filter((record) => Boolean(record.matter_id)).length,
    attorney_review_required_task_count: taskRecords.filter((record) => record.attorney_review_required === true).length,
    human_review_required_task_count: taskRecords.filter((record) => record.human_review_required === true).length,
    legal_advice_provided: taskRecords.some((record) => record.legal_advice_provided === true),
    client_facing_output_generated: taskRecords.some((record) => record.client_facing_output_generated === true),
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed,
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
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

function buildTimelineEventBySourceRecord(matterTimeline) {
  const index = new Map();
  for (const event of matterTimeline?.matter_timeline_events ?? []) {
    if (!event.source_id || !event.source_record_id) continue;
    index.set(sourceKey(event.source_id, event.source_record_id), event);
  }
  return index;
}

function buildDocumentBySourceRecord(matterDocumentIndex) {
  const index = new Map();
  for (const document of matterDocumentIndex?.document_records ?? []) {
    if (!document.source_id || !document.source_record_id) continue;
    index.set(sourceKey(document.source_id, document.source_record_id), document);
  }
  return index;
}

function buildWorkflowContext(workflowRunDashboard) {
  const panels = workflowRunDashboard?.workflow_run_dashboard_panels ?? [];
  return {
    panels,
    panelByRun: new Map(panels.filter((panel) => panel.workflow_run_id).map((panel) => [panel.workflow_run_id, panel])),
    panelsByMatter: groupBy(panels.filter((panel) => panel.matter_id), "matter_id"),
  };
}

function buildMatterOsProfileByMatter(matterOsProfile) {
  return new Map((matterOsProfile?.matter_os_profiles ?? []).map((profile) => [profile.matter_id, profile]));
}

function buildDeliveryByArtifactId(deliveryQueue) {
  return new Map((deliveryQueue?.delivery_actions ?? []).filter((action) => action.artifact_id).map((action) => [action.artifact_id, action]));
}

function sourceKey(sourceId, sourceRecordId) {
  return `${sourceId}::${sourceRecordId}`;
}

function inferCapabilityId(taskCategory) {
  if (taskCategory.startsWith("litigation_")) return "law_firm.litigation.task_review";
  if (taskCategory === "output_review") return "law_firm.output.attorney_review";
  if (taskCategory === "vdr_request") return "law_firm.ldd.vdr_request";
  if (taskCategory === "qa_item") return "law_firm.ldd.qa_review";
  if (taskCategory === "cp_checklist") return "law_firm.closing.checklist";
  return "law_firm.matter.task_review";
}

function statusColumn(taskStatus) {
  const normalized = String(taskStatus ?? "open");
  return TASK_COLUMNS.find((column) => column.status_values.includes(normalized))?.task_column_id ?? "open";
}

function dueStatus(dueDate, generatedAt) {
  const today = new Date(`${generatedAt.slice(0, 10)}T00:00:00.000Z`);
  const due = new Date(`${dueDate}T00:00:00.000Z`);
  const deltaDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (deltaDays < 0) return "overdue";
  if (deltaDays === 0) return "due_today";
  if (deltaDays <= 7) return "due_soon";
  return "upcoming";
}

function normalizeDate(value, generatedAt) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value)) return value.slice(0, 10);
  return generatedAt.slice(0, 10);
}

function stripEmbeddedWorkflowBinding(record) {
  const { workflow_binding: _workflowBinding, ...rest } = record;
  return rest;
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

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    checkpoint_id: checkpointId,
    checkpoint_status: passed ? "passed" : "failed",
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

async function readSourceArtifacts(inputs) {
  const sources = [
    { source_id: "matter_document_index", source_kind: "artifact", path: inputs.matter_document_index_path },
    { source_id: "matter_timeline", source_kind: "artifact", path: inputs.matter_timeline_path },
    { source_id: "matter_os_profile", source_kind: "artifact", path: inputs.matter_os_profile_path },
    { source_id: "workflow_run_dashboard", source_kind: "artifact", path: inputs.workflow_run_dashboard_path },
    { source_id: "output_catalog", source_kind: "artifact", path: inputs.output_catalog_path },
    { source_id: "delivery_queue", source_kind: "artifact", path: inputs.delivery_queue_path },
    ...inputs.matter_files.map((matterPath, index) => ({
      source_id: `matter_file_${index + 1}`,
      source_kind: "matter_file",
      path: matterPath,
    })),
  ];
  return Promise.all(sources.map(readSource));
}

async function readSource(source) {
  const result = await readJsonOrError(source.path);
  return {
    ...source,
    available: result.available,
    value: result.value,
    error: result.error,
    content_hash: result.content_hash,
  };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      value: JSON.parse(raw),
      error: null,
      content_hash: `sha256:${sha256(raw)}`,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: null,
      error: error.message,
      content_hash: null,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      value: raw,
      error: null,
      content_hash: `sha256:${sha256(raw)}`,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: null,
      error: error.message,
      content_hash: null,
    };
  }
}

function normalizeInputs(options) {
  return {
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.matterDocumentIndexPath),
    matter_timeline_path: path.resolve(options.matterTimelinePath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.matterTimelinePath),
    matter_os_profile_path: path.resolve(options.matterOsProfilePath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.matterOsProfilePath),
    workflow_run_dashboard_path: path.resolve(options.workflowRunDashboardPath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.workflowRunDashboardPath),
    matter_files: (options.matterFiles ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.matterFiles).map((matterPath) => path.resolve(matterPath)),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.outputCatalogPath),
    delivery_queue_path: path.resolve(options.deliveryQueuePath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.deliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_TASK_BOARD_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter-document-index") parsed.matterDocumentIndexPath = argv[++index];
    else if (arg === "--matter-timeline") parsed.matterTimelinePath = argv[++index];
    else if (arg === "--matter-os-profile") parsed.matterOsProfilePath = argv[++index];
    else if (arg === "--workflow-run-dashboard") parsed.workflowRunDashboardPath = argv[++index];
    else if (arg === "--matter-file") {
      parsed.matterFiles = parsed.matterFiles ?? [];
      parsed.matterFiles.push(argv[++index]);
    } else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-task-board.mjs [options]

Options:
  --check                         Fail if validation does not pass
  --out-dir <path>                Output directory
  --matter-document-index <path>  Matter Document Index artifact
  --matter-timeline <path>        Matter Timeline artifact
  --matter-os-profile <path>      Matter OS Profile artifact
  --workflow-run-dashboard <path> Workflow Run Dashboard artifact
  --matter-file <path>            Matter file; may be repeated
  --output-catalog <path>         Output catalog artifact
  --delivery-queue <path>         Protected delivery queue artifact
  --package <path>                package.json path
  --roadmap <path>                roadmap/ledger path
  --run-at <iso>                  Deterministic generated_at timestamp
`);
}

function renderMatterTaskBoardMarkdown(result) {
  const lines = [];
  lines.push("# Matter Task Board");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_task_board_status}`);
  lines.push(`Tasks: ${result.summary.task_record_count}`);
  lines.push(`Workflow bindings: ${result.summary.workflow_bound_task_count}/${result.summary.task_record_count}`);
  lines.push(`Owners: ${result.summary.task_with_owner_count}/${result.summary.task_record_count}`);
  lines.push(`Due dates: ${result.summary.task_with_due_date_count}/${result.summary.task_record_count}`);
  lines.push(`Desktop boundary: ${result.summary.desktop_boundary_status}, read-only=${result.summary.desktop_read_only}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("| Due | Matter | Column | Owner | Status | Task | Workflow |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const record of result.task_records) {
    lines.push(`| ${record.due_date} | ${record.matter_id} | ${record.task_column_id} | ${record.task_owner} | ${record.task_status} | ${record.task_title} | ${record.workflow_binding_status} |`);
  }
  lines.push("");
  lines.push("Human review note: Matter Task Board rows are operational context only. They do not provide legal advice, generate client-facing output, write matter data, transition workflow state, execute runtime actions, or deliver outputs; attorney/human review remains required.");
  return `${lines.join("\n")}\n`;
}

function serializableMatterTaskBoard(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareTaskRecords(left, right) {
  return String(left.due_date).localeCompare(String(right.due_date))
    || String(left.matter_id).localeCompare(String(right.matter_id))
    || String(left.task_column_id).localeCompare(String(right.task_column_id))
    || String(left.task_id).localeCompare(String(right.task_id));
}

function buildSortKey(record) {
  return `${record.due_date}|${record.matter_id}|${record.task_column_id}|${record.task_id}`;
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (!value) continue;
    const list = grouped.get(value) ?? [];
    list.push(item);
    grouped.set(value, list);
  }
  return grouped;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
