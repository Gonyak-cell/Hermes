import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXTRACTOR_COVERAGE_REPORT_OUT_DIR = "artifacts/extractor-coverage-report/latest";
export const DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  expansionQuarantineLedgerPath: "artifacts/expansion-quarantine-ledger/latest/expansion-quarantine-ledger.json",
  batchClassificationResultPath: "artifacts/batch-classification-result/latest/batch-classification-result.json",
  extractorRegistryPath: "artifacts/extractor-registry/latest/extractor-registry.json",
};

const REPORT_SCHEMA_VERSION = "extractor-coverage-report.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.extractor_coverage_report";
const PHASE_SLOT = "P284";
const PREVIOUS_PHASE_SLOT = "P283";
const NEXT_PHASE_SLOT = "P285";
const HUMAN_REVIEW_NOTE = "Extractor Coverage Report is a read-only coverage aggregation. It does not execute extractors, read source file contents, run OCR, mutate resources or state, deliver output, produce legal advice, or create client-facing output.";

export async function runExtractorCoverageReport(options = {}) {
  const result = await buildExtractorCoverageReport(options);
  if (options.write !== false) await writeExtractorCoverageReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Extractor coverage report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExtractorCoverageReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const expansionQuarantineLedgerRead = await readJsonOrError(inputs.expansion_quarantine_ledger_path);
  const batchClassificationRead = await readJsonOrError(inputs.batch_classification_result_path);
  const extractorRegistryRead = await readJsonOrError(inputs.extractor_registry_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const expansionQuarantineLedger = expansionQuarantineLedgerRead.value ?? {};
  const batchClassificationResult = batchClassificationRead.value ?? {};
  const extractorRegistry = extractorRegistryRead.value ?? {};

  const coverageItemRows = buildCoverageItemRows({
    resourceExpansion,
    expansionQuarantineLedger,
    batchClassificationResult,
    extractorRegistry,
    generatedAt,
  });
  const documentTypeCoverageRows = buildDocumentTypeCoverageRows(coverageItemRows, generatedAt);
  const extensionCoverageRows = buildExtensionCoverageRows(coverageItemRows, generatedAt);
  const statusCoverageRows = buildStatusCoverageRows(coverageItemRows, generatedAt);
  const unsupportedTypeRows = buildUnsupportedTypeRows(coverageItemRows, generatedAt);
  const extractorFailureRows = buildExtractorFailureRows(coverageItemRows, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionQuarantineLedgerRead,
    batchClassificationRead,
    extractorRegistryRead,
    resourceExpansion,
    expansionQuarantineLedger,
    batchClassificationResult,
    extractorRegistry,
    coverageItemRows,
    documentTypeCoverageRows,
    extensionCoverageRows,
    statusCoverageRows,
    unsupportedTypeRows,
    extractorFailureRows,
    boundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeExtractorCoverageReport({
    resourceExpansion,
    expansionQuarantineLedger,
    batchClassificationResult,
    extractorRegistry,
    coverageItemRows,
    documentTypeCoverageRows,
    extensionCoverageRows,
    statusCoverageRows,
    unsupportedTypeRows,
    extractorFailureRows,
    boundary,
    validation,
  });
  const result = {
    schema_version: REPORT_SCHEMA_VERSION,
    generated_at: generatedAt,
    extractor_coverage_report_id: `extractor-coverage-report.${dateStamp(generatedAt)}`,
    extractor_coverage_report_status: summary.extractor_coverage_report_status,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      resourceExpansionRead,
      expansionQuarantineLedgerRead,
      batchClassificationRead,
      extractorRegistryRead,
    }),
    extractor_coverage_contract: buildContract(generatedAt, coverageItemRows),
    extractor_coverage_item_rows: coverageItemRows,
    document_type_coverage_rows: documentTypeCoverageRows,
    extension_coverage_rows: extensionCoverageRows,
    status_coverage_rows: statusCoverageRows,
    unsupported_type_rows: unsupportedTypeRows,
    extractor_failure_rows: extractorFailureRows,
    extractor_coverage_boundary: boundary,
    extractor_coverage_checks: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderExtractorCoverageMarkdown(result),
  };
}

export async function writeExtractorCoverageReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "extractor-coverage-report.json"), serializableExtractorCoverageReport(result));
  await writeJson(path.join(outDir, "extractor-coverage-item-rows.json"), {
    schema_version: "extractor-coverage-item-rows.v1",
    generated_at: result.generated_at,
    coverage_item_row_count: result.extractor_coverage_item_rows.length,
    extractor_coverage_item_rows: result.extractor_coverage_item_rows,
  });
  await writeJson(path.join(outDir, "document-type-coverage-rows.json"), {
    schema_version: "document-type-coverage-rows.v1",
    generated_at: result.generated_at,
    document_type_coverage_row_count: result.document_type_coverage_rows.length,
    document_type_coverage_rows: result.document_type_coverage_rows,
  });
  await writeJson(path.join(outDir, "extension-coverage-rows.json"), {
    schema_version: "extension-coverage-rows.v1",
    generated_at: result.generated_at,
    extension_coverage_row_count: result.extension_coverage_rows.length,
    extension_coverage_rows: result.extension_coverage_rows,
  });
  await writeJson(path.join(outDir, "status-coverage-rows.json"), {
    schema_version: "status-coverage-rows.v1",
    generated_at: result.generated_at,
    status_coverage_row_count: result.status_coverage_rows.length,
    status_coverage_rows: result.status_coverage_rows,
  });
  await writeJson(path.join(outDir, "unsupported-type-rows.json"), {
    schema_version: "unsupported-type-rows.v1",
    generated_at: result.generated_at,
    unsupported_type_row_count: result.unsupported_type_rows.length,
    unsupported_type_rows: result.unsupported_type_rows,
  });
  await writeJson(path.join(outDir, "extractor-failure-rows.json"), {
    schema_version: "extractor-failure-rows.v1",
    generated_at: result.generated_at,
    extractor_failure_row_count: result.extractor_failure_rows.length,
    extractor_failure_rows: result.extractor_failure_rows,
  });
  await writeJson(path.join(outDir, "extractor-coverage-checks.json"), {
    schema_version: "extractor-coverage-checks.v1",
    generated_at: result.generated_at,
    check_count: result.extractor_coverage_checks.length,
    extractor_coverage_checks: result.extractor_coverage_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "extractor-coverage-validation-report.v1",
    generated_at: result.generated_at,
    extractor_coverage_report_id: result.extractor_coverage_report_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runExtractorCoverageReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExtractorCoverageReport(args);
    console.log(`Extractor coverage report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.extractor_coverage_report_status}`);
    console.log(`Coverage rows: ${result.summary.coverage_item_row_count}`);
    console.log(`Processed rate: ${result.summary.processing_rate}`);
    console.log(`Failure rate: ${result.summary.failure_rate}`);
    console.log(`Unsupported rate: ${result.summary.unsupported_rate}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCoverageItemRows({
  resourceExpansion,
  expansionQuarantineLedger,
  batchClassificationResult,
  extractorRegistry,
  generatedAt,
}) {
  const compatibilityByResourceId = new Map((extractorRegistry.extractor_compatibility_rows ?? []).map((row) => [row.resource_id, row]));
  const classificationByResourceId = new Map((batchClassificationResult.batch_classification_rows ?? []).map((row) => [row.resource_id, row]));
  const quarantineByResourceId = new Map((expansionQuarantineLedger.quarantine_decision_rows ?? []).map((row) => [row.resource_id, row]));
  return (resourceExpansion.items ?? []).map((item, index) => {
    const compatibilityRow = compatibilityByResourceId.get(item.resource_id) ?? {};
    const classificationRow = classificationByResourceId.get(item.resource_id) ?? {};
    const quarantineRow = quarantineByResourceId.get(item.resource_id) ?? {};
    const extension = normalizeExtension(classificationRow.extension ?? compatibilityRow.extension ?? item.extension);
    const itemStatus = classificationRow.item_status ?? compatibilityRow.item_status ?? item.status ?? "unknown";
    const processed = isProcessedStatus(itemStatus);
    const failed = isFailureStatus(itemStatus) || quarantineRow.quarantine_category === "extraction_failure";
    const quarantined = itemStatus === "quarantined" || quarantineRow.hold_status === "held";
    const unsupported = isUnsupportedType({ item, compatibilityRow, quarantineRow, extension });
    const coverageMissing = !compatibilityRow.extractor_compatibility_row_id;
    const covered = !coverageMissing && compatibilityRow.compatibility_status === "compatible_pending_human_review";
    const coverageStatus = coverageMissing
      ? "attention"
      : failed || quarantined || unsupported
        ? "covered_with_human_review_holds"
        : "covered_pending_human_review";
    return {
      extractor_coverage_item_row_id: `extractor-coverage-item-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: item.item_id ?? compatibilityRow.item_id ?? classificationRow.item_id ?? null,
      resource_id: item.resource_id ?? compatibilityRow.resource_id ?? classificationRow.resource_id ?? null,
      resource_version_id: item.resource_version_id ?? compatibilityRow.resource_version_id ?? classificationRow.resource_version_id ?? null,
      relative_path: item.relative_path ?? compatibilityRow.relative_path ?? classificationRow.relative_path ?? null,
      extension,
      resource_type: classificationRow.resource_type ?? compatibilityRow.resource_type ?? item.resource_type ?? "unknown",
      document_type: compatibilityRow.document_type ?? classificationRow.resource_type ?? item.resource_type ?? "unknown",
      item_status: itemStatus,
      data_classification: classificationRow.data_classification ?? compatibilityRow.data_classification ?? item.data_classification ?? "unknown",
      extractor_compatibility_row_id: compatibilityRow.extractor_compatibility_row_id ?? null,
      extractor_registry_entry_id: compatibilityRow.extractor_registry_entry_id ?? null,
      selected_extractor_id: compatibilityRow.selected_extractor_id ?? null,
      selected_adapter_id: compatibilityRow.selected_adapter_id ?? null,
      selected_extractor_family: compatibilityRow.selected_extractor_family ?? item.extractor_family ?? "unknown",
      batch_classification_row_id: classificationRow.batch_classification_row_id ?? compatibilityRow.batch_classification_row_id ?? null,
      quarantine_decision_row_id: quarantineRow.quarantine_decision_row_id ?? null,
      quarantine_category: quarantineRow.quarantine_category ?? (quarantined ? "unknown_hold" : "none"),
      quarantine_reason: quarantineRow.quarantine_reason ?? item.quarantine_reason ?? null,
      processing_status: processed ? "processed" : "pending",
      coverage_status: coverageStatus,
      failure_status: failed ? "failed" : quarantined ? "held_for_human_review" : "passed",
      unsupported_type_status: unsupported ? "unsupported_or_unknown_type" : "supported_or_reviewable",
      compatibility_status: compatibilityRow.compatibility_status ?? "missing",
      compatibility_basis: compatibilityRow.compatibility_basis ?? "missing_compatibility_row",
      supported_extension_match: compatibilityRow.supported_extension_match === true,
      fallback_registry_entry_used: compatibilityRow.fallback_registry_entry_used === true,
      processing_rate_basis: "terminal_status_from_resource_expansion",
      failure_rate_basis: "failed_status_or_extraction_failure_quarantine_category",
      unsupported_rate_basis: "unsupported_unknown_quarantine_or_missing_registry_extension",
      processed,
      failed,
      quarantined,
      unsupported,
      covered,
      coverage_missing: coverageMissing,
      local_only: compatibilityRow.local_only !== false,
      external_service_allowed: compatibilityRow.external_service_allowed === true,
      network_access_allowed: compatibilityRow.network_access_allowed === true,
      extractor_execution_performed: false,
      file_content_read_performed: false,
      ocr_execution_performed: false,
      external_model_used: false,
      matter_data_write_performed: false,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
      reason_codes: unique([
        processed ? "terminal_or_processed_status" : "pending_status",
        covered ? "extractor_registry_compatibility_linked" : "extractor_registry_compatibility_missing",
        compatibilityRow.supported_extension_match ? "supported_extension_match" : null,
        compatibilityRow.fallback_registry_entry_used ? "fallback_registry_entry_used" : null,
        failed ? "failure_accounted" : null,
        quarantined ? "quarantine_hold_accounted" : null,
        unsupported ? "unsupported_or_unknown_type_accounted" : null,
        "human_review_required",
      ]),
    };
  }).sort(by("extractor_coverage_item_row_id"));
}

function buildDocumentTypeCoverageRows(itemRows, generatedAt) {
  return groupedCoverageRows({
    rows: itemRows,
    groupKey: "document_type",
    rowIdKey: "document_type_coverage_row_id",
    rowIdPrefix: "document-type-coverage-row",
    groupValueKey: "document_type",
    generatedAt,
  });
}

function buildExtensionCoverageRows(itemRows, generatedAt) {
  return groupedCoverageRows({
    rows: itemRows,
    groupKey: "extension",
    rowIdKey: "extension_coverage_row_id",
    rowIdPrefix: "extension-coverage-row",
    groupValueKey: "extension",
    generatedAt,
  });
}

function buildStatusCoverageRows(itemRows, generatedAt) {
  return groupedCoverageRows({
    rows: itemRows,
    groupKey: "item_status",
    rowIdKey: "status_coverage_row_id",
    rowIdPrefix: "status-coverage-row",
    groupValueKey: "item_status",
    generatedAt,
  });
}

function groupedCoverageRows({ rows, groupKey, rowIdKey, rowIdPrefix, groupValueKey, generatedAt }) {
  return [...groupBy(rows, groupKey).entries()].map(([groupValue, groupRows], index) => {
    const summary = summarizeRows(groupRows);
    return {
      [rowIdKey]: `${rowIdPrefix}.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      [groupValueKey]: groupValue,
      resource_item_count: summary.total,
      processed_item_count: summary.processed,
      covered_item_count: summary.covered,
      failed_item_count: summary.failed,
      quarantined_item_count: summary.quarantined,
      unsupported_item_count: summary.unsupported,
      fallback_registry_entry_used_count: summary.fallback,
      coverage_missing_item_count: summary.coverageMissing,
      processing_rate: rate(summary.processed, summary.total),
      coverage_rate: rate(summary.covered, summary.total),
      failure_rate: rate(summary.failed, summary.total),
      quarantine_rate: rate(summary.quarantined, summary.total),
      unsupported_rate: rate(summary.unsupported, summary.total),
      coverage_status: coverageStatusForSummary(summary),
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    };
  }).sort(by(groupValueKey));
}

function buildUnsupportedTypeRows(itemRows, generatedAt) {
  const unsupportedRows = itemRows.filter((row) => row.unsupported);
  return [...groupBy(unsupportedRows, (row) => `${row.extension || "unknown"}|${row.resource_type || "unknown"}|${row.quarantine_category || "unknown"}`).entries()]
    .map(([key, rows], index) => {
      const [extension, resourceType, quarantineCategory] = key.split("|");
      return {
        unsupported_type_row_id: `unsupported-type-row.${String(index + 1).padStart(4, "0")}`,
        generated_at: generatedAt,
        extension,
        resource_type: resourceType,
        quarantine_category: quarantineCategory,
        unsupported_item_count: rows.length,
        resource_ids: unique(rows.map((row) => row.resource_id).filter(Boolean)),
        selected_extractor_ids: unique(rows.map((row) => row.selected_extractor_id).filter(Boolean)),
        unsupported_type_status: "unsupported_or_unknown_type",
        human_review_required: true,
        legal_advice_generated: false,
        client_facing_ready: false,
      };
    }).sort(by("extension", "resource_type", "quarantine_category"));
}

function buildExtractorFailureRows(itemRows, generatedAt) {
  return itemRows
    .filter((row) => row.failed || row.quarantined || row.coverage_missing)
    .map((row, index) => ({
      extractor_failure_row_id: `extractor-failure-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: row.item_id,
      resource_id: row.resource_id,
      resource_version_id: row.resource_version_id,
      relative_path: row.relative_path,
      extension: row.extension,
      document_type: row.document_type,
      item_status: row.item_status,
      failure_status: row.failure_status,
      coverage_status: row.coverage_status,
      quarantine_category: row.quarantine_category,
      quarantine_reason: row.quarantine_reason,
      extractor_compatibility_row_id: row.extractor_compatibility_row_id,
      selected_extractor_id: row.selected_extractor_id,
      retry_execution_performed: false,
      extractor_execution_performed: false,
      file_content_read_performed: false,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    })).sort(by("extractor_failure_row_id"));
}

function buildContract(generatedAt, coverageItemRows) {
  return {
    schema_version: "extractor-coverage-contract.v1",
    contract_id: REPORT_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    generated_at: generatedAt,
    coverage_rule: "Every Resource Expansion item receives a coverage item row linked to the P283 extractor registry compatibility result.",
    aggregation_rule: "Document type, extension, status, unsupported type, and failure/hold aggregates expose processing, coverage, failure, quarantine, and unsupported rates.",
    execution_rule: "This phase is report-only and performs no extractor/OCR execution, source file content reads, writes, delivery, protected action, legal advice, or client-facing output.",
    coverage_item_row_count: coverageItemRows.length,
    human_review_required: true,
    client_facing_output_allowed: false,
  };
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "extractor-coverage-report.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    source_artifact_read_performed: true,
    extractor_coverage_report_only: true,
    extractor_execution_performed: false,
    ocr_execution_performed: false,
    file_content_read_performed: false,
    external_model_used: false,
    external_service_called: false,
    network_access_performed: false,
    source_ingest_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    matter_data_write_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  controlPlaneLoopText,
  reviewDashboardText,
  reviewApiText,
  resourceExpansionRead,
  expansionQuarantineLedgerRead,
  batchClassificationRead,
  extractorRegistryRead,
  resourceExpansion,
  expansionQuarantineLedger,
  batchClassificationResult,
  extractorRegistry,
  coverageItemRows,
  documentTypeCoverageRows,
  extensionCoverageRows,
  statusCoverageRows,
  unsupportedTypeRows,
  extractorFailureRows,
  boundary,
}) {
  const resourceSummary = resourceExpansion.summary ?? {};
  const quarantineSummary = expansionQuarantineLedger.summary ?? {};
  const batchSummary = batchClassificationResult.summary ?? {};
  const registrySummary = extractorRegistry.summary ?? {};
  const rowSummary = summarizeRows(coverageItemRows);
  const itemCount = resourceExpansion.items?.length ?? 0;
  const unsupportedItemCount = coverageItemRows.filter((row) => row.unsupported).length;
  const failureOrHoldCount = coverageItemRows.filter((row) => row.failed || row.quarantined || row.coverage_missing).length;
  return [
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1" && itemCount > 0, "Resource Expansion Job is readable."),
    checkpoint("source.extractor_registry", extractorRegistryRead.available && registrySummary.extractor_registry_status === "complete" && registrySummary.phase_slot === "P283" && registrySummary.next_phase_slot === "P284", "P283 Extractor Registry is complete and points to P284."),
    checkpoint("source.expansion_quarantine_ledger", expansionQuarantineLedgerRead.available && quarantineSummary.expansion_quarantine_ledger_status === "complete" && quarantineSummary.phase_slot === "P280", "P280 Expansion Quarantine Ledger is complete."),
    checkpoint("source.batch_classification_result", batchClassificationRead.available && batchSummary.batch_classification_result_status === "complete" && batchSummary.phase_slot === "P281", "P281 Batch Classification Result is complete."),
    checkpoint("source.resource_terminality", (resourceSummary.terminal_count ?? 0) === itemCount && (resourceSummary.remaining_count ?? 0) === 0, "Resource Expansion has no remaining items for the current baseline."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:extractor-coverage"), "package.json exposes resource:extractor-coverage."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["extractor_coverage_report", "resource:extractor-coverage"]) && includesAll(reviewDashboardText.value, ["extractor_coverage_report", "buildExtractorCoverageReportStage"]) && includesAll(reviewApiText.value, ["/api/extractor-coverage-reports", "/api/extractor-coverage-document-types"]), "Control-plane loop, dashboard, and API expose Extractor Coverage Report."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P284", "extractor coverage report"]) && includesAll(implementationRoadmapText.value, ["Phase 284", "Extractor Coverage Report"]), "Ledger and implementation roadmap promote Phase 284."),
    checkpoint("coverage.item_rows", coverageItemRows.length === itemCount && coverageItemRows.length > 0, "Coverage item rows cover every Resource Expansion item."),
    checkpoint("coverage.compatibility_link", coverageItemRows.every((row) => row.extractor_compatibility_row_id && row.compatibility_status === "compatible_pending_human_review"), "Every coverage item row links to a P283 extractor compatibility row."),
    checkpoint("coverage.classification_link", coverageItemRows.every((row) => row.batch_classification_row_id), "Every coverage item row links to P281 classification."),
    checkpoint("coverage.quarantine_link", (expansionQuarantineLedger.quarantine_decision_rows?.length ?? 0) >= coverageItemRows.length, "P280 quarantine decisions cover the P284 rows."),
    checkpoint("coverage.document_type_rows", documentTypeCoverageRows.length > 0 && documentTypeCoverageRows.every(isAcceptableCoverageRow), "Document type coverage rows aggregate without missing coverage."),
    checkpoint("coverage.extension_rows", extensionCoverageRows.length > 0 && extensionCoverageRows.every(isAcceptableCoverageRow), "Extension coverage rows aggregate without missing coverage."),
    checkpoint("coverage.status_rows", statusCoverageRows.length > 0 && statusCoverageRows.every(isAcceptableCoverageRow), "Status coverage rows aggregate without missing coverage."),
    checkpoint("coverage.processing_rates", coverageItemRows.every((row) => row.processed) && allRatesBounded([...documentTypeCoverageRows, ...extensionCoverageRows, ...statusCoverageRows], "processing_rate"), "Processing rates are bounded and all baseline rows are processed."),
    checkpoint("coverage.coverage_rates", rowSummary.covered === coverageItemRows.length && allRatesBounded([...documentTypeCoverageRows, ...extensionCoverageRows, ...statusCoverageRows], "coverage_rate"), "Coverage rates are bounded and all rows are covered by the registry."),
    checkpoint("coverage.failure_rates", allRatesBounded([...documentTypeCoverageRows, ...extensionCoverageRows, ...statusCoverageRows], "failure_rate"), "Failure rates are bounded."),
    checkpoint("coverage.unsupported_rates", allRatesBounded([...documentTypeCoverageRows, ...extensionCoverageRows, ...statusCoverageRows], "unsupported_rate"), "Unsupported type rates are bounded."),
    checkpoint("coverage.counts_reconcile", rowSummary.total === rowSummary.processed && rowSummary.coverageMissing === 0 && rowSummary.failed <= rowSummary.total && rowSummary.unsupported <= rowSummary.total, "Coverage counts reconcile to source item count."),
    checkpoint("unsupported.aggregated", unsupportedTypeRows.reduce((sum, row) => sum + row.unsupported_item_count, 0) === unsupportedItemCount, "Unsupported type rows aggregate every unsupported item."),
    checkpoint("failure_hold.aggregated", extractorFailureRows.length === failureOrHoldCount, "Failure/hold rows account for every failed, quarantined, or missing-coverage item."),
    checkpoint("registry.local_only", coverageItemRows.every((row) => row.local_only === true && row.external_service_allowed === false && row.network_access_allowed === false), "Every coverage row inherits local-only registry posture."),
    checkpoint("registry.no_execution_counts", coverageItemRows.every((row) => row.extractor_execution_performed === false && row.file_content_read_performed === false && row.ocr_execution_performed === false && row.external_model_used === false), "Coverage rows do not perform extractor/OCR/file/model work."),
    checkpoint("boundary.no_execution", boundary.extractor_execution_performed === false && boundary.ocr_execution_performed === false && boundary.file_content_read_performed === false && boundary.external_model_used === false, "No extractor/OCR execution, file content read, or model use occurs."),
    checkpoint("boundary.no_external", boundary.external_service_called === false && boundary.network_access_performed === false, "No external service or network access occurs."),
    checkpoint("boundary.no_mutation_delivery", boundary.source_ingest_performed === false && boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.matter_data_write_performed === false && boundary.delivery_execution_performed === false, "No source/resource/state/matter mutation or delivery occurs."),
    checkpoint("boundary.no_legal_client", boundary.protected_action_executed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No protected action, legal advice, or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && registrySummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeExtractorCoverageReport({
  resourceExpansion,
  expansionQuarantineLedger,
  batchClassificationResult,
  extractorRegistry,
  coverageItemRows,
  documentTypeCoverageRows,
  extensionCoverageRows,
  statusCoverageRows,
  unsupportedTypeRows,
  extractorFailureRows,
  boundary,
  validation,
}) {
  const quarantineSummary = expansionQuarantineLedger.summary ?? {};
  const batchSummary = batchClassificationResult.summary ?? {};
  const registrySummary = extractorRegistry.summary ?? {};
  const rowSummary = summarizeRows(coverageItemRows);
  return {
    extractor_coverage_report_status: validation.valid ? "complete" : "attention",
    extractor_coverage_report_id: REPORT_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_source_id: resourceExpansion.source_id ?? null,
    source_expansion_quarantine_ledger_status: quarantineSummary.expansion_quarantine_ledger_status ?? "unknown",
    source_expansion_quarantine_phase_slot: quarantineSummary.phase_slot ?? null,
    source_batch_classification_result_status: batchSummary.batch_classification_result_status ?? "unknown",
    source_batch_classification_phase_slot: batchSummary.phase_slot ?? null,
    source_extractor_registry_status: registrySummary.extractor_registry_status ?? "unknown",
    source_extractor_registry_phase_slot: registrySummary.phase_slot ?? null,
    source_extractor_registry_next_phase_slot: registrySummary.next_phase_slot ?? null,
    source_extractor_registry_entry_count: registrySummary.extractor_registry_entry_count ?? 0,
    source_compatibility_row_count: registrySummary.compatibility_row_count ?? extractorRegistry.extractor_compatibility_rows?.length ?? 0,
    resource_item_count: resourceExpansion.items?.length ?? 0,
    coverage_item_row_count: coverageItemRows.length,
    processed_item_count: rowSummary.processed,
    covered_item_count: rowSummary.covered,
    failed_item_count: rowSummary.failed,
    quarantined_item_count: rowSummary.quarantined,
    unsupported_item_count: rowSummary.unsupported,
    fallback_registry_entry_used_count: rowSummary.fallback,
    coverage_missing_item_count: rowSummary.coverageMissing,
    processing_rate: rate(rowSummary.processed, rowSummary.total),
    coverage_rate: rate(rowSummary.covered, rowSummary.total),
    failure_rate: rate(rowSummary.failed, rowSummary.total),
    quarantine_rate: rate(rowSummary.quarantined, rowSummary.total),
    unsupported_rate: rate(rowSummary.unsupported, rowSummary.total),
    document_type_coverage_row_count: documentTypeCoverageRows.length,
    passed_document_type_coverage_row_count: documentTypeCoverageRows.filter(isAcceptableCoverageRow).length,
    extension_coverage_row_count: extensionCoverageRows.length,
    passed_extension_coverage_row_count: extensionCoverageRows.filter(isAcceptableCoverageRow).length,
    status_coverage_row_count: statusCoverageRows.length,
    passed_status_coverage_row_count: statusCoverageRows.filter(isAcceptableCoverageRow).length,
    unsupported_type_row_count: unsupportedTypeRows.length,
    extractor_failure_row_count: extractorFailureRows.length,
    human_review_required_count: coverageItemRows.filter((row) => row.human_review_required).length,
    client_facing_ready_count: coverageItemRows.filter((row) => row.client_facing_ready).length,
    extractor_execution_count: coverageItemRows.filter((row) => row.extractor_execution_performed).length,
    file_content_read_count: coverageItemRows.filter((row) => row.file_content_read_performed).length,
    ocr_execution_count: coverageItemRows.filter((row) => row.ocr_execution_performed).length,
    external_model_used_count: coverageItemRows.filter((row) => row.external_model_used).length,
    matter_data_write_performed_count: coverageItemRows.filter((row) => row.matter_data_write_performed).length,
    read_only: boundary.read_only,
    extractor_coverage_report_only: boundary.extractor_coverage_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    extractor_execution_performed: boundary.extractor_execution_performed,
    ocr_execution_performed: boundary.ocr_execution_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    external_model_used: boundary.external_model_used,
    external_service_called: boundary.external_service_called,
    network_access_performed: boundary.network_access_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    matter_data_write_performed: boundary.matter_data_write_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    human_review_required: true,
    client_facing_ready: false,
    legal_advice_generated: false,
    protected_action_executed: false,
    note: HUMAN_REVIEW_NOTE,
  };
}

function buildSourceContracts(reads) {
  return [
    sourceContract("package", reads.packageJson),
    sourceContract("final-completion-phase-ledger", reads.roadmapText),
    sourceContract("implementation-roadmap", reads.implementationRoadmapText),
    sourceContract("control-plane-loop", reads.controlPlaneLoopText),
    sourceContract("review-dashboard", reads.reviewDashboardText),
    sourceContract("review-api", reads.reviewApiText),
    sourceContract("resource-expansion", reads.resourceExpansionRead),
    sourceContract("expansion-quarantine-ledger", reads.expansionQuarantineLedgerRead),
    sourceContract("batch-classification-result", reads.batchClassificationRead),
    sourceContract("extractor-registry", reads.extractorRegistryRead),
  ];
}

function sourceContract(sourceId, read) {
  return {
    source_id: sourceId,
    path: read.path,
    available: read.available,
    content_hash: read.content_hash ?? null,
    error: read.error ?? null,
  };
}

function renderExtractorCoverageMarkdown(result) {
  const summary = result.summary;
  const lines = [
    "# Extractor Coverage Report",
    "",
    `Status: ${summary.extractor_coverage_report_status}`,
    `Phase: ${summary.phase_slot}`,
    "",
    "## Coverage",
    `- Resource items: ${summary.coverage_item_row_count}/${summary.resource_item_count}`,
    `- Document type rows: ${summary.document_type_coverage_row_count}`,
    `- Extension rows: ${summary.extension_coverage_row_count}`,
    `- Status rows: ${summary.status_coverage_row_count}`,
    `- Processing rate: ${summary.processing_rate}`,
    `- Failure rate: ${summary.failure_rate}`,
    `- Unsupported rate: ${summary.unsupported_rate}`,
    `- Unsupported type rows: ${summary.unsupported_type_row_count}`,
    "",
    "## Boundary",
    `- Extractor execution: ${summary.extractor_execution_performed}`,
    `- OCR execution: ${summary.ocr_execution_performed}`,
    `- File content read: ${summary.file_content_read_performed}`,
    `- External services/network: ${summary.external_service_called}/${summary.network_access_performed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    HUMAN_REVIEW_NOTE,
  ];
  return `${lines.join("\n")}\n`;
}

function serializableExtractorCoverageReport(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeRows(rows) {
  return {
    total: rows.length,
    processed: rows.filter((row) => row.processed).length,
    covered: rows.filter((row) => row.covered).length,
    failed: rows.filter((row) => row.failed).length,
    quarantined: rows.filter((row) => row.quarantined).length,
    unsupported: rows.filter((row) => row.unsupported).length,
    fallback: rows.filter((row) => row.fallback_registry_entry_used).length,
    coverageMissing: rows.filter((row) => row.coverage_missing).length,
  };
}

function coverageStatusForSummary(summary) {
  if (summary.coverageMissing > 0) return "attention";
  if (summary.failed > 0 || summary.quarantined > 0 || summary.unsupported > 0) return "covered_with_human_review_holds";
  return "covered_pending_human_review";
}

function isAcceptableCoverageRow(row) {
  return ["covered_pending_human_review", "covered_with_human_review_holds"].includes(row.coverage_status);
}

function isProcessedStatus(status) {
  return ["extracted", "skipped_duplicate", "quarantined", "failed", "dataless"].includes(String(status ?? ""));
}

function isFailureStatus(status) {
  return ["failed", "extraction_failed", "error"].includes(String(status ?? ""));
}

function isUnsupportedType({ item, compatibilityRow, quarantineRow, extension }) {
  const category = String(quarantineRow.quarantine_category ?? "").toLowerCase();
  const reason = String(quarantineRow.quarantine_reason ?? item.quarantine_reason ?? "").toLowerCase();
  if (category === "unsupported_or_unknown_type") return true;
  if (reason.includes("unsupported") || reason.includes("unknown type")) return true;
  return compatibilityRow.fallback_registry_entry_used === true
    && compatibilityRow.supported_extension_match !== true
    && !extension;
}

function allRatesBounded(rows, key) {
  return rows.every((row) => Number.isFinite(row[key]) && row[key] >= 0 && row[key] <= 1);
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    item_count: validationItems.length,
    error_count: errors.length,
    errors,
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.reviewApiPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.resourceExpansionPath,
    expansion_quarantine_ledger_path: options.expansionQuarantineLedgerPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.expansionQuarantineLedgerPath,
    batch_classification_result_path: options.batchClassificationResultPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.batchClassificationResultPath,
    extractor_registry_path: options.extractorRegistryPath ?? DEFAULT_EXTRACTOR_COVERAGE_REPORT_INPUTS.extractorRegistryPath,
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
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--expansion-quarantine-ledger") parsed.expansionQuarantineLedgerPath = argv[++index];
    else if (arg === "--batch-classification-result") parsed.batchClassificationResultPath = argv[++index];
    else if (arg === "--extractor-registry") parsed.extractorRegistryPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/extractor-coverage-report.mjs [options]

Options:
  --resource-expansion <path>               resource-expansion-job.json path.
  --expansion-quarantine-ledger <path>      expansion-quarantine-ledger.json path.
  --batch-classification-result <path>      batch-classification-result.json path.
  --extractor-registry <path>               extractor-registry.json path.
  --out-dir <folder>                        Output folder.
  --check                                   Fail if validation does not pass.
  -h, --help                                Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: JSON.parse(text),
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: null,
      error: String(error?.message ?? error),
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: "",
      error: String(error?.message ?? error),
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EIO", "ENOENT", "EBUSY", "EPERM"].includes(error?.code) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

function groupBy(values, keyOrFn) {
  const grouped = new Map();
  for (const value of values) {
    const key = typeof keyOrFn === "function" ? keyOrFn(value) : value[keyOrFn];
    const safeKey = key ?? "unknown";
    const rows = grouped.get(safeKey) ?? [];
    rows.push(value);
    grouped.set(safeKey, rows);
  }
  return grouped;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function by(...keys) {
  return (left, right) => {
    for (const key of keys) {
      const leftValue = String(left[key] ?? "");
      const rightValue = String(right[key] ?? "");
      const compared = leftValue.localeCompare(rightValue);
      if (compared !== 0) return compared;
    }
    return 0;
  };
}

function normalizeExtension(extension) {
  return String(extension ?? "").replace(/^\./, "").toLowerCase();
}

function rate(numerator, denominator) {
  if (!denominator) return 0;
  return Number((numerator / denominator).toFixed(6));
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replaceAll("-", "");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}
