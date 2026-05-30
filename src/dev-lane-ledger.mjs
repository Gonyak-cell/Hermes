import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DEV_LANE_LEDGER_OUT_DIR = "artifacts/dev-lane-ledger/latest";
export const DEFAULT_DEV_LANE_LEDGER_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  scopeFreezeGatePath: "artifacts/scope-freeze-gate/latest/scope-freeze-gate.json",
  planReconciliationPath: "artifacts/plan-reconciliation/latest/plan-reconciliation.json",
  worktreeManagerV2Path: "artifacts/worktree-manager-v2/latest/worktree-manager-v2.json",
};

const CONTRACT_ID = "dev-lane-ledger.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "scope_freeze_worktree_manager_and_plan_reconciliation_lane_records";
const DESKTOP_SURFACE_POLICY = "read_only_dev_lane_surface";
const AGENT_ORDER = ["claude_code", "codex"];
const FOLLOW_ON_GATES = ["diff_review_gate", "canonical_test_gate", "protected_file_scan_gate", "human_merge_approval_gate"];

export async function runDevLaneLedger(options = {}) {
  const result = await buildDevLaneLedger(options);
  if (options.write !== false) await writeDevLaneLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Dev lane ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDevLaneLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DEV_LANE_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const scopeFreezeGate = await readJsonOrError(inputs.scope_freeze_gate_path);
  const planReconciliation = await readJsonOrError(inputs.plan_reconciliation_path);
  const worktreeManagerV2 = await readJsonOrError(inputs.worktree_manager_v2_path);
  const scopeFreezeArtifact = scopeFreezeGate.value ?? {};
  const reconciliationArtifact = planReconciliation.value ?? {};
  const worktreeArtifact = worktreeManagerV2.value ?? {};
  const selectedScope = scopeFreezeArtifact.selected_plan_scope ?? reconciliationArtifact.selected_plan_scope ?? {};
  const freezeDecision = scopeFreezeArtifact.scope_freeze_decision ?? {};
  const planCandidates = reconciliationArtifact.plan_candidates ?? [];
  const worktreePlans = worktreeArtifact.agent_worktree_plans ?? [];
  const devLanes = buildDevLanes({
    selectedScope,
    freezeDecision,
    scopeFreezeGate: scopeFreezeArtifact,
    planCandidates,
    worktreePlans,
    generatedAt,
  });
  const branchRecords = buildBranchRecords({ devLanes, generatedAt });
  const worktreeRecords = buildWorktreeRecords({ devLanes, generatedAt });
  const desktopBoundary = buildDesktopBoundary({ devLanes, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    scopeFreezeGate: scopeFreezeArtifact,
    scopeFreezeGateError: scopeFreezeGate.error,
    planReconciliation: reconciliationArtifact,
    planReconciliationError: planReconciliation.error,
    worktreeManagerV2: worktreeArtifact,
    worktreeManagerV2Error: worktreeManagerV2.error,
    selectedScope,
    freezeDecision,
    devLanes,
    branchRecords,
    worktreeRecords,
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
  const summary = summarizeDevLaneLedger({
    scopeFreezeGate: scopeFreezeArtifact,
    planReconciliation: reconciliationArtifact,
    worktreeManagerV2: worktreeArtifact,
    selectedScope,
    freezeDecision,
    devLanes,
    branchRecords,
    worktreeRecords,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    dev_lane_ledger_id: `dev-lane-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    dev_lane_ledger_status: summary.dev_lane_ledger_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, scopeFreezeGate, planReconciliation, worktreeManagerV2 }),
    dev_lane_ledger_contract: buildContract(generatedAt),
    source_scope_freeze_gate: buildSourceScopeFreezeGate(scopeFreezeArtifact),
    source_plan_reconciliation: buildSourcePlanReconciliation(reconciliationArtifact),
    source_worktree_manager_v2: buildSourceWorktreeManagerV2(worktreeArtifact),
    selected_plan_scope: selectedScope,
    source_scope_freeze_decision: freezeDecision,
    dev_lanes: devLanes,
    dev_lane_branch_records: branchRecords,
    dev_lane_worktree_records: worktreeRecords,
    dev_lane_desktop_boundary: desktopBoundary,
    dev_lane_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderDevLaneLedgerMarkdown(result),
  };
}

export async function writeDevLaneLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDevLaneLedger(result);
  await writeJson(path.join(outDir, "dev-lane-ledger.json"), serializable);
  await writeJson(path.join(outDir, "dev-lanes.json"), {
    schema_version: "dev-lanes.v1",
    generated_at: result.generated_at,
    dev_lane_count: result.dev_lanes.length,
    dev_lanes: result.dev_lanes,
  });
  await writeJson(path.join(outDir, "dev-lane-branch-records.json"), {
    schema_version: "dev-lane-branch-records.v1",
    generated_at: result.generated_at,
    branch_record_count: result.dev_lane_branch_records.length,
    dev_lane_branch_records: result.dev_lane_branch_records,
  });
  await writeJson(path.join(outDir, "dev-lane-worktree-records.json"), {
    schema_version: "dev-lane-worktree-records.v1",
    generated_at: result.generated_at,
    worktree_record_count: result.dev_lane_worktree_records.length,
    dev_lane_worktree_records: result.dev_lane_worktree_records,
  });
  await writeJson(path.join(outDir, "dev-lane-desktop-boundary.json"), {
    schema_version: "dev-lane-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    dev_lane_desktop_boundary: result.dev_lane_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "dev-lane-ledger-validation-report.v1",
    generated_at: result.generated_at,
    dev_lane_ledger_id: result.dev_lane_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDevLaneLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDevLaneLedger(args);
    console.log(`Dev lane ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.dev_lane_ledger_status}`);
    console.log(`Dev lanes: ${result.summary.dev_lane_count}`);
    console.log(`Branch records: ${result.summary.branch_record_count}`);
    console.log(`Worktree records: ${result.summary.worktree_record_count}`);
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
    schema_version: "dev-lane-ledger-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    provisioning_rule: "dev_lanes_are_recorded_only_after_scope_freeze_and_before_patch_application",
    branch_rule: "each_agent_lane_has_a_unique_branch_record_with_codex_prefix",
    worktree_rule: "each_agent_lane_has_a_unique_worktree_record_bound_to_the_frozen_scope",
    execution_rule: "ledger_creation_does_not_run_git_commands_invoke_external_agents_accept_plans_or_apply_patches",
    desktop_companion_rule: "desktop_companion_reads_dev_lane_records_boundary_and_validation_only",
    mutation_policy: "physical_worktree_creation_protected_writes_patch_merge_release_and_client_facing_outputs_remain_follow_on_human_gated_actions",
    created_at: generatedAt,
  };
}

function buildSourceScopeFreezeGate(scopeFreezeGate) {
  return {
    schema_version: "source-scope-freeze-gate.v1",
    scope_freeze_gate_id: scopeFreezeGate.scope_freeze_gate_id ?? null,
    scope_freeze_gate_status: scopeFreezeGate.summary?.scope_freeze_gate_status ?? scopeFreezeGate.scope_freeze_gate_status ?? "unknown",
    selected_scope_id: scopeFreezeGate.selected_plan_scope?.selected_scope_id ?? null,
    selected_scope_status: scopeFreezeGate.summary?.selected_scope_status ?? scopeFreezeGate.selected_plan_scope?.selected_scope_status ?? "unknown",
    frozen_scope_item_count: scopeFreezeGate.summary?.frozen_scope_item_count ?? scopeFreezeGate.frozen_scope_items?.length ?? 0,
    scope_file_boundary_count: scopeFreezeGate.summary?.scope_file_boundary_count ?? scopeFreezeGate.scope_file_boundaries?.length ?? 0,
    protected_file_rule_count: scopeFreezeGate.summary?.protected_file_rule_count ?? scopeFreezeGate.scope_protected_file_rules?.length ?? 0,
    scope_freeze_performed_count: scopeFreezeGate.summary?.scope_freeze_performed_count ?? 0,
    worktree_provisioning_allowed_after_freeze: scopeFreezeGate.summary?.worktree_provisioning_allowed_after_freeze ?? false,
    protected_file_write_allowed_without_approval: scopeFreezeGate.summary?.protected_file_write_allowed_without_approval ?? false,
    source_hash: hashObject({
      scope_freeze_gate_id: scopeFreezeGate.scope_freeze_gate_id ?? null,
      selected_plan_scope: scopeFreezeGate.selected_plan_scope ?? null,
      scope_freeze_decision: scopeFreezeGate.scope_freeze_decision ?? null,
      frozen_scope_items: scopeFreezeGate.frozen_scope_items ?? [],
    }),
  };
}

function buildSourcePlanReconciliation(planReconciliation) {
  return {
    schema_version: "source-plan-reconciliation.v1",
    plan_reconciliation_id: planReconciliation.plan_reconciliation_id ?? null,
    plan_reconciliation_status: planReconciliation.summary?.plan_reconciliation_status ?? planReconciliation.plan_reconciliation_status ?? "unknown",
    plan_candidate_count: planReconciliation.summary?.plan_candidate_count ?? planReconciliation.plan_candidates?.length ?? 0,
    ready_plan_candidate_count: planReconciliation.summary?.ready_plan_candidate_count ?? (planReconciliation.plan_candidates ?? []).filter((candidate) => candidate.candidate_status === "ready_for_reconciliation").length,
    claude_plan_candidate_count: planReconciliation.summary?.claude_plan_candidate_count ?? (planReconciliation.plan_candidates ?? []).filter((candidate) => candidate.agent === "claude_code").length,
    codex_plan_candidate_count: planReconciliation.summary?.codex_plan_candidate_count ?? (planReconciliation.plan_candidates ?? []).filter((candidate) => candidate.agent === "codex").length,
    selected_scope_status: planReconciliation.summary?.selected_scope_status ?? planReconciliation.selected_plan_scope?.selected_scope_status ?? "unknown",
    source_hash: hashObject({
      plan_reconciliation_id: planReconciliation.plan_reconciliation_id ?? null,
      selected_plan_scope: planReconciliation.selected_plan_scope ?? null,
      plan_candidates: planReconciliation.plan_candidates ?? [],
    }),
  };
}

function buildSourceWorktreeManagerV2(worktreeManagerV2) {
  return {
    schema_version: "source-worktree-manager-v2.v1",
    worktree_manager_v2_id: worktreeManagerV2.worktree_manager_v2_id ?? null,
    worktree_manager_v2_status: worktreeManagerV2.summary?.worktree_manager_v2_status ?? "unknown",
    manager_status: worktreeManagerV2.summary?.manager_status ?? worktreeManagerV2.worktree_manager_contract?.manager_status ?? "unknown",
    branch_prefix: worktreeManagerV2.summary?.branch_prefix ?? worktreeManagerV2.worktree_manager_contract?.branch_prefix ?? null,
    worktree_root: worktreeManagerV2.summary?.worktree_root ?? worktreeManagerV2.worktree_manager_contract?.worktree_root ?? null,
    agent_worktree_plan_count: worktreeManagerV2.summary?.agent_worktree_plan_count ?? worktreeManagerV2.agent_worktree_plans?.length ?? 0,
    claude_code_worktree_required: worktreeManagerV2.summary?.claude_code_worktree_required ?? false,
    codex_worktree_required: worktreeManagerV2.summary?.codex_worktree_required ?? false,
    protected_mutation_route: worktreeManagerV2.summary?.protected_mutation_route ?? worktreeManagerV2.worktree_manager_contract?.protected_mutation_route ?? "unknown",
    desktop_read_only: worktreeManagerV2.summary?.desktop_read_only ?? false,
    desktop_create_worktree_allowed: worktreeManagerV2.summary?.desktop_create_worktree_allowed ?? true,
    desktop_delete_worktree_allowed: worktreeManagerV2.summary?.desktop_delete_worktree_allowed ?? true,
    source_hash: hashObject({
      worktree_manager_v2_id: worktreeManagerV2.worktree_manager_v2_id ?? null,
      worktree_manager_contract: worktreeManagerV2.worktree_manager_contract ?? null,
      agent_worktree_plans: worktreeManagerV2.agent_worktree_plans ?? [],
    }),
  };
}

function buildDevLanes({ selectedScope, freezeDecision, scopeFreezeGate, planCandidates, worktreePlans, generatedAt }) {
  const candidateByAgent = new Map(planCandidates.map((candidate) => [candidate.agent, candidate]));
  const worktreePlanByAgent = new Map(worktreePlans.map((worktreePlan) => [normalizeAgent(worktreePlan.runtime_id), worktreePlan]));
  return AGENT_ORDER.map((agent, index) => {
    const candidate = candidateByAgent.get(agent) ?? {};
    const worktreePlan = worktreePlanByAgent.get(agent) ?? {};
    const laneRole = agent === "claude_code" ? "planner_review_lane" : "implementation_patch_lane";
    const selectedScopeId = selectedScope.selected_scope_id ?? "selected-plan-scope.unknown";
    const branchName = worktreePlan.branch_name ?? `codex/personal-dev/${agent.replaceAll("_", "-")}/${slugify(selectedScopeId)}`;
    const worktreePath = worktreePlan.worktree_path ?? `.hermes/worktrees/${branchName.replaceAll("/", "-")}`;
    const lane = {
      schema_version: "dev-lane.v1",
      dev_lane_id: `dev-lane.${slugify(agent)}.${slugify(selectedScopeId)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      agent,
      runtime_id: worktreePlan.runtime_id ?? candidate.runtime_id ?? agent,
      adapter_id: worktreePlan.adapter_id ?? null,
      lane_role: laneRole,
      lane_status: "provisioned",
      provisioning_kind: "ledger_only_after_scope_freeze",
      source_plan_candidate_id: candidate.plan_candidate_id ?? null,
      source_agent_worktree_plan_id: worktreePlan.agent_worktree_plan_id ?? null,
      source_selected_scope_id: selectedScope.selected_scope_id ?? null,
      source_scope_freeze_decision_id: freezeDecision.scope_freeze_decision_id ?? null,
      source_normalized_task_id: selectedScope.source_normalized_task_id ?? candidate.source_normalized_task_id ?? null,
      source_scope_freeze_gate_id: scopeFreezeGate.scope_freeze_gate_id ?? null,
      branch_prefix: worktreePlan.branch_prefix ?? "codex/",
      branch_name: branchName,
      worktree_root: worktreePlan.worktree_root ?? ".hermes/worktrees",
      worktree_path: worktreePath,
      branch_record_id: `dev-lane-branch-record.${slugify(agent)}.${slugify(selectedScopeId)}`,
      worktree_record_id: `dev-lane-worktree-record.${slugify(agent)}.${slugify(selectedScopeId)}`,
      branch_record_status: "created",
      worktree_record_status: "created",
      branch_materialized: false,
      worktree_materialized: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      patch_application_performed: false,
      protected_file_write_allowed_without_approval: false,
      protected_write_requires_approval: true,
      protected_mutation_route: worktreePlan.protected_mutation_route ?? "protected_action_request_only",
      protected_mutation_request_required: true,
      human_gate_required: true,
      human_review_required: true,
      source_of_truth: "harness_control_plane",
      runtime_source_of_truth: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      create_action_allowed_from_desktop: false,
      requested_isolation: worktreePlan.requested_isolation ?? "git_worktree",
      isolation_required: true,
      dirty_checkout_policy: worktreePlan.dirty_checkout_policy ?? "block",
      frozen_scope_item_count: scopeFreezeGate.summary?.frozen_scope_item_count ?? scopeFreezeGate.frozen_scope_items?.length ?? 0,
      scope_file_boundary_count: scopeFreezeGate.summary?.scope_file_boundary_count ?? scopeFreezeGate.scope_file_boundaries?.length ?? 0,
      protected_file_rule_count: scopeFreezeGate.summary?.protected_file_rule_count ?? scopeFreezeGate.scope_protected_file_rules?.length ?? 0,
      frozen_scope_item_ids: (scopeFreezeGate.frozen_scope_items ?? []).map((item) => item.frozen_scope_item_id),
      scoped_file_paths: (scopeFreezeGate.scope_file_boundaries ?? []).map((boundary) => boundary.file_path),
      required_follow_on_gates: FOLLOW_ON_GATES,
      human_review_note: "Dev lane ledger records branch/worktree lane identifiers only. Physical worktree creation, protected writes, patch application, merge, release, and legal/client-facing outputs remain human-gated.",
      provisioned_at: generatedAt,
    };
    return {
      ...lane,
      lane_hash: hashObject(lane),
    };
  });
}

function buildBranchRecords({ devLanes, generatedAt }) {
  return devLanes.map((lane) => {
    const record = {
      schema_version: "dev-lane-branch-record.v1",
      branch_record_id: lane.branch_record_id,
      dev_lane_id: lane.dev_lane_id,
      agent: lane.agent,
      branch_name: lane.branch_name,
      branch_prefix: lane.branch_prefix,
      branch_record_status: "created",
      record_kind: "ledger_branch_record",
      source_agent_worktree_plan_id: lane.source_agent_worktree_plan_id,
      source_scope_freeze_decision_id: lane.source_scope_freeze_decision_id,
      git_ref_created: false,
      git_command_executed: false,
      protected_mutation_performed: false,
      human_gate_required_for_materialization: true,
      source_of_truth: "harness_control_plane",
      recorded_at: generatedAt,
    };
    return {
      ...record,
      branch_record_hash: hashObject(record),
    };
  });
}

function buildWorktreeRecords({ devLanes, generatedAt }) {
  return devLanes.map((lane) => {
    const record = {
      schema_version: "dev-lane-worktree-record.v1",
      worktree_record_id: lane.worktree_record_id,
      dev_lane_id: lane.dev_lane_id,
      agent: lane.agent,
      worktree_root: lane.worktree_root,
      worktree_path: lane.worktree_path,
      branch_name: lane.branch_name,
      worktree_record_status: "created",
      record_kind: "ledger_worktree_record",
      source_agent_worktree_plan_id: lane.source_agent_worktree_plan_id,
      source_scope_freeze_decision_id: lane.source_scope_freeze_decision_id,
      filesystem_path_created: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      human_gate_required_for_materialization: true,
      source_of_truth: "harness_control_plane",
      recorded_at: generatedAt,
    };
    return {
      ...record,
      worktree_record_hash: hashObject(record),
    };
  });
}

function buildDesktopBoundary({ devLanes, generatedAt }) {
  return {
    schema_version: "dev-lane-desktop-boundary.v1",
    boundary_id: "dev-lane-desktop-boundary.personal-dev",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    create_worktree_allowed: false,
    delete_worktree_allowed: false,
    delete_branch_allowed: false,
    cleanup_allowed: false,
    runtime_execution_allowed: false,
    external_agent_invocation_allowed: false,
    plan_acceptance_allowed: false,
    patch_application_allowed: false,
    protected_file_write_allowed: false,
    protected_file_rule_edit_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    visible_collections: ["dev_lanes", "dev_lane_branch_records", "dev_lane_worktree_records", "dev_lane_desktop_boundary", "validation_items"],
    denied_actions: ["create_worktree", "delete_worktree", "delete_branch", "invoke_agent", "accept_plan", "apply_patch", "write_protected_file", "merge_branch"],
    dev_lane_count: devLanes.length,
    enforced_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  scopeFreezeGate,
  scopeFreezeGateError,
  planReconciliation,
  planReconciliationError,
  worktreeManagerV2,
  worktreeManagerV2Error,
  selectedScope,
  freezeDecision,
  devLanes,
  branchRecords,
  worktreeRecords,
  desktopBoundary,
}) {
  const branchNames = devLanes.map((lane) => lane.branch_name);
  const worktreePaths = devLanes.map((lane) => lane.worktree_path);
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:dev-lanes"]), "package.json exposes personal-dev:dev-lanes."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P220") && String(roadmapText ?? "").includes("worktree lane"), "Final completion ledger declares P220 worktree lane provisioning."),
    checkpoint("scope_freeze_gate_available", !scopeFreezeGateError && Boolean(scopeFreezeGate?.schema_version), "Scope Freeze Gate artifact is available."),
    checkpoint("scope_freeze_gate_complete", scopeFreezeGate?.summary?.scope_freeze_gate_status === "complete" && scopeFreezeGate?.summary?.validation_error_count === 0, "Scope Freeze Gate is complete before dev lane provisioning."),
    checkpoint("scope_freeze_allows_worktree_provisioning", scopeFreezeGate?.summary?.scope_freeze_performed_count === 1 && scopeFreezeGate?.summary?.worktree_provisioning_allowed_after_freeze === true, "Scope freeze allows follow-on worktree lane provisioning."),
    checkpoint("plan_reconciliation_available", !planReconciliationError && Boolean(planReconciliation?.schema_version), "Plan Reconciliation artifact is available."),
    checkpoint("plan_reconciliation_complete", planReconciliation?.summary?.plan_reconciliation_status === "complete", "Plan Reconciliation is complete before dev lane provisioning."),
    checkpoint("worktree_manager_v2_available", !worktreeManagerV2Error && Boolean(worktreeManagerV2?.schema_version), "Worktree Manager v2 artifact is available."),
    checkpoint("worktree_manager_v2_complete", worktreeManagerV2?.summary?.worktree_manager_v2_status === "complete" && worktreeManagerV2?.summary?.validation_error_count === 0, "Worktree Manager v2 is complete before dev lane provisioning."),
    checkpoint("selected_scope_ready", selectedScope.selected_scope_status === "selected_for_human_review" && (selectedScope.selected_scope_items?.length ?? 0) > 0, "Selected scope is bound to the dev lanes."),
    checkpoint("freeze_decision_bound", freezeDecision.decision_status === "frozen" && freezeDecision.scope_freeze_performed === true, "Frozen scope decision is bound to the dev lanes."),
    checkpoint("dev_lanes_provisioned", devLanes.length === 2 && devLanes.every((lane) => lane.lane_status === "provisioned"), "Claude Code and Codex dev lanes are provisioned as ledger records."),
    checkpoint("claude_and_codex_lanes_present", devLanes.some((lane) => lane.agent === "claude_code") && devLanes.some((lane) => lane.agent === "codex"), "Claude Code and Codex lanes are both present."),
    checkpoint("unique_branch_names", unique(branchNames).length === branchNames.length && branchNames.every((branchName) => branchName.startsWith("codex/")), "Dev lane branch names are unique and use the codex/ prefix."),
    checkpoint("unique_worktree_paths", unique(worktreePaths).length === worktreePaths.length && worktreePaths.every(Boolean), "Dev lane worktree paths are unique and declared."),
    checkpoint("branch_records_created", branchRecords.length === devLanes.length && branchRecords.every((record) => record.branch_record_status === "created" && record.git_command_executed === false), "Branch records are created without running git commands."),
    checkpoint("worktree_records_created", worktreeRecords.length === devLanes.length && worktreeRecords.every((record) => record.worktree_record_status === "created" && record.filesystem_mutation_performed === false), "Worktree records are created without filesystem mutation."),
    checkpoint("no_execution_or_mutation", devLanes.every((lane) => lane.git_command_executed === false && lane.filesystem_mutation_performed === false && lane.external_agent_invocation_performed === false && lane.plan_acceptance_performed === false && lane.patch_application_performed === false), "Dev lane ledger records provisioning without execution, plan acceptance, or patch application."),
    checkpoint("protected_writes_blocked", devLanes.every((lane) => lane.protected_file_write_allowed_without_approval === false && lane.protected_mutation_performed === false), "Protected file writes remain blocked without explicit approval."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.create_worktree_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot create worktrees."),
  ];
}

function summarizeDevLaneLedger({
  scopeFreezeGate,
  planReconciliation,
  worktreeManagerV2,
  selectedScope,
  freezeDecision,
  devLanes,
  branchRecords,
  worktreeRecords,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    dev_lane_ledger_status: validation.valid ? "complete" : "blocked",
    dev_lane_ledger_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_scope_freeze_gate_id: scopeFreezeGate.scope_freeze_gate_id ?? null,
    source_scope_freeze_gate_status: scopeFreezeGate.summary?.scope_freeze_gate_status ?? scopeFreezeGate.scope_freeze_gate_status ?? "unknown",
    source_plan_reconciliation_id: planReconciliation.plan_reconciliation_id ?? null,
    source_plan_reconciliation_status: planReconciliation.summary?.plan_reconciliation_status ?? planReconciliation.plan_reconciliation_status ?? "unknown",
    source_worktree_manager_v2_id: worktreeManagerV2.worktree_manager_v2_id ?? null,
    source_worktree_manager_v2_status: worktreeManagerV2.summary?.worktree_manager_v2_status ?? "unknown",
    selected_scope_id: selectedScope.selected_scope_id ?? null,
    selected_scope_status: selectedScope.selected_scope_status ?? "unknown",
    scope_freeze_decision_status: freezeDecision.decision_status ?? "unknown",
    scope_freeze_performed_count: scopeFreezeGate.summary?.scope_freeze_performed_count ?? 0,
    worktree_provisioning_allowed_after_freeze: scopeFreezeGate.summary?.worktree_provisioning_allowed_after_freeze ?? false,
    frozen_scope_item_count: scopeFreezeGate.summary?.frozen_scope_item_count ?? scopeFreezeGate.frozen_scope_items?.length ?? 0,
    scope_file_boundary_count: scopeFreezeGate.summary?.scope_file_boundary_count ?? scopeFreezeGate.scope_file_boundaries?.length ?? 0,
    protected_file_rule_count: scopeFreezeGate.summary?.protected_file_rule_count ?? scopeFreezeGate.scope_protected_file_rules?.length ?? 0,
    dev_lane_count: devLanes.length,
    provisioned_dev_lane_count: devLanes.filter((lane) => lane.lane_status === "provisioned").length,
    claude_code_lane_count: devLanes.filter((lane) => lane.agent === "claude_code").length,
    codex_lane_count: devLanes.filter((lane) => lane.agent === "codex").length,
    planner_review_lane_count: devLanes.filter((lane) => lane.lane_role === "planner_review_lane").length,
    implementation_patch_lane_count: devLanes.filter((lane) => lane.lane_role === "implementation_patch_lane").length,
    unique_branch_name_count: unique(devLanes.map((lane) => lane.branch_name)).length,
    unique_worktree_path_count: unique(devLanes.map((lane) => lane.worktree_path)).length,
    branch_record_count: branchRecords.length,
    created_branch_record_count: branchRecords.filter((record) => record.branch_record_status === "created").length,
    materialized_branch_count: branchRecords.filter((record) => record.git_ref_created).length,
    worktree_record_count: worktreeRecords.length,
    created_worktree_record_count: worktreeRecords.filter((record) => record.worktree_record_status === "created").length,
    materialized_worktree_count: worktreeRecords.filter((record) => record.filesystem_path_created).length,
    git_command_executed_count: devLanes.filter((lane) => lane.git_command_executed).length + branchRecords.filter((record) => record.git_command_executed).length + worktreeRecords.filter((record) => record.git_command_executed).length,
    filesystem_mutation_performed_count: devLanes.filter((lane) => lane.filesystem_mutation_performed).length + worktreeRecords.filter((record) => record.filesystem_mutation_performed).length,
    protected_file_write_allowed_without_approval: devLanes.some((lane) => lane.protected_file_write_allowed_without_approval),
    protected_mutation_performed_count: devLanes.filter((lane) => lane.protected_mutation_performed).length + branchRecords.filter((record) => record.protected_mutation_performed).length + worktreeRecords.filter((record) => record.protected_mutation_performed).length,
    external_agent_invocation_performed_count: devLanes.filter((lane) => lane.external_agent_invocation_performed).length,
    plan_acceptance_performed_count: devLanes.filter((lane) => lane.plan_acceptance_performed).length,
    patch_application_performed_count: devLanes.filter((lane) => lane.patch_application_performed).length,
    human_review_required: devLanes.every((lane) => lane.human_review_required),
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_create_worktree_allowed: desktopBoundary.create_worktree_allowed,
    desktop_delete_worktree_allowed: desktopBoundary.delete_worktree_allowed,
    desktop_delete_branch_allowed: desktopBoundary.delete_branch_allowed,
    desktop_cleanup_allowed: desktopBoundary.cleanup_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    desktop_external_agent_invocation_allowed: desktopBoundary.external_agent_invocation_allowed,
    desktop_plan_acceptance_allowed: desktopBoundary.plan_acceptance_allowed,
    desktop_patch_application_allowed: desktopBoundary.patch_application_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
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
    by_agent: countBy(devLanes, "agent"),
    by_lane_status: countBy(devLanes, "lane_status"),
    by_branch_record_status: countBy(branchRecords, "branch_record_status"),
    by_worktree_record_status: countBy(worktreeRecords, "worktree_record_status"),
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    worktree_lane_provisioning_performed: true,
    physical_worktree_creation_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    patch_application_performed: false,
    protected_mutation_performed: false,
    task_state_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, scopeFreezeGate, planReconciliation, worktreeManagerV2 }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("scope_freeze_gate", "artifacts/scope-freeze-gate/latest/scope-freeze-gate.json", scopeFreezeGate),
    sourceContract("plan_reconciliation", "artifacts/plan-reconciliation/latest/plan-reconciliation.json", planReconciliation),
    sourceContract("worktree_manager_v2", "artifacts/worktree-manager-v2/latest/worktree-manager-v2.json", worktreeManagerV2),
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
    schema_version: "dev-lane-checkpoint.v1",
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
    repo_root: options.repoRoot ?? DEFAULT_DEV_LANE_LEDGER_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_DEV_LANE_LEDGER_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_DEV_LANE_LEDGER_INPUTS.roadmapPath,
    scope_freeze_gate_path: path.resolve(options.scopeFreezeGatePath ?? DEFAULT_DEV_LANE_LEDGER_INPUTS.scopeFreezeGatePath),
    plan_reconciliation_path: path.resolve(options.planReconciliationPath ?? DEFAULT_DEV_LANE_LEDGER_INPUTS.planReconciliationPath),
    worktree_manager_v2_path: path.resolve(options.worktreeManagerV2Path ?? DEFAULT_DEV_LANE_LEDGER_INPUTS.worktreeManagerV2Path),
  };
}

function serializableDevLaneLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderDevLaneLedgerMarkdown(result) {
  const lines = [];
  lines.push("# Dev Lane Ledger");
  lines.push("");
  lines.push(`Status: ${result.summary.dev_lane_ledger_status}`);
  lines.push(`Selected scope: ${result.summary.selected_scope_id}`);
  lines.push(`Dev lanes: ${result.summary.dev_lane_count}`);
  lines.push(`Branch records: ${result.summary.branch_record_count}`);
  lines.push(`Worktree records: ${result.summary.worktree_record_count}`);
  lines.push("");
  lines.push("## Lanes");
  for (const lane of result.dev_lanes) {
    lines.push(`- ${lane.agent}: ${lane.lane_status} -> ${lane.branch_name} (${lane.worktree_path})`);
  }
  lines.push("");
  lines.push("Human review note: dev lane provisioning records branch/worktree identifiers only. Physical worktree creation, protected file writes, patch application, merge, release, and legal/client-facing outputs remain human-gated.");
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
    else if (arg === "--scope-freeze-gate") parsed.scopeFreezeGatePath = argv[++index];
    else if (arg === "--plan-reconciliation") parsed.planReconciliationPath = argv[++index];
    else if (arg === "--worktree-manager-v2") parsed.worktreeManagerV2Path = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/dev-lane-ledger.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --out-dir <path>                Output directory.
  --run-at <iso>                  Fixed generation timestamp.
  --scope-freeze-gate <path>      scope-freeze-gate.json path.
  --plan-reconciliation <path>    plan-reconciliation.json path.
  --worktree-manager-v2 <path>    worktree-manager-v2.json path.
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
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeAgent(value) {
  if (value === "claude-code") return "claude_code";
  return value;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z").replace("T", "T");
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function countBy(items, key) {
  return items.reduce((accumulator, item) => {
    const value = item[key] ?? "unknown";
    accumulator[value] = (accumulator[value] ?? 0) + 1;
    return accumulator;
  }, {});
}
