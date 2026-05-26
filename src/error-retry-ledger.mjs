import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ERROR_RETRY_LEDGER_OUT_DIR = "artifacts/error-retry-ledger/latest";
export const DEFAULT_ERROR_RETRY_LEDGER_INPUTS = {
  errorCostObservabilityContractFreezePath: "artifacts/error-cost-observability-contract-freeze/latest/error-cost-observability-contract-freeze.json",
  observabilityTraceProjectionPath: "artifacts/observability-trace-projection/latest/observability-trace-projection.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  toolInvocationLedgerPath: "artifacts/tool-invocation-ledger/latest/tool-invocation-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "error-retry-ledger.v1";
const PROJECTED_ERROR_SCHEMA_VERSION = "projected-error-record.v1";
const RETRY_RECORD_SCHEMA_VERSION = "retry-record.v1";
const TIMEOUT_RECORD_SCHEMA_VERSION = "timeout-record.v1";
const RESUME_STATE_RECORD_SCHEMA_VERSION = "resume-state-record.v1";

export async function runErrorRetryLedger(options = {}) {
  const result = await buildErrorRetryLedger(options);
  if (options.write !== false) await writeErrorRetryLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Error/retry ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildErrorRetryLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ERROR_RETRY_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    errorCostObservabilityContractFreeze: await readJsonOrError(inputs.error_cost_observability_contract_freeze_path),
    observabilityTraceProjection: await readJsonOrError(inputs.observability_trace_projection_path),
    workflowRunLedger: await readJsonOrError(inputs.workflow_run_ledger_path),
    toolInvocationLedger: await readJsonOrError(inputs.tool_invocation_ledger_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
  };
  const projection = buildProjection(sources, generatedAt);
  const validationItems = validateErrorRetryLedger({ sources, projection });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    error_retry_ledger_id: `error-retry-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    error_retry_ledger_contract: buildContract(generatedAt),
    error_retry_ledger_catalog: {
      schema_version: "error-retry-ledger-catalog.v1",
      generated_at: generatedAt,
      projected_error_records: projection.projectedErrorRecords,
      retry_records: projection.retryRecords,
      timeout_records: projection.timeoutRecords,
      resume_state_records: projection.resumeStateRecords,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeProjection(projection, validation),
  };
  return {
    ...result,
    markdown: renderErrorRetryLedgerMarkdown(result),
  };
}

export async function writeErrorRetryLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "error-retry-ledger.json"), serializableLedger(result));
  await writeJson(path.join(outDir, "projected-error-records.json"), {
    schema_version: "projected-error-records.v1",
    generated_at: result.generated_at,
    projected_error_record_count: result.error_retry_ledger_catalog.projected_error_records.length,
    projected_error_records: result.error_retry_ledger_catalog.projected_error_records,
  });
  await writeJson(path.join(outDir, "retry-records.json"), {
    schema_version: "retry-records.v1",
    generated_at: result.generated_at,
    retry_record_count: result.error_retry_ledger_catalog.retry_records.length,
    retry_records: result.error_retry_ledger_catalog.retry_records,
  });
  await writeJson(path.join(outDir, "timeout-records.json"), {
    schema_version: "timeout-records.v1",
    generated_at: result.generated_at,
    timeout_record_count: result.error_retry_ledger_catalog.timeout_records.length,
    timeout_records: result.error_retry_ledger_catalog.timeout_records,
  });
  await writeJson(path.join(outDir, "resume-state-records.json"), {
    schema_version: "resume-state-records.v1",
    generated_at: result.generated_at,
    resume_state_record_count: result.error_retry_ledger_catalog.resume_state_records.length,
    resume_state_records: result.error_retry_ledger_catalog.resume_state_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "error-retry-ledger-validation-report.v1",
    generated_at: result.generated_at,
    error_retry_ledger_id: result.error_retry_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runErrorRetryLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runErrorRetryLedger(args);
    console.log(`Error/retry ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.error_retry_ledger_status}`);
    console.log(`Error/retry/timeout/resume records: ${result.summary.projected_error_record_count}/${result.summary.retry_record_count}/${result.summary.timeout_record_count}/${result.summary.resume_state_record_count}`);
    console.log(`Retryable/non-retryable: ${result.summary.retryable_error_count}/${result.summary.non_retryable_error_count}`);
    console.log(`Auto retries scheduled: ${result.summary.auto_retry_scheduled_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildProjection(sources, generatedAt) {
  const errorCostFreeze = sources.errorCostObservabilityContractFreeze.value ?? {};
  const traceProjection = sources.observabilityTraceProjection.value ?? {};
  const workflowRunLedger = sources.workflowRunLedger.value ?? {};
  const toolInvocationLedger = sources.toolInvocationLedger.value ?? {};

  const sourceErrorRecords = errorCostFreeze.error_cost_observability_contract?.error_records ?? [];
  const traceProjections = errorCostFreeze.error_cost_observability_contract?.trace_projections ?? [];
  const observabilityTraceRecords = traceProjection.observability_trace_projection_catalog?.observability_trace_records ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const toolInvocationRecords = toolInvocationLedger.tool_invocation_catalog?.tool_invocation_records ?? [];

  const traceIndexes = buildTraceIndexes({ traceProjections, observabilityTraceRecords });
  const workflowById = new Map(workflowRunRecords.map((record) => [record.workflow_run_id, record]));
  const blockedToolsByWorkflow = groupBy(
    toolInvocationRecords.filter((record) => record.invocation_state === "blocked" || record.permission_status === "blocked"),
    "workflow_run_id",
  );

  const projectedErrorRecords = sourceErrorRecords.map((record) => projectedErrorRecord({
    record,
    workflow: workflowById.get(record.workflow_run_id),
    trace: resolveTraceForError(record, traceIndexes),
    blockedTools: blockedToolsByWorkflow.get(record.workflow_run_id) ?? [],
    generatedAt,
  })).sort(by("projected_error_record_id"));

  const retryRecords = projectedErrorRecords.map((record) => retryRecord(record, generatedAt)).sort(by("retry_record_id"));
  const timeoutRecords = projectedErrorRecords.map((record) => timeoutRecord(record, generatedAt)).sort(by("timeout_record_id"));
  const resumeStateRecords = projectedErrorRecords.map((record) => resumeStateRecord(record, generatedAt)).sort(by("resume_state_record_id"));

  return {
    projectedErrorRecords,
    retryRecords,
    timeoutRecords,
    resumeStateRecords,
    sourceCounts: {
      source_error_record_count: errorCostFreeze.summary?.error_record_count ?? sourceErrorRecords.length,
      trace_projection_count: errorCostFreeze.summary?.trace_projection_count ?? traceProjections.length,
      observability_trace_record_count: traceProjection.summary?.observability_trace_record_count ?? observabilityTraceRecords.length,
      workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
      blocked_tool_invocation_count: toolInvocationLedger.summary?.blocked_tool_invocation_count ?? toolInvocationRecords.filter((record) => record.invocation_state === "blocked" || record.permission_status === "blocked").length,
      source_retryable_error_count: errorCostFreeze.summary?.retryable_error_count ?? sourceErrorRecords.filter((record) => record.retryable).length,
      source_blocking_error_count: errorCostFreeze.summary?.blocking_error_count ?? sourceErrorRecords.filter((record) => record.blocking).length,
    },
  };
}

function projectedErrorRecord({ record, workflow, trace, blockedTools, generatedAt }) {
  const timeoutState = deriveTimeoutState(record, trace);
  const retryState = deriveRetryState(record);
  const resumeState = deriveResumeState(record);
  const projected = {
    schema_version: PROJECTED_ERROR_SCHEMA_VERSION,
    projected_error_record_id: `projected-error.${slugify(record.error_record_id)}`,
    source_error_record_id: record.error_record_id,
    source_error_id: record.source_error_id ?? null,
    source_ledger: "error_cost_observability_contract_freeze",
    error_kind: record.error_kind,
    error_type: record.error_type,
    severity: record.severity,
    error_status: record.error_status,
    failure_state: deriveFailureState(record),
    retry_state: retryState,
    timeout_state: timeoutState,
    resume_state: resumeState,
    workflow_run_id: record.workflow_run_id ?? null,
    workflow_run_record_status: workflow?.workflow_run_record_status ?? workflow?.run_status ?? null,
    run_ledger_id: record.run_ledger_id ?? null,
    correlation_id: record.correlation_id ?? null,
    correlation_trace_id: trace?.correlation_trace_id ?? null,
    observability_trace_id: trace?.observability_trace_id ?? null,
    trace_projection_id: trace?.trace_projection_id ?? null,
    trace_binding_status: trace ? "bound" : "missing_trace",
    tenant_id: record.tenant_id ?? null,
    matter_id: record.matter_id ?? null,
    capability_id: record.capability_id ?? null,
    domain_pack: record.domain_pack ?? null,
    policy_snapshot_id: record.policy_snapshot_id ?? null,
    actor_type: record.actor_type ?? null,
    actor_id: record.actor_id ?? null,
    retryable: Boolean(record.retryable),
    retry_count: Number(record.retry_count ?? 0),
    retry_status: record.retry_status ?? "unknown",
    blocking: Boolean(record.blocking),
    blocked_tool_invocation_count: blockedTools.length,
    protected_tool_block_count: blockedTools.filter((tool) => tool.protected_action).length,
    message: record.message ?? "",
    first_seen_at: record.first_seen_at ?? null,
    last_seen_at: record.last_seen_at ?? null,
    source_event_record_id: record.source_refs?.event_record_id ?? null,
    source_refs: record.source_refs ?? {},
    metadata: {
      ...(record.metadata ?? {}),
      timeout_observed: timeoutState !== "not_timeout",
      resume_requires_human: resumeRequiresHuman(record),
      workflow_terminal_state: workflow?.terminal_state ?? null,
    },
    recorded_at: generatedAt,
  };
  return {
    ...projected,
    projected_error_record_hash: hashValue(projected),
  };
}

function retryRecord(errorRecord, generatedAt) {
  const retryState = errorRecord.retry_state;
  const requiresHuman = resumeRequiresHuman(errorRecord);
  const retry = {
    schema_version: RETRY_RECORD_SCHEMA_VERSION,
    retry_record_id: `retry-record.${slugify(errorRecord.source_error_record_id)}`,
    projected_error_record_id: errorRecord.projected_error_record_id,
    source_error_record_id: errorRecord.source_error_record_id,
    workflow_run_id: errorRecord.workflow_run_id,
    run_ledger_id: errorRecord.run_ledger_id,
    correlation_trace_id: errorRecord.correlation_trace_id,
    observability_trace_id: errorRecord.observability_trace_id,
    error_kind: errorRecord.error_kind,
    error_type: errorRecord.error_type,
    retryable: errorRecord.retryable,
    retry_count: errorRecord.retry_count,
    retry_status: errorRecord.retry_status,
    retry_state: retryState,
    auto_retry_scheduled: false,
    retry_schedule_state: "not_scheduled",
    requires_human_before_retry: requiresHuman,
    next_retry_action: nextRetryAction(errorRecord),
    retry_policy_status: errorRecord.retryable ? "manual_gate_required" : "not_retryable",
    recorded_at: generatedAt,
  };
  return {
    ...retry,
    retry_record_hash: hashValue(retry),
  };
}

function timeoutRecord(errorRecord, generatedAt) {
  const timeoutObserved = errorRecord.timeout_state !== "not_timeout";
  const timeout = {
    schema_version: TIMEOUT_RECORD_SCHEMA_VERSION,
    timeout_record_id: `timeout-record.${slugify(errorRecord.source_error_record_id)}`,
    projected_error_record_id: errorRecord.projected_error_record_id,
    source_error_record_id: errorRecord.source_error_record_id,
    workflow_run_id: errorRecord.workflow_run_id,
    run_ledger_id: errorRecord.run_ledger_id,
    correlation_trace_id: errorRecord.correlation_trace_id,
    observability_trace_id: errorRecord.observability_trace_id,
    error_kind: errorRecord.error_kind,
    error_type: errorRecord.error_type,
    timeout_state: errorRecord.timeout_state,
    timeout_observed: timeoutObserved,
    latency_status: errorRecord.metadata?.latency_status ?? null,
    latency_seconds: errorRecord.metadata?.latency_seconds ?? null,
    timeout_threshold_seconds: errorRecord.metadata?.timeout_threshold_seconds ?? null,
    timeout_policy_status: timeoutObserved ? "requires_resume_plan" : "not_timeout",
    recorded_at: generatedAt,
  };
  return {
    ...timeout,
    timeout_record_hash: hashValue(timeout),
  };
}

function resumeStateRecord(errorRecord, generatedAt) {
  const humanRequired = resumeRequiresHuman(errorRecord);
  const resume = {
    schema_version: RESUME_STATE_RECORD_SCHEMA_VERSION,
    resume_state_record_id: `resume-state.${slugify(errorRecord.source_error_record_id)}`,
    projected_error_record_id: errorRecord.projected_error_record_id,
    source_error_record_id: errorRecord.source_error_record_id,
    workflow_run_id: errorRecord.workflow_run_id,
    run_ledger_id: errorRecord.run_ledger_id,
    correlation_trace_id: errorRecord.correlation_trace_id,
    observability_trace_id: errorRecord.observability_trace_id,
    error_kind: errorRecord.error_kind,
    error_type: errorRecord.error_type,
    failure_state: errorRecord.failure_state,
    retry_state: errorRecord.retry_state,
    timeout_state: errorRecord.timeout_state,
    resume_state: errorRecord.resume_state,
    resume_required: errorRecord.blocking || errorRecord.retryable,
    resume_blocked: errorRecord.blocking,
    human_approval_required: humanRequired,
    resume_owner: humanRequired ? "attorney_or_designated_reviewer" : "harness_operator",
    resume_preconditions: resumePreconditions(errorRecord),
    next_resume_action: nextResumeAction(errorRecord),
    recorded_at: generatedAt,
  };
  return {
    ...resume,
    resume_state_record_hash: hashValue(resume),
  };
}

function buildTraceIndexes({ traceProjections, observabilityTraceRecords }) {
  const observabilityByWorkflow = new Map(observabilityTraceRecords.map((record) => [record.workflow_run_id, record]));
  const observabilityByCorrelation = new Map(observabilityTraceRecords.map((record) => [record.correlation_id, record]));
  const byErrorId = new Map();
  const byWorkflowRunId = new Map();
  const byCorrelationId = new Map();
  for (const trace of traceProjections) {
    const observability = observabilityByWorkflow.get(trace.workflow_run_id) ?? observabilityByCorrelation.get(trace.correlation_id);
    const merged = {
      trace_projection_id: trace.trace_projection_id,
      correlation_trace_id: observability?.correlation_trace_id ?? null,
      observability_trace_id: observability?.observability_trace_id ?? null,
      workflow_run_id: trace.workflow_run_id,
      run_ledger_id: trace.run_ledger_id,
      correlation_id: trace.correlation_id,
      latency_status: trace.latency_status ?? null,
      latency_seconds: trace.latency_seconds ?? null,
      duration_seconds: trace.duration_seconds ?? null,
    };
    if (trace.workflow_run_id) byWorkflowRunId.set(trace.workflow_run_id, merged);
    if (trace.correlation_id) byCorrelationId.set(trace.correlation_id, merged);
    for (const errorId of trace.error_record_ids ?? []) byErrorId.set(errorId, merged);
  }
  return { byErrorId, byWorkflowRunId, byCorrelationId };
}

function resolveTraceForError(record, indexes) {
  const trace = indexes.byErrorId.get(record.error_record_id)
    ?? indexes.byWorkflowRunId.get(record.workflow_run_id)
    ?? indexes.byCorrelationId.get(record.correlation_id)
    ?? null;
  if (!trace) return null;
  return {
    ...trace,
    latency_status: trace.latency_status,
    latency_seconds: trace.latency_seconds,
  };
}

function deriveFailureState(record) {
  if (record.error_status === "closed") return "closed_failure";
  if (record.blocking) return "blocking_failure";
  return "nonblocking_failure";
}

function deriveRetryState(record) {
  if (!record.retryable) return "not_retryable";
  if (Number(record.retry_count ?? 0) > 0) return "retry_attempted";
  if (record.retry_status === "retry_exhausted") return "retry_exhausted";
  return "retry_available";
}

function deriveTimeoutState(record) {
  const haystack = `${record.error_kind ?? ""} ${record.error_type ?? ""} ${record.message ?? ""}`.toLowerCase();
  if (haystack.includes("timeout") || haystack.includes("timed_out")) return "timeout_observed";
  return "not_timeout";
}

function deriveResumeState(record) {
  if (record.error_status === "closed") return "resume_not_required";
  if (record.blocking && resumeRequiresHuman(record)) return "blocked_waiting_for_human";
  if (record.blocking) return "blocked_pending_resolution";
  if (record.retryable) return "resume_ready_after_gate_review";
  return "resume_not_required";
}

function resumeRequiresHuman(record) {
  const text = `${record.error_type ?? ""} ${record.message ?? ""}`.toLowerCase();
  return Boolean(record.blocking)
    || text.includes("approval")
    || text.includes("human")
    || text.includes("attorney");
}

function resumePreconditions(errorRecord) {
  if (errorRecord.resume_state === "resume_not_required") return [];
  const preconditions = [];
  if (errorRecord.human_approval_required ?? resumeRequiresHuman(errorRecord)) preconditions.push("human_approval_recorded");
  if (errorRecord.retryable) preconditions.push("retry_gate_reviewed");
  if (errorRecord.timeout_state !== "not_timeout") preconditions.push("timeout_cause_resolved");
  if (errorRecord.trace_binding_status !== "bound") preconditions.push("trace_binding_resolved");
  return preconditions.length > 0 ? preconditions : ["operator_resolution_recorded"];
}

function nextRetryAction(errorRecord) {
  if (!errorRecord.retryable) return "not_applicable";
  if (resumeRequiresHuman(errorRecord)) return "human_approval_required";
  return "manual_retry_review_required";
}

function nextResumeAction(errorRecord) {
  if (errorRecord.resume_state === "resume_not_required") return "none";
  if (resumeRequiresHuman(errorRecord)) return "record_human_approval_or_rejection";
  if (errorRecord.retryable) return "review_retry_candidate";
  return "record_operator_resolution";
}

function validateErrorRetryLedger({ sources, projection }) {
  const items = [];
  for (const [sourceName, source] of Object.entries(sources)) {
    items.push(validationItem(`source.${sourceName}`, `source_${sourceName}_available`, source.ok, `${sourceName} is available.`));
  }
  const packageScripts = sources.packageJson.value?.scripts ?? {};
  const roadmapText = String(sources.roadmap.value ?? "");
  const summary = summarizeProjection(projection, { errors: [] });
  items.push(validationItem("package.scripts.observability:errors", "package_script_declared", Boolean(packageScripts["observability:errors"]), "`observability:errors` package script must be declared."));
  items.push(validationItem("roadmap.phase_171", "roadmap_phase_declared", roadmapText.includes("Phase 171: Error Retry Ledger"), "Phase 171 roadmap entry must be declared."));
  items.push(validationItem("projected_error_records", "error_records_present", summary.projected_error_record_count > 0, "Projected error records must be produced."));
  items.push(validationItem("projected_error_records.count", "source_error_count_matches", summary.projected_error_record_count === projection.sourceCounts.source_error_record_count, "Every source ErrorRecord v2 row must be projected."));
  items.push(validationItem("retry_records.count", "retry_record_count_matches_error_count", summary.retry_record_count === summary.projected_error_record_count, "Every projected error must have one retry record."));
  items.push(validationItem("timeout_records.count", "timeout_record_count_matches_error_count", summary.timeout_record_count === summary.projected_error_record_count, "Every projected error must have one timeout classification record."));
  items.push(validationItem("resume_state_records.count", "resume_state_record_count_matches_error_count", summary.resume_state_record_count === summary.projected_error_record_count, "Every projected error must have one resume-state record."));
  items.push(validationItem("projected_error_records.trace_binding", "all_errors_bound_to_trace", summary.missing_trace_binding_count === 0, "Every projected error must bind to a known observability trace."));
  items.push(validationItem("retry_records.auto_retry", "no_auto_retry_scheduled", summary.auto_retry_scheduled_count === 0, "The ledger must not schedule auto retries without an explicit gate."));
  items.push(validationItem("retry_records.retryable_count", "retryable_count_matches_source", summary.retryable_error_count === projection.sourceCounts.source_retryable_error_count, "Retryable projected error count must match source ErrorRecord v2 retryable count."));
  items.push(validationItem("resume_state_records.blocking", "blocking_errors_have_resume_state", summary.resume_blocked_count === projection.sourceCounts.source_blocking_error_count, "Every blocking source error must be represented as a blocked resume-state row."));
  items.push(validationItem("projected_error_records.hash", "projected_error_hashes_present", projection.projectedErrorRecords.every((record) => record.projected_error_record_hash), "Every projected error record must have a hash."));
  items.push(validationItem("retry_records.hash", "retry_hashes_present", projection.retryRecords.every((record) => record.retry_record_hash), "Every retry record must have a hash."));
  items.push(validationItem("timeout_records.hash", "timeout_hashes_present", projection.timeoutRecords.every((record) => record.timeout_record_hash), "Every timeout record must have a hash."));
  items.push(validationItem("resume_state_records.hash", "resume_hashes_present", projection.resumeStateRecords.every((record) => record.resume_state_record_hash), "Every resume-state record must have a hash."));
  return items;
}

function summarizeProjection(projection, validation) {
  const projectedErrorRecords = projection.projectedErrorRecords;
  const retryRecords = projection.retryRecords;
  const timeoutRecords = projection.timeoutRecords;
  const resumeStateRecords = projection.resumeStateRecords;
  return {
    error_retry_ledger_status: validation.errors.length === 0 ? "complete" : "blocked",
    error_retry_ledger_contract_id: CONTRACT_ID,
    projected_error_record_count: projectedErrorRecords.length,
    source_error_record_count: projection.sourceCounts.source_error_record_count,
    source_trace_projection_count: projection.sourceCounts.trace_projection_count,
    source_observability_trace_record_count: projection.sourceCounts.observability_trace_record_count,
    source_workflow_run_record_count: projection.sourceCounts.workflow_run_record_count,
    source_blocked_tool_invocation_count: projection.sourceCounts.blocked_tool_invocation_count,
    retry_record_count: retryRecords.length,
    timeout_record_count: timeoutRecords.length,
    resume_state_record_count: resumeStateRecords.length,
    failure_record_count: projectedErrorRecords.filter((record) => record.failure_state.endsWith("_failure")).length,
    blocking_error_count: projectedErrorRecords.filter((record) => record.blocking).length,
    nonblocking_error_count: projectedErrorRecords.filter((record) => !record.blocking).length,
    retryable_error_count: projectedErrorRecords.filter((record) => record.retryable).length,
    non_retryable_error_count: projectedErrorRecords.filter((record) => !record.retryable).length,
    retry_available_count: retryRecords.filter((record) => record.retry_state === "retry_available").length,
    retry_attempted_count: retryRecords.filter((record) => record.retry_state === "retry_attempted").length,
    retry_exhausted_count: retryRecords.filter((record) => record.retry_state === "retry_exhausted").length,
    retry_not_scheduled_count: retryRecords.filter((record) => record.retry_schedule_state === "not_scheduled").length,
    auto_retry_scheduled_count: retryRecords.filter((record) => record.auto_retry_scheduled).length,
    timeout_observed_count: timeoutRecords.filter((record) => record.timeout_observed).length,
    non_timeout_record_count: timeoutRecords.filter((record) => !record.timeout_observed).length,
    resume_required_count: resumeStateRecords.filter((record) => record.resume_required).length,
    resume_blocked_count: resumeStateRecords.filter((record) => record.resume_blocked).length,
    resume_ready_count: resumeStateRecords.filter((record) => record.resume_state === "resume_ready_after_gate_review").length,
    resume_not_required_count: resumeStateRecords.filter((record) => record.resume_state === "resume_not_required").length,
    human_approval_required_resume_count: resumeStateRecords.filter((record) => record.human_approval_required).length,
    trace_bound_error_count: projectedErrorRecords.filter((record) => record.trace_binding_status === "bound").length,
    missing_trace_binding_count: projectedErrorRecords.filter((record) => record.trace_binding_status !== "bound").length,
    validation_item_count: validation.items?.length ?? 0,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_error_kind: countBy(projectedErrorRecords, "error_kind"),
    by_error_status: countBy(projectedErrorRecords, "error_status"),
    by_failure_state: countBy(projectedErrorRecords, "failure_state"),
    by_retry_state: countBy(retryRecords, "retry_state"),
    by_timeout_state: countBy(timeoutRecords, "timeout_state"),
    by_resume_state: countBy(resumeStateRecords, "resume_state"),
    by_trace_binding_status: countBy(projectedErrorRecords, "trace_binding_status"),
    by_domain_pack: countBy(projectedErrorRecords, "domain_pack"),
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "error-retry-ledger-contract.v1",
    generated_at: generatedAt,
    error_retry_ledger_contract_id: CONTRACT_ID,
    required_error_fields: [
      "projected_error_record_id",
      "source_error_record_id",
      "error_kind",
      "error_status",
      "failure_state",
      "retry_state",
      "timeout_state",
      "resume_state",
      "trace_binding_status",
    ],
    separated_state_ledgers: ["projected_error_records", "retry_records", "timeout_records", "resume_state_records"],
    retry_rule: "Retry rows are classification records only; no auto retry is scheduled without a later explicit gate/approval artifact.",
    resume_rule: "Blocking errors remain blocked until a human approval or operator resolution artifact is recorded.",
    timeout_rule: "Timeout state is classified independently from failure and retry state so timeout handling can evolve without rewriting ErrorRecord v2.",
  };
}

function buildSourceContracts(sources, inputs) {
  return {
    error_cost_observability_contract_freeze: sourceContract(sources.errorCostObservabilityContractFreeze, inputs.error_cost_observability_contract_freeze_path, {
      freeze_status: sources.errorCostObservabilityContractFreeze.value?.summary?.freeze_status ?? null,
      error_record_count: sources.errorCostObservabilityContractFreeze.value?.summary?.error_record_count ?? 0,
    }),
    observability_trace_projection: sourceContract(sources.observabilityTraceProjection, inputs.observability_trace_projection_path, {
      observability_trace_projection_status: sources.observabilityTraceProjection.value?.summary?.observability_trace_projection_status ?? null,
      observability_trace_record_count: sources.observabilityTraceProjection.value?.summary?.observability_trace_record_count ?? 0,
    }),
    workflow_run_ledger: sourceContract(sources.workflowRunLedger, inputs.workflow_run_ledger_path, {
      workflow_run_ledger_status: sources.workflowRunLedger.value?.summary?.workflow_run_ledger_status ?? null,
      workflow_run_record_count: sources.workflowRunLedger.value?.summary?.workflow_run_record_count ?? 0,
    }),
    tool_invocation_ledger: sourceContract(sources.toolInvocationLedger, inputs.tool_invocation_ledger_path, {
      tool_invocation_ledger_status: sources.toolInvocationLedger.value?.summary?.tool_invocation_ledger_status ?? null,
      blocked_tool_invocation_count: sources.toolInvocationLedger.value?.summary?.blocked_tool_invocation_count ?? 0,
    }),
  };
}

function sourceContract(source, sourcePath, extra = {}) {
  return {
    source_path: sourcePath,
    available: source.ok,
    schema_version: source.value?.schema_version ?? null,
    generated_at: source.value?.generated_at ?? null,
    error: source.ok ? null : source.error,
    ...extra,
  };
}

function serializableLedger(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    error_retry_ledger_id: result.error_retry_ledger_id,
    output_dir: result.output_dir,
    inputs: result.inputs,
    source_contracts: result.source_contracts,
    error_retry_ledger_contract: result.error_retry_ledger_contract,
    error_retry_ledger_catalog: result.error_retry_ledger_catalog,
    validation_items: result.validation_items,
    validation: result.validation,
    summary: result.summary,
  };
}

function renderErrorRetryLedgerMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Error/Retry Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.error_retry_ledger_status}`);
  lines.push("");
  lines.push(`- Projected error records: ${summary.projected_error_record_count}`);
  lines.push(`- Retry records: ${summary.retry_record_count}`);
  lines.push(`- Timeout records: ${summary.timeout_record_count}`);
  lines.push(`- Resume state records: ${summary.resume_state_record_count}`);
  lines.push(`- Retryable/non-retryable errors: ${summary.retryable_error_count}/${summary.non_retryable_error_count}`);
  lines.push(`- Timeout observed/non-timeout: ${summary.timeout_observed_count}/${summary.non_timeout_record_count}`);
  lines.push(`- Resume blocked/ready/not required: ${summary.resume_blocked_count}/${summary.resume_ready_count}/${summary.resume_not_required_count}`);
  lines.push(`- Trace-bound/missing errors: ${summary.trace_bound_error_count}/${summary.missing_trace_binding_count}`);
  lines.push(`- Auto retries scheduled: ${summary.auto_retry_scheduled_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Projected Errors");
  lines.push("");
  for (const record of result.error_retry_ledger_catalog.projected_error_records) {
    lines.push(`- ${record.source_error_record_id}: ${record.error_kind}/${record.failure_state}, retry=${record.retry_state}, timeout=${record.timeout_state}, resume=${record.resume_state}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    error_cost_observability_contract_freeze_path: path.resolve(options.errorCostObservabilityContractFreezePath ?? DEFAULT_ERROR_RETRY_LEDGER_INPUTS.errorCostObservabilityContractFreezePath),
    observability_trace_projection_path: path.resolve(options.observabilityTraceProjectionPath ?? DEFAULT_ERROR_RETRY_LEDGER_INPUTS.observabilityTraceProjectionPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_ERROR_RETRY_LEDGER_INPUTS.workflowRunLedgerPath),
    tool_invocation_ledger_path: path.resolve(options.toolInvocationLedgerPath ?? DEFAULT_ERROR_RETRY_LEDGER_INPUTS.toolInvocationLedgerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_ERROR_RETRY_LEDGER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_ERROR_RETRY_LEDGER_INPUTS.roadmapPath),
  };
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      ok: true,
      value: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function validationItem(pathValue, checkId, passed, message) {
  return {
    path: pathValue,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function groupBy(items, keyOrFn) {
  const grouped = new Map();
  const getter = typeof keyOrFn === "function" ? keyOrFn : (item) => item?.[keyOrFn];
  for (const item of items) {
    const key = getter(item) ?? "unknown";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(item);
  }
  return grouped;
}

function countBy(items, key) {
  return Object.fromEntries([...groupBy(items, key).entries()].map(([groupKey, values]) => [groupKey, values.length]).sort(([a], [b]) => String(a).localeCompare(String(b))));
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") parsed.check = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--error-cost-observability-contract-freeze") parsed.errorCostObservabilityContractFreezePath = argv[++index];
    else if (arg === "--observability-trace-projection") parsed.observabilityTraceProjectionPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--tool-invocation-ledger") parsed.toolInvocationLedgerPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/error-retry-ledger.mjs [options]

Options:
  --check                                        Fail when validation does not pass.
  --out-dir <path>                              Output directory.
  --error-cost-observability-contract-freeze <path>
                                                 error-cost-observability-contract-freeze.json path.
  --observability-trace-projection <path>       observability-trace-projection.json path.
  --workflow-run-ledger <path>                  workflow-run-ledger.json path.
  --tool-invocation-ledger <path>               tool-invocation-ledger.json path.
  --package <path>                              package.json path.
  --roadmap <path>                              implementation-roadmap.md path.
`);
}
