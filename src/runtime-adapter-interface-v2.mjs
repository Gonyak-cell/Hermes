import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_ADAPTER_INTERFACE_V2_OUT_DIR = "artifacts/runtime-adapter-interface-v2/latest";
export const DEFAULT_RUNTIME_ADAPTER_INTERFACE_V2_INPUTS = {
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  workflowGateFreezePath: "artifacts/workflow-gate-freeze/latest/workflow-gate-freeze.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const REQUIRED_FIELD_GROUPS = [
  {
    field_group_id: "runtime_input_contract",
    label: "Runtime Input Contract",
    required_fields: ["input_contract.schema_ref", "input_contract.accepted_context_types", "input_contract.max_input_classification", "input_contract.redaction_required", "input_contract.prompt_injection_handling"],
  },
  {
    field_group_id: "runtime_output_contract",
    label: "Runtime Output Contract",
    required_fields: ["output_contract.schema_ref", "output_contract.artifact_types", "output_contract.output_trust", "output_contract.output_hash_required"],
  },
  {
    field_group_id: "runtime_artifact_contract",
    label: "Runtime Artifact Contract",
    required_fields: ["artifact_capture_required", "output_artifact_types", "command_binding.binding_id"],
  },
  {
    field_group_id: "runtime_log_contract",
    label: "Runtime Log Contract",
    required_fields: ["logs_required", "observability.trace_required", "observability.prompt_hash_required", "observability.output_hash_required", "observability.cost_tracking_required"],
  },
  {
    field_group_id: "runtime_risk_contract",
    label: "Runtime Risk Contract",
    required_fields: ["risk_level", "execution_environment.execution_mode", "execution_environment.network_policy", "execution_environment.external_execution", "workspace_policy.isolation_type"],
  },
  {
    field_group_id: "runtime_verification_contract",
    label: "Runtime Verification Contract",
    required_fields: ["verification.verification_required", "verification.verifier_runtime_ids", "verification.required_gates", "verification.acceptance_authority"],
  },
  {
    field_group_id: "desktop_surface_policy",
    label: "Desktop Operator Surface Policy",
    required_fields: ["desktop_surface_policy", "read_only", "mutation_allowed", "protected_mutation_request_allowed", "protected_mutation_execution_allowed", "secret_material_exposed", "installer_or_gateway_control"],
  },
];

export async function runRuntimeAdapterInterfaceV2(options = {}) {
  const result = await buildRuntimeAdapterInterfaceV2(options);
  if (options.write !== false) await writeRuntimeAdapterInterfaceV2(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime adapter interface v2 validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeAdapterInterfaceV2(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_ADAPTER_INTERFACE_V2_OUT_DIR);
  const inputs = {
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_RUNTIME_ADAPTER_INTERFACE_V2_INPUTS.runtimeAgentRunContractFreezePath),
    capability_registry_api_path: path.resolve(options.capabilityRegistryApiPath ?? DEFAULT_RUNTIME_ADAPTER_INTERFACE_V2_INPUTS.capabilityRegistryApiPath),
    workflow_gate_freeze_path: path.resolve(options.workflowGateFreezePath ?? DEFAULT_RUNTIME_ADAPTER_INTERFACE_V2_INPUTS.workflowGateFreezePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_RUNTIME_ADAPTER_INTERFACE_V2_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const capabilityRegistryApi = await readJson(inputs.capability_registry_api_path);
  const workflowGateFreeze = await readJson(inputs.workflow_gate_freeze_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectRuntimeAdapterInterface({
    runtimeAgentRunContractFreeze,
    capabilityRegistryApi,
    workflowGateFreeze,
    desktopCompanionIntegration,
    generatedAt,
  });
  const validationItems = validateRuntimeAdapterInterface({
    runtimeAgentRunContractFreeze,
    capabilityRegistryApi,
    workflowGateFreeze,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);

  const result = {
    schema_version: "runtime-adapter-interface-v2.v1",
    generated_at: generatedAt,
    interface_id: `runtime-adapter-interface-v2.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      runtime_agentrun_contract_freeze: {
        schema_version: runtimeAgentRunContractFreeze.schema_version,
        freeze_id: runtimeAgentRunContractFreeze.freeze_id,
        freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? null,
        runtime_adapter_count: runtimeAgentRunContractFreeze.summary?.runtime_adapter_count ?? 0,
        runtime_execution_contract_count: runtimeAgentRunContractFreeze.summary?.runtime_execution_contract_count ?? 0,
      },
      capability_registry_api: {
        schema_version: capabilityRegistryApi.schema_version,
        registry_api_status: capabilityRegistryApi.summary?.capability_registry_api_status ?? null,
        desktop_companion_readiness_status: capabilityRegistryApi.summary?.desktop_companion_readiness_status ?? null,
        route_group_count: capabilityRegistryApi.summary?.desktop_route_group_count ?? 0,
      },
      workflow_gate_freeze: {
        schema_version: workflowGateFreeze.schema_version,
        workflow_gate_freeze_status: workflowGateFreeze.summary?.workflow_gate_freeze_status ?? null,
        desktop_companion_readiness_status: workflowGateFreeze.summary?.desktop_companion_readiness_status ?? null,
      },
      desktop_companion_integration: {
        document_path: inputs.desktop_companion_integration_path,
        declares_operator_surface: desktopCompanionIntegration.includes("operator companion surface"),
        declares_read_only_v1: desktopCompanionIntegration.includes("읽기 전용") || desktopCompanionIntegration.includes("read_only=true"),
        declares_not_runtime_source_of_truth: desktopCompanionIntegration.includes("source of truth가 아니라") || desktopCompanionIntegration.includes("not a runtime"),
      },
    },
    runtime_adapter_interface_contract: {
      schema_version: "runtime-adapter-interface-contract.v2",
      generated_at: generatedAt,
      field_groups: projection.fieldGroups,
      runtime_adapter_interfaces: projection.runtimeAdapterInterfaces,
      operator_surface_policies: projection.operatorSurfacePolicies,
    },
    summary: summarizeInterface(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderRuntimeAdapterInterfaceMarkdown(result),
  };
}

export async function writeRuntimeAdapterInterfaceV2(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableInterface(result);
  await writeJson(path.join(outDir, "runtime-adapter-interface-v2.json"), serializable);
  await writeJson(path.join(outDir, "runtime-adapter-interface-fields.json"), {
    generated_at: result.generated_at,
    field_group_count: result.runtime_adapter_interface_contract.field_groups.length,
    field_groups: result.runtime_adapter_interface_contract.field_groups,
  });
  await writeJson(path.join(outDir, "operator-surface-policies.json"), {
    generated_at: result.generated_at,
    operator_surface_policy_count: result.runtime_adapter_interface_contract.operator_surface_policies.length,
    operator_surface_policies: result.runtime_adapter_interface_contract.operator_surface_policies,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    interface_id: result.interface_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeAdapterInterfaceV2Cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRuntimeAdapterInterfaceV2(args);
    console.log(`Runtime adapter interface v2 written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.runtime_adapter_interface_status}`);
    console.log(`Runtime interfaces: ${result.summary.runtime_adapter_interface_count}`);
    console.log(`Operator policies: ${result.summary.operator_surface_policy_count}`);
    console.log(`Read-only policies: ${result.summary.read_only_policy_count}/${result.summary.operator_surface_policy_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectRuntimeAdapterInterface({
  runtimeAgentRunContractFreeze,
  capabilityRegistryApi,
  workflowGateFreeze,
  desktopCompanionIntegration,
  generatedAt,
}) {
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const runtimeAdapters = runtimeContract.runtime_adapters ?? [];
  const runtimeExecutionContracts = runtimeContract.runtime_execution_contracts ?? [];
  const runtimeArtifacts = runtimeContract.runtime_artifacts ?? [];
  const runtimeLogs = runtimeContract.runtime_logs ?? [];
  const runtimeVerifications = runtimeContract.runtime_verifications ?? [];
  const executionByRuntimeId = new Map(runtimeExecutionContracts.map((contract) => [contract.runtime_id, contract]));
  const artifactsByRuntimeId = groupBy(runtimeArtifacts, "runtime_id");
  const logsByRuntimeId = groupBy(runtimeLogs, "runtime_id");
  const verificationsByRuntimeId = groupBy(runtimeVerifications, "runtime_id");
  const desktopRouteGroups = capabilityRegistryApi.desktop_companion_route_groups ?? capabilityRegistryApi.capability_registry_api?.desktop_companion_route_groups ?? [];
  const workflowGateSlices = workflowGateFreeze.workflow_gate_vertical_slices ?? [];

  const fieldGroups = REQUIRED_FIELD_GROUPS.map((group) => ({
    ...group,
    lock_status: "locked",
    compatibility_floor: "runtime-adapter.v2",
    created_at: generatedAt,
  }));
  const operatorSurfacePolicies = runtimeAdapters.map((adapter) => operatorSurfacePolicy({
    adapter,
    desktopRouteGroups,
    workflowGateSlices,
    desktopCompanionIntegration,
    generatedAt,
  }));
  const policyByRuntimeId = new Map(operatorSurfacePolicies.map((policy) => [policy.runtime_id, policy]));
  const runtimeAdapterInterfaces = runtimeAdapters.map((adapter) => runtimeAdapterInterface({
    adapter,
    executionContract: executionByRuntimeId.get(adapter.runtime_id),
    runtimeArtifacts: artifactsByRuntimeId.get(adapter.runtime_id) ?? [],
    runtimeLogs: logsByRuntimeId.get(adapter.runtime_id) ?? [],
    runtimeVerifications: verificationsByRuntimeId.get(adapter.runtime_id) ?? [],
    operatorSurfacePolicy: policyByRuntimeId.get(adapter.runtime_id),
    generatedAt,
  }));

  return {
    fieldGroups,
    runtimeAdapterInterfaces,
    operatorSurfacePolicies,
  };
}

function runtimeAdapterInterface({
  adapter,
  executionContract,
  runtimeArtifacts,
  runtimeLogs,
  runtimeVerifications,
  operatorSurfacePolicy,
  generatedAt,
}) {
  const inputContractStatus = hasInputContract(adapter) ? "locked" : "missing";
  const outputContractStatus = hasOutputContract(adapter) ? "locked" : "missing";
  const artifactContractStatus = typeof adapter.artifact_capture_required === "boolean" && Array.isArray(adapter.output_artifact_types) ? "locked" : "missing";
  const logContractStatus = typeof adapter.logs_required === "boolean" && typeof adapter.observability?.trace_required === "boolean" ? "locked" : "missing";
  const riskContractStatus = adapter.risk_level && adapter.execution_environment?.execution_mode && adapter.workspace_policy?.isolation_type ? "locked" : "missing";
  const verificationContractStatus = typeof adapter.verification_required === "boolean" && adapter.verification?.acceptance_authority ? "locked" : "missing";
  const interfaceStatus = [
    inputContractStatus,
    outputContractStatus,
    artifactContractStatus,
    logContractStatus,
    riskContractStatus,
    verificationContractStatus,
    operatorSurfacePolicy?.policy_status,
  ].every((status) => status === "locked" || status === "passed") ? "locked" : "blocked";

  return {
    interface_id: `runtime-adapter-interface.${adapter.runtime_id}`,
    schema_version: "runtime-adapter-interface.v2",
    adapter_id: adapter.adapter_id,
    runtime_id: adapter.runtime_id,
    runtime_display_name: adapter.display_name,
    risk_level: adapter.risk_level,
    execution_contract_id: executionContract?.execution_contract_id ?? null,
    runtime_execution_contract_bound: Boolean(executionContract),
    input_contract_status: inputContractStatus,
    output_contract_status: outputContractStatus,
    artifact_contract_status: artifactContractStatus,
    log_contract_status: logContractStatus,
    risk_contract_status: riskContractStatus,
    verification_contract_status: verificationContractStatus,
    operator_surface_policy_id: operatorSurfacePolicy?.operator_surface_policy_id ?? null,
    operator_surface_policy_status: operatorSurfacePolicy?.policy_status ?? "missing",
    desktop_surface_policy: operatorSurfacePolicy?.desktop_surface_policy ?? "missing",
    read_only: Boolean(operatorSurfacePolicy?.read_only),
    mutation_allowed: Boolean(operatorSurfacePolicy?.mutation_allowed),
    protected_mutation_request_allowed: Boolean(operatorSurfacePolicy?.protected_mutation_request_allowed),
    protected_mutation_execution_allowed: Boolean(operatorSurfacePolicy?.protected_mutation_execution_allowed),
    protected_mutation_request_policy: operatorSurfacePolicy?.protected_mutation_request_policy ?? "missing",
    secret_material_exposed: Boolean(operatorSurfacePolicy?.secret_material_exposed),
    installer_or_gateway_control: Boolean(operatorSurfacePolicy?.installer_or_gateway_control),
    runtime_source_of_truth: Boolean(operatorSurfacePolicy?.runtime_source_of_truth),
    output_trust: adapter.output_trust,
    verification_required: Boolean(adapter.verification_required),
    logs_required: Boolean(adapter.logs_required),
    artifact_capture_required: Boolean(adapter.artifact_capture_required),
    runtime_artifact_contract_count: runtimeArtifacts.length,
    runtime_log_contract_count: runtimeLogs.length,
    runtime_verification_contract_count: runtimeVerifications.length,
    interface_status: interfaceStatus,
    created_at: generatedAt,
    metadata: {
      accepted_context_types: adapter.input_contract?.accepted_context_types ?? [],
      output_artifact_types: adapter.output_artifact_types ?? [],
      required_verification_gates: adapter.verification?.required_gates ?? [],
    },
  };
}

function operatorSurfacePolicy({ adapter, desktopRouteGroups, workflowGateSlices, desktopCompanionIntegration, generatedAt }) {
  const referencedRouteGroups = desktopRouteGroups
    .filter((group) => group.read_only === true && group.mutation_allowed === false)
    .map((group) => group.route_group_id ?? group.desktop_companion_route_group_id)
    .filter(Boolean);
  const workflowSliceIds = workflowGateSlices
    .filter((slice) => slice.read_only === true && slice.mutation_allowed === false)
    .map((slice) => slice.workflow_gate_vertical_slice_id)
    .filter(Boolean);
  return {
    operator_surface_policy_id: `operator-surface-policy.${adapter.runtime_id}`,
    schema_version: "operator-surface-policy.v1",
    runtime_id: adapter.runtime_id,
    adapter_id: adapter.adapter_id,
    desktop_surface: "runtime_adapters",
    desktop_surface_policy: "read_only_runtime_status",
    source_of_truth: "harness_control_plane",
    runtime_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_request_policy: "disabled_in_desktop_v1_receipt_or_human_gate_required",
    protected_mutation_execution_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    auto_update_control: false,
    skill_install_control: false,
    allowed_operator_actions: ["view_status", "view_logs", "view_artifacts", "view_verification", "draft_receipt_reference"],
    denied_operator_actions: ["execute_runtime", "approve_protected_mutation", "write_secret", "start_gateway", "install_skill", "schedule_cron", "auto_update"],
    route_group_refs: referencedRouteGroups,
    workflow_gate_vertical_slice_refs: workflowSliceIds,
    desktop_companion_contract_ref: desktopCompanionIntegration.includes("Desktop v1은 실행 버튼을 제공하지 않는다") ? "docs/desktop-companion-integration.md#mutation-principles" : "docs/desktop-companion-integration.md",
    policy_status: "locked",
    created_at: generatedAt,
    metadata: {
      risk_level: adapter.risk_level,
      output_trust: adapter.output_trust,
      verification_required: Boolean(adapter.verification_required),
    },
  };
}

function validateRuntimeAdapterInterface({
  runtimeAgentRunContractFreeze,
  capabilityRegistryApi,
  workflowGateFreeze,
  desktopCompanionIntegration,
  fieldGroups,
  runtimeAdapterInterfaces,
  operatorSurfacePolicies,
}) {
  const items = [];
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_contract_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze must be complete."));
  items.push(validationItem("source.capability_registry_api", "capability_registry_api_complete", capabilityRegistryApi.summary?.capability_registry_api_status === "complete", "Capability registry API must be complete."));
  items.push(validationItem("source.workflow_gate_freeze", "workflow_gate_freeze_complete", workflowGateFreeze.summary?.workflow_gate_freeze_status === "complete", "Workflow/Gate freeze must be complete."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_operator_surface_declared", desktopCompanionIntegration.includes("operator companion surface") && desktopCompanionIntegration.includes("읽기 전용"), "Desktop Companion integration must declare read-only operator surface."));
  items.push(validationItem("field_groups", "required_field_groups_locked", fieldGroups.length === REQUIRED_FIELD_GROUPS.length && fieldGroups.every((group) => group.lock_status === "locked"), "All runtime adapter interface field groups are locked."));

  for (const adapterInterface of runtimeAdapterInterfaces) {
    const pathLabel = `runtime_adapter_interfaces.${adapterInterface.runtime_id}`;
    items.push(validationItem(pathLabel, "runtime_execution_contract_bound", adapterInterface.runtime_execution_contract_bound, "Runtime adapter binds to a runtime execution contract."));
    items.push(validationItem(pathLabel, "input_contract_locked", adapterInterface.input_contract_status === "locked", "Input contract fields are locked."));
    items.push(validationItem(pathLabel, "output_contract_locked", adapterInterface.output_contract_status === "locked", "Output contract fields are locked."));
    items.push(validationItem(pathLabel, "artifact_contract_locked", adapterInterface.artifact_contract_status === "locked", "Artifact contract fields are locked."));
    items.push(validationItem(pathLabel, "log_contract_locked", adapterInterface.log_contract_status === "locked", "Log contract fields are locked."));
    items.push(validationItem(pathLabel, "risk_contract_locked", adapterInterface.risk_contract_status === "locked", "Risk contract fields are locked."));
    items.push(validationItem(pathLabel, "verification_contract_locked", adapterInterface.verification_contract_status === "locked", "Verification contract fields are locked."));
    items.push(validationItem(pathLabel, "operator_surface_policy_locked", adapterInterface.operator_surface_policy_status === "locked", "Operator surface policy is locked."));
    items.push(validationItem(pathLabel, "desktop_surface_read_only", adapterInterface.read_only === true && adapterInterface.mutation_allowed === false, "Desktop surface is read-only and cannot mutate."));
    items.push(validationItem(pathLabel, "protected_mutation_request_disabled", adapterInterface.protected_mutation_request_allowed === false && adapterInterface.protected_mutation_execution_allowed === false, "Desktop surface cannot request or execute protected mutations in v1."));
    items.push(validationItem(pathLabel, "secret_and_installer_control_blocked", adapterInterface.secret_material_exposed === false && adapterInterface.installer_or_gateway_control === false, "Desktop surface exposes no secrets, installer, or gateway control."));
    items.push(validationItem(pathLabel, "runtime_not_source_of_truth", adapterInterface.runtime_source_of_truth === false, "Runtime/desktop surface is not the source of truth."));
  }

  for (const policy of operatorSurfacePolicies) {
    const pathLabel = `operator_surface_policies.${policy.runtime_id}`;
    items.push(validationItem(pathLabel, "read_only_policy", policy.read_only === true && policy.desktop_surface_policy === "read_only_runtime_status", "Operator surface policy is read-only."));
    items.push(validationItem(pathLabel, "mutation_blocked", policy.mutation_allowed === false && policy.protected_mutation_execution_allowed === false, "Operator surface policy blocks mutation execution."));
    items.push(validationItem(pathLabel, "sensitive_controls_blocked", policy.secret_material_exposed === false && policy.provider_key_visible === false && policy.installer_or_gateway_control === false && policy.ssh_or_cron_control === false && policy.auto_update_control === false && policy.skill_install_control === false, "Sensitive Desktop controls are blocked."));
  }

  return items;
}

function summarizeInterface(projection, validationItems, validation) {
  const interfaces = projection.runtimeAdapterInterfaces;
  const policies = projection.operatorSurfacePolicies;
  return {
    runtime_adapter_interface_status: validation.valid ? "complete" : "blocked",
    runtime_adapter_interface_contract_version: "runtime-adapter-interface-contract.v2",
    runtime_adapter_interface_count: interfaces.length,
    locked_runtime_adapter_interface_count: interfaces.filter((item) => item.interface_status === "locked").length,
    field_group_count: projection.fieldGroups.length,
    locked_field_group_count: projection.fieldGroups.filter((group) => group.lock_status === "locked").length,
    input_contract_locked_count: interfaces.filter((item) => item.input_contract_status === "locked").length,
    output_contract_locked_count: interfaces.filter((item) => item.output_contract_status === "locked").length,
    artifact_contract_locked_count: interfaces.filter((item) => item.artifact_contract_status === "locked").length,
    log_contract_locked_count: interfaces.filter((item) => item.log_contract_status === "locked").length,
    risk_contract_locked_count: interfaces.filter((item) => item.risk_contract_status === "locked").length,
    verification_contract_locked_count: interfaces.filter((item) => item.verification_contract_status === "locked").length,
    runtime_execution_contract_bound_count: interfaces.filter((item) => item.runtime_execution_contract_bound).length,
    operator_surface_policy_count: policies.length,
    locked_operator_surface_policy_count: policies.filter((policy) => policy.policy_status === "locked").length,
    read_only_policy_count: policies.filter((policy) => policy.read_only === true).length,
    mutation_allowed_count: policies.filter((policy) => policy.mutation_allowed === true).length,
    protected_mutation_request_allowed_count: policies.filter((policy) => policy.protected_mutation_request_allowed === true).length,
    protected_mutation_execution_allowed_count: policies.filter((policy) => policy.protected_mutation_execution_allowed === true).length,
    secret_material_exposed_count: policies.filter((policy) => policy.secret_material_exposed === true || policy.provider_key_visible === true).length,
    installer_or_gateway_control_count: policies.filter((policy) => policy.installer_or_gateway_control === true).length,
    runtime_source_of_truth_count: policies.filter((policy) => policy.runtime_source_of_truth === true).length,
    high_risk_runtime_interface_count: interfaces.filter((item) => ["high", "critical"].includes(item.risk_level)).length,
    verification_required_runtime_interface_count: interfaces.filter((item) => item.verification_required).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: Object.fromEntries(interfaces.map((item) => [item.runtime_id, item.interface_status])),
    by_risk_level: countBy(interfaces, "risk_level"),
    by_desktop_surface_policy: countBy(policies, "desktop_surface_policy"),
  };
}

function renderRuntimeAdapterInterfaceMarkdown(result) {
  const lines = [];
  lines.push("# Runtime Adapter Interface v2");
  lines.push("");
  lines.push(`- Status: ${result.summary.runtime_adapter_interface_status}`);
  lines.push(`- Runtime interfaces: ${result.summary.locked_runtime_adapter_interface_count}/${result.summary.runtime_adapter_interface_count}`);
  lines.push(`- Field groups locked: ${result.summary.locked_field_group_count}/${result.summary.field_group_count}`);
  lines.push(`- Operator surface policies: ${result.summary.locked_operator_surface_policy_count}/${result.summary.operator_surface_policy_count}`);
  lines.push(`- Read-only Desktop policies: ${result.summary.read_only_policy_count}/${result.summary.operator_surface_policy_count}`);
  lines.push(`- Mutation allowed: ${result.summary.mutation_allowed_count}`);
  lines.push(`- Protected mutation requests allowed: ${result.summary.protected_mutation_request_allowed_count}`);
  lines.push(`- Protected mutation execution allowed: ${result.summary.protected_mutation_execution_allowed_count}`);
  lines.push(`- Secret material exposed: ${result.summary.secret_material_exposed_count}`);
  lines.push(`- Installer/gateway controls: ${result.summary.installer_or_gateway_control_count}`);
  lines.push(`- Runtime source-of-truth claims: ${result.summary.runtime_source_of_truth_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Runtime Interfaces");
  for (const item of result.runtime_adapter_interface_contract.runtime_adapter_interfaces) {
    lines.push(`- ${item.runtime_id}: ${item.interface_status}, risk ${item.risk_level}, output ${item.output_trust}, surface ${item.desktop_surface_policy}`);
  }
  lines.push("");
  lines.push("## Operator Surface");
  lines.push("Desktop Companion v1 remains a read-only operator surface. It can display runtime status, logs, artifacts, and verification state, but it cannot execute runtimes, request protected mutations, expose secrets, control gateways/installers, or become the source of truth.");
  return `${lines.join("\n")}\n`;
}

function hasInputContract(adapter) {
  return Boolean(
    adapter.input_contract?.schema_ref
    && Array.isArray(adapter.input_contract?.accepted_context_types)
    && adapter.input_contract?.max_input_classification
    && typeof adapter.input_contract?.redaction_required === "boolean"
    && adapter.input_contract?.prompt_injection_handling,
  );
}

function hasOutputContract(adapter) {
  return Boolean(
    adapter.output_contract?.schema_ref
    && Array.isArray(adapter.output_contract?.artifact_types)
    && adapter.output_contract?.output_trust
    && typeof adapter.output_contract?.output_hash_required === "boolean",
  );
}

function validationItem(pathLabel, check, passed, message, details = {}) {
  return {
    path: pathLabel,
    check,
    status: passed ? "passed" : "failed",
    message,
    details,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, check: item.check, message: item.message, details: item.details ?? {} }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function serializableInterface(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items ?? []) {
    const value = item?.[key] ?? "unknown";
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(item);
  }
  return grouped;
}

function countBy(items, key) {
  return (items ?? []).reduce((counts, item) => {
    const value = item?.[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--capability-registry-api") parsed.capabilityRegistryApiPath = argv[++index];
    else if (arg === "--workflow-gate-freeze") parsed.workflowGateFreezePath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-adapter-interface-v2.mjs [options]

Options:
  --check                                      Fail when validation errors are present
  --out-dir <path>                            Output directory
  --runtime-agentrun-contract-freeze <path>   Runtime/AgentRun contract freeze artifact
  --capability-registry-api <path>            Capability registry API artifact
  --workflow-gate-freeze <path>               Workflow/Gate freeze artifact
  --desktop-companion-integration <path>      Desktop Companion integration design doc
  --help                                      Show this help
`);
}
