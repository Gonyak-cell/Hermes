import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_OUTPUT_DESTINATION_POLICY_OUT_DIR = "artifacts/output-destination-policy/latest";
export const DEFAULT_OUTPUT_DESTINATION_POLICY_INPUTS = {
  policyMatrixCatalogPath: "artifacts/policy-matrix/latest/policy-matrix-catalog.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  protectedDeliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  deliveryExecutionDraftPath: "artifacts/delivery-execution/latest/delivery-execution-draft.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
};

const DECISIONS = new Set(["allow", "review", "deny"]);
const GATE_STATUSES = new Set(["passed", "requires_approval", "blocked"]);
const FINAL_ACTION_TOOL_BY_DESTINATION = {
  email: "email.send",
  erp: "erp.billing.issue",
  github: "github.merge",
};

export async function runOutputDestinationPolicyEnforcement(options = {}) {
  const result = await buildOutputDestinationPolicyEnforcement(options);
  if (options.write !== false) await writeOutputDestinationPolicyEnforcement(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Output destination policy enforcement failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildOutputDestinationPolicyEnforcement(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_OUTPUT_DESTINATION_POLICY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const policyResult = await readJsonOrError(inputs.policy_matrix_catalog_path);
  const outputDeliveryResult = await readJsonOrError(inputs.output_delivery_contract_freeze_path);
  const deliveryQueueResult = await readJsonOrError(inputs.protected_delivery_queue_path);
  const deliveryExecutionResult = await readJsonOrError(inputs.delivery_execution_draft_path);
  const toolRuntimeResult = await readJsonOrError(inputs.tool_runtime_policy_enforcement_path);
  const projected = projectOutputDestinationPolicy({
    policyMatrixCatalog: policyResult.value ?? {},
    outputDeliveryFreeze: outputDeliveryResult.value ?? {},
    protectedDeliveryQueue: deliveryQueueResult.value ?? {},
    deliveryExecutionDraft: deliveryExecutionResult.value ?? {},
    toolRuntimePolicyEnforcement: toolRuntimeResult.value ?? {},
    generatedAt,
  });
  const validationItems = validateOutputDestinationPolicy({
    policyResult,
    outputDeliveryResult,
    deliveryQueueResult,
    deliveryExecutionResult,
    toolRuntimeResult,
    projected,
  });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "output-destination-policy-enforcement.v1",
    generated_at: generatedAt,
    output_destination_policy_enforcement_id: `output-destination-policy-enforcement.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_policy_matrix_catalog: summarizePolicySource(policyResult),
    source_output_delivery_contract: summarizeOutputDeliverySource(outputDeliveryResult),
    source_protected_delivery_queue: summarizeDeliveryQueueSource(deliveryQueueResult),
    source_delivery_execution_draft: summarizeDeliveryExecutionSource(deliveryExecutionResult),
    source_tool_runtime_policy_enforcement: summarizeToolRuntimeSource(toolRuntimeResult),
    output_destination_policy_catalog: {
      schema_version: "output-destination-policy-catalog.v1",
      generated_at: generatedAt,
      policy_rules: projected.policyRules,
      artifact_destination_gates: projected.artifactDestinationGates,
      delivery_action_destination_gates: projected.deliveryActionDestinationGates,
      final_action_separation_gates: projected.finalActionSeparationGates,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeOutputDestinationPolicy(projected, validationItems, validation, {
      policyResult,
      outputDeliveryResult,
      deliveryQueueResult,
      deliveryExecutionResult,
      toolRuntimeResult,
    }),
  };
  return {
    ...result,
    markdown: renderOutputDestinationPolicyMarkdown(result),
  };
}

export async function writeOutputDestinationPolicyEnforcement(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "output-destination-policy-enforcement.json"), serializable);
  await writeJson(path.join(outDir, "output-destination-policy-catalog.json"), serializable.output_destination_policy_catalog);
  await writeJson(path.join(outDir, "policy-destination-rules.json"), {
    generated_at: result.generated_at,
    policy_rule_count: result.output_destination_policy_catalog.policy_rules.length,
    policy_rules: result.output_destination_policy_catalog.policy_rules,
  });
  await writeJson(path.join(outDir, "artifact-destination-gates.json"), {
    generated_at: result.generated_at,
    artifact_destination_gate_count: result.output_destination_policy_catalog.artifact_destination_gates.length,
    artifact_destination_gates: result.output_destination_policy_catalog.artifact_destination_gates,
  });
  await writeJson(path.join(outDir, "delivery-action-destination-gates.json"), {
    generated_at: result.generated_at,
    delivery_action_destination_gate_count: result.output_destination_policy_catalog.delivery_action_destination_gates.length,
    delivery_action_destination_gates: result.output_destination_policy_catalog.delivery_action_destination_gates,
  });
  await writeJson(path.join(outDir, "final-action-separation-gates.json"), {
    generated_at: result.generated_at,
    final_action_separation_gate_count: result.output_destination_policy_catalog.final_action_separation_gates.length,
    final_action_separation_gates: result.output_destination_policy_catalog.final_action_separation_gates,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    output_destination_policy_enforcement_id: result.output_destination_policy_enforcement_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runOutputDestinationPolicyEnforcementCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runOutputDestinationPolicyEnforcement(args);
    console.log(`Output destination policy enforcement written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.output_destination_policy_status}`);
    console.log(`Policy rules: ${result.summary.policy_rule_count}`);
    console.log(`Artifact gates: ${result.summary.artifact_destination_gate_count}`);
    console.log(`Delivery action gates: ${result.summary.delivery_action_destination_gate_count}`);
    console.log(`Final action separation gates: ${result.summary.final_action_separation_gate_count}`);
    console.log(`Unsafe final actions: ${result.summary.unsafe_final_action_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectOutputDestinationPolicy({
  policyMatrixCatalog,
  outputDeliveryFreeze,
  protectedDeliveryQueue,
  deliveryExecutionDraft,
  toolRuntimePolicyEnforcement,
  generatedAt,
}) {
  const outputRules = policyMatrixCatalog.output_rules ?? [];
  const outputContract = outputDeliveryFreeze.output_delivery_contract ?? {};
  const outputArtifacts = outputContract.output_artifacts ?? [];
  const deliveryActions = outputContract.delivery_actions ?? protectedDeliveryQueue.delivery_actions ?? [];
  const deliveryReceipts = outputContract.delivery_receipts ?? [];
  const deliveryBindings = outputContract.output_delivery_bindings ?? [];
  const executionCandidates = deliveryExecutionDraft.execution_candidates ?? [];
  const executionPackets = deliveryExecutionDraft.execution_packets ?? [];
  const toolPermissionGates = toolRuntimePolicyEnforcement.tool_runtime_policy_catalog?.tool_permission_gates ?? [];
  const toolGateByToolId = groupBy(toolPermissionGates, "tool_id");
  const actionById = new Map(deliveryActions.map((action) => [action.delivery_action_id, action]));
  const actionsByArtifactId = groupBy(deliveryActions, "output_artifact_id");
  const receiptsByActionId = groupByMany(deliveryReceipts, "delivery_action_ids");
  const bindingByArtifactId = new Map(deliveryBindings.map((binding) => [binding.output_artifact_id, binding]));
  const executionCandidateByActionId = new Map(executionCandidates.map((candidate) => [candidate.delivery_action_id, candidate]));

  const policyRules = outputRules.map((rule) => buildPolicyDestinationRule({
    rule,
    toolPermissionGates: toolGateByToolId.get(destinationToolForRule(rule)) ?? [],
    generatedAt,
  })).sort(by("policy_destination_rule_id"));
  const policyRuleByArtifactType = new Map(policyRules.map((rule) => [rule.artifact_type, rule]));

  const artifactDestinationGates = outputArtifacts.map((artifact) => buildArtifactDestinationGate({
    artifact,
    policyRule: policyRuleByArtifactType.get(artifact.artifact_type),
    deliveryActions: actionsByArtifactId.get(artifact.output_artifact_id) ?? [],
    binding: bindingByArtifactId.get(artifact.output_artifact_id),
    generatedAt,
  })).sort(by("artifact_destination_gate_id"));

  const deliveryActionDestinationGates = deliveryActions.map((action) => buildDeliveryActionDestinationGate({
    action,
    policyRule: policyRuleByArtifactType.get(action.artifact_type),
    artifact: outputArtifacts.find((item) => item.output_artifact_id === action.output_artifact_id),
    receipts: receiptsByActionId.get(action.delivery_action_id) ?? [],
    executionCandidate: executionCandidateByActionId.get(action.delivery_action_id),
    toolPermissionGates: toolGateByToolId.get(destinationToolForAction(action)) ?? [],
    generatedAt,
  })).sort(by("delivery_action_destination_gate_id"));

  const finalActionSeparationGates = buildFinalActionSeparationGates({
    policyRules,
    deliveryActions,
    deliveryActionDestinationGates,
    receiptsByActionId,
    executionCandidates,
    executionPackets,
    toolGateByToolId,
    generatedAt,
  }).sort(by("final_action_separation_gate_id"));

  return {
    outputRules,
    outputArtifacts,
    deliveryActions,
    deliveryReceipts,
    deliveryBindings,
    executionCandidates,
    executionPackets,
    toolPermissionGates,
    policyRules,
    artifactDestinationGates,
    deliveryActionDestinationGates,
    finalActionSeparationGates,
  };
}

function buildPolicyDestinationRule({ rule, toolPermissionGates, generatedAt }) {
  const destinationKind = destinationKindForRule(rule);
  const destinationToolId = destinationToolForRule(rule);
  const finalActionRequired = destinationToolId !== null || rule.delivery_policy !== "internal_only";
  const computedRequiredGates = requiredDestinationGates(rule, { finalActionRequired, destinationToolId });
  const originalRequiredGates = rule.required_gates ?? [];
  const toolPolicyKnown = !destinationToolId || toolPermissionGates.some((gate) => gate.tool_policy_known);
  const protectedToolGateCount = toolPermissionGates.filter((gate) => gate.protected_action).length;
  const gateDecision = finalActionRequired ? "review" : "allow";
  return {
    schema_version: "policy-destination-rule.v1",
    policy_destination_rule_id: `policy-destination-rule.${slugify(rule.artifact_type)}`,
    artifact_type: rule.artifact_type,
    default_status: rule.default_status,
    delivery_policy: rule.delivery_policy,
    destination_kind: destinationKind,
    destination_tool_id: destinationToolId,
    final_action_required: finalActionRequired,
    draft_generation_allowed: true,
    draft_final_action_separated: true,
    approval_required: Boolean(rule.approval_required || rule.delivery_policy === "approval_required" || rule.delivery_policy === "partner_approval_required"),
    human_approval_required: computedRequiredGates.includes("human_approval_gate"),
    output_destination_gate_required: finalActionRequired,
    policy_declares_output_destination_gate: originalRequiredGates.includes("output_destination_gate"),
    computed_required_gates: computedRequiredGates,
    original_required_gates: originalRequiredGates,
    tool_policy_known: toolPolicyKnown,
    protected_tool_gate_count: protectedToolGateCount,
    gate_decision: gateDecision,
    gate_status: statusForDecision(gateDecision),
    reason_codes: unique([
      finalActionRequired ? "final_action_requires_destination_gate" : "internal_draft_only",
      destinationToolId ? "destination_tool_bound" : "no_external_tool_required",
      rule.delivery_policy === "partner_approval_required" ? "partner_approval_required" : null,
      rule.delivery_policy === "test_gate_required" ? "test_gate_required" : null,
    ]),
    decided_at: generatedAt,
    metadata: {
      source_metadata: rule.metadata ?? {},
    },
  };
}

function buildArtifactDestinationGate({ artifact, policyRule, deliveryActions, binding, generatedAt }) {
  const destinationKinds = unique(deliveryActions.map((action) => destinationKindForAction(action)));
  const destinationKind = destinationKinds.length === 1 ? destinationKinds[0] : (policyRule?.destination_kind ?? "unknown");
  const hasProtectedAction = deliveryActions.some((action) => action.protected_action);
  const finalActionRequired = Boolean(policyRule?.final_action_required || hasProtectedAction || deliveryActions.length > 0);
  const computedRequiredGates = requiredDestinationGates(policyRule ?? { required_gates: [], delivery_policy: "unknown" }, {
    finalActionRequired,
    destinationToolId: destinationToolForKind(destinationKind),
    deliveryActions,
  });
  const approvalPending = artifact.approval_status && artifact.approval_status !== "approved";
  const gateDecision = !policyRule
    ? "deny"
    : finalActionRequired || approvalPending
      ? "review"
      : "allow";
  return {
    schema_version: "artifact-destination-gate.v1",
    artifact_destination_gate_id: `artifact-destination-gate.${slugify(artifact.output_artifact_id)}`,
    output_artifact_id: artifact.output_artifact_id,
    artifact_type: artifact.artifact_type,
    artifact_uri: artifact.artifact_uri ?? null,
    tenant_id: artifact.tenant_id ?? null,
    matter_id: artifact.matter_id ?? null,
    domain_pack: artifact.domain_pack ?? null,
    policy_known: Boolean(policyRule),
    delivery_policy: policyRule?.delivery_policy ?? "unknown",
    output_status: artifact.output_status ?? "unknown",
    delivery_state: artifact.delivery_state ?? "unknown",
    approval_status: artifact.approval_status ?? "unknown",
    destination_kind: destinationKind,
    destination_tool_id: destinationToolForKind(destinationKind),
    delivery_action_count: deliveryActions.length,
    protected_delivery_action_count: deliveryActions.filter((action) => action.protected_action).length,
    final_action_required: finalActionRequired,
    draft_generation_allowed: true,
    draft_final_action_separated: Boolean(binding?.separation_status === "generation_approval_delivery_separated" || artifact.delivery_separation_status === "separate_delivery_action_linked"),
    output_destination_gate_required: finalActionRequired,
    required_gates: computedRequiredGates,
    gate_decision: gateDecision,
    gate_status: statusForDecision(gateDecision),
    ready_for_delivery: deliveryActions.some((action) => action.ready_for_delivery),
    executed: deliveryActions.some((action) => action.executed),
    unsafe_final_action: deliveryActions.some((action) => action.executed && (action.delivery_receipt_count ?? 0) === 0 && action.approval_status !== "approved"),
    reason_codes: unique([
      !policyRule ? "artifact_policy_missing" : null,
      finalActionRequired ? "artifact_has_final_action_boundary" : "artifact_internal_only",
      approvalPending ? "approval_pending" : null,
      hasProtectedAction ? "protected_delivery_action" : null,
    ]),
    decided_at: generatedAt,
    metadata: {
      capability_id: artifact.capability_id ?? null,
      workflow_run_id: artifact.workflow_run_id ?? null,
      binding_status: binding?.binding_status ?? null,
    },
  };
}

function buildDeliveryActionDestinationGate({
  action,
  policyRule,
  artifact,
  receipts,
  executionCandidate,
  toolPermissionGates,
  generatedAt,
}) {
  const destinationKind = destinationKindForAction(action);
  const destinationToolId = destinationToolForAction(action);
  const finalActionRequired = Boolean(action.protected_action || destinationToolId || policyRule?.final_action_required);
  const receiptPresent = receipts.some((receipt) => receipt.receipt_status === "delivered" || receipt.receipt_status === "pending");
  const deliveredReceiptPresent = receipts.some((receipt) => receipt.receipt_status === "delivered");
  const approved = action.approval_status === "approved";
  const executed = Boolean(action.executed || executionCandidate?.executed);
  const readyForDelivery = Boolean(action.ready_for_delivery || executionCandidate?.ready_for_delivery);
  const unsafeFinalAction = executed && !deliveredReceiptPresent;
  const blockedFinalAction = finalActionRequired && !executed && (!approved || action.delivery_status?.startsWith("blocked"));
  const gateDecision = unsafeFinalAction || !policyRule
    ? "deny"
    : finalActionRequired && (!approved || !deliveredReceiptPresent || !readyForDelivery)
      ? "review"
      : "allow";
  const finalActionStatus = unsafeFinalAction
    ? "unsafe_executed_without_required_control"
    : executed
      ? "executed_with_controls"
      : blockedFinalAction
        ? "blocked_pending_approval"
        : finalActionRequired
          ? "draft_not_executed"
          : "not_required";
  return {
    schema_version: "delivery-action-destination-gate.v1",
    delivery_action_destination_gate_id: `delivery-action-destination-gate.${slugify(action.delivery_action_id)}`,
    delivery_action_id: action.delivery_action_id,
    output_artifact_id: action.output_artifact_id,
    artifact_type: action.artifact_type,
    domain_pack: action.domain_pack ?? artifact?.domain_pack ?? null,
    tenant_id: action.tenant_id ?? artifact?.tenant_id ?? null,
    matter_id: action.matter_id ?? artifact?.matter_id ?? null,
    delivery_channel: action.delivery_channel ?? "unknown",
    delivery_target: action.delivery_target ?? "unknown",
    delivery_status: action.delivery_status ?? "unknown",
    destination_kind: destinationKind,
    destination_tool_id: destinationToolId,
    destination_tool_policy_known: !destinationToolId || toolPermissionGates.some((gate) => gate.tool_policy_known),
    destination_tool_gate_count: toolPermissionGates.length,
    protected_action: Boolean(action.protected_action),
    draft_only: Boolean(action.draft_only),
    final_action_required: finalActionRequired,
    ready_for_delivery: readyForDelivery,
    executed,
    approval_required: Boolean(action.requires_human_approval || policyRule?.human_approval_required),
    approval_status: action.approval_status ?? "unknown",
    receipt_required: finalActionRequired,
    receipt_present: receiptPresent,
    delivered_receipt_present: deliveredReceiptPresent,
    output_destination_gate_required: finalActionRequired,
    required_gates: requiredDestinationGates(policyRule ?? { required_gates: [], delivery_policy: "unknown" }, {
      finalActionRequired,
      destinationToolId,
      deliveryActions: [action],
    }),
    gate_decision: gateDecision,
    gate_status: statusForDecision(gateDecision),
    final_action_status: finalActionStatus,
    unsafe_final_action: unsafeFinalAction,
    blocked_final_action: blockedFinalAction,
    reason_codes: unique([
      !policyRule ? "delivery_policy_missing" : null,
      action.protected_action ? "protected_delivery_action" : null,
      action.draft_only ? "delivery_action_is_draft_only" : null,
      !approved && finalActionRequired ? "approval_pending_or_missing" : null,
      !deliveredReceiptPresent && finalActionRequired ? "delivery_receipt_not_delivered" : null,
      destinationToolId ? "destination_tool_bound" : null,
    ]),
    decided_at: generatedAt,
    metadata: {
      execution_candidate_status: executionCandidate?.execution_status ?? action.execution_candidate_status ?? null,
      run_status: action.run_status ?? null,
    },
  };
}

function buildFinalActionSeparationGates({
  policyRules,
  deliveryActions,
  deliveryActionDestinationGates,
  receiptsByActionId,
  executionCandidates,
  executionPackets,
  toolGateByToolId,
  generatedAt,
}) {
  const gates = [];
  for (const rule of policyRules) {
    const matchingActions = deliveryActions.filter((action) => action.artifact_type === rule.artifact_type);
    const matchingActionGates = deliveryActionDestinationGates.filter((gate) => gate.artifact_type === rule.artifact_type);
    gates.push(buildFinalActionSeparationGate({
      gateId: `final-action-separation-gate.policy.${slugify(rule.artifact_type)}`,
      subjectType: "policy_destination_rule",
      subjectId: rule.policy_destination_rule_id,
      artifactType: rule.artifact_type,
      deliveryPolicy: rule.delivery_policy,
      destinationKind: rule.destination_kind,
      destinationToolId: rule.destination_tool_id,
      finalActionRequired: rule.final_action_required,
      matchingActions,
      matchingActionGates,
      receiptsByActionId,
      executionCandidates,
      executionPackets,
      toolPermissionGates: toolGateByToolId.get(rule.destination_tool_id) ?? [],
      generatedAt,
    }));
  }
  const protectedTools = ["email.send", "erp.billing.issue", "github.merge"];
  for (const toolId of protectedTools) {
    const destinationKind = Object.entries(FINAL_ACTION_TOOL_BY_DESTINATION).find(([, value]) => value === toolId)?.[0] ?? "unknown";
    const matchingActions = deliveryActions.filter((action) => destinationToolForAction(action) === toolId);
    const matchingActionGates = deliveryActionDestinationGates.filter((gate) => gate.destination_tool_id === toolId);
    gates.push(buildFinalActionSeparationGate({
      gateId: `final-action-separation-gate.tool.${slugify(toolId)}`,
      subjectType: "destination_tool",
      subjectId: toolId,
      artifactType: null,
      deliveryPolicy: "protected_tool",
      destinationKind,
      destinationToolId: toolId,
      finalActionRequired: true,
      matchingActions,
      matchingActionGates,
      receiptsByActionId,
      executionCandidates,
      executionPackets,
      toolPermissionGates: toolGateByToolId.get(toolId) ?? [],
      generatedAt,
    }));
  }
  return gates;
}

function buildFinalActionSeparationGate({
  gateId,
  subjectType,
  subjectId,
  artifactType,
  deliveryPolicy,
  destinationKind,
  destinationToolId,
  finalActionRequired,
  matchingActions,
  matchingActionGates,
  toolPermissionGates,
  generatedAt,
}) {
  const currentActionCount = matchingActions.length;
  const executedCount = matchingActionGates.filter((gate) => gate.executed).length;
  const unsafeFinalActionCount = matchingActionGates.filter((gate) => gate.unsafe_final_action).length;
  const blockedFinalActionCount = matchingActionGates.filter((gate) => gate.blocked_final_action).length;
  const pendingApprovalCount = matchingActionGates.filter((gate) => gate.approval_status !== "approved" && gate.final_action_required).length;
  const draftOnlyCount = matchingActionGates.filter((gate) => gate.draft_only).length;
  const toolPolicyKnown = !destinationToolId || toolPermissionGates.some((gate) => gate.tool_policy_known);
  const protectedToolGatePresent = !destinationToolId || toolPermissionGates.some((gate) => gate.protected_action && gate.gate_decision !== "allow");
  const separationStatus = unsafeFinalActionCount > 0
    ? "unsafe_final_action"
    : currentActionCount === 0
      ? "policy_separated_no_current_action"
      : executedCount > 0
        ? "executed_with_controls"
        : blockedFinalActionCount > 0 || pendingApprovalCount > 0
          ? "draft_and_final_action_separated_pending_approval"
          : "draft_and_final_action_separated";
  const gateDecision = unsafeFinalActionCount > 0 || !toolPolicyKnown
    ? "deny"
    : finalActionRequired && (blockedFinalActionCount > 0 || pendingApprovalCount > 0 || protectedToolGatePresent)
      ? "review"
      : "allow";
  return {
    schema_version: "final-action-separation-gate.v1",
    final_action_separation_gate_id: gateId,
    subject_type: subjectType,
    subject_id: subjectId,
    artifact_type: artifactType,
    delivery_policy: deliveryPolicy,
    destination_kind: destinationKind,
    destination_tool_id: destinationToolId,
    final_action_required: finalActionRequired,
    current_action_count: currentActionCount,
    draft_only_action_count: draftOnlyCount,
    executed_action_count: executedCount,
    blocked_final_action_count: blockedFinalActionCount,
    pending_approval_count: pendingApprovalCount,
    unsafe_final_action_count: unsafeFinalActionCount,
    tool_policy_known: toolPolicyKnown,
    protected_tool_gate_present: protectedToolGatePresent,
    output_destination_gate_required: finalActionRequired,
    separation_status: separationStatus,
    gate_decision: gateDecision,
    gate_status: statusForDecision(gateDecision),
    required_gates: unique([
      finalActionRequired ? "output_destination_gate" : null,
      finalActionRequired ? "human_approval_gate" : null,
      destinationToolId ? "tool_permission_gate" : null,
    ]),
    reason_codes: unique([
      finalActionRequired ? "final_action_must_be_separate_from_draft" : "final_action_not_required",
      destinationToolId ? "protected_destination_tool" : null,
      currentActionCount === 0 ? "no_current_delivery_action" : null,
      blockedFinalActionCount > 0 ? "final_action_blocked_pending_approval" : null,
      unsafeFinalActionCount > 0 ? "unsafe_final_action_detected" : null,
    ]),
    decided_at: generatedAt,
    metadata: {},
  };
}

function validateOutputDestinationPolicy({
  policyResult,
  outputDeliveryResult,
  deliveryQueueResult,
  deliveryExecutionResult,
  toolRuntimeResult,
  projected,
}) {
  const validationItems = [];
  const policyArtifactTypes = new Set(projected.policyRules.map((rule) => rule.artifact_type));
  const deliveryActionIds = new Set(projected.deliveryActions.map((action) => action.delivery_action_id));
  const toolIds = new Set(projected.toolPermissionGates.map((gate) => gate.tool_id));

  pushCheck(validationItems, "source", "policy_matrix_catalog", "source_available", policyResult.ok, "Policy Matrix Catalog must be readable.");
  pushCheck(validationItems, "source", "output_delivery_contract_freeze", "source_available", outputDeliveryResult.ok, "Output/Delivery contract freeze must be readable.");
  pushCheck(validationItems, "source", "protected_delivery_queue", "source_available", deliveryQueueResult.ok, "Protected Delivery Queue must be readable.");
  pushCheck(validationItems, "source", "delivery_execution_draft", "source_available", deliveryExecutionResult.ok, "Delivery Execution Draft must be readable.");
  pushCheck(validationItems, "source", "tool_runtime_policy_enforcement", "source_available", toolRuntimeResult.ok, "Tool/Runtime Policy Enforcement must be readable.");
  pushCheck(validationItems, "source", policyResult.value?.catalog_id ?? "policy_matrix_catalog", "policy_matrix_valid", policyResult.value?.summary?.policy_status === "valid", "Policy Matrix Catalog must be valid.");
  pushCheck(validationItems, "source", outputDeliveryResult.value?.freeze_id ?? "output_delivery_contract_freeze", "output_delivery_contract_complete", outputDeliveryResult.value?.summary?.freeze_status === "complete", "Output/Delivery contract freeze must be complete.");
  pushCheck(validationItems, "source", "protected_delivery_queue", "delivery_queue_has_actions", (deliveryQueueResult.value?.summary?.delivery_action_count ?? projected.deliveryActions.length) > 0, "Protected Delivery Queue must expose delivery actions.");
  pushCheck(validationItems, "source", deliveryExecutionResult.value?.execution_plan_id ?? "delivery_execution_draft", "delivery_execution_draft_only", deliveryExecutionResult.value?.execution_mode === "draft_only", "Delivery execution must remain draft_only.");
  pushCheck(validationItems, "source", toolRuntimeResult.value?.tool_runtime_policy_enforcement_id ?? "tool_runtime_policy_enforcement", "tool_runtime_policy_complete", toolRuntimeResult.value?.summary?.tool_runtime_policy_enforcement_status === "complete", "Tool/Runtime Policy Enforcement must be complete.");

  pushUniqueIdChecks(validationItems, projected.policyRules, "policy_destination_rule", "policy_destination_rule_id");
  pushUniqueIdChecks(validationItems, projected.artifactDestinationGates, "artifact_destination_gate", "artifact_destination_gate_id");
  pushUniqueIdChecks(validationItems, projected.deliveryActionDestinationGates, "delivery_action_destination_gate", "delivery_action_destination_gate_id");
  pushUniqueIdChecks(validationItems, projected.finalActionSeparationGates, "final_action_separation_gate", "final_action_separation_gate_id");

  for (const rule of projected.policyRules) {
    pushCheck(validationItems, "policy_destination_rule", rule.policy_destination_rule_id, "decision_supported", DECISIONS.has(rule.gate_decision), "Policy destination decision must be allow, review, or deny.");
    pushCheck(validationItems, "policy_destination_rule", rule.policy_destination_rule_id, "status_supported", GATE_STATUSES.has(rule.gate_status), "Policy destination status must be supported.");
    pushCheck(validationItems, "policy_destination_rule", rule.policy_destination_rule_id, "final_action_gate_computed", !rule.final_action_required || rule.computed_required_gates.includes("output_destination_gate"), "Final-action policy rules must compute output_destination_gate.");
    pushCheck(validationItems, "policy_destination_rule", rule.policy_destination_rule_id, "destination_tool_policy_known", !rule.destination_tool_id || rule.tool_policy_known, "Protected destination tools must link to Tool/Runtime policy.");
  }

  for (const gate of projected.artifactDestinationGates) {
    pushCheck(validationItems, "artifact_destination_gate", gate.artifact_destination_gate_id, "policy_known", gate.policy_known, "Output artifact must have an output policy rule.");
    pushCheck(validationItems, "artifact_destination_gate", gate.artifact_destination_gate_id, "matter_boundary_present", Boolean(gate.tenant_id && gate.matter_id), "Output artifact destination gate must preserve tenant and matter boundary.");
    pushCheck(validationItems, "artifact_destination_gate", gate.artifact_destination_gate_id, "draft_final_action_separated", !gate.final_action_required || gate.draft_final_action_separated, "Output artifact generation must be separate from final delivery.");
    pushCheck(validationItems, "artifact_destination_gate", gate.artifact_destination_gate_id, "output_destination_gate_present", !gate.final_action_required || gate.required_gates.includes("output_destination_gate"), "Final-action artifact gates must include output_destination_gate.");
    pushCheck(validationItems, "artifact_destination_gate", gate.artifact_destination_gate_id, "unsafe_final_action_absent", !gate.unsafe_final_action, "Output artifact must not show an unsafe final action.");
  }

  for (const gate of projected.deliveryActionDestinationGates) {
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "policy_known", policyArtifactTypes.has(gate.artifact_type), "Delivery action must map to an output policy rule.");
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "action_known", deliveryActionIds.has(gate.delivery_action_id), "Delivery action gate must reference a known action.");
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "decision_supported", DECISIONS.has(gate.gate_decision), "Delivery action destination decision must be allow, review, or deny.");
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "status_supported", GATE_STATUSES.has(gate.gate_status), "Delivery action destination status must be supported.");
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "draft_only_before_final", !gate.final_action_required || gate.draft_only || gate.executed, "Protected delivery action must be draft_only before final execution.");
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "output_destination_gate_present", !gate.final_action_required || gate.required_gates.includes("output_destination_gate"), "Final-action delivery gates must include output_destination_gate.");
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "destination_tool_policy_known", !gate.destination_tool_id || gate.destination_tool_policy_known, "Destination tool policy must be known for protected tools.");
    pushCheck(validationItems, "delivery_action_destination_gate", gate.delivery_action_destination_gate_id, "unsafe_final_action_absent", !gate.unsafe_final_action, "Final action must not be executed without approval and delivered receipt.");
  }

  for (const gate of projected.finalActionSeparationGates) {
    pushCheck(validationItems, "final_action_separation_gate", gate.final_action_separation_gate_id, "decision_supported", DECISIONS.has(gate.gate_decision), "Final action separation decision must be allow, review, or deny.");
    pushCheck(validationItems, "final_action_separation_gate", gate.final_action_separation_gate_id, "status_supported", GATE_STATUSES.has(gate.gate_status), "Final action separation status must be supported.");
    pushCheck(validationItems, "final_action_separation_gate", gate.final_action_separation_gate_id, "output_destination_gate_present", !gate.final_action_required || gate.required_gates.includes("output_destination_gate"), "Final action separation must require output_destination_gate.");
    pushCheck(validationItems, "final_action_separation_gate", gate.final_action_separation_gate_id, "protected_tool_gate_present", !gate.destination_tool_id || (toolIds.has(gate.destination_tool_id) && gate.protected_tool_gate_present), "Protected final-action tools must have Tool/Runtime protected gates.");
    pushCheck(validationItems, "final_action_separation_gate", gate.final_action_separation_gate_id, "unsafe_final_action_absent", gate.unsafe_final_action_count === 0, "No final action may execute without approval and receipt controls.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.policyRules.length === 0) errors.push({ path: "output_destination_policy_catalog.policy_rules", message: "At least one destination policy rule is required." });
  if (projected.artifactDestinationGates.length === 0) errors.push({ path: "output_destination_policy_catalog.artifact_destination_gates", message: "At least one artifact destination gate is required." });
  if (projected.deliveryActionDestinationGates.length === 0) errors.push({ path: "output_destination_policy_catalog.delivery_action_destination_gates", message: "At least one delivery action destination gate is required." });
  if (projected.finalActionSeparationGates.length === 0) errors.push({ path: "output_destination_policy_catalog.final_action_separation_gates", message: "At least one final action separation gate is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeOutputDestinationPolicy(projected, validationItems, validation, sources) {
  const policyRules = projected.policyRules;
  const artifactGates = projected.artifactDestinationGates;
  const deliveryGates = projected.deliveryActionDestinationGates;
  const finalGates = projected.finalActionSeparationGates;
  const failedChecks = validationItems.filter((item) => item.status === "failed");
  return {
    output_destination_policy_status: validation.valid ? "complete" : "blocked",
    source_policy_matrix_status: sources.policyResult.value?.summary?.policy_status ?? "unknown",
    source_output_delivery_contract_status: sources.outputDeliveryResult.value?.summary?.freeze_status ?? "unknown",
    source_delivery_queue_action_count: sources.deliveryQueueResult.value?.summary?.delivery_action_count ?? 0,
    source_delivery_execution_mode: sources.deliveryExecutionResult.value?.execution_mode ?? "unknown",
    source_tool_runtime_policy_status: sources.toolRuntimeResult.value?.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
    policy_rule_count: policyRules.length,
    output_rule_count: projected.outputRules.length,
    output_artifact_count: projected.outputArtifacts.length,
    delivery_action_count: projected.deliveryActions.length,
    delivery_receipt_count: projected.deliveryReceipts.length,
    artifact_destination_gate_count: artifactGates.length,
    delivery_action_destination_gate_count: deliveryGates.length,
    final_action_separation_gate_count: finalGates.length,
    final_action_required_policy_count: policyRules.filter((rule) => rule.final_action_required).length,
    final_action_required_artifact_count: artifactGates.filter((gate) => gate.final_action_required).length,
    final_action_required_delivery_count: deliveryGates.filter((gate) => gate.final_action_required).length,
    draft_generation_allowed_count: artifactGates.filter((gate) => gate.draft_generation_allowed).length,
    draft_final_action_separated_count: artifactGates.filter((gate) => gate.draft_final_action_separated).length,
    protected_destination_count: deliveryGates.filter((gate) => gate.protected_action).length,
    protected_destination_tool_count: finalGates.filter((gate) => gate.destination_tool_id).length,
    tool_policy_linked_count: finalGates.filter((gate) => gate.tool_policy_known).length,
    review_gate_count: [...policyRules, ...artifactGates, ...deliveryGates, ...finalGates].filter((gate) => gate.gate_status === "requires_approval").length,
    blocked_gate_count: [...policyRules, ...artifactGates, ...deliveryGates, ...finalGates].filter((gate) => gate.gate_status === "blocked").length,
    blocked_final_action_count: deliveryGates.filter((gate) => gate.blocked_final_action).length,
    pending_approval_final_action_count: deliveryGates.filter((gate) => gate.final_action_required && gate.approval_status !== "approved").length,
    approved_final_action_count: deliveryGates.filter((gate) => gate.final_action_required && gate.approval_status === "approved").length,
    executed_final_action_count: deliveryGates.filter((gate) => gate.executed).length,
    unsafe_final_action_count: deliveryGates.filter((gate) => gate.unsafe_final_action).length + finalGates.reduce((count, gate) => count + gate.unsafe_final_action_count, 0),
    missing_policy_count: failedChecks.filter((item) => item.check_id === "policy_known").length,
    missing_tool_policy_count: failedChecks.filter((item) => item.check_id === "destination_tool_policy_known" || item.check_id === "protected_tool_gate_present").length,
    missing_output_destination_gate_count: failedChecks.filter((item) => item.check_id === "output_destination_gate_present" || item.check_id === "final_action_gate_computed").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedChecks.length,
    validation_error_count: validation.errors.length,
    by_artifact_type: countBy([...artifactGates, ...deliveryGates], "artifact_type"),
    by_delivery_policy: countBy(policyRules, "delivery_policy"),
    by_destination_kind: countBy([...policyRules, ...artifactGates, ...deliveryGates, ...finalGates], "destination_kind"),
    by_delivery_channel: countBy(deliveryGates, "delivery_channel"),
    by_gate_status: countBy([...policyRules, ...artifactGates, ...deliveryGates, ...finalGates], "gate_status"),
    by_gate_decision: countBy([...policyRules, ...artifactGates, ...deliveryGates, ...finalGates], "gate_decision"),
    by_final_action_status: countBy(deliveryGates, "final_action_status"),
    by_separation_status: countBy(finalGates, "separation_status"),
  };
}

function destinationKindForRule(rule) {
  if (rule.artifact_type === "email_draft") return "email";
  if (rule.artifact_type === "erp_billing_draft") return "erp";
  if (rule.artifact_type === "pr_draft") return "github";
  if (rule.artifact_type === "public_content") return "public_distribution";
  if (["docx", "pptx"].includes(rule.artifact_type)) return "manual_delivery";
  if (rule.delivery_policy === "internal_only") return "internal_record";
  return "manual_delivery";
}

function destinationKindForAction(action) {
  const channel = String(action.delivery_channel ?? "").toLowerCase();
  const target = String(action.delivery_target ?? "").toLowerCase();
  const artifactType = String(action.artifact_type ?? "").toLowerCase();
  if (channel.includes("github") || target.includes("github") || artifactType === "pr_draft") return "github";
  if (channel.includes("email") || target.includes("email") || artifactType === "email_draft") return "email";
  if (channel.includes("erp") || target.includes("billing") || artifactType === "erp_billing_draft") return "erp";
  if (channel.includes("manual") || target.includes("packet") || target.includes("document")) return "manual_delivery";
  return "internal_record";
}

function destinationToolForRule(rule) {
  return destinationToolForKind(destinationKindForRule(rule));
}

function destinationToolForAction(action) {
  return destinationToolForKind(destinationKindForAction(action));
}

function destinationToolForKind(kind) {
  return FINAL_ACTION_TOOL_BY_DESTINATION[kind] ?? null;
}

function requiredDestinationGates(policyRule, { finalActionRequired, destinationToolId, deliveryActions = [] }) {
  const policyGates = policyRule.computed_required_gates ?? policyRule.required_gates ?? policyRule.original_required_gates ?? [];
  const actionGates = deliveryActions.flatMap((action) => action.blocking_gate_ids ?? []);
  return unique([
    ...policyGates,
    ...actionGates,
    finalActionRequired ? "output_destination_gate" : null,
    destinationToolId ? "tool_permission_gate" : null,
    (policyRule.delivery_policy === "partner_approval_required" || policyRule.approval_required || deliveryActions.some((action) => action.requires_human_approval)) ? "human_approval_gate" : null,
    policyRule.delivery_policy === "test_gate_required" ? "test_gate" : null,
    destinationToolId === "erp.billing.issue" ? "billing_approval_gate" : null,
  ]);
}

function statusForDecision(decision) {
  if (decision === "deny") return "blocked";
  if (decision === "review") return "requires_approval";
  return "passed";
}

function summarizePolicySource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    catalog_id: source.catalog_id ?? null,
    policy_status: source.summary?.policy_status ?? (result.ok ? "unknown" : "missing"),
    output_rule_count: source.summary?.output_rule_count ?? 0,
    validation_error_count: source.summary?.validation_error_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizeOutputDeliverySource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? (result.ok ? "unknown" : "missing"),
    output_artifact_count: source.summary?.output_artifact_count ?? 0,
    delivery_action_count: source.summary?.delivery_action_count ?? 0,
    delivery_receipt_count: source.summary?.delivery_receipt_count ?? 0,
    validation_error_count: source.summary?.validation_error_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizeDeliveryQueueSource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    delivery_action_count: source.summary?.delivery_action_count ?? 0,
    protected_action_count: source.summary?.protected_action_count ?? 0,
    blocked_action_count: source.summary?.blocked_action_count ?? 0,
    ready_action_count: source.summary?.ready_action_count ?? 0,
    delivered_action_count: source.summary?.delivered_action_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizeDeliveryExecutionSource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    execution_plan_id: source.execution_plan_id ?? null,
    execution_mode: source.execution_mode ?? (result.ok ? "unknown" : "missing"),
    ready_candidate_count: source.summary?.ready_candidate_count ?? 0,
    blocked_candidate_count: source.summary?.blocked_candidate_count ?? 0,
    execution_packet_count: source.summary?.execution_packet_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function summarizeToolRuntimeSource(result) {
  const source = result.value ?? {};
  return {
    schema_version: source.schema_version ?? null,
    tool_runtime_policy_enforcement_id: source.tool_runtime_policy_enforcement_id ?? null,
    tool_runtime_policy_enforcement_status: source.summary?.tool_runtime_policy_enforcement_status ?? (result.ok ? "unknown" : "missing"),
    tool_permission_gate_count: source.summary?.tool_permission_gate_count ?? 0,
    protected_action_tool_gate_count: source.summary?.protected_action_tool_gate_count ?? 0,
    validation_error_count: source.summary?.validation_error_count ?? 0,
    error: result.ok ? null : result.error,
  };
}

function renderOutputDestinationPolicyMarkdown(result) {
  const lines = [];
  lines.push("# Output Destination Policy Enforcement");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.output_destination_policy_status}`);
  lines.push("");
  lines.push(`- Policy destination rules: ${result.summary.policy_rule_count}`);
  lines.push(`- Artifact destination gates: ${result.summary.artifact_destination_gate_count}`);
  lines.push(`- Delivery action destination gates: ${result.summary.delivery_action_destination_gate_count}`);
  lines.push(`- Final action separation gates: ${result.summary.final_action_separation_gate_count}`);
  lines.push(`- Protected destination actions: ${result.summary.protected_destination_count}`);
  lines.push(`- Blocked final actions awaiting approval: ${result.summary.blocked_final_action_count}`);
  lines.push(`- Unsafe final actions: ${result.summary.unsafe_final_action_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Delivery Gates");
  for (const gate of result.output_destination_policy_catalog.delivery_action_destination_gates) {
    lines.push(`- ${gate.delivery_action_id}: ${gate.destination_kind}, ${gate.final_action_status}, ${gate.gate_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    policy_matrix_catalog_path: path.resolve(options.policyMatrixCatalogPath ?? DEFAULT_OUTPUT_DESTINATION_POLICY_INPUTS.policyMatrixCatalogPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_OUTPUT_DESTINATION_POLICY_INPUTS.outputDeliveryContractFreezePath),
    protected_delivery_queue_path: path.resolve(options.protectedDeliveryQueuePath ?? DEFAULT_OUTPUT_DESTINATION_POLICY_INPUTS.protectedDeliveryQueuePath),
    delivery_execution_draft_path: path.resolve(options.deliveryExecutionDraftPath ?? DEFAULT_OUTPUT_DESTINATION_POLICY_INPUTS.deliveryExecutionDraftPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_OUTPUT_DESTINATION_POLICY_INPUTS.toolRuntimePolicyEnforcementPath),
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
    else if (arg === "--policy-matrix-catalog") parsed.policyMatrixCatalogPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--protected-delivery-queue") parsed.protectedDeliveryQueuePath = argv[++index];
    else if (arg === "--delivery-execution-draft") parsed.deliveryExecutionDraftPath = argv[++index];
    else if (arg === "--tool-runtime-policy-enforcement") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
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
  console.log(`Usage: node scripts/output-destination-policy-enforcement.mjs [options]

Options:
  --policy-matrix-catalog <path>           policy-matrix-catalog.json path.
  --output-delivery-contract-freeze <path> output-delivery-contract-freeze.json path.
  --protected-delivery-queue <path>        protected-delivery-queue.json path.
  --delivery-execution-draft <path>        delivery-execution-draft.json path.
  --tool-runtime-policy-enforcement <path> tool-runtime-policy-enforcement.json path.
  --out-dir <path>                         Output directory.
  --run-at <iso>                           Deterministic timestamp.
  --check                                  Exit non-zero when validation fails.
  --no-write                               Build without writing artifacts.
  -h, --help                               Show this help.
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
    schema_version: "output-destination-policy-validation.v1",
    validation_id: `output-destination-policy-validation.${slugify(subjectType)}.${slugify(subjectId)}.${slugify(checkId)}`,
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

function groupByMany(items, key) {
  return items.reduce((groups, item) => {
    const values = item[key] ?? [];
    for (const value of values) {
      const group = groups.get(value) ?? [];
      group.push(item);
      groups.set(value, group);
    }
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
