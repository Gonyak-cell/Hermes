import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKTREE_MANAGER_V2_OUT_DIR = "artifacts/worktree-manager-v2/latest";
export const DEFAULT_WORKTREE_MANAGER_V2_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  runtimeCommandBindingsPath: "examples/core/runtime-command-bindings.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  workflowGateFreezePath: "artifacts/workflow-gate-freeze/latest/workflow-gate-freeze.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const WORKTREE_BRANCH_PREFIX = "codex/";
const WORKTREE_ROOT = ".hermes/worktrees";
const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";

export async function runWorktreeManagerV2(options = {}) {
  const result = await buildWorktreeManagerV2(options);
  if (options.write !== false) await writeWorktreeManagerV2(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Worktree Manager v2 validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorktreeManagerV2(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKTREE_MANAGER_V2_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_WORKTREE_MANAGER_V2_INPUTS.runtimeAdapterInterfaceV2Path),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_WORKTREE_MANAGER_V2_INPUTS.runtimeAgentRunContractFreezePath),
    runtime_command_bindings_path: path.resolve(options.runtimeCommandBindingsPath ?? DEFAULT_WORKTREE_MANAGER_V2_INPUTS.runtimeCommandBindingsPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_WORKTREE_MANAGER_V2_INPUTS.agentRunLedgerPath),
    workflow_gate_freeze_path: path.resolve(options.workflowGateFreezePath ?? DEFAULT_WORKTREE_MANAGER_V2_INPUTS.workflowGateFreezePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_WORKTREE_MANAGER_V2_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const runtimeCommandBindings = await readJson(inputs.runtime_command_bindings_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const workflowGateFreeze = await readJson(inputs.workflow_gate_freeze_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectWorktreeManagerV2({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    runtimeCommandBindings,
    agentRunLedger,
    workflowGateFreeze,
    desktopCompanionIntegration,
    generatedAt,
  });
  const validationItems = validateWorktreeManagerV2({
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
    schema_version: "worktree-manager-v2.v1",
    generated_at: generatedAt,
    worktree_manager_v2_id: `worktree-manager-v2.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAdapterInterfaceV2,
      runtimeAgentRunContractFreeze,
      runtimeCommandBindings,
      agentRunLedger,
      workflowGateFreeze,
      desktopCompanionIntegration,
      projection,
    }),
    worktree_manager_contract: projection.worktreeManagerContract,
    agent_worktree_plans: projection.agentWorktreePlans,
    worktree_status_records: projection.worktreeStatusRecords,
    worktree_cleanup_records: projection.worktreeCleanupRecords,
    worktree_desktop_boundary: projection.worktreeDesktopBoundary,
    summary: summarizeWorktreeManagerV2(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderWorktreeManagerV2Markdown(result),
  };
}

export async function writeWorktreeManagerV2(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableWorktreeManagerV2(result);
  await writeJson(path.join(outDir, "worktree-manager-v2.json"), serializable);
  await writeJson(path.join(outDir, "agent-worktree-plans.json"), {
    schema_version: "agent-worktree-plans.v1",
    generated_at: result.generated_at,
    plan_count: result.agent_worktree_plans.length,
    agent_worktree_plans: result.agent_worktree_plans,
  });
  await writeJson(path.join(outDir, "worktree-status-records.json"), {
    schema_version: "worktree-status-records.v1",
    generated_at: result.generated_at,
    status_record_count: result.worktree_status_records.length,
    worktree_status_records: result.worktree_status_records,
  });
  await writeJson(path.join(outDir, "worktree-cleanup-records.json"), {
    schema_version: "worktree-cleanup-records.v1",
    generated_at: result.generated_at,
    cleanup_record_count: result.worktree_cleanup_records.length,
    worktree_cleanup_records: result.worktree_cleanup_records,
  });
  await writeJson(path.join(outDir, "worktree-desktop-boundary.json"), result.worktree_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "worktree-manager-v2-validation-report.v1",
    generated_at: result.generated_at,
    worktree_manager_v2_id: result.worktree_manager_v2_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorktreeManagerV2Cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorktreeManagerV2(args);
    console.log(`Worktree Manager v2 written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.worktree_manager_v2_status}`);
    console.log(`Worktree runtimes: ${result.summary.worktree_required_runtime_count}`);
    console.log(`Agent worktree plans: ${result.summary.agent_worktree_plan_count}`);
    console.log(`Status records: ${result.summary.status_record_count}`);
    console.log(`Cleanup records: ${result.summary.cleanup_record_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectWorktreeManagerV2({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  generatedAt,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const runtimeAdapters = runtimeContract.runtime_adapters ?? [];
  const agentRunContracts = runtimeContract.agent_runs ?? [];
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const commandBindings = runtimeCommandBindings.bindings ?? [];
  const commandBindingsByRuntime = new Map(commandBindings.map((binding) => [binding.runtime_id, binding]));
  const operatorSurfacePoliciesByRuntime = new Map((interfaceContract.operator_surface_policies ?? []).map((policy) => [policy.runtime_id, policy]));
  const interfacesByRuntime = new Map((interfaceContract.runtime_adapter_interfaces ?? []).map((item) => [item.runtime_id, item]));
  const worktreeRuntimeAdapters = runtimeAdapters
    .filter((adapter) => adapter.workspace_policy?.isolation_type === "git_worktree" || commandBindingsByRuntime.get(adapter.runtime_id)?.execute_requires_git_worktree === true)
    .sort((left, right) => left.runtime_id.localeCompare(right.runtime_id));
  const worktreeRuntimeIds = worktreeRuntimeAdapters.map((adapter) => adapter.runtime_id);
  const agentRunRecordsById = new Map(agentRunRecords.map((record) => [record.agent_run_id, record]));
  const worktreeAgentRuns = agentRunContracts
    .filter((run) => worktreeRuntimeIds.includes(run.runtime_id))
    .sort((left, right) => left.agent_run_id.localeCompare(right.agent_run_id));
  const workflowGateVerticalSlices = workflowGateFreeze.workflow_gate_vertical_slices ?? [];

  const agentWorktreePlans = worktreeAgentRuns.map((agentRun, index) => {
    const runtimeAdapter = runtimeAdapters.find((adapter) => adapter.runtime_id === agentRun.runtime_id) ?? {};
    const commandBinding = commandBindingsByRuntime.get(agentRun.runtime_id) ?? {};
    const operatorPolicy = operatorSurfacePoliciesByRuntime.get(agentRun.runtime_id) ?? {};
    const runtimeInterface = interfacesByRuntime.get(agentRun.runtime_id) ?? {};
    const agentRunRecord = agentRunRecordsById.get(agentRun.agent_run_id) ?? {};
    const branchName = buildBranchName(agentRun);
    const statusRecordId = `worktree-status.${slug(agentRun.agent_run_id)}`;
    const cleanupRecordId = `worktree-cleanup.${slug(agentRun.agent_run_id)}`;
    return {
      schema_version: "agent-worktree-plan.v1",
      agent_worktree_plan_id: `agent-worktree-plan.${slug(agentRun.agent_run_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      agent_run_id: agentRun.agent_run_id,
      workflow_run_id: agentRun.workflow_run_id ?? agentRunRecord.workflow_run_id ?? null,
      runtime_id: agentRun.runtime_id,
      adapter_id: runtimeAdapter.adapter_id ?? runtimeInterface.adapter_id ?? null,
      interface_id: runtimeInterface.interface_id ?? null,
      command_binding_id: commandBinding.binding_id ?? null,
      capability_id: agentRun.capability_id,
      domain_pack: agentRun.domain_pack,
      branch_prefix: WORKTREE_BRANCH_PREFIX,
      branch_name: branchName,
      worktree_root: WORKTREE_ROOT,
      worktree_path: `${WORKTREE_ROOT}/${branchName.replaceAll("/", "-")}`,
      requested_isolation: "git_worktree",
      isolation_required: true,
      execute_requires_git_worktree: commandBinding.execute_requires_git_worktree === true,
      dirty_checkout_policy: runtimeAdapter.workspace_policy?.dirty_checkout_policy ?? "block",
      protected_paths: runtimeAdapter.workspace_policy?.protected_paths ?? [],
      create_status: "planned",
      creation_tracked: true,
      branch_creation_tracked: true,
      worktree_creation_tracked: true,
      branch_create_action: "git worktree add -b",
      create_action_allowed_from_desktop: false,
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      protected_mutation_request_required: true,
      human_gate_required: true,
      source_of_truth: "harness_control_plane",
      runtime_source_of_truth: false,
      desktop_surface_policy: operatorPolicy.desktop_surface_policy ?? "read_only_runtime_status",
      status_record_id: statusRecordId,
      cleanup_record_id: cleanupRecordId,
      workflow_gate_vertical_slice_refs: workflowGateVerticalSlices
        .filter((slice) => slice.capability_id === agentRun.capability_id)
        .map((slice) => slice.workflow_gate_vertical_slice_id),
      plan_status: "ready",
    };
  });

  const worktreeStatusRecords = agentWorktreePlans.map((plan) => ({
    schema_version: "worktree-status-record.v1",
    status_record_id: plan.status_record_id,
    generated_at: generatedAt,
    agent_worktree_plan_id: plan.agent_worktree_plan_id,
    agent_run_id: plan.agent_run_id,
    workflow_run_id: plan.workflow_run_id,
    runtime_id: plan.runtime_id,
    branch_name: plan.branch_name,
    worktree_path: plan.worktree_path,
    requested_isolation: plan.requested_isolation,
    current_status: "planned",
    branch_status: "planned",
    worktree_status: "planned",
    dirty_checkout_status: "blocked_until_isolated_worktree",
    status_tracking_status: "ready",
    creation_tracked: true,
    branch_creation_tracked: true,
    worktree_creation_tracked: true,
    source_of_truth: "harness_control_plane",
    runtime_self_report_trusted: false,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
  }));

  const worktreeCleanupRecords = agentWorktreePlans.map((plan) => ({
    schema_version: "worktree-cleanup-record.v1",
    cleanup_record_id: plan.cleanup_record_id,
    generated_at: generatedAt,
    agent_worktree_plan_id: plan.agent_worktree_plan_id,
    agent_run_id: plan.agent_run_id,
    workflow_run_id: plan.workflow_run_id,
    runtime_id: plan.runtime_id,
    branch_name: plan.branch_name,
    worktree_path: plan.worktree_path,
    cleanup_policy: "retain_for_audit",
    cleanup_status: "tracked",
    cleanup_tracking_status: "ready",
    cleanup_trigger: "manual_after_merge_or_abandon",
    auto_cleanup_allowed: false,
    delete_worktree_requires_human_gate: true,
    delete_branch_requires_human_gate: true,
    artifact_retention_required: true,
    audit_retention_required: true,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    source_of_truth: "harness_control_plane",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
  }));

  const worktreeManagerContract = {
    schema_version: "worktree-manager-v2-contract.v1",
    generated_at: generatedAt,
    contract_id: "worktree-manager-v2.default",
    manager_status: "locked",
    source_of_truth: "harness_control_plane",
    branch_prefix: WORKTREE_BRANCH_PREFIX,
    worktree_root: WORKTREE_ROOT,
    worktree_required_runtime_ids: worktreeRuntimeIds,
    worktree_required_runtime_count: worktreeRuntimeIds.length,
    agent_scoped_worktrees_required: true,
    status_tracking_required: true,
    cleanup_tracking_required: true,
    branch_creation_tracked: true,
    worktree_creation_tracked: true,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    protected_mutation_request_required: true,
    desktop_can_create_worktree: false,
    desktop_can_delete_worktree: false,
    desktop_can_delete_branch: false,
    human_gate_required_for_create: true,
    human_gate_required_for_cleanup: true,
    runtime_self_report_trusted: false,
    create_helper_script: "worktree:prepare",
    plan_artifact_count: agentWorktreePlans.length,
    status_record_count: worktreeStatusRecords.length,
    cleanup_record_count: worktreeCleanupRecords.length,
  };

  const worktreeDesktopBoundary = {
    schema_version: "worktree-manager-v2-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "worktree-manager-v2.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "worktree_manager",
    desktop_surface_policy: "read_only_worktree_status",
    source_of_truth: "harness_control_plane",
    runtime_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_execution_allowed: false,
    create_worktree_allowed: false,
    delete_worktree_allowed: false,
    delete_branch_allowed: false,
    cleanup_allowed: false,
    secret_material_exposed: false,
    installer_or_gateway_control: false,
    allowed_operator_actions: ["view_worktree_plans", "view_worktree_status", "view_cleanup_status", "draft_receipt_reference"],
    denied_operator_actions: ["create_worktree", "delete_worktree", "delete_branch", "cleanup_worktree", "execute_runtime"],
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
  };

  return {
    worktreeManagerContract,
    agentWorktreePlans,
    worktreeStatusRecords,
    worktreeCleanupRecords,
    worktreeDesktopBoundary,
    worktreeRuntimeAdapters,
    worktreeRuntimeIds,
    agentRunRecords,
  };
}

function buildSourceContracts({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  projection,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const commandBindings = runtimeCommandBindings.bindings ?? [];
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  return {
    runtime_adapter_interface_v2: {
      runtime_adapter_interface_status: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status ?? "unknown",
      operator_surface_policy_count: interfaceContract.operator_surface_policies?.length ?? 0,
      worktree_runtime_operator_policy_count: (interfaceContract.operator_surface_policies ?? []).filter((policy) => projection.worktreeRuntimeIds.includes(policy.runtime_id)).length,
    },
    runtime_agentrun_contract_freeze: {
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      runtime_adapter_count: runtimeContract.runtime_adapters?.length ?? 0,
      worktree_runtime_adapter_count: projection.worktreeRuntimeAdapters.length,
      worktree_agent_run_contract_count: projection.agentWorktreePlans.length,
    },
    runtime_command_bindings: {
      binding_registry_id: runtimeCommandBindings.binding_registry_id ?? null,
      binding_count: commandBindings.length,
      git_worktree_required_binding_count: commandBindings.filter((binding) => binding.execute_requires_git_worktree === true).length,
    },
    agent_run_ledger: {
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunRecords.length,
      worktree_agent_run_record_count: agentRunRecords.filter((record) => projection.worktreeRuntimeIds.includes(record.runtime_id)).length,
    },
    workflow_gate_freeze: {
      workflow_gate_freeze_status: workflowGateFreeze.summary?.workflow_gate_freeze_status ?? "unknown",
      workflow_gate_vertical_slice_count: workflowGateFreeze.workflow_gate_vertical_slices?.length ?? 0,
      personal_dev_worktree_slice_count: (workflowGateFreeze.workflow_gate_vertical_slices ?? []).filter((slice) => slice.capability_id === "personal_dev.codex.worktree_patch").length,
    },
    desktop_companion_integration: {
      declares_read_only: /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /not a runtime source of truth|not.*source of truth|source of truth가 아니라/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /human gate|protected mutation/i.test(desktopCompanionIntegration),
    },
  };
}

function validateWorktreeManagerV2({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  runtimeCommandBindings,
  agentRunLedger,
  workflowGateFreeze,
  desktopCompanionIntegration,
  worktreeManagerContract,
  agentWorktreePlans,
  worktreeStatusRecords,
  worktreeCleanupRecords,
  worktreeDesktopBoundary,
  worktreeRuntimeIds,
}) {
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const commandBindings = runtimeCommandBindings.bindings ?? [];
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const statusIds = new Set(worktreeStatusRecords.map((record) => record.status_record_id));
  const cleanupIds = new Set(worktreeCleanupRecords.map((record) => record.cleanup_record_id));
  const items = [];
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_interface_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun freeze is complete."));
  items.push(validationItem("source.runtime_command_bindings", "git_worktree_binding_present", commandBindings.some((binding) => binding.execute_requires_git_worktree === true), "At least one command binding requires git worktree isolation."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete", "AgentRun ledger is complete."));
  items.push(validationItem("source.workflow_gate_freeze", "workflow_gate_freeze_complete", workflowGateFreeze.summary?.workflow_gate_freeze_status === "complete", "Workflow/Gate freeze is complete."));
  items.push(validationItem("source.desktop_companion", "desktop_companion_read_only_declared", /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration), "Desktop companion is documented as read-only by default."));
  items.push(validationItem("source.desktop_companion", "desktop_companion_not_source_of_truth", /not a runtime source of truth|not.*source of truth|source of truth가 아니라/i.test(desktopCompanionIntegration), "Desktop companion is not the runtime source of truth."));
  items.push(validationItem("contract.worktree_manager", "manager_locked", worktreeManagerContract.manager_status === "locked", "Worktree Manager v2 contract is locked."));
  items.push(validationItem("contract.worktree_manager", "branch_prefix_codex", worktreeManagerContract.branch_prefix === WORKTREE_BRANCH_PREFIX, "Branch prefix is codex/."));
  items.push(validationItem("contract.worktree_manager", "agent_scoped_required", worktreeManagerContract.agent_scoped_worktrees_required === true, "Agent scoped worktrees are required."));
  items.push(validationItem("contract.worktree_manager", "status_tracking_required", worktreeManagerContract.status_tracking_required === true, "Status tracking is required."));
  items.push(validationItem("contract.worktree_manager", "cleanup_tracking_required", worktreeManagerContract.cleanup_tracking_required === true, "Cleanup tracking is required."));
  items.push(validationItem("contract.worktree_manager", "protected_mutation_route", worktreeManagerContract.protected_mutation_route === PROTECTED_MUTATION_ROUTE, "Worktree mutations route through protected action requests."));
  items.push(validationItem("contract.worktree_manager", "desktop_cannot_mutate", worktreeManagerContract.desktop_can_create_worktree === false && worktreeManagerContract.desktop_can_delete_worktree === false && worktreeManagerContract.desktop_can_delete_branch === false, "Desktop cannot create or delete worktrees/branches."));
  items.push(validationItem("runtimes.worktree", "worktree_runtime_count", worktreeRuntimeIds.length >= 2, "Claude Code and Codex worktree runtimes are represented."));
  items.push(validationItem("runtimes.worktree", "claude_code_worktree_runtime", worktreeRuntimeIds.includes("claude_code"), "Claude Code requires git worktree isolation."));
  items.push(validationItem("runtimes.worktree", "codex_worktree_runtime", worktreeRuntimeIds.includes("codex"), "Codex requires git worktree isolation."));
  items.push(validationItem("plans.agent_worktrees", "plan_count_matches_runtime_contracts", agentWorktreePlans.length === (runtimeContract.agent_runs ?? []).filter((run) => worktreeRuntimeIds.includes(run.runtime_id)).length, "Every worktree AgentRun contract has a plan."));
  items.push(validationItem("plans.agent_worktrees", "plan_count_nonzero", agentWorktreePlans.length > 0, "At least one agent worktree plan exists."));
  items.push(validationItem("plans.agent_worktrees", "records_exist_in_ledger", agentWorktreePlans.every((plan) => agentRunRecords.some((record) => record.agent_run_id === plan.agent_run_id)), "Every worktree plan maps to an AgentRun ledger record."));
  items.push(validationItem("plans.agent_worktrees", "branch_prefixes_compliant", agentWorktreePlans.every((plan) => plan.branch_name.startsWith(WORKTREE_BRANCH_PREFIX)), "Every branch uses the codex/ prefix."));
  items.push(validationItem("plans.agent_worktrees", "worktree_paths_declared", agentWorktreePlans.every((plan) => typeof plan.worktree_path === "string" && plan.worktree_path.startsWith(WORKTREE_ROOT)), "Every plan declares a worktree path."));
  items.push(validationItem("plans.agent_worktrees", "status_refs_declared", agentWorktreePlans.every((plan) => statusIds.has(plan.status_record_id)), "Every plan has a status record."));
  items.push(validationItem("plans.agent_worktrees", "cleanup_refs_declared", agentWorktreePlans.every((plan) => cleanupIds.has(plan.cleanup_record_id)), "Every plan has a cleanup record."));
  items.push(validationItem("plans.agent_worktrees", "create_not_allowed_from_desktop", agentWorktreePlans.every((plan) => plan.create_action_allowed_from_desktop === false), "Worktree creation is not allowed from Desktop."));
  items.push(validationItem("status.worktrees", "status_record_count_matches_plans", worktreeStatusRecords.length === agentWorktreePlans.length, "Status record count matches plan count."));
  items.push(validationItem("status.worktrees", "status_tracking_ready", worktreeStatusRecords.every((record) => record.status_tracking_status === "ready"), "All worktree status records are ready."));
  items.push(validationItem("status.worktrees", "creation_tracking_ready", worktreeStatusRecords.every((record) => record.branch_creation_tracked === true && record.worktree_creation_tracked === true), "Branch and worktree creation tracking is ready."));
  items.push(validationItem("status.worktrees", "runtime_self_report_untrusted", worktreeStatusRecords.every((record) => record.runtime_self_report_trusted === false), "Runtime self-report is not trusted for status."));
  items.push(validationItem("cleanup.worktrees", "cleanup_record_count_matches_plans", worktreeCleanupRecords.length === agentWorktreePlans.length, "Cleanup record count matches plan count."));
  items.push(validationItem("cleanup.worktrees", "cleanup_tracking_ready", worktreeCleanupRecords.every((record) => record.cleanup_tracking_status === "ready"), "All cleanup records are ready."));
  items.push(validationItem("cleanup.worktrees", "auto_cleanup_disabled", worktreeCleanupRecords.every((record) => record.auto_cleanup_allowed === false), "Automatic cleanup is disabled."));
  items.push(validationItem("cleanup.worktrees", "cleanup_requires_human_gate", worktreeCleanupRecords.every((record) => record.delete_worktree_requires_human_gate === true && record.delete_branch_requires_human_gate === true), "Worktree and branch deletion require a human gate."));
  items.push(validationItem("desktop.boundary", "desktop_boundary_locked", worktreeDesktopBoundary.boundary_status === "locked", "Worktree Desktop boundary is locked."));
  items.push(validationItem("desktop.boundary", "desktop_read_only", worktreeDesktopBoundary.read_only === true && worktreeDesktopBoundary.mutation_allowed === false, "Desktop worktree surface is read-only."));
  items.push(validationItem("desktop.boundary", "desktop_no_protected_execution", worktreeDesktopBoundary.protected_mutation_execution_allowed === false, "Desktop cannot execute protected worktree mutations."));
  items.push(validationItem("desktop.boundary", "desktop_not_runtime_source_of_truth", worktreeDesktopBoundary.runtime_source_of_truth === false, "Desktop is not runtime source of truth."));
  return items;
}

function summarizeWorktreeManagerV2(projection, validationItems, validation) {
  const contract = projection.worktreeManagerContract;
  const plans = projection.agentWorktreePlans;
  const statusRecords = projection.worktreeStatusRecords;
  const cleanupRecords = projection.worktreeCleanupRecords;
  const desktopBoundary = projection.worktreeDesktopBoundary;
  return {
    worktree_manager_v2_status: validation.valid ? "complete" : "attention",
    worktree_manager_contract_id: contract.contract_id,
    manager_status: contract.manager_status,
    source_of_truth: contract.source_of_truth,
    branch_prefix: contract.branch_prefix,
    worktree_root: contract.worktree_root,
    worktree_required_runtime_ids: contract.worktree_required_runtime_ids,
    worktree_required_runtime_count: contract.worktree_required_runtime_count,
    claude_code_worktree_required: contract.worktree_required_runtime_ids.includes("claude_code"),
    codex_worktree_required: contract.worktree_required_runtime_ids.includes("codex"),
    agent_worktree_plan_count: plans.length,
    status_record_count: statusRecords.length,
    cleanup_record_count: cleanupRecords.length,
    agent_scoped_plan_count: plans.filter((plan) => plan.agent_run_id && plan.workflow_run_id && plan.branch_name).length,
    branch_name_compliant_count: plans.filter((plan) => plan.branch_name.startsWith(WORKTREE_BRANCH_PREFIX)).length,
    worktree_path_declared_count: plans.filter((plan) => typeof plan.worktree_path === "string" && plan.worktree_path.startsWith(WORKTREE_ROOT)).length,
    create_status_planned_count: plans.filter((plan) => plan.create_status === "planned").length,
    branch_creation_tracked_count: statusRecords.filter((record) => record.branch_creation_tracked === true).length,
    worktree_creation_tracked_count: statusRecords.filter((record) => record.worktree_creation_tracked === true).length,
    status_tracking_ready_count: statusRecords.filter((record) => record.status_tracking_status === "ready").length,
    cleanup_tracking_ready_count: cleanupRecords.filter((record) => record.cleanup_tracking_status === "ready").length,
    auto_cleanup_allowed_count: cleanupRecords.filter((record) => record.auto_cleanup_allowed === true).length,
    delete_requires_human_gate_count: cleanupRecords.filter((record) => record.delete_worktree_requires_human_gate === true && record.delete_branch_requires_human_gate === true).length,
    artifact_retention_required_count: cleanupRecords.filter((record) => record.artifact_retention_required === true).length,
    protected_mutation_route: contract.protected_mutation_route,
    protected_mutation_request_required: contract.protected_mutation_request_required,
    human_gate_required_for_create: contract.human_gate_required_for_create,
    human_gate_required_for_cleanup: contract.human_gate_required_for_cleanup,
    runtime_self_report_trusted: contract.runtime_self_report_trusted,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_protected_mutation_request_allowed: desktopBoundary.protected_mutation_request_allowed,
    desktop_protected_mutation_execution_allowed: desktopBoundary.protected_mutation_execution_allowed,
    desktop_create_worktree_allowed: desktopBoundary.create_worktree_allowed,
    desktop_delete_worktree_allowed: desktopBoundary.delete_worktree_allowed,
    desktop_delete_branch_allowed: desktopBoundary.delete_branch_allowed,
    desktop_cleanup_allowed: desktopBoundary.cleanup_allowed,
    desktop_runtime_source_of_truth: desktopBoundary.runtime_source_of_truth,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function renderWorktreeManagerV2Markdown(result) {
  const summary = result.summary;
  const lines = [
    "# Worktree Manager v2",
    "",
    `- Status: ${summary.worktree_manager_v2_status}`,
    `- Worktree runtimes: ${summary.worktree_required_runtime_ids.join(", ")}`,
    `- Agent worktree plans: ${summary.agent_worktree_plan_count}`,
    `- Status records: ${summary.status_record_count}`,
    `- Cleanup records: ${summary.cleanup_record_count}`,
    `- Branch prefix: ${summary.branch_prefix}`,
    `- Protected mutation route: ${summary.protected_mutation_route}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Agent Worktree Plans",
    "",
    "| AgentRun | Runtime | Branch | Worktree | Status | Cleanup |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const plan of result.agent_worktree_plans) {
    lines.push(`| ${plan.agent_run_id} | ${plan.runtime_id} | ${plan.branch_name} | ${plan.worktree_path} | ${plan.status_record_id} | ${plan.cleanup_record_id} |`);
  }
  lines.push("", "## Validation", "");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.check_id} - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableWorktreeManagerV2(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function validationItem(scope, checkId, passed, message) {
  return {
    scope,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: `${item.scope}.${item.check_id}`,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    error_count: errors.length,
    errors,
  };
}

function buildBranchName(agentRun) {
  const pack = slug(agentRun.domain_pack ?? "pack");
  const runtime = slug(agentRun.runtime_id ?? "runtime");
  const workflow = slug(agentRun.workflow_run_id ?? agentRun.agent_run_id ?? "run").replace(/^workflow-run-/, "");
  return `${WORKTREE_BRANCH_PREFIX}${pack}/${runtime}/${workflow}`;
}

function slug(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "item";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--runtime-adapter-interface-v2") parsed.runtimeAdapterInterfaceV2Path = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--runtime-command-bindings") parsed.runtimeCommandBindingsPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--workflow-gate-freeze") parsed.workflowGateFreezePath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/worktree-manager-v2.mjs [options]

Options:
  --out-dir <path>                         Output directory.
  --runtime-adapter-interface-v2 <path>    Runtime Adapter Interface v2 artifact.
  --runtime-agentrun-contract-freeze <path>
                                           Runtime/AgentRun contract freeze artifact.
  --runtime-command-bindings <path>        Runtime command bindings fixture.
  --agent-run-ledger <path>                Agent Run Ledger artifact.
  --workflow-gate-freeze <path>            Workflow/Gate freeze artifact.
  --desktop-companion-integration <path>   Desktop companion integration doc.
  --check                                  Exit non-zero when validation fails.
  -h, --help                               Show this help.
`);
}
