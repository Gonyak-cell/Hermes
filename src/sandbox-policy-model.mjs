import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SANDBOX_POLICY_MODEL_OUT_DIR = "artifacts/sandbox-policy-model/latest";
export const DEFAULT_SANDBOX_POLICY_MODEL_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  worktreeManagerV2Path: "artifacts/worktree-manager-v2/latest/worktree-manager-v2.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  policyMatrixPath: "examples/core/policy-matrix.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";
const BACKEND_KINDS = ["local", "docker", "ssh", "cloud"];

export async function runSandboxPolicyModel(options = {}) {
  const result = await buildSandboxPolicyModel(options);
  if (options.write !== false) await writeSandboxPolicyModel(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Sandbox Policy Model validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSandboxPolicyModel(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SANDBOX_POLICY_MODEL_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_SANDBOX_POLICY_MODEL_INPUTS.runtimeAdapterInterfaceV2Path),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_SANDBOX_POLICY_MODEL_INPUTS.runtimeAgentRunContractFreezePath),
    worktree_manager_v2_path: path.resolve(options.worktreeManagerV2Path ?? DEFAULT_SANDBOX_POLICY_MODEL_INPUTS.worktreeManagerV2Path),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_SANDBOX_POLICY_MODEL_INPUTS.toolRuntimePolicyEnforcementPath),
    policy_matrix_path: path.resolve(options.policyMatrixPath ?? DEFAULT_SANDBOX_POLICY_MODEL_INPUTS.policyMatrixPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_SANDBOX_POLICY_MODEL_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const worktreeManagerV2 = await readJson(inputs.worktree_manager_v2_path);
  const toolRuntimePolicyEnforcement = await readJson(inputs.tool_runtime_policy_enforcement_path);
  const policyMatrix = await readJson(inputs.policy_matrix_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectSandboxPolicyModel({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    worktreeManagerV2,
    toolRuntimePolicyEnforcement,
    policyMatrix,
    generatedAt,
  });
  const validationItems = validateSandboxPolicyModel({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    worktreeManagerV2,
    toolRuntimePolicyEnforcement,
    policyMatrix,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "sandbox-policy-model.v1",
    generated_at: generatedAt,
    sandbox_policy_model_id: `sandbox-policy-model.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAdapterInterfaceV2,
      runtimeAgentRunContractFreeze,
      worktreeManagerV2,
      toolRuntimePolicyEnforcement,
      policyMatrix,
      desktopCompanionIntegration,
    }),
    sandbox_policy_contract: projection.sandboxPolicyContract,
    sandbox_backend_policies: projection.sandboxBackendPolicies,
    runtime_sandbox_bindings: projection.runtimeSandboxBindings,
    sandbox_policy_decisions: projection.sandboxPolicyDecisions,
    sandbox_desktop_boundary: projection.sandboxDesktopBoundary,
    summary: summarizeSandboxPolicyModel(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };

  return {
    ...result,
    markdown: renderSandboxPolicyModelMarkdown(result),
  };
}

export async function writeSandboxPolicyModel(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableSandboxPolicyModel(result);
  await writeJson(path.join(outDir, "sandbox-policy-model.json"), serializable);
  await writeJson(path.join(outDir, "sandbox-backend-policies.json"), {
    schema_version: "sandbox-backend-policies.v1",
    generated_at: result.generated_at,
    backend_policy_count: result.sandbox_backend_policies.length,
    sandbox_backend_policies: result.sandbox_backend_policies,
  });
  await writeJson(path.join(outDir, "runtime-sandbox-bindings.json"), {
    schema_version: "runtime-sandbox-bindings.v1",
    generated_at: result.generated_at,
    runtime_sandbox_binding_count: result.runtime_sandbox_bindings.length,
    runtime_sandbox_bindings: result.runtime_sandbox_bindings,
  });
  await writeJson(path.join(outDir, "sandbox-policy-decisions.json"), {
    schema_version: "sandbox-policy-decisions.v1",
    generated_at: result.generated_at,
    sandbox_policy_decision_count: result.sandbox_policy_decisions.length,
    sandbox_policy_decisions: result.sandbox_policy_decisions,
  });
  await writeJson(path.join(outDir, "sandbox-desktop-boundary.json"), result.sandbox_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "sandbox-policy-model-validation-report.v1",
    generated_at: result.generated_at,
    sandbox_policy_model_id: result.sandbox_policy_model_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runSandboxPolicyModelCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runSandboxPolicyModel(args);
    console.log(`Sandbox Policy Model written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.sandbox_policy_model_status}`);
    console.log(`Backend policies: ${result.summary.backend_policy_count}`);
    console.log(`Runtime bindings: ${result.summary.runtime_sandbox_binding_count}`);
    console.log(`SSH policy: ${result.summary.ssh_backend_policy_status}`);
    console.log(`Cloud policy: ${result.summary.cloud_backend_policy_status}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectSandboxPolicyModel({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  worktreeManagerV2,
  generatedAt,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const runtimeAdapters = runtimeContract.runtime_adapters ?? [];
  const operatorPoliciesByRuntime = new Map((interfaceContract.operator_surface_policies ?? []).map((policy) => [policy.runtime_id, policy]));
  const runtimeInterfacesByRuntime = new Map((interfaceContract.runtime_adapter_interfaces ?? []).map((item) => [item.runtime_id, item]));
  const worktreeRuntimeIds = worktreeManagerV2.worktree_manager_contract?.worktree_required_runtime_ids ?? worktreeManagerV2.summary?.worktree_required_runtime_ids ?? [];

  const sandboxBackendPolicies = buildSandboxBackendPolicies(generatedAt);
  const backendPolicyByKind = new Map(sandboxBackendPolicies.map((policy) => [policy.backend_kind, policy]));
  const runtimeSandboxBindings = runtimeAdapters.map((adapter, index) => {
    const execution = adapter.execution_environment ?? {};
    const workspace = adapter.workspace_policy ?? {};
    const runtimeInterface = runtimeInterfacesByRuntime.get(adapter.runtime_id) ?? {};
    const operatorPolicy = operatorPoliciesByRuntime.get(adapter.runtime_id) ?? {};
    const backendKind = inferBackendKind(adapter);
    const backendPolicy = backendPolicyByKind.get(backendKind) ?? null;
    const policyDecision = decideRuntimeSandboxPolicy({ adapter, backendKind, backendPolicy, worktreeRuntimeIds });
    return {
      schema_version: "runtime-sandbox-binding.v1",
      runtime_sandbox_binding_id: `runtime-sandbox-binding.${slug(adapter.runtime_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      runtime_id: adapter.runtime_id,
      adapter_id: adapter.adapter_id,
      interface_id: runtimeInterface.interface_id ?? null,
      execution_mode: execution.execution_mode ?? "unknown",
      risk_level: adapter.risk_level ?? "unknown",
      sandbox_required: execution.sandbox_required === true,
      workspace_isolation_type: workspace.isolation_type ?? "unknown",
      backend_kind: backendKind,
      backend_policy_id: backendPolicy?.backend_policy_id ?? null,
      backend_policy_status: backendPolicy?.backend_policy_status ?? "not_applicable",
      binding_status: policyDecision.binding_status,
      policy_decision_status: policyDecision.policy_decision_status,
      execution_allowed: policyDecision.execution_allowed,
      network_access_allowed: false,
      external_transfer_allowed: false,
      secret_material_allowed: false,
      external_execution_declared: execution.external_execution === true,
      source_network_policy: execution.network_policy ?? "unknown",
      source_external_execution: execution.external_execution === true,
      git_worktree_overlay_required: worktreeRuntimeIds.includes(adapter.runtime_id),
      workspace_overlay_required: worktreeRuntimeIds.includes(adapter.runtime_id),
      allowed_isolation_matched: policyDecision.allowed_isolation_matched,
      human_gate_required_for_execution: policyDecision.human_gate_required_for_execution,
      human_gate_required_for_mutation: true,
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      operator_surface_policy_id: operatorPolicy.operator_surface_policy_id ?? null,
      desktop_surface_policy: operatorPolicy.desktop_surface_policy ?? "read_only_runtime_status",
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      desktop_protected_mutation_request_allowed: false,
      desktop_protected_mutation_execution_allowed: false,
      source_of_truth: "harness_control_plane",
      runtime_source_of_truth: false,
      decision_reason_codes: policyDecision.reason_codes,
    };
  });

  const sandboxPolicyContract = {
    schema_version: "sandbox-policy-contract.v1",
    generated_at: generatedAt,
    contract_id: "sandbox-policy-model.default",
    contract_status: "locked",
    source_of_truth: "harness_control_plane",
    policy_decision_authority: "gate_engine_policy_snapshot",
    supported_backend_kinds: BACKEND_KINDS,
    backend_policy_count: sandboxBackendPolicies.length,
    default_network_access_allowed: false,
    default_external_transfer_allowed: false,
    secret_material_allowed: false,
    runtime_self_report_trusted: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_protected_mutation: true,
    desktop_surface_policy: "read_only_sandbox_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_runtime_source_of_truth: false,
  };

  const sandboxPolicyDecisions = sandboxBackendPolicies.map((policy) => ({
    schema_version: "sandbox-policy-decision.v1",
    sandbox_policy_decision_id: `sandbox-policy-decision.${policy.backend_kind}`,
    generated_at: generatedAt,
    backend_kind: policy.backend_kind,
    backend_policy_id: policy.backend_policy_id,
    backend_policy_status: policy.backend_policy_status,
    execution_allowed_by_default: policy.execution_allowed_by_default,
    policy_decision_status: policy.backend_policy_status === "allowed" ? "allow" : "blocked_by_default",
    default_network_access_allowed: policy.default_network_access_allowed,
    external_transfer_allowed: policy.external_transfer_allowed,
    secret_material_allowed: policy.secret_material_allowed,
    exception_route: policy.exception_route,
    human_gate_required_for_exception: policy.human_gate_required_for_exception,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    desktop_mutation_allowed: false,
    source_of_truth: "harness_control_plane",
  }));

  const sandboxDesktopBoundary = {
    schema_version: "sandbox-policy-model-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "sandbox-policy-model.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "sandbox_policy_model",
    desktop_surface_policy: "read_only_sandbox_status",
    source_of_truth: "harness_control_plane",
    runtime_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_execution_allowed: false,
    local_process_control_allowed: false,
    docker_control_allowed: false,
    ssh_control_allowed: false,
    cloud_runtime_control_allowed: false,
    installer_or_gateway_control: false,
    secret_material_exposed: false,
    allowed_operator_actions: ["view_sandbox_policy", "view_backend_decisions", "view_runtime_bindings", "draft_receipt_reference"],
    denied_operator_actions: ["execute_local_process", "start_container", "open_ssh_tunnel", "start_cloud_runtime", "install_runtime", "change_policy"],
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
  };

  return {
    sandboxPolicyContract,
    sandboxBackendPolicies,
    runtimeSandboxBindings,
    sandboxPolicyDecisions,
    sandboxDesktopBoundary,
  };
}

function buildSandboxBackendPolicies(generatedAt) {
  return [
    {
      schema_version: "sandbox-backend-policy.v1",
      backend_policy_id: "sandbox-backend-policy.local",
      generated_at: generatedAt,
      backend_kind: "local",
      display_name: "Local Process Sandbox",
      backend_policy_status: "allowed",
      execution_allowed_by_default: true,
      execution_modes: ["local_process"],
      allowed_isolation_types: ["temp_dir"],
      required_controls: ["temp_dir_isolation", "deterministic_input_snapshot", "protected_path_block", "audit_capture"],
      default_network_access_allowed: false,
      external_transfer_allowed: false,
      secret_material_allowed: false,
      exception_route: "not_required",
      human_gate_required_for_exception: false,
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      desktop_control_allowed: false,
      source_of_truth: "harness_control_plane",
    },
    {
      schema_version: "sandbox-backend-policy.v1",
      backend_policy_id: "sandbox-backend-policy.docker",
      generated_at: generatedAt,
      backend_kind: "docker",
      display_name: "Docker Container Sandbox",
      backend_policy_status: "allowed",
      execution_allowed_by_default: true,
      execution_modes: ["docker"],
      allowed_isolation_types: ["docker_container", "git_worktree"],
      required_controls: ["container_isolation", "git_worktree_overlay_when_required", "protected_path_block", "artifact_capture", "audit_capture"],
      default_network_access_allowed: false,
      external_transfer_allowed: false,
      secret_material_allowed: false,
      exception_route: "not_required",
      human_gate_required_for_exception: false,
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      desktop_control_allowed: false,
      source_of_truth: "harness_control_plane",
    },
    {
      schema_version: "sandbox-backend-policy.v1",
      backend_policy_id: "sandbox-backend-policy.ssh",
      generated_at: generatedAt,
      backend_kind: "ssh",
      display_name: "SSH Workspace Sandbox",
      backend_policy_status: "blocked_by_default",
      execution_allowed_by_default: false,
      execution_modes: ["ssh"],
      allowed_isolation_types: ["ssh_workspace"],
      required_controls: ["explicit_policy_exception", "secret_handle_only", "human_gate", "audit_capture"],
      default_network_access_allowed: false,
      external_transfer_allowed: false,
      secret_material_allowed: false,
      exception_route: PROTECTED_MUTATION_ROUTE,
      human_gate_required_for_exception: true,
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      desktop_control_allowed: false,
      source_of_truth: "harness_control_plane",
    },
    {
      schema_version: "sandbox-backend-policy.v1",
      backend_policy_id: "sandbox-backend-policy.cloud",
      generated_at: generatedAt,
      backend_kind: "cloud",
      display_name: "Cloud Runtime Sandbox",
      backend_policy_status: "blocked_by_default",
      execution_allowed_by_default: false,
      execution_modes: ["cloud_runtime"],
      allowed_isolation_types: ["cloud_workspace"],
      required_controls: ["explicit_policy_exception", "policy_snapshot_binding", "secret_handle_only", "human_gate", "audit_capture"],
      default_network_access_allowed: false,
      external_transfer_allowed: false,
      secret_material_allowed: false,
      exception_route: PROTECTED_MUTATION_ROUTE,
      human_gate_required_for_exception: true,
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      desktop_control_allowed: false,
      source_of_truth: "harness_control_plane",
    },
  ];
}

function inferBackendKind(adapter) {
  const executionMode = adapter.execution_environment?.execution_mode;
  if (executionMode === "local_process") return "local";
  if (executionMode === "docker") return "docker";
  if (executionMode === "ssh") return "ssh";
  if (executionMode === "cloud_runtime") return "cloud";
  if (executionMode === "harness") return "control_plane";
  if (executionMode === "manual") return "manual";
  if (executionMode === "browser" || executionMode === "mcp") return "operator_surface";
  return "unknown";
}

function decideRuntimeSandboxPolicy({ adapter, backendKind, backendPolicy, worktreeRuntimeIds }) {
  const execution = adapter.execution_environment ?? {};
  const workspace = adapter.workspace_policy ?? {};
  if (!execution.sandbox_required && (backendKind === "control_plane" || backendKind === "manual")) {
    return {
      binding_status: "not_applicable",
      policy_decision_status: "not_applicable",
      execution_allowed: false,
      allowed_isolation_matched: workspace.isolation_type === "none" || workspace.isolation_type === "manual",
      human_gate_required_for_execution: false,
      reason_codes: ["runtime_not_sandbox_backend"],
    };
  }
  if (!backendPolicy) {
    return {
      binding_status: "blocked",
      policy_decision_status: "blocked_until_backend_policy",
      execution_allowed: false,
      allowed_isolation_matched: false,
      human_gate_required_for_execution: true,
      reason_codes: ["backend_policy_missing", "surface_specific_sandbox_required"],
    };
  }
  const allowedIsolationMatched = backendPolicy.allowed_isolation_types.includes(workspace.isolation_type);
  const executionAllowed = backendPolicy.backend_policy_status === "allowed" && allowedIsolationMatched;
  const reasonCodes = [];
  if (executionAllowed) reasonCodes.push("backend_policy_allowed");
  if (workspace.isolation_type === "git_worktree" && worktreeRuntimeIds.includes(adapter.runtime_id)) reasonCodes.push("git_worktree_overlay_required");
  if (!allowedIsolationMatched) reasonCodes.push("isolation_type_not_allowed_by_backend_policy");
  if (backendPolicy.backend_policy_status !== "allowed") reasonCodes.push("backend_blocked_by_default");
  return {
    binding_status: executionAllowed ? "bound" : "blocked",
    policy_decision_status: executionAllowed ? "allowed" : "blocked_by_default",
    execution_allowed: executionAllowed,
    allowed_isolation_matched: allowedIsolationMatched,
    human_gate_required_for_execution: execution.external_execution === true || backendPolicy.human_gate_required_for_exception === true,
    reason_codes: reasonCodes,
  };
}

function buildSourceContracts({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  worktreeManagerV2,
  toolRuntimePolicyEnforcement,
  policyMatrix,
  desktopCompanionIntegration,
}) {
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const runtimeAdapters = runtimeContract.runtime_adapters ?? [];
  return {
    runtime_adapter_interface_v2: {
      runtime_adapter_interface_status: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status ?? "unknown",
      operator_surface_policy_count: runtimeAdapterInterfaceV2.summary?.operator_surface_policy_count ?? 0,
      read_only_policy_count: runtimeAdapterInterfaceV2.summary?.read_only_policy_count ?? 0,
    },
    runtime_agentrun_contract_freeze: {
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      runtime_adapter_count: runtimeAdapters.length,
      sandbox_required_runtime_count: runtimeAdapters.filter((adapter) => adapter.execution_environment?.sandbox_required === true).length,
    },
    worktree_manager_v2: {
      worktree_manager_v2_status: worktreeManagerV2.summary?.worktree_manager_v2_status ?? "unknown",
      worktree_required_runtime_count: worktreeManagerV2.summary?.worktree_required_runtime_count ?? 0,
      protected_mutation_route: worktreeManagerV2.summary?.protected_mutation_route ?? "unknown",
    },
    tool_runtime_policy_enforcement: {
      tool_runtime_policy_enforcement_status: toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
      runtime_policy_gate_count: toolRuntimePolicyEnforcement.summary?.runtime_policy_gate_count ?? 0,
      protected_action_tool_gate_count: toolRuntimePolicyEnforcement.summary?.protected_action_tool_gate_count ?? 0,
    },
    policy_matrix: {
      schema_version: policyMatrix.schema_version ?? null,
      runtime_rule_count: policyMatrix.runtime_rules?.length ?? 0,
      classification_level_count: policyMatrix.classification_levels?.length ?? 0,
    },
    desktop_companion_integration: {
      declares_read_only: /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /not a runtime source of truth|source of truth가 아니라/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /human gate|protected mutation/i.test(desktopCompanionIntegration),
      blocks_ssh_or_gateway_control: /SSH|gateway|installer/i.test(desktopCompanionIntegration),
    },
  };
}

function validateSandboxPolicyModel({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  worktreeManagerV2,
  toolRuntimePolicyEnforcement,
  policyMatrix,
  desktopCompanionIntegration,
  sandboxPolicyContract,
  sandboxBackendPolicies,
  runtimeSandboxBindings,
  sandboxPolicyDecisions,
  sandboxDesktopBoundary,
}) {
  const runtimeAdapters = runtimeAgentRunContractFreeze.runtime_agentrun_contract?.runtime_adapters ?? [];
  const sandboxRequiredRuntimeCount = runtimeAdapters.filter((adapter) => adapter.execution_environment?.sandbox_required === true).length;
  const backendPolicyByKind = new Map(sandboxBackendPolicies.map((policy) => [policy.backend_kind, policy]));
  const bindingByRuntime = new Map(runtimeSandboxBindings.map((binding) => [binding.runtime_id, binding]));
  const decisionByBackend = new Map(sandboxPolicyDecisions.map((decision) => [decision.backend_kind, decision]));
  const items = [];

  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_interface_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun freeze is complete."));
  items.push(validationItem("source.worktree_manager_v2", "worktree_manager_complete", worktreeManagerV2.summary?.worktree_manager_v2_status === "complete", "Worktree Manager v2 is complete."));
  items.push(validationItem("source.tool_runtime_policy", "tool_runtime_policy_complete", toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status === "complete", "Tool/Runtime policy enforcement is complete."));
  items.push(validationItem("source.policy_matrix", "runtime_rules_present", (policyMatrix.runtime_rules?.length ?? 0) > 0, "Policy matrix runtime rules are present."));
  items.push(validationItem("source.desktop_companion", "desktop_companion_read_only_declared", /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration), "Desktop companion is documented as read-only by default."));
  items.push(validationItem("source.desktop_companion", "desktop_companion_not_source_of_truth", /not a runtime source of truth|source of truth가 아니라/i.test(desktopCompanionIntegration), "Desktop companion is not the runtime source of truth."));
  items.push(validationItem("contract.sandbox_policy", "contract_locked", sandboxPolicyContract.contract_status === "locked", "Sandbox policy contract is locked."));
  items.push(validationItem("contract.sandbox_policy", "harness_source_of_truth", sandboxPolicyContract.source_of_truth === "harness_control_plane", "Harness control-plane is source of truth."));
  items.push(validationItem("contract.sandbox_policy", "backend_policy_count", sandboxBackendPolicies.length === BACKEND_KINDS.length, "Local, Docker, SSH, and cloud backend policies are all present."));
  for (const backendKind of BACKEND_KINDS) {
    items.push(validationItem(`backend.${backendKind}`, "backend_policy_present", backendPolicyByKind.has(backendKind), `${backendKind} backend policy is present.`));
  }
  items.push(validationItem("backend.local", "local_allowed", backendPolicyByKind.get("local")?.backend_policy_status === "allowed", "Local sandbox backend is allowed."));
  items.push(validationItem("backend.docker", "docker_allowed", backendPolicyByKind.get("docker")?.backend_policy_status === "allowed", "Docker sandbox backend is allowed."));
  items.push(validationItem("backend.ssh", "ssh_blocked_by_default", backendPolicyByKind.get("ssh")?.backend_policy_status === "blocked_by_default", "SSH backend is blocked by default."));
  items.push(validationItem("backend.cloud", "cloud_blocked_by_default", backendPolicyByKind.get("cloud")?.backend_policy_status === "blocked_by_default", "Cloud backend is blocked by default."));
  items.push(validationItem("backend.network", "network_access_disabled", sandboxBackendPolicies.every((policy) => policy.default_network_access_allowed === false), "Backend policies disable network access by default."));
  items.push(validationItem("backend.external_transfer", "external_transfer_disabled", sandboxBackendPolicies.every((policy) => policy.external_transfer_allowed === false), "Backend policies block external transfer."));
  items.push(validationItem("backend.secrets", "secret_material_blocked", sandboxBackendPolicies.every((policy) => policy.secret_material_allowed === false), "Backend policies block raw secret material."));
  items.push(validationItem("decisions.backends", "decision_count_matches_backends", sandboxPolicyDecisions.length === sandboxBackendPolicies.length, "Every backend has a policy decision row."));
  items.push(validationItem("decisions.ssh_cloud", "ssh_cloud_blocked", decisionByBackend.get("ssh")?.policy_decision_status === "blocked_by_default" && decisionByBackend.get("cloud")?.policy_decision_status === "blocked_by_default", "SSH and cloud decisions are blocked by default."));
  items.push(validationItem("bindings.runtimes", "all_runtime_bindings_present", runtimeSandboxBindings.length === runtimeAdapters.length, "Every runtime has a sandbox binding row."));
  items.push(validationItem("bindings.runtimes", "sandbox_required_runtime_bindings_present", runtimeAdapters.filter((adapter) => adapter.execution_environment?.sandbox_required === true).every((adapter) => bindingByRuntime.has(adapter.runtime_id)), "Every sandbox-required runtime has a sandbox binding."));
  items.push(validationItem("bindings.local_script", "local_script_temp_dir_allowed", bindingByRuntime.get("local_script")?.policy_decision_status === "allowed" && bindingByRuntime.get("local_script")?.workspace_isolation_type === "temp_dir", "Local Script is allowed only through temp_dir local sandbox policy."));
  items.push(validationItem("bindings.document_renderer", "document_renderer_docker_allowed", bindingByRuntime.get("document_renderer")?.policy_decision_status === "allowed" && bindingByRuntime.get("document_renderer")?.workspace_isolation_type === "docker_container", "Document Renderer is allowed through Docker container policy."));
  items.push(validationItem("bindings.worktree", "claude_codex_git_worktree_overlay", bindingByRuntime.get("claude_code")?.git_worktree_overlay_required === true && bindingByRuntime.get("codex")?.git_worktree_overlay_required === true, "Claude Code and Codex require git worktree overlays."));
  items.push(validationItem("bindings.operator_surfaces", "browser_mcp_blocked_until_surface_policy", bindingByRuntime.get("browser")?.policy_decision_status === "blocked_until_backend_policy" && bindingByRuntime.get("mcp_tool")?.policy_decision_status === "blocked_until_backend_policy", "Browser and MCP surfaces remain blocked until surface-specific sandbox policy exists."));
  items.push(validationItem("bindings.network", "runtime_network_disabled", runtimeSandboxBindings.every((binding) => binding.network_access_allowed === false), "Runtime bindings disable network access by default."));
  items.push(validationItem("bindings.external_transfer", "runtime_external_transfer_disabled", runtimeSandboxBindings.every((binding) => binding.external_transfer_allowed === false), "Runtime bindings block external transfer."));
  items.push(validationItem("bindings.secrets", "runtime_secret_material_blocked", runtimeSandboxBindings.every((binding) => binding.secret_material_allowed === false), "Runtime bindings block raw secret material."));
  items.push(validationItem("bindings.counts", "sandbox_required_count_consistent", sandboxRequiredRuntimeCount === runtimeSandboxBindings.filter((binding) => binding.sandbox_required === true).length, "Sandbox-required runtime count is consistent."));
  items.push(validationItem("desktop.boundary", "desktop_boundary_locked", sandboxDesktopBoundary.boundary_status === "locked", "Sandbox Desktop boundary is locked."));
  items.push(validationItem("desktop.boundary", "desktop_read_only", sandboxDesktopBoundary.read_only === true && sandboxDesktopBoundary.mutation_allowed === false, "Desktop sandbox surface is read-only."));
  items.push(validationItem("desktop.boundary", "desktop_no_protected_execution", sandboxDesktopBoundary.protected_mutation_execution_allowed === false, "Desktop cannot execute protected sandbox mutations."));
  items.push(validationItem("desktop.boundary", "desktop_no_ssh_cloud_control", sandboxDesktopBoundary.ssh_control_allowed === false && sandboxDesktopBoundary.cloud_runtime_control_allowed === false, "Desktop cannot control SSH or cloud runtimes."));
  items.push(validationItem("desktop.boundary", "desktop_not_runtime_source_of_truth", sandboxDesktopBoundary.runtime_source_of_truth === false, "Desktop is not runtime source of truth."));
  return items;
}

function summarizeSandboxPolicyModel(projection, validationItems, validation) {
  const backendPolicies = projection.sandboxBackendPolicies;
  const bindings = projection.runtimeSandboxBindings;
  const desktopBoundary = projection.sandboxDesktopBoundary;
  const backendStatus = (kind) => backendPolicies.find((policy) => policy.backend_kind === kind)?.backend_policy_status ?? "missing";
  return {
    sandbox_policy_model_status: validation.valid ? "complete" : "attention",
    sandbox_policy_contract_id: projection.sandboxPolicyContract.contract_id,
    contract_status: projection.sandboxPolicyContract.contract_status,
    source_of_truth: projection.sandboxPolicyContract.source_of_truth,
    policy_decision_authority: projection.sandboxPolicyContract.policy_decision_authority,
    backend_policy_count: backendPolicies.length,
    backend_policy_decision_count: projection.sandboxPolicyDecisions.length,
    local_backend_policy_status: backendStatus("local"),
    docker_backend_policy_status: backendStatus("docker"),
    ssh_backend_policy_status: backendStatus("ssh"),
    cloud_backend_policy_status: backendStatus("cloud"),
    allowed_backend_policy_count: backendPolicies.filter((policy) => policy.backend_policy_status === "allowed").length,
    blocked_backend_policy_count: backendPolicies.filter((policy) => policy.backend_policy_status === "blocked_by_default").length,
    runtime_sandbox_binding_count: bindings.length,
    sandbox_required_runtime_count: bindings.filter((binding) => binding.sandbox_required === true).length,
    allowed_runtime_sandbox_binding_count: bindings.filter((binding) => binding.policy_decision_status === "allowed").length,
    blocked_runtime_sandbox_binding_count: bindings.filter((binding) => binding.policy_decision_status === "blocked_by_default" || binding.policy_decision_status === "blocked_until_backend_policy").length,
    not_applicable_runtime_binding_count: bindings.filter((binding) => binding.policy_decision_status === "not_applicable").length,
    git_worktree_overlay_count: bindings.filter((binding) => binding.git_worktree_overlay_required === true).length,
    network_access_allowed_count: bindings.filter((binding) => binding.network_access_allowed === true).length + backendPolicies.filter((policy) => policy.default_network_access_allowed === true).length,
    external_transfer_allowed_count: bindings.filter((binding) => binding.external_transfer_allowed === true).length + backendPolicies.filter((policy) => policy.external_transfer_allowed === true).length,
    secret_material_allowed_count: bindings.filter((binding) => binding.secret_material_allowed === true).length + backendPolicies.filter((policy) => policy.secret_material_allowed === true).length,
    ssh_cloud_blocked_count: backendPolicies.filter((policy) => ["ssh", "cloud"].includes(policy.backend_kind) && policy.backend_policy_status === "blocked_by_default").length,
    protected_mutation_route: projection.sandboxPolicyContract.protected_mutation_route,
    human_gate_required_for_protected_mutation: projection.sandboxPolicyContract.human_gate_required_for_protected_mutation,
    runtime_self_report_trusted: projection.sandboxPolicyContract.runtime_self_report_trusted,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_protected_mutation_request_allowed: desktopBoundary.protected_mutation_request_allowed,
    desktop_protected_mutation_execution_allowed: desktopBoundary.protected_mutation_execution_allowed,
    desktop_local_process_control_allowed: desktopBoundary.local_process_control_allowed,
    desktop_docker_control_allowed: desktopBoundary.docker_control_allowed,
    desktop_ssh_control_allowed: desktopBoundary.ssh_control_allowed,
    desktop_cloud_runtime_control_allowed: desktopBoundary.cloud_runtime_control_allowed,
    desktop_installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    desktop_secret_material_exposed: desktopBoundary.secret_material_exposed,
    desktop_runtime_source_of_truth: desktopBoundary.runtime_source_of_truth,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function renderSandboxPolicyModelMarkdown(result) {
  const summary = result.summary;
  const lines = [
    "# Sandbox Policy Model",
    "",
    `- Status: ${summary.sandbox_policy_model_status}`,
    `- Backend policies: ${summary.backend_policy_count}`,
    `- Local: ${summary.local_backend_policy_status}`,
    `- Docker: ${summary.docker_backend_policy_status}`,
    `- SSH: ${summary.ssh_backend_policy_status}`,
    `- Cloud: ${summary.cloud_backend_policy_status}`,
    `- Runtime bindings: ${summary.runtime_sandbox_binding_count}`,
    `- Network access allowed count: ${summary.network_access_allowed_count}`,
    `- External transfer allowed count: ${summary.external_transfer_allowed_count}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Backend Policies",
    "",
    "| Backend | Status | Execution modes | Isolation | Exception route |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const policy of result.sandbox_backend_policies) {
    lines.push(`| ${policy.backend_kind} | ${policy.backend_policy_status} | ${policy.execution_modes.join(", ")} | ${policy.allowed_isolation_types.join(", ")} | ${policy.exception_route} |`);
  }
  lines.push("", "## Runtime Bindings", "");
  lines.push("| Runtime | Backend | Isolation | Decision | Network | External transfer |");
  lines.push("| --- | --- | --- | --- | --- | --- |");
  for (const binding of result.runtime_sandbox_bindings) {
    lines.push(`| ${binding.runtime_id} | ${binding.backend_kind} | ${binding.workspace_isolation_type} | ${binding.policy_decision_status} | ${binding.network_access_allowed} | ${binding.external_transfer_allowed} |`);
  }
  lines.push("", "## Validation", "");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.check_id} - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableSandboxPolicyModel(result) {
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
    else if (arg === "--worktree-manager-v2") parsed.worktreeManagerV2Path = argv[++index];
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--policy-matrix") parsed.policyMatrixPath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/sandbox-policy-model.mjs [options]

Options:
  --out-dir <path>                         Output directory.
  --runtime-adapter-interface-v2 <path>    Runtime Adapter Interface v2 artifact.
  --runtime-agentrun-contract-freeze <path>
                                           Runtime/AgentRun contract freeze artifact.
  --worktree-manager-v2 <path>             Worktree Manager v2 artifact.
  --tool-runtime-policy <path>             Tool/Runtime policy enforcement artifact.
  --policy-matrix <path>                   Core policy matrix fixture.
  --desktop-companion-integration <path>   Desktop companion integration doc.
  --check                                  Exit non-zero when validation fails.
  -h, --help                               Show this help.
`);
}
