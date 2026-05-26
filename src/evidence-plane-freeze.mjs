import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_PLANE_FREEZE_OUT_DIR = "artifacts/evidence-plane-freeze/latest";
export const DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS = {
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  immutableObjectStoreLayoutPath: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  resourceDedupHashLedgerPath: "artifacts/resource-dedup-hash/latest/resource-dedup-hash-ledger.json",
  resourceQuarantineModelPath: "artifacts/resource-quarantine/latest/resource-quarantine-model.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  extractorAdapterContractPath: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  evidenceGoldenFixturesPath: "artifacts/evidence-golden-fixtures/latest/evidence-golden-fixtures.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  evidenceCoveragePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  evidenceFlagsPath: "artifacts/evidence-flags/latest/evidence-flags.json",
  exhibitMapPath: "artifacts/exhibit-map/latest/exhibit-map.json",
  chainOfCustodyEventsPath: "artifacts/chain-of-custody/latest/chain-of-custody-events.json",
  searchIndexContractPath: "artifacts/search-index/latest/search-index-contract.json",
  vectorIndexPolicyBoundaryPath: "artifacts/vector-index-policy/latest/vector-index-policy-boundary.json",
  retrievalFilterCompilerPath: "artifacts/retrieval-filters/latest/retrieval-filter-compiler.json",
  evidenceViewerDataApiPath: "artifacts/evidence-viewer-data-api/latest/evidence-viewer-data-api.json",
  evidenceExportBundlePath: "artifacts/evidence-export-bundle/latest/evidence-export-bundle.json",
  evidenceRegressionTestsPath: "artifacts/evidence-regression-tests/latest/evidence-regression-tests.json",
  resourceEvidenceDashboardSummaryPath: "artifacts/resource-evidence-dashboard/latest/resource-evidence-dashboard-summary.json",
  lawFirmSlicePath: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  eventAuditRunContractFreezePath: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVIDENCE_PLANE_FREEZE_CONTRACT_ID = "evidence-plane-freeze.v1";
const TRACE_SCHEMA_VERSION = "evidence-plane-representative-trace.v1";

const FREEZE_SOURCE_DEFINITIONS = [
  sourceDefinition("resource_store_interface", "Resource Store Interface", "resourceStoreInterfacePath", "P133", "resource_store_interface_status", "complete"),
  sourceDefinition("immutable_object_store_layout", "Immutable Object Store Layout", "immutableObjectStoreLayoutPath", "P134", "object_store_layout_status", "complete"),
  sourceDefinition("resource_version_ledger", "Resource Version Ledger", "resourceVersionLedgerPath", "P135", "resource_version_ledger_status", "complete"),
  sourceDefinition("normalized_text_contract", "Normalized Text Contract", "normalizedTextContractPath", "P136", "normalized_text_contract_status", "complete"),
  sourceDefinition("extractor_adapter_contract", "Extractor Adapter Contract", "extractorAdapterContractPath", "P137", "extractor_adapter_contract_status", "complete"),
  sourceDefinition("source_span_store", "Source Span Store", "sourceSpanStorePath", "P138", "source_span_store_status", "complete"),
  sourceDefinition("evidence_item_store", "Evidence Item Store", "evidenceItemStorePath", "P139", "evidence_item_store_status", "complete"),
  sourceDefinition("fact_claim_store", "Fact Claim Store", "factClaimStorePath", "P140", "fact_claim_store_status", "complete"),
  sourceDefinition("issue_graph_store", "Issue Graph Store", "issueGraphStorePath", "P141", "issue_graph_store_status", "complete"),
  sourceDefinition("citation_object_store", "Citation Object Store", "citationObjectStorePath", "P142", "citation_object_store_status", "complete"),
  sourceDefinition("lineage_graph_builder", "Lineage Graph Builder", "lineageGraphPath", "P143", "lineage_graph_status", "complete"),
  sourceDefinition("evidence_coverage_score", "Evidence Coverage Scoring", "evidenceCoveragePath", "P144", "evidence_coverage_status", "complete"),
  sourceDefinition("evidence_flags", "Evidence Flags", "evidenceFlagsPath", "P145", "evidence_flags_status", "complete"),
  sourceDefinition("exhibit_map", "Exhibit Mapping", "exhibitMapPath", "P146", "exhibit_map_status", "complete"),
  sourceDefinition("chain_of_custody_events", "Chain of Custody Events", "chainOfCustodyEventsPath", "P147", "custody_event_ledger_status", "complete"),
  sourceDefinition("search_index_contract", "Search Index Contract", "searchIndexContractPath", "P148", "search_index_contract_status", "complete"),
  sourceDefinition("vector_index_policy_boundary", "Vector Index Policy Boundary", "vectorIndexPolicyBoundaryPath", "P149", "vector_index_policy_boundary_status", "complete"),
  sourceDefinition("retrieval_filter_compiler", "Retrieval Filter Compiler", "retrievalFilterCompilerPath", "P150", "retrieval_filter_compiler_status", "complete"),
  sourceDefinition("evidence_golden_fixtures", "Evidence Extraction Golden Cases", "evidenceGoldenFixturesPath", "P151", "evidence_golden_fixture_status", "complete"),
  sourceDefinition("resource_dedup_hash_ledger", "Resource Dedup/Hash Ledger", "resourceDedupHashLedgerPath", "P152", "resource_dedup_hash_status", "complete"),
  sourceDefinition("resource_quarantine_model", "Resource Quarantine Model", "resourceQuarantineModelPath", "P153", "resource_quarantine_status", "complete"),
  sourceDefinition("evidence_viewer_data_api", "Evidence Viewer Data API", "evidenceViewerDataApiPath", "P154", "evidence_viewer_data_status", "complete"),
  sourceDefinition("evidence_export_bundle", "Evidence Export Bundle", "evidenceExportBundlePath", "P155", "evidence_export_bundle_status", "complete"),
  sourceDefinition("evidence_regression_tests", "Evidence Regression Tests", "evidenceRegressionTestsPath", "P156", "evidence_regression_status", "complete"),
  sourceDefinition("resource_evidence_dashboard_summary", "Resource/Evidence Dashboard Summary", "resourceEvidenceDashboardSummaryPath", "P157", "resource_evidence_dashboard_status", "complete"),
];

const REPRESENTATIVE_SOURCE_DEFINITIONS = [
  sourceDefinition("law_firm_ldd_slice", "Law Firm LDD Slice", "lawFirmSlicePath", "representative", null, null),
  sourceDefinition("output_delivery_contract_freeze", "Output/Delivery Contract Freeze", "outputDeliveryContractFreezePath", "output", "freeze_status", "complete"),
  sourceDefinition("event_audit_run_contract_freeze", "Event/Audit/Run Ledger Contract Freeze", "eventAuditRunContractFreezePath", "audit", "freeze_status", "complete"),
];

const SUPPORT_SOURCE_DEFINITIONS = [
  sourceDefinition("package_json", "Package Scripts", "packagePath", "verification", null, null, "text"),
  sourceDefinition("implementation_roadmap", "Implementation Roadmap", "roadmapPath", "verification", null, null, "text"),
];

export async function runEvidencePlaneFreeze(options = {}) {
  const result = await buildEvidencePlaneFreeze(options);
  if (options.write !== false) await writeEvidencePlaneFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence Plane freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidencePlaneFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_PLANE_FREEZE_OUT_DIR);
  const freezeSources = await readSources(FREEZE_SOURCE_DEFINITIONS, options);
  const representativeSources = await readSources(REPRESENTATIVE_SOURCE_DEFINITIONS, options);
  const supportSources = await readSources(SUPPORT_SOURCE_DEFINITIONS, options);
  const artifacts = Object.fromEntries([...freezeSources, ...representativeSources, ...supportSources].map((source) => [source.source_id, source.data]));
  const freezeSourceStatuses = [...freezeSources, ...representativeSources].map((source) => buildFreezeSourceStatus(source));
  const representativeTraces = buildRepresentativeTraces(artifacts, generatedAt);
  const freezeCheckpoints = buildFreezeCheckpoints({ artifacts, freezeSourceStatuses, representativeTraces });
  const validation = summarizeValidation(freezeCheckpoints);
  const freezeStatus = deriveFreezeStatus({ validation, representativeTraces });
  const result = {
    schema_version: "evidence-plane-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `evidence-plane-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    evidence_plane_freeze_status: freezeStatus,
    safe_handling: {
      freeze_report_only: true,
      source_artifact_mutation_allowed: false,
      protected_actions_executed: false,
      external_delivery_executed: false,
      external_model_call_executed: false,
      auto_approval_allowed: false,
    },
    inputs: normalizeInputs(options),
    freeze_scope: {
      track: "Resource, Data, Evidence, Lineage Plane",
      frozen_slots: [
        "P133",
        "P134",
        "P135",
        "P136",
        "P137",
        "P138",
        "P139",
        "P140",
        "P141",
        "P142",
        "P143",
        "P144",
        "P145",
        "P146",
        "P147",
        "P148",
        "P149",
        "P150",
        "P151",
        "P152",
        "P153",
        "P154",
        "P155",
        "P156",
        "P157",
        "P158",
      ],
      source_phase_range: "Phase 133-157",
      representative_slice: "law-firm-ldd-slice",
      next_planned_slot: "P159",
      next_track: "Event, Run Ledger, Audit, Observability",
    },
    evidence_plane_freeze_contract: buildEvidencePlaneFreezeContract(generatedAt),
    freeze_source_statuses: freezeSourceStatuses,
    freeze_checkpoints: freezeCheckpoints,
    representative_traces: representativeTraces,
    freeze_note: buildFreezeNote({ generatedAt, freezeStatus, freezeSourceStatuses, freezeCheckpoints, representativeTraces }),
    validation,
    summary: summarizeFreeze({ freezeStatus, freezeSourceStatuses, freezeCheckpoints, representativeTraces, artifacts, validation }),
  };
  return {
    ...result,
    markdown: renderEvidencePlaneFreezeMarkdown(result),
  };
}

export async function writeEvidencePlaneFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "evidence-plane-freeze.json"), serializableEvidencePlaneFreeze(result));
  await writeJson(path.join(outDir, "freeze-source-statuses.json"), {
    schema_version: "evidence-plane-freeze-source-statuses.v1",
    generated_at: result.generated_at,
    freeze_source_status_count: result.freeze_source_statuses.length,
    freeze_source_statuses: result.freeze_source_statuses,
  });
  await writeJson(path.join(outDir, "freeze-checkpoints.json"), {
    schema_version: "evidence-plane-freeze-checkpoints.v1",
    generated_at: result.generated_at,
    freeze_checkpoint_count: result.freeze_checkpoints.length,
    freeze_checkpoints: result.freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "representative-traces.json"), {
    schema_version: "evidence-plane-representative-traces.v1",
    generated_at: result.generated_at,
    representative_trace_count: result.representative_traces.length,
    representative_traces: result.representative_traces,
  });
  await writeJson(path.join(outDir, "freeze-note.json"), result.freeze_note);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "evidence-plane-freeze-validation-report.v1",
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    freeze_checkpoints: result.freeze_checkpoints,
  });
  await writeFile(path.join(outDir, "freeze-note.md"), renderFreezeNoteMarkdown(result.freeze_note), "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidencePlaneFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidencePlaneFreeze(args);
    console.log(`Evidence Plane freeze written to ${result.output_dir}`);
    console.log(`Freeze status: ${result.evidence_plane_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_freeze_source_count}/${result.summary.freeze_source_count}`);
    console.log(`Checkpoints: ${result.summary.passed_freeze_checkpoint_count}/${result.summary.freeze_checkpoint_count}`);
    console.log(`Representative traces: ${result.summary.complete_representative_trace_count}/${result.summary.representative_trace_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readSources(definitions, options) {
  const inputs = normalizeInputs(options);
  const sources = [];
  for (const definition of definitions) {
    const configuredPath = inputs[snakeCase(definition.option)];
    const readResult = definition.format === "text"
      ? await readTextOrError(configuredPath)
      : await readJsonOrError(configuredPath);
    sources.push({
      ...definition,
      path: configuredPath,
      available: readResult.ok,
      schema_version: readResult.value?.schema_version ?? null,
      generated_at: readResult.value?.generated_at ?? null,
      summary: readResult.value?.summary ?? null,
      content_hash: readResult.raw ? sha256(readResult.raw) : null,
      observed_status: definition.status_key ? readResult.value?.summary?.[definition.status_key] ?? null : readResult.ok ? "available" : null,
      data: readResult.value,
      error: readResult.error,
    });
  }
  return sources;
}

function buildFreezeSourceStatus(source) {
  const statusMatches = source.expected_status === null || source.observed_status === source.expected_status;
  return {
    schema_version: "evidence-plane-freeze-source-status.v1",
    source_id: source.source_id,
    label: source.label,
    planned_slot: source.planned_slot,
    path: source.path,
    available: source.available,
    schema_version_observed: source.schema_version,
    generated_at: source.generated_at,
    status_key: source.status_key,
    expected_status: source.expected_status,
    observed_status: source.observed_status,
    source_status: source.available && statusMatches && sourceValidationErrors(source.data) === 0 ? "passed" : "failed",
    validation_error_count: sourceValidationErrors(source.data),
    content_hash: source.content_hash,
    error: source.error,
  };
}

function buildRepresentativeTraces(artifacts, generatedAt) {
  const resourceEvidence = artifacts.law_firm_ldd_slice?.resource_evidence ?? {};
  const resources = resourceEvidence.resources ?? [];
  const sourceSpans = resourceEvidence.source_spans ?? [];
  const evidenceItems = resourceEvidence.evidence_items ?? [];
  const citations = resourceEvidence.citations ?? [];
  const outputArtifacts = artifacts.output_delivery_contract_freeze?.output_delivery_contract?.output_artifacts ?? [];
  const outputBindings = artifacts.output_delivery_contract_freeze?.output_delivery_contract?.output_delivery_bindings ?? [];
  const eventRecords = artifacts.event_audit_run_contract_freeze?.event_audit_run_contract?.event_records ?? [];
  const runLedgers = artifacts.event_audit_run_contract_freeze?.event_audit_run_contract?.run_ledgers ?? [];
  const custodyEvents = artifacts.chain_of_custody_events?.custody_event_catalog?.custody_events ?? [];
  const exportBundles = artifacts.evidence_export_bundle?.evidence_export_catalog?.export_bundles ?? [];
  const lineagePaths = artifacts.lineage_graph_builder?.lineage_graph_catalog?.lineage_paths ?? [];
  const traces = [];

  for (const citation of citations) {
    const outputArtifact = outputArtifacts.find((artifact) => artifact.output_artifact_id === citation.output_artifact_id);
    if (!outputArtifact) continue;

    const sourceSpan = sourceSpans.find((span) => citation.source_span_ids?.includes(span.id));
    const evidenceItem = evidenceItems.find((item) => citation.evidence_item_ids?.includes(item.id));
    const resource = resources.find((candidate) => candidate.id === sourceSpan?.resource_id);
    if (!resource) continue;

    const resourceKey = resourceKeyFromId(resource.id);
    const workflowEvents = eventRecords.filter((event) => event.workflow_run_id === outputArtifact.workflow_run_id);
    const outputEvent = workflowEvents.find((event) => event.subject_id === outputArtifact.output_artifact_id && event.event_type === "output.rendered")
      ?? eventRecords.find((event) => event.event_record_id === outputArtifact.event_id);
    const approvalEvent = workflowEvents.find((event) => event.event_type === "approval.requested");
    const humanGateEvent = workflowEvents.find((event) => event.event_type === "gate.failed" && String(event.subject_id).includes("human_approval_gate"));
    const runLedger = runLedgers.find((run) => run.run_ledger_id === outputArtifact.created_by_run_id)
      ?? runLedgers.find((run) => run.run_ledger_id === outputEvent?.run_ledger_id);
    const custodyMatches = custodyEvents.filter((event) => eventMatchesResource(event, resource.id, sourceSpan.resource_version_id, resourceKey));
    const exportBundle = exportBundles.find((bundle) => bundle.source_package?.resource_id === resource.id || String(bundle.export_bundle_id).includes(resourceKey));
    const lineagePath = lineagePaths.find((lineage) => String(lineage.lineage_path_id).includes(resourceKey) || String(lineage.source_span_id).includes(resourceKey));
    const outputBinding = outputBindings.find((binding) => binding.output_artifact_id === outputArtifact.output_artifact_id);
    const traceStatus = resource
      && sourceSpan
      && evidenceItem
      && citation
      && outputArtifact
      && outputEvent
      && approvalEvent
      && humanGateEvent
      && custodyMatches.length > 0
      && exportBundle
      && lineagePath
      ? "complete"
      : "attention";

    traces.push({
      schema_version: TRACE_SCHEMA_VERSION,
      trace_id: `evidence-plane-trace.${resourceKey}.${slug(outputArtifact.output_artifact_id)}`,
      generated_at: generatedAt,
      trace_status: traceStatus,
      tenant_id: resource.tenant_id ?? outputArtifact.tenant_id ?? null,
      matter_id: resource.matter_id ?? outputArtifact.matter_id ?? null,
      classification: resource.classification ?? exportBundle?.classification ?? null,
      policy_snapshot_id: outputArtifact.policy_snapshot_id ?? exportBundle?.policy_snapshot_id ?? null,
      resource_ref: {
        resource_id: resource.id,
        resource_version_id: sourceSpan.resource_version_id ?? null,
        source_uri: resource.source_uri ?? null,
        content_hash: resource.content_hash ?? null,
        materialization_status: resource.materialization_status ?? null,
        ingestion_status: resource.ingestion_status ?? null,
      },
      evidence_ref: {
        source_span_id: sourceSpan.id,
        evidence_item_id: evidenceItem.id,
        evidence_type: evidenceItem.evidence_type ?? null,
        review_status: evidenceItem.review_status ?? null,
        lineage_path_id: lineagePath?.lineage_path_id ?? exportBundle?.lineage_path_id ?? null,
        lineage_path_status: lineagePath?.path_status ?? null,
        export_bundle_id: exportBundle?.export_bundle_id ?? null,
        export_bundle_status: exportBundle?.bundle_status ?? null,
        export_status: exportBundle?.export_status ?? null,
      },
      citation_ref: {
        citation_id: citation.id,
        citation_status: citation.citation_status ?? null,
        target_path: citation.target_path ?? null,
        source_span_ids: citation.source_span_ids ?? [],
        evidence_item_ids: citation.evidence_item_ids ?? [],
        output_paragraph_id: exportBundle?.output_paragraph_id ?? null,
      },
      output_ref: {
        output_artifact_id: outputArtifact.output_artifact_id,
        artifact_type: outputArtifact.artifact_type ?? null,
        output_status: outputArtifact.output_status ?? null,
        delivery_state: outputArtifact.delivery_state ?? null,
        approval_status: outputArtifact.approval_status ?? null,
        blocking_gate_ids: outputArtifact.blocking_gate_ids ?? [],
        citation_count: outputArtifact.citation_count ?? 0,
        output_delivery_binding_id: outputBinding?.output_delivery_binding_id ?? null,
        delivery_separation_status: outputArtifact.delivery_separation_status ?? null,
      },
      audit_refs: {
        workflow_run_id: outputArtifact.workflow_run_id ?? null,
        run_ledger_id: outputEvent?.run_ledger_id ?? null,
        run_ledger_bound: Boolean(outputEvent?.run_ledger_id || runLedger),
        event_record_ids: workflowEvents.map((event) => event.event_record_id),
        event_record_count: workflowEvents.length,
        output_event_record_id: outputEvent?.event_record_id ?? null,
        approval_requested_event_id: approvalEvent?.event_record_id ?? null,
        human_approval_gate_event_id: humanGateEvent?.event_record_id ?? null,
        custody_event_ids: custodyMatches.map((event) => event.custody_event_id),
        custody_event_count: custodyMatches.length,
        audit_binding_status: outputEvent && custodyMatches.length > 0 ? "event_records_and_custody_bound" : "attention",
      },
      guardrails: {
        attorney_review_required: outputArtifact.approval_status === "pending" || exportBundle?.review_gate?.attorney_review_required === true,
        output_delivery_allowed: exportBundle?.review_gate?.output_delivery_allowed === true,
        external_transfer_allowed: exportBundle?.review_gate?.external_transfer_allowed === true,
        client_facing_ready: Boolean(exportBundle?.review_gate?.client_facing_ready),
        output_delivery_blocked: ["blocked_pending_approval", "blocked_by_gate"].includes(outputArtifact.delivery_state),
        human_approval_gate_failed_as_expected: Boolean(humanGateEvent),
      },
      preservation: {
        matter_preserved: resource.matter_id === outputArtifact.matter_id && (exportBundle ? resource.matter_id === exportBundle.matter_id : true),
        classification_preserved: exportBundle ? resource.classification === exportBundle.classification : true,
        policy_snapshot_preserved: exportBundle ? outputArtifact.policy_snapshot_id === exportBundle.policy_snapshot_id : true,
      },
    });
  }

  return traces.slice(0, 3);
}

function buildFreezeCheckpoints({ artifacts, freezeSourceStatuses, representativeTraces }) {
  const checkpoints = [];
  const packageText = artifacts.package_json ?? "";
  const roadmapText = artifacts.implementation_roadmap ?? "";
  for (const source of freezeSourceStatuses) {
    pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_available", source.available, `${source.label} source artifact must be readable.`);
    if (source.expected_status !== null) {
      pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_status_expected", source.observed_status === source.expected_status, `${source.label} must report ${source.status_key}=${source.expected_status}.`);
      pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_validation_clean", source.validation_error_count === 0, `${source.label} must not carry validation errors.`);
    }
    pushCheckpoint(checkpoints, `source.${source.source_id}`, "source_hash_locked", Boolean(source.content_hash), `${source.label} must have a content hash for freeze evidence.`);
  }

  pushCheckpoint(checkpoints, "representative_trace", "representative_trace_present", representativeTraces.length > 0, "At least one representative trace must pass through resource, evidence, output, and audit.");
  pushCheckpoint(checkpoints, "representative_trace", "representative_traces_complete", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.trace_status === "complete"), "Every representative trace must be complete.");
  pushCheckpoint(checkpoints, "representative_trace", "source_span_to_output_bound", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.citation_ref.source_span_ids.length > 0 && trace.output_ref.output_artifact_id), "Representative traces must bind source spans to output artifacts.");
  pushCheckpoint(checkpoints, "representative_trace", "event_ledger_bound", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.audit_refs.event_record_count > 0 && trace.audit_refs.output_event_record_id), "Representative traces must bind output artifacts to event ledger records.");
  pushCheckpoint(checkpoints, "representative_trace", "run_ledger_bound", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.audit_refs.run_ledger_bound), "Representative traces must preserve run ledger binding.");
  pushCheckpoint(checkpoints, "representative_trace", "custody_bound", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.audit_refs.custody_event_count > 0), "Representative traces must preserve chain-of-custody events.");
  pushCheckpoint(checkpoints, "representative_trace", "human_approval_gate_blocks_delivery", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.guardrails.human_approval_gate_failed_as_expected && trace.guardrails.attorney_review_required && trace.guardrails.output_delivery_blocked), "Representative law-firm output must stay blocked until attorney review.");
  pushCheckpoint(checkpoints, "representative_trace", "no_client_facing_ready", representativeTraces.every((trace) => trace.guardrails.client_facing_ready === false), "Freeze must not mark representative legal output client-facing ready.");
  pushCheckpoint(checkpoints, "representative_trace", "no_external_transfer_ready", representativeTraces.every((trace) => trace.guardrails.external_transfer_allowed === false), "Freeze must not permit external transfer for representative confidential evidence.");
  pushCheckpoint(checkpoints, "representative_trace", "matter_classification_policy_preserved", representativeTraces.length > 0 && representativeTraces.every((trace) => trace.preservation.matter_preserved && trace.preservation.classification_preserved && trace.preservation.policy_snapshot_preserved), "Representative traces must preserve matter, classification, and policy snapshot.");

  pushCheckpoint(checkpoints, "package_json", "freeze_script_registered", String(packageText).includes("\"resource:evidence-plane-freeze\""), "package.json must expose npm run resource:evidence-plane-freeze.");
  pushCheckpoint(checkpoints, "implementation_roadmap", "phase_157_recorded", String(roadmapText).includes("## Phase 157: Resource/Evidence Dashboard Summary"), "Roadmap must retain the Phase 157 completion record.");
  pushCheckpoint(checkpoints, "implementation_roadmap", "phase_158_recorded", String(roadmapText).includes("## Phase 158: Evidence Plane Freeze") || String(roadmapText).includes("| P158 | Evidence Plane freeze |"), "Roadmap must record Phase 158 completion or planned slot.");
  return checkpoints;
}

function deriveFreezeStatus({ validation, representativeTraces }) {
  if (!validation.valid) return "blocked";
  const pendingHumanAction = representativeTraces.some((trace) => trace.guardrails.attorney_review_required || trace.guardrails.output_delivery_blocked);
  return pendingHumanAction ? "frozen_with_pending_human_actions" : "frozen_clear";
}

function summarizeFreeze({ freezeStatus, freezeSourceStatuses, freezeCheckpoints, representativeTraces, artifacts, validation }) {
  const traceCount = representativeTraces.length;
  const completeTraceCount = representativeTraces.filter((trace) => trace.trace_status === "complete").length;
  return {
    evidence_plane_freeze_status: freezeStatus,
    evidence_plane_freeze_contract_id: EVIDENCE_PLANE_FREEZE_CONTRACT_ID,
    freeze_source_count: freezeSourceStatuses.length,
    passed_freeze_source_count: freezeSourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_freeze_source_count: freezeSourceStatuses.filter((source) => source.source_status === "failed").length,
    frozen_slot_count: 26,
    freeze_checkpoint_count: freezeCheckpoints.length,
    passed_freeze_checkpoint_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status === "passed").length,
    failed_freeze_checkpoint_count: freezeCheckpoints.filter((checkpoint) => checkpoint.status === "failed").length,
    representative_trace_count: traceCount,
    complete_representative_trace_count: completeTraceCount,
    representative_resource_count: new Set(representativeTraces.map((trace) => trace.resource_ref.resource_id)).size,
    representative_evidence_bound_count: representativeTraces.filter((trace) => trace.evidence_ref.evidence_item_id && trace.evidence_ref.source_span_id).length,
    representative_output_bound_count: representativeTraces.filter((trace) => trace.output_ref.output_artifact_id).length,
    representative_audit_event_bound_count: representativeTraces.filter((trace) => trace.audit_refs.event_record_count > 0 && trace.audit_refs.output_event_record_id).length,
    representative_custody_bound_count: representativeTraces.filter((trace) => trace.audit_refs.custody_event_count > 0).length,
    representative_event_ledger_bound_count: representativeTraces.filter((trace) => trace.audit_refs.event_record_count > 0).length,
    representative_run_ledger_bound_count: representativeTraces.filter((trace) => trace.audit_refs.run_ledger_bound).length,
    source_span_to_output_path_count: representativeTraces.filter((trace) => trace.citation_ref.source_span_ids.length > 0 && trace.output_ref.output_artifact_id).length,
    output_delivery_blocked_count: representativeTraces.filter((trace) => trace.guardrails.output_delivery_blocked).length,
    attorney_review_required_count: representativeTraces.filter((trace) => trace.guardrails.attorney_review_required).length,
    external_transfer_blocked_count: representativeTraces.filter((trace) => trace.guardrails.external_transfer_allowed === false).length,
    client_facing_ready_count: representativeTraces.filter((trace) => trace.guardrails.client_facing_ready).length,
    lineage_source_to_output_path_count: artifacts.lineage_graph_builder?.summary?.source_to_output_path_count ?? 0,
    evidence_export_bundle_count: artifacts.evidence_export_bundle?.summary?.export_bundle_count ?? 0,
    custody_event_count: artifacts.chain_of_custody_events?.summary?.custody_event_count ?? 0,
    law_firm_output_artifact_count: (artifacts.output_delivery_contract_freeze?.output_delivery_contract?.output_artifacts ?? []).filter((artifact) => artifact.domain_pack === "law-firm").length,
    event_record_count: artifacts.event_audit_run_contract_freeze?.summary?.event_record_count ?? 0,
    run_ledger_count: artifacts.event_audit_run_contract_freeze?.summary?.run_ledger_count ?? 0,
    source_validation_error_count: freezeSourceStatuses.reduce((sum, source) => sum + source.validation_error_count, 0),
    validation_error_count: validation.errors.length,
  };
}

function buildEvidencePlaneFreezeContract(generatedAt) {
  return {
    schema_version: "evidence-plane-freeze-contract.v1",
    evidence_plane_freeze_contract_id: EVIDENCE_PLANE_FREEZE_CONTRACT_ID,
    generated_at: generatedAt,
    source_rule: "Freeze reads P133-P157 artifacts and does not mutate source resource, evidence, output, event, audit, or custody records.",
    representative_trace_rule: "At least one matter-scoped law-firm resource must bind resource -> source span -> evidence -> citation -> output -> event/run ledger -> custody.",
    guardrail_rule: "Law-firm outputs remain pending attorney review, blocked from delivery, blocked from external transfer, and not client-facing ready.",
    api_routes: [
      "/api/evidence-plane-freezes",
      "/api/evidence-plane-freeze-sources",
      "/api/evidence-plane-freeze-checkpoints",
      "/api/evidence-plane-representative-traces",
      "/api/evidence-plane-freeze-validations",
    ],
  };
}

function buildFreezeNote({ generatedAt, freezeStatus, freezeSourceStatuses, freezeCheckpoints, representativeTraces }) {
  const failedCheckpoints = freezeCheckpoints.filter((checkpoint) => checkpoint.status === "failed");
  return {
    schema_version: "evidence-plane-freeze-note.v1",
    generated_at: generatedAt,
    freeze_status: freezeStatus,
    decision: failedCheckpoints.length === 0 ? "freeze_accepted" : "freeze_blocked",
    reviewer_note: "Evidence Plane freeze is an internal harness control artifact. It does not approve legal advice, client delivery, filing, or external model transmission.",
    source_summary: {
      source_count: freezeSourceStatuses.length,
      passed_source_count: freezeSourceStatuses.filter((source) => source.source_status === "passed").length,
      failed_source_count: freezeSourceStatuses.filter((source) => source.source_status === "failed").length,
    },
    representative_trace_summary: {
      representative_trace_count: representativeTraces.length,
      complete_representative_trace_count: representativeTraces.filter((trace) => trace.trace_status === "complete").length,
      attorney_review_required_count: representativeTraces.filter((trace) => trace.guardrails.attorney_review_required).length,
      client_facing_ready_count: representativeTraces.filter((trace) => trace.guardrails.client_facing_ready).length,
    },
    failed_checkpoints: failedCheckpoints.map((checkpoint) => ({
      checkpoint_id: checkpoint.checkpoint_id,
      check_id: checkpoint.check_id,
      message: checkpoint.message,
    })),
  };
}

function serializableEvidencePlaneFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderEvidencePlaneFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Plane Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Freeze status: ${result.evidence_plane_freeze_status}`);
  lines.push("");
  lines.push(`- Sources: ${result.summary.passed_freeze_source_count}/${result.summary.freeze_source_count}`);
  lines.push(`- Checkpoints: ${result.summary.passed_freeze_checkpoint_count}/${result.summary.freeze_checkpoint_count}`);
  lines.push(`- Representative traces: ${result.summary.complete_representative_trace_count}/${result.summary.representative_trace_count}`);
  lines.push(`- Evidence bound traces: ${result.summary.representative_evidence_bound_count}`);
  lines.push(`- Output bound traces: ${result.summary.representative_output_bound_count}`);
  lines.push(`- Audit/event bound traces: ${result.summary.representative_audit_event_bound_count}`);
  lines.push(`- Client-facing ready: ${result.summary.client_facing_ready_count}`);
  lines.push("");
  lines.push("## Representative Traces");
  lines.push("");
  for (const trace of result.representative_traces) {
    lines.push(`- ${trace.trace_id}: ${trace.trace_status} (${trace.resource_ref.resource_id} -> ${trace.output_ref.output_artifact_id})`);
  }
  lines.push("");
  lines.push("## Failed Checkpoints");
  lines.push("");
  const failed = result.freeze_checkpoints.filter((checkpoint) => checkpoint.status === "failed");
  if (failed.length === 0) {
    lines.push("- none");
  } else {
    for (const checkpoint of failed) lines.push(`- ${checkpoint.checkpoint_id}.${checkpoint.check_id}: ${checkpoint.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function renderFreezeNoteMarkdown(freezeNote) {
  const lines = [];
  lines.push("# Evidence Plane Freeze Note");
  lines.push("");
  lines.push(`Generated: ${freezeNote.generated_at}`);
  lines.push(`Decision: ${freezeNote.decision}`);
  lines.push(`Freeze status: ${freezeNote.freeze_status}`);
  lines.push("");
  lines.push(freezeNote.reviewer_note);
  lines.push("");
  lines.push(`- Passed sources: ${freezeNote.source_summary.passed_source_count}/${freezeNote.source_summary.source_count}`);
  lines.push(`- Complete traces: ${freezeNote.representative_trace_summary.complete_representative_trace_count}/${freezeNote.representative_trace_summary.representative_trace_count}`);
  lines.push(`- Attorney review required: ${freezeNote.representative_trace_summary.attorney_review_required_count}`);
  lines.push(`- Client-facing ready: ${freezeNote.representative_trace_summary.client_facing_ready_count}`);
  return `${lines.join("\n")}\n`;
}

function pushCheckpoint(checkpoints, checkpointId, checkId, passed, message) {
  checkpoints.push({
    schema_version: "evidence-plane-freeze-checkpoint.v1",
    checkpoint_id: checkpointId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.checkpoint_id, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function sourceDefinition(sourceId, label, option, plannedSlot, statusKey, expectedStatus, format = "json") {
  return {
    source_id: sourceId,
    label,
    option,
    planned_slot: plannedSlot,
    status_key: statusKey,
    expected_status: expectedStatus,
    format,
  };
}

function eventMatchesResource(event, resourceId, resourceVersionId, resourceKey) {
  const ids = [
    event.subject_ref?.subject_id,
    event.subject?.subject_id,
    event.subject_id,
    ...(event.linked_refs ?? []).map((ref) => ref.ref_id ?? ref.subject_id),
  ].filter(Boolean);
  return ids.some((id) => id === resourceId || id === resourceVersionId || String(id).includes(resourceKey));
}

function sourceValidationErrors(artifact) {
  return artifact?.summary?.validation_error_count
    ?? artifact?.summary?.failed_validation_item_count
    ?? artifact?.validation?.errors?.length
    ?? 0;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      ok: true,
      value: JSON.parse(raw),
      raw,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      raw: null,
      error: error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      ok: true,
      value: raw,
      raw,
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      raw: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options = {}) {
  return {
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.resourceStoreInterfacePath),
    immutable_object_store_layout_path: path.resolve(options.immutableObjectStoreLayoutPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.immutableObjectStoreLayoutPath),
    resource_version_ledger_path: path.resolve(options.resourceVersionLedgerPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.resourceVersionLedgerPath),
    resource_dedup_hash_ledger_path: path.resolve(options.resourceDedupHashLedgerPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.resourceDedupHashLedgerPath),
    resource_quarantine_model_path: path.resolve(options.resourceQuarantineModelPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.resourceQuarantineModelPath),
    normalized_text_contract_path: path.resolve(options.normalizedTextContractPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.normalizedTextContractPath),
    extractor_adapter_contract_path: path.resolve(options.extractorAdapterContractPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.extractorAdapterContractPath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.evidenceItemStorePath),
    evidence_golden_fixtures_path: path.resolve(options.evidenceGoldenFixturesPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.evidenceGoldenFixturesPath),
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.factClaimStorePath),
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.issueGraphStorePath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.citationObjectStorePath),
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.lineageGraphPath),
    evidence_coverage_path: path.resolve(options.evidenceCoveragePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.evidenceCoveragePath),
    evidence_flags_path: path.resolve(options.evidenceFlagsPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.evidenceFlagsPath),
    exhibit_map_path: path.resolve(options.exhibitMapPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.exhibitMapPath),
    chain_of_custody_events_path: path.resolve(options.chainOfCustodyEventsPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.chainOfCustodyEventsPath),
    search_index_contract_path: path.resolve(options.searchIndexContractPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.searchIndexContractPath),
    vector_index_policy_boundary_path: path.resolve(options.vectorIndexPolicyBoundaryPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.vectorIndexPolicyBoundaryPath),
    retrieval_filter_compiler_path: path.resolve(options.retrievalFilterCompilerPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.retrievalFilterCompilerPath),
    evidence_viewer_data_api_path: path.resolve(options.evidenceViewerDataApiPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.evidenceViewerDataApiPath),
    evidence_export_bundle_path: path.resolve(options.evidenceExportBundlePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.evidenceExportBundlePath),
    evidence_regression_tests_path: path.resolve(options.evidenceRegressionTestsPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.evidenceRegressionTestsPath),
    resource_evidence_dashboard_summary_path: path.resolve(options.resourceEvidenceDashboardSummaryPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.resourceEvidenceDashboardSummaryPath),
    law_firm_slice_path: path.resolve(options.lawFirmSlicePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.lawFirmSlicePath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.outputDeliveryContractFreezePath),
    event_audit_run_contract_freeze_path: path.resolve(options.eventAuditRunContractFreezePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.eventAuditRunContractFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_PLANE_FREEZE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--immutable-object-store-layout") parsed.immutableObjectStoreLayoutPath = argv[++index];
    else if (arg === "--resource-version-ledger") parsed.resourceVersionLedgerPath = argv[++index];
    else if (arg === "--resource-dedup-hash") parsed.resourceDedupHashLedgerPath = argv[++index];
    else if (arg === "--resource-quarantine") parsed.resourceQuarantineModelPath = argv[++index];
    else if (arg === "--normalized-text-contract") parsed.normalizedTextContractPath = argv[++index];
    else if (arg === "--extractor-adapter-contract") parsed.extractorAdapterContractPath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--evidence-golden-fixtures") parsed.evidenceGoldenFixturesPath = argv[++index];
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--evidence-coverage") parsed.evidenceCoveragePath = argv[++index];
    else if (arg === "--evidence-flags") parsed.evidenceFlagsPath = argv[++index];
    else if (arg === "--exhibit-map") parsed.exhibitMapPath = argv[++index];
    else if (arg === "--chain-of-custody") parsed.chainOfCustodyEventsPath = argv[++index];
    else if (arg === "--search-index") parsed.searchIndexContractPath = argv[++index];
    else if (arg === "--vector-policy") parsed.vectorIndexPolicyBoundaryPath = argv[++index];
    else if (arg === "--retrieval-filters") parsed.retrievalFilterCompilerPath = argv[++index];
    else if (arg === "--evidence-viewer-data-api") parsed.evidenceViewerDataApiPath = argv[++index];
    else if (arg === "--evidence-export-bundle") parsed.evidenceExportBundlePath = argv[++index];
    else if (arg === "--evidence-regression-tests") parsed.evidenceRegressionTestsPath = argv[++index];
    else if (arg === "--resource-evidence-dashboard") parsed.resourceEvidenceDashboardSummaryPath = argv[++index];
    else if (arg === "--law-firm-slice") parsed.lawFirmSlicePath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-plane-freeze.mjs [options]

Options:
  --check                                      fail if freeze validation fails.
  --out-dir <path>                            output directory.
  --law-firm-slice <path>                     law-firm-ldd-slice.json path.
  --output-delivery-contract-freeze <path>    output-delivery-contract-freeze.json path.
  --event-audit-run-contract-freeze <path>    event-audit-run-contract-freeze.json path.
  --resource-evidence-dashboard <path>        resource-evidence-dashboard-summary.json path.
  --help                                      show this help.
`);
}

function dateStamp(isoString) {
  return isoString.replaceAll(":", "").replaceAll(".", "").replace("Z", "Z").replaceAll("-", "");
}

function resourceKeyFromId(id) {
  return String(id).replace(/^resource\./, "").replaceAll(".", "-").replaceAll("_", "-");
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function snakeCase(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runEvidencePlaneFreezeCli();
}
