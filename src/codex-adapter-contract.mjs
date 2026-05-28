import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CODEX_ADAPTER_CONTRACT_OUT_DIR = "artifacts/codex-adapter-contract/latest";
export const DEFAULT_CODEX_ADAPTER_CONTRACT_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  runtimeCommandBindingsPath: "examples/core/runtime-command-bindings.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  workflowGateFreezePath: "artifacts/workflow-gate-freeze/latest/workflow-gate-freeze.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const CODEX_RUNTIME_ID = "codex";

export async function runCodexAdapterContract(options = {}) {
  const result = await buildCodexAdapterContract(options);
  if (options.write !== false) await writeCodexAdapterContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Codex adapter contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCodexAdapterContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CODEX_ADAPTER_CONTRACT_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_CODEX_ADAPTER_CONTRACT_INPUTS.runtimeAdapterInterfaceV2Path),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_CODEX_ADAPTER_CONTRACT_INPUTS.runtimeAgentRunContractFreezePath),
    runtime_command_bindings_path: path.resolve(options.runtimeCommandBindingsPath ?? DEFAULT_CODEX_ADAPTER_CONTRACT_INPUTS.runtimeCommandBindingsPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_CODEX_ADAPTER_CONTRACT_INPUTS.agentRunLedgerPath),
    workflow_gate_freeze_path: path.resolve(options.workflowGateFreezePath ?? DEFAULT_CODEX_ADAPTER_CONTRACT_INPUTS.workflowGateFreezePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_CODEX_ADAPTER_CONTRACT_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const runtimeCommandBindings = await readJson(inputs.runtime_command_bindings_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const workflowGateFreeze = await readJson(inputs.workflow_gate_freeze_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");
  const projection = projectCodexAdapterContract({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    runtimeCommandBindings,
    agentRunLedger,
    workflowGateFreeze,
    desktopCompanionIntegration,
    generatedAt,
  });
  const validationItems = validateCodexAdapterContract({
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
    schema_version: "codex-adapter-contract.v1",
    generated_at: generatedAt,
    adapter_projection_id: `codex-adapter-contract.${dateStamp(generatedAt)}`,
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
    codex_adapter_contract: projection.codexAdapterContract,
    codex_patch_gate_contracts: projection.codexPatchGateContracts,
    codex_agent_run_ledger_bindings: projection.codexAgentRunLedgerBindings,
    codex_desktop_boundary: projection.codexDesktopBoundary,
    summary: summarizeCodexAdapterContract(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderCodexAdapterMarkdown(result),
  };
}

export async function writeCodexAdapterContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableCodexAdapterContract(result);
  await writeJson(path.join(outDir, "codex-adapter-contract.json"), serializable);
  await writeJson(path.join(outDir, "codex-patch-gate-contracts.json"), {
    schema_version: "codex-patch-gate-contracts.v1",
    generated_at: result.generated_at,
    contract_count: result.codex_patch_gate_contracts.length,
    codex_patch_gate_contracts: result.codex_patch_gate_contracts,
  });
  await writeJson(path.join(outDir, "codex-agent-run-ledger-bindings.json"), {
    schema_version: "codex-agent-run-ledger-bindings.v1",
    generated_at: result.generated_at,
    binding_count: result.codex_agent_run_ledger_bindings.length,
    codex_agent_run_ledger_bindings: result.codex_agent_run_ledger_bindings,
  });
  await writeJson(path.join(outDir, "codex-desktop-boundary.json"), result.codex_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "codex-adapter-validation-report.v1",
    generated_at: result.generated_at,
    adapter_projection_id: result.adapter_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCodexAdapterContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCodexAdapterContract(args);
    console.log(`Codex adapter contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.codex_adapter_contract_status}`);
    console.log(`AgentRun ledger bound: ${result.summary.agent_run_ledger_bound}`);
    console.log(`Patch gate contracts: ${result.summary.patch_gate_contract_count}`);
    console.log(`Direct apply allowed: ${result.summary.direct_apply_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectCodexAdapterContract({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  generatedAt,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const codexInterface = (interfaceContract.runtime_adapter_interfaces ?? []).find((item) => item.runtime_id === CODEX_RUNTIME_ID) ?? null;
  const codexOperatorPolicy = (interfaceContract.operator_surface_policies ?? []).find((item) => item.runtime_id === CODEX_RUNTIME_ID) ?? null;
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const codexRuntimeAdapter = (runtimeContract.runtime_adapters ?? []).find((item) => item.runtime_id === CODEX_RUNTIME_ID) ?? null;
  const codexRuntimeExecutionContract = (runtimeContract.runtime_execution_contracts ?? []).find((item) => item.runtime_id === CODEX_RUNTIME_ID) ?? null;
  const codexCommandBinding = (runtimeCommandBindings.bindings ?? []).find((item) => item.runtime_id === CODEX_RUNTIME_ID) ?? null;
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const codexAgentRunRecords = agentRunRecords.filter((record) => record.runtime_id === CODEX_RUNTIME_ID);
  const workflowGateVerticalSlices = workflowGateFreeze.workflow_gate_vertical_slices ?? [];
  const requiredGates = unique([
    ...(codexRuntimeAdapter?.verification?.required_gates ?? []),
    "human_approval_gate",
  ]);
  const codexAdapterContract = {
    schema_version: "codex-adapter-contract.v1",
    generated_at: generatedAt,
    contract_id: "codex-adapter-contract.default",
    runtime_id: CODEX_RUNTIME_ID,
    adapter_id: codexRuntimeAdapter?.adapter_id ?? "runtime.codex.default",
    adapter_interface_id: codexInterface?.interface_id ?? null,
    runtime_execution_contract_id: codexRuntimeExecutionContract?.execution_contract_id ?? codexInterface?.execution_contract_id ?? null,
    command_binding_id: codexCommandBinding?.binding_id ?? null,
    adapter_status: "locked",
    execution_authority: "harness_control_plane",
    source_of_truth: "agent_run_ledger",
    output_trust: codexRuntimeAdapter?.output_trust ?? codexInterface?.output_trust ?? "untrusted_until_verified",
    patch_trust: "untrusted_until_reviewed",
    verification_required: codexRuntimeAdapter?.verification_required ?? codexInterface?.verification_required ?? true,
    required_gates: requiredGates,
    lane_policy: {
      schema_version: "codex-lane-policy.v1",
      output_mode: "patch_or_pr_draft_only",
      direct_apply_allowed: false,
      direct_merge_allowed: false,
      protected_path_write_allowed: false,
      execute_requires_git_worktree: codexCommandBinding?.execute_requires_git_worktree === true,
      execute_requires_human_gate: true,
      execute_requires_policy_snapshot: true,
      execute_requires_agent_run_ledger_sink: true,
      external_runtime_call_allowed_without_gate: false,
      patch_materialized_as_untrusted_artifact: true,
      runtime_self_report_trusted: false,
      prompt_delivery: codexCommandBinding?.prompt_delivery ?? "stdin",
      command_resolution_required: true,
      timeout_seconds: codexRuntimeAdapter?.lifecycle?.timeout_seconds ?? 3600,
    },
    patch_gate_policy: {
      schema_version: "codex-patch-gate-policy.v1",
      change_target: "review_patch",
      mutation_route: "protected_action_request_only",
      merge_authority: "human_gate",
      acceptance_authority: codexRuntimeAdapter?.verification?.acceptance_authority ?? "gate_engine",
      required_gates: requiredGates,
      protected_file_gate_required: requiredGates.includes("protected_file_gate"),
      diff_review_gate_required: requiredGates.includes("diff_review_gate"),
      test_gate_required: requiredGates.includes("test_gate"),
      human_approval_gate_required: requiredGates.includes("human_approval_gate"),
      bypass_allowed: false,
      gate_binding_status: "ready",
    },
    collection_policy: buildCollectionPolicy({
      codexRuntimeAdapter,
      codexInterface,
      agentRunLedger,
    }),
    desktop_boundary_ref: "codex-desktop-boundary.codex",
  };
  const codexPatchGateContracts = [
    buildPatchGateContract({
      codexAdapterContract,
      codexAgentRunRecords,
      workflowGateVerticalSlices,
      generatedAt,
    }),
  ];
  const codexAgentRunLedgerBindings = [
    buildAgentRunLedgerBinding({
      codexAdapterContract,
      agentRunLedger,
      codexAgentRunRecords,
      generatedAt,
    }),
  ];
  const codexDesktopBoundary = buildDesktopBoundary({
    codexOperatorPolicy,
    desktopCompanionIntegration,
    generatedAt,
  });
  return {
    codexInterface,
    codexOperatorPolicy,
    codexRuntimeAdapter,
    codexRuntimeExecutionContract,
    codexCommandBinding,
    agentRunRecords,
    codexAgentRunRecords,
    workflowGateVerticalSlices,
    codexAdapterContract,
    codexPatchGateContracts,
    codexAgentRunLedgerBindings,
    codexDesktopBoundary,
  };
}

function buildCollectionPolicy({ codexRuntimeAdapter, codexInterface, agentRunLedger }) {
  return {
    schema_version: "codex-agent-run-collection-policy.v1",
    sink_ledger: "agent_run_ledger",
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? "agent-run-ledger.v1",
    collect_runtime_invocation_id: true,
    collect_workflow_run_id: true,
    collect_input_ref: true,
    collect_output_ref: true,
    collect_output_hash: codexRuntimeAdapter?.observability?.output_hash_required ?? codexInterface?.output_hash_required ?? true,
    collect_logs_ref: codexRuntimeAdapter?.logs_required ?? codexInterface?.logs_required ?? true,
    collect_artifact_refs: codexRuntimeAdapter?.artifact_capture_required ?? codexInterface?.artifact_capture_required ?? true,
    collect_runtime_verification: codexRuntimeAdapter?.verification_required ?? codexInterface?.verification_required ?? true,
    collect_patch_review_status: true,
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    collection_status: "ready",
  };
}

function buildPatchGateContract({
  codexAdapterContract,
  codexAgentRunRecords,
  workflowGateVerticalSlices,
  generatedAt,
}) {
  const requiredGates = codexAdapterContract.patch_gate_policy.required_gates;
  return {
    schema_version: "codex-patch-gate-contract.v1",
    generated_at: generatedAt,
    patch_gate_contract_id: "codex-patch-gate.codex.default",
    runtime_id: CODEX_RUNTIME_ID,
    adapter_id: codexAdapterContract.adapter_id,
    change_target: "review_patch",
    patch_output_trust: "untrusted_until_verified",
    direct_apply_allowed: false,
    direct_merge_allowed: false,
    protected_path_write_allowed: false,
    human_review_required: true,
    protected_file_gate_required: requiredGates.includes("protected_file_gate"),
    diff_review_gate_required: requiredGates.includes("diff_review_gate"),
    test_gate_required: requiredGates.includes("test_gate"),
    human_approval_gate_required: requiredGates.includes("human_approval_gate"),
    required_gates: requiredGates,
    gate_binding_status: "ready",
    workflow_gate_vertical_slice_refs: workflowGateVerticalSlices.map((slice) => slice.workflow_gate_vertical_slice_id).filter(Boolean),
    current_codex_agent_run_count: codexAgentRunRecords.length,
    unreviewed_auto_apply_count: 0,
    contract_status: "locked",
  };
}

function buildAgentRunLedgerBinding({
  codexAdapterContract,
  agentRunLedger,
  codexAgentRunRecords,
  generatedAt,
}) {
  return {
    schema_version: "codex-agent-run-ledger-binding.v1",
    generated_at: generatedAt,
    binding_id: "codex-agent-run-ledger-binding.default",
    runtime_id: CODEX_RUNTIME_ID,
    adapter_id: codexAdapterContract.adapter_id,
    command_binding_id: codexAdapterContract.command_binding_id,
    source_patch_gate_contract_id: "codex-patch-gate.codex.default",
    sink_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? null,
    sink_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    current_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    current_codex_agent_run_record_count: codexAgentRunRecords.length,
    collection_status: "ready",
    output_capture_status: "ready",
    log_capture_status: "ready",
    artifact_capture_status: "ready",
    verification_capture_status: "ready",
    patch_review_capture_status: "ready",
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    binding_status: "locked",
  };
}

function buildDesktopBoundary({ codexOperatorPolicy, desktopCompanionIntegration, generatedAt }) {
  return {
    schema_version: "codex-desktop-boundary.v1",
    generated_at: generatedAt,
    desktop_boundary_id: "codex-desktop-boundary.codex",
    runtime_id: CODEX_RUNTIME_ID,
    desktop_surface_policy: codexOperatorPolicy?.desktop_surface_policy ?? "read_only_runtime_status",
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
    allowed_operator_actions: codexOperatorPolicy?.allowed_operator_actions ?? ["view_status", "view_logs", "view_artifacts", "view_verification", "draft_receipt_reference"],
    denied_operator_actions: unique([
      ...(codexOperatorPolicy?.denied_operator_actions ?? []),
      "apply_patch",
      "merge_pr",
      "approve_protected_file_change",
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
      codex_interface_status: projection.codexInterface?.interface_status ?? "missing",
      codex_operator_surface_policy_status: projection.codexOperatorPolicy?.policy_status ?? "missing",
    },
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      codex_runtime_adapter_found: Boolean(projection.codexRuntimeAdapter),
      codex_runtime_execution_contract_found: Boolean(projection.codexRuntimeExecutionContract),
      current_codex_agent_run_contract_count: (runtimeAgentRunContractFreeze.runtime_agentrun_contract?.agent_runs ?? []).filter((item) => item.runtime_id === CODEX_RUNTIME_ID).length,
    },
    runtime_command_bindings: {
      schema_version: runtimeCommandBindings.schema_version ?? null,
      binding_registry_id: runtimeCommandBindings.binding_registry_id ?? null,
      codex_command_binding_found: Boolean(projection.codexCommandBinding),
      codex_prompt_delivery: projection.codexCommandBinding?.prompt_delivery ?? null,
      codex_execute_requires_git_worktree: projection.codexCommandBinding?.execute_requires_git_worktree === true,
      codex_candidate_command_count: projection.codexCommandBinding?.candidate_commands?.length ?? 0,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      current_codex_agent_run_record_count: projection.codexAgentRunRecords.length,
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

function validateCodexAdapterContract({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  codexInterface,
  codexOperatorPolicy,
  codexRuntimeAdapter,
  codexRuntimeExecutionContract,
  codexCommandBinding,
  codexAdapterContract,
  codexPatchGateContracts,
  codexAgentRunLedgerBindings,
  codexDesktopBoundary,
}) {
  const items = [];
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_adapter_interface_v2_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_contract_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze is complete."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete", "AgentRun ledger is complete and available as the Codex result sink."));
  items.push(validationItem("source.workflow_gate_freeze", "workflow_gate_freeze_complete", workflowGateFreeze.summary?.workflow_gate_freeze_status === "complete", "Workflow/Gate freeze is complete."));
  items.push(validationItem("source.runtime_command_bindings", "runtime_command_binding_registry_loaded", runtimeCommandBindings.schema_version === "runtime-command-bindings.v1", "Runtime command binding registry is loaded."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_boundary_documented", desktopCompanionIntegration.includes("source of truth가 아니라") && desktopCompanionIntegration.includes("읽기 전용"), "Desktop companion boundary is documented as read-only and not source of truth."));
  items.push(validationItem("codex.interface", "codex_interface_locked", codexInterface?.interface_status === "locked", "Codex runtime interface is locked."));
  items.push(validationItem("codex.interface", "codex_output_untrusted", codexInterface?.output_trust === "untrusted_until_verified", "Codex output remains untrusted until verification."));
  items.push(validationItem("codex.interface", "codex_verification_required", codexInterface?.verification_required === true, "Codex output requires verification."));
  items.push(validationItem("codex.runtime_contract", "codex_runtime_adapter_found", Boolean(codexRuntimeAdapter), "Codex runtime adapter exists in Runtime/AgentRun freeze."));
  items.push(validationItem("codex.runtime_contract", "codex_execution_contract_found", Boolean(codexRuntimeExecutionContract), "Codex runtime execution contract exists."));
  items.push(validationItem("codex.runtime_contract", "codex_git_worktree_isolation", codexRuntimeAdapter?.workspace_policy?.isolation_type === "git_worktree", "Codex uses git worktree isolation."));
  items.push(validationItem("codex.command_binding", "codex_command_binding_found", Boolean(codexCommandBinding), "Codex command binding is declared."));
  items.push(validationItem("codex.command_binding", "codex_command_binding_prompt_delivery_locked", codexCommandBinding?.prompt_delivery === "stdin", "Codex command binding uses stdin prompt delivery."));
  items.push(validationItem("codex.command_binding", "codex_execute_requires_git_worktree", codexCommandBinding?.execute_requires_git_worktree === true, "Codex execute mode requires git worktree isolation."));
  items.push(validationItem("codex.adapter_contract", "codex_adapter_contract_locked", codexAdapterContract.adapter_status === "locked", "Codex adapter contract is locked."));
  items.push(validationItem("codex.adapter_contract", "codex_direct_apply_blocked", codexAdapterContract.lane_policy.direct_apply_allowed === false && codexAdapterContract.lane_policy.direct_merge_allowed === false, "Codex cannot apply or merge its own patch."));
  items.push(validationItem("codex.adapter_contract", "codex_patch_untrusted", codexAdapterContract.patch_trust === "untrusted_until_reviewed" && codexAdapterContract.output_trust === "untrusted_until_verified", "Codex patch output remains untrusted."));
  items.push(validationItem("codex.adapter_contract", "codex_agent_run_ledger_sink_required", codexAdapterContract.collection_policy.sink_ledger === "agent_run_ledger" && codexAdapterContract.collection_policy.collect_patch_review_status === true, "Codex patch outputs are collected into AgentRun ledger references."));
  items.push(validationItem("codex.patch_gate", "codex_patch_gate_contract_locked", codexPatchGateContracts.every((contract) => contract.contract_status === "locked" && contract.gate_binding_status === "ready"), "Codex patch gate contract is locked and ready."));
  items.push(validationItem("codex.patch_gate", "codex_patch_gate_required", codexPatchGateContracts.every((contract) => contract.protected_file_gate_required && contract.diff_review_gate_required && contract.test_gate_required && contract.human_review_required), "Codex patch output requires protected file, diff review, test, and human review gates."));
  items.push(validationItem("codex.patch_gate", "no_auto_apply", codexPatchGateContracts.every((contract) => contract.unreviewed_auto_apply_count === 0 && contract.direct_apply_allowed === false), "No Codex patch may be auto-applied."));
  items.push(validationItem("codex.agent_run_ledger_binding", "codex_agent_run_ledger_binding_locked", codexAgentRunLedgerBindings.every((binding) => binding.binding_status === "locked" && binding.collection_status === "ready"), "Codex AgentRun ledger binding is locked."));
  items.push(validationItem("codex.desktop_boundary", "desktop_read_only", codexDesktopBoundary.read_only === true && codexDesktopBoundary.mutation_allowed === false, "Codex Desktop surface is read-only."));
  items.push(validationItem("codex.desktop_boundary", "desktop_not_runtime_source_of_truth", codexDesktopBoundary.runtime_source_of_truth === false && codexDesktopBoundary.desktop_source_of_truth === false, "Desktop is not a runtime or source of truth for Codex."));
  items.push(validationItem("codex.desktop_boundary", "desktop_protected_mutations_blocked", codexDesktopBoundary.protected_mutation_request_allowed === false && codexDesktopBoundary.protected_mutation_execution_allowed === false, "Desktop cannot request or execute protected Codex mutations in v1."));
  items.push(validationItem("codex.desktop_boundary", "desktop_sensitive_controls_absent", codexDesktopBoundary.secret_material_exposed === false && codexDesktopBoundary.installer_or_gateway_control === false && codexDesktopBoundary.ssh_or_cron_control === false && codexDesktopBoundary.skill_install_control === false, "Desktop exposes no secrets, installer, gateway, SSH, cron, or skill-install controls."));
  items.push(validationItem("codex.operator_policy", "operator_policy_read_only", codexOperatorPolicy?.read_only === true && codexOperatorPolicy?.runtime_source_of_truth === false, "Codex operator policy remains read-only and not source of truth."));
  return items;
}

function summarizeCodexAdapterContract(projection, validationItems, validation) {
  const boundary = projection.codexDesktopBoundary;
  const binding = projection.codexAgentRunLedgerBindings[0] ?? {};
  const patchGate = projection.codexPatchGateContracts[0] ?? {};
  return {
    codex_adapter_contract_status: validation.valid ? "complete" : "attention",
    runtime_id: CODEX_RUNTIME_ID,
    adapter_id: projection.codexAdapterContract.adapter_id,
    adapter_status: projection.codexAdapterContract.adapter_status,
    codex_interface_bound: Boolean(projection.codexInterface),
    codex_runtime_execution_contract_bound: Boolean(projection.codexRuntimeExecutionContract),
    codex_command_binding_declared: Boolean(projection.codexCommandBinding),
    command_binding_id: projection.codexAdapterContract.command_binding_id,
    agent_run_ledger_bound: binding.sink_ledger_status === "complete",
    agent_run_ledger_status: binding.sink_ledger_status ?? "unknown",
    current_agent_run_record_count: binding.current_agent_run_record_count ?? 0,
    current_codex_agent_run_record_count: binding.current_codex_agent_run_record_count ?? 0,
    patch_gate_contract_count: projection.codexPatchGateContracts.length,
    patch_gate_binding_status: patchGate.gate_binding_status ?? "unknown",
    direct_apply_allowed: projection.codexAdapterContract.lane_policy.direct_apply_allowed,
    direct_merge_allowed: projection.codexAdapterContract.lane_policy.direct_merge_allowed,
    protected_path_write_allowed: projection.codexAdapterContract.lane_policy.protected_path_write_allowed,
    patch_materialized_as_untrusted_artifact: projection.codexAdapterContract.lane_policy.patch_materialized_as_untrusted_artifact,
    output_trust: projection.codexAdapterContract.output_trust,
    patch_trust: projection.codexAdapterContract.patch_trust,
    verification_required: projection.codexAdapterContract.verification_required,
    execute_requires_git_worktree: projection.codexAdapterContract.lane_policy.execute_requires_git_worktree,
    execute_requires_human_gate: projection.codexAdapterContract.lane_policy.execute_requires_human_gate,
    external_runtime_call_allowed_without_gate: projection.codexAdapterContract.lane_policy.external_runtime_call_allowed_without_gate,
    protected_file_gate_required: patchGate.protected_file_gate_required ?? false,
    diff_review_gate_required: patchGate.diff_review_gate_required ?? false,
    test_gate_required: patchGate.test_gate_required ?? false,
    human_review_required: patchGate.human_review_required ?? false,
    unreviewed_auto_apply_count: patchGate.unreviewed_auto_apply_count ?? 0,
    output_capture_ready: binding.output_capture_status === "ready",
    log_capture_ready: binding.log_capture_status === "ready",
    artifact_capture_ready: binding.artifact_capture_status === "ready",
    verification_capture_ready: binding.verification_capture_status === "ready",
    patch_review_capture_ready: binding.patch_review_capture_status === "ready",
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

function renderCodexAdapterMarkdown(result) {
  const summary = result.summary;
  return [
    "# Codex Adapter Contract",
    "",
    `- Status: ${summary.codex_adapter_contract_status}`,
    `- Runtime: ${summary.runtime_id}`,
    `- Adapter: ${summary.adapter_id}`,
    `- Interface bound: ${summary.codex_interface_bound}`,
    `- AgentRun ledger bound: ${summary.agent_run_ledger_bound}`,
    `- Current Codex AgentRun records: ${summary.current_codex_agent_run_record_count}`,
    `- Output trust: ${summary.output_trust}`,
    `- Patch trust: ${summary.patch_trust}`,
    `- Direct apply allowed: ${summary.direct_apply_allowed}`,
    `- Patch gate required: ${summary.diff_review_gate_required}`,
    `- Test gate required: ${summary.test_gate_required}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Desktop runtime source of truth: ${summary.desktop_runtime_source_of_truth}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableCodexAdapterContract(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_CODEX_ADAPTER_CONTRACT_OUT_DIR,
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
  console.log(`Usage: node scripts/codex-adapter-contract.mjs [options]

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

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
