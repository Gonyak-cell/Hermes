import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SECRETS_BROKER_CONTRACT_OUT_DIR = "artifacts/secrets-broker/latest";
export const DEFAULT_SECRETS_BROKER_CONTRACT_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  sandboxPolicyModelPath: "artifacts/sandbox-policy-model/latest/sandbox-policy-model.json",
  dockerLocalBackendSelectorPath: "artifacts/docker-local-backend-selector/latest/docker-local-backend-selector.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  policyMatrixPath: "examples/core/policy-matrix.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";
const SECRET_HANDLE_KINDS = [
  "provider_api_key",
  "oauth_token",
  "ssh_key",
  "signing_certificate",
  "database_credential",
  "webhook_secret",
  "local_env_secret",
  "human_entered_secret_receipt",
];
const AGENT_RUNTIME_IDS = new Set(["hermes", "claude_code", "codex"]);
const OPTIONAL_HANDLE_RUNTIME_IDS = new Set(["local_script", "document_renderer"]);
const BLOCKED_OPERATOR_RUNTIME_IDS = new Set(["mcp_tool", "browser"]);
const METADATA_ONLY_RUNTIME_IDS = new Set(["harness"]);
const MANUAL_RUNTIME_IDS = new Set(["manual"]);

export async function runSecretsBrokerContract(options = {}) {
  const result = await buildSecretsBrokerContract(options);
  if (options.write !== false) await writeSecretsBrokerContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Secrets broker contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSecretsBrokerContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SECRETS_BROKER_CONTRACT_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_SECRETS_BROKER_CONTRACT_INPUTS.runtimeAdapterInterfaceV2Path),
    sandbox_policy_model_path: path.resolve(options.sandboxPolicyModelPath ?? DEFAULT_SECRETS_BROKER_CONTRACT_INPUTS.sandboxPolicyModelPath),
    docker_local_backend_selector_path: path.resolve(options.dockerLocalBackendSelectorPath ?? DEFAULT_SECRETS_BROKER_CONTRACT_INPUTS.dockerLocalBackendSelectorPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_SECRETS_BROKER_CONTRACT_INPUTS.toolRuntimePolicyEnforcementPath),
    policy_matrix_path: path.resolve(options.policyMatrixPath ?? DEFAULT_SECRETS_BROKER_CONTRACT_INPUTS.policyMatrixPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_SECRETS_BROKER_CONTRACT_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const sandboxPolicyModel = await readJson(inputs.sandbox_policy_model_path);
  const dockerLocalBackendSelector = await readJson(inputs.docker_local_backend_selector_path);
  const toolRuntimePolicyEnforcement = await readJson(inputs.tool_runtime_policy_enforcement_path);
  const policyMatrix = await readJson(inputs.policy_matrix_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectSecretsBrokerContract({
    runtimeAdapterInterfaceV2,
    sandboxPolicyModel,
    dockerLocalBackendSelector,
    toolRuntimePolicyEnforcement,
    policyMatrix,
    generatedAt,
  });
  const validationItems = validateSecretsBrokerContract({
    runtimeAdapterInterfaceV2,
    sandboxPolicyModel,
    dockerLocalBackendSelector,
    toolRuntimePolicyEnforcement,
    policyMatrix,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "secrets-broker-contract.v1",
    generated_at: generatedAt,
    secrets_broker_contract_id: `secrets-broker-contract.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAdapterInterfaceV2,
      sandboxPolicyModel,
      dockerLocalBackendSelector,
      toolRuntimePolicyEnforcement,
      policyMatrix,
      desktopCompanionIntegration,
    }),
    secrets_broker_contract: projection.secretsBrokerContract,
    secret_handle_policies: projection.secretHandlePolicies,
    runtime_secret_access_bindings: projection.runtimeSecretAccessBindings,
    secret_audit_bindings: projection.secretAuditBindings,
    secrets_desktop_boundary: projection.secretsDesktopBoundary,
    summary: summarizeSecretsBrokerContract(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };

  return {
    ...result,
    markdown: renderSecretsBrokerContractMarkdown(result),
  };
}

export async function writeSecretsBrokerContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableSecretsBrokerContract(result);
  await writeJson(path.join(outDir, "secrets-broker-contract.json"), serializable);
  await writeJson(path.join(outDir, "secret-handle-policies.json"), {
    schema_version: "secret-handle-policies.v1",
    generated_at: result.generated_at,
    secret_handle_policy_count: result.secret_handle_policies.length,
    secret_handle_policies: result.secret_handle_policies,
  });
  await writeJson(path.join(outDir, "runtime-secret-access-bindings.json"), {
    schema_version: "runtime-secret-access-bindings.v1",
    generated_at: result.generated_at,
    runtime_secret_access_binding_count: result.runtime_secret_access_bindings.length,
    runtime_secret_access_bindings: result.runtime_secret_access_bindings,
  });
  await writeJson(path.join(outDir, "secret-audit-bindings.json"), {
    schema_version: "secret-audit-bindings.v1",
    generated_at: result.generated_at,
    secret_audit_binding_count: result.secret_audit_bindings.length,
    secret_audit_bindings: result.secret_audit_bindings,
  });
  await writeJson(path.join(outDir, "secrets-desktop-boundary.json"), result.secrets_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "secrets-broker-validation-report.v1",
    generated_at: result.generated_at,
    secrets_broker_contract_id: result.secrets_broker_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runSecretsBrokerContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runSecretsBrokerContract(args);
    console.log(`Secrets broker contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.secrets_broker_contract_status}`);
    console.log(`Secret handle policies: ${result.summary.secret_handle_policy_count}`);
    console.log(`Runtime secret bindings: ${result.summary.runtime_secret_access_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectSecretsBrokerContract({
  runtimeAdapterInterfaceV2,
  sandboxPolicyModel,
  dockerLocalBackendSelector,
  toolRuntimePolicyEnforcement,
  policyMatrix,
  generatedAt,
}) {
  const runtimeInterfaces = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract?.runtime_adapter_interfaces ?? [];
  const operatorPolicies = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract?.operator_surface_policies ?? [];
  const runtimeBackendSelections = dockerLocalBackendSelector.runtime_backend_selections ?? [];
  const runtimePolicyGates = toolRuntimePolicyEnforcement.tool_runtime_policy_catalog?.runtime_policy_gates ?? [];
  const classifications = (policyMatrix.classification_levels ?? []).map((level) => level.classification);
  const runtimeInterfaceById = new Map(runtimeInterfaces.map((runtimeInterface) => [runtimeInterface.runtime_id, runtimeInterface]));
  const operatorPolicyByRuntimeId = new Map(operatorPolicies.map((policy) => [policy.runtime_id, policy]));
  const runtimePolicyGateByRuntimeId = groupBy(runtimePolicyGates, (gate) => gate.runtime_id);

  const secretsBrokerContract = {
    schema_version: "secrets-broker-interface.v1",
    generated_at: generatedAt,
    broker_contract_id: "secrets-broker.default",
    contract_status: "locked",
    broker_status: "locked",
    source_of_truth: "harness_control_plane",
    secret_material_source_of_truth: "external_secret_store_handle_registry",
    handle_registry_authority: "harness_control_plane",
    access_authority: "policy_snapshot_and_human_gate",
    secret_handle_required: true,
    audit_required: true,
    policy_snapshot_required: true,
    raw_secret_material_persisted: false,
    raw_secret_material_exposed_to_runtime: false,
    raw_secret_material_exposed_to_desktop: false,
    raw_secret_material_logged: false,
    provider_key_direct_access_allowed: false,
    provider_key_visible_to_desktop: false,
    runtime_self_report_trusted_for_secret_access: false,
    default_access_mode: "handle_ref_only",
    default_token_materialization: "scoped_runtime_token_only_after_gate",
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_secret_exception: true,
    desktop_surface_policy: "read_only_secret_handle_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: false,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
  };

  const secretHandlePolicies = SECRET_HANDLE_KINDS.map((secretKind, index) => buildSecretHandlePolicy({
    secretKind,
    generatedAt,
    sequence: index + 1,
  }));
  const runtimeSecretAccessBindings = runtimeBackendSelections.map((selection, index) => buildRuntimeSecretAccessBinding({
    selection,
    runtimeInterface: runtimeInterfaceById.get(selection.runtime_id) ?? {},
    operatorPolicy: operatorPolicyByRuntimeId.get(selection.runtime_id) ?? {},
    runtimePolicyGates: runtimePolicyGateByRuntimeId.get(selection.runtime_id) ?? [],
    classifications,
    generatedAt,
    sequence: index + 1,
  }));
  const secretAuditBindings = runtimeSecretAccessBindings.map((binding, index) => buildSecretAuditBinding({
    binding,
    generatedAt,
    sequence: index + 1,
  }));
  const secretsDesktopBoundary = {
    schema_version: "secrets-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "secrets-broker.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "secrets_broker",
    desktop_surface_policy: "read_only_secret_handle_status",
    source_of_truth: "harness_control_plane",
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_execution_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    credential_export_allowed: false,
    local_secret_store_write_allowed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    auto_update_control: false,
    skill_install_control: false,
    allowed_operator_actions: ["view_secret_policy_status", "view_handle_reference_metadata", "view_secret_audit_receipts", "draft_receipt_reference"],
    denied_operator_actions: ["read_raw_secret", "export_provider_key", "write_secret", "sync_secret_to_desktop_config", "start_gateway", "open_ssh_tunnel", "install_provider"],
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
    secret_handle_policy_count: secretHandlePolicies.length,
    runtime_secret_access_binding_count: runtimeSecretAccessBindings.length,
    secret_audit_binding_count: secretAuditBindings.length,
  };

  return {
    secretsBrokerContract,
    secretHandlePolicies,
    runtimeSecretAccessBindings,
    secretAuditBindings,
    secretsDesktopBoundary,
    sandbox_secret_material_allowed_count: sandboxPolicyModel.summary?.secret_material_allowed_count ?? 0,
  };
}

function buildSecretHandlePolicy({ secretKind, generatedAt, sequence }) {
  return {
    schema_version: "secret-handle-policy.v1",
    secret_handle_policy_id: `secret-handle-policy.${secretKind}`,
    generated_at: generatedAt,
    sequence,
    secret_kind: secretKind,
    policy_status: "locked",
    access_mode: "handle_ref_only",
    secret_handle_required: true,
    handle_metadata_visible: true,
    raw_secret_material_persisted: false,
    raw_secret_material_exposed: false,
    raw_secret_material_logged: false,
    provider_key_direct_access_allowed: false,
    desktop_metadata_visible: true,
    desktop_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    audit_required: true,
    policy_snapshot_required: true,
    rotation_audit_required: true,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
    allowed_broker_actions: ["register_handle_metadata", "issue_scoped_runtime_handle", "record_audit_receipt"],
    denied_broker_actions: ["read_raw_secret", "export_provider_key", "persist_secret_material", "send_secret_to_desktop", "write_desktop_provider_config"],
    source_of_truth: "harness_control_plane",
  };
}

function buildRuntimeSecretAccessBinding({
  selection,
  runtimeInterface,
  operatorPolicy,
  runtimePolicyGates,
  classifications,
  generatedAt,
  sequence,
}) {
  const runtimeId = selection.runtime_id;
  const accessStatus = runtimeSecretAccessStatus(selection);
  const handleOnly = !["blocked", "not_applicable"].includes(accessStatus);
  const runtimePolicyGateCount = runtimePolicyGates.length;
  const reviewedPolicyGateCount = runtimePolicyGates.filter((gate) => gate.runtime_policy_decision === "review").length;
  const deniedPolicyGateCount = runtimePolicyGates.filter((gate) => gate.runtime_policy_decision === "deny").length;
  return {
    schema_version: "runtime-secret-access-binding.v1",
    runtime_secret_access_binding_id: `runtime-secret-access-binding.${slug(runtimeId)}`,
    generated_at: generatedAt,
    sequence,
    runtime_id: runtimeId,
    adapter_id: selection.adapter_id,
    risk_level: selection.risk_level,
    source_runtime_interface_id: runtimeInterface.interface_id ?? null,
    source_runtime_backend_selection_id: selection.runtime_backend_selection_id,
    source_operator_surface_policy_id: operatorPolicy.operator_surface_policy_id ?? null,
    source_backend_kind: selection.source_backend_kind,
    selected_backend_kind: selection.selected_backend_kind,
    backend_selection_status: selection.selection_status,
    secret_access_status: accessStatus,
    access_mode: handleOnly ? "handle_ref_only" : accessStatus,
    secret_handle_required_for_secret_use: true,
    secret_material_required_by_default: false,
    raw_secret_material_allowed: false,
    raw_secret_material_exposed_to_runtime: false,
    raw_secret_material_exposed_to_desktop: false,
    provider_key_direct_access_allowed: false,
    provider_key_visible_to_desktop: false,
    brokered_handle_request_allowed: handleOnly,
    scoped_runtime_token_allowed: handleOnly && selection.selection_status === "selected",
    policy_snapshot_required: true,
    audit_required: true,
    audit_binding_id: `secret-audit-binding.${slug(runtimeId)}`,
    runtime_policy_gate_count: runtimePolicyGateCount,
    reviewed_runtime_policy_gate_count: reviewedPolicyGateCount,
    denied_runtime_policy_gate_count: deniedPolicyGateCount,
    classification_scope_count: classifications.length,
    p5_secret_access_status: "blocked_raw_secret_handle_only",
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_secret_exception: true,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    source_of_truth: "harness_control_plane",
    runtime_source_of_truth: false,
    decision_reason_codes: runtimeSecretReasonCodes(selection, accessStatus),
  };
}

function buildSecretAuditBinding({ binding, generatedAt, sequence }) {
  const eventType = binding.brokered_handle_request_allowed
    ? "secret.handle.requested"
    : binding.secret_access_status === "blocked"
      ? "secret.access.blocked"
      : "secret.access.not_applicable";
  return {
    schema_version: "secret-audit-binding.v1",
    secret_audit_binding_id: binding.audit_binding_id,
    generated_at: generatedAt,
    sequence,
    runtime_id: binding.runtime_id,
    source_runtime_secret_access_binding_id: binding.runtime_secret_access_binding_id,
    audit_sink: "audit_event_ledger",
    audit_event_type: eventType,
    audit_binding_status: "locked",
    actor_binding_required: true,
    run_id_required: binding.secret_access_status !== "not_applicable",
    correlation_id_required: true,
    policy_snapshot_required: true,
    secret_handle_ref_recorded: true,
    secret_kind_recorded: true,
    access_decision_recorded: true,
    raw_secret_material_logged: false,
    provider_key_logged: false,
    desktop_audit_receipt_visible: true,
    desktop_secret_material_exposed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    source_of_truth: "harness_control_plane",
  };
}

function runtimeSecretAccessStatus(selection) {
  if (METADATA_ONLY_RUNTIME_IDS.has(selection.runtime_id)) return "metadata_only";
  if (MANUAL_RUNTIME_IDS.has(selection.runtime_id)) return "receipt_reference_only";
  if (BLOCKED_OPERATOR_RUNTIME_IDS.has(selection.runtime_id) || selection.selection_status === "blocked") return "blocked";
  if (AGENT_RUNTIME_IDS.has(selection.runtime_id)) return "brokered_handle_only";
  if (OPTIONAL_HANDLE_RUNTIME_IDS.has(selection.runtime_id)) return "handle_optional";
  if (selection.selection_status === "selected") return "brokered_handle_only";
  return "not_applicable";
}

function runtimeSecretReasonCodes(selection, accessStatus) {
  if (accessStatus === "metadata_only") return ["control_plane_metadata_only", "raw_secret_material_forbidden"];
  if (accessStatus === "receipt_reference_only") return ["manual_receipt_reference_only", "raw_secret_material_forbidden"];
  if (accessStatus === "blocked") return ["operator_surface_blocked", "surface_policy_required", "raw_secret_material_forbidden"];
  if (accessStatus === "handle_optional") return ["deterministic_runtime_no_secret_by_default", "handle_required_for_exception"];
  if (accessStatus === "brokered_handle_only" && selection.selected_backend_kind === "docker") return ["sandboxed_runtime", "brokered_handle_required", "human_gate_for_exception"];
  if (accessStatus === "brokered_handle_only" && selection.selected_backend_kind === "local") return ["local_runtime", "brokered_handle_required", "audit_required"];
  return ["secret_access_not_applicable"];
}

function buildSourceContracts({
  runtimeAdapterInterfaceV2,
  sandboxPolicyModel,
  dockerLocalBackendSelector,
  toolRuntimePolicyEnforcement,
  policyMatrix,
  desktopCompanionIntegration,
}) {
  return {
    runtime_adapter_interface_v2: {
      runtime_adapter_interface_status: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status ?? "unknown",
      runtime_adapter_interface_count: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_count ?? 0,
      operator_surface_policy_count: runtimeAdapterInterfaceV2.summary?.operator_surface_policy_count ?? 0,
      secret_material_exposed_count: runtimeAdapterInterfaceV2.summary?.secret_material_exposed_count ?? 0,
      runtime_source_of_truth_count: runtimeAdapterInterfaceV2.summary?.runtime_source_of_truth_count ?? 0,
    },
    sandbox_policy_model: {
      sandbox_policy_model_status: sandboxPolicyModel.summary?.sandbox_policy_model_status ?? "unknown",
      contract_status: sandboxPolicyModel.summary?.contract_status ?? "unknown",
      runtime_sandbox_binding_count: sandboxPolicyModel.summary?.runtime_sandbox_binding_count ?? 0,
      network_access_allowed_count: sandboxPolicyModel.summary?.network_access_allowed_count ?? 0,
      external_transfer_allowed_count: sandboxPolicyModel.summary?.external_transfer_allowed_count ?? 0,
      secret_material_allowed_count: sandboxPolicyModel.summary?.secret_material_allowed_count ?? 0,
    },
    docker_local_backend_selector: {
      docker_local_backend_selector_status: dockerLocalBackendSelector.summary?.docker_local_backend_selector_status ?? "unknown",
      contract_status: dockerLocalBackendSelector.summary?.contract_status ?? "unknown",
      runtime_backend_selection_count: dockerLocalBackendSelector.summary?.runtime_backend_selection_count ?? 0,
      selected_runtime_backend_count: dockerLocalBackendSelector.summary?.selected_runtime_backend_count ?? 0,
      secret_material_allowed_count: dockerLocalBackendSelector.summary?.secret_material_allowed_count ?? 0,
      desktop_secret_material_exposed: dockerLocalBackendSelector.summary?.desktop_secret_material_exposed ?? false,
    },
    tool_runtime_policy_enforcement: {
      tool_runtime_policy_enforcement_status: toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
      runtime_policy_gate_count: toolRuntimePolicyEnforcement.summary?.runtime_policy_gate_count ?? 0,
      tool_permission_gate_count: toolRuntimePolicyEnforcement.summary?.tool_permission_gate_count ?? 0,
      protected_action_tool_gate_count: toolRuntimePolicyEnforcement.summary?.protected_action_tool_gate_count ?? 0,
    },
    policy_matrix: {
      schema_version: policyMatrix.schema_version ?? null,
      classification_level_count: policyMatrix.classification_levels?.length ?? 0,
      p5_secret_present: Boolean((policyMatrix.classification_levels ?? []).some((level) => level.classification === "P5_SECRET")),
    },
    desktop_companion_integration: {
      declares_read_only: /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /not a runtime source of truth|source of truth가 아니라/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /human gate|protected mutation/i.test(desktopCompanionIntegration),
      blocks_secret_or_provider_key_control: /secret|provider key|secrets/i.test(desktopCompanionIntegration),
      blocks_installer_gateway_or_ssh_control: /installer|gateway|SSH/i.test(desktopCompanionIntegration),
    },
  };
}

function validateSecretsBrokerContract({
  runtimeAdapterInterfaceV2,
  sandboxPolicyModel,
  dockerLocalBackendSelector,
  toolRuntimePolicyEnforcement,
  policyMatrix,
  desktopCompanionIntegration,
  secretsBrokerContract,
  secretHandlePolicies,
  runtimeSecretAccessBindings,
  secretAuditBindings,
  secretsDesktopBoundary,
}) {
  const items = [];
  const runtimeBackendSelections = dockerLocalBackendSelector.runtime_backend_selections ?? [];
  const bindingByRuntime = new Map(runtimeSecretAccessBindings.map((binding) => [binding.runtime_id, binding]));

  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_interface_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_interface_no_secret_surface", runtimeAdapterInterfaceV2.summary?.secret_material_exposed_count === 0 && runtimeAdapterInterfaceV2.summary?.runtime_source_of_truth_count === 0, "Runtime interface exposes no secret material and grants no runtime source-of-truth authority."));
  items.push(validationItem("source.sandbox_policy_model", "sandbox_policy_complete", sandboxPolicyModel.summary?.sandbox_policy_model_status === "complete", "Sandbox Policy Model is complete."));
  items.push(validationItem("source.sandbox_policy_model", "sandbox_blocks_secret_material", sandboxPolicyModel.summary?.secret_material_allowed_count === 0, "Sandbox policy allows no raw secret material."));
  items.push(validationItem("source.docker_local_backend_selector", "backend_selector_complete", dockerLocalBackendSelector.summary?.docker_local_backend_selector_status === "complete", "Docker/local backend selector is complete."));
  items.push(validationItem("source.docker_local_backend_selector", "backend_selector_blocks_secret_material", dockerLocalBackendSelector.summary?.secret_material_allowed_count === 0 && dockerLocalBackendSelector.summary?.desktop_secret_material_exposed === false, "Backend selector exposes no secret material."));
  items.push(validationItem("source.tool_runtime_policy", "tool_runtime_policy_complete", toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status === "complete", "Tool/runtime policy enforcement is complete."));
  items.push(validationItem("source.policy_matrix", "p5_secret_present", (policyMatrix.classification_levels ?? []).some((level) => level.classification === "P5_SECRET"), "Policy matrix includes P5 secret classification."));
  items.push(validationItem("source.desktop_companion", "desktop_companion_read_only_declared", /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration), "Desktop Companion remains read-only."));

  items.push(validationItem("contract.broker", "contract_locked", secretsBrokerContract.contract_status === "locked" && secretsBrokerContract.broker_status === "locked", "Secrets broker contract is locked."));
  items.push(validationItem("contract.broker", "harness_source_of_truth", secretsBrokerContract.source_of_truth === "harness_control_plane", "Harness control-plane is source of truth."));
  items.push(validationItem("contract.broker", "handle_and_audit_required", secretsBrokerContract.secret_handle_required === true && secretsBrokerContract.audit_required === true && secretsBrokerContract.policy_snapshot_required === true, "Secret access requires handle, audit, and policy snapshot."));
  items.push(validationItem("contract.broker", "raw_secret_material_forbidden", secretsBrokerContract.raw_secret_material_persisted === false && secretsBrokerContract.raw_secret_material_exposed_to_runtime === false && secretsBrokerContract.raw_secret_material_exposed_to_desktop === false && secretsBrokerContract.raw_secret_material_logged === false, "Raw secret material is not persisted, exposed, or logged."));
  items.push(validationItem("contract.broker", "provider_key_direct_access_forbidden", secretsBrokerContract.provider_key_direct_access_allowed === false && secretsBrokerContract.provider_key_visible_to_desktop === false, "Provider keys are not directly accessible or visible to Desktop."));
  items.push(validationItem("contract.broker", "exception_route_human_gated", secretsBrokerContract.protected_mutation_route === PROTECTED_MUTATION_ROUTE && secretsBrokerContract.human_gate_required_for_secret_exception === true, "Secret exceptions use protected mutation route with human gate."));

  items.push(validationItem("handle_policies", "secret_kind_count", secretHandlePolicies.length === SECRET_HANDLE_KINDS.length, "Every secret handle kind has a policy."));
  items.push(validationItem("handle_policies", "handle_policies_locked", secretHandlePolicies.every((policy) => policy.policy_status === "locked"), "Secret handle policies are locked."));
  items.push(validationItem("handle_policies", "handle_policies_forbid_raw_secret", secretHandlePolicies.every((policy) => policy.raw_secret_material_exposed === false && policy.raw_secret_material_persisted === false && policy.raw_secret_material_logged === false), "Secret handle policies forbid raw secret persistence, exposure, and logs."));
  items.push(validationItem("handle_policies", "desktop_hides_secret_material", secretHandlePolicies.every((policy) => policy.desktop_secret_material_exposed === false && policy.desktop_provider_key_visible === false), "Desktop sees no secret material or provider key from handle policies."));
  items.push(validationItem("handle_policies", "audit_required", secretHandlePolicies.every((policy) => policy.audit_required === true && policy.policy_snapshot_required === true), "Secret handle policies require audit and policy snapshot."));

  items.push(validationItem("runtime_bindings", "runtime_binding_count_matches_backend_selector", runtimeSecretAccessBindings.length === runtimeBackendSelections.length, "Every runtime backend selection has a secret access binding."));
  items.push(validationItem("runtime_bindings", "runtime_bindings_forbid_raw_secret", runtimeSecretAccessBindings.every((binding) => binding.raw_secret_material_allowed === false && binding.raw_secret_material_exposed_to_runtime === false && binding.raw_secret_material_exposed_to_desktop === false), "Runtime secret access bindings forbid raw secret material."));
  items.push(validationItem("runtime_bindings", "provider_keys_forbidden", runtimeSecretAccessBindings.every((binding) => binding.provider_key_direct_access_allowed === false && binding.provider_key_visible_to_desktop === false), "Runtime bindings forbid direct provider key access."));
  items.push(validationItem("runtime_bindings", "agents_handle_only", ["hermes", "claude_code", "codex"].every((runtimeId) => bindingByRuntime.get(runtimeId)?.secret_access_status === "brokered_handle_only"), "Agent runtimes use brokered handle-only access."));
  items.push(validationItem("runtime_bindings", "deterministic_runtimes_optional_handle", ["local_script", "document_renderer"].every((runtimeId) => bindingByRuntime.get(runtimeId)?.secret_access_status === "handle_optional"), "Deterministic runtimes default to no secret and require a handle for exceptions."));
  items.push(validationItem("runtime_bindings", "operator_surfaces_blocked", ["mcp_tool", "browser"].every((runtimeId) => bindingByRuntime.get(runtimeId)?.secret_access_status === "blocked"), "Operator surface runtimes are blocked from secret broker access."));
  items.push(validationItem("runtime_bindings", "harness_manual_not_raw_secret", bindingByRuntime.get("harness")?.secret_access_status === "metadata_only" && bindingByRuntime.get("manual")?.secret_access_status === "receipt_reference_only", "Harness and manual lanes do not receive raw secret material."));

  items.push(validationItem("audit_bindings", "audit_binding_count_matches_runtime_bindings", secretAuditBindings.length === runtimeSecretAccessBindings.length, "Every runtime secret binding has an audit binding."));
  items.push(validationItem("audit_bindings", "audit_bindings_locked", secretAuditBindings.every((binding) => binding.audit_binding_status === "locked"), "Secret audit bindings are locked."));
  items.push(validationItem("audit_bindings", "audit_records_handle_not_material", secretAuditBindings.every((binding) => binding.secret_handle_ref_recorded === true && binding.raw_secret_material_logged === false && binding.provider_key_logged === false), "Audit records secret handle references, not secret material or provider keys."));
  items.push(validationItem("audit_bindings", "audit_policy_snapshot_required", secretAuditBindings.every((binding) => binding.policy_snapshot_required === true && binding.correlation_id_required === true), "Secret audit bindings require policy snapshot and correlation id."));

  items.push(validationItem("desktop.boundary", "desktop_boundary_locked", secretsDesktopBoundary.boundary_status === "locked", "Secrets Desktop boundary is locked."));
  items.push(validationItem("desktop.boundary", "desktop_read_only", secretsDesktopBoundary.read_only === true && secretsDesktopBoundary.mutation_allowed === false, "Secrets Desktop boundary is read-only."));
  items.push(validationItem("desktop.boundary", "desktop_hides_secret_material", secretsDesktopBoundary.secret_material_exposed === false && secretsDesktopBoundary.provider_key_visible === false && secretsDesktopBoundary.credential_export_allowed === false, "Desktop cannot see or export secrets or provider keys."));
  items.push(validationItem("desktop.boundary", "desktop_no_secret_mutation_or_gateway", secretsDesktopBoundary.protected_mutation_execution_allowed === false && secretsDesktopBoundary.local_secret_store_write_allowed === false && secretsDesktopBoundary.installer_or_gateway_control === false && secretsDesktopBoundary.ssh_or_cron_control === false, "Desktop cannot mutate secrets or control gateways/SSH/cron."));
  items.push(validationItem("desktop.boundary", "desktop_not_source_of_truth", secretsDesktopBoundary.desktop_source_of_truth === false, "Desktop is not secret source of truth."));

  return items;
}

function summarizeSecretsBrokerContract(projection, validationItems, validation) {
  const runtimeBindings = projection.runtimeSecretAccessBindings;
  const handlePolicies = projection.secretHandlePolicies;
  const auditBindings = projection.secretAuditBindings;
  const desktopBoundary = projection.secretsDesktopBoundary;
  return {
    secrets_broker_contract_status: validation.valid ? "complete" : "attention",
    broker_contract_id: projection.secretsBrokerContract.broker_contract_id,
    contract_status: projection.secretsBrokerContract.contract_status,
    broker_status: projection.secretsBrokerContract.broker_status,
    source_of_truth: projection.secretsBrokerContract.source_of_truth,
    secret_material_source_of_truth: projection.secretsBrokerContract.secret_material_source_of_truth,
    access_authority: projection.secretsBrokerContract.access_authority,
    secret_handle_required: projection.secretsBrokerContract.secret_handle_required,
    audit_required: projection.secretsBrokerContract.audit_required,
    policy_snapshot_required: projection.secretsBrokerContract.policy_snapshot_required,
    raw_secret_material_persisted: projection.secretsBrokerContract.raw_secret_material_persisted,
    raw_secret_material_exposed_to_runtime: projection.secretsBrokerContract.raw_secret_material_exposed_to_runtime,
    raw_secret_material_exposed_to_desktop: projection.secretsBrokerContract.raw_secret_material_exposed_to_desktop,
    raw_secret_material_logged: projection.secretsBrokerContract.raw_secret_material_logged,
    provider_key_direct_access_allowed: projection.secretsBrokerContract.provider_key_direct_access_allowed,
    provider_key_visible_to_desktop: projection.secretsBrokerContract.provider_key_visible_to_desktop,
    runtime_self_report_trusted_for_secret_access: projection.secretsBrokerContract.runtime_self_report_trusted_for_secret_access,
    secret_handle_policy_count: handlePolicies.length,
    locked_secret_handle_policy_count: handlePolicies.filter((policy) => policy.policy_status === "locked").length,
    desktop_visible_handle_metadata_count: handlePolicies.filter((policy) => policy.desktop_metadata_visible === true).length,
    runtime_secret_access_binding_count: runtimeBindings.length,
    brokered_handle_only_runtime_count: runtimeBindings.filter((binding) => binding.secret_access_status === "brokered_handle_only").length,
    handle_optional_runtime_count: runtimeBindings.filter((binding) => binding.secret_access_status === "handle_optional").length,
    metadata_only_runtime_count: runtimeBindings.filter((binding) => binding.secret_access_status === "metadata_only").length,
    receipt_reference_runtime_count: runtimeBindings.filter((binding) => binding.secret_access_status === "receipt_reference_only").length,
    blocked_runtime_secret_access_count: runtimeBindings.filter((binding) => binding.secret_access_status === "blocked").length,
    runtime_secret_handle_required_count: runtimeBindings.filter((binding) => binding.secret_handle_required_for_secret_use === true).length,
    brokered_handle_request_allowed_count: runtimeBindings.filter((binding) => binding.brokered_handle_request_allowed === true).length,
    scoped_runtime_token_allowed_count: runtimeBindings.filter((binding) => binding.scoped_runtime_token_allowed === true).length,
    raw_secret_material_allowed_count: runtimeBindings.filter((binding) => binding.raw_secret_material_allowed === true).length + handlePolicies.filter((policy) => policy.raw_secret_material_exposed === true || policy.raw_secret_material_persisted === true).length,
    runtime_raw_secret_exposed_count: runtimeBindings.filter((binding) => binding.raw_secret_material_exposed_to_runtime === true).length,
    desktop_secret_material_exposed_count: runtimeBindings.filter((binding) => binding.raw_secret_material_exposed_to_desktop === true || binding.desktop_secret_material_exposed === true).length + handlePolicies.filter((policy) => policy.desktop_secret_material_exposed === true).length + (desktopBoundary.secret_material_exposed ? 1 : 0),
    provider_key_direct_access_allowed_count: runtimeBindings.filter((binding) => binding.provider_key_direct_access_allowed === true).length + handlePolicies.filter((policy) => policy.provider_key_direct_access_allowed === true).length + (projection.secretsBrokerContract.provider_key_direct_access_allowed ? 1 : 0),
    provider_key_visible_to_desktop_count: runtimeBindings.filter((binding) => binding.provider_key_visible_to_desktop === true || binding.desktop_provider_key_visible === true).length + handlePolicies.filter((policy) => policy.desktop_provider_key_visible === true).length + (desktopBoundary.provider_key_visible ? 1 : 0),
    secret_audit_binding_count: auditBindings.length,
    locked_secret_audit_binding_count: auditBindings.filter((binding) => binding.audit_binding_status === "locked").length,
    audit_policy_snapshot_required_count: auditBindings.filter((binding) => binding.policy_snapshot_required === true).length,
    raw_secret_material_logged_count: auditBindings.filter((binding) => binding.raw_secret_material_logged === true).length,
    provider_key_logged_count: auditBindings.filter((binding) => binding.provider_key_logged === true).length,
    protected_mutation_route: projection.secretsBrokerContract.protected_mutation_route,
    human_gate_required_for_secret_exception: projection.secretsBrokerContract.human_gate_required_for_secret_exception,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_protected_mutation_request_allowed: desktopBoundary.protected_mutation_request_allowed,
    desktop_protected_mutation_execution_allowed: desktopBoundary.protected_mutation_execution_allowed,
    desktop_secret_material_exposed: desktopBoundary.secret_material_exposed,
    desktop_provider_key_visible: desktopBoundary.provider_key_visible,
    desktop_credential_export_allowed: desktopBoundary.credential_export_allowed,
    desktop_local_secret_store_write_allowed: desktopBoundary.local_secret_store_write_allowed,
    desktop_installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    desktop_ssh_or_cron_control: desktopBoundary.ssh_or_cron_control,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function renderSecretsBrokerContractMarkdown(result) {
  const summary = result.summary;
  const lines = [
    "# Secrets Broker Contract",
    "",
    `- Status: ${summary.secrets_broker_contract_status}`,
    `- Broker: ${summary.broker_status}`,
    `- Secret handle policies: ${summary.secret_handle_policy_count}`,
    `- Runtime secret bindings: ${summary.runtime_secret_access_binding_count}`,
    `- Brokered handle-only runtimes: ${summary.brokered_handle_only_runtime_count}`,
    `- Blocked runtime secret access: ${summary.blocked_runtime_secret_access_count}`,
    `- Raw secret material allowed count: ${summary.raw_secret_material_allowed_count}`,
    `- Provider key direct access count: ${summary.provider_key_direct_access_allowed_count}`,
    `- Desktop secret material exposed: ${summary.desktop_secret_material_exposed}`,
    `- Desktop provider key visible: ${summary.desktop_provider_key_visible}`,
    `- Secret audit bindings: ${summary.secret_audit_binding_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Runtime Secret Access",
    "",
    "| Runtime | Backend | Secret Access | Handle Request | Audit |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const binding of result.runtime_secret_access_bindings) {
    lines.push(`| ${binding.runtime_id} | ${binding.selected_backend_kind ?? "none"} | ${binding.secret_access_status} | ${binding.brokered_handle_request_allowed} | ${binding.audit_required} |`);
  }
  lines.push("", "## Secret Handle Policies", "");
  lines.push("| Secret Kind | Access | Desktop Metadata | Secret Exposed |");
  lines.push("| --- | --- | --- | --- |");
  for (const policy of result.secret_handle_policies) {
    lines.push(`| ${policy.secret_kind} | ${policy.access_mode} | ${policy.desktop_metadata_visible} | ${policy.desktop_secret_material_exposed} |`);
  }
  lines.push("", "## Validation", "");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.check_id} - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableSecretsBrokerContract(result) {
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

function groupBy(items, keyFn) {
  const result = new Map();
  for (const item of items ?? []) {
    const key = keyFn(item);
    const group = result.get(key) ?? [];
    group.push(item);
    result.set(key, group);
  }
  return result;
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
    else if (arg === "--sandbox-policy-model") parsed.sandboxPolicyModelPath = argv[++index];
    else if (arg === "--docker-local-backend-selector") parsed.dockerLocalBackendSelectorPath = argv[++index];
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--policy-matrix") parsed.policyMatrixPath = argv[++index];
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
  console.log(`Usage: node scripts/secrets-broker-contract.mjs [options]

Options:
  --out-dir <path>                         Output directory.
  --runtime-adapter-interface-v2 <path>    runtime-adapter-interface-v2.json input path.
  --sandbox-policy-model <path>            sandbox-policy-model.json input path.
  --docker-local-backend-selector <path>   docker-local-backend-selector.json input path.
  --tool-runtime-policy <path>             tool-runtime-policy-enforcement.json input path.
  --policy-matrix <path>                   policy-matrix.json input path.
  --desktop-companion-integration <path>   desktop companion design doc path.
  --check                                  Exit non-zero if validation fails.
`);
}
