import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTEXT_PACKET_LEDGER_OUT_DIR = "artifacts/context-packets/latest";
export const DEFAULT_CONTEXT_PACKET_DOMAIN_PACK_REGISTRY = "artifacts/domain-packs/latest/domain-pack-registry.json";
export const DEFAULT_CONTEXT_PACKET_RUNTIME_ADAPTERS = "examples/core/runtime-adapters.json";
export const DEFAULT_CONTEXT_PACKET_POLICY_SNAPSHOT_LEDGER = "artifacts/policy-snapshots/latest/policy-snapshot-ledger.json";

export const DEFAULT_CONTEXT_PACKET_SOURCES = [
  {
    source_id: "vertical_slice",
    label: "First Vertical Slice",
    slice_path: "artifacts/vertical-slice/latest/vertical-slice.json",
  },
  {
    source_id: "law_firm_ldd_slice",
    label: "Law Firm LDD Slice",
    slice_path: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
  },
  {
    source_id: "personal_dev_slice",
    label: "Personal Dev Slice",
    slice_path: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
  },
  {
    source_id: "creative_document_slice",
    label: "Creative Document Slice",
    slice_path: "artifacts/creative-document-slice/latest/creative-document-slice.json",
  },
];

const CONTENT_CONTEXT_TYPES = new Set(["normalized_text", "source_span", "evidence_item", "fact", "issue", "output_artifact"]);

export async function runContextPacketLedger(options = {}) {
  const result = await buildContextPacketLedger(options);
  if (options.write !== false) await writeContextPacketLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Context packet ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContextPacketLedger(options = {}) {
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTEXT_PACKET_LEDGER_OUT_DIR);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const domainPackRegistryPath = path.resolve(options.domainPackRegistryPath ?? DEFAULT_CONTEXT_PACKET_DOMAIN_PACK_REGISTRY);
  const runtimeAdaptersPath = path.resolve(options.runtimeAdaptersPath ?? DEFAULT_CONTEXT_PACKET_RUNTIME_ADAPTERS);
  const policySnapshotLedgerPath = path.resolve(options.policySnapshotLedgerPath ?? DEFAULT_CONTEXT_PACKET_POLICY_SNAPSHOT_LEDGER);
  const registryResult = await readJsonOrError(domainPackRegistryPath);
  const runtimeResult = await readJsonOrError(runtimeAdaptersPath);
  const snapshotResult = await readJsonOrError(policySnapshotLedgerPath);
  const sourceDefinitions = normalizeSourceDefinitions(options.sources ?? buildSourceDefinitionsFromOptions(options));
  const sources = await readContextSources(sourceDefinitions);
  const capabilityRecords = await readCapabilityManifests(registryResult.value);
  const runtimeAdapters = new Map((runtimeResult.value?.adapters ?? []).map((adapter) => [adapter.runtime_id, adapter]));
  const snapshotIds = new Set((snapshotResult.value?.policy_snapshots ?? []).map((snapshot) => snapshot.policy_snapshot_id));
  const packetBuild = buildContextPackets({ sources, capabilityRecords, runtimeAdapters, snapshotIds });
  const validation = validateContextPacketLedger({
    registryResult,
    runtimeResult,
    snapshotResult,
    sources,
    packets: packetBuild.contextPackets,
  });
  const ledger = {
    schema_version: "context-packet-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `context-packet-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    domain_pack_registry_path: domainPackRegistryPath,
    runtime_adapters_path: runtimeAdaptersPath,
    policy_snapshot_ledger_path: policySnapshotLedgerPath,
    ledger_status: validation.valid ? "valid" : "blocked",
    summary: summarizeContextPacketLedger({
      sources,
      contextPackets: packetBuild.contextPackets,
      contextItems: packetBuild.contextItems,
      retrievalFilters: packetBuild.retrievalFilters,
      validation,
    }),
    sources: sources.map(({ slice: _slice, ...source }) => source),
    context_packets: packetBuild.contextPackets,
    context_items: packetBuild.contextItems,
    retrieval_filters: packetBuild.retrievalFilters,
    validation,
  };

  return {
    ...ledger,
    markdown: renderContextPacketLedgerMarkdown(ledger),
  };
}

export async function writeContextPacketLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "context-packet-ledger.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    output_dir: result.output_dir,
    domain_pack_registry_path: result.domain_pack_registry_path,
    runtime_adapters_path: result.runtime_adapters_path,
    policy_snapshot_ledger_path: result.policy_snapshot_ledger_path,
    ledger_status: result.ledger_status,
    summary: result.summary,
    sources: result.sources,
    context_packets: result.context_packets,
    context_items: result.context_items,
    retrieval_filters: result.retrieval_filters,
    validation: result.validation,
  });
  await writeJson(path.join(outDir, "context-packets.json"), {
    generated_at: result.generated_at,
    count: result.context_packets.length,
    context_packets: result.context_packets,
  });
  await writeJson(path.join(outDir, "context-items.json"), {
    generated_at: result.generated_at,
    count: result.context_items.length,
    context_items: result.context_items,
  });
  await writeJson(path.join(outDir, "retrieval-filters.json"), {
    generated_at: result.generated_at,
    count: result.retrieval_filters.length,
    retrieval_filters: result.retrieval_filters,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runContextPacketLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runContextPacketLedger(args);
    console.log(`Context packet ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Ledger status: ${result.ledger_status}`);
    console.log(`Context packets: ${result.summary.context_packet_count}`);
    console.log(`Context items: ${result.summary.context_item_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function normalizeSourceDefinitions(sources) {
  return sources.map((source) => ({
    source_id: source.source_id,
    label: source.label,
    slice_path: path.resolve(source.slice_path),
  }));
}

function buildSourceDefinitionsFromOptions(options) {
  const overrides = new Map();
  setSourceOverride(overrides, "vertical_slice", options.verticalSlicePath);
  setSourceOverride(overrides, "law_firm_ldd_slice", options.lawFirmSlicePath);
  setSourceOverride(overrides, "personal_dev_slice", options.personalDevSlicePath);
  setSourceOverride(overrides, "creative_document_slice", options.creativeDocumentSlicePath);
  return DEFAULT_CONTEXT_PACKET_SOURCES
    .filter((source) => overrides.get(source.source_id)?.enabled !== false)
    .map((source) => ({
      ...source,
      slice_path: overrides.get(source.source_id)?.slice_path ?? source.slice_path,
    }));
}

function setSourceOverride(overrides, sourceId, slicePath) {
  if (slicePath === undefined) return;
  overrides.set(sourceId, {
    enabled: slicePath !== false,
    slice_path: slicePath === false ? undefined : slicePath,
  });
}

async function readContextSources(sourceDefinitions) {
  const sources = [];
  for (const source of sourceDefinitions) {
    const result = await readJsonOrError(source.slice_path);
    const slice = result.value;
    sources.push({
      source_id: source.source_id,
      label: source.label,
      slice_path: source.slice_path,
      available: result.ok,
      schema_version: slice?.schema_version ?? null,
      generated_at: slice?.generated_at ?? null,
      workflow_run_count: slice?.workflow_runtime?.workflow_runs?.length ?? 0,
      agent_run_count: slice?.workflow_runtime?.agent_runs?.length ?? 0,
      resource_count: slice?.resource_evidence?.resources?.length ?? 0,
      evidence_count: slice?.resource_evidence?.evidence_items?.length ?? 0,
      error: result.ok ? null : result.error,
      slice,
    });
  }
  return sources;
}

async function readCapabilityManifests(registry) {
  const capabilities = new Map();
  for (const record of registry?.capabilities ?? []) {
    let manifest = null;
    try {
      manifest = JSON.parse(await readFile(record.path, "utf8"));
    } catch {
      manifest = null;
    }
    capabilities.set(record.capability_id, {
      ...record,
      manifest,
    });
  }
  return capabilities;
}

function buildContextPackets({ sources, capabilityRecords, runtimeAdapters, snapshotIds }) {
  const contextPackets = [];
  const contextItems = [];
  const retrievalFilters = [];
  for (const source of sources) {
    if (!source.available) continue;
    const slice = source.slice;
    const resources = slice.resource_evidence?.resources ?? [];
    const mattersById = new Map((slice.identity_policy?.matters ?? []).map((matter) => [matter.id, matter]));
    const capabilitiesById = new Map((slice.workflow_runtime?.capabilities ?? []).map((capability) => [capability.id, capability]));
    const agentRunsByWorkflow = groupBy(slice.workflow_runtime?.agent_runs ?? [], "workflow_run_id");
    for (const workflowRun of slice.workflow_runtime?.workflow_runs ?? []) {
      const capabilityRecord = capabilityRecords.get(workflowRun.capability_id);
      const capability = capabilityRecord?.manifest ?? capabilitiesById.get(workflowRun.capability_id) ?? null;
      const agentRuns = agentRunsByWorkflow.get(workflowRun.id) ?? [];
      for (const agentRun of agentRuns) {
        const packet = buildContextPacket({
          source,
          slice,
          workflowRun,
          agentRun,
          capability,
          runtimeAdapter: runtimeAdapters.get(agentRun.runtime_id) ?? null,
          snapshotDeclared: snapshotIds.has(workflowRun.policy_snapshot_id),
          resources,
          matter: mattersById.get(workflowRun.matter_id) ?? null,
        });
        contextPackets.push(packet.packet);
        contextItems.push(...packet.items);
        retrievalFilters.push(packet.retrievalFilter);
      }
    }
  }
  return { contextPackets, contextItems, retrievalFilters };
}

function buildContextPacket({ source, slice, workflowRun, agentRun, capability, runtimeAdapter, snapshotDeclared, resources, matter }) {
  const packetId = `context-packet.${source.source_id}.${slugify(workflowRun.id)}.${slugify(agentRun.id)}`;
  const inputResourceIds = new Set(workflowRun.input_refs?.length ? workflowRun.input_refs : resources.map((resource) => resource.id));
  const selectedResources = resources.filter((resource) => inputResourceIds.has(resource.id));
  const classification = maxClassification(selectedResources.map((resource) => resource.classification), matter?.classification);
  const capabilityDataPolicy = capability?.data_policy ?? {};
  const runtimeInputContract = runtimeAdapter?.input_contract ?? {};
  const runtimeDataAccess = runtimeAdapter?.data_access ?? {};
  const capabilityContextTypes = capabilityDataPolicy.allowed_context_types ?? inferCapabilityContextTypes(capability);
  const runtimeContextTypes = runtimeInputContract.accepted_context_types ?? [];
  const allowedContextTypes = unique(capabilityContextTypes.filter((type) => runtimeContextTypes.includes(type)));
  const requiredFilterKeys = unique([
    ...(capabilityDataPolicy.retrieval_filters_required ?? []),
    ...(runtimeDataAccess.retrieval_filters_required ?? []),
  ]);
  const filterValues = buildFilterValues({ workflowRun, matter, selectedResources, classification });
  const missingFilterKeys = requiredFilterKeys.filter((key) => !hasFilterValue(filterValues[key]));
  const classificationAllowed = Boolean(
    runtimeAdapter
      && classificationRank(classification) <= classificationRank(capabilityDataPolicy.max_input_classification ?? classification)
      && classificationRank(classification) <= classificationRank(runtimeInputContract.max_input_classification ?? classification)
      && (
        (runtimeDataAccess.raw_context_allowed_classifications ?? []).includes(classification)
        || (runtimeDataAccess.redacted_context_allowed_classifications ?? []).includes(classification)
      ),
  );
  const runtimeAllowedByCapability = Boolean(runtimeAdapter && (capability?.allowed_runtimes ?? []).includes(agentRun.runtime_id));
  const redactionRequired = Boolean(
    capabilityDataPolicy.redaction_required
      || runtimeInputContract.redaction_required
      || capabilityDataPolicy.external_model_policy === "redaction_required",
  );
  const rawAllowed = (runtimeDataAccess.raw_context_allowed_classifications ?? []).includes(classification);
  const redactedAllowed = (runtimeDataAccess.redacted_context_allowed_classifications ?? []).includes(classification);
  const contextMode = deriveContextMode({
    runtimeAdapter,
    missingFilterKeys,
    classificationAllowed,
    runtimeAllowedByCapability,
    redactionRequired,
    rawAllowed,
    redactedAllowed,
  });
  const packetStatus = contextMode === "blocked" ? "blocked" : "ready";
  const blockers = buildPacketBlockers({
    runtimeAdapter,
    capability,
    snapshotDeclared,
    missingFilterKeys,
    classificationAllowed,
    runtimeAllowedByCapability,
    allowedContextTypes,
    contextMode,
  });
  const itemCandidates = buildContextItemCandidates({
    packetId,
    slice,
    workflowRun,
    selectedResources,
    allowedContextTypes,
    contextMode,
  });
  const items = contextMode === "blocked" ? [] : itemCandidates;
  const retrievalFilter = {
    retrieval_filter_id: `retrieval-filter.${source.source_id}.${slugify(workflowRun.id)}.${slugify(agentRun.id)}`,
    context_packet_id: packetId,
    source_id: source.source_id,
    workflow_run_id: workflowRun.id,
    agent_run_id: agentRun.id,
    runtime_id: agentRun.runtime_id,
    required_filter_keys: requiredFilterKeys,
    missing_filter_keys: missingFilterKeys,
    filter_values: Object.fromEntries(requiredFilterKeys.map((key) => [key, filterValues[key] ?? null])),
    filter_status: missingFilterKeys.length === 0 ? "complete" : "missing_required_filter",
  };
  const includedTypes = unique(items.map((item) => item.item_type));
  const excludedTypes = unique(capabilityContextTypes.filter((type) => !includedTypes.includes(type)));
  return {
    packet: {
      context_packet_id: packetId,
      source_id: source.source_id,
      source_label: source.label,
      workflow_run_id: workflowRun.id,
      agent_run_id: agentRun.id,
      runtime_id: agentRun.runtime_id,
      capability_id: workflowRun.capability_id,
      domain_pack: capability?.domain_pack ?? inferDomainPackFromSource(source.source_id),
      tenant_id: workflowRun.tenant_id,
      matter_id: workflowRun.matter_id,
      client_id: matter?.client_id ?? null,
      wall_ids: matter?.wall_ids ?? [],
      policy_snapshot_id: workflowRun.policy_snapshot_id,
      policy_snapshot_declared: snapshotDeclared,
      packet_status: packetStatus,
      context_mode: contextMode,
      max_classification: classification,
      classification_allowed: classificationAllowed,
      runtime_allowed_by_capability: runtimeAllowedByCapability,
      redaction_required: redactionRequired,
      redaction_applied: contextMode === "redacted",
      prompt_injection_handling: runtimeInputContract.prompt_injection_handling ?? "unknown",
      required_filter_keys: requiredFilterKeys,
      missing_filter_keys: missingFilterKeys,
      included_context_types: includedTypes,
      excluded_context_types: excludedTypes,
      context_item_count: items.length,
      context_item_ids: items.map((item) => item.context_item_id),
      blocker_count: blockers.length,
      blockers,
      metadata: {
        resource_count: selectedResources.length,
        capability_redaction_required: Boolean(capabilityDataPolicy.redaction_required),
        runtime_redaction_required: Boolean(runtimeInputContract.redaction_required),
      },
    },
    items,
    retrievalFilter,
  };
}

function buildContextItemCandidates({ packetId, slice, workflowRun, selectedResources, allowedContextTypes, contextMode }) {
  const inputResourceIds = new Set(selectedResources.map((resource) => resource.id));
  const resourceVersionsByResource = groupBy(slice.resource_evidence?.resource_versions ?? [], "resource_id");
  const sourceSpans = (slice.resource_evidence?.source_spans ?? []).filter((span) => inputResourceIds.has(span.resource_id));
  const sourceSpanIds = new Set(sourceSpans.map((span) => span.id));
  const evidenceItems = (slice.resource_evidence?.evidence_items ?? []).filter((evidence) => (evidence.source_span_ids ?? []).some((spanId) => sourceSpanIds.has(spanId)));
  const evidenceIds = new Set(evidenceItems.map((evidence) => evidence.id));
  const facts = (slice.resource_evidence?.facts ?? []).filter((fact) => (fact.evidence_item_ids ?? []).some((evidenceId) => evidenceIds.has(evidenceId)));
  const factIds = new Set(facts.map((fact) => fact.id));
  const issues = (slice.resource_evidence?.issues ?? []).filter((issue) => (issue.linked_fact_ids ?? []).some((factId) => factIds.has(factId)));
  const normalizedTexts = (slice.resource_evidence?.normalized_texts ?? []).filter((text) => inputResourceIds.has(text.resource_id));
  const outputs = (slice.governance_output?.output_artifacts ?? []).filter((artifact) => (workflowRun.output_refs ?? []).includes(artifact.id));
  const resourceById = new Map(selectedResources.map((resource) => [resource.id, resource]));
  const items = [];
  if (allowedContextTypes.includes("resource_metadata")) {
    for (const resource of selectedResources) {
      items.push(toContextItem({ packetId, itemType: "resource_metadata", sourceRefType: "resource", sourceRef: resource, resource, contextMode }));
    }
  }
  if (allowedContextTypes.includes("normalized_text")) {
    for (const text of normalizedTexts) {
      const resource = resourceById.get(text.resource_id);
      items.push(toContextItem({ packetId, itemType: "normalized_text", sourceRefType: "normalized_text", sourceRef: text, resource, contextMode }));
    }
  }
  if (allowedContextTypes.includes("source_span")) {
    for (const span of sourceSpans) {
      const resource = resourceById.get(span.resource_id);
      items.push(toContextItem({ packetId, itemType: "source_span", sourceRefType: "source_span", sourceRef: span, resource, contextMode }));
    }
  }
  if (allowedContextTypes.includes("evidence_item")) {
    for (const evidence of evidenceItems) {
      const span = sourceSpans.find((candidate) => (evidence.source_span_ids ?? []).includes(candidate.id));
      const resource = span ? resourceById.get(span.resource_id) : null;
      items.push(toContextItem({ packetId, itemType: "evidence_item", sourceRefType: "evidence_item", sourceRef: evidence, resource, contextMode }));
    }
  }
  if (allowedContextTypes.includes("fact")) {
    for (const fact of facts) {
      items.push(toContextItem({ packetId, itemType: "fact", sourceRefType: "fact", sourceRef: fact, resource: null, contextMode }));
    }
  }
  if (allowedContextTypes.includes("issue")) {
    for (const issue of issues) {
      items.push(toContextItem({ packetId, itemType: "issue", sourceRefType: "issue", sourceRef: issue, resource: null, contextMode }));
    }
  }
  if (allowedContextTypes.includes("output_artifact")) {
    for (const artifact of outputs) {
      items.push(toContextItem({ packetId, itemType: "output_artifact", sourceRefType: "output_artifact", sourceRef: artifact, resource: null, contextMode }));
    }
  }
  return items.map((item, index) => ({
    ...item,
    context_item_id: `${packetId}.item.${String(index + 1).padStart(3, "0")}`,
  }));
}

function toContextItem({ packetId, itemType, sourceRefType, sourceRef, resource, contextMode }) {
  const classification = resource?.classification ?? sourceRef.classification ?? null;
  const contentMode = CONTENT_CONTEXT_TYPES.has(itemType) && contextMode === "redacted" ? "redacted_reference" : contextMode === "raw" ? "raw_reference" : "metadata_only";
  const redactionApplied = contentMode === "redacted_reference";
  return {
    context_item_id: `${packetId}.item.pending`,
    context_packet_id: packetId,
    item_type: itemType,
    source_ref_type: sourceRefType,
    source_ref_id: sourceRef.id,
    resource_id: resource?.id ?? sourceRef.resource_id ?? null,
    matter_id: resource?.matter_id ?? sourceRef.matter_id ?? null,
    classification,
    content_mode: contentMode,
    redaction_applied: redactionApplied,
    content_hash: sourceRef.hash ?? sourceRef.content_hash ?? sourceRef.text_hash ?? hashValue(sourceRef),
    preview: redactionApplied ? "[redacted]" : previewFor(sourceRef),
    metadata: {
      source_packet_mode: contextMode,
      resource_version_count: resource ? undefined : 0,
    },
  };
}

function buildPacketBlockers({ runtimeAdapter, capability, snapshotDeclared, missingFilterKeys, classificationAllowed, runtimeAllowedByCapability, allowedContextTypes, contextMode }) {
  const blockers = [];
  if (!runtimeAdapter) blockers.push("runtime_adapter_missing");
  if (!capability) blockers.push("capability_manifest_missing");
  if (!snapshotDeclared) blockers.push("policy_snapshot_not_declared");
  if (missingFilterKeys.length > 0) blockers.push("retrieval_filter_missing");
  if (!classificationAllowed) blockers.push("classification_not_allowed");
  if (!runtimeAllowedByCapability) blockers.push("runtime_not_allowed_by_capability");
  if (allowedContextTypes.length === 0) blockers.push("no_shared_context_type");
  if (contextMode === "blocked") blockers.push("context_mode_blocked");
  return unique(blockers);
}

function deriveContextMode({ runtimeAdapter, missingFilterKeys, classificationAllowed, runtimeAllowedByCapability, redactionRequired, rawAllowed, redactedAllowed }) {
  if (!runtimeAdapter || missingFilterKeys.length > 0 || !classificationAllowed || !runtimeAllowedByCapability) return "blocked";
  if (redactionRequired) return redactedAllowed ? "redacted" : "blocked";
  if (rawAllowed) return "raw";
  if (redactedAllowed) return "redacted";
  return "blocked";
}

function buildFilterValues({ workflowRun, matter, selectedResources, classification }) {
  return {
    tenant_id: workflowRun.tenant_id,
    client_id: matter?.client_id ?? null,
    matter_id: workflowRun.matter_id,
    wall_id: matter?.wall_ids ?? [],
    classification,
    resource_type: unique(selectedResources.map((resource) => resource.resource_type)),
  };
}

function hasFilterValue(value) {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function validateContextPacketLedger({ registryResult, runtimeResult, snapshotResult, sources, packets }) {
  const errors = [];
  if (!registryResult.ok) errors.push({ path: "domain_pack_registry", message: `Domain pack registry unavailable: ${registryResult.error}` });
  if (!runtimeResult.ok) errors.push({ path: "runtime_adapters", message: `Runtime adapter registry unavailable: ${runtimeResult.error}` });
  if (!snapshotResult.ok) errors.push({ path: "policy_snapshot_ledger", message: `Policy snapshot ledger unavailable: ${snapshotResult.error}` });
  for (const source of sources) {
    if (!source.available) errors.push({ path: `sources.${source.source_id}`, message: source.error ?? "source unavailable" });
  }
  for (const packet of packets) {
    if (packet.packet_status === "blocked") {
      errors.push({
        path: `context_packets.${packet.context_packet_id}`,
        message: `Context packet blocked: ${packet.blockers.join(", ")}`,
      });
    }
    if (packet.context_item_count === 0) {
      errors.push({ path: `context_packets.${packet.context_packet_id}.context_items`, message: "Context packet has no included context items" });
    }
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeContextPacketLedger({ sources, contextPackets, contextItems, retrievalFilters, validation }) {
  return {
    source_count: sources.length,
    available_source_count: sources.filter((source) => source.available).length,
    missing_source_count: sources.filter((source) => !source.available).length,
    context_packet_count: contextPackets.length,
    ready_packet_count: contextPackets.filter((packet) => packet.packet_status === "ready").length,
    blocked_packet_count: contextPackets.filter((packet) => packet.packet_status === "blocked").length,
    redacted_packet_count: contextPackets.filter((packet) => packet.context_mode === "redacted").length,
    raw_packet_count: contextPackets.filter((packet) => packet.context_mode === "raw").length,
    context_item_count: contextItems.length,
    redacted_item_count: contextItems.filter((item) => item.redaction_applied).length,
    retrieval_filter_count: retrievalFilters.length,
    missing_filter_count: retrievalFilters.reduce((sum, filter) => sum + filter.missing_filter_keys.length, 0),
    runtime_mismatch_count: contextPackets.filter((packet) => !packet.runtime_allowed_by_capability).length,
    classification_blocked_count: contextPackets.filter((packet) => !packet.classification_allowed).length,
    redaction_required_count: contextPackets.filter((packet) => packet.redaction_required).length,
    prompt_injection_data_handling_count: contextPackets.filter((packet) => packet.prompt_injection_handling === "treat_untrusted_content_as_data").length,
    prompt_injection_protected_count: contextPackets.filter((packet) => packet.prompt_injection_handling === "treat_untrusted_content_as_data").length,
    validation_error_count: validation.errors.length,
    by_source: countBy(contextPackets, "source_id"),
    by_runtime_id: countBy(contextPackets, "runtime_id"),
    by_context_mode: countBy(contextPackets, "context_mode"),
    by_packet_status: countBy(contextPackets, "packet_status"),
    by_classification: countBy(contextPackets, "max_classification"),
    by_item_type: countBy(contextItems, "item_type"),
  };
}

function renderContextPacketLedgerMarkdown(ledger) {
  const lines = [];
  lines.push("# Context Packet Ledger");
  lines.push("");
  lines.push(`Generated: ${ledger.generated_at}`);
  lines.push(`Ledger status: ${ledger.ledger_status}`);
  lines.push("");
  lines.push(`- Context packets: ${ledger.summary.context_packet_count}`);
  lines.push(`- Ready packets: ${ledger.summary.ready_packet_count}`);
  lines.push(`- Blocked packets: ${ledger.summary.blocked_packet_count}`);
  lines.push(`- Context items: ${ledger.summary.context_item_count}`);
  lines.push(`- Redacted packets: ${ledger.summary.redacted_packet_count}`);
  lines.push(`- Missing retrieval filters: ${ledger.summary.missing_filter_count}`);
  lines.push(`- Validation errors: ${ledger.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Packets");
  lines.push("");
  for (const packet of ledger.context_packets) {
    lines.push(`- ${packet.context_packet_id}: ${packet.runtime_id}, ${packet.context_mode}, items=${packet.context_item_count}`);
  }
  if (ledger.context_packets.length === 0) lines.push("- No context packets found.");
  if (ledger.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    lines.push("");
    for (const error of ledger.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function inferCapabilityContextTypes(capability) {
  const roles = capability?.required_resources?.map((resource) => resource.resource_role) ?? [];
  const mapped = roles.flatMap((role) => {
    if (role === "resource" || role === "repo" || role === "worktree") return ["resource_metadata"];
    if (role === "normalized_text") return ["normalized_text"];
    if (role === "source_span") return ["source_span"];
    if (role === "evidence_item") return ["evidence_item"];
    if (role === "test_result") return ["test_result"];
    return [];
  });
  return mapped.length > 0 ? unique(mapped) : ["resource_metadata"];
}

function previewFor(value) {
  const text = value.text_preview ?? value.summary ?? value.statement ?? value.title ?? value.artifact_uri ?? value.source_uri ?? value.id ?? "";
  return String(text).replace(/\s+/g, " ").slice(0, 240);
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function maxClassification(values, fallback = "P0_PUBLIC") {
  return values.filter(Boolean).sort((left, right) => classificationRank(right) - classificationRank(left))[0] ?? fallback;
}

function classificationRank(value) {
  const order = ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET"];
  const index = order.indexOf(value);
  return index === -1 ? 999 : index;
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
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
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function inferDomainPackFromSource(sourceId) {
  if (sourceId === "law_firm_ldd_slice") return "law-firm";
  if (sourceId === "personal_dev_slice") return "personal-dev";
  if (sourceId === "creative_document_slice") return "creative-document";
  return "platform";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_CONTEXT_PACKET_LEDGER_OUT_DIR,
    domainPackRegistryPath: DEFAULT_CONTEXT_PACKET_DOMAIN_PACK_REGISTRY,
    runtimeAdaptersPath: DEFAULT_CONTEXT_PACKET_RUNTIME_ADAPTERS,
    policySnapshotLedgerPath: DEFAULT_CONTEXT_PACKET_POLICY_SNAPSHOT_LEDGER,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--runtime-adapters") parsed.runtimeAdaptersPath = argv[++index];
    else if (arg === "--policy-snapshot-ledger") parsed.policySnapshotLedgerPath = argv[++index];
    else if (arg === "--vertical-slice") parsed.verticalSlicePath = argv[++index];
    else if (arg === "--no-vertical-slice") parsed.verticalSlicePath = false;
    else if (arg === "--law-firm-slice") parsed.lawFirmSlicePath = argv[++index];
    else if (arg === "--no-law-firm-slice") parsed.lawFirmSlicePath = false;
    else if (arg === "--personal-dev-slice") parsed.personalDevSlicePath = argv[++index];
    else if (arg === "--no-personal-dev-slice") parsed.personalDevSlicePath = false;
    else if (arg === "--creative-document-slice") parsed.creativeDocumentSlicePath = argv[++index];
    else if (arg === "--no-creative-document-slice") parsed.creativeDocumentSlicePath = false;
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/context-packet-ledger.mjs [options]

Options:
  --domain-pack-registry <path>  domain-pack-registry.json path.
  --runtime-adapters <path>      runtime-adapter-registry.v1 JSON path.
  --policy-snapshot-ledger <path>
                                  policy-snapshot-ledger.json path.
  --out-dir <folder>             Output directory.
  --vertical-slice <path>        vertical-slice.json path.
  --no-vertical-slice            Exclude first vertical slice.
  --law-firm-slice <path>        law-firm-ldd-slice.json path.
  --no-law-firm-slice            Exclude law-firm slice.
  --personal-dev-slice <path>    personal-dev-slice.json path.
  --no-personal-dev-slice        Exclude personal-dev slice.
  --creative-document-slice <path>
                                  creative-document-slice.json path.
  --no-creative-document-slice   Exclude creative-document slice.
  --run-at <iso>                 Deterministic generated_at timestamp.
  --check                        Exit non-zero when the ledger is invalid.
  -h, --help                     Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
