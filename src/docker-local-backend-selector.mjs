import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DOCKER_LOCAL_BACKEND_SELECTOR_OUT_DIR = "artifacts/docker-local-backend-selector/latest";
export const DEFAULT_DOCKER_LOCAL_BACKEND_SELECTOR_INPUTS = {
  sandboxPolicyModelPath: "artifacts/sandbox-policy-model/latest/sandbox-policy-model.json",
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  policyMatrixPath: "examples/core/policy-matrix.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const SELECTABLE_BACKEND_KINDS = ["local", "docker"];
const BLOCKED_BACKEND_KINDS = ["ssh", "cloud"];
const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";
const AGENT_RUNTIME_IDS = new Set(["hermes", "claude_code", "codex"]);
const OPERATOR_SURFACE_RUNTIME_IDS = new Set(["mcp_tool", "browser"]);
const NON_BACKEND_RUNTIME_IDS = new Set(["harness", "manual"]);

export async function runDockerLocalBackendSelector(options = {}) {
  const result = await buildDockerLocalBackendSelector(options);
  if (options.write !== false) await writeDockerLocalBackendSelector(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Docker/local backend selector validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDockerLocalBackendSelector(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DOCKER_LOCAL_BACKEND_SELECTOR_OUT_DIR);
  const inputs = {
    sandbox_policy_model_path: path.resolve(options.sandboxPolicyModelPath ?? DEFAULT_DOCKER_LOCAL_BACKEND_SELECTOR_INPUTS.sandboxPolicyModelPath),
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_DOCKER_LOCAL_BACKEND_SELECTOR_INPUTS.runtimeAdapterInterfaceV2Path),
    policy_matrix_path: path.resolve(options.policyMatrixPath ?? DEFAULT_DOCKER_LOCAL_BACKEND_SELECTOR_INPUTS.policyMatrixPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_DOCKER_LOCAL_BACKEND_SELECTOR_INPUTS.desktopCompanionIntegrationPath),
  };

  const sandboxPolicyModel = await readJson(inputs.sandbox_policy_model_path);
  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const policyMatrix = await readJson(inputs.policy_matrix_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectDockerLocalBackendSelector({
    sandboxPolicyModel,
    runtimeAdapterInterfaceV2,
    policyMatrix,
    generatedAt,
  });
  const validationItems = validateDockerLocalBackendSelector({
    sandboxPolicyModel,
    runtimeAdapterInterfaceV2,
    policyMatrix,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "docker-local-backend-selector.v1",
    generated_at: generatedAt,
    docker_local_backend_selector_id: `docker-local-backend-selector.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      sandboxPolicyModel,
      runtimeAdapterInterfaceV2,
      policyMatrix,
      desktopCompanionIntegration,
    }),
    backend_selector_contract: projection.backendSelectorContract,
    backend_selection_rules: projection.backendSelectionRules,
    runtime_backend_selections: projection.runtimeBackendSelections,
    classification_backend_selections: projection.classificationBackendSelections,
    runtime_classification_backend_matrix: projection.runtimeClassificationBackendMatrix,
    backend_selector_desktop_boundary: projection.backendSelectorDesktopBoundary,
    summary: summarizeDockerLocalBackendSelector(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };

  return {
    ...result,
    markdown: renderDockerLocalBackendSelectorMarkdown(result),
  };
}

export async function writeDockerLocalBackendSelector(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDockerLocalBackendSelector(result);
  await writeJson(path.join(outDir, "docker-local-backend-selector.json"), serializable);
  await writeJson(path.join(outDir, "backend-selection-rules.json"), {
    schema_version: "backend-selection-rules.v1",
    generated_at: result.generated_at,
    backend_selection_rule_count: result.backend_selection_rules.length,
    backend_selection_rules: result.backend_selection_rules,
  });
  await writeJson(path.join(outDir, "runtime-backend-selections.json"), {
    schema_version: "runtime-backend-selections.v1",
    generated_at: result.generated_at,
    runtime_backend_selection_count: result.runtime_backend_selections.length,
    runtime_backend_selections: result.runtime_backend_selections,
  });
  await writeJson(path.join(outDir, "classification-backend-selections.json"), {
    schema_version: "classification-backend-selections.v1",
    generated_at: result.generated_at,
    classification_backend_selection_count: result.classification_backend_selections.length,
    classification_backend_selections: result.classification_backend_selections,
  });
  await writeJson(path.join(outDir, "runtime-classification-backend-matrix.json"), {
    schema_version: "runtime-classification-backend-matrix.v1",
    generated_at: result.generated_at,
    matrix_row_count: result.runtime_classification_backend_matrix.length,
    runtime_classification_backend_matrix: result.runtime_classification_backend_matrix,
  });
  await writeJson(path.join(outDir, "backend-selector-desktop-boundary.json"), result.backend_selector_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "docker-local-backend-selector-validation-report.v1",
    generated_at: result.generated_at,
    docker_local_backend_selector_id: result.docker_local_backend_selector_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDockerLocalBackendSelectorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runDockerLocalBackendSelector(args);
    console.log(`Docker/local backend selector written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.docker_local_backend_selector_status}`);
    console.log(`Runtime selections: ${result.summary.runtime_backend_selection_count}`);
    console.log(`Classification selections: ${result.summary.classification_backend_selection_count}`);
    console.log(`Selected local/docker runtimes: ${result.summary.selected_runtime_backend_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectDockerLocalBackendSelector({
  sandboxPolicyModel,
  runtimeAdapterInterfaceV2,
  policyMatrix,
  generatedAt,
}) {
  const classificationLevels = policyMatrix.classification_levels ?? [];
  const runtimeRules = policyMatrix.runtime_rules ?? [];
  const sandboxBindings = sandboxPolicyModel.runtime_sandbox_bindings ?? [];
  const sandboxBackendPolicies = sandboxPolicyModel.sandbox_backend_policies ?? [];
  const backendPolicyByKind = new Map(sandboxBackendPolicies.map((policy) => [policy.backend_kind, policy]));

  const backendSelectorContract = {
    schema_version: "backend-selector-contract.v1",
    generated_at: generatedAt,
    contract_id: "docker-local-backend-selector.default",
    contract_status: "locked",
    selector_status: "locked",
    source_of_truth: "harness_control_plane",
    selection_authority: "policy_snapshot_and_sandbox_model",
    selectable_backend_kinds: SELECTABLE_BACKEND_KINDS,
    blocked_backend_kinds: BLOCKED_BACKEND_KINDS,
    operator_surface_backend_kinds: ["operator_surface"],
    non_execution_backend_kinds: ["control_plane", "manual"],
    risk_inputs: ["runtime_risk_level", "external_execution", "sandbox_required", "workspace_isolation_type"],
    classification_inputs: classificationLevels.map((level) => level.classification),
    default_network_access_allowed: false,
    default_external_transfer_allowed: false,
    secret_material_allowed: false,
    runtime_self_report_trusted: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_protected_mutation: true,
    desktop_surface_policy: "read_only_backend_selection_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_runtime_source_of_truth: false,
  };

  const backendSelectionRules = classificationLevels.map((classificationLevel, index) => buildBackendSelectionRule({
    classificationLevel,
    runtimeRule: runtimeRules.find((rule) => rule.classification === classificationLevel.classification) ?? {},
    sequence: index + 1,
    generatedAt,
  }));

  const runtimeBackendSelections = sandboxBindings.map((binding, index) => buildRuntimeBackendSelection({
    binding,
    backendPolicyByKind,
    runtimeRules,
    sequence: index + 1,
    generatedAt,
  }));
  const runtimeClassificationBackendMatrix = runtimeBackendSelections.flatMap((selection) => selection.classification_outcomes);
  const classificationBackendSelections = classificationLevels.map((classificationLevel, index) => buildClassificationBackendSelection({
    classificationLevel,
    runtimeRule: runtimeRules.find((rule) => rule.classification === classificationLevel.classification) ?? {},
    runtimeClassificationBackendMatrix,
    sequence: index + 1,
    generatedAt,
  }));

  const operatorPolicies = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract?.operator_surface_policies ?? [];
  const backendSelectorDesktopBoundary = {
    schema_version: "backend-selector-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "docker-local-backend-selector.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "docker_local_backend_selector",
    desktop_surface_policy: "read_only_backend_selection_status",
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
    allowed_operator_actions: ["view_backend_selection", "view_runtime_backend_matrix", "view_classification_backend_policy", "draft_receipt_reference"],
    denied_operator_actions: ["change_backend_selection", "execute_local_process", "start_container", "open_ssh_tunnel", "start_cloud_runtime", "install_runtime", "change_policy"],
    operator_surface_policy_count: operatorPolicies.length,
    read_only_operator_surface_policy_count: operatorPolicies.filter((policy) => policy.read_only === true && policy.mutation_allowed === false).length,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
  };

  return {
    backendSelectorContract,
    backendSelectionRules,
    runtimeBackendSelections,
    classificationBackendSelections,
    runtimeClassificationBackendMatrix,
    backendSelectorDesktopBoundary,
  };
}

function buildBackendSelectionRule({ classificationLevel, runtimeRule, sequence, generatedAt }) {
  const classification = classificationLevel.classification;
  const sensitivityRank = classificationRank(classification);
  const secretLike = classification === "P5_SECRET";
  return {
    schema_version: "backend-selection-rule.v1",
    backend_selection_rule_id: `backend-selection-rule.${slug(classification)}`,
    generated_at: generatedAt,
    sequence,
    classification,
    classification_name: classificationLevel.name ?? classification,
    default_external_model_policy: classificationLevel.default_external_model_policy ?? "unknown",
    allowed_runtime_ids: runtimeRule.allowed_runtimes ?? [],
    restricted_runtime_ids: runtimeRule.restricted_runtimes ?? [],
    forbidden_runtime_ids: runtimeRule.forbidden_runtimes ?? [],
    required_gate_ids: runtimeRule.required_gates ?? [],
    selectable_backend_kinds: secretLike ? [] : SELECTABLE_BACKEND_KINDS,
    protected_backend_kinds: secretLike ? ["local"] : sensitivityRank >= 2 ? SELECTABLE_BACKEND_KINDS : [],
    blocked_backend_kinds: secretLike ? ["docker", ...BLOCKED_BACKEND_KINDS] : BLOCKED_BACKEND_KINDS,
    preferred_backend_strategy: preferredBackendStrategy(classification),
    network_access_allowed: false,
    external_transfer_allowed: false,
    secret_material_allowed: false,
    redaction_required_for_agent_runtime: sensitivityRank >= 2,
    human_gate_required_for_restricted_runtime: sensitivityRank >= 2 || secretLike,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    source_of_truth: "harness_control_plane",
  };
}

function buildRuntimeBackendSelection({ binding, backendPolicyByKind, runtimeRules, sequence, generatedAt }) {
  const selectedBackendKind = selectableBackendKind(binding);
  const selectionStatus = runtimeSelectionStatus(binding, selectedBackendKind);
  const backendPolicy = selectedBackendKind ? backendPolicyByKind.get(selectedBackendKind) : null;
  const classificationOutcomes = runtimeRules.map((runtimeRule, index) => buildRuntimeClassificationOutcome({
    binding,
    runtimeRule,
    selectedBackendKind,
    selectionStatus,
    sequence,
    classificationSequence: index + 1,
    generatedAt,
  }));

  return {
    schema_version: "runtime-backend-selection.v1",
    runtime_backend_selection_id: `runtime-backend-selection.${slug(binding.runtime_id)}`,
    generated_at: generatedAt,
    sequence,
    runtime_id: binding.runtime_id,
    adapter_id: binding.adapter_id,
    risk_level: binding.risk_level,
    sandbox_required: binding.sandbox_required === true,
    source_sandbox_binding_id: binding.runtime_sandbox_binding_id,
    source_backend_kind: binding.backend_kind,
    candidate_backend_kind: binding.backend_kind,
    selected_backend_kind: selectedBackendKind,
    selected_backend_policy_id: backendPolicy?.backend_policy_id ?? null,
    selection_status: selectionStatus,
    execution_allowed_by_selector: selectionStatus === "selected",
    workspace_isolation_type: binding.workspace_isolation_type,
    git_worktree_overlay_required: binding.git_worktree_overlay_required === true,
    network_access_allowed: false,
    external_transfer_allowed: false,
    secret_material_allowed: false,
    runtime_self_report_trusted: false,
    human_gate_required_for_selected_backend: binding.human_gate_required_for_execution === true || binding.risk_level === "high",
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_execution_allowed: false,
    source_of_truth: "harness_control_plane",
    runtime_source_of_truth: false,
    decision_reason_codes: runtimeSelectionReasonCodes(binding, selectedBackendKind, selectionStatus),
    classification_outcomes: classificationOutcomes,
  };
}

function buildRuntimeClassificationOutcome({
  binding,
  runtimeRule,
  selectedBackendKind,
  selectionStatus,
  sequence,
  classificationSequence,
  generatedAt,
}) {
  const runtimeId = binding.runtime_id;
  const classification = runtimeRule.classification;
  const runtimeAllowed = (runtimeRule.allowed_runtimes ?? []).includes(runtimeId);
  const runtimeRestricted = (runtimeRule.restricted_runtimes ?? []).includes(runtimeId);
  const runtimeForbidden = (runtimeRule.forbidden_runtimes ?? []).includes(runtimeId);
  const classificationGateRequired = runtimeRestricted || classificationRank(classification) >= 2;
  const runtimeExecutionGateRequired = binding.human_gate_required_for_execution === true || binding.risk_level === "high";
  const secretLike = classification === "P5_SECRET";

  let backendSelectionStatus = "blocked";
  let backendKind = null;
  let reasonCodes = [];

  if (selectionStatus === "not_applicable") {
    backendSelectionStatus = "not_applicable";
    reasonCodes = ["runtime_not_backend_selected"];
  } else if (selectionStatus === "blocked") {
    backendSelectionStatus = "blocked";
    reasonCodes = ["runtime_backend_blocked", binding.backend_kind === "operator_surface" ? "operator_surface_not_local_or_docker" : "source_backend_not_selectable"];
  } else if (runtimeForbidden || (secretLike && selectedBackendKind === "docker")) {
    backendSelectionStatus = "blocked";
    reasonCodes = runtimeForbidden ? ["runtime_forbidden_for_classification"] : ["secret_material_blocks_docker_selection"];
  } else if (runtimeRestricted) {
    backendSelectionStatus = "selected_with_human_gate";
    backendKind = selectedBackendKind;
    reasonCodes = ["runtime_restricted_for_classification", "human_gate_required", "redaction_required"];
  } else if (runtimeAllowed) {
    backendSelectionStatus = classificationGateRequired || runtimeExecutionGateRequired
      ? "selected_with_human_gate"
      : "selected";
    backendKind = selectedBackendKind;
    reasonCodes = backendSelectionStatus === "selected_with_human_gate"
      ? ["runtime_allowed_for_classification", "human_gate_required"]
      : ["runtime_allowed_for_classification", "backend_selected"];
  } else {
    backendSelectionStatus = "blocked";
    reasonCodes = ["runtime_not_declared_for_classification"];
  }

  return {
    schema_version: "runtime-classification-backend-selection.v1",
    runtime_classification_backend_selection_id: `runtime-classification-backend-selection.${slug(runtimeId)}.${slug(classification)}`,
    generated_at: generatedAt,
    sequence: (sequence * 100) + classificationSequence,
    runtime_id: runtimeId,
    classification,
    risk_level: binding.risk_level,
    selected_backend_kind: backendKind,
    backend_selection_status: backendSelectionStatus,
    classification_gate_required: classificationGateRequired,
    runtime_execution_gate_required: runtimeExecutionGateRequired,
    human_gate_required: backendSelectionStatus === "selected_with_human_gate",
    redaction_required: runtimeRestricted || (AGENT_RUNTIME_IDS.has(runtimeId) && classificationRank(classification) >= 2),
    network_access_allowed: false,
    external_transfer_allowed: false,
    secret_material_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    decision_reason_codes: reasonCodes,
  };
}

function buildClassificationBackendSelection({
  classificationLevel,
  runtimeRule,
  runtimeClassificationBackendMatrix,
  sequence,
  generatedAt,
}) {
  const classification = classificationLevel.classification;
  const outcomes = runtimeClassificationBackendMatrix.filter((row) => row.classification === classification);
  const nonProtectedSelectedBackends = unique(outcomes
    .filter((row) => row.backend_selection_status === "selected")
    .map((row) => row.selected_backend_kind)
    .filter(Boolean));
  const protectedBackends = unique(outcomes
    .filter((row) => row.backend_selection_status === "selected_with_human_gate")
    .map((row) => row.selected_backend_kind)
    .filter(Boolean));
  const selectedBackendKinds = classification === "P5_SECRET" ? [] : nonProtectedSelectedBackends;
  const protectedBackendKinds = classification === "P5_SECRET" ? unique(["local", ...protectedBackends.filter((kind) => kind === "local")]) : protectedBackends;
  const blockedBackendKinds = unique([
    ...BLOCKED_BACKEND_KINDS,
    ...(classification === "P5_SECRET" ? ["docker"] : []),
  ]);
  const backendSelectionStatus = classification === "P5_SECRET"
    ? "protected_review_only"
    : protectedBackendKinds.length > 0
      ? "selected_with_human_gate"
      : "selected";

  return {
    schema_version: "classification-backend-selection.v1",
    classification_backend_selection_id: `classification-backend-selection.${slug(classification)}`,
    generated_at: generatedAt,
    sequence,
    classification,
    classification_name: classificationLevel.name ?? classification,
    default_external_model_policy: classificationLevel.default_external_model_policy ?? "unknown",
    backend_selection_status: backendSelectionStatus,
    selected_backend_kinds: selectedBackendKinds,
    protected_backend_kinds: protectedBackendKinds,
    blocked_backend_kinds: blockedBackendKinds,
    allowed_runtime_ids: runtimeRule.allowed_runtimes ?? [],
    restricted_runtime_ids: runtimeRule.restricted_runtimes ?? [],
    forbidden_runtime_ids: runtimeRule.forbidden_runtimes ?? [],
    runtime_outcome_count: outcomes.length,
    selected_runtime_outcome_count: outcomes.filter((row) => row.backend_selection_status === "selected").length,
    protected_runtime_outcome_count: outcomes.filter((row) => row.backend_selection_status === "selected_with_human_gate").length,
    blocked_runtime_outcome_count: outcomes.filter((row) => row.backend_selection_status === "blocked").length,
    not_applicable_runtime_outcome_count: outcomes.filter((row) => row.backend_selection_status === "not_applicable").length,
    network_access_allowed: false,
    external_transfer_allowed: false,
    secret_material_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required: backendSelectionStatus !== "selected",
    source_of_truth: "harness_control_plane",
  };
}

function selectableBackendKind(binding) {
  if (SELECTABLE_BACKEND_KINDS.includes(binding.backend_kind) && binding.policy_decision_status === "allowed") {
    return binding.backend_kind;
  }
  return null;
}

function runtimeSelectionStatus(binding, selectedBackendKind) {
  if (selectedBackendKind) return "selected";
  if (NON_BACKEND_RUNTIME_IDS.has(binding.runtime_id) || ["control_plane", "manual"].includes(binding.backend_kind)) return "not_applicable";
  if (OPERATOR_SURFACE_RUNTIME_IDS.has(binding.runtime_id) || binding.backend_kind === "operator_surface") return "blocked";
  return "blocked";
}

function runtimeSelectionReasonCodes(binding, selectedBackendKind, selectionStatus) {
  if (selectionStatus === "selected" && selectedBackendKind === "local") return ["sandbox_policy_allowed", "local_temp_dir_selected"];
  if (selectionStatus === "selected" && selectedBackendKind === "docker" && binding.git_worktree_overlay_required) return ["sandbox_policy_allowed", "docker_selected", "git_worktree_overlay_required"];
  if (selectionStatus === "selected" && selectedBackendKind === "docker") return ["sandbox_policy_allowed", "docker_container_selected"];
  if (selectionStatus === "not_applicable") return ["runtime_not_execution_backend"];
  if (binding.backend_kind === "operator_surface") return ["operator_surface_not_selectable", "surface_policy_required"];
  return ["backend_not_selectable"];
}

function buildSourceContracts({
  sandboxPolicyModel,
  runtimeAdapterInterfaceV2,
  policyMatrix,
  desktopCompanionIntegration,
}) {
  return {
    sandbox_policy_model: {
      sandbox_policy_model_status: sandboxPolicyModel.summary?.sandbox_policy_model_status ?? "unknown",
      contract_status: sandboxPolicyModel.summary?.contract_status ?? "unknown",
      local_backend_policy_status: sandboxPolicyModel.summary?.local_backend_policy_status ?? "unknown",
      docker_backend_policy_status: sandboxPolicyModel.summary?.docker_backend_policy_status ?? "unknown",
      ssh_backend_policy_status: sandboxPolicyModel.summary?.ssh_backend_policy_status ?? "unknown",
      cloud_backend_policy_status: sandboxPolicyModel.summary?.cloud_backend_policy_status ?? "unknown",
      runtime_sandbox_binding_count: sandboxPolicyModel.summary?.runtime_sandbox_binding_count ?? 0,
      network_access_allowed_count: sandboxPolicyModel.summary?.network_access_allowed_count ?? 0,
      external_transfer_allowed_count: sandboxPolicyModel.summary?.external_transfer_allowed_count ?? 0,
      secret_material_allowed_count: sandboxPolicyModel.summary?.secret_material_allowed_count ?? 0,
    },
    runtime_adapter_interface_v2: {
      runtime_adapter_interface_status: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status ?? "unknown",
      operator_surface_policy_count: runtimeAdapterInterfaceV2.summary?.operator_surface_policy_count ?? 0,
      read_only_policy_count: runtimeAdapterInterfaceV2.summary?.read_only_policy_count ?? 0,
    },
    policy_matrix: {
      schema_version: policyMatrix.schema_version ?? null,
      classification_level_count: policyMatrix.classification_levels?.length ?? 0,
      runtime_rule_count: policyMatrix.runtime_rules?.length ?? 0,
    },
    desktop_companion_integration: {
      declares_read_only: /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /not a runtime source of truth|source of truth가 아니라/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /human gate|protected mutation/i.test(desktopCompanionIntegration),
      blocks_installer_gateway_or_ssh_control: /installer|gateway|SSH/i.test(desktopCompanionIntegration),
    },
  };
}

function validateDockerLocalBackendSelector({
  sandboxPolicyModel,
  runtimeAdapterInterfaceV2,
  policyMatrix,
  desktopCompanionIntegration,
  backendSelectorContract,
  backendSelectionRules,
  runtimeBackendSelections,
  classificationBackendSelections,
  runtimeClassificationBackendMatrix,
  backendSelectorDesktopBoundary,
}) {
  const items = [];
  const classificationLevels = policyMatrix.classification_levels ?? [];
  const sandboxBindings = sandboxPolicyModel.runtime_sandbox_bindings ?? [];
  const selectionByRuntime = new Map(runtimeBackendSelections.map((selection) => [selection.runtime_id, selection]));
  const classificationSelectionById = new Map(classificationBackendSelections.map((selection) => [selection.classification, selection]));

  items.push(validationItem("source.sandbox_policy_model", "sandbox_policy_complete", sandboxPolicyModel.summary?.sandbox_policy_model_status === "complete", "Sandbox Policy Model is complete."));
  items.push(validationItem("source.sandbox_policy_model", "local_docker_allowed", sandboxPolicyModel.summary?.local_backend_policy_status === "allowed" && sandboxPolicyModel.summary?.docker_backend_policy_status === "allowed", "Local and Docker backend policies are allowed."));
  items.push(validationItem("source.sandbox_policy_model", "ssh_cloud_blocked", sandboxPolicyModel.summary?.ssh_backend_policy_status === "blocked_by_default" && sandboxPolicyModel.summary?.cloud_backend_policy_status === "blocked_by_default", "SSH and cloud remain blocked by default."));
  items.push(validationItem("source.sandbox_policy_model", "no_network_external_secret", sandboxPolicyModel.summary?.network_access_allowed_count === 0 && sandboxPolicyModel.summary?.external_transfer_allowed_count === 0 && sandboxPolicyModel.summary?.secret_material_allowed_count === 0, "Sandbox policy disables network, external transfer, and raw secret material."));
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_interface_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.policy_matrix", "classification_rules_present", classificationLevels.length >= 6 && (policyMatrix.runtime_rules?.length ?? 0) >= classificationLevels.length, "Policy matrix has classification runtime rules."));
  items.push(validationItem("source.desktop_companion", "desktop_companion_read_only_declared", /read[- ]only|읽기 전용/i.test(desktopCompanionIntegration), "Desktop Companion is read-only by default."));
  items.push(validationItem("source.desktop_companion", "desktop_companion_not_runtime_source", /not a runtime source of truth|source of truth가 아니라/i.test(desktopCompanionIntegration), "Desktop Companion is not runtime source of truth."));

  items.push(validationItem("contract.selector", "contract_locked", backendSelectorContract.contract_status === "locked" && backendSelectorContract.selector_status === "locked", "Backend selector contract is locked."));
  items.push(validationItem("contract.selector", "harness_source_of_truth", backendSelectorContract.source_of_truth === "harness_control_plane", "Harness control-plane is source of truth."));
  items.push(validationItem("contract.selector", "only_local_docker_selectable", arraySetEquals(backendSelectorContract.selectable_backend_kinds, SELECTABLE_BACKEND_KINDS), "Only local and Docker are selectable backends."));
  items.push(validationItem("contract.selector", "ssh_cloud_excluded", BLOCKED_BACKEND_KINDS.every((kind) => backendSelectorContract.blocked_backend_kinds.includes(kind)), "SSH and cloud are excluded from selection."));
  items.push(validationItem("contract.selector", "runtime_self_report_untrusted", backendSelectorContract.runtime_self_report_trusted === false, "Runtime self-report is not trusted for backend selection."));
  items.push(validationItem("rules.classifications", "rule_count_matches_classifications", backendSelectionRules.length === classificationLevels.length, "Every classification has a backend selection rule."));
  items.push(validationItem("rules.secrets", "secret_classification_protected_only", backendSelectionRules.find((rule) => rule.classification === "P5_SECRET")?.selectable_backend_kinds.length === 0, "P5 secret material has no automatic backend selection."));

  items.push(validationItem("runtime.selections", "all_runtime_selections_present", runtimeBackendSelections.length === sandboxBindings.length, "Every sandbox binding has a backend selection row."));
  items.push(validationItem("runtime.selections", "selected_backends_only_local_or_docker", runtimeBackendSelections.filter((selection) => selection.selection_status === "selected").every((selection) => SELECTABLE_BACKEND_KINDS.includes(selection.selected_backend_kind)), "Selected runtime backends are local or Docker only."));
  items.push(validationItem("runtime.local_script", "local_script_local_selected", selectionByRuntime.get("local_script")?.selected_backend_kind === "local" && selectionByRuntime.get("local_script")?.workspace_isolation_type === "temp_dir", "Local Script selects local temp_dir backend."));
  items.push(validationItem("runtime.document_renderer", "document_renderer_docker_selected", selectionByRuntime.get("document_renderer")?.selected_backend_kind === "docker" && selectionByRuntime.get("document_renderer")?.workspace_isolation_type === "docker_container", "Document Renderer selects Docker container backend."));
  items.push(validationItem("runtime.agent_worktrees", "claude_codex_docker_worktree_selected", selectionByRuntime.get("claude_code")?.selected_backend_kind === "docker" && selectionByRuntime.get("claude_code")?.git_worktree_overlay_required === true && selectionByRuntime.get("codex")?.selected_backend_kind === "docker" && selectionByRuntime.get("codex")?.git_worktree_overlay_required === true, "Claude Code and Codex select Docker with git worktree overlays."));
  items.push(validationItem("runtime.operator_surfaces", "browser_mcp_blocked", selectionByRuntime.get("browser")?.selection_status === "blocked" && selectionByRuntime.get("mcp_tool")?.selection_status === "blocked", "Browser and MCP tool surfaces are blocked from Docker/local selector."));
  items.push(validationItem("runtime.non_backend", "harness_manual_not_applicable", selectionByRuntime.get("harness")?.selection_status === "not_applicable" && selectionByRuntime.get("manual")?.selection_status === "not_applicable", "Harness and manual lanes are not backend-selected."));
  items.push(validationItem("runtime.guards", "runtime_guards_disabled", runtimeBackendSelections.every((selection) => selection.network_access_allowed === false && selection.external_transfer_allowed === false && selection.secret_material_allowed === false), "Runtime backend selections disable network, external transfer, and raw secrets."));

  items.push(validationItem("classification.selections", "classification_count_matches_policy_matrix", classificationBackendSelections.length === classificationLevels.length, "Every classification has a backend selection row."));
  items.push(validationItem("classification.p0", "public_local_docker_visible", classificationSelectionById.get("P0_PUBLIC")?.selected_backend_kinds.includes("local") && classificationSelectionById.get("P0_PUBLIC")?.selected_backend_kinds.includes("docker"), "P0 can select local and Docker backends."));
  items.push(validationItem("classification.p2", "client_confidential_human_gate", classificationSelectionById.get("P2_CLIENT_CONFIDENTIAL")?.protected_backend_kinds.includes("docker") && classificationSelectionById.get("P2_CLIENT_CONFIDENTIAL")?.human_gate_required === true, "P2 client confidential Docker use is human-gated."));
  items.push(validationItem("classification.p5", "secret_review_only", classificationSelectionById.get("P5_SECRET")?.backend_selection_status === "protected_review_only" && classificationSelectionById.get("P5_SECRET")?.selected_backend_kinds.length === 0, "P5 secret material is protected review only."));
  items.push(validationItem("classification.guards", "classification_guards_disabled", classificationBackendSelections.every((selection) => selection.network_access_allowed === false && selection.external_transfer_allowed === false && selection.secret_material_allowed === false), "Classification backend selections disable network, external transfer, and raw secrets."));
  items.push(validationItem("matrix.coverage", "runtime_classification_matrix_complete", runtimeClassificationBackendMatrix.length === runtimeBackendSelections.length * classificationLevels.length, "Runtime/classification backend matrix is complete."));
  items.push(validationItem("matrix.secrets", "matrix_secret_material_blocked", runtimeClassificationBackendMatrix.every((row) => row.secret_material_allowed === false), "Runtime/classification matrix blocks raw secret material."));

  items.push(validationItem("desktop.boundary", "desktop_boundary_locked", backendSelectorDesktopBoundary.boundary_status === "locked", "Backend selector Desktop boundary is locked."));
  items.push(validationItem("desktop.boundary", "desktop_read_only", backendSelectorDesktopBoundary.read_only === true && backendSelectorDesktopBoundary.mutation_allowed === false, "Desktop backend selector surface is read-only."));
  items.push(validationItem("desktop.boundary", "desktop_no_execution", backendSelectorDesktopBoundary.protected_mutation_execution_allowed === false && backendSelectorDesktopBoundary.local_process_control_allowed === false && backendSelectorDesktopBoundary.docker_control_allowed === false, "Desktop cannot execute local or Docker backend changes."));
  items.push(validationItem("desktop.boundary", "desktop_no_ssh_cloud", backendSelectorDesktopBoundary.ssh_control_allowed === false && backendSelectorDesktopBoundary.cloud_runtime_control_allowed === false, "Desktop cannot control SSH or cloud runtimes."));
  items.push(validationItem("desktop.boundary", "desktop_not_runtime_source", backendSelectorDesktopBoundary.runtime_source_of_truth === false, "Desktop is not runtime source of truth."));

  return items;
}

function summarizeDockerLocalBackendSelector(projection, validationItems, validation) {
  const runtimeSelections = projection.runtimeBackendSelections;
  const classificationSelections = projection.classificationBackendSelections;
  const matrix = projection.runtimeClassificationBackendMatrix;
  const desktopBoundary = projection.backendSelectorDesktopBoundary;
  return {
    docker_local_backend_selector_status: validation.valid ? "complete" : "attention",
    backend_selector_contract_id: projection.backendSelectorContract.contract_id,
    contract_status: projection.backendSelectorContract.contract_status,
    selector_status: projection.backendSelectorContract.selector_status,
    source_of_truth: projection.backendSelectorContract.source_of_truth,
    selection_authority: projection.backendSelectorContract.selection_authority,
    selectable_backend_count: projection.backendSelectorContract.selectable_backend_kinds.length,
    blocked_backend_count: projection.backendSelectorContract.blocked_backend_kinds.length,
    backend_selection_rule_count: projection.backendSelectionRules.length,
    runtime_backend_selection_count: runtimeSelections.length,
    selected_runtime_backend_count: runtimeSelections.filter((selection) => selection.selection_status === "selected").length,
    blocked_runtime_backend_count: runtimeSelections.filter((selection) => selection.selection_status === "blocked").length,
    not_applicable_runtime_backend_count: runtimeSelections.filter((selection) => selection.selection_status === "not_applicable").length,
    local_selected_runtime_count: runtimeSelections.filter((selection) => selection.selected_backend_kind === "local").length,
    docker_selected_runtime_count: runtimeSelections.filter((selection) => selection.selected_backend_kind === "docker").length,
    high_risk_docker_selected_runtime_count: runtimeSelections.filter((selection) => selection.selected_backend_kind === "docker" && selection.risk_level === "high").length,
    git_worktree_overlay_count: runtimeSelections.filter((selection) => selection.git_worktree_overlay_required === true).length,
    classification_backend_selection_count: classificationSelections.length,
    selected_classification_backend_count: classificationSelections.filter((selection) => selection.backend_selection_status === "selected").length,
    human_gated_classification_backend_count: classificationSelections.filter((selection) => selection.backend_selection_status === "selected_with_human_gate").length,
    protected_review_classification_count: classificationSelections.filter((selection) => selection.backend_selection_status === "protected_review_only").length,
    runtime_classification_matrix_count: matrix.length,
    human_gated_runtime_classification_count: matrix.filter((row) => row.backend_selection_status === "selected_with_human_gate").length,
    blocked_runtime_classification_count: matrix.filter((row) => row.backend_selection_status === "blocked").length,
    ssh_cloud_selected_count: runtimeSelections.filter((selection) => BLOCKED_BACKEND_KINDS.includes(selection.selected_backend_kind)).length,
    operator_surface_selected_count: runtimeSelections.filter((selection) => selection.selected_backend_kind === "operator_surface").length,
    network_access_allowed_count: runtimeSelections.filter((selection) => selection.network_access_allowed === true).length + classificationSelections.filter((selection) => selection.network_access_allowed === true).length + matrix.filter((row) => row.network_access_allowed === true).length,
    external_transfer_allowed_count: runtimeSelections.filter((selection) => selection.external_transfer_allowed === true).length + classificationSelections.filter((selection) => selection.external_transfer_allowed === true).length + matrix.filter((row) => row.external_transfer_allowed === true).length,
    secret_material_allowed_count: runtimeSelections.filter((selection) => selection.secret_material_allowed === true).length + classificationSelections.filter((selection) => selection.secret_material_allowed === true).length + matrix.filter((row) => row.secret_material_allowed === true).length,
    protected_mutation_route: projection.backendSelectorContract.protected_mutation_route,
    human_gate_required_for_protected_mutation: projection.backendSelectorContract.human_gate_required_for_protected_mutation,
    runtime_self_report_trusted: projection.backendSelectorContract.runtime_self_report_trusted,
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

function preferredBackendStrategy(classification) {
  if (classification === "P5_SECRET") return "manual_or_secret_handle_only";
  if (classification === "P4_HIGHLY_RESTRICTED") return "local_first_docker_only_with_human_gate";
  if (classification === "P3_PRIVILEGED") return "local_first_docker_renderer_only";
  if (classification === "P2_CLIENT_CONFIDENTIAL") return "local_first_docker_agent_requires_redaction_and_human_gate";
  return "local_for_deterministic_docker_for_sandboxed_agent";
}

function classificationRank(classification) {
  const match = String(classification ?? "").match(/^P(\d+)_/);
  return match ? Number(match[1]) : 99;
}

function renderDockerLocalBackendSelectorMarkdown(result) {
  const summary = result.summary;
  const lines = [
    "# Docker/local Backend Selector",
    "",
    `- Status: ${summary.docker_local_backend_selector_status}`,
    `- Selector: ${summary.selector_status}`,
    `- Runtime selections: ${summary.runtime_backend_selection_count}`,
    `- Selected runtime backends: ${summary.selected_runtime_backend_count}`,
    `- Local selected: ${summary.local_selected_runtime_count}`,
    `- Docker selected: ${summary.docker_selected_runtime_count}`,
    `- Classification selections: ${summary.classification_backend_selection_count}`,
    `- Runtime/classification matrix rows: ${summary.runtime_classification_matrix_count}`,
    `- SSH/cloud selected count: ${summary.ssh_cloud_selected_count}`,
    `- Network access allowed count: ${summary.network_access_allowed_count}`,
    `- External transfer allowed count: ${summary.external_transfer_allowed_count}`,
    `- Secret material allowed count: ${summary.secret_material_allowed_count}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "## Runtime Backend Selections",
    "",
    "| Runtime | Risk | Backend | Status | Isolation |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const selection of result.runtime_backend_selections) {
    lines.push(`| ${selection.runtime_id} | ${selection.risk_level} | ${selection.selected_backend_kind ?? "none"} | ${selection.selection_status} | ${selection.workspace_isolation_type} |`);
  }
  lines.push("", "## Classification Backend Selections", "");
  lines.push("| Classification | Status | Selected | Protected | Blocked |");
  lines.push("| --- | --- | --- | --- | --- |");
  for (const selection of result.classification_backend_selections) {
    lines.push(`| ${selection.classification} | ${selection.backend_selection_status} | ${selection.selected_backend_kinds.join(", ") || "none"} | ${selection.protected_backend_kinds.join(", ") || "none"} | ${selection.blocked_backend_kinds.join(", ") || "none"} |`);
  }
  lines.push("", "## Validation", "");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.check_id} - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableDockerLocalBackendSelector(result) {
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

function unique(values) {
  return [...new Set(values)];
}

function arraySetEquals(left, right) {
  return left.length === right.length && right.every((item) => left.includes(item));
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
    else if (arg === "--sandbox-policy-model") parsed.sandboxPolicyModelPath = argv[++index];
    else if (arg === "--runtime-adapter-interface-v2") parsed.runtimeAdapterInterfaceV2Path = argv[++index];
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
  console.log(`Usage: node scripts/docker-local-backend-selector.mjs [options]

Options:
  --out-dir <path>                         Output directory.
  --sandbox-policy-model <path>            sandbox-policy-model.json input path.
  --runtime-adapter-interface-v2 <path>    runtime-adapter-interface-v2.json input path.
  --policy-matrix <path>                   policy-matrix.json input path.
  --desktop-companion-integration <path>   desktop companion design doc path.
  --check                                  Exit non-zero if validation fails.
`);
}
