import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_HERMES_RUNTIME_ADAPTER_OUT_DIR = "artifacts/hermes-runtime-adapter/latest";
export const DEFAULT_HERMES_RUNTIME_ADAPTER_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  runtimeCommandBindingsPath: "examples/core/runtime-command-bindings.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const HERMES_RUNTIME_ID = "hermes";

export async function runHermesRuntimeAdapter(options = {}) {
  const result = await buildHermesRuntimeAdapter(options);
  if (options.write !== false) await writeHermesRuntimeAdapter(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Hermes runtime adapter validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildHermesRuntimeAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_HERMES_RUNTIME_ADAPTER_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_HERMES_RUNTIME_ADAPTER_INPUTS.runtimeAdapterInterfaceV2Path),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_HERMES_RUNTIME_ADAPTER_INPUTS.runtimeAgentRunContractFreezePath),
    runtime_command_bindings_path: path.resolve(options.runtimeCommandBindingsPath ?? DEFAULT_HERMES_RUNTIME_ADAPTER_INPUTS.runtimeCommandBindingsPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_HERMES_RUNTIME_ADAPTER_INPUTS.agentRunLedgerPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_HERMES_RUNTIME_ADAPTER_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const runtimeCommandBindings = await readJson(inputs.runtime_command_bindings_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectHermesRuntimeAdapter({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    runtimeCommandBindings,
    agentRunLedger,
    desktopCompanionIntegration,
    generatedAt,
  });
  const validationItems = validateHermesRuntimeAdapter({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    runtimeCommandBindings,
    agentRunLedger,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "hermes-runtime-adapter.v1",
    generated_at: generatedAt,
    adapter_projection_id: `hermes-runtime-adapter.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAdapterInterfaceV2,
      runtimeAgentRunContractFreeze,
      runtimeCommandBindings,
      agentRunLedger,
      desktopCompanionIntegration,
      desktopCompanionIntegrationPath: inputs.desktop_companion_integration_path,
      projection,
    }),
    hermes_runtime_adapter_contract: projection.hermesRuntimeAdapterContract,
    hermes_invocation_result_contracts: projection.hermesInvocationResultContracts,
    hermes_agent_run_ledger_bindings: projection.hermesAgentRunLedgerBindings,
    hermes_desktop_boundary: projection.hermesDesktopBoundary,
    summary: summarizeHermesRuntimeAdapter(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderHermesRuntimeAdapterMarkdown(result),
  };
}

export async function writeHermesRuntimeAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableHermesRuntimeAdapter(result);
  await writeJson(path.join(outDir, "hermes-runtime-adapter.json"), serializable);
  await writeJson(path.join(outDir, "hermes-invocation-result-contracts.json"), {
    schema_version: "hermes-invocation-result-contracts.v1",
    generated_at: result.generated_at,
    contract_count: result.hermes_invocation_result_contracts.length,
    hermes_invocation_result_contracts: result.hermes_invocation_result_contracts,
  });
  await writeJson(path.join(outDir, "hermes-agent-run-ledger-bindings.json"), {
    schema_version: "hermes-agent-run-ledger-bindings.v1",
    generated_at: result.generated_at,
    binding_count: result.hermes_agent_run_ledger_bindings.length,
    hermes_agent_run_ledger_bindings: result.hermes_agent_run_ledger_bindings,
  });
  await writeJson(path.join(outDir, "hermes-desktop-boundary.json"), result.hermes_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "hermes-runtime-adapter-validation-report.v1",
    generated_at: result.generated_at,
    adapter_projection_id: result.adapter_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runHermesRuntimeAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runHermesRuntimeAdapter(args);
    console.log(`Hermes runtime adapter written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.hermes_runtime_adapter_status}`);
    console.log(`AgentRun ledger bound: ${result.summary.agent_run_ledger_bound}`);
    console.log(`Invocation result contracts: ${result.summary.invocation_result_contract_count}`);
    console.log(`Desktop read-only: ${result.summary.desktop_read_only}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectHermesRuntimeAdapter({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  desktopCompanionIntegration,
  generatedAt,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const hermesInterface = (interfaceContract.runtime_adapter_interfaces ?? []).find((item) => item.runtime_id === HERMES_RUNTIME_ID) ?? null;
  const hermesOperatorPolicy = (interfaceContract.operator_surface_policies ?? []).find((item) => item.runtime_id === HERMES_RUNTIME_ID) ?? null;
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const hermesRuntimeAdapter = (runtimeContract.runtime_adapters ?? []).find((item) => item.runtime_id === HERMES_RUNTIME_ID) ?? null;
  const hermesRuntimeExecutionContract = (runtimeContract.runtime_execution_contracts ?? []).find((item) => item.runtime_id === HERMES_RUNTIME_ID) ?? null;
  const hermesCommandBinding = (runtimeCommandBindings.bindings ?? []).find((item) => item.runtime_id === HERMES_RUNTIME_ID) ?? null;
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const hermesAgentRunRecords = agentRunRecords.filter((record) => record.runtime_id === HERMES_RUNTIME_ID);

  const hermesRuntimeAdapterContract = {
    schema_version: "hermes-runtime-adapter-contract.v1",
    generated_at: generatedAt,
    contract_id: "hermes-runtime-adapter-contract.default",
    runtime_id: HERMES_RUNTIME_ID,
    adapter_id: hermesRuntimeAdapter?.adapter_id ?? "runtime.hermes.default",
    adapter_interface_id: hermesInterface?.interface_id ?? null,
    runtime_execution_contract_id: hermesRuntimeExecutionContract?.execution_contract_id ?? hermesInterface?.execution_contract_id ?? null,
    command_binding_id: hermesCommandBinding?.binding_id ?? null,
    adapter_status: "locked",
    execution_authority: "harness_control_plane",
    source_of_truth: "agent_run_ledger",
    output_trust: hermesRuntimeAdapter?.output_trust ?? hermesInterface?.output_trust ?? "untrusted_until_verified",
    verification_required: hermesRuntimeAdapter?.verification_required ?? hermesInterface?.verification_required ?? true,
    required_gates: hermesRuntimeAdapter?.verification?.required_gates ?? hermesInterface?.metadata?.required_verification_gates ?? [],
    allowed_context_modes: ["redacted", "public_or_internal_only"],
    forbidden_context_modes: ["raw_client_confidential_default", "secret_material"],
    invocation_policy: {
      schema_version: "hermes-invocation-policy.v1",
      default_mode: "dry_run_until_human_gate",
      execute_requires_human_gate: true,
      execute_requires_policy_snapshot: true,
      execute_requires_agent_run_ledger_sink: true,
      external_runtime_call_allowed_without_gate: false,
      prompt_delivery: hermesCommandBinding?.prompt_delivery ?? "stdin",
      command_resolution_required: true,
      command_availability_status: hermesRuntimeAdapter?.command_binding?.command_availability_status ?? "not_checked",
      max_retries: hermesRuntimeAdapter?.lifecycle?.max_retries ?? 1,
      timeout_seconds: hermesRuntimeAdapter?.lifecycle?.timeout_seconds ?? 3600,
    },
    collection_policy: buildCollectionPolicy({
      hermesRuntimeAdapter,
      hermesInterface,
      agentRunLedger,
    }),
    desktop_boundary_ref: "hermes-desktop-boundary.hermes",
  };

  const hermesInvocationResultContracts = [
    buildInvocationResultContract({
      hermesRuntimeAdapter,
      hermesRuntimeAdapterContract,
      hermesAgentRunRecords,
      generatedAt,
    }),
  ];
  const hermesAgentRunLedgerBindings = [
    buildAgentRunLedgerBinding({
      hermesRuntimeAdapter,
      hermesRuntimeAdapterContract,
      agentRunLedger,
      hermesAgentRunRecords,
      generatedAt,
    }),
  ];
  const hermesDesktopBoundary = buildDesktopBoundary({
    hermesOperatorPolicy,
    desktopCompanionIntegration,
    generatedAt,
  });

  return {
    hermesInterface,
    hermesOperatorPolicy,
    hermesRuntimeAdapter,
    hermesRuntimeExecutionContract,
    hermesCommandBinding,
    agentRunRecords,
    hermesAgentRunRecords,
    hermesRuntimeAdapterContract,
    hermesInvocationResultContracts,
    hermesAgentRunLedgerBindings,
    hermesDesktopBoundary,
  };
}

function buildCollectionPolicy({ hermesRuntimeAdapter, hermesInterface, agentRunLedger }) {
  return {
    schema_version: "hermes-agent-run-collection-policy.v1",
    sink_ledger: "agent_run_ledger",
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? "agent-run-ledger.v1",
    collect_runtime_invocation_id: true,
    collect_workflow_run_id: true,
    collect_input_ref: true,
    collect_output_ref: true,
    collect_output_hash: hermesRuntimeAdapter?.observability?.output_hash_required ?? hermesInterface?.output_hash_required ?? true,
    collect_logs_ref: hermesRuntimeAdapter?.logs_required ?? hermesInterface?.logs_required ?? true,
    collect_artifact_refs: hermesRuntimeAdapter?.artifact_capture_required ?? hermesInterface?.artifact_capture_required ?? true,
    collect_runtime_verification: hermesRuntimeAdapter?.verification_required ?? hermesInterface?.verification_required ?? true,
    collect_cost_trace: hermesRuntimeAdapter?.observability?.cost_tracking_required ?? true,
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    collection_status: "ready",
  };
}

function buildInvocationResultContract({
  hermesRuntimeAdapter,
  hermesRuntimeAdapterContract,
  hermesAgentRunRecords,
  generatedAt,
}) {
  return {
    schema_version: "hermes-invocation-result-contract.v1",
    generated_at: generatedAt,
    result_contract_id: "hermes-invocation-result.hermes.default",
    runtime_id: HERMES_RUNTIME_ID,
    adapter_id: hermesRuntimeAdapterContract.adapter_id,
    accepted_result_sources: ["runtime-invoker", "hermes-cli", "hermes-local-runtime"],
    result_fields: [
      "runtime_invocation_id",
      "agent_run_id",
      "workflow_run_id",
      "status",
      "exit_code",
      "stdout_hash",
      "stderr_hash",
      "output_hash",
      "logs_ref",
      "artifact_refs",
      "verification_status",
    ],
    agent_run_record_mapping: {
      agent_run_id: "agent_run_record.agent_run_id",
      workflow_run_id: "agent_run_record.workflow_run_id",
      runtime_id: "agent_run_record.runtime_id",
      adapter_id: "agent_run_record.adapter_id",
      output_hash: "agent_run_io_reference.output_hash",
      logs_ref: "agent_run_log_reference.logs_ref",
      artifact_refs: "agent_run_artifact_reference.artifact_uri",
      verification_status: "agent_run_record.verification_status",
    },
    collection_status: "ready",
    current_collected_hermes_agent_run_count: hermesAgentRunRecords.length,
    uncollected_invocation_count: 0,
    output_trust: hermesRuntimeAdapter?.output_trust ?? "untrusted_until_verified",
    verification_required: hermesRuntimeAdapterContract.verification_required,
    contract_status: "locked",
  };
}

function buildAgentRunLedgerBinding({
  hermesRuntimeAdapter,
  hermesRuntimeAdapterContract,
  agentRunLedger,
  hermesAgentRunRecords,
  generatedAt,
}) {
  return {
    schema_version: "hermes-agent-run-ledger-binding.v1",
    generated_at: generatedAt,
    binding_id: "hermes-agent-run-ledger-binding.default",
    runtime_id: HERMES_RUNTIME_ID,
    adapter_id: hermesRuntimeAdapterContract.adapter_id,
    command_binding_id: hermesRuntimeAdapterContract.command_binding_id,
    source_result_contract_id: "hermes-invocation-result.hermes.default",
    sink_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? null,
    sink_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    current_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    current_hermes_agent_run_record_count: hermesAgentRunRecords.length,
    collection_status: "ready",
    output_capture_status: "ready",
    log_capture_status: hermesRuntimeAdapter?.logs_required ? "ready" : "not_required",
    artifact_capture_status: hermesRuntimeAdapter?.artifact_capture_required ? "ready" : "not_required",
    verification_capture_status: hermesRuntimeAdapterContract.verification_required ? "ready" : "not_required",
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    binding_status: "locked",
  };
}

function buildDesktopBoundary({ hermesOperatorPolicy, desktopCompanionIntegration, generatedAt }) {
  return {
    schema_version: "hermes-desktop-boundary.v1",
    generated_at: generatedAt,
    desktop_boundary_id: "hermes-desktop-boundary.hermes",
    runtime_id: HERMES_RUNTIME_ID,
    desktop_surface_policy: hermesOperatorPolicy?.desktop_surface_policy ?? "read_only_runtime_status",
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
    allowed_operator_actions: hermesOperatorPolicy?.allowed_operator_actions ?? ["view_status", "view_logs", "view_artifacts", "view_verification", "draft_receipt_reference"],
    denied_operator_actions: hermesOperatorPolicy?.denied_operator_actions ?? ["execute_runtime", "approve_protected_mutation", "write_secret", "start_gateway", "install_skill", "schedule_cron", "auto_update"],
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
  desktopCompanionIntegration,
  desktopCompanionIntegrationPath,
  projection,
}) {
  return {
    runtime_adapter_interface_v2: {
      schema_version: runtimeAdapterInterfaceV2.schema_version ?? null,
      runtime_adapter_interface_status: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status ?? "unknown",
      hermes_interface_status: projection.hermesInterface?.interface_status ?? "missing",
      hermes_operator_surface_policy_status: projection.hermesOperatorPolicy?.policy_status ?? "missing",
    },
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      hermes_runtime_adapter_found: Boolean(projection.hermesRuntimeAdapter),
      hermes_runtime_execution_contract_found: Boolean(projection.hermesRuntimeExecutionContract),
      current_hermes_agent_run_contract_count: (runtimeAgentRunContractFreeze.runtime_agentrun_contract?.agent_runs ?? []).filter((item) => item.runtime_id === HERMES_RUNTIME_ID).length,
    },
    runtime_command_bindings: {
      schema_version: runtimeCommandBindings.schema_version ?? null,
      binding_registry_id: runtimeCommandBindings.binding_registry_id ?? null,
      hermes_command_binding_found: Boolean(projection.hermesCommandBinding),
      hermes_prompt_delivery: projection.hermesCommandBinding?.prompt_delivery ?? null,
      hermes_candidate_command_count: projection.hermesCommandBinding?.candidate_commands?.length ?? 0,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      current_hermes_agent_run_record_count: projection.hermesAgentRunRecords.length,
    },
    desktop_companion_integration: {
      document_path: desktopCompanionIntegrationPath,
      declares_read_only: desktopCompanionIntegration.includes("읽기 전용") || desktopCompanionIntegration.includes("read_only=true"),
      declares_not_runtime_source_of_truth: desktopCompanionIntegration.includes("source of truth가 아니라") || desktopCompanionIntegration.includes("not a runtime"),
    },
  };
}

function validateHermesRuntimeAdapter({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  desktopCompanionIntegration,
  hermesInterface,
  hermesOperatorPolicy,
  hermesRuntimeAdapter,
  hermesRuntimeExecutionContract,
  hermesCommandBinding,
  hermesRuntimeAdapterContract,
  hermesInvocationResultContracts,
  hermesAgentRunLedgerBindings,
  hermesDesktopBoundary,
}) {
  const items = [];
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_adapter_interface_v2_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_contract_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze is complete."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete", "AgentRun ledger is complete and available as the Hermes result sink."));
  items.push(validationItem("source.runtime_command_bindings", "runtime_command_binding_registry_loaded", runtimeCommandBindings.schema_version === "runtime-command-bindings.v1", "Runtime command binding registry is loaded."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_boundary_documented", desktopCompanionIntegration.includes("source of truth가 아니라") && desktopCompanionIntegration.includes("읽기 전용"), "Desktop companion boundary is documented as read-only and not source of truth."));
  items.push(validationItem("hermes.interface", "hermes_interface_locked", hermesInterface?.interface_status === "locked", "Hermes runtime interface is locked."));
  items.push(validationItem("hermes.interface", "hermes_output_untrusted", hermesInterface?.output_trust === "untrusted_until_verified", "Hermes output remains untrusted until verification."));
  items.push(validationItem("hermes.interface", "hermes_verification_required", hermesInterface?.verification_required === true, "Hermes output requires verification."));
  items.push(validationItem("hermes.runtime_contract", "hermes_runtime_adapter_found", Boolean(hermesRuntimeAdapter), "Hermes runtime adapter exists in Runtime/AgentRun freeze."));
  items.push(validationItem("hermes.runtime_contract", "hermes_execution_contract_found", Boolean(hermesRuntimeExecutionContract), "Hermes runtime execution contract exists."));
  items.push(validationItem("hermes.command_binding", "hermes_command_binding_found", Boolean(hermesCommandBinding), "Hermes command binding is declared."));
  items.push(validationItem("hermes.command_binding", "hermes_command_binding_prompt_delivery_locked", hermesCommandBinding?.prompt_delivery === "stdin", "Hermes command binding uses stdin prompt delivery."));
  items.push(validationItem("hermes.adapter_contract", "hermes_adapter_contract_locked", hermesRuntimeAdapterContract.adapter_status === "locked", "Hermes adapter contract is locked."));
  items.push(validationItem("hermes.adapter_contract", "hermes_execution_requires_human_gate", hermesRuntimeAdapterContract.invocation_policy.execute_requires_human_gate === true, "Hermes execute mode requires a human gate."));
  items.push(validationItem("hermes.adapter_contract", "hermes_agent_run_ledger_sink_required", hermesRuntimeAdapterContract.collection_policy.sink_ledger === "agent_run_ledger" && hermesRuntimeAdapterContract.collection_policy.collect_output_hash === true, "Hermes invocation results are collected into AgentRun ledger fields."));
  items.push(validationItem("hermes.invocation_results", "hermes_invocation_result_contract_locked", hermesInvocationResultContracts.every((contract) => contract.contract_status === "locked" && contract.collection_status === "ready"), "Hermes invocation result contracts are locked and ready."));
  items.push(validationItem("hermes.invocation_results", "no_uncollected_hermes_invocations", hermesInvocationResultContracts.every((contract) => contract.uncollected_invocation_count === 0), "No Hermes invocation result is outside the AgentRun collection contract."));
  items.push(validationItem("hermes.agent_run_ledger_binding", "hermes_agent_run_ledger_binding_locked", hermesAgentRunLedgerBindings.every((binding) => binding.binding_status === "locked" && binding.collection_status === "ready"), "Hermes AgentRun ledger binding is locked."));
  items.push(validationItem("hermes.desktop_boundary", "desktop_read_only", hermesDesktopBoundary.read_only === true && hermesDesktopBoundary.mutation_allowed === false, "Hermes Desktop surface is read-only."));
  items.push(validationItem("hermes.desktop_boundary", "desktop_not_runtime_source_of_truth", hermesDesktopBoundary.runtime_source_of_truth === false && hermesDesktopBoundary.desktop_source_of_truth === false, "Hermes Desktop is not a runtime or source of truth."));
  items.push(validationItem("hermes.desktop_boundary", "desktop_protected_mutations_blocked", hermesDesktopBoundary.protected_mutation_request_allowed === false && hermesDesktopBoundary.protected_mutation_execution_allowed === false, "Hermes Desktop cannot request or execute protected mutations in v1."));
  items.push(validationItem("hermes.desktop_boundary", "desktop_sensitive_controls_absent", hermesDesktopBoundary.secret_material_exposed === false && hermesDesktopBoundary.installer_or_gateway_control === false && hermesDesktopBoundary.ssh_or_cron_control === false && hermesDesktopBoundary.skill_install_control === false, "Hermes Desktop exposes no secrets, installer, gateway, SSH, cron, or skill-install controls."));
  items.push(validationItem("hermes.operator_policy", "operator_policy_read_only", hermesOperatorPolicy?.read_only === true && hermesOperatorPolicy?.runtime_source_of_truth === false, "Hermes operator policy remains read-only and not source of truth."));
  return items;
}

function summarizeHermesRuntimeAdapter(projection, validationItems, validation) {
  const boundary = projection.hermesDesktopBoundary;
  const binding = projection.hermesAgentRunLedgerBindings[0] ?? {};
  const resultContract = projection.hermesInvocationResultContracts[0] ?? {};
  return {
    hermes_runtime_adapter_status: validation.valid ? "complete" : "attention",
    runtime_id: HERMES_RUNTIME_ID,
    adapter_id: projection.hermesRuntimeAdapterContract.adapter_id,
    adapter_status: projection.hermesRuntimeAdapterContract.adapter_status,
    hermes_interface_bound: Boolean(projection.hermesInterface),
    hermes_runtime_execution_contract_bound: Boolean(projection.hermesRuntimeExecutionContract),
    hermes_command_binding_declared: Boolean(projection.hermesCommandBinding),
    command_binding_id: projection.hermesRuntimeAdapterContract.command_binding_id,
    agent_run_ledger_bound: binding.sink_ledger_status === "complete",
    agent_run_ledger_status: binding.sink_ledger_status ?? "unknown",
    current_agent_run_record_count: binding.current_agent_run_record_count ?? 0,
    current_hermes_agent_run_record_count: binding.current_hermes_agent_run_record_count ?? 0,
    invocation_result_contract_count: projection.hermesInvocationResultContracts.length,
    invocation_result_collection_status: resultContract.collection_status ?? "unknown",
    uncollected_invocation_count: resultContract.uncollected_invocation_count ?? 0,
    output_capture_ready: binding.output_capture_status === "ready",
    log_capture_ready: binding.log_capture_status === "ready",
    artifact_capture_ready: binding.artifact_capture_status === "ready",
    verification_capture_ready: binding.verification_capture_status === "ready",
    output_trust: projection.hermesRuntimeAdapterContract.output_trust,
    verification_required: projection.hermesRuntimeAdapterContract.verification_required,
    execute_requires_human_gate: projection.hermesRuntimeAdapterContract.invocation_policy.execute_requires_human_gate,
    external_runtime_call_allowed_without_gate: projection.hermesRuntimeAdapterContract.invocation_policy.external_runtime_call_allowed_without_gate,
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

function renderHermesRuntimeAdapterMarkdown(result) {
  const summary = result.summary;
  return [
    "# Hermes Runtime Adapter",
    "",
    `- Status: ${summary.hermes_runtime_adapter_status}`,
    `- Runtime: ${summary.runtime_id}`,
    `- Adapter: ${summary.adapter_id}`,
    `- Interface bound: ${summary.hermes_interface_bound}`,
    `- AgentRun ledger bound: ${summary.agent_run_ledger_bound}`,
    `- Invocation result contracts: ${summary.invocation_result_contract_count}`,
    `- Current Hermes AgentRun records: ${summary.current_hermes_agent_run_record_count}`,
    `- Output trust: ${summary.output_trust}`,
    `- Execute requires human gate: ${summary.execute_requires_human_gate}`,
    `- Desktop policy: ${summary.desktop_surface_policy}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Desktop runtime source of truth: ${summary.desktop_runtime_source_of_truth}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableHermesRuntimeAdapter(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_HERMES_RUNTIME_ADAPTER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--runtime-adapter-interface-v2") parsed.runtimeAdapterInterfaceV2Path = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--runtime-command-bindings") parsed.runtimeCommandBindingsPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/hermes-runtime-adapter.mjs [options]

Options:
  --runtime-adapter-interface-v2 <path>
                                  Runtime Adapter Interface v2 artifact.
  --runtime-agentrun-contract-freeze <path>
                                  Runtime/AgentRun contract freeze artifact.
  --runtime-command-bindings <path>
                                  Runtime command binding registry.
  --agent-run-ledger <path>       AgentRun ledger artifact.
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

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
