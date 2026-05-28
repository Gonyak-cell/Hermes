import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LOCAL_SCRIPT_ADAPTER_OUT_DIR = "artifacts/local-script-adapter/latest";
export const DEFAULT_LOCAL_SCRIPT_ADAPTER_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  runtimeCommandBindingsPath: "examples/core/runtime-command-bindings.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  workflowGateFreezePath: "artifacts/workflow-gate-freeze/latest/workflow-gate-freeze.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const LOCAL_SCRIPT_RUNTIME_ID = "local_script";

export async function runLocalScriptAdapter(options = {}) {
  const result = await buildLocalScriptAdapter(options);
  if (options.write !== false) await writeLocalScriptAdapter(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Local script adapter validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLocalScriptAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LOCAL_SCRIPT_ADAPTER_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_LOCAL_SCRIPT_ADAPTER_INPUTS.runtimeAdapterInterfaceV2Path),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_LOCAL_SCRIPT_ADAPTER_INPUTS.runtimeAgentRunContractFreezePath),
    runtime_command_bindings_path: path.resolve(options.runtimeCommandBindingsPath ?? DEFAULT_LOCAL_SCRIPT_ADAPTER_INPUTS.runtimeCommandBindingsPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_LOCAL_SCRIPT_ADAPTER_INPUTS.agentRunLedgerPath),
    workflow_gate_freeze_path: path.resolve(options.workflowGateFreezePath ?? DEFAULT_LOCAL_SCRIPT_ADAPTER_INPUTS.workflowGateFreezePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_LOCAL_SCRIPT_ADAPTER_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const runtimeCommandBindings = await readJson(inputs.runtime_command_bindings_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const workflowGateFreeze = await readJson(inputs.workflow_gate_freeze_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectLocalScriptAdapter({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    runtimeCommandBindings,
    agentRunLedger,
    workflowGateFreeze,
    desktopCompanionIntegration,
    generatedAt,
  });
  const validationItems = validateLocalScriptAdapter({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    runtimeCommandBindings,
    agentRunLedger,
    workflowGateFreeze,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "local-script-adapter.v1",
    generated_at: generatedAt,
    adapter_projection_id: `local-script-adapter.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAdapterInterfaceV2,
      runtimeAgentRunContractFreeze,
      runtimeCommandBindings,
      agentRunLedger,
      workflowGateFreeze,
      desktopCompanionIntegration,
      desktopCompanionIntegrationPath: inputs.desktop_companion_integration_path,
      projection,
    }),
    local_script_adapter_contract: projection.localScriptAdapterContract,
    local_script_execution_contracts: projection.localScriptExecutionContracts,
    local_script_agent_run_ledger_bindings: projection.localScriptAgentRunLedgerBindings,
    local_script_desktop_boundary: projection.localScriptDesktopBoundary,
    summary: summarizeLocalScriptAdapter(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderLocalScriptAdapterMarkdown(result),
  };
}

export async function writeLocalScriptAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLocalScriptAdapter(result);
  await writeJson(path.join(outDir, "local-script-adapter.json"), serializable);
  await writeJson(path.join(outDir, "local-script-execution-contracts.json"), {
    schema_version: "local-script-execution-contracts.v1",
    generated_at: result.generated_at,
    contract_count: result.local_script_execution_contracts.length,
    local_script_execution_contracts: result.local_script_execution_contracts,
  });
  await writeJson(path.join(outDir, "local-script-agent-run-ledger-bindings.json"), {
    schema_version: "local-script-agent-run-ledger-bindings.v1",
    generated_at: result.generated_at,
    binding_count: result.local_script_agent_run_ledger_bindings.length,
    local_script_agent_run_ledger_bindings: result.local_script_agent_run_ledger_bindings,
  });
  await writeJson(path.join(outDir, "local-script-desktop-boundary.json"), result.local_script_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "local-script-adapter-validation-report.v1",
    generated_at: result.generated_at,
    adapter_projection_id: result.adapter_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLocalScriptAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLocalScriptAdapter(args);
    console.log(`Local script adapter written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.local_script_adapter_status}`);
    console.log(`AgentRun ledger bound: ${result.summary.agent_run_ledger_bound}`);
    console.log(`Execution contracts: ${result.summary.execution_contract_count}`);
    console.log(`Network access allowed: ${result.summary.network_access_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectLocalScriptAdapter({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  generatedAt,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const localScriptInterface = (interfaceContract.runtime_adapter_interfaces ?? []).find((item) => item.runtime_id === LOCAL_SCRIPT_RUNTIME_ID) ?? null;
  const localScriptOperatorPolicy = (interfaceContract.operator_surface_policies ?? []).find((item) => item.runtime_id === LOCAL_SCRIPT_RUNTIME_ID) ?? null;
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const localScriptRuntimeAdapter = (runtimeContract.runtime_adapters ?? []).find((item) => item.runtime_id === LOCAL_SCRIPT_RUNTIME_ID) ?? null;
  const localScriptRuntimeExecutionContract = (runtimeContract.runtime_execution_contracts ?? []).find((item) => item.runtime_id === LOCAL_SCRIPT_RUNTIME_ID) ?? null;
  const localScriptAgentRunContracts = (runtimeContract.agent_runs ?? []).filter((item) => item.runtime_id === LOCAL_SCRIPT_RUNTIME_ID);
  const localScriptCommandBinding = (runtimeCommandBindings.bindings ?? []).find((item) => item.runtime_id === LOCAL_SCRIPT_RUNTIME_ID) ?? null;
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const localScriptAgentRunRecords = agentRunRecords.filter((record) => record.runtime_id === LOCAL_SCRIPT_RUNTIME_ID);
  const workflowGateVerticalSlices = workflowGateFreeze.workflow_gate_vertical_slices ?? [];
  const requiredGates = unique([
    ...(localScriptRuntimeAdapter?.tool_policy?.required_gates ?? []),
    ...(localScriptRuntimeAdapter?.verification?.required_gates ?? []),
    "human_approval_gate",
  ]);
  const localScriptAdapterContract = {
    schema_version: "local-script-adapter-contract.v1",
    generated_at: generatedAt,
    contract_id: "local-script-adapter.default",
    runtime_id: LOCAL_SCRIPT_RUNTIME_ID,
    adapter_id: localScriptRuntimeAdapter?.adapter_id ?? "runtime.local_script.default",
    adapter_interface_id: localScriptInterface?.interface_id ?? null,
    runtime_execution_contract_id: localScriptRuntimeExecutionContract?.execution_contract_id ?? localScriptInterface?.execution_contract_id ?? null,
    command_binding_id: localScriptCommandBinding?.binding_id ?? null,
    adapter_status: "locked",
    execution_authority: "harness_control_plane",
    source_of_truth: "agent_run_ledger",
    output_trust: localScriptRuntimeAdapter?.output_trust ?? localScriptInterface?.output_trust ?? "trusted_after_deterministic_validation",
    verification_required: localScriptRuntimeAdapter?.verification_required ?? localScriptInterface?.verification_required ?? true,
    required_gates: requiredGates,
    deterministic_execution_policy: {
      schema_version: "local-script-deterministic-execution-policy.v1",
      execution_mode: localScriptRuntimeExecutionContract?.execution_mode ?? "local_process",
      network_policy: localScriptRuntimeExecutionContract?.network_policy ?? "disabled",
      network_access_allowed: false,
      external_execution_allowed: false,
      sandbox_required: localScriptRuntimeExecutionContract?.sandbox_required === true,
      workspace_isolation_type: localScriptRuntimeExecutionContract?.workspace_isolation_type ?? "temp_dir",
      dirty_checkout_policy: localScriptRuntimeExecutionContract?.dirty_checkout_policy ?? "require_snapshot",
      prompt_delivery: localScriptCommandBinding?.prompt_delivery ?? "none",
      execute_requires_git_worktree: localScriptCommandBinding?.execute_requires_git_worktree === true,
      command_resolution_required: true,
      candidate_command_count: localScriptCommandBinding?.candidate_commands?.length ?? 0,
      direct_final_delivery_allowed: false,
      protected_path_write_allowed: false,
      secret_material_allowed: false,
      runtime_self_report_trusted: false,
      deterministic_output_hash_required: true,
      renderer_preparation_only: true,
      script_kind_allowlist: ["extractor", "classifier", "validator", "renderer_prepare", "test_gate"],
      timeout_seconds: localScriptRuntimeExecutionContract?.timeout_seconds ?? localScriptRuntimeAdapter?.lifecycle?.timeout_seconds ?? 1800,
    },
    gate_policy: {
      schema_version: "local-script-gate-policy.v1",
      mutation_route: "protected_action_request_only",
      acceptance_authority: localScriptRuntimeAdapter?.verification?.acceptance_authority ?? "gate_engine",
      required_gates: requiredGates,
      matter_access_gate_required: requiredGates.includes("matter_access_gate"),
      classification_gate_required: requiredGates.includes("classification_gate"),
      tool_permission_gate_required: requiredGates.includes("tool_permission_gate"),
      protected_file_gate_required: requiredGates.includes("protected_file_gate"),
      evidence_coverage_gate_required: requiredGates.includes("evidence_coverage_gate"),
      test_gate_required: requiredGates.includes("test_gate"),
      human_approval_gate_required: requiredGates.includes("human_approval_gate"),
      bypass_allowed: false,
      gate_binding_status: "ready",
    },
    collection_policy: buildCollectionPolicy({
      localScriptRuntimeAdapter,
      localScriptInterface,
      agentRunLedger,
    }),
    desktop_boundary_ref: "local-script-desktop-boundary.local_script",
  };
  const localScriptExecutionContracts = localScriptAgentRunContracts.map((contract) => buildExecutionContract({
    contract,
    localScriptAdapterContract,
    matchingRecord: localScriptAgentRunRecords.find((record) => record.agent_run_id === contract.agent_run_id),
    workflowGateVerticalSlices,
    generatedAt,
  }));
  const localScriptAgentRunLedgerBindings = [
    buildAgentRunLedgerBinding({
      localScriptAdapterContract,
      agentRunLedger,
      localScriptAgentRunRecords,
      localScriptExecutionContracts,
      generatedAt,
    }),
  ];
  const localScriptDesktopBoundary = buildDesktopBoundary({
    localScriptOperatorPolicy,
    desktopCompanionIntegration,
    generatedAt,
  });
  return {
    localScriptInterface,
    localScriptOperatorPolicy,
    localScriptRuntimeAdapter,
    localScriptRuntimeExecutionContract,
    localScriptCommandBinding,
    localScriptAgentRunContracts,
    agentRunRecords,
    localScriptAgentRunRecords,
    workflowGateVerticalSlices,
    localScriptAdapterContract,
    localScriptExecutionContracts,
    localScriptAgentRunLedgerBindings,
    localScriptDesktopBoundary,
  };
}

function buildCollectionPolicy({ localScriptRuntimeAdapter, localScriptInterface, agentRunLedger }) {
  return {
    schema_version: "local-script-agent-run-collection-policy.v1",
    sink_ledger: "agent_run_ledger",
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? "agent-run-ledger.v1",
    collect_runtime_invocation_id: true,
    collect_workflow_run_id: true,
    collect_input_ref: true,
    collect_output_ref: true,
    collect_output_hash: localScriptRuntimeAdapter?.observability?.output_hash_required ?? localScriptInterface?.output_hash_required ?? true,
    collect_logs_ref: localScriptRuntimeAdapter?.logs_required ?? localScriptInterface?.logs_required ?? true,
    collect_artifact_refs: localScriptRuntimeAdapter?.artifact_capture_required ?? localScriptInterface?.artifact_capture_required ?? true,
    collect_runtime_verification: localScriptRuntimeAdapter?.verification_required ?? localScriptInterface?.verification_required ?? true,
    collect_deterministic_validation_status: true,
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    collection_status: "ready",
  };
}

function buildExecutionContract({
  contract,
  localScriptAdapterContract,
  matchingRecord,
  workflowGateVerticalSlices,
  generatedAt,
}) {
  const lane = contract.metadata?.source_metadata?.lane ?? contract.metadata?.source_metadata?.mode ?? "deterministic_script";
  return {
    schema_version: "local-script-execution-contract.v1",
    generated_at: generatedAt,
    local_script_execution_contract_id: `local-script-execution.${normalizeId(contract.agent_run_id)}`,
    runtime_id: LOCAL_SCRIPT_RUNTIME_ID,
    adapter_id: localScriptAdapterContract.adapter_id,
    agent_run_id: contract.agent_run_id,
    agent_run_record_id: matchingRecord?.agent_run_record_id ?? null,
    workflow_run_id: contract.workflow_run_id,
    domain_pack: contract.domain_pack,
    capability_id: contract.capability_id,
    deterministic_lane: lane,
    execution_mode: localScriptAdapterContract.deterministic_execution_policy.execution_mode,
    network_access_allowed: false,
    external_execution_allowed: false,
    sandbox_required: localScriptAdapterContract.deterministic_execution_policy.sandbox_required,
    workspace_isolation_type: localScriptAdapterContract.deterministic_execution_policy.workspace_isolation_type,
    prompt_delivery: localScriptAdapterContract.deterministic_execution_policy.prompt_delivery,
    input_ref: contract.input_ref ?? matchingRecord?.input_ref ?? null,
    output_ref: contract.output_ref ?? matchingRecord?.output_ref ?? null,
    output_hash: contract.output_hash ?? matchingRecord?.output_hash ?? null,
    output_hash_status: contract.output_hash ? "present" : "missing",
    output_trust: contract.output_trust ?? localScriptAdapterContract.output_trust,
    output_contract_ref: contract.output_contract_ref ?? "governance-output.v1",
    logs_ref: contract.logs_ref ?? matchingRecord?.logs_ref ?? null,
    log_capture_status: contract.log_capture_status ?? matchingRecord?.log_reference_status ?? "unknown",
    artifact_ids: contract.artifact_ids ?? matchingRecord?.artifact_ids ?? [],
    artifact_capture_status: contract.artifact_capture_status ?? matchingRecord?.artifact_reference_status ?? "unknown",
    verification_required: contract.verification_required ?? true,
    verification_status: contract.verification_status ?? matchingRecord?.verification_status ?? "unknown",
    required_gates: unique([...(contract.required_gates ?? []), "human_approval_gate"]),
    acceptance_authority: contract.acceptance_authority ?? "gate_engine",
    deterministic_validation_required: true,
    deterministic_validation_status: "ready",
    direct_final_delivery_allowed: false,
    protected_path_write_allowed: false,
    secret_material_allowed: false,
    runtime_self_report_trusted: false,
    workflow_gate_vertical_slice_refs: workflowGateVerticalSlices
      .filter((slice) => slice.domain_pack === contract.domain_pack || slice.capability_id === contract.capability_id)
      .map((slice) => slice.workflow_gate_vertical_slice_id)
      .filter(Boolean),
    contract_status: "locked",
  };
}

function buildAgentRunLedgerBinding({
  localScriptAdapterContract,
  agentRunLedger,
  localScriptAgentRunRecords,
  localScriptExecutionContracts,
  generatedAt,
}) {
  return {
    schema_version: "local-script-agent-run-ledger-binding.v1",
    generated_at: generatedAt,
    binding_id: "local-script-agent-run-ledger-binding.default",
    runtime_id: LOCAL_SCRIPT_RUNTIME_ID,
    adapter_id: localScriptAdapterContract.adapter_id,
    command_binding_id: localScriptAdapterContract.command_binding_id,
    sink_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? null,
    sink_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    current_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    current_local_script_agent_run_record_count: localScriptAgentRunRecords.length,
    execution_contract_count: localScriptExecutionContracts.length,
    collection_status: "ready",
    output_capture_status: "ready",
    log_capture_status: "ready",
    artifact_capture_status: "ready",
    verification_capture_status: "ready",
    deterministic_validation_capture_status: "ready",
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    binding_status: "locked",
  };
}

function buildDesktopBoundary({ localScriptOperatorPolicy, desktopCompanionIntegration, generatedAt }) {
  return {
    schema_version: "local-script-desktop-boundary.v1",
    generated_at: generatedAt,
    desktop_boundary_id: "local-script-desktop-boundary.local_script",
    runtime_id: LOCAL_SCRIPT_RUNTIME_ID,
    desktop_surface_policy: localScriptOperatorPolicy?.desktop_surface_policy ?? "read_only_runtime_status",
    source_of_truth: "harness_control_plane",
    runtime_source_of_truth: false,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_execution_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    auto_update_control: false,
    skill_install_control: false,
    allowed_operator_actions: localScriptOperatorPolicy?.allowed_operator_actions ?? ["view_status", "view_logs", "view_artifacts", "view_verification", "draft_receipt_reference"],
    denied_operator_actions: unique([
      ...(localScriptOperatorPolicy?.denied_operator_actions ?? []),
      "execute_runtime",
      "approve_protected_mutation",
      "write_secret",
    ]),
    human_gate_required_for_execution: true,
    protected_mutation_route: "receipt_draft_or_human_gate_only",
    integration_doc_declares_read_only: desktopCompanionIntegration.includes("읽기 전용") || desktopCompanionIntegration.includes("read_only=true"),
    boundary_status: "locked",
  };
}

function buildSourceContracts({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  desktopCompanionIntegrationPath,
  projection,
}) {
  return {
    runtime_adapter_interface_v2: {
      schema_version: runtimeAdapterInterfaceV2.schema_version ?? null,
      runtime_adapter_interface_status: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status ?? "unknown",
      local_script_interface_status: projection.localScriptInterface?.interface_status ?? "missing",
      local_script_operator_surface_policy_status: projection.localScriptOperatorPolicy?.policy_status ?? "missing",
    },
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      local_script_runtime_adapter_found: Boolean(projection.localScriptRuntimeAdapter),
      local_script_runtime_execution_contract_found: Boolean(projection.localScriptRuntimeExecutionContract),
      current_local_script_agent_run_contract_count: projection.localScriptAgentRunContracts.length,
    },
    runtime_command_bindings: {
      schema_version: runtimeCommandBindings.schema_version ?? null,
      binding_registry_id: runtimeCommandBindings.binding_registry_id ?? null,
      local_script_command_binding_found: Boolean(projection.localScriptCommandBinding),
      local_script_prompt_delivery: projection.localScriptCommandBinding?.prompt_delivery ?? null,
      local_script_execute_requires_git_worktree: projection.localScriptCommandBinding?.execute_requires_git_worktree === true,
      local_script_candidate_command_count: projection.localScriptCommandBinding?.candidate_commands?.length ?? 0,
      local_script_deterministic: projection.localScriptCommandBinding?.metadata?.deterministic === true,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      current_local_script_agent_run_record_count: projection.localScriptAgentRunRecords.length,
    },
    workflow_gate_freeze: {
      schema_version: workflowGateFreeze.schema_version ?? null,
      workflow_gate_freeze_status: workflowGateFreeze.summary?.workflow_gate_freeze_status ?? "unknown",
      workflow_gate_vertical_slice_count: workflowGateFreeze.summary?.workflow_gate_vertical_slice_count ?? 0,
    },
    desktop_companion_integration: {
      document_path: desktopCompanionIntegrationPath,
      declares_read_only: desktopCompanionIntegration.includes("읽기 전용") || desktopCompanionIntegration.includes("read_only=true"),
      declares_not_runtime_source_of_truth: desktopCompanionIntegration.includes("source of truth가 아니라") || desktopCompanionIntegration.includes("not a runtime"),
    },
  };
}

function validateLocalScriptAdapter({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  localScriptInterface,
  localScriptOperatorPolicy,
  localScriptRuntimeAdapter,
  localScriptRuntimeExecutionContract,
  localScriptCommandBinding,
  localScriptAgentRunContracts,
  localScriptAdapterContract,
  localScriptExecutionContracts,
  localScriptAgentRunLedgerBindings,
  localScriptDesktopBoundary,
}) {
  const items = [];
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_adapter_interface_v2_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_contract_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze is complete."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete", "AgentRun ledger is complete and available as the Local Script result sink."));
  items.push(validationItem("source.workflow_gate_freeze", "workflow_gate_freeze_complete", workflowGateFreeze.summary?.workflow_gate_freeze_status === "complete", "Workflow/Gate freeze is complete."));
  items.push(validationItem("source.runtime_command_bindings", "runtime_command_binding_registry_loaded", runtimeCommandBindings.schema_version === "runtime-command-bindings.v1", "Runtime command binding registry is loaded."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_boundary_documented", desktopCompanionIntegration.includes("source of truth가 아니라") && desktopCompanionIntegration.includes("읽기 전용"), "Desktop companion boundary is documented as read-only and not source of truth."));
  items.push(validationItem("local_script.interface", "local_script_interface_locked", localScriptInterface?.interface_status === "locked", "Local Script runtime interface is locked."));
  items.push(validationItem("local_script.interface", "local_script_output_trust_locked", localScriptInterface?.output_trust === "trusted_after_deterministic_validation", "Local Script output trust is deterministic validation-bound."));
  items.push(validationItem("local_script.runtime_contract", "local_script_runtime_adapter_found", Boolean(localScriptRuntimeAdapter), "Local Script runtime adapter exists in Runtime/AgentRun freeze."));
  items.push(validationItem("local_script.runtime_contract", "local_script_execution_contract_found", Boolean(localScriptRuntimeExecutionContract), "Local Script runtime execution contract exists."));
  items.push(validationItem("local_script.runtime_contract", "local_script_network_disabled", localScriptRuntimeExecutionContract?.network_policy === "disabled" && localScriptRuntimeExecutionContract?.external_execution === false, "Local Script execution is local-only with network disabled."));
  items.push(validationItem("local_script.runtime_contract", "local_script_temp_dir_isolation", localScriptRuntimeExecutionContract?.workspace_isolation_type === "temp_dir", "Local Script uses temp_dir isolation."));
  items.push(validationItem("local_script.command_binding", "local_script_command_binding_found", Boolean(localScriptCommandBinding), "Local Script command binding is declared."));
  items.push(validationItem("local_script.command_binding", "local_script_prompt_delivery_none", localScriptCommandBinding?.prompt_delivery === "none", "Local Script command binding uses no prompt delivery."));
  items.push(validationItem("local_script.command_binding", "local_script_deterministic_binding", localScriptCommandBinding?.metadata?.deterministic === true, "Local Script command binding is marked deterministic."));
  items.push(validationItem("local_script.adapter_contract", "local_script_adapter_contract_locked", localScriptAdapterContract.adapter_status === "locked", "Local Script adapter contract is locked."));
  items.push(validationItem("local_script.adapter_contract", "local_script_no_network_or_external_execution", localScriptAdapterContract.deterministic_execution_policy.network_access_allowed === false && localScriptAdapterContract.deterministic_execution_policy.external_execution_allowed === false, "Local Script cannot use network or external execution."));
  items.push(validationItem("local_script.adapter_contract", "local_script_no_direct_delivery_or_protected_writes", localScriptAdapterContract.deterministic_execution_policy.direct_final_delivery_allowed === false && localScriptAdapterContract.deterministic_execution_policy.protected_path_write_allowed === false, "Local Script cannot directly deliver final outputs or write protected paths."));
  items.push(validationItem("local_script.adapter_contract", "local_script_agent_run_ledger_sink_required", localScriptAdapterContract.collection_policy.sink_ledger === "agent_run_ledger" && localScriptAdapterContract.collection_policy.collect_deterministic_validation_status === true, "Local Script outputs are collected into AgentRun ledger references."));
  items.push(validationItem("local_script.execution_contracts", "local_script_execution_contracts_materialized", localScriptExecutionContracts.length === localScriptAgentRunContracts.length && localScriptExecutionContracts.length >= 1, "Local Script execution contracts are materialized for current AgentRun contracts."));
  items.push(validationItem("local_script.execution_contracts", "local_script_execution_contracts_locked", localScriptExecutionContracts.every((contract) => contract.contract_status === "locked" && contract.deterministic_validation_status === "ready"), "Local Script execution contracts are locked and validation-ready."));
  items.push(validationItem("local_script.execution_contracts", "local_script_execution_capture_ready", localScriptExecutionContracts.every((contract) => contract.output_hash_status === "present" && contract.log_capture_status === "captured" && contract.artifact_capture_status === "captured"), "Local Script execution contracts capture output hash, logs, and artifacts."));
  items.push(validationItem("local_script.execution_contracts", "local_script_execution_gates_required", localScriptExecutionContracts.every((contract) => contract.required_gates.includes("test_gate") && contract.required_gates.includes("human_approval_gate")), "Local Script execution contracts retain test and human approval gates."));
  items.push(validationItem("local_script.agent_run_ledger_binding", "local_script_agent_run_ledger_binding_locked", localScriptAgentRunLedgerBindings.every((binding) => binding.binding_status === "locked" && binding.collection_status === "ready"), "Local Script AgentRun ledger binding is locked."));
  items.push(validationItem("local_script.desktop_boundary", "desktop_read_only", localScriptDesktopBoundary.read_only === true && localScriptDesktopBoundary.mutation_allowed === false, "Local Script Desktop surface is read-only."));
  items.push(validationItem("local_script.desktop_boundary", "desktop_not_runtime_source_of_truth", localScriptDesktopBoundary.runtime_source_of_truth === false && localScriptDesktopBoundary.desktop_source_of_truth === false, "Desktop is not a runtime or source of truth for Local Script."));
  items.push(validationItem("local_script.desktop_boundary", "desktop_sensitive_controls_absent", localScriptDesktopBoundary.secret_material_exposed === false && localScriptDesktopBoundary.installer_or_gateway_control === false && localScriptDesktopBoundary.ssh_or_cron_control === false && localScriptDesktopBoundary.skill_install_control === false, "Desktop exposes no secrets, installer, gateway, SSH, cron, or skill-install controls."));
  items.push(validationItem("local_script.operator_policy", "operator_policy_read_only", localScriptOperatorPolicy?.read_only === true && localScriptOperatorPolicy?.runtime_source_of_truth === false, "Local Script operator policy remains read-only and not source of truth."));
  return items;
}

function summarizeLocalScriptAdapter(projection, validationItems, validation) {
  const boundary = projection.localScriptDesktopBoundary;
  const binding = projection.localScriptAgentRunLedgerBindings[0] ?? {};
  const policy = projection.localScriptAdapterContract.deterministic_execution_policy;
  const gatePolicy = projection.localScriptAdapterContract.gate_policy;
  return {
    local_script_adapter_status: validation.valid ? "complete" : "attention",
    runtime_id: LOCAL_SCRIPT_RUNTIME_ID,
    adapter_id: projection.localScriptAdapterContract.adapter_id,
    adapter_status: projection.localScriptAdapterContract.adapter_status,
    local_script_interface_bound: Boolean(projection.localScriptInterface),
    local_script_runtime_execution_contract_bound: Boolean(projection.localScriptRuntimeExecutionContract),
    local_script_command_binding_declared: Boolean(projection.localScriptCommandBinding),
    command_binding_id: projection.localScriptAdapterContract.command_binding_id,
    agent_run_ledger_bound: binding.sink_ledger_status === "complete",
    agent_run_ledger_status: binding.sink_ledger_status ?? "unknown",
    current_agent_run_record_count: binding.current_agent_run_record_count ?? 0,
    current_local_script_agent_run_record_count: binding.current_local_script_agent_run_record_count ?? 0,
    execution_contract_count: projection.localScriptExecutionContracts.length,
    execution_contract_locked_count: projection.localScriptExecutionContracts.filter((contract) => contract.contract_status === "locked").length,
    deterministic_validation_ready_count: projection.localScriptExecutionContracts.filter((contract) => contract.deterministic_validation_status === "ready").length,
    output_hash_present_count: projection.localScriptExecutionContracts.filter((contract) => contract.output_hash_status === "present").length,
    log_capture_ready_count: projection.localScriptExecutionContracts.filter((contract) => contract.log_capture_status === "captured").length,
    artifact_capture_ready_count: projection.localScriptExecutionContracts.filter((contract) => contract.artifact_capture_status === "captured").length,
    network_access_allowed: policy.network_access_allowed,
    external_execution_allowed: policy.external_execution_allowed,
    sandbox_required: policy.sandbox_required,
    workspace_isolation_type: policy.workspace_isolation_type,
    prompt_delivery: policy.prompt_delivery,
    execute_requires_git_worktree: policy.execute_requires_git_worktree,
    direct_final_delivery_allowed: policy.direct_final_delivery_allowed,
    protected_path_write_allowed: policy.protected_path_write_allowed,
    secret_material_allowed: policy.secret_material_allowed,
    runtime_self_report_trusted: policy.runtime_self_report_trusted,
    renderer_preparation_only: policy.renderer_preparation_only,
    output_trust: projection.localScriptAdapterContract.output_trust,
    verification_required: projection.localScriptAdapterContract.verification_required,
    matter_access_gate_required: gatePolicy.matter_access_gate_required,
    classification_gate_required: gatePolicy.classification_gate_required,
    tool_permission_gate_required: gatePolicy.tool_permission_gate_required,
    protected_file_gate_required: gatePolicy.protected_file_gate_required,
    evidence_coverage_gate_required: gatePolicy.evidence_coverage_gate_required,
    test_gate_required: gatePolicy.test_gate_required,
    human_review_required: gatePolicy.human_approval_gate_required,
    gate_binding_status: gatePolicy.gate_binding_status,
    output_capture_ready: binding.output_capture_status === "ready",
    log_capture_ready: binding.log_capture_status === "ready",
    artifact_capture_ready: binding.artifact_capture_status === "ready",
    verification_capture_ready: binding.verification_capture_status === "ready",
    deterministic_validation_capture_ready: binding.deterministic_validation_capture_status === "ready",
    desktop_surface_policy: boundary.desktop_surface_policy,
    desktop_read_only: boundary.read_only,
    desktop_mutation_allowed: boundary.mutation_allowed,
    desktop_protected_mutation_request_allowed: boundary.protected_mutation_request_allowed,
    desktop_protected_mutation_execution_allowed: boundary.protected_mutation_execution_allowed,
    desktop_secret_material_exposed: boundary.secret_material_exposed,
    desktop_installer_or_gateway_control: boundary.installer_or_gateway_control,
    desktop_runtime_source_of_truth: boundary.runtime_source_of_truth,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function validationItem(pathName, check, passed, message) {
  return {
    path: pathName,
    check,
    status: passed ? "passed" : "failed",
    message,
  };
}

function renderLocalScriptAdapterMarkdown(result) {
  const summary = result.summary;
  return [
    "# Local Script Adapter",
    "",
    `- Status: ${summary.local_script_adapter_status}`,
    `- Runtime: ${summary.runtime_id}`,
    `- Adapter: ${summary.adapter_id}`,
    `- Interface bound: ${summary.local_script_interface_bound}`,
    `- AgentRun ledger bound: ${summary.agent_run_ledger_bound}`,
    `- Current Local Script AgentRun records: ${summary.current_local_script_agent_run_record_count}`,
    `- Execution contracts: ${summary.execution_contract_count}`,
    `- Output trust: ${summary.output_trust}`,
    `- Network access allowed: ${summary.network_access_allowed}`,
    `- External execution allowed: ${summary.external_execution_allowed}`,
    `- Deterministic validation capture ready: ${summary.deterministic_validation_capture_ready}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Desktop runtime source of truth: ${summary.desktop_runtime_source_of_truth}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableLocalScriptAdapter(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_LOCAL_SCRIPT_ADAPTER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--runtime-adapter-interface-v2") parsed.runtimeAdapterInterfaceV2Path = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--runtime-command-bindings") parsed.runtimeCommandBindingsPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--workflow-gate-freeze") parsed.workflowGateFreezePath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/local-script-adapter.mjs [options]

Options:
  --runtime-adapter-interface-v2 <path>
                                  Runtime Adapter Interface v2 artifact.
  --runtime-agentrun-contract-freeze <path>
                                  Runtime/AgentRun contract freeze artifact.
  --runtime-command-bindings <path>
                                  Runtime command binding registry.
  --agent-run-ledger <path>       AgentRun ledger artifact.
  --workflow-gate-freeze <path>   Workflow/Gate freeze artifact.
  --desktop-companion-integration <path>
                                  Desktop Companion integration document.
  --out-dir <path>                Output directory.
  --check                         Exit non-zero when validation fails.
  -h, --help                      Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeId(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
