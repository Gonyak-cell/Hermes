import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_TOOL_RUNTIME_POLICY_ENFORCEMENT_OUT_DIR = "artifacts/tool-runtime-policy/latest";
export const DEFAULT_TOOL_RUNTIME_POLICY_ENFORCEMENT_INPUTS = {
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  policyMatrixCatalogPath: "artifacts/policy-matrix/latest/policy-matrix-catalog.json",
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
};

const DECISIONS = new Set(["allow", "review", "deny"]);
const GATE_STATUSES = new Set(["passed", "requires_approval", "blocked"]);

export async function runToolRuntimePolicyEnforcement(options = {}) {
  const result = await buildToolRuntimePolicyEnforcement(options);
  if (options.write !== false) await writeToolRuntimePolicyEnforcement(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Tool/runtime policy enforcement failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildToolRuntimePolicyEnforcement(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TOOL_RUNTIME_POLICY_ENFORCEMENT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const runtimeResult = await readJsonOrError(inputs.runtime_agentrun_contract_freeze_path);
  const policyResult = await readJsonOrError(inputs.policy_matrix_catalog_path);
  const capabilityResult = await readJsonOrError(inputs.capability_workflow_contract_freeze_path);
  const modelPolicyResult = await readJsonOrError(inputs.model_policy_enforcement_path);
  const projected = projectToolRuntimePolicy({
    runtimeFreeze: runtimeResult.value ?? {},
    policyMatrixCatalog: policyResult.value ?? {},
    capabilityWorkflowFreeze: capabilityResult.value ?? {},
    modelPolicyEnforcement: modelPolicyResult.value ?? {},
    generatedAt,
  });
  const validationItems = validateToolRuntimePolicy({
    runtimeResult,
    policyResult,
    capabilityResult,
    modelPolicyResult,
    projected,
  });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "tool-runtime-policy-enforcement.v1",
    generated_at: generatedAt,
    tool_runtime_policy_enforcement_id: `tool-runtime-policy-enforcement.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_runtime_agentrun_contract: summarizeRuntimeSource(runtimeResult),
    source_policy_matrix_catalog: summarizePolicySource(policyResult),
    source_capability_workflow_contract: summarizeCapabilitySource(capabilityResult),
    source_model_policy_enforcement: summarizeModelPolicySource(modelPolicyResult),
    tool_runtime_policy_catalog: {
      schema_version: "tool-runtime-policy-catalog.v1",
      generated_at: generatedAt,
      runtime_policy_gates: projected.runtimePolicyGates,
      tool_permission_gates: projected.toolPermissionGates,
      agent_run_tool_gates: projected.agentRunToolGates,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeToolRuntimePolicy(projected, validationItems, validation, {
      runtimeResult,
      policyResult,
      capabilityResult,
      modelPolicyResult,
    }),
  };
  return {
    ...result,
    markdown: renderToolRuntimePolicyMarkdown(result),
  };
}

export async function writeToolRuntimePolicyEnforcement(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "tool-runtime-policy-enforcement.json"), serializable);
  await writeJson(path.join(outDir, "tool-runtime-policy-catalog.json"), serializable.tool_runtime_policy_catalog);
  await writeJson(path.join(outDir, "runtime-policy-gates.json"), {
    generated_at: result.generated_at,
    runtime_policy_gate_count: result.tool_runtime_policy_catalog.runtime_policy_gates.length,
    runtime_policy_gates: result.tool_runtime_policy_catalog.runtime_policy_gates,
  });
  await writeJson(path.join(outDir, "tool-permission-gates.json"), {
    generated_at: result.generated_at,
    tool_permission_gate_count: result.tool_runtime_policy_catalog.tool_permission_gates.length,
    tool_permission_gates: result.tool_runtime_policy_catalog.tool_permission_gates,
  });
  await writeJson(path.join(outDir, "agent-run-tool-gates.json"), {
    generated_at: result.generated_at,
    agent_run_tool_gate_count: result.tool_runtime_policy_catalog.agent_run_tool_gates.length,
    agent_run_tool_gates: result.tool_runtime_policy_catalog.agent_run_tool_gates,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    tool_runtime_policy_enforcement_id: result.tool_runtime_policy_enforcement_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runToolRuntimePolicyEnforcementCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runToolRuntimePolicyEnforcement(args);
    console.log(`Tool/runtime policy enforcement written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.tool_runtime_policy_enforcement_status}`);
    console.log(`Runtime gates: ${result.summary.runtime_policy_gate_count}`);
    console.log(`Tool gates: ${result.summary.tool_permission_gate_count}`);
    console.log(`Agent-run gates: ${result.summary.agent_run_tool_gate_count}`);
    console.log(`Forbidden tool blocked: ${result.summary.forbidden_tool_blocked_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectToolRuntimePolicy({
  runtimeFreeze,
  policyMatrixCatalog,
  capabilityWorkflowFreeze,
  modelPolicyEnforcement,
  generatedAt,
}) {
  const runtimeAdapters = runtimeFreeze.runtime_agentrun_contract?.runtime_adapters ?? [];
  const agentRuns = runtimeFreeze.runtime_agentrun_contract?.agent_runs ?? [];
  const runtimeRules = policyMatrixCatalog.runtime_rules ?? [];
  const toolRules = policyMatrixCatalog.tool_rules ?? [];
  const capabilityContracts = capabilityWorkflowFreeze.capability_workflow_contract?.gate_runtime_contracts ?? [];
  const modelRouteGates = modelPolicyEnforcement.model_policy_gate_catalog?.route_model_gates ?? [];
  const toolRuleById = new Map(toolRules.map((rule) => [rule.tool_id, rule]));
  const runtimeAdapterById = new Map(runtimeAdapters.map((adapter) => [adapter.runtime_id, adapter]));
  const capabilityContractById = new Map(capabilityContracts.map((contract) => [contract.capability_id, contract]));
  const modelRouteGatesByRuntime = groupBy(modelRouteGates, "runtime_id");

  const runtimePolicyGates = [];
  for (const runtime of runtimeAdapters) {
    for (const rule of runtimeRules) {
      runtimePolicyGates.push(buildRuntimePolicyGate({ runtime, runtimeRule: rule, generatedAt }));
    }
  }

  const toolPermissionGates = [];
  for (const runtime of runtimeAdapters) {
    const allowedTools = runtime.tool_policy?.allowed_tools ?? [];
    const forbiddenTools = runtime.tool_policy?.forbidden_tools ?? [];
    const toolIds = unique([...allowedTools, ...forbiddenTools]);
    for (const toolId of toolIds) {
      toolPermissionGates.push(buildToolPermissionGate({
        runtime,
        toolId,
        toolRule: toolRuleById.get(toolId),
        requestedState: forbiddenTools.includes(toolId) ? "forbidden" : "allowed",
        generatedAt,
      }));
    }
  }

  const agentRunToolGates = agentRuns.map((agentRun) => buildAgentRunToolGate({
    agentRun,
    runtime: runtimeAdapterById.get(agentRun.runtime_id),
    capabilityContract: capabilityContractById.get(agentRun.capability_id),
    toolPermissionGates: toolPermissionGates.filter((gate) => gate.runtime_id === agentRun.runtime_id),
    runtimePolicyGates: runtimePolicyGates.filter((gate) => gate.runtime_id === agentRun.runtime_id),
    modelRouteGates: modelRouteGatesByRuntime.get(agentRun.runtime_id) ?? [],
    generatedAt,
  })).sort(by("agent_run_tool_gate_id"));

  return {
    runtimeAdapters,
    agentRuns,
    runtimeRules,
    toolRules,
    capabilityContracts,
    modelRouteGates,
    runtimePolicyGates: runtimePolicyGates.sort(by("runtime_policy_gate_id")),
    toolPermissionGates: toolPermissionGates.sort(by("tool_permission_gate_id")),
    agentRunToolGates,
  };
}

function buildRuntimePolicyGate({ runtime, runtimeRule, generatedAt }) {
  const runtimeDecision = runtimePolicyDecision(runtime.runtime_id, runtimeRule);
  const gateStatus = statusForDecision(runtimeDecision);
  const reasonCodes = [];
  if ((runtimeRule.allowed_runtimes ?? []).includes(runtime.runtime_id)) reasonCodes.push("runtime_allowed_by_classification_policy");
  if ((runtimeRule.restricted_runtimes ?? []).includes(runtime.runtime_id)) reasonCodes.push("runtime_restricted_by_classification_policy");
  if ((runtimeRule.forbidden_runtimes ?? []).includes(runtime.runtime_id)) reasonCodes.push("runtime_forbidden_by_classification_policy");
  if (runtime.execution_environment?.external_execution) reasonCodes.push("external_execution_runtime");
  if (runtime.execution_environment?.sandbox_required) reasonCodes.push("sandbox_required");
  return {
    schema_version: "runtime-policy-gate.v1",
    runtime_policy_gate_id: `runtime-policy-gate.${slugify(runtime.runtime_id)}.${slugify(runtimeRule.classification)}`,
    runtime_id: runtime.runtime_id,
    adapter_id: runtime.adapter_id,
    classification: runtimeRule.classification,
    runtime_rule_id: runtimeRule.runtime_rule_id,
    runtime_policy_decision: runtimeDecision,
    gate_status: gateStatus,
    external_execution: Boolean(runtime.execution_environment?.external_execution),
    sandbox_required: Boolean(runtime.execution_environment?.sandbox_required),
    network_policy: runtime.execution_environment?.network_policy ?? "unknown",
    workspace_isolation_type: runtime.workspace_policy?.isolation_type ?? "unknown",
    command_binding_id: runtime.command_binding?.binding_id ?? null,
    command_availability_status: runtime.command_binding?.command_availability_status ?? "unknown",
    required_gates: unique([...(runtimeRule.required_gates ?? []), ...(runtime.tool_policy?.required_gates ?? [])]),
    reason_codes: unique(reasonCodes),
    decided_at: generatedAt,
    metadata: {
      risk_level: runtime.risk_level,
      output_trust: runtime.output_trust,
    },
  };
}

function buildToolPermissionGate({ runtime, toolId, toolRule, requestedState, generatedAt }) {
  const decision = requestedState === "forbidden" ? "deny" : toolDecision(toolRule);
  const gateStatus = statusForDecision(decision);
  const requiredGates = unique([
    ...(runtime.tool_policy?.required_gates ?? []),
    ...(toolRule?.required_gates ?? []),
    ...(toolRule?.approval_required ? ["human_approval_gate"] : []),
    "tool_permission_gate",
  ]);
  const reasonCodes = [];
  if (requestedState === "forbidden") reasonCodes.push("runtime_forbids_tool");
  else reasonCodes.push("runtime_allows_tool");
  if (!toolRule) reasonCodes.push("tool_policy_missing");
  if (toolRule?.approval_required) reasonCodes.push("tool_requires_approval");
  if (toolRule?.default_policy === "restricted") reasonCodes.push("tool_restricted_by_default");
  return {
    schema_version: "tool-permission-gate.v1",
    tool_permission_gate_id: `tool-permission-gate.${slugify(runtime.runtime_id)}.${slugify(toolId)}`,
    runtime_id: runtime.runtime_id,
    adapter_id: runtime.adapter_id,
    tool_id: toolId,
    requested_state: requestedState,
    tool_policy_known: Boolean(toolRule),
    default_policy: toolRule?.default_policy ?? "unknown",
    approval_required: Boolean(toolRule?.approval_required),
    gate_decision: decision,
    gate_status: gateStatus,
    protected_action: Boolean(toolRule?.approval_required || ["email.send", "erp.billing.issue", "github.merge"].includes(toolId)),
    required_gates: requiredGates,
    forbidden_by_runtime: requestedState === "forbidden",
    allowed_by_runtime: requestedState === "allowed",
    reason_codes: unique(reasonCodes),
    decided_at: generatedAt,
    metadata: {
      runtime_risk_level: runtime.risk_level,
      tool_description: toolRule?.description ?? null,
    },
  };
}

function buildAgentRunToolGate({
  agentRun,
  runtime,
  capabilityContract,
  toolPermissionGates,
  runtimePolicyGates,
  modelRouteGates,
  generatedAt,
}) {
  const capabilityRequiresToolGate = (capabilityContract?.required_gates ?? []).some((gate) => gate.gate_id === "tool_permission_gate");
  const runtimeRequiresToolGate = (runtime?.tool_policy?.required_gates ?? []).includes("tool_permission_gate");
  const forbiddenToolGateCount = toolPermissionGates.filter((gate) => gate.gate_decision === "deny" && gate.requested_state === "forbidden").length;
  const allowedToolGateCount = toolPermissionGates.filter((gate) => gate.requested_state === "allowed").length;
  const approvalRequiredToolGateCount = toolPermissionGates.filter((gate) => gate.gate_decision === "review").length;
  const runtimeBlockedClassificationCount = runtimePolicyGates.filter((gate) => gate.gate_status === "blocked").length;
  const runtimeReviewClassificationCount = runtimePolicyGates.filter((gate) => gate.gate_status === "requires_approval").length;
  const routeBlockedCount = modelRouteGates.filter((gate) => gate.gate_status === "blocked").length;
  const reasonCodes = [];
  if (!runtime) reasonCodes.push("runtime_adapter_missing");
  if (!agentRun.runtime_allowed_by_capability) reasonCodes.push("runtime_not_allowed_by_capability");
  if (capabilityRequiresToolGate) reasonCodes.push("capability_requires_tool_permission_gate");
  if (runtimeRequiresToolGate) reasonCodes.push("runtime_requires_tool_permission_gate");
  if (approvalRequiredToolGateCount > 0) reasonCodes.push("runtime_has_approval_required_tools");
  if (runtimeBlockedClassificationCount > 0) reasonCodes.push("runtime_forbidden_for_some_classifications");
  if (routeBlockedCount > 0) reasonCodes.push("model_route_blocked_for_runtime");
  const gateDecision = !runtime || !agentRun.runtime_allowed_by_capability || (capabilityRequiresToolGate && !runtimeRequiresToolGate)
    ? "deny"
    : approvalRequiredToolGateCount > 0 || runtimeReviewClassificationCount > 0
      ? "review"
      : "allow";
  const gateStatus = statusForDecision(gateDecision);
  return {
    schema_version: "agent-run-tool-gate.v1",
    agent_run_tool_gate_id: `agent-run-tool-gate.${slugify(agentRun.agent_run_id)}`,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    capability_id: agentRun.capability_id,
    domain_pack: agentRun.domain_pack,
    runtime_id: agentRun.runtime_id,
    adapter_id: agentRun.adapter_id ?? runtime?.adapter_id ?? null,
    runtime_known: Boolean(runtime),
    runtime_allowed_by_capability: Boolean(agentRun.runtime_allowed_by_capability),
    capability_requires_tool_permission_gate: capabilityRequiresToolGate,
    runtime_requires_tool_permission_gate: runtimeRequiresToolGate,
    requested_tool_count: allowedToolGateCount,
    allowed_tool_count: allowedToolGateCount,
    forbidden_tool_count: forbiddenToolGateCount,
    approval_required_tool_count: approvalRequiredToolGateCount,
    runtime_blocked_classification_count: runtimeBlockedClassificationCount,
    runtime_review_classification_count: runtimeReviewClassificationCount,
    model_route_blocked_count: routeBlockedCount,
    gate_decision: gateDecision,
    gate_status: gateStatus,
    audit_required: true,
    human_approval_required: gateDecision === "review" || Boolean(agentRun.verification_status === "pending_human_approval"),
    required_gates: unique([
      ...(agentRun.required_gates ?? []),
      ...(runtime?.tool_policy?.required_gates ?? []),
      ...(capabilityContract?.required_gates ?? []).map((gate) => gate.gate_id),
      "tool_permission_gate",
    ]),
    reason_codes: unique(reasonCodes),
    decided_at: generatedAt,
    metadata: {
      status: agentRun.status,
      risk_level: agentRun.risk_level,
      output_trust: agentRun.output_trust,
      command_binding_id: agentRun.command_binding_id ?? null,
    },
  };
}

function validateToolRuntimePolicy({
  runtimeResult,
  policyResult,
  capabilityResult,
  modelPolicyResult,
  projected,
}) {
  const validationItems = [];
  const toolIds = new Set(projected.toolRules.map((rule) => rule.tool_id));
  const runtimeIds = new Set(projected.runtimeAdapters.map((runtime) => runtime.runtime_id));
  const capabilityIds = new Set(projected.capabilityContracts.map((contract) => contract.capability_id));

  pushCheck(validationItems, "source", "runtime_agentrun_contract_freeze", "source_available", runtimeResult.ok, "Runtime/AgentRun contract freeze must be readable.");
  pushCheck(validationItems, "source", "policy_matrix_catalog", "source_available", policyResult.ok, "Policy Matrix Catalog must be readable.");
  pushCheck(validationItems, "source", "capability_workflow_contract_freeze", "source_available", capabilityResult.ok, "Capability/Workflow contract freeze must be readable.");
  pushCheck(validationItems, "source", "model_policy_enforcement", "source_available", modelPolicyResult.ok, "Model Policy Enforcement must be readable.");
  pushCheck(validationItems, "source", runtimeResult.value?.freeze_id ?? "runtime_agentrun_contract_freeze", "runtime_contract_complete", runtimeResult.value?.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze must be complete.");
  pushCheck(validationItems, "source", policyResult.value?.matrix_id ?? "policy_matrix_catalog", "policy_matrix_valid", policyResult.value?.summary?.policy_status === "valid", "Policy Matrix Catalog must be valid.");
  pushCheck(validationItems, "source", capabilityResult.value?.freeze_id ?? "capability_workflow_contract_freeze", "capability_workflow_complete", capabilityResult.value?.summary?.freeze_status === "complete", "Capability/Workflow contract freeze must be complete.");
  pushCheck(validationItems, "source", modelPolicyResult.value?.model_policy_enforcement_id ?? "model_policy_enforcement", "model_policy_complete", modelPolicyResult.value?.summary?.model_policy_enforcement_status === "complete", "Model Policy Enforcement must be complete.");

  pushUniqueIdChecks(validationItems, projected.runtimePolicyGates, "runtime_policy_gate", "runtime_policy_gate_id");
  pushUniqueIdChecks(validationItems, projected.toolPermissionGates, "tool_permission_gate", "tool_permission_gate_id");
  pushUniqueIdChecks(validationItems, projected.agentRunToolGates, "agent_run_tool_gate", "agent_run_tool_gate_id");

  for (const runtime of projected.runtimeAdapters) {
    const allowed = new Set(runtime.tool_policy?.allowed_tools ?? []);
    const forbidden = new Set(runtime.tool_policy?.forbidden_tools ?? []);
    const overlaps = [...allowed].filter((toolId) => forbidden.has(toolId));
    pushCheck(validationItems, "runtime_adapter", runtime.runtime_id, "allowed_forbidden_tool_sets_disjoint", overlaps.length === 0, "Runtime allowed_tools and forbidden_tools must be disjoint.");
    for (const toolId of [...allowed, ...forbidden]) {
      pushCheck(validationItems, "runtime_adapter", runtime.runtime_id, `tool_policy_known_${slugify(toolId)}`, toolIds.has(toolId), `Tool policy must exist for ${toolId}.`);
    }
    const needsToolGate = allowed.size > 0 && runtime.runtime_id !== "manual";
    pushCheck(validationItems, "runtime_adapter", runtime.runtime_id, "tool_permission_gate_declared", !needsToolGate || (runtime.tool_policy?.required_gates ?? []).includes("tool_permission_gate"), "Non-manual runtimes with tools must declare tool_permission_gate.");
  }

  for (const gate of projected.runtimePolicyGates) {
    pushCheck(validationItems, "runtime_policy_gate", gate.runtime_policy_gate_id, "runtime_known", runtimeIds.has(gate.runtime_id), "Runtime policy gate must reference a known runtime.");
    pushCheck(validationItems, "runtime_policy_gate", gate.runtime_policy_gate_id, "decision_supported", DECISIONS.has(gate.runtime_policy_decision), "Runtime policy decision must be allow, review, or deny.");
    pushCheck(validationItems, "runtime_policy_gate", gate.runtime_policy_gate_id, "status_supported", GATE_STATUSES.has(gate.gate_status), "Runtime policy gate status must be supported.");
    pushCheck(validationItems, "runtime_policy_gate", gate.runtime_policy_gate_id, "forbidden_runtime_blocked", !gate.reason_codes.includes("runtime_forbidden_by_classification_policy") || gate.gate_status === "blocked", "Forbidden runtime/classification bindings must be blocked.");
  }

  for (const gate of projected.toolPermissionGates) {
    pushCheck(validationItems, "tool_permission_gate", gate.tool_permission_gate_id, "tool_policy_known", gate.tool_policy_known, "Tool permission gate must reference a known tool policy.");
    pushCheck(validationItems, "tool_permission_gate", gate.tool_permission_gate_id, "decision_supported", DECISIONS.has(gate.gate_decision), "Tool permission gate decision must be allow, review, or deny.");
    pushCheck(validationItems, "tool_permission_gate", gate.tool_permission_gate_id, "status_supported", GATE_STATUSES.has(gate.gate_status), "Tool permission gate status must be supported.");
    pushCheck(validationItems, "tool_permission_gate", gate.tool_permission_gate_id, "forbidden_tool_blocked", !gate.forbidden_by_runtime || gate.gate_decision === "deny", "Forbidden runtime tools must be denied.");
    pushCheck(validationItems, "tool_permission_gate", gate.tool_permission_gate_id, "approval_tool_requires_human_gate", !gate.approval_required || gate.required_gates.includes("human_approval_gate"), "Approval-required tools must include human_approval_gate.");
  }

  for (const gate of projected.agentRunToolGates) {
    pushCheck(validationItems, "agent_run_tool_gate", gate.agent_run_tool_gate_id, "runtime_known", gate.runtime_known, "AgentRun tool gate must reference a known runtime.");
    pushCheck(validationItems, "agent_run_tool_gate", gate.agent_run_tool_gate_id, "capability_known", capabilityIds.has(gate.capability_id), "AgentRun tool gate must reference a capability gate/runtime contract.");
    pushCheck(validationItems, "agent_run_tool_gate", gate.agent_run_tool_gate_id, "decision_supported", DECISIONS.has(gate.gate_decision), "AgentRun tool gate decision must be allow, review, or deny.");
    pushCheck(validationItems, "agent_run_tool_gate", gate.agent_run_tool_gate_id, "status_supported", GATE_STATUSES.has(gate.gate_status), "AgentRun tool gate status must be supported.");
    pushCheck(validationItems, "agent_run_tool_gate", gate.agent_run_tool_gate_id, "runtime_allowed_by_capability", gate.runtime_allowed_by_capability, "AgentRun runtime must be allowed by capability.");
    pushCheck(validationItems, "agent_run_tool_gate", gate.agent_run_tool_gate_id, "tool_permission_gate_present", !gate.capability_requires_tool_permission_gate || gate.runtime_requires_tool_permission_gate, "Capability-required tool_permission_gate must be present on runtime.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.runtimePolicyGates.length === 0) errors.push({ path: "tool_runtime_policy_catalog.runtime_policy_gates", message: "At least one runtime policy gate is required." });
  if (projected.toolPermissionGates.length === 0) errors.push({ path: "tool_runtime_policy_catalog.tool_permission_gates", message: "At least one tool permission gate is required." });
  if (projected.agentRunToolGates.length === 0) errors.push({ path: "tool_runtime_policy_catalog.agent_run_tool_gates", message: "At least one AgentRun tool gate is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeToolRuntimePolicy(projected, validationItems, validation, sources) {
  const runtimeGates = projected.runtimePolicyGates;
  const toolGates = projected.toolPermissionGates;
  const agentGates = projected.agentRunToolGates;
  const failedChecks = validationItems.filter((item) => item.status === "failed");
  return {
    tool_runtime_policy_enforcement_status: validation.valid ? "complete" : "blocked",
    source_runtime_contract_status: sources.runtimeResult.value?.summary?.freeze_status ?? "unknown",
    source_policy_matrix_status: sources.policyResult.value?.summary?.policy_status ?? "unknown",
    source_capability_workflow_status: sources.capabilityResult.value?.summary?.freeze_status ?? "unknown",
    source_model_policy_status: sources.modelPolicyResult.value?.summary?.model_policy_enforcement_status ?? "unknown",
    runtime_count: projected.runtimeAdapters.length,
    agent_run_count: projected.agentRuns.length,
    runtime_rule_count: projected.runtimeRules.length,
    tool_rule_count: projected.toolRules.length,
    runtime_policy_gate_count: runtimeGates.length,
    runtime_policy_allow_count: runtimeGates.filter((gate) => gate.runtime_policy_decision === "allow").length,
    runtime_policy_review_count: runtimeGates.filter((gate) => gate.runtime_policy_decision === "review").length,
    runtime_policy_deny_count: runtimeGates.filter((gate) => gate.runtime_policy_decision === "deny").length,
    blocked_runtime_policy_gate_count: runtimeGates.filter((gate) => gate.gate_status === "blocked").length,
    restricted_runtime_policy_gate_count: runtimeGates.filter((gate) => gate.gate_status === "requires_approval").length,
    tool_permission_gate_count: toolGates.length,
    allowed_tool_gate_count: toolGates.filter((gate) => gate.requested_state === "allowed").length,
    forbidden_tool_gate_count: toolGates.filter((gate) => gate.requested_state === "forbidden").length,
    forbidden_tool_blocked_count: toolGates.filter((gate) => gate.forbidden_by_runtime && gate.gate_decision === "deny").length,
    review_tool_gate_count: toolGates.filter((gate) => gate.gate_decision === "review").length,
    denied_tool_gate_count: toolGates.filter((gate) => gate.gate_decision === "deny").length,
    approval_required_tool_gate_count: toolGates.filter((gate) => gate.gate_decision === "review").length,
    protected_action_tool_gate_count: toolGates.filter((gate) => gate.protected_action).length,
    agent_run_tool_gate_count: agentGates.length,
    agent_run_tool_gate_allow_count: agentGates.filter((gate) => gate.gate_decision === "allow").length,
    agent_run_tool_gate_review_count: agentGates.filter((gate) => gate.gate_decision === "review").length,
    agent_run_tool_gate_deny_count: agentGates.filter((gate) => gate.gate_decision === "deny").length,
    agent_run_tool_gate_passed_count: agentGates.filter((gate) => gate.gate_status === "passed").length,
    agent_run_tool_gate_requires_approval_count: agentGates.filter((gate) => gate.gate_status === "requires_approval").length,
    agent_run_tool_gate_blocked_count: agentGates.filter((gate) => gate.gate_status === "blocked").length,
    tool_overlap_count: failedChecks.filter((item) => item.check_id === "allowed_forbidden_tool_sets_disjoint").length,
    unknown_tool_count: failedChecks.filter((item) => item.check_id.startsWith("tool_policy_known")).length,
    missing_tool_permission_gate_count: failedChecks.filter((item) => item.check_id === "tool_permission_gate_declared").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedChecks.length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy([...toolGates, ...agentGates], "runtime_id"),
    by_tool_id: countBy(toolGates, "tool_id"),
    by_gate_status: countBy([...runtimeGates, ...toolGates, ...agentGates], "gate_status"),
    by_gate_decision: countBy([...toolGates, ...agentGates], "gate_decision"),
    by_runtime_policy_decision: countBy(runtimeGates, "runtime_policy_decision"),
  };
}

function summarizeRuntimeSource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? (result.ok ? "unknown" : "missing"),
    runtime_adapter_count: source.summary?.runtime_adapter_count ?? 0,
    agent_run_count: source.summary?.agent_run_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizePolicySource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    matrix_id: source.matrix_id ?? null,
    policy_status: source.summary?.policy_status ?? (result.ok ? "unknown" : "missing"),
    runtime_rule_count: source.summary?.runtime_rule_count ?? 0,
    tool_rule_count: source.summary?.tool_rule_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizeCapabilitySource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? (result.ok ? "unknown" : "missing"),
    gate_runtime_contract_count: source.summary?.gate_runtime_contract_count ?? 0,
    agent_run_count: source.summary?.agent_run_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizeModelPolicySource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    model_policy_enforcement_id: source.model_policy_enforcement_id ?? null,
    model_policy_enforcement_status: source.summary?.model_policy_enforcement_status ?? (result.ok ? "unknown" : "missing"),
    route_model_gate_count: source.summary?.route_model_gate_count ?? 0,
    unauthorized_external_allow_count: source.summary?.unauthorized_external_allow_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function renderToolRuntimePolicyMarkdown(result) {
  const lines = [];
  lines.push("# Tool/Runtime Policy Enforcement");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.tool_runtime_policy_enforcement_status}`);
  lines.push("");
  lines.push(`- Runtime policy gates: ${result.summary.runtime_policy_gate_count}`);
  lines.push(`- Tool permission gates: ${result.summary.tool_permission_gate_count}`);
  lines.push(`- AgentRun tool gates: ${result.summary.agent_run_tool_gate_count}`);
  lines.push(`- Forbidden tool gates blocked: ${result.summary.forbidden_tool_blocked_count}/${result.summary.forbidden_tool_gate_count}`);
  lines.push(`- Approval-required tool gates: ${result.summary.approval_required_tool_gate_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Runtime Tool Gates");
  for (const gate of result.tool_runtime_policy_catalog.tool_permission_gates) {
    lines.push(`- ${gate.runtime_id}/${gate.tool_id}: ${gate.gate_decision}, ${gate.gate_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function runtimePolicyDecision(runtimeId, runtimeRule) {
  if ((runtimeRule.forbidden_runtimes ?? []).includes(runtimeId)) return "deny";
  if ((runtimeRule.restricted_runtimes ?? []).includes(runtimeId)) return "review";
  if ((runtimeRule.allowed_runtimes ?? []).includes(runtimeId)) return "allow";
  return "review";
}

function toolDecision(toolRule) {
  if (!toolRule) return "review";
  if (toolRule.default_policy === "approval_required" || toolRule.approval_required) return "review";
  if (toolRule.default_policy === "forbidden") return "deny";
  return "allow";
}

function statusForDecision(decision) {
  if (decision === "deny") return "blocked";
  if (decision === "review") return "requires_approval";
  return "passed";
}

function normalizeInputs(options) {
  return {
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_TOOL_RUNTIME_POLICY_ENFORCEMENT_INPUTS.runtimeAgentRunContractFreezePath),
    policy_matrix_catalog_path: path.resolve(options.policyMatrixCatalogPath ?? DEFAULT_TOOL_RUNTIME_POLICY_ENFORCEMENT_INPUTS.policyMatrixCatalogPath),
    capability_workflow_contract_freeze_path: path.resolve(options.capabilityWorkflowContractFreezePath ?? DEFAULT_TOOL_RUNTIME_POLICY_ENFORCEMENT_INPUTS.capabilityWorkflowContractFreezePath),
    model_policy_enforcement_path: path.resolve(options.modelPolicyEnforcementPath ?? DEFAULT_TOOL_RUNTIME_POLICY_ENFORCEMENT_INPUTS.modelPolicyEnforcementPath),
  };
}

function serializableLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--policy-matrix-catalog") parsed.policyMatrixCatalogPath = argv[++index];
    else if (arg === "--capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--model-policy-enforcement") parsed.modelPolicyEnforcementPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/tool-runtime-policy-enforcement.mjs [options]

Options:
  --runtime-agentrun-contract-freeze <path>
                                  runtime-agentrun-contract-freeze.json path.
  --policy-matrix-catalog <path> policy-matrix-catalog.json path.
  --capability-workflow-contract-freeze <path>
                                  capability-workflow-contract-freeze.json path.
  --model-policy-enforcement <path>
                                  model-policy-enforcement.json path.
  --out-dir <path>               Output directory.
  --run-at <iso>                 Deterministic timestamp.
  --check                        Exit non-zero when validation fails.
  --no-write                     Build without writing artifacts.
  -h, --help                     Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    return {
      ok: true,
      value: JSON.parse(await readFile(filePath, "utf8")),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function pushUniqueIdChecks(items, rows, subjectType, idKey) {
  const seen = new Set();
  for (const row of rows) {
    const id = row[idKey];
    const unique = Boolean(id) && !seen.has(id);
    pushCheck(items, subjectType, id ?? "missing_id", `${idKey}_unique`, unique, `${idKey} must be present and unique.`);
    if (id) seen.add(id);
  }
}

function pushCheck(items, subjectType, subjectId, checkId, passed, message) {
  items.push({
    schema_version: "tool-runtime-policy-validation.v1",
    validation_id: `tool-runtime-policy-validation.${slugify(subjectType)}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: String(subjectId ?? "unknown"),
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] ?? "unknown";
    const group = groups.get(value) ?? [];
    group.push(item);
    groups.set(value, group);
    return groups;
  }, new Map());
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))].sort((left, right) => String(left).localeCompare(String(right)));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").toLowerCase() || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
