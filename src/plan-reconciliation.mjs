import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PLAN_RECONCILIATION_OUT_DIR = "artifacts/plan-reconciliation/latest";
export const DEFAULT_PLAN_RECONCILIATION_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  planRequestContractPath: "artifacts/plan-request-contract/latest/plan-request-contract.json",
};

const CONTRACT_ID = "plan-reconciliation.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "plan_request_contract_reconciled_into_human_gated_scope_candidate";
const DESKTOP_SURFACE_POLICY = "read_only_reconciliation_surface";

export async function runPlanReconciliation(options = {}) {
  const result = await buildPlanReconciliation(options);
  if (options.write !== false) await writePlanReconciliation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Plan reconciliation validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlanReconciliation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLAN_RECONCILIATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const planRequestContract = await readJsonOrError(inputs.plan_request_contract_path);
  const sourceArtifact = planRequestContract.value ?? {};
  const sharedContext = sourceArtifact.shared_planning_context ?? {};
  const planRequests = sourceArtifact.plan_requests ?? [];
  const planCandidates = buildPlanCandidates({ planRequests, sharedContext, generatedAt });
  const commonalities = buildPlanCommonalities({ planCandidates, sharedContext, generatedAt });
  const conflicts = buildPlanConflicts({ planCandidates, sharedContext, generatedAt });
  const selectedScope = buildSelectedScope({ planCandidates, commonalities, conflicts, sharedContext, generatedAt });
  const unresolvedQuestions = buildUnresolvedQuestions({ selectedScope, sharedContext, generatedAt });
  const desktopBoundary = buildDesktopBoundary({ planCandidates, selectedScope, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    planRequestContract: sourceArtifact,
    planRequestError: planRequestContract.error,
    sharedContext,
    planRequests,
    planCandidates,
    commonalities,
    conflicts,
    selectedScope,
    unresolvedQuestions,
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
  const summary = summarizePlanReconciliation({
    planRequestContract: sourceArtifact,
    sharedContext,
    planRequests,
    planCandidates,
    commonalities,
    conflicts,
    selectedScope,
    unresolvedQuestions,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    plan_reconciliation_id: `plan-reconciliation.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    plan_reconciliation_status: summary.plan_reconciliation_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, planRequestContract }),
    plan_reconciliation_contract: buildContract(generatedAt),
    source_plan_request_contract: buildSourcePlanRequestContract(sourceArtifact),
    shared_planning_context: sharedContext,
    plan_candidates: planCandidates,
    plan_commonalities: commonalities,
    plan_conflicts: conflicts,
    selected_plan_scope: selectedScope,
    unresolved_plan_questions: unresolvedQuestions,
    plan_reconciliation_desktop_boundary: desktopBoundary,
    plan_reconciliation_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderPlanReconciliationMarkdown(result),
  };
}

export async function writePlanReconciliation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePlanReconciliation(result);
  await writeJson(path.join(outDir, "plan-reconciliation.json"), serializable);
  await writeJson(path.join(outDir, "plan-candidates.json"), {
    schema_version: "plan-candidates.v1",
    generated_at: result.generated_at,
    plan_candidate_count: result.plan_candidates.length,
    plan_candidates: result.plan_candidates,
  });
  await writeJson(path.join(outDir, "plan-commonalities.json"), {
    schema_version: "plan-commonalities.v1",
    generated_at: result.generated_at,
    plan_commonality_count: result.plan_commonalities.length,
    plan_commonalities: result.plan_commonalities,
  });
  await writeJson(path.join(outDir, "plan-conflicts.json"), {
    schema_version: "plan-conflicts.v1",
    generated_at: result.generated_at,
    plan_conflict_count: result.plan_conflicts.length,
    plan_conflicts: result.plan_conflicts,
  });
  await writeJson(path.join(outDir, "selected-plan-scope.json"), {
    schema_version: "selected-plan-scope-artifact.v1",
    generated_at: result.generated_at,
    selected_plan_scope: result.selected_plan_scope,
  });
  await writeJson(path.join(outDir, "unresolved-plan-questions.json"), {
    schema_version: "unresolved-plan-questions.v1",
    generated_at: result.generated_at,
    unresolved_question_count: result.unresolved_plan_questions.length,
    unresolved_plan_questions: result.unresolved_plan_questions,
  });
  await writeJson(path.join(outDir, "plan-reconciliation-desktop-boundary.json"), {
    schema_version: "plan-reconciliation-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    plan_reconciliation_desktop_boundary: result.plan_reconciliation_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "plan-reconciliation-validation-report.v1",
    generated_at: result.generated_at,
    plan_reconciliation_id: result.plan_reconciliation_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlanReconciliationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlanReconciliation(args);
    console.log(`Plan reconciliation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.plan_reconciliation_status}`);
    console.log(`Plan candidates: ${result.summary.plan_candidate_count}`);
    console.log(`Commonalities: ${result.summary.commonality_count}`);
    console.log(`Conflicts: ${result.summary.conflict_count}`);
    console.log(`Unresolved questions: ${result.summary.unresolved_question_count}`);
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
    schema_version: "plan-reconciliation-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    reconciliation_rule: "claude_code_and_codex_plan_candidates_are_compared_against_one_shared_context_and_constraints_hash",
    conflict_rule: "scope_or_execution_conflicts_must_be_recorded_with_resolution_status_before_scope_freeze",
    selected_scope_rule: "selected_scope_is_a_human_gated_candidate_and_is_not_a_scope_freeze_or_plan_acceptance",
    unresolved_question_rule: "open_questions_are_recorded_without_blocking_the_read_only_reconciliation_artifact",
    desktop_companion_rule: "desktop_companion_reads_reconciliation_candidates_conflicts_scope_questions_and_validation_only",
    mutation_policy: "agent_invocation_plan_acceptance_scope_freeze_worktree_creation_and_task_state_mutation_require_follow_on_human_gated_phases",
    created_at: generatedAt,
  };
}

function buildSourcePlanRequestContract(sourceArtifact) {
  return {
    schema_version: "source-plan-request-contract.v1",
    plan_request_contract_id: sourceArtifact.plan_request_contract_id ?? null,
    plan_request_status: sourceArtifact.summary?.plan_request_status ?? sourceArtifact.plan_request_status ?? "unknown",
    shared_context_id: sourceArtifact.shared_planning_context?.shared_context_id ?? null,
    context_hash: sourceArtifact.shared_planning_context?.context_hash ?? null,
    constraints_hash: sourceArtifact.shared_planning_context?.constraints_hash ?? null,
    plan_request_count: sourceArtifact.plan_requests?.length ?? 0,
    source_hash: hashObject({
      plan_request_contract_id: sourceArtifact.plan_request_contract_id ?? null,
      shared_context_id: sourceArtifact.shared_planning_context?.shared_context_id ?? null,
      context_hash: sourceArtifact.shared_planning_context?.context_hash ?? null,
      constraints_hash: sourceArtifact.shared_planning_context?.constraints_hash ?? null,
      plan_requests: sourceArtifact.plan_requests ?? [],
    }),
  };
}

function buildPlanCandidates({ planRequests, sharedContext, generatedAt }) {
  return planRequests.map((request) => {
    const isClaude = request.agent === "claude_code";
    const candidate = {
      schema_version: "plan-candidate.v1",
      plan_candidate_id: `plan-candidate.${request.agent}.${slugify(request.source_normalized_task_id ?? request.plan_request_id)}`,
      source_plan_request_id: request.plan_request_id,
      source_request_hash: request.request_hash,
      agent: request.agent,
      runtime_id: request.runtime_id,
      candidate_status: "ready_for_reconciliation",
      candidate_origin: "deterministic_local_candidate_from_plan_request",
      shared_context_id: request.shared_context_id,
      source_normalized_task_id: request.source_normalized_task_id ?? sharedContext.source_normalized_task_id ?? null,
      context_hash: request.context_hash,
      constraints_hash: request.constraints_hash,
      plan_depth: isClaude ? "review_first_contract_plan" : "implementation_first_patch_plan",
      scope_summary: isClaude
        ? "Review the plan request contract, policy constraints, and human gates before implementation scope is frozen."
        : "Implement the deterministic reconciliation artifact, expose it through validation, dashboard, API, and tests, then leave scope freeze to the next gate.",
      scope_items: isClaude
        ? ["reconciliation_contract_shape", "conflict_and_commonality_review", "human_gate_alignment", "test_coverage_expectations"]
        : ["reconciliation_module_and_cli", "schema_and_golden_fixture", "dashboard_and_api_surface", "control_plane_checkpoint_and_tests"],
      proposed_steps: isClaude
        ? [
            "Verify both plan requests share the same context and constraints.",
            "List common scope elements before selecting a candidate scope.",
            "Resolve implementation depth and file surface differences.",
            "Record unresolved questions for the scope freeze gate.",
          ]
        : [
            "Create a deterministic plan reconciliation artifact from the plan request contract.",
            "Add schema, CLI, package script, golden fixture, and validation coverage.",
            "Expose reconciliation state through dashboard stages and read-only API routes.",
            "Run canonical tests and keep merge/release approval human-gated.",
          ],
      touched_files: isClaude
        ? ["docs/implementation-roadmap.md", "docs/final-completion-phase-ledger.md", "schemas/plan-reconciliation.schema.json", "test/matter-harness.test.mjs"]
        : ["src/plan-reconciliation.mjs", "scripts/plan-reconciliation.mjs", "src/review-dashboard.mjs", "src/review-api.mjs", "src/control-plane-goal-checkpoint.mjs"],
      tests: ["npm run personal-dev:plan-reconciliation -- --check", "npm run contracts:golden-fixtures -- --check", "npm test"],
      risks: isClaude
        ? ["treating_request_records_as_accepted_plans", "freezing_scope_before_human_review"]
        : ["missing_dashboard_or_api_projection", "forgetting_checkpoint_and_loop_integration"],
      human_review_needs: ["scope_freeze_gate", "diff_review_gate", "human_merge_approval_gate"],
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      command_execution_performed: false,
      created_at: generatedAt,
    };
    return {
      ...candidate,
      candidate_hash: hashObject(candidate),
    };
  });
}

function buildPlanCommonalities({ planCandidates, sharedContext, generatedAt }) {
  const agents = planCandidates.map((candidate) => candidate.agent);
  const commonItems = [
    ["shared_context", "Both candidate plans are bound to one shared planning context.", sharedContext.shared_context_id],
    ["constraint_hash", "Both candidate plans preserve the same constraints hash.", sharedContext.constraints_hash],
    ["human_gates", "Both candidate plans require scope freeze, diff review, canonical tests, and human merge approval.", "human_gated_delivery"],
    ["no_agent_execution", "Both candidate plans record no external agent invocation or command execution.", "read_only_reconciliation"],
    ["draft_only_output", "Both candidate plans keep legal/client-facing and merge/release outputs behind human review.", "draft_only"],
  ];
  return commonItems.map(([kind, description, evidence], index) => ({
    schema_version: "plan-commonality.v1",
    commonality_id: `plan-commonality.${kind}`,
    commonality_status: "accepted",
    commonality_kind: kind,
    evidence_agents: agents,
    evidence_value: evidence ?? null,
    description,
    created_at: generatedAt,
    sequence: index + 1,
  }));
}

function buildPlanConflicts({ planCandidates, sharedContext, generatedAt }) {
  const byAgent = new Map(planCandidates.map((candidate) => [candidate.agent, candidate]));
  const claude = byAgent.get("claude_code") ?? {};
  const codex = byAgent.get("codex") ?? {};
  return [
    {
      schema_version: "plan-conflict.v1",
      conflict_id: `plan-conflict.implementation-depth.${slugify(sharedContext.source_normalized_task_id)}`,
      conflict_status: "resolved",
      conflict_kind: "implementation_depth",
      claude_code_position: claude.plan_depth ?? "unknown",
      codex_position: codex.plan_depth ?? "unknown",
      selected_resolution: "contract_first_reconciliation_with_scope_freeze_deferred",
      resolution_reason: "P218 can reconcile plan candidates and recommend scope, but P219 owns the actual scope freeze gate.",
      created_at: generatedAt,
    },
    {
      schema_version: "plan-conflict.v1",
      conflict_id: `plan-conflict.file-surface.${slugify(sharedContext.source_normalized_task_id)}`,
      conflict_status: "resolved",
      conflict_kind: "file_surface",
      claude_code_position: (claude.touched_files ?? []).join(","),
      codex_position: (codex.touched_files ?? []).join(","),
      selected_resolution: "include_artifact_schema_cli_dashboard_api_checkpoint_tests_and_docs",
      resolution_reason: "The reconciliation artifact must be contract-valid and observable before the next phase can freeze scope.",
      created_at: generatedAt,
    },
  ];
}

function buildSelectedScope({ planCandidates, commonalities, conflicts, sharedContext, generatedAt }) {
  const selected = {
    schema_version: "selected-plan-scope.v1",
    selected_scope_id: `selected-plan-scope.${slugify(sharedContext.source_normalized_task_id)}`,
    selected_scope_status: "selected_for_human_review",
    source_shared_context_id: sharedContext.shared_context_id ?? null,
    source_normalized_task_id: sharedContext.source_normalized_task_id ?? null,
    context_hash: sharedContext.context_hash ?? null,
    constraints_hash: sharedContext.constraints_hash ?? null,
    selected_from_candidate_count: planCandidates.length,
    accepted_commonality_count: commonalities.filter((item) => item.commonality_status === "accepted").length,
    resolved_conflict_count: conflicts.filter((item) => item.conflict_status === "resolved").length,
    selected_scope_items: [
      "create_plan_reconciliation_artifact",
      "record_commonalities_conflicts_selected_scope_and_unresolved_questions",
      "publish_schema_cli_golden_fixture_dashboard_api_and_checkpoint_coverage",
      "keep_scope_freeze_and_plan_acceptance_for_follow_on_human_gated_phase",
    ],
    excluded_scope_items: [
      "invoke_claude_code_or_codex_as_external_agents",
      "accept_or_execute_any_plan",
      "freeze_scope_before_phase_219",
      "mutate_issue_tracker_or_task_state",
      "produce_legal_or_client_facing_advice",
    ],
    protected_paths_requiring_human_approval: ["artifacts/**", ".github/**", ".env*", "client-confidential/**"],
    required_next_gate: "scope_freeze_gate",
    scope_freeze_performed: false,
    plan_acceptance_performed: false,
    implementation_allowed_before_scope_freeze: false,
    human_review_required: true,
    human_review_note: "Selected scope is an operational draft for human review and Phase 219 scope freeze; it is not accepted implementation authority.",
    selected_at: generatedAt,
  };
  return {
    ...selected,
    selection_hash: hashObject(selected),
  };
}

function buildUnresolvedQuestions({ selectedScope, sharedContext, generatedAt }) {
  return [
    {
      schema_version: "unresolved-plan-question.v1",
      question_id: `unresolved-plan-question.scope-freeze.${slugify(sharedContext.source_normalized_task_id)}`,
      question_status: "open_for_scope_freeze_gate",
      blocker_status: "non_blocking_for_reconciliation",
      question: "Which selected scope items should Phase 219 freeze before any worktree or implementation run is authorized?",
      related_scope_item: selectedScope.selected_scope_items[0],
      required_owner: "human_reviewer",
      created_at: generatedAt,
    },
    {
      schema_version: "unresolved-plan-question.v1",
      question_id: `unresolved-plan-question.live-agent-plan.${slugify(sharedContext.source_normalized_task_id)}`,
      question_status: "open_for_future_live_agent_workflow",
      blocker_status: "non_blocking_for_reconciliation",
      question: "Should future live Claude Code/Codex plan submissions replace the deterministic local candidate rows before implementation planning?",
      related_scope_item: "future_external_plan_submission_policy",
      required_owner: "human_reviewer",
      created_at: generatedAt,
    },
  ];
}

function buildDesktopBoundary({ planCandidates, selectedScope, generatedAt }) {
  return {
    schema_version: "plan-reconciliation-desktop-boundary.v1",
    boundary_id: "plan-reconciliation-desktop-boundary.personal-dev",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    runtime_execution_allowed: false,
    external_agent_invocation_allowed: false,
    plan_acceptance_allowed: false,
    scope_freeze_allowed: false,
    task_state_write_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    visible_collections: ["plan_candidates", "plan_commonalities", "plan_conflicts", "selected_plan_scope", "unresolved_plan_questions", "validation_items"],
    denied_actions: ["invoke_agent", "accept_plan", "freeze_scope", "create_worktree", "write_task_state", "merge_branch"],
    plan_candidate_count: planCandidates.length,
    selected_scope_status: selectedScope.selected_scope_status,
    enforced_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  planRequestContract,
  planRequestError,
  sharedContext,
  planRequests,
  planCandidates,
  commonalities,
  conflicts,
  selectedScope,
  unresolvedQuestions,
  desktopBoundary,
}) {
  const agents = new Set(planCandidates.map((candidate) => candidate.agent));
  const contextHashes = new Set(planCandidates.map((candidate) => candidate.context_hash));
  const constraintHashes = new Set(planCandidates.map((candidate) => candidate.constraints_hash));
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:plan-reconciliation"]), "package.json exposes personal-dev:plan-reconciliation."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P218") && String(roadmapText ?? "").includes("plan reconciliation"), "Final completion ledger declares P218 plan reconciliation."),
    checkpoint("plan_request_contract_available", !planRequestError && Boolean(planRequestContract?.schema_version), "Plan Request Contract artifact is available."),
    checkpoint("plan_request_contract_complete", (planRequestContract?.summary?.plan_request_status ?? planRequestContract?.plan_request_status) === "complete", "Plan Request Contract is complete before reconciliation."),
    checkpoint("shared_context_bound", Boolean(sharedContext?.shared_context_id && sharedContext?.context_hash && sharedContext?.constraints_hash), "Shared planning context is available for reconciliation."),
    checkpoint("two_plan_requests_loaded", planRequests.length === 2, "Two plan request records are loaded for reconciliation."),
    checkpoint("claude_and_codex_candidates_created", planCandidates.length === 2 && agents.has("claude_code") && agents.has("codex"), "Claude Code and Codex plan candidates are both present."),
    checkpoint("candidate_hashes_match_source_context", contextHashes.size === 1 && constraintHashes.size === 1 && planCandidates.every((candidate) => candidate.shared_context_id === sharedContext.shared_context_id), "Plan candidates share the same context and constraints."),
    checkpoint("commonalities_recorded", commonalities.length > 0 && commonalities.every((item) => item.commonality_status === "accepted"), "Plan commonalities are recorded."),
    checkpoint("conflicts_recorded_and_resolved", conflicts.length > 0 && conflicts.every((item) => item.conflict_status === "resolved"), "Plan conflicts are recorded and resolved for this phase."),
    checkpoint("selected_scope_ready_but_not_frozen", selectedScope.selected_scope_status === "selected_for_human_review" && selectedScope.scope_freeze_performed === false && selectedScope.plan_acceptance_performed === false, "Selected scope is ready for human review without freezing or accepting a plan."),
    checkpoint("unresolved_questions_recorded", unresolvedQuestions.length > 0 && unresolvedQuestions.every((item) => item.blocker_status === "non_blocking_for_reconciliation"), "Unresolved questions are recorded for follow-on gates."),
    checkpoint("no_runtime_or_external_invocation", planCandidates.every((candidate) => candidate.external_agent_invocation_performed === false && candidate.command_execution_performed === false && candidate.plan_acceptance_performed === false), "Plan reconciliation records candidates without invoking agents or accepting plans."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.runtime_execution_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot mutate reconciliation state."),
  ];
}

function summarizePlanReconciliation({
  planRequestContract,
  sharedContext,
  planRequests,
  planCandidates,
  commonalities,
  conflicts,
  selectedScope,
  unresolvedQuestions,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const complete = validation.valid;
  return {
    plan_reconciliation_status: complete ? "complete" : "blocked",
    plan_reconciliation_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_plan_request_contract_id: planRequestContract?.plan_request_contract_id ?? null,
    source_plan_request_status: planRequestContract?.summary?.plan_request_status ?? planRequestContract?.plan_request_status ?? "unknown",
    shared_context_count: sharedContext?.shared_context_id ? 1 : 0,
    shared_context_id: sharedContext?.shared_context_id ?? null,
    normalized_task_id: sharedContext?.source_normalized_task_id ?? null,
    plan_request_count: planRequests.length,
    plan_candidate_count: planCandidates.length,
    ready_plan_candidate_count: planCandidates.filter((candidate) => candidate.candidate_status === "ready_for_reconciliation").length,
    claude_plan_candidate_count: planCandidates.filter((candidate) => candidate.agent === "claude_code").length,
    codex_plan_candidate_count: planCandidates.filter((candidate) => candidate.agent === "codex").length,
    unique_context_hash_count: new Set(planCandidates.map((candidate) => candidate.context_hash)).size,
    unique_constraints_hash_count: new Set(planCandidates.map((candidate) => candidate.constraints_hash)).size,
    commonality_count: commonalities.length,
    accepted_commonality_count: commonalities.filter((item) => item.commonality_status === "accepted").length,
    conflict_count: conflicts.length,
    resolved_conflict_count: conflicts.filter((item) => item.conflict_status === "resolved").length,
    unresolved_conflict_count: conflicts.filter((item) => item.conflict_status !== "resolved").length,
    selected_scope_status: selectedScope.selected_scope_status ?? "unknown",
    selected_scope_item_count: selectedScope.selected_scope_items?.length ?? 0,
    excluded_scope_item_count: selectedScope.excluded_scope_items?.length ?? 0,
    protected_path_approval_count: selectedScope.protected_paths_requiring_human_approval?.length ?? 0,
    unresolved_question_count: unresolvedQuestions.length,
    non_blocking_unresolved_question_count: unresolvedQuestions.filter((item) => item.blocker_status === "non_blocking_for_reconciliation").length,
    external_agent_invocation_performed_count: planCandidates.filter((candidate) => candidate.external_agent_invocation_performed).length,
    plan_acceptance_performed_count: planCandidates.filter((candidate) => candidate.plan_acceptance_performed).length + (selectedScope.plan_acceptance_performed ? 1 : 0),
    scope_freeze_performed_count: selectedScope.scope_freeze_performed ? 1 : 0,
    command_execution_performed_count: planCandidates.filter((candidate) => candidate.command_execution_performed).length,
    implementation_allowed_before_scope_freeze: selectedScope.implementation_allowed_before_scope_freeze,
    human_review_required: selectedScope.human_review_required,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    desktop_external_agent_invocation_allowed: desktopBoundary.external_agent_invocation_allowed,
    desktop_plan_acceptance_allowed: desktopBoundary.plan_acceptance_allowed,
    desktop_scope_freeze_allowed: desktopBoundary.scope_freeze_allowed,
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
    by_agent: countBy(planCandidates, "agent"),
    by_candidate_status: countBy(planCandidates, "candidate_status"),
    by_conflict_status: countBy(conflicts, "conflict_status"),
    by_question_status: countBy(unresolvedQuestions, "question_status"),
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    scope_freeze_performed: false,
    protected_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, planRequestContract }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("plan_request_contract", "artifacts/plan-request-contract/latest/plan-request-contract.json", planRequestContract),
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

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "plan-reconciliation-checkpoint.v1",
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
    repo_root: options.repoRoot ?? DEFAULT_PLAN_RECONCILIATION_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_PLAN_RECONCILIATION_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_PLAN_RECONCILIATION_INPUTS.roadmapPath,
    plan_request_contract_path: path.resolve(options.planRequestContractPath ?? DEFAULT_PLAN_RECONCILIATION_INPUTS.planRequestContractPath),
  };
}

function serializablePlanReconciliation(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderPlanReconciliationMarkdown(result) {
  const lines = [];
  lines.push("# Plan Reconciliation");
  lines.push("");
  lines.push(`Status: ${result.summary.plan_reconciliation_status}`);
  lines.push(`Shared context: ${result.summary.shared_context_id}`);
  lines.push(`Plan candidates: ${result.summary.plan_candidate_count}`);
  lines.push(`Commonalities: ${result.summary.commonality_count}`);
  lines.push(`Conflicts: ${result.summary.conflict_count} (${result.summary.resolved_conflict_count} resolved)`);
  lines.push(`Selected scope: ${result.summary.selected_scope_status}`);
  lines.push(`Unresolved questions: ${result.summary.unresolved_question_count}`);
  lines.push("");
  lines.push("## Selected Scope");
  for (const scopeItem of result.selected_plan_scope.selected_scope_items ?? []) {
    lines.push(`- ${scopeItem}`);
  }
  lines.push("");
  lines.push("## Conflicts");
  for (const conflict of result.plan_conflicts) {
    lines.push(`- ${conflict.conflict_status}: ${conflict.conflict_kind} - ${conflict.selected_resolution}`);
  }
  lines.push("");
  lines.push("## Unresolved Questions");
  for (const question of result.unresolved_plan_questions) {
    lines.push(`- ${question.question_status}: ${question.question}`);
  }
  lines.push("");
  lines.push("Human review note: selected scope is a draft operational reconciliation for Phase 219 scope freeze. Human review remains required before implementation, merge, release, or any legal/client-facing output.");
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
    else if (arg === "--plan-request-contract") parsed.planRequestContractPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/plan-reconciliation.mjs [options]

Options:
  --check                          Exit non-zero when validation fails.
  --out-dir <path>                 Output directory.
  --run-at <iso>                   Fixed generation timestamp.
  --plan-request-contract <path>   plan-request-contract.json path.
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
