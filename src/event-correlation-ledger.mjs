import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVENT_CORRELATION_LEDGER_OUT_DIR = "artifacts/event-correlation/latest";
export const DEFAULT_EVENT_CORRELATION_LEDGER_INPUTS = {
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  eventAuditRunContractFreezePath: "artifacts/event-audit-run-contract-freeze/latest/event-audit-run-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVENT_CORRELATION_LEDGER_SCHEMA_VERSION = "event-correlation-ledger.v1";
const EVENT_CORRELATION_CONTRACT_SCHEMA_VERSION = "event-correlation-contract.v1";
const CORRELATION_TRACE_SCHEMA_VERSION = "correlation-trace.v1";
const CAUSATION_EDGE_SCHEMA_VERSION = "causation-edge.v1";
const TRACE_RUN_BINDING_SCHEMA_VERSION = "trace-run-binding.v1";
const EVENT_CORRELATION_CONTRACT_ID = "event-correlation.v1";

export async function runEventCorrelationLedger(options = {}) {
  const result = await buildEventCorrelationLedger(options);
  if (options.write !== false) await writeEventCorrelationLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Event correlation ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEventCorrelationLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVENT_CORRELATION_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const appendOnlyEventStore = await readJson(inputs.append_only_event_store_path);
  const eventAuditRunContractFreeze = await readJson(inputs.event_audit_run_contract_freeze_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const projection = buildCorrelationProjection({ appendOnlyEventStore, eventAuditRunContractFreeze, generatedAt });
  const validationItems = validateEventCorrelationLedger({
    appendOnlyEventStore,
    eventAuditRunContractFreeze,
    packageJson,
    roadmapText,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: EVENT_CORRELATION_LEDGER_SCHEMA_VERSION,
    generated_at: generatedAt,
    event_correlation_ledger_id: `event-correlation-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      append_only_event_store: {
        schema_version: appendOnlyEventStore.schema_version ?? null,
        append_only_event_store_id: appendOnlyEventStore.append_only_event_store_id ?? null,
        event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
        stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
        validation_error_count: appendOnlyEventStore.summary?.validation_error_count ?? appendOnlyEventStore.validation?.errors?.length ?? 0,
      },
      event_audit_run_contract_freeze: {
        schema_version: eventAuditRunContractFreeze.schema_version ?? null,
        freeze_id: eventAuditRunContractFreeze.freeze_id ?? null,
        freeze_status: eventAuditRunContractFreeze.summary?.freeze_status ?? "unknown",
        run_ledger_count: eventAuditRunContractFreeze.summary?.run_ledger_count ?? 0,
        event_run_binding_count: eventAuditRunContractFreeze.summary?.event_run_binding_count ?? 0,
        validation_error_count: eventAuditRunContractFreeze.summary?.validation_error_count ?? eventAuditRunContractFreeze.validation?.errors?.length ?? 0,
      },
    },
    event_correlation_contract: buildEventCorrelationContract(generatedAt),
    event_correlation_catalog: {
      schema_version: "event-correlation-catalog.v1",
      generated_at: generatedAt,
      correlation_traces: projection.correlationTraces,
      causation_edges: projection.causationEdges,
      trace_run_bindings: projection.traceRunBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeEventCorrelationLedger({
      appendOnlyEventStore,
      eventAuditRunContractFreeze,
      correlationTraces: projection.correlationTraces,
      causationEdges: projection.causationEdges,
      traceRunBindings: projection.traceRunBindings,
      validationItems,
      validation,
    }),
  };
  return {
    ...result,
    markdown: renderEventCorrelationLedgerMarkdown(result),
  };
}

export async function writeEventCorrelationLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "event-correlation-ledger.json"), serializableEventCorrelationLedger(result));
  await writeJson(path.join(outDir, "correlation-traces.json"), {
    schema_version: "correlation-traces.v1",
    generated_at: result.generated_at,
    correlation_trace_count: result.event_correlation_catalog.correlation_traces.length,
    correlation_traces: result.event_correlation_catalog.correlation_traces,
  });
  await writeJson(path.join(outDir, "causation-edges.json"), {
    schema_version: "causation-edges.v1",
    generated_at: result.generated_at,
    causation_edge_count: result.event_correlation_catalog.causation_edges.length,
    causation_edges: result.event_correlation_catalog.causation_edges,
  });
  await writeJson(path.join(outDir, "trace-run-bindings.json"), {
    schema_version: "trace-run-bindings.v1",
    generated_at: result.generated_at,
    trace_run_binding_count: result.event_correlation_catalog.trace_run_bindings.length,
    trace_run_bindings: result.event_correlation_catalog.trace_run_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "event-correlation-validation-report.v1",
    generated_at: result.generated_at,
    event_correlation_ledger_id: result.event_correlation_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEventCorrelationLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEventCorrelationLedger(args);
    console.log(`Event correlation ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.event_correlation_status}`);
    console.log(`Traces: ${result.summary.correlation_trace_count}`);
    console.log(`Causation edges: ${result.summary.linked_causation_edge_count}/${result.summary.causation_edge_count}`);
    console.log(`Run bindings: ${result.summary.known_trace_run_binding_count}/${result.summary.trace_run_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildEventCorrelationContract(generatedAt) {
  return {
    schema_version: EVENT_CORRELATION_CONTRACT_SCHEMA_VERSION,
    generated_at: generatedAt,
    event_correlation_contract_id: EVENT_CORRELATION_CONTRACT_ID,
    correlation_scope: "tenant_matter_workflow_run_event",
    external_control_event_policy: "explicit_external_control_trace",
    required_trace_fields: [
      "correlation_id",
      "tenant_id",
      "matter_id",
      "workflow_run_id",
      "run_ledger_id",
      "event_envelope_id",
    ],
    required_edge_fields: [
      "correlation_id",
      "causation_id",
      "cause_event_envelope_id",
      "effect_event_envelope_id",
    ],
    required_binding_fields: [
      "correlation_id",
      "correlation_trace_id",
      "workflow_run_id",
      "run_ledger_id",
    ],
    notes: [
      "Run-bound events must be linked by correlation_id to matter, workflow, run ledger, and event envelope ids.",
      "External control events without a run ledger are kept in explicit external_control traces instead of being silently coerced.",
      "Causation edges always point from a cause event envelope to an effect event envelope inside the append-only event store.",
    ],
  };
}

function buildCorrelationProjection({ appendOnlyEventStore, eventAuditRunContractFreeze, generatedAt }) {
  const storedEvents = appendOnlyEventStore.event_store_catalog?.stored_events ?? [];
  const runLedgers = eventAuditRunContractFreeze.event_audit_run_contract?.run_ledgers ?? [];
  const runLedgerIds = new Set(runLedgers.map((run) => run.run_ledger_id));
  const eventByEnvelopeId = new Map(storedEvents.map((event) => [event.event_envelope_id, event]));
  const eventsByCorrelation = groupBy(storedEvents, (event) => event.correlation_id ?? `correlation.missing.${event.event_envelope_id}`);
  const correlationTraces = [...eventsByCorrelation.entries()]
    .map(([correlationId, events]) => buildCorrelationTrace({ correlationId, events, eventByEnvelopeId, runLedgerIds, generatedAt }))
    .sort((left, right) => left.correlation_id.localeCompare(right.correlation_id));
  const traceByCorrelationId = new Map(correlationTraces.map((trace) => [trace.correlation_id, trace]));
  const causationEdges = storedEvents
    .filter((event) => Boolean(event.causation_id))
    .map((event) => buildCausationEdge({ event, causeEvent: eventByEnvelopeId.get(event.causation_id), trace: traceByCorrelationId.get(event.correlation_id), generatedAt }))
    .sort((left, right) => left.effect_event_envelope_id.localeCompare(right.effect_event_envelope_id));
  const traceRunBindings = correlationTraces
    .flatMap((trace) => trace.run_ledger_ids.map((runLedgerId) => buildTraceRunBinding({ trace, runLedgerId, runLedgerIds, generatedAt })))
    .sort((left, right) => left.trace_run_binding_id.localeCompare(right.trace_run_binding_id));
  return { correlationTraces, causationEdges, traceRunBindings };
}

function buildCorrelationTrace({ correlationId, events, eventByEnvelopeId, runLedgerIds, generatedAt }) {
  const sortedEvents = [...events].sort((left, right) => {
    const timeCompare = String(left.event_time ?? "").localeCompare(String(right.event_time ?? ""));
    if (timeCompare !== 0) return timeCompare;
    return (left.global_sequence ?? 0) - (right.global_sequence ?? 0);
  });
  const tenantIds = sortedUnique(sortedEvents.map((event) => event.tenant_id));
  const matterIds = sortedUnique(sortedEvents.map((event) => event.matter_id));
  const workflowRunIds = sortedUnique(sortedEvents.map((event) => event.workflow_run_id));
  const runLedgerIdValues = sortedUnique(sortedEvents.map((event) => event.run_ledger_id));
  const storedEventIds = sortedEvents.map((event) => event.stored_event_id);
  const eventEnvelopeIds = sortedEvents.map((event) => event.event_envelope_id);
  const sourceKinds = sortedUnique(sortedEvents.map((event) => event.source_kind));
  const externalControlTrace = runLedgerIdValues.length === 0 && sourceKinds.every((sourceKind) => sourceKind === "audit_event");
  const matterWorkflowRunLinked = matterIds.length > 0 && workflowRunIds.length > 0 && runLedgerIdValues.length > 0;
  const traceStatus = matterWorkflowRunLinked ? "linked" : externalControlTrace ? "external_control" : "incomplete";
  const missingCauseCount = sortedEvents.filter((event) => event.causation_id && !eventByEnvelopeId.has(event.causation_id)).length;
  const causationStatus = missingCauseCount === 0 ? "linked" : "missing_cause";
  const unknownRunCount = runLedgerIdValues.filter((runLedgerId) => !runLedgerIds.has(runLedgerId)).length;
  const runBindingStatus = runLedgerIdValues.length === 0
    ? (externalControlTrace ? "external_control" : "unknown_run")
    : unknownRunCount === 0 ? "known" : "unknown_run";
  return {
    schema_version: CORRELATION_TRACE_SCHEMA_VERSION,
    correlation_trace_id: `correlation-trace.${slugify(correlationId)}`,
    correlation_id: correlationId,
    tenant_id: tenantIds[0] ?? null,
    tenant_ids: tenantIds,
    matter_id: matterIds[0] ?? null,
    matter_ids: matterIds,
    workflow_run_id: workflowRunIds[0] ?? null,
    workflow_run_ids: workflowRunIds,
    run_ledger_id: runLedgerIdValues[0] ?? null,
    run_ledger_ids: runLedgerIdValues,
    stored_event_ids: storedEventIds,
    event_envelope_ids: eventEnvelopeIds,
    event_types: sortedUnique(sortedEvents.map((event) => event.event_type)),
    event_families: sortedUnique(sortedEvents.map((event) => event.event_family)),
    source_kinds: sourceKinds,
    event_count: sortedEvents.length,
    root_event_count: sortedEvents.filter((event) => !event.causation_id).length,
    caused_event_count: sortedEvents.filter((event) => Boolean(event.causation_id)).length,
    missing_cause_count: missingCauseCount,
    first_event_time: sortedEvents.reduce((earliest, event) => minIso(earliest, event.event_time), null),
    last_event_time: sortedEvents.reduce((latest, event) => maxIso(latest, event.event_time), null),
    trace_status: traceStatus,
    causation_status: causationStatus,
    run_binding_status: runBindingStatus,
    external_control_trace: externalControlTrace,
    recorded_at: generatedAt,
  };
}

function buildCausationEdge({ event, causeEvent, trace, generatedAt }) {
  const linked = Boolean(causeEvent);
  return {
    schema_version: CAUSATION_EDGE_SCHEMA_VERSION,
    causation_edge_id: `causation-edge.${slugify(event.causation_id)}.${slugify(event.event_envelope_id)}`,
    correlation_id: event.correlation_id ?? null,
    correlation_trace_id: trace?.correlation_trace_id ?? null,
    causation_id: event.causation_id,
    cause_event_envelope_id: event.causation_id,
    effect_event_envelope_id: event.event_envelope_id,
    cause_stored_event_id: causeEvent?.stored_event_id ?? null,
    effect_stored_event_id: event.stored_event_id,
    event_type: event.event_type,
    event_family: event.event_family,
    event_time: event.event_time,
    causation_status: linked ? "linked" : "missing_cause",
    recorded_at: generatedAt,
  };
}

function buildTraceRunBinding({ trace, runLedgerId, runLedgerIds, generatedAt }) {
  const known = runLedgerIds.has(runLedgerId);
  return {
    schema_version: TRACE_RUN_BINDING_SCHEMA_VERSION,
    trace_run_binding_id: `trace-run-binding.${slugify(trace.correlation_id)}.${slugify(runLedgerId)}`,
    correlation_id: trace.correlation_id,
    correlation_trace_id: trace.correlation_trace_id,
    tenant_id: trace.tenant_id,
    matter_id: trace.matter_id,
    workflow_run_id: trace.workflow_run_id,
    run_ledger_id: runLedgerId,
    stored_event_count: trace.event_count,
    event_envelope_ids: trace.event_envelope_ids,
    run_binding_status: known ? "known" : "unknown_run",
    recorded_at: generatedAt,
  };
}

function validateEventCorrelationLedger({
  appendOnlyEventStore,
  eventAuditRunContractFreeze,
  packageJson,
  roadmapText,
  correlationTraces,
  causationEdges,
  traceRunBindings,
}) {
  const items = [];
  const storedEvents = appendOnlyEventStore.event_store_catalog?.stored_events ?? [];
  const traceEventCount = correlationTraces.reduce((count, trace) => count + trace.event_envelope_ids.length, 0);
  const externalControlTraceCount = correlationTraces.filter((trace) => trace.trace_status === "external_control").length;
  addValidation(items, {
    path: "source.append_only_event_store",
    check_id: "source_append_only_event_store_complete",
    passed: appendOnlyEventStore.summary?.event_store_status === "complete" && appendOnlyEventStore.validation?.valid !== false,
    message: appendOnlyEventStore.summary?.event_store_status === "complete"
      ? "Append-only event store is complete."
      : "Append-only event store must be complete before event correlation projection.",
  });
  addValidation(items, {
    path: "source.event_audit_run_contract_freeze",
    check_id: "source_event_audit_run_freeze_complete",
    passed: eventAuditRunContractFreeze.summary?.freeze_status === "complete" && eventAuditRunContractFreeze.validation?.valid !== false,
    message: eventAuditRunContractFreeze.summary?.freeze_status === "complete"
      ? "Event/Audit/Run Ledger contract freeze is complete."
      : "Event/Audit/Run Ledger contract freeze must be complete before event correlation projection.",
  });
  addValidation(items, {
    path: "event_correlation_catalog.correlation_traces",
    check_id: "stored_events_projected_once",
    passed: storedEvents.length === traceEventCount && new Set(correlationTraces.flatMap((trace) => trace.event_envelope_ids)).size === storedEvents.length,
    message: `${traceEventCount}/${storedEvents.length} stored event envelope id(s) are present in exactly one correlation trace.`,
  });
  addValidation(items, {
    path: "event_correlation_catalog.correlation_traces.correlation_id",
    check_id: "correlation_ids_present",
    passed: storedEvents.every((event) => Boolean(event.correlation_id)),
    message: `${storedEvents.filter((event) => Boolean(event.correlation_id)).length}/${storedEvents.length} stored event(s) declare correlation_id.`,
  });
  addValidation(items, {
    path: "event_correlation_catalog.correlation_traces.trace_status",
    check_id: "run_bound_or_external_control_traces_classified",
    passed: correlationTraces.every((trace) => trace.trace_status === "linked" || trace.trace_status === "external_control"),
    message: `${correlationTraces.filter((trace) => trace.trace_status === "linked").length} run-bound trace(s) and ${externalControlTraceCount} external control trace(s) are classified.`,
  });
  addValidation(items, {
    path: "event_correlation_catalog.causation_edges",
    check_id: "causation_edges_linked",
    passed: causationEdges.every((edge) => edge.causation_status === "linked"),
    message: `${causationEdges.filter((edge) => edge.causation_status === "linked").length}/${causationEdges.length} causation edge(s) link to stored cause events.`,
  });
  addValidation(items, {
    path: "event_correlation_catalog.trace_run_bindings",
    check_id: "trace_run_bindings_known",
    passed: traceRunBindings.length > 0 && traceRunBindings.every((binding) => binding.run_binding_status === "known"),
    message: `${traceRunBindings.filter((binding) => binding.run_binding_status === "known").length}/${traceRunBindings.length} trace/run binding(s) resolve to known RunLedger v2 records.`,
  });
  addValidation(items, {
    path: "event_correlation_contract.external_control_event_policy",
    check_id: "external_control_events_explicit",
    passed: correlationTraces.filter((trace) => trace.run_ledger_ids.length === 0).every((trace) => trace.trace_status === "external_control"),
    message: `${externalControlTraceCount} trace(s) without run ledger are explicit external control traces.`,
  });
  addValidation(items, {
    path: "package.scripts.events:correlation",
    check_id: "package_script_registered",
    passed: Boolean(packageJson.scripts?.["events:correlation"]),
    message: packageJson.scripts?.["events:correlation"]
      ? "package.json registers events:correlation."
      : "package.json must register events:correlation.",
  });
  addValidation(items, {
    path: "docs.implementation_roadmap.phase_162",
    check_id: "roadmap_phase_162_recorded",
    passed: String(roadmapText).includes("## Phase 162: Event Correlation Ledger") || String(roadmapText).includes("| P162 | correlation/causation id 구현 |"),
    message: "Roadmap must record Phase 162 completion or planned slot.",
  });
  return items;
}

function summarizeEventCorrelationLedger({
  appendOnlyEventStore,
  eventAuditRunContractFreeze,
  correlationTraces,
  causationEdges,
  traceRunBindings,
  validationItems,
  validation,
}) {
  const storedEvents = appendOnlyEventStore.event_store_catalog?.stored_events ?? [];
  const missingCorrelationIdCount = storedEvents.filter((event) => !event.correlation_id).length;
  const missingMatterIdCount = storedEvents.filter((event) => !event.matter_id).length;
  const missingWorkflowRunIdCount = storedEvents.filter((event) => !event.workflow_run_id).length;
  const missingRunLedgerIdCount = storedEvents.filter((event) => !event.run_ledger_id).length;
  return {
    event_correlation_status: validation.valid ? "complete" : "blocked",
    event_correlation_contract_id: EVENT_CORRELATION_CONTRACT_ID,
    source_event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
    source_stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? storedEvents.length,
    source_event_audit_run_freeze_status: eventAuditRunContractFreeze.summary?.freeze_status ?? "unknown",
    source_run_ledger_count: eventAuditRunContractFreeze.summary?.run_ledger_count ?? 0,
    correlation_trace_count: correlationTraces.length,
    linked_trace_count: correlationTraces.filter((trace) => trace.trace_status === "linked").length,
    external_control_trace_count: correlationTraces.filter((trace) => trace.trace_status === "external_control").length,
    incomplete_trace_count: correlationTraces.filter((trace) => trace.trace_status === "incomplete").length,
    causation_edge_count: causationEdges.length,
    linked_causation_edge_count: causationEdges.filter((edge) => edge.causation_status === "linked").length,
    missing_causation_edge_count: causationEdges.filter((edge) => edge.causation_status !== "linked").length,
    trace_run_binding_count: traceRunBindings.length,
    known_trace_run_binding_count: traceRunBindings.filter((binding) => binding.run_binding_status === "known").length,
    unknown_trace_run_binding_count: traceRunBindings.filter((binding) => binding.run_binding_status !== "known").length,
    matter_bound_trace_count: correlationTraces.filter((trace) => Boolean(trace.matter_id)).length,
    workflow_bound_trace_count: correlationTraces.filter((trace) => Boolean(trace.workflow_run_id)).length,
    run_bound_trace_count: correlationTraces.filter((trace) => trace.run_ledger_ids.length > 0).length,
    event_bound_trace_count: correlationTraces.filter((trace) => trace.event_count > 0).length,
    missing_correlation_id_count: missingCorrelationIdCount,
    missing_matter_id_count: missingMatterIdCount,
    missing_workflow_run_id_count: missingWorkflowRunIdCount,
    missing_run_ledger_id_count: missingRunLedgerIdCount,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_trace_status: countBy(correlationTraces, "trace_status"),
    by_causation_status: countBy(correlationTraces, "causation_status"),
    by_run_binding_status: countBy(correlationTraces, "run_binding_status"),
    by_matter_id: countBy(correlationTraces, "matter_id"),
  };
}

function renderEventCorrelationLedgerMarkdown(result) {
  const lines = [];
  lines.push("# Event Correlation Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Ledger ID: ${result.event_correlation_ledger_id}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Status: ${result.summary.event_correlation_status}`);
  lines.push(`- Contract: ${result.summary.event_correlation_contract_id}`);
  lines.push(`- Source stored events: ${result.summary.source_stored_event_count}`);
  lines.push(`- Correlation traces: ${result.summary.correlation_trace_count}`);
  lines.push(`- Linked run traces: ${result.summary.linked_trace_count}`);
  lines.push(`- External control traces: ${result.summary.external_control_trace_count}`);
  lines.push(`- Causation edges: ${result.summary.linked_causation_edge_count}/${result.summary.causation_edge_count}`);
  lines.push(`- Trace/run bindings: ${result.summary.known_trace_run_binding_count}/${result.summary.trace_run_binding_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Contract Notes");
  lines.push("");
  lines.push("- Run-bound events are grouped by correlation_id and must carry matter, workflow, run ledger, and event envelope ids.");
  lines.push("- Audit-only control events without a run ledger remain visible as external_control traces.");
  lines.push("- Causation edges reference append-only stored event envelopes and never rewrite source events.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_EVENT_CORRELATION_LEDGER_INPUTS;
  return {
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? defaults.appendOnlyEventStorePath),
    event_audit_run_contract_freeze_path: path.resolve(options.eventAuditRunContractFreezePath ?? defaults.eventAuditRunContractFreezePath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function serializableEventCorrelationLedger(result) {
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

function groupBy(items, getKey) {
  const grouped = new Map();
  for (const item of items) {
    const key = getKey(item);
    grouped.set(key, [...(grouped.get(key) ?? []), item]);
  }
  return grouped;
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right)));
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

function minIso(left, right) {
  if (!left) return right;
  if (!right) return left;
  return String(left) <= String(right) ? left : right;
}

function maxIso(left, right) {
  if (!left) return right;
  if (!right) return left;
  return String(left) >= String(right) ? left : right;
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
    outDir: DEFAULT_EVENT_CORRELATION_LEDGER_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--append-only-event-store") parsed.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--event-audit-run-contract-freeze") parsed.eventAuditRunContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/event-correlation-ledger.mjs [options]

Project append-only stored events into correlation traces, causation edges, and trace/run bindings.

Options:
  --check                                      Exit non-zero when validation fails.
  --out-dir, --out <path>                     Output directory.
  --run-at <iso>                              Override generated_at timestamp.
  --append-only-event-store <path>            append-only-event-store.json path.
  --event-audit-run-contract-freeze <path>    event-audit-run-contract-freeze.json path.
  --package <path>                            package.json path.
  --roadmap <path>                            implementation roadmap path.
`);
}
