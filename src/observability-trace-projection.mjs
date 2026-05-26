import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OBSERVABILITY_TRACE_PROJECTION_OUT_DIR = "artifacts/observability-trace-projection/latest";
export const DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS = {
  eventCorrelationLedgerPath: "artifacts/event-correlation/latest/event-correlation-ledger.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "observability-trace-projection.v1";
const TRACE_SCHEMA_VERSION = "observability-trace-record.v1";
const BINDING_SCHEMA_VERSION = "observability-trace-binding.v1";

export async function runObservabilityTraceProjection(options = {}) {
  const result = await buildObservabilityTraceProjection(options);
  if (options.write !== false) await writeObservabilityTraceProjection(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Observability trace projection validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildObservabilityTraceProjection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    eventCorrelationLedger: await readJsonOrError(inputs.event_correlation_ledger_path),
    workflowRunLedger: await readJsonOrError(inputs.workflow_run_ledger_path),
    agentRunLedger: await readJsonOrError(inputs.agent_run_ledger_path),
    gateApprovalContractFreeze: await readJsonOrError(inputs.gate_approval_contract_freeze_path),
    outputArtifactCatalog: await readJsonOrError(inputs.output_artifact_catalog_path),
    packageJson: await readJsonOrError(inputs.package_path),
    roadmap: await readTextOrError(inputs.roadmap_path),
  };
  const projection = buildProjection(sources, generatedAt);
  const validationItems = validateObservabilityTraceProjection({ sources, projection });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    observability_trace_projection_id: `observability-trace-projection.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts(sources, inputs),
    observability_trace_projection_contract: buildContract(generatedAt),
    observability_trace_projection_catalog: {
      schema_version: "observability-trace-projection-catalog.v1",
      generated_at: generatedAt,
      observability_trace_records: projection.observabilityTraceRecords,
      workflow_trace_bindings: projection.workflowTraceBindings,
      agent_trace_bindings: projection.agentTraceBindings,
      gate_trace_bindings: projection.gateTraceBindings,
      output_trace_bindings: projection.outputTraceBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeProjection(projection, validation),
  };
  return {
    ...result,
    markdown: renderObservabilityTraceProjectionMarkdown(result),
  };
}

export async function writeObservabilityTraceProjection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "observability-trace-projection.json"), serializableProjection(result));
  await writeJson(path.join(outDir, "observability-trace-records.json"), {
    schema_version: "observability-trace-records.v1",
    generated_at: result.generated_at,
    observability_trace_record_count: result.observability_trace_projection_catalog.observability_trace_records.length,
    observability_trace_records: result.observability_trace_projection_catalog.observability_trace_records,
  });
  await writeJson(path.join(outDir, "workflow-trace-bindings.json"), {
    schema_version: "workflow-trace-bindings.v1",
    generated_at: result.generated_at,
    workflow_trace_binding_count: result.observability_trace_projection_catalog.workflow_trace_bindings.length,
    workflow_trace_bindings: result.observability_trace_projection_catalog.workflow_trace_bindings,
  });
  await writeJson(path.join(outDir, "agent-trace-bindings.json"), {
    schema_version: "agent-trace-bindings.v1",
    generated_at: result.generated_at,
    agent_trace_binding_count: result.observability_trace_projection_catalog.agent_trace_bindings.length,
    agent_trace_bindings: result.observability_trace_projection_catalog.agent_trace_bindings,
  });
  await writeJson(path.join(outDir, "gate-trace-bindings.json"), {
    schema_version: "gate-trace-bindings.v1",
    generated_at: result.generated_at,
    gate_trace_binding_count: result.observability_trace_projection_catalog.gate_trace_bindings.length,
    gate_trace_bindings: result.observability_trace_projection_catalog.gate_trace_bindings,
  });
  await writeJson(path.join(outDir, "output-trace-bindings.json"), {
    schema_version: "output-trace-bindings.v1",
    generated_at: result.generated_at,
    output_trace_binding_count: result.observability_trace_projection_catalog.output_trace_bindings.length,
    output_trace_bindings: result.observability_trace_projection_catalog.output_trace_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "observability-trace-projection-validation-report.v1",
    generated_at: result.generated_at,
    observability_trace_projection_id: result.observability_trace_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runObservabilityTraceProjectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runObservabilityTraceProjection(args);
    console.log(`Observability trace projection written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.observability_trace_projection_status}`);
    console.log(`Trace records: ${result.summary.observability_trace_record_count}`);
    console.log(`Workflow/agent/gate/output bindings: ${result.summary.workflow_trace_binding_count}/${result.summary.agent_trace_binding_count}/${result.summary.gate_trace_binding_count}/${result.summary.output_trace_binding_count}`);
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
  const eventCorrelationLedger = sources.eventCorrelationLedger.value ?? {};
  const workflowRunLedger = sources.workflowRunLedger.value ?? {};
  const agentRunLedger = sources.agentRunLedger.value ?? {};
  const gateApprovalContractFreeze = sources.gateApprovalContractFreeze.value ?? {};
  const outputArtifactCatalog = sources.outputArtifactCatalog.value ?? {};

  const correlationTraces = eventCorrelationLedger.event_correlation_catalog?.correlation_traces ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const gateResults = gateApprovalContractFreeze.gate_approval_contract?.gate_results ?? [];
  const outputArtifacts = outputArtifactCatalog.artifacts ?? [];

  const traceIndexes = indexCorrelationTraces(correlationTraces);
  const workflowTraceBindings = workflowRunRecords
    .map((record) => buildTraceBinding({
      sourceType: "workflow",
      sourceId: record.workflow_run_id,
      workflowRunId: record.workflow_run_id,
      agentRunId: null,
      gateResultId: null,
      outputArtifactId: null,
      eventEnvelopeId: first(record.event_envelope_ids),
      correlationTraceId: record.correlation_trace_id,
      correlationId: record.correlation_id,
      runLedgerId: record.run_ledger_id,
      tenantId: record.tenant_id,
      matterId: record.matter_id,
      domainPack: record.domain_pack,
      sourceStatus: record.workflow_run_record_status,
      trace: resolveTrace(record, traceIndexes),
      generatedAt,
    }))
    .sort(by("trace_binding_id"));

  const agentTraceBindings = agentRunRecords
    .map((record) => buildTraceBinding({
      sourceType: "agent",
      sourceId: record.agent_run_id,
      workflowRunId: record.workflow_run_id,
      agentRunId: record.agent_run_id,
      gateResultId: null,
      outputArtifactId: null,
      eventEnvelopeId: first(record.event_envelope_ids),
      correlationTraceId: record.correlation_trace_id,
      correlationId: record.correlation_id,
      runLedgerId: record.run_ledger_id,
      tenantId: record.tenant_id,
      matterId: record.matter_id,
      domainPack: record.domain_pack,
      sourceStatus: record.status,
      trace: resolveTrace(record, traceIndexes),
      generatedAt,
    }))
    .sort(by("trace_binding_id"));

  const gateTraceBindings = gateResults
    .map((record) => buildTraceBinding({
      sourceType: "gate",
      sourceId: record.gate_result_id,
      workflowRunId: record.workflow_run_id,
      agentRunId: null,
      gateResultId: record.gate_result_id,
      outputArtifactId: null,
      eventEnvelopeId: record.event_id ?? null,
      correlationTraceId: null,
      correlationId: record.workflow_run_id ?? null,
      runLedgerId: null,
      tenantId: record.tenant_id,
      matterId: record.matter_id,
      domainPack: record.domain_pack,
      sourceStatus: record.gate_outcome,
      trace: resolveTrace(record, traceIndexes),
      generatedAt,
      eventBindingStatus: record.event_id ? "event_backed" : "workflow_inferred",
    }))
    .sort(by("trace_binding_id"));

  const outputTraceBindings = outputArtifacts
    .map((record) => buildTraceBinding({
      sourceType: "output",
      sourceId: record.artifact_id,
      workflowRunId: record.workflow_run_id,
      agentRunId: record.created_by_run_id ?? null,
      gateResultId: null,
      outputArtifactId: record.artifact_id,
      eventEnvelopeId: null,
      correlationTraceId: null,
      correlationId: record.workflow_run_id ?? null,
      runLedgerId: null,
      tenantId: record.tenant_id,
      matterId: record.matter_id,
      domainPack: record.domain_pack,
      sourceStatus: record.delivery_state ?? record.status,
      trace: resolveTrace(record, traceIndexes),
      generatedAt,
      eventBindingStatus: "workflow_inferred",
    }))
    .sort(by("trace_binding_id"));

  const allBindings = [
    ...workflowTraceBindings,
    ...agentTraceBindings,
    ...gateTraceBindings,
    ...outputTraceBindings,
  ];
  const bindingsByTraceId = groupBy(allBindings.filter((binding) => binding.correlation_trace_id), "correlation_trace_id");
  const observabilityTraceRecords = correlationTraces
    .map((trace) => buildObservabilityTraceRecord({ trace, bindings: bindingsByTraceId.get(trace.correlation_trace_id) ?? [], generatedAt }))
    .sort(by("observability_trace_id"));

  return {
    observabilityTraceRecords,
    workflowTraceBindings,
    agentTraceBindings,
    gateTraceBindings,
    outputTraceBindings,
    sourceCounts: {
      correlation_trace_count: eventCorrelationLedger.summary?.correlation_trace_count ?? correlationTraces.length,
      linked_trace_count: eventCorrelationLedger.summary?.linked_trace_count ?? correlationTraces.filter((trace) => trace.trace_status === "linked").length,
      external_control_trace_count: eventCorrelationLedger.summary?.external_control_trace_count ?? correlationTraces.filter((trace) => trace.external_control_trace).length,
      workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? agentRunRecords.length,
      gate_result_count: gateApprovalContractFreeze.summary?.gate_result_count ?? gateResults.length,
      output_artifact_count: outputArtifactCatalog.summary?.artifact_count ?? outputArtifacts.length,
    },
  };
}

function buildTraceBinding({
  sourceType,
  sourceId,
  workflowRunId,
  agentRunId,
  gateResultId,
  outputArtifactId,
  eventEnvelopeId,
  correlationTraceId,
  correlationId,
  runLedgerId,
  tenantId,
  matterId,
  domainPack,
  sourceStatus,
  trace,
  generatedAt,
  eventBindingStatus,
}) {
  const resolvedTraceId = trace?.correlation_trace_id ?? correlationTraceId ?? null;
  const binding = {
    schema_version: BINDING_SCHEMA_VERSION,
    trace_binding_id: `observability-trace-binding.${sourceType}.${slugify(sourceId)}`,
    binding_type: sourceType,
    source_id: sourceId,
    workflow_run_id: workflowRunId ?? trace?.workflow_run_id ?? null,
    agent_run_id: agentRunId,
    gate_result_id: gateResultId,
    output_artifact_id: outputArtifactId,
    event_envelope_id: eventEnvelopeId,
    correlation_trace_id: resolvedTraceId,
    observability_trace_id: resolvedTraceId ? `observability-trace.${slugify(resolvedTraceId)}` : null,
    correlation_id: trace?.correlation_id ?? correlationId ?? null,
    run_ledger_id: runLedgerId ?? trace?.run_ledger_id ?? null,
    tenant_id: tenantId ?? trace?.tenant_id ?? null,
    matter_id: matterId ?? trace?.matter_id ?? null,
    domain_pack: domainPack ?? null,
    source_status: sourceStatus ?? "unknown",
    binding_status: trace ? "known" : "missing_trace",
    event_binding_status: eventBindingStatus ?? (eventEnvelopeId ? "event_backed" : "not_applicable"),
    recorded_at: generatedAt,
  };
  return {
    ...binding,
    trace_binding_hash: hashValue(binding),
  };
}

function buildObservabilityTraceRecord({ trace, bindings, generatedAt }) {
  const byType = groupBy(bindings, "binding_type");
  const workflowBindings = byType.get("workflow") ?? [];
  const agentBindings = byType.get("agent") ?? [];
  const gateBindings = byType.get("gate") ?? [];
  const outputBindings = byType.get("output") ?? [];
  const externalControl = Boolean(trace.external_control_trace);
  const traceComponentStatus = externalControl
    ? "external_control"
    : workflowBindings.length > 0 && agentBindings.length > 0 && gateBindings.length > 0 && outputBindings.length > 0
      ? "complete"
      : "partial";
  const record = {
    schema_version: TRACE_SCHEMA_VERSION,
    observability_trace_id: `observability-trace.${slugify(trace.correlation_trace_id)}`,
    correlation_trace_id: trace.correlation_trace_id,
    correlation_id: trace.correlation_id,
    tenant_id: trace.tenant_id ?? null,
    matter_id: trace.matter_id ?? null,
    workflow_run_id: trace.workflow_run_id ?? null,
    run_ledger_id: trace.run_ledger_id ?? null,
    trace_status: trace.trace_status,
    trace_component_status: traceComponentStatus,
    external_control_trace: externalControl,
    event_count: trace.event_count ?? 0,
    root_event_count: trace.root_event_count ?? 0,
    caused_event_count: trace.caused_event_count ?? 0,
    workflow_trace_binding_ids: workflowBindings.map((binding) => binding.trace_binding_id).sort(),
    agent_trace_binding_ids: agentBindings.map((binding) => binding.trace_binding_id).sort(),
    gate_trace_binding_ids: gateBindings.map((binding) => binding.trace_binding_id).sort(),
    output_trace_binding_ids: outputBindings.map((binding) => binding.trace_binding_id).sort(),
    workflow_binding_count: workflowBindings.length,
    agent_binding_count: agentBindings.length,
    gate_binding_count: gateBindings.length,
    output_binding_count: outputBindings.length,
    known_binding_count: bindings.filter((binding) => binding.binding_status === "known").length,
    missing_binding_count: bindings.filter((binding) => binding.binding_status !== "known").length,
    event_envelope_ids: trace.event_envelope_ids ?? [],
    stored_event_ids: trace.stored_event_ids ?? [],
    recorded_at: generatedAt,
  };
  return {
    ...record,
    observability_trace_hash: hashValue(record),
  };
}

function indexCorrelationTraces(correlationTraces) {
  const byTraceId = new Map();
  const byCorrelationId = new Map();
  const byWorkflowRunId = new Map();
  for (const trace of correlationTraces) {
    if (trace.correlation_trace_id) byTraceId.set(trace.correlation_trace_id, trace);
    if (trace.correlation_id) byCorrelationId.set(trace.correlation_id, trace);
    for (const workflowRunId of trace.workflow_run_ids ?? []) {
      byWorkflowRunId.set(workflowRunId, trace);
    }
    if (trace.workflow_run_id) byWorkflowRunId.set(trace.workflow_run_id, trace);
  }
  return { byTraceId, byCorrelationId, byWorkflowRunId };
}

function resolveTrace(record, indexes) {
  return indexes.byTraceId.get(record.correlation_trace_id)
    ?? indexes.byWorkflowRunId.get(record.workflow_run_id)
    ?? indexes.byCorrelationId.get(record.correlation_id)
    ?? indexes.byCorrelationId.get(record.workflow_run_id)
    ?? null;
}

function validateObservabilityTraceProjection({ sources, projection }) {
  const items = [];
  for (const [sourceName, source] of Object.entries(sources)) {
    items.push(validationItem(`source.${sourceName}`, `source_${sourceName}_available`, source.ok, `${sourceName} is available.`));
  }
  const packageScripts = sources.packageJson.value?.scripts ?? {};
  const roadmapText = String(sources.roadmap.value ?? "");
  const summary = summarizeProjection(projection, { errors: [] });
  items.push(validationItem("package.scripts.observability:traces", "package_script_declared", Boolean(packageScripts["observability:traces"]), "`observability:traces` package script must be declared."));
  items.push(validationItem("roadmap.phase_170", "roadmap_phase_declared", roadmapText.includes("Phase 170: Observability Trace Projection"), "Phase 170 roadmap entry must be declared."));
  items.push(validationItem("observability_trace_records", "trace_records_present", summary.observability_trace_record_count > 0, "Observability trace records must be produced."));
  items.push(validationItem("observability_trace_records.count", "source_trace_count_matches", summary.observability_trace_record_count === projection.sourceCounts.correlation_trace_count, "Every source correlation trace must be projected."));
  items.push(validationItem("workflow_trace_bindings.count", "workflow_trace_binding_count_matches_source", summary.workflow_trace_binding_count === projection.sourceCounts.workflow_run_record_count, "Every workflow run record must have a trace binding row."));
  items.push(validationItem("workflow_trace_bindings.known", "workflow_trace_bindings_known", summary.unknown_workflow_trace_binding_count === 0, "Every workflow run trace binding must resolve to a known trace."));
  items.push(validationItem("agent_trace_bindings.count", "agent_trace_binding_count_matches_source", summary.agent_trace_binding_count === projection.sourceCounts.agent_run_record_count, "Every agent run record must have a trace binding row."));
  items.push(validationItem("agent_trace_bindings.known", "agent_trace_bindings_known", summary.unknown_agent_trace_binding_count === 0, "Every agent run trace binding must resolve to a known trace."));
  items.push(validationItem("gate_trace_bindings.count", "gate_trace_binding_count_matches_source", summary.gate_trace_binding_count === projection.sourceCounts.gate_result_count, "Every gate result must have a trace binding row."));
  items.push(validationItem("gate_trace_bindings.known", "gate_trace_bindings_known", summary.unknown_gate_trace_binding_count === 0, "Every gate trace binding must resolve to a known trace."));
  items.push(validationItem("output_trace_bindings.count", "output_trace_binding_count_matches_source", summary.output_trace_binding_count === projection.sourceCounts.output_artifact_count, "Every output artifact must have a trace binding row."));
  items.push(validationItem("output_trace_bindings.known", "output_trace_bindings_known", summary.unknown_output_trace_binding_count === 0, "Every output trace binding must resolve to a known trace."));
  items.push(validationItem("observability_trace_records.linked", "linked_traces_have_workflow_binding", summary.linked_trace_count === summary.trace_with_workflow_count, "Every linked run trace must carry a workflow binding."));
  items.push(validationItem("observability_trace_records.components", "complete_component_trace_present", summary.complete_component_trace_count > 0, "At least one trace must connect workflow, agent, gate, and output components."));
  items.push(validationItem("observability_trace_records.hash", "trace_hashes_present", projection.observabilityTraceRecords.every((record) => record.observability_trace_hash), "Every observability trace record must have a hash."));
  items.push(validationItem("trace_bindings.hash", "binding_hashes_present", allTraceBindings(projection).every((binding) => binding.trace_binding_hash), "Every trace binding row must have a hash."));
  return items;
}

function summarizeProjection(projection, validation) {
  const records = projection.observabilityTraceRecords;
  const workflowTraceBindings = projection.workflowTraceBindings;
  const agentTraceBindings = projection.agentTraceBindings;
  const gateTraceBindings = projection.gateTraceBindings;
  const outputTraceBindings = projection.outputTraceBindings;
  return {
    observability_trace_projection_status: validation.errors.length === 0 ? "complete" : "blocked",
    observability_trace_projection_contract_id: CONTRACT_ID,
    observability_trace_record_count: records.length,
    source_correlation_trace_count: projection.sourceCounts.correlation_trace_count,
    linked_trace_count: records.filter((record) => record.trace_status === "linked").length,
    external_control_trace_count: records.filter((record) => record.external_control_trace).length,
    complete_component_trace_count: records.filter((record) => record.trace_component_status === "complete").length,
    partial_component_trace_count: records.filter((record) => record.trace_component_status === "partial").length,
    trace_with_workflow_count: records.filter((record) => record.workflow_binding_count > 0).length,
    trace_with_agent_count: records.filter((record) => record.agent_binding_count > 0).length,
    trace_with_gate_count: records.filter((record) => record.gate_binding_count > 0).length,
    trace_with_output_count: records.filter((record) => record.output_binding_count > 0).length,
    workflow_trace_binding_count: workflowTraceBindings.length,
    known_workflow_trace_binding_count: workflowTraceBindings.filter((binding) => binding.binding_status === "known").length,
    unknown_workflow_trace_binding_count: workflowTraceBindings.filter((binding) => binding.binding_status !== "known").length,
    agent_trace_binding_count: agentTraceBindings.length,
    known_agent_trace_binding_count: agentTraceBindings.filter((binding) => binding.binding_status === "known").length,
    unknown_agent_trace_binding_count: agentTraceBindings.filter((binding) => binding.binding_status !== "known").length,
    gate_trace_binding_count: gateTraceBindings.length,
    known_gate_trace_binding_count: gateTraceBindings.filter((binding) => binding.binding_status === "known").length,
    unknown_gate_trace_binding_count: gateTraceBindings.filter((binding) => binding.binding_status !== "known").length,
    output_trace_binding_count: outputTraceBindings.length,
    known_output_trace_binding_count: outputTraceBindings.filter((binding) => binding.binding_status === "known").length,
    unknown_output_trace_binding_count: outputTraceBindings.filter((binding) => binding.binding_status !== "known").length,
    source_workflow_run_record_count: projection.sourceCounts.workflow_run_record_count,
    source_agent_run_record_count: projection.sourceCounts.agent_run_record_count,
    source_gate_result_count: projection.sourceCounts.gate_result_count,
    source_output_artifact_count: projection.sourceCounts.output_artifact_count,
    validation_item_count: validation.items?.length ?? 0,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_trace_status: countBy(records, "trace_status"),
    by_trace_component_status: countBy(records, "trace_component_status"),
    by_binding_type: countBy(allTraceBindings(projection), "binding_type"),
    by_binding_status: countBy(allTraceBindings(projection), "binding_status"),
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "observability-trace-projection-contract.v1",
    generated_at: generatedAt,
    observability_trace_projection_contract_id: CONTRACT_ID,
    required_trace_fields: ["observability_trace_id", "correlation_trace_id", "correlation_id", "trace_status", "trace_component_status", "observability_trace_hash"],
    required_binding_fields: ["trace_binding_id", "binding_type", "source_id", "correlation_trace_id", "observability_trace_id", "binding_status", "trace_binding_hash"],
    component_binding_rule: "Workflow, agent, gate, and output records are projected as binding rows against a correlation trace id; external-control audit traces remain explicit and are not force-bound to a workflow.",
    run_trace_rule: "Every linked run trace must bind to a workflow run record, and every available workflow/agent/gate/output source record must resolve to a known trace.",
  };
}

function buildSourceContracts(sources, inputs) {
  return {
    event_correlation_ledger: sourceContract(sources.eventCorrelationLedger, inputs.event_correlation_ledger_path, {
      event_correlation_status: sources.eventCorrelationLedger.value?.summary?.event_correlation_status ?? null,
      correlation_trace_count: sources.eventCorrelationLedger.value?.summary?.correlation_trace_count ?? 0,
    }),
    workflow_run_ledger: sourceContract(sources.workflowRunLedger, inputs.workflow_run_ledger_path, {
      workflow_run_ledger_status: sources.workflowRunLedger.value?.summary?.workflow_run_ledger_status ?? null,
      workflow_run_record_count: sources.workflowRunLedger.value?.summary?.workflow_run_record_count ?? 0,
    }),
    agent_run_ledger: sourceContract(sources.agentRunLedger, inputs.agent_run_ledger_path, {
      agent_run_ledger_status: sources.agentRunLedger.value?.summary?.agent_run_ledger_status ?? null,
      agent_run_record_count: sources.agentRunLedger.value?.summary?.agent_run_record_count ?? 0,
    }),
    gate_approval_contract_freeze: sourceContract(sources.gateApprovalContractFreeze, inputs.gate_approval_contract_freeze_path, {
      freeze_status: sources.gateApprovalContractFreeze.value?.summary?.freeze_status ?? null,
      gate_result_count: sources.gateApprovalContractFreeze.value?.summary?.gate_result_count ?? 0,
    }),
    output_artifact_catalog: sourceContract(sources.outputArtifactCatalog, inputs.output_artifact_catalog_path, {
      artifact_count: sources.outputArtifactCatalog.value?.summary?.artifact_count ?? 0,
      blocked_delivery_count: sources.outputArtifactCatalog.value?.summary?.blocked_delivery_count ?? 0,
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

function serializableProjection(result) {
  return {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    observability_trace_projection_id: result.observability_trace_projection_id,
    output_dir: result.output_dir,
    inputs: result.inputs,
    source_contracts: result.source_contracts,
    observability_trace_projection_contract: result.observability_trace_projection_contract,
    observability_trace_projection_catalog: result.observability_trace_projection_catalog,
    validation_items: result.validation_items,
    validation: result.validation,
    summary: result.summary,
  };
}

function renderObservabilityTraceProjectionMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Observability Trace Projection");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.observability_trace_projection_status}`);
  lines.push("");
  lines.push(`- Trace records: ${summary.observability_trace_record_count}`);
  lines.push(`- Linked/external control traces: ${summary.linked_trace_count}/${summary.external_control_trace_count}`);
  lines.push(`- Complete component traces: ${summary.complete_component_trace_count}`);
  lines.push(`- Workflow/agent/gate/output bindings: ${summary.workflow_trace_binding_count}/${summary.agent_trace_binding_count}/${summary.gate_trace_binding_count}/${summary.output_trace_binding_count}`);
  lines.push(`- Unknown workflow/agent/gate/output bindings: ${summary.unknown_workflow_trace_binding_count}/${summary.unknown_agent_trace_binding_count}/${summary.unknown_gate_trace_binding_count}/${summary.unknown_output_trace_binding_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Trace Records");
  lines.push("");
  for (const record of result.observability_trace_projection_catalog.observability_trace_records) {
    lines.push(`- ${record.observability_trace_id}: ${record.trace_component_status} (workflow ${record.workflow_binding_count}, agent ${record.agent_binding_count}, gate ${record.gate_binding_count}, output ${record.output_binding_count})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    event_correlation_ledger_path: path.resolve(options.eventCorrelationLedgerPath ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.eventCorrelationLedgerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.workflowRunLedgerPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.agentRunLedgerPath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.gateApprovalContractFreezePath),
    output_artifact_catalog_path: path.resolve(options.outputArtifactCatalogPath ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.outputArtifactCatalogPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.roadmapPath),
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

function allTraceBindings(projection) {
  return [
    ...projection.workflowTraceBindings,
    ...projection.agentTraceBindings,
    ...projection.gateTraceBindings,
    ...projection.outputTraceBindings,
  ];
}

function groupBy(items, keyOrFn) {
  const grouped = new Map();
  for (const item of items) {
    const key = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    const normalizedKey = key ?? "unknown";
    if (!grouped.has(normalizedKey)) grouped.set(normalizedKey, []);
    grouped.get(normalizedKey).push(item);
  }
  return grouped;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function first(items) {
  return Array.isArray(items) && items.length > 0 ? items[0] : null;
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_OUT_DIR,
    eventCorrelationLedgerPath: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.eventCorrelationLedgerPath,
    workflowRunLedgerPath: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.workflowRunLedgerPath,
    agentRunLedgerPath: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.agentRunLedgerPath,
    gateApprovalContractFreezePath: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.gateApprovalContractFreezePath,
    outputArtifactCatalogPath: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.outputArtifactCatalogPath,
    packagePath: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.packagePath,
    roadmapPath: DEFAULT_OBSERVABILITY_TRACE_PROJECTION_INPUTS.roadmapPath,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--event-correlation-ledger") parsed.eventCorrelationLedgerPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--output-catalog" || arg === "--output-artifact-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/observability-trace-projection.mjs [options]

Options:
  --event-correlation-ledger <path>        event-correlation-ledger.json path.
  --workflow-run-ledger <path>             workflow-run-ledger.json path.
  --agent-run-ledger <path>                agent-run-ledger.json path.
  --gate-approval-contract-freeze <path>   gate-approval-contract-freeze.json path.
  --output-catalog <path>                  output-catalog.json path.
  --package <path>                         package.json path.
  --roadmap <path>                         implementation-roadmap.md path.
  --out-dir <folder>                       Output directory.
  --run-at <iso>                           Deterministic generated_at timestamp.
  --check                                  Exit non-zero when the projection is invalid.
  -h, --help                               Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
