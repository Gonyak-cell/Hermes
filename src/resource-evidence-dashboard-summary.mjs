import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_OUT_DIR = "artifacts/resource-evidence-dashboard/latest";
export const DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  resourceQuarantineModelPath: "artifacts/resource-quarantine/latest/resource-quarantine-model.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  evidenceCoveragePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  evidenceViewerDataApiPath: "artifacts/evidence-viewer-data-api/latest/evidence-viewer-data-api.json",
  evidenceExportBundlePath: "artifacts/evidence-export-bundle/latest/evidence-export-bundle.json",
  evidenceRegressionTestsPath: "artifacts/evidence-regression-tests/latest/evidence-regression-tests.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const RESOURCE_EVIDENCE_DASHBOARD_CONTRACT_ID = "resource-evidence-dashboard-summary.v1";
const PANEL_SCHEMA_VERSION = "resource-evidence-dashboard-panel-row.v1";
const MATTER_ROLLUP_SCHEMA_VERSION = "resource-evidence-dashboard-matter-rollup.v1";
const CLASSIFICATION_ROLLUP_SCHEMA_VERSION = "resource-evidence-dashboard-classification-rollup.v1";

export async function runResourceEvidenceDashboardSummary(options = {}) {
  const result = await buildResourceEvidenceDashboardSummary(options);
  if (options.write !== false) await writeResourceEvidenceDashboardSummary(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Resource/evidence dashboard summary failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildResourceEvidenceDashboardSummary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    resourceIngest,
    resourceStoreInterface,
    resourceQuarantineModel,
    evidenceItemStore,
    evidenceCoverage,
    evidenceViewerDataApi,
    evidenceExportBundle,
    evidenceRegressionTests,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.resource_ingest_path),
    readJson(inputs.resource_store_interface_path),
    readJson(inputs.resource_quarantine_model_path),
    readJson(inputs.evidence_item_store_path),
    readJson(inputs.evidence_coverage_path),
    readJson(inputs.evidence_viewer_data_api_path),
    readJson(inputs.evidence_export_bundle_path),
    readJson(inputs.evidence_regression_tests_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const sources = {
    resourceIngest,
    resourceStoreInterface,
    resourceQuarantineModel,
    evidenceItemStore,
    evidenceCoverage,
    evidenceViewerDataApi,
    evidenceExportBundle,
    evidenceRegressionTests,
  };
  const panelRows = buildPanelRows(sources, generatedAt);
  const matterRollups = buildMatterRollups(sources, generatedAt);
  const classificationRollups = buildClassificationRollups(sources, generatedAt);
  const validationItems = validateResourceEvidenceDashboardSummary({
    sources,
    panelRows,
    matterRollups,
    classificationRollups,
    packageText,
    roadmapText,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeResourceEvidenceDashboardSummary({
    sources,
    panelRows,
    matterRollups,
    classificationRollups,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "resource-evidence-dashboard-summary.v1",
    generated_at: generatedAt,
    resource_evidence_dashboard_summary_id: `resource-evidence-dashboard-summary.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_statuses: {
      resource_ingest: sourceStatus(resourceIngest, "gate_status"),
      resource_store_interface: sourceStatus(resourceStoreInterface, "resource_store_interface_status"),
      resource_quarantine_model: sourceStatus(resourceQuarantineModel, "resource_quarantine_status"),
      evidence_item_store: sourceStatus(evidenceItemStore, "evidence_item_store_status"),
      evidence_coverage_score: sourceStatus(evidenceCoverage, "evidence_coverage_status"),
      evidence_viewer_data_api: sourceStatus(evidenceViewerDataApi, "evidence_viewer_data_status"),
      evidence_export_bundle: sourceStatus(evidenceExportBundle, "evidence_export_bundle_status"),
      evidence_regression_tests: sourceStatus(evidenceRegressionTests, "evidence_regression_status"),
    },
    resource_evidence_dashboard_contract: buildResourceEvidenceDashboardContract(generatedAt),
    resource_evidence_dashboard_catalog: {
      schema_version: "resource-evidence-dashboard-catalog.v1",
      generated_at: generatedAt,
      panel_rows: panelRows,
      matter_rollups: matterRollups,
      classification_rollups: classificationRollups,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderResourceEvidenceDashboardSummaryMarkdown(result),
  };
}

export async function writeResourceEvidenceDashboardSummary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableResourceEvidenceDashboardSummary(result);
  await writeJson(path.join(outDir, "resource-evidence-dashboard-summary.json"), serializable);
  await writeJson(path.join(outDir, "panel-rows.json"), {
    schema_version: "resource-evidence-dashboard-panel-rows.v1",
    generated_at: result.generated_at,
    panel_row_count: result.resource_evidence_dashboard_catalog.panel_rows.length,
    panel_rows: result.resource_evidence_dashboard_catalog.panel_rows,
  });
  await writeJson(path.join(outDir, "matter-rollups.json"), {
    schema_version: "resource-evidence-dashboard-matter-rollups.v1",
    generated_at: result.generated_at,
    matter_rollup_count: result.resource_evidence_dashboard_catalog.matter_rollups.length,
    matter_rollups: result.resource_evidence_dashboard_catalog.matter_rollups,
  });
  await writeJson(path.join(outDir, "classification-rollups.json"), {
    schema_version: "resource-evidence-dashboard-classification-rollups.v1",
    generated_at: result.generated_at,
    classification_rollup_count: result.resource_evidence_dashboard_catalog.classification_rollups.length,
    classification_rollups: result.resource_evidence_dashboard_catalog.classification_rollups,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    resource_evidence_dashboard_summary_id: result.resource_evidence_dashboard_summary_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runResourceEvidenceDashboardSummaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runResourceEvidenceDashboardSummary(args);
    console.log(`Resource/evidence dashboard summary written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.resource_evidence_dashboard_status}`);
    console.log(`Panels: ${result.summary.panel_row_count}`);
    console.log(`Matter rollups: ${result.summary.matter_rollup_count}`);
    console.log(`Classification rollups: ${result.summary.classification_rollup_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildResourceEvidenceDashboardContract(generatedAt) {
  return {
    schema_version: "resource-evidence-dashboard-contract.v1",
    resource_evidence_dashboard_contract_id: RESOURCE_EVIDENCE_DASHBOARD_CONTRACT_ID,
    generated_at: generatedAt,
    source_rule: "Dashboard rows are read-only projections over resource ingest, quarantine, evidence, coverage, export, and regression artifacts.",
    matter_boundary_rule: "Matter and classification rollups preserve source matter_id/classification values and do not merge data by prompt instruction.",
    delivery_rule: "This surface is an internal operational dashboard. It cannot approve, deliver, mutate, or mark client-facing legal output ready.",
    api_routes: [
      "/api/resource-evidence-dashboard-summaries",
      "/api/resource-evidence-panel-rows",
      "/api/resource-evidence-matter-rollups",
      "/api/resource-evidence-classification-rollups",
      "/api/resource-evidence-dashboard-validations",
    ],
  };
}

function buildPanelRows(sources, generatedAt) {
  const ingestSummary = sources.resourceIngest.summary ?? {};
  const storeSummary = sources.resourceStoreInterface.summary ?? {};
  const quarantineSummary = sources.resourceQuarantineModel.summary ?? {};
  const evidenceSummary = sources.evidenceItemStore.summary ?? {};
  const viewerSummary = sources.evidenceViewerDataApi.summary ?? {};
  const coverageSummary = sources.evidenceCoverage.summary ?? {};
  const exportSummary = sources.evidenceExportBundle.summary ?? {};
  const regressionSummary = sources.evidenceRegressionTests.summary ?? {};
  return [
    panelRow({
      panelId: "resource_evidence_panel.ingest",
      panelType: "ingest",
      label: "Resource Ingest",
      sourceArtifactId: "resource_ingest",
      sourceStatus: ingestSummary.gate_status ?? "unknown",
      primaryCount: ingestSummary.promoted_resource_count ?? 0,
      secondaryCount: ingestSummary.promoted_evidence_count ?? 0,
      attentionCount: (ingestSummary.duplicate_count ?? 0) + (ingestSummary.blocked_count ?? 0),
      blockedCount: ingestSummary.blocked_count ?? 0,
      reviewRequiredCount: 0,
      validationErrorCount: sourceValidationErrors(sources.resourceIngest),
      routes: ["/api/sources", "/api/resource-store-records"],
      message: `${ingestSummary.promoted_resource_count ?? 0} resource(s), ${ingestSummary.promoted_evidence_count ?? 0} evidence seed(s) promoted.`,
      generatedAt,
      metrics: {
        source_item_count: ingestSummary.source_item_count ?? 0,
        duplicate_count: ingestSummary.duplicate_count ?? 0,
      },
    }),
    panelRow({
      panelId: "resource_evidence_panel.store",
      panelType: "store",
      label: "Resource Store",
      sourceArtifactId: "resource_store_interface",
      sourceStatus: storeSummary.resource_store_interface_status ?? "unknown",
      primaryCount: storeSummary.resource_store_record_count ?? 0,
      secondaryCount: storeSummary.resource_version_store_record_count ?? 0,
      attentionCount: storeSummary.validation_error_count ?? 0,
      blockedCount: 0,
      reviewRequiredCount: 0,
      validationErrorCount: sourceValidationErrors(sources.resourceStoreInterface),
      routes: ["/api/resource-store-interfaces", "/api/resource-store-records", "/api/resource-version-store-records"],
      message: `${storeSummary.resource_store_record_count ?? 0} stored resource(s), ${storeSummary.held_resource_query_plan_count ?? 0} held query plan(s).`,
      generatedAt,
      metrics: {
        registry_projection_count: storeSummary.registry_projection_count ?? 0,
        compiled_resource_query_plan_count: storeSummary.compiled_resource_query_plan_count ?? 0,
        executable_resource_query_plan_count: storeSummary.executable_resource_query_plan_count ?? 0,
      },
    }),
    panelRow({
      panelId: "resource_evidence_panel.quarantine",
      panelType: "quarantine",
      label: "Resource Quarantine",
      sourceArtifactId: "resource_quarantine_model",
      sourceStatus: quarantineSummary.resource_quarantine_status ?? "unknown",
      primaryCount: quarantineSummary.quarantine_item_count ?? 0,
      secondaryCount: quarantineSummary.review_queue_item_count ?? 0,
      attentionCount: quarantineSummary.pending_human_review_count ?? 0,
      blockedCount: quarantineSummary.retrieval_blocked_count ?? 0,
      reviewRequiredCount: quarantineSummary.pending_human_review_count ?? 0,
      validationErrorCount: sourceValidationErrors(sources.resourceQuarantineModel),
      routes: ["/api/resource-quarantine-models", "/api/resource-quarantine-items", "/api/resource-quarantine-review-queue"],
      message: `${quarantineSummary.quarantine_item_count ?? 0} held resource(s), ${quarantineSummary.pending_human_review_count ?? 0} pending human review.`,
      generatedAt,
      metrics: {
        external_transfer_blocked_count: quarantineSummary.external_transfer_blocked_count ?? 0,
        output_delivery_blocked_count: quarantineSummary.output_delivery_blocked_count ?? 0,
        auto_release_allowed_count: quarantineSummary.auto_release_allowed_count ?? 0,
      },
    }),
    panelRow({
      panelId: "resource_evidence_panel.evidence",
      panelType: "evidence",
      label: "Evidence Items",
      sourceArtifactId: "evidence_item_store",
      sourceStatus: evidenceSummary.evidence_item_store_status ?? "unknown",
      primaryCount: evidenceSummary.evidence_item_count ?? 0,
      secondaryCount: evidenceSummary.evidence_source_span_binding_count ?? 0,
      attentionCount: evidenceSummary.needs_review_count ?? 0,
      blockedCount: 0,
      reviewRequiredCount: evidenceSummary.review_queue_item_count ?? 0,
      validationErrorCount: sourceValidationErrors(sources.evidenceItemStore),
      routes: ["/api/evidence-item-stores", "/api/evidence-items", "/api/evidence-review-queue"],
      message: `${evidenceSummary.evidence_item_count ?? 0} evidence item(s), ${evidenceSummary.needs_review_count ?? 0} attorney review candidate(s).`,
      generatedAt,
      metrics: {
        source_span_linked_evidence_count: evidenceSummary.source_span_linked_evidence_count ?? 0,
        machine_extracted_evidence_count: evidenceSummary.machine_extracted_evidence_count ?? 0,
        approved_count: evidenceSummary.approved_count ?? 0,
      },
    }),
    panelRow({
      panelId: "resource_evidence_panel.viewer",
      panelType: "viewer",
      label: "Evidence Viewer",
      sourceArtifactId: "evidence_viewer_data_api",
      sourceStatus: viewerSummary.evidence_viewer_data_status ?? "unknown",
      primaryCount: viewerSummary.viewer_card_count ?? 0,
      secondaryCount: viewerSummary.source_span_panel_count ?? 0,
      attentionCount: viewerSummary.needs_review_card_count ?? 0,
      blockedCount: 0,
      reviewRequiredCount: viewerSummary.needs_review_card_count ?? 0,
      validationErrorCount: sourceValidationErrors(sources.evidenceViewerDataApi),
      routes: ["/api/evidence-viewer-data", "/api/evidence-viewer-cards", "/api/evidence-viewer-source-spans"],
      message: `${viewerSummary.viewer_card_count ?? 0} read-only evidence card(s), ${viewerSummary.complete_lineage_path_panel_count ?? 0} complete lineage panel(s).`,
      generatedAt,
      metrics: {
        card_source_span_bound_count: viewerSummary.card_source_span_bound_count ?? 0,
        card_lineage_path_bound_count: viewerSummary.card_lineage_path_bound_count ?? 0,
        read_only_card_count: viewerSummary.read_only_card_count ?? 0,
      },
    }),
    panelRow({
      panelId: "resource_evidence_panel.coverage",
      panelType: "coverage",
      label: "Evidence Coverage",
      sourceArtifactId: "evidence_coverage_score",
      sourceStatus: coverageSummary.evidence_coverage_status ?? "unknown",
      primaryCount: coverageSummary.coverage_score_count ?? 0,
      secondaryCount: coverageSummary.coverage_dimension_count ?? 0,
      attentionCount: coverageSummary.missing_required_dimension_count ?? 0,
      blockedCount: 0,
      reviewRequiredCount: coverageSummary.needs_review_score_count ?? 0,
      validationErrorCount: sourceValidationErrors(sources.evidenceCoverage),
      routes: ["/api/evidence-coverage-scores", "/api/evidence-coverage-records", "/api/evidence-coverage-dimensions"],
      message: `${coverageSummary.coverage_score_count ?? 0} coverage score(s), ${coverageSummary.missing_required_dimension_count ?? 0} missing required dimension(s).`,
      generatedAt,
      metrics: {
        full_coverage_score_count: coverageSummary.full_coverage_score_count ?? 0,
        partial_coverage_score_count: coverageSummary.partial_coverage_score_count ?? 0,
        average_coverage_score: coverageSummary.average_coverage_score ?? 0,
        client_facing_ready_score_count: coverageSummary.client_facing_ready_score_count ?? 0,
      },
    }),
    panelRow({
      panelId: "resource_evidence_panel.export",
      panelType: "export",
      label: "Evidence Export Bundle",
      sourceArtifactId: "evidence_export_bundle",
      sourceStatus: exportSummary.evidence_export_bundle_status ?? "unknown",
      primaryCount: exportSummary.export_bundle_count ?? 0,
      secondaryCount: exportSummary.source_package_count ?? 0,
      attentionCount: exportSummary.held_for_review_bundle_count ?? 0,
      blockedCount: exportSummary.delivery_blocked_bundle_count ?? 0,
      reviewRequiredCount: exportSummary.attorney_review_required_bundle_count ?? 0,
      validationErrorCount: sourceValidationErrors(sources.evidenceExportBundle),
      routes: ["/api/evidence-export-bundles", "/api/evidence-export-bundle-records", "/api/evidence-export-source-packages"],
      message: `${exportSummary.export_bundle_count ?? 0} internal review bundle(s), ${exportSummary.delivery_blocked_bundle_count ?? 0} delivery-blocked.`,
      generatedAt,
      metrics: {
        external_transfer_blocked_bundle_count: exportSummary.external_transfer_blocked_bundle_count ?? 0,
        client_facing_ready_bundle_count: exportSummary.client_facing_ready_bundle_count ?? 0,
        missing_required_dimension_total: exportSummary.missing_required_dimension_total ?? 0,
      },
    }),
    panelRow({
      panelId: "resource_evidence_panel.regression",
      panelType: "regression",
      label: "Evidence Regression",
      sourceArtifactId: "evidence_regression_tests",
      sourceStatus: regressionSummary.evidence_regression_status ?? "unknown",
      primaryCount: regressionSummary.regression_test_case_count ?? 0,
      secondaryCount: regressionSummary.regression_hash_count ?? 0,
      attentionCount: regressionSummary.failed_regression_case_count ?? 0,
      blockedCount: 0,
      reviewRequiredCount: regressionSummary.human_review_required_case_count ?? 0,
      validationErrorCount: sourceValidationErrors(sources.evidenceRegressionTests),
      routes: ["/api/evidence-regression-tests", "/api/evidence-regression-test-cases", "/api/evidence-regression-hashes"],
      message: `${regressionSummary.regression_test_case_count ?? 0} regression case(s), ${regressionSummary.locked_regression_hash_count ?? 0} locked hash(es).`,
      generatedAt,
      metrics: {
        passed_regression_case_count: regressionSummary.passed_regression_case_count ?? 0,
        external_service_used_case_count: regressionSummary.external_service_used_case_count ?? 0,
        client_facing_ready_case_count: regressionSummary.client_facing_ready_case_count ?? 0,
      },
    }),
  ].sort(by("panel_id"));
}

function panelRow({
  panelId,
  panelType,
  label,
  sourceArtifactId,
  sourceStatus,
  primaryCount,
  secondaryCount,
  attentionCount,
  blockedCount,
  reviewRequiredCount,
  validationErrorCount,
  routes,
  message,
  generatedAt,
  metrics,
}) {
  const status = validationErrorCount > 0 || sourceStatus === "failed"
    ? "attention"
    : "ready";
  return {
    schema_version: PANEL_SCHEMA_VERSION,
    panel_id: panelId,
    panel_type: panelType,
    label,
    source_artifact_id: sourceArtifactId,
    source_status: sourceStatus,
    panel_status: status,
    primary_count: primaryCount,
    secondary_count: secondaryCount,
    attention_count: attentionCount,
    blocked_count: blockedCount,
    review_required_count: reviewRequiredCount,
    validation_error_count: validationErrorCount,
    route_refs: routes,
    message,
    generated_at: generatedAt,
    metrics,
  };
}

function buildMatterRollups(sources, generatedAt) {
  const rollups = new Map();
  for (const resource of sources.resourceIngest.resource_evidence?.resources ?? []) {
    incrementRollup(rollups, resource.matter_id, "resource_count", resource.classification);
  }
  for (const item of sources.resourceQuarantineModel.quarantine_catalog?.quarantine_items ?? []) {
    const rollup = incrementRollup(rollups, item.matter_id, "quarantine_item_count", item.data_classification);
    if (item.human_review_required) rollup.pending_review_count += 1;
    if (!item.retrieval_allowed) rollup.retrieval_blocked_count += 1;
    if (!item.output_delivery_allowed) rollup.delivery_blocked_count += 1;
  }
  for (const evidence of sources.evidenceItemStore.evidence_item_catalog?.evidence_items ?? []) {
    const rollup = incrementRollup(rollups, evidence.matter_id, "evidence_item_count", evidence.classification);
    if (evidence.review_status === "needs_review") rollup.pending_review_count += 1;
  }
  for (const score of sources.evidenceCoverage.evidence_coverage_catalog?.coverage_scores ?? []) {
    const rollup = incrementRollup(rollups, score.matter_id, "coverage_score_count", score.classification);
    if (score.review_status === "needs_review") rollup.pending_review_count += 1;
    if (score.client_facing_ready) rollup.client_facing_ready_count += 1;
  }
  for (const bundle of sources.evidenceExportBundle.evidence_export_catalog?.export_bundles ?? []) {
    const rollup = incrementRollup(rollups, bundle.matter_id, "export_bundle_count", bundle.classification);
    if (bundle.review_gate?.attorney_review_required) rollup.pending_review_count += 1;
    if (!bundle.bundle_actions?.output_delivery_allowed) rollup.delivery_blocked_count += 1;
    if (bundle.client_facing_ready) rollup.client_facing_ready_count += 1;
  }
  return [...rollups.values()].map((rollup) => ({
    schema_version: MATTER_ROLLUP_SCHEMA_VERSION,
    matter_id: rollup.rollup_id,
    primary_classification: mostCommon(rollup.classifications),
    resource_count: rollup.resource_count,
    quarantine_item_count: rollup.quarantine_item_count,
    evidence_item_count: rollup.evidence_item_count,
    coverage_score_count: rollup.coverage_score_count,
    export_bundle_count: rollup.export_bundle_count,
    pending_review_count: rollup.pending_review_count,
    retrieval_blocked_count: rollup.retrieval_blocked_count,
    delivery_blocked_count: rollup.delivery_blocked_count,
    client_facing_ready_count: rollup.client_facing_ready_count,
    rollup_status: rollup.pending_review_count > 0 ? "review_required" : "ready",
    generated_at: generatedAt,
  })).sort(by("matter_id"));
}

function buildClassificationRollups(sources, generatedAt) {
  const rollups = new Map();
  for (const resource of sources.resourceIngest.resource_evidence?.resources ?? []) {
    incrementRollup(rollups, resource.classification, "resource_count", resource.classification);
  }
  for (const item of sources.resourceQuarantineModel.quarantine_catalog?.quarantine_items ?? []) {
    const rollup = incrementRollup(rollups, item.data_classification, "quarantine_item_count", item.data_classification);
    if (item.human_review_required) rollup.pending_review_count += 1;
    if (!item.retrieval_allowed) rollup.retrieval_blocked_count += 1;
    if (!item.output_delivery_allowed) rollup.delivery_blocked_count += 1;
  }
  for (const evidence of sources.evidenceItemStore.evidence_item_catalog?.evidence_items ?? []) {
    const rollup = incrementRollup(rollups, evidence.classification, "evidence_item_count", evidence.classification);
    if (evidence.review_status === "needs_review") rollup.pending_review_count += 1;
  }
  for (const score of sources.evidenceCoverage.evidence_coverage_catalog?.coverage_scores ?? []) {
    const rollup = incrementRollup(rollups, score.classification, "coverage_score_count", score.classification);
    if (score.review_status === "needs_review") rollup.pending_review_count += 1;
    if (score.client_facing_ready) rollup.client_facing_ready_count += 1;
  }
  for (const bundle of sources.evidenceExportBundle.evidence_export_catalog?.export_bundles ?? []) {
    const rollup = incrementRollup(rollups, bundle.classification, "export_bundle_count", bundle.classification);
    if (bundle.review_gate?.attorney_review_required) rollup.pending_review_count += 1;
    if (!bundle.bundle_actions?.output_delivery_allowed) rollup.delivery_blocked_count += 1;
    if (bundle.client_facing_ready) rollup.client_facing_ready_count += 1;
  }
  return [...rollups.values()].map((rollup) => ({
    schema_version: CLASSIFICATION_ROLLUP_SCHEMA_VERSION,
    classification: rollup.rollup_id,
    resource_count: rollup.resource_count,
    quarantine_item_count: rollup.quarantine_item_count,
    evidence_item_count: rollup.evidence_item_count,
    coverage_score_count: rollup.coverage_score_count,
    export_bundle_count: rollup.export_bundle_count,
    pending_review_count: rollup.pending_review_count,
    retrieval_blocked_count: rollup.retrieval_blocked_count,
    delivery_blocked_count: rollup.delivery_blocked_count,
    client_facing_ready_count: rollup.client_facing_ready_count,
    rollup_status: rollup.pending_review_count > 0 ? "review_required" : "ready",
    generated_at: generatedAt,
  })).sort(by("classification"));
}

function incrementRollup(rollups, id, field, classification) {
  const rollupId = id ?? "unknown";
  if (!rollups.has(rollupId)) {
    rollups.set(rollupId, {
      rollup_id: rollupId,
      classifications: [],
      resource_count: 0,
      quarantine_item_count: 0,
      evidence_item_count: 0,
      coverage_score_count: 0,
      export_bundle_count: 0,
      pending_review_count: 0,
      retrieval_blocked_count: 0,
      delivery_blocked_count: 0,
      client_facing_ready_count: 0,
    });
  }
  const rollup = rollups.get(rollupId);
  rollup[field] += 1;
  if (classification) rollup.classifications.push(classification);
  return rollup;
}

function validateResourceEvidenceDashboardSummary({ sources, panelRows, matterRollups, classificationRollups, packageText, roadmapText }) {
  const items = [];
  const ingestSummary = sources.resourceIngest.summary ?? {};
  const storeSummary = sources.resourceStoreInterface.summary ?? {};
  const quarantineSummary = sources.resourceQuarantineModel.summary ?? {};
  const evidenceSummary = sources.evidenceItemStore.summary ?? {};
  const viewerSummary = sources.evidenceViewerDataApi.summary ?? {};
  const coverageSummary = sources.evidenceCoverage.summary ?? {};
  const exportSummary = sources.evidenceExportBundle.summary ?? {};
  const regressionSummary = sources.evidenceRegressionTests.summary ?? {};
  pushCheck(items, "package_json", "resource_evidence_dashboard_script_registered", String(packageText).includes("\"resource:evidence-dashboard\""), "package.json must expose npm run resource:evidence-dashboard.");
  pushCheck(items, "roadmap", "phase_157_documented", String(roadmapText).includes("## Phase 157: Resource/Evidence Dashboard Summary"), "Roadmap must document Phase 157.");
  pushCheck(items, "source.resource_ingest", "source_complete", ["passed", "blocked"].includes(ingestSummary.gate_status), "Resource ingest must produce a passed or policy-blocked gate status.");
  pushCheck(items, "source.resource_store_interface", "source_complete", storeSummary.resource_store_interface_status === "complete", "Resource Store Interface must be complete.");
  pushCheck(items, "source.resource_quarantine_model", "source_complete", quarantineSummary.resource_quarantine_status === "complete", "Resource Quarantine Model must be complete.");
  pushCheck(items, "source.evidence_item_store", "source_complete", evidenceSummary.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(items, "source.evidence_viewer_data_api", "source_complete", viewerSummary.evidence_viewer_data_status === "complete", "Evidence Viewer Data API must be complete.");
  pushCheck(items, "source.evidence_coverage_score", "source_complete", coverageSummary.evidence_coverage_status === "complete", "Evidence Coverage Score must be complete.");
  pushCheck(items, "source.evidence_export_bundle", "source_complete", exportSummary.evidence_export_bundle_status === "complete", "Evidence Export Bundle must be complete.");
  pushCheck(items, "source.evidence_regression_tests", "source_complete", regressionSummary.evidence_regression_status === "complete", "Evidence Regression Tests must be complete.");
  pushCheck(items, "catalog.panel_rows", "required_panels_present", panelRows.length >= 8, "Dashboard summary must expose ingest, store, quarantine, evidence, viewer, coverage, export, and regression panels.");
  pushCheck(items, "catalog.matter_rollups", "matter_rollups_present", matterRollups.length > 0, "Dashboard summary must expose matter rollups.");
  pushCheck(items, "catalog.classification_rollups", "classification_rollups_present", classificationRollups.length > 0, "Dashboard summary must expose classification rollups.");
  pushCheck(items, "resource_counts", "ingest_store_count_match", (ingestSummary.promoted_resource_count ?? 0) === (storeSummary.resource_store_record_count ?? -1), "Promoted resources must match Resource Store records.");
  pushCheck(items, "resource_counts", "quarantine_source_scope_present", (quarantineSummary.source_expansion_item_count ?? 0) > 0, "Quarantine panel must retain source expansion scope.");
  pushCheck(items, "resource_counts", "quarantine_review_queue_count_match", (quarantineSummary.quarantine_item_count ?? 0) === (quarantineSummary.review_queue_item_count ?? -1), "Every quarantine item must appear in the review queue.");
  pushCheck(items, "evidence_counts", "evidence_coverage_count_match", (evidenceSummary.evidence_item_count ?? 0) === (coverageSummary.coverage_score_count ?? -1), "Evidence item count must match coverage score count.");
  pushCheck(items, "evidence_counts", "coverage_export_count_match", (coverageSummary.coverage_score_count ?? 0) === (exportSummary.export_bundle_count ?? -1), "Coverage score count must match export bundle count.");
  pushCheck(items, "evidence_counts", "coverage_regression_count_match", (coverageSummary.coverage_score_count ?? 0) === (regressionSummary.coverage_regression_case_count ?? -1), "Coverage score count must match coverage regression case count.");
  pushCheck(items, "review_boundary", "quarantine_blocks_retrieval", (quarantineSummary.retrieval_blocked_count ?? 0) === (quarantineSummary.quarantine_item_count ?? -1), "Every quarantine item must block retrieval.");
  pushCheck(items, "review_boundary", "quarantine_blocks_delivery", (quarantineSummary.output_delivery_blocked_count ?? 0) === (quarantineSummary.quarantine_item_count ?? -1), "Every quarantine item must block output delivery.");
  pushCheck(items, "review_boundary", "evidence_requires_review", (evidenceSummary.needs_review_count ?? 0) === (evidenceSummary.evidence_item_count ?? -1), "Every machine-generated evidence item must require review.");
  pushCheck(items, "review_boundary", "coverage_requires_review", (coverageSummary.needs_review_score_count ?? 0) === (coverageSummary.coverage_score_count ?? -1), "Every coverage score must require review.");
  pushCheck(items, "review_boundary", "export_blocks_delivery", (exportSummary.delivery_blocked_bundle_count ?? 0) === (exportSummary.export_bundle_count ?? -1), "Every export bundle must block delivery.");
  pushCheck(items, "review_boundary", "no_client_facing_ready_output", (coverageSummary.client_facing_ready_score_count ?? 1) === 0 && (exportSummary.client_facing_ready_bundle_count ?? 1) === 0 && (regressionSummary.client_facing_ready_case_count ?? 1) === 0, "Dashboard summary must not mark client-facing output ready.");
  pushCheck(items, "review_boundary", "no_external_service_regression", (regressionSummary.external_service_used_case_count ?? 1) === 0, "Regression dashboard source must remain local deterministic.");
  pushCheck(items, "contract.api_routes", "api_routes_declared", buildResourceEvidenceDashboardContract(new Date().toISOString()).api_routes.length === 5, "Dashboard contract must declare read-only API routes.");
  pushCheck(items, "source_validations", "no_source_validation_errors", totalSourceValidationErrors(sources) === 0, "Source artifacts must have zero validation errors.");
  return items;
}

function summarizeResourceEvidenceDashboardSummary({ sources, panelRows, matterRollups, classificationRollups, validationItems, validation }) {
  const ingestSummary = sources.resourceIngest.summary ?? {};
  const storeSummary = sources.resourceStoreInterface.summary ?? {};
  const quarantineSummary = sources.resourceQuarantineModel.summary ?? {};
  const evidenceSummary = sources.evidenceItemStore.summary ?? {};
  const viewerSummary = sources.evidenceViewerDataApi.summary ?? {};
  const coverageSummary = sources.evidenceCoverage.summary ?? {};
  const exportSummary = sources.evidenceExportBundle.summary ?? {};
  const regressionSummary = sources.evidenceRegressionTests.summary ?? {};
  return {
    resource_evidence_dashboard_status: validation.valid ? "complete" : "blocked",
    resource_evidence_dashboard_contract_id: RESOURCE_EVIDENCE_DASHBOARD_CONTRACT_ID,
    resource_ingest_status: ingestSummary.gate_status ?? "unknown",
    resource_store_interface_status: storeSummary.resource_store_interface_status ?? "unknown",
    resource_quarantine_status: quarantineSummary.resource_quarantine_status ?? "unknown",
    evidence_item_store_status: evidenceSummary.evidence_item_store_status ?? "unknown",
    evidence_viewer_data_status: viewerSummary.evidence_viewer_data_status ?? "unknown",
    evidence_coverage_status: coverageSummary.evidence_coverage_status ?? "unknown",
    evidence_export_bundle_status: exportSummary.evidence_export_bundle_status ?? "unknown",
    evidence_regression_status: regressionSummary.evidence_regression_status ?? "unknown",
    panel_row_count: panelRows.length,
    ready_panel_count: panelRows.filter((row) => row.panel_status === "ready").length,
    attention_panel_count: panelRows.filter((row) => row.panel_status === "attention").length,
    matter_rollup_count: matterRollups.length,
    classification_rollup_count: classificationRollups.length,
    source_item_count: ingestSummary.source_item_count ?? 0,
    promoted_resource_count: ingestSummary.promoted_resource_count ?? 0,
    promoted_evidence_count: ingestSummary.promoted_evidence_count ?? 0,
    resource_store_record_count: storeSummary.resource_store_record_count ?? 0,
    quarantine_item_count: quarantineSummary.quarantine_item_count ?? 0,
    quarantine_pending_human_review_count: quarantineSummary.pending_human_review_count ?? 0,
    quarantine_retrieval_blocked_count: quarantineSummary.retrieval_blocked_count ?? 0,
    quarantine_external_transfer_blocked_count: quarantineSummary.external_transfer_blocked_count ?? 0,
    quarantine_output_delivery_blocked_count: quarantineSummary.output_delivery_blocked_count ?? 0,
    evidence_item_count: evidenceSummary.evidence_item_count ?? 0,
    evidence_needs_review_count: evidenceSummary.needs_review_count ?? 0,
    viewer_card_count: viewerSummary.viewer_card_count ?? 0,
    coverage_score_count: coverageSummary.coverage_score_count ?? 0,
    coverage_dimension_count: coverageSummary.coverage_dimension_count ?? 0,
    missing_required_dimension_count: coverageSummary.missing_required_dimension_count ?? 0,
    full_coverage_score_count: coverageSummary.full_coverage_score_count ?? 0,
    partial_coverage_score_count: coverageSummary.partial_coverage_score_count ?? 0,
    average_coverage_score: coverageSummary.average_coverage_score ?? 0,
    export_bundle_count: exportSummary.export_bundle_count ?? 0,
    export_delivery_blocked_bundle_count: exportSummary.delivery_blocked_bundle_count ?? 0,
    export_external_transfer_blocked_bundle_count: exportSummary.external_transfer_blocked_bundle_count ?? 0,
    export_client_facing_ready_bundle_count: exportSummary.client_facing_ready_bundle_count ?? 0,
    regression_test_case_count: regressionSummary.regression_test_case_count ?? 0,
    regression_failed_case_count: regressionSummary.failed_regression_case_count ?? 0,
    regression_hash_count: regressionSummary.regression_hash_count ?? 0,
    regression_external_service_used_case_count: regressionSummary.external_service_used_case_count ?? 0,
    client_facing_ready_count: (coverageSummary.client_facing_ready_score_count ?? 0) + (exportSummary.client_facing_ready_bundle_count ?? 0) + (regressionSummary.client_facing_ready_case_count ?? 0),
    source_validation_error_count: totalSourceValidationErrors(sources),
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: Object.fromEntries(matterRollups.map((rollup) => [rollup.matter_id, rollup.evidence_item_count])),
    by_classification: Object.fromEntries(classificationRollups.map((rollup) => [rollup.classification, rollup.evidence_item_count])),
  };
}

function renderResourceEvidenceDashboardSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Resource/Evidence Dashboard Summary");
  lines.push("");
  lines.push(`Status: ${result.summary.resource_evidence_dashboard_status}`);
  lines.push(`Contract: ${result.summary.resource_evidence_dashboard_contract_id}`);
  lines.push(`Panels: ${result.summary.panel_row_count}`);
  lines.push(`Matter rollups: ${result.summary.matter_rollup_count}`);
  lines.push(`Classification rollups: ${result.summary.classification_rollup_count}`);
  lines.push("");
  lines.push("## Panels");
  for (const row of result.resource_evidence_dashboard_catalog.panel_rows) {
    lines.push(`- ${row.label}: ${row.primary_count} primary, ${row.attention_count} attention, ${row.review_required_count} review required (${row.panel_status})`);
  }
  lines.push("");
  lines.push("## Guardrails");
  lines.push(`- Client-facing ready count: ${result.summary.client_facing_ready_count}`);
  lines.push(`- Source validation errors: ${result.summary.source_validation_error_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  return `${lines.join("\n")}\n`;
}

function sourceStatus(artifact, key) {
  return {
    schema_version: artifact.schema_version ?? null,
    status: artifact.summary?.[key] ?? "unknown",
    validation_error_count: sourceValidationErrors(artifact),
    generated_at: artifact.generated_at ?? null,
  };
}

function sourceValidationErrors(artifact) {
  return artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0;
}

function totalSourceValidationErrors(sources) {
  return Object.values(sources).reduce((total, artifact) => total + sourceValidationErrors(artifact), 0);
}

function pushCheck(items, subjectId, checkId, passed, message) {
  items.push({
    validation_item_id: `resource-evidence-dashboard.${slugify(subjectId)}.${checkId}`,
    path: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function serializableResourceEvidenceDashboardSummary(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--resource-quarantine") parsed.resourceQuarantineModelPath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--evidence-coverage") parsed.evidenceCoveragePath = argv[++index];
    else if (arg === "--evidence-viewer-data-api") parsed.evidenceViewerDataApiPath = argv[++index];
    else if (arg === "--evidence-export-bundle") parsed.evidenceExportBundlePath = argv[++index];
    else if (arg === "--evidence-regression-tests") parsed.evidenceRegressionTestsPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: node scripts/resource-evidence-dashboard-summary.mjs [options]

Options:
  --check                              Exit non-zero when validation fails.
  --out-dir <path>                     Output directory.
  --resource-ingest <path>             resource-ingest.json path.
  --resource-store-interface <path>    resource-store-interface.json path.
  --resource-quarantine <path>         resource-quarantine-model.json path.
  --evidence-item-store <path>         evidence-item-store.json path.
  --evidence-coverage <path>           evidence-coverage-score.json path.
  --evidence-viewer-data-api <path>    evidence-viewer-data-api.json path.
  --evidence-export-bundle <path>      evidence-export-bundle.json path.
  --evidence-regression-tests <path>   evidence-regression-tests.json path.
  --run-at <iso>                       Override generated_at.
  --help                               Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.resourceIngestPath),
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.resourceStoreInterfacePath),
    resource_quarantine_model_path: path.resolve(options.resourceQuarantineModelPath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.resourceQuarantineModelPath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.evidenceItemStorePath),
    evidence_coverage_path: path.resolve(options.evidenceCoveragePath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.evidenceCoveragePath),
    evidence_viewer_data_api_path: path.resolve(options.evidenceViewerDataApiPath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.evidenceViewerDataApiPath),
    evidence_export_bundle_path: path.resolve(options.evidenceExportBundlePath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.evidenceExportBundlePath),
    evidence_regression_tests_path: path.resolve(options.evidenceRegressionTestsPath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.evidenceRegressionTestsPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_RESOURCE_EVIDENCE_DASHBOARD_SUMMARY_INPUTS.roadmapPath),
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

function mostCommon(values) {
  const counts = values.reduce((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  return Object.entries(counts).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0] ?? null;
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
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
