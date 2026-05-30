import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CHAIN_OF_CUSTODY_OUT_DIR = "artifacts/chain-of-custody/latest";
export const DEFAULT_CHAIN_OF_CUSTODY_INPUTS = {
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  evidenceFlagsPath: "artifacts/evidence-flags/latest/evidence-flags.json",
  exhibitMapPath: "artifacts/exhibit-map/latest/exhibit-map.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CHAIN_OF_CUSTODY_CONTRACT_ID = "chain-of-custody-events.v1";
const CUSTODY_EVENT_SCHEMA_VERSION = "custody-event.v1";
const CUSTODY_EVENT_LINK_SCHEMA_VERSION = "custody-event-link.v1";
const CUSTODY_STAGE_INDEX_SCHEMA_VERSION = "custody-stage-index.v1";
const CUSTODY_STAGES = ["upload", "normalize", "extract", "review", "approve"];

export async function runChainOfCustodyEvents(options = {}) {
  const result = await buildChainOfCustodyEvents(options);
  if (options.write !== false) await writeChainOfCustodyEvents(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Chain of custody events failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildChainOfCustodyEvents(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CHAIN_OF_CUSTODY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceStoreInterface = await readJson(inputs.resource_store_interface_path);
  const resourceVersionLedger = await readJson(inputs.resource_version_ledger_path);
  const normalizedTextContract = await readJson(inputs.normalized_text_contract_path);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const evidenceItemStore = await readJson(inputs.evidence_item_store_path);
  const factClaimStore = await readJson(inputs.fact_claim_store_path);
  const issueGraphStore = await readJson(inputs.issue_graph_store_path);
  const citationObjectStore = await readJson(inputs.citation_object_store_path);
  const lineageGraph = await readJson(inputs.lineage_graph_path);
  const evidenceFlags = await readJson(inputs.evidence_flags_path);
  const exhibitMap = await readJson(inputs.exhibit_map_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const sourceStores = {
    resourceStoreInterface,
    resourceVersionLedger,
    normalizedTextContract,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
    lineageGraph,
    evidenceFlags,
    exhibitMap,
  };
  const catalogs = buildCatalogLookups(sourceStores);
  const custodyLedgerId = `chain-of-custody.${dateStamp(generatedAt)}`;
  const { custodyEvents, custodyEventLinks } = buildCustodyEventCatalog({
    generatedAt,
    custodyLedgerId,
    catalogs,
  });
  const custodyStageIndexes = buildCustodyStageIndexes(custodyEvents, generatedAt);
  const validationItems = validateChainOfCustodyEvents({
    packageText,
    roadmapText,
    sourceStores,
    catalogs,
    custodyEvents,
    custodyEventLinks,
    custodyStageIndexes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeChainOfCustody({
    sourceStores,
    catalogs,
    custodyEvents,
    custodyEventLinks,
    custodyStageIndexes,
    validationItems,
    validation,
  });

  const result = {
    schema_version: "chain-of-custody-events.v1",
    generated_at: generatedAt,
    custody_ledger_id: custodyLedgerId,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("resource_store_interface", resourceStoreInterface),
      summarizeSource("resource_version_ledger", resourceVersionLedger),
      summarizeSource("normalized_text_contract", normalizedTextContract),
      summarizeSource("source_span_store", sourceSpanStore),
      summarizeSource("evidence_item_store", evidenceItemStore),
      summarizeSource("fact_claim_store", factClaimStore),
      summarizeSource("issue_graph_store", issueGraphStore),
      summarizeSource("citation_object_store", citationObjectStore),
      summarizeSource("lineage_graph_builder", lineageGraph),
      summarizeSource("evidence_flags", evidenceFlags),
      summarizeSource("exhibit_map", exhibitMap),
    ],
    custody_event_contract: buildCustodyEventContract(generatedAt),
    custody_event_catalog: {
      schema_version: "custody-event-catalog.v1",
      generated_at: generatedAt,
      custody_events: custodyEvents,
      custody_event_links: custodyEventLinks,
      custody_stage_indexes: custodyStageIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderChainOfCustodyMarkdown(result),
  };
}

export async function writeChainOfCustodyEvents(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableChainOfCustody(result);
  await writeJson(path.join(outDir, "chain-of-custody-events.json"), serializable);
  await writeJson(path.join(outDir, "custody-events.json"), {
    schema_version: "custody-events.v1",
    generated_at: result.generated_at,
    custody_event_count: result.custody_event_catalog.custody_events.length,
    custody_events: result.custody_event_catalog.custody_events,
  });
  await writeJson(path.join(outDir, "custody-event-links.json"), {
    schema_version: "custody-event-links.v1",
    generated_at: result.generated_at,
    custody_event_link_count: result.custody_event_catalog.custody_event_links.length,
    custody_event_links: result.custody_event_catalog.custody_event_links,
  });
  await writeJson(path.join(outDir, "custody-stage-indexes.json"), {
    schema_version: "custody-stage-indexes.v1",
    generated_at: result.generated_at,
    custody_stage_indexes: result.custody_event_catalog.custody_stage_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    custody_ledger_id: result.custody_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runChainOfCustodyEventsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runChainOfCustodyEvents(args);
    console.log(`Chain of custody events written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.custody_event_ledger_status}`);
    console.log(`Events: ${result.summary.custody_event_count}`);
    console.log(`Chains: ${result.summary.custody_chain_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCustodyEventContract(generatedAt) {
  return {
    schema_version: "chain-of-custody-event-contract.v1",
    custody_event_contract_id: CHAIN_OF_CUSTODY_CONTRACT_ID,
    generated_at: generatedAt,
    custody_event_schema_version: CUSTODY_EVENT_SCHEMA_VERSION,
    custody_event_link_schema_version: CUSTODY_EVENT_LINK_SCHEMA_VERSION,
    custody_stage_index_schema_version: CUSTODY_STAGE_INDEX_SCHEMA_VERSION,
    required_stages: CUSTODY_STAGES,
    append_only_rule: "events_are_never_mutated; corrections must be new events",
    hash_rule: "each event hash covers canonical event content and previous chain hash",
    human_gate_rule: "review and approve stages remain pending until explicit human approval",
    output_rule: "no custody approval event makes a legal output client-facing",
  };
}

function buildCatalogLookups(stores) {
  const resourceStoreRecords = stores.resourceStoreInterface.resource_store_catalog?.resource_store_records ?? [];
  const resourceVersions = stores.resourceStoreInterface.resource_store_catalog?.resource_version_store_records ?? [];
  const versionEvents = stores.resourceVersionLedger.version_ledger_catalog?.version_events ?? [];
  const objectPathBindings = stores.resourceVersionLedger.version_ledger_catalog?.object_path_bindings ?? [];
  const normalizedArtifacts = stores.normalizedTextContract.normalized_text_catalog?.normalized_text_artifacts ?? [];
  const sourceSpans = stores.sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const evidenceItems = stores.evidenceItemStore.evidence_item_catalog?.evidence_items ?? [];
  const factClaims = stores.factClaimStore.fact_claim_catalog?.fact_claims ?? [];
  const issues = stores.issueGraphStore.issue_graph_catalog?.issues ?? [];
  const citations = stores.citationObjectStore.citation_catalog?.citations ?? [];
  const outputParagraphs = stores.citationObjectStore.citation_catalog?.output_paragraphs ?? [];
  const lineagePaths = stores.lineageGraph.lineage_graph_catalog?.lineage_paths ?? [];
  const evidenceFlagRecords = stores.evidenceFlags.evidence_flag_catalog?.evidence_flag_records ?? [];
  const exhibitRecords = stores.exhibitMap.exhibit_catalog?.exhibit_records ?? [];
  return {
    resourceVersions,
    resourceStoreRecords,
    versionEvents,
    objectPathBindings,
    normalizedArtifacts,
    sourceSpans,
    evidenceItems,
    factClaims,
    issues,
    citations,
    outputParagraphs,
    lineagePaths,
    evidenceFlagRecords,
    exhibitRecords,
    resourceVersionById: indexBy(resourceVersions, "resource_version_id"),
    resourceStoreRecordByResourceId: indexBy(resourceStoreRecords, "resource_id"),
    versionEventByResourceVersionId: indexBy(versionEvents, "resource_version_id"),
    objectPathBindingByResourceVersionId: indexBy(objectPathBindings, "resource_version_id"),
    normalizedArtifactById: indexBy(normalizedArtifacts, "normalized_text_artifact_id"),
    normalizedArtifactByResourceVersionId: indexBy(normalizedArtifacts, "resource_version_id"),
    sourceSpanById: indexBy(sourceSpans, "source_span_id"),
    evidenceItemById: indexBy(evidenceItems, "evidence_id"),
    factClaimById: indexBy(factClaims, "fact_id"),
    issueById: indexBy(issues, "issue_id"),
    citationById: indexBy(citations, "citation_id"),
    outputParagraphById: indexBy(outputParagraphs, "output_paragraph_id"),
    lineagePathById: indexBy(lineagePaths, "lineage_path_id"),
    evidenceFlagById: indexBy(evidenceFlagRecords, "evidence_flag_record_id"),
  };
}

function buildCustodyEventCatalog({ generatedAt, custodyLedgerId, catalogs }) {
  const custodyEvents = [];
  const custodyEventLinks = [];
  const chainState = new Map();
  let sequence = 0;

  const pushEvent = (eventInput) => {
    sequence += 1;
    const previous = chainState.get(eventInput.custody_chain_id);
    const chainSequence = (previous?.chain_sequence ?? 0) + 1;
    const eventCore = {
      schema_version: CUSTODY_EVENT_SCHEMA_VERSION,
      custody_event_id: `custody-event.${String(sequence).padStart(5, "0")}.${slugify(eventInput.event_stage)}.${slugify(eventInput.subject_ref?.subject_id)}`,
      custody_ledger_id: custodyLedgerId,
      custody_chain_id: eventInput.custody_chain_id,
      global_sequence: sequence,
      chain_sequence: chainSequence,
      previous_event_hash: previous?.event_hash ?? null,
      event_stage: eventInput.event_stage,
      event_type: eventInput.event_type,
      event_status: eventInput.event_status,
      append_only: true,
      immutable: true,
      event_time: generatedAt,
      actor: eventInput.actor ?? buildActor(eventInput.event_stage),
      tenant_id: eventInput.tenant_id,
      matter_id: eventInput.matter_id,
      classification: eventInput.classification,
      policy_snapshot_id: eventInput.policy_snapshot_id,
      subject_ref: eventInput.subject_ref,
      linked_refs: eventInput.linked_refs ?? [],
      custody_state: eventInput.custody_state,
      source_ref: eventInput.source_ref,
      metadata: eventInput.metadata ?? {},
    };
    const event = {
      ...eventCore,
      event_hash: hashValue(eventCore),
    };
    chainState.set(event.custody_chain_id, { chain_sequence: chainSequence, event_hash: event.event_hash });
    custodyEvents.push(event);
    custodyEventLinks.push(buildCustodyEventLink(event, generatedAt));
  };

  for (const resourceVersion of sortBy(catalogs.resourceVersions, "resource_version_id")) {
    const resourceRecord = catalogs.resourceStoreRecordByResourceId.get(resourceVersion.resource_id);
    const versionEvent = catalogs.versionEventByResourceVersionId.get(resourceVersion.resource_version_id);
    const objectPathBinding = catalogs.objectPathBindingByResourceVersionId.get(resourceVersion.resource_version_id);
    const policySnapshotId = resourceVersion.policy_snapshot_id ?? resourceRecord?.policy_snapshot_id;
    pushEvent({
      custody_chain_id: resourceChainId(resourceVersion.resource_version_id),
      event_stage: "upload",
      event_type: "resource_version_uploaded",
      event_status: versionEvent?.event_status ?? "recorded",
      tenant_id: resourceVersion.tenant_id,
      matter_id: resourceVersion.matter_id,
      classification: resourceVersion.classification,
      policy_snapshot_id: policySnapshotId,
      subject_ref: subjectRef("resource_version", resourceVersion.resource_version_id),
      linked_refs: [
        subjectRef("resource", resourceVersion.resource_id),
        subjectRef("resource_version_event", versionEvent?.version_event_id),
        subjectRef("object_path_binding", objectPathBinding?.object_path_binding_id),
      ],
      custody_state: custodyState({
        reviewStatus: resourceVersion.review_status ?? "not_requested",
        approvalStatus: "not_requested",
        humanReviewRequired: false,
        clientFacingReady: false,
      }),
      source_ref: sourceRef("resource_version_ledger", versionEvent?.schema_version, versionEvent?.version_event_id),
      metadata: {
        source_system: resourceVersion.source_system,
        external_id: resourceVersion.external_id,
        content_hash: resourceVersion.content_hash,
        object_key: objectPathBinding?.object_key ?? null,
      },
    });
  }

  for (const normalizedArtifact of sortBy(catalogs.normalizedArtifacts, "normalized_text_artifact_id")) {
    pushEvent({
      custody_chain_id: resourceChainId(normalizedArtifact.resource_version_id),
      event_stage: "normalize",
      event_type: "resource_text_normalized",
      event_status: normalizedArtifact.text_storage?.raw_source_binding_status === "bound" ? "normalized" : "needs_source_binding_review",
      tenant_id: normalizedArtifact.tenant_id,
      matter_id: normalizedArtifact.matter_id,
      classification: normalizedArtifact.classification,
      policy_snapshot_id: normalizedArtifact.policy_snapshot_id,
      subject_ref: subjectRef("normalized_text_artifact", normalizedArtifact.normalized_text_artifact_id),
      linked_refs: [
        subjectRef("resource", normalizedArtifact.resource_id),
        subjectRef("resource_version", normalizedArtifact.resource_version_id),
        subjectRef("normalized_text", normalizedArtifact.normalized_text_id),
      ],
      custody_state: custodyState({
        reviewStatus: "not_requested",
        approvalStatus: "not_requested",
        humanReviewRequired: false,
        clientFacingReady: false,
      }),
      source_ref: sourceRef("normalized_text_contract", normalizedArtifact.schema_version, normalizedArtifact.normalized_text_artifact_id),
      metadata: {
        text_hash: normalizedArtifact.text_hash,
        text_storage_mode: normalizedArtifact.text_storage?.storage_mode ?? null,
        raw_source_binding_status: normalizedArtifact.text_storage?.raw_source_binding_status ?? null,
      },
    });
  }

  for (const exhibit of sortBy(catalogs.exhibitRecords, "exhibit_number")) {
    const evidenceItem = catalogs.evidenceItemById.get(exhibit.evidence_item_id);
    const fact = catalogs.factClaimById.get(exhibit.fact_id);
    const issue = catalogs.issueById.get(exhibit.issue_id);
    const citation = catalogs.citationById.get(exhibit.citation_id);
    const paragraph = catalogs.outputParagraphById.get(exhibit.output_paragraph_id);
    const lineagePath = catalogs.lineagePathById.get(exhibit.lineage_path_id);
    const flagRecord = catalogs.evidenceFlagById.get(exhibit.evidence_flag_record_id);
    const sourceSpan = catalogs.sourceSpanById.get(exhibit.source_span_id);
    const chainId = evidenceChainId(exhibit.exhibit_id);
    const linkedRefs = [
      subjectRef("source_span", exhibit.source_span_id),
      subjectRef("evidence_item", exhibit.evidence_item_id),
      subjectRef("fact_claim", exhibit.fact_id),
      subjectRef("issue", exhibit.issue_id),
      subjectRef("citation", exhibit.citation_id),
      subjectRef("output_paragraph", exhibit.output_paragraph_id),
      subjectRef("lineage_path", exhibit.lineage_path_id),
      subjectRef("evidence_flag_record", exhibit.evidence_flag_record_id),
    ];
    const shared = {
      custody_chain_id: chainId,
      tenant_id: exhibit.tenant_id,
      matter_id: exhibit.matter_id,
      classification: exhibit.classification,
      policy_snapshot_id: exhibit.policy_snapshot_id,
      subject_ref: subjectRef("exhibit", exhibit.exhibit_id),
      linked_refs: linkedRefs,
      metadata: {
        exhibit_number: exhibit.exhibit_number,
        exhibit_reference: exhibit.exhibit_reference,
        source_span_location_type: sourceSpan?.location_type ?? null,
        evidence_review_status: evidenceItem?.review_status ?? null,
        fact_review_status: fact?.review_status ?? null,
        issue_review_status: issue?.review_status ?? null,
        citation_status: citation?.citation_status ?? null,
        source_binding_status: citation?.source_binding_status ?? exhibit.source_binding_status ?? null,
        paragraph_client_facing_status: paragraph?.client_facing_status ?? exhibit.output_client_facing_status ?? null,
        lineage_path_status: lineagePath?.path_status ?? exhibit.lineage_path_status ?? null,
        external_transfer_flag: flagRecord?.external_transfer_flag ?? exhibit.external_transfer_flag ?? null,
      },
    };
    pushEvent({
      ...shared,
      event_stage: "extract",
      event_type: "evidence_path_extracted",
      event_status: "machine_extracted_pending_review",
      custody_state: custodyState({
        reviewStatus: "needs_review",
        approvalStatus: "not_requested",
        humanReviewRequired: true,
        attorneyReviewRequired: true,
        clientFacingStatus: "not_client_facing",
        clientFacingReady: false,
      }),
      source_ref: sourceRef("exhibit_map", exhibit.schema_version, exhibit.exhibit_id),
    });
    pushEvent({
      ...shared,
      event_stage: "review",
      event_type: "attorney_review_required",
      event_status: "pending_human_review",
      custody_state: custodyState({
        reviewStatus: exhibit.review_status ?? "needs_review",
        approvalStatus: "not_requested",
        humanReviewRequired: true,
        attorneyReviewRequired: true,
        clientFacingStatus: "not_client_facing",
        clientFacingReady: false,
      }),
      source_ref: sourceRef("evidence_flags", flagRecord?.schema_version, flagRecord?.evidence_flag_record_id),
    });
    pushEvent({
      ...shared,
      event_stage: "approve",
      event_type: "approval_requested",
      event_status: "held_pending_human_approval",
      custody_state: custodyState({
        reviewStatus: exhibit.review_status ?? "needs_review",
        approvalStatus: "requested",
        humanReviewRequired: true,
        attorneyReviewRequired: true,
        clientFacingStatus: "not_client_facing",
        clientFacingReady: false,
      }),
      source_ref: sourceRef("exhibit_map", exhibit.schema_version, exhibit.exhibit_id),
      metadata: {
        ...shared.metadata,
        approval_rule: "human_approval_object_required_before_output_delivery",
      },
    });
  }

  return { custodyEvents, custodyEventLinks };
}

function buildActor(stage) {
  return {
    actor_type: stage === "review" || stage === "approve" ? "system_handoff" : "system",
    actor_id: "harness.chain_of_custody_events",
    runtime_id: "local_script",
    human_approval_actor_required: stage === "review" || stage === "approve",
  };
}

function custodyState({
  reviewStatus,
  approvalStatus,
  humanReviewRequired,
  attorneyReviewRequired = false,
  clientFacingStatus = "not_client_facing",
  clientFacingReady,
}) {
  return {
    review_status: reviewStatus,
    approval_status: approvalStatus,
    human_review_required: humanReviewRequired,
    attorney_review_required: attorneyReviewRequired,
    output_client_facing_status: clientFacingStatus,
    client_facing_ready: clientFacingReady,
  };
}

function buildCustodyEventLink(event, generatedAt) {
  return {
    schema_version: CUSTODY_EVENT_LINK_SCHEMA_VERSION,
    custody_event_link_id: `custody-event-link.${slugify(event.custody_event_id)}`,
    custody_event_id: event.custody_event_id,
    custody_chain_id: event.custody_chain_id,
    event_stage: event.event_stage,
    event_type: event.event_type,
    subject_type: event.subject_ref?.subject_type ?? "unknown",
    subject_id: event.subject_ref?.subject_id ?? null,
    target_type: event.subject_ref?.subject_type ?? "unknown",
    target_id: event.subject_ref?.subject_id ?? null,
    linked_ref_count: event.linked_refs?.filter((ref) => Boolean(ref.subject_id)).length ?? 0,
    link_status: event.subject_ref?.subject_id ? "bound" : "missing_target",
    tenant_id: event.tenant_id,
    matter_id: event.matter_id,
    classification: event.classification,
    policy_snapshot_id: event.policy_snapshot_id,
    created_at: generatedAt,
  };
}

function buildCustodyStageIndexes(events, generatedAt) {
  return CUSTODY_STAGES.map((stage) => {
    const stageEvents = events.filter((event) => event.event_stage === stage);
    return {
      schema_version: CUSTODY_STAGE_INDEX_SCHEMA_VERSION,
      custody_stage_index_id: `custody-stage-index.${stage}`,
      event_stage: stage,
      event_count: stageEvents.length,
      custody_event_ids: stageEvents.map((event) => event.custody_event_id),
      custody_chain_ids: [...new Set(stageEvents.map((event) => event.custody_chain_id))].sort(),
      by_event_status: countBy(stageEvents, "event_status"),
      generated_at: generatedAt,
    };
  });
}

function validateChainOfCustodyEvents({
  packageText,
  roadmapText,
  sourceStores,
  catalogs,
  custodyEvents,
  custodyEventLinks,
  custodyStageIndexes,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const byEventId = new Map(custodyEvents.map((event) => [event.custody_event_id, event]));
  const chainGroups = groupBy(custodyEvents, "custody_chain_id");
  const resourceChainGroups = new Map([...chainGroups].filter(([chainId]) => chainId.startsWith("custody.chain.resource.")));
  const evidenceChainGroups = new Map([...chainGroups].filter(([chainId]) => chainId.startsWith("custody.chain.evidence.")));
  const expectedEventCount = catalogs.resourceVersions.length + catalogs.normalizedArtifacts.length + catalogs.exhibitRecords.length * 3;

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:custody-events"]), "package.json must expose resource:custody-events.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 147: Chain of Custody Events"), "Implementation roadmap must document Phase 147.");
  pushCheck(validationItems, "source", "resource_store_interface_complete", sourceStores.resourceStoreInterface.summary?.resource_store_interface_status === "complete", "Resource Store Interface must be complete.");
  pushCheck(validationItems, "source", "resource_version_ledger_complete", sourceStores.resourceVersionLedger.summary?.resource_version_ledger_status === "complete", "Resource Version Ledger must be complete.");
  pushCheck(validationItems, "source", "normalized_text_contract_complete", sourceStores.normalizedTextContract.summary?.normalized_text_contract_status === "complete", "Normalized Text Contract must be complete.");
  pushCheck(validationItems, "source", "exhibit_map_complete", sourceStores.exhibitMap.summary?.exhibit_map_status === "complete", "Exhibit Map must be complete.");
  pushCheck(validationItems, "catalog", "custody_events_expected_count", custodyEvents.length === expectedEventCount, "Custody event count must match upload + normalize + extract/review/approve events.");
  pushCheck(validationItems, "catalog", "custody_event_links_match_events", custodyEventLinks.length === custodyEvents.length, "Every custody event must have a link row.");
  pushCheck(validationItems, "catalog", "all_stages_indexed", custodyStageIndexes.length === CUSTODY_STAGES.length && CUSTODY_STAGES.every((stage) => custodyStageIndexes.some((index) => index.event_stage === stage)), "All custody stages must be indexed.");
  pushCheck(validationItems, "catalog", "upload_count_matches_resource_versions", custodyEvents.filter((event) => event.event_stage === "upload").length === catalogs.resourceVersions.length, "Upload events must match resource versions.");
  pushCheck(validationItems, "catalog", "normalize_count_matches_normalized_artifacts", custodyEvents.filter((event) => event.event_stage === "normalize").length === catalogs.normalizedArtifacts.length, "Normalize events must match normalized artifacts.");
  for (const stage of ["extract", "review", "approve"]) {
    pushCheck(validationItems, "catalog", `${stage}_count_matches_exhibits`, custodyEvents.filter((event) => event.event_stage === stage).length === catalogs.exhibitRecords.length, `${stage} events must match exhibit records.`);
  }

  for (const event of custodyEvents) {
    const prefix = `custody_events.${event.custody_event_id}`;
    pushCheck(validationItems, prefix, "schema_version_canonical", event.schema_version === CUSTODY_EVENT_SCHEMA_VERSION, "Custody event must use custody-event.v1.");
    pushCheck(validationItems, prefix, "append_only", event.append_only === true && event.immutable === true, "Custody event must be append-only and immutable.");
    pushCheck(validationItems, prefix, "hash_present", Boolean(event.event_hash), "Custody event must have a content hash.");
    pushCheck(validationItems, prefix, "stage_canonical", CUSTODY_STAGES.includes(event.event_stage), "Custody stage must be canonical.");
    pushCheck(validationItems, prefix, "actor_present", Boolean(event.actor?.actor_id && event.actor?.runtime_id), "Custody event must preserve actor and runtime.");
    pushCheck(validationItems, prefix, "identity_preserved", Boolean(event.tenant_id && event.matter_id && event.classification && event.policy_snapshot_id), "Custody event must preserve tenant, matter, classification, and policy snapshot.");
    pushCheck(validationItems, prefix, "subject_present", Boolean(event.subject_ref?.subject_type && event.subject_ref?.subject_id), "Custody event must bind a subject.");
    pushCheck(validationItems, prefix, "not_client_facing", event.custody_state?.client_facing_ready === false, "Custody event cannot make outputs client-facing.");
    if (event.event_stage === "review" || event.event_stage === "approve") {
      pushCheck(validationItems, prefix, "human_gate_required", event.custody_state?.human_review_required === true && event.actor?.human_approval_actor_required === true, "Review and approval stages must require human approval.");
    }
  }

  for (const [chainId, chainEvents] of chainGroups) {
    const sorted = [...chainEvents].sort((a, b) => a.chain_sequence - b.chain_sequence);
    for (let index = 0; index < sorted.length; index += 1) {
      const event = sorted[index];
      const expectedPrevious = index === 0 ? null : sorted[index - 1].event_hash;
      pushCheck(validationItems, `chains.${chainId}.${event.custody_event_id}`, "previous_hash_linked", event.previous_event_hash === expectedPrevious, "Chain events must preserve previous event hash.");
    }
  }

  for (const [chainId, chainEvents] of resourceChainGroups) {
    const stages = new Set(chainEvents.map((event) => event.event_stage));
    pushCheck(validationItems, `chains.${chainId}`, "resource_chain_complete", stages.has("upload") && stages.has("normalize"), "Resource custody chain must include upload and normalize stages.");
  }

  for (const [chainId, chainEvents] of evidenceChainGroups) {
    const stages = new Set(chainEvents.map((event) => event.event_stage));
    pushCheck(validationItems, `chains.${chainId}`, "evidence_chain_complete", ["extract", "review", "approve"].every((stage) => stages.has(stage)), "Evidence custody chain must include extract, review, and approve-hold stages.");
  }

  for (const link of custodyEventLinks) {
    const prefix = `custody_event_links.${link.custody_event_link_id}`;
    pushCheck(validationItems, prefix, "event_resolves", byEventId.has(link.custody_event_id), "Custody event link must resolve its event.");
    pushCheck(validationItems, prefix, "link_bound", link.link_status === "bound", "Custody event link must be bound.");
  }

  return validationItems;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.path}.${item.check_id}`, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeChainOfCustody({
  sourceStores,
  catalogs,
  custodyEvents,
  custodyEventLinks,
  custodyStageIndexes,
  validationItems,
  validation,
}) {
  const resourceChains = [...new Set(custodyEvents.filter((event) => event.custody_chain_id.startsWith("custody.chain.resource.")).map((event) => event.custody_chain_id))];
  const evidenceChains = [...new Set(custodyEvents.filter((event) => event.custody_chain_id.startsWith("custody.chain.evidence.")).map((event) => event.custody_chain_id))];
  const chainGroups = groupBy(custodyEvents, "custody_chain_id");
  const completeResourceChainCount = resourceChains.filter((chainId) => chainHasStages(chainGroups.get(chainId), ["upload", "normalize"])).length;
  const completeEvidenceChainCount = evidenceChains.filter((chainId) => chainHasStages(chainGroups.get(chainId), ["extract", "review", "approve"])).length;
  return {
    custody_event_ledger_status: validation.valid ? "complete" : "blocked",
    custody_event_contract_id: CHAIN_OF_CUSTODY_CONTRACT_ID,
    custody_event_schema_version: CUSTODY_EVENT_SCHEMA_VERSION,
    custody_event_link_schema_version: CUSTODY_EVENT_LINK_SCHEMA_VERSION,
    custody_stage_index_schema_version: CUSTODY_STAGE_INDEX_SCHEMA_VERSION,
    resource_store_interface_status: sourceStores.resourceStoreInterface.summary?.resource_store_interface_status ?? "unknown",
    resource_version_ledger_status: sourceStores.resourceVersionLedger.summary?.resource_version_ledger_status ?? "unknown",
    normalized_text_contract_status: sourceStores.normalizedTextContract.summary?.normalized_text_contract_status ?? "unknown",
    source_span_store_status: sourceStores.sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    evidence_item_store_status: sourceStores.evidenceItemStore.summary?.evidence_item_store_status ?? "unknown",
    fact_claim_store_status: sourceStores.factClaimStore.summary?.fact_claim_store_status ?? "unknown",
    issue_graph_store_status: sourceStores.issueGraphStore.summary?.issue_graph_store_status ?? "unknown",
    citation_object_store_status: sourceStores.citationObjectStore.summary?.citation_object_store_status ?? "unknown",
    lineage_graph_status: sourceStores.lineageGraph.summary?.lineage_graph_status ?? "unknown",
    evidence_flags_status: sourceStores.evidenceFlags.summary?.evidence_flags_status ?? "unknown",
    exhibit_map_status: sourceStores.exhibitMap.summary?.exhibit_map_status ?? "unknown",
    resource_version_count: catalogs.resourceVersions.length,
    normalized_text_artifact_count: catalogs.normalizedArtifacts.length,
    evidence_item_count: catalogs.evidenceItems.length,
    exhibit_record_count: catalogs.exhibitRecords.length,
    custody_event_count: custodyEvents.length,
    custody_event_link_count: custodyEventLinks.length,
    custody_stage_index_count: custodyStageIndexes.length,
    upload_event_count: custodyEvents.filter((event) => event.event_stage === "upload").length,
    normalize_event_count: custodyEvents.filter((event) => event.event_stage === "normalize").length,
    extract_event_count: custodyEvents.filter((event) => event.event_stage === "extract").length,
    review_event_count: custodyEvents.filter((event) => event.event_stage === "review").length,
    approve_event_count: custodyEvents.filter((event) => event.event_stage === "approve").length,
    append_only_event_count: custodyEvents.filter((event) => event.append_only === true && event.immutable === true).length,
    hashed_event_count: custodyEvents.filter((event) => Boolean(event.event_hash)).length,
    previous_hash_linked_event_count: custodyEvents.filter((event) => event.chain_sequence === 1 || Boolean(event.previous_event_hash)).length,
    custody_chain_count: chainGroups.size,
    complete_resource_chain_count: completeResourceChainCount,
    complete_evidence_chain_count: completeEvidenceChainCount,
    matter_preserved_event_count: custodyEvents.filter((event) => Boolean(event.matter_id)).length,
    classification_preserved_event_count: custodyEvents.filter((event) => Boolean(event.classification)).length,
    policy_snapshot_preserved_event_count: custodyEvents.filter((event) => Boolean(event.policy_snapshot_id)).length,
    needs_review_event_count: custodyEvents.filter((event) => event.custody_state?.review_status === "needs_review").length,
    pending_approval_event_count: custodyEvents.filter((event) => event.event_stage === "approve" && event.event_status === "held_pending_human_approval").length,
    approved_event_count: custodyEvents.filter((event) => event.custody_state?.approval_status === "approved").length,
    client_facing_ready_event_count: custodyEvents.filter((event) => event.custody_state?.client_facing_ready === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_event_stage: countBy(custodyEvents, "event_stage"),
    by_event_type: countBy(custodyEvents, "event_type"),
    by_event_status: countBy(custodyEvents, "event_status"),
    by_matter_id: countBy(custodyEvents, "matter_id"),
    by_classification: countBy(custodyEvents, "classification"),
  };
}

function renderChainOfCustodyMarkdown(result) {
  const lines = [];
  lines.push("# Chain of Custody Events");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.custody_event_ledger_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.custody_event_contract_id}`);
  lines.push(`- Events: ${result.summary.custody_event_count}`);
  lines.push(`- Links: ${result.summary.custody_event_link_count}`);
  lines.push(`- Chains: ${result.summary.custody_chain_count}`);
  lines.push(`- Upload events: ${result.summary.upload_event_count}`);
  lines.push(`- Normalize events: ${result.summary.normalize_event_count}`);
  lines.push(`- Extract events: ${result.summary.extract_event_count}`);
  lines.push(`- Review events: ${result.summary.review_event_count}`);
  lines.push(`- Approval-hold events: ${result.summary.approve_event_count}`);
  lines.push(`- Client-facing ready events: ${result.summary.client_facing_ready_event_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function subjectRef(subjectType, subjectId) {
  return {
    subject_type: subjectType,
    subject_id: subjectId ?? null,
  };
}

function sourceRef(sourceArtifactId, sourceSchemaVersion, sourceRecordId) {
  return {
    source_artifact_id: sourceArtifactId,
    source_schema_version: sourceSchemaVersion ?? null,
    source_record_id: sourceRecordId ?? null,
  };
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `chain-of-custody-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function normalizeInputs(options) {
  return {
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.resourceStoreInterfacePath),
    resource_version_ledger_path: path.resolve(options.resourceVersionLedgerPath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.resourceVersionLedgerPath),
    normalized_text_contract_path: path.resolve(options.normalizedTextContractPath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.normalizedTextContractPath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.evidenceItemStorePath),
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.factClaimStorePath),
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.issueGraphStorePath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.citationObjectStorePath),
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.lineageGraphPath),
    evidence_flags_path: path.resolve(options.evidenceFlagsPath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.evidenceFlagsPath),
    exhibit_map_path: path.resolve(options.exhibitMapPath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.exhibitMapPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_CHAIN_OF_CUSTODY_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--resource-version-ledger") parsed.resourceVersionLedgerPath = argv[++index];
    else if (arg === "--normalized-text-contract") parsed.normalizedTextContractPath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--evidence-flags") parsed.evidenceFlagsPath = argv[++index];
    else if (arg === "--exhibit-map") parsed.exhibitMapPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/chain-of-custody-events.mjs [options]

Options:
  --resource-store-interface <path>   resource-store-interface.json path.
  --resource-version-ledger <path>    resource-version-ledger.json path.
  --normalized-text-contract <path>   normalized-text-contract.json path.
  --source-span-store <path>          source-span-store.json path.
  --evidence-item-store <path>        evidence-item-store.json path.
  --fact-claim-store <path>           fact-claim-store.json path.
  --issue-graph-store <path>          issue-graph-store.json path.
  --citation-object-store <path>      citation-object-store.json path.
  --lineage-graph <path>              lineage-graph.json path.
  --evidence-flags <path>             evidence-flags.json path.
  --exhibit-map <path>                exhibit-map.json path.
  --out-dir <path>                    Output directory.
  --run-at <iso>                      Deterministic generated_at timestamp.
  --check                             Exit non-zero when validation fails.
  --no-write                          Build without writing artifacts.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readTextFileWithWindowsRetry(filePath));
}

async function readText(filePath) {
  return readTextFileWithWindowsRetry(filePath);
}

async function readTextFileWithWindowsRetry(filePath) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      lastError = error;
      if (process.platform !== "win32" || !/EISDIR|EBUSY|EPERM/i.test(error.message) || attempt === 4) break;
      await delay(500 * attempt);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableChainOfCustody(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeSource(sourceId, data) {
  return {
    source_id: sourceId,
    schema_version: data.schema_version ?? null,
    generated_at: data.generated_at ?? null,
    summary: data.summary ?? null,
  };
}

function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

function sortBy(items, key) {
  return [...items].sort((a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""), undefined, { numeric: true }));
}

function chainHasStages(events = [], stages = []) {
  const present = new Set(events.map((event) => event.event_stage));
  return stages.every((stage) => present.has(stage));
}

function resourceChainId(resourceVersionId) {
  return `custody.chain.resource.${slugify(resourceVersionId)}`;
}

function evidenceChainId(exhibitId) {
  return `custody.chain.evidence.${slugify(exhibitId)}`;
}

function hashValue(value) {
  return createHash("sha256").update(canonicalize(value)).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalize(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
