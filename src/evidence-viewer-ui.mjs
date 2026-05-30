import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_VIEWER_UI_OUT_DIR = "artifacts/evidence-viewer-ui/latest";
export const DEFAULT_EVIDENCE_VIEWER_UI_INPUTS = {
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  approvalQueueUiPath: "artifacts/approval-queue-ui/latest/approval-queue-ui.json",
  dashboardInformationArchitecturePath: "artifacts/review-dashboard-ia/latest/review-dashboard-ia.json",
  evidenceViewerDataApiPath: "artifacts/evidence-viewer-data-api/latest/evidence-viewer-data-api.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  evidenceCoverageScorePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  evidenceFlagsPath: "artifacts/evidence-flags/latest/evidence-flags.json",
};

const SCHEMA_VERSION = "evidence-viewer-ui.v1";
const CAPABILITY_ID = "dashboard.evidence_viewer_ui";
const PHASE_SLOT = "P290";
const PREVIOUS_PHASE_SLOT = "P289";
const NEXT_PHASE_SLOT = "P291";
const PANEL_DEFINITIONS = [
  ["evidence_cards", "Evidence Cards", "Read-only evidence cards joined to source span, citation, coverage, and review flag context."],
  ["source_spans", "Source Spans", "Source span preview panels with locator and evidence binding status."],
  ["citations", "Citations", "Citation review rows linked to output paragraphs and source spans."],
  ["coverage", "Coverage", "Coverage score rows and missing required dimensions for review."],
  ["review_flags", "Review Flags", "Privilege, redaction, transfer, extraction, and human confirmation flags."],
];

export async function runEvidenceViewerUi(options = {}) {
  const result = await buildEvidenceViewerUi(options);
  if (options.write !== false) await writeEvidenceViewerUi(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence Viewer UI validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceViewerUi(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_VIEWER_UI_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    approvalQueueUi,
    dashboardInformationArchitecture,
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverageScore,
    evidenceFlags,
  ] = await Promise.all([
    readJson(inputs.package_path),
    readText(inputs.roadmap_path),
    readText(inputs.implementation_roadmap_path),
    readText(inputs.review_dashboard_path),
    readText(inputs.review_api_path),
    readText(inputs.review_api_doc_path),
    readJson(inputs.approval_queue_ui_path),
    readJson(inputs.dashboard_information_architecture_path),
    readJson(inputs.evidence_viewer_data_api_path),
    readJson(inputs.citation_object_store_path),
    readJson(inputs.evidence_coverage_score_path),
    readJson(inputs.evidence_flags_path),
  ]);

  const context = buildJoinContext({
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverageScore,
    evidenceFlags,
  });
  const evidenceViewerUiCards = buildEvidenceViewerUiCards({ context, generatedAt });
  const sourceSpanRows = buildSourceSpanRows({ context, evidenceViewerUiCards, generatedAt });
  const citationRows = buildCitationRows({ context, evidenceViewerUiCards, generatedAt });
  const coverageRows = buildCoverageRows({ context, evidenceViewerUiCards, generatedAt });
  const flagRows = buildFlagRows({ context, evidenceViewerUiCards, generatedAt });
  const panels = buildPanels({
    evidenceViewerUiCards,
    sourceSpanRows,
    citationRows,
    coverageRows,
    flagRows,
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
    approvalQueueUi,
    dashboardInformationArchitecture,
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverageScore,
    evidenceFlags,
    evidenceViewerUiCards,
    sourceSpanRows,
    citationRows,
    coverageRows,
    flagRows,
    panels,
    boundary,
  });
  const validation = summarizeValidation(checks);
  const summary = summarizeEvidenceViewerUi({
    approvalQueueUi,
    dashboardInformationArchitecture,
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverageScore,
    evidenceFlags,
    evidenceViewerUiCards,
    sourceSpanRows,
    citationRows,
    coverageRows,
    flagRows,
    panels,
    boundary,
    checks,
    validation,
  });

  return {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    evidence_viewer_ui_id: `evidence-viewer-ui.${dateStamp(generatedAt)}`,
    evidence_viewer_ui_status: validation.valid ? "complete" : "attention",
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      approvalQueueUi,
      dashboardInformationArchitecture,
      evidenceViewerDataApi,
      citationObjectStore,
      evidenceCoverageScore,
      evidenceFlags,
    }),
    evidence_viewer_ui_contract: {
      schema_version: "evidence-viewer-ui-contract.v1",
      contract_id: SCHEMA_VERSION,
      phase_slot: PHASE_SLOT,
      previous_phase_slot: PREVIOUS_PHASE_SLOT,
      next_phase_slot: NEXT_PHASE_SLOT,
      required_panels: PANEL_DEFINITIONS.map(([panelKey]) => panelKey),
      source_contracts: [
        "approval_queue_ui",
        "dashboard_information_architecture",
        "evidence_viewer_data_api",
        "citation_object_store",
        "evidence_coverage_score",
        "evidence_flags",
      ],
      read_only: true,
      ui_projection_only: true,
      source_span_preview_only: true,
      citation_preview_only: true,
      coverage_preview_only: true,
      source_file_content_read_allowed: false,
      source_ingest_allowed: false,
      evidence_mutation_allowed: false,
      citation_approval_allowed: false,
      output_delivery_allowed: false,
      legal_advice_generated: false,
      client_facing_output_allowed: false,
    },
    evidence_viewer_ui_panels: panels,
    evidence_viewer_ui_cards: evidenceViewerUiCards,
    evidence_viewer_ui_source_spans: sourceSpanRows,
    evidence_viewer_ui_citations: citationRows,
    evidence_viewer_ui_coverage: coverageRows,
    evidence_viewer_ui_flags: flagRows,
    evidence_viewer_ui_boundary: boundary,
    evidence_viewer_ui_checks: checks,
    validation_items: checks,
    validation,
    summary,
    summary_markdown: renderSummary({ summary, panels }),
  };
}

export async function writeEvidenceViewerUi(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "evidence-viewer-ui.json"), result);
  await writeJson(path.join(outDir, "evidence-viewer-ui-panels.json"), {
    schema_version: "evidence-viewer-ui-panels.v1",
    generated_at: result.generated_at,
    evidence_viewer_ui_panel_count: result.evidence_viewer_ui_panels.length,
    evidence_viewer_ui_panels: result.evidence_viewer_ui_panels,
  });
  await writeJson(path.join(outDir, "evidence-viewer-ui-cards.json"), {
    schema_version: "evidence-viewer-ui-cards.v1",
    generated_at: result.generated_at,
    evidence_viewer_ui_card_count: result.evidence_viewer_ui_cards.length,
    evidence_viewer_ui_cards: result.evidence_viewer_ui_cards,
  });
  await writeJson(path.join(outDir, "evidence-viewer-ui-source-spans.json"), {
    schema_version: "evidence-viewer-ui-source-spans.v1",
    generated_at: result.generated_at,
    source_span_row_count: result.evidence_viewer_ui_source_spans.length,
    evidence_viewer_ui_source_spans: result.evidence_viewer_ui_source_spans,
  });
  await writeJson(path.join(outDir, "evidence-viewer-ui-citations.json"), {
    schema_version: "evidence-viewer-ui-citations.v1",
    generated_at: result.generated_at,
    citation_row_count: result.evidence_viewer_ui_citations.length,
    evidence_viewer_ui_citations: result.evidence_viewer_ui_citations,
  });
  await writeJson(path.join(outDir, "evidence-viewer-ui-coverage.json"), {
    schema_version: "evidence-viewer-ui-coverage.v1",
    generated_at: result.generated_at,
    coverage_row_count: result.evidence_viewer_ui_coverage.length,
    evidence_viewer_ui_coverage: result.evidence_viewer_ui_coverage,
  });
  await writeJson(path.join(outDir, "evidence-viewer-ui-flags.json"), {
    schema_version: "evidence-viewer-ui-flags.v1",
    generated_at: result.generated_at,
    flag_row_count: result.evidence_viewer_ui_flags.length,
    evidence_viewer_ui_flags: result.evidence_viewer_ui_flags,
  });
  await writeJson(path.join(outDir, "evidence-viewer-ui-boundary.json"), result.evidence_viewer_ui_boundary);
  await writeJson(path.join(outDir, "evidence-viewer-ui-checks.json"), {
    schema_version: "evidence-viewer-ui-checks.v1",
    generated_at: result.generated_at,
    evidence_viewer_ui_check_count: result.evidence_viewer_ui_checks.length,
    evidence_viewer_ui_checks: result.evidence_viewer_ui_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "evidence-viewer-ui-validation-report.v1",
    generated_at: result.generated_at,
    evidence_viewer_ui_id: result.evidence_viewer_ui_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runEvidenceViewerUiCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runEvidenceViewerUi(args);
    console.log(`Evidence Viewer UI ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_viewer_ui_status}`);
    console.log(`Panels: ${result.summary.evidence_viewer_ui_panel_count}`);
    console.log(`Cards: ${result.summary.evidence_viewer_ui_card_count}`);
    console.log(`Citations: ${result.summary.citation_row_count}`);
    console.log(`Coverage rows: ${result.summary.coverage_row_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildJoinContext({
  evidenceViewerDataApi,
  citationObjectStore,
  evidenceCoverageScore,
  evidenceFlags,
}) {
  const viewerCatalog = evidenceViewerDataApi.evidence_viewer_data_catalog ?? {};
  const citationCatalog = citationObjectStore.citation_catalog ?? {};
  const coverageCatalog = evidenceCoverageScore.evidence_coverage_catalog ?? {};
  const flagCatalog = evidenceFlags.evidence_flag_catalog ?? {};
  const viewerCards = viewerCatalog.viewer_cards ?? [];
  const sourceSpanPanels = viewerCatalog.source_span_panels ?? [];
  const lineagePathPanels = viewerCatalog.lineage_path_panels ?? [];
  const citations = citationCatalog.citations ?? [];
  const outputParagraphs = citationCatalog.output_paragraphs ?? [];
  const citationReviewQueueItems = citationCatalog.review_queue_items ?? [];
  const coverageScores = coverageCatalog.coverage_scores ?? [];
  const coverageDimensions = coverageCatalog.coverage_dimensions ?? [];
  const flagRecords = flagCatalog.evidence_flag_records ?? [];
  const flagDecisions = flagCatalog.flag_decisions ?? [];

  return {
    viewerCards,
    sourceSpanPanels,
    lineagePathPanels,
    citations,
    outputParagraphs,
    citationReviewQueueItems,
    coverageScores,
    coverageDimensions,
    flagRecords,
    flagDecisions,
    sourceSpanById: new Map(sourceSpanPanels.map((panel) => [panel.source_span_id, panel])),
    lineagePathsByEvidenceId: groupBy(lineagePathPanels, "evidence_id"),
    citationsByEvidenceId: firstBy(citations, "evidence_item_id"),
    citationsByCitationId: firstBy(citations, "citation_id"),
    citationsBySourceSpanId: firstBy(citations, "source_span_id"),
    outputParagraphById: firstBy(outputParagraphs, "output_paragraph_id"),
    reviewQueueByCitationId: firstBy(citationReviewQueueItems, "citation_id"),
    coverageByEvidenceId: firstBy(coverageScores, "evidence_item_id"),
    coverageByCitationId: firstBy(coverageScores, "citation_id"),
    coverageBySourceSpanId: firstBy(coverageScores, "source_span_id"),
    coverageDimensionsByScoreId: groupBy(coverageDimensions, "coverage_score_id"),
    flagByEvidenceId: firstBy(flagRecords, "evidence_item_id"),
    flagByCoverageId: firstBy(flagRecords, "coverage_score_id"),
    flagByCitationId: firstBy(flagRecords, "citation_id"),
    flagDecisionsByRecordId: groupBy(flagDecisions, "evidence_flag_record_id"),
  };
}

function buildEvidenceViewerUiCards({ context, generatedAt }) {
  return context.viewerCards.map((card) => {
    const sourceSpanId = card.primary_source_span_id ?? card.source_span_ids?.[0] ?? null;
    const sourceSpanPanel = sourceSpanId ? context.sourceSpanById.get(sourceSpanId) : null;
    const citation = context.citationsByEvidenceId.get(card.evidence_id)
      ?? (sourceSpanId ? context.citationsBySourceSpanId.get(sourceSpanId) : null)
      ?? null;
    const coverage = context.coverageByEvidenceId.get(card.evidence_id)
      ?? (citation ? context.coverageByCitationId.get(citation.citation_id) : null)
      ?? (sourceSpanId ? context.coverageBySourceSpanId.get(sourceSpanId) : null)
      ?? null;
    const flagRecord = context.flagByEvidenceId.get(card.evidence_id)
      ?? (coverage ? context.flagByCoverageId.get(coverage.coverage_score_id) : null)
      ?? (citation ? context.flagByCitationId.get(citation.citation_id) : null)
      ?? null;
    const outputParagraph = citation ? context.outputParagraphById.get(citation.output_paragraph_id) : null;
    const reviewQueue = citation ? context.reviewQueueByCitationId.get(citation.citation_id) : null;
    const coverageDimensions = coverage ? context.coverageDimensionsByScoreId.get(coverage.coverage_score_id) ?? [] : [];
    const flagDecisions = flagRecord ? context.flagDecisionsByRecordId.get(flagRecord.evidence_flag_record_id) ?? [] : [];
    const missingRequiredDimensions = coverageDimensions
      .filter((dimension) => dimension.required && !dimension.covered)
      .map((dimension) => dimension.dimension)
      .sort();
    const cardStatus = sourceSpanPanel && citation && coverage && flagRecord ? "ready" : "attention";

    return {
      schema_version: "evidence-viewer-ui-card.v1",
      evidence_viewer_ui_card_id: `evidence-viewer-ui-card.${slugify(card.evidence_id)}`,
      generated_at: generatedAt,
      card_status: cardStatus,
      viewer_card_id: card.viewer_card_id,
      evidence_id: card.evidence_id,
      evidence_type: card.evidence_type ?? null,
      tenant_id: card.tenant_id ?? null,
      matter_id: card.matter_id ?? null,
      classification: card.classification ?? null,
      policy_snapshot_id: card.policy_snapshot_id ?? null,
      review_status: card.review_status ?? null,
      reliability: card.reliability ?? null,
      verification_state: card.verification_state ?? null,
      privilege_flag: Boolean(card.privilege_flag),
      redaction_state: card.redaction_state ?? null,
      source_span_id: sourceSpanId,
      source_span_panel_id: sourceSpanPanel?.source_span_panel_id ?? null,
      source_span_binding_status: sourceSpanPanel ? "bound" : "missing",
      source_span_location_type: sourceSpanPanel?.location_type ?? card.source_locator?.location_type ?? null,
      source_locator: card.source_locator ?? sourceSpanPanel?.locator ?? {},
      source_preview: normalizePreview(card.source_preview ?? sourceSpanPanel?.content_preview ?? ""),
      lineage_path_ids: card.lineage_path_ids ?? [],
      lineage_path_count: card.lineage_path_count ?? 0,
      citation_id: citation?.citation_id ?? null,
      citation_status: citation?.citation_status ?? "missing",
      citation_binding_status: citation?.source_binding_status ?? "missing",
      output_paragraph_id: citation?.output_paragraph_id ?? null,
      output_paragraph_preview: normalizePreview(outputParagraph?.paragraph_text ?? ""),
      citation_review_queue_item_id: reviewQueue?.review_queue_item_id ?? null,
      approval_required_before_output: Boolean(reviewQueue?.approval_required_before_output ?? citation?.human_review_required ?? true),
      coverage_score_id: coverage?.coverage_score_id ?? null,
      coverage_status: coverage?.coverage_status ?? "missing",
      coverage_score: coverage?.coverage_score ?? null,
      required_dimension_count: coverage?.required_dimension_count ?? 0,
      covered_required_dimension_count: coverage?.covered_required_dimension_count ?? 0,
      missing_required_dimension_count: coverage?.missing_required_dimension_count ?? missingRequiredDimensions.length,
      missing_required_dimensions: missingRequiredDimensions,
      coverage_dimension_count: coverageDimensions.length,
      coverage_dimensions: coverageDimensions.map((dimension) => ({
        coverage_dimension_id: dimension.coverage_dimension_id,
        dimension: dimension.dimension,
        required: Boolean(dimension.required),
        covered: Boolean(dimension.covered),
        coverage_status: dimension.coverage_status,
      })),
      evidence_flag_record_id: flagRecord?.evidence_flag_record_id ?? null,
      extraction_flag: flagRecord?.extraction_flag ?? "missing",
      human_confirmation_flag: flagRecord?.human_confirmation_flag ?? "missing",
      privilege_review_flag: flagRecord?.privilege_flag ?? "missing",
      redaction_flag: flagRecord?.redaction_flag ?? "missing",
      external_transfer_flag: flagRecord?.external_transfer_flag ?? "missing",
      flag_decision_count: flagDecisions.length,
      human_review_required: Boolean(card.viewer_actions?.human_review_required ?? citation?.human_review_required ?? reviewQueue?.review_required ?? true),
      client_facing_ready: Boolean(citation?.client_facing_ready ?? outputParagraph?.client_facing_ready ?? false),
      read_only: true,
      preview_only: true,
      legal_advice_generated: false,
      client_facing_output_generated: false,
      ui_actions: buildUiActions(),
    };
  }).sort(by("evidence_viewer_ui_card_id"));
}

function buildSourceSpanRows({ context, evidenceViewerUiCards, generatedAt }) {
  const cardsBySourceSpanId = groupBy(evidenceViewerUiCards, "source_span_id");
  return context.sourceSpanPanels.map((panel) => {
    const cards = cardsBySourceSpanId.get(panel.source_span_id) ?? [];
    return {
      schema_version: "evidence-viewer-ui-source-span-row.v1",
      source_span_row_id: `evidence-viewer-ui-source-span.${slugify(panel.source_span_id)}`,
      generated_at: generatedAt,
      source_span_id: panel.source_span_id,
      source_span_panel_id: panel.source_span_panel_id,
      tenant_id: panel.tenant_id ?? null,
      matter_id: panel.matter_id ?? null,
      classification: panel.classification ?? null,
      policy_snapshot_id: panel.policy_snapshot_id ?? null,
      resource_id: panel.resource_id,
      resource_version_id: panel.resource_version_id,
      normalized_text_id: panel.normalized_text_id,
      location_type: panel.location_type,
      span_status: panel.span_status,
      review_status: panel.review_status,
      binding_status: panel.binding_status,
      locator: panel.locator ?? {},
      content_preview: normalizePreview(panel.content_preview ?? ""),
      evidence_ids: panel.evidence_ids ?? [],
      evidence_binding_count: panel.evidence_binding_count ?? 0,
      linked_card_count: cards.length,
      citation_count: cards.filter((card) => card.citation_binding_status === "bound").length,
      coverage_count: cards.filter((card) => card.coverage_status !== "missing").length,
      read_only: true,
      preview_only: true,
      source_file_content_read_performed: false,
    };
  }).sort(by("source_span_row_id"));
}

function buildCitationRows({ context, evidenceViewerUiCards, generatedAt }) {
  const cardByCitationId = firstBy(evidenceViewerUiCards.filter((card) => card.citation_id), "citation_id");
  return context.citations.map((citation) => {
    const card = cardByCitationId.get(citation.citation_id);
    const outputParagraph = context.outputParagraphById.get(citation.output_paragraph_id);
    return {
      schema_version: "evidence-viewer-ui-citation-row.v1",
      citation_row_id: `evidence-viewer-ui-citation.${slugify(citation.citation_id)}`,
      generated_at: generatedAt,
      citation_id: citation.citation_id,
      output_paragraph_id: citation.output_paragraph_id,
      issue_id: citation.issue_id,
      fact_id: citation.fact_id,
      evidence_id: citation.evidence_item_id,
      source_span_id: citation.source_span_id,
      lineage_id: citation.lineage_id ?? null,
      tenant_id: citation.tenant_id ?? null,
      matter_id: citation.matter_id ?? null,
      classification: citation.classification ?? null,
      policy_snapshot_id: citation.policy_snapshot_id ?? null,
      citation_style: citation.citation_style,
      citation_status: citation.citation_status,
      verification_status: citation.verification_status,
      citation_binding_status: citation.source_binding_status,
      source_binding_status: citation.source_binding_status,
      human_review_required: Boolean(citation.human_review_required),
      client_facing_ready: Boolean(citation.client_facing_ready),
      linked_card_id: card?.evidence_viewer_ui_card_id ?? null,
      card_binding_status: card ? "bound" : "missing",
      output_paragraph_preview: normalizePreview(outputParagraph?.paragraph_text ?? ""),
      read_only: true,
      preview_only: true,
      citation_approval_performed: false,
      output_delivery_performed: false,
    };
  }).sort(by("citation_row_id"));
}

function buildCoverageRows({ context, evidenceViewerUiCards, generatedAt }) {
  const cardByCoverageId = firstBy(evidenceViewerUiCards.filter((card) => card.coverage_score_id), "coverage_score_id");
  return context.coverageScores.map((score) => {
    const card = cardByCoverageId.get(score.coverage_score_id);
    const dimensions = context.coverageDimensionsByScoreId.get(score.coverage_score_id) ?? [];
    const missingRequiredDimensions = dimensions
      .filter((dimension) => dimension.required && !dimension.covered)
      .map((dimension) => dimension.dimension)
      .sort();
    return {
      schema_version: "evidence-viewer-ui-coverage-row.v1",
      coverage_row_id: `evidence-viewer-ui-coverage.${slugify(score.coverage_score_id)}`,
      generated_at: generatedAt,
      coverage_score_id: score.coverage_score_id,
      lineage_path_id: score.lineage_path_id,
      coverage_subject_type: score.coverage_subject_type,
      coverage_subject_id: score.coverage_subject_id,
      output_paragraph_id: score.output_paragraph_id,
      citation_id: score.citation_id,
      issue_id: score.issue_id,
      fact_id: score.fact_id,
      evidence_id: score.evidence_item_id,
      source_span_id: score.source_span_id,
      tenant_id: score.tenant_id ?? null,
      matter_id: score.matter_id ?? null,
      classification: score.classification ?? null,
      policy_snapshot_id: score.policy_snapshot_id ?? null,
      coverage_status: score.coverage_status,
      coverage_score: score.coverage_score,
      required_dimension_count: score.required_dimension_count ?? 0,
      covered_required_dimension_count: score.covered_required_dimension_count ?? 0,
      missing_required_dimension_count: score.missing_required_dimension_count ?? missingRequiredDimensions.length,
      coverage_dimension_count: dimensions.length,
      missing_required_dimensions: missingRequiredDimensions,
      linked_card_id: card?.evidence_viewer_ui_card_id ?? null,
      card_binding_status: card ? "bound" : "missing",
      review_status: score.review_status ?? "needs_review",
      human_review_required: Boolean(score.human_review_required ?? true),
      client_facing_ready: Boolean(score.client_facing_ready ?? false),
      read_only: true,
      preview_only: true,
    };
  }).sort(by("coverage_row_id"));
}

function buildFlagRows({ context, evidenceViewerUiCards, generatedAt }) {
  const cardByFlagId = firstBy(evidenceViewerUiCards.filter((card) => card.evidence_flag_record_id), "evidence_flag_record_id");
  return context.flagRecords.map((record) => {
    const card = cardByFlagId.get(record.evidence_flag_record_id);
    const decisions = context.flagDecisionsByRecordId.get(record.evidence_flag_record_id) ?? [];
    return {
      schema_version: "evidence-viewer-ui-flag-row.v1",
      flag_row_id: `evidence-viewer-ui-flag.${slugify(record.evidence_flag_record_id)}`,
      generated_at: generatedAt,
      evidence_flag_record_id: record.evidence_flag_record_id,
      coverage_score_id: record.coverage_score_id,
      citation_id: record.citation_id,
      evidence_id: record.evidence_item_id,
      source_span_id: record.source_span_id,
      tenant_id: record.tenant_id ?? null,
      matter_id: record.matter_id ?? null,
      classification: record.classification ?? null,
      policy_snapshot_id: record.policy_snapshot_id ?? null,
      extraction_flag: record.extraction_flag,
      human_confirmation_flag: record.human_confirmation_flag,
      privilege_review_flag: record.privilege_flag,
      redaction_flag: record.redaction_flag,
      external_transfer_flag: record.external_transfer_flag,
      flag_decision_count: decisions.length,
      human_review_required_decision_count: decisions.filter((decision) => decision.human_review_required).length,
      linked_card_id: card?.evidence_viewer_ui_card_id ?? null,
      card_binding_status: card ? "bound" : "missing",
      review_status: record.review_status ?? "needs_review",
      human_review_required: true,
      client_facing_ready: false,
      read_only: true,
      preview_only: true,
    };
  }).sort(by("flag_row_id"));
}

function buildPanels({
  evidenceViewerUiCards,
  sourceSpanRows,
  citationRows,
  coverageRows,
  flagRows,
  generatedAt,
}) {
  const panelCounts = {
    evidence_cards: evidenceViewerUiCards.length,
    source_spans: sourceSpanRows.length,
    citations: citationRows.length,
    coverage: coverageRows.length,
    review_flags: flagRows.length,
  };
  return PANEL_DEFINITIONS.map(([panelKey, panelLabel, description], index) => ({
    schema_version: "evidence-viewer-ui-panel.v1",
    panel_key: panelKey,
    panel_label: panelLabel,
    panel_order: index + 1,
    panel_status: panelCounts[panelKey] > 0 ? "ready" : "empty",
    description,
    row_count: panelCounts[panelKey],
    read_only: true,
    preview_only: true,
    source_file_content_read_allowed: false,
    source_ingest_allowed: false,
    evidence_mutation_allowed: false,
    citation_approval_allowed: false,
    output_delivery_allowed: false,
    legal_advice_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "evidence-viewer-ui-boundary.v1",
    boundary_id: "evidence-viewer-ui.boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    ui_projection_only: true,
    source_span_preview_only: true,
    citation_preview_only: true,
    coverage_preview_only: true,
    source_file_content_read_allowed: false,
    source_file_content_read_performed: false,
    source_ingest_allowed: false,
    source_ingest_performed: false,
    evidence_mutation_allowed: false,
    evidence_mutation_performed: false,
    citation_approval_allowed: false,
    citation_approval_performed: false,
    output_delivery_allowed: false,
    output_delivery_performed: false,
    route_execution_allowed: false,
    route_execution_performed: false,
    server_start_allowed: false,
    server_started: false,
    mutation_allowed: false,
    protected_action_execution_allowed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
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
  approvalQueueUi,
  dashboardInformationArchitecture,
  evidenceViewerDataApi,
  citationObjectStore,
  evidenceCoverageScore,
  evidenceFlags,
  evidenceViewerUiCards,
  sourceSpanRows,
  citationRows,
  coverageRows,
  flagRows,
  panels,
  boundary,
}) {
  const viewerSummary = evidenceViewerDataApi.summary ?? {};
  const citationSummary = citationObjectStore.summary ?? {};
  const coverageSummary = evidenceCoverageScore.summary ?? {};
  const flagsSummary = evidenceFlags.summary ?? {};
  const approvalQueueUiSummary = approvalQueueUi.summary ?? {};
  const dashboardIaSummary = dashboardInformationArchitecture.summary ?? {};
  const cardCount = evidenceViewerUiCards.length;
  const checks = [
    check("surface.package_script", hasScript(packageJson, "evidence:viewer-ui"), "package.json exposes evidence:viewer-ui."),
    check("surface.ledger", includesAll(roadmapText, ["| P290 |", "Evidence Viewer UI"]), "Final completion ledger promotes Phase 290."),
    check("surface.implementation_roadmap", includesAll(implementationRoadmapText, ["Phase 290", "Evidence Viewer UI"]), "Implementation roadmap documents Phase 290."),
    check("surface.dashboard", includesAll(reviewDashboardText, ["evidence_viewer_ui", "buildEvidenceViewerUiStage"]), "Review Dashboard registers Evidence Viewer UI."),
    check("surface.review_api", includesAll(reviewApiText, ["/api/evidence-viewer-ui-artifacts", "/api/evidence-viewer-ui-cards", "/api/evidence-viewer-ui-coverage"]), "Review API exposes Evidence Viewer UI routes."),
    check("surface.review_api_doc", includesAll(reviewApiDocText, ["P290 Evidence Viewer UI Routes", "/api/evidence-viewer-ui-cards"]), "Review API docs list Evidence Viewer UI routes."),
    check("source.approval_queue_ui", approvalQueueUiSummary.approval_queue_ui_status === "complete" && approvalQueueUiSummary.phase_slot === "P289" && approvalQueueUiSummary.next_phase_slot === "P290", "P289 Approval Queue UI is complete before P290."),
    check("source.dashboard_information_architecture", dashboardIaSummary.review_dashboard_ia_status === "complete" && dashboardIaSummary.phase_slot === "P288", "P288 dashboard IA remains complete."),
    check("source.evidence_viewer_data_api", viewerSummary.evidence_viewer_data_status === "complete", "Evidence Viewer Data API source is complete."),
    check("source.citation_object_store", citationSummary.citation_object_store_status === "complete", "Citation Object Store source is complete."),
    check("source.evidence_coverage_score", coverageSummary.evidence_coverage_status === "complete", "Evidence Coverage Score source is complete."),
    check("source.evidence_flags", flagsSummary.evidence_flags_status === "complete", "Evidence Flags source is complete."),
    check("panels.required", panels.length === PANEL_DEFINITIONS.length && panels.every((panel) => panel.panel_status === "ready"), "All required Evidence Viewer UI panels are ready."),
    check("cards.source_count", cardCount > 0 && cardCount === (viewerSummary.viewer_card_count ?? 0), "Every viewer data card is represented."),
    check("cards.source_span_bound", evidenceViewerUiCards.every((card) => card.source_span_binding_status === "bound"), "Every UI card is bound to a source span panel."),
    check("cards.citation_bound", evidenceViewerUiCards.every((card) => card.citation_binding_status === "bound"), "Every UI card is bound to a citation."),
    check("cards.coverage_bound", evidenceViewerUiCards.every((card) => card.coverage_status !== "missing"), "Every UI card is bound to a coverage score."),
    check("cards.flag_bound", evidenceViewerUiCards.every((card) => card.evidence_flag_record_id), "Every UI card is bound to review flags."),
    check("cards.review_gate", evidenceViewerUiCards.every((card) => card.human_review_required && card.client_facing_ready === false), "Every UI card remains human-review gated and not client-facing ready."),
    check("rows.source_spans", sourceSpanRows.length === (viewerSummary.source_span_panel_count ?? 0) && sourceSpanRows.every((row) => row.binding_status === "bound"), "Source span UI rows cover all source span panels."),
    check("rows.citations", citationRows.length === (citationSummary.citation_count ?? 0) && citationRows.every((row) => row.citation_binding_status === "bound"), "Citation UI rows cover all citations and preserve source binding."),
    check("rows.coverage", coverageRows.length === (coverageSummary.coverage_score_count ?? 0) && coverageRows.every((row) => row.coverage_status !== "missing"), "Coverage UI rows cover all coverage scores."),
    check("rows.flags", flagRows.length === (flagsSummary.evidence_flag_record_count ?? 0) && flagRows.every((row) => row.human_review_required), "Flag UI rows cover all evidence flag records."),
    check("boundary.read_only", boundary.read_only && boundary.ui_projection_only && boundary.source_file_content_read_performed === false && boundary.source_ingest_performed === false && boundary.evidence_mutation_performed === false && boundary.citation_approval_performed === false && boundary.output_delivery_performed === false, "Evidence Viewer UI is read-only and performs no source ingest, mutation, approval, or output delivery."),
    check("boundary.no_execution", boundary.route_execution_performed === false && boundary.server_started === false && boundary.protected_action_executed === false && boundary.mutation_allowed === false, "Evidence Viewer UI does not execute routes, start a server, mutate, or execute protected actions."),
    check("boundary.no_legal_output", boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false, "Evidence Viewer UI generates no legal advice or client-facing output."),
    check("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
  return checks;
}

function summarizeEvidenceViewerUi({
  approvalQueueUi,
  dashboardInformationArchitecture,
  evidenceViewerDataApi,
  citationObjectStore,
  evidenceCoverageScore,
  evidenceFlags,
  evidenceViewerUiCards,
  sourceSpanRows,
  citationRows,
  coverageRows,
  flagRows,
  panels,
  boundary,
  checks,
  validation,
}) {
  const approvalSummary = approvalQueueUi.summary ?? {};
  const dashboardIaSummary = dashboardInformationArchitecture.summary ?? {};
  const viewerSummary = evidenceViewerDataApi.summary ?? {};
  const citationSummary = citationObjectStore.summary ?? {};
  const coverageSummary = evidenceCoverageScore.summary ?? {};
  const flagsSummary = evidenceFlags.summary ?? {};
  return {
    evidence_viewer_ui_status: validation.valid ? "complete" : "attention",
    evidence_viewer_ui_id: `evidence-viewer-ui.${dateStamp(evidenceViewerUiCards[0]?.generated_at ?? new Date().toISOString())}`,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_approval_queue_ui_status: approvalSummary.approval_queue_ui_status ?? "unknown",
    source_approval_queue_ui_phase_slot: approvalSummary.phase_slot ?? null,
    source_approval_queue_ui_next_phase_slot: approvalSummary.next_phase_slot ?? null,
    source_dashboard_information_architecture_status: dashboardIaSummary.review_dashboard_ia_status ?? "unknown",
    source_dashboard_information_architecture_phase_slot: dashboardIaSummary.phase_slot ?? null,
    source_evidence_viewer_data_status: viewerSummary.evidence_viewer_data_status ?? "unknown",
    source_evidence_viewer_data_card_count: viewerSummary.viewer_card_count ?? 0,
    source_citation_object_store_status: citationSummary.citation_object_store_status ?? "unknown",
    source_citation_count: citationSummary.citation_count ?? 0,
    source_evidence_coverage_status: coverageSummary.evidence_coverage_status ?? "unknown",
    source_coverage_score_count: coverageSummary.coverage_score_count ?? 0,
    source_evidence_flags_status: flagsSummary.evidence_flags_status ?? "unknown",
    source_flag_record_count: flagsSummary.evidence_flag_record_count ?? 0,
    evidence_viewer_ui_panel_count: panels.length,
    required_panel_count: PANEL_DEFINITIONS.length,
    ready_panel_count: panels.filter((panel) => panel.panel_status === "ready").length,
    evidence_viewer_ui_card_count: evidenceViewerUiCards.length,
    source_span_row_count: sourceSpanRows.length,
    citation_row_count: citationRows.length,
    coverage_row_count: coverageRows.length,
    flag_row_count: flagRows.length,
    card_source_span_bound_count: evidenceViewerUiCards.filter((card) => card.source_span_binding_status === "bound").length,
    card_citation_bound_count: evidenceViewerUiCards.filter((card) => card.citation_binding_status === "bound").length,
    card_coverage_bound_count: evidenceViewerUiCards.filter((card) => card.coverage_status !== "missing").length,
    card_flag_bound_count: evidenceViewerUiCards.filter((card) => card.evidence_flag_record_id).length,
    full_coverage_card_count: evidenceViewerUiCards.filter((card) => card.coverage_status === "complete").length,
    partial_coverage_card_count: evidenceViewerUiCards.filter((card) => card.coverage_status === "partial").length,
    missing_required_dimension_card_count: evidenceViewerUiCards.filter((card) => (card.missing_required_dimension_count ?? 0) > 0).length,
    human_review_required_card_count: evidenceViewerUiCards.filter((card) => card.human_review_required).length,
    client_facing_ready_card_count: evidenceViewerUiCards.filter((card) => card.client_facing_ready).length,
    read_only_card_count: evidenceViewerUiCards.filter((card) => card.read_only).length,
    preview_only_card_count: evidenceViewerUiCards.filter((card) => card.preview_only).length,
    read_only: boundary.read_only,
    ui_projection_only: boundary.ui_projection_only,
    source_span_preview_only: boundary.source_span_preview_only,
    citation_preview_only: boundary.citation_preview_only,
    coverage_preview_only: boundary.coverage_preview_only,
    source_file_content_read_performed: boundary.source_file_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    evidence_mutation_performed: boundary.evidence_mutation_performed,
    citation_approval_performed: boundary.citation_approval_performed,
    output_delivery_performed: boundary.output_delivery_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    mutation_allowed: boundary.mutation_allowed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: checks.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceContracts({
  approvalQueueUi,
  dashboardInformationArchitecture,
  evidenceViewerDataApi,
  citationObjectStore,
  evidenceCoverageScore,
  evidenceFlags,
}) {
  return [
    sourceContract("approval_queue_ui", approvalQueueUi, approvalQueueUi.summary?.approval_queue_ui_status),
    sourceContract("dashboard_information_architecture", dashboardInformationArchitecture, dashboardInformationArchitecture.summary?.review_dashboard_ia_status),
    sourceContract("evidence_viewer_data_api", evidenceViewerDataApi, evidenceViewerDataApi.summary?.evidence_viewer_data_status),
    sourceContract("citation_object_store", citationObjectStore, citationObjectStore.summary?.citation_object_store_status),
    sourceContract("evidence_coverage_score", evidenceCoverageScore, evidenceCoverageScore.summary?.evidence_coverage_status),
    sourceContract("evidence_flags", evidenceFlags, evidenceFlags.summary?.evidence_flags_status),
  ];
}

function sourceContract(sourceId, artifact, sourceStatus) {
  return {
    schema_version: "evidence-viewer-ui-source-contract.v1",
    source_id: sourceId,
    source_schema_version: artifact.schema_version ?? null,
    source_generated_at: artifact.generated_at ?? null,
    source_status: sourceStatus ?? "unknown",
    validation_error_count: artifact.validation?.errors?.length ?? artifact.summary?.validation_error_count ?? 0,
  };
}

function buildUiActions() {
  return {
    source_span_view_allowed: true,
    citation_view_allowed: true,
    coverage_view_allowed: true,
    flag_view_allowed: true,
    approve_allowed: false,
    citation_approval_allowed: false,
    output_delivery_allowed: false,
    source_ingest_allowed: false,
    mutation_allowed: false,
    protected_action_execution_allowed: false,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status === "failed").map((item) => ({
    validation_id: item.validation_id,
    path: item.check_id,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors,
  };
}

function check(checkId, passed, message) {
  return {
    schema_version: "evidence-viewer-ui-check.v1",
    validation_id: `evidence-viewer-ui.${checkId}`,
    subject_id: "evidence_viewer_ui",
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function renderSummary({ summary, panels }) {
  const lines = [];
  lines.push("# Evidence Viewer UI");
  lines.push("");
  lines.push(`Status: ${summary.evidence_viewer_ui_status}`);
  lines.push("");
  lines.push(`- Phase: ${summary.phase_slot}`);
  lines.push(`- Previous phase: ${summary.previous_phase_slot}`);
  lines.push(`- Next phase: ${summary.next_phase_slot}`);
  lines.push(`- Panels: ${summary.evidence_viewer_ui_panel_count}`);
  lines.push(`- Cards: ${summary.evidence_viewer_ui_card_count}`);
  lines.push(`- Source spans: ${summary.source_span_row_count}`);
  lines.push(`- Citations: ${summary.citation_row_count}`);
  lines.push(`- Coverage rows: ${summary.coverage_row_count}`);
  lines.push(`- Human review required cards: ${summary.human_review_required_card_count}`);
  lines.push(`- Client-facing ready cards: ${summary.client_facing_ready_card_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Panels");
  lines.push("");
  for (const panel of panels) {
    lines.push(`- ${panel.panel_label}: ${panel.row_count} row(s), ${panel.panel_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options = {}) {
  return {
    package_path: options.packagePath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.implementationRoadmapPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.reviewApiPath,
    review_api_doc_path: options.reviewApiDocPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.reviewApiDocPath,
    approval_queue_ui_path: options.approvalQueueUiPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.approvalQueueUiPath,
    dashboard_information_architecture_path: options.dashboardInformationArchitecturePath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.dashboardInformationArchitecturePath,
    evidence_viewer_data_api_path: options.evidenceViewerDataApiPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.evidenceViewerDataApiPath,
    citation_object_store_path: options.citationObjectStorePath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.citationObjectStorePath,
    evidence_coverage_score_path: options.evidenceCoverageScorePath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.evidenceCoverageScorePath,
    evidence_flags_path: options.evidenceFlagsPath ?? DEFAULT_EVIDENCE_VIEWER_UI_INPUTS.evidenceFlagsPath,
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
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") parsed.implementationRoadmapPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--review-api-doc") parsed.reviewApiDocPath = argv[++index];
    else if (arg === "--approval-queue-ui") parsed.approvalQueueUiPath = argv[++index];
    else if (arg === "--dashboard-ia") parsed.dashboardInformationArchitecturePath = argv[++index];
    else if (arg === "--evidence-viewer-data-api") parsed.evidenceViewerDataApiPath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--evidence-coverage-score") parsed.evidenceCoverageScorePath = argv[++index];
    else if (arg === "--evidence-flags") parsed.evidenceFlagsPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-viewer-ui.mjs [options]

Options:
  --check                            Fail when validation checks fail.
  --out-dir <path>                   Output directory.
  --approval-queue-ui <path>         approval-queue-ui.json path.
  --dashboard-ia <path>              review-dashboard-ia.json path.
  --evidence-viewer-data-api <path>  evidence-viewer-data-api.json path.
  --citation-object-store <path>     citation-object-store.json path.
  --evidence-coverage-score <path>   evidence-coverage-score.json path.
  --evidence-flags <path>            evidence-flags.json path.
  --run-at <iso>                     Deterministic generated_at timestamp.
`);
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

function firstBy(items, key) {
  const map = new Map();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (value && !map.has(value)) map.set(value, item);
  }
  return map;
}

function groupBy(items, key) {
  const map = new Map();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (!value) continue;
    const group = map.get(value) ?? [];
    group.push(item);
    map.set(value, group);
  }
  return map;
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function normalizePreview(value) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text.length > 1200 ? `${text.slice(0, 1200)}...` : text;
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}
