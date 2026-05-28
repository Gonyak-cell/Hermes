import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_OUT_DIR = "artifacts/claude-code-adapter-contract/latest";
export const DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  runtimeCommandBindingsPath: "examples/core/runtime-command-bindings.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  workflowGateFreezePath: "artifacts/workflow-gate-freeze/latest/workflow-gate-freeze.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const CLAUDE_CODE_RUNTIME_ID = "claude_code";

export async function runClaudeCodeAdapterContract(options = {}) {
  const result = await buildClaudeCodeAdapterContract(options);
  if (options.write !== false) await writeClaudeCodeAdapterContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Claude Code adapter contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildClaudeCodeAdapterContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_INPUTS.runtimeAdapterInterfaceV2Path),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_INPUTS.runtimeAgentRunContractFreezePath),
    runtime_command_bindings_path: path.resolve(options.runtimeCommandBindingsPath ?? DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_INPUTS.runtimeCommandBindingsPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_INPUTS.agentRunLedgerPath),
    workflow_gate_freeze_path: path.resolve(options.workflowGateFreezePath ?? DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_INPUTS.workflowGateFreezePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const runtimeCommandBindings = await readJson(inputs.runtime_command_bindings_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const workflowGateFreeze = await readJson(inputs.workflow_gate_freeze_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectClaudeCodeAdapterContract({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    runtimeCommandBindings,
    agentRunLedger,
    workflowGateFreeze,
    desktopCompanionIntegration,
    generatedAt,
  });
  const validationItems = validateClaudeCodeAdapterContract({
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
    schema_version: "claude-code-adapter-contract.v1",
    generated_at: generatedAt,
    adapter_projection_id: `claude-code-adapter-contract.${dateStamp(generatedAt)}`,
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
    claude_code_adapter_contract: projection.claudeCodeAdapterContract,
    claude_code_diff_gate_contracts: projection.claudeCodeDiffGateContracts,
    claude_code_agent_run_ledger_bindings: projection.claudeCodeAgentRunLedgerBindings,
    claude_code_desktop_boundary: projection.claudeCodeDesktopBoundary,
    summary: summarizeClaudeCodeAdapterContract(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderClaudeCodeAdapterMarkdown(result),
  };
}

export async function writeClaudeCodeAdapterContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableClaudeCodeAdapterContract(result);
  await writeJson(path.join(outDir, "claude-code-adapter-contract.json"), serializable);
  await writeJson(path.join(outDir, "claude-code-diff-gate-contracts.json"), {
    schema_version: "claude-code-diff-gate-contracts.v1",
    generated_at: result.generated_at,
    contract_count: result.claude_code_diff_gate_contracts.length,
    claude_code_diff_gate_contracts: result.claude_code_diff_gate_contracts,
  });
  await writeJson(path.join(outDir, "claude-code-agent-run-ledger-bindings.json"), {
    schema_version: "claude-code-agent-run-ledger-bindings.v1",
    generated_at: result.generated_at,
    binding_count: result.claude_code_agent_run_ledger_bindings.length,
    claude_code_agent_run_ledger_bindings: result.claude_code_agent_run_ledger_bindings,
  });
  await writeJson(path.join(outDir, "claude-code-desktop-boundary.json"), result.claude_code_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "claude-code-adapter-validation-report.v1",
    generated_at: result.generated_at,
    adapter_projection_id: result.adapter_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runClaudeCodeAdapterContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runClaudeCodeAdapterContract(args);
    console.log(`Claude Code adapter contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.claude_code_adapter_contract_status}`);
    console.log(`AgentRun ledger bound: ${result.summary.agent_run_ledger_bound}`);
    console.log(`Diff gate contracts: ${result.summary.diff_gate_contract_count}`);
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

function projectClaudeCodeAdapterContract({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  generatedAt,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const claudeCodeInterface = (interfaceContract.runtime_adapter_interfaces ?? []).find((item) => item.runtime_id === CLAUDE_CODE_RUNTIME_ID) ?? null;
  const claudeCodeOperatorPolicy = (interfaceContract.operator_surface_policies ?? []).find((item) => item.runtime_id === CLAUDE_CODE_RUNTIME_ID) ?? null;
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const claudeCodeRuntimeAdapter = (runtimeContract.runtime_adapters ?? []).find((item) => item.runtime_id === CLAUDE_CODE_RUNTIME_ID) ?? null;
  const claudeCodeRuntimeExecutionContract = (runtimeContract.runtime_execution_contracts ?? []).find((item) => item.runtime_id === CLAUDE_CODE_RUNTIME_ID) ?? null;
  const claudeCodeCommandBinding = (runtimeCommandBindings.bindings ?? []).find((item) => item.runtime_id === CLAUDE_CODE_RUNTIME_ID) ?? null;
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const claudeCodeAgentRunRecords = agentRunRecords.filter((record) => record.runtime_id === CLAUDE_CODE_RUNTIME_ID);
  const workflowGateVerticalSlices = workflowGateFreeze.workflow_gate_vertical_slices ?? [];
  const requiredGates = unique([
    ...(claudeCodeRuntimeAdapter?.verification?.required_gates ?? []),
    "human_approval_gate",
  ]);

  const claudeCodeAdapterContract = {
    schema_version: "claude-code-adapter-contract.v1",
    generated_at: generatedAt,
    contract_id: "claude-code-adapter-contract.default",
    runtime_id: CLAUDE_CODE_RUNTIME_ID,
    adapter_id: claudeCodeRuntimeAdapter?.adapter_id ?? "runtime.claude_code.default",
    adapter_interface_id: claudeCodeInterface?.interface_id ?? null,
    runtime_execution_contract_id: claudeCodeRuntimeExecutionContract?.execution_contract_id ?? claudeCodeInterface?.execution_contract_id ?? null,
    command_binding_id: claudeCodeCommandBinding?.binding_id ?? null,
    adapter_status: "locked",
    execution_authority: "harness_control_plane",
    source_of_truth: "agent_run_ledger",
    output_trust: claudeCodeRuntimeAdapter?.output_trust ?? claudeCodeInterface?.output_trust ?? "untrusted_until_verified",
    patch_trust: "untrusted_until_reviewed",
    verification_required: claudeCodeRuntimeAdapter?.verification_required ?? claudeCodeInterface?.verification_required ?? true,
    required_gates: requiredGates,
    lane_policy: {
      schema_version: "claude-code-lane-policy.v1",
      output_mode: "diff_or_pr_draft_only",
      direct_apply_allowed: false,
      direct_merge_allowed: false,
      protected_path_write_allowed: false,
      execute_requires_git_worktree: claudeCodeCommandBinding?.execute_requires_git_worktree === true,
      execute_requires_human_gate: true,
      execute_requires_policy_snapshot: true,
      execute_requires_agent_run_ledger_sink: true,
      external_runtime_call_allowed_without_gate: false,
      patch_materialized_as_untrusted_artifact: true,
      runtime_self_report_trusted: false,
      prompt_delivery: claudeCodeCommandBinding?.prompt_delivery ?? "stdin",
      command_resolution_required: true,
      timeout_seconds: claudeCodeRuntimeAdapter?.lifecycle?.timeout_seconds ?? 3600,
    },
    diff_gate_policy: {
      schema_version: "claude-code-diff-gate-policy.v1",
      change_target: "review_diff",
      mutation_route: "protected_action_request_only",
      merge_authority: "human_gate",
      acceptance_authority: claudeCodeRuntimeAdapter?.verification?.acceptance_authority ?? "gate_engine",
      required_gates: requiredGates,
      protected_file_gate_required: requiredGates.includes("protected_file_gate"),
      diff_review_gate_required: requiredGates.includes("diff_review_gate"),
      test_gate_required: requiredGates.includes("test_gate"),
      human_approval_gate_required: requiredGates.includes("human_approval_gate"),
      bypass_allowed: false,
      gate_binding_status: "ready",
    },
    collection_policy: buildCollectionPolicy({
      claudeCodeRuntimeAdapter,
      claudeCodeInterface,
      agentRunLedger,
    }),
    desktop_boundary_ref: "claude-code-desktop-boundary.claude_code",
  };

  const claudeCodeDiffGateContracts = [
    buildDiffGateContract({
      claudeCodeAdapterContract,
      claudeCodeAgentRunRecords,
      workflowGateVerticalSlices,
      generatedAt,
    }),
  ];
  const claudeCodeAgentRunLedgerBindings = [
    buildAgentRunLedgerBinding({
      claudeCodeAdapterContract,
      agentRunLedger,
      claudeCodeAgentRunRecords,
      generatedAt,
    }),
  ];
  const claudeCodeDesktopBoundary = buildDesktopBoundary({
    claudeCodeOperatorPolicy,
    desktopCompanionIntegration,
    generatedAt,
  });

  return {
    claudeCodeInterface,
    claudeCodeOperatorPolicy,
    claudeCodeRuntimeAdapter,
    claudeCodeRuntimeExecutionContract,
    claudeCodeCommandBinding,
    agentRunRecords,
    claudeCodeAgentRunRecords,
    workflowGateVerticalSlices,
    claudeCodeAdapterContract,
    claudeCodeDiffGateContracts,
    claudeCodeAgentRunLedgerBindings,
    claudeCodeDesktopBoundary,
  };
}

function buildCollectionPolicy({ claudeCodeRuntimeAdapter, claudeCodeInterface, agentRunLedger }) {
  return {
    schema_version: "claude-code-agent-run-collection-policy.v1",
    sink_ledger: "agent_run_ledger",
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? "agent-run-ledger.v1",
    collect_runtime_invocation_id: true,
    collect_workflow_run_id: true,
    collect_input_ref: true,
    collect_output_ref: true,
    collect_output_hash: claudeCodeRuntimeAdapter?.observability?.output_hash_required ?? claudeCodeInterface?.output_hash_required ?? true,
    collect_logs_ref: claudeCodeRuntimeAdapter?.logs_required ?? claudeCodeInterface?.logs_required ?? true,
    collect_artifact_refs: claudeCodeRuntimeAdapter?.artifact_capture_required ?? claudeCodeInterface?.artifact_capture_required ?? true,
    collect_runtime_verification: claudeCodeRuntimeAdapter?.verification_required ?? claudeCodeInterface?.verification_required ?? true,
    collect_diff_review_status: true,
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    collection_status: "ready",
  };
}

function buildDiffGateContract({
  claudeCodeAdapterContract,
  claudeCodeAgentRunRecords,
  workflowGateVerticalSlices,
  generatedAt,
}) {
  const requiredGates = claudeCodeAdapterContract.diff_gate_policy.required_gates;
  return {
    schema_version: "claude-code-diff-gate-contract.v1",
    generated_at: generatedAt,
    diff_gate_contract_id: "claude-code-diff-gate.claude_code.default",
    runtime_id: CLAUDE_CODE_RUNTIME_ID,
    adapter_id: claudeCodeAdapterContract.adapter_id,
    change_target: "review_diff",
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
    current_claude_code_agent_run_count: claudeCodeAgentRunRecords.length,
    unreviewed_auto_apply_count: 0,
    contract_status: "locked",
  };
}

function buildAgentRunLedgerBinding({
  claudeCodeAdapterContract,
  agentRunLedger,
  claudeCodeAgentRunRecords,
  generatedAt,
}) {
  return {
    schema_version: "claude-code-agent-run-ledger-binding.v1",
    generated_at: generatedAt,
    binding_id: "claude-code-agent-run-ledger-binding.default",
    runtime_id: CLAUDE_CODE_RUNTIME_ID,
    adapter_id: claudeCodeAdapterContract.adapter_id,
    command_binding_id: claudeCodeAdapterContract.command_binding_id,
    source_diff_gate_contract_id: "claude-code-diff-gate.claude_code.default",
    sink_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? null,
    sink_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    current_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    current_claude_code_agent_run_record_count: claudeCodeAgentRunRecords.length,
    collection_status: "ready",
    output_capture_status: "ready",
    log_capture_status: "ready",
    artifact_capture_status: "ready",
    verification_capture_status: "ready",
    diff_review_capture_status: "ready",
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    binding_status: "locked",
  };
}

function buildDesktopBoundary({ claudeCodeOperatorPolicy, desktopCompanionIntegration, generatedAt }) {
  return {
    schema_version: "claude-code-desktop-boundary.v1",
    generated_at: generatedAt,
    desktop_boundary_id: "claude-code-desktop-boundary.claude_code",
    runtime_id: CLAUDE_CODE_RUNTIME_ID,
    desktop_surface_policy: claudeCodeOperatorPolicy?.desktop_surface_policy ?? "read_only_runtime_status",
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
    allowed_operator_actions: claudeCodeOperatorPolicy?.allowed_operator_actions ?? ["view_status", "view_logs", "view_artifacts", "view_verification", "draft_receipt_reference"],
    denied_operator_actions: unique([
      ...(claudeCodeOperatorPolicy?.denied_operator_actions ?? []),
      "apply_diff",
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
      claude_code_interface_status: projection.claudeCodeInterface?.interface_status ?? "missing",
      claude_code_operator_surface_policy_status: projection.claudeCodeOperatorPolicy?.policy_status ?? "missing",
    },
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      claude_code_runtime_adapter_found: Boolean(projection.claudeCodeRuntimeAdapter),
      claude_code_runtime_execution_contract_found: Boolean(projection.claudeCodeRuntimeExecutionContract),
      current_claude_code_agent_run_contract_count: (runtimeAgentRunContractFreeze.runtime_agentrun_contract?.agent_runs ?? []).filter((item) => item.runtime_id === CLAUDE_CODE_RUNTIME_ID).length,
    },
    runtime_command_bindings: {
      schema_version: runtimeCommandBindings.schema_version ?? null,
      binding_registry_id: runtimeCommandBindings.binding_registry_id ?? null,
      claude_code_command_binding_found: Boolean(projection.claudeCodeCommandBinding),
      claude_code_prompt_delivery: projection.claudeCodeCommandBinding?.prompt_delivery ?? null,
      claude_code_execute_requires_git_worktree: projection.claudeCodeCommandBinding?.execute_requires_git_worktree === true,
      claude_code_candidate_command_count: projection.claudeCodeCommandBinding?.candidate_commands?.length ?? 0,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      current_claude_code_agent_run_record_count: projection.claudeCodeAgentRunRecords.length,
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

function validateClaudeCodeAdapterContract({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  claudeCodeInterface,
  claudeCodeOperatorPolicy,
  claudeCodeRuntimeAdapter,
  claudeCodeRuntimeExecutionContract,
  claudeCodeCommandBinding,
  claudeCodeAdapterContract,
  claudeCodeDiffGateContracts,
  claudeCodeAgentRunLedgerBindings,
  claudeCodeDesktopBoundary,
}) {
  const items = [];
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_adapter_interface_v2_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_contract_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze is complete."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete", "AgentRun ledger is complete and available as the Claude Code result sink."));
  items.push(validationItem("source.workflow_gate_freeze", "workflow_gate_freeze_complete", workflowGateFreeze.summary?.workflow_gate_freeze_status === "complete", "Workflow/Gate freeze is complete."));
  items.push(validationItem("source.runtime_command_bindings", "runtime_command_binding_registry_loaded", runtimeCommandBindings.schema_version === "runtime-command-bindings.v1", "Runtime command binding registry is loaded."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_boundary_documented", desktopCompanionIntegration.includes("source of truth가 아니라") && desktopCompanionIntegration.includes("읽기 전용"), "Desktop companion boundary is documented as read-only and not source of truth."));
  items.push(validationItem("claude_code.interface", "claude_code_interface_locked", claudeCodeInterface?.interface_status === "locked", "Claude Code runtime interface is locked."));
  items.push(validationItem("claude_code.interface", "claude_code_output_untrusted", claudeCodeInterface?.output_trust === "untrusted_until_verified", "Claude Code output remains untrusted until verification."));
  items.push(validationItem("claude_code.interface", "claude_code_verification_required", claudeCodeInterface?.verification_required === true, "Claude Code output requires verification."));
  items.push(validationItem("claude_code.runtime_contract", "claude_code_runtime_adapter_found", Boolean(claudeCodeRuntimeAdapter), "Claude Code runtime adapter exists in Runtime/AgentRun freeze."));
  items.push(validationItem("claude_code.runtime_contract", "claude_code_execution_contract_found", Boolean(claudeCodeRuntimeExecutionContract), "Claude Code runtime execution contract exists."));
  items.push(validationItem("claude_code.runtime_contract", "claude_code_git_worktree_isolation", claudeCodeRuntimeAdapter?.workspace_policy?.isolation_type === "git_worktree", "Claude Code uses git worktree isolation."));
  items.push(validationItem("claude_code.command_binding", "claude_code_command_binding_found", Boolean(claudeCodeCommandBinding), "Claude Code command binding is declared."));
  items.push(validationItem("claude_code.command_binding", "claude_code_command_binding_prompt_delivery_locked", claudeCodeCommandBinding?.prompt_delivery === "stdin", "Claude Code command binding uses stdin prompt delivery."));
  items.push(validationItem("claude_code.command_binding", "claude_code_execute_requires_git_worktree", claudeCodeCommandBinding?.execute_requires_git_worktree === true, "Claude Code execute mode requires git worktree isolation."));
  items.push(validationItem("claude_code.adapter_contract", "claude_code_adapter_contract_locked", claudeCodeAdapterContract.adapter_status === "locked", "Claude Code adapter contract is locked."));
  items.push(validationItem("claude_code.adapter_contract", "claude_code_direct_apply_blocked", claudeCodeAdapterContract.lane_policy.direct_apply_allowed === false && claudeCodeAdapterContract.lane_policy.direct_merge_allowed === false, "Claude Code cannot apply or merge its own diff."));
  items.push(validationItem("claude_code.adapter_contract", "claude_code_patch_untrusted", claudeCodeAdapterContract.patch_trust === "untrusted_until_reviewed" && claudeCodeAdapterContract.output_trust === "untrusted_until_verified", "Claude Code patch output remains untrusted."));
  items.push(validationItem("claude_code.adapter_contract", "claude_code_agent_run_ledger_sink_required", claudeCodeAdapterContract.collection_policy.sink_ledger === "agent_run_ledger" && claudeCodeAdapterContract.collection_policy.collect_diff_review_status === true, "Claude Code diff outputs are collected into AgentRun ledger references."));
  items.push(validationItem("claude_code.diff_gate", "claude_code_diff_gate_contract_locked", claudeCodeDiffGateContracts.every((contract) => contract.contract_status === "locked" && contract.gate_binding_status === "ready"), "Claude Code diff gate contract is locked and ready."));
  items.push(validationItem("claude_code.diff_gate", "claude_code_diff_gate_required", claudeCodeDiffGateContracts.every((contract) => contract.protected_file_gate_required && contract.diff_review_gate_required && contract.test_gate_required && contract.human_review_required), "Claude Code diff output requires protected file, diff review, test, and human review gates."));
  items.push(validationItem("claude_code.diff_gate", "no_auto_apply", claudeCodeDiffGateContracts.every((contract) => contract.unreviewed_auto_apply_count === 0 && contract.direct_apply_allowed === false), "No Claude Code diff may be auto-applied."));
  items.push(validationItem("claude_code.agent_run_ledger_binding", "claude_code_agent_run_ledger_binding_locked", claudeCodeAgentRunLedgerBindings.every((binding) => binding.binding_status === "locked" && binding.collection_status === "ready"), "Claude Code AgentRun ledger binding is locked."));
  items.push(validationItem("claude_code.desktop_boundary", "desktop_read_only", claudeCodeDesktopBoundary.read_only === true && claudeCodeDesktopBoundary.mutation_allowed === false, "Claude Code Desktop surface is read-only."));
  items.push(validationItem("claude_code.desktop_boundary", "desktop_not_runtime_source_of_truth", claudeCodeDesktopBoundary.runtime_source_of_truth === false && claudeCodeDesktopBoundary.desktop_source_of_truth === false, "Desktop is not a runtime or source of truth for Claude Code."));
  items.push(validationItem("claude_code.desktop_boundary", "desktop_protected_mutations_blocked", claudeCodeDesktopBoundary.protected_mutation_request_allowed === false && claudeCodeDesktopBoundary.protected_mutation_execution_allowed === false, "Desktop cannot request or execute protected Claude Code mutations in v1."));
  items.push(validationItem("claude_code.desktop_boundary", "desktop_sensitive_controls_absent", claudeCodeDesktopBoundary.secret_material_exposed === false && claudeCodeDesktopBoundary.installer_or_gateway_control === false && claudeCodeDesktopBoundary.ssh_or_cron_control === false && claudeCodeDesktopBoundary.skill_install_control === false, "Desktop exposes no secrets, installer, gateway, SSH, cron, or skill-install controls."));
  items.push(validationItem("claude_code.operator_policy", "operator_policy_read_only", claudeCodeOperatorPolicy?.read_only === true && claudeCodeOperatorPolicy?.runtime_source_of_truth === false, "Claude Code operator policy remains read-only and not source of truth."));
  return items;
}

function summarizeClaudeCodeAdapterContract(projection, validationItems, validation) {
  const boundary = projection.claudeCodeDesktopBoundary;
  const binding = projection.claudeCodeAgentRunLedgerBindings[0] ?? {};
  const diffGate = projection.claudeCodeDiffGateContracts[0] ?? {};
  return {
    claude_code_adapter_contract_status: validation.valid ? "complete" : "attention",
    runtime_id: CLAUDE_CODE_RUNTIME_ID,
    adapter_id: projection.claudeCodeAdapterContract.adapter_id,
    adapter_status: projection.claudeCodeAdapterContract.adapter_status,
    claude_code_interface_bound: Boolean(projection.claudeCodeInterface),
    claude_code_runtime_execution_contract_bound: Boolean(projection.claudeCodeRuntimeExecutionContract),
    claude_code_command_binding_declared: Boolean(projection.claudeCodeCommandBinding),
    command_binding_id: projection.claudeCodeAdapterContract.command_binding_id,
    agent_run_ledger_bound: binding.sink_ledger_status === "complete",
    agent_run_ledger_status: binding.sink_ledger_status ?? "unknown",
    current_agent_run_record_count: binding.current_agent_run_record_count ?? 0,
    current_claude_code_agent_run_record_count: binding.current_claude_code_agent_run_record_count ?? 0,
    diff_gate_contract_count: projection.claudeCodeDiffGateContracts.length,
    diff_gate_binding_status: diffGate.gate_binding_status ?? "unknown",
    direct_apply_allowed: projection.claudeCodeAdapterContract.lane_policy.direct_apply_allowed,
    direct_merge_allowed: projection.claudeCodeAdapterContract.lane_policy.direct_merge_allowed,
    protected_path_write_allowed: projection.claudeCodeAdapterContract.lane_policy.protected_path_write_allowed,
    patch_materialized_as_untrusted_artifact: projection.claudeCodeAdapterContract.lane_policy.patch_materialized_as_untrusted_artifact,
    output_trust: projection.claudeCodeAdapterContract.output_trust,
    patch_trust: projection.claudeCodeAdapterContract.patch_trust,
    verification_required: projection.claudeCodeAdapterContract.verification_required,
    execute_requires_git_worktree: projection.claudeCodeAdapterContract.lane_policy.execute_requires_git_worktree,
    execute_requires_human_gate: projection.claudeCodeAdapterContract.lane_policy.execute_requires_human_gate,
    external_runtime_call_allowed_without_gate: projection.claudeCodeAdapterContract.lane_policy.external_runtime_call_allowed_without_gate,
    protected_file_gate_required: diffGate.protected_file_gate_required ?? false,
    diff_review_gate_required: diffGate.diff_review_gate_required ?? false,
    test_gate_required: diffGate.test_gate_required ?? false,
    human_review_required: diffGate.human_review_required ?? false,
    unreviewed_auto_apply_count: diffGate.unreviewed_auto_apply_count ?? 0,
    output_capture_ready: binding.output_capture_status === "ready",
    log_capture_ready: binding.log_capture_status === "ready",
    artifact_capture_ready: binding.artifact_capture_status === "ready",
    verification_capture_ready: binding.verification_capture_status === "ready",
    diff_review_capture_ready: binding.diff_review_capture_status === "ready",
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

function renderClaudeCodeAdapterMarkdown(result) {
  const summary = result.summary;
  return [
    "# Claude Code Adapter Contract",
    "",
    `- Status: ${summary.claude_code_adapter_contract_status}`,
    `- Runtime: ${summary.runtime_id}`,
    `- Adapter: ${summary.adapter_id}`,
    `- Interface bound: ${summary.claude_code_interface_bound}`,
    `- AgentRun ledger bound: ${summary.agent_run_ledger_bound}`,
    `- Current Claude Code AgentRun records: ${summary.current_claude_code_agent_run_record_count}`,
    `- Output trust: ${summary.output_trust}`,
    `- Patch trust: ${summary.patch_trust}`,
    `- Direct apply allowed: ${summary.direct_apply_allowed}`,
    `- Diff review gate required: ${summary.diff_review_gate_required}`,
    `- Test gate required: ${summary.test_gate_required}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Desktop runtime source of truth: ${summary.desktop_runtime_source_of_truth}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableClaudeCodeAdapterContract(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_CLAUDE_CODE_ADAPTER_CONTRACT_OUT_DIR,
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
  console.log(`Usage: node scripts/claude-code-adapter-contract.mjs [options]

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
