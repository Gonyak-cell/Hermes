import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_TOOL_INVOCATION_LEDGER_OUT_DIR = "artifacts/tool-invocation-ledger/latest";
export const DEFAULT_TOOL_INVOCATION_LEDGER_INPUTS = {
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  appendOnlyEventStorePath: "artifacts/append-only-event-store/latest/append-only-event-store.json",
  eventCorrelationLedgerPath: "artifacts/event-correlation/latest/event-correlation-ledger.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const TOOL_INVOCATION_LEDGER_SCHEMA_VERSION = "tool-invocation-ledger.v1";
const TOOL_INVOCATION_LEDGER_CONTRACT_SCHEMA_VERSION = "tool-invocation-ledger-contract.v1";
const TOOL_INVOCATION_RECORD_SCHEMA_VERSION = "tool-invocation-record.v1";
const TOOL_INVOCATION_PERMISSION_DECISION_SCHEMA_VERSION = "tool-invocation-permission-decision.v1";
const TOOL_INVOCATION_AGENT_BINDING_SCHEMA_VERSION = "tool-invocation-agent-binding.v1";
const TOOL_INVOCATION_EVENT_BINDING_SCHEMA_VERSION = "tool-invocation-event-binding.v1";
const TOOL_INVOCATION_LEDGER_CONTRACT_ID = "tool-invocation-ledger.v1";

export async function runToolInvocationLedger(options = {}) {
  const result = await buildToolInvocationLedger(options);
  if (options.write !== false) await writeToolInvocationLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Tool invocation ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildToolInvocationLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TOOL_INVOCATION_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const toolRuntimePolicyEnforcement = await readJson(inputs.tool_runtime_policy_enforcement_path);
  const appendOnlyEventStore = await readJson(inputs.append_only_event_store_path);
  const eventCorrelationLedger = await readJson(inputs.event_correlation_ledger_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const projection = buildToolInvocationProjection({
    agentRunLedger,
    toolRuntimePolicyEnforcement,
    appendOnlyEventStore,
    eventCorrelationLedger,
    runtimeAgentRunContractFreeze,
    generatedAt,
  });
  const validationItems = validateToolInvocationLedger({
    agentRunLedger,
    toolRuntimePolicyEnforcement,
    appendOnlyEventStore,
    eventCorrelationLedger,
    runtimeAgentRunContractFreeze,
    packageJson,
    roadmapText,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: TOOL_INVOCATION_LEDGER_SCHEMA_VERSION,
    generated_at: generatedAt,
    tool_invocation_ledger_id: `tool-invocation-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      agent_run_ledger: {
        schema_version: agentRunLedger.schema_version ?? null,
        agent_run_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
        agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
        agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
        validation_error_count: agentRunLedger.summary?.validation_error_count ?? agentRunLedger.validation?.errors?.length ?? 0,
      },
      tool_runtime_policy_enforcement: {
        schema_version: toolRuntimePolicyEnforcement.schema_version ?? null,
        tool_runtime_policy_enforcement_id: toolRuntimePolicyEnforcement.tool_runtime_policy_enforcement_id ?? null,
        tool_runtime_policy_enforcement_status: toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
        tool_permission_gate_count: toolRuntimePolicyEnforcement.summary?.tool_permission_gate_count ?? 0,
        agent_run_tool_gate_count: toolRuntimePolicyEnforcement.summary?.agent_run_tool_gate_count ?? 0,
        validation_error_count: toolRuntimePolicyEnforcement.summary?.validation_error_count ?? toolRuntimePolicyEnforcement.validation?.errors?.length ?? 0,
      },
      append_only_event_store: {
        schema_version: appendOnlyEventStore.schema_version ?? null,
        append_only_event_store_id: appendOnlyEventStore.append_only_event_store_id ?? null,
        event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
        stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
        validation_error_count: appendOnlyEventStore.summary?.validation_error_count ?? appendOnlyEventStore.validation?.errors?.length ?? 0,
      },
      event_correlation_ledger: {
        schema_version: eventCorrelationLedger.schema_version ?? null,
        event_correlation_ledger_id: eventCorrelationLedger.event_correlation_ledger_id ?? null,
        event_correlation_status: eventCorrelationLedger.summary?.event_correlation_status ?? "unknown",
        correlation_trace_count: eventCorrelationLedger.summary?.correlation_trace_count ?? 0,
        run_bound_trace_count: eventCorrelationLedger.summary?.run_bound_trace_count ?? 0,
        validation_error_count: eventCorrelationLedger.summary?.validation_error_count ?? eventCorrelationLedger.validation?.errors?.length ?? 0,
      },
      runtime_agentrun_contract_freeze: {
        schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
        freeze_id: runtimeAgentRunContractFreeze.freeze_id ?? null,
        freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
        runtime_adapter_count: runtimeAgentRunContractFreeze.summary?.runtime_adapter_count ?? 0,
        agent_run_count: runtimeAgentRunContractFreeze.summary?.agent_run_count ?? 0,
        validation_error_count: runtimeAgentRunContractFreeze.summary?.validation_error_count ?? runtimeAgentRunContractFreeze.validation?.errors?.length ?? 0,
      },
    },
    tool_invocation_ledger_contract: buildToolInvocationLedgerContract(generatedAt),
    tool_invocation_catalog: {
      schema_version: "tool-invocation-catalog.v1",
      generated_at: generatedAt,
      tool_invocation_records: projection.toolInvocationRecords,
      tool_invocation_permission_decisions: projection.toolInvocationPermissionDecisions,
      tool_invocation_agent_bindings: projection.toolInvocationAgentBindings,
      tool_invocation_event_bindings: projection.toolInvocationEventBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeToolInvocationLedger({
      agentRunLedger,
      toolRuntimePolicyEnforcement,
      appendOnlyEventStore,
      eventCorrelationLedger,
      runtimeAgentRunContractFreeze,
      validationItems,
      validation,
      ...projection,
    }),
  };
  return {
    ...result,
    markdown: renderToolInvocationLedgerMarkdown(result),
  };
}

export async function writeToolInvocationLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "tool-invocation-ledger.json"), serializableToolInvocationLedger(result));
  await writeJson(path.join(outDir, "tool-invocation-records.json"), {
    schema_version: "tool-invocation-records.v1",
    generated_at: result.generated_at,
    tool_invocation_record_count: result.tool_invocation_catalog.tool_invocation_records.length,
    tool_invocation_records: result.tool_invocation_catalog.tool_invocation_records,
  });
  await writeJson(path.join(outDir, "tool-invocation-permission-decisions.json"), {
    schema_version: "tool-invocation-permission-decisions.v1",
    generated_at: result.generated_at,
    tool_invocation_permission_decision_count: result.tool_invocation_catalog.tool_invocation_permission_decisions.length,
    tool_invocation_permission_decisions: result.tool_invocation_catalog.tool_invocation_permission_decisions,
  });
  await writeJson(path.join(outDir, "tool-invocation-agent-bindings.json"), {
    schema_version: "tool-invocation-agent-bindings.v1",
    generated_at: result.generated_at,
    tool_invocation_agent_binding_count: result.tool_invocation_catalog.tool_invocation_agent_bindings.length,
    tool_invocation_agent_bindings: result.tool_invocation_catalog.tool_invocation_agent_bindings,
  });
  await writeJson(path.join(outDir, "tool-invocation-event-bindings.json"), {
    schema_version: "tool-invocation-event-bindings.v1",
    generated_at: result.generated_at,
    tool_invocation_event_binding_count: result.tool_invocation_catalog.tool_invocation_event_bindings.length,
    tool_invocation_event_bindings: result.tool_invocation_catalog.tool_invocation_event_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "tool-invocation-ledger-validation-report.v1",
    generated_at: result.generated_at,
    tool_invocation_ledger_id: result.tool_invocation_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runToolInvocationLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runToolInvocationLedger(args);
    console.log(`Tool invocation ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.tool_invocation_ledger_status}`);
    console.log(`Tool invocations: ${result.summary.tool_invocation_record_count}`);
    console.log(`Permission decisions: ${result.summary.permission_decision_count}`);
    console.log(`Agent bindings: ${result.summary.complete_agent_binding_count}/${result.summary.agent_run_binding_count}`);
    console.log(`Event bindings: ${result.summary.context_bound_event_binding_count}/${result.summary.event_binding_count}`);
    console.log(`Blocked invocations: ${result.summary.blocked_tool_invocation_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildToolInvocationLedgerContract(generatedAt) {
  return {
    schema_version: TOOL_INVOCATION_LEDGER_CONTRACT_SCHEMA_VERSION,
    generated_at: generatedAt,
    tool_invocation_ledger_contract_id: TOOL_INVOCATION_LEDGER_CONTRACT_ID,
    reference_model: "agent_run_tool_permission_projection.v1",
    required_invocation_fields: [
      "tool_invocation_id",
      "agent_run_id",
      "runtime_id",
      "tool_id",
      "tool_permission_gate_id",
      "permission_decision",
      "permission_status",
      "invocation_state",
      "execution_allowed",
    ],
    required_permission_decision_fields: [
      "tool_invocation_id",
      "tool_permission_gate_id",
      "permission_decision",
      "permission_status",
      "required_gates",
    ],
    required_agent_binding_fields: [
      "agent_run_id",
      "agent_run_tool_gate_id",
      "invocation_record_count",
      "binding_status",
    ],
    required_event_binding_fields: [
      "tool_invocation_id",
      "agent_run_id",
      "event_envelope_id",
      "stored_event_id",
      "event_context",
      "event_binding_status",
    ],
    notes: [
      "Tool invocation rows are projected from deterministic runtime tool policies and AgentRun ledger records, not from agent self-report.",
      "Forbidden tools remain visible as blocked invocation intents so protected actions can be audited.",
      "The current event model binds each tool invocation to its AgentRun event context until direct tool_invocation.* events are introduced.",
    ],
  };
}

function buildToolInvocationProjection({
  agentRunLedger,
  toolRuntimePolicyEnforcement,
  appendOnlyEventStore,
  eventCorrelationLedger,
  runtimeAgentRunContractFreeze,
  generatedAt,
}) {
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const agentRunEventBindings = agentRunLedger.agent_run_catalog?.agent_run_event_bindings ?? [];
  const toolPermissionGates = toolRuntimePolicyEnforcement.tool_runtime_policy_catalog?.tool_permission_gates ?? [];
  const agentRunToolGates = toolRuntimePolicyEnforcement.tool_runtime_policy_catalog?.agent_run_tool_gates ?? [];
  const correlationTraces = eventCorrelationLedger.event_correlation_catalog?.correlation_traces ?? [];
  const storedEvents = appendOnlyEventStore.event_store_catalog?.stored_events ?? [];
  const runtimeAdapters = runtimeAgentRunContractFreeze.runtime_agentrun_contract?.runtime_adapters ?? [];
  const agentRunToolGateByAgentRunId = new Map(agentRunToolGates.map((gate) => [gate.agent_run_id, gate]));
  const toolPermissionGatesByRuntimeId = groupBy(toolPermissionGates, "runtime_id");
  const agentRunEventsByAgentRunId = groupBy(agentRunEventBindings, "agent_run_id");
  const storedEventById = new Map(storedEvents.map((event) => [event.stored_event_id, event]));
  const correlationTraceByWorkflowRunId = new Map(correlationTraces.map((trace) => [trace.workflow_run_id, trace]));
  const runtimeAdapterByRuntimeId = new Map(runtimeAdapters.map((runtime) => [runtime.runtime_id, runtime]));

  const toolInvocationRecords = [];
  const toolInvocationPermissionDecisions = [];
  const toolInvocationAgentBindings = [];
  const toolInvocationEventBindings = [];

  for (const agentRun of agentRunRecords) {
    const agentRunToolGate = agentRunToolGateByAgentRunId.get(agentRun.agent_run_id);
    const runtimeToolPermissionGates = [...(toolPermissionGatesByRuntimeId.get(agentRun.runtime_id) ?? [])].sort(by("tool_permission_gate_id"));
    const agentRunEvents = agentRunEventsByAgentRunId.get(agentRun.agent_run_id) ?? [];
    const eventContextBinding = selectAgentRunEventContext(agentRunEvents);
    const storedEvent = eventContextBinding ? storedEventById.get(eventContextBinding.stored_event_id) : null;
    const correlationTrace = correlationTraceByWorkflowRunId.get(agentRun.workflow_run_id);
    const runtimeAdapter = runtimeAdapterByRuntimeId.get(agentRun.runtime_id);
    const bindingRecords = [];
    for (const toolGate of runtimeToolPermissionGates) {
      const record = buildToolInvocationRecord({
        agentRun,
        agentRunToolGate,
        toolGate,
        runtimeAdapter,
        correlationTrace,
        generatedAt,
      });
      const permissionDecision = buildToolInvocationPermissionDecision({
        record,
        toolGate,
        agentRunToolGate,
        generatedAt,
      });
      const eventBinding = buildToolInvocationEventBinding({
        record,
        agentRun,
        agentRunToolGate,
        eventContextBinding,
        storedEvent,
        correlationTrace,
        generatedAt,
      });
      bindingRecords.push(record);
      toolInvocationRecords.push(record);
      toolInvocationPermissionDecisions.push(permissionDecision);
      toolInvocationEventBindings.push(eventBinding);
    }
    toolInvocationAgentBindings.push(buildToolInvocationAgentBinding({
      agentRun,
      agentRunToolGate,
      runtimeAdapter,
      invocationRecords: bindingRecords,
      eventContextBinding,
      generatedAt,
    }));
  }

  return {
    toolInvocationRecords: toolInvocationRecords.sort(by("tool_invocation_id")),
    toolInvocationPermissionDecisions: toolInvocationPermissionDecisions.sort(by("tool_invocation_permission_decision_id")),
    toolInvocationAgentBindings: toolInvocationAgentBindings.sort(by("tool_invocation_agent_binding_id")),
    toolInvocationEventBindings: toolInvocationEventBindings.sort(by("tool_invocation_event_binding_id")),
  };
}

function buildToolInvocationRecord({
  agentRun,
  agentRunToolGate,
  toolGate,
  runtimeAdapter,
  correlationTrace,
  generatedAt,
}) {
  const invocationState = invocationStateForGate(toolGate);
  return {
    schema_version: TOOL_INVOCATION_RECORD_SCHEMA_VERSION,
    tool_invocation_id: `tool-invocation.${slugify(agentRun.agent_run_id)}.${slugify(toolGate.tool_id)}`,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    workflow_run_record_id: agentRun.workflow_run_record_id ?? null,
    run_ledger_id: agentRun.run_ledger_id ?? null,
    correlation_id: correlationTrace?.correlation_id ?? agentRun.correlation_id ?? agentRun.workflow_run_id,
    correlation_trace_id: correlationTrace?.correlation_trace_id ?? agentRun.correlation_trace_id ?? null,
    tenant_id: agentRun.tenant_id ?? null,
    matter_id: agentRun.matter_id ?? null,
    domain_pack: agentRun.domain_pack ?? "unknown",
    capability_id: agentRun.capability_id ?? null,
    workflow_id: agentRun.workflow_id ?? null,
    runtime_id: agentRun.runtime_id,
    adapter_id: agentRun.adapter_id ?? runtimeAdapter?.adapter_id ?? toolGate.adapter_id ?? null,
    command_binding_id: agentRun.command_binding_id ?? runtimeAdapter?.command_binding?.binding_id ?? null,
    agent_run_tool_gate_id: agentRunToolGate?.agent_run_tool_gate_id ?? null,
    tool_permission_gate_id: toolGate.tool_permission_gate_id,
    tool_id: toolGate.tool_id,
    requested_state: toolGate.requested_state,
    permission_decision: toolGate.gate_decision,
    permission_status: toolGate.gate_status,
    invocation_state: invocationState,
    execution_allowed: invocationState === "permitted",
    protected_action: Boolean(toolGate.protected_action),
    approval_required: Boolean(toolGate.approval_required || toolGate.gate_status === "requires_approval"),
    human_approval_required: Boolean(agentRunToolGate?.human_approval_required || toolGate.required_gates?.includes("human_approval_gate")),
    audit_required: true,
    tool_policy_known: Boolean(toolGate.tool_policy_known),
    allowed_by_runtime: Boolean(toolGate.allowed_by_runtime),
    forbidden_by_runtime: Boolean(toolGate.forbidden_by_runtime),
    required_gates: sortedUnique([...(toolGate.required_gates ?? []), ...(agentRunToolGate?.required_gates ?? [])]),
    reason_codes: sortedUnique([...(toolGate.reason_codes ?? []), ...(agentRunToolGate?.reason_codes ?? [])]),
    runtime_invocation_scope: "runtime_internal",
    decision_source: "tool_runtime_policy_enforcement",
    ledger_source: "agent_run_ledger",
    recorded_at: generatedAt,
  };
}

function buildToolInvocationPermissionDecision({
  record,
  toolGate,
  agentRunToolGate,
  generatedAt,
}) {
  return {
    schema_version: TOOL_INVOCATION_PERMISSION_DECISION_SCHEMA_VERSION,
    tool_invocation_permission_decision_id: `tool-invocation-permission-decision.${slugify(record.tool_invocation_id)}`,
    tool_invocation_id: record.tool_invocation_id,
    agent_run_id: record.agent_run_id,
    workflow_run_id: record.workflow_run_id,
    runtime_id: record.runtime_id,
    adapter_id: record.adapter_id,
    tool_id: record.tool_id,
    tool_permission_gate_id: toolGate.tool_permission_gate_id,
    agent_run_tool_gate_id: agentRunToolGate?.agent_run_tool_gate_id ?? null,
    requested_state: toolGate.requested_state,
    permission_decision: toolGate.gate_decision,
    permission_status: toolGate.gate_status,
    invocation_state: record.invocation_state,
    execution_allowed: record.execution_allowed,
    protected_action: record.protected_action,
    approval_required: record.approval_required,
    human_approval_required: record.human_approval_required,
    required_gates: record.required_gates,
    reason_codes: record.reason_codes,
    decided_at: toolGate.decided_at ?? generatedAt,
    recorded_at: generatedAt,
  };
}

function buildToolInvocationAgentBinding({
  agentRun,
  agentRunToolGate,
  runtimeAdapter,
  invocationRecords,
  eventContextBinding,
  generatedAt,
}) {
  const permittedCount = invocationRecords.filter((record) => record.invocation_state === "permitted").length;
  const blockedCount = invocationRecords.filter((record) => record.invocation_state === "blocked").length;
  const approvalCount = invocationRecords.filter((record) => record.invocation_state === "requires_approval").length;
  const bindingStatus = agentRunToolGate && invocationRecords.length > 0 && eventContextBinding
    ? "complete"
    : "partial";
  return {
    schema_version: TOOL_INVOCATION_AGENT_BINDING_SCHEMA_VERSION,
    tool_invocation_agent_binding_id: `tool-invocation-agent-binding.${slugify(agentRun.agent_run_id)}`,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    workflow_run_record_id: agentRun.workflow_run_record_id ?? null,
    run_ledger_id: agentRun.run_ledger_id ?? null,
    runtime_id: agentRun.runtime_id,
    adapter_id: agentRun.adapter_id ?? runtimeAdapter?.adapter_id ?? null,
    command_binding_id: agentRun.command_binding_id ?? runtimeAdapter?.command_binding?.binding_id ?? null,
    capability_id: agentRun.capability_id ?? null,
    domain_pack: agentRun.domain_pack ?? "unknown",
    agent_run_tool_gate_id: agentRunToolGate?.agent_run_tool_gate_id ?? null,
    agent_gate_decision: agentRunToolGate?.gate_decision ?? "missing",
    agent_gate_status: agentRunToolGate?.gate_status ?? "missing",
    runtime_allowed_by_capability: Boolean(agentRunToolGate?.runtime_allowed_by_capability),
    requested_tool_count: agentRunToolGate?.requested_tool_count ?? invocationRecords.filter((record) => record.requested_state === "allowed").length,
    allowed_tool_count: agentRunToolGate?.allowed_tool_count ?? invocationRecords.filter((record) => record.requested_state === "allowed").length,
    forbidden_tool_count: agentRunToolGate?.forbidden_tool_count ?? invocationRecords.filter((record) => record.requested_state === "forbidden").length,
    invocation_record_count: invocationRecords.length,
    permitted_invocation_count: permittedCount,
    blocked_invocation_count: blockedCount,
    approval_required_invocation_count: approvalCount,
    protected_action_invocation_count: invocationRecords.filter((record) => record.protected_action).length,
    audit_required: true,
    human_approval_required: Boolean(agentRunToolGate?.human_approval_required || invocationRecords.some((record) => record.human_approval_required)),
    event_context_binding_id: eventContextBinding?.agent_run_event_binding_id ?? null,
    event_binding_status: eventContextBinding ? "context_bound" : "missing_agent_run_event",
    binding_status: bindingStatus,
    recorded_at: generatedAt,
  };
}

function buildToolInvocationEventBinding({
  record,
  agentRun,
  agentRunToolGate,
  eventContextBinding,
  storedEvent,
  correlationTrace,
  generatedAt,
}) {
  const eventContext = eventContextBinding?.event_effect === "agent_state_completed"
    ? "agent_run_completed"
    : eventContextBinding?.event_effect === "agent_state_started"
      ? "agent_run_started"
      : "missing_agent_run_event";
  return {
    schema_version: TOOL_INVOCATION_EVENT_BINDING_SCHEMA_VERSION,
    tool_invocation_event_binding_id: `tool-invocation-event-binding.${slugify(record.tool_invocation_id)}`,
    tool_invocation_id: record.tool_invocation_id,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    workflow_run_record_id: agentRun.workflow_run_record_id ?? null,
    run_ledger_id: agentRun.run_ledger_id ?? storedEvent?.run_ledger_id ?? null,
    correlation_id: correlationTrace?.correlation_id ?? agentRun.correlation_id ?? storedEvent?.correlation_id ?? null,
    correlation_trace_id: correlationTrace?.correlation_trace_id ?? agentRun.correlation_trace_id ?? null,
    agent_run_tool_gate_id: agentRunToolGate?.agent_run_tool_gate_id ?? null,
    tool_permission_gate_id: record.tool_permission_gate_id,
    tool_id: record.tool_id,
    permission_decision: record.permission_decision,
    invocation_state: record.invocation_state,
    event_envelope_id: eventContextBinding?.event_envelope_id ?? null,
    stored_event_id: eventContextBinding?.stored_event_id ?? null,
    event_type: eventContextBinding?.event_type ?? null,
    event_family: eventContextBinding?.event_family ?? null,
    event_time: eventContextBinding?.event_time ?? null,
    global_sequence: eventContextBinding?.global_sequence ?? null,
    stream_sequence: eventContextBinding?.stream_sequence ?? null,
    actor_type: eventContextBinding?.actor_type ?? storedEvent?.actor_type ?? null,
    actor_id: eventContextBinding?.actor_id ?? storedEvent?.actor_id ?? null,
    event_context: eventContext,
    direct_tool_event: false,
    event_binding_status: eventContextBinding ? "context_bound" : "missing_agent_run_event",
    recorded_at: generatedAt,
  };
}

function selectAgentRunEventContext(agentRunEvents) {
  const sortedEvents = [...agentRunEvents].sort((left, right) => {
    const timeCompare = String(left.event_time ?? "").localeCompare(String(right.event_time ?? ""));
    if (timeCompare !== 0) return timeCompare;
    return (left.global_sequence ?? 0) - (right.global_sequence ?? 0);
  });
  return sortedEvents.find((event) => event.event_effect === "agent_state_completed")
    ?? sortedEvents.find((event) => event.event_effect === "agent_state_started")
    ?? sortedEvents[0]
    ?? null;
}

function invocationStateForGate(toolGate) {
  if (toolGate.gate_status === "blocked" || toolGate.gate_decision === "deny") return "blocked";
  if (toolGate.gate_status === "requires_approval" || toolGate.gate_decision === "review") return "requires_approval";
  return "permitted";
}

function validateToolInvocationLedger({
  agentRunLedger,
  toolRuntimePolicyEnforcement,
  appendOnlyEventStore,
  eventCorrelationLedger,
  runtimeAgentRunContractFreeze,
  packageJson,
  roadmapText,
  toolInvocationRecords,
  toolInvocationPermissionDecisions,
  toolInvocationAgentBindings,
  toolInvocationEventBindings,
}) {
  const items = [];
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const toolPermissionGates = toolRuntimePolicyEnforcement.tool_runtime_policy_catalog?.tool_permission_gates ?? [];
  const agentRunToolGates = toolRuntimePolicyEnforcement.tool_runtime_policy_catalog?.agent_run_tool_gates ?? [];
  const toolGatesByRuntimeId = groupBy(toolPermissionGates, "runtime_id");
  const expectedInvocationCount = agentRunRecords.reduce((sum, record) => sum + (toolGatesByRuntimeId.get(record.runtime_id)?.length ?? 0), 0);
  const decisionByInvocationId = new Map(toolInvocationPermissionDecisions.map((decision) => [decision.tool_invocation_id, decision]));
  const eventBindingByInvocationId = new Map(toolInvocationEventBindings.map((binding) => [binding.tool_invocation_id, binding]));

  addValidation(items, {
    path: "source.agent_run_ledger",
    check_id: "source_agent_run_ledger_complete",
    passed: agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunLedger.validation?.valid !== false,
    message: agentRunLedger.summary?.agent_run_ledger_status === "complete"
      ? "Agent run ledger is complete."
      : "Agent run ledger must be complete before tool invocation projection.",
  });
  addValidation(items, {
    path: "source.tool_runtime_policy_enforcement",
    check_id: "source_tool_runtime_policy_complete",
    passed: toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status === "complete" && toolRuntimePolicyEnforcement.validation?.valid !== false,
    message: toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status === "complete"
      ? "Tool/runtime policy enforcement is complete."
      : "Tool/runtime policy enforcement must be complete before tool invocation projection.",
  });
  addValidation(items, {
    path: "source.append_only_event_store",
    check_id: "source_append_only_event_store_complete",
    passed: appendOnlyEventStore.summary?.event_store_status === "complete" && appendOnlyEventStore.validation?.valid !== false,
    message: appendOnlyEventStore.summary?.event_store_status === "complete"
      ? "Append-only event store is complete."
      : "Append-only event store must be complete before tool invocation projection.",
  });
  addValidation(items, {
    path: "source.event_correlation_ledger",
    check_id: "source_event_correlation_complete",
    passed: eventCorrelationLedger.summary?.event_correlation_status === "complete" && eventCorrelationLedger.validation?.valid !== false,
    message: eventCorrelationLedger.summary?.event_correlation_status === "complete"
      ? "Event correlation ledger is complete."
      : "Event correlation ledger must be complete before tool invocation projection.",
  });
  addValidation(items, {
    path: "source.runtime_agentrun_contract_freeze",
    check_id: "source_runtime_agentrun_contract_complete",
    passed: runtimeAgentRunContractFreeze.summary?.freeze_status === "complete" && runtimeAgentRunContractFreeze.validation?.valid !== false,
    message: runtimeAgentRunContractFreeze.summary?.freeze_status === "complete"
      ? "Runtime/AgentRun contract freeze is complete."
      : "Runtime/AgentRun contract freeze must be complete before tool invocation projection.",
  });
  addValidation(items, {
    path: "tool_invocation_catalog.tool_invocation_records",
    check_id: "tool_invocations_projected",
    passed: toolInvocationRecords.length === expectedInvocationCount && toolInvocationRecords.length > 0,
    message: `${toolInvocationRecords.length}/${expectedInvocationCount} AgentRun runtime tool invocation row(s) projected.`,
  });
  addValidation(items, {
    path: "tool_invocation_catalog.tool_invocation_permission_decisions",
    check_id: "permission_decisions_projected",
    passed: toolInvocationPermissionDecisions.length === toolInvocationRecords.length && toolInvocationRecords.every((record) => decisionByInvocationId.has(record.tool_invocation_id)),
    message: `${toolInvocationPermissionDecisions.length}/${toolInvocationRecords.length} tool invocation permission decision row(s) projected.`,
  });
  addValidation(items, {
    path: "tool_invocation_catalog.tool_invocation_agent_bindings",
    check_id: "agent_run_bindings_complete",
    passed: toolInvocationAgentBindings.length === agentRunRecords.length && toolInvocationAgentBindings.every((binding) => binding.binding_status === "complete"),
    message: `${toolInvocationAgentBindings.filter((binding) => binding.binding_status === "complete").length}/${agentRunRecords.length} AgentRun tool invocation binding row(s) are complete.`,
  });
  addValidation(items, {
    path: "tool_invocation_catalog.tool_invocation_event_bindings",
    check_id: "tool_invocations_bound_to_agent_events",
    passed: toolInvocationEventBindings.length === toolInvocationRecords.length && toolInvocationRecords.every((record) => eventBindingByInvocationId.get(record.tool_invocation_id)?.event_binding_status === "context_bound"),
    message: `${toolInvocationEventBindings.filter((binding) => binding.event_binding_status === "context_bound").length}/${toolInvocationRecords.length} tool invocation row(s) are bound to AgentRun event context.`,
  });
  addValidation(items, {
    path: "tool_invocation_catalog.tool_invocation_records.permission",
    check_id: "forbidden_invocations_blocked",
    passed: toolInvocationRecords.every((record) => !record.forbidden_by_runtime || record.invocation_state === "blocked"),
    message: `${toolInvocationRecords.filter((record) => record.forbidden_by_runtime && record.invocation_state === "blocked").length}/${toolInvocationRecords.filter((record) => record.forbidden_by_runtime).length} forbidden runtime tool invocation row(s) are blocked.`,
  });
  addValidation(items, {
    path: "tool_invocation_catalog.tool_invocation_records.agent_run_tool_gate_id",
    check_id: "agent_run_tool_gates_bound",
    passed: toolInvocationRecords.every((record) => record.agent_run_tool_gate_id) && toolInvocationAgentBindings.every((binding) => binding.agent_run_tool_gate_id),
    message: `${toolInvocationAgentBindings.filter((binding) => binding.agent_run_tool_gate_id).length}/${agentRunToolGates.length} AgentRun tool gates bound to invocation ledger.`,
  });
  addValidation(items, {
    path: "tool_invocation_catalog.tool_invocation_records.tool_permission_gate_id",
    check_id: "tool_permission_gates_bound",
    passed: toolInvocationRecords.every((record) => record.tool_permission_gate_id),
    message: `${toolInvocationRecords.filter((record) => record.tool_permission_gate_id).length}/${toolInvocationRecords.length} tool invocation row(s) reference tool permission gates.`,
  });
  addValidation(items, {
    path: "package.scripts.events:tool-invocations",
    check_id: "package_script_registered",
    passed: Boolean(packageJson.scripts?.["events:tool-invocations"]),
    message: packageJson.scripts?.["events:tool-invocations"]
      ? "package.json registers events:tool-invocations."
      : "package.json must register events:tool-invocations.",
  });
  addValidation(items, {
    path: "docs.implementation_roadmap.phase_165",
    check_id: "roadmap_phase_165_recorded",
    passed: String(roadmapText).includes("## Phase 165: Tool Invocation Ledger") || String(roadmapText).includes("| P165 | tool invocation ledger 구현 |"),
    message: "Roadmap must record Phase 165 completion or planned slot.",
  });
  return items;
}

function summarizeToolInvocationLedger({
  agentRunLedger,
  toolRuntimePolicyEnforcement,
  appendOnlyEventStore,
  eventCorrelationLedger,
  runtimeAgentRunContractFreeze,
  toolInvocationRecords,
  toolInvocationPermissionDecisions,
  toolInvocationAgentBindings,
  toolInvocationEventBindings,
  validationItems,
  validation,
}) {
  const forbiddenRecords = toolInvocationRecords.filter((record) => record.forbidden_by_runtime);
  const allowedRecords = toolInvocationRecords.filter((record) => record.allowed_by_runtime);
  const blockedRecords = toolInvocationRecords.filter((record) => record.invocation_state === "blocked");
  return {
    tool_invocation_ledger_status: validation.valid ? "complete" : "blocked",
    tool_invocation_ledger_contract_id: TOOL_INVOCATION_LEDGER_CONTRACT_ID,
    source_agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    source_agent_run_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    source_tool_runtime_policy_status: toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
    source_tool_permission_gate_count: toolRuntimePolicyEnforcement.summary?.tool_permission_gate_count ?? 0,
    source_agent_run_tool_gate_count: toolRuntimePolicyEnforcement.summary?.agent_run_tool_gate_count ?? 0,
    source_event_store_status: appendOnlyEventStore.summary?.event_store_status ?? "unknown",
    source_stored_event_count: appendOnlyEventStore.summary?.stored_event_count ?? 0,
    source_event_correlation_status: eventCorrelationLedger.summary?.event_correlation_status ?? "unknown",
    source_run_bound_trace_count: eventCorrelationLedger.summary?.run_bound_trace_count ?? 0,
    source_runtime_agentrun_contract_freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
    tool_invocation_record_count: toolInvocationRecords.length,
    permission_decision_count: toolInvocationPermissionDecisions.length,
    agent_run_binding_count: toolInvocationAgentBindings.length,
    complete_agent_binding_count: toolInvocationAgentBindings.filter((binding) => binding.binding_status === "complete").length,
    event_binding_count: toolInvocationEventBindings.length,
    context_bound_event_binding_count: toolInvocationEventBindings.filter((binding) => binding.event_binding_status === "context_bound").length,
    permitted_tool_invocation_count: toolInvocationRecords.filter((record) => record.invocation_state === "permitted").length,
    review_tool_invocation_count: toolInvocationRecords.filter((record) => record.invocation_state === "requires_approval").length,
    blocked_tool_invocation_count: blockedRecords.length,
    allowed_tool_invocation_count: allowedRecords.length,
    forbidden_tool_invocation_count: forbiddenRecords.length,
    denied_tool_invocation_count: toolInvocationRecords.filter((record) => record.permission_decision === "deny").length,
    approval_required_tool_invocation_count: toolInvocationRecords.filter((record) => record.approval_required || record.human_approval_required).length,
    protected_action_tool_invocation_count: toolInvocationRecords.filter((record) => record.protected_action).length,
    execution_allowed_invocation_count: toolInvocationRecords.filter((record) => record.execution_allowed).length,
    missing_permission_decision_count: toolInvocationRecords.length - toolInvocationPermissionDecisions.length,
    missing_agent_run_tool_gate_count: toolInvocationRecords.filter((record) => !record.agent_run_tool_gate_id).length,
    missing_event_binding_count: toolInvocationEventBindings.filter((binding) => binding.event_binding_status !== "context_bound").length,
    unknown_tool_count: toolInvocationRecords.filter((record) => !record.tool_policy_known).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(toolInvocationRecords, "runtime_id"),
    by_tool_id: countBy(toolInvocationRecords, "tool_id"),
    by_permission_decision: countBy(toolInvocationRecords, "permission_decision"),
    by_permission_status: countBy(toolInvocationRecords, "permission_status"),
    by_invocation_state: countBy(toolInvocationRecords, "invocation_state"),
    by_agent_binding_status: countBy(toolInvocationAgentBindings, "binding_status"),
    by_event_binding_status: countBy(toolInvocationEventBindings, "event_binding_status"),
  };
}

function renderToolInvocationLedgerMarkdown(result) {
  const lines = [];
  lines.push("# Tool Invocation Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Ledger ID: ${result.tool_invocation_ledger_id}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Status: ${result.summary.tool_invocation_ledger_status}`);
  lines.push(`- Contract: ${result.summary.tool_invocation_ledger_contract_id}`);
  lines.push(`- Tool invocation records: ${result.summary.tool_invocation_record_count}`);
  lines.push(`- Permission decisions: ${result.summary.permission_decision_count}`);
  lines.push(`- Agent bindings: ${result.summary.complete_agent_binding_count}/${result.summary.agent_run_binding_count}`);
  lines.push(`- Event context bindings: ${result.summary.context_bound_event_binding_count}/${result.summary.event_binding_count}`);
  lines.push(`- Permitted invocations: ${result.summary.permitted_tool_invocation_count}`);
  lines.push(`- Blocked invocations: ${result.summary.blocked_tool_invocation_count}`);
  lines.push(`- Protected-action invocations: ${result.summary.protected_action_tool_invocation_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Contract Notes");
  lines.push("");
  lines.push("- Tool invocation rows are derived from policy gates plus AgentRun ledger rows.");
  lines.push("- Forbidden runtime tools stay in the ledger as blocked protected-action attempts.");
  lines.push("- Event bindings intentionally use AgentRun event context until direct tool invocation events exist.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_TOOL_INVOCATION_LEDGER_INPUTS;
  return {
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? defaults.agentRunLedgerPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? defaults.toolRuntimePolicyEnforcementPath),
    append_only_event_store_path: path.resolve(options.appendOnlyEventStorePath ?? defaults.appendOnlyEventStorePath),
    event_correlation_ledger_path: path.resolve(options.eventCorrelationLedgerPath ?? defaults.eventCorrelationLedgerPath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? defaults.runtimeAgentRunContractFreezePath),
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

function serializableToolInvocationLedger(result) {
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

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key];
    if (!value) return groups;
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
    return groups;
  }, new Map());
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

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 180) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_TOOL_INVOCATION_LEDGER_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--tool-runtime-policy-enforcement") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--append-only-event-store") parsed.appendOnlyEventStorePath = argv[++index];
    else if (arg === "--event-correlation-ledger") parsed.eventCorrelationLedgerPath = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/tool-invocation-ledger.mjs [options]

Project runtime tool permission gates into auditable AgentRun tool invocation rows.

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                   Build without writing artifacts.
  --out-dir, --out <path>                     Output directory.
  --run-at <iso>                              Override generated_at timestamp.
  --agent-run-ledger <path>                   agent-run-ledger.json path.
  --tool-runtime-policy-enforcement <path>    tool-runtime-policy-enforcement.json path.
  --append-only-event-store <path>            append-only-event-store.json path.
  --event-correlation-ledger <path>           event-correlation-ledger.json path.
  --runtime-agentrun-contract-freeze <path>   runtime-agentrun-contract-freeze.json path.
  --package <path>                            package.json path.
  --roadmap <path>                            implementation roadmap path.
`);
}
