import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_RUN_DASHBOARD_OUT_DIR = "artifacts/workflow-run-dashboard/latest";
export const DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS = {
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  workflowDslStateModelPath: "artifacts/workflow-dsl-state-model/latest/workflow-dsl-state-model.json",
  workflowStateMachineRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  workflowQueueRetryBackoffPath: "artifacts/workflow-queue-retry-backoff/latest/workflow-queue-retry-backoff-contract.json",
  workflowIdempotencyLedgerPath: "artifacts/workflow-idempotency/latest/workflow-idempotency-ledger.json",
  workflowResumeCancelContractPath: "artifacts/workflow-resume-cancel/latest/workflow-resume-cancel-contract.json",
  gateResultAggregatorPath: "artifacts/gate-result-aggregator/latest/gate-result-aggregator.json",
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  protectedDeliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  reviewApiPath: "src/review-api.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
};

const WORKFLOW_RUN_DASHBOARD_CONTRACT_ID = "workflow-run-dashboard.v1";
const WORKFLOW_RUN_DASHBOARD_SCHEMA_VERSION = "workflow-run-dashboard.v1";
const READ_ONLY_ROUTE_METHOD = "GET";

export async function runWorkflowRunDashboard(options = {}) {
  const result = await buildWorkflowRunDashboard(options);
  if (options.write !== false) await writeWorkflowRunDashboard(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow run dashboard validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowRunDashboard(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    workflowRunLedger: await readJsonOrError(inputs.workflow_run_ledger_path),
    workflowDslStateModel: await readJsonOrError(inputs.workflow_dsl_state_model_path),
    workflowStateMachineRunner: await readJsonOrError(inputs.workflow_state_machine_runner_path),
    workflowQueueRetryBackoff: await readJsonOrError(inputs.workflow_queue_retry_backoff_path),
    workflowIdempotencyLedger: await readJsonOrError(inputs.workflow_idempotency_ledger_path),
    workflowResumeCancelContract: await readJsonOrError(inputs.workflow_resume_cancel_contract_path),
    gateResultAggregator: await readJsonOrError(inputs.gate_result_aggregator_path),
    outputCatalog: await readJsonOrError(inputs.output_catalog_path),
    protectedDeliveryQueue: await readJsonOrError(inputs.protected_delivery_queue_path),
    capabilityRegistryApi: await readJsonOrError(inputs.capability_registry_api_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
    reviewApi: await readTextOrError(inputs.review_api_path),
    reviewDashboard: await readTextOrError(inputs.review_dashboard_path),
  };
  const artifacts = sourceArtifacts(sources);
  const runIndex = buildRunIndex(artifacts);
  const workflowRunDashboardPanels = buildWorkflowRunDashboardPanels(runIndex, generatedAt);
  const workflowRunStateCards = buildWorkflowRunStateCards(workflowRunDashboardPanels, generatedAt);
  const workflowRunQueueCards = buildWorkflowRunQueueCards(workflowRunDashboardPanels, generatedAt);
  const workflowRunGateCards = buildWorkflowRunGateCards(workflowRunDashboardPanels, generatedAt);
  const workflowRunOutputCards = buildWorkflowRunOutputCards(workflowRunDashboardPanels, generatedAt);
  const workflowRunDashboardRouteRecords = buildWorkflowRunDashboardRouteRecords(sources.reviewApi.value ?? "", generatedAt);
  const validationItems = validateWorkflowRunDashboard({
    sources,
    workflowRunDashboardPanels,
    workflowRunStateCards,
    workflowRunQueueCards,
    workflowRunGateCards,
    workflowRunOutputCards,
    workflowRunDashboardRouteRecords,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: WORKFLOW_RUN_DASHBOARD_SCHEMA_VERSION,
    generated_at: generatedAt,
    workflow_run_dashboard_id: `workflow-run-dashboard.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    workflow_run_dashboard_contract: buildWorkflowRunDashboardContract(generatedAt),
    workflow_run_dashboard_catalog: {
      schema_version: "workflow-run-dashboard-catalog.v1",
      generated_at: generatedAt,
      workflow_run_dashboard_panels: workflowRunDashboardPanels,
      workflow_run_state_cards: workflowRunStateCards,
      workflow_run_queue_cards: workflowRunQueueCards,
      workflow_run_gate_cards: workflowRunGateCards,
      workflow_run_output_cards: workflowRunOutputCards,
      workflow_run_dashboard_route_records: workflowRunDashboardRouteRecords,
    },
    workflow_run_dashboard_panels: workflowRunDashboardPanels,
    workflow_run_state_cards: workflowRunStateCards,
    workflow_run_queue_cards: workflowRunQueueCards,
    workflow_run_gate_cards: workflowRunGateCards,
    workflow_run_output_cards: workflowRunOutputCards,
    workflow_run_dashboard_route_records: workflowRunDashboardRouteRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowRunDashboard({
      sources,
      workflowRunDashboardPanels,
      workflowRunStateCards,
      workflowRunQueueCards,
      workflowRunGateCards,
      workflowRunOutputCards,
      workflowRunDashboardRouteRecords,
      validationItems,
      validation,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowRunDashboardMarkdown(result),
  };
}

export async function writeWorkflowRunDashboard(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-run-dashboard.json"), serializableWorkflowRunDashboard(result));
  await writeJson(path.join(outDir, "workflow-run-dashboard-panels.json"), {
    schema_version: "workflow-run-dashboard-panels.v1",
    generated_at: result.generated_at,
    workflow_run_dashboard_panel_count: result.workflow_run_dashboard_panels.length,
    workflow_run_dashboard_panels: result.workflow_run_dashboard_panels,
  });
  await writeJson(path.join(outDir, "workflow-run-state-cards.json"), {
    schema_version: "workflow-run-state-cards.v1",
    generated_at: result.generated_at,
    workflow_run_state_card_count: result.workflow_run_state_cards.length,
    workflow_run_state_cards: result.workflow_run_state_cards,
  });
  await writeJson(path.join(outDir, "workflow-run-queue-cards.json"), {
    schema_version: "workflow-run-queue-cards.v1",
    generated_at: result.generated_at,
    workflow_run_queue_card_count: result.workflow_run_queue_cards.length,
    workflow_run_queue_cards: result.workflow_run_queue_cards,
  });
  await writeJson(path.join(outDir, "workflow-run-gate-cards.json"), {
    schema_version: "workflow-run-gate-cards.v1",
    generated_at: result.generated_at,
    workflow_run_gate_card_count: result.workflow_run_gate_cards.length,
    workflow_run_gate_cards: result.workflow_run_gate_cards,
  });
  await writeJson(path.join(outDir, "workflow-run-output-cards.json"), {
    schema_version: "workflow-run-output-cards.v1",
    generated_at: result.generated_at,
    workflow_run_output_card_count: result.workflow_run_output_cards.length,
    workflow_run_output_cards: result.workflow_run_output_cards,
  });
  await writeJson(path.join(outDir, "workflow-run-dashboard-route-records.json"), {
    schema_version: "workflow-run-dashboard-route-records.v1",
    generated_at: result.generated_at,
    workflow_run_dashboard_route_record_count: result.workflow_run_dashboard_route_records.length,
    workflow_run_dashboard_route_records: result.workflow_run_dashboard_route_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-run-dashboard-validation-report.v1",
    generated_at: result.generated_at,
    workflow_run_dashboard_id: result.workflow_run_dashboard_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowRunDashboardCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowRunDashboard(args);
    console.log(`Workflow run dashboard ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_run_dashboard_status}`);
    console.log(`Panels: ${result.summary.workflow_run_dashboard_panel_count}`);
    console.log(`State cards: ${result.summary.workflow_run_state_card_count}`);
    console.log(`Queue cards: ${result.summary.workflow_run_queue_card_count}`);
    console.log(`Gate cards: ${result.summary.workflow_run_gate_card_count}`);
    console.log(`Output cards: ${result.summary.workflow_run_output_card_count}`);
    console.log(`Routes: ${result.summary.workflow_run_dashboard_route_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildWorkflowRunDashboardContract(generatedAt) {
  return {
    schema_version: "workflow-run-dashboard-contract.v1",
    workflow_run_dashboard_contract_id: WORKFLOW_RUN_DASHBOARD_CONTRACT_ID,
    generated_at: generatedAt,
    desktop_companion_role: "operator_companion",
    source_of_truth: "harness_control_plane",
    surface_policy: "read_only_status_summary",
    covered_status_domains: ["run", "state", "queue", "retry", "idempotency", "resume_cancel", "gate", "output"],
    mutation_policy: "not_allowed_in_v1",
    protected_action_policy: "display_only_no_execution",
    secret_policy: "no_secret_material_exposed",
    installer_gateway_policy: "not_owned_by_core",
    human_review_rule: "Resume, cancel, retry, delivery, and client-facing release remain human-gated decisions.",
  };
}

function buildRunIndex(artifacts) {
  const workflowRunRecords = artifacts.workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const stateByRun = byId(artifacts.workflowDslStateModel.workflow_run_state_projections ?? [], "workflow_run_id");
  const runnerPlanByRun = byId(artifacts.workflowStateMachineRunner.workflow_runner_plans ?? [], "workflow_run_id");
  const transitionGuardByRun = byId(artifacts.workflowStateMachineRunner.transition_guard_records ?? [], "workflow_run_id");
  const queueByRun = byId(artifacts.workflowQueueRetryBackoff.workflow_queue_records ?? [], "workflow_run_id");
  const retryByRun = groupBy(artifacts.workflowQueueRetryBackoff.retry_classification_records ?? [], "workflow_run_id");
  const backoffByRun = groupBy(artifacts.workflowQueueRetryBackoff.backoff_policy_records ?? [], "workflow_run_id");
  const idempotencyKeyByRun = byId(artifacts.workflowIdempotencyLedger.idempotency_key_records ?? [], "workflow_run_id");
  const idempotencyDecisionsByRun = groupBy(artifacts.workflowIdempotencyLedger.idempotency_decision_records ?? [], "workflow_run_id");
  const resumeCursorByRun = byId(artifacts.workflowResumeCancelContract.resume_cursor_records ?? [], "workflow_run_id");
  const cancelRequestByRun = byId(artifacts.workflowResumeCancelContract.cancel_request_records ?? [], "workflow_run_id");
  const resumeCancelDecisionsByRun = groupBy(artifacts.workflowResumeCancelContract.resume_cancel_decision_records ?? [], "workflow_run_id");
  const workflowGateStatusByRun = byId(artifacts.gateResultAggregator.workflow_gate_status_records ?? [], "workflow_run_id");
  const gateAggregatesByRun = groupBy(artifacts.gateResultAggregator.gate_aggregate_records ?? [], "workflow_run_id");
  const outputsByRun = groupBy(artifacts.outputCatalog.artifacts ?? [], "workflow_run_id");
  const deliveryActionsByRun = groupBy(artifacts.protectedDeliveryQueue.delivery_actions ?? [], "workflow_run_id");
  const capabilityById = byId(artifacts.capabilityRegistryApi.capability_api_cards ?? [], "capability_id");

  return workflowRunRecords.map((runRecord) => ({
    runRecord,
    stateProjection: stateByRun.get(runRecord.workflow_run_id) ?? null,
    runnerPlan: runnerPlanByRun.get(runRecord.workflow_run_id) ?? null,
    transitionGuard: transitionGuardByRun.get(runRecord.workflow_run_id) ?? null,
    queueRecord: queueByRun.get(runRecord.workflow_run_id) ?? null,
    retryClassifications: retryByRun.get(runRecord.workflow_run_id) ?? [],
    backoffPolicies: backoffByRun.get(runRecord.workflow_run_id) ?? [],
    idempotencyKey: idempotencyKeyByRun.get(runRecord.workflow_run_id) ?? null,
    idempotencyDecisions: idempotencyDecisionsByRun.get(runRecord.workflow_run_id) ?? [],
    resumeCursor: resumeCursorByRun.get(runRecord.workflow_run_id) ?? null,
    cancelRequest: cancelRequestByRun.get(runRecord.workflow_run_id) ?? null,
    resumeCancelDecisions: resumeCancelDecisionsByRun.get(runRecord.workflow_run_id) ?? [],
    workflowGateStatus: workflowGateStatusByRun.get(runRecord.workflow_run_id) ?? null,
    gateAggregates: gateAggregatesByRun.get(runRecord.workflow_run_id) ?? [],
    outputs: outputsByRun.get(runRecord.workflow_run_id) ?? [],
    deliveryActions: deliveryActionsByRun.get(runRecord.workflow_run_id) ?? [],
    capabilityCard: capabilityById.get(runRecord.capability_id) ?? null,
  }));
}

function buildWorkflowRunDashboardPanels(runIndex, generatedAt) {
  return runIndex.map((entry) => {
    const run = entry.runRecord;
    const state = entry.stateProjection;
    const queue = entry.queueRecord;
    const gate = entry.workflowGateStatus;
    const resume = entry.resumeCursor;
    const cancel = entry.cancelRequest;
    const retryableCount = entry.retryClassifications.filter((record) => record.retryable === true).length;
    const nonRetryableCount = entry.retryClassifications.filter((record) => record.retryable === false).length;
    const deliveryStatusCounts = countBy(entry.deliveryActions, "delivery_status");
    const outputStatusCounts = countBy(entry.outputs, "status");
    const routePaths = [
      "/api/workflow-run-dashboard-panels",
      "/api/workflow-run-state-cards",
      "/api/workflow-run-queue-cards",
      "/api/workflow-run-gate-cards",
      "/api/workflow-run-output-cards",
      "/api/workflow-run-records",
      "/api/workflow-gate-statuses",
    ];
    const base = {
      schema_version: "workflow-run-dashboard-panel.v1",
      workflow_run_dashboard_panel_id: `workflow-run-dashboard-panel.${slugify(run.workflow_run_id)}`,
      workflow_run_id: run.workflow_run_id,
      workflow_run_record_id: run.workflow_run_record_id,
      workflow_id: run.workflow_id,
      run_ledger_id: run.run_ledger_id,
      tenant_id: run.tenant_id ?? null,
      matter_id: run.matter_id ?? null,
      capability_id: run.capability_id ?? null,
      domain_pack: run.domain_pack ?? null,
      capability_display_name: entry.capabilityCard?.display_name ?? null,
      desktop_surface: "workflow_runs",
      desktop_card_status: computePanelStatus({ run, state, queue, gate }),
      read_only: true,
      mutation_allowed: false,
      protected_mutation_request_allowed: false,
      secret_material_exposed: false,
      installer_or_gateway_control: false,
      source_of_truth: "harness_control_plane",
      run_status: run.run_status,
      terminal_state: run.terminal_state,
      blocked_reason: run.blocked_reason ?? null,
      human_review_required: Boolean(run.human_review_required || state?.human_review_required || gate?.human_review_required || queue?.human_review_required),
      law_firm_human_review_required: Boolean(state?.law_firm_human_review_required || queue?.law_firm_human_review_required || gate?.domain_pack === "law-firm"),
      dsl_current_state: state?.dsl_current_state ?? null,
      dsl_terminal_state: state?.dsl_terminal_state ?? null,
      state_projection_status: state?.state_projection_status ?? state?.projection_status ?? "missing",
      runner_plan_status: entry.runnerPlan?.runner_plan_status ?? "missing",
      next_action: entry.runnerPlan?.next_action ?? null,
      transition_guard_status: entry.transitionGuard?.transition_guard_status ?? "missing",
      queue_status: queue?.queue_status ?? "missing",
      dequeue_policy: queue?.dequeue_policy ?? null,
      auto_dequeue_allowed: Boolean(queue?.auto_dequeue_allowed),
      retry_classification_count: entry.retryClassifications.length,
      retryable_classification_count: retryableCount,
      non_retryable_classification_count: nonRetryableCount,
      backoff_policy_count: entry.backoffPolicies.length,
      auto_retry_scheduled: entry.backoffPolicies.some((record) => record.auto_retry_scheduled === true),
      idempotency_key_record_id: entry.idempotencyKey?.idempotency_key_record_id ?? null,
      idempotency_key_status: entry.idempotencyKey?.key_status ?? "missing",
      duplicate_probe_skipped: entry.idempotencyDecisions.some((record) => record.skipped_duplicate === true),
      resume_cursor_record_id: resume?.resume_cursor_record_id ?? null,
      resume_state: resume?.resume_state ?? "missing",
      resume_required: Boolean(resume?.resume_required),
      auto_resume_allowed: Boolean(resume?.auto_resume_allowed),
      cancel_request_record_id: cancel?.cancel_request_record_id ?? null,
      cancel_request_status: cancel?.cancel_request_status ?? "missing",
      auto_cancel_allowed: Boolean(cancel?.auto_cancel_allowed),
      destructive_cancel_mutation_allowed: Boolean(cancel?.destructive_mutation_allowed),
      workflow_gate_status: gate?.workflow_gate_status ?? "missing",
      gate_aggregate_record_count: gate?.gate_aggregate_record_count ?? entry.gateAggregates.length,
      passed_gate_count: gate?.passed_gate_count ?? entry.gateAggregates.filter((record) => record.aggregate_gate_state === "pass").length,
      warning_gate_count: gate?.warning_gate_count ?? entry.gateAggregates.filter((record) => record.aggregate_gate_state === "warn").length,
      manual_gate_count: gate?.manual_gate_count ?? entry.gateAggregates.filter((record) => record.aggregate_gate_state === "manual").length,
      failed_gate_count: gate?.failed_gate_count ?? entry.gateAggregates.filter((record) => record.aggregate_gate_state === "fail").length,
      ready_for_execution: Boolean(gate?.ready_for_execution),
      ready_for_delivery: Boolean(gate?.ready_for_delivery),
      final_action_allowed: Boolean(gate?.final_action_allowed),
      execution_performed: Boolean(gate?.execution_performed_count),
      protected_action_executed: Boolean(gate?.protected_action_executed_count),
      final_action_executed: Boolean(gate?.final_action_executed_count),
      output_artifact_count: entry.outputs.length,
      output_status_counts: outputStatusCounts,
      delivery_action_count: entry.deliveryActions.length,
      delivery_status_counts: deliveryStatusCounts,
      ready_delivery_action_count: deliveryStatusCounts.ready ?? 0,
      delivered_action_count: deliveryStatusCounts.delivered ?? 0,
      blocked_delivery_action_count: (deliveryStatusCounts.blocked_pending_approval ?? 0) + (deliveryStatusCounts.blocked_by_gate ?? 0),
      route_paths: routePaths,
      query_examples: routePaths.slice(0, 5).map((routePath) => `${routePath}?workflow_run_id=${encodeURIComponent(run.workflow_run_id)}`),
      human_review_note: "Read-only workflow run dashboard panel; resume, cancel, retry, delivery, and final outputs require human approval.",
      generated_at: generatedAt,
    };
    return {
      ...base,
      workflow_run_dashboard_panel_hash: stableHash(base),
    };
  }).sort(by("workflow_run_dashboard_panel_id"));
}

function buildWorkflowRunStateCards(panels, generatedAt) {
  return panels.map((panel) => {
    const base = {
      schema_version: "workflow-run-state-card.v1",
      workflow_run_state_card_id: `workflow-run-state-card.${slugify(panel.workflow_run_id)}`,
      workflow_run_id: panel.workflow_run_id,
      workflow_id: panel.workflow_id,
      domain_pack: panel.domain_pack,
      capability_id: panel.capability_id,
      run_status: panel.run_status,
      terminal_state: panel.terminal_state,
      dsl_current_state: panel.dsl_current_state,
      dsl_terminal_state: panel.dsl_terminal_state,
      state_projection_status: panel.state_projection_status,
      runner_plan_status: panel.runner_plan_status,
      next_action: panel.next_action,
      transition_guard_status: panel.transition_guard_status,
      blocked_reason: panel.blocked_reason,
      human_review_required: panel.human_review_required,
      read_only: true,
      mutation_allowed: false,
      generated_at: generatedAt,
    };
    return { ...base, workflow_run_state_card_hash: stableHash(base) };
  });
}

function buildWorkflowRunQueueCards(panels, generatedAt) {
  return panels.map((panel) => {
    const base = {
      schema_version: "workflow-run-queue-card.v1",
      workflow_run_queue_card_id: `workflow-run-queue-card.${slugify(panel.workflow_run_id)}`,
      workflow_run_id: panel.workflow_run_id,
      run_ledger_id: panel.run_ledger_id,
      domain_pack: panel.domain_pack,
      queue_status: panel.queue_status,
      dequeue_policy: panel.dequeue_policy,
      auto_dequeue_allowed: panel.auto_dequeue_allowed,
      retry_classification_count: panel.retry_classification_count,
      retryable_classification_count: panel.retryable_classification_count,
      non_retryable_classification_count: panel.non_retryable_classification_count,
      backoff_policy_count: panel.backoff_policy_count,
      auto_retry_scheduled: panel.auto_retry_scheduled,
      idempotency_key_record_id: panel.idempotency_key_record_id,
      idempotency_key_status: panel.idempotency_key_status,
      duplicate_probe_skipped: panel.duplicate_probe_skipped,
      resume_cursor_record_id: panel.resume_cursor_record_id,
      resume_state: panel.resume_state,
      resume_required: panel.resume_required,
      auto_resume_allowed: panel.auto_resume_allowed,
      cancel_request_record_id: panel.cancel_request_record_id,
      cancel_request_status: panel.cancel_request_status,
      auto_cancel_allowed: panel.auto_cancel_allowed,
      destructive_cancel_mutation_allowed: panel.destructive_cancel_mutation_allowed,
      read_only: true,
      mutation_allowed: false,
      generated_at: generatedAt,
    };
    return { ...base, workflow_run_queue_card_hash: stableHash(base) };
  });
}

function buildWorkflowRunGateCards(panels, generatedAt) {
  return panels.map((panel) => {
    const base = {
      schema_version: "workflow-run-gate-card.v1",
      workflow_run_gate_card_id: `workflow-run-gate-card.${slugify(panel.workflow_run_id)}`,
      workflow_run_id: panel.workflow_run_id,
      domain_pack: panel.domain_pack,
      workflow_gate_status: panel.workflow_gate_status,
      gate_aggregate_record_count: panel.gate_aggregate_record_count,
      passed_gate_count: panel.passed_gate_count,
      warning_gate_count: panel.warning_gate_count,
      manual_gate_count: panel.manual_gate_count,
      failed_gate_count: panel.failed_gate_count,
      human_review_required: panel.human_review_required,
      ready_for_execution: panel.ready_for_execution,
      ready_for_delivery: panel.ready_for_delivery,
      final_action_allowed: panel.final_action_allowed,
      execution_performed: panel.execution_performed,
      protected_action_executed: panel.protected_action_executed,
      final_action_executed: panel.final_action_executed,
      read_only: true,
      mutation_allowed: false,
      generated_at: generatedAt,
    };
    return { ...base, workflow_run_gate_card_hash: stableHash(base) };
  });
}

function buildWorkflowRunOutputCards(panels, generatedAt) {
  return panels.map((panel) => {
    const base = {
      schema_version: "workflow-run-output-card.v1",
      workflow_run_output_card_id: `workflow-run-output-card.${slugify(panel.workflow_run_id)}`,
      workflow_run_id: panel.workflow_run_id,
      domain_pack: panel.domain_pack,
      matter_id: panel.matter_id,
      output_artifact_count: panel.output_artifact_count,
      output_status_counts: panel.output_status_counts,
      delivery_action_count: panel.delivery_action_count,
      delivery_status_counts: panel.delivery_status_counts,
      ready_delivery_action_count: panel.ready_delivery_action_count,
      delivered_action_count: panel.delivered_action_count,
      blocked_delivery_action_count: panel.blocked_delivery_action_count,
      ready_for_delivery: panel.ready_for_delivery,
      final_action_allowed: panel.final_action_allowed,
      final_action_executed: panel.final_action_executed,
      read_only: true,
      mutation_allowed: false,
      human_review_note: "Output status is visible only; delivery and final release remain human-approved.",
      generated_at: generatedAt,
    };
    return { ...base, workflow_run_output_card_hash: stableHash(base) };
  });
}

function buildWorkflowRunDashboardRouteRecords(reviewApiSource, generatedAt) {
  const routes = [
    routeRecord("/api/workflow-run-dashboards", "workflow_run_dashboards", "Workflow run dashboard artifact", generatedAt),
    routeRecord("/api/workflow-run-dashboard-panels", "workflow_run_dashboard_panels", "Desktop workflow run panels", generatedAt),
    routeRecord("/api/workflow-run-state-cards", "workflow_run_state_cards", "Workflow run state cards", generatedAt),
    routeRecord("/api/workflow-run-queue-cards", "workflow_run_queue_cards", "Workflow run queue, retry, idempotency, resume, and cancel cards", generatedAt),
    routeRecord("/api/workflow-run-gate-cards", "workflow_run_gate_cards", "Workflow run gate status cards", generatedAt),
    routeRecord("/api/workflow-run-output-cards", "workflow_run_output_cards", "Workflow run output status cards", generatedAt),
    routeRecord("/api/workflow-run-dashboard-validations", "workflow_run_dashboard_validations", "Workflow run dashboard validation rows", generatedAt),
  ];
  return routes.map((record) => ({
    ...record,
    route_status: reviewApiSource.includes(`"${record.route_path}"`) ? "declared" : "missing",
    route_hash: stableHash(record),
  }));
}

function routeRecord(routePath, collection, description, generatedAt) {
  return {
    schema_version: "workflow-run-dashboard-route-record.v1",
    route_id: `workflow-run-dashboard-route.${slugRoute(routePath)}`,
    route_method: READ_ONLY_ROUTE_METHOD,
    route_path: routePath,
    collection,
    description,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    secret_material_exposed: false,
    installer_or_gateway_control: false,
    source_of_truth: "harness_control_plane",
    query_example: `${routePath}?limit=5`,
    generated_at: generatedAt,
  };
}

function validateWorkflowRunDashboard({
  sources,
  workflowRunDashboardPanels,
  workflowRunStateCards,
  workflowRunQueueCards,
  workflowRunGateCards,
  workflowRunOutputCards,
  workflowRunDashboardRouteRecords,
}) {
  const packageJson = sources.packageJson.value ?? {};
  const roadmapText = sources.roadmap.value ?? "";
  const reviewDashboardSource = sources.reviewDashboard.value ?? "";
  const workflowRunRecordCount = sources.workflowRunLedger.value?.summary?.workflow_run_record_count
    ?? sources.workflowRunLedger.value?.workflow_run_catalog?.workflow_run_records?.length
    ?? 0;
  const stateProjectionCount = sources.workflowDslStateModel.value?.summary?.workflow_run_state_projection_count
    ?? sources.workflowDslStateModel.value?.workflow_run_state_projections?.length
    ?? 0;
  const queueRecordCount = sources.workflowQueueRetryBackoff.value?.summary?.workflow_queue_record_count
    ?? sources.workflowQueueRetryBackoff.value?.workflow_queue_records?.length
    ?? 0;
  const gateStatusCount = sources.gateResultAggregator.value?.summary?.workflow_gate_status_count
    ?? sources.gateResultAggregator.value?.workflow_gate_status_records?.length
    ?? 0;
  const items = [];
  items.push(validationItem("package.scripts.workflows:run-dashboard", "package_script_present", Boolean(packageJson.scripts?.["workflows:run-dashboard"]), "package.json must expose npm run workflows:run-dashboard."));
  items.push(validationItem("roadmap.p192", "roadmap_slot_declared", roadmapText.includes("| P192 | workflow run dashboard 구현 |") || roadmapText.includes("## Phase 192"), "P192 roadmap slot or phase entry must be declared."));
  items.push(validationItem("review_dashboard.source", "dashboard_source_present", reviewDashboardSource.includes("workflow_run_dashboard"), "Review dashboard must read workflow_run_dashboard source artifacts."));
  items.push(validationItem("review_dashboard.stage", "dashboard_stage_present", reviewDashboardSource.includes("Workflow Run Dashboard"), "Review dashboard must expose Workflow Run Dashboard stage status."));
  items.push(validationItem("sources.workflow_run_ledger", "workflow_run_ledger_complete", sourceStatus(sources.workflowRunLedger, "workflow_run_ledger_status") === "complete", "Workflow run ledger must be complete."));
  items.push(validationItem("sources.workflow_dsl_state_model", "workflow_dsl_state_model_complete", sourceStatus(sources.workflowDslStateModel, "workflow_dsl_state_model_status") === "complete", "Workflow DSL state model must be complete."));
  items.push(validationItem("sources.workflow_state_machine_runner", "workflow_state_machine_runner_complete", sourceStatus(sources.workflowStateMachineRunner, "workflow_state_machine_runner_status") === "complete", "Workflow state machine runner must be complete."));
  items.push(validationItem("sources.workflow_queue_retry_backoff", "workflow_queue_retry_backoff_complete", sourceStatus(sources.workflowQueueRetryBackoff, "workflow_queue_retry_backoff_status") === "complete", "Workflow queue/retry/backoff contract must be complete."));
  items.push(validationItem("sources.workflow_idempotency", "workflow_idempotency_complete", sourceStatus(sources.workflowIdempotencyLedger, "workflow_idempotency_status") === "complete", "Workflow idempotency ledger must be complete."));
  items.push(validationItem("sources.workflow_resume_cancel", "workflow_resume_cancel_complete", sourceStatus(sources.workflowResumeCancelContract, "workflow_resume_cancel_status") === "complete", "Workflow resume/cancel contract must be complete."));
  items.push(validationItem("sources.gate_result_aggregator", "gate_result_aggregator_complete", sourceStatus(sources.gateResultAggregator, "gate_result_aggregator_status") === "complete", "Gate result aggregator must be complete."));
  items.push(validationItem("sources.capability_registry_api", "capability_registry_api_complete", sourceStatus(sources.capabilityRegistryApi, "capability_registry_api_status") === "complete", "Capability registry API must be complete."));
  items.push(validationItem("panels.count", "panel_count_matches_workflow_runs", workflowRunDashboardPanels.length === workflowRunRecordCount && workflowRunRecordCount > 0, "Workflow run dashboard panels must cover every workflow run."));
  items.push(validationItem("cards.state.count", "state_card_count_matches_workflow_runs", workflowRunStateCards.length === workflowRunRecordCount && workflowRunStateCards.length === stateProjectionCount, "State cards must align with workflow run state projections."));
  items.push(validationItem("cards.queue.count", "queue_card_count_matches_workflow_runs", workflowRunQueueCards.length === workflowRunRecordCount && workflowRunQueueCards.length === queueRecordCount, "Queue cards must align with workflow queue records."));
  items.push(validationItem("cards.gate.count", "gate_card_count_matches_workflow_runs", workflowRunGateCards.length === workflowRunRecordCount && workflowRunGateCards.length === gateStatusCount, "Gate cards must align with workflow gate statuses."));
  items.push(validationItem("cards.output.count", "output_card_count_matches_workflow_runs", workflowRunOutputCards.length === workflowRunRecordCount, "Output cards must cover every workflow run, even when no output artifact exists."));
  items.push(validationItem("panels.read_only", "panels_read_only", workflowRunDashboardPanels.every((panel) => panel.read_only === true && panel.mutation_allowed === false), "Workflow run dashboard panels must be read-only."));
  items.push(validationItem("routes.read_only", "routes_read_only", workflowRunDashboardRouteRecords.every((route) => route.read_only === true && route.mutation_allowed === false && route.secret_material_exposed === false && route.installer_or_gateway_control === false), "Workflow run dashboard routes must be read-only and must not expose secrets or installer/gateway control."));
  items.push(validationItem("routes.declared", "routes_declared", workflowRunDashboardRouteRecords.every((route) => route.route_status === "declared"), "Workflow run dashboard Review API routes must be declared."));
  items.push(validationItem("execution.no_auto_dequeue", "no_auto_dequeue", workflowRunDashboardPanels.every((panel) => panel.auto_dequeue_allowed === false), "Dashboard must not authorize automatic dequeue."));
  items.push(validationItem("execution.no_auto_retry", "no_auto_retry", workflowRunDashboardPanels.every((panel) => panel.auto_retry_scheduled === false), "Dashboard must not schedule retries."));
  items.push(validationItem("execution.no_auto_resume_cancel", "no_auto_resume_or_cancel", workflowRunDashboardPanels.every((panel) => panel.auto_resume_allowed === false && panel.auto_cancel_allowed === false), "Dashboard must not auto resume or cancel workflows."));
  items.push(validationItem("execution.no_protected_or_final_action", "no_protected_or_final_action", workflowRunDashboardPanels.every((panel) => panel.protected_action_executed === false && panel.final_action_executed === false), "Dashboard must not execute protected or final actions."));
  return items;
}

function summarizeWorkflowRunDashboard({
  sources,
  workflowRunDashboardPanels,
  workflowRunStateCards,
  workflowRunQueueCards,
  workflowRunGateCards,
  workflowRunOutputCards,
  workflowRunDashboardRouteRecords,
  validationItems,
  validation,
}) {
  const panelStatus = countBy(workflowRunDashboardPanels, "desktop_card_status");
  const routeStatus = countBy(workflowRunDashboardRouteRecords, "route_status");
  const sourceValidationErrorCount = [
    sources.workflowRunLedger,
    sources.workflowDslStateModel,
    sources.workflowStateMachineRunner,
    sources.workflowQueueRetryBackoff,
    sources.workflowIdempotencyLedger,
    sources.workflowResumeCancelContract,
    sources.gateResultAggregator,
    sources.capabilityRegistryApi,
  ].reduce((sum, source) => sum + (source.value?.summary?.validation_error_count ?? source.value?.validation?.errors?.length ?? 0), 0);
  const readyRouteCount = workflowRunDashboardRouteRecords.length;
  const readOnlyRouteCount = workflowRunDashboardRouteRecords.filter((route) => route.read_only).length;
  return {
    workflow_run_dashboard_status: validation.valid ? "complete" : "blocked",
    workflow_run_dashboard_contract_id: WORKFLOW_RUN_DASHBOARD_CONTRACT_ID,
    desktop_companion_readiness_status: validation.valid ? "read_only_ready" : "blocked",
    source_workflow_run_ledger_status: sourceStatus(sources.workflowRunLedger, "workflow_run_ledger_status"),
    source_workflow_dsl_state_model_status: sourceStatus(sources.workflowDslStateModel, "workflow_dsl_state_model_status"),
    source_workflow_state_machine_runner_status: sourceStatus(sources.workflowStateMachineRunner, "workflow_state_machine_runner_status"),
    source_workflow_queue_retry_backoff_status: sourceStatus(sources.workflowQueueRetryBackoff, "workflow_queue_retry_backoff_status"),
    source_workflow_idempotency_status: sourceStatus(sources.workflowIdempotencyLedger, "workflow_idempotency_status"),
    source_workflow_resume_cancel_status: sourceStatus(sources.workflowResumeCancelContract, "workflow_resume_cancel_status"),
    source_gate_result_aggregator_status: sourceStatus(sources.gateResultAggregator, "gate_result_aggregator_status"),
    source_capability_registry_api_status: sourceStatus(sources.capabilityRegistryApi, "capability_registry_api_status"),
    source_workflow_run_record_count: sources.workflowRunLedger.value?.summary?.workflow_run_record_count ?? 0,
    source_workflow_state_projection_count: sources.workflowDslStateModel.value?.summary?.workflow_run_state_projection_count ?? 0,
    source_runner_plan_count: sources.workflowStateMachineRunner.value?.summary?.runner_plan_count ?? 0,
    source_workflow_queue_record_count: sources.workflowQueueRetryBackoff.value?.summary?.workflow_queue_record_count ?? 0,
    source_retry_classification_count: sources.workflowQueueRetryBackoff.value?.summary?.retry_classification_count ?? 0,
    source_backoff_policy_count: sources.workflowQueueRetryBackoff.value?.summary?.backoff_policy_count ?? 0,
    source_idempotency_key_count: sources.workflowIdempotencyLedger.value?.summary?.idempotency_key_count ?? 0,
    source_resume_cursor_count: sources.workflowResumeCancelContract.value?.summary?.resume_cursor_count ?? 0,
    source_cancel_request_count: sources.workflowResumeCancelContract.value?.summary?.cancel_request_count ?? 0,
    source_workflow_gate_status_count: sources.gateResultAggregator.value?.summary?.workflow_gate_status_count ?? 0,
    source_output_artifact_count: sources.outputCatalog.value?.summary?.artifact_count ?? sources.outputCatalog.value?.artifacts?.length ?? 0,
    source_delivery_action_count: sources.protectedDeliveryQueue.value?.summary?.delivery_action_count ?? sources.protectedDeliveryQueue.value?.delivery_actions?.length ?? 0,
    workflow_run_dashboard_panel_count: workflowRunDashboardPanels.length,
    workflow_run_state_card_count: workflowRunStateCards.length,
    workflow_run_queue_card_count: workflowRunQueueCards.length,
    workflow_run_gate_card_count: workflowRunGateCards.length,
    workflow_run_output_card_count: workflowRunOutputCards.length,
    human_review_required_panel_count: workflowRunDashboardPanels.filter((panel) => panel.human_review_required).length,
    manual_review_required_panel_count: workflowRunDashboardPanels.filter((panel) => panel.workflow_gate_status === "manual_review_required").length,
    held_queue_panel_count: workflowRunDashboardPanels.filter((panel) => panel.queue_status === "held_for_human_review").length,
    waiting_state_panel_count: workflowRunDashboardPanels.filter((panel) => panel.dsl_current_state === "waiting").length,
    output_artifact_panel_count: workflowRunDashboardPanels.filter((panel) => panel.output_artifact_count > 0).length,
    output_artifact_count: workflowRunDashboardPanels.reduce((sum, panel) => sum + panel.output_artifact_count, 0),
    delivery_action_count: workflowRunDashboardPanels.reduce((sum, panel) => sum + panel.delivery_action_count, 0),
    ready_delivery_action_count: workflowRunDashboardPanels.reduce((sum, panel) => sum + panel.ready_delivery_action_count, 0),
    delivered_action_count: workflowRunDashboardPanels.reduce((sum, panel) => sum + panel.delivered_action_count, 0),
    auto_dequeue_allowed_count: workflowRunDashboardPanels.filter((panel) => panel.auto_dequeue_allowed).length,
    auto_retry_scheduled_count: workflowRunDashboardPanels.filter((panel) => panel.auto_retry_scheduled).length,
    auto_resume_allowed_count: workflowRunDashboardPanels.filter((panel) => panel.auto_resume_allowed).length,
    auto_cancel_allowed_count: workflowRunDashboardPanels.filter((panel) => panel.auto_cancel_allowed).length,
    protected_action_executed_count: workflowRunDashboardPanels.filter((panel) => panel.protected_action_executed).length,
    delivery_ready_count: workflowRunDashboardPanels.filter((panel) => panel.ready_for_delivery).length,
    final_action_executed_count: workflowRunDashboardPanels.filter((panel) => panel.final_action_executed).length,
    ready_panel_count: panelStatus.ready ?? 0,
    attention_panel_count: panelStatus.attention ?? 0,
    human_review_panel_count: panelStatus.human_review_required ?? 0,
    blocked_panel_count: panelStatus.blocked ?? 0,
    workflow_run_dashboard_route_count: readyRouteCount,
    declared_route_count: routeStatus.declared ?? 0,
    missing_route_count: routeStatus.missing ?? 0,
    read_only_route_count: readOnlyRouteCount,
    mutation_route_count: workflowRunDashboardRouteRecords.filter((route) => route.mutation_allowed).length,
    protected_mutation_request_route_count: workflowRunDashboardRouteRecords.filter((route) => route.protected_mutation_request_allowed).length,
    secret_material_route_count: workflowRunDashboardRouteRecords.filter((route) => route.secret_material_exposed).length,
    installer_or_gateway_route_count: workflowRunDashboardRouteRecords.filter((route) => route.installer_or_gateway_control).length,
    source_validation_error_count: sourceValidationErrorCount,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function renderWorkflowRunDashboardMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Run Dashboard");
  lines.push("");
  lines.push("Desktop Companion read-only status surface. Resume, cancel, retry, delivery, and final outputs require human approval.");
  lines.push("");
  lines.push(`- Status: ${summary.workflow_run_dashboard_status}`);
  lines.push(`- Panels: ${summary.workflow_run_dashboard_panel_count}`);
  lines.push(`- Human-review panels: ${summary.human_review_required_panel_count}`);
  lines.push(`- Held queue panels: ${summary.held_queue_panel_count}`);
  lines.push(`- Routes: ${summary.declared_route_count}/${summary.workflow_run_dashboard_route_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Workflow Runs");
  for (const panel of result.workflow_run_dashboard_panels) {
    lines.push(`- ${panel.workflow_run_id}: ${panel.desktop_card_status}; state ${panel.dsl_current_state}; queue ${panel.queue_status}; gate ${panel.workflow_gate_status}; outputs ${panel.output_artifact_count}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildSourceContracts(sources, inputs) {
  return {
    workflow_run_ledger: sourceContract(sources.workflowRunLedger, inputs.workflow_run_ledger_path, "workflow-run-ledger.v1"),
    workflow_dsl_state_model: sourceContract(sources.workflowDslStateModel, inputs.workflow_dsl_state_model_path, "workflow-dsl-state-model.v1"),
    workflow_state_machine_runner: sourceContract(sources.workflowStateMachineRunner, inputs.workflow_state_machine_runner_path, "workflow-state-machine-runner.v1"),
    workflow_queue_retry_backoff: sourceContract(sources.workflowQueueRetryBackoff, inputs.workflow_queue_retry_backoff_path, "workflow-queue-retry-backoff.v1"),
    workflow_idempotency_ledger: sourceContract(sources.workflowIdempotencyLedger, inputs.workflow_idempotency_ledger_path, "workflow-idempotency-ledger.v1"),
    workflow_resume_cancel_contract: sourceContract(sources.workflowResumeCancelContract, inputs.workflow_resume_cancel_contract_path, "workflow-resume-cancel-contract.v1"),
    gate_result_aggregator: sourceContract(sources.gateResultAggregator, inputs.gate_result_aggregator_path, "gate-result-aggregator.v1"),
    output_catalog: sourceContract(sources.outputCatalog, inputs.output_catalog_path, "output-artifact-catalog.v1"),
    protected_delivery_queue: sourceContract(sources.protectedDeliveryQueue, inputs.protected_delivery_queue_path, "protected-delivery-queue.v1"),
    capability_registry_api: sourceContract(sources.capabilityRegistryApi, inputs.capability_registry_api_path, "capability-registry-api.v1"),
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

function sourceArtifacts(sources) {
  return {
    workflowRunLedger: sources.workflowRunLedger.value ?? {},
    workflowDslStateModel: sources.workflowDslStateModel.value ?? {},
    workflowStateMachineRunner: sources.workflowStateMachineRunner.value ?? {},
    workflowQueueRetryBackoff: sources.workflowQueueRetryBackoff.value ?? {},
    workflowIdempotencyLedger: sources.workflowIdempotencyLedger.value ?? {},
    workflowResumeCancelContract: sources.workflowResumeCancelContract.value ?? {},
    gateResultAggregator: sources.gateResultAggregator.value ?? {},
    outputCatalog: sources.outputCatalog.value ?? {},
    protectedDeliveryQueue: sources.protectedDeliveryQueue.value ?? {},
    capabilityRegistryApi: sources.capabilityRegistryApi.value ?? {},
  };
}

function computePanelStatus({ run, state, queue, gate }) {
  if ((gate?.failed_gate_count ?? 0) > 0) return "blocked";
  if (gate?.workflow_gate_status === "manual_review_required" || queue?.queue_status === "held_for_human_review" || run.human_review_required || state?.human_review_required) return "human_review_required";
  if (gate?.ready_for_execution || gate?.ready_for_delivery) return "ready";
  return "attention";
}

function normalizeInputs(options) {
  return {
    workflow_run_ledger_path: options.workflowRunLedgerPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.workflowRunLedgerPath,
    workflow_dsl_state_model_path: options.workflowDslStateModelPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.workflowDslStateModelPath,
    workflow_state_machine_runner_path: options.workflowStateMachineRunnerPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.workflowStateMachineRunnerPath,
    workflow_queue_retry_backoff_path: options.workflowQueueRetryBackoffPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.workflowQueueRetryBackoffPath,
    workflow_idempotency_ledger_path: options.workflowIdempotencyLedgerPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.workflowIdempotencyLedgerPath,
    workflow_resume_cancel_contract_path: options.workflowResumeCancelContractPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.workflowResumeCancelContractPath,
    gate_result_aggregator_path: options.gateResultAggregatorPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.gateResultAggregatorPath,
    output_catalog_path: options.outputCatalogPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.outputCatalogPath,
    protected_delivery_queue_path: options.protectedDeliveryQueuePath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.protectedDeliveryQueuePath,
    capability_registry_api_path: options.capabilityRegistryApiPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.capabilityRegistryApiPath,
    package_path: options.packagePath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.roadmapPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.reviewApiPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_WORKFLOW_RUN_DASHBOARD_INPUTS.reviewDashboardPath,
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
    else if (arg === "--workflow-dsl-state-model") args.workflowDslStateModelPath = argv[++index];
    else if (arg === "--workflow-state-machine-runner") args.workflowStateMachineRunnerPath = argv[++index];
    else if (arg === "--workflow-queue-retry-backoff") args.workflowQueueRetryBackoffPath = argv[++index];
    else if (arg === "--workflow-idempotency") args.workflowIdempotencyLedgerPath = argv[++index];
    else if (arg === "--workflow-resume-cancel") args.workflowResumeCancelContractPath = argv[++index];
    else if (arg === "--gate-result-aggregator") args.gateResultAggregatorPath = argv[++index];
    else if (arg === "--output-catalog") args.outputCatalogPath = argv[++index];
    else if (arg === "--delivery-queue") args.protectedDeliveryQueuePath = argv[++index];
    else if (arg === "--capability-registry-api") args.capabilityRegistryApiPath = argv[++index];
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
  console.log(`Usage: node scripts/workflow-run-dashboard.mjs [options]

Options:
  --check                                  fail when validation is not complete
  --out-dir <dir>                          output directory
  --workflow-run-ledger <path>             workflow-run-ledger.json path
  --workflow-dsl-state-model <path>        workflow-dsl-state-model.json path
  --workflow-state-machine-runner <path>   workflow-state-machine-runner.json path
  --workflow-queue-retry-backoff <path>    workflow-queue-retry-backoff-contract.json path
  --workflow-idempotency <path>            workflow-idempotency-ledger.json path
  --workflow-resume-cancel <path>          workflow-resume-cancel-contract.json path
  --gate-result-aggregator <path>          gate-result-aggregator.json path
  --output-catalog <path>                  output-catalog.json path
  --delivery-queue <path>                  protected-delivery-queue.json path
  --capability-registry-api <path>         capability-registry-api.json path
  --package <path>                         package.json path
  --roadmap <path>                         final completion phase ledger path
  --review-api <path>                      review-api source path
  --review-dashboard <path>                review-dashboard source path
  --run-at <iso>                           deterministic generated_at timestamp
  --help                                   show this help
`);
}

function serializableWorkflowRunDashboard(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
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
  if (source.value?.summary) return "available";
  return "unknown";
}

function byId(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const row of rows) {
    const groupKey = row[key];
    const existing = groups.get(groupKey) ?? [];
    existing.push(row);
    groups.set(groupKey, existing);
  }
  return groups;
}

function countBy(rows, key) {
  const counts = {};
  for (const row of rows) counts[row[key] ?? "unknown"] = (counts[row[key] ?? "unknown"] ?? 0) + 1;
  return counts;
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function slugRoute(routePath) {
  return routePath.replace(/^\/api\//, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:.]/g, "").replace("T", "-").replace("Z", "Z");
}

function stableHash(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
