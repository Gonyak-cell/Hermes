import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_EXPORT_BUNDLE_OUT_DIR = "artifacts/evidence-export-bundle/latest";
export const DEFAULT_EVIDENCE_EXPORT_BUNDLE_INPUTS = {
  evidenceViewerDataApiPath: "artifacts/evidence-viewer-data-api/latest/evidence-viewer-data-api.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  evidenceCoveragePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  exhibitMapPath: "artifacts/exhibit-map/latest/exhibit-map.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVIDENCE_EXPORT_BUNDLE_CONTRACT_ID = "evidence-export-bundle.v1";
const EXPORT_BUNDLE_SCHEMA_VERSION = "evidence-export-bundle-record.v1";
const EXPORT_PACKAGE_SCHEMA_VERSION = "evidence-export-package.v1";

export async function runEvidenceExportBundle(options = {}) {
  const result = await buildEvidenceExportBundle(options);
  if (options.write !== false) await writeEvidenceExportBundle(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence export bundle failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceExportBundle(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_EXPORT_BUNDLE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverage,
    exhibitMap,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.evidence_viewer_data_api_path),
    readJson(inputs.citation_object_store_path),
    readJson(inputs.evidence_coverage_path),
    readJson(inputs.exhibit_map_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);
  const catalogs = buildCatalogLookups({
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverage,
    exhibitMap,
  });
  const exportBundles = catalogs.coverageScores.map((coverageScore, index) => buildExportBundleRecord({
    coverageScore,
    catalogs,
    index,
    generatedAt,
  }));
  const exportSourcePackages = exportBundles.map((bundle) => bundle.source_package);
  const exportCitationPackages = exportBundles.map((bundle) => bundle.citation_package);
  const exportCoveragePackages = exportBundles.map((bundle) => bundle.coverage_package);
  const exportIndexes = buildExportIndexes(exportBundles, generatedAt);
  const validationItems = validateEvidenceExportBundle({
    packageText,
    roadmapText,
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverage,
    exhibitMap,
    catalogs,
    exportBundles,
    exportSourcePackages,
    exportCitationPackages,
    exportCoveragePackages,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeEvidenceExportBundle({
    evidenceViewerDataApi,
    citationObjectStore,
    evidenceCoverage,
    exhibitMap,
    exportBundles,
    exportSourcePackages,
    exportCitationPackages,
    exportCoveragePackages,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "evidence-export-bundle.v1",
    generated_at: generatedAt,
    evidence_export_bundle_id: `evidence-export-bundle.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("evidence_viewer_data_api", evidenceViewerDataApi),
      summarizeSource("citation_object_store", citationObjectStore),
      summarizeSource("evidence_coverage_score", evidenceCoverage),
      summarizeSource("exhibit_map", exhibitMap),
    ],
    evidence_export_bundle_contract: buildEvidenceExportBundleContract(generatedAt),
    evidence_export_catalog: {
      schema_version: "evidence-export-catalog.v1",
      generated_at: generatedAt,
      export_bundles: exportBundles,
      export_source_packages: exportSourcePackages,
      export_citation_packages: exportCitationPackages,
      export_coverage_packages: exportCoveragePackages,
      export_indexes: exportIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderEvidenceExportBundleMarkdown(result),
  };
}

export async function writeEvidenceExportBundle(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableEvidenceExportBundle(result);
  await writeJson(path.join(outDir, "evidence-export-bundle.json"), serializable);
  await writeJson(path.join(outDir, "export-bundles.json"), {
    schema_version: "evidence-export-bundle-records.v1",
    generated_at: result.generated_at,
    export_bundle_count: result.evidence_export_catalog.export_bundles.length,
    export_bundles: result.evidence_export_catalog.export_bundles,
  });
  await writeJson(path.join(outDir, "export-source-packages.json"), {
    schema_version: "evidence-export-source-packages.v1",
    generated_at: result.generated_at,
    source_package_count: result.evidence_export_catalog.export_source_packages.length,
    export_source_packages: result.evidence_export_catalog.export_source_packages,
  });
  await writeJson(path.join(outDir, "export-citation-packages.json"), {
    schema_version: "evidence-export-citation-packages.v1",
    generated_at: result.generated_at,
    citation_package_count: result.evidence_export_catalog.export_citation_packages.length,
    export_citation_packages: result.evidence_export_catalog.export_citation_packages,
  });
  await writeJson(path.join(outDir, "export-coverage-packages.json"), {
    schema_version: "evidence-export-coverage-packages.v1",
    generated_at: result.generated_at,
    coverage_package_count: result.evidence_export_catalog.export_coverage_packages.length,
    export_coverage_packages: result.evidence_export_catalog.export_coverage_packages,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    evidence_export_bundle_id: result.evidence_export_bundle_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceExportBundleCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceExportBundle(args);
    console.log(`Evidence export bundle written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_export_bundle_status}`);
    console.log(`Export bundles: ${result.summary.export_bundle_count}`);
    console.log(`Source packages: ${result.summary.source_package_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCatalogLookups({ evidenceViewerDataApi, citationObjectStore, evidenceCoverage, exhibitMap }) {
  const viewerCards = evidenceViewerDataApi.evidence_viewer_data_catalog?.viewer_cards ?? [];
  const sourceSpanPanels = evidenceViewerDataApi.evidence_viewer_data_catalog?.source_span_panels ?? [];
  const lineagePathPanels = evidenceViewerDataApi.evidence_viewer_data_catalog?.lineage_path_panels ?? [];
  const outputParagraphs = citationObjectStore.citation_catalog?.output_paragraphs ?? [];
  const citations = citationObjectStore.citation_catalog?.citations ?? [];
  const coverageScores = evidenceCoverage.evidence_coverage_catalog?.coverage_scores ?? [];
  const exhibitRecords = exhibitMap.exhibit_catalog?.exhibit_records ?? [];
  return {
    viewerCards,
    sourceSpanPanels,
    lineagePathPanels,
    outputParagraphs,
    citations,
    coverageScores,
    exhibitRecords,
    viewerCardByEvidenceId: indexBy(viewerCards, "evidence_id"),
    sourceSpanPanelById: indexBy(sourceSpanPanels, "source_span_id"),
    lineagePathPanelById: indexBy(lineagePathPanels, "lineage_path_id"),
    outputById: indexBy(outputParagraphs, "output_paragraph_id"),
    citationById: indexBy(citations, "citation_id"),
    exhibitByCoverageId: indexBy(exhibitRecords, "coverage_score_id"),
  };
}

function buildExportBundleRecord({ coverageScore, catalogs, index, generatedAt }) {
  const viewerCard = catalogs.viewerCardByEvidenceId.get(coverageScore.evidence_item_id) ?? null;
  const sourcePanel = catalogs.sourceSpanPanelById.get(coverageScore.source_span_id) ?? null;
  const lineagePanel = catalogs.lineagePathPanelById.get(coverageScore.lineage_path_id) ?? null;
  const outputParagraph = catalogs.outputById.get(coverageScore.output_paragraph_id) ?? null;
  const citation = catalogs.citationById.get(coverageScore.citation_id) ?? null;
  const exhibit = catalogs.exhibitByCoverageId.get(coverageScore.coverage_score_id) ?? null;
  const sequence = index + 1;
  const exportBundleId = `evidence-export-bundle.${String(sequence).padStart(4, "0")}.${slugify(coverageScore.output_paragraph_id)}`;
  const sourcePackage = buildSourcePackage({ exportBundleId, coverageScore, viewerCard, sourcePanel, generatedAt });
  const citationPackage = buildCitationPackage({ exportBundleId, coverageScore, citation, outputParagraph, exhibit, generatedAt });
  const coveragePackage = buildCoveragePackage({ exportBundleId, coverageScore, generatedAt });
  return {
    schema_version: EXPORT_BUNDLE_SCHEMA_VERSION,
    export_bundle_id: exportBundleId,
    export_sequence: sequence,
    generated_at: generatedAt,
    bundle_status: "held_for_attorney_review",
    export_status: "internal_review_only",
    tenant_id: coverageScore.tenant_id ?? null,
    matter_id: coverageScore.matter_id ?? null,
    classification: coverageScore.classification ?? null,
    policy_snapshot_id: coverageScore.policy_snapshot_id ?? null,
    output_paragraph_id: coverageScore.output_paragraph_id,
    citation_id: coverageScore.citation_id,
    coverage_score_id: coverageScore.coverage_score_id,
    lineage_path_id: coverageScore.lineage_path_id,
    evidence_id: coverageScore.evidence_item_id,
    source_span_id: coverageScore.source_span_id,
    exhibit_id: exhibit?.exhibit_id ?? null,
    exhibit_reference: exhibit?.exhibit_reference ?? null,
    source_package_id: sourcePackage.source_package_id,
    citation_package_id: citationPackage.citation_package_id,
    coverage_package_id: coveragePackage.coverage_package_id,
    source_package: sourcePackage,
    citation_package: citationPackage,
    coverage_package: coveragePackage,
    lineage_package: buildLineagePackage({ exportBundleId, coverageScore, lineagePanel, generatedAt }),
    exhibit_package: buildExhibitPackage({ exportBundleId, exhibit, generatedAt }),
    review_gate: {
      review_status: "needs_review",
      human_review_required: true,
      attorney_review_required: true,
      approval_required_before_delivery: true,
      source_review_required: true,
      citation_review_required: true,
      coverage_review_required: true,
      output_delivery_allowed: false,
      external_transfer_allowed: false,
      client_facing_ready: false,
    },
    bundle_actions: {
      source_view_allowed: Boolean(sourcePanel || viewerCard?.source_span),
      citation_view_allowed: Boolean(citation),
      coverage_view_allowed: Boolean(coverageScore),
      exhibit_view_allowed: Boolean(exhibit),
      export_file_generation_allowed: true,
      output_delivery_allowed: false,
      external_transfer_allowed: false,
      client_facing_delivery_allowed: false,
    },
    preservation: buildPreservation(coverageScore, sourcePackage, citationPackage, exhibit),
    metadata: {
      paragraph_preview: truncate(outputParagraph?.paragraph_text ?? "", 220),
      source_preview: sourcePackage.source_preview,
      missing_required_dimension_count: coverageScore.missing_required_dimension_count ?? 0,
      export_rule: "internal_review_bundle_only_until_attorney_approval",
    },
  };
}

function buildSourcePackage({ exportBundleId, coverageScore, viewerCard, sourcePanel, generatedAt }) {
  const sourceSpan = viewerCard?.source_span ?? null;
  return {
    schema_version: EXPORT_PACKAGE_SCHEMA_VERSION,
    source_package_id: `source-package.${slugify(exportBundleId)}`,
    export_bundle_id: exportBundleId,
    generated_at: generatedAt,
    package_type: "source",
    package_status: sourcePanel || sourceSpan ? "bound" : "missing",
    evidence_id: coverageScore.evidence_item_id,
    viewer_card_id: viewerCard?.viewer_card_id ?? null,
    source_span_panel_id: sourcePanel?.source_span_panel_id ?? null,
    source_span_id: coverageScore.source_span_id,
    source_span_count: viewerCard?.source_span_count ?? sourcePanel?.evidence_binding_count ?? 0,
    resource_id: sourcePanel?.resource_id ?? sourceSpan?.resource_id ?? null,
    resource_version_id: sourcePanel?.resource_version_id ?? sourceSpan?.resource_version_id ?? null,
    normalized_text_id: sourcePanel?.normalized_text_id ?? sourceSpan?.normalized_text_id ?? null,
    tenant_id: coverageScore.tenant_id ?? sourcePanel?.tenant_id ?? sourceSpan?.tenant_id ?? null,
    matter_id: coverageScore.matter_id ?? sourcePanel?.matter_id ?? sourceSpan?.matter_id ?? null,
    classification: coverageScore.classification ?? sourcePanel?.classification ?? sourceSpan?.classification ?? null,
    policy_snapshot_id: coverageScore.policy_snapshot_id ?? sourcePanel?.policy_snapshot_id ?? sourceSpan?.policy_snapshot_id ?? null,
    source_locator: sourcePanel?.locator ?? sourceSpan?.locator ?? viewerCard?.source_locator ?? {},
    source_preview: sourcePanel?.content_preview ?? sourceSpan?.content_preview ?? viewerCard?.source_preview ?? "",
    review_status: viewerCard?.review_status ?? sourcePanel?.review_status ?? coverageScore.review_status ?? "needs_review",
    output_delivery_allowed: false,
    external_transfer_allowed: false,
  };
}

function buildCitationPackage({ exportBundleId, coverageScore, citation, outputParagraph, exhibit, generatedAt }) {
  return {
    schema_version: EXPORT_PACKAGE_SCHEMA_VERSION,
    citation_package_id: `citation-package.${slugify(exportBundleId)}`,
    export_bundle_id: exportBundleId,
    generated_at: generatedAt,
    package_type: "citation",
    package_status: citation && outputParagraph ? "bound" : "missing",
    output_paragraph_id: coverageScore.output_paragraph_id,
    citation_id: coverageScore.citation_id,
    citation_status: citation?.citation_status ?? "unknown",
    verification_status: citation?.verification_status ?? "unknown",
    source_binding_status: citation?.source_binding_status ?? "unknown",
    paragraph_text: outputParagraph?.paragraph_text ?? "",
    paragraph_type: outputParagraph?.paragraph_type ?? null,
    exhibit_id: exhibit?.exhibit_id ?? null,
    exhibit_reference: exhibit?.exhibit_reference ?? null,
    tenant_id: coverageScore.tenant_id ?? citation?.tenant_id ?? outputParagraph?.tenant_id ?? null,
    matter_id: coverageScore.matter_id ?? citation?.matter_id ?? outputParagraph?.matter_id ?? null,
    classification: coverageScore.classification ?? citation?.classification ?? outputParagraph?.classification ?? null,
    policy_snapshot_id: coverageScore.policy_snapshot_id ?? citation?.policy_snapshot_id ?? outputParagraph?.policy_snapshot_id ?? null,
    review_status: citation?.citation_status ?? outputParagraph?.review_status ?? "needs_review",
    human_review_required: citation?.human_review_required ?? true,
    client_facing_ready: false,
  };
}

function buildCoveragePackage({ exportBundleId, coverageScore, generatedAt }) {
  return {
    schema_version: EXPORT_PACKAGE_SCHEMA_VERSION,
    coverage_package_id: `coverage-package.${slugify(exportBundleId)}`,
    export_bundle_id: exportBundleId,
    generated_at: generatedAt,
    package_type: "coverage",
    package_status: "bound",
    coverage_score_id: coverageScore.coverage_score_id,
    coverage_status: coverageScore.coverage_status,
    coverage_score: coverageScore.coverage_score,
    required_dimension_count: coverageScore.required_dimension_count ?? 0,
    covered_required_dimension_count: coverageScore.covered_required_dimension_count ?? 0,
    missing_required_dimension_count: coverageScore.missing_required_dimension_count ?? 0,
    dimension_count: coverageScore.dimension_count ?? coverageScore.coverage_dimensions?.length ?? 0,
    dimensions: (coverageScore.coverage_dimensions ?? []).map((dimension) => ({
      coverage_dimension_id: dimension.coverage_dimension_id,
      dimension: dimension.dimension,
      required: dimension.required,
      covered: dimension.covered,
      coverage_status: dimension.coverage_status,
      rationale: dimension.rationale,
    })),
    review_status: coverageScore.review_status ?? "needs_review",
    human_review_required: coverageScore.human_review_required ?? true,
    client_facing_ready: false,
  };
}

function buildLineagePackage({ exportBundleId, coverageScore, lineagePanel, generatedAt }) {
  return {
    schema_version: EXPORT_PACKAGE_SCHEMA_VERSION,
    lineage_package_id: `lineage-package.${slugify(exportBundleId)}`,
    export_bundle_id: exportBundleId,
    generated_at: generatedAt,
    package_type: "lineage",
    package_status: lineagePanel ? "bound" : "missing",
    lineage_path_id: coverageScore.lineage_path_id,
    path_status: lineagePanel?.path_status ?? "unknown",
    node_count: lineagePanel?.node_count ?? 0,
    edge_count: lineagePanel?.edge_count ?? 0,
    node_sequence: lineagePanel?.node_sequence ?? [],
    edge_sequence: lineagePanel?.edge_sequence ?? [],
  };
}

function buildExhibitPackage({ exportBundleId, exhibit, generatedAt }) {
  return {
    schema_version: EXPORT_PACKAGE_SCHEMA_VERSION,
    exhibit_package_id: `exhibit-package.${slugify(exportBundleId)}`,
    export_bundle_id: exportBundleId,
    generated_at: generatedAt,
    package_type: "exhibit",
    package_status: exhibit ? "bound" : "missing",
    exhibit_id: exhibit?.exhibit_id ?? null,
    exhibit_number: exhibit?.exhibit_number ?? null,
    exhibit_label: exhibit?.exhibit_label ?? null,
    exhibit_reference: exhibit?.exhibit_reference ?? null,
    exhibit_status: exhibit?.exhibit_status ?? "unknown",
    attorney_review_required: exhibit?.attorney_review_required ?? true,
    client_facing_ready: false,
  };
}

function buildEvidenceExportBundleContract(generatedAt) {
  return {
    schema_version: "evidence-export-bundle-contract.v1",
    evidence_export_bundle_contract_id: EVIDENCE_EXPORT_BUNDLE_CONTRACT_ID,
    generated_at: generatedAt,
    export_bundle_schema_version: EXPORT_BUNDLE_SCHEMA_VERSION,
    export_package_schema_version: EXPORT_PACKAGE_SCHEMA_VERSION,
    source_inputs: [
      "evidence-viewer-data-api.v1",
      "citation-object-store.v1",
      "evidence-coverage-score.v1",
      "exhibit-map.v1",
    ],
    required_package_types: ["source", "citation", "coverage", "lineage", "exhibit"],
    export_rule: "internal_review_bundle_only_not_delivery",
    delivery_rule: "bundle output delivery and external transfer stay blocked until explicit attorney approval.",
    api_routes: [
      "/api/evidence-export-bundles",
      "/api/evidence-export-bundle-records",
      "/api/evidence-export-source-packages",
      "/api/evidence-export-citation-packages",
      "/api/evidence-export-coverage-packages",
      "/api/evidence-export-bundle-validations",
    ],
  };
}

function validateEvidenceExportBundle({
  packageText,
  roadmapText,
  evidenceViewerDataApi,
  citationObjectStore,
  evidenceCoverage,
  exhibitMap,
  catalogs,
  exportBundles,
  exportSourcePackages,
  exportCitationPackages,
  exportCoveragePackages,
}) {
  const coverageCount = evidenceCoverage.summary?.coverage_score_count ?? 0;
  const citationCount = citationObjectStore.summary?.citation_count ?? 0;
  const exhibitCount = exhibitMap.summary?.exhibit_record_count ?? 0;
  const items = [];
  pushCheck(items, "package_json", "evidence_export_bundle_script_registered", String(packageText).includes("\"evidence:export-bundle\""), "package.json must expose npm run evidence:export-bundle.");
  pushCheck(items, "roadmap", "phase_155_documented", String(roadmapText).includes("## Phase 155: Evidence Export Bundle"), "Roadmap must document Phase 155.");
  pushCheck(items, "evidence_viewer_data_api", "viewer_data_complete", evidenceViewerDataApi.summary?.evidence_viewer_data_status === "complete", "Evidence Viewer Data API must be complete.");
  pushCheck(items, "citation_object_store", "citation_object_store_complete", citationObjectStore.summary?.citation_object_store_status === "complete", "Citation Object Store must be complete.");
  pushCheck(items, "evidence_coverage_score", "evidence_coverage_complete", evidenceCoverage.summary?.evidence_coverage_status === "complete", "Evidence Coverage Score must be complete.");
  pushCheck(items, "exhibit_map", "exhibit_map_complete", exhibitMap.summary?.exhibit_map_status === "complete", "Exhibit Map must be complete.");
  pushCheck(items, "export_bundles", "bundles_cover_coverage_scores", exportBundles.length === coverageCount, "Every coverage score must have one evidence export bundle.");
  pushCheck(items, "export_bundles", "bundles_cover_citations", exportBundles.length === citationCount, "Every citation must be represented in an evidence export bundle.");
  pushCheck(items, "export_bundles", "bundles_cover_exhibits", exportBundles.length === exhibitCount, "Every exhibit must be represented in an evidence export bundle.");
  pushCheck(items, "source_packages", "source_packages_cover_bundles", exportSourcePackages.length === exportBundles.length, "Every bundle must have a source package.");
  pushCheck(items, "citation_packages", "citation_packages_cover_bundles", exportCitationPackages.length === exportBundles.length, "Every bundle must have a citation package.");
  pushCheck(items, "coverage_packages", "coverage_packages_cover_bundles", exportCoveragePackages.length === exportBundles.length, "Every bundle must have a coverage package.");
  pushCheck(items, "export_bundles", "bundles_are_fully_bound", exportBundles.every(bundleFullyBound), "Every export bundle must bind source, citation, coverage, lineage, and exhibit packages.");
  pushCheck(items, "export_bundles", "bundle_identity_preserved", exportBundles.every(bundleIdentityPreserved), "Every export bundle must preserve matter, classification, and policy snapshot across packages.");
  pushCheck(items, "export_bundles", "bundles_held_for_review", exportBundles.every((bundle) => bundle.bundle_status === "held_for_attorney_review" && bundle.review_gate.attorney_review_required === true), "Every export bundle must be held for attorney review.");
  pushCheck(items, "export_bundles", "bundle_delivery_blocked", exportBundles.every((bundle) => bundle.bundle_actions.output_delivery_allowed === false && bundle.bundle_actions.external_transfer_allowed === false && bundle.review_gate.client_facing_ready === false), "Export bundles must not authorize delivery or external transfer.");
  pushCheck(items, "source_packages", "source_package_locator_present", exportSourcePackages.every((pkg) => pkg.package_status === "bound" && Object.keys(pkg.source_locator ?? {}).length > 0 && pkg.source_preview.length > 0), "Every source package must expose a locator and preview.");
  pushCheck(items, "citation_packages", "citation_package_source_bound", exportCitationPackages.every((pkg) => pkg.package_status === "bound" && pkg.source_binding_status === "bound"), "Every citation package must be source-bound.");
  pushCheck(items, "coverage_packages", "coverage_package_dimensions_present", exportCoveragePackages.every((pkg) => pkg.package_status === "bound" && pkg.dimension_count === pkg.dimensions.length && pkg.dimension_count > 0), "Every coverage package must include coverage dimensions.");
  pushCheck(items, "catalog_integrity", "input_catalogs_non_empty", catalogs.viewerCards.length > 0 && catalogs.citations.length > 0 && catalogs.coverageScores.length > 0 && catalogs.exhibitRecords.length > 0, "Input catalogs must be non-empty.");
  return items;
}

function summarizeEvidenceExportBundle({
  evidenceViewerDataApi,
  citationObjectStore,
  evidenceCoverage,
  exhibitMap,
  exportBundles,
  exportSourcePackages,
  exportCitationPackages,
  exportCoveragePackages,
  validationItems,
  validation,
}) {
  const bundleCount = exportBundles.length;
  return {
    evidence_export_bundle_status: validation.valid ? "complete" : "blocked",
    evidence_export_bundle_contract_id: EVIDENCE_EXPORT_BUNDLE_CONTRACT_ID,
    evidence_viewer_data_status: evidenceViewerDataApi.summary?.evidence_viewer_data_status ?? "unknown",
    citation_object_store_status: citationObjectStore.summary?.citation_object_store_status ?? "unknown",
    evidence_coverage_status: evidenceCoverage.summary?.evidence_coverage_status ?? "unknown",
    exhibit_map_status: exhibitMap.summary?.exhibit_map_status ?? "unknown",
    viewer_card_count: evidenceViewerDataApi.summary?.viewer_card_count ?? 0,
    citation_count: citationObjectStore.summary?.citation_count ?? 0,
    coverage_score_count: evidenceCoverage.summary?.coverage_score_count ?? 0,
    exhibit_record_count: exhibitMap.summary?.exhibit_record_count ?? 0,
    export_bundle_count: bundleCount,
    source_package_count: exportSourcePackages.length,
    citation_package_count: exportCitationPackages.length,
    coverage_package_count: exportCoveragePackages.length,
    exhibit_package_count: exportBundles.filter((bundle) => bundle.exhibit_package.package_status === "bound").length,
    lineage_package_count: exportBundles.filter((bundle) => bundle.lineage_package.package_status === "bound").length,
    source_bound_bundle_count: exportBundles.filter((bundle) => bundle.source_package.package_status === "bound").length,
    citation_bound_bundle_count: exportBundles.filter((bundle) => bundle.citation_package.package_status === "bound").length,
    coverage_bound_bundle_count: exportBundles.filter((bundle) => bundle.coverage_package.package_status === "bound").length,
    lineage_bound_bundle_count: exportBundles.filter((bundle) => bundle.lineage_package.package_status === "bound").length,
    exhibit_bound_bundle_count: exportBundles.filter((bundle) => bundle.exhibit_package.package_status === "bound").length,
    held_for_review_bundle_count: exportBundles.filter((bundle) => bundle.bundle_status === "held_for_attorney_review").length,
    attorney_review_required_bundle_count: exportBundles.filter((bundle) => bundle.review_gate.attorney_review_required === true).length,
    read_only_bundle_count: exportBundles.filter((bundle) => bundle.export_status === "internal_review_only").length,
    delivery_blocked_bundle_count: exportBundles.filter((bundle) => bundle.bundle_actions.output_delivery_allowed === false).length,
    external_transfer_blocked_bundle_count: exportBundles.filter((bundle) => bundle.bundle_actions.external_transfer_allowed === false).length,
    client_facing_ready_bundle_count: exportBundles.filter((bundle) => bundle.review_gate.client_facing_ready === true).length,
    matter_preserved_bundle_count: exportBundles.filter((bundle) => bundle.preservation.matter_preserved === true).length,
    classification_preserved_bundle_count: exportBundles.filter((bundle) => bundle.preservation.classification_preserved === true).length,
    policy_snapshot_preserved_bundle_count: exportBundles.filter((bundle) => bundle.preservation.policy_snapshot_preserved === true).length,
    missing_required_dimension_total: exportBundles.reduce((sum, bundle) => sum + (bundle.coverage_package.missing_required_dimension_count ?? 0), 0),
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(exportBundles, "matter_id"),
    by_classification: countBy(exportBundles, "classification"),
    by_export_status: countBy(exportBundles, "export_status"),
    by_bundle_status: countBy(exportBundles, "bundle_status"),
  };
}

function buildExportIndexes(exportBundles, generatedAt) {
  return {
    schema_version: "evidence-export-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(exportBundles, "matter_id"),
    by_classification: countBy(exportBundles, "classification"),
    by_export_status: countBy(exportBundles, "export_status"),
    by_bundle_status: countBy(exportBundles, "bundle_status"),
    by_coverage_status: countBy(exportBundles.map((bundle) => bundle.coverage_package), "coverage_status"),
  };
}

function buildPreservation(coverageScore, sourcePackage, citationPackage, exhibit) {
  const candidates = [sourcePackage, citationPackage, exhibit].filter(Boolean);
  return {
    matter_preserved: candidates.every((item) => (item.matter_id ?? coverageScore.matter_id ?? null) === (coverageScore.matter_id ?? null)),
    classification_preserved: candidates.every((item) => (item.classification ?? coverageScore.classification ?? null) === (coverageScore.classification ?? null)),
    policy_snapshot_preserved: candidates.every((item) => (item.policy_snapshot_id ?? coverageScore.policy_snapshot_id ?? null) === (coverageScore.policy_snapshot_id ?? null)),
  };
}

function bundleFullyBound(bundle) {
  return bundle.source_package.package_status === "bound"
    && bundle.citation_package.package_status === "bound"
    && bundle.coverage_package.package_status === "bound"
    && bundle.lineage_package.package_status === "bound"
    && bundle.exhibit_package.package_status === "bound";
}

function bundleIdentityPreserved(bundle) {
  return bundle.preservation.matter_preserved === true
    && bundle.preservation.classification_preserved === true
    && bundle.preservation.policy_snapshot_preserved === true;
}

function summarizeSource(sourceId, artifact) {
  return {
    source_id: sourceId,
    schema_version: artifact.schema_version ?? null,
    generated_at: artifact.generated_at ?? null,
    summary: artifact.summary ?? null,
  };
}

function serializableEvidenceExportBundle(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderEvidenceExportBundleMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Export Bundle");
  lines.push("");
  lines.push(`Status: ${result.summary.evidence_export_bundle_status}`);
  lines.push(`Contract: ${result.summary.evidence_export_bundle_contract_id}`);
  lines.push(`Export bundles: ${result.summary.export_bundle_count}`);
  lines.push(`Source packages: ${result.summary.source_package_count}`);
  lines.push(`Citation packages: ${result.summary.citation_package_count}`);
  lines.push(`Coverage packages: ${result.summary.coverage_package_count}`);
  lines.push(`Delivery blocked: ${result.summary.delivery_blocked_bundle_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Routes");
  for (const route of result.evidence_export_bundle_contract.api_routes) {
    lines.push(`- ${route}`);
  }
  return `${lines.join("\n")}\n`;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.subject_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, subjectId, checkId, passed, message) {
  items.push({
    schema_version: "validation-item.v1",
    validation_id: `evidence-export-bundle.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
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
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--evidence-viewer-data-api") parsed.evidenceViewerDataApiPath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--evidence-coverage") parsed.evidenceCoveragePath = argv[++index];
    else if (arg === "--exhibit-map") parsed.exhibitMapPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: node scripts/evidence-export-bundle.mjs [options]

Options:
  --check                              Exit non-zero when validation fails.
  --out-dir <path>                     Output directory.
  --evidence-viewer-data-api <path>    evidence-viewer-data-api.json path.
  --citation-object-store <path>       citation-object-store.json path.
  --evidence-coverage <path>           evidence-coverage-score.json path.
  --exhibit-map <path>                 exhibit-map.json path.
  --run-at <iso>                       Override generated_at.
  --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    evidence_viewer_data_api_path: path.resolve(options.evidenceViewerDataApiPath ?? DEFAULT_EVIDENCE_EXPORT_BUNDLE_INPUTS.evidenceViewerDataApiPath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_EVIDENCE_EXPORT_BUNDLE_INPUTS.citationObjectStorePath),
    evidence_coverage_path: path.resolve(options.evidenceCoveragePath ?? DEFAULT_EVIDENCE_EXPORT_BUNDLE_INPUTS.evidenceCoveragePath),
    exhibit_map_path: path.resolve(options.exhibitMapPath ?? DEFAULT_EVIDENCE_EXPORT_BUNDLE_INPUTS.exhibitMapPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_EXPORT_BUNDLE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_EXPORT_BUNDLE_INPUTS.roadmapPath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

async function readText(filePath) {
  return readFile(path.resolve(filePath), "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function truncate(value, length) {
  const text = String(value ?? "");
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
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
