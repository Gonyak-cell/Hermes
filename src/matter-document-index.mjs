import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_DOCUMENT_INDEX_OUT_DIR = "artifacts/matter-document-index/latest";
export const DEFAULT_MATTER_DOCUMENT_INDEX_INPUTS = {
  matterTimelinePath: "artifacts/matter-timeline/latest/matter-timeline.json",
  matterFiles: [
    "examples/project-alpha-matter.json",
    "examples/project-beta-litigation-matter.json",
  ],
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  deliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "matter-document-index.v1";
const SOURCE_OF_TRUTH = "matter_files_timeline_and_output_artifacts";
const DOCUMENT_ROLES = ["original", "draft", "submitted", "counterparty_proposal"];
const ROLE_RANK = new Map([
  ["original", 1],
  ["counterparty_proposal", 2],
  ["draft", 3],
  ["submitted", 4],
]);
const STATUS_RANK = new Map([
  ["missing", 1],
  ["requested", 2],
  ["open", 3],
  ["received", 4],
  ["in-review", 5],
  ["pending_review", 6],
  ["planned", 7],
  ["approved", 8],
  ["delivered", 9],
]);

export async function runMatterDocumentIndex(options = {}) {
  const result = await buildMatterDocumentIndex(options);
  if (options.write !== false) await writeMatterDocumentIndex(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter document index validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterDocumentIndex(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_DOCUMENT_INDEX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const matterFileReads = sourceReads.filter((source) => source.source_kind === "matter_file");
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const matterTimeline = sourceById.matter_timeline;
  const outputCatalog = sourceById.output_catalog;
  const deliveryQueue = sourceById.delivery_queue;
  const timelineEventBySourceRecord = buildTimelineEventBySourceRecord(matterTimeline);
  const deliveryByArtifactId = buildDeliveryByArtifactId(deliveryQueue);
  const baseRecords = buildMatterDocumentRecords({
    generatedAt,
    matterFileReads,
    matterTimeline,
    outputCatalog,
    deliveryByArtifactId,
    timelineEventBySourceRecord,
  });
  const documentRecords = markLatestDocuments(baseRecords);
  const documentFamilies = buildDocumentFamilies(documentRecords, generatedAt);
  const latestDocuments = documentRecords.filter((record) => record.is_latest).sort(compareDocumentRecords);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matterTimeline,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    documentRecords,
    documentFamilies,
    latestDocuments,
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
  const summary = summarizeMatterDocumentIndex({
    matterTimeline,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    documentRecords,
    documentFamilies,
    latestDocuments,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    matter_document_index_id: `matter-document-index.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    matter_document_index_status: summary.matter_document_index_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    matter_document_index_contract: buildContract(generatedAt),
    document_records: documentRecords,
    document_families: documentFamilies,
    latest_documents: latestDocuments,
    matter_document_index_desktop_boundary: desktopBoundary,
    matter_document_index_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMatterDocumentIndexMarkdown(result),
  };
}

export async function writeMatterDocumentIndex(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterDocumentIndex(result);
  await writeJson(path.join(outDir, "matter-document-index.json"), serializable);
  await writeJson(path.join(outDir, "matter-document-records.json"), {
    schema_version: "matter-document-records.v1",
    generated_at: result.generated_at,
    document_record_count: result.document_records.length,
    document_records: result.document_records,
  });
  await writeJson(path.join(outDir, "matter-document-families.json"), {
    schema_version: "matter-document-families.v1",
    generated_at: result.generated_at,
    document_family_count: result.document_families.length,
    document_families: result.document_families,
  });
  await writeJson(path.join(outDir, "matter-latest-documents.json"), {
    schema_version: "matter-latest-documents.v1",
    generated_at: result.generated_at,
    latest_document_count: result.latest_documents.length,
    latest_documents: result.latest_documents,
  });
  await writeJson(path.join(outDir, "matter-document-index-boundary.json"), {
    schema_version: "matter-document-index-boundary-artifact.v1",
    generated_at: result.generated_at,
    matter_document_index_desktop_boundary: result.matter_document_index_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-document-index-validation-report.v1",
    generated_at: result.generated_at,
    matter_document_index_id: result.matter_document_index_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterDocumentIndexCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterDocumentIndex(args);
    console.log(`Matter document index ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_document_index_status}`);
    console.log(`Documents: ${result.summary.document_record_count}`);
    console.log(`Families: ${result.summary.document_family_count}`);
    console.log(`Roles: original=${result.summary.original_document_count}, draft=${result.summary.draft_document_count}, submitted=${result.summary.submitted_document_count}, counterparty=${result.summary.counterparty_proposal_count}`);
    console.log(`Latest documents: ${result.summary.latest_document_count}`);
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
    schema_version: "matter-document-index-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    document_role_rule: "original_draft_submitted_and_counterparty_proposal_documents_are_classified_as_distinct_roles",
    latest_document_rule: "each_document_family_has_one_latest_document_selected_by_version_date_status_and_role_rank",
    matter_boundary_rule: "every_document_record_carries_one_matter_id_and_never_merges_confidential_context_across_matters",
    attorney_review_rule: "document_index_rows_are_operational_context_only_and_do_not_create_legal_or_client_facing_outputs",
    desktop_companion_rule: "desktop_companion_reads_document_index_records_families_latest_documents_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_write_matter_data_execute_runtime_actions_or_deliver_outputs",
    created_at: generatedAt,
  };
}

function buildMatterDocumentRecords({
  generatedAt,
  matterFileReads,
  matterTimeline,
  outputCatalog,
  deliveryByArtifactId,
  timelineEventBySourceRecord,
}) {
  const records = [];
  for (const matterRead of matterFileReads) {
    if (!matterRead.value?.matter_id) continue;
    records.push(...buildMatterFileDocumentRecords(matterRead, generatedAt, timelineEventBySourceRecord));
  }
  records.push(...buildOutputSubmittedDocumentRecords(outputCatalog, deliveryByArtifactId, generatedAt));
  records.push(...buildTimelineSubmittedDocumentRecords(matterTimeline, generatedAt, records));
  return records.sort(compareDocumentRecords);
}

function buildMatterFileDocumentRecords(matterRead, generatedAt, timelineEventBySourceRecord) {
  const matter = matterRead.value;
  const matterId = matter.matter_id;
  const owner = matter.matter_profile?.responsible_partner ?? matter.review_workflow?.default_reviewer ?? null;
  const defaultReviewStatus = matter.confidentiality?.human_approval_required === true ? "pending_review" : "internal_review";
  const records = [];
  const seenSourceRecordIds = new Set();

  for (const document of matter.documents ?? []) {
    seenSourceRecordIds.add(document.id);
    const role = classifyMatterDocumentRole(document);
    const timelineEvent = timelineEventBySourceRecord.get(sourceRecordKey(matterId, document.id));
    records.push(documentRecord({
      generatedAt,
      matterId,
      documentRole: role,
      title: document.title ?? document.id,
      documentType: document.type ?? "document",
      documentStatus: document.status ?? "unknown",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath: matterRead.path,
      sourceRecordId: document.id,
      sourceUri: null,
      documentDate: document.date ?? timelineEvent?.event_date ?? generatedAt.slice(0, 10),
      owner,
      issue: document.issue ?? null,
      reviewStatus: document.status === "approved" ? "approved" : defaultReviewStatus,
      confidence: document.status === "missing" || document.status === "requested" ? "expected_record" : "source_record",
      metadata: {
        source_document_status: document.status ?? null,
        timeline_event_id: timelineEvent?.event_id ?? null,
      },
    }));
  }

  for (const item of matter.deal_control?.vdr_requests ?? []) {
    records.push(documentRecord({
      generatedAt,
      matterId,
      documentRole: "original",
      title: item.title ?? item.id,
      documentType: "vdr_request",
      documentStatus: item.status ?? "requested",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath: matterRead.path,
      sourceRecordId: item.id,
      sourceUri: null,
      documentDate: item.due ?? generatedAt.slice(0, 10),
      owner: item.owner ?? owner,
      issue: item.issue ?? null,
      reviewStatus: defaultReviewStatus,
      confidence: item.status === "missing" || item.status === "requested" ? "expected_record" : "source_record",
      metadata: {
        source_collection: "deal_control.vdr_requests",
      },
    }));
  }

  for (const item of matter.deal_control?.cp_checklist ?? []) {
    if (item.evidence && seenSourceRecordIds.has(item.evidence)) continue;
    records.push(documentRecord({
      generatedAt,
      matterId,
      documentRole: item.evidence ? "draft" : "original",
      title: item.title ?? item.id,
      documentType: "closing_deliverable",
      documentStatus: item.status ?? "open",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath: matterRead.path,
      sourceRecordId: item.id,
      sourceUri: null,
      documentDate: item.due ?? generatedAt.slice(0, 10),
      owner: item.owner ?? owner,
      issue: null,
      reviewStatus: defaultReviewStatus,
      confidence: item.evidence ? "linked_evidence" : "expected_record",
      metadata: {
        source_collection: "deal_control.cp_checklist",
        evidence: item.evidence ?? null,
      },
    }));
  }

  for (const item of matter.litigation_control?.evidence ?? []) {
    if (seenSourceRecordIds.has(item.id)) continue;
    const timelineEvent = timelineEventBySourceRecord.get(sourceRecordKey(matterId, item.id));
    records.push(documentRecord({
      generatedAt,
      matterId,
      documentRole: "original",
      title: item.title ?? item.id,
      documentType: item.type ?? "evidence",
      documentStatus: item.status ?? "received",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath: matterRead.path,
      sourceRecordId: item.id,
      sourceUri: null,
      documentDate: timelineEvent?.event_date ?? generatedAt.slice(0, 10),
      owner,
      issue: null,
      reviewStatus: defaultReviewStatus,
      confidence: "source_record",
      metadata: {
        source_collection: "litigation_control.evidence",
        timeline_event_id: timelineEvent?.event_id ?? null,
      },
    }));
  }

  for (const item of matter.deal_control?.negotiation_points ?? []) {
    if (!isCounterpartyProposal(item)) continue;
    records.push(documentRecord({
      generatedAt,
      matterId,
      documentRole: "counterparty_proposal",
      title: `Counterparty proposal: ${item.clause ?? item.title ?? item.id}`,
      documentType: "counterparty_position",
      documentStatus: item.status ?? "open",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath: matterRead.path,
      sourceRecordId: item.id,
      sourceUri: null,
      documentDate: generatedAt.slice(0, 10),
      owner: item.owner ?? owner,
      issue: item.open_issue ?? null,
      reviewStatus: defaultReviewStatus,
      confidence: "source_record",
      metadata: {
        clause: item.clause ?? null,
        position: item.position ?? null,
        open_issue: item.open_issue ?? null,
        severity: item.severity ?? null,
      },
    }));
  }

  return records;
}

function buildOutputSubmittedDocumentRecords(outputCatalog, deliveryByArtifactId, generatedAt) {
  const records = [];
  for (const artifact of outputCatalog?.artifacts ?? []) {
    if (artifact.domain_pack !== "law-firm") continue;
    const delivery = deliveryByArtifactId.get(artifact.artifact_id);
    records.push(documentRecord({
      generatedAt,
      matterId: artifact.matter_id,
      documentRole: "submitted",
      title: artifact.metadata?.title ?? artifact.artifact_id,
      documentType: artifact.artifact_type ?? "output_artifact",
      documentStatus: artifact.status ?? "pending_review",
      sourceKind: "output_catalog",
      sourceId: artifact.source_id ?? "output_catalog",
      sourcePath: null,
      sourceRecordId: artifact.artifact_id,
      sourceUri: artifact.artifact_uri ?? null,
      documentDate: artifact.created_at ?? generatedAt,
      owner: null,
      issue: null,
      reviewStatus: artifact.approval_status === "pending" ? "pending_review" : artifact.status ?? "pending_review",
      confidence: "source_record",
      metadata: {
        artifact_id: artifact.artifact_id,
        domain_pack: artifact.domain_pack,
        capability_id: artifact.capability_id ?? null,
        workflow_run_id: artifact.workflow_run_id ?? null,
        delivery_target: delivery?.delivery_target ?? null,
        delivery_status: delivery?.delivery_status ?? artifact.delivery_state ?? null,
        approval_id: artifact.approval_id ?? delivery?.required_approval_id ?? null,
        approval_status: artifact.approval_status ?? delivery?.approval_status ?? null,
        protected_action: delivery?.protected_action === true,
      },
    }));
  }
  return records;
}

function buildTimelineSubmittedDocumentRecords(matterTimeline, generatedAt, existingRecords) {
  const existingSourceRecordIds = new Set(existingRecords.map((record) => record.source_record_id).filter(Boolean));
  const records = [];
  for (const event of matterTimeline?.matter_timeline_events ?? []) {
    if (event.event_type !== "submission") continue;
    if (existingSourceRecordIds.has(event.source_record_id)) continue;
    records.push(documentRecord({
      generatedAt,
      matterId: event.matter_id,
      documentRole: "submitted",
      title: `Planned submission: ${event.event_title}`,
      documentType: event.event_subtype ?? "submission",
      documentStatus: event.event_status ?? "planned",
      sourceKind: "matter_timeline",
      sourceId: event.source_id ?? "matter_timeline",
      sourcePath: event.source_path ?? null,
      sourceRecordId: event.source_record_id ?? event.event_id,
      sourceUri: null,
      documentDate: event.event_at ?? event.event_date ?? generatedAt,
      owner: event.owner ?? null,
      issue: null,
      reviewStatus: event.review_status ?? "pending_review",
      confidence: "timeline_projection",
      metadata: {
        timeline_event_id: event.event_id,
        event_subtype: event.event_subtype ?? null,
      },
    }));
  }
  return records;
}

function documentRecord({
  generatedAt,
  matterId,
  documentRole,
  title,
  documentType,
  documentStatus,
  sourceKind,
  sourceId,
  sourcePath,
  sourceRecordId,
  sourceUri,
  documentDate,
  owner,
  issue,
  reviewStatus,
  confidence,
  metadata = {},
}) {
  const documentAt = normalizeEventAt(documentDate, generatedAt);
  const { versionLabel, versionNumber } = parseVersion(title);
  const familyId = buildDocumentFamilyId(matterId, title, documentRole, documentType);
  const documentId = `matter-document.${slugify(matterId)}.${slugify(documentRole)}.${slugify(sourceRecordId ?? title)}`;
  return {
    schema_version: "matter-document-record.v1",
    document_id: documentId,
    matter_id: matterId,
    document_family_id: familyId,
    document_role: documentRole,
    document_title: title,
    document_type: documentType,
    version_label: versionLabel,
    version_number: versionNumber,
    document_status: documentStatus,
    document_date: documentAt.slice(0, 10),
    document_at: documentAt,
    is_latest: false,
    source_kind: sourceKind,
    source_id: sourceId,
    source_path: sourcePath,
    source_uri: sourceUri,
    source_record_id: sourceRecordId ?? null,
    owner: owner ?? null,
    issue,
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

function markLatestDocuments(records) {
  const grouped = groupBy(records, "document_family_id");
  const latestIds = new Set();
  for (const familyRecords of grouped.values()) {
    const latest = [...familyRecords].sort(compareLatestCandidates)[0];
    if (latest) latestIds.add(latest.document_id);
  }
  return records.map((record) => ({
    ...record,
    is_latest: latestIds.has(record.document_id),
  })).sort(compareDocumentRecords);
}

function buildDocumentFamilies(records, generatedAt) {
  const grouped = groupBy(records, "document_family_id");
  const families = [];
  for (const [familyId, familyRecords] of grouped.entries()) {
    const sortedRecords = [...familyRecords].sort(compareDocumentRecords);
    const latest = sortedRecords.find((record) => record.is_latest) ?? [...familyRecords].sort(compareLatestCandidates)[0];
    const roles = unique(familyRecords.map((record) => record.document_role)).sort();
    families.push({
      schema_version: "matter-document-family.v1",
      document_family_id: familyId,
      matter_id: latest?.matter_id ?? sortedRecords[0]?.matter_id ?? null,
      canonical_title: latest?.document_title ?? sortedRecords[0]?.document_title ?? familyId,
      document_type: latest?.document_type ?? sortedRecords[0]?.document_type ?? "document",
      record_count: familyRecords.length,
      document_roles: roles,
      has_original: roles.includes("original"),
      has_draft: roles.includes("draft"),
      has_submitted: roles.includes("submitted"),
      has_counterparty_proposal: roles.includes("counterparty_proposal"),
      latest_document_id: latest?.document_id ?? null,
      latest_document_role: latest?.document_role ?? null,
      latest_document_status: latest?.document_status ?? null,
      latest_document_at: latest?.document_at ?? null,
      family_status: latest ? "indexed" : "blocked",
      attorney_review_required: true,
      human_review_required: true,
      legal_advice_provided: false,
      client_facing_output_generated: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      created_at: generatedAt,
    });
  }
  return families.sort(by("document_family_id"));
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "matter-document-index-desktop-boundary.v1",
    boundary_id: "matter-document-index-desktop-boundary.read-only",
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
    supported_document_roles: DOCUMENT_ROLES,
    created_at: generatedAt,
  };
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  matterTimeline,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  documentRecords,
  documentFamilies,
  latestDocuments,
  desktopBoundary,
}) {
  const sourceAvailable = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.available === true;
  const matterFileAvailableCount = matterFileReads.filter((source) => source.available).length;
  const matterFileWithMatterIdCount = matterFileReads.filter((source) => Boolean(source.value?.matter_id)).length;
  const roleCounts = countDocumentRoles(documentRecords);
  const packageScriptPresent = Boolean(packageJson?.scripts?.["matter:document-index"]);
  const roadmapSlotDeclared = typeof roadmapText === "string" && /P234\s*\|\s*matter document index/i.test(roadmapText);
  const lawFirmArtifactCount = outputCatalog?.summary?.by_domain_pack?.["law-firm"] ?? outputCatalog?.artifacts?.filter((artifact) => artifact.domain_pack === "law-firm").length ?? 0;
  const lawFirmDeliveryCount = deliveryQueue?.summary?.law_firm_action_count ?? deliveryQueue?.delivery_actions?.filter((action) => action.domain_pack === "law-firm").length ?? 0;
  const latestFamilyIds = new Set(latestDocuments.map((record) => record.document_family_id));

  return [
    checkpoint("source_matter_timeline_available", sourceAvailable("matter_timeline"), "Matter Timeline source is readable."),
    checkpoint("source_output_catalog_available", sourceAvailable("output_catalog"), "Output catalog source is readable."),
    checkpoint("source_delivery_queue_available", sourceAvailable("delivery_queue"), "Protected delivery queue source is readable."),
    checkpoint("source_matter_timeline_complete", matterTimeline?.summary?.matter_timeline_status === "complete", "Matter Timeline source is complete."),
    checkpoint("source_output_catalog_contains_law_firm_outputs", lawFirmArtifactCount > 0, "Output catalog contains law-firm submitted/review artifacts."),
    checkpoint("source_delivery_queue_contains_law_firm_actions", lawFirmDeliveryCount > 0, "Protected delivery queue contains law-firm delivery actions."),
    checkpoint("matter_files_available", matterFileAvailableCount === matterFileReads.length && matterFileReads.length > 0, "Configured matter files are readable.", { passed_count: matterFileAvailableCount, expected_count: matterFileReads.length }),
    checkpoint("matter_files_scoped_by_matter_id", matterFileWithMatterIdCount === matterFileReads.length && matterFileReads.length > 0, "Every configured matter file carries matter_id.", { passed_count: matterFileWithMatterIdCount, expected_count: matterFileReads.length }),
    checkpoint("package_script_registered", packageScriptPresent, "package.json exposes matter:document-index."),
    checkpoint("roadmap_slot_declared", roadmapSlotDeclared, "P234 matter document index planned slot is declared."),
    checkpoint("document_records_created", documentRecords.length > 0, "Matter document records are created."),
    checkpoint("original_documents_classified", roleCounts.original > 0, "Original/source documents are classified.", { passed_count: roleCounts.original, expected_count: 1 }),
    checkpoint("draft_documents_classified", roleCounts.draft > 0, "Draft documents are classified.", { passed_count: roleCounts.draft, expected_count: 1 }),
    checkpoint("submitted_documents_classified", roleCounts.submitted > 0, "Submitted/review packet documents are classified.", { passed_count: roleCounts.submitted, expected_count: 1 }),
    checkpoint("counterparty_proposals_classified", roleCounts.counterparty_proposal > 0, "Counterparty proposal documents are classified.", { passed_count: roleCounts.counterparty_proposal, expected_count: 1 }),
    checkpoint("document_families_created", documentFamilies.length > 0, "Document families are created."),
    checkpoint("latest_documents_identified", latestDocuments.length === documentFamilies.length && documentFamilies.length > 0 && latestFamilyIds.size === documentFamilies.length, "Every document family has one latest document.", { passed_count: latestDocuments.length, expected_count: documentFamilies.length }),
    checkpoint("document_records_scoped_by_matter_id", documentRecords.every((record) => Boolean(record.matter_id)), "Every document record is scoped by matter_id.", { passed_count: documentRecords.filter((record) => Boolean(record.matter_id)).length, expected_count: documentRecords.length }),
    checkpoint("attorney_review_gate_preserved", documentRecords.every((record) => record.attorney_review_required === true), "Attorney review remains required for law-firm document index context."),
    checkpoint("human_review_gate_preserved", documentRecords.every((record) => record.human_review_required === true), "Human review remains required for law-firm document index context."),
    checkpoint("no_legal_or_client_facing_output", documentRecords.every((record) => record.legal_advice_provided === false && record.client_facing_output_generated === false), "Matter document index does not provide legal advice or generate client-facing output."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and not source of truth."),
  ];
}

function summarizeMatterDocumentIndex({
  matterTimeline,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  documentRecords,
  documentFamilies,
  latestDocuments,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const roleCounts = countDocumentRoles(documentRecords);
  const failedCheckpointCount = checkpoints.filter((checkpoint) => checkpoint.status !== "passed").length;
  const complete = validation.valid
    && failedCheckpointCount === 0
    && documentRecords.length > 0
    && documentFamilies.length > 0
    && DOCUMENT_ROLES.every((role) => roleCounts[role] > 0)
    && latestDocuments.length === documentFamilies.length
    && latestDocuments.length > 0
    && documentRecords.every((record) => Boolean(record.matter_id));
  return {
    matter_document_index_status: complete ? "complete" : "blocked",
    matter_document_index_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_timeline_status: matterTimeline?.summary?.matter_timeline_status ?? "unknown",
    source_output_catalog_status: outputCatalog?.schema_version === "output-artifact-catalog.v1" ? "complete" : "unknown",
    source_delivery_queue_status: deliveryQueue?.schema_version === "protected-delivery-queue.v1" ? "complete" : "unknown",
    matter_file_count: matterFileReads.length,
    available_matter_file_count: matterFileReads.filter((source) => source.available).length,
    matter_file_with_matter_id_count: matterFileReads.filter((source) => Boolean(source.value?.matter_id)).length,
    document_record_count: documentRecords.length,
    document_family_count: documentFamilies.length,
    original_document_count: roleCounts.original,
    draft_document_count: roleCounts.draft,
    submitted_document_count: roleCounts.submitted,
    counterparty_proposal_count: roleCounts.counterparty_proposal,
    latest_document_count: latestDocuments.length,
    family_with_latest_document_count: new Set(latestDocuments.map((record) => record.document_family_id)).size,
    matter_id_scoped_document_count: documentRecords.filter((record) => Boolean(record.matter_id)).length,
    attorney_review_required_document_count: documentRecords.filter((record) => record.attorney_review_required === true).length,
    human_review_required_document_count: documentRecords.filter((record) => record.human_review_required === true).length,
    pending_review_document_count: documentRecords.filter((record) => record.review_status === "pending_review").length,
    blocked_delivery_submitted_document_count: documentRecords.filter((record) => record.document_role === "submitted" && String(record.metadata?.delivery_status ?? "").startsWith("blocked")).length,
    legal_advice_provided: documentRecords.some((record) => record.legal_advice_provided === true),
    client_facing_output_generated: documentRecords.some((record) => record.client_facing_output_generated === true),
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
    readJsonSource("matter_timeline", inputs.matter_timeline_path, "artifact"),
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
    schema_version: "matter-document-index-checkpoint.v1",
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
    matter_timeline_path: path.resolve(options.matterTimelinePath ?? DEFAULT_MATTER_DOCUMENT_INDEX_INPUTS.matterTimelinePath),
    matter_files: normalizeMatterFiles(options.matterFiles ?? DEFAULT_MATTER_DOCUMENT_INDEX_INPUTS.matterFiles).map((filePath) => path.resolve(filePath)),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_MATTER_DOCUMENT_INDEX_INPUTS.outputCatalogPath),
    delivery_queue_path: path.resolve(options.deliveryQueuePath ?? DEFAULT_MATTER_DOCUMENT_INDEX_INPUTS.deliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_DOCUMENT_INDEX_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_DOCUMENT_INDEX_INPUTS.roadmapPath),
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
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter-timeline") parsed.matterTimelinePath = argv[++index];
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
  console.log(`Usage: node scripts/matter-document-index.mjs [options]

Options:
  --check                              fail when validation errors exist
  --out-dir <path>                    output directory
  --matter-timeline <path>            Matter Timeline path
  --matter-file <path>                matter file path; can be repeated
  --matter-files <a,b>                comma-separated matter file paths
  --output-catalog <path>             output artifact catalog path
  --delivery-queue <path>             protected delivery queue path
  --package <path>                    package.json path
  --roadmap <path>                    final phase ledger path
  --run-at <iso>                      deterministic generated_at timestamp
`);
}

function renderMatterDocumentIndexMarkdown(result) {
  const lines = [];
  lines.push("# Matter Document Index");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_document_index_status}`);
  lines.push(`Documents: ${result.summary.document_record_count}`);
  lines.push(`Families: ${result.summary.document_family_count}`);
  lines.push(`Roles: original=${result.summary.original_document_count}, draft=${result.summary.draft_document_count}, submitted=${result.summary.submitted_document_count}, counterparty=${result.summary.counterparty_proposal_count}`);
  lines.push(`Latest documents: ${result.summary.latest_document_count}/${result.summary.document_family_count}`);
  lines.push(`Desktop boundary: ${result.summary.desktop_boundary_status}, read-only=${result.summary.desktop_read_only}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("| Matter | Role | Latest | Status | Title | Source |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const record of result.document_records) {
    lines.push(`| ${record.matter_id} | ${record.document_role} | ${record.is_latest} | ${record.document_status} | ${record.document_title} | ${record.source_kind} |`);
  }
  lines.push("");
  lines.push("Human review note: Matter Document Index rows are operational context only. They do not provide legal advice, generate client-facing output, write matter data, execute runtime actions, or deliver outputs; attorney/human review remains required.");
  return `${lines.join("\n")}\n`;
}

function serializableMatterDocumentIndex(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildTimelineEventBySourceRecord(matterTimeline) {
  return new Map((matterTimeline?.matter_timeline_events ?? []).map((event) => [sourceRecordKey(event.matter_id, event.source_record_id), event]));
}

function buildDeliveryByArtifactId(deliveryQueue) {
  return new Map((deliveryQueue?.delivery_actions ?? []).map((action) => [action.artifact_id, action]));
}

function classifyMatterDocumentRole(document) {
  const text = `${document.title ?? ""} ${document.type ?? ""} ${document.status ?? ""}`.toLowerCase();
  if (/\b(markup|draft|memo|contract)\b/.test(text) && document.status !== "received") return "draft";
  return "original";
}

function isCounterpartyProposal(item) {
  const text = `${item.open_issue ?? ""} ${item.position ?? ""} ${item.clause ?? ""}`.toLowerCase();
  return /\b(buyer counsel|counterparty|opposing counsel|other side)\b/.test(text);
}

function buildDocumentFamilyId(matterId, title, documentRole, documentType) {
  const normalizedTitle = String(title ?? "document")
    .replace(/\bv\d+\b/gi, "")
    .replace(/\b(markup|draft|counterparty proposal|planned submission|received document)\b/gi, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  const roleScope = documentRole === "counterparty_proposal" ? "counterparty" : documentType;
  return `matter-document-family.${slugify(matterId)}.${slugify(roleScope)}.${slugify(normalizedTitle)}`;
}

function parseVersion(title) {
  const match = String(title ?? "").match(/\bv(\d+)\b/i);
  if (!match) return { versionLabel: null, versionNumber: 1 };
  return {
    versionLabel: `v${match[1]}`,
    versionNumber: Number(match[1]),
  };
}

function countDocumentRoles(records) {
  return Object.fromEntries(DOCUMENT_ROLES.map((role) => [
    role,
    records.filter((record) => record.document_role === role).length,
  ]));
}

function compareDocumentRecords(left, right) {
  return String(left.matter_id).localeCompare(String(right.matter_id))
    || String(left.document_family_id).localeCompare(String(right.document_family_id))
    || String(left.document_at).localeCompare(String(right.document_at))
    || String(left.document_id).localeCompare(String(right.document_id));
}

function compareLatestCandidates(left, right) {
  return (right.version_number ?? 0) - (left.version_number ?? 0)
    || String(right.document_at).localeCompare(String(left.document_at))
    || (STATUS_RANK.get(right.document_status) ?? 0) - (STATUS_RANK.get(left.document_status) ?? 0)
    || (ROLE_RANK.get(right.document_role) ?? 0) - (ROLE_RANK.get(left.document_role) ?? 0)
    || String(left.document_id).localeCompare(String(right.document_id));
}

function normalizeEventAt(value, generatedAt) {
  if (!value) return generatedAt;
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text}T00:00:00.000Z`;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? generatedAt : date.toISOString();
}

function sourceRecordKey(matterId, sourceRecordId) {
  return `${matterId}::${sourceRecordId ?? ""}`;
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
