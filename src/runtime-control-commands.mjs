import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_CONTROL_COMMANDS_OUT_DIR = "artifacts/runtime-control-commands/latest";
export const DEFAULT_RUNTIME_CONTROL_COMMANDS_INPUTS = {
  runtimeTimeoutHeartbeatPath: "artifacts/runtime-timeout-heartbeat/latest/runtime-timeout-heartbeat.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  workflowResumeCancelContractPath: "artifacts/workflow-resume-cancel/latest/workflow-resume-cancel-contract.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const CONTROL_COMMAND_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "runtime_timeout_heartbeat_agent_run_ledger_and_audit_event_ledger";
const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";

export async function runRuntimeControlCommands(options = {}) {
  const result = await buildRuntimeControlCommands(options);
  if (options.write !== false) await writeRuntimeControlCommands(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime control commands validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeControlCommands(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_CONTROL_COMMANDS_OUT_DIR);
  const inputs = normalizeInputs(options);
  const runtimeTimeoutHeartbeat = await readJson(inputs.runtime_timeout_heartbeat_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const auditEventLedger = await readJson(inputs.audit_event_ledger_path);
  const workflowResumeCancelContract = await readJson(inputs.workflow_resume_cancel_contract_path);
  const gateApprovalContractFreeze = await readJson(inputs.gate_approval_contract_freeze_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");
  const projection = projectRuntimeControlCommands({
    runtimeTimeoutHeartbeat,
    agentRunLedger,
    auditEventLedger,
    workflowResumeCancelContract,
    gateApprovalContractFreeze,
    generatedAt,
  });
  const validationItems = validateRuntimeControlCommands({
    runtimeTimeoutHeartbeat,
    agentRunLedger,
    auditEventLedger,
    workflowResumeCancelContract,
    gateApprovalContractFreeze,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "runtime-control-commands.v1",
    generated_at: generatedAt,
    runtime_control_commands_id: `runtime-control-commands.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeTimeoutHeartbeat,
      agentRunLedger,
      auditEventLedger,
      workflowResumeCancelContract,
      gateApprovalContractFreeze,
      desktopCompanionIntegration,
    }),
    runtime_control_command_contract: buildRuntimeControlCommandContract(generatedAt),
    runtime_control_command_requests: projection.runtimeControlCommandRequests,
    runtime_control_command_results: projection.runtimeControlCommandResults,
    runtime_control_audit_bindings: projection.runtimeControlAuditBindings,
    runtime_control_desktop_boundary: projection.runtimeControlDesktopBoundary,
    summary: summarizeRuntimeControlCommands(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderRuntimeControlCommandsMarkdown(result),
  };
}

export async function writeRuntimeControlCommands(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "runtime-control-commands.json"), serializableRuntimeControlCommands(result));
  await writeJson(path.join(outDir, "runtime-control-command-requests.json"), {
    schema_version: "runtime-control-command-requests.v1",
    generated_at: result.generated_at,
    runtime_control_command_request_count: result.runtime_control_command_requests.length,
    runtime_control_command_requests: result.runtime_control_command_requests,
  });
  await writeJson(path.join(outDir, "runtime-control-command-results.json"), {
    schema_version: "runtime-control-command-results.v1",
    generated_at: result.generated_at,
    runtime_control_command_result_count: result.runtime_control_command_results.length,
    runtime_control_command_results: result.runtime_control_command_results,
  });
  await writeJson(path.join(outDir, "runtime-control-audit-bindings.json"), {
    schema_version: "runtime-control-audit-bindings.v1",
    generated_at: result.generated_at,
    runtime_control_audit_binding_count: result.runtime_control_audit_bindings.length,
    runtime_control_audit_bindings: result.runtime_control_audit_bindings,
  });
  await writeJson(path.join(outDir, "runtime-control-desktop-boundary.json"), result.runtime_control_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "runtime-control-commands-validation-report.v1",
    generated_at: result.generated_at,
    runtime_control_commands_id: result.runtime_control_commands_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeControlCommandsCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRuntimeControlCommands(args);
    console.log(`Runtime control commands written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.runtime_control_command_status}`);
    console.log(`Requests: ${result.summary.control_command_request_count}`);
    console.log(`Results: ${result.summary.command_result_count}`);
    console.log(`Audit bindings: ${result.summary.audit_binding_count}`);
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
    runtime_timeout_heartbeat_path: path.resolve(options.runtimeTimeoutHeartbeatPath ?? DEFAULT_RUNTIME_CONTROL_COMMANDS_INPUTS.runtimeTimeoutHeartbeatPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_RUNTIME_CONTROL_COMMANDS_INPUTS.agentRunLedgerPath),
    audit_event_ledger_path: path.resolve(options.auditEventLedgerPath ?? DEFAULT_RUNTIME_CONTROL_COMMANDS_INPUTS.auditEventLedgerPath),
    workflow_resume_cancel_contract_path: path.resolve(options.workflowResumeCancelContractPath ?? DEFAULT_RUNTIME_CONTROL_COMMANDS_INPUTS.workflowResumeCancelContractPath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? DEFAULT_RUNTIME_CONTROL_COMMANDS_INPUTS.gateApprovalContractFreezePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_RUNTIME_CONTROL_COMMANDS_INPUTS.desktopCompanionIntegrationPath),
  };
}

function projectRuntimeControlCommands({
  runtimeTimeoutHeartbeat,
  agentRunLedger,
  auditEventLedger,
  workflowResumeCancelContract,
  gateApprovalContractFreeze,
  generatedAt,
}) {
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const heartbeatsByAgentRunId = new Map((runtimeTimeoutHeartbeat.runtime_heartbeat_records ?? []).map((record) => [record.agent_run_id, record]));
  const timeoutsByAgentRunId = new Map((runtimeTimeoutHeartbeat.runtime_timeout_records ?? []).map((record) => [record.agent_run_id, record]));
  const lifecycleBindingsByAgentRunId = new Map((runtimeTimeoutHeartbeat.runtime_lifecycle_ledger_bindings ?? []).map((binding) => [binding.agent_run_id, binding]));
  const workflowDecisionCount = workflowResumeCancelContract.summary?.resume_cancel_decision_count ?? 0;
  const pendingApprovalCount = gateApprovalContractFreeze.summary?.pending_approval_request_count ?? 0;
  const auditTrailCount = auditEventLedger.summary?.audit_trail_record_count ?? auditEventLedger.audit_event_catalog?.audit_trail_records?.length ?? 0;

  const runtimeControlCommandRequests = agentRunRecords.flatMap((agentRun) => {
    const heartbeat = heartbeatsByAgentRunId.get(agentRun.agent_run_id) ?? {};
    const timeout = timeoutsByAgentRunId.get(agentRun.agent_run_id) ?? {};
    const lifecycleBinding = lifecycleBindingsByAgentRunId.get(agentRun.agent_run_id) ?? {};
    return ["cancel", "resume"].map((controlCommandKind) => {
      const terminalState = isTerminalStatus(agentRun.status);
      const lifecycleAllowed = controlCommandKind === "cancel"
        ? heartbeat.cancellable === true || agentRun.lifecycle_policy?.cancellable === true
        : heartbeat.resumable === true || agentRun.lifecycle_policy?.resumable === true;
      return {
        schema_version: "runtime-control-command-request.v1",
        runtime_control_command_request_id: `runtime-control-request.${controlCommandKind}.${slugify(agentRun.agent_run_id)}`,
        control_command_authority: CONTROL_COMMAND_AUTHORITY,
        control_command_kind: controlCommandKind,
        request_status: "recorded_pending_human_gate",
        source_of_truth: SOURCE_OF_TRUTH,
        agent_run_id: agentRun.agent_run_id,
        agent_run_record_id: agentRun.agent_run_record_id,
        workflow_run_id: agentRun.workflow_run_id,
        workflow_run_record_id: agentRun.workflow_run_record_id,
        run_ledger_id: agentRun.run_ledger_id,
        runtime_id: agentRun.runtime_id,
        adapter_id: agentRun.adapter_id,
        tenant_id: agentRun.tenant_id,
        matter_id: agentRun.matter_id,
        domain_pack: agentRun.domain_pack,
        capability_id: agentRun.capability_id,
        current_agent_run_status: agentRun.status,
        current_agent_run_terminal: terminalState,
        lifecycle_cancellable: heartbeat.cancellable === true || agentRun.lifecycle_policy?.cancellable === true,
        lifecycle_resumable: heartbeat.resumable === true || agentRun.lifecycle_policy?.resumable === true,
        lifecycle_allows_requested_command: lifecycleAllowed,
        runtime_heartbeat_record_id: heartbeat.runtime_heartbeat_record_id ?? null,
        runtime_timeout_record_id: timeout.runtime_timeout_record_id ?? null,
        runtime_lifecycle_ledger_binding_id: lifecycleBinding.runtime_lifecycle_ledger_binding_id ?? null,
        runtime_log_id: agentRun.runtime_log_id ?? heartbeat.runtime_log_id ?? null,
        normalized_log_id: heartbeat.normalized_log_id ?? null,
        observability_trace_id: lifecycleBinding.observability_trace_id ?? heartbeat.observability_trace_id ?? null,
        correlation_trace_id: agentRun.correlation_trace_id ?? lifecycleBinding.correlation_trace_id ?? heartbeat.correlation_trace_id ?? null,
        terminal_state_guard: terminalState,
        protected_control_request: true,
        human_gate_required: true,
        approval_request_required: true,
        audit_event_append_required: true,
        run_ledger_append_required: true,
        command_execution_allowed: false,
        runtime_process_control_allowed: false,
        auto_control_allowed: false,
        protected_action_execution_allowed: false,
        desktop_request_mode: "receipt_draft_only",
        desktop_origin_allowed: "protected_action_request_only",
        workflow_resume_cancel_decision_count: workflowDecisionCount,
        pending_approval_request_count: pendingApprovalCount,
        source_audit_trail_record_count: auditTrailCount,
        request_hash: sha256(JSON.stringify({
          controlCommandKind,
          agent_run_id: agentRun.agent_run_id,
          workflow_run_id: agentRun.workflow_run_id,
          run_ledger_id: agentRun.run_ledger_id,
          status: agentRun.status,
        })),
        requested_at: generatedAt,
        recorded_at: generatedAt,
      };
    });
  });

  const runtimeControlCommandResults = runtimeControlCommandRequests.map((request) => {
    const resultStatus = request.current_agent_run_terminal ? "not_executed_terminal_state" : "held_for_human_gate";
    return {
      schema_version: "runtime-control-command-result.v1",
      runtime_control_command_result_id: `runtime-control-result.${request.control_command_kind}.${slugify(request.agent_run_id)}`,
      runtime_control_command_request_id: request.runtime_control_command_request_id,
      control_command_authority: CONTROL_COMMAND_AUTHORITY,
      control_command_kind: request.control_command_kind,
      result_status: resultStatus,
      result_reason: request.current_agent_run_terminal
        ? "agent_run_already_terminal_control_command_recorded_for_audit"
        : "protected_runtime_control_requires_human_gate",
      source_of_truth: SOURCE_OF_TRUTH,
      agent_run_id: request.agent_run_id,
      agent_run_record_id: request.agent_run_record_id,
      workflow_run_id: request.workflow_run_id,
      workflow_run_record_id: request.workflow_run_record_id,
      run_ledger_id: request.run_ledger_id,
      runtime_id: request.runtime_id,
      adapter_id: request.adapter_id,
      tenant_id: request.tenant_id,
      matter_id: request.matter_id,
      domain_pack: request.domain_pack,
      capability_id: request.capability_id,
      correlation_trace_id: request.correlation_trace_id,
      current_agent_run_status: request.current_agent_run_status,
      current_agent_run_terminal: request.current_agent_run_terminal,
      lifecycle_allows_requested_command: request.lifecycle_allows_requested_command,
      terminal_state_guard: request.terminal_state_guard,
      command_execution_allowed: false,
      execution_performed: false,
      runtime_process_control_allowed: false,
      protected_action_executed: false,
      auto_control_allowed: false,
      new_run_created: false,
      run_ledger_append_required: true,
      run_ledger_append_mode: "append_only_control_receipt",
      audit_event_append_required: true,
      audit_recorded: true,
      human_review_required: true,
      desktop_mutation_execution_allowed: false,
      desktop_source_of_truth: false,
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      request_hash: request.request_hash,
      result_hash: sha256(JSON.stringify({
        request_id: request.runtime_control_command_request_id,
        result_status: resultStatus,
        execution_performed: false,
      })),
      recorded_at: generatedAt,
    };
  });

  const runtimeControlAuditBindings = runtimeControlCommandResults.map((result) => ({
    schema_version: "runtime-control-audit-binding.v1",
    runtime_control_audit_binding_id: `runtime-control-audit-binding.${result.control_command_kind}.${slugify(result.agent_run_id)}`,
    audit_binding_status: "recorded",
    audit_record_status: "recorded_in_runtime_control_audit_binding",
    audit_record_kind: "runtime_control_command_result",
    audit_domain: "runtime",
    audit_type: `runtime.${result.control_command_kind}.requested`,
    audit_severity: result.current_agent_run_terminal ? "medium" : "high",
    source_of_truth: SOURCE_OF_TRUTH,
    source_audit_event_ledger_status: auditEventLedger.summary?.audit_event_ledger_status ?? "unknown",
    runtime_control_command_request_id: result.runtime_control_command_request_id,
    runtime_control_command_result_id: result.runtime_control_command_result_id,
    agent_run_id: result.agent_run_id,
    agent_run_record_id: result.agent_run_record_id,
    workflow_run_id: result.workflow_run_id,
    workflow_run_record_id: result.workflow_run_record_id,
    run_ledger_id: result.run_ledger_id,
    runtime_id: result.runtime_id,
    adapter_id: result.adapter_id,
    tenant_id: result.tenant_id,
    matter_id: result.matter_id,
    domain_pack: result.domain_pack,
    correlation_trace_id: result.correlation_trace_id ?? null,
    protected_action_event: true,
    protected_action_executed: false,
    external_execution: false,
    requires_human_review: true,
    command_execution_allowed: false,
    execution_performed: false,
    audit_event_append_required: true,
    audit_append_status: "append_only_receipt_recorded",
    event_store_binding_status: "source_projection_only",
    separation_status: "separate_from_observability",
    desktop_source_of_truth: false,
    recorded_at: generatedAt,
  }));

  const runtimeControlDesktopBoundary = {
    schema_version: "runtime-control-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "runtime-control-commands.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "runtime_control_commands",
    desktop_surface_policy: "read_only_status_with_protected_request_drafts",
    source_of_truth: CONTROL_COMMAND_AUTHORITY,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: true,
    protected_mutation_execution_allowed: false,
    command_execution_allowed: false,
    cancel_allowed: false,
    resume_allowed: false,
    runtime_process_control_allowed: false,
    runtime_start_allowed: false,
    process_signal_allowed: false,
    installer_or_gateway_control: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
    allowed_operator_actions: ["view_control_requests", "view_control_results", "view_audit_bindings", "draft_protected_control_request"],
    denied_operator_actions: ["execute_cancel", "execute_resume", "send_process_signal", "start_runtime", "bypass_human_gate", "edit_audit_result"],
    runtime_control_command_request_count: runtimeControlCommandRequests.length,
    runtime_control_command_result_count: runtimeControlCommandResults.length,
    runtime_control_audit_binding_count: runtimeControlAuditBindings.length,
  };

  return {
    runtimeControlCommandRequests,
    runtimeControlCommandResults,
    runtimeControlAuditBindings,
    runtimeControlDesktopBoundary,
  };
}

function buildRuntimeControlCommandContract(generatedAt) {
  return {
    schema_version: "runtime-control-command-contract.v1",
    generated_at: generatedAt,
    control_command_contract_id: "runtime-control-commands.default",
    contract_status: "locked",
    control_command_authority: CONTROL_COMMAND_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    cancel_request_required: true,
    resume_request_required: true,
    command_result_required: true,
    audit_binding_required: true,
    run_ledger_append_required: true,
    terminal_state_guard_required: true,
    protected_control_request_required: true,
    human_gate_required: true,
    runtime_self_report_trusted: false,
    desktop_surface_policy: "read_only_status_with_protected_request_drafts",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: true,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    cancel_allowed: false,
    resume_allowed: false,
    runtime_process_control_allowed: false,
    command_execution_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
  };
}

function buildSourceContracts({
  runtimeTimeoutHeartbeat,
  agentRunLedger,
  auditEventLedger,
  workflowResumeCancelContract,
  gateApprovalContractFreeze,
  desktopCompanionIntegration,
}) {
  return {
    runtime_timeout_heartbeat: {
      schema_version: runtimeTimeoutHeartbeat.schema_version ?? null,
      runtime_timeout_heartbeat_status: runtimeTimeoutHeartbeat.summary?.runtime_timeout_heartbeat_status ?? "unknown",
      agent_run_count: runtimeTimeoutHeartbeat.summary?.agent_run_count ?? 0,
      cancel_allowed: runtimeTimeoutHeartbeat.summary?.cancel_allowed ?? false,
      resume_allowed: runtimeTimeoutHeartbeat.summary?.resume_allowed ?? false,
      runtime_process_control_allowed: runtimeTimeoutHeartbeat.summary?.runtime_process_control_allowed ?? false,
      validation_error_count: runtimeTimeoutHeartbeat.summary?.validation_error_count ?? runtimeTimeoutHeartbeat.validation?.errors?.length ?? 0,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      validation_error_count: agentRunLedger.summary?.validation_error_count ?? agentRunLedger.validation?.errors?.length ?? 0,
    },
    audit_event_ledger: {
      schema_version: auditEventLedger.schema_version ?? null,
      audit_event_ledger_status: auditEventLedger.summary?.audit_event_ledger_status ?? "unknown",
      audit_trail_record_count: auditEventLedger.summary?.audit_trail_record_count ?? auditEventLedger.audit_event_catalog?.audit_trail_records?.length ?? 0,
      protected_action_executed_audit_record_count: auditEventLedger.summary?.protected_action_executed_audit_record_count ?? 0,
      validation_error_count: auditEventLedger.summary?.validation_error_count ?? auditEventLedger.validation?.errors?.length ?? 0,
    },
    workflow_resume_cancel_contract: {
      schema_version: workflowResumeCancelContract.schema_version ?? null,
      workflow_resume_cancel_status: workflowResumeCancelContract.summary?.workflow_resume_cancel_status ?? "unknown",
      resume_cancel_decision_count: workflowResumeCancelContract.summary?.resume_cancel_decision_count ?? 0,
      auto_resume_allowed_count: workflowResumeCancelContract.summary?.auto_resume_allowed_count ?? 0,
      auto_cancel_allowed_count: workflowResumeCancelContract.summary?.auto_cancel_allowed_count ?? 0,
      protected_action_executed_count: workflowResumeCancelContract.summary?.protected_action_executed_count ?? 0,
      validation_error_count: workflowResumeCancelContract.summary?.validation_error_count ?? workflowResumeCancelContract.validation?.errors?.length ?? 0,
    },
    gate_approval_contract_freeze: {
      schema_version: gateApprovalContractFreeze.schema_version ?? null,
      freeze_status: gateApprovalContractFreeze.summary?.freeze_status ?? "unknown",
      pending_approval_request_count: gateApprovalContractFreeze.summary?.pending_approval_request_count ?? 0,
      protected_explicit_approval_request_count: gateApprovalContractFreeze.summary?.protected_explicit_approval_request_count ?? 0,
      validation_error_count: gateApprovalContractFreeze.summary?.validation_error_count ?? gateApprovalContractFreeze.validation?.errors?.length ?? 0,
    },
    desktop_companion_integration: {
      declares_read_only: /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /source of truth가 아니라|not.*source of truth|source_of_truth=false/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /Human Gate|human gate|protected action request|protected_action_request/i.test(desktopCompanionIntegration),
      declares_protected_mutation_boundary: /protected execution|mutation_allowed=false|protected mutation|직접 제어하지 않는다|runtime source of truth/i.test(desktopCompanionIntegration),
    },
  };
}

function validateRuntimeControlCommands({
  runtimeTimeoutHeartbeat,
  agentRunLedger,
  auditEventLedger,
  workflowResumeCancelContract,
  gateApprovalContractFreeze,
  desktopCompanionIntegration,
  runtimeControlCommandRequests,
  runtimeControlCommandResults,
  runtimeControlAuditBindings,
  runtimeControlDesktopBoundary,
}) {
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const agentRunCount = agentRunLedger.summary?.agent_run_record_count ?? agentRunRecords.length;
  const items = [];
  items.push(validationItem("source.runtime_timeout_heartbeat", "runtime_lifecycle_complete", runtimeTimeoutHeartbeat.summary?.runtime_timeout_heartbeat_status === "complete" && runtimeTimeoutHeartbeat.summary?.agent_run_count === agentRunCount && runtimeTimeoutHeartbeat.summary?.cancel_allowed === false && runtimeTimeoutHeartbeat.summary?.resume_allowed === false && runtimeTimeoutHeartbeat.validation?.valid !== false, "Runtime timeout/heartbeat is complete and keeps lifecycle control disabled at the Desktop boundary."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunCount > 0 && agentRunLedger.validation?.valid !== false, "AgentRun ledger is the runtime run source for control command requests."));
  items.push(validationItem("source.audit_event_ledger", "audit_event_ledger_complete", auditEventLedger.summary?.audit_event_ledger_status === "complete" && (auditEventLedger.summary?.audit_trail_record_count ?? 0) > 0 && auditEventLedger.validation?.valid !== false, "Audit event ledger is available for append-only runtime control receipts."));
  items.push(validationItem("source.workflow_resume_cancel_contract", "workflow_resume_cancel_human_gated", workflowResumeCancelContract.summary?.workflow_resume_cancel_status === "complete" && workflowResumeCancelContract.summary?.auto_resume_allowed_count === 0 && workflowResumeCancelContract.summary?.auto_cancel_allowed_count === 0 && workflowResumeCancelContract.summary?.protected_action_executed_count === 0, "Workflow resume/cancel contract preserves human-gated control semantics."));
  items.push(validationItem("source.gate_approval_contract_freeze", "gate_approval_available", gateApprovalContractFreeze.summary?.freeze_status === "complete" && gateApprovalContractFreeze.summary?.pending_approval_request_count > 0 && gateApprovalContractFreeze.validation?.valid !== false, "Gate/Approval contract is available for protected runtime control requests."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_declares_protected_boundary", /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration) && /protected action request|Human Gate|human gate/i.test(desktopCompanionIntegration), "Desktop companion remains an operator surface with protected mutation routed through human gates."));
  items.push(validationItem("runtime_control_command_requests", "requests_cover_cancel_and_resume", runtimeControlCommandRequests.length === agentRunCount * 2 && countBy(runtimeControlCommandRequests, "control_command_kind").cancel === agentRunCount && countBy(runtimeControlCommandRequests, "control_command_kind").resume === agentRunCount, "Every AgentRun has one cancel and one resume request receipt."));
  items.push(validationItem("runtime_control_command_requests", "requests_are_protected_human_gated", runtimeControlCommandRequests.every((request) => request.protected_control_request === true && request.human_gate_required === true && request.command_execution_allowed === false && request.runtime_process_control_allowed === false), "Every runtime control request is protected, human-gated, and non-executing."));
  items.push(validationItem("runtime_control_command_results", "results_cover_requests", runtimeControlCommandResults.length === runtimeControlCommandRequests.length, "Every runtime control request has a result receipt."));
  items.push(validationItem("runtime_control_command_results", "results_record_no_execution", runtimeControlCommandResults.every((result) => result.audit_recorded === true && result.execution_performed === false && result.protected_action_executed === false && result.command_execution_allowed === false && result.new_run_created === false), "Every control result is recorded for audit without executing runtime process control."));
  items.push(validationItem("runtime_control_audit_bindings", "audit_bindings_cover_results", runtimeControlAuditBindings.length === runtimeControlCommandResults.length && runtimeControlAuditBindings.every((binding) => binding.audit_binding_status === "recorded" && binding.audit_record_status === "recorded_in_runtime_control_audit_binding"), "Every control result has an audit binding record."));
  items.push(validationItem("runtime_control_audit_bindings", "audit_separated_from_observability", runtimeControlAuditBindings.every((binding) => binding.separation_status === "separate_from_observability" && binding.protected_action_executed === false && binding.audit_event_append_required === true), "Runtime control audit records stay separate from observability and never mark protected action execution."));
  items.push(validationItem("runtime_control_desktop_boundary", "desktop_boundary_locked_read_only", runtimeControlDesktopBoundary.boundary_status === "locked" && runtimeControlDesktopBoundary.read_only === true && runtimeControlDesktopBoundary.mutation_allowed === false && runtimeControlDesktopBoundary.protected_mutation_execution_allowed === false && runtimeControlDesktopBoundary.desktop_source_of_truth === false, "Desktop runtime control boundary is locked read-only with request drafts only."));
  items.push(validationItem("runtime_control_desktop_boundary", "desktop_cannot_execute_control_commands", runtimeControlDesktopBoundary.cancel_allowed === false && runtimeControlDesktopBoundary.resume_allowed === false && runtimeControlDesktopBoundary.command_execution_allowed === false && runtimeControlDesktopBoundary.runtime_process_control_allowed === false && runtimeControlDesktopBoundary.runtime_start_allowed === false && runtimeControlDesktopBoundary.process_signal_allowed === false, "Desktop cannot execute cancel/resume, start runtimes, or send process signals."));
  return items;
}

function summarizeRuntimeControlCommands(projection, validationItems, validation) {
  const requests = projection.runtimeControlCommandRequests;
  const results = projection.runtimeControlCommandResults;
  const auditBindings = projection.runtimeControlAuditBindings;
  return {
    runtime_control_command_status: validation.valid ? "complete" : "blocked",
    control_command_contract_id: "runtime-control-commands.default",
    contract_status: "locked",
    control_command_authority: CONTROL_COMMAND_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    runtime_self_report_trusted: false,
    agent_run_count: new Set(requests.map((request) => request.agent_run_id)).size,
    control_command_request_count: requests.length,
    cancel_request_count: requests.filter((request) => request.control_command_kind === "cancel").length,
    resume_request_count: requests.filter((request) => request.control_command_kind === "resume").length,
    protected_control_request_count: requests.filter((request) => request.protected_control_request === true).length,
    human_gate_required_request_count: requests.filter((request) => request.human_gate_required === true).length,
    terminal_state_guard_count: requests.filter((request) => request.terminal_state_guard === true).length,
    command_execution_allowed_count: requests.filter((request) => request.command_execution_allowed === true).length,
    runtime_process_control_allowed_count: requests.filter((request) => request.runtime_process_control_allowed === true).length,
    auto_control_allowed_count: requests.filter((request) => request.auto_control_allowed === true).length,
    command_result_count: results.length,
    held_or_not_executed_result_count: results.filter((result) => ["held_for_human_gate", "not_executed_terminal_state"].includes(result.result_status)).length,
    audit_recorded_count: results.filter((result) => result.audit_recorded === true).length,
    execution_performed_count: results.filter((result) => result.execution_performed === true).length,
    protected_action_executed_count: results.filter((result) => result.protected_action_executed === true).length,
    new_run_created_count: results.filter((result) => result.new_run_created === true).length,
    audit_binding_count: auditBindings.length,
    recorded_audit_binding_count: auditBindings.filter((binding) => binding.audit_binding_status === "recorded").length,
    audit_append_required_count: auditBindings.filter((binding) => binding.audit_event_append_required === true).length,
    audit_separated_from_observability_count: auditBindings.filter((binding) => binding.separation_status === "separate_from_observability").length,
    desktop_surface_policy: "read_only_status_with_protected_request_drafts",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: true,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    cancel_allowed: false,
    resume_allowed: false,
    runtime_start_allowed: false,
    runtime_process_control_allowed: false,
    command_execution_allowed: false,
    process_signal_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(requests, "runtime_id"),
    by_control_command_kind: countBy(requests, "control_command_kind"),
    by_request_status: countBy(requests, "request_status"),
    by_result_status: countBy(results, "result_status"),
    by_audit_binding_status: countBy(auditBindings, "audit_binding_status"),
  };
}

function renderRuntimeControlCommandsMarkdown(result) {
  const lines = [];
  lines.push("# Runtime Control Commands");
  lines.push("");
  lines.push(`- Status: ${result.summary.runtime_control_command_status}`);
  lines.push(`- Requests: ${result.summary.control_command_request_count} (${result.summary.cancel_request_count} cancel, ${result.summary.resume_request_count} resume)`);
  lines.push(`- Results recorded: ${result.summary.audit_recorded_count}/${result.summary.command_result_count}`);
  lines.push(`- Audit bindings: ${result.summary.recorded_audit_binding_count}/${result.summary.audit_binding_count}`);
  lines.push(`- Desktop: ${result.summary.desktop_surface_policy}, execution_allowed=${result.summary.command_execution_allowed}`);
  lines.push("");
  lines.push("## Validation");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.path} (${item.check}) - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function isTerminalStatus(status) {
  return ["completed", "blocked", "failed", "cancelled", "timed_out"].includes(status);
}

function serializableRuntimeControlCommands(result) {
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
    else if (arg === "--runtime-timeout-heartbeat") args.runtimeTimeoutHeartbeatPath = argv[++index];
    else if (arg === "--agent-run-ledger") args.agentRunLedgerPath = argv[++index];
    else if (arg === "--audit-event-ledger") args.auditEventLedgerPath = argv[++index];
    else if (arg === "--workflow-resume-cancel") args.workflowResumeCancelContractPath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") args.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--desktop-companion-integration") args.desktopCompanionIntegrationPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-control-commands.mjs [options]

Options:
  --check                                 Fail when validation errors are present.
  --no-write                              Build without writing artifacts.
  --out-dir <path>                        Output directory.
  --runtime-timeout-heartbeat <path>      Runtime Timeout/Heartbeat artifact.
  --agent-run-ledger <path>               AgentRun ledger artifact.
  --audit-event-ledger <path>             Audit Event Ledger artifact.
  --workflow-resume-cancel <path>         Workflow Resume/Cancel Contract artifact.
  --gate-approval-contract-freeze <path>  Gate/Approval contract freeze artifact.
  --desktop-companion-integration <path>  Desktop Companion integration note.
`);
}
