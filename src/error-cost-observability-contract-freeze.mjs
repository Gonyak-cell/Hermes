import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ERROR_COST_OBSERVABILITY_CONTRACT_FREEZE_OUT_DIR = "artifacts/error-cost-observability-contract-freeze/latest";
export const DEFAULT_ERROR_COST_OBSERVABILITY_CONTRACT_FREEZE_INPUTS = {
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  costBudgetLedgerPath: "artifacts/cost-budget/latest/cost-budget-ledger.json",
  tokenUsageLedgerPath: "artifacts/token-usage/latest/token-usage-ledger.json",
  costAttributionLedgerPath: "artifacts/cost-attribution/latest/cost-attribution-ledger.json",
  budgetAlertLedgerPath: "artifacts/budget-alerts/latest/budget-alert-ledger.json",
  eventAuditRunContractFreezePath: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
};

const ERROR_RECORD_SCHEMA_VERSION = "error-record.v2";
const COST_OBSERVATION_SCHEMA_VERSION = "cost-observation.v2";
const TRACE_PROJECTION_SCHEMA_VERSION = "trace-projection.v2";

export async function runErrorCostObservabilityContractFreeze(options = {}) {
  const result = await buildErrorCostObservabilityContractFreeze(options);
  if (options.write !== false) await writeErrorCostObservabilityContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Error/Cost/Observability contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildErrorCostObservabilityContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ERROR_COST_OBSERVABILITY_CONTRACT_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);

  const observabilityCatalog = await readJson(inputs.observability_catalog_path);
  const costBudgetLedger = await readJson(inputs.cost_budget_ledger_path);
  const tokenUsageLedger = await readJson(inputs.token_usage_ledger_path);
  const costAttributionLedger = await readJson(inputs.cost_attribution_ledger_path);
  const budgetAlertLedger = await readJson(inputs.budget_alert_ledger_path);
  const eventAuditRunContractFreeze = await readJson(inputs.event_audit_run_contract_freeze_path);

  const projection = projectErrorCostObservabilityContracts({
    observabilityCatalog,
    costBudgetLedger,
    tokenUsageLedger,
    costAttributionLedger,
    budgetAlertLedger,
    eventAuditRunContractFreeze,
    generatedAt,
  });
  const validationItems = validateErrorCostObservabilityContracts({
    observabilityCatalog,
    costBudgetLedger,
    tokenUsageLedger,
    costAttributionLedger,
    budgetAlertLedger,
    eventAuditRunContractFreeze,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "error-cost-observability-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `error-cost-observability-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      observability_catalog: sourceContract(observabilityCatalog, {
        workflow_run_count: observabilityCatalog.summary?.workflow_run_count ?? 0,
        event_count: observabilityCatalog.summary?.event_count ?? 0,
        cost_record_count: observabilityCatalog.summary?.cost_record_count ?? 0,
        total_runtime_seconds: observabilityCatalog.summary?.total_runtime_seconds ?? 0,
      }),
      cost_budget_ledger: sourceContract(costBudgetLedger, {
        ledger_status: costBudgetLedger.ledger_status ?? null,
        budget_decision_count: costBudgetLedger.summary?.budget_decision_count ?? 0,
      }),
      token_usage_ledger: sourceContract(tokenUsageLedger, {
        ledger_status: tokenUsageLedger.ledger_status ?? null,
        token_usage_record_count: tokenUsageLedger.summary?.token_usage_record_count ?? 0,
      }),
      cost_attribution_ledger: sourceContract(costAttributionLedger, {
        ledger_status: costAttributionLedger.ledger_status ?? null,
        attribution_record_count: costAttributionLedger.summary?.attribution_record_count ?? 0,
      }),
      budget_alert_ledger: sourceContract(budgetAlertLedger, {
        ledger_status: budgetAlertLedger.ledger_status ?? null,
        alert_record_count: budgetAlertLedger.summary?.alert_record_count ?? 0,
      }),
      event_audit_run_contract_freeze: sourceContract(eventAuditRunContractFreeze, {
        freeze_status: eventAuditRunContractFreeze.summary?.freeze_status ?? null,
        run_ledger_count: eventAuditRunContractFreeze.summary?.run_ledger_count ?? 0,
      }),
    },
    contract_versions: {
      error_record_schema_version: ERROR_RECORD_SCHEMA_VERSION,
      cost_observation_schema_version: COST_OBSERVATION_SCHEMA_VERSION,
      trace_projection_schema_version: TRACE_PROJECTION_SCHEMA_VERSION,
      compatibility_floor: "event-audit-run-contract.v2+observability-catalog.v1+cost-attribution-ledger.v1",
    },
    field_requirements: buildFieldRequirements(),
    summary: summarizeFreeze(projection, validationItems, validation),
    error_cost_observability_contract: {
      schema_version: "error-cost-observability-contract.v2",
      generated_at: generatedAt,
      error_records: projection.errorRecordsV2,
      cost_observations: projection.costObservationsV2,
      trace_projections: projection.traceProjectionsV2,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderErrorCostObservabilityContractFreezeMarkdown(result),
  };
}

export async function writeErrorCostObservabilityContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "error-cost-observability-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "error-record-v2-fixture.json"), {
    generated_at: result.generated_at,
    error_record_schema_version: result.contract_versions.error_record_schema_version,
    error_record_count: result.error_cost_observability_contract.error_records.length,
    error_records: result.error_cost_observability_contract.error_records,
  });
  await writeJson(path.join(outDir, "cost-observation-v2-fixture.json"), {
    generated_at: result.generated_at,
    cost_observation_schema_version: result.contract_versions.cost_observation_schema_version,
    cost_observation_count: result.error_cost_observability_contract.cost_observations.length,
    cost_observations: result.error_cost_observability_contract.cost_observations,
  });
  await writeJson(path.join(outDir, "trace-projection-v2-fixture.json"), {
    generated_at: result.generated_at,
    trace_projection_schema_version: result.contract_versions.trace_projection_schema_version,
    trace_projection_count: result.error_cost_observability_contract.trace_projections.length,
    trace_projections: result.error_cost_observability_contract.trace_projections,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runErrorCostObservabilityContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runErrorCostObservabilityContractFreeze(args);
    console.log(`Error/Cost/Observability contract freeze written to ${result.output_dir}`);
    console.log(`ErrorRecord v2: ${result.summary.error_record_count}`);
    console.log(`CostObservation v2: ${result.summary.cost_observation_count}`);
    console.log(`TraceProjection v2: ${result.summary.trace_projection_count}`);
    console.log(`Latency coverage: ${result.summary.latency_observed_count}/${result.summary.trace_projection_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectErrorCostObservabilityContracts({
  observabilityCatalog,
  costBudgetLedger,
  tokenUsageLedger,
  costAttributionLedger,
  budgetAlertLedger,
  eventAuditRunContractFreeze,
  generatedAt,
}) {
  const contract = eventAuditRunContractFreeze.error_cost_observability_contract
    ?? eventAuditRunContractFreeze.event_audit_run_contract
    ?? {};
  const runLedgers = contract.run_ledgers ?? [];
  const eventRecords = contract.event_records ?? [];
  const auditEvents = contract.audit_events ?? [];
  const runByWorkflow = new Map(runLedgers.map((run) => [run.workflow_run_id, run]));
  const eventsByWorkflow = groupBy(eventRecords, (event) => event.workflow_run_id ?? event.correlation_id);
  const auditEventsByWorkflow = groupBy(auditEvents, (event) => event.workflow_run_id ?? event.correlation_id);
  const observabilityRunsByWorkflow = new Map((observabilityCatalog.run_records ?? []).map((run) => [run.workflow_run_id, run]));
  const budgetDecisionById = new Map((costBudgetLedger.budget_decisions ?? []).map((decision) => [decision.budget_decision_id, decision]));
  const tokenUsageById = new Map((tokenUsageLedger.token_usage_records ?? []).map((record) => [record.token_usage_id, record]));
  const tokenUsageByBudgetDecision = new Map((tokenUsageLedger.token_usage_records ?? []).map((record) => [record.budget_decision_id, record]));
  const alertByAttribution = new Map((budgetAlertLedger.alert_records ?? []).map((record) => [record.attribution_id, record]));
  const costRecordsByWorkflow = groupBy(observabilityCatalog.cost_records ?? [], (record) => record.workflow_run_id);
  const attributionsByWorkflow = groupBy(costAttributionLedger.attribution_records ?? [], (record) => record.workflow_run_id);

  const costObservationsV2 = (costAttributionLedger.attribution_records ?? []).map((record) => costObservationV2({
    attribution: record,
    budgetDecision: budgetDecisionById.get(record.budget_decision_id),
    tokenUsage: tokenUsageById.get(record.token_usage_id) ?? tokenUsageByBudgetDecision.get(record.budget_decision_id),
    alert: alertByAttribution.get(record.attribution_id),
    runLedger: runByWorkflow.get(record.workflow_run_id),
    generatedAt,
  }));
  const costObservationsByWorkflow = groupBy(costObservationsV2, (record) => record.workflow_run_id);

  const errorRecordsV2 = buildErrorRecords({
    runLedgers,
    observabilityRunsByWorkflow,
    eventsByWorkflow,
    generatedAt,
  });
  const errorRecordsByWorkflow = groupBy(errorRecordsV2, (record) => record.workflow_run_id);

  const traceProjectionsV2 = runLedgers.map((runLedger) => traceProjectionV2({
    runLedger,
    observabilityRun: observabilityRunsByWorkflow.get(runLedger.workflow_run_id),
    events: eventsByWorkflow.get(runLedger.workflow_run_id) ?? [],
    auditEvents: auditEventsByWorkflow.get(runLedger.workflow_run_id) ?? [],
    costObservations: costObservationsByWorkflow.get(runLedger.workflow_run_id) ?? [],
    rawCostRecords: costRecordsByWorkflow.get(runLedger.workflow_run_id) ?? [],
    attributionRecords: attributionsByWorkflow.get(runLedger.workflow_run_id) ?? [],
    errorRecords: errorRecordsByWorkflow.get(runLedger.workflow_run_id) ?? [],
    generatedAt,
  }));

  return {
    errorRecordsV2,
    costObservationsV2,
    traceProjectionsV2,
  };
}

function buildErrorRecords({ runLedgers, observabilityRunsByWorkflow, eventsByWorkflow, generatedAt }) {
  const records = [];
  for (const runLedger of runLedgers) {
    const observabilityRun = observabilityRunsByWorkflow.get(runLedger.workflow_run_id);
    if (!["completed", "passed", "success"].includes(String(runLedger.run_status ?? "").toLowerCase())) {
      records.push(errorRecordV2({
        errorId: `error.run_blocked.${slugify(runLedger.run_ledger_id)}`,
        errorKind: "run_blocked",
        errorType: runLedger.blocked_reason ?? "run_not_completed",
        severity: runLedger.run_status === "blocked" ? "blocked" : "warning",
        message: runLedger.blocked_reason ?? `Run ended with status ${runLedger.run_status ?? "unknown"}.`,
        runLedger,
        sourceEvent: null,
        retryable: false,
        blocking: runLedger.run_status === "blocked",
        generatedAt,
      }));
    }
    if ((observabilityRun?.error_count ?? 0) > 0) {
      records.push(errorRecordV2({
        errorId: `error.runtime_count.${slugify(runLedger.run_ledger_id)}`,
        errorKind: "runtime_error_count",
        errorType: "runtime_error",
        severity: "error",
        message: `${observabilityRun.error_count} runtime error(s) were reported by observability.`,
        runLedger,
        sourceEvent: null,
        retryable: true,
        blocking: true,
        generatedAt,
      }));
    }
    for (const event of eventsByWorkflow.get(runLedger.workflow_run_id) ?? []) {
      if (event.event_type !== "gate.failed") continue;
      records.push(errorRecordV2({
        errorId: `error.gate_failed.${slugify(event.event_record_id)}`,
        errorKind: "gate_failed",
        errorType: event.data?.gate_id ?? event.subject_id ?? "gate_failed",
        severity: event.data?.blocking ? "blocked" : "warning",
        message: `${event.data?.gate_id ?? event.subject_id ?? "gate"} failed.`,
        runLedger,
        sourceEvent: event,
        retryable: true,
        blocking: Boolean(event.data?.blocking),
        generatedAt,
      }));
    }
  }
  return records;
}

function errorRecordV2({ errorId, errorKind, errorType, severity, message, runLedger, sourceEvent, retryable, blocking, generatedAt }) {
  return {
    schema_version: ERROR_RECORD_SCHEMA_VERSION,
    error_record_id: errorId,
    source_error_id: sourceEvent?.event_record_id ?? runLedger.run_ledger_id,
    error_kind: errorKind,
    error_type: errorType,
    severity,
    error_status: "open",
    workflow_run_id: runLedger.workflow_run_id,
    run_ledger_id: runLedger.run_ledger_id,
    correlation_id: runLedger.correlation_id,
    tenant_id: runLedger.tenant_id,
    matter_id: runLedger.matter_id,
    capability_id: runLedger.capability_id,
    domain_pack: runLedger.domain_pack,
    policy_snapshot_id: runLedger.policy_snapshot_id,
    actor_type: sourceEvent?.actor_type ?? "harness",
    actor_id: sourceEvent?.actor_id ?? "harness.orchestrator",
    retryable,
    retry_count: 0,
    retry_status: retryable ? "retry_not_attempted" : "not_retryable",
    blocking,
    message,
    first_seen_at: sourceEvent?.event_time ?? runLedger.updated_at ?? generatedAt,
    last_seen_at: sourceEvent?.event_time ?? runLedger.updated_at ?? generatedAt,
    source_refs: {
      event_record_id: sourceEvent?.event_record_id ?? null,
      run_ledger_id: runLedger.run_ledger_id,
    },
    metadata: {
      run_status: runLedger.run_status,
      source_event_type: sourceEvent?.event_type ?? null,
    },
  };
}

function costObservationV2({ attribution, budgetDecision, tokenUsage, alert, runLedger, generatedAt }) {
  const sourceCostRecordIds = unique([
    ...(attribution.metadata?.cost_record_ids ?? []),
    ...(budgetDecision?.metadata?.cost_record_ids ?? []),
    ...(tokenUsage?.cost_record_ids ?? []),
  ]);
  const costStatus = alert?.alert_status && alert.alert_status !== "clear"
    ? alert.alert_status
    : attribution.attribution_status ?? "unknown";
  return {
    schema_version: COST_OBSERVATION_SCHEMA_VERSION,
    cost_observation_id: `cost-observation.${slugify(attribution.attribution_id)}`,
    attribution_id: attribution.attribution_id,
    budget_decision_id: attribution.budget_decision_id,
    token_usage_id: attribution.token_usage_id ?? tokenUsage?.token_usage_id ?? null,
    alert_record_id: alert?.alert_record_id ?? null,
    routing_decision_id: attribution.routing_decision_id,
    context_packet_id: attribution.context_packet_id,
    workflow_run_id: attribution.workflow_run_id,
    run_ledger_id: runLedger?.run_ledger_id ?? null,
    agent_run_id: attribution.agent_run_id,
    runtime_id: attribution.runtime_id,
    capability_id: attribution.capability_id,
    domain_pack: attribution.domain_pack,
    tenant_id: attribution.tenant_id,
    matter_id: attribution.matter_id,
    classification: attribution.classification,
    policy_snapshot_id: runLedger?.policy_snapshot_id ?? null,
    cost_status: costStatus,
    budget_status: attribution.budget_status,
    token_tracking_status: attribution.token_tracking_status,
    alert_status: alert?.alert_status ?? "clear",
    max_usd: attribution.max_usd,
    observed_usd: attribution.observed_usd,
    estimated_token_usd: attribution.estimated_token_usd,
    projected_usd: attribution.projected_usd,
    budget_remaining_usd: attribution.budget_remaining_usd,
    over_budget: attribution.over_budget,
    untracked_cost: attribution.untracked_cost,
    input_token_count: tokenUsage?.input_token_count ?? 0,
    output_token_count: tokenUsage?.output_token_count ?? 0,
    total_token_count: attribution.total_token_count ?? tokenUsage?.total_token_count ?? 0,
    observed_runtime_seconds: attribution.observed_runtime_seconds ?? 0,
    cost_record_count: attribution.cost_record_count ?? 0,
    source_cost_record_ids: sourceCostRecordIds,
    audit_required: Boolean(attribution.audit_required),
    recorded_at: generatedAt,
    cost_hash: hashValue({
      attribution_id: attribution.attribution_id,
      token_usage_id: attribution.token_usage_id ?? tokenUsage?.token_usage_id ?? null,
      projected_usd: attribution.projected_usd,
      total_token_count: attribution.total_token_count ?? tokenUsage?.total_token_count ?? 0,
      observed_runtime_seconds: attribution.observed_runtime_seconds ?? 0,
      costStatus,
    }),
    metadata: {
      attribution_hash: attribution.attribution_hash ?? null,
      budget_decision_hash: budgetDecision?.decision_hash ?? null,
      token_usage_hash: tokenUsage?.usage_hash ?? null,
      alert_hash: alert?.alert_hash ?? null,
    },
  };
}

function traceProjectionV2({ runLedger, observabilityRun, events, auditEvents, costObservations, rawCostRecords, attributionRecords, errorRecords, generatedAt }) {
  const retryEvents = events.filter((event) => String(event.event_type ?? "").includes("retry"));
  const observedRuntimeSeconds = observabilityRun?.runtime_seconds ?? sumBy(rawCostRecords.filter((record) => record.cost_type === "runtime_seconds"), "amount");
  const durationSeconds = secondsBetween(runLedger.started_at, runLedger.updated_at);
  const latencySeconds = observedRuntimeSeconds || durationSeconds;
  const tokenUsageIds = unique(costObservations.map((record) => record.token_usage_id).filter(Boolean));
  const costObservationIds = costObservations.map((record) => record.cost_observation_id);
  const errorRecordIds = errorRecords.map((record) => record.error_record_id);
  return {
    schema_version: TRACE_PROJECTION_SCHEMA_VERSION,
    trace_projection_id: `trace-projection.${slugify(runLedger.run_ledger_id)}`,
    run_ledger_id: runLedger.run_ledger_id,
    workflow_run_id: runLedger.workflow_run_id,
    correlation_id: runLedger.correlation_id,
    tenant_id: runLedger.tenant_id,
    matter_id: runLedger.matter_id,
    capability_id: runLedger.capability_id,
    domain_pack: runLedger.domain_pack,
    policy_snapshot_id: runLedger.policy_snapshot_id,
    run_status: runLedger.run_status,
    trace_status: errorRecordIds.length > 0 ? "attention" : "complete",
    started_at: runLedger.started_at,
    updated_at: runLedger.updated_at,
    duration_seconds: durationSeconds,
    observed_runtime_seconds: observedRuntimeSeconds,
    latency_seconds: latencySeconds,
    latency_status: Number.isFinite(latencySeconds) && latencySeconds >= 0 ? "observed" : "missing",
    retry_count: retryEvents.length,
    retry_status: retryEvents.length > 0 ? "retry_recorded" : "not_retried",
    retry_event_ids: retryEvents.map((event) => event.event_record_id),
    event_record_ids: events.map((event) => event.event_record_id),
    audit_event_ids: auditEvents.map((event) => event.audit_event_id),
    agent_run_ids: runLedger.agent_run_ids ?? [],
    error_record_ids: errorRecordIds,
    cost_observation_ids: costObservationIds,
    token_usage_ids: tokenUsageIds,
    event_count: events.length,
    audit_event_count: auditEvents.length,
    agent_run_count: runLedger.agent_run_ids?.length ?? 0,
    error_record_count: errorRecordIds.length,
    cost_observation_count: costObservationIds.length,
    token_usage_count: tokenUsageIds.length,
    projected_usd: roundMoney(sumBy(costObservations, "projected_usd")),
    total_token_count: costObservations.reduce((sum, record) => sum + Number(record.total_token_count ?? 0), 0),
    raw_cost_record_count: rawCostRecords.length,
    attribution_record_count: attributionRecords.length,
    recorded_at: generatedAt,
    metadata: {
      observability_run_id: observabilityRun?.run_id ?? null,
      source_runtime_seconds: observabilityRun?.runtime_seconds ?? null,
    },
  };
}

function validateErrorCostObservabilityContracts({
  observabilityCatalog,
  costBudgetLedger,
  tokenUsageLedger,
  costAttributionLedger,
  budgetAlertLedger,
  eventAuditRunContractFreeze,
  errorRecordsV2,
  costObservationsV2,
  traceProjectionsV2,
}) {
  const items = [];
  addValidation(items, {
    path: "source.event_audit_run_contract_freeze",
    check_id: "event_audit_run_freeze_complete",
    passed: eventAuditRunContractFreeze.summary?.freeze_status === "complete" && eventAuditRunContractFreeze.validation?.valid !== false,
    message: "Event/Audit/Run Ledger freeze is complete.",
  });
  for (const [sourceId, source] of [
    ["observability_catalog", observabilityCatalog],
    ["cost_budget_ledger", costBudgetLedger],
    ["token_usage_ledger", tokenUsageLedger],
    ["cost_attribution_ledger", costAttributionLedger],
    ["budget_alert_ledger", budgetAlertLedger],
  ]) {
    addValidation(items, {
      path: `source.${sourceId}`,
      check_id: "source_available_and_valid",
      passed: source.validation?.valid !== false && source.ledger_status !== "blocked",
      message: `${sourceId} is available for Error/Cost/Observability projection.`,
    });
  }
  addValidation(items, {
    path: "contract.error_records",
    check_id: "failure_projection_present",
    passed: errorRecordsV2.length >= (observabilityCatalog.summary?.blocked_run_count ?? 0),
    message: `${errorRecordsV2.length} ErrorRecord v2 contract(s) projected.`,
  });
  addValidation(items, {
    path: "contract.cost_observations",
    check_id: "cost_observation_count_matches_attribution",
    passed: costObservationsV2.length === (costAttributionLedger.attribution_records?.length ?? 0),
    message: `${costObservationsV2.length} CostObservation v2 contract(s) projected.`,
  });
  addValidation(items, {
    path: "contract.trace_projections",
    check_id: "trace_projection_count_matches_run_ledgers",
    passed: traceProjectionsV2.length === (eventAuditRunContractFreeze.event_audit_run_contract?.run_ledgers?.length ?? 0),
    message: `${traceProjectionsV2.length} TraceProjection v2 contract(s) projected.`,
  });
  for (const errorRecord of errorRecordsV2) {
    validateRequiredFields(items, "error_record", errorRecord.error_record_id, errorRecord, ["schema_version", "error_record_id", "error_kind", "severity", "workflow_run_id", "correlation_id", "policy_snapshot_id", "retry_status"]);
    addValidation(items, {
      path: `error_record.${errorRecord.error_record_id}.schema_version`,
      check_id: "error_record_schema_version",
      passed: errorRecord.schema_version === ERROR_RECORD_SCHEMA_VERSION,
      message: `${errorRecord.error_record_id} uses ErrorRecord v2.`,
    });
  }
  for (const costObservation of costObservationsV2) {
    validateRequiredFields(items, "cost_observation", costObservation.cost_observation_id, costObservation, ["schema_version", "cost_observation_id", "workflow_run_id", "runtime_id", "capability_id", "cost_status", "projected_usd", "total_token_count"]);
    addValidation(items, {
      path: `cost_observation.${costObservation.cost_observation_id}.token_usage_id`,
      check_id: "cost_observation_token_usage_linked",
      passed: Boolean(costObservation.token_usage_id),
      message: `${costObservation.cost_observation_id} links token usage ${costObservation.token_usage_id ?? "missing"}.`,
    });
  }
  for (const trace of traceProjectionsV2) {
    validateRequiredFields(items, "trace_projection", trace.trace_projection_id, trace, ["schema_version", "trace_projection_id", "run_ledger_id", "workflow_run_id", "correlation_id", "policy_snapshot_id", "latency_status", "retry_status"]);
    addValidation(items, {
      path: `trace_projection.${trace.trace_projection_id}.latency_status`,
      check_id: "trace_projection_latency_observed",
      passed: trace.latency_status === "observed",
      message: `${trace.trace_projection_id} has latency status ${trace.latency_status}.`,
    });
    addValidation(items, {
      path: `trace_projection.${trace.trace_projection_id}.cost_observation_ids`,
      check_id: "trace_projection_cost_observation_linked",
      passed: trace.cost_observation_count > 0,
      message: `${trace.trace_projection_id} links ${trace.cost_observation_count} cost observation(s).`,
    });
  }
  return items;
}

function validateRequiredFields(items, kind, id, record, fields) {
  for (const field of fields) {
    addValidation(items, {
      path: `${kind}.${id}.${field}`,
      check_id: `${kind}_${field}_present`,
      passed: record[field] !== undefined && record[field] !== null && record[field] !== "",
      message: `${id} ${field} is ${record[field] === undefined || record[field] === null || record[field] === "" ? "missing" : "present"}.`,
    });
  }
}

function summarizeFreeze(projection, validationItems, validation) {
  const { errorRecordsV2, costObservationsV2, traceProjectionsV2 } = projection;
  const totalRuntimeSeconds = sumBy(traceProjectionsV2, "observed_runtime_seconds");
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    error_record_schema_version: ERROR_RECORD_SCHEMA_VERSION,
    cost_observation_schema_version: COST_OBSERVATION_SCHEMA_VERSION,
    trace_projection_schema_version: TRACE_PROJECTION_SCHEMA_VERSION,
    error_record_count: errorRecordsV2.length,
    run_blocked_error_count: errorRecordsV2.filter((record) => record.error_kind === "run_blocked").length,
    gate_failed_error_count: errorRecordsV2.filter((record) => record.error_kind === "gate_failed").length,
    retryable_error_count: errorRecordsV2.filter((record) => record.retryable).length,
    blocking_error_count: errorRecordsV2.filter((record) => record.blocking).length,
    cost_observation_count: costObservationsV2.length,
    token_usage_linked_count: costObservationsV2.filter((record) => record.token_usage_id).length,
    missing_token_usage_count: costObservationsV2.filter((record) => !record.token_usage_id).length,
    cost_attribution_linked_count: costObservationsV2.filter((record) => record.attribution_id).length,
    budget_alert_linked_count: costObservationsV2.filter((record) => record.alert_record_id).length,
    over_budget_count: costObservationsV2.filter((record) => record.over_budget).length,
    untracked_cost_count: costObservationsV2.filter((record) => record.untracked_cost).length,
    total_projected_usd: roundMoney(sumBy(costObservationsV2, "projected_usd")),
    total_observed_usd: roundMoney(sumBy(costObservationsV2, "observed_usd")),
    total_estimated_token_usd: roundMoney(sumBy(costObservationsV2, "estimated_token_usd")),
    total_token_count: costObservationsV2.reduce((sum, record) => sum + Number(record.total_token_count ?? 0), 0),
    trace_projection_count: traceProjectionsV2.length,
    trace_with_error_count: traceProjectionsV2.filter((trace) => trace.error_record_count > 0).length,
    trace_with_cost_count: traceProjectionsV2.filter((trace) => trace.cost_observation_count > 0).length,
    trace_with_policy_snapshot_count: traceProjectionsV2.filter((trace) => trace.policy_snapshot_id).length,
    latency_observed_count: traceProjectionsV2.filter((trace) => trace.latency_status === "observed").length,
    missing_latency_count: traceProjectionsV2.filter((trace) => trace.latency_status !== "observed").length,
    total_runtime_seconds: totalRuntimeSeconds,
    average_latency_seconds: traceProjectionsV2.length > 0 ? roundNumber(totalRuntimeSeconds / traceProjectionsV2.length, 4) : 0,
    retry_projection_count: traceProjectionsV2.length,
    retry_count: traceProjectionsV2.reduce((sum, trace) => sum + Number(trace.retry_count ?? 0), 0),
    trace_with_retry_count: traceProjectionsV2.filter((trace) => trace.retry_count > 0).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_error_kind: countBy(errorRecordsV2, "error_kind"),
    by_error_severity: countBy(errorRecordsV2, "severity"),
    by_cost_status: countBy(costObservationsV2, "cost_status"),
    by_trace_status: countBy(traceProjectionsV2, "trace_status"),
    by_retry_status: countBy(traceProjectionsV2, "retry_status"),
    by_runtime_id: countBy(costObservationsV2, "runtime_id"),
    by_domain_pack: countBy(costObservationsV2, "domain_pack"),
  };
}

function buildFieldRequirements() {
  return {
    error_record_v2: {
      required_fields: ["schema_version", "error_record_id", "error_kind", "severity", "workflow_run_id", "correlation_id", "policy_snapshot_id", "retry_status"],
      optional_fields: ["source_error_id", "source_refs", "metadata"],
      required_groups: {
        recovery: ["retryable", "retry_count", "retry_status", "blocking"],
      },
    },
    cost_observation_v2: {
      required_fields: ["schema_version", "cost_observation_id", "workflow_run_id", "runtime_id", "capability_id", "cost_status", "projected_usd", "total_token_count"],
      optional_fields: ["token_usage_id", "alert_record_id", "source_cost_record_ids", "metadata"],
      required_groups: {
        attribution: ["attribution_id", "budget_decision_id", "tenant_id", "matter_id", "domain_pack"],
      },
    },
    trace_projection_v2: {
      required_fields: ["schema_version", "trace_projection_id", "run_ledger_id", "workflow_run_id", "correlation_id", "policy_snapshot_id", "latency_status", "retry_status"],
      optional_fields: ["event_record_ids", "audit_event_ids", "error_record_ids", "cost_observation_ids", "metadata"],
      required_groups: {
        observability: ["duration_seconds", "observed_runtime_seconds", "retry_count", "projected_usd", "total_token_count"],
      },
    },
  };
}

function renderErrorCostObservabilityContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Error/Cost/Observability Contract Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Freeze ID: ${result.freeze_id}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Freeze status: ${result.summary.freeze_status}`);
  lines.push(`- ErrorRecord v2: ${result.summary.error_record_count}`);
  lines.push(`- CostObservation v2: ${result.summary.cost_observation_count}`);
  lines.push(`- TraceProjection v2: ${result.summary.trace_projection_count}`);
  lines.push(`- Latency coverage: ${result.summary.latency_observed_count}/${result.summary.trace_projection_count}`);
  lines.push(`- Token usage links: ${result.summary.token_usage_linked_count}/${result.summary.cost_observation_count}`);
  lines.push(`- Total projected USD: ${result.summary.total_projected_usd}`);
  lines.push(`- Total runtime seconds: ${result.summary.total_runtime_seconds}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Trace Projections");
  lines.push("");
  for (const trace of result.error_cost_observability_contract.trace_projections) {
    lines.push(`- ${trace.workflow_run_id}: ${trace.trace_status}, latency ${trace.latency_seconds}s, errors ${trace.error_record_count}, cost observations ${trace.cost_observation_count}`);
  }
  if (result.error_cost_observability_contract.trace_projections.length === 0) lines.push("- No trace projections generated.");
  return `${lines.join("\n")}\n`;
}

function sourceContract(source, extra = {}) {
  return {
    schema_version: source.schema_version ?? null,
    generated_at: source.generated_at ?? null,
    ...extra,
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_ERROR_COST_OBSERVABILITY_CONTRACT_FREEZE_INPUTS;
  return {
    observability_catalog_path: path.resolve(options.observabilityCatalogPath ?? defaults.observabilityCatalogPath),
    cost_budget_ledger_path: path.resolve(options.costBudgetLedgerPath ?? defaults.costBudgetLedgerPath),
    token_usage_ledger_path: path.resolve(options.tokenUsageLedgerPath ?? defaults.tokenUsageLedgerPath),
    cost_attribution_ledger_path: path.resolve(options.costAttributionLedgerPath ?? defaults.costAttributionLedgerPath),
    budget_alert_ledger_path: path.resolve(options.budgetAlertLedgerPath ?? defaults.budgetAlertLedgerPath),
    event_audit_run_contract_freeze_path: path.resolve(options.eventAuditRunContractFreezePath ?? defaults.eventAuditRunContractFreezePath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message, metadata = {} }) {
  items.push({
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    metadata,
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status === "failed")
    .map((item) => ({
      path: item.path,
      check_id: item.check_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = typeof keyFn === "function" ? keyFn(item) : item[keyFn];
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function sumBy(items, key) {
  return items.reduce((sum, item) => sum + Number(item[key] ?? 0), 0);
}

function secondsBetween(start, end) {
  const startMs = Date.parse(start ?? "");
  const endMs = Date.parse(end ?? "");
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return 0;
  return roundNumber((endMs - startMs) / 1000, 4);
}

function roundMoney(value) {
  return Math.round(Number(value ?? 0) * 10000) / 10000;
}

function roundNumber(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(Number(value ?? 0) * factor) / factor;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_ERROR_COST_OBSERVABILITY_CONTRACT_FREEZE_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--cost-budget-ledger") parsed.costBudgetLedgerPath = argv[++index];
    else if (arg === "--token-usage-ledger") parsed.tokenUsageLedgerPath = argv[++index];
    else if (arg === "--cost-attribution-ledger") parsed.costAttributionLedgerPath = argv[++index];
    else if (arg === "--budget-alert-ledger") parsed.budgetAlertLedgerPath = argv[++index];
    else if (arg === "--event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/error-cost-observability-contract-freeze.mjs [options]

Freeze ErrorRecord, CostObservation, and TraceProjection v2 contracts.

Options:
  --check                                      Exit non-zero when validation fails.
  --out-dir, --out <path>                     Output directory.
  --run-at <iso>                              Override generated_at timestamp.
  --observability-catalog <path>              Observability catalog JSON.
  --cost-budget-ledger <path>                 Cost budget ledger JSON.
  --token-usage-ledger <path>                 Token usage ledger JSON.
  --cost-attribution-ledger <path>            Cost attribution ledger JSON.
  --budget-alert-ledger <path>                Budget alert ledger JSON.
  --event-audit-run-contract-freeze <path>    Event/Audit/Run Ledger contract freeze JSON.
`);
}
