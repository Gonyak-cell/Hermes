import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PLAN_REQUEST_CONTRACT_OUT_DIR = "artifacts/plan-request-contract/latest";
export const DEFAULT_PLAN_REQUEST_CONTRACT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  issueIntakeAdapterPath: "artifacts/issue-intake-adapter/latest/issue-intake-adapter.json",
  repoProfileDetectorPath: "artifacts/repo-profile-detector/latest/repo-profile-detector.json",
  agentInstructionRegistryPath: "artifacts/agent-instruction-registry/latest/agent-instruction-registry.json",
};

const CONTRACT_ID = "plan-request-contract.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "shared_context_plan_requests_for_claude_and_codex";
const DESKTOP_SURFACE_POLICY = "read_only_operator_surface";

export async function runPlanRequestContract(options = {}) {
  const result = await buildPlanRequestContract(options);
  if (options.write !== false) await writePlanRequestContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Plan request contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlanRequestContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLAN_REQUEST_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const issueIntakeAdapter = await readJsonOrError(inputs.issue_intake_adapter_path);
  const repoProfileDetector = await readJsonOrError(inputs.repo_profile_detector_path);
  const agentInstructionRegistry = await readJsonOrError(inputs.agent_instruction_registry_path);
  const task = selectNormalizedTask(issueIntakeAdapter.value);
  const sharedContext = buildSharedPlanningContext({
    task,
    issueIntakeAdapter: issueIntakeAdapter.value,
    repoProfileDetector: repoProfileDetector.value,
    agentInstructionRegistry: agentInstructionRegistry.value,
    generatedAt,
  });
  const planRequests = buildPlanRequests({ task, sharedContext, generatedAt });
  const planRequestBindings = buildPlanRequestBindings({ planRequests, sharedContext, generatedAt });
  const desktopBoundary = buildDesktopBoundary({ planRequests, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    issueIntakeAdapter: issueIntakeAdapter.value,
    repoProfileDetector: repoProfileDetector.value,
    agentInstructionRegistry: agentInstructionRegistry.value,
    sharedContext,
    planRequests,
    planRequestBindings,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizePlanRequestContract({
    issueIntakeAdapter: issueIntakeAdapter.value,
    repoProfileDetector: repoProfileDetector.value,
    agentInstructionRegistry: agentInstructionRegistry.value,
    sharedContext,
    planRequests,
    planRequestBindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    plan_request_contract_id: `plan-request-contract.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    plan_request_status: summary.plan_request_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, issueIntakeAdapter, repoProfileDetector, agentInstructionRegistry }),
    plan_request_contract: buildContract(generatedAt),
    shared_planning_context: sharedContext,
    plan_requests: planRequests,
    plan_request_bindings: planRequestBindings,
    plan_request_desktop_boundary: desktopBoundary,
    plan_request_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderPlanRequestContractMarkdown(result),
  };
}

export async function writePlanRequestContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePlanRequestContract(result);
  await writeJson(path.join(outDir, "plan-request-contract.json"), serializable);
  await writeJson(path.join(outDir, "shared-planning-context.json"), {
    schema_version: "shared-planning-context-artifact.v1",
    generated_at: result.generated_at,
    shared_planning_context: result.shared_planning_context,
  });
  await writeJson(path.join(outDir, "plan-requests.json"), {
    schema_version: "plan-requests.v1",
    generated_at: result.generated_at,
    plan_request_count: result.plan_requests.length,
    plan_requests: result.plan_requests,
  });
  await writeJson(path.join(outDir, "plan-request-bindings.json"), {
    schema_version: "plan-request-bindings.v1",
    generated_at: result.generated_at,
    plan_request_binding_count: result.plan_request_bindings.length,
    plan_request_bindings: result.plan_request_bindings,
  });
  await writeJson(path.join(outDir, "plan-request-desktop-boundary.json"), {
    schema_version: "plan-request-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    plan_request_desktop_boundary: result.plan_request_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "plan-request-contract-validation-report.v1",
    generated_at: result.generated_at,
    plan_request_contract_id: result.plan_request_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlanRequestContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlanRequestContract(args);
    console.log(`Plan request contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.plan_request_status}`);
    console.log(`Plan requests: ${result.summary.plan_request_count}`);
    console.log(`Shared context: ${result.summary.shared_context_count}`);
    console.log(`External agent invocations performed: ${result.summary.external_agent_invocation_performed_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "plan-request-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    shared_context_rule: "claude_code_and_codex_plan_requests_must_reference_one_shared_planning_context",
    constraint_rule: "both_plan_requests_must_use_the_same_scope_constraints_policy_snapshot_and_human_gate_requirements",
    execution_rule: "this_artifact_records_plan_requests_only_and_does_not_invoke_external_agents_or_accept_plans",
    desktop_companion_rule: "desktop_companion_reads_plan_request_context_binding_and_boundary_status_only",
    mutation_policy: "plan_acceptance_scope_freeze_worktree_creation_and_task_state_mutation_require_follow_on_human_gated_phases",
    created_at: generatedAt,
  };
}

function buildSharedPlanningContext({ task, issueIntakeAdapter, repoProfileDetector, agentInstructionRegistry, generatedAt }) {
  const repoSummary = repoProfileDetector?.summary ?? {};
  const instructionSummary = agentInstructionRegistry?.summary ?? {};
  const normalizedTaskId = task.normalized_task_id ?? task.task_contract_id ?? task.task_id;
  const taskTitle = task.title ?? task.task_title ?? "Untitled task";
  const context = {
    schema_version: "shared-planning-context.v1",
    shared_context_id: `shared-planning-context.${slugify(task.task_id)}`,
    source_issue_intake_adapter_id: issueIntakeAdapter?.issue_intake_adapter_id ?? null,
    source_normalized_task_id: normalizedTaskId,
    capability_id: task.capability_id ?? CAPABILITY_ID,
    pack_id: PACK_ID,
    repository_id: task.repository_id ?? task.repo_profile_id ?? repoSummary.repository_id ?? "repo.hermes",
    repository_path: task.repository_path ?? task.repository ?? repoSummary.repository_path ?? "repository.current",
    primary_language: repoSummary.primary_language ?? "javascript",
    framework_profile: repoSummary.primary_framework ?? "node-esm",
    instruction_registry_id: agentInstructionRegistry?.agent_instruction_registry_id ?? null,
    instruction_version_count: instructionSummary.locked_instruction_version_count ?? 0,
    task_snapshot: {
      task_id: task.task_id,
      title: taskTitle,
      task_status: task.task_status,
      task_priority: task.task_priority,
      source_issue_id: task.source_issue_id,
      source_system: task.source_system,
      labels: task.labels ?? [],
    },
    required_outputs: ["claude_plan_request", "codex_plan_request", "plan_reconciliation_input"],
    required_gates: ["scope_freeze_gate", "diff_review_gate", "canonical_test_gate", "human_merge_approval_gate"],
    constraints: [
      "keep_changes_within_selected_task_scope",
      "do_not_write_protected_paths_without_human_approval",
      "do_not_execute_external_agents_in_plan_request_contract",
      "keep_all_outputs_draft_until_human_review",
      "preserve_personal_dev_and_law_firm_workspace_boundaries",
    ],
    human_review_note: "Plan requests are operational coordination artifacts only; implementation, merge, release, and legal/client-facing outputs remain human-gated.",
    created_at: generatedAt,
  };
  return {
    ...context,
    context_hash: hashObject(context),
    constraints_hash: hashObject({ constraints: context.constraints, required_gates: context.required_gates }),
  };
}

function buildPlanRequests({ task, sharedContext, generatedAt }) {
  return [
    planRequest({
      runtimeId: "runtime.claude_code.default",
      agent: "claude_code",
      requestedRole: "planner_reviewer",
      task,
      sharedContext,
      generatedAt,
    }),
    planRequest({
      runtimeId: "runtime.codex.default",
      agent: "codex",
      requestedRole: "implementation_planner",
      task,
      sharedContext,
      generatedAt,
    }),
  ];
}

function planRequest({ runtimeId, agent, requestedRole, task, sharedContext, generatedAt }) {
  const request = {
    schema_version: "plan-request.v1",
    plan_request_id: `plan-request.${agent}.${slugify(task.task_id)}`,
    runtime_id: runtimeId,
    agent,
    requested_role: requestedRole,
    request_status: "ready",
    shared_context_id: sharedContext.shared_context_id,
    context_hash: sharedContext.context_hash,
    constraints_hash: sharedContext.constraints_hash,
    source_normalized_task_id: sharedContext.source_normalized_task_id,
    source_issue_id: task.source_issue_id,
    capability_id: sharedContext.capability_id,
    requested_plan_shape: {
      schema_version: "requested-plan-shape.v1",
      required_sections: ["scope_summary", "proposed_steps", "touched_files", "tests", "risks", "human_review_needs"],
      forbidden_sections: ["final_merge_instruction", "client_advice", "legal_conclusion"],
      output_state: "draft_plan_only",
    },
    policy_constraints: sharedContext.constraints,
    human_review_required: true,
    external_agent_invocation_allowed: false,
    external_agent_invocation_performed: false,
    plan_acceptance_allowed: false,
    plan_acceptance_performed: false,
    command_execution_performed: false,
    created_at: generatedAt,
  };
  return {
    ...request,
    request_hash: hashObject(request),
  };
}

function buildPlanRequestBindings({ planRequests, sharedContext, generatedAt }) {
  return planRequests.map((request) => ({
    schema_version: "plan-request-binding.v1",
    binding_id: `plan-request-binding.${request.agent}.${slugify(sharedContext.source_normalized_task_id)}`,
    plan_request_id: request.plan_request_id,
    shared_context_id: sharedContext.shared_context_id,
    source_normalized_task_id: sharedContext.source_normalized_task_id,
    runtime_id: request.runtime_id,
    binding_status: "bound",
    context_hash_matches: request.context_hash === sharedContext.context_hash,
    constraints_hash_matches: request.constraints_hash === sharedContext.constraints_hash,
    created_at: generatedAt,
  }));
}

function buildDesktopBoundary({ planRequests, generatedAt }) {
  return {
    schema_version: "plan-request-desktop-boundary.v1",
    boundary_id: "plan-request-desktop-boundary.personal-dev",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    runtime_execution_allowed: false,
    external_agent_invocation_allowed: false,
    plan_acceptance_allowed: false,
    task_state_write_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    visible_collections: ["shared_planning_context", "plan_requests", "plan_request_bindings", "validation_items"],
    denied_actions: ["invoke_agent", "accept_plan", "freeze_scope", "create_worktree", "write_task_state", "merge_branch"],
    plan_request_count: planRequests.length,
    enforced_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  issueIntakeAdapter,
  repoProfileDetector,
  agentInstructionRegistry,
  sharedContext,
  planRequests,
  planRequestBindings,
  desktopBoundary,
}) {
  const agents = new Set(planRequests.map((request) => request.agent));
  const contextHashes = new Set(planRequests.map((request) => request.context_hash));
  const constraintHashes = new Set(planRequests.map((request) => request.constraints_hash));
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:plan-request"]), "package.json exposes personal-dev:plan-request."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P217") && String(roadmapText ?? "").includes("plan request"), "Final completion ledger declares P217 plan request contract."),
    checkpoint("issue_intake_complete", issueIntakeAdapter?.summary?.issue_intake_status === "complete", "Issue Intake Adapter is complete before plan requests are emitted."),
    checkpoint("repo_profile_complete", repoProfileDetector?.summary?.repo_profile_detector_status === "complete", "Repo Profile Detector is complete before plan requests are emitted."),
    checkpoint("instruction_registry_complete", agentInstructionRegistry?.summary?.agent_instruction_registry_status === "complete", "Agent Instruction Registry is complete before plan requests are emitted."),
    checkpoint("shared_context_created", Boolean(sharedContext?.shared_context_id && sharedContext?.context_hash && sharedContext?.constraints_hash), "Shared planning context has stable context and constraint hashes."),
    checkpoint("claude_and_codex_requests_created", planRequests.length === 2 && agents.has("claude_code") && agents.has("codex"), "Claude Code and Codex plan request records are both present."),
    checkpoint("requests_share_context_and_constraints", contextHashes.size === 1 && constraintHashes.size === 1 && planRequests.every((request) => request.shared_context_id === sharedContext.shared_context_id), "Both requests use the same shared context and constraints."),
    checkpoint("bindings_complete", planRequestBindings.length === planRequests.length && planRequestBindings.every((binding) => binding.binding_status === "bound" && binding.context_hash_matches && binding.constraints_hash_matches), "Every request is bound to the shared context and task."),
    checkpoint("no_runtime_or_external_invocation", planRequests.every((request) => request.external_agent_invocation_performed === false && request.command_execution_performed === false && request.plan_acceptance_performed === false), "Plan request contract records requests without invoking agents or accepting plans."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.runtime_execution_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot mutate plan state."),
  ];
}

function summarizePlanRequestContract({
  issueIntakeAdapter,
  repoProfileDetector,
  agentInstructionRegistry,
  sharedContext,
  planRequests,
  planRequestBindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const complete = validation.valid;
  return {
    plan_request_status: complete ? "complete" : "blocked",
    plan_request_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    issue_intake_status: issueIntakeAdapter?.summary?.issue_intake_status ?? "unknown",
    repo_profile_detector_status: repoProfileDetector?.summary?.repo_profile_detector_status ?? "unknown",
    agent_instruction_registry_status: agentInstructionRegistry?.summary?.agent_instruction_registry_status ?? "unknown",
    shared_context_count: sharedContext ? 1 : 0,
    shared_context_id: sharedContext?.shared_context_id ?? null,
    normalized_task_id: sharedContext?.source_normalized_task_id ?? null,
    plan_request_count: planRequests.length,
    ready_plan_request_count: planRequests.filter((request) => request.request_status === "ready").length,
    claude_plan_request_count: planRequests.filter((request) => request.agent === "claude_code").length,
    codex_plan_request_count: planRequests.filter((request) => request.agent === "codex").length,
    unique_context_hash_count: new Set(planRequests.map((request) => request.context_hash)).size,
    unique_constraints_hash_count: new Set(planRequests.map((request) => request.constraints_hash)).size,
    shared_context_binding_count: planRequestBindings.length,
    bound_plan_request_count: planRequestBindings.filter((binding) => binding.binding_status === "bound").length,
    unbound_plan_request_count: planRequestBindings.filter((binding) => binding.binding_status !== "bound").length,
    context_hash_mismatch_count: planRequestBindings.filter((binding) => !binding.context_hash_matches).length,
    constraints_hash_mismatch_count: planRequestBindings.filter((binding) => !binding.constraints_hash_matches).length,
    external_agent_invocation_allowed_count: planRequests.filter((request) => request.external_agent_invocation_allowed).length,
    external_agent_invocation_performed_count: planRequests.filter((request) => request.external_agent_invocation_performed).length,
    plan_acceptance_performed_count: planRequests.filter((request) => request.plan_acceptance_performed).length,
    command_execution_performed_count: planRequests.filter((request) => request.command_execution_performed).length,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    desktop_external_agent_invocation_allowed: desktopBoundary.external_agent_invocation_allowed,
    desktop_plan_acceptance_allowed: desktopBoundary.plan_acceptance_allowed,
    desktop_task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    raw_secret_material_exposed: desktopBoundary.raw_secret_material_exposed,
    provider_key_exposed: desktopBoundary.provider_key_exposed,
    installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    ssh_or_cron_control: desktopBoundary.ssh_or_cron_control,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_agent: countBy(planRequests, "agent"),
    by_request_status: countBy(planRequests, "request_status"),
    by_binding_status: countBy(planRequestBindings, "binding_status"),
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    external_agent_invocation_performed: false,
    protected_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, issueIntakeAdapter, repoProfileDetector, agentInstructionRegistry }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("issue_intake_adapter", "artifacts/issue-intake-adapter/latest/issue-intake-adapter.json", issueIntakeAdapter),
    sourceContract("repo_profile_detector", "artifacts/repo-profile-detector/latest/repo-profile-detector.json", repoProfileDetector),
    sourceContract("agent_instruction_registry", "artifacts/agent-instruction-registry/latest/agent-instruction-registry.json", agentInstructionRegistry),
  ];
}

function sourceContract(sourceId, sourcePath, result) {
  const available = !result?.error;
  const value = result?.value ?? result;
  return {
    source_id: sourceId,
    source_path: sourcePath,
    available,
    source_status: available ? "available" : "missing",
    source_schema_version: value?.schema_version ?? null,
    source_hash: available ? hashObject(value) : null,
    error: result?.error ?? null,
  };
}

function selectNormalizedTask(issueIntakeAdapter) {
  const tasks = issueIntakeAdapter?.normalized_task_contracts ?? [];
  const ready = tasks.find((task) => ["ready", "ready_for_workflow"].includes(task.normalized_task_status) || task.task_status === "in-progress");
  if (ready) return ready;
  if (tasks[0]) return tasks[0];
  return {
    normalized_task_id: "normalized-task.missing",
    task_id: "TASK-MISSING",
    title: "Missing normalized task",
    task_status: "next",
    task_priority: "p1",
    source_issue_id: "missing",
    source_system: "unknown",
    labels: [],
    capability_id: CAPABILITY_ID,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "plan-request-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_PLAN_REQUEST_CONTRACT_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_PLAN_REQUEST_CONTRACT_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_PLAN_REQUEST_CONTRACT_INPUTS.roadmapPath,
    issue_intake_adapter_path: path.resolve(options.issueIntakeAdapterPath ?? DEFAULT_PLAN_REQUEST_CONTRACT_INPUTS.issueIntakeAdapterPath),
    repo_profile_detector_path: path.resolve(options.repoProfileDetectorPath ?? DEFAULT_PLAN_REQUEST_CONTRACT_INPUTS.repoProfileDetectorPath),
    agent_instruction_registry_path: path.resolve(options.agentInstructionRegistryPath ?? DEFAULT_PLAN_REQUEST_CONTRACT_INPUTS.agentInstructionRegistryPath),
  };
}

function serializablePlanRequestContract(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderPlanRequestContractMarkdown(result) {
  const lines = [];
  lines.push("# Plan Request Contract");
  lines.push("");
  lines.push(`Status: ${result.summary.plan_request_status}`);
  lines.push(`Shared context: ${result.summary.shared_context_id}`);
  lines.push(`Plan requests: ${result.summary.plan_request_count}`);
  lines.push(`External agent invocations performed: ${result.summary.external_agent_invocation_performed_count}`);
  lines.push("");
  lines.push("## Requests");
  for (const request of result.plan_requests) {
    lines.push(`- ${request.agent}: ${request.request_status}, context=${request.shared_context_id}, constraints=${request.constraints_hash}`);
  }
  lines.push("");
  lines.push("## Desktop Boundary");
  lines.push(`- Read-only: ${result.plan_request_desktop_boundary.read_only}`);
  lines.push(`- Runtime execution allowed: ${result.plan_request_desktop_boundary.runtime_execution_allowed}`);
  lines.push(`- Plan acceptance allowed: ${result.plan_request_desktop_boundary.plan_acceptance_allowed}`);
  lines.push("");
  lines.push("## Checkpoints");
  for (const checkpointItem of result.plan_request_checkpoints) {
    lines.push(`- ${checkpointItem.status}: ${checkpointItem.checkpoint_id} - ${checkpointItem.message}`);
  }
  lines.push("");
  lines.push("Human review note: plan requests are draft operational coordination records. Human review remains required before implementation, merge, release, or any legal/client-facing output.");
  return `${lines.join("\n")}\n`;
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
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--issue-intake-adapter") parsed.issueIntakeAdapterPath = argv[++index];
    else if (arg === "--repo-profile-detector") parsed.repoProfileDetectorPath = argv[++index];
    else if (arg === "--agent-instruction-registry") parsed.agentInstructionRegistryPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/plan-request-contract.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --out-dir <path>                Output directory.
  --run-at <iso>                  Fixed generation timestamp.
  --issue-intake-adapter <path>   issue-intake-adapter.json path.
  --repo-profile-detector <path>  repo-profile-detector.json path.
  --agent-instruction-registry <path>
                                  agent-instruction-registry.json path.
`);
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8") };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashObject(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}
