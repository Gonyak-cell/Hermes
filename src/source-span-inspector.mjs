import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SOURCE_SPAN_INSPECTOR_OUT_DIR = "artifacts/source-span-inspector/latest";
export const DEFAULT_SOURCE_SPAN_INSPECTOR_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  evidenceViewerUiPath: "artifacts/evidence-viewer-ui/latest/evidence-viewer-ui.json",
};

const SCHEMA_VERSION = "source-span-inspector.v1";
const CAPABILITY_ID = "dashboard.source_span_inspector";
const PHASE_SLOT = "P291";
const PREVIOUS_PHASE_SLOT = "P290";
const NEXT_PHASE_SLOT = "P292";
const PANEL_DEFINITIONS = [
  ["source_locations", "Source Locations", "Source span locator and location unit comparison rows."],
  ["normalized_text", "Normalized Text", "Normalized text preview and object-key comparison rows."],
  ["extracted_facts", "Extracted Facts", "Extracted fact claim comparison rows bound to source spans."],
  ["inspection_status", "Inspection Status", "Read-only inspection status rows and human-review boundaries."],
];

export async function runSourceSpanInspector(options = {}) {
  const result = await buildSourceSpanInspector(options);
  if (options.write !== false) await writeSourceSpanInspector(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Source Span Inspector validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSourceSpanInspector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SOURCE_SPAN_INSPECTOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    sourceSpanStore,
    normalizedTextContract,
    factClaimStore,
    evidenceViewerUi,
  ] = await Promise.all([
    readJson(inputs.package_path),
    readText(inputs.roadmap_path),
    readText(inputs.implementation_roadmap_path),
    readText(inputs.review_dashboard_path),
    readText(inputs.review_api_path),
    readText(inputs.review_api_doc_path),
    readJson(inputs.source_span_store_path),
    readJson(inputs.normalized_text_contract_path),
    readJson(inputs.fact_claim_store_path),
    readJson(inputs.evidence_viewer_ui_path),
  ]);

  const context = buildJoinContext({
    sourceSpanStore,
    normalizedTextContract,
    factClaimStore,
    evidenceViewerUi,
  });
  const rows = buildInspectorRows({ context, generatedAt });
  const locationComparisons = rows.map(toLocationComparison);
  const normalizedTextComparisons = rows.map(toNormalizedTextComparison);
  const extractedFactComparisons = rows.map(toExtractedFactComparison);
  const panels = buildPanels({ rows, locationComparisons, normalizedTextComparisons, extractedFactComparisons, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    sourceSpanStore,
    normalizedTextContract,
    factClaimStore,
    evidenceViewerUi,
    rows,
    locationComparisons,
    normalizedTextComparisons,
    extractedFactComparisons,
    panels,
    boundary,
  });
  const validation = summarizeValidation(checks);
  const summary = summarizeSourceSpanInspector({
    sourceSpanStore,
    normalizedTextContract,
    factClaimStore,
    evidenceViewerUi,
    rows,
    locationComparisons,
    normalizedTextComparisons,
    extractedFactComparisons,
    panels,
    boundary,
    checks,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    source_span_inspector_id: summary.source_span_inspector_id,
    source_span_inspector_status: summary.source_span_inspector_status,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({ sourceSpanStore, normalizedTextContract, factClaimStore, evidenceViewerUi }),
    source_span_inspector_contract: buildInspectorContract(generatedAt),
    source_span_inspector_panels: panels,
    source_span_inspector_rows: rows,
    source_span_location_comparisons: locationComparisons,
    normalized_text_comparisons: normalizedTextComparisons,
    extracted_fact_comparisons: extractedFactComparisons,
    source_span_inspector_boundary: boundary,
    source_span_inspector_checks: checks,
    validation_items: checks,
    validation,
    summary,
  };
  result.summary_markdown = buildSummaryMarkdown(result);
  return result;
}

function buildJoinContext({ sourceSpanStore, normalizedTextContract, factClaimStore, evidenceViewerUi }) {
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const sourceSpanLocators = sourceSpanStore.source_span_catalog?.source_span_locators ?? [];
  const sourceSpanLocationUnits = sourceSpanStore.source_span_catalog?.source_span_location_units ?? [];
  const normalizedTextArtifacts = normalizedTextContract.normalized_text_catalog?.normalized_text_artifacts ?? [];
  const locationMaps = normalizedTextContract.normalized_text_catalog?.location_maps ?? [];
  const factClaims = factClaimStore.fact_claim_catalog?.fact_claims ?? [];
  const evidenceBindings = factClaimStore.fact_claim_catalog?.evidence_bindings ?? [];
  const viewerRows = evidenceViewerUi.evidence_viewer_ui_source_spans ?? [];
  const viewerCards = evidenceViewerUi.evidence_viewer_ui_cards ?? [];
  return {
    sourceSpans: [...sourceSpans].sort(by("source_span_id")),
    locatorBySpanId: mapBy(sourceSpanLocators, "source_span_id"),
    locationUnitBySpanId: mapBy(sourceSpanLocationUnits, "source_span_id"),
    normalizedTextById: mapBy(normalizedTextArtifacts, "normalized_text_id"),
    locationMapByNormalizedTextId: mapBy(locationMaps, "normalized_text_id"),
    factsBySpanId: mapFactsBySpanId(factClaims),
    bindingByEvidenceId: mapBy(evidenceBindings, "evidence_id"),
    viewerRowBySpanId: mapBy(viewerRows, "source_span_id"),
    viewerCardBySpanId: mapBy(viewerCards, "source_span_id"),
  };
}

function buildInspectorRows({ context, generatedAt }) {
  return context.sourceSpans.map((span) => {
    const locatorRow = context.locatorBySpanId.get(span.source_span_id) ?? null;
    const locationUnit = context.locationUnitBySpanId.get(span.source_span_id) ?? null;
    const normalizedText = context.normalizedTextById.get(span.normalized_text_id) ?? null;
    const locationMap = context.locationMapByNormalizedTextId.get(span.normalized_text_id) ?? null;
    const fact = context.factsBySpanId.get(span.source_span_id) ?? null;
    const viewerRow = context.viewerRowBySpanId.get(span.source_span_id) ?? null;
    const viewerCard = context.viewerCardBySpanId.get(span.source_span_id) ?? null;
    const evidenceId = viewerCard?.evidence_id ?? fact?.primary_evidence_item_id ?? null;
    const evidenceBinding = evidenceId ? context.bindingByEvidenceId.get(evidenceId) ?? null : null;
    const locationStatus = locationMatched(span, locatorRow, locationUnit, locationMap) ? "matched" : "attention";
    const normalizedStatus = normalizedTextMatched(span, normalizedText, locationMap) ? "matched" : "attention";
    const factStatus = factMatched(span, fact, evidenceBinding, viewerCard) ? "matched" : "attention";
    const comparisonStatus = [locationStatus, normalizedStatus, factStatus].every((status) => status === "matched")
      ? "matched"
      : "attention";
    return {
      schema_version: "source-span-inspector-row.v1",
      source_span_inspector_row_id: `source-span-inspector.${slugify(span.source_span_id)}`,
      generated_at: generatedAt,
      inspection_status: comparisonStatus === "matched" ? "ready" : "attention",
      comparison_status: comparisonStatus,
      source_span_id: span.source_span_id,
      source_span_store_record_id: span.source_span_store_record_id,
      tenant_id: span.tenant_id ?? null,
      matter_id: span.matter_id ?? null,
      classification: span.classification ?? null,
      policy_snapshot_id: span.policy_snapshot_id ?? null,
      resource_id: span.resource_id,
      resource_version_id: span.resource_version_id,
      normalized_text_id: span.normalized_text_id,
      normalized_text_artifact_id: span.normalized_text_artifact_id,
      location_type: span.location_type,
      locator: span.locator,
      locator_status: span.locator_status ?? span.locator?.locator_status ?? null,
      location_unit_id: locationUnit?.location_unit_id ?? span.location_unit_id ?? null,
      source_locator_strategy: span.source_locator_strategy ?? null,
      timestamp_status: span.timestamp_status,
      offset_unit: span.locator?.offset_unit ?? "utf16_code_unit",
      char_start: span.locator?.char_start ?? null,
      char_end: span.locator?.char_end ?? null,
      page_start: span.locator?.page_start ?? null,
      page_end: span.locator?.page_end ?? null,
      paragraph_index: span.locator?.paragraph_index ?? null,
      line_index: span.locator?.line_index ?? null,
      normalized_text_object_key: normalizedText?.text_storage?.normalized_text_object_key ?? null,
      raw_source_object_key: normalizedText?.text_storage?.raw_source_object_key ?? null,
      raw_source_binding_status: normalizedText?.text_storage?.raw_source_binding_status ?? "unknown",
      normalized_text_preview: normalizedText?.text_preview ?? "",
      source_span_preview: span.content_preview ?? "",
      text_hash: span.text_hash ?? null,
      normalized_text_hash: normalizedText?.text_hash ?? null,
      preview_match_status: previewMatches(span.content_preview, normalizedText?.text_preview) ? "matched" : "attention",
      fact_id: fact?.fact_id ?? null,
      fact_type: fact?.fact_type ?? null,
      fact_statement: fact?.statement ?? null,
      fact_confidence: fact?.confidence ?? null,
      fact_reliability: fact?.reliability ?? null,
      fact_review_status: fact?.review_status ?? null,
      fact_verification_state: fact?.verification_state ?? null,
      evidence_id: evidenceId,
      evidence_binding_status: evidenceBinding?.binding_status ?? (evidenceId ? "bound" : "missing"),
      viewer_card_id: viewerCard?.viewer_card_id ?? null,
      evidence_viewer_ui_card_id: viewerCard?.evidence_viewer_ui_card_id ?? null,
      evidence_viewer_ui_source_span_row_id: viewerRow?.source_span_row_id ?? null,
      location_comparison_status: locationStatus,
      normalized_text_comparison_status: normalizedStatus,
      extracted_fact_comparison_status: factStatus,
      read_only: true,
      preview_only: true,
      source_file_content_read_performed: false,
      normalized_text_object_read_performed: false,
      source_ingest_performed: false,
      fact_mutation_performed: false,
      legal_advice_generated: false,
      client_facing_output_generated: false,
      human_review_required: true,
      client_facing_ready: false,
    };
  });
}

function toLocationComparison(row) {
  return {
    schema_version: "source-span-location-comparison.v1",
    location_comparison_id: `source-span-location-comparison.${slugify(row.source_span_id)}`,
    generated_at: row.generated_at,
    source_span_id: row.source_span_id,
    normalized_text_id: row.normalized_text_id,
    resource_id: row.resource_id,
    location_type: row.location_type,
    comparison_status: row.location_comparison_status,
    locator_status: row.locator_status,
    source_locator_strategy: row.source_locator_strategy,
    location_unit_id: row.location_unit_id,
    offset_unit: row.offset_unit,
    char_start: row.char_start,
    char_end: row.char_end,
    page_start: row.page_start,
    page_end: row.page_end,
    paragraph_index: row.paragraph_index,
    line_index: row.line_index,
    timestamp_status: row.timestamp_status,
    raw_source_object_key: row.raw_source_object_key,
    raw_source_binding_status: row.raw_source_binding_status,
    read_only: true,
    preview_only: true,
    source_file_content_read_performed: false,
  };
}

function toNormalizedTextComparison(row) {
  return {
    schema_version: "normalized-text-comparison.v1",
    normalized_text_comparison_id: `normalized-text-comparison.${slugify(row.source_span_id)}`,
    generated_at: row.generated_at,
    source_span_id: row.source_span_id,
    normalized_text_id: row.normalized_text_id,
    normalized_text_artifact_id: row.normalized_text_artifact_id,
    comparison_status: row.normalized_text_comparison_status,
    preview_match_status: row.preview_match_status,
    text_hash: row.text_hash,
    normalized_text_hash: row.normalized_text_hash,
    normalized_text_object_key: row.normalized_text_object_key,
    normalized_text_preview: row.normalized_text_preview,
    source_span_preview: row.source_span_preview,
    read_only: true,
    preview_only: true,
    normalized_text_object_read_performed: false,
  };
}

function toExtractedFactComparison(row) {
  return {
    schema_version: "extracted-fact-comparison.v1",
    extracted_fact_comparison_id: `extracted-fact-comparison.${slugify(row.source_span_id)}`,
    generated_at: row.generated_at,
    source_span_id: row.source_span_id,
    fact_id: row.fact_id,
    evidence_id: row.evidence_id,
    comparison_status: row.extracted_fact_comparison_status,
    evidence_binding_status: row.evidence_binding_status,
    fact_type: row.fact_type,
    fact_statement: row.fact_statement,
    fact_confidence: row.fact_confidence,
    fact_reliability: row.fact_reliability,
    fact_review_status: row.fact_review_status,
    fact_verification_state: row.fact_verification_state,
    human_review_required: true,
    client_facing_ready: false,
    read_only: true,
    preview_only: true,
    fact_mutation_performed: false,
  };
}

function buildPanels({ rows, locationComparisons, normalizedTextComparisons, extractedFactComparisons, generatedAt }) {
  const rowCounts = new Map([
    ["source_locations", locationComparisons.length],
    ["normalized_text", normalizedTextComparisons.length],
    ["extracted_facts", extractedFactComparisons.length],
    ["inspection_status", rows.length],
  ]);
  return PANEL_DEFINITIONS.map(([panelKey, panelLabel, description], index) => ({
    schema_version: "source-span-inspector-panel.v1",
    panel_key: panelKey,
    panel_label: panelLabel,
    panel_order: index + 1,
    panel_status: "ready",
    description,
    row_count: rowCounts.get(panelKey) ?? 0,
    read_only: true,
    preview_only: true,
    source_file_content_read_allowed: false,
    normalized_text_object_read_allowed: false,
    source_ingest_allowed: false,
    fact_mutation_allowed: false,
    output_delivery_allowed: false,
    legal_advice_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "source-span-inspector-boundary.v1",
    boundary_status: "enforced",
    generated_at: generatedAt,
    read_only: true,
    preview_only: true,
    inspector_projection_only: true,
    source_file_content_read_performed: false,
    normalized_text_object_read_performed: false,
    source_ingest_performed: false,
    fact_mutation_performed: false,
    output_delivery_performed: false,
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

function buildChecks({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  reviewDashboardText,
  reviewApiText,
  reviewApiDocText,
  sourceSpanStore,
  normalizedTextContract,
  factClaimStore,
  evidenceViewerUi,
  rows,
  locationComparisons,
  normalizedTextComparisons,
  extractedFactComparisons,
  panels,
  boundary,
}) {
  const scripts = packageJson.scripts ?? {};
  const sourceSpanCount = sourceSpanStore.summary?.source_span_count ?? 0;
  const checks = [];
  const check = (id, passed, message) => checks.push({
    schema_version: "source-span-inspector-check.v1",
    validation_id: `source-span-inspector.${id}`,
    subject_id: "source_span_inspector",
    check_id: id,
    status: passed ? "passed" : "failed",
    message,
  });
  check("surface.package_script", Boolean(scripts["evidence:source-span-inspector"]), "package.json exposes evidence:source-span-inspector.");
  check("docs.ledger_phase", /P291.+source span inspector/i.test(roadmapText), "Final completion ledger includes P291 Source Span Inspector.");
  check("docs.roadmap_phase", /Phase 291 - Source Span Inspector/i.test(implementationRoadmapText), "Implementation roadmap includes Phase 291 Source Span Inspector.");
  check("dashboard.source_registered", reviewDashboardText.includes("source_span_inspector"), "Review Dashboard registers source_span_inspector.");
  check("api.routes_registered", reviewApiText.includes("/api/source-span-inspector-rows"), "Review API registers Source Span Inspector routes.");
  check("api.docs_registered", /Source Span Inspector/i.test(reviewApiDocText), "Review API docs mention Source Span Inspector routes.");
  check("source.source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store source is complete.");
  check("source.normalized_text_complete", normalizedTextContract.summary?.normalized_text_contract_status === "complete", "Normalized Text Contract source is complete.");
  check("source.fact_claim_complete", factClaimStore.summary?.fact_claim_store_status === "complete", "Fact Claim Store source is complete.");
  check("source.evidence_viewer_ui_complete", evidenceViewerUi.summary?.evidence_viewer_ui_status === "complete", "Evidence Viewer UI source is complete.");
  check("source.evidence_viewer_ui_phase_guard", evidenceViewerUi.summary?.phase_slot === "P290" && evidenceViewerUi.summary?.next_phase_slot === "P291", "Evidence Viewer UI remains the P290 guard before P291.");
  check("rows.cover_source_spans", rows.length === sourceSpanCount && rows.length > 0, "Inspector rows cover every source span.");
  check("rows.location_comparisons", locationComparisons.length === rows.length, "Every inspector row has a location comparison.");
  check("rows.normalized_text_comparisons", normalizedTextComparisons.length === rows.length, "Every inspector row has a normalized text comparison.");
  check("rows.extracted_fact_comparisons", extractedFactComparisons.length === rows.length, "Every inspector row has an extracted fact comparison.");
  check("rows.location_matched", rows.every((row) => row.location_comparison_status === "matched"), "Every source span locator matches its location unit.");
  check("rows.normalized_text_matched", rows.every((row) => row.normalized_text_comparison_status === "matched"), "Every source span is bound to normalized text metadata and preview.");
  check("rows.extracted_fact_matched", rows.every((row) => row.extracted_fact_comparison_status === "matched"), "Every source span is bound to an extracted fact claim.");
  check("rows.evidence_viewer_bound", rows.every((row) => row.evidence_viewer_ui_card_id && row.evidence_viewer_ui_source_span_row_id), "Every inspector row is bound to Evidence Viewer UI rows.");
  check("rows.human_review_required", rows.every((row) => row.human_review_required && row.client_facing_ready === false), "All inspector rows require human review and are not client-facing ready.");
  check("panels.ready", panels.length === PANEL_DEFINITIONS.length && panels.every((panel) => panel.panel_status === "ready"), "All required inspector panels are ready.");
  check("boundary.read_only", boundary.read_only && boundary.preview_only && boundary.inspector_projection_only, "Inspector boundary is read-only and preview-only.");
  check("boundary.no_source_reads", boundary.source_file_content_read_performed === false && boundary.normalized_text_object_read_performed === false, "Inspector does not read source files or normalized text objects.");
  check("boundary.no_mutation", boundary.source_ingest_performed === false && boundary.fact_mutation_performed === false && boundary.mutation_allowed === false, "Inspector does not ingest sources or mutate facts.");
  check("boundary.no_output", boundary.output_delivery_performed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false, "Inspector does not deliver output, legal advice, or client-facing content.");
  check("boundary.windows_baseline", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved.");
  return checks;
}

function summarizeSourceSpanInspector({
  sourceSpanStore,
  normalizedTextContract,
  factClaimStore,
  evidenceViewerUi,
  rows,
  locationComparisons,
  normalizedTextComparisons,
  extractedFactComparisons,
  panels,
  boundary,
  checks,
  validation,
}) {
  const rowCount = rows.length;
  const matchedRows = rows.filter((row) => row.comparison_status === "matched").length;
  return {
    source_span_inspector_status: validation.valid ? "complete" : "attention",
    source_span_inspector_id: `source-span-inspector.${dateStamp(rows[0]?.generated_at ?? new Date().toISOString())}`,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    source_source_span_count: sourceSpanStore.summary?.source_span_count ?? 0,
    source_normalized_text_contract_status: normalizedTextContract.summary?.normalized_text_contract_status ?? "unknown",
    source_normalized_text_artifact_count: normalizedTextContract.summary?.normalized_text_artifact_count ?? 0,
    source_fact_claim_store_status: factClaimStore.summary?.fact_claim_store_status ?? "unknown",
    source_fact_claim_count: factClaimStore.summary?.fact_claim_count ?? 0,
    source_evidence_viewer_ui_status: evidenceViewerUi.summary?.evidence_viewer_ui_status ?? "unknown",
    source_evidence_viewer_ui_phase_slot: evidenceViewerUi.summary?.phase_slot ?? null,
    source_evidence_viewer_ui_next_phase_slot: evidenceViewerUi.summary?.next_phase_slot ?? null,
    source_span_inspector_panel_count: panels.length,
    required_panel_count: PANEL_DEFINITIONS.length,
    ready_panel_count: panels.filter((panel) => panel.panel_status === "ready").length,
    inspected_source_span_count: rowCount,
    location_comparison_count: locationComparisons.length,
    normalized_text_comparison_count: normalizedTextComparisons.length,
    extracted_fact_comparison_count: extractedFactComparisons.length,
    location_matched_count: rows.filter((row) => row.location_comparison_status === "matched").length,
    normalized_text_matched_count: rows.filter((row) => row.normalized_text_comparison_status === "matched").length,
    extracted_fact_matched_count: rows.filter((row) => row.extracted_fact_comparison_status === "matched").length,
    fully_matched_row_count: matchedRows,
    attention_row_count: rowCount - matchedRows,
    evidence_viewer_bound_row_count: rows.filter((row) => row.evidence_viewer_ui_card_id && row.evidence_viewer_ui_source_span_row_id).length,
    human_review_required_row_count: rows.filter((row) => row.human_review_required).length,
    client_facing_ready_row_count: rows.filter((row) => row.client_facing_ready).length,
    read_only_row_count: rows.filter((row) => row.read_only).length,
    preview_only_row_count: rows.filter((row) => row.preview_only).length,
    read_only: boundary.read_only,
    preview_only: boundary.preview_only,
    inspector_projection_only: boundary.inspector_projection_only,
    source_file_content_read_performed: boundary.source_file_content_read_performed,
    normalized_text_object_read_performed: boundary.normalized_text_object_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    fact_mutation_performed: boundary.fact_mutation_performed,
    output_delivery_performed: boundary.output_delivery_performed,
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
    failed_checkpoint_count: checks.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceContracts({ sourceSpanStore, normalizedTextContract, factClaimStore, evidenceViewerUi }) {
  return [
    sourceContract("source_span_store", sourceSpanStore, sourceSpanStore.summary?.source_span_store_status),
    sourceContract("normalized_text_contract", normalizedTextContract, normalizedTextContract.summary?.normalized_text_contract_status),
    sourceContract("fact_claim_store", factClaimStore, factClaimStore.summary?.fact_claim_store_status),
    sourceContract("evidence_viewer_ui", evidenceViewerUi, evidenceViewerUi.summary?.evidence_viewer_ui_status),
  ];
}

function sourceContract(sourceId, artifact, sourceStatus) {
  return {
    schema_version: "source-span-inspector-source-contract.v1",
    source_id: sourceId,
    source_schema_version: artifact.schema_version ?? null,
    source_generated_at: artifact.generated_at ?? null,
    source_status: sourceStatus ?? "unknown",
    validation_error_count: artifact.validation?.errors?.length ?? artifact.summary?.validation_error_count ?? 0,
  };
}

function buildInspectorContract(generatedAt) {
  return {
    schema_version: "source-span-inspector-contract.v1",
    source_span_inspector_contract_id: "source-span-inspector.v1",
    generated_at: generatedAt,
    phase_slot: PHASE_SLOT,
    source_inputs: ["source_span_store", "normalized_text_contract", "fact_claim_store", "evidence_viewer_ui"],
    comparison_targets: ["source_location", "normalized_text_preview", "extracted_fact"],
    offset_unit: "utf16_code_unit",
    boundary_rule: "Read-only inspector compares existing locator, normalized text preview, and extracted fact metadata without reading source files or mutating evidence.",
    human_review_rule: "Inspector rows are internal, attorney-reviewable, and not client-facing ready.",
  };
}

function locationMatched(span, locatorRow, locationUnit, locationMap) {
  if (!span?.locator || !locatorRow || !locationUnit || !locationMap) return false;
  return locatorRow.source_span_id === span.source_span_id
    && locationUnit.source_span_id === span.source_span_id
    && locationMap.normalized_text_id === span.normalized_text_id
    && span.locator.offset_unit === "utf16_code_unit"
    && locationUnit.offset_unit === "utf16_code_unit"
    && locatorRow.offset_unit === "utf16_code_unit"
    && span.locator.char_start === locationUnit.char_start
    && span.locator.char_end === locationUnit.char_end
    && span.locator.char_start === locatorRow.char_start
    && span.locator.char_end === locatorRow.char_end
    && span.timestamp_status === "not_applicable";
}

function normalizedTextMatched(span, normalizedText, locationMap) {
  if (!span || !normalizedText || !locationMap) return false;
  return span.normalized_text_id === normalizedText.normalized_text_id
    && span.normalized_text_artifact_id === normalizedText.normalized_text_artifact_id
    && span.resource_id === normalizedText.resource_id
    && span.resource_version_id === normalizedText.resource_version_id
    && span.text_hash === normalizedText.text_hash
    && locationMap.normalized_text_id === normalizedText.normalized_text_id
    && previewMatches(span.content_preview, normalizedText.text_preview);
}

function factMatched(span, fact, evidenceBinding, viewerCard) {
  if (!span || !fact || !evidenceBinding || !viewerCard) return false;
  return fact.source_span_ids?.includes(span.source_span_id)
    && fact.source_span_count > 0
    && fact.primary_evidence_item_id === viewerCard.evidence_id
    && evidenceBinding.fact_id === fact.fact_id
    && evidenceBinding.binding_status === "bound"
    && fact.review_status === "needs_review"
    && fact.reliability === "machine_extracted";
}

function previewMatches(sourcePreview = "", normalizedPreview = "") {
  if (!sourcePreview || !normalizedPreview) return false;
  const source = compactPreview(sourcePreview).slice(0, 120);
  const normalized = compactPreview(normalizedPreview).slice(0, 120);
  return source.length > 0 && normalized.startsWith(source.slice(0, Math.min(source.length, 80)));
}

function compactPreview(value) {
  return String(value).replace(/\s+/g, " ").trim();
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status === "failed").map((item) => ({
    validation_id: item.validation_id,
    check_id: item.check_id,
    message: item.message,
  }));
  return { valid: errors.length === 0, errors };
}

async function writeSourceSpanInspector(result, outDir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "source-span-inspector.json"), result);
  await writeJson(path.join(outDir, "source-span-inspector-panels.json"), {
    schema_version: "source-span-inspector-panels.v1",
    generated_at: result.generated_at,
    source_span_inspector_panel_count: result.source_span_inspector_panels.length,
    source_span_inspector_panels: result.source_span_inspector_panels,
  });
  await writeJson(path.join(outDir, "source-span-inspector-rows.json"), {
    schema_version: "source-span-inspector-rows.v1",
    generated_at: result.generated_at,
    source_span_inspector_row_count: result.source_span_inspector_rows.length,
    source_span_inspector_rows: result.source_span_inspector_rows,
  });
  await writeJson(path.join(outDir, "source-span-location-comparisons.json"), {
    schema_version: "source-span-location-comparisons.v1",
    generated_at: result.generated_at,
    source_span_location_comparison_count: result.source_span_location_comparisons.length,
    source_span_location_comparisons: result.source_span_location_comparisons,
  });
  await writeJson(path.join(outDir, "normalized-text-comparisons.json"), {
    schema_version: "normalized-text-comparisons.v1",
    generated_at: result.generated_at,
    normalized_text_comparison_count: result.normalized_text_comparisons.length,
    normalized_text_comparisons: result.normalized_text_comparisons,
  });
  await writeJson(path.join(outDir, "extracted-fact-comparisons.json"), {
    schema_version: "extracted-fact-comparisons.v1",
    generated_at: result.generated_at,
    extracted_fact_comparison_count: result.extracted_fact_comparisons.length,
    extracted_fact_comparisons: result.extracted_fact_comparisons,
  });
  await writeJson(path.join(outDir, "source-span-inspector-boundary.json"), result.source_span_inspector_boundary);
  await writeJson(path.join(outDir, "source-span-inspector-checks.json"), {
    schema_version: "source-span-inspector-checks.v1",
    generated_at: result.generated_at,
    source_span_inspector_check_count: result.source_span_inspector_checks.length,
    source_span_inspector_checks: result.source_span_inspector_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "source-span-inspector-validation-report.v1",
    generated_at: result.generated_at,
    source_span_inspector_id: result.source_span_inspector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

function buildSummaryMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Source Span Inspector");
  lines.push("");
  lines.push(`Status: ${summary.source_span_inspector_status}`);
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`);
  lines.push("");
  lines.push("## Counts");
  lines.push(`- Source spans inspected: ${summary.inspected_source_span_count}`);
  lines.push(`- Location comparisons: ${summary.location_comparison_count}`);
  lines.push(`- Normalized text comparisons: ${summary.normalized_text_comparison_count}`);
  lines.push(`- Extracted fact comparisons: ${summary.extracted_fact_comparison_count}`);
  lines.push(`- Fully matched rows: ${summary.fully_matched_row_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("- Read-only inspector projection.");
  lines.push("- No source file content or normalized text object reads are performed.");
  lines.push("- No source ingest, fact mutation, output delivery, route execution, server start, legal advice, or client-facing output is performed.");
  lines.push("- Human-review gates and Windows baseline stability are preserved.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const merged = { ...DEFAULT_SOURCE_SPAN_INSPECTOR_INPUTS, ...options };
  return {
    package_path: merged.packagePath,
    roadmap_path: merged.roadmapPath,
    implementation_roadmap_path: merged.implementationRoadmapPath,
    review_dashboard_path: merged.reviewDashboardPath,
    review_api_path: merged.reviewApiPath,
    review_api_doc_path: merged.reviewApiDocPath,
    source_span_store_path: merged.sourceSpanStorePath,
    normalized_text_contract_path: merged.normalizedTextContractPath,
    fact_claim_store_path: merged.factClaimStorePath,
    evidence_viewer_ui_path: merged.evidenceViewerUiPath,
  };
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function mapBy(items, key) {
  const map = new Map();
  for (const item of items ?? []) map.set(item[key], item);
  return map;
}

function mapFactsBySpanId(facts) {
  const map = new Map();
  for (const fact of facts ?? []) {
    for (const spanId of fact.source_span_ids ?? []) map.set(spanId, fact);
  }
  return map;
}

function by(key) {
  return (a, b) => String(a[key] ?? "").localeCompare(String(b[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || "unknown";
}

function dateStamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const args = { check: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--source-span-store") args.sourceSpanStorePath = argv[++index];
    else if (arg === "--normalized-text-contract") args.normalizedTextContractPath = argv[++index];
    else if (arg === "--fact-claim-store") args.factClaimStorePath = argv[++index];
    else if (arg === "--evidence-viewer-ui") args.evidenceViewerUiPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
  }
  return args;
}

export async function runSourceSpanInspectorCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const result = await runSourceSpanInspector(options);
  if (options.check) {
    console.log(`Source Span Inspector validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.source_span_inspector_status}`);
    console.log(`Inspected source spans: ${result.summary.inspected_source_span_count}`);
    console.log(`Location comparisons: ${result.summary.location_comparison_count}`);
    console.log(`Extracted fact comparisons: ${result.summary.extracted_fact_comparison_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } else {
    console.log(`Source Span Inspector written to ${result.output_dir}`);
  }
  return result;
}
