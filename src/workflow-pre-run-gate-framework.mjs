import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_OUT_DIR = "artifacts/workflow-pre-run-gates/latest";
export const DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS = {
  workflowPromptInjectionBoundaryPath: "artifacts/workflow-prompt-injection-boundary/latest/workflow-prompt-injection-boundary.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  toolRuntimePolicyEnforcementPath: "artifacts/tool-runtime-policy/latest/tool-runtime-policy-enforcement.json",
  costBudgetLedgerPath: "artifacts/cost-budget/latest/cost-budget-ledger.json",
  conflictCheckInterfacePath: "artifacts/conflict-check/latest/conflict-check-interface.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const PRE_RUN_GATE_FRAMEWORK_CONTRACT_ID = "workflow-pre-run-gate-framework.v1";
const PRE_RUN_GATE_RECORD_SCHEMA_VERSION = "workflow-pre-run-gate-record.v1";
const PRE_RUN_GATE_DECISION_SCHEMA_VERSION = "workflow-pre-run-gate-decision.v1";
const PRE_RUN_GATE_GUARD_SCHEMA_VERSION = "workflow-pre-run-gate-guard.v1";
const REQUIRED_GATE_TYPES = ["access_gate", "model_gate", "tool_gate", "budget_gate", "conflict_gate"];

export async function runWorkflowPreRunGateFramework(options = {}) {
  const result = await buildWorkflowPreRunGateFramework(options);
  if (options.write !== false) await writeWorkflowPreRunGateFramework(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow pre-run gate framework validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowPreRunGateFramework(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowPromptInjectionBoundary = await readJson(inputs.workflow_prompt_injection_boundary_path);
  const matterAccessPolicyEvaluator = await readJson(inputs.matter_access_policy_evaluator_path);
  const modelPolicyEnforcement = await readJson(inputs.model_policy_enforcement_path);
  const toolRuntimePolicyEnforcement = await readJson(inputs.tool_runtime_policy_enforcement_path);
  const costBudgetLedger = await readJson(inputs.cost_budget_ledger_path);
  const conflictCheckInterface = await readJson(inputs.conflict_check_interface_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const buildResult = buildPreRunGateRecords({
    workflowPromptInjectionBoundary,
    matterAccessPolicyEvaluator,
    modelPolicyEnforcement,
    toolRuntimePolicyEnforcement,
    costBudgetLedger,
    conflictCheckInterface,
    generatedAt,
  });
  const validationItems = validateWorkflowPreRunGateFramework({
    workflowPromptInjectionBoundary,
    matterAccessPolicyEvaluator,
    modelPolicyEnforcement,
    toolRuntimePolicyEnforcement,
    costBudgetLedger,
    conflictCheckInterface,
    packageJson,
    roadmapText,
    buildResult,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-pre-run-gate-framework.v1",
    generated_at: generatedAt,
    workflow_pre_run_gate_framework_id: `workflow-pre-run-gate-framework.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_prompt_injection_boundary: sourceSummary(workflowPromptInjectionBoundary, "workflow_prompt_injection_boundary_status"),
      matter_access_policy_evaluator: sourceSummary(matterAccessPolicyEvaluator, "access_policy_status"),
      model_policy_enforcement: sourceSummary(modelPolicyEnforcement, "model_policy_enforcement_status"),
      tool_runtime_policy_enforcement: sourceSummary(toolRuntimePolicyEnforcement, "tool_runtime_policy_enforcement_status"),
      cost_budget_ledger: sourceSummary(costBudgetLedger, "cost_budget_ledger_status"),
      conflict_check_interface: sourceSummary(conflictCheckInterface, "conflict_check_interface_status"),
    },
    pre_run_gate_framework_contract: buildPreRunGateFrameworkContract(generatedAt),
    pre_run_gate_records: buildResult.preRunGateRecords,
    pre_run_gate_decision_records: buildResult.preRunGateDecisionRecords,
    pre_run_gate_guard_records: buildResult.preRunGateGuardRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowPreRunGateFramework({
      workflowPromptInjectionBoundary,
      matterAccessPolicyEvaluator,
      modelPolicyEnforcement,
      toolRuntimePolicyEnforcement,
      costBudgetLedger,
      conflictCheckInterface,
      buildResult,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowPreRunGateFrameworkMarkdown(result),
  };
}

export async function writeWorkflowPreRunGateFramework(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-pre-run-gate-framework.json"), serializablePreRunGateFramework(result));
  await writeJson(path.join(outDir, "pre-run-gate-records.json"), {
    schema_version: "workflow-pre-run-gate-records.v1",
    generated_at: result.generated_at,
    pre_run_gate_record_count: result.pre_run_gate_records.length,
    pre_run_gate_records: result.pre_run_gate_records,
  });
  await writeJson(path.join(outDir, "pre-run-gate-decisions.json"), {
    schema_version: "workflow-pre-run-gate-decision-records.v1",
    generated_at: result.generated_at,
    pre_run_gate_decision_record_count: result.pre_run_gate_decision_records.length,
    pre_run_gate_decision_records: result.pre_run_gate_decision_records,
  });
  await writeJson(path.join(outDir, "pre-run-gate-guards.json"), {
    schema_version: "workflow-pre-run-gate-guard-records.v1",
    generated_at: result.generated_at,
    pre_run_gate_guard_record_count: result.pre_run_gate_guard_records.length,
    pre_run_gate_guard_records: result.pre_run_gate_guard_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-pre-run-gate-framework-validation-report.v1",
    generated_at: result.generated_at,
    workflow_pre_run_gate_framework_id: result.workflow_pre_run_gate_framework_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowPreRunGateFrameworkCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowPreRunGateFramework(args);
    console.log(`Workflow pre-run gate framework ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_pre_run_gate_framework_status}`);
    console.log(`Gate records: ${result.summary.pre_run_gate_record_count}`);
    console.log(`Gate sets: ${result.summary.workflow_run_with_gate_set_count}`);
    console.log(`Held decisions: ${result.summary.held_for_human_review_decision_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildPreRunGateRecords({
  workflowPromptInjectionBoundary,
  matterAccessPolicyEvaluator,
  modelPolicyEnforcement,
  toolRuntimePolicyEnforcement,
  costBudgetLedger,
  conflictCheckInterface,
  generatedAt,
}) {
  const promptBoundaryGuards = workflowPromptInjectionBoundary.prompt_boundary_guard_records ?? [];
  const wrappersByRequest = groupBy(workflowPromptInjectionBoundary.untrusted_content_wrapper_records ?? [], "retrieval_request_record_id");
  const resourceAccessDecisions = matterAccessPolicyEvaluator.matter_access_policy?.resource_access_decisions ?? [];
  const matterAccessDecisions = matterAccessPolicyEvaluator.matter_access_policy?.matter_access_decisions ?? [];
  const routeModelGatesByRun = groupBy(modelPolicyEnforcement.model_policy_gate_catalog?.route_model_gates ?? [], "workflow_run_id");
  const resourceModelGatesByResource = groupBy(modelPolicyEnforcement.model_policy_gate_catalog?.resource_model_gates ?? [], "resource_id");
  const agentToolGatesByRun = groupBy(toolRuntimePolicyEnforcement.tool_runtime_policy_catalog?.agent_run_tool_gates ?? [], "workflow_run_id");
  const budgetDecisionsByRun = groupBy(costBudgetLedger.budget_decisions ?? [], "workflow_run_id");
  const conflictResultsByMatter = groupBy(conflictCheckInterface.conflict_check_catalog?.conflict_check_results ?? [], "matter_id");

  const preRunGateRecords = [];
  const preRunGateDecisionRecords = [];
  const preRunGateGuardRecords = [];

  for (const promptGuard of [...promptBoundaryGuards].sort(by("workflow_run_id"))) {
    const wrappers = wrappersByRequest.get(promptGuard.retrieval_request_record_id) ?? [];
    const context = {
      promptGuard,
      wrappers,
      resourceAccessDecisions,
      matterAccessDecisions,
      routeModelGates: routeModelGatesByRun.get(promptGuard.workflow_run_id) ?? [],
      resourceModelGatesByResource,
      agentToolGates: agentToolGatesByRun.get(promptGuard.workflow_run_id) ?? [],
      budgetDecisions: budgetDecisionsByRun.get(promptGuard.workflow_run_id) ?? [],
      conflictResults: conflictResultsByMatter.get(promptGuard.matter_id) ?? [],
      generatedAt,
    };
    const gateRecords = [
      buildAccessGateRecord(context),
      buildModelGateRecord(context),
      buildToolGateRecord(context),
      buildBudgetGateRecord(context),
      buildConflictGateRecord(context),
    ];
    preRunGateRecords.push(...gateRecords);
    const decisionRecord = buildPreRunGateDecisionRecord(promptGuard, gateRecords, generatedAt);
    preRunGateDecisionRecords.push(decisionRecord);
    preRunGateGuardRecords.push(buildPreRunGateGuardRecord(promptGuard, gateRecords, decisionRecord, generatedAt));
  }

  return {
    preRunGateRecords,
    preRunGateDecisionRecords,
    preRunGateGuardRecords,
  };
}

function buildAccessGateRecord(context) {
  const { promptGuard, wrappers, resourceAccessDecisions, matterAccessDecisions, generatedAt } = context;
  const resourceIds = unique(wrappers.map((wrapper) => wrapper.resource_id));
  const matchingResourceDecisions = resourceAccessDecisions.filter((decision) =>
    resourceIds.includes(decision.resource_id)
      && (decision.target_matter_id === promptGuard.matter_id || decision.resource_matter_id === promptGuard.matter_id || decision.matter_id === promptGuard.matter_id));
  const matchingMatterDecisions = matterAccessDecisions.filter((decision) => decision.matter_id === promptGuard.matter_id);
  const sourceStatuses = [
    ...matchingResourceDecisions.map((decision) => decision.access_decision),
    ...matchingMatterDecisions.map((decision) => decision.access_decision),
  ];
  const lawFirmScoped = promptGuard.policy_snapshot_id === "policy.default.law_firm.v1" || promptGuard.classification_floor === "P2_CLIENT_CONFIDENTIAL";
  const gateDecision = sourceStatuses.includes("deny")
    ? "review"
    : sourceStatuses.includes("review") || matchingResourceDecisions.some((decision) => decision.requires_human_review) || lawFirmScoped
      ? "review"
      : "allow";
  const gateStatus = gateDecision === "allow" ? "passed" : "review_required";
  const reasonCodes = [
    matchingResourceDecisions.length > 0 ? "resource_access_decision_resolved" : "resource_access_decision_not_scoped_to_request",
    matchingMatterDecisions.length > 0 ? "matter_access_decision_resolved" : "matter_access_decision_not_scoped_to_request",
    lawFirmScoped ? "law_firm_or_client_confidential_access_requires_human_review" : "non_law_firm_workspace_access_prechecked",
  ];
  return buildGateRecord({
    promptGuard,
    gateType: "access_gate",
    source_record_ids: [
      ...matchingResourceDecisions.map((decision) => decision.resource_access_decision_id),
      ...matchingMatterDecisions.map((decision) => decision.matter_access_decision_id),
    ],
    gateDecision,
    gateStatus,
    humanReviewRequired: gateDecision !== "allow",
    source_statuses: sourceStatuses,
    reason_codes: reasonCodes,
    generatedAt,
    metadata: {
      candidate_resource_count: resourceIds.length,
      matched_resource_access_decision_count: matchingResourceDecisions.length,
      matched_matter_access_decision_count: matchingMatterDecisions.length,
      source_deny_count: sourceStatuses.filter((status) => status === "deny").length,
    },
  });
}

function buildModelGateRecord(context) {
  const { promptGuard, wrappers, routeModelGates, resourceModelGatesByResource, generatedAt } = context;
  const resourceIds = unique(wrappers.map((wrapper) => wrapper.resource_id));
  const resourceModelGates = resourceIds.flatMap((resourceId) => resourceModelGatesByResource.get(resourceId) ?? []);
  const sourceGates = [...routeModelGates, ...resourceModelGates];
  const hasBlocked = sourceGates.some((gate) => gate.gate_status === "blocked" || gate.gate_decision === "deny");
  const hasReview = sourceGates.some((gate) => gate.gate_status === "requires_approval" || gate.gate_decision === "review" || gate.human_approval_required);
  const gateDecision = hasBlocked ? "review" : hasReview ? "review" : "allow";
  const gateStatus = gateDecision === "allow" ? "passed" : "review_required";
  return buildGateRecord({
    promptGuard,
    gateType: "model_gate",
    source_record_ids: sourceGates.map((gate) => gate.route_model_gate_id ?? gate.resource_model_gate_id ?? gate.classification_model_gate_id).filter(Boolean),
    gateDecision,
    gateStatus,
    humanReviewRequired: gateDecision !== "allow",
    source_statuses: sourceGates.map((gate) => gate.gate_status ?? gate.external_model_decision).filter(Boolean),
    reason_codes: [
      routeModelGates.length > 0 ? "workflow_route_model_gate_resolved" : "workflow_route_model_gate_missing",
      resourceModelGates.length > 0 ? "candidate_resource_model_gates_resolved" : "candidate_resource_model_gates_not_required",
      hasBlocked ? "source_model_gate_denial_held_for_review" : hasReview ? "source_model_gate_requires_approval" : "model_route_prechecked",
    ],
    generatedAt,
    metadata: {
      route_model_gate_count: routeModelGates.length,
      resource_model_gate_count: resourceModelGates.length,
      external_transfer_requested_count: sourceGates.filter((gate) => gate.external_transfer).length,
    },
  });
}

function buildToolGateRecord(context) {
  const { promptGuard, agentToolGates, generatedAt } = context;
  const hasBlocked = agentToolGates.some((gate) => gate.gate_status === "blocked" || gate.gate_decision === "deny");
  const hasReview = agentToolGates.length === 0 || agentToolGates.some((gate) => gate.gate_status === "requires_approval" || gate.gate_decision === "review" || gate.human_approval_required);
  const gateDecision = hasBlocked ? "review" : hasReview ? "review" : "allow";
  const gateStatus = gateDecision === "allow" ? "passed" : "review_required";
  return buildGateRecord({
    promptGuard,
    gateType: "tool_gate",
    source_record_ids: agentToolGates.map((gate) => gate.agent_run_tool_gate_id).filter(Boolean),
    gateDecision,
    gateStatus,
    humanReviewRequired: gateDecision !== "allow",
    source_statuses: agentToolGates.map((gate) => gate.gate_status).filter(Boolean),
    reason_codes: [
      agentToolGates.length > 0 ? "agent_run_tool_gates_resolved" : "agent_run_tool_gate_missing",
      hasBlocked ? "source_tool_gate_denial_held_for_review" : hasReview ? "tool_permission_requires_human_review" : "tool_permissions_prechecked",
    ],
    generatedAt,
    metadata: {
      agent_run_tool_gate_count: agentToolGates.length,
      requested_tool_count: sum(agentToolGates.map((gate) => gate.requested_tool_count ?? 0)),
      forbidden_tool_count: sum(agentToolGates.map((gate) => gate.forbidden_tool_count ?? 0)),
      approval_required_tool_count: sum(agentToolGates.map((gate) => gate.approval_required_tool_count ?? 0)),
    },
  });
}

function buildBudgetGateRecord(context) {
  const { promptGuard, budgetDecisions, generatedAt } = context;
  const hasBlocked = budgetDecisions.some((decision) => decision.budget_status === "blocked");
  const hasMissing = budgetDecisions.length === 0;
  const gateDecision = hasBlocked || hasMissing ? "review" : "allow";
  const gateStatus = gateDecision === "allow" ? "passed" : "review_required";
  return buildGateRecord({
    promptGuard,
    gateType: "budget_gate",
    source_record_ids: budgetDecisions.map((decision) => decision.budget_decision_id).filter(Boolean),
    gateDecision,
    gateStatus,
    humanReviewRequired: gateDecision !== "allow",
    source_statuses: budgetDecisions.map((decision) => decision.budget_status).filter(Boolean),
    reason_codes: [
      budgetDecisions.length > 0 ? "cost_budget_decisions_resolved" : "cost_budget_decision_missing",
      hasBlocked ? "budget_blocker_held_before_execution" : hasMissing ? "budget_gate_requires_manual_resolution" : "budget_precheck_passed",
    ],
    generatedAt,
    metadata: {
      budget_decision_count: budgetDecisions.length,
      max_usd: sum(budgetDecisions.map((decision) => decision.max_usd ?? 0)),
      observed_usd: sum(budgetDecisions.map((decision) => decision.observed_usd ?? 0)),
      token_tracking_pending_count: budgetDecisions.filter((decision) => decision.token_tracking_status === "pending_records").length,
    },
  });
}

function buildConflictGateRecord(context) {
  const { promptGuard, conflictResults, generatedAt } = context;
  const lawFirmScoped = promptGuard.policy_snapshot_id === "policy.default.law_firm.v1" || promptGuard.classification_floor === "P2_CLIENT_CONFIDENTIAL";
  const hasBlocked = conflictResults.some((result) => result.result_status === "blocked" || result.final_access_effect === "blocked");
  const hasReview = conflictResults.some((result) => result.result_status === "review_required" || result.human_review_required) || (lawFirmScoped && conflictResults.length === 0);
  const gateDecision = hasBlocked ? "review" : hasReview ? "review" : "allow";
  const gateStatus = gateDecision === "allow" ? "passed" : "review_required";
  return buildGateRecord({
    promptGuard,
    gateType: "conflict_gate",
    source_record_ids: conflictResults.map((result) => result.conflict_check_result_id).filter(Boolean),
    gateDecision,
    gateStatus,
    humanReviewRequired: gateDecision !== "allow",
    source_statuses: conflictResults.map((result) => result.result_status).filter(Boolean),
    reason_codes: [
      conflictResults.length > 0 ? "conflict_check_result_resolved" : lawFirmScoped ? "law_firm_conflict_check_result_missing" : "conflict_check_not_required_for_workspace",
      hasBlocked ? "conflict_blocker_held_before_execution" : hasReview ? "conflict_review_required_before_execution" : "conflict_precheck_passed",
    ],
    generatedAt,
    metadata: {
      conflict_check_result_count: conflictResults.length,
      conflict_signal_count: sum(conflictResults.map((result) => result.signal_count ?? 0)),
      review_signal_count: sum(conflictResults.map((result) => result.review_signal_count ?? 0)),
      block_signal_count: sum(conflictResults.map((result) => result.block_signal_count ?? 0)),
    },
  });
}

function buildGateRecord({
  promptGuard,
  gateType,
  source_record_ids,
  gateDecision,
  gateStatus,
  humanReviewRequired,
  source_statuses,
  reason_codes,
  generatedAt,
  metadata,
}) {
  const recordBase = {
    schema_version: PRE_RUN_GATE_RECORD_SCHEMA_VERSION,
    pre_run_gate_record_id: `pre-run-gate.${slugify(promptGuard.workflow_run_id)}.${gateType.replace(/_/g, "-")}`,
    pre_run_gate_framework_contract_id: PRE_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    gate_type: gateType,
    gate_stage: "pre_run",
    retrieval_request_record_id: promptGuard.retrieval_request_record_id,
    prompt_boundary_guard_id: promptGuard.prompt_boundary_guard_id,
    workflow_run_id: promptGuard.workflow_run_id,
    context_packet_v2_record_id: promptGuard.context_packet_v2_record_id,
    matter_id: promptGuard.matter_id,
    classification_floor: promptGuard.classification_floor,
    policy_snapshot_id: promptGuard.policy_snapshot_id ?? null,
    source_record_ids,
    source_statuses,
    pre_run_gate_decision: gateDecision,
    pre_run_gate_status: gateStatus,
    execution_allowed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: humanReviewRequired,
    required_before_execution: true,
    reason_codes: unique(reason_codes.filter(Boolean)),
    recorded_at: generatedAt,
    metadata,
  };
  return {
    ...recordBase,
    pre_run_gate_hash: hashValue(recordBase),
  };
}

function buildPreRunGateDecisionRecord(promptGuard, gateRecords, generatedAt) {
  const blockedCount = gateRecords.filter((record) => record.pre_run_gate_status === "blocked").length;
  const reviewCount = gateRecords.filter((record) => record.pre_run_gate_status === "review_required").length;
  const decision = blockedCount > 0 ? "blocked_before_execution" : reviewCount > 0 ? "hold_for_human_review" : "ready_after_pre_run_gates";
  const decisionBase = {
    schema_version: PRE_RUN_GATE_DECISION_SCHEMA_VERSION,
    pre_run_gate_decision_record_id: `pre-run-gate-decision.${slugify(promptGuard.workflow_run_id)}`,
    pre_run_gate_framework_contract_id: PRE_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    workflow_run_id: promptGuard.workflow_run_id,
    retrieval_request_record_id: promptGuard.retrieval_request_record_id,
    prompt_boundary_guard_id: promptGuard.prompt_boundary_guard_id,
    matter_id: promptGuard.matter_id,
    classification_floor: promptGuard.classification_floor,
    required_gate_types: REQUIRED_GATE_TYPES,
    resolved_gate_types: unique(gateRecords.map((record) => record.gate_type)),
    pre_run_gate_record_ids: gateRecords.map((record) => record.pre_run_gate_record_id),
    pre_run_gate_decision: decision,
    pre_run_gate_set_status: blockedCount > 0 ? "blocked" : reviewCount > 0 ? "review_required" : "passed",
    passed_gate_count: gateRecords.filter((record) => record.pre_run_gate_status === "passed").length,
    review_required_gate_count: reviewCount,
    blocked_gate_count: blockedCount,
    execution_allowed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: true,
    pre_run_only: true,
    decided_at: generatedAt,
  };
  return {
    ...decisionBase,
    pre_run_gate_decision_hash: hashValue(decisionBase),
  };
}

function buildPreRunGateGuardRecord(promptGuard, gateRecords, decisionRecord, generatedAt) {
  const missingGateTypes = REQUIRED_GATE_TYPES.filter((gateType) => !gateRecords.some((record) => record.gate_type === gateType));
  const guardBase = {
    schema_version: PRE_RUN_GATE_GUARD_SCHEMA_VERSION,
    pre_run_gate_guard_record_id: `pre-run-gate-guard.${slugify(promptGuard.workflow_run_id)}`,
    pre_run_gate_framework_contract_id: PRE_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    workflow_run_id: promptGuard.workflow_run_id,
    retrieval_request_record_id: promptGuard.retrieval_request_record_id,
    prompt_boundary_guard_id: promptGuard.prompt_boundary_guard_id,
    matter_id: promptGuard.matter_id,
    classification_floor: promptGuard.classification_floor,
    pre_run_gate_decision_record_id: decisionRecord.pre_run_gate_decision_record_id,
    required_gate_types: REQUIRED_GATE_TYPES,
    missing_gate_types: missingGateTypes,
    gate_record_count: gateRecords.length,
    access_gate_status: gateRecords.find((record) => record.gate_type === "access_gate")?.pre_run_gate_status ?? "missing",
    model_gate_status: gateRecords.find((record) => record.gate_type === "model_gate")?.pre_run_gate_status ?? "missing",
    tool_gate_status: gateRecords.find((record) => record.gate_type === "tool_gate")?.pre_run_gate_status ?? "missing",
    budget_gate_status: gateRecords.find((record) => record.gate_type === "budget_gate")?.pre_run_gate_status ?? "missing",
    conflict_gate_status: gateRecords.find((record) => record.gate_type === "conflict_gate")?.pre_run_gate_status ?? "missing",
    pre_run_guard_status: missingGateTypes.length === 0 && gateRecords.every((record) => record.pre_run_gate_status !== "blocked") ? "passed" : "blocked",
    pre_run_gate_set_status: decisionRecord.pre_run_gate_set_status,
    execution_allowed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: true,
    recorded_at: generatedAt,
  };
  return {
    ...guardBase,
    pre_run_gate_guard_hash: hashValue(guardBase),
  };
}

function validateWorkflowPreRunGateFramework({
  workflowPromptInjectionBoundary,
  matterAccessPolicyEvaluator,
  modelPolicyEnforcement,
  toolRuntimePolicyEnforcement,
  costBudgetLedger,
  conflictCheckInterface,
  packageJson,
  roadmapText,
  buildResult,
}) {
  const items = [];
  const promptBoundaryGuards = workflowPromptInjectionBoundary.prompt_boundary_guard_records ?? [];
  const gateRecords = buildResult.preRunGateRecords;
  const decisionRecords = buildResult.preRunGateDecisionRecords;
  const guardRecords = buildResult.preRunGateGuardRecords;
  const promptGuardIds = new Set(promptBoundaryGuards.map((guard) => guard.prompt_boundary_guard_id));
  const gatePromptGuardIds = new Set(gateRecords.map((record) => record.prompt_boundary_guard_id));
  const gatesByRun = groupBy(gateRecords, "workflow_run_id");

  pushCheck(items, "source.workflow_prompt_injection_boundary", "workflow_prompt_injection_boundary_complete", workflowPromptInjectionBoundary.summary?.workflow_prompt_injection_boundary_status === "complete" && workflowPromptInjectionBoundary.validation?.valid !== false, "Workflow prompt injection boundary must be complete.");
  pushCheck(items, "source.matter_access_policy_evaluator", "matter_access_policy_complete", matterAccessPolicyEvaluator.summary?.access_policy_status === "complete" && matterAccessPolicyEvaluator.validation?.valid !== false, "Matter access policy evaluator must be complete.");
  pushCheck(items, "source.model_policy_enforcement", "model_policy_complete", modelPolicyEnforcement.summary?.model_policy_enforcement_status === "complete" && modelPolicyEnforcement.validation?.valid !== false, "Model policy enforcement must be complete.");
  pushCheck(items, "source.tool_runtime_policy_enforcement", "tool_runtime_policy_complete", toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status === "complete" && toolRuntimePolicyEnforcement.validation?.valid !== false, "Tool/runtime policy enforcement must be complete.");
  pushCheck(items, "source.cost_budget_ledger", "cost_budget_complete", (costBudgetLedger.ledger_status === "valid" || costBudgetLedger.summary?.validation_error_count === 0) && costBudgetLedger.validation?.valid !== false, "Cost budget ledger must be valid.");
  pushCheck(items, "source.conflict_check_interface", "conflict_check_complete", conflictCheckInterface.summary?.conflict_check_interface_status === "complete" && conflictCheckInterface.validation?.valid !== false, "Conflict check interface must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:pre-run-gates"]), "package.json must expose npm run workflows:pre-run-gates.");
  pushCheck(items, "roadmap.phase_187", "phase_187_documented", roadmapText.includes("P187") && roadmapText.includes("pre-run gate"), "Phase ledger must keep the P187 pre-run gate slot visible.");
  pushCheck(items, "pre_run_gate_records", "five_gates_per_prompt_boundary_guard", gateRecords.length === promptBoundaryGuards.length * REQUIRED_GATE_TYPES.length && [...promptGuardIds].every((guardId) => gatePromptGuardIds.has(guardId)), "Every prompt boundary guard must have five pre-run gate records.");
  pushCheck(items, "pre_run_gate_records", "required_gate_set_complete", promptBoundaryGuards.every((guard) => sameSet((gatesByRun.get(guard.workflow_run_id) ?? []).map((record) => record.gate_type), REQUIRED_GATE_TYPES)), "Each workflow run must have access, model, tool, budget, and conflict gates.");
  pushCheck(items, "pre_run_gate_records", "gates_prevent_execution", gateRecords.every((record) => !record.execution_allowed && !record.external_transfer_allowed && !record.protected_action_execution_allowed), "Pre-run gate records must not allow execution, external transfer, or protected action.");
  pushCheck(items, "pre_run_gate_decision_records", "decision_per_prompt_boundary_guard", decisionRecords.length === promptBoundaryGuards.length, "Every prompt boundary guard must have one pre-run decision record.");
  pushCheck(items, "pre_run_gate_decision_records", "decisions_pre_run_only", decisionRecords.every((record) => record.pre_run_only && !record.execution_allowed && !record.external_transfer_allowed && !record.protected_action_execution_allowed), "Pre-run decisions must remain pre-run only and non-executable.");
  pushCheck(items, "pre_run_gate_guard_records", "guard_per_prompt_boundary_guard", guardRecords.length === promptBoundaryGuards.length, "Every prompt boundary guard must have one pre-run guard record.");
  pushCheck(items, "pre_run_gate_guard_records", "guards_pass_required_gate_presence", guardRecords.every((record) => record.missing_gate_types.length === 0 && record.pre_run_guard_status === "passed"), "Pre-run guards must pass required gate presence checks.");
  pushCheck(items, "pre_run_gate_guard_records", "guards_human_reviewed", guardRecords.every((record) => record.human_review_required && !record.execution_allowed && !record.external_transfer_allowed && !record.protected_action_execution_allowed), "Pre-run guards must require human review and avoid direct execution.");
  return items;
}

function summarizeWorkflowPreRunGateFramework({
  workflowPromptInjectionBoundary,
  matterAccessPolicyEvaluator,
  modelPolicyEnforcement,
  toolRuntimePolicyEnforcement,
  costBudgetLedger,
  conflictCheckInterface,
  buildResult,
  validation,
  validationItems,
}) {
  const gateRecords = buildResult.preRunGateRecords;
  const decisionRecords = buildResult.preRunGateDecisionRecords;
  const guardRecords = buildResult.preRunGateGuardRecords;
  const gateTypeCounts = countByObject(gateRecords, "gate_type");
  return {
    workflow_pre_run_gate_framework_status: validation.errors.length === 0 ? "complete" : "blocked",
    pre_run_gate_framework_contract_id: PRE_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    source_workflow_prompt_injection_boundary_status: workflowPromptInjectionBoundary.summary?.workflow_prompt_injection_boundary_status ?? "unknown",
    source_matter_access_policy_status: matterAccessPolicyEvaluator.summary?.access_policy_status ?? "unknown",
    source_model_policy_enforcement_status: modelPolicyEnforcement.summary?.model_policy_enforcement_status ?? "unknown",
    source_tool_runtime_policy_enforcement_status: toolRuntimePolicyEnforcement.summary?.tool_runtime_policy_enforcement_status ?? "unknown",
    source_cost_budget_ledger_status: costBudgetLedger.ledger_status ?? (costBudgetLedger.summary?.validation_error_count === 0 ? "valid" : "unknown"),
    source_conflict_check_interface_status: conflictCheckInterface.summary?.conflict_check_interface_status ?? "unknown",
    source_prompt_boundary_guard_count: workflowPromptInjectionBoundary.summary?.prompt_boundary_guard_count ?? workflowPromptInjectionBoundary.prompt_boundary_guard_records?.length ?? 0,
    source_matter_access_decision_count: matterAccessPolicyEvaluator.summary?.matter_access_decision_count ?? 0,
    source_resource_access_decision_count: matterAccessPolicyEvaluator.summary?.resource_access_decision_count ?? 0,
    source_route_model_gate_count: modelPolicyEnforcement.summary?.route_model_gate_count ?? 0,
    source_agent_run_tool_gate_count: toolRuntimePolicyEnforcement.summary?.agent_run_tool_gate_count ?? 0,
    source_budget_decision_count: costBudgetLedger.summary?.budget_decision_count ?? costBudgetLedger.budget_decisions?.length ?? 0,
    source_conflict_check_result_count: conflictCheckInterface.summary?.conflict_check_result_count ?? 0,
    pre_run_gate_record_count: gateRecords.length,
    pre_run_gate_decision_count: decisionRecords.length,
    pre_run_gate_guard_count: guardRecords.length,
    workflow_run_with_gate_set_count: guardRecords.length,
    access_gate_count: gateTypeCounts.access_gate ?? 0,
    model_gate_count: gateTypeCounts.model_gate ?? 0,
    tool_gate_count: gateTypeCounts.tool_gate ?? 0,
    budget_gate_count: gateTypeCounts.budget_gate ?? 0,
    conflict_gate_count: gateTypeCounts.conflict_gate ?? 0,
    passed_gate_count: gateRecords.filter((record) => record.pre_run_gate_status === "passed").length,
    review_required_gate_count: gateRecords.filter((record) => record.pre_run_gate_status === "review_required").length,
    blocked_gate_count: gateRecords.filter((record) => record.pre_run_gate_status === "blocked").length,
    human_review_required_gate_count: gateRecords.filter((record) => record.human_review_required).length,
    all_required_gate_set_count: guardRecords.filter((record) => record.missing_gate_types.length === 0).length,
    pre_run_guard_passed_count: guardRecords.filter((record) => record.pre_run_guard_status === "passed").length,
    held_for_human_review_decision_count: decisionRecords.filter((record) => record.pre_run_gate_decision === "hold_for_human_review").length,
    ready_after_pre_run_gate_decision_count: decisionRecords.filter((record) => record.pre_run_gate_decision === "ready_after_pre_run_gates").length,
    blocked_before_execution_decision_count: decisionRecords.filter((record) => record.pre_run_gate_decision === "blocked_before_execution").length,
    execution_allowed_count: gateRecords.filter((record) => record.execution_allowed).length + decisionRecords.filter((record) => record.execution_allowed).length + guardRecords.filter((record) => record.execution_allowed).length,
    external_transfer_allowed_count: gateRecords.filter((record) => record.external_transfer_allowed).length + decisionRecords.filter((record) => record.external_transfer_allowed).length + guardRecords.filter((record) => record.external_transfer_allowed).length,
    protected_action_executed_count: gateRecords.filter((record) => record.protected_action_execution_allowed).length + decisionRecords.filter((record) => record.protected_action_execution_allowed).length + guardRecords.filter((record) => record.protected_action_execution_allowed).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_gate_type: gateTypeCounts,
    by_pre_run_gate_status: countByObject(gateRecords, "pre_run_gate_status"),
    by_pre_run_gate_decision: countByObject(decisionRecords, "pre_run_gate_decision"),
    by_pre_run_guard_status: countByObject(guardRecords, "pre_run_guard_status"),
  };
}

function buildPreRunGateFrameworkContract(generatedAt) {
  return {
    schema_version: "workflow-pre-run-gate-framework-contract.v1",
    generated_at: generatedAt,
    pre_run_gate_framework_contract_id: PRE_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    pre_run_gate_record_schema_version: PRE_RUN_GATE_RECORD_SCHEMA_VERSION,
    pre_run_gate_decision_schema_version: PRE_RUN_GATE_DECISION_SCHEMA_VERSION,
    pre_run_gate_guard_schema_version: PRE_RUN_GATE_GUARD_SCHEMA_VERSION,
    required_gate_types: REQUIRED_GATE_TYPES,
    execution_rule: "pre-run gates judge access, model, tool, budget, and conflict controls before execution and never execute tools, transfers, or protected actions.",
    law_firm_safety_rule: "client-confidential or law-firm scoped workflow runs remain human-review gated before execution.",
    prompt_boundary_rule: "pre-run gate sets are built only after prompt injection boundary guards have wrapped retrieval content as untrusted evidence.",
  };
}

function renderWorkflowPreRunGateFrameworkMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Pre-run Gate Framework");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_pre_run_gate_framework_status}`);
  lines.push("");
  lines.push(`- Gate records: ${summary.pre_run_gate_record_count}`);
  lines.push(`- Gate sets: ${summary.workflow_run_with_gate_set_count}`);
  lines.push(`- Review-required gates: ${summary.review_required_gate_count}`);
  lines.push(`- Held decisions: ${summary.held_for_human_review_decision_count}`);
  lines.push(`- Execution/external/protected allowed: ${summary.execution_allowed_count}/${summary.external_transfer_allowed_count}/${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Gate Sets");
  lines.push("");
  for (const guard of result.pre_run_gate_guard_records) {
    lines.push(`- ${guard.pre_run_gate_guard_record_id}: ${guard.pre_run_guard_status}, set=${guard.pre_run_gate_set_status}, gates=${guard.gate_record_count}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    workflow_prompt_injection_boundary_path: path.resolve(options.workflowPromptInjectionBoundaryPath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.workflowPromptInjectionBoundaryPath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.matterAccessPolicyEvaluatorPath),
    model_policy_enforcement_path: path.resolve(options.modelPolicyEnforcementPath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.modelPolicyEnforcementPath),
    tool_runtime_policy_enforcement_path: path.resolve(options.toolRuntimePolicyEnforcementPath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.toolRuntimePolicyEnforcementPath),
    cost_budget_ledger_path: path.resolve(options.costBudgetLedgerPath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.costBudgetLedgerPath),
    conflict_check_interface_path: path.resolve(options.conflictCheckInterfacePath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.conflictCheckInterfacePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowPromptInjectionBoundaryPath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.workflowPromptInjectionBoundaryPath,
    matterAccessPolicyEvaluatorPath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.matterAccessPolicyEvaluatorPath,
    modelPolicyEnforcementPath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.modelPolicyEnforcementPath,
    toolRuntimePolicyEnforcementPath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.toolRuntimePolicyEnforcementPath,
    costBudgetLedgerPath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.costBudgetLedgerPath,
    conflictCheckInterfacePath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.conflictCheckInterfacePath,
    packagePath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_PRE_RUN_GATE_FRAMEWORK_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-prompt-injection-boundary") parsed.workflowPromptInjectionBoundaryPath = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--model-policy") parsed.modelPolicyEnforcementPath = argv[++index];
    else if (arg === "--tool-runtime-policy") parsed.toolRuntimePolicyEnforcementPath = argv[++index];
    else if (arg === "--cost-budget") parsed.costBudgetLedgerPath = argv[++index];
    else if (arg === "--conflict-check") parsed.conflictCheckInterfacePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-pre-run-gate-framework.mjs [options]

Options:
  --workflow-prompt-injection-boundary <path> workflow-prompt-injection-boundary.json path.
  --matter-access-policy <path> matter-access-policy-evaluator.json path.
  --model-policy <path> model-policy-enforcement.json path.
  --tool-runtime-policy <path> tool-runtime-policy-enforcement.json path.
  --cost-budget <path> cost-budget-ledger.json path.
  --conflict-check <path> conflict-check-interface.json path.
  --package <path> package.json path.
  --roadmap <path> final completion phase ledger path.
  --out-dir <path> output directory.
  --run-at <iso> deterministic generated_at timestamp.
  --check validate only without writing artifacts.
`);
}

function serializablePreRunGateFramework(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sourceSummary(artifact, statusKey) {
  return {
    schema_version: artifact.schema_version ?? null,
    generated_at: artifact.generated_at ?? null,
    status: artifact.summary?.[statusKey] ?? artifact.ledger_status ?? (artifact.validation?.valid === true ? "complete" : "unknown"),
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
  };
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items ?? []) {
    const groupKey = item?.[key];
    if (groupKey == null) continue;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  }
  return groups;
}

function countByObject(items, key) {
  const counts = {};
  for (const item of items ?? []) {
    const value = item?.[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null))];
}

function sameSet(actual, expected) {
  const actualSet = new Set(actual);
  return actualSet.size === expected.length && expected.every((value) => actualSet.has(value));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}
