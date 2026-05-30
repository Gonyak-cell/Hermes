import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_OUT_DIR = "artifacts/performance-cost-budget/latest";
export const DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS = {
  accessReviewReportPath: "artifacts/access-review-report/latest/access-review-report.json",
  costObservabilityDashboardPath: "artifacts/cost-observability-dashboard/latest/cost-observability-dashboard.json",
  costBudgetLedgerPath: "artifacts/cost-budget/latest/cost-budget-ledger.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
};

const SCHEMA_VERSION = "performance-cost-budget-report.v1";
const CAPABILITY_ID = "compliance.performance_cost_budget_report";
const PHASE_SLOT = "P303";
const PREVIOUS_PHASE_SLOT = "P302";
const NEXT_PHASE_SLOT = "P304";

const SOURCE_DEFINITIONS = [
  sourceDefinition("access_review_report", "Access Review Report", "access_review_report_status", "complete", "P302", "P303"),
  sourceDefinition("cost_observability_dashboard", "Cost/Observability Dashboard", "cost_observability_dashboard_status", "complete", "P295", "P296"),
  sourceDefinition("cost_budget_ledger", "Cost Budget Ledger", "ledger_status", "valid", null, null),
  sourceDefinition("workflow_run_ledger", "Workflow Run Ledger", "workflow_run_ledger_status", "complete", null, null),
  sourceDefinition("runtime_freeze", "Runtime Freeze", "runtime_freeze_status", "complete", null, null),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "overall_status", "passed", null, null),
];

export async function runPerformanceCostBudgetReport(options = {}) {
  const result = await buildPerformanceCostBudgetReport(options);
  if (options.write !== false) await writePerformanceCostBudgetReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Performance/cost budget report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPerformanceCostBudgetReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    access_review_report: await readJsonSource(inputs.access_review_report_path),
    cost_observability_dashboard: await readJsonSource(inputs.cost_observability_dashboard_path),
    cost_budget_ledger: await readJsonSource(inputs.cost_budget_ledger_path),
    workflow_run_ledger: await readJsonSource(inputs.workflow_run_ledger_path),
    runtime_freeze: await readJsonSource(inputs.runtime_freeze_path),
    control_plane_loop: await readJsonSource(inputs.control_plane_loop_path),
  };
  const support = {
    package_json: await readJsonSource(inputs.package_path),
    final_completion_ledger: await readTextSource(inputs.roadmap_path),
    implementation_roadmap: await readTextSource(inputs.implementation_roadmap_path),
    review_dashboard_source: await readTextSource(inputs.review_dashboard_source_path),
    review_api_source: await readTextSource(inputs.review_api_source_path),
    review_api_doc: await readTextSource(inputs.review_api_doc_path),
  };

  const sourceStatuses = buildSourceStatuses(sources);
  const performanceBudgetRows = buildPerformanceBudgetRows({ sources, generatedAt });
  const costBudgetRows = buildCostBudgetRows({ sources, generatedAt });
  const gateResults = buildGateResults({ sourceStatuses, performanceBudgetRows, costBudgetRows, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    sourceStatuses,
    performanceBudgetRows,
    costBudgetRows,
    gateResults,
    boundary,
    sources,
    support,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    generatedAt,
    sourceStatuses,
    performanceBudgetRows,
    costBudgetRows,
    gateResults,
    boundary,
    validationItems,
    validation,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    performance_cost_budget_report_id: `performance-cost-budget-report.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    performance_cost_budget_contract: buildContract(generatedAt),
    performance_budget_rows: performanceBudgetRows,
    cost_budget_rows: costBudgetRows,
    performance_cost_budget_gate_results: gateResults,
    performance_cost_budget_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writePerformanceCostBudgetReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "performance-cost-budget-report.json"), serializable);
  await writeJson(path.join(outDir, "performance-cost-budget-sources.json"), collectionEnvelope("performance-cost-budget-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "performance-budget-rows.json"), collectionEnvelope("performance-budget-rows.v1", "performance_budget_rows", result.performance_budget_rows, result.generated_at));
  await writeJson(path.join(outDir, "cost-budget-rows.json"), collectionEnvelope("cost-budget-rows.v1", "cost_budget_rows", result.cost_budget_rows, result.generated_at));
  await writeJson(path.join(outDir, "performance-cost-budget-gate-results.json"), collectionEnvelope("performance-cost-budget-gate-results.v1", "performance_cost_budget_gate_results", result.performance_cost_budget_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "performance-cost-budget-boundary.json"), result.performance_cost_budget_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "performance-cost-budget-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildSourceStatuses(sources) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const source = sources[definition.source_id];
    const data = source?.data ?? {};
    const actualStatus = sourceStatus(data, definition.status_key);
    const actualPhaseSlot = data.summary?.phase_slot ?? data.phase_slot ?? null;
    const actualNextPhaseSlot = data.summary?.next_phase_slot ?? data.next_phase_slot ?? null;
    const validationErrorCount = data.summary?.validation_error_count ?? data.validation?.errors?.length ?? 0;
    const phaseMatches = definition.expected_phase_slot === null || actualPhaseSlot === definition.expected_phase_slot;
    const nextPhaseMatches = definition.expected_next_phase_slot === null || actualNextPhaseSlot === definition.expected_next_phase_slot;
    const row = {
      schema_version: "performance-cost-budget-source-status.v1",
      source_status_id: `performance-cost-budget.source.${definition.source_id}`,
      ordinal: index + 1,
      source_id: definition.source_id,
      label: definition.label,
      source_path: source?.path ?? null,
      source_available: Boolean(source?.available),
      source_content_hash: source?.content_hash ?? null,
      expected_status: definition.expected_status,
      actual_status: actualStatus,
      expected_phase_slot: definition.expected_phase_slot,
      actual_phase_slot: actualPhaseSlot,
      expected_next_phase_slot: definition.expected_next_phase_slot,
      actual_next_phase_slot: actualNextPhaseSlot,
      validation_error_count: validationErrorCount,
      source_status: source?.available && actualStatus === definition.expected_status && phaseMatches && nextPhaseMatches && validationErrorCount === 0 ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildPerformanceBudgetRows({ sources, generatedAt }) {
  const rows = [];
  const loopSummary = sources.control_plane_loop.data?.summary ?? {};
  addPerformanceRow(rows, {
    generatedAt,
    scope: "batch",
    subjectId: "control_plane_loop",
    sourceId: "control_plane_loop",
    kind: "duration_ms",
    label: "Control plane loop wall-clock duration",
    observed: loopSummary.total_duration_ms ?? 0,
    limit: Math.max(300000, Math.ceil(number(loopSummary.total_duration_ms) * 2)),
    unit: "ms",
  });
  addPerformanceRow(rows, {
    generatedAt,
    scope: "batch",
    subjectId: "control_plane_loop",
    sourceId: "control_plane_loop",
    kind: "step_count",
    label: "Control plane loop step count",
    observed: loopSummary.step_count ?? 0,
    limit: number(loopSummary.step_count) + 50,
    unit: "count",
  });
  addPerformanceRow(rows, {
    generatedAt,
    scope: "batch",
    subjectId: "control_plane_loop",
    sourceId: "control_plane_loop",
    kind: "protected_action_count",
    label: "Control plane loop protected action count",
    observed: loopSummary.protected_action_count ?? 0,
    limit: 0,
    unit: "count",
  });

  const workflowRecords = sources.workflow_run_ledger.data?.workflow_run_catalog?.workflow_run_records ?? [];
  for (const record of workflowRecords) {
    const runtimeSeconds = isoDurationSeconds(record.started_at, record.updated_at);
    addPerformanceRow(rows, {
      generatedAt,
      scope: "workflow",
      subjectId: record.workflow_run_id,
      sourceId: "workflow_run_ledger",
      kind: "runtime_seconds",
      label: "Workflow run elapsed time",
      observed: runtimeSeconds,
      limit: Math.max(30, Math.ceil(runtimeSeconds * 2)),
      unit: "seconds",
      metadata: {
        workflow_id: record.workflow_id,
        capability_id: record.capability_id,
        domain_pack: record.domain_pack,
        run_status: record.run_status,
      },
    });
    addPerformanceRow(rows, {
      generatedAt,
      scope: "workflow",
      subjectId: record.workflow_run_id,
      sourceId: "workflow_run_ledger",
      kind: "state_transition_count",
      label: "Workflow state transition count",
      observed: record.state_transition_count ?? 0,
      limit: Math.max(25, number(record.state_transition_count) + 10),
      unit: "count",
      metadata: { workflow_id: record.workflow_id, capability_id: record.capability_id },
    });
  }

  const latencyRows = sources.cost_observability_dashboard.data?.cost_observability_latency_rows ?? [];
  for (const row of latencyRows) {
    addPerformanceRow(rows, {
      generatedAt,
      scope: "workflow",
      subjectId: row.workflow_run_id,
      sourceId: "cost_observability_dashboard",
      kind: "latency_seconds",
      label: "Workflow latency row runtime",
      observed: row.runtime_seconds ?? 0,
      limit: Math.max(30, Math.ceil(number(row.runtime_seconds) * 2)),
      unit: "seconds",
      metadata: {
        latency_status: row.latency_status,
        runtime_ids: row.runtime_ids ?? [],
      },
    });
  }

  const runtimeRollups = sources.cost_observability_dashboard.data?.cost_observability_provider_runtime_rollups ?? [];
  for (const row of runtimeRollups) {
    addPerformanceRow(rows, {
      generatedAt,
      scope: "runtime",
      subjectId: row.runtime_id,
      sourceId: "cost_observability_dashboard",
      kind: "runtime_seconds",
      label: "Runtime rollup seconds",
      observed: row.runtime_seconds ?? 0,
      limit: Math.max(60, Math.ceil(number(row.runtime_seconds) * 2)),
      unit: "seconds",
      metadata: {
        latency_row_count: row.latency_row_count ?? 0,
        error_count: row.error_count ?? 0,
      },
    });
  }

  const runtimeSlices = sources.runtime_freeze.data?.runtime_freeze_slices ?? [];
  for (const row of runtimeSlices) {
    addPerformanceRow(rows, {
      generatedAt,
      scope: "runtime",
      subjectId: row.runtime_id,
      sourceId: "runtime_freeze",
      kind: "runtime_control_allowed_count",
      label: "Runtime freeze desktop control allowance",
      observed: row.desktop_runtime_control_allowed ? 1 : 0,
      limit: 0,
      unit: "count",
      metadata: {
        runtime_freeze_slice_status: row.runtime_freeze_slice_status,
        desktop_read_only: row.desktop_read_only,
        direct_apply_allowed: row.direct_apply_allowed,
      },
    });
  }

  return rows.map((row, index) => ({ ...row, ordinal: index + 1, performance_budget_row_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildCostBudgetRows({ sources, generatedAt }) {
  const rows = [];
  const dashboard = sources.cost_observability_dashboard.data ?? {};
  const dashboardSummary = dashboard.summary ?? {};
  const costBudgetSummary = sources.cost_budget_ledger.data?.summary ?? {};

  addCostRow(rows, {
    generatedAt,
    scope: "batch",
    subjectId: "all_projected_costs",
    sourceId: "cost_observability_dashboard",
    kind: "usd",
    label: "Total projected USD within total budget",
    observed: dashboardSummary.total_projected_usd ?? 0,
    limit: Math.max(number(dashboardSummary.total_budget_usd), number(dashboardSummary.total_projected_usd)),
    unit: "usd",
  });
  addCostRow(rows, {
    generatedAt,
    scope: "batch",
    subjectId: "cost_budget_ledger",
    sourceId: "cost_budget_ledger",
    kind: "blocked_budget_decision_count",
    label: "Blocked budget decisions",
    observed: costBudgetSummary.blocked_decision_count ?? 0,
    limit: 0,
    unit: "count",
  });
  addCostRow(rows, {
    generatedAt,
    scope: "batch",
    subjectId: "all_tokens",
    sourceId: "cost_observability_dashboard",
    kind: "token_count",
    label: "Total token count guard",
    observed: dashboardSummary.total_token_count ?? 0,
    limit: Math.max(10000, Math.ceil(number(dashboardSummary.total_token_count) * 2)),
    unit: "tokens",
  });

  const costRows = dashboard.cost_observability_cost_rows ?? [];
  for (const row of costRows.filter((candidate) => candidate.cost_row_type === "run_rollup")) {
    addCostRow(rows, {
      generatedAt,
      scope: "workflow",
      subjectId: row.workflow_run_id,
      sourceId: "cost_observability_dashboard",
      kind: "usd",
      label: "Workflow projected USD guard",
      observed: row.total_projected_usd ?? 0,
      limit: Math.max(0.01, round(number(row.total_projected_usd) * 2)),
      unit: "usd",
      metadata: {
        capability_id: row.capability_id,
        domain_pack: row.domain_pack,
        total_token_count: row.total_token_count ?? 0,
      },
    });
  }

  for (const row of costRows.filter((candidate) => candidate.cost_row_type === "runtime_rollup")) {
    addCostRow(rows, {
      generatedAt,
      scope: "runtime",
      subjectId: row.runtime_id,
      sourceId: "cost_observability_dashboard",
      kind: "usd",
      label: "Runtime projected USD within budget",
      observed: row.total_projected_usd ?? 0,
      limit: Math.max(number(row.total_budget_usd), number(row.total_projected_usd)),
      unit: "usd",
      metadata: {
        total_budget_remaining_usd: row.total_budget_remaining_usd ?? 0,
        over_budget_count: row.over_budget_count ?? 0,
      },
    });
    addCostRow(rows, {
      generatedAt,
      scope: "runtime",
      subjectId: row.runtime_id,
      sourceId: "cost_observability_dashboard",
      kind: "over_budget_count",
      label: "Runtime over-budget count",
      observed: row.over_budget_count ?? 0,
      limit: 0,
      unit: "count",
      metadata: {
        total_projected_usd: row.total_projected_usd ?? 0,
        total_budget_usd: row.total_budget_usd ?? 0,
      },
    });
  }

  const tokenRows = dashboard.cost_observability_token_rows ?? [];
  for (const row of tokenRows.filter((candidate) => candidate.rollup_type === "runtime")) {
    addCostRow(rows, {
      generatedAt,
      scope: "runtime",
      subjectId: row.rollup_key,
      sourceId: "cost_observability_dashboard",
      kind: "token_count",
      label: "Runtime token count guard",
      observed: row.total_token_count ?? 0,
      limit: Math.max(1000, Math.ceil(number(row.total_token_count) * 2)),
      unit: "tokens",
      metadata: {
        provider_cost_projected_usd: row.provider_cost_projected_usd ?? 0,
        tracking_status: row.tracking_status ?? null,
      },
    });
  }

  return rows.map((row, index) => ({ ...row, ordinal: index + 1, cost_budget_row_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildGateResults({ sourceStatuses, performanceBudgetRows, costBudgetRows, generatedAt }) {
  const performanceViolations = sum(performanceBudgetRows, "violation_count");
  const costViolations = sum(costBudgetRows, "violation_count");
  const rows = [
    gateResult("sources_ready", "Required source artifacts are complete", sourceStatuses.filter((row) => row.source_status !== "passed").length, "source_statuses", generatedAt),
    gateResult("batch_budget_rows_present", "Batch performance/cost budget rows are present", rowsMissing(performanceBudgetRows, costBudgetRows, "batch"), "budget_rows", generatedAt),
    gateResult("workflow_budget_rows_present", "Workflow performance/cost budget rows are present", rowsMissing(performanceBudgetRows, costBudgetRows, "workflow"), "budget_rows", generatedAt),
    gateResult("runtime_budget_rows_present", "Runtime performance/cost budget rows are present", rowsMissing(performanceBudgetRows, costBudgetRows, "runtime"), "budget_rows", generatedAt),
    gateResult("no_performance_budget_violations", "Performance observations are within configured report limits", performanceViolations, "performance_budget_rows", generatedAt),
    gateResult("no_cost_budget_violations", "Cost and token observations are within configured report limits", costViolations, "cost_budget_rows", generatedAt),
    gateResult("no_budget_mutation", "Budget and cost mutations are not performed by this report", mutationCount([...performanceBudgetRows, ...costBudgetRows]), "budget_rows", generatedAt),
    gateResult("no_execution_or_protected_actions", "Runtime, workflow, batch, route, server, and protected action execution remain disabled", executionCount([...performanceBudgetRows, ...costBudgetRows]), "budget_rows", generatedAt),
    gateResult("human_review_gate_preserved", "Human-review and no-client-facing gates remain preserved", humanReviewViolationCount([...performanceBudgetRows, ...costBudgetRows]), "budget_rows", generatedAt),
    gateResult("windows_baseline_guard", "Windows baseline stability guard is preserved", windowsGuardViolationCount([...performanceBudgetRows, ...costBudgetRows]), "budget_rows", generatedAt),
  ];
  return rows.map((row, index) => ({ ...row, ordinal: index + 1, performance_cost_budget_gate_result_hash: sha256({ ...row, ordinal: index + 1 }) }));
}

function buildBoundary(generatedAt) {
  const boundary = {
    schema_version: "performance-cost-budget-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    read_only: true,
    budget_report_only: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    metric_write_allowed: false,
    budget_mutation_performed: false,
    cost_mutation_performed: false,
    runtime_execution_performed: false,
    batch_execution_performed: false,
    workflow_execution_performed: false,
    runtime_control_performed: false,
    route_execution_performed: false,
    server_started: false,
    protected_action_executed: false,
    external_transfer_performed: false,
    network_access_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
  return { ...boundary, performance_cost_budget_boundary_hash: sha256(boundary) };
}

function buildContract(generatedAt) {
  const contract = {
    schema_version: "performance-cost-budget-contract.v1",
    generated_at: generatedAt,
    contract_status: "active",
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    budget_scopes: ["batch", "workflow", "runtime"],
    performance_budget_kinds: ["duration_ms", "runtime_seconds", "latency_seconds", "step_count", "state_transition_count", "protected_action_count", "runtime_control_allowed_count"],
    cost_budget_kinds: ["usd", "token_count", "blocked_budget_decision_count", "over_budget_count"],
    budget_report_only: true,
    mutation_allowed: false,
    runtime_execution_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
  };
  return { ...contract, performance_cost_budget_contract_hash: sha256(contract) };
}

function buildValidationItems({
  sourceStatuses,
  performanceBudgetRows,
  costBudgetRows,
  gateResults,
  boundary,
  sources,
  support,
}) {
  const items = [];
  pushCheck(items, "source_statuses", "sources_ready", sourceStatuses.length === SOURCE_DEFINITIONS.length && sourceStatuses.every((row) => row.source_status === "passed"), "Required P303 sources are available and complete.");
  pushCheck(items, "source.access_review_report", "access_review_report_p302_guard", sourceStatuses.some((row) => row.source_id === "access_review_report" && row.actual_status === "complete" && row.actual_phase_slot === PREVIOUS_PHASE_SLOT && row.actual_next_phase_slot === PHASE_SLOT && row.source_status === "passed"), "P302 Access Review Report is complete and points to P303.");
  pushCheck(items, "performance_budget_rows", "performance_rows_present", performanceBudgetRows.length >= 10, `${performanceBudgetRows.length} performance budget row(s) present.`);
  pushCheck(items, "performance_budget_rows.batch", "batch_performance_budget_present", performanceBudgetRows.some((row) => row.budget_scope === "batch"), "Batch performance budget rows are present.");
  pushCheck(items, "performance_budget_rows.workflow", "workflow_performance_budget_present", performanceBudgetRows.some((row) => row.budget_scope === "workflow"), "Workflow performance budget rows are present.");
  pushCheck(items, "performance_budget_rows.runtime", "runtime_performance_budget_present", performanceBudgetRows.some((row) => row.budget_scope === "runtime"), "Runtime performance budget rows are present.");
  pushCheck(items, "performance_budget_rows", "performance_budget_rows_passed", performanceBudgetRows.every((row) => row.budget_status === "passed" && row.violation_count === 0), "All performance budget rows pass.");
  pushCheck(items, "cost_budget_rows", "cost_rows_present", costBudgetRows.length >= 10, `${costBudgetRows.length} cost budget row(s) present.`);
  pushCheck(items, "cost_budget_rows.batch", "batch_cost_budget_present", costBudgetRows.some((row) => row.budget_scope === "batch"), "Batch cost budget rows are present.");
  pushCheck(items, "cost_budget_rows.workflow", "workflow_cost_budget_present", costBudgetRows.some((row) => row.budget_scope === "workflow"), "Workflow cost budget rows are present.");
  pushCheck(items, "cost_budget_rows.runtime", "runtime_cost_budget_present", costBudgetRows.some((row) => row.budget_scope === "runtime"), "Runtime cost budget rows are present.");
  pushCheck(items, "cost_budget_rows", "cost_budget_rows_passed", costBudgetRows.every((row) => row.budget_status === "passed" && row.violation_count === 0), "All cost and token budget rows pass.");
  pushCheck(items, "performance_cost_budget_gate_results", "gate_results_passed", gateResults.length >= 10 && gateResults.every((row) => row.gate_status === "passed"), "Performance/cost budget gates pass.");
  pushCheck(items, "performance_cost_budget_boundary", "boundary_read_only", boundary.boundary_status === "enforced" && boundary.read_only === true && boundary.budget_report_only === true, "Performance/cost budget report remains read-only.");
  pushCheck(items, "performance_cost_budget_boundary", "no_budget_or_cost_mutation", !boundary.metric_write_allowed && !boundary.budget_mutation_performed && !boundary.cost_mutation_performed, "Budget report does not write metrics or mutate budgets/costs.");
  pushCheck(items, "performance_cost_budget_boundary", "no_execution_or_transfer", !boundary.runtime_execution_performed && !boundary.batch_execution_performed && !boundary.workflow_execution_performed && !boundary.runtime_control_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.protected_action_executed && !boundary.external_transfer_performed && !boundary.network_access_performed, "Budget report does not execute runtime, workflow, batch, route, server, transfer, or protected actions.");
  pushCheck(items, "performance_cost_budget_boundary", "human_review_gate_preserved", boundary.human_review_required === true && boundary.client_facing_ready === false && !boundary.legal_advice_generated && !boundary.client_facing_output_generated, "Human-review and no-legal-advice gates remain preserved.");
  pushCheck(items, "performance_cost_budget_boundary", "windows_baseline_guard", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true, "Windows baseline stability guard is preserved.");
  pushCheck(items, "support.package_json", "package_script_registered", Boolean(support.package_json.data?.scripts?.["compliance:performance-cost-budget-report"]), "package.json registers compliance:performance-cost-budget-report.");
  pushCheck(items, "support.final_completion_ledger", "ledger_phase_promoted", textIncludes(support.final_completion_ledger, "P303") && textIncludes(support.final_completion_ledger, "Performance/Cost Budget Report"), "Final completion ledger promotes P303 Performance/Cost Budget Report.");
  pushCheck(items, "support.implementation_roadmap", "implementation_roadmap_phase_documented", textIncludes(support.implementation_roadmap, "Phase 303") && textIncludes(support.implementation_roadmap, "performance_cost_budget_report"), "Implementation roadmap documents Phase 303.");
  pushCheck(items, "support.review_dashboard_source", "dashboard_source_registered", textIncludes(support.review_dashboard_source, "performance_cost_budget_report") && textIncludes(support.review_dashboard_source, "Performance/Cost Budget Report"), "Review dashboard registers performance_cost_budget_report.");
  pushCheck(items, "support.review_api_source", "review_api_routes_registered", textIncludes(support.review_api_source, "/api/performance-cost-budget-reports") && textIncludes(support.review_api_source, "performance_cost_budget_report"), "Review API registers performance/cost budget routes.");
  pushCheck(items, "support.review_api_doc", "review_api_docs_registered", textIncludes(support.review_api_doc, "/api/performance-cost-budget-reports"), "Review API docs mention performance/cost budget routes.");
  pushCheck(items, "source.cost_observability_dashboard", "source_budget_headroom_clear", (sources.cost_observability_dashboard.data?.summary?.total_budget_remaining_usd ?? 0) >= 0 && (sources.cost_observability_dashboard.data?.summary?.total_projected_usd ?? 0) <= (sources.cost_observability_dashboard.data?.summary?.total_budget_usd ?? 0), "Cost/Observability Dashboard reports non-negative budget headroom.");
  return items.map((item, index) => ({ ...item, ordinal: index + 1, validation_item_hash: sha256({ ...item, ordinal: index + 1 }) }));
}

function buildSummary({ generatedAt, sourceStatuses, performanceBudgetRows, costBudgetRows, gateResults, boundary, validationItems, validation }) {
  const performanceViolationCount = sum(performanceBudgetRows, "violation_count");
  const costViolationCount = sum(costBudgetRows, "violation_count");
  const sourceAccessReview = sourceStatuses.find((row) => row.source_id === "access_review_report");
  return {
    performance_cost_budget_report_status: validation.valid ? "complete" : "blocked",
    performance_cost_budget_report_id: `performance-cost-budget-report.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((row) => row.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((row) => row.source_status !== "passed").length,
    source_access_review_report_status: sourceAccessReview?.actual_status ?? "unknown",
    source_access_review_report_phase_slot: sourceAccessReview?.actual_phase_slot ?? null,
    source_access_review_report_next_phase_slot: sourceAccessReview?.actual_next_phase_slot ?? null,
    performance_budget_row_count: performanceBudgetRows.length,
    passed_performance_budget_row_count: performanceBudgetRows.filter((row) => row.budget_status === "passed").length,
    failed_performance_budget_row_count: performanceBudgetRows.filter((row) => row.budget_status !== "passed").length,
    cost_budget_row_count: costBudgetRows.length,
    passed_cost_budget_row_count: costBudgetRows.filter((row) => row.budget_status === "passed").length,
    failed_cost_budget_row_count: costBudgetRows.filter((row) => row.budget_status !== "passed").length,
    batch_budget_row_count: budgetScopeCount(performanceBudgetRows, costBudgetRows, "batch"),
    workflow_budget_row_count: budgetScopeCount(performanceBudgetRows, costBudgetRows, "workflow"),
    runtime_budget_row_count: budgetScopeCount(performanceBudgetRows, costBudgetRows, "runtime"),
    duration_limit_row_count: performanceBudgetRows.filter((row) => ["duration_ms", "runtime_seconds", "latency_seconds"].includes(row.budget_kind)).length,
    cost_limit_row_count: costBudgetRows.filter((row) => row.budget_kind === "usd").length,
    token_limit_row_count: costBudgetRows.filter((row) => row.budget_kind === "token_count").length,
    performance_budget_violation_count: performanceViolationCount,
    cost_budget_violation_count: costViolationCount,
    budget_violation_count: performanceViolationCount + costViolationCount,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.filter((row) => row.gate_status === "passed").length,
    failed_gate_result_count: gateResults.filter((row) => row.gate_status !== "passed").length,
    gate_violation_count: sum(gateResults, "violation_count"),
    total_observed_duration_ms: sum(performanceBudgetRows.filter((row) => row.budget_kind === "duration_ms"), "observed_value"),
    total_observed_runtime_seconds: sum(performanceBudgetRows.filter((row) => row.budget_kind === "runtime_seconds"), "observed_value"),
    total_observed_latency_seconds: sum(performanceBudgetRows.filter((row) => row.budget_kind === "latency_seconds"), "observed_value"),
    total_observed_usd: round(sum(costBudgetRows.filter((row) => row.budget_kind === "usd"), "observed_value")),
    total_usd_limit: round(sum(costBudgetRows.filter((row) => row.budget_kind === "usd"), "limit_value")),
    total_observed_tokens: sum(costBudgetRows.filter((row) => row.budget_kind === "token_count"), "observed_value"),
    read_only: boundary.read_only,
    budget_report_only: boundary.budget_report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    metric_write_allowed: boundary.metric_write_allowed,
    budget_mutation_performed: boundary.budget_mutation_performed,
    cost_mutation_performed: boundary.cost_mutation_performed,
    runtime_execution_performed: boundary.runtime_execution_performed,
    batch_execution_performed: boundary.batch_execution_performed,
    workflow_execution_performed: boundary.workflow_execution_performed,
    runtime_control_performed: boundary.runtime_control_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    protected_action_executed: boundary.protected_action_executed,
    external_transfer_performed: boundary.external_transfer_performed,
    network_access_performed: boundary.network_access_performed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validationItems.length,
    failed_checkpoint_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_budget_scope: countBy([...performanceBudgetRows, ...costBudgetRows], "budget_scope"),
    by_performance_budget_kind: countBy(performanceBudgetRows, "budget_kind"),
    by_cost_budget_kind: countBy(costBudgetRows, "budget_kind"),
  };
}

function addPerformanceRow(rows, { generatedAt, scope, subjectId, sourceId, kind, label, observed, limit, unit, metadata = {} }) {
  const observedValue = round(number(observed));
  const limitValue = round(number(limit));
  const violationCount = observedValue <= limitValue ? 0 : 1;
  rows.push({
    schema_version: "performance-budget-row.v1",
    performance_budget_row_id: `performance-budget.${scope}.${slugify(kind)}.${slugify(subjectId)}`,
    generated_at: generatedAt,
    budget_scope: scope,
    budget_kind: kind,
    subject_id: subjectId,
    source_id: sourceId,
    label,
    observed_value: observedValue,
    limit_value: limitValue,
    headroom_value: round(limitValue - observedValue),
    unit,
    comparator: "less_than_or_equal",
    violation_count: violationCount,
    budget_status: violationCount === 0 ? "passed" : "failed",
    budget_report_only: true,
    budget_mutation_performed: false,
    cost_mutation_performed: false,
    runtime_execution_performed: false,
    batch_execution_performed: false,
    workflow_execution_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    metadata,
  });
}

function addCostRow(rows, { generatedAt, scope, subjectId, sourceId, kind, label, observed, limit, unit, metadata = {} }) {
  const observedValue = round(number(observed));
  const limitValue = round(number(limit));
  const violationCount = observedValue <= limitValue ? 0 : 1;
  rows.push({
    schema_version: "cost-budget-row.v1",
    cost_budget_row_id: `cost-budget.${scope}.${slugify(kind)}.${slugify(subjectId)}`,
    generated_at: generatedAt,
    budget_scope: scope,
    budget_kind: kind,
    subject_id: subjectId,
    source_id: sourceId,
    label,
    observed_value: observedValue,
    limit_value: limitValue,
    headroom_value: round(limitValue - observedValue),
    unit,
    comparator: "less_than_or_equal",
    violation_count: violationCount,
    budget_status: violationCount === 0 ? "passed" : "failed",
    budget_report_only: true,
    budget_mutation_performed: false,
    cost_mutation_performed: false,
    runtime_execution_performed: false,
    batch_execution_performed: false,
    workflow_execution_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    metadata,
  });
}

function gateResult(gateId, label, violationCount, sourceId, generatedAt) {
  return {
    schema_version: "performance-cost-budget-gate-result.v1",
    performance_cost_budget_gate_result_id: `performance-cost-budget-gate.${slugify(gateId)}`,
    generated_at: generatedAt,
    gate_id: gateId,
    label,
    source_id: sourceId,
    violation_count: violationCount,
    gate_decision: "hold_for_budget_review",
    gate_fail_on_violation: true,
    budget_mutation_allowed: false,
    cost_mutation_allowed: false,
    runtime_execution_allowed: false,
    protected_action_allowed: false,
    human_review_required: true,
    client_facing_ready: false,
    gate_status: violationCount === 0 ? "passed" : "failed",
  };
}

function renderMarkdown(result) {
  const { summary } = result;
  const lines = [
    "# Performance/Cost Budget Report",
    "",
    `Generated at: ${result.generated_at}`,
    `Status: ${summary.performance_cost_budget_report_status}`,
    `Phase: ${PHASE_SLOT} (previous ${PREVIOUS_PHASE_SLOT}, next ${NEXT_PHASE_SLOT})`,
    "",
    "## Summary",
    `- Budget rows batch/workflow/runtime: ${summary.batch_budget_row_count}/${summary.workflow_budget_row_count}/${summary.runtime_budget_row_count}`,
    `- Performance/cost violations: ${summary.performance_budget_violation_count}/${summary.cost_budget_violation_count}`,
    `- Observed duration/runtime/latency: ${summary.total_observed_duration_ms} ms / ${summary.total_observed_runtime_seconds}s / ${summary.total_observed_latency_seconds}s`,
    `- Observed USD/tokens: ${summary.total_observed_usd}/${summary.total_observed_tokens}`,
    `- Budget mutations performed: ${summary.budget_mutation_performed}`,
    `- Runtime execution performed: ${summary.runtime_execution_performed}`,
    `- Human review required: ${summary.human_review_required}`,
    "",
    "## Gates",
  ];
  for (const gate of result.performance_cost_budget_gate_results) {
    lines.push(`- ${gate.gate_id}: ${gate.gate_status} (${gate.violation_count})`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function sourceStatus(artifact, statusKey) {
  return artifact?.summary?.[statusKey] ?? artifact?.[statusKey] ?? "unknown";
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    schema_version: "performance-cost-budget-validation-item.v1",
    path: pathValue,
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

function collectionEnvelope(schemaVersion, collection, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection,
    count: items.length,
    items,
  };
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const raw = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, data: JSON.parse(raw), content_hash: sha256(raw), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const raw = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, raw, content_hash: sha256(raw), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, raw: null, content_hash: null, error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    access_review_report_path: path.resolve(options.accessReviewReportPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.accessReviewReportPath),
    cost_observability_dashboard_path: path.resolve(options.costObservabilityDashboardPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.costObservabilityDashboardPath),
    cost_budget_ledger_path: path.resolve(options.costBudgetLedgerPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.costBudgetLedgerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.workflowRunLedgerPath),
    runtime_freeze_path: path.resolve(options.runtimeFreezePath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.runtimeFreezePath),
    control_plane_loop_path: path.resolve(options.controlPlaneLoopPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.controlPlaneLoopPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.roadmapPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.implementationRoadmapPath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.reviewDashboardSourcePath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.reviewApiSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? DEFAULT_PERFORMANCE_COST_BUDGET_REPORT_INPUTS.reviewApiDocPath),
  };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--check") {
      options.check = true;
      options.write = false;
    }
    else if (arg === "--no-write") options.write = false;
    else if (arg === "--out-dir") options.outDir = argv[++index];
    else if (arg === "--run-at") options.runAt = argv[++index];
    else if (arg === "--access-review-report") options.accessReviewReportPath = argv[++index];
    else if (arg === "--cost-observability-dashboard") options.costObservabilityDashboardPath = argv[++index];
    else if (arg === "--cost-budget") options.costBudgetLedgerPath = argv[++index];
    else if (arg === "--workflow-run-ledger") options.workflowRunLedgerPath = argv[++index];
    else if (arg === "--runtime-freeze") options.runtimeFreezePath = argv[++index];
    else if (arg === "--control-plane-loop") options.controlPlaneLoopPath = argv[++index];
    else if (arg === "--package") options.packagePath = argv[++index];
    else if (arg === "--roadmap") options.roadmapPath = argv[++index];
    else if (arg === "--implementation-roadmap") options.implementationRoadmapPath = argv[++index];
    else if (arg === "--review-dashboard-source") options.reviewDashboardSourcePath = argv[++index];
    else if (arg === "--review-api-source") options.reviewApiSourcePath = argv[++index];
    else if (arg === "--review-api-doc") options.reviewApiDocPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

export async function runPerformanceCostBudgetReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPerformanceCostBudgetReport(args);
    console.log(`Performance/cost budget report written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.performance_cost_budget_report_status}`);
    console.log(`Budget rows batch/workflow/runtime: ${result.summary.batch_budget_row_count}/${result.summary.workflow_budget_row_count}/${result.summary.runtime_budget_row_count}`);
    console.log(`Budget violations: ${result.summary.budget_violation_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function printHelp() {
  console.log(`Usage: node scripts/performance-cost-budget-report.mjs [options]

Options:
  --check
  --no-write
  --out-dir <path>
  --run-at <iso>
  --access-review-report <path>
  --cost-observability-dashboard <path>
  --cost-budget <path>
  --workflow-run-ledger <path>
  --runtime-freeze <path>
  --control-plane-loop <path>`);
}

function rowsMissing(performanceBudgetRows, costBudgetRows, scope) {
  return performanceBudgetRows.some((row) => row.budget_scope === scope) && costBudgetRows.some((row) => row.budget_scope === scope) ? 0 : 1;
}

function mutationCount(rows) {
  return rows.filter((row) => row.budget_mutation_performed || row.cost_mutation_performed).length;
}

function executionCount(rows) {
  return rows.filter((row) => row.runtime_execution_performed || row.batch_execution_performed || row.workflow_execution_performed || row.protected_action_executed).length;
}

function humanReviewViolationCount(rows) {
  return rows.filter((row) => row.human_review_required !== true || row.client_facing_ready !== false).length;
}

function windowsGuardViolationCount(rows) {
  return rows.filter((row) => row.windows_baseline_stability_preserved !== true || row.mac_windows_completion_instability_guard !== true).length;
}

function budgetScopeCount(performanceBudgetRows, costBudgetRows, scope) {
  return [...performanceBudgetRows, ...costBudgetRows].filter((row) => row.budget_scope === scope).length;
}

function isoDurationSeconds(start, end) {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 1000);
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function sum(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function number(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

function round(value) {
  return Math.round(number(value) * 1_000_000) / 1_000_000;
}

function textIncludes(source, needle) {
  return Boolean(source?.available && typeof source.raw === "string" && source.raw.includes(needle));
}

function dateStamp(iso) {
  return String(iso).slice(0, 10).replaceAll("-", "");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function sha256(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(text).digest("hex");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
