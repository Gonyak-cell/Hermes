import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_COST_OBSERVABILITY_DASHBOARD_OUT_DIR = "artifacts/cost-observability-dashboard/latest";
export const DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS = {
  packageJsonPath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  costBudgetLedgerPath: "artifacts/cost-budget/latest/cost-budget-ledger.json",
  tokenUsageLedgerPath: "artifacts/token-usage/latest/token-usage-ledger.json",
  costAttributionLedgerPath: "artifacts/cost-attribution/latest/cost-attribution-ledger.json",
  costRecordProjectionPath: "artifacts/cost-record-projection/latest/cost-record-projection.json",
  tokenUsageProjectionPath: "artifacts/token-usage-projection/latest/token-usage-projection.json",
  observabilityTraceProjectionPath: "artifacts/observability-trace-projection/latest/observability-trace-projection.json",
  errorRetryLedgerPath: "artifacts/error-retry-ledger/latest/error-retry-ledger.json",
  observabilityFreezePath: "artifacts/observability-freeze/latest/observability-freeze.json",
  policyViolationQueuePath: "artifacts/policy-violation-queue/latest/policy-violation-queue.json",
};

const PHASE_SLOT = "P295";
const PREVIOUS_PHASE_SLOT = "P294";
const NEXT_PHASE_SLOT = "P296";
const CAPABILITY_ID = "desktop.cost_observability_dashboard";
const PANEL_DEFINITIONS = [
  ["cost", "Cost", "Projected spend, category totals, run cost, and budget headroom."],
  ["tokens", "Tokens", "Input, output, cache, and provider-bound token projections."],
  ["latency", "Latency", "Run runtime seconds and latency posture by workflow."],
  ["errors", "Errors", "Open projected errors and trace binding posture."],
  ["retries", "Retries", "Manual retry, timeout, and resume state visibility."],
  ["rollups", "Provider/runtime", "Provider cost category plus runtime token, cost, latency, error, and retry rollups."],
];

export async function runCostObservabilityDashboard(options = {}) {
  const result = await buildCostObservabilityDashboard(options);
  if (options.write !== false) await writeCostObservabilityDashboard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Cost/Observability Dashboard failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCostObservabilityDashboard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = JSON.parse(await readText(inputs.package_json_path));
  const roadmapText = await readText(inputs.roadmap_path);
  const implementationRoadmapText = await readText(inputs.implementation_roadmap_path);
  const reviewDashboardText = await readText(inputs.review_dashboard_path);
  const reviewApiText = await readText(inputs.review_api_path);
  const reviewApiDocText = await readText(inputs.review_api_doc_path);
  const sources = {
    observabilityCatalog: await readJson(inputs.observability_catalog_path),
    costBudgetLedger: await readJson(inputs.cost_budget_ledger_path),
    tokenUsageLedger: await readJson(inputs.token_usage_ledger_path),
    costAttributionLedger: await readJson(inputs.cost_attribution_ledger_path),
    costRecordProjection: await readJson(inputs.cost_record_projection_path),
    tokenUsageProjection: await readJson(inputs.token_usage_projection_path),
    observabilityTraceProjection: await readJson(inputs.observability_trace_projection_path),
    errorRetryLedger: await readJson(inputs.error_retry_ledger_path),
    observabilityFreeze: await readJson(inputs.observability_freeze_path),
    policyViolationQueue: await readJson(inputs.policy_violation_queue_path),
  };

  const costRows = buildCostRows({ sources, generatedAt });
  const tokenRows = buildTokenRows({ sources, generatedAt });
  const latencyRows = buildLatencyRows({ sources, generatedAt });
  const errorRows = buildErrorRows({ sources, generatedAt });
  const retryRows = buildRetryRows({ sources, generatedAt });
  const providerRuntimeRollups = buildProviderRuntimeRollups({ sources, costRows, tokenRows, latencyRows, errorRows, retryRows, generatedAt });
  const panels = buildPanels({ costRows, tokenRows, latencyRows, errorRows, retryRows, providerRuntimeRollups, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const checks = buildChecks({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    reviewDashboardText,
    reviewApiText,
    reviewApiDocText,
    sources,
    costRows,
    tokenRows,
    latencyRows,
    errorRows,
    retryRows,
    providerRuntimeRollups,
    panels,
    boundary,
    generatedAt,
  });
  const validation = summarizeValidation(checks);
  const summary = buildSummary({ sources, costRows, tokenRows, latencyRows, errorRows, retryRows, providerRuntimeRollups, panels, checks, validation, boundary, generatedAt });
  const result = {
    schema_version: "cost-observability-dashboard.v1",
    cost_observability_dashboard_id: summary.cost_observability_dashboard_id,
    cost_observability_dashboard_status: summary.cost_observability_dashboard_status,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    generated_at: generatedAt,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources),
    cost_observability_dashboard_contract: buildDashboardContract(generatedAt),
    cost_observability_panels: panels,
    cost_observability_cost_rows: costRows,
    cost_observability_token_rows: tokenRows,
    cost_observability_latency_rows: latencyRows,
    cost_observability_error_rows: errorRows,
    cost_observability_retry_rows: retryRows,
    cost_observability_provider_runtime_rollups: providerRuntimeRollups,
    cost_observability_boundary: boundary,
    cost_observability_checks: checks,
    validation_items: checks,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

function buildCostRows({ sources, generatedAt }) {
  const projectionCatalog = sources.costRecordProjection.cost_record_projection_catalog ?? {};
  const attribution = sources.costAttributionLedger;
  const rows = [];
  for (const row of projectionCatalog.cost_category_rollups ?? []) {
    rows.push({
      schema_version: "cost-observability-cost-row.v1",
      cost_observability_cost_row_id: `cost-observability-cost.category.${slugify(row.cost_category)}`,
      cost_row_type: "category_rollup",
      cost_row_status: "ready",
      cost_category: row.cost_category,
      workflow_run_id: null,
      run_ledger_id: null,
      runtime_id: null,
      capability_id: null,
      domain_pack: null,
      matter_id: null,
      projected_cost_record_count: row.projected_cost_record_count ?? 0,
      total_observed_usd: number(row.total_observed_usd),
      total_estimated_usd: number(row.total_estimated_usd),
      total_projected_usd: number(row.total_projected_usd),
      total_budget_usd: 0,
      total_budget_remaining_usd: 0,
      total_token_count: number(row.total_token_count),
      total_runtime_seconds: number(row.total_runtime_seconds),
      api_invocation_count: 0,
      storage_artifact_count: 0,
      over_budget_count: 0,
      pricing_status: row.unpriced_record_count > 0 ? "partially_unpriced" : "priced_or_estimated",
      read_only: true,
      preview_only: true,
      generated_at: generatedAt,
    });
  }
  for (const row of projectionCatalog.run_cost_rollups ?? []) {
    rows.push({
      schema_version: "cost-observability-cost-row.v1",
      cost_observability_cost_row_id: `cost-observability-cost.run.${slugify(row.workflow_run_id)}`,
      cost_row_type: "run_rollup",
      cost_row_status: "ready",
      cost_category: "run_total",
      workflow_run_id: row.workflow_run_id,
      run_ledger_id: row.run_ledger_id ?? null,
      runtime_id: null,
      capability_id: row.capability_id ?? null,
      domain_pack: row.domain_pack ?? null,
      matter_id: row.matter_id ?? null,
      projected_cost_record_count: row.projected_cost_record_count ?? 0,
      total_observed_usd: number(row.total_observed_usd),
      total_estimated_usd: number(row.total_estimated_usd),
      total_projected_usd: number(row.total_projected_usd),
      total_budget_usd: 0,
      total_budget_remaining_usd: 0,
      total_token_count: number(row.total_token_count),
      total_runtime_seconds: number(row.total_runtime_seconds),
      api_invocation_count: row.api_invocation_count ?? 0,
      storage_artifact_count: row.storage_artifact_count ?? 0,
      over_budget_count: 0,
      pricing_status: row.pricing_status ?? "unknown",
      read_only: true,
      preview_only: true,
      generated_at: generatedAt,
    });
  }
  for (const row of attribution.rollups?.by_runtime_id ?? []) {
    rows.push({
      schema_version: "cost-observability-cost-row.v1",
      cost_observability_cost_row_id: `cost-observability-cost.runtime.${slugify(row.key)}`,
      cost_row_type: "runtime_rollup",
      cost_row_status: "ready",
      cost_category: "runtime_total",
      workflow_run_id: null,
      run_ledger_id: null,
      runtime_id: row.key,
      capability_id: null,
      domain_pack: null,
      matter_id: null,
      projected_cost_record_count: row.record_count ?? 0,
      total_observed_usd: number(row.total_observed_usd),
      total_estimated_usd: number(row.total_estimated_token_usd),
      total_projected_usd: number(row.total_projected_usd),
      total_budget_usd: number(row.total_budget_usd),
      total_budget_remaining_usd: Math.max(0, number(row.total_budget_usd) - number(row.total_projected_usd)),
      total_token_count: number(row.total_token_count),
      total_runtime_seconds: 0,
      api_invocation_count: 0,
      storage_artifact_count: 0,
      over_budget_count: row.over_budget_count ?? 0,
      pricing_status: row.over_budget_count > 0 ? "over_budget" : "within_budget",
      read_only: true,
      preview_only: true,
      generated_at: generatedAt,
    });
  }
  return rows.sort(by("cost_observability_cost_row_id"));
}

function buildTokenRows({ sources, generatedAt }) {
  const catalog = sources.tokenUsageProjection.token_usage_projection_catalog ?? {};
  const rows = [
    ...(catalog.runtime_token_rollups ?? []),
    ...(catalog.capability_token_rollups ?? []),
    ...(catalog.domain_pack_token_rollups ?? []),
    ...(catalog.tracking_status_token_rollups ?? []),
  ];
  return rows.map((row) => ({
    schema_version: "cost-observability-token-row.v1",
    cost_observability_token_row_id: `cost-observability-token.${slugify(row.rollup_type)}.${slugify(row.rollup_key)}`,
    token_row_status: "ready",
    rollup_type: row.rollup_type,
    rollup_key: row.rollup_key,
    runtime_id: row.runtime_id ?? null,
    capability_id: row.capability_id ?? null,
    domain_pack: row.domain_pack ?? null,
    matter_id: row.matter_id ?? null,
    tracking_status: row.tracking_status ?? null,
    projected_token_usage_record_count: row.projected_token_usage_record_count ?? 0,
    input_token_count: row.input_token_count ?? 0,
    output_token_count: row.output_token_count ?? 0,
    cache_token_count: row.cache_token_count ?? 0,
    total_token_count: row.total_token_count ?? 0,
    estimated_record_count: row.estimated_record_count ?? 0,
    recorded_record_count: row.recorded_record_count ?? 0,
    unknown_record_count: row.unknown_record_count ?? 0,
    provider_cost_projected_usd: number(row.provider_cost_projected_usd),
    read_only: true,
    preview_only: true,
    generated_at: generatedAt,
  })).sort(by("cost_observability_token_row_id"));
}

function buildLatencyRows({ sources, generatedAt }) {
  const runRollupsByWorkflow = new Map((sources.costRecordProjection.cost_record_projection_catalog?.run_cost_rollups ?? []).map((row) => [row.workflow_run_id, row]));
  return (sources.observabilityCatalog.run_records ?? []).map((row) => {
    const costRollup = runRollupsByWorkflow.get(row.workflow_run_id);
    const runtimeSeconds = number(costRollup?.total_runtime_seconds ?? row.runtime_seconds);
    return {
      schema_version: "cost-observability-latency-row.v1",
      cost_observability_latency_row_id: `cost-observability-latency.${slugify(row.workflow_run_id)}`,
      latency_row_status: "ready",
      workflow_run_id: row.workflow_run_id,
      run_ledger_id: row.run_id ?? null,
      run_status: row.status ?? null,
      capability_id: row.capability_id ?? null,
      domain_pack: row.domain_pack ?? null,
      matter_id: row.matter_id ?? null,
      runtime_ids: row.runtime_ids ?? [],
      runtime_seconds: runtimeSeconds,
      agent_run_count: row.agent_run_count ?? 0,
      event_count: row.event_count ?? 0,
      gate_count: row.gate_count ?? 0,
      failed_gate_count: row.failed_gate_count ?? 0,
      blocking_gate_count: row.blocking_gate_count ?? 0,
      pending_approval_count: row.pending_approval_count ?? 0,
      latency_status: runtimeSeconds > 30 ? "attention" : "nominal",
      started_at: row.started_at ?? null,
      updated_at: row.updated_at ?? null,
      read_only: true,
      preview_only: true,
      generated_at: generatedAt,
    };
  }).sort(by("cost_observability_latency_row_id"));
}

function buildErrorRows({ sources, generatedAt }) {
  return (sources.errorRetryLedger.error_retry_ledger_catalog?.projected_error_records ?? []).map((row) => ({
    schema_version: "cost-observability-error-row.v1",
    cost_observability_error_row_id: `cost-observability-error.${slugify(row.projected_error_record_id)}`,
    error_row_status: "open",
    projected_error_record_id: row.projected_error_record_id,
    source_error_record_id: row.source_error_record_id ?? null,
    error_kind: row.error_kind,
    error_type: row.error_type,
    severity: row.severity,
    error_status: row.error_status,
    failure_state: row.failure_state,
    retry_state: row.retry_state,
    timeout_state: row.timeout_state,
    resume_state: row.resume_state,
    workflow_run_id: row.workflow_run_id,
    run_ledger_id: row.run_ledger_id ?? null,
    runtime_id: row.runtime_id ?? null,
    domain_pack: row.domain_pack ?? null,
    observability_trace_id: row.observability_trace_id ?? null,
    correlation_trace_id: row.correlation_trace_id ?? null,
    trace_binding_status: row.trace_binding_status ?? "bound",
    read_only: true,
    preview_only: true,
    generated_at: generatedAt,
  })).sort(by("cost_observability_error_row_id"));
}

function buildRetryRows({ sources, generatedAt }) {
  const resumeByError = new Map((sources.errorRetryLedger.error_retry_ledger_catalog?.resume_state_records ?? []).map((row) => [row.projected_error_record_id, row]));
  const timeoutByError = new Map((sources.errorRetryLedger.error_retry_ledger_catalog?.timeout_records ?? []).map((row) => [row.projected_error_record_id, row]));
  return (sources.errorRetryLedger.error_retry_ledger_catalog?.retry_records ?? []).map((row) => {
    const resume = resumeByError.get(row.projected_error_record_id);
    const timeout = timeoutByError.get(row.projected_error_record_id);
    return {
      schema_version: "cost-observability-retry-row.v1",
      cost_observability_retry_row_id: `cost-observability-retry.${slugify(row.retry_record_id)}`,
      retry_row_status: "ready",
      retry_record_id: row.retry_record_id,
      projected_error_record_id: row.projected_error_record_id,
      workflow_run_id: row.workflow_run_id,
      run_ledger_id: row.run_ledger_id ?? null,
      error_kind: row.error_kind,
      error_type: row.error_type,
      retryable: Boolean(row.retryable),
      retry_count: row.retry_count ?? 0,
      retry_status: row.retry_status,
      retry_state: row.retry_state,
      auto_retry_scheduled: Boolean(row.auto_retry_scheduled),
      retry_schedule_state: row.retry_schedule_state,
      next_retry_action: row.next_retry_action ?? null,
      retry_policy_status: row.retry_policy_status ?? null,
      timeout_state: timeout?.timeout_state ?? null,
      timeout_observed: Boolean(timeout?.timeout_observed),
      latency_seconds: timeout?.latency_seconds ?? null,
      resume_state: resume?.resume_state ?? null,
      resume_required: Boolean(resume?.resume_required),
      resume_blocked: Boolean(resume?.resume_blocked),
      human_approval_required: Boolean(row.requires_human_before_retry ?? resume?.human_approval_required),
      read_only: true,
      preview_only: true,
      generated_at: generatedAt,
    };
  }).sort(by("cost_observability_retry_row_id"));
}

function buildProviderRuntimeRollups({ sources, costRows, tokenRows, latencyRows, errorRows, retryRows, generatedAt }) {
  const runtimeIds = new Set([
    ...Object.keys(sources.costRecordProjection.summary?.by_runtime_id ?? {}),
    ...Object.keys(sources.tokenUsageProjection.summary?.by_runtime_id ?? {}),
    ...latencyRows.flatMap((row) => row.runtime_ids ?? []),
    ...errorRows.map((row) => row.runtime_id).filter(Boolean),
  ]);
  const providerCostRow = costRows.find((row) => row.cost_row_type === "category_rollup" && row.cost_category === "provider");
  return [...runtimeIds].sort().map((runtimeId) => {
    const runtimeCostRows = costRows.filter((row) => row.runtime_id === runtimeId);
    const runtimeTokenRows = tokenRows.filter((row) => row.runtime_id === runtimeId);
    const runtimeLatencyRows = latencyRows.filter((row) => row.runtime_ids.includes(runtimeId));
    const runtimeErrorRows = errorRows.filter((row) => row.runtime_id === runtimeId || runtimeLatencyRows.some((latency) => latency.workflow_run_id === row.workflow_run_id));
    const runtimeRetryRows = retryRows.filter((row) => runtimeLatencyRows.some((latency) => latency.workflow_run_id === row.workflow_run_id));
    return {
      schema_version: "cost-observability-provider-runtime-rollup.v1",
      cost_observability_provider_runtime_rollup_id: `cost-observability-provider-runtime.${slugify(runtimeId)}`,
      rollup_status: "ready",
      provider_boundary: "provider_cost_category",
      runtime_id: runtimeId,
      cost_record_count: sum(runtimeCostRows, "projected_cost_record_count"),
      provider_cost_record_count: providerCostRow?.projected_cost_record_count ?? 0,
      total_projected_usd: round(sum(runtimeCostRows, "total_projected_usd")),
      provider_projected_usd: providerCostRow?.total_projected_usd ?? 0,
      total_budget_usd: round(sum(runtimeCostRows, "total_budget_usd")),
      total_budget_remaining_usd: round(sum(runtimeCostRows, "total_budget_remaining_usd")),
      total_token_count: sum(runtimeTokenRows, "total_token_count"),
      input_token_count: sum(runtimeTokenRows, "input_token_count"),
      output_token_count: sum(runtimeTokenRows, "output_token_count"),
      runtime_seconds: sum(runtimeLatencyRows, "runtime_seconds"),
      latency_row_count: runtimeLatencyRows.length,
      error_count: runtimeErrorRows.length,
      retry_record_count: runtimeRetryRows.length,
      retry_available_count: runtimeRetryRows.filter((row) => row.retry_state === "retry_available").length,
      auto_retry_scheduled_count: runtimeRetryRows.filter((row) => row.auto_retry_scheduled).length,
      read_only: true,
      preview_only: true,
      generated_at: generatedAt,
    };
  });
}

function buildPanels({ costRows, tokenRows, latencyRows, errorRows, retryRows, providerRuntimeRollups, generatedAt }) {
  const counts = {
    cost: costRows.length,
    tokens: tokenRows.length,
    latency: latencyRows.length,
    errors: errorRows.length,
    retries: retryRows.length,
    rollups: providerRuntimeRollups.length,
  };
  return PANEL_DEFINITIONS.map(([panelKey, panelLabel, description], index) => ({
    schema_version: "cost-observability-panel.v1",
    cost_observability_panel_id: `cost-observability-panel.${panelKey}`,
    panel_key: panelKey,
    panel_label: panelLabel,
    panel_order: index + 1,
    panel_status: "ready",
    description,
    row_count: counts[panelKey] ?? 0,
    read_only: true,
    preview_only: true,
    dashboard_projection_only: true,
    metric_write_allowed: false,
    runtime_control_allowed: false,
    retry_execution_allowed: false,
    budget_mutation_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    generated_at: generatedAt,
  }));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "cost-observability-boundary.v1",
    boundary_status: "enforced",
    generated_at: generatedAt,
    read_only: true,
    preview_only: true,
    dashboard_projection_only: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    metric_write_allowed: false,
    budget_mutation_allowed: false,
    runtime_control_performed: false,
    retry_execution_performed: false,
    approval_application_performed: false,
    protected_action_executed: false,
    delivery_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildDashboardContract(generatedAt) {
  return {
    schema_version: "cost-observability-dashboard-contract.v1",
    cost_observability_dashboard_contract_id: "cost-observability-dashboard.v1",
    generated_at: generatedAt,
    dashboard_rule: "Project token, cost, latency, error, retry, and provider/runtime rollup metadata into read-only Desktop dashboard rows.",
    source_rule: "Read only ledger/projection metadata and summaries; do not read source document or log content.",
    execution_rule: "Do not mutate budgets or metrics, control runtimes, schedule retries, apply approvals, deliver output, execute routes, or start servers.",
  };
}

function buildChecks({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  reviewDashboardText,
  reviewApiText,
  reviewApiDocText,
  sources,
  costRows,
  tokenRows,
  latencyRows,
  errorRows,
  retryRows,
  providerRuntimeRollups,
  panels,
  boundary,
  generatedAt,
}) {
  const checks = [];
  const check = (pathValue, checkId, passed, message) => checks.push({
    validation_item_id: `cost-observability-check.${slugify(checkId)}`,
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
    generated_at: generatedAt,
  });
  check("package.json.scripts", "script_registered", Boolean(packageJson.scripts?.["observability:cost-dashboard"]), "package.json registers observability:cost-dashboard.");
  check("docs.final_completion_ledger", "ledger_promotes_phase_295", includesAll(roadmapText, ["P295", "Cost/Observability Dashboard"]), "Final completion ledger tracks P295.");
  check("docs.implementation_roadmap", "implementation_roadmap_promotes_phase_295", includesAll(implementationRoadmapText, ["Phase 295 - Cost/Observability Dashboard", "cost_observability_dashboard"]), "Implementation roadmap documents Phase 295.");
  check("src.review_dashboard", "dashboard_registered", includesAll(reviewDashboardText, ["cost_observability_dashboard", "buildCostObservabilityDashboardStage"]), "Review Dashboard registers Cost/Observability Dashboard.");
  check("src.review_api", "review_api_registered", includesAll(reviewApiText, ["/api/cost-observability-dashboards", "/api/cost-observability-runtime-rollups"]), "Review API exposes Cost/Observability Dashboard routes.");
  check("docs.review_api", "review_api_doc_registered", includesAll(reviewApiDocText, ["Cost/Observability Dashboard routes", "/api/cost-observability-cost-rows"]), "Review API docs include Cost/Observability Dashboard routes.");
  check("sources.observability_catalog", "observability_catalog_ready", sourceStatus(sources.observabilityCatalog, "observability_catalog_status") !== "missing" && (sources.observabilityCatalog.summary?.workflow_run_count ?? 0) > 0, "Observability Catalog has workflow runs.");
  check("sources.cost_budget_ledger", "cost_budget_ledger_ready", sourceStatus(sources.costBudgetLedger, "ledger_status") === "valid", "Cost Budget Ledger is valid.");
  check("sources.token_usage_ledger", "token_usage_ledger_ready", sourceStatus(sources.tokenUsageLedger, "ledger_status") === "valid", "Token Usage Ledger is valid.");
  check("sources.cost_attribution_ledger", "cost_attribution_ledger_ready", sourceStatus(sources.costAttributionLedger, "ledger_status") === "valid", "Cost Attribution Ledger is valid.");
  check("sources.cost_record_projection", "cost_record_projection_ready", sourceStatus(sources.costRecordProjection, "cost_record_projection_status") === "complete", "Cost Record Projection is complete.");
  check("sources.token_usage_projection", "token_usage_projection_ready", sourceStatus(sources.tokenUsageProjection, "token_usage_projection_status") === "complete", "Token Usage Projection is complete.");
  check("sources.observability_trace_projection", "observability_trace_projection_ready", sourceStatus(sources.observabilityTraceProjection, "observability_trace_projection_status") === "complete", "Observability Trace Projection is complete.");
  check("sources.error_retry_ledger", "error_retry_ledger_ready", sourceStatus(sources.errorRetryLedger, "error_retry_ledger_status") === "complete", "Error/Retry Ledger is complete.");
  check("sources.observability_freeze", "observability_freeze_ready", sourceStatus(sources.observabilityFreeze, "observability_freeze_status") === "complete", "Observability Freeze is complete.");
  check("sources.policy_violation_queue", "policy_violation_queue_guard_ready", sources.policyViolationQueue.summary?.policy_violation_queue_status === "complete" && sources.policyViolationQueue.summary?.phase_slot === PREVIOUS_PHASE_SLOT && sources.policyViolationQueue.summary?.next_phase_slot === PHASE_SLOT, "P294 Policy Violation Queue guard is complete and points to P295.");
  check("cost_observability_panels", "required_panels_ready", panels.length === PANEL_DEFINITIONS.length && panels.every((panel) => panel.panel_status === "ready"), "All required dashboard panels are ready.");
  check("cost_observability_cost_rows", "cost_rows_present", costRows.length > 0, `${costRows.length} cost row(s) projected.`);
  check("cost_observability_token_rows", "token_rows_present", tokenRows.length > 0, `${tokenRows.length} token row(s) projected.`);
  check("cost_observability_latency_rows", "latency_rows_present", latencyRows.length > 0, `${latencyRows.length} latency row(s) projected.`);
  check("cost_observability_error_rows", "error_rows_present", errorRows.length > 0, `${errorRows.length} error row(s) projected.`);
  check("cost_observability_retry_rows", "retry_rows_present", retryRows.length > 0, `${retryRows.length} retry row(s) projected.`);
  check("cost_observability_provider_runtime_rollups", "provider_runtime_rollups_present", providerRuntimeRollups.length > 0, `${providerRuntimeRollups.length} provider/runtime rollup row(s) projected.`);
  check("cost_observability_runtime_rollups", "runtime_rollups_include_tokens_and_cost", providerRuntimeRollups.some((row) => row.total_token_count > 0) && providerRuntimeRollups.some((row) => row.total_projected_usd > 0), "Runtime rollups include token and cost totals.");
  check("cost_observability_boundary", "read_only_boundary_enforced", boundary.read_only && !boundary.metric_write_allowed && !boundary.budget_mutation_allowed && !boundary.runtime_control_performed && !boundary.retry_execution_performed && !boundary.delivery_execution_performed, "Read-only/no-execution boundary is enforced.");
  return checks;
}

function buildSummary({ sources, costRows, tokenRows, latencyRows, errorRows, retryRows, providerRuntimeRollups, panels, checks, validation, boundary, generatedAt }) {
  return {
    cost_observability_dashboard_status: validation.valid ? "complete" : "attention",
    cost_observability_dashboard_id: `cost-observability-dashboard.${dateStamp(generatedAt)}`,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_observability_workflow_run_count: sources.observabilityCatalog.summary?.workflow_run_count ?? 0,
    source_cost_budget_ledger_status: sourceStatus(sources.costBudgetLedger, "ledger_status"),
    source_token_usage_ledger_status: sourceStatus(sources.tokenUsageLedger, "ledger_status"),
    source_cost_attribution_ledger_status: sourceStatus(sources.costAttributionLedger, "ledger_status"),
    source_cost_record_projection_status: sourceStatus(sources.costRecordProjection, "cost_record_projection_status"),
    source_token_usage_projection_status: sourceStatus(sources.tokenUsageProjection, "token_usage_projection_status"),
    source_observability_trace_projection_status: sourceStatus(sources.observabilityTraceProjection, "observability_trace_projection_status"),
    source_error_retry_ledger_status: sourceStatus(sources.errorRetryLedger, "error_retry_ledger_status"),
    source_observability_freeze_status: sourceStatus(sources.observabilityFreeze, "observability_freeze_status"),
    source_policy_violation_queue_status: sources.policyViolationQueue.summary?.policy_violation_queue_status ?? "unknown",
    source_policy_violation_queue_phase_slot: sources.policyViolationQueue.summary?.phase_slot ?? null,
    source_policy_violation_queue_next_phase_slot: sources.policyViolationQueue.summary?.next_phase_slot ?? null,
    cost_observability_panel_count: panels.length,
    required_panel_count: PANEL_DEFINITIONS.length,
    ready_panel_count: panels.filter((panel) => panel.panel_status === "ready").length,
    cost_row_count: costRows.length,
    token_row_count: tokenRows.length,
    latency_row_count: latencyRows.length,
    error_row_count: errorRows.length,
    retry_row_count: retryRows.length,
    provider_runtime_rollup_count: providerRuntimeRollups.length,
    total_projected_usd: round(sum(costRows.filter((row) => row.cost_row_type === "category_rollup"), "total_projected_usd")),
    total_budget_usd: sources.costAttributionLedger.summary?.total_budget_usd ?? 0,
    total_budget_remaining_usd: sources.costAttributionLedger.summary?.total_budget_remaining_usd ?? 0,
    total_token_count: sources.tokenUsageProjection.summary?.total_token_count ?? 0,
    total_input_token_count: sources.tokenUsageProjection.summary?.total_input_token_count ?? 0,
    total_output_token_count: sources.tokenUsageProjection.summary?.total_output_token_count ?? 0,
    total_runtime_seconds: sum(latencyRows, "runtime_seconds"),
    open_error_count: errorRows.filter((row) => row.error_status === "open").length,
    retry_available_count: retryRows.filter((row) => row.retry_state === "retry_available").length,
    auto_retry_scheduled_count: retryRows.filter((row) => row.auto_retry_scheduled).length,
    timeout_observed_count: retryRows.filter((row) => row.timeout_observed).length,
    resume_blocked_count: retryRows.filter((row) => row.resume_blocked).length,
    read_only: boundary.read_only,
    preview_only: boundary.preview_only,
    dashboard_projection_only: boundary.dashboard_projection_only,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    metric_write_allowed: boundary.metric_write_allowed,
    budget_mutation_allowed: boundary.budget_mutation_allowed,
    runtime_control_performed: boundary.runtime_control_performed,
    retry_execution_performed: boundary.retry_execution_performed,
    approval_application_performed: boundary.approval_application_performed,
    protected_action_executed: boundary.protected_action_executed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: checks.length,
    failed_checkpoint_count: checks.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(providerRuntimeRollups, "runtime_id"),
    by_cost_row_type: countBy(costRows, "cost_row_type"),
    by_error_kind: countBy(errorRows, "error_kind"),
    by_retry_state: countBy(retryRows, "retry_state"),
  };
}

export async function writeCostObservabilityDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "cost-observability-dashboard.json"), serializable);
  await writeJson(path.join(outDir, "cost-observability-panels.json"), collectionEnvelope("cost-observability-panels.v1", "cost_observability_panels", result.cost_observability_panels, result.generated_at));
  await writeJson(path.join(outDir, "cost-observability-cost-rows.json"), collectionEnvelope("cost-observability-cost-rows.v1", "cost_observability_cost_rows", result.cost_observability_cost_rows, result.generated_at));
  await writeJson(path.join(outDir, "cost-observability-token-rows.json"), collectionEnvelope("cost-observability-token-rows.v1", "cost_observability_token_rows", result.cost_observability_token_rows, result.generated_at));
  await writeJson(path.join(outDir, "cost-observability-latency-rows.json"), collectionEnvelope("cost-observability-latency-rows.v1", "cost_observability_latency_rows", result.cost_observability_latency_rows, result.generated_at));
  await writeJson(path.join(outDir, "cost-observability-error-rows.json"), collectionEnvelope("cost-observability-error-rows.v1", "cost_observability_error_rows", result.cost_observability_error_rows, result.generated_at));
  await writeJson(path.join(outDir, "cost-observability-retry-rows.json"), collectionEnvelope("cost-observability-retry-rows.v1", "cost_observability_retry_rows", result.cost_observability_retry_rows, result.generated_at));
  await writeJson(path.join(outDir, "cost-observability-runtime-rollups.json"), collectionEnvelope("cost-observability-runtime-rollups.v1", "cost_observability_provider_runtime_rollups", result.cost_observability_provider_runtime_rollups, result.generated_at));
  await writeJson(path.join(outDir, "cost-observability-boundary.json"), result.cost_observability_boundary);
  await writeJson(path.join(outDir, "cost-observability-checks.json"), collectionEnvelope("cost-observability-checks.v1", "cost_observability_checks", result.cost_observability_checks, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    cost_observability_dashboard_id: result.cost_observability_dashboard_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [];
  lines.push("# Cost/Observability Dashboard");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.cost_observability_dashboard_status}`);
  lines.push("");
  lines.push(`- Projected USD: ${summary.total_projected_usd}`);
  lines.push(`- Tokens: ${summary.total_token_count}`);
  lines.push(`- Runtime seconds: ${summary.total_runtime_seconds}`);
  lines.push(`- Errors/retries: ${summary.open_error_count}/${summary.retry_available_count}`);
  lines.push(`- Runtime rollups: ${summary.provider_runtime_rollup_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Boundary");
  lines.push("- Read-only dashboard projection.");
  lines.push("- No metric writes, budget mutation, runtime control, retry execution, delivery, route execution, legal advice, or client-facing output.");
  return `${lines.join("\n")}\n`;
}

export async function runCostObservabilityDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runCostObservabilityDashboard(args);
    console.log(`Cost/Observability Dashboard validated at ${result.output_dir}`);
    console.log(`Status: ${result.summary.cost_observability_dashboard_status}`);
    console.log(`Cost/token/latency/error/retry/rollup rows: ${result.summary.cost_row_count}/${result.summary.token_row_count}/${result.summary.latency_row_count}/${result.summary.error_row_count}/${result.summary.retry_row_count}/${result.summary.provider_runtime_rollup_count}`);
    console.log(`Projected USD: ${result.summary.total_projected_usd}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildSourceContracts(sources) {
  return {
    observability_catalog: sourceContract(sources.observabilityCatalog, "observability_catalog_status"),
    cost_budget_ledger: sourceContract(sources.costBudgetLedger, "ledger_status"),
    token_usage_ledger: sourceContract(sources.tokenUsageLedger, "ledger_status"),
    cost_attribution_ledger: sourceContract(sources.costAttributionLedger, "ledger_status"),
    cost_record_projection: sourceContract(sources.costRecordProjection, "cost_record_projection_status"),
    token_usage_projection: sourceContract(sources.tokenUsageProjection, "token_usage_projection_status"),
    observability_trace_projection: sourceContract(sources.observabilityTraceProjection, "observability_trace_projection_status"),
    error_retry_ledger: sourceContract(sources.errorRetryLedger, "error_retry_ledger_status"),
    observability_freeze: sourceContract(sources.observabilityFreeze, "observability_freeze_status"),
    policy_violation_queue: sourceContract(sources.policyViolationQueue, "policy_violation_queue_status"),
  };
}

function sourceContract(artifact, statusField) {
  return {
    schema_version: artifact.schema_version ?? null,
    status: sourceStatus(artifact, statusField),
    generated_at: artifact.generated_at ?? null,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
  };
}

function sourceStatus(artifact, statusField) {
  return artifact.summary?.[statusField] ?? artifact[statusField] ?? "unknown";
}

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "passed"),
    errors: items.filter((item) => item.status === "failed").map((item) => ({
      path: item.path,
      message: item.message,
      check_id: item.check_id,
    })),
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sum(rows, key) {
  return round(rows.reduce((total, row) => total + number(row[key]), 0));
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function round(value) {
  return Math.round(number(value) * 1_000_000) / 1_000_000;
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function includesAll(text, needles) {
  return needles.every((needle) => text.includes(needle));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function readJson(filePath) {
  return JSON.parse(await readText(filePath));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  return {
    package_json_path: path.resolve(options.packageJsonPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.packageJsonPath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.implementationRoadmapPath),
    review_dashboard_path: path.resolve(options.reviewDashboardPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.reviewDashboardPath),
    review_api_path: path.resolve(options.reviewApiPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.reviewApiPath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.reviewApiDocPath),
    observability_catalog_path: path.resolve(options.observabilityCatalogPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.observabilityCatalogPath),
    cost_budget_ledger_path: path.resolve(options.costBudgetLedgerPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.costBudgetLedgerPath),
    token_usage_ledger_path: path.resolve(options.tokenUsageLedgerPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.tokenUsageLedgerPath),
    cost_attribution_ledger_path: path.resolve(options.costAttributionLedgerPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.costAttributionLedgerPath),
    cost_record_projection_path: path.resolve(options.costRecordProjectionPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.costRecordProjectionPath),
    token_usage_projection_path: path.resolve(options.tokenUsageProjectionPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.tokenUsageProjectionPath),
    observability_trace_projection_path: path.resolve(options.observabilityTraceProjectionPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.observabilityTraceProjectionPath),
    error_retry_ledger_path: path.resolve(options.errorRetryLedgerPath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.errorRetryLedgerPath),
    observability_freeze_path: path.resolve(options.observabilityFreezePath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.observabilityFreezePath),
    policy_violation_queue_path: path.resolve(options.policyViolationQueuePath ?? DEFAULT_COST_OBSERVABILITY_DASHBOARD_INPUTS.policyViolationQueuePath),
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
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--cost-budget") parsed.costBudgetLedgerPath = argv[++index];
    else if (arg === "--token-usage") parsed.tokenUsageLedgerPath = argv[++index];
    else if (arg === "--cost-attribution") parsed.costAttributionLedgerPath = argv[++index];
    else if (arg === "--cost-record-projection") parsed.costRecordProjectionPath = argv[++index];
    else if (arg === "--token-usage-projection") parsed.tokenUsageProjectionPath = argv[++index];
    else if (arg === "--observability-traces") parsed.observabilityTraceProjectionPath = argv[++index];
    else if (arg === "--error-retry") parsed.errorRetryLedgerPath = argv[++index];
    else if (arg === "--observability-freeze") parsed.observabilityFreezePath = argv[++index];
    else if (arg === "--policy-violation-queue") parsed.policyViolationQueuePath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/cost-observability-dashboard.mjs [--check] [--out-dir DIR]");
}
