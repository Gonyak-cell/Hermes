import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LEDGER_API_DASHBOARD_OUT_DIR = "artifacts/ledger-api-dashboard/latest";
export const DEFAULT_LEDGER_API_DASHBOARD_INPUTS = {
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  costRecordProjectionPath: "artifacts/cost-record-projection/latest/cost-record-projection.json",
  tokenUsageProjectionPath: "artifacts/token-usage-projection/latest/token-usage-projection.json",
  errorRetryLedgerPath: "artifacts/error-retry-ledger/latest/error-retry-ledger.json",
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  eventReplayHarnessPath: "artifacts/event-replay/latest/event-replay-harness.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
  reviewApiPath: "src/review-api.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
};

const LEDGER_API_DASHBOARD_SCHEMA_VERSION = "ledger-api-dashboard.v1";
const LEDGER_API_DASHBOARD_CONTRACT_ID = "ledger-api-dashboard.v1";
const LEDGER_DASHBOARD_PANEL_SCHEMA_VERSION = "ledger-dashboard-panel.v1";
const LEDGER_API_ROUTE_RECORD_SCHEMA_VERSION = "ledger-api-route-record.v1";
const LEDGER_PANEL_METRIC_SCHEMA_VERSION = "ledger-panel-metric.v1";
const LEDGER_CROSS_LINK_SCHEMA_VERSION = "ledger-cross-link.v1";
const LEDGER_DOMAINS = ["run", "audit", "cost", "error", "event"];

export async function runLedgerApiDashboard(options = {}) {
  const result = await buildLedgerApiDashboard(options);
  if (options.write !== false) await writeLedgerApiDashboard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Ledger API/dashboard validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLedgerApiDashboard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LEDGER_API_DASHBOARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    workflowRunLedger: await readJsonOrError(inputs.workflow_run_ledger_path),
    auditEventLedger: await readJsonOrError(inputs.audit_event_ledger_path),
    costRecordProjection: await readJsonOrError(inputs.cost_record_projection_path),
    tokenUsageProjection: await readJsonOrError(inputs.token_usage_projection_path),
    errorRetryLedger: await readJsonOrError(inputs.error_retry_ledger_path),
    appendOnlyEventStore: await readJsonOrError(inputs.append_only_event_store_path),
    eventReplayHarness: await readJsonOrError(inputs.event_replay_harness_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
    reviewApi: await readTextOrError(inputs.review_api_path),
    reviewDashboard: await readTextOrError(inputs.review_dashboard_path),
  };
  const artifacts = {
    workflowRunLedger: sources.workflowRunLedger.value ?? {},
    auditEventLedger: sources.auditEventLedger.value ?? {},
    costRecordProjection: sources.costRecordProjection.value ?? {},
    tokenUsageProjection: sources.tokenUsageProjection.value ?? {},
    errorRetryLedger: sources.errorRetryLedger.value ?? {},
    appendOnlyEventStore: sources.appendOnlyEventStore.value ?? {},
    eventReplayHarness: sources.eventReplayHarness.value ?? {},
  };
  const ledgerDashboardPanels = buildLedgerDashboardPanels(artifacts, generatedAt);
  const ledgerApiRouteRecords = buildLedgerApiRouteRecords(ledgerDashboardPanels, sources.reviewApi.value ?? "", generatedAt);
  const ledgerPanelMetrics = buildLedgerPanelMetrics(ledgerDashboardPanels, generatedAt);
  const ledgerCrossLinks = buildLedgerCrossLinks(artifacts, generatedAt);
  const validationItems = validateLedgerApiDashboard({
    sources,
    ledgerDashboardPanels,
    ledgerApiRouteRecords,
    ledgerPanelMetrics,
    ledgerCrossLinks,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: LEDGER_API_DASHBOARD_SCHEMA_VERSION,
    generated_at: generatedAt,
    ledger_api_dashboard_id: `ledger-api-dashboard.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    ledger_api_dashboard_contract: buildLedgerApiDashboardContract(generatedAt),
    ledger_api_dashboard_catalog: {
      schema_version: "ledger-api-dashboard-catalog.v1",
      generated_at: generatedAt,
      ledger_dashboard_panels: ledgerDashboardPanels,
      ledger_api_route_records: ledgerApiRouteRecords,
      ledger_panel_metrics: ledgerPanelMetrics,
      ledger_cross_links: ledgerCrossLinks,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeLedgerApiDashboard({
      sources,
      ledgerDashboardPanels,
      ledgerApiRouteRecords,
      ledgerPanelMetrics,
      ledgerCrossLinks,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderLedgerApiDashboardMarkdown(result),
  };
}

export async function writeLedgerApiDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "ledger-api-dashboard.json"), serializableLedgerApiDashboard(result));
  await writeJson(path.join(outDir, "ledger-dashboard-panels.json"), {
    schema_version: "ledger-dashboard-panels.v1",
    generated_at: result.generated_at,
    ledger_dashboard_panel_count: result.ledger_api_dashboard_catalog.ledger_dashboard_panels.length,
    ledger_dashboard_panels: result.ledger_api_dashboard_catalog.ledger_dashboard_panels,
  });
  await writeJson(path.join(outDir, "ledger-api-route-records.json"), {
    schema_version: "ledger-api-route-records.v1",
    generated_at: result.generated_at,
    ledger_api_route_record_count: result.ledger_api_dashboard_catalog.ledger_api_route_records.length,
    ledger_api_route_records: result.ledger_api_dashboard_catalog.ledger_api_route_records,
  });
  await writeJson(path.join(outDir, "ledger-panel-metrics.json"), {
    schema_version: "ledger-panel-metrics.v1",
    generated_at: result.generated_at,
    ledger_panel_metric_count: result.ledger_api_dashboard_catalog.ledger_panel_metrics.length,
    ledger_panel_metrics: result.ledger_api_dashboard_catalog.ledger_panel_metrics,
  });
  await writeJson(path.join(outDir, "ledger-cross-links.json"), {
    schema_version: "ledger-cross-links.v1",
    generated_at: result.generated_at,
    ledger_cross_link_count: result.ledger_api_dashboard_catalog.ledger_cross_links.length,
    ledger_cross_links: result.ledger_api_dashboard_catalog.ledger_cross_links,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ledger-api-dashboard-validation-report.v1",
    generated_at: result.generated_at,
    ledger_api_dashboard_id: result.ledger_api_dashboard_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLedgerApiDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLedgerApiDashboard(args);
    console.log(`Ledger API/dashboard written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.ledger_api_dashboard_status}`);
    console.log(`Panels: ${result.summary.ledger_dashboard_panel_count}`);
    console.log(`Routes: ${result.summary.ledger_api_route_record_count}`);
    console.log(`Metrics: ${result.summary.ledger_panel_metric_count}`);
    console.log(`Cross links: ${result.summary.ledger_cross_link_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildLedgerApiDashboardContract(generatedAt) {
  return {
    schema_version: "ledger-api-dashboard-contract.v1",
    ledger_api_dashboard_contract_id: LEDGER_API_DASHBOARD_CONTRACT_ID,
    generated_at: generatedAt,
    covered_domains: LEDGER_DOMAINS,
    source_rule: "The ledger API/dashboard surface is a read-only index over run, audit, cost, error, and event ledgers.",
    dashboard_rule: "Panels expose operational counts and route shortcuts only; they do not apply approvals, delivery, deletion, retry, or legal decisions.",
    api_rule: "Every panel route maps to an existing Review API GET endpoint and at least one safe query example.",
    human_review_rule: "Legal, client-facing, retention, retry, and delivery outcomes remain human-approved outputs.",
  };
}

function buildLedgerDashboardPanels(artifacts, generatedAt) {
  const workflowSummary = artifacts.workflowRunLedger.summary ?? {};
  const auditSummary = artifacts.auditEventLedger.summary ?? {};
  const costSummary = artifacts.costRecordProjection.summary ?? {};
  const tokenSummary = artifacts.tokenUsageProjection.summary ?? {};
  const errorSummary = artifacts.errorRetryLedger.summary ?? {};
  const eventStoreSummary = artifacts.appendOnlyEventStore.summary ?? {};
  const replaySummary = artifacts.eventReplayHarness.summary ?? {};
  return [
    panel({
      panelId: "ledger-panel.run",
      ledgerDomain: "run",
      label: "Run Ledger",
      sourceLedgerIds: ["workflow_run_ledger"],
      panelStatus: statusFor([workflowSummary.workflow_run_ledger_status], workflowSummary.validation_error_count),
      primaryCount: workflowSummary.workflow_run_record_count ?? 0,
      secondaryCount: workflowSummary.state_transition_count ?? 0,
      attentionCount: workflowSummary.blocked_workflow_run_record_count ?? 0,
      blockedCount: workflowSummary.terminal_state_mismatch_count ?? 0,
      validationErrorCount: workflowSummary.validation_error_count ?? 0,
      apiRoutes: [
        "/api/workflow-run-ledgers",
        "/api/workflow-run-records",
        "/api/workflow-state-transitions",
        "/api/workflow-event-bindings",
      ],
      queryExamples: [
        "/api/workflow-run-ledgers?workflow_run_ledger_status=complete",
        "/api/workflow-run-records?workflow_run_record_status=event_backed",
        "/api/workflow-state-transitions?transition_status=event_backed",
      ],
      metrics: {
        workflow_run_record_count: workflowSummary.workflow_run_record_count ?? 0,
        event_backed_workflow_run_record_count: workflowSummary.event_backed_workflow_run_record_count ?? 0,
        state_transition_count: workflowSummary.state_transition_count ?? 0,
        event_binding_count: workflowSummary.event_binding_count ?? 0,
        blocked_workflow_run_record_count: workflowSummary.blocked_workflow_run_record_count ?? 0,
        terminal_state_mismatch_count: workflowSummary.terminal_state_mismatch_count ?? 0,
      },
      generatedAt,
    }),
    panel({
      panelId: "ledger-panel.audit",
      ledgerDomain: "audit",
      label: "Audit Ledger",
      sourceLedgerIds: ["audit_event_ledger"],
      panelStatus: statusFor([auditSummary.audit_event_ledger_status], auditSummary.validation_error_count),
      primaryCount: auditSummary.audit_trail_record_count ?? 0,
      secondaryCount: auditSummary.audit_separation_binding_count ?? 0,
      attentionCount: auditSummary.human_review_required_audit_record_count ?? 0,
      blockedCount: auditSummary.mixed_observability_record_count ?? 0,
      validationErrorCount: auditSummary.validation_error_count ?? 0,
      apiRoutes: [
        "/api/audit-event-ledgers",
        "/api/audit-trail-records",
        "/api/audit-separation-bindings",
        "/api/audit-source-rollups",
        "/api/audit-event-ledger-validations",
      ],
      queryExamples: [
        "/api/audit-event-ledgers?audit_event_ledger_status=complete",
        "/api/audit-trail-records?separation_status=separate_from_observability",
        "/api/audit-source-rollups?audit_domain=security",
      ],
      metrics: {
        audit_trail_record_count: auditSummary.audit_trail_record_count ?? 0,
        audit_event_v2_record_count: auditSummary.audit_event_v2_record_count ?? 0,
        access_audit_record_count: auditSummary.access_audit_record_count ?? 0,
        audit_separation_binding_count: auditSummary.audit_separation_binding_count ?? 0,
        event_store_bound_record_count: auditSummary.event_store_bound_record_count ?? 0,
        human_review_required_audit_record_count: auditSummary.human_review_required_audit_record_count ?? 0,
        mixed_observability_record_count: auditSummary.mixed_observability_record_count ?? 0,
      },
      generatedAt,
    }),
    panel({
      panelId: "ledger-panel.cost",
      ledgerDomain: "cost",
      label: "Cost Ledger",
      sourceLedgerIds: ["cost_record_projection", "token_usage_projection"],
      panelStatus: statusFor([costSummary.cost_record_projection_status, tokenSummary.token_usage_projection_status], (costSummary.validation_error_count ?? 0) + (tokenSummary.validation_error_count ?? 0)),
      primaryCount: costSummary.projected_cost_record_count ?? 0,
      secondaryCount: tokenSummary.projected_token_usage_record_count ?? 0,
      attentionCount: (costSummary.unpriced_record_count ?? 0) + (tokenSummary.unknown_record_count ?? 0),
      blockedCount: (costSummary.missing_run_cost_rollup_count ?? 0) + (tokenSummary.missing_provider_cost_record_count ?? 0),
      validationErrorCount: (costSummary.validation_error_count ?? 0) + (tokenSummary.validation_error_count ?? 0),
      apiRoutes: [
        "/api/cost-record-projections",
        "/api/projected-cost-records",
        "/api/run-cost-rollups",
        "/api/cost-category-rollups",
        "/api/token-usage-projections",
        "/api/projected-token-usage-records",
      ],
      queryExamples: [
        "/api/cost-record-projections?cost_record_projection_status=complete",
        "/api/projected-cost-records?cost_category=provider",
        "/api/projected-token-usage-records?provider_cost_binding_status=bound",
      ],
      metrics: {
        projected_cost_record_count: costSummary.projected_cost_record_count ?? 0,
        run_cost_rollup_count: costSummary.run_cost_rollup_count ?? 0,
        attributed_run_cost_rollup_count: costSummary.attributed_run_cost_rollup_count ?? 0,
        total_projected_usd: costSummary.total_projected_usd ?? 0,
        projected_token_usage_record_count: tokenSummary.projected_token_usage_record_count ?? 0,
        total_token_count: tokenSummary.total_token_count ?? 0,
        missing_provider_cost_record_count: tokenSummary.missing_provider_cost_record_count ?? 0,
      },
      generatedAt,
    }),
    panel({
      panelId: "ledger-panel.error",
      ledgerDomain: "error",
      label: "Error Ledger",
      sourceLedgerIds: ["error_retry_ledger"],
      panelStatus: statusFor([errorSummary.error_retry_ledger_status], errorSummary.validation_error_count),
      primaryCount: errorSummary.projected_error_record_count ?? 0,
      secondaryCount: errorSummary.retry_record_count ?? 0,
      attentionCount: errorSummary.resume_blocked_count ?? 0,
      blockedCount: errorSummary.missing_trace_binding_count ?? 0,
      validationErrorCount: errorSummary.validation_error_count ?? 0,
      apiRoutes: [
        "/api/error-retry-ledgers",
        "/api/projected-error-records",
        "/api/retry-records",
        "/api/timeout-records",
        "/api/resume-state-records",
        "/api/error-retry-ledger-validations",
      ],
      queryExamples: [
        "/api/error-retry-ledgers?error_retry_ledger_status=complete",
        "/api/projected-error-records?failure_state=blocking_failure",
        "/api/resume-state-records?resume_blocked=true",
      ],
      metrics: {
        projected_error_record_count: errorSummary.projected_error_record_count ?? 0,
        retry_record_count: errorSummary.retry_record_count ?? 0,
        timeout_record_count: errorSummary.timeout_record_count ?? 0,
        resume_state_record_count: errorSummary.resume_state_record_count ?? 0,
        resume_blocked_count: errorSummary.resume_blocked_count ?? 0,
        auto_retry_scheduled_count: errorSummary.auto_retry_scheduled_count ?? 0,
        missing_trace_binding_count: errorSummary.missing_trace_binding_count ?? 0,
      },
      generatedAt,
    }),
    panel({
      panelId: "ledger-panel.event",
      ledgerDomain: "event",
      label: "Event Ledger",
      sourceLedgerIds: ["append_only_event_store", "event_replay_harness"],
      panelStatus: statusFor([eventStoreSummary.event_store_status, replaySummary.event_replay_status], (eventStoreSummary.validation_error_count ?? 0) + (replaySummary.validation_error_count ?? 0)),
      primaryCount: eventStoreSummary.stored_event_count ?? 0,
      secondaryCount: replaySummary.replayed_event_count ?? 0,
      attentionCount: (eventStoreSummary.correction_event_count ?? 0) + (replaySummary.blocked_event_stream_count ?? 0),
      blockedCount: (eventStoreSummary.sequence_gap_count ?? 0) + (replaySummary.hash_chain_mismatch_count ?? 0) + (replaySummary.dashboard_metric_mismatch_count ?? 0),
      validationErrorCount: (eventStoreSummary.validation_error_count ?? 0) + (replaySummary.validation_error_count ?? 0),
      apiRoutes: [
        "/api/append-only-event-stores",
        "/api/stored-events",
        "/api/event-streams",
        "/api/event-store-validations",
        "/api/event-replay-harnesses",
        "/api/replayed-event-streams",
        "/api/replayed-run-summaries",
        "/api/dashboard-replay-metrics",
      ],
      queryExamples: [
        "/api/append-only-event-stores?event_store_status=complete",
        "/api/event-streams?sequence_status=contiguous",
        "/api/event-replay-harnesses?event_replay_status=complete",
      ],
      metrics: {
        stored_event_count: eventStoreSummary.stored_event_count ?? 0,
        event_stream_count: eventStoreSummary.event_stream_count ?? 0,
        contiguous_stream_count: eventStoreSummary.contiguous_stream_count ?? 0,
        sequence_gap_count: eventStoreSummary.sequence_gap_count ?? 0,
        replayed_event_count: replaySummary.replayed_event_count ?? 0,
        replayed_event_stream_count: replaySummary.replayed_event_stream_count ?? 0,
        dashboard_metric_mismatch_count: replaySummary.dashboard_metric_mismatch_count ?? 0,
      },
      generatedAt,
    }),
  ];
}

function panel({
  panelId,
  ledgerDomain,
  label,
  sourceLedgerIds,
  panelStatus,
  primaryCount,
  secondaryCount,
  attentionCount,
  blockedCount,
  validationErrorCount,
  apiRoutes,
  queryExamples,
  metrics,
  generatedAt,
}) {
  const base = {
    schema_version: LEDGER_DASHBOARD_PANEL_SCHEMA_VERSION,
    panel_id: panelId,
    ledger_domain: ledgerDomain,
    label,
    source_ledger_ids: sourceLedgerIds,
    panel_status: panelStatus,
    primary_count: primaryCount,
    secondary_count: secondaryCount,
    attention_count: attentionCount,
    blocked_count: blockedCount,
    validation_error_count: validationErrorCount,
    api_routes: apiRoutes,
    query_examples: queryExamples,
    metric_keys: Object.keys(metrics).sort(),
    metrics,
    human_review_note: "Read-only ledger panel; legal, delivery, retry, retention, and client-facing decisions require human approval.",
    generated_at: generatedAt,
  };
  return {
    ...base,
    panel_hash: stableHash(base),
  };
}

function buildLedgerApiRouteRecords(panels, reviewApiSource, generatedAt) {
  const records = [];
  for (const panelRow of panels) {
    for (const routePath of panelRow.api_routes) {
      const queryExample = panelRow.query_examples.find((query) => query.startsWith(routePath)) ?? `${routePath}?limit=5`;
      const base = {
        schema_version: LEDGER_API_ROUTE_RECORD_SCHEMA_VERSION,
        route_id: `ledger-api-route.${panelRow.ledger_domain}.${slugRoute(routePath)}`,
        ledger_domain: panelRow.ledger_domain,
        panel_id: panelRow.panel_id,
        source_ledger_id: panelRow.source_ledger_ids[0],
        route_method: "GET",
        route_path: routePath,
        query_example: queryExample,
        route_status: reviewApiSource.includes(`"${routePath}"`) ? "declared" : "missing",
        protected_action: false,
        generated_at: generatedAt,
      };
      records.push({
        ...base,
        route_hash: stableHash(base),
      });
    }
  }
  return records.sort(by("route_id"));
}

function buildLedgerPanelMetrics(panels, generatedAt) {
  const rows = [];
  for (const panelRow of panels) {
    for (const [metricKey, metricValue] of Object.entries(panelRow.metrics ?? {})) {
      const numericValue = typeof metricValue === "number" ? metricValue : Number(metricValue ?? 0);
      const base = {
        schema_version: LEDGER_PANEL_METRIC_SCHEMA_VERSION,
        metric_id: `ledger-panel-metric.${panelRow.ledger_domain}.${metricKey}`,
        panel_id: panelRow.panel_id,
        ledger_domain: panelRow.ledger_domain,
        metric_key: metricKey,
        metric_value: Number.isFinite(numericValue) ? numericValue : 0,
        metric_status: metricKey.includes("error") || metricKey.includes("mismatch") || metricKey.includes("missing")
          ? (numericValue === 0 ? "passed" : "attention")
          : (numericValue > 0 ? "present" : "zero"),
        generated_at: generatedAt,
      };
      rows.push({
        ...base,
        metric_hash: stableHash(base),
      });
    }
  }
  return rows.sort(by("metric_id"));
}

function buildLedgerCrossLinks(artifacts, generatedAt) {
  const workflowSummary = artifacts.workflowRunLedger.summary ?? {};
  const auditSummary = artifacts.auditEventLedger.summary ?? {};
  const costSummary = artifacts.costRecordProjection.summary ?? {};
  const errorSummary = artifacts.errorRetryLedger.summary ?? {};
  const eventStoreSummary = artifacts.appendOnlyEventStore.summary ?? {};
  const replaySummary = artifacts.eventReplayHarness.summary ?? {};
  return [
    crossLink({
      linkId: "ledger-cross-link.run-event-bindings",
      linkType: "run_to_event",
      fromLedgerDomain: "run",
      toLedgerDomain: "event",
      sourceLedgerIds: ["workflow_run_ledger", "append_only_event_store"],
      sourceRecordCount: workflowSummary.event_binding_count ?? 0,
      linkedRecordCount: workflowSummary.linked_event_binding_count ?? 0,
      linkStatus: (workflowSummary.linked_event_binding_count ?? 0) > 0 ? "linked" : "missing",
      generatedAt,
    }),
    crossLink({
      linkId: "ledger-cross-link.run-cost-rollups",
      linkType: "run_to_cost",
      fromLedgerDomain: "run",
      toLedgerDomain: "cost",
      sourceLedgerIds: ["workflow_run_ledger", "cost_record_projection"],
      sourceRecordCount: costSummary.run_cost_rollup_count ?? 0,
      linkedRecordCount: costSummary.attributed_run_cost_rollup_count ?? 0,
      linkStatus: (costSummary.missing_run_cost_rollup_count ?? 0) === 0 ? "linked" : "attention",
      generatedAt,
    }),
    crossLink({
      linkId: "ledger-cross-link.run-error-source",
      linkType: "run_to_error",
      fromLedgerDomain: "run",
      toLedgerDomain: "error",
      sourceLedgerIds: ["workflow_run_ledger", "error_retry_ledger"],
      sourceRecordCount: workflowSummary.workflow_run_record_count ?? 0,
      linkedRecordCount: errorSummary.source_workflow_run_record_count ?? 0,
      linkStatus: (errorSummary.source_workflow_run_record_count ?? 0) > 0 ? "linked" : "missing",
      generatedAt,
    }),
    crossLink({
      linkId: "ledger-cross-link.event-audit-store-binding",
      linkType: "event_to_audit",
      fromLedgerDomain: "event",
      toLedgerDomain: "audit",
      sourceLedgerIds: ["append_only_event_store", "audit_event_ledger"],
      sourceRecordCount: auditSummary.audit_event_v2_record_count ?? 0,
      linkedRecordCount: auditSummary.event_store_bound_record_count ?? 0,
      linkStatus: (auditSummary.event_store_bound_record_count ?? 0) > 0 ? "linked" : "missing",
      generatedAt,
    }),
    crossLink({
      linkId: "ledger-cross-link.event-replay-parity",
      linkType: "event_to_replay",
      fromLedgerDomain: "event",
      toLedgerDomain: "event",
      sourceLedgerIds: ["append_only_event_store", "event_replay_harness"],
      sourceRecordCount: eventStoreSummary.stored_event_count ?? 0,
      linkedRecordCount: replaySummary.replayed_event_count ?? 0,
      linkStatus: (eventStoreSummary.stored_event_count ?? -1) === (replaySummary.replayed_event_count ?? -2) ? "linked" : "attention",
      generatedAt,
    }),
  ].sort(by("link_id"));
}

function crossLink({
  linkId,
  linkType,
  fromLedgerDomain,
  toLedgerDomain,
  sourceLedgerIds,
  sourceRecordCount,
  linkedRecordCount,
  linkStatus,
  generatedAt,
}) {
  const base = {
    schema_version: LEDGER_CROSS_LINK_SCHEMA_VERSION,
    link_id: linkId,
    link_type: linkType,
    from_ledger_domain: fromLedgerDomain,
    to_ledger_domain: toLedgerDomain,
    source_ledger_ids: sourceLedgerIds,
    source_record_count: sourceRecordCount,
    linked_record_count: linkedRecordCount,
    link_status: linkStatus,
    generated_at: generatedAt,
  };
  return {
    ...base,
    link_hash: stableHash(base),
  };
}

function validateLedgerApiDashboard({
  sources,
  ledgerDashboardPanels,
  ledgerApiRouteRecords,
  ledgerPanelMetrics,
  ledgerCrossLinks,
}) {
  const packageJson = sources.packageJson.value ?? {};
  const roadmapText = sources.roadmap.value ?? "";
  const reviewApiSource = sources.reviewApi.value ?? "";
  const reviewDashboardSource = sources.reviewDashboard.value ?? "";
  const domains = new Set(ledgerDashboardPanels.map((panelRow) => panelRow.ledger_domain));
  const panelByDomain = new Map(ledgerDashboardPanels.map((panelRow) => [panelRow.ledger_domain, panelRow]));
  const items = [];
  items.push(validationItem("package.scripts.ledgers_api_dashboard", "package_script_present", Boolean(packageJson.scripts?.["ledgers:api-dashboard"]), "package.json must expose npm run ledgers:api-dashboard."));
  items.push(validationItem("roadmap.phase_174", "roadmap_phase_declared", roadmapText.includes("Phase 174: Ledger API/Dashboard"), "Phase 174 roadmap entry must be declared."));
  items.push(validationItem("review_dashboard.source", "dashboard_source_present", reviewDashboardSource.includes("ledger_api_dashboard"), "Review dashboard must read ledger_api_dashboard source artifacts."));
  items.push(validationItem("review_dashboard.stage", "dashboard_stage_present", reviewDashboardSource.includes("Ledger API Dashboard"), "Review dashboard must expose Ledger API Dashboard stage/panel status."));
  items.push(validationItem("panels.required_domains", "required_domains_present", LEDGER_DOMAINS.every((domain) => domains.has(domain)), "Run, audit, cost, error, and event panels must be present."));
  items.push(validationItem("panels.count", "panel_count_complete", ledgerDashboardPanels.length === LEDGER_DOMAINS.length, "Ledger API dashboard must expose exactly five domain panels."));
  for (const domain of LEDGER_DOMAINS) {
    const panelRow = panelByDomain.get(domain);
    items.push(validationItem(`panels.${domain}`, "panel_passed", panelRow?.panel_status === "passed", `${domain} ledger panel must pass.`));
    items.push(validationItem(`panels.${domain}.routes`, "panel_routes_present", (panelRow?.api_routes?.length ?? 0) >= 3, `${domain} panel must expose Review API routes.`));
    items.push(validationItem(`panels.${domain}.query_examples`, "query_examples_present", (panelRow?.query_examples?.length ?? 0) >= 1, `${domain} panel must include safe query examples.`));
  }
  const missingRoutes = ledgerApiRouteRecords.filter((record) => record.route_status !== "declared");
  items.push(validationItem("api.routes.declared", "api_routes_declared", missingRoutes.length === 0, "Every P174 ledger route record must map to a declared Review API route.", { missing_route_count: missingRoutes.length }));
  items.push(validationItem("api.routes.count", "api_route_count_minimum", ledgerApiRouteRecords.length >= 20, "P174 must index at least 20 run/audit/cost/error/event API routes."));
  items.push(validationItem("metrics.count", "panel_metrics_present", ledgerPanelMetrics.length >= 20, "P174 must expose dashboard panel metrics."));
  items.push(validationItem("cross_links.count", "cross_links_present", ledgerCrossLinks.length >= 5, "P174 must expose ledger cross-link health rows."));
  items.push(validationItem("cross_links.status", "cross_links_linked", ledgerCrossLinks.every((link) => link.link_status === "linked"), "P174 cross-link rows must be linked without attention states."));
  return items;
}

function summarizeLedgerApiDashboard({
  sources,
  ledgerDashboardPanels,
  ledgerApiRouteRecords,
  ledgerPanelMetrics,
  ledgerCrossLinks,
  validation,
  validationItems,
}) {
  const panelStatus = countBy(ledgerDashboardPanels, "panel_status");
  const routeStatus = countBy(ledgerApiRouteRecords, "route_status");
  const metricStatus = countBy(ledgerPanelMetrics, "metric_status");
  const linkStatus = countBy(ledgerCrossLinks, "link_status");
  const domainCounts = countBy(ledgerDashboardPanels, "ledger_domain");
  const sourceValidationErrorCount = ledgerDashboardPanels.reduce((sum, panelRow) => sum + (panelRow.validation_error_count ?? 0), 0);
  const routeQueryExampleCount = ledgerApiRouteRecords.filter((record) => record.query_example).length;
  return {
    ledger_api_dashboard_status: validation.valid ? "complete" : "blocked",
    ledger_api_dashboard_contract_id: LEDGER_API_DASHBOARD_CONTRACT_ID,
    source_workflow_run_ledger_status: sourceStatus(sources.workflowRunLedger, "workflow_run_ledger_status"),
    source_audit_event_ledger_status: sourceStatus(sources.auditEventLedger, "audit_event_ledger_status"),
    source_cost_record_projection_status: sourceStatus(sources.costRecordProjection, "cost_record_projection_status"),
    source_token_usage_projection_status: sourceStatus(sources.tokenUsageProjection, "token_usage_projection_status"),
    source_error_retry_ledger_status: sourceStatus(sources.errorRetryLedger, "error_retry_ledger_status"),
    source_append_only_event_store_status: sourceStatus(sources.appendOnlyEventStore, "event_store_status"),
    source_event_replay_harness_status: sourceStatus(sources.eventReplayHarness, "event_replay_status"),
    ledger_dashboard_panel_count: ledgerDashboardPanels.length,
    passed_panel_count: panelStatus.passed ?? 0,
    blocked_panel_count: panelStatus.blocked ?? 0,
    ledger_domain_count: new Set(ledgerDashboardPanels.map((panelRow) => panelRow.ledger_domain)).size,
    run_panel_count: domainCounts.run ?? 0,
    audit_panel_count: domainCounts.audit ?? 0,
    cost_panel_count: domainCounts.cost ?? 0,
    error_panel_count: domainCounts.error ?? 0,
    event_panel_count: domainCounts.event ?? 0,
    ledger_api_route_record_count: ledgerApiRouteRecords.length,
    declared_route_count: routeStatus.declared ?? 0,
    missing_route_count: routeStatus.missing ?? 0,
    route_query_example_count: routeQueryExampleCount,
    ledger_panel_metric_count: ledgerPanelMetrics.length,
    present_metric_count: metricStatus.present ?? 0,
    attention_metric_count: metricStatus.attention ?? 0,
    ledger_cross_link_count: ledgerCrossLinks.length,
    linked_cross_link_count: linkStatus.linked ?? 0,
    attention_cross_link_count: linkStatus.attention ?? 0,
    source_validation_error_count: sourceValidationErrorCount,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function buildSourceContracts(sources, inputs) {
  return {
    workflow_run_ledger: sourceContract(sources.workflowRunLedger, inputs.workflow_run_ledger_path, "workflow-run-ledger.v1"),
    audit_event_ledger: sourceContract(sources.auditEventLedger, inputs.audit_event_ledger_path, "audit-event-ledger.v1"),
    cost_record_projection: sourceContract(sources.costRecordProjection, inputs.cost_record_projection_path, "cost-record-projection.v1"),
    token_usage_projection: sourceContract(sources.tokenUsageProjection, inputs.token_usage_projection_path, "token-usage-projection.v1"),
    error_retry_ledger: sourceContract(sources.errorRetryLedger, inputs.error_retry_ledger_path, "error-retry-ledger.v1"),
    append_only_event_store: sourceContract(sources.appendOnlyEventStore, inputs.append_only_event_store_path, "append-only-event-store.v1"),
    event_replay_harness: sourceContract(sources.eventReplayHarness, inputs.event_replay_harness_path, "event-replay-harness.v1"),
  };
}

function sourceContract(source, filePath, expectedSchemaVersion) {
  return {
    path: filePath,
    available: source.ok,
    schema_version: source.value?.schema_version ?? null,
    expected_schema_version: expectedSchemaVersion,
    status: source.ok ? "available" : "missing",
    error: source.ok ? null : source.error,
  };
}

function renderLedgerApiDashboardMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Ledger API/Dashboard");
  lines.push("");
  lines.push("Attorney review is required before any legal, client-facing, delivery, retry, retention, or deletion decision.");
  lines.push("");
  lines.push(`- Status: ${summary.ledger_api_dashboard_status}`);
  lines.push(`- Panels: ${summary.passed_panel_count}/${summary.ledger_dashboard_panel_count}`);
  lines.push(`- API routes: ${summary.declared_route_count}/${summary.ledger_api_route_record_count}`);
  lines.push(`- Metrics: ${summary.ledger_panel_metric_count}`);
  lines.push(`- Cross links: ${summary.linked_cross_link_count}/${summary.ledger_cross_link_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Panels");
  for (const panelRow of result.ledger_api_dashboard_catalog.ledger_dashboard_panels) {
    lines.push(`- ${panelRow.label}: ${panelRow.panel_status}; primary ${panelRow.primary_count}, secondary ${panelRow.secondary_count}, attention ${panelRow.attention_count}, blocked ${panelRow.blocked_count}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    workflow_run_ledger_path: options.workflowRunLedgerPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.workflowRunLedgerPath,
    audit_event_ledger_path: options.auditEventLedgerPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.auditEventLedgerPath,
    cost_record_projection_path: options.costRecordProjectionPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.costRecordProjectionPath,
    token_usage_projection_path: options.tokenUsageProjectionPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.tokenUsageProjectionPath,
    error_retry_ledger_path: options.errorRetryLedgerPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.errorRetryLedgerPath,
    append_only_event_store_path: options.appendOnlyEventStorePath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.appendOnlyEventStorePath,
    event_replay_harness_path: options.eventReplayHarnessPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.eventReplayHarnessPath,
    package_path: options.packagePath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.roadmapPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.reviewApiPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_LEDGER_API_DASHBOARD_INPUTS.reviewDashboardPath,
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--workflow-run-ledger") args.workflowRunLedgerPath = argv[++index];
    else if (arg === "--audit-event-ledger") args.auditEventLedgerPath = argv[++index];
    else if (arg === "--cost-record-projection") args.costRecordProjectionPath = argv[++index];
    else if (arg === "--token-usage-projection") args.tokenUsageProjectionPath = argv[++index];
    else if (arg === "--error-retry-ledger") args.errorRetryLedgerPath = argv[++index];
    else if (arg === "--append-only-event-store") args.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--event-replay-harness") args.eventReplayHarnessPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--roadmap") args.roadmapPath = argv[++index];
    else if (arg === "--review-api") args.reviewApiPath = argv[++index];
    else if (arg === "--review-dashboard") args.reviewDashboardPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/ledger-api-dashboard.mjs [options]

Options:
  --check                         fail when validation is not complete
  --out-dir <dir>                 output directory
  --workflow-run-ledger <path>    workflow-run-ledger.json path
  --audit-event-ledger <path>     audit-event-ledger.json path
  --cost-record-projection <path> cost-record-projection.json path
  --token-usage-projection <path> token-usage-projection.json path
  --error-retry-ledger <path>     error-retry-ledger.json path
  --append-only-event-store <path> append-only-event-store.json path
  --event-replay-harness <path>   event-replay-harness.json path
  --package <path>                package.json path
  --roadmap <path>                implementation roadmap path
  --review-api <path>             review-api source path
  --review-dashboard <path>       review-dashboard source path
  --run-at <iso>                  deterministic generated_at timestamp
  --help                          show this help
`);
}

function serializableLedgerApiDashboard(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function statusFor(statuses, validationErrorCount = 0) {
  const normalized = statuses.filter(Boolean);
  if (validationErrorCount > 0) return "blocked";
  if (normalized.length === 0) return "blocked";
  return normalized.every((status) => status === "complete" || status === "valid" || status === "passed") ? "passed" : "blocked";
}

function validationItem(pathValue, checkId, passed, message, details = {}) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    ...details,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

async function readJsonOrError(filePath) {
  try {
    return { ok: true, path: filePath, value: JSON.parse(await readFile(filePath, "utf8")), error: null };
  } catch (error) {
    return { ok: false, path: filePath, value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { ok: true, path: filePath, value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { ok: false, path: filePath, value: "", error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sourceStatus(source, summaryKey) {
  if (!source.ok) return "missing";
  const status = source.value?.summary?.[summaryKey];
  if (status) return status;
  if (source.value?.validation?.valid === true) return "valid";
  return "unknown";
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key]] = (counts[row[key]] ?? 0) + 1;
  return counts;
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function slugRoute(routePath) {
  return routePath.replace(/^\/api\//, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function dateStamp(iso) {
  return iso.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

function stableHash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
