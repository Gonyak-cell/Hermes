import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXPANSION_STATUS_DASHBOARD_OUT_DIR = "artifacts/expansion-status-dashboard/latest";
export const DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  expansionDedupLedgerPath: "artifacts/expansion-dedup-ledger/latest/expansion-dedup-ledger.json",
  expansionQuarantineLedgerPath: "artifacts/expansion-quarantine-ledger/latest/expansion-quarantine-ledger.json",
  extractorCoverageReportPath: "artifacts/extractor-coverage-report/latest/extractor-coverage-report.json",
};

const DASHBOARD_SCHEMA_VERSION = "expansion-status-dashboard.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.expansion_status_dashboard";
const PHASE_SLOT = "P285";
const PREVIOUS_PHASE_SLOT = "P284";
const NEXT_PHASE_SLOT = "P286";
const REQUIRED_STATUS_BUCKETS = ["discovered", "queued", "ingested", "failed", "quarantined"];
const HUMAN_REVIEW_NOTE = "Expansion Status Dashboard is a read-only status/API projection. It does not run expansion, ingest sources, read source file contents, retry extraction, release quarantine, mutate resources or state, deliver output, produce legal advice, or create client-facing output.";

export async function runExpansionStatusDashboard(options = {}) {
  const result = await buildExpansionStatusDashboard(options);
  if (options.write !== false) await writeExpansionStatusDashboard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Expansion status dashboard validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExpansionStatusDashboard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const expansionDedupLedgerRead = await readJsonOrError(inputs.expansion_dedup_ledger_path);
  const expansionQuarantineLedgerRead = await readJsonOrError(inputs.expansion_quarantine_ledger_path);
  const extractorCoverageReportRead = await readJsonOrError(inputs.extractor_coverage_report_path);

  const resourceExpansion = resourceExpansionRead.value ?? {};
  const expansionDedupLedger = expansionDedupLedgerRead.value ?? {};
  const expansionQuarantineLedger = expansionQuarantineLedgerRead.value ?? {};
  const extractorCoverageReport = extractorCoverageReportRead.value ?? {};

  const statusItemRows = buildStatusItemRows({
    resourceExpansion,
    expansionDedupLedger,
    expansionQuarantineLedger,
    extractorCoverageReport,
    generatedAt,
  });
  const statusRollupRows = buildStatusRollupRows(statusItemRows, generatedAt);
  const statusPanelRows = buildStatusPanelRows(statusRollupRows, generatedAt);
  const apiRouteRows = buildApiRouteRows(generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    resourceExpansionRead,
    expansionDedupLedgerRead,
    expansionQuarantineLedgerRead,
    extractorCoverageReportRead,
    resourceExpansion,
    expansionDedupLedger,
    expansionQuarantineLedger,
    extractorCoverageReport,
    statusItemRows,
    statusRollupRows,
    statusPanelRows,
    apiRouteRows,
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
  const summary = summarizeExpansionStatusDashboard({
    resourceExpansion,
    expansionDedupLedger,
    expansionQuarantineLedger,
    extractorCoverageReport,
    statusItemRows,
    statusRollupRows,
    statusPanelRows,
    apiRouteRows,
    boundary,
    validation,
  });
  const result = {
    schema_version: DASHBOARD_SCHEMA_VERSION,
    generated_at: generatedAt,
    expansion_status_dashboard_id: `expansion-status-dashboard.${dateStamp(generatedAt)}`,
    expansion_status_dashboard_status: summary.expansion_status_dashboard_status,
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
      expansionDedupLedgerRead,
      expansionQuarantineLedgerRead,
      extractorCoverageReportRead,
    }),
    expansion_status_dashboard_contract: buildContract(generatedAt, statusItemRows, apiRouteRows),
    expansion_status_item_rows: statusItemRows,
    expansion_status_rollup_rows: statusRollupRows,
    expansion_status_panel_rows: statusPanelRows,
    expansion_status_api_route_rows: apiRouteRows,
    expansion_status_boundary: boundary,
    expansion_status_checks: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderExpansionStatusMarkdown(result),
  };
}

export async function writeExpansionStatusDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "expansion-status-dashboard.json"), serializableExpansionStatusDashboard(result));
  await writeJson(path.join(outDir, "expansion-status-item-rows.json"), {
    schema_version: "expansion-status-item-rows.v1",
    generated_at: result.generated_at,
    status_item_row_count: result.expansion_status_item_rows.length,
    expansion_status_item_rows: result.expansion_status_item_rows,
  });
  await writeJson(path.join(outDir, "expansion-status-rollup-rows.json"), {
    schema_version: "expansion-status-rollup-rows.v1",
    generated_at: result.generated_at,
    status_rollup_row_count: result.expansion_status_rollup_rows.length,
    expansion_status_rollup_rows: result.expansion_status_rollup_rows,
  });
  await writeJson(path.join(outDir, "expansion-status-panel-rows.json"), {
    schema_version: "expansion-status-panel-rows.v1",
    generated_at: result.generated_at,
    status_panel_row_count: result.expansion_status_panel_rows.length,
    expansion_status_panel_rows: result.expansion_status_panel_rows,
  });
  await writeJson(path.join(outDir, "expansion-status-api-route-rows.json"), {
    schema_version: "expansion-status-api-route-rows.v1",
    generated_at: result.generated_at,
    api_route_row_count: result.expansion_status_api_route_rows.length,
    expansion_status_api_route_rows: result.expansion_status_api_route_rows,
  });
  await writeJson(path.join(outDir, "expansion-status-checks.json"), {
    schema_version: "expansion-status-checks.v1",
    generated_at: result.generated_at,
    check_count: result.expansion_status_checks.length,
    expansion_status_checks: result.expansion_status_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "expansion-status-validation-report.v1",
    generated_at: result.generated_at,
    expansion_status_dashboard_id: result.expansion_status_dashboard_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runExpansionStatusDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExpansionStatusDashboard(args);
    console.log(`Expansion status dashboard ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.expansion_status_dashboard_status}`);
    console.log(`Discovered: ${result.summary.discovered_item_count}`);
    console.log(`Queued: ${result.summary.queued_item_count}`);
    console.log(`Ingested: ${result.summary.ingested_item_count}`);
    console.log(`Failed: ${result.summary.failed_item_count}`);
    console.log(`Quarantined: ${result.summary.quarantined_item_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildStatusItemRows({
  resourceExpansion,
  expansionDedupLedger,
  expansionQuarantineLedger,
  extractorCoverageReport,
  generatedAt,
}) {
  const dedupByResourceId = new Map((expansionDedupLedger.duplicate_decision_rows ?? []).map((row) => [row.resource_id, row]));
  const quarantineByResourceId = new Map((expansionQuarantineLedger.quarantine_decision_rows ?? []).map((row) => [row.resource_id, row]));
  const coverageByResourceId = new Map((extractorCoverageReport.extractor_coverage_item_rows ?? []).map((row) => [row.resource_id, row]));
  return (resourceExpansion.items ?? []).map((item, index) => {
    const dedupRow = dedupByResourceId.get(item.resource_id) ?? {};
    const quarantineRow = quarantineByResourceId.get(item.resource_id) ?? {};
    const coverageRow = coverageByResourceId.get(item.resource_id) ?? {};
    const historyStatuses = (item.status_history ?? []).map((event) => event.status).filter(Boolean);
    const statusBuckets = statusBucketsForItem(item, historyStatuses, quarantineRow);
    const lifecycleStatus = item.status === "queued" ? "queued" : "terminal";
    const ingested = statusBuckets.includes("ingested");
    return {
      expansion_status_item_row_id: `expansion-status-item-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: item.item_id,
      resource_id: item.resource_id,
      resource_version_id: item.resource_version_id ?? null,
      relative_path: item.relative_path ?? null,
      source_path_reference_hash: item.source_path ? `sha256:${sha256(item.source_path)}` : null,
      extension: normalizeExtension(item.extension),
      candidate_domain: item.candidate_domain ?? "unknown",
      resource_type: item.resource_type ?? "unknown",
      data_classification: item.data_classification ?? "unknown",
      item_status: item.status ?? "unknown",
      expansion_lifecycle_status: lifecycleStatus,
      status_buckets: statusBuckets,
      discovered_status: "discovered",
      queued_status: item.status === "queued" ? "queued" : "not_queued",
      ingested_status: ingested ? "ingested" : "not_ingested",
      failed_status: item.status === "failed" ? "failed" : "not_failed",
      quarantined_status: item.status === "quarantined" || quarantineRow.hold_status === "held" ? "quarantined" : "not_quarantined",
      terminal_status: lifecycleStatus === "terminal" ? "terminal" : "pending",
      dedup_decision_row_id: dedupRow.duplicate_decision_row_id ?? null,
      dedup_decision: dedupRow.dedup_decision ?? null,
      duplicate_detected: dedupRow.duplicate_detected === true,
      skipped_duplicate: item.status === "skipped_duplicate" || dedupRow.skipped_duplicate === true,
      quarantine_decision_row_id: quarantineRow.quarantine_decision_row_id ?? null,
      quarantine_decision: quarantineRow.quarantine_decision ?? null,
      quarantine_category: quarantineRow.quarantine_category ?? "none",
      quarantine_reason: quarantineRow.quarantine_reason ?? item.quarantine_reason ?? null,
      extractor_coverage_item_row_id: coverageRow.extractor_coverage_item_row_id ?? null,
      extractor_coverage_status: coverageRow.coverage_status ?? "missing",
      status_history_count: historyStatuses.length,
      status_history_statuses: unique(historyStatuses),
      status_query_ready: true,
      api_queryable: true,
      dashboard_panel_visible: true,
      source_path_used_for_status_identity: false,
      source_artifact_read_performed: true,
      expansion_execution_performed: false,
      source_ingest_performed: false,
      file_content_read_performed: false,
      extraction_retry_performed: false,
      quarantine_release_performed: false,
      resource_mutation_performed: false,
      state_mutation_performed: false,
      matter_data_write_performed: false,
      delivery_execution_performed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      human_review_required: true,
      client_facing_ready: false,
    };
  }).sort(by("expansion_status_item_row_id"));
}

function buildStatusRollupRows(statusItemRows, generatedAt) {
  return REQUIRED_STATUS_BUCKETS.map((bucket, index) => {
    const rows = statusItemRows.filter((row) => row.status_buckets.includes(bucket));
    return {
      expansion_status_rollup_row_id: `expansion-status-rollup-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      status_bucket: bucket,
      item_count: rows.length,
      resource_ids: unique(rows.map((row) => row.resource_id)),
      query_route: routeForBucket(bucket),
      query_filter: `expansion_status_bucket=${bucket}`,
      panel_status: "queryable",
      api_queryable: true,
      dashboard_panel_visible: true,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
    };
  });
}

function buildStatusPanelRows(statusRollupRows, generatedAt) {
  return statusRollupRows.map((row, index) => ({
    expansion_status_panel_row_id: `expansion-status-panel-row.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    panel_key: row.status_bucket,
    label: titleCase(row.status_bucket),
    item_count: row.item_count,
    route_path: row.query_route,
    filter_query: row.query_filter,
    panel_status: "queryable",
    read_only: true,
    mutation_allowed: false,
    protected_action_executed: false,
    human_review_required: true,
    client_facing_ready: false,
  }));
}

function buildApiRouteRows(generatedAt) {
  const routes = [
    ["/api/expansion-status-dashboards", "Expansion Status Dashboard artifact"],
    ["/api/expansion-status-items", "All expansion status item rows"],
    ["/api/expansion-status-rollups", "Expansion status rollup rows"],
    ["/api/expansion-discovered-items", "Discovered expansion items"],
    ["/api/expansion-queued-items", "Queued expansion items"],
    ["/api/expansion-ingested-items", "Ingested expansion items"],
    ["/api/expansion-failed-items", "Failed expansion items"],
    ["/api/expansion-quarantined-items", "Quarantined expansion items"],
    ["/api/expansion-status-panels", "Expansion status panel rows"],
    ["/api/expansion-status-api-routes", "Expansion status API route rows"],
    ["/api/expansion-status-checks", "Expansion status check rows"],
    ["/api/expansion-status-validations", "Expansion status validation rows"],
  ];
  return routes.map(([routePath, description], index) => ({
    expansion_status_api_route_row_id: `expansion-status-api-route-row.${String(index + 1).padStart(4, "0")}`,
    generated_at: generatedAt,
    method: "GET",
    route_path: routePath,
    description,
    route_status: "queryable",
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    legal_advice_generated: false,
    client_facing_ready: false,
  }));
}

function buildContract(generatedAt, statusItemRows, apiRouteRows) {
  return {
    schema_version: "expansion-status-dashboard-contract.v1",
    contract_id: DASHBOARD_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    generated_at: generatedAt,
    status_rule: "Every Resource Expansion item is projected into a queryable status row with discovered, queued, ingested, failed, and quarantined buckets.",
    api_rule: "Dashboard/API routes expose all required status buckets as read-only collections.",
    execution_rule: "This phase performs no expansion run, source ingest, source file content read, extraction retry, quarantine release, mutation, delivery, protected action, legal advice, or client-facing output.",
    status_item_row_count: statusItemRows.length,
    api_route_row_count: apiRouteRows.length,
    human_review_required: true,
    client_facing_output_allowed: false,
  };
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "expansion-status-dashboard.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    source_artifact_read_performed: true,
    expansion_status_dashboard_report_only: true,
    expansion_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    extraction_retry_performed: false,
    quarantine_release_performed: false,
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
  expansionDedupLedgerRead,
  expansionQuarantineLedgerRead,
  extractorCoverageReportRead,
  resourceExpansion,
  expansionDedupLedger,
  expansionQuarantineLedger,
  extractorCoverageReport,
  statusItemRows,
  statusRollupRows,
  statusPanelRows,
  apiRouteRows,
  boundary,
}) {
  const resourceSummary = resourceExpansion.summary ?? {};
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const quarantineSummary = expansionQuarantineLedger.summary ?? {};
  const coverageSummary = extractorCoverageReport.summary ?? {};
  const itemCount = resourceExpansion.items?.length ?? 0;
  const requiredRoutes = apiRouteRows.map((row) => row.route_path);
  return [
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1" && itemCount > 0, "Resource Expansion Job is readable."),
    checkpoint("source.expansion_dedup_ledger", expansionDedupLedgerRead.available && dedupSummary.expansion_dedup_ledger_status === "complete" && dedupSummary.phase_slot === "P279", "P279 Expansion Dedup Ledger is complete."),
    checkpoint("source.expansion_quarantine_ledger", expansionQuarantineLedgerRead.available && quarantineSummary.expansion_quarantine_ledger_status === "complete" && quarantineSummary.phase_slot === "P280", "P280 Expansion Quarantine Ledger is complete."),
    checkpoint("source.extractor_coverage_report", extractorCoverageReportRead.available && coverageSummary.extractor_coverage_report_status === "complete" && coverageSummary.phase_slot === "P284" && coverageSummary.next_phase_slot === "P285", "P284 Extractor Coverage Report is complete and points to P285."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:expansion-status"), "package.json exposes resource:expansion-status."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["expansion_status_dashboard", "resource:expansion-status"]) && includesAll(reviewDashboardText.value, ["expansion_status_dashboard", "buildExpansionStatusDashboardStage"]) && includesAll(reviewApiText.value, ["/api/expansion-status-dashboards", "/api/expansion-discovered-items", "/api/expansion-quarantined-items"]), "Control-plane loop, dashboard, and API expose Expansion Status Dashboard."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P285", "Expansion Status Dashboard"]) && includesAll(implementationRoadmapText.value, ["Phase 285", "Expansion Status Dashboard"]), "Ledger and implementation roadmap promote Phase 285."),
    checkpoint("status.item_rows", statusItemRows.length === itemCount && statusItemRows.length > 0, "Status rows cover every Resource Expansion item."),
    checkpoint("status.discovered_bucket", countBucket(statusItemRows, "discovered") === itemCount, "Every status row is discoverable."),
    checkpoint("status.queued_count", countBucket(statusItemRows, "queued") === (resourceSummary.remaining_count ?? 0), "Queued status bucket matches Resource Expansion remaining count."),
    checkpoint("status.failed_count", countBucket(statusItemRows, "failed") === (resourceSummary.failed_count ?? 0), "Failed status bucket matches Resource Expansion failed count."),
    checkpoint("status.quarantined_count", countBucket(statusItemRows, "quarantined") === (resourceSummary.quarantine_count ?? 0), "Quarantined status bucket matches Resource Expansion quarantine count."),
    checkpoint("status.ingested_query", countBucket(statusItemRows, "ingested") >= (resourceSummary.extracted_count ?? 0) + (resourceSummary.skipped_duplicate_count ?? 0) + (resourceSummary.failed_count ?? 0), "Ingested status bucket is queryable for items with ingest evidence."),
    checkpoint("status.rollups", REQUIRED_STATUS_BUCKETS.every((bucket) => statusRollupRows.some((row) => row.status_bucket === bucket && row.panel_status === "queryable")), "Required discovered/queued/ingested/failed/quarantined rollups exist."),
    checkpoint("status.panels", statusPanelRows.length === REQUIRED_STATUS_BUCKETS.length && statusPanelRows.every((row) => row.panel_status === "queryable" && row.read_only === true), "Dashboard panel rows are read-only and queryable."),
    checkpoint("status.api_routes", requiredRoutes.every((routePath) => reviewApiText.value.includes(routePath)) && apiRouteRows.every((row) => row.route_status === "queryable" && row.read_only === true && row.mutation_allowed === false), "Expansion status API routes are registered as read-only query routes."),
    checkpoint("status.links", statusItemRows.every((row) => row.dedup_decision_row_id && row.quarantine_decision_row_id && row.extractor_coverage_item_row_id), "Status rows link to dedup, quarantine, and coverage rows."),
    checkpoint("status.query_ready", statusItemRows.every((row) => row.status_query_ready && row.api_queryable && row.dashboard_panel_visible), "Every status row is query-ready for dashboard/API."),
    checkpoint("status.no_absolute_identity", statusItemRows.every((row) => row.source_path_reference_hash && row.source_path_used_for_status_identity === false), "Status rows use path hashes for reference and do not use absolute paths as identity."),
    checkpoint("boundary.no_execution", boundary.expansion_execution_performed === false && boundary.source_ingest_performed === false && boundary.file_content_read_performed === false && boundary.extraction_retry_performed === false, "No expansion execution, source ingest, source file read, or extraction retry occurs."),
    checkpoint("boundary.no_release_mutation", boundary.quarantine_release_performed === false && boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.matter_data_write_performed === false, "No quarantine release or source/resource/state/matter mutation occurs."),
    checkpoint("boundary.no_delivery_legal_client", boundary.delivery_execution_performed === false && boundary.protected_action_executed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No delivery, protected action, legal advice, or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && coverageSummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeExpansionStatusDashboard({
  resourceExpansion,
  expansionDedupLedger,
  expansionQuarantineLedger,
  extractorCoverageReport,
  statusItemRows,
  statusRollupRows,
  statusPanelRows,
  apiRouteRows,
  boundary,
  validation,
}) {
  const resourceSummary = resourceExpansion.summary ?? {};
  const dedupSummary = expansionDedupLedger.summary ?? {};
  const quarantineSummary = expansionQuarantineLedger.summary ?? {};
  const coverageSummary = extractorCoverageReport.summary ?? {};
  return {
    expansion_status_dashboard_status: validation.valid ? "complete" : "attention",
    expansion_status_dashboard_id: DASHBOARD_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_resource_expansion_source_id: resourceExpansion.source_id ?? null,
    source_resource_expansion_discovered_count: resourceSummary.discovered_count ?? 0,
    source_resource_expansion_remaining_count: resourceSummary.remaining_count ?? 0,
    source_expansion_dedup_ledger_status: dedupSummary.expansion_dedup_ledger_status ?? "unknown",
    source_expansion_dedup_phase_slot: dedupSummary.phase_slot ?? null,
    source_expansion_quarantine_ledger_status: quarantineSummary.expansion_quarantine_ledger_status ?? "unknown",
    source_expansion_quarantine_phase_slot: quarantineSummary.phase_slot ?? null,
    source_extractor_coverage_report_status: coverageSummary.extractor_coverage_report_status ?? "unknown",
    source_extractor_coverage_phase_slot: coverageSummary.phase_slot ?? null,
    source_extractor_coverage_next_phase_slot: coverageSummary.next_phase_slot ?? null,
    resource_item_count: resourceExpansion.items?.length ?? 0,
    status_item_row_count: statusItemRows.length,
    discovered_item_count: countBucket(statusItemRows, "discovered"),
    queued_item_count: countBucket(statusItemRows, "queued"),
    ingested_item_count: countBucket(statusItemRows, "ingested"),
    extracted_item_count: statusItemRows.filter((row) => row.item_status === "extracted").length,
    failed_item_count: countBucket(statusItemRows, "failed"),
    quarantined_item_count: countBucket(statusItemRows, "quarantined"),
    skipped_duplicate_item_count: statusItemRows.filter((row) => row.item_status === "skipped_duplicate").length,
    terminal_item_count: statusItemRows.filter((row) => row.terminal_status === "terminal").length,
    status_rollup_row_count: statusRollupRows.length,
    required_status_bucket_count: REQUIRED_STATUS_BUCKETS.length,
    queryable_status_bucket_count: statusRollupRows.filter((row) => row.panel_status === "queryable").length,
    status_panel_row_count: statusPanelRows.length,
    queryable_status_panel_count: statusPanelRows.filter((row) => row.panel_status === "queryable").length,
    api_route_row_count: apiRouteRows.length,
    queryable_api_route_count: apiRouteRows.filter((row) => row.route_status === "queryable").length,
    linked_dedup_row_count: statusItemRows.filter((row) => row.dedup_decision_row_id).length,
    linked_quarantine_row_count: statusItemRows.filter((row) => row.quarantine_decision_row_id).length,
    linked_coverage_row_count: statusItemRows.filter((row) => row.extractor_coverage_item_row_id).length,
    human_review_required_count: statusItemRows.filter((row) => row.human_review_required).length,
    client_facing_ready_count: statusItemRows.filter((row) => row.client_facing_ready).length,
    source_path_used_for_status_identity_count: statusItemRows.filter((row) => row.source_path_used_for_status_identity).length,
    read_only: boundary.read_only,
    expansion_status_dashboard_report_only: boundary.expansion_status_dashboard_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    expansion_execution_performed: boundary.expansion_execution_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    extraction_retry_performed: boundary.extraction_retry_performed,
    quarantine_release_performed: boundary.quarantine_release_performed,
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

function statusBucketsForItem(item, historyStatuses, quarantineRow) {
  return unique([
    "discovered",
    item.status === "queued" ? "queued" : null,
    historyStatuses.includes("ingested") || item.raw_hash_sha256 || ["extracted", "failed", "skipped_duplicate"].includes(item.status) ? "ingested" : null,
    item.status === "failed" ? "failed" : null,
    item.status === "quarantined" || quarantineRow.hold_status === "held" ? "quarantined" : null,
    item.status,
  ]);
}

function routeForBucket(bucket) {
  const routes = {
    discovered: "/api/expansion-discovered-items",
    queued: "/api/expansion-queued-items",
    ingested: "/api/expansion-ingested-items",
    failed: "/api/expansion-failed-items",
    quarantined: "/api/expansion-quarantined-items",
  };
  return routes[bucket] ?? "/api/expansion-status-items";
}

function countBucket(rows, bucket) {
  return rows.filter((row) => row.status_buckets.includes(bucket)).length;
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
    sourceContract("expansion-dedup-ledger", reads.expansionDedupLedgerRead),
    sourceContract("expansion-quarantine-ledger", reads.expansionQuarantineLedgerRead),
    sourceContract("extractor-coverage-report", reads.extractorCoverageReportRead),
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

function renderExpansionStatusMarkdown(result) {
  const summary = result.summary;
  const lines = [
    "# Expansion Status Dashboard",
    "",
    `Status: ${summary.expansion_status_dashboard_status}`,
    `Phase: ${summary.phase_slot}`,
    "",
    "## Status Buckets",
    `- Discovered: ${summary.discovered_item_count}`,
    `- Queued: ${summary.queued_item_count}`,
    `- Ingested: ${summary.ingested_item_count}`,
    `- Failed: ${summary.failed_item_count}`,
    `- Quarantined: ${summary.quarantined_item_count}`,
    "",
    "## API",
    `- Queryable status buckets: ${summary.queryable_status_bucket_count}/${summary.required_status_bucket_count}`,
    `- API routes: ${summary.queryable_api_route_count}/${summary.api_route_row_count}`,
    `- Dashboard panels: ${summary.queryable_status_panel_count}/${summary.status_panel_row_count}`,
    "",
    "## Boundary",
    `- Expansion execution: ${summary.expansion_execution_performed}`,
    `- Source ingest/file read: ${summary.source_ingest_performed}/${summary.file_content_read_performed}`,
    `- Quarantine release: ${summary.quarantine_release_performed}`,
    `- Mutation/delivery: ${summary.resource_mutation_performed}/${summary.delivery_execution_performed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    HUMAN_REVIEW_NOTE,
  ];
  return `${lines.join("\n")}\n`;
}

function serializableExpansionStatusDashboard(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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
    repo_root: options.repoRoot ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.reviewApiPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.resourceExpansionPath,
    expansion_dedup_ledger_path: options.expansionDedupLedgerPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.expansionDedupLedgerPath,
    expansion_quarantine_ledger_path: options.expansionQuarantineLedgerPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.expansionQuarantineLedgerPath,
    extractor_coverage_report_path: options.extractorCoverageReportPath ?? DEFAULT_EXPANSION_STATUS_DASHBOARD_INPUTS.extractorCoverageReportPath,
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
    else if (arg === "--expansion-dedup-ledger") parsed.expansionDedupLedgerPath = argv[++index];
    else if (arg === "--expansion-quarantine-ledger") parsed.expansionQuarantineLedgerPath = argv[++index];
    else if (arg === "--extractor-coverage-report") parsed.extractorCoverageReportPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/expansion-status-dashboard.mjs [options]

Options:
  --resource-expansion <path>             resource-expansion-job.json path.
  --expansion-dedup-ledger <path>         expansion-dedup-ledger.json path.
  --expansion-quarantine-ledger <path>    expansion-quarantine-ledger.json path.
  --extractor-coverage-report <path>      extractor-coverage-report.json path.
  --out-dir <folder>                      Output folder.
  --check                                 Fail if validation does not pass.
  -h, --help                              Show this help.
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

function titleCase(value) {
  return String(value ?? "")
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function dateStamp(isoString) {
  return isoString.slice(0, 10).replaceAll("-", "");
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
}
