import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_OUT_DIR = "artifacts/runtime-timeout-heartbeat/latest";
export const DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_INPUTS = {
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  runtimeLogNormalizationPath: "artifacts/runtime-log-normalization/latest/runtime-log-normalization.json",
  workflowInRunGateFrameworkPath: "artifacts/workflow-in-run-gates/latest/workflow-in-run-gate-framework.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const LIFECYCLE_AUTHORITY = "harness_control_plane";
const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";
const SOURCE_OF_TRUTH = "runtime_agentrun_contract_agent_run_ledger_and_runtime_logs";

export async function runRuntimeTimeoutHeartbeat(options = {}) {
  const result = await buildRuntimeTimeoutHeartbeat(options);
  if (options.write !== false) await writeRuntimeTimeoutHeartbeat(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime timeout/heartbeat validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeTimeoutHeartbeat(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const workflowRunLedger = await readJson(inputs.workflow_run_ledger_path);
  const runtimeLogNormalization = await readJson(inputs.runtime_log_normalization_path);
  const workflowInRunGateFramework = await readJson(inputs.workflow_in_run_gate_framework_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");
  const projection = projectRuntimeTimeoutHeartbeat({
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    workflowRunLedger,
    runtimeLogNormalization,
    workflowInRunGateFramework,
    generatedAt,
  });
  const validationItems = validateRuntimeTimeoutHeartbeat({
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    workflowRunLedger,
    runtimeLogNormalization,
    workflowInRunGateFramework,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "runtime-timeout-heartbeat.v1",
    generated_at: generatedAt,
    runtime_timeout_heartbeat_id: `runtime-timeout-heartbeat.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAgentRunContractFreeze,
      agentRunLedger,
      workflowRunLedger,
      runtimeLogNormalization,
      workflowInRunGateFramework,
      desktopCompanionIntegration,
    }),
    runtime_timeout_heartbeat_contract: buildRuntimeTimeoutHeartbeatContract(generatedAt),
    runtime_heartbeat_records: projection.runtimeHeartbeatRecords,
    runtime_timeout_records: projection.runtimeTimeoutRecords,
    runtime_lifecycle_ledger_bindings: projection.runtimeLifecycleLedgerBindings,
    runtime_heartbeat_desktop_boundary: projection.runtimeHeartbeatDesktopBoundary,
    summary: summarizeRuntimeTimeoutHeartbeat(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderRuntimeTimeoutHeartbeatMarkdown(result),
  };
}

export async function writeRuntimeTimeoutHeartbeat(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "runtime-timeout-heartbeat.json"), serializableRuntimeTimeoutHeartbeat(result));
  await writeJson(path.join(outDir, "runtime-heartbeat-records.json"), {
    schema_version: "runtime-heartbeat-records.v1",
    generated_at: result.generated_at,
    runtime_heartbeat_record_count: result.runtime_heartbeat_records.length,
    runtime_heartbeat_records: result.runtime_heartbeat_records,
  });
  await writeJson(path.join(outDir, "runtime-timeout-records.json"), {
    schema_version: "runtime-timeout-records.v1",
    generated_at: result.generated_at,
    runtime_timeout_record_count: result.runtime_timeout_records.length,
    runtime_timeout_records: result.runtime_timeout_records,
  });
  await writeJson(path.join(outDir, "runtime-lifecycle-ledger-bindings.json"), {
    schema_version: "runtime-lifecycle-ledger-bindings.v1",
    generated_at: result.generated_at,
    runtime_lifecycle_ledger_binding_count: result.runtime_lifecycle_ledger_bindings.length,
    runtime_lifecycle_ledger_bindings: result.runtime_lifecycle_ledger_bindings,
  });
  await writeJson(path.join(outDir, "runtime-heartbeat-desktop-boundary.json"), result.runtime_heartbeat_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "runtime-timeout-heartbeat-validation-report.v1",
    generated_at: result.generated_at,
    runtime_timeout_heartbeat_id: result.runtime_timeout_heartbeat_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeTimeoutHeartbeatCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRuntimeTimeoutHeartbeat(args);
    console.log(`Runtime timeout/heartbeat written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.runtime_timeout_heartbeat_status}`);
    console.log(`Heartbeat records: ${result.summary.heartbeat_record_count}`);
    console.log(`Timeout records: ${result.summary.timeout_record_count}`);
    console.log(`Timed out: ${result.summary.timed_out_count}`);
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
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_INPUTS.runtimeAgentRunContractFreezePath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_INPUTS.agentRunLedgerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_INPUTS.workflowRunLedgerPath),
    runtime_log_normalization_path: path.resolve(options.runtimeLogNormalizationPath ?? DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_INPUTS.runtimeLogNormalizationPath),
    workflow_in_run_gate_framework_path: path.resolve(options.workflowInRunGateFrameworkPath ?? DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_INPUTS.workflowInRunGateFrameworkPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_RUNTIME_TIMEOUT_HEARTBEAT_INPUTS.desktopCompanionIntegrationPath),
  };
}

function projectRuntimeTimeoutHeartbeat({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  workflowRunLedger,
  runtimeLogNormalization,
  workflowInRunGateFramework,
  generatedAt,
}) {
  const agentRuns = runtimeAgentRunContractFreeze.runtime_agentrun_contract?.agent_runs ?? [];
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const normalizedLogs = runtimeLogNormalization.normalized_runtime_logs ?? [];
  const traceBindings = runtimeLogNormalization.runtime_log_trace_bindings ?? [];
  const inRunGateRecords = workflowInRunGateFramework.in_run_gate_records ?? [];
  const agentRecordByAgentRunId = new Map(agentRunRecords.map((record) => [record.agent_run_id, record]));
  const workflowRecordByRunId = new Map(workflowRunRecords.map((record) => [record.workflow_run_id, record]));
  const normalizedLogByAgentRunId = new Map(normalizedLogs.map((record) => [record.agent_run_id, record]));
  const traceBindingByAgentRunId = new Map(traceBindings.map((binding) => [binding.agent_run_id, binding]));
  const timeoutGatesByAgentRunId = groupBy(
    inRunGateRecords.filter((record) => record.gate_type === "timeout_gate"),
    (record) => record.agent_run_id,
  );

  const runtimeHeartbeatRecords = agentRuns.map((agentRun) => {
    const agentRecord = agentRecordByAgentRunId.get(agentRun.agent_run_id);
    const normalizedLog = normalizedLogByAgentRunId.get(agentRun.agent_run_id);
    const traceBinding = traceBindingByAgentRunId.get(agentRun.agent_run_id);
    const lifecycle = normalizeLifecycle(agentRun.lifecycle_policy ?? agentRecord?.lifecycle_policy);
    const startedAt = agentRecord?.started_at ?? agentRun.started_at ?? generatedAt;
    const completedAt = agentRecord?.completed_at ?? agentRun.completed_at ?? null;
    const terminal = isTerminalStatus(agentRun.status);
    const elapsedSeconds = elapsedSecondsBetween(startedAt, completedAt ?? generatedAt);
    const heartbeatDueCount = terminal ? 0 : Math.max(0, Math.floor(elapsedSeconds / lifecycle.heartbeat_seconds));
    const timeoutGates = timeoutGatesByAgentRunId.get(agentRun.agent_run_id) ?? [];
    const heartbeatRecordId = `runtime-heartbeat.${slugify(agentRun.agent_run_id)}`;
    return {
      schema_version: "runtime-heartbeat-record.v1",
      runtime_heartbeat_record_id: heartbeatRecordId,
      heartbeat_authority: LIFECYCLE_AUTHORITY,
      heartbeat_status: terminal ? "observed_terminal" : "watching",
      lifecycle_policy_hash: sha256(JSON.stringify(lifecycle)),
      agent_run_id: agentRun.agent_run_id,
      agent_run_record_id: agentRecord?.agent_run_record_id ?? null,
      workflow_run_id: agentRun.workflow_run_id,
      workflow_run_record_id: agentRecord?.workflow_run_record_id ?? workflowRecordByRunId.get(agentRun.workflow_run_id)?.workflow_run_record_id ?? null,
      run_ledger_id: agentRecord?.run_ledger_id ?? agentRun.run_record_id ?? null,
      runtime_id: agentRun.runtime_id,
      adapter_id: agentRun.adapter_id,
      runtime_log_id: agentRecord?.runtime_log_id ?? normalizedLog?.runtime_log_id ?? null,
      normalized_log_id: normalizedLog?.normalized_log_id ?? null,
      runtime_log_trace_binding_id: traceBinding?.runtime_log_trace_binding_id ?? null,
      observability_trace_id: traceBinding?.observability_trace_id ?? normalizedLog?.observability_trace_id ?? null,
      correlation_trace_id: traceBinding?.correlation_trace_id ?? normalizedLog?.correlation_trace_id ?? agentRecord?.correlation_trace_id ?? null,
      heartbeat_interval_seconds: lifecycle.heartbeat_seconds,
      timeout_seconds: lifecycle.timeout_seconds,
      max_retries: lifecycle.max_retries,
      cancellable: lifecycle.cancellable,
      resumable: lifecycle.resumable,
      started_at: startedAt,
      completed_at: completedAt,
      elapsed_seconds: elapsedSeconds,
      recorded_heartbeat_count: 1,
      heartbeat_due_count: heartbeatDueCount,
      heartbeat_missed: false,
      last_heartbeat_at: completedAt ?? generatedAt,
      next_heartbeat_due_at: terminal ? null : addSeconds(generatedAt, lifecycle.heartbeat_seconds),
      long_running_watch_required: lifecycle.timeout_seconds > lifecycle.heartbeat_seconds,
      long_running_state: terminal ? "terminal_completed" : "active_watch",
      timeout_gate_record_count: timeoutGates.length,
      timeout_gate_status: timeoutGates.length > 0 && timeoutGates.every((gate) => gate.in_run_gate_status === "passed") ? "passed" : "not_applicable",
      runtime_self_report_trusted: false,
      desktop_read_only: true,
      recorded_at: generatedAt,
    };
  });

  const heartbeatByAgentRunId = new Map(runtimeHeartbeatRecords.map((record) => [record.agent_run_id, record]));
  const runtimeTimeoutRecords = agentRuns.map((agentRun) => {
    const heartbeat = heartbeatByAgentRunId.get(agentRun.agent_run_id);
    const lifecycle = normalizeLifecycle(agentRun.lifecycle_policy ?? heartbeat);
    const startedAt = heartbeat?.started_at ?? agentRun.started_at ?? generatedAt;
    const elapsedSeconds = heartbeat?.elapsed_seconds ?? elapsedSecondsBetween(startedAt, agentRun.completed_at ?? generatedAt);
    const timedOut = elapsedSeconds > lifecycle.timeout_seconds;
    const timeoutRecordId = `runtime-timeout.${slugify(agentRun.agent_run_id)}`;
    return {
      schema_version: "runtime-timeout-record.v1",
      runtime_timeout_record_id: timeoutRecordId,
      timeout_authority: LIFECYCLE_AUTHORITY,
      timeout_status: timedOut ? "timed_out" : "within_timeout",
      agent_run_id: agentRun.agent_run_id,
      workflow_run_id: agentRun.workflow_run_id,
      runtime_id: agentRun.runtime_id,
      adapter_id: agentRun.adapter_id,
      heartbeat_record_id: heartbeat?.runtime_heartbeat_record_id ?? null,
      timeout_seconds: lifecycle.timeout_seconds,
      heartbeat_interval_seconds: lifecycle.heartbeat_seconds,
      elapsed_seconds: elapsedSeconds,
      timeout_deadline_at: addSeconds(startedAt, lifecycle.timeout_seconds),
      timed_out: timedOut,
      active_timeout: !isTerminalStatus(agentRun.status) && timedOut,
      timeout_action_status: timedOut ? "requires_human_gate" : "not_required",
      timeout_action: timedOut ? "protected_control_action_request" : "none_terminal_within_timeout",
      protected_control_action_required: timedOut,
      human_gate_required_for_control_action: true,
      runtime_self_report_trusted: false,
      desktop_timeout_override_allowed: false,
      desktop_cancel_allowed: false,
      desktop_resume_allowed: false,
      desktop_clock_edit_allowed: false,
      recorded_at: generatedAt,
    };
  });

  const timeoutByAgentRunId = new Map(runtimeTimeoutRecords.map((record) => [record.agent_run_id, record]));
  const runtimeLifecycleLedgerBindings = runtimeHeartbeatRecords.map((heartbeat) => {
    const timeout = timeoutByAgentRunId.get(heartbeat.agent_run_id);
    return {
      schema_version: "runtime-lifecycle-ledger-binding.v1",
      runtime_lifecycle_ledger_binding_id: `runtime-lifecycle-binding.${slugify(heartbeat.agent_run_id)}`,
      binding_authority: LIFECYCLE_AUTHORITY,
      binding_status: heartbeat.agent_run_record_id && heartbeat.normalized_log_id && heartbeat.observability_trace_id ? "bound" : "attention",
      agent_run_id: heartbeat.agent_run_id,
      agent_run_record_id: heartbeat.agent_run_record_id,
      workflow_run_id: heartbeat.workflow_run_id,
      workflow_run_record_id: heartbeat.workflow_run_record_id,
      run_ledger_id: heartbeat.run_ledger_id,
      runtime_id: heartbeat.runtime_id,
      runtime_heartbeat_record_id: heartbeat.runtime_heartbeat_record_id,
      runtime_timeout_record_id: timeout?.runtime_timeout_record_id ?? null,
      runtime_log_id: heartbeat.runtime_log_id,
      normalized_log_id: heartbeat.normalized_log_id,
      runtime_log_trace_binding_id: heartbeat.runtime_log_trace_binding_id,
      observability_trace_id: heartbeat.observability_trace_id,
      correlation_trace_id: heartbeat.correlation_trace_id,
      heartbeat_status: heartbeat.heartbeat_status,
      timeout_status: timeout?.timeout_status ?? "unknown",
      timed_out: timeout?.timed_out ?? false,
      runtime_self_report_trusted: false,
      desktop_read_only: true,
      recorded_at: generatedAt,
    };
  });

  const runtimeHeartbeatDesktopBoundary = {
    schema_version: "runtime-heartbeat-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "runtime-timeout-heartbeat.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "runtime_timeout_heartbeat",
    desktop_surface_policy: "read_only_runtime_lifecycle_status",
    source_of_truth: LIFECYCLE_AUTHORITY,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: true,
    protected_mutation_execution_allowed: false,
    heartbeat_write_allowed: false,
    timeout_override_allowed: false,
    cancel_allowed: false,
    resume_allowed: false,
    clock_edit_allowed: false,
    runtime_start_allowed: false,
    runtime_process_control_allowed: false,
    installer_or_gateway_control: false,
    allowed_operator_actions: ["view_heartbeat_status", "view_timeout_status", "filter_lifecycle_records", "draft_protected_control_request"],
    denied_operator_actions: ["write_heartbeat", "override_timeout", "cancel_runtime", "resume_runtime", "edit_clock", "start_runtime", "control_runtime_process"],
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
    heartbeat_record_count: runtimeHeartbeatRecords.length,
    timeout_record_count: runtimeTimeoutRecords.length,
    lifecycle_ledger_binding_count: runtimeLifecycleLedgerBindings.length,
  };

  return {
    runtimeHeartbeatRecords,
    runtimeTimeoutRecords,
    runtimeLifecycleLedgerBindings,
    runtimeHeartbeatDesktopBoundary,
  };
}

function buildRuntimeTimeoutHeartbeatContract(generatedAt) {
  return {
    schema_version: "runtime-timeout-heartbeat-contract.v1",
    generated_at: generatedAt,
    lifecycle_contract_id: "runtime-timeout-heartbeat.default",
    contract_status: "locked",
    lifecycle_status: "locked",
    heartbeat_authority: LIFECYCLE_AUTHORITY,
    timeout_authority: LIFECYCLE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    heartbeat_ledger_required: true,
    timeout_ledger_required: true,
    run_ledger_binding_required: true,
    normalized_log_binding_required: true,
    trace_binding_required: true,
    runtime_self_report_trusted: false,
    desktop_surface_policy: "read_only_runtime_lifecycle_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: true,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    heartbeat_write_allowed: false,
    timeout_override_allowed: false,
    cancel_allowed: false,
    resume_allowed: false,
    clock_edit_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
  };
}

function buildSourceContracts({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  workflowRunLedger,
  runtimeLogNormalization,
  workflowInRunGateFramework,
  desktopCompanionIntegration,
}) {
  return {
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      agent_run_count: runtimeAgentRunContractFreeze.summary?.agent_run_count ?? 0,
      validation_error_count: runtimeAgentRunContractFreeze.summary?.validation_error_count ?? runtimeAgentRunContractFreeze.validation?.errors?.length ?? 0,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      validation_error_count: agentRunLedger.summary?.validation_error_count ?? agentRunLedger.validation?.errors?.length ?? 0,
    },
    workflow_run_ledger: {
      schema_version: workflowRunLedger.schema_version ?? null,
      workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
      workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? 0,
      validation_error_count: workflowRunLedger.summary?.validation_error_count ?? workflowRunLedger.validation?.errors?.length ?? 0,
    },
    runtime_log_normalization: {
      schema_version: runtimeLogNormalization.schema_version ?? null,
      runtime_log_normalization_status: runtimeLogNormalization.summary?.runtime_log_normalization_status ?? "unknown",
      normalized_log_count: runtimeLogNormalization.summary?.normalized_log_count ?? 0,
      known_trace_binding_count: runtimeLogNormalization.summary?.known_trace_binding_count ?? 0,
      desktop_mutation_allowed: runtimeLogNormalization.summary?.desktop_mutation_allowed ?? false,
      desktop_source_of_truth: runtimeLogNormalization.summary?.desktop_source_of_truth ?? false,
      validation_error_count: runtimeLogNormalization.summary?.validation_error_count ?? runtimeLogNormalization.validation?.errors?.length ?? 0,
    },
    workflow_in_run_gate_framework: {
      schema_version: workflowInRunGateFramework.schema_version ?? null,
      workflow_in_run_gate_framework_status: workflowInRunGateFramework.summary?.workflow_in_run_gate_framework_status ?? "unknown",
      timeout_gate_count: workflowInRunGateFramework.summary?.timeout_gate_count ?? 0,
      timeout_without_gate_count: workflowInRunGateFramework.summary?.timeout_without_gate_count ?? 0,
      timeout_gate_passed_count: workflowInRunGateFramework.summary?.timeout_gate_passed_count ?? 0,
      validation_error_count: workflowInRunGateFramework.summary?.validation_error_count ?? workflowInRunGateFramework.validation?.errors?.length ?? 0,
    },
    desktop_companion_integration: {
      declares_read_only: /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /source of truth가 아니라|not.*source of truth|source_of_truth=false/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /Human Gate|human gate|protected action request|protected_action_request/i.test(desktopCompanionIntegration),
      blocks_runtime_control: /protected execution|mutation_allowed=false|start_runtime|직접 제어하지 않는다|runtime source of truth/i.test(desktopCompanionIntegration),
    },
  };
}

function validateRuntimeTimeoutHeartbeat({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  workflowRunLedger,
  runtimeLogNormalization,
  workflowInRunGateFramework,
  desktopCompanionIntegration,
  runtimeHeartbeatRecords,
  runtimeTimeoutRecords,
  runtimeLifecycleLedgerBindings,
  runtimeHeartbeatDesktopBoundary,
}) {
  const agentRuns = runtimeAgentRunContractFreeze.runtime_agentrun_contract?.agent_runs ?? [];
  const agentRunCount = runtimeAgentRunContractFreeze.summary?.agent_run_count ?? agentRuns.length;
  const normalizedLogCount = runtimeLogNormalization.summary?.normalized_log_count ?? 0;
  const items = [];
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "agent_run_lifecycle_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete" && agentRunCount > 0 && agentRuns.every((run) => hasCompleteLifecycle(run.lifecycle_policy)), "Runtime/AgentRun freeze has lifecycle timeout and heartbeat policies for every AgentRun."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunLedger.summary?.agent_run_record_count === agentRunCount && agentRunLedger.validation?.valid !== false, "AgentRun ledger has one record per AgentRun."));
  items.push(validationItem("source.workflow_run_ledger", "workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete" && workflowRunLedger.validation?.valid !== false, "Workflow run ledger is available for run binding."));
  items.push(validationItem("source.runtime_log_normalization", "runtime_log_normalization_complete", runtimeLogNormalization.summary?.runtime_log_normalization_status === "complete" && normalizedLogCount === agentRunCount && runtimeLogNormalization.summary?.known_trace_binding_count === agentRunCount && runtimeLogNormalization.validation?.valid !== false, "Runtime log normalization has one normalized log and trace binding per AgentRun."));
  items.push(validationItem("source.workflow_in_run_gate_framework", "timeout_gates_configured", workflowInRunGateFramework.summary?.workflow_in_run_gate_framework_status === "complete" && workflowInRunGateFramework.summary?.timeout_without_gate_count === 0 && workflowInRunGateFramework.summary?.timeout_gate_passed_count > 0, "In-run gate framework has configured timeout gates and no timeout-without-gate cases."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_declares_lifecycle_boundary", /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration) && /protected action request|Human Gate|human gate/i.test(desktopCompanionIntegration), "Desktop companion documentation preserves read-only status and human-gated protected mutation."));
  items.push(validationItem("runtime_heartbeat_records", "heartbeat_records_cover_agent_runs", runtimeHeartbeatRecords.length === agentRunCount, "Heartbeat ledger has one record per AgentRun."));
  items.push(validationItem("runtime_heartbeat_records", "heartbeats_observed_without_miss", runtimeHeartbeatRecords.every((record) => record.heartbeat_status === "observed_terminal" && record.recorded_heartbeat_count >= 1 && record.heartbeat_missed === false && record.runtime_self_report_trusted === false), "Every completed AgentRun has an observed terminal heartbeat and no missed heartbeat."));
  items.push(validationItem("runtime_timeout_records", "timeout_records_cover_agent_runs", runtimeTimeoutRecords.length === agentRunCount, "Timeout ledger has one record per AgentRun."));
  items.push(validationItem("runtime_timeout_records", "timeouts_within_policy", runtimeTimeoutRecords.every((record) => record.timeout_status === "within_timeout" && record.timed_out === false && record.active_timeout === false && record.timeout_action_status === "not_required"), "Every AgentRun closed within its timeout policy."));
  items.push(validationItem("runtime_lifecycle_ledger_bindings", "ledger_bindings_cover_lifecycle_records", runtimeLifecycleLedgerBindings.length === agentRunCount && runtimeLifecycleLedgerBindings.every((binding) => binding.binding_status === "bound" && binding.timed_out === false && binding.runtime_self_report_trusted === false), "Lifecycle bindings connect heartbeat, timeout, AgentRun ledger, normalized logs, and traces."));
  items.push(validationItem("runtime_heartbeat_desktop_boundary", "desktop_boundary_locked_read_only", runtimeHeartbeatDesktopBoundary.boundary_status === "locked" && runtimeHeartbeatDesktopBoundary.read_only === true && runtimeHeartbeatDesktopBoundary.mutation_allowed === false && runtimeHeartbeatDesktopBoundary.protected_mutation_execution_allowed === false && runtimeHeartbeatDesktopBoundary.desktop_source_of_truth === false, "Desktop lifecycle boundary is locked read-only and not source of truth."));
  items.push(validationItem("runtime_heartbeat_desktop_boundary", "desktop_cannot_mutate_runtime_lifecycle", runtimeHeartbeatDesktopBoundary.heartbeat_write_allowed === false && runtimeHeartbeatDesktopBoundary.timeout_override_allowed === false && runtimeHeartbeatDesktopBoundary.cancel_allowed === false && runtimeHeartbeatDesktopBoundary.resume_allowed === false && runtimeHeartbeatDesktopBoundary.clock_edit_allowed === false && runtimeHeartbeatDesktopBoundary.runtime_start_allowed === false, "Desktop cannot write heartbeats, override timeouts, cancel/resume runtimes, edit clock, or start runtime."));
  return items;
}

function summarizeRuntimeTimeoutHeartbeat(projection, validationItems, validation) {
  const heartbeats = projection.runtimeHeartbeatRecords;
  const timeouts = projection.runtimeTimeoutRecords;
  const bindings = projection.runtimeLifecycleLedgerBindings;
  return {
    runtime_timeout_heartbeat_status: validation.valid ? "complete" : "blocked",
    lifecycle_contract_id: "runtime-timeout-heartbeat.default",
    contract_status: "locked",
    heartbeat_authority: LIFECYCLE_AUTHORITY,
    timeout_authority: LIFECYCLE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    runtime_self_report_trusted: false,
    agent_run_count: heartbeats.length,
    heartbeat_record_count: heartbeats.length,
    observed_heartbeat_count: heartbeats.filter((record) => record.heartbeat_status === "observed_terminal").length,
    recorded_heartbeat_count: heartbeats.reduce((sum, record) => sum + Number(record.recorded_heartbeat_count ?? 0), 0),
    heartbeat_due_count: heartbeats.reduce((sum, record) => sum + Number(record.heartbeat_due_count ?? 0), 0),
    heartbeat_missed_count: heartbeats.filter((record) => record.heartbeat_missed === true).length,
    terminal_heartbeat_count: heartbeats.filter((record) => record.long_running_state === "terminal_completed").length,
    timeout_record_count: timeouts.length,
    timeout_policy_bound_count: timeouts.filter((record) => record.timeout_seconds > 0 && record.heartbeat_interval_seconds > 0).length,
    long_running_watch_count: heartbeats.filter((record) => record.long_running_watch_required === true).length,
    timed_out_count: timeouts.filter((record) => record.timed_out === true).length,
    active_timeout_count: timeouts.filter((record) => record.active_timeout === true).length,
    timeout_action_required_count: timeouts.filter((record) => record.timeout_action_status !== "not_required").length,
    run_ledger_binding_count: bindings.length,
    bound_run_ledger_binding_count: bindings.filter((binding) => binding.binding_status === "bound").length,
    known_trace_binding_count: bindings.filter((binding) => binding.observability_trace_id && binding.correlation_trace_id).length,
    desktop_surface_policy: "read_only_runtime_lifecycle_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: true,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    heartbeat_write_allowed: false,
    timeout_override_allowed: false,
    cancel_allowed: false,
    resume_allowed: false,
    clock_edit_allowed: false,
    runtime_start_allowed: false,
    runtime_process_control_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(heartbeats, "runtime_id"),
    by_heartbeat_status: countBy(heartbeats, "heartbeat_status"),
    by_timeout_status: countBy(timeouts, "timeout_status"),
    by_long_running_state: countBy(heartbeats, "long_running_state"),
  };
}

function renderRuntimeTimeoutHeartbeatMarkdown(result) {
  const lines = [];
  lines.push("# Runtime Timeout/Heartbeat");
  lines.push("");
  lines.push(`- Status: ${result.summary.runtime_timeout_heartbeat_status}`);
  lines.push(`- Heartbeats: ${result.summary.observed_heartbeat_count}/${result.summary.heartbeat_record_count}`);
  lines.push(`- Timeouts within policy: ${result.summary.timeout_record_count - result.summary.timed_out_count}/${result.summary.timeout_record_count}`);
  lines.push(`- Run ledger bindings: ${result.summary.bound_run_ledger_binding_count}/${result.summary.run_ledger_binding_count}`);
  lines.push(`- Desktop: ${result.summary.desktop_surface_policy}, mutation_allowed=${result.summary.desktop_mutation_allowed}`);
  lines.push("");
  lines.push("## Validation");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.path} (${item.check}) - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeLifecycle(lifecycle = {}) {
  return {
    timeout_seconds: Number(lifecycle.timeout_seconds ?? 1),
    heartbeat_seconds: Number(lifecycle.heartbeat_seconds ?? 1),
    cancellable: Boolean(lifecycle.cancellable),
    resumable: Boolean(lifecycle.resumable),
    max_retries: Number(lifecycle.max_retries ?? 0),
  };
}

function hasCompleteLifecycle(lifecycle = {}) {
  return Number(lifecycle.timeout_seconds) > 0
    && Number(lifecycle.heartbeat_seconds) > 0
    && typeof lifecycle.cancellable === "boolean"
    && typeof lifecycle.resumable === "boolean"
    && Number(lifecycle.max_retries) >= 0;
}

function elapsedSecondsBetween(startedAt, endedAt) {
  const started = Date.parse(startedAt);
  const ended = Date.parse(endedAt);
  if (!Number.isFinite(started) || !Number.isFinite(ended)) return 0;
  return Math.max(0, Math.ceil((ended - started) / 1000));
}

function addSeconds(value, seconds) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp + Number(seconds) * 1000).toISOString();
}

function isTerminalStatus(status) {
  return ["completed", "blocked", "failed", "cancelled", "timed_out"].includes(status);
}

function serializableRuntimeTimeoutHeartbeat(result) {
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
    else if (arg === "--workflow-run-ledger") args.workflowRunLedgerPath = argv[++index];
    else if (arg === "--runtime-log-normalization") args.runtimeLogNormalizationPath = argv[++index];
    else if (arg === "--workflow-in-run-gates") args.workflowInRunGateFrameworkPath = argv[++index];
    else if (arg === "--desktop-companion-integration") args.desktopCompanionIntegrationPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-timeout-heartbeat.mjs [options]

Options:
  --check                                      Fail when validation errors are present.
  --no-write                                   Build without writing artifacts.
  --out-dir <path>                             Output directory.
  --runtime-agentrun-contract-freeze <path>    Runtime/AgentRun freeze artifact.
  --agent-run-ledger <path>                    AgentRun ledger artifact.
  --workflow-run-ledger <path>                 WorkflowRun ledger artifact.
  --runtime-log-normalization <path>           Runtime Log Normalization artifact.
  --workflow-in-run-gates <path>               Workflow In-run Gate Framework artifact.
  --desktop-companion-integration <path>       Desktop Companion integration note.
`);
}
