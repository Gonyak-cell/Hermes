import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SCOPE_FREEZE_GATE_OUT_DIR = "artifacts/scope-freeze-gate/latest";
export const DEFAULT_SCOPE_FREEZE_GATE_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  planReconciliationPath: "artifacts/plan-reconciliation/latest/plan-reconciliation.json",
  protectedFileGatePath: "artifacts/protected-file-gate/latest/protected-file-gate.json",
};

const CONTRACT_ID = "scope-freeze-gate.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "plan_reconciliation_selected_scope_and_protected_file_rules";
const DESKTOP_SURFACE_POLICY = "read_only_scope_freeze_surface";

export async function runScopeFreezeGate(options = {}) {
  const result = await buildScopeFreezeGate(options);
  if (options.write !== false) await writeScopeFreezeGate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Scope freeze gate validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildScopeFreezeGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SCOPE_FREEZE_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const planReconciliation = await readJsonOrError(inputs.plan_reconciliation_path);
  const protectedFileGate = await readJsonOrError(inputs.protected_file_gate_path);
  const reconciliationArtifact = planReconciliation.value ?? {};
  const protectedFileGateArtifact = protectedFileGate.value ?? {};
  const selectedScope = reconciliationArtifact.selected_plan_scope ?? {};
  const planCandidates = reconciliationArtifact.plan_candidates ?? [];
  const protectedRules = buildProtectedFileRuleSnapshot({ protectedFileGate: protectedFileGateArtifact, selectedScope, generatedAt });
  const frozenScopeItems = buildFrozenScopeItems({ selectedScope, generatedAt });
  const fileBoundaries = buildScopeFileBoundaries({ planCandidates, protectedRules, selectedScope, generatedAt });
  const freezeDecision = buildScopeFreezeDecision({
    selectedScope,
    frozenScopeItems,
    fileBoundaries,
    protectedRules,
    generatedAt,
  });
  const desktopBoundary = buildDesktopBoundary({ freezeDecision, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    planReconciliation: reconciliationArtifact,
    planReconciliationError: planReconciliation.error,
    protectedFileGate: protectedFileGateArtifact,
    protectedFileGateError: protectedFileGate.error,
    selectedScope,
    frozenScopeItems,
    fileBoundaries,
    protectedRules,
    freezeDecision,
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
  const summary = summarizeScopeFreezeGate({
    planReconciliation: reconciliationArtifact,
    protectedFileGate: protectedFileGateArtifact,
    selectedScope,
    frozenScopeItems,
    fileBoundaries,
    protectedRules,
    freezeDecision,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    scope_freeze_gate_id: `scope-freeze-gate.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    scope_freeze_gate_status: summary.scope_freeze_gate_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, planReconciliation, protectedFileGate }),
    scope_freeze_gate_contract: buildContract(generatedAt),
    source_plan_reconciliation: buildSourcePlanReconciliation(reconciliationArtifact),
    source_protected_file_gate: buildSourceProtectedFileGate(protectedFileGateArtifact),
    selected_plan_scope: selectedScope,
    frozen_scope_items: frozenScopeItems,
    scope_file_boundaries: fileBoundaries,
    scope_protected_file_rules: protectedRules,
    scope_freeze_decision: freezeDecision,
    scope_freeze_desktop_boundary: desktopBoundary,
    scope_freeze_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderScopeFreezeGateMarkdown(result),
  };
}

export async function writeScopeFreezeGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableScopeFreezeGate(result);
  await writeJson(path.join(outDir, "scope-freeze-gate.json"), serializable);
  await writeJson(path.join(outDir, "frozen-scope-items.json"), {
    schema_version: "frozen-scope-items.v1",
    generated_at: result.generated_at,
    frozen_scope_item_count: result.frozen_scope_items.length,
    frozen_scope_items: result.frozen_scope_items,
  });
  await writeJson(path.join(outDir, "scope-file-boundaries.json"), {
    schema_version: "scope-file-boundaries.v1",
    generated_at: result.generated_at,
    scope_file_boundary_count: result.scope_file_boundaries.length,
    scope_file_boundaries: result.scope_file_boundaries,
  });
  await writeJson(path.join(outDir, "scope-protected-file-rules.json"), {
    schema_version: "scope-protected-file-rules.v1",
    generated_at: result.generated_at,
    scope_protected_file_rule_count: result.scope_protected_file_rules.length,
    scope_protected_file_rules: result.scope_protected_file_rules,
  });
  await writeJson(path.join(outDir, "scope-freeze-decision.json"), {
    schema_version: "scope-freeze-decision-artifact.v1",
    generated_at: result.generated_at,
    scope_freeze_decision: result.scope_freeze_decision,
  });
  await writeJson(path.join(outDir, "scope-freeze-desktop-boundary.json"), {
    schema_version: "scope-freeze-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    scope_freeze_desktop_boundary: result.scope_freeze_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "scope-freeze-gate-validation-report.v1",
    generated_at: result.generated_at,
    scope_freeze_gate_id: result.scope_freeze_gate_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runScopeFreezeGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runScopeFreezeGate(args);
    console.log(`Scope freeze gate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.scope_freeze_gate_status}`);
    console.log(`Frozen scope items: ${result.summary.frozen_scope_item_count}`);
    console.log(`Scope file boundaries: ${result.summary.scope_file_boundary_count}`);
    console.log(`Protected file rules: ${result.summary.protected_file_rule_count}`);
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
    schema_version: "scope-freeze-gate-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    freeze_rule: "selected_plan_scope_items_file_boundaries_and_protected_file_rules_are_frozen_before_worktree_or_patch",
    protected_file_rule: "protected_paths_require_explicit_human_approval_and_are_blocked_before_approval",
    scope_change_rule: "scope_expansion_requires_new_plan_reconciliation_and_scope_freeze",
    execution_rule: "scope_freeze_records_authorized_boundaries_only_and_does_not_execute_agents_or_apply_patches",
    desktop_companion_rule: "desktop_companion_reads_scope_freeze_state_boundary_and_validation_only",
    mutation_policy: "worktree_creation_patch_application_merge_release_and_client_facing_outputs_remain_follow_on_human_gated_actions",
    created_at: generatedAt,
  };
}

function buildSourcePlanReconciliation(planReconciliation) {
  return {
    schema_version: "source-plan-reconciliation.v1",
    plan_reconciliation_id: planReconciliation.plan_reconciliation_id ?? null,
    plan_reconciliation_status: planReconciliation.summary?.plan_reconciliation_status ?? planReconciliation.plan_reconciliation_status ?? "unknown",
    selected_scope_id: planReconciliation.selected_plan_scope?.selected_scope_id ?? null,
    selected_scope_status: planReconciliation.selected_plan_scope?.selected_scope_status ?? "unknown",
    selected_scope_item_count: planReconciliation.selected_plan_scope?.selected_scope_items?.length ?? 0,
    unresolved_question_count: planReconciliation.unresolved_plan_questions?.length ?? 0,
    source_hash: hashObject({
      plan_reconciliation_id: planReconciliation.plan_reconciliation_id ?? null,
      selected_plan_scope: planReconciliation.selected_plan_scope ?? null,
      plan_candidates: planReconciliation.plan_candidates ?? [],
    }),
  };
}

function buildSourceProtectedFileGate(protectedFileGate) {
  return {
    schema_version: "source-protected-file-gate.v1",
    protected_file_gate_id: protectedFileGate.protected_file_gate_id ?? null,
    protected_file_gate_status: protectedFileGate.summary?.protected_file_gate_status ?? "unknown",
    contract_status: protectedFileGate.summary?.contract_status ?? protectedFileGate.protected_file_gate_contract?.contract_status ?? "unknown",
    protected_file_rule_count: protectedFileGate.protected_file_gate_rules?.length ?? 0,
    protected_path_write_allowed_count: protectedFileGate.summary?.protected_path_write_allowed_count ?? 0,
    write_allowed_before_approval_count: protectedFileGate.summary?.write_allowed_before_approval_count ?? 0,
    protected_action_executed_count: protectedFileGate.summary?.protected_action_executed_count ?? 0,
    source_hash: hashObject({
      protected_file_gate_id: protectedFileGate.protected_file_gate_id ?? null,
      protected_file_gate_rules: protectedFileGate.protected_file_gate_rules ?? [],
      protected_file_gate_contract: protectedFileGate.protected_file_gate_contract ?? null,
    }),
  };
}

function buildFrozenScopeItems({ selectedScope, generatedAt }) {
  return (selectedScope.selected_scope_items ?? []).map((scopeItem, index) => ({
    schema_version: "frozen-scope-item.v1",
    frozen_scope_item_id: `frozen-scope-item.${slugify(scopeItem)}`,
    source_selected_scope_id: selectedScope.selected_scope_id ?? null,
    source_normalized_task_id: selectedScope.source_normalized_task_id ?? null,
    frozen_scope_status: "frozen",
    scope_item: scopeItem,
    scope_item_sequence: index + 1,
    change_authority: "within_frozen_scope_only",
    scope_expansion_requires_new_freeze: true,
    human_review_required: true,
    frozen_at: generatedAt,
  }));
}

function buildScopeFileBoundaries({ planCandidates, protectedRules, selectedScope, generatedAt }) {
  const filePaths = unique(planCandidates.flatMap((candidate) => candidate.touched_files ?? []));
  return filePaths.map((filePath) => {
    const matchedRules = protectedRules.filter((rule) => pathMatchesRule(filePath, rule.patterns));
    const protectedFileDetected = matchedRules.length > 0;
    return {
      schema_version: "scope-file-boundary.v1",
      scope_file_boundary_id: `scope-file-boundary.${slugify(filePath)}`,
      source_selected_scope_id: selectedScope.selected_scope_id ?? null,
      file_path: filePath,
      file_boundary_status: protectedFileDetected ? "in_scope_protected_requires_approval" : "in_scope_unprotected",
      in_frozen_scope: true,
      protected_file_detected: protectedFileDetected,
      matched_rule_ids: matchedRules.map((rule) => rule.source_protected_file_gate_rule_id),
      protected_write_requires_explicit_approval: protectedFileDetected,
      write_allowed_before_approval: false,
      mutation_allowed_before_approval: false,
      diff_review_gate_required: true,
      canonical_test_gate_required: true,
      human_merge_approval_gate_required: true,
      protected_action_executed: false,
      recorded_at: generatedAt,
    };
  });
}

function buildProtectedFileRuleSnapshot({ protectedFileGate, selectedScope, generatedAt }) {
  const sourceRules = protectedFileGate.protected_file_gate_rules ?? [];
  const selectedScopeRules = (selectedScope.protected_paths_requiring_human_approval ?? []).map((pattern, index) => ({
    schema_version: "protected-file-gate-rule.v1",
    protected_file_gate_rule_id: `selected-scope-protected-rule.${index + 1}`,
    rule_type: "selected_scope_pattern",
    protected_class: "selected_scope_protected_path",
    patterns: [pattern],
    gate_decision: "block_pending_explicit_approval",
    blocking_by_default: true,
    explicit_approval_required: true,
    human_gate_required: true,
    write_allowed_before_approval: false,
    mutation_allowed_before_approval: false,
    protected_action_executed: false,
    rule_status: "locked",
  }));
  return [...sourceRules, ...selectedScopeRules].map((rule) => ({
    schema_version: "scope-protected-file-rule.v1",
    scope_protected_file_rule_id: `scope-${rule.protected_file_gate_rule_id}`,
    source_protected_file_gate_rule_id: rule.protected_file_gate_rule_id,
    source_selected_scope_id: selectedScope.selected_scope_id ?? null,
    rule_type: rule.rule_type,
    protected_class: rule.protected_class,
    patterns: rule.patterns ?? [],
    pattern_count: rule.pattern_count ?? rule.patterns?.length ?? 0,
    rule_status: "frozen",
    rule_snapshot_status: "frozen",
    gate_decision: rule.gate_decision ?? "block_pending_explicit_approval",
    blocking_by_default: true,
    explicit_approval_required: true,
    human_gate_required: true,
    write_allowed_before_approval: false,
    mutation_allowed_before_approval: false,
    protected_action_executed: false,
    frozen_at: generatedAt,
  }));
}

function buildScopeFreezeDecision({ selectedScope, frozenScopeItems, fileBoundaries, protectedRules, generatedAt }) {
  const decision = {
    schema_version: "scope-freeze-decision.v1",
    scope_freeze_decision_id: `scope-freeze-decision.${slugify(selectedScope.selected_scope_id)}`,
    source_selected_scope_id: selectedScope.selected_scope_id ?? null,
    source_normalized_task_id: selectedScope.source_normalized_task_id ?? null,
    decision_status: "frozen",
    freeze_kind: "implementation_scope_before_worktree_or_patch",
    frozen_scope_item_count: frozenScopeItems.length,
    scope_file_boundary_count: fileBoundaries.length,
    protected_file_rule_count: protectedRules.length,
    protected_file_detected_count: fileBoundaries.filter((boundary) => boundary.protected_file_detected).length,
    scope_freeze_performed: true,
    plan_acceptance_performed: false,
    external_agent_invocation_performed: false,
    command_execution_performed: false,
    task_state_mutation_performed: false,
    worktree_provisioning_allowed_after_freeze: true,
    implementation_patch_allowed_before_worktree: false,
    implementation_patch_allowed_before_diff_review: false,
    protected_write_allowed_without_explicit_approval: false,
    scope_change_requires_new_reconciliation: true,
    scope_change_requires_new_freeze: true,
    required_follow_on_gates: ["worktree_lane_provisioning", "diff_review_gate", "canonical_test_gate", "human_merge_approval_gate"],
    human_review_required: true,
    human_review_note: "Scope freeze is an operational boundary for follow-on implementation lanes; protected file changes, merge, release, and legal/client-facing outputs remain human-gated.",
    decided_at: generatedAt,
  };
  return {
    ...decision,
    decision_hash: hashObject(decision),
  };
}

function buildDesktopBoundary({ freezeDecision, generatedAt }) {
  return {
    schema_version: "scope-freeze-desktop-boundary.v1",
    boundary_id: "scope-freeze-desktop-boundary.personal-dev",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    scope_change_allowed: false,
    protected_file_rule_edit_allowed: false,
    protected_file_write_allowed: false,
    approval_bypass_allowed: false,
    runtime_execution_allowed: false,
    external_agent_invocation_allowed: false,
    plan_acceptance_allowed: false,
    task_state_write_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    visible_collections: ["frozen_scope_items", "scope_file_boundaries", "scope_protected_file_rules", "scope_freeze_decision", "validation_items"],
    denied_actions: ["change_scope", "edit_protected_file_rules", "invoke_agent", "accept_plan", "create_worktree", "apply_patch", "merge_branch"],
    scope_freeze_decision_id: freezeDecision.scope_freeze_decision_id,
    enforced_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  planReconciliation,
  planReconciliationError,
  protectedFileGate,
  protectedFileGateError,
  selectedScope,
  frozenScopeItems,
  fileBoundaries,
  protectedRules,
  freezeDecision,
  desktopBoundary,
}) {
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:scope-freeze"]), "package.json exposes personal-dev:scope-freeze."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P219") && String(roadmapText ?? "").includes("scope freeze"), "Final completion ledger declares P219 scope freeze gate."),
    checkpoint("plan_reconciliation_available", !planReconciliationError && Boolean(planReconciliation?.schema_version), "Plan Reconciliation artifact is available."),
    checkpoint("plan_reconciliation_complete", (planReconciliation?.summary?.plan_reconciliation_status ?? planReconciliation?.plan_reconciliation_status) === "complete", "Plan Reconciliation is complete before scope freeze."),
    checkpoint("selected_scope_ready", selectedScope.selected_scope_status === "selected_for_human_review" && (selectedScope.selected_scope_items?.length ?? 0) > 0, "Selected scope is ready for the freeze gate."),
    checkpoint("protected_file_gate_available", !protectedFileGateError && Boolean(protectedFileGate?.schema_version), "Protected File Gate artifact is available."),
    checkpoint("protected_file_gate_complete", protectedFileGate?.summary?.protected_file_gate_status === "complete" && protectedFileGate?.summary?.validation_error_count === 0, "Protected File Gate is complete before scope freeze."),
    checkpoint("scope_items_frozen", frozenScopeItems.length > 0 && frozenScopeItems.every((item) => item.frozen_scope_status === "frozen"), "Selected scope items are frozen."),
    checkpoint("file_boundaries_frozen", fileBoundaries.length > 0 && fileBoundaries.every((boundary) => boundary.in_frozen_scope && boundary.write_allowed_before_approval === false), "In-scope file boundaries are frozen with writes blocked before approval."),
    checkpoint("protected_rules_frozen", protectedRules.length > 0 && protectedRules.every((rule) => rule.rule_status === "frozen" && rule.explicit_approval_required && rule.write_allowed_before_approval === false), "Protected file rules are frozen and require explicit approval."),
    checkpoint("freeze_decision_recorded", freezeDecision.decision_status === "frozen" && freezeDecision.scope_freeze_performed === true && freezeDecision.plan_acceptance_performed === false, "Scope freeze decision is recorded without plan acceptance."),
    checkpoint("no_execution_or_mutation", freezeDecision.external_agent_invocation_performed === false && freezeDecision.command_execution_performed === false && freezeDecision.task_state_mutation_performed === false, "Scope freeze records boundaries without execution or task mutation."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.scope_change_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot change scope."),
  ];
}

function summarizeScopeFreezeGate({
  planReconciliation,
  protectedFileGate,
  selectedScope,
  frozenScopeItems,
  fileBoundaries,
  protectedRules,
  freezeDecision,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    scope_freeze_gate_status: validation.valid ? "complete" : "blocked",
    scope_freeze_gate_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_plan_reconciliation_id: planReconciliation?.plan_reconciliation_id ?? null,
    source_plan_reconciliation_status: planReconciliation?.summary?.plan_reconciliation_status ?? planReconciliation?.plan_reconciliation_status ?? "unknown",
    source_protected_file_gate_id: protectedFileGate?.protected_file_gate_id ?? null,
    source_protected_file_gate_status: protectedFileGate?.summary?.protected_file_gate_status ?? "unknown",
    selected_scope_id: selectedScope.selected_scope_id ?? null,
    selected_scope_status: selectedScope.selected_scope_status ?? "unknown",
    source_selected_scope_item_count: selectedScope.selected_scope_items?.length ?? 0,
    frozen_scope_item_count: frozenScopeItems.length,
    frozen_scope_item_frozen_count: frozenScopeItems.filter((item) => item.frozen_scope_status === "frozen").length,
    scope_file_boundary_count: fileBoundaries.length,
    in_scope_file_boundary_count: fileBoundaries.filter((boundary) => boundary.in_frozen_scope).length,
    protected_file_detected_count: fileBoundaries.filter((boundary) => boundary.protected_file_detected).length,
    protected_file_rule_count: protectedRules.length,
    frozen_protected_file_rule_count: protectedRules.filter((rule) => rule.rule_status === "frozen").length,
    frozen_protected_file_rule_snapshot_count: protectedRules.filter((rule) => rule.rule_snapshot_status === "frozen").length,
    protected_write_requires_approval: protectedRules.every((rule) => rule.explicit_approval_required === true),
    protected_write_requires_approval_count: protectedRules.filter((rule) => rule.explicit_approval_required).length,
    write_allowed_before_approval_count: protectedRules.filter((rule) => rule.write_allowed_before_approval).length + fileBoundaries.filter((boundary) => boundary.write_allowed_before_approval).length,
    mutation_allowed_before_approval_count: protectedRules.filter((rule) => rule.mutation_allowed_before_approval).length + fileBoundaries.filter((boundary) => boundary.mutation_allowed_before_approval).length,
    scope_freeze_decision_status: freezeDecision.decision_status,
    scope_freeze_performed_count: freezeDecision.scope_freeze_performed ? 1 : 0,
    plan_acceptance_performed_count: freezeDecision.plan_acceptance_performed ? 1 : 0,
    external_agent_invocation_performed_count: freezeDecision.external_agent_invocation_performed ? 1 : 0,
    command_execution_performed_count: freezeDecision.command_execution_performed ? 1 : 0,
    task_state_mutation_performed_count: freezeDecision.task_state_mutation_performed ? 1 : 0,
    protected_mutation_performed_count: 0,
    worktree_provisioning_allowed_after_freeze: freezeDecision.worktree_provisioning_allowed_after_freeze,
    implementation_patch_allowed_before_worktree: freezeDecision.implementation_patch_allowed_before_worktree,
    implementation_patch_allowed_before_diff_review: freezeDecision.implementation_patch_allowed_before_diff_review,
    protected_write_allowed_without_explicit_approval: freezeDecision.protected_write_allowed_without_explicit_approval,
    protected_file_write_allowed_without_approval: freezeDecision.protected_write_allowed_without_explicit_approval,
    scope_change_requires_new_reconciliation: freezeDecision.scope_change_requires_new_reconciliation,
    scope_change_requires_new_freeze: freezeDecision.scope_change_requires_new_freeze,
    human_review_required: freezeDecision.human_review_required,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_scope_change_allowed: desktopBoundary.scope_change_allowed,
    desktop_protected_file_rule_edit_allowed: desktopBoundary.protected_file_rule_edit_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
    desktop_approval_bypass_allowed: desktopBoundary.approval_bypass_allowed,
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
    by_file_boundary_status: countBy(fileBoundaries, "file_boundary_status"),
    by_rule_status: countBy(protectedRules, "rule_status"),
    by_rule_snapshot_status: countBy(protectedRules, "rule_snapshot_status"),
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    external_agent_invocation_performed: false,
    scope_freeze_performed: true,
    plan_acceptance_performed: false,
    protected_mutation_performed: false,
    task_state_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, planReconciliation, protectedFileGate }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("plan_reconciliation", "artifacts/plan-reconciliation/latest/plan-reconciliation.json", planReconciliation),
    sourceContract("protected_file_gate", "artifacts/protected-file-gate/latest/protected-file-gate.json", protectedFileGate),
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
    schema_version: "scope-freeze-checkpoint.v1",
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
    repo_root: options.repoRoot ?? DEFAULT_SCOPE_FREEZE_GATE_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_SCOPE_FREEZE_GATE_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_SCOPE_FREEZE_GATE_INPUTS.roadmapPath,
    plan_reconciliation_path: path.resolve(options.planReconciliationPath ?? DEFAULT_SCOPE_FREEZE_GATE_INPUTS.planReconciliationPath),
    protected_file_gate_path: path.resolve(options.protectedFileGatePath ?? DEFAULT_SCOPE_FREEZE_GATE_INPUTS.protectedFileGatePath),
  };
}

function serializableScopeFreezeGate(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderScopeFreezeGateMarkdown(result) {
  const lines = [];
  lines.push("# Scope Freeze Gate");
  lines.push("");
  lines.push(`Status: ${result.summary.scope_freeze_gate_status}`);
  lines.push(`Selected scope: ${result.summary.selected_scope_id}`);
  lines.push(`Frozen scope items: ${result.summary.frozen_scope_item_count}`);
  lines.push(`Scope file boundaries: ${result.summary.scope_file_boundary_count}`);
  lines.push(`Protected rules: ${result.summary.protected_file_rule_count}`);
  lines.push(`Scope freeze performed: ${result.summary.scope_freeze_performed_count}`);
  lines.push("");
  lines.push("## Frozen Scope");
  for (const item of result.frozen_scope_items) {
    lines.push(`- ${item.frozen_scope_status}: ${item.scope_item}`);
  }
  lines.push("");
  lines.push("## File Boundaries");
  for (const boundary of result.scope_file_boundaries) {
    lines.push(`- ${boundary.file_boundary_status}: ${boundary.file_path}`);
  }
  lines.push("");
  lines.push("Human review note: scope freeze is an operational boundary only. Protected file writes, patch application, merge, release, and legal/client-facing outputs remain human-gated.");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--plan-reconciliation") parsed.planReconciliationPath = argv[++index];
    else if (arg === "--protected-file-gate") parsed.protectedFileGatePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/scope-freeze-gate.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --out-dir <path>                Output directory.
  --run-at <iso>                  Fixed generation timestamp.
  --plan-reconciliation <path>    plan-reconciliation.json path.
  --protected-file-gate <path>    protected-file-gate.json path.
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

function pathMatchesRule(filePath, patterns = []) {
  const normalized = normalizePath(filePath);
  return patterns.some((pattern) => patternMatches(normalized, normalizePath(pattern)));
}

function patternMatches(filePath, pattern) {
  if (!pattern) return false;
  if (pattern === filePath) return true;
  if (pattern.endsWith("/**")) return filePath.startsWith(pattern.slice(0, -3));
  if (pattern.startsWith("**/*")) return filePath.includes(pattern.slice(4).replace(/\*/g, ""));
  if (pattern.startsWith("**/")) return filePath.endsWith(pattern.slice(3));
  if (pattern.includes("*")) {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, ".*").replace(/\*/g, "[^/]*");
    return new RegExp(`^${escaped}$`).test(filePath);
  }
  return filePath === pattern;
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
