import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_LOG_NORMALIZATION_OUT_DIR = "artifacts/runtime-log-normalization/latest";
export const DEFAULT_RUNTIME_LOG_NORMALIZATION_INPUTS = {
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  runtimeArtifactCapturePath: "artifacts/runtime-artifact-capture/latest/runtime-artifact-capture.json",
  observabilityTraceProjectionPath: "artifacts/observability-trace-projection/latest/observability-trace-projection.json",
  agentTraceBindingsPath: "artifacts/observability-trace-projection/latest/agent-trace-bindings.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const NORMALIZATION_AUTHORITY = "harness_control_plane";
const COMMON_LOG_SCHEMA_VERSION = "runtime-log-entry.v1";
const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";

export async function runRuntimeLogNormalization(options = {}) {
  const result = await buildRuntimeLogNormalization(options);
  if (options.write !== false) await writeRuntimeLogNormalization(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime log normalization validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeLogNormalization(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_LOG_NORMALIZATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const runtimeArtifactCapture = await readJson(inputs.runtime_artifact_capture_path);
  const observabilityTraceProjection = await readJson(inputs.observability_trace_projection_path);
  const agentTraceBindings = await readJson(inputs.agent_trace_bindings_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");
  const projection = projectRuntimeLogNormalization({
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    runtimeArtifactCapture,
    agentTraceBindings,
    generatedAt,
  });
  const validationItems = validateRuntimeLogNormalization({
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    runtimeArtifactCapture,
    observabilityTraceProjection,
    agentTraceBindings,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "runtime-log-normalization.v1",
    generated_at: generatedAt,
    runtime_log_normalization_id: `runtime-log-normalization.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAgentRunContractFreeze,
      agentRunLedger,
      runtimeArtifactCapture,
      observabilityTraceProjection,
      agentTraceBindings,
      desktopCompanionIntegration,
    }),
    runtime_log_normalization_contract: buildRuntimeLogNormalizationContract(generatedAt),
    normalized_runtime_logs: projection.normalizedRuntimeLogs,
    normalized_log_streams: projection.normalizedLogStreams,
    runtime_log_search_documents: projection.runtimeLogSearchDocuments,
    runtime_log_trace_bindings: projection.runtimeLogTraceBindings,
    runtime_log_desktop_boundary: projection.runtimeLogDesktopBoundary,
    summary: summarizeRuntimeLogNormalization(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderRuntimeLogNormalizationMarkdown(result),
  };
}

export async function writeRuntimeLogNormalization(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "runtime-log-normalization.json"), serializableRuntimeLogNormalization(result));
  await writeJson(path.join(outDir, "normalized-runtime-logs.json"), {
    schema_version: "normalized-runtime-logs.v1",
    generated_at: result.generated_at,
    normalized_runtime_log_count: result.normalized_runtime_logs.length,
    normalized_runtime_logs: result.normalized_runtime_logs,
  });
  await writeJson(path.join(outDir, "normalized-log-streams.json"), {
    schema_version: "normalized-log-streams.v1",
    generated_at: result.generated_at,
    normalized_log_stream_count: result.normalized_log_streams.length,
    normalized_log_streams: result.normalized_log_streams,
  });
  await writeJson(path.join(outDir, "runtime-log-search-documents.json"), {
    schema_version: "runtime-log-search-documents.v1",
    generated_at: result.generated_at,
    runtime_log_search_document_count: result.runtime_log_search_documents.length,
    runtime_log_search_documents: result.runtime_log_search_documents,
  });
  await writeJson(path.join(outDir, "runtime-log-trace-bindings.json"), {
    schema_version: "runtime-log-trace-bindings.v1",
    generated_at: result.generated_at,
    runtime_log_trace_binding_count: result.runtime_log_trace_bindings.length,
    runtime_log_trace_bindings: result.runtime_log_trace_bindings,
  });
  await writeJson(path.join(outDir, "runtime-log-desktop-boundary.json"), result.runtime_log_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "runtime-log-normalization-validation-report.v1",
    generated_at: result.generated_at,
    runtime_log_normalization_id: result.runtime_log_normalization_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeLogNormalizationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRuntimeLogNormalization(args);
    console.log(`Runtime log normalization written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.runtime_log_normalization_status}`);
    console.log(`Runtime logs: ${result.summary.normalized_log_count}`);
    console.log(`Streams: ${result.summary.bound_stream_count}/${result.summary.normalized_stream_count}`);
    console.log(`Search documents: ${result.summary.search_document_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function normalizeInputs(options) {
  return {
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_RUNTIME_LOG_NORMALIZATION_INPUTS.runtimeAgentRunContractFreezePath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_RUNTIME_LOG_NORMALIZATION_INPUTS.agentRunLedgerPath),
    runtime_artifact_capture_path: path.resolve(options.runtimeArtifactCapturePath ?? DEFAULT_RUNTIME_LOG_NORMALIZATION_INPUTS.runtimeArtifactCapturePath),
    observability_trace_projection_path: path.resolve(options.observabilityTraceProjectionPath ?? DEFAULT_RUNTIME_LOG_NORMALIZATION_INPUTS.observabilityTraceProjectionPath),
    agent_trace_bindings_path: path.resolve(options.agentTraceBindingsPath ?? DEFAULT_RUNTIME_LOG_NORMALIZATION_INPUTS.agentTraceBindingsPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_RUNTIME_LOG_NORMALIZATION_INPUTS.desktopCompanionIntegrationPath),
  };
}

function projectRuntimeLogNormalization({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  runtimeArtifactCapture,
  agentTraceBindings,
  generatedAt,
}) {
  const runtimeLogs = runtimeAgentRunContractFreeze.runtime_agentrun_contract?.runtime_logs ?? [];
  const agentRunLogReferences = agentRunLedger.agent_run_catalog?.agent_run_log_references ?? [];
  const streamCaptureRecords = runtimeArtifactCapture.stream_capture_records ?? [];
  const traceBindings = agentTraceBindings.agent_trace_bindings ?? [];
  const logReferenceByRuntimeLogId = new Map(agentRunLogReferences.map((reference) => [reference.runtime_log_id, reference]));
  const traceBindingByAgentRunId = new Map(traceBindings.map((binding) => [binding.agent_run_id, binding]));
  const streamCapturesByRuntimeLogId = groupBy(streamCaptureRecords, (record) => record.runtime_log_id);

  const normalizedRuntimeLogs = runtimeLogs.map((runtimeLog) => {
    const streamCaptures = streamCapturesByRuntimeLogId.get(runtimeLog.runtime_log_id) ?? [];
    const logReference = logReferenceByRuntimeLogId.get(runtimeLog.runtime_log_id);
    const traceBinding = traceBindingByAgentRunId.get(runtimeLog.agent_run_id);
    const normalizedLogId = `normalized-runtime-log.${slugify(runtimeLog.runtime_log_id)}`;
    return {
      schema_version: "normalized-runtime-log.v1",
      normalized_log_id: normalizedLogId,
      common_log_schema_version: COMMON_LOG_SCHEMA_VERSION,
      normalization_authority: NORMALIZATION_AUTHORITY,
      normalization_status: runtimeLog.log_capture_status === "captured" && streamCaptures.length >= 2 ? "normalized" : "attention",
      runtime_log_id: runtimeLog.runtime_log_id,
      agent_run_log_reference_id: logReference?.agent_run_log_reference_id ?? null,
      agent_run_id: runtimeLog.agent_run_id,
      workflow_run_id: runtimeLog.workflow_run_id,
      runtime_id: runtimeLog.runtime_id,
      logs_ref: runtimeLog.logs_ref,
      logs_required: Boolean(runtimeLog.logs_required),
      log_capture_status: runtimeLog.log_capture_status,
      log_reference_status: logReference?.log_reference_status ?? "missing",
      trace_required: Boolean(runtimeLog.trace_required),
      observability_trace_id: traceBinding?.observability_trace_id ?? null,
      correlation_trace_id: traceBinding?.correlation_trace_id ?? null,
      correlation_id: traceBinding?.correlation_id ?? runtimeLog.workflow_run_id,
      stream_capture_record_ids: streamCaptures.map((record) => record.stream_capture_record_id),
      normalized_stream_ids: streamCaptures.map((record) => `normalized-log-stream.${slugify(record.stream_capture_record_id)}`),
      stream_count: streamCaptures.length,
      stdout_stream_count: streamCaptures.filter((record) => record.stream_name === "stdout").length,
      stderr_stream_count: streamCaptures.filter((record) => record.stream_name === "stderr").length,
      output_artifact_ids: unique(streamCaptures.map((record) => record.output_artifact_id)),
      output_artifact_binding_status: streamCaptures.length > 0 && streamCaptures.every((record) => record.output_artifact_binding_status === "bound_to_output_artifact") ? "bound_to_output_artifact" : "attention",
      search_document_ids: streamCaptures.map((record) => `runtime-log-search-document.${slugify(record.stream_capture_record_id)}`),
      runtime_self_report_trusted: false,
      searchable: true,
      recorded_at: generatedAt,
    };
  });
  const normalizedLogByRuntimeLogId = new Map(normalizedRuntimeLogs.map((record) => [record.runtime_log_id, record]));

  const normalizedLogStreams = streamCaptureRecords.map((streamCapture) => {
    const normalizedLog = normalizedLogByRuntimeLogId.get(streamCapture.runtime_log_id);
    const traceBinding = traceBindingByAgentRunId.get(streamCapture.agent_run_id);
    return {
      schema_version: "normalized-log-stream.v1",
      normalized_stream_id: `normalized-log-stream.${slugify(streamCapture.stream_capture_record_id)}`,
      normalized_log_id: normalizedLog?.normalized_log_id ?? null,
      common_log_schema_version: COMMON_LOG_SCHEMA_VERSION,
      normalization_authority: NORMALIZATION_AUTHORITY,
      normalization_status: streamCapture.capture_status === "bound" && streamCapture.log_capture_status === "captured" ? "normalized" : "attention",
      stream_capture_record_id: streamCapture.stream_capture_record_id,
      runtime_log_id: streamCapture.runtime_log_id,
      agent_run_id: streamCapture.agent_run_id,
      workflow_run_id: streamCapture.workflow_run_id,
      runtime_id: streamCapture.runtime_id,
      stream_name: streamCapture.stream_name,
      log_event_type: "runtime_stream_capture",
      severity: severityForStream(streamCapture.stream_name),
      message_ref: `runtime-log-message://${streamCapture.runtime_log_id}/${streamCapture.stream_name}`,
      stream_ref: streamCapture.stream_ref,
      logs_ref: streamCapture.logs_ref,
      output_artifact_id: streamCapture.output_artifact_id,
      output_artifact_binding_status: streamCapture.output_artifact_binding_status,
      observability_trace_id: traceBinding?.observability_trace_id ?? null,
      correlation_trace_id: traceBinding?.correlation_trace_id ?? null,
      search_text: buildSearchText(streamCapture, traceBinding),
      searchable: true,
      runtime_self_report_trusted: false,
      recorded_at: generatedAt,
    };
  });

  const runtimeLogSearchDocuments = normalizedLogStreams.map((stream) => ({
    schema_version: "runtime-log-search-document.v1",
    runtime_log_search_document_id: `runtime-log-search-document.${slugify(stream.stream_capture_record_id)}`,
    index_status: stream.normalization_status === "normalized" ? "indexed" : "attention",
    common_log_schema_version: COMMON_LOG_SCHEMA_VERSION,
    normalized_stream_id: stream.normalized_stream_id,
    normalized_log_id: stream.normalized_log_id,
    runtime_log_id: stream.runtime_log_id,
    agent_run_id: stream.agent_run_id,
    workflow_run_id: stream.workflow_run_id,
    runtime_id: stream.runtime_id,
    stream_name: stream.stream_name,
    severity: stream.severity,
    log_event_type: stream.log_event_type,
    message_ref: stream.message_ref,
    stream_ref: stream.stream_ref,
    output_artifact_id: stream.output_artifact_id,
    observability_trace_id: stream.observability_trace_id,
    correlation_trace_id: stream.correlation_trace_id,
    search_text: stream.search_text,
    search_hash: sha256(stream.search_text),
    searchable: true,
    desktop_read_only: true,
    runtime_self_report_trusted: false,
    recorded_at: generatedAt,
  }));

  const runtimeLogTraceBindings = normalizedRuntimeLogs.map((runtimeLog) => ({
    schema_version: "runtime-log-trace-binding.v1",
    runtime_log_trace_binding_id: `runtime-log-trace-binding.${slugify(runtimeLog.runtime_log_id)}`,
    binding_authority: NORMALIZATION_AUTHORITY,
    binding_status: runtimeLog.observability_trace_id ? "known" : "attention",
    normalized_log_id: runtimeLog.normalized_log_id,
    runtime_log_id: runtimeLog.runtime_log_id,
    agent_run_id: runtimeLog.agent_run_id,
    workflow_run_id: runtimeLog.workflow_run_id,
    runtime_id: runtimeLog.runtime_id,
    trace_required: runtimeLog.trace_required,
    observability_trace_id: runtimeLog.observability_trace_id,
    correlation_trace_id: runtimeLog.correlation_trace_id,
    correlation_id: runtimeLog.correlation_id,
    runtime_self_report_trusted: false,
    recorded_at: generatedAt,
  }));

  const runtimeLogDesktopBoundary = {
    schema_version: "runtime-log-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "runtime-log-normalization.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "runtime_log_normalization",
    desktop_surface_policy: "read_only_runtime_log_search_status",
    source_of_truth: NORMALIZATION_AUTHORITY,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_execution_allowed: false,
    log_write_allowed: false,
    raw_log_export_allowed: false,
    search_index_mutation_allowed: false,
    normalization_override_allowed: false,
    stream_write_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    allowed_operator_actions: ["view_log_status", "filter_normalized_logs", "search_log_documents", "view_trace_binding"],
    denied_operator_actions: ["write_log", "export_raw_log", "edit_normalization", "mutate_search_index", "start_runtime", "override_trace_binding"],
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
    normalized_log_count: normalizedRuntimeLogs.length,
    normalized_stream_count: normalizedLogStreams.length,
    search_document_count: runtimeLogSearchDocuments.length,
    trace_binding_count: runtimeLogTraceBindings.length,
  };

  return {
    normalizedRuntimeLogs,
    normalizedLogStreams,
    runtimeLogSearchDocuments,
    runtimeLogTraceBindings,
    runtimeLogDesktopBoundary,
  };
}

function buildRuntimeLogNormalizationContract(generatedAt) {
  return {
    schema_version: "runtime-log-normalization-contract.v1",
    generated_at: generatedAt,
    normalization_contract_id: "runtime-log-normalization.default",
    contract_status: "locked",
    normalization_status: "locked",
    normalization_authority: NORMALIZATION_AUTHORITY,
    source_of_truth: "runtime_log_contract_agent_run_ledger_and_artifact_capture",
    common_log_schema_version: COMMON_LOG_SCHEMA_VERSION,
    stdout_stderr_capture_required: true,
    output_artifact_binding_required: true,
    trace_binding_required: true,
    searchable_document_required: true,
    runtime_self_report_trusted: false,
    desktop_surface_policy: "read_only_runtime_log_search_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: false,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
  };
}

function buildSourceContracts({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  runtimeArtifactCapture,
  observabilityTraceProjection,
  agentTraceBindings,
  desktopCompanionIntegration,
}) {
  return {
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      runtime_log_count: runtimeAgentRunContractFreeze.summary?.runtime_log_count ?? 0,
      validation_error_count: runtimeAgentRunContractFreeze.summary?.validation_error_count ?? runtimeAgentRunContractFreeze.validation?.errors?.length ?? 0,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_log_reference_count: agentRunLedger.summary?.agent_run_log_reference_count ?? 0,
      validation_error_count: agentRunLedger.summary?.validation_error_count ?? agentRunLedger.validation?.errors?.length ?? 0,
    },
    runtime_artifact_capture: {
      schema_version: runtimeArtifactCapture.schema_version ?? null,
      runtime_artifact_capture_status: runtimeArtifactCapture.summary?.runtime_artifact_capture_status ?? "unknown",
      stream_capture_record_count: runtimeArtifactCapture.summary?.stream_capture_record_count ?? 0,
      bound_stream_capture_count: runtimeArtifactCapture.summary?.bound_stream_capture_count ?? 0,
      desktop_mutation_allowed: runtimeArtifactCapture.summary?.desktop_mutation_allowed ?? false,
      desktop_source_of_truth: runtimeArtifactCapture.summary?.desktop_source_of_truth ?? false,
      validation_error_count: runtimeArtifactCapture.summary?.validation_error_count ?? runtimeArtifactCapture.validation?.errors?.length ?? 0,
    },
    observability_trace_projection: {
      schema_version: observabilityTraceProjection.schema_version ?? null,
      observability_trace_projection_status: observabilityTraceProjection.summary?.observability_trace_projection_status ?? "unknown",
      agent_trace_binding_count: observabilityTraceProjection.summary?.agent_trace_binding_count ?? 0,
      known_agent_trace_binding_count: observabilityTraceProjection.summary?.known_agent_trace_binding_count ?? 0,
      validation_error_count: observabilityTraceProjection.summary?.validation_error_count ?? observabilityTraceProjection.validation?.errors?.length ?? 0,
    },
    agent_trace_bindings: {
      schema_version: agentTraceBindings.schema_version ?? null,
      agent_trace_binding_count: agentTraceBindings.agent_trace_bindings?.length ?? 0,
      known_agent_trace_binding_count: (agentTraceBindings.agent_trace_bindings ?? []).filter((binding) => binding.binding_status === "known").length,
    },
    desktop_companion_integration: {
      declares_read_only: /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /source of truth가 아니라|not.*source of truth|source_of_truth=false/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /Human Gate|human gate|protected action request|protected_action_request/i.test(desktopCompanionIntegration),
      blocks_runtime_or_log_mutation: /protected execution|mutation_allowed=false|직접 제어하지 않는다|start_runtime|로그 변경/i.test(desktopCompanionIntegration),
    },
  };
}

function validateRuntimeLogNormalization({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  runtimeArtifactCapture,
  observabilityTraceProjection,
  agentTraceBindings,
  desktopCompanionIntegration,
  normalizedRuntimeLogs,
  normalizedLogStreams,
  runtimeLogSearchDocuments,
  runtimeLogTraceBindings,
  runtimeLogDesktopBoundary,
}) {
  const runtimeLogCount = runtimeAgentRunContractFreeze.summary?.runtime_log_count ?? 0;
  const streamCaptureCount = runtimeArtifactCapture.summary?.stream_capture_record_count ?? 0;
  const agentTraceBindingRows = agentTraceBindings.agent_trace_bindings ?? [];
  const searchDocumentIds = new Set(runtimeLogSearchDocuments.map((document) => document.runtime_log_search_document_id));
  const normalizedStreamIds = new Set(normalizedLogStreams.map((stream) => stream.normalized_stream_id));
  const normalizedLogIds = new Set(normalizedRuntimeLogs.map((record) => record.normalized_log_id));
  const items = [];
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_logs_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete" && runtimeAgentRunContractFreeze.validation?.valid !== false && runtimeLogCount > 0, "Runtime/AgentRun freeze has captured runtime log contracts."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_log_references_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunLedger.summary?.agent_run_log_reference_count === runtimeLogCount && agentRunLedger.validation?.valid !== false, "AgentRun ledger has one log reference per runtime log."));
  items.push(validationItem("source.runtime_artifact_capture", "artifact_capture_streams_complete", runtimeArtifactCapture.summary?.runtime_artifact_capture_status === "complete" && runtimeArtifactCapture.summary?.bound_stream_capture_count === streamCaptureCount && runtimeArtifactCapture.validation?.valid !== false, "Runtime artifact capture has bound stdout/stderr streams."));
  items.push(validationItem("source.observability_trace_projection", "agent_trace_bindings_complete", observabilityTraceProjection.summary?.observability_trace_projection_status === "complete" && observabilityTraceProjection.summary?.known_agent_trace_binding_count === runtimeLogCount && observabilityTraceProjection.validation?.valid !== false, "Observability projection has known trace bindings for every agent run."));
  items.push(validationItem("source.agent_trace_bindings", "agent_trace_binding_file_complete", agentTraceBindingRows.length === runtimeLogCount && agentTraceBindingRows.every((binding) => binding.binding_status === "known"), "Agent trace binding rows are available and known."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_declares_read_only_logs", /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration) && /protected action request|Human Gate|human gate/i.test(desktopCompanionIntegration), "Desktop companion integration documents read-only and human-gated mutation boundaries."));
  items.push(validationItem("normalized_runtime_logs", "runtime_log_count_matched", normalizedRuntimeLogs.length === runtimeLogCount, "Every runtime log contract has a normalized log row."));
  items.push(validationItem("normalized_runtime_logs", "all_runtime_logs_normalized", normalizedRuntimeLogs.every((record) => record.normalization_status === "normalized" && record.common_log_schema_version === COMMON_LOG_SCHEMA_VERSION && record.runtime_self_report_trusted === false), "Every runtime log is normalized to the common log schema."));
  items.push(validationItem("normalized_runtime_logs", "each_log_has_stdout_and_stderr", normalizedRuntimeLogs.every((record) => record.stdout_stream_count === 1 && record.stderr_stream_count === 1 && record.stream_count === 2), "Each normalized runtime log has stdout and stderr stream rows."));
  items.push(validationItem("normalized_log_streams", "stream_count_matched", normalizedLogStreams.length === streamCaptureCount && normalizedLogStreams.length === runtimeLogCount * 2, "Every captured stdout/stderr stream is normalized."));
  items.push(validationItem("normalized_log_streams", "all_streams_bound_and_searchable", normalizedLogStreams.every((stream) => stream.normalization_status === "normalized" && stream.output_artifact_binding_status === "bound_to_output_artifact" && stream.searchable === true), "Normalized streams remain bound to OutputArtifact records and searchable."));
  items.push(validationItem("runtime_log_search_documents", "search_documents_cover_streams", runtimeLogSearchDocuments.length === normalizedLogStreams.length && runtimeLogSearchDocuments.every((document) => document.index_status === "indexed" && document.searchable === true && normalizedStreamIds.has(document.normalized_stream_id)), "Search documents cover every normalized stream."));
  items.push(validationItem("runtime_log_search_documents", "normalized_logs_reference_search_documents", normalizedRuntimeLogs.every((record) => record.search_document_ids.every((documentId) => searchDocumentIds.has(documentId))), "Normalized runtime logs reference existing search documents."));
  items.push(validationItem("runtime_log_trace_bindings", "trace_bindings_cover_logs", runtimeLogTraceBindings.length === normalizedRuntimeLogs.length && runtimeLogTraceBindings.every((binding) => binding.binding_status === "known" && normalizedLogIds.has(binding.normalized_log_id)), "Runtime log trace bindings cover every normalized log."));
  items.push(validationItem("runtime_log_desktop_boundary", "desktop_boundary_locked_read_only", runtimeLogDesktopBoundary.boundary_status === "locked" && runtimeLogDesktopBoundary.read_only === true && runtimeLogDesktopBoundary.mutation_allowed === false && runtimeLogDesktopBoundary.protected_mutation_execution_allowed === false && runtimeLogDesktopBoundary.desktop_source_of_truth === false, "Desktop log boundary is locked read-only and not source of truth."));
  items.push(validationItem("runtime_log_desktop_boundary", "desktop_cannot_write_or_mutate_logs", runtimeLogDesktopBoundary.log_write_allowed === false && runtimeLogDesktopBoundary.raw_log_export_allowed === false && runtimeLogDesktopBoundary.search_index_mutation_allowed === false && runtimeLogDesktopBoundary.normalization_override_allowed === false && runtimeLogDesktopBoundary.stream_write_allowed === false, "Desktop cannot write logs, export raw logs, mutate search index, override normalization, or write streams."));
  return items;
}

function summarizeRuntimeLogNormalization(projection, validationItems, validation) {
  const normalizedRuntimeLogs = projection.normalizedRuntimeLogs;
  const normalizedLogStreams = projection.normalizedLogStreams;
  const runtimeLogSearchDocuments = projection.runtimeLogSearchDocuments;
  const runtimeLogTraceBindings = projection.runtimeLogTraceBindings;
  return {
    runtime_log_normalization_status: validation.valid ? "complete" : "blocked",
    normalization_contract_id: "runtime-log-normalization.default",
    contract_status: "locked",
    normalization_authority: NORMALIZATION_AUTHORITY,
    source_of_truth: "runtime_log_contract_agent_run_ledger_and_artifact_capture",
    common_log_schema_version: COMMON_LOG_SCHEMA_VERSION,
    runtime_self_report_trusted: false,
    normalized_log_count: normalizedRuntimeLogs.length,
    normalized_stream_count: normalizedLogStreams.length,
    stdout_stream_count: normalizedLogStreams.filter((stream) => stream.stream_name === "stdout").length,
    stderr_stream_count: normalizedLogStreams.filter((stream) => stream.stream_name === "stderr").length,
    bound_stream_count: normalizedLogStreams.filter((stream) => stream.output_artifact_binding_status === "bound_to_output_artifact").length,
    searchable_stream_count: normalizedLogStreams.filter((stream) => stream.searchable === true).length,
    search_document_count: runtimeLogSearchDocuments.length,
    indexed_search_document_count: runtimeLogSearchDocuments.filter((document) => document.index_status === "indexed").length,
    trace_binding_count: runtimeLogTraceBindings.length,
    known_trace_binding_count: runtimeLogTraceBindings.filter((binding) => binding.binding_status === "known").length,
    unbound_trace_binding_count: runtimeLogTraceBindings.filter((binding) => binding.binding_status !== "known").length,
    desktop_surface_policy: "read_only_runtime_log_search_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: false,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    log_write_allowed: false,
    raw_log_export_allowed: false,
    search_index_mutation_allowed: false,
    normalization_override_allowed: false,
    stream_write_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(normalizedRuntimeLogs, "runtime_id"),
    by_stream_name: countBy(normalizedLogStreams, "stream_name"),
    by_severity: countBy(normalizedLogStreams, "severity"),
  };
}

function renderRuntimeLogNormalizationMarkdown(result) {
  const lines = [];
  lines.push("# Runtime Log Normalization");
  lines.push("");
  lines.push(`- Status: ${result.summary.runtime_log_normalization_status}`);
  lines.push(`- Runtime logs: ${result.summary.normalized_log_count}`);
  lines.push(`- Streams: ${result.summary.bound_stream_count}/${result.summary.normalized_stream_count}`);
  lines.push(`- Search documents: ${result.summary.indexed_search_document_count}/${result.summary.search_document_count}`);
  lines.push(`- Trace bindings: ${result.summary.known_trace_binding_count}/${result.summary.trace_binding_count}`);
  lines.push(`- Desktop: ${result.summary.desktop_surface_policy}, mutation_allowed=${result.summary.desktop_mutation_allowed}`);
  lines.push("");
  lines.push("## Validation");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.path} (${item.check}) - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildSearchText(streamCapture, traceBinding) {
  return [
    streamCapture.workflow_run_id,
    streamCapture.agent_run_id,
    streamCapture.runtime_id,
    streamCapture.runtime_log_id,
    streamCapture.stream_name,
    streamCapture.logs_ref,
    streamCapture.stream_ref,
    streamCapture.output_artifact_id,
    traceBinding?.observability_trace_id,
    traceBinding?.correlation_trace_id,
  ].filter(Boolean).join(" ");
}

function severityForStream(streamName) {
  return streamName === "stderr" ? "warning" : "info";
}

function serializableRuntimeLogNormalization(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function validationItem(pathLabel, check, passed, message, details = {}) {
  return {
    path: pathLabel,
    check,
    status: passed ? "passed" : "failed",
    message,
    ...details,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      check: item.check,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const rawKey = keyFn(item);
    if (rawKey === undefined || rawKey === null || rawKey === "") continue;
    const keys = Array.isArray(rawKey) ? rawKey : [rawKey];
    for (const key of keys) {
      if (key === undefined || key === null || key === "") continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
  }
  return groups;
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function dateStamp(value) {
  return value.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, ".").replaceAll(/^\.+|\.+$/g, "");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") args.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--agent-run-ledger") args.agentRunLedgerPath = argv[++index];
    else if (arg === "--runtime-artifact-capture") args.runtimeArtifactCapturePath = argv[++index];
    else if (arg === "--observability-trace-projection") args.observabilityTraceProjectionPath = argv[++index];
    else if (arg === "--agent-trace-bindings") args.agentTraceBindingsPath = argv[++index];
    else if (arg === "--desktop-companion-integration") args.desktopCompanionIntegrationPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-log-normalization.mjs [options]

Options:
  --check                                      Fail when validation errors are present.
  --no-write                                   Build without writing artifacts.
  --out-dir <path>                             Output directory.
  --runtime-agentrun-contract-freeze <path>    Runtime/AgentRun freeze artifact.
  --agent-run-ledger <path>                    AgentRun ledger artifact.
  --runtime-artifact-capture <path>            Runtime Artifact Capture artifact.
  --observability-trace-projection <path>      Observability Trace Projection artifact.
  --agent-trace-bindings <path>                Agent trace binding rows.
  --desktop-companion-integration <path>       Desktop Companion integration note.
`);
}
