import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PERSONAL_DEV_E2E_FREEZE_OUT_DIR = "artifacts/personal-dev-e2e-freeze/latest";
export const DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  personalDevPackManifestPath: "artifacts/personal-dev-pack-manifest/latest/personal-dev-pack-manifest.json",
  repoProfileDetectorPath: "artifacts/repo-profile-detector/latest/repo-profile-detector.json",
  agentInstructionRegistryPath: "artifacts/agent-instruction-registry/latest/agent-instruction-registry.json",
  issueIntakeAdapterPath: "artifacts/issue-intake-adapter/latest/issue-intake-adapter.json",
  planRequestContractPath: "artifacts/plan-request-contract/latest/plan-request-contract.json",
  planReconciliationPath: "artifacts/plan-reconciliation/latest/plan-reconciliation.json",
  scopeFreezeGatePath: "artifacts/scope-freeze-gate/latest/scope-freeze-gate.json",
  devLaneLedgerPath: "artifacts/dev-lane-ledger/latest/dev-lane-ledger.json",
  implementationPatchCapturePath: "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json",
  diffReviewGatePath: "artifacts/diff-review-gate/latest/diff-review-gate.json",
  canonicalTestMatrixPath: "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json",
  devProtectedScanPath: "artifacts/dev-protected-scan/latest/dev-protected-scan.json",
  prDraftArtifactPath: "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json",
  releaseNoteArtifactPath: "artifacts/release-note-artifact/latest/release-note-artifact.json",
  rollbackPlanArtifactPath: "artifacts/rollback-plan-artifact/latest/rollback-plan-artifact.json",
  technicalDebtLedgerPath: "artifacts/technical-debt-ledger/latest/technical-debt-ledger.json",
  personalDevDashboardApiPath: "artifacts/personal-dev-dashboard-api/latest/personal-dev-dashboard-api.json",
};

const CONTRACT_ID = "personal-dev-e2e-freeze.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const FREEZE_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "personal_dev_phase_artifacts_e2e_freeze_report";
const DESKTOP_SURFACE_POLICY = "read_only_personal_dev_e2e_freeze_surface";

const SOURCE_DEFINITIONS = [
  sourceDefinition("personal_dev_pack_manifest", "Personal Dev Pack Manifest", "P213", "personalDevPackManifestPath", "personal-dev:pack-manifest", "personal_dev_pack_manifest_status", "personal_dev_pack_manifest_id"),
  sourceDefinition("repo_profile_detector", "Repo Profile Detector", "P214", "repoProfileDetectorPath", "personal-dev:repo-profile", "repo_profile_detector_status", "repo_profile_detector_id"),
  sourceDefinition("agent_instruction_registry", "Agent Instruction Registry", "P215", "agentInstructionRegistryPath", "personal-dev:instructions", "agent_instruction_registry_status", "agent_instruction_registry_id"),
  sourceDefinition("issue_intake_adapter", "Issue Intake Adapter", "P216", "issueIntakeAdapterPath", "personal-dev:issue-intake", "issue_intake_status", "issue_intake_adapter_id"),
  sourceDefinition("plan_request_contract", "Plan Request Contract", "P217", "planRequestContractPath", "personal-dev:plan-request", "plan_request_status", "plan_request_contract_id"),
  sourceDefinition("plan_reconciliation", "Plan Reconciliation", "P218", "planReconciliationPath", "personal-dev:plan-reconciliation", "plan_reconciliation_status", "plan_reconciliation_id"),
  sourceDefinition("scope_freeze_gate", "Scope Freeze Gate", "P219", "scopeFreezeGatePath", "personal-dev:scope-freeze", "scope_freeze_gate_status", "scope_freeze_gate_id"),
  sourceDefinition("dev_lane_ledger", "Dev Lane Ledger", "P220", "devLaneLedgerPath", "personal-dev:dev-lanes", "dev_lane_ledger_status", "dev_lane_ledger_id"),
  sourceDefinition("implementation_patch_capture", "Implementation Patch Capture", "P221", "implementationPatchCapturePath", "personal-dev:patch-capture", "implementation_patch_capture_status", "implementation_patch_capture_id"),
  sourceDefinition("diff_review_gate", "Diff Review Gate", "P222", "diffReviewGatePath", "personal-dev:diff-review", "diff_review_gate_status", "diff_review_gate_id"),
  sourceDefinition("canonical_test_matrix", "Canonical Test Matrix", "P223", "canonicalTestMatrixPath", "personal-dev:test-matrix", "canonical_test_matrix_status", "canonical_test_matrix_id"),
  sourceDefinition("dev_protected_scan", "Dev Protected Scan", "P224", "devProtectedScanPath", "personal-dev:protected-scan", "dev_protected_scan_status", "dev_protected_scan_id"),
  sourceDefinition("pr_draft_artifact", "PR Draft Artifact", "P225", "prDraftArtifactPath", "personal-dev:pr-draft", "pr_draft_artifact_status", "pr_draft_artifact_id"),
  sourceDefinition("release_note_artifact", "Release Note Artifact", "P226", "releaseNoteArtifactPath", "personal-dev:release-note", "release_note_artifact_status", "release_note_artifact_id"),
  sourceDefinition("rollback_plan_artifact", "Rollback Plan Artifact", "P227", "rollbackPlanArtifactPath", "personal-dev:rollback-plan", "rollback_plan_artifact_status", "rollback_plan_artifact_id"),
  sourceDefinition("technical_debt_ledger", "Technical Debt Ledger", "P228", "technicalDebtLedgerPath", "personal-dev:technical-debt", "technical_debt_ledger_status", "technical_debt_ledger_id"),
  sourceDefinition("personal_dev_dashboard_api", "Personal Dev Dashboard API", "P229", "personalDevDashboardApiPath", "personal-dev:dashboard-api", "personal_dev_dashboard_api_status", "personal_dev_dashboard_api_id"),
];

export async function runPersonalDevE2eFreeze(options = {}) {
  const result = await buildPersonalDevE2eFreeze(options);
  if (options.write !== false) await writePersonalDevE2eFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Personal dev E2E freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPersonalDevE2eFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const readResults = {};
  for (const definition of SOURCE_DEFINITIONS) {
    readResults[definition.source_id] = await readJsonOrError(inputs[definition.input_key]);
  }
  const artifacts = Object.fromEntries(SOURCE_DEFINITIONS.map((definition) => [
    definition.source_id,
    readResults[definition.source_id].value ?? {},
  ]));
  const freezeSources = buildFreezeSources({ artifacts, readResults, generatedAt });
  const sourceById = new Map(freezeSources.map((source) => [source.source_id, source]));
  const e2eTraces = buildE2eTraces({ artifacts, generatedAt });
  const loopBindings = buildLoopBindings({ sourceById, generatedAt, controlPlaneLoopText: controlPlaneLoopText.value });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    controlPlaneLoopText: controlPlaneLoopText.value,
    reviewDashboardText: reviewDashboardText.value,
    reviewApiText: reviewApiText.value,
    readErrors: {
      packageJson: packageJson.error,
      roadmapText: roadmapText.error,
      controlPlaneLoopText: controlPlaneLoopText.error,
      reviewDashboardText: reviewDashboardText.error,
      reviewApiText: reviewApiText.error,
    },
    artifacts,
    freezeSources,
    e2eTraces,
    loopBindings,
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
  const summary = summarizePersonalDevE2eFreeze({
    artifacts,
    freezeSources,
    e2eTraces,
    loopBindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    personal_dev_e2e_freeze_id: `personal-dev-e2e-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    personal_dev_e2e_freeze_status: summary.personal_dev_e2e_freeze_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      readResults,
    }),
    personal_dev_e2e_freeze_contract: buildContract(generatedAt),
    personal_dev_e2e_freeze_sources: freezeSources,
    personal_dev_e2e_traces: e2eTraces,
    personal_dev_e2e_loop_bindings: loopBindings,
    personal_dev_e2e_freeze_desktop_boundary: desktopBoundary,
    personal_dev_e2e_freeze_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummaryMarkdown(result),
  };
}

export async function writePersonalDevE2eFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePersonalDevE2eFreeze(result);
  await writeJson(path.join(outDir, "personal-dev-e2e-freeze.json"), serializable);
  await writeJson(path.join(outDir, "personal-dev-e2e-freeze-sources.json"), {
    schema_version: "personal-dev-e2e-freeze-sources-artifact.v1",
    generated_at: result.generated_at,
    source_count: result.personal_dev_e2e_freeze_sources.length,
    personal_dev_e2e_freeze_sources: result.personal_dev_e2e_freeze_sources,
  });
  await writeJson(path.join(outDir, "personal-dev-e2e-traces.json"), {
    schema_version: "personal-dev-e2e-traces-artifact.v1",
    generated_at: result.generated_at,
    trace_count: result.personal_dev_e2e_traces.length,
    personal_dev_e2e_traces: result.personal_dev_e2e_traces,
  });
  await writeJson(path.join(outDir, "personal-dev-e2e-loop-bindings.json"), {
    schema_version: "personal-dev-e2e-loop-bindings-artifact.v1",
    generated_at: result.generated_at,
    loop_binding_count: result.personal_dev_e2e_loop_bindings.length,
    personal_dev_e2e_loop_bindings: result.personal_dev_e2e_loop_bindings,
  });
  await writeJson(path.join(outDir, "personal-dev-e2e-freeze-checkpoints.json"), {
    schema_version: "personal-dev-e2e-freeze-checkpoints-artifact.v1",
    generated_at: result.generated_at,
    checkpoint_count: result.personal_dev_e2e_freeze_checkpoints.length,
    personal_dev_e2e_freeze_checkpoints: result.personal_dev_e2e_freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "personal-dev-e2e-freeze-desktop-boundary.json"), {
    schema_version: "personal-dev-e2e-freeze-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    personal_dev_e2e_freeze_desktop_boundary: result.personal_dev_e2e_freeze_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "personal-dev-e2e-freeze-validation-report.v1",
    generated_at: result.generated_at,
    personal_dev_e2e_freeze_id: result.personal_dev_e2e_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runPersonalDevE2eFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPersonalDevE2eFreeze(args);
    console.log(`Personal dev E2E freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.personal_dev_e2e_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
    console.log(`Traces: ${result.summary.passed_trace_count}/${result.summary.trace_count}`);
    console.log(`Loop bindings: ${result.summary.bound_loop_binding_count}/${result.summary.loop_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function sourceDefinition(sourceId, label, phase_slot, optionKey, packageScript, statusKey, artifactIdKey) {
  return {
    source_id: sourceId,
    label,
    phase_slot,
    option_key: optionKey,
    input_key: camelToSnake(optionKey),
    package_script_name: packageScript,
    status_key: statusKey,
    artifact_id_key: artifactIdKey,
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "personal-dev-e2e-freeze-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    phase_range: "P213-P230",
    source_phase_range: "P213-P229",
    next_phase_slot: "P231",
    freeze_rule: "personal_dev_issue_to_pr_path_is_complete_as_read_only_phase_artifacts_before_future_desktop_work",
    trace_rule: "issue_plan_worktree_diff_test_pr_and_dashboard_api_traces_must_pass_without_mutation_or_external_agent_execution",
    desktop_companion_rule: "desktop_companion_reads_freeze_sources_traces_loop_bindings_and_validation_only",
    human_review_rule: "issue_mutation_task_writes_commands_pr_creation_merge_release_rollback_and_client_facing_outputs_remain_human_gated",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    personal_dev_e2e_freeze_generated: true,
    source_artifact_mutation_performed: false,
    issue_mutation_performed: false,
    task_state_write_performed: false,
    command_execution_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed_outside_artifact_dir: false,
    protected_mutation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    pull_request_creation_performed: false,
    merge_performed: false,
    release_performed: false,
    rollback_execution_performed: false,
    patch_application_performed: false,
    external_agent_invocation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function buildFreezeSources({ artifacts, readResults, generatedAt }) {
  return SOURCE_DEFINITIONS.map((definition) => {
    const artifact = artifacts[definition.source_id] ?? {};
    const readResult = readResults[definition.source_id] ?? {};
    const summary = artifact.summary ?? {};
    const validationErrorCount = summary.validation_error_count ?? artifact.validation?.errors?.length ?? 0;
    const source = {
      schema_version: "personal-dev-e2e-freeze-source.v1",
      source_id: definition.source_id,
      source_label: definition.label,
      phase_slot: definition.phase_slot,
      generated_at: generatedAt,
      source_path: readResult.path ?? definition.option_key,
      package_script_name: definition.package_script_name,
      source_artifact_id: artifact[definition.artifact_id_key] ?? null,
      source_status: readResult.error ? "missing" : summary[definition.status_key] ?? "unknown",
      source_status_key: definition.status_key,
      validation_error_count: validationErrorCount,
      checkpoint_count: summary.checkpoint_count ?? 0,
      passed_checkpoint_count: summary.passed_checkpoint_count ?? 0,
      failed_checkpoint_count: summary.failed_checkpoint_count ?? validationErrorCount,
      desktop_read_only: summary.desktop_read_only ?? false,
      desktop_source_of_truth: summary.desktop_source_of_truth ?? summary.desktop_runtime_source_of_truth ?? false,
      source_hash: hashObject(artifact),
      read_error: readResult.error ?? null,
    };
    return {
      ...source,
      freeze_source_hash: hashObject(source),
    };
  });
}

function buildE2eTraces({ artifacts, generatedAt }) {
  const pack = artifacts.personal_dev_pack_manifest.summary ?? {};
  const repo = artifacts.repo_profile_detector.summary ?? {};
  const instructions = artifacts.agent_instruction_registry.summary ?? {};
  const issue = artifacts.issue_intake_adapter.summary ?? {};
  const request = artifacts.plan_request_contract.summary ?? {};
  const plan = artifacts.plan_reconciliation.summary ?? {};
  const scope = artifacts.scope_freeze_gate.summary ?? {};
  const lane = artifacts.dev_lane_ledger.summary ?? {};
  const patch = artifacts.implementation_patch_capture.summary ?? {};
  const diff = artifacts.diff_review_gate.summary ?? {};
  const matrix = artifacts.canonical_test_matrix.summary ?? {};
  const scan = artifacts.dev_protected_scan.summary ?? {};
  const pr = artifacts.pr_draft_artifact.summary ?? {};
  const release = artifacts.release_note_artifact.summary ?? {};
  const rollback = artifacts.rollback_plan_artifact.summary ?? {};
  const debt = artifacts.technical_debt_ledger.summary ?? {};
  const dashboard = artifacts.personal_dev_dashboard_api.summary ?? {};
  return [
    trace({
      stage: "issue",
      label: "Issue intake to normalized tasks",
      sourceIds: ["personal_dev_pack_manifest", "repo_profile_detector", "agent_instruction_registry", "issue_intake_adapter"],
      generatedAt,
      metrics: {
        personal_dev_pack_manifest_status: pack.personal_dev_pack_manifest_status ?? "unknown",
        repo_profile_detector_status: repo.repo_profile_detector_status ?? "unknown",
        agent_instruction_registry_status: instructions.agent_instruction_registry_status ?? "unknown",
        issue_intake_status: issue.issue_intake_status ?? "unknown",
        issue_source_count: issue.issue_source_count ?? 0,
        normalized_task_count: issue.normalized_task_count ?? 0,
        issue_task_binding_count: issue.issue_task_binding_count ?? 0,
        unbound_issue_task_binding_count: issue.unbound_issue_task_binding_count ?? 0,
        issue_mutation_performed_count: issue.issue_mutation_performed_count ?? 0,
        command_execution_performed_count: issue.command_execution_performed_count ?? 0,
      },
      condition: pack.personal_dev_pack_manifest_status === "complete"
        && repo.repo_profile_detector_status === "complete"
        && instructions.agent_instruction_registry_status === "complete"
        && issue.issue_intake_status === "complete"
        && (issue.issue_source_count ?? 0) >= 3
        && (issue.normalized_task_count ?? 0) >= 3
        && (issue.issue_task_binding_count ?? 0) >= 3
        && (issue.unbound_issue_task_binding_count ?? 0) === 0
        && (issue.issue_mutation_performed_count ?? 0) === 0
        && (issue.command_execution_performed_count ?? 0) === 0,
    }),
    trace({
      stage: "plan",
      label: "Plan request, reconciliation, and scope freeze",
      sourceIds: ["plan_request_contract", "plan_reconciliation", "scope_freeze_gate"],
      generatedAt,
      metrics: {
        plan_request_status: request.plan_request_status ?? "unknown",
        plan_request_count: request.plan_request_count ?? 0,
        ready_plan_request_count: request.ready_plan_request_count ?? 0,
        plan_reconciliation_status: plan.plan_reconciliation_status ?? "unknown",
        plan_candidate_count: plan.plan_candidate_count ?? 0,
        ready_plan_candidate_count: plan.ready_plan_candidate_count ?? 0,
        unresolved_conflict_count: plan.unresolved_conflict_count ?? 0,
        selected_scope_item_count: plan.selected_scope_item_count ?? 0,
        scope_freeze_gate_status: scope.scope_freeze_gate_status ?? "unknown",
        scope_freeze_performed_count: scope.scope_freeze_performed_count ?? 0,
        frozen_scope_item_count: scope.frozen_scope_item_count ?? 0,
        external_agent_invocation_performed_count: Math.max(request.external_agent_invocation_performed_count ?? 0, plan.external_agent_invocation_performed_count ?? 0, scope.external_agent_invocation_performed_count ?? 0),
        plan_acceptance_performed_count: Math.max(request.plan_acceptance_performed_count ?? 0, plan.plan_acceptance_performed_count ?? 0, scope.plan_acceptance_performed_count ?? 0),
        command_execution_performed_count: Math.max(request.command_execution_performed_count ?? 0, plan.command_execution_performed_count ?? 0, scope.command_execution_performed_count ?? 0),
      },
      condition: request.plan_request_status === "complete"
        && plan.plan_reconciliation_status === "complete"
        && scope.scope_freeze_gate_status === "complete"
        && (request.plan_request_count ?? 0) === 2
        && (request.ready_plan_request_count ?? 0) === 2
        && (plan.plan_candidate_count ?? 0) === 2
        && (plan.unresolved_conflict_count ?? 0) === 0
        && (scope.scope_freeze_performed_count ?? 0) === 1
        && (scope.frozen_scope_item_count ?? 0) >= 1
        && (request.external_agent_invocation_performed_count ?? 0) === 0
        && (plan.external_agent_invocation_performed_count ?? 0) === 0
        && (scope.external_agent_invocation_performed_count ?? 0) === 0
        && (request.plan_acceptance_performed_count ?? 0) === 0
        && (plan.plan_acceptance_performed_count ?? 0) === 0
        && (scope.plan_acceptance_performed_count ?? 0) === 0,
    }),
    trace({
      stage: "worktree",
      label: "Frozen scope to parallel worktree lanes",
      sourceIds: ["scope_freeze_gate", "dev_lane_ledger"],
      generatedAt,
      metrics: {
        dev_lane_ledger_status: lane.dev_lane_ledger_status ?? "unknown",
        dev_lane_count: lane.dev_lane_count ?? 0,
        branch_record_count: lane.branch_record_count ?? 0,
        worktree_record_count: lane.worktree_record_count ?? 0,
        materialized_branch_count: lane.materialized_branch_count ?? 0,
        materialized_worktree_count: lane.materialized_worktree_count ?? 0,
        git_command_executed_count: lane.git_command_executed_count ?? 0,
        filesystem_mutation_performed_count: lane.filesystem_mutation_performed_count ?? 0,
        protected_mutation_performed_count: lane.protected_mutation_performed_count ?? 0,
      },
      condition: lane.dev_lane_ledger_status === "complete"
        && (lane.dev_lane_count ?? 0) >= 2
        && (lane.branch_record_count ?? 0) >= 2
        && (lane.worktree_record_count ?? 0) >= 2
        && (lane.git_command_executed_count ?? 0) === 0
        && (lane.filesystem_mutation_performed_count ?? 0) === 0
        && (lane.protected_mutation_performed_count ?? 0) === 0,
    }),
    trace({
      stage: "diff",
      label: "Patch capture to diff review gate",
      sourceIds: ["implementation_patch_capture", "diff_review_gate"],
      generatedAt,
      metrics: {
        implementation_patch_capture_status: patch.implementation_patch_capture_status ?? "unknown",
        patch_record_count: patch.patch_record_count ?? 0,
        diff_capture_count: patch.diff_capture_count ?? 0,
        touched_file_count: patch.touched_file_count ?? 0,
        diff_review_gate_status: diff.diff_review_gate_status ?? "unknown",
        diff_review_result_count: diff.diff_review_result_count ?? 0,
        passed_with_human_gate_count: diff.passed_with_human_gate_count ?? 0,
        patch_application_performed_count: Math.max(patch.patch_application_performed_count ?? 0, diff.patch_application_performed_count ?? 0),
        git_command_executed_count: Math.max(patch.git_command_executed_count ?? 0, diff.git_command_executed_count ?? 0),
        filesystem_mutation_performed_count: Math.max(patch.filesystem_mutation_performed_count ?? 0, diff.filesystem_mutation_performed_count ?? 0),
        protected_mutation_performed_count: Math.max(patch.protected_mutation_performed_count ?? 0, diff.protected_mutation_performed_count ?? 0),
      },
      condition: patch.implementation_patch_capture_status === "complete"
        && diff.diff_review_gate_status === "complete"
        && (patch.patch_record_count ?? 0) >= 2
        && (patch.diff_capture_count ?? 0) >= 2
        && (diff.diff_review_result_count ?? 0) >= 2
        && (diff.passed_with_human_gate_count ?? 0) === (diff.diff_review_result_count ?? 0)
        && (patch.patch_application_performed_count ?? 0) === 0
        && (diff.patch_application_performed_count ?? 0) === 0
        && (patch.filesystem_mutation_performed_count ?? 0) === 0
        && (diff.filesystem_mutation_performed_count ?? 0) === 0,
    }),
    trace({
      stage: "test",
      label: "Canonical tests and protected scan",
      sourceIds: ["canonical_test_matrix", "dev_protected_scan"],
      generatedAt,
      metrics: {
        canonical_test_matrix_status: matrix.canonical_test_matrix_status ?? "unknown",
        required_dimension_count: matrix.required_dimension_count ?? 0,
        passed_required_dimension_count: matrix.passed_required_dimension_count ?? 0,
        failed_dimension_count: matrix.failed_dimension_count ?? 0,
        dev_protected_scan_status: scan.dev_protected_scan_status ?? "unknown",
        scan_result_count: scan.scan_result_count ?? 0,
        passed_with_protected_blocks_count: scan.passed_with_protected_blocks_count ?? 0,
        protected_candidate_count: scan.protected_candidate_count ?? 0,
        blocked_before_approval_count: scan.blocked_before_approval_count ?? 0,
        raw_secret_material_exposed_count: scan.raw_secret_material_exposed_count ?? 0,
        provider_key_exposed_count: scan.provider_key_exposed_count ?? 0,
        protected_mutation_performed_count: scan.protected_mutation_performed_count ?? 0,
      },
      condition: matrix.canonical_test_matrix_status === "complete"
        && scan.dev_protected_scan_status === "complete"
        && (matrix.required_dimension_count ?? 0) > 0
        && matrix.passed_required_dimension_count === matrix.required_dimension_count
        && (matrix.failed_dimension_count ?? 0) === 0
        && (scan.scan_result_count ?? 0) >= 2
        && (scan.passed_with_protected_blocks_count ?? 0) === (scan.scan_result_count ?? 0)
        && (scan.raw_secret_material_exposed_count ?? 0) === 0
        && (scan.provider_key_exposed_count ?? 0) === 0
        && (scan.protected_mutation_performed_count ?? 0) === 0,
    }),
    trace({
      stage: "pr",
      label: "PR draft, release note, rollback plan, and debt ledger",
      sourceIds: ["pr_draft_artifact", "release_note_artifact", "rollback_plan_artifact", "technical_debt_ledger"],
      generatedAt,
      metrics: {
        pr_draft_artifact_status: pr.pr_draft_artifact_status ?? "unknown",
        pr_draft_output_artifact_count: pr.pr_draft_output_artifact_count ?? 0,
        release_note_artifact_status: release.release_note_artifact_status ?? "unknown",
        release_note_output_artifact_count: release.release_note_output_artifact_count ?? 0,
        rollback_plan_artifact_status: rollback.rollback_plan_artifact_status ?? "unknown",
        rollback_output_artifact_count: rollback.rollback_output_artifact_count ?? 0,
        technical_debt_ledger_status: debt.technical_debt_ledger_status ?? "unknown",
        technical_debt_task_count: debt.technical_debt_task_count ?? 0,
        pull_request_creation_performed: pr.pull_request_creation_performed ?? false,
        github_api_called: pr.github_api_called ?? false,
        branch_push_performed: pr.branch_push_performed ?? false,
        merge_performed: Boolean(pr.merge_performed || release.merge_performed || rollback.merge_performed || debt.merge_performed),
        release_performed: Boolean(pr.release_performed || release.release_performed || rollback.release_performed || debt.release_performed),
        rollback_execution_performed: rollback.rollback_execution_performed ?? false,
      },
      condition: pr.pr_draft_artifact_status === "complete"
        && release.release_note_artifact_status === "complete"
        && rollback.rollback_plan_artifact_status === "complete"
        && debt.technical_debt_ledger_status === "complete"
        && (pr.pr_draft_output_artifact_count ?? 0) === 1
        && (release.release_note_output_artifact_count ?? 0) === 1
        && (rollback.rollback_output_artifact_count ?? 0) === 1
        && (debt.technical_debt_task_count ?? 0) >= 1
        && pr.pull_request_creation_performed !== true
        && pr.github_api_called !== true
        && pr.branch_push_performed !== true
        && pr.merge_performed !== true
        && release.merge_performed !== true
        && rollback.merge_performed !== true
        && debt.merge_performed !== true
        && pr.release_performed !== true
        && release.release_performed !== true
        && rollback.release_performed !== true
        && debt.release_performed !== true
        && rollback.rollback_execution_performed !== true,
    }),
    trace({
      stage: "dashboard_api",
      label: "Read-only dashboard and review API projection",
      sourceIds: ["personal_dev_dashboard_api"],
      generatedAt,
      metrics: {
        personal_dev_dashboard_api_status: dashboard.personal_dev_dashboard_api_status ?? "unknown",
        panel_row_count: dashboard.panel_row_count ?? 0,
        ready_panel_row_count: dashboard.ready_panel_row_count ?? 0,
        api_route_binding_count: dashboard.api_route_binding_count ?? 0,
        active_api_route_binding_count: dashboard.active_api_route_binding_count ?? 0,
        read_only_api_route_binding_count: dashboard.read_only_api_route_binding_count ?? 0,
        route_count: dashboard.route_count ?? 0,
        mutation_performed: dashboard.mutation_performed ?? false,
        command_execution_performed: dashboard.command_execution_performed ?? false,
        task_state_write_performed: dashboard.task_state_write_performed ?? false,
        issue_mutation_performed: dashboard.issue_mutation_performed ?? false,
        desktop_read_only: dashboard.desktop_read_only ?? false,
        desktop_source_of_truth: dashboard.desktop_source_of_truth ?? true,
      },
      condition: dashboard.personal_dev_dashboard_api_status === "complete"
        && (dashboard.panel_row_count ?? 0) === 6
        && (dashboard.ready_panel_row_count ?? 0) === 6
        && (dashboard.api_route_binding_count ?? 0) === 6
        && (dashboard.active_api_route_binding_count ?? 0) === 6
        && (dashboard.read_only_api_route_binding_count ?? 0) === 6
        && dashboard.mutation_performed !== true
        && dashboard.command_execution_performed !== true
        && dashboard.task_state_write_performed !== true
        && dashboard.issue_mutation_performed !== true
        && dashboard.desktop_read_only === true
        && dashboard.desktop_source_of_truth === false,
    }),
  ];
}

function trace({ stage, label, sourceIds, metrics, condition, generatedAt }) {
  const record = {
    schema_version: "personal-dev-e2e-trace.v1",
    e2e_trace_id: `personal-dev-e2e-trace.${stage}`,
    generated_at: generatedAt,
    trace_stage: stage,
    trace_label: label,
    trace_status: condition ? "passed" : "failed",
    source_ids: sourceIds,
    metrics,
    read_only: true,
    mutation_allowed: false,
    mutation_performed: false,
    command_execution_allowed: false,
    command_execution_performed: false,
    external_agent_invocation_allowed: false,
    human_review_required: true,
  };
  return {
    ...record,
    e2e_trace_hash: hashObject(record),
  };
}

function buildLoopBindings({ sourceById, generatedAt, controlPlaneLoopText }) {
  const bindings = SOURCE_DEFINITIONS.map((definition) => {
    const source = sourceById.get(definition.source_id);
    return loopBinding({
      bindingId: `personal-dev-e2e-loop-binding.${definition.source_id}`,
      generatedAt,
      phaseSlot: definition.phase_slot,
      sourceId: definition.source_id,
      controlPlaneStepId: definition.source_id,
      packageScriptName: definition.package_script_name,
      expectedOutputPath: DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS[definition.option_key],
      bindingStatus: source?.source_status === "complete" ? "bound_prior_source" : "source_attention",
      loopDeclared: String(controlPlaneLoopText ?? "").includes(`step("${definition.source_id}"`),
    });
  });
  bindings.push(loopBinding({
    bindingId: "personal-dev-e2e-loop-binding.personal_dev_e2e_freeze",
    generatedAt,
    phaseSlot: "P230",
    sourceId: "personal_dev_e2e_freeze",
    controlPlaneStepId: "personal_dev_e2e_freeze",
    packageScriptName: "personal-dev:e2e-freeze",
    expectedOutputPath: "artifacts/personal-dev-e2e-freeze/latest/personal-dev-e2e-freeze.json",
    bindingStatus: String(controlPlaneLoopText ?? "").includes('step("personal_dev_e2e_freeze"') ? "bound_self" : "loop_step_missing",
    loopDeclared: String(controlPlaneLoopText ?? "").includes('step("personal_dev_e2e_freeze"'),
  }));
  return bindings;
}

function loopBinding({ bindingId, generatedAt, phaseSlot, sourceId, controlPlaneStepId, packageScriptName, expectedOutputPath, bindingStatus, loopDeclared }) {
  const binding = {
    schema_version: "personal-dev-e2e-loop-binding.v1",
    e2e_loop_binding_id: bindingId,
    generated_at: generatedAt,
    phase_slot: phaseSlot,
    source_id: sourceId,
    control_plane_step_id: controlPlaneStepId,
    package_script_name: packageScriptName,
    expected_output_path: expectedOutputPath,
    e2e_loop_binding_status: bindingStatus,
    control_plane_loop_declared: loopDeclared,
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed_by_freeze: false,
    command_execution_performed_by_freeze: false,
    human_review_required: true,
  };
  return {
    ...binding,
    e2e_loop_binding_hash: hashObject(binding),
  };
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "personal-dev-e2e-freeze-desktop-boundary.v1",
    boundary_id: "personal-dev-e2e-freeze-desktop-boundary.personal-dev",
    generated_at: generatedAt,
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    visible_collections: ["personal_dev_e2e_freeze_sources", "personal_dev_e2e_traces", "personal_dev_e2e_loop_bindings", "validation_items"],
    read_only: true,
    mutation_allowed: false,
    task_state_write_allowed: false,
    issue_mutation_allowed: false,
    external_fetch_allowed: false,
    command_execution_allowed: false,
    git_command_allowed: false,
    github_api_allowed: false,
    branch_push_allowed: false,
    pull_request_creation_allowed: false,
    merge_allowed: false,
    release_allowed: false,
    rollback_execution_allowed: false,
    patch_application_allowed: false,
    protected_file_write_allowed: false,
    secret_material_read_allowed: false,
    production_config_write_allowed: false,
    external_agent_invocation_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    human_review_required: true,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  controlPlaneLoopText,
  reviewDashboardText,
  reviewApiText,
  readErrors,
  artifacts,
  freezeSources,
  e2eTraces,
  loopBindings,
  desktopBoundary,
}) {
  const s = (sourceId) => artifacts[sourceId]?.summary ?? {};
  const packageScripts = packageJson?.scripts ?? {};
  const allSourcesComplete = freezeSources.length === SOURCE_DEFINITIONS.length
    && freezeSources.every((source) => source.source_status === "complete" && source.validation_error_count === 0);
  const allTracesPassed = e2eTraces.every((traceItem) => traceItem.trace_status === "passed");
  const allLoopBindingsReady = loopBindings.length === SOURCE_DEFINITIONS.length + 1
    && loopBindings.every((binding) => binding.control_plane_loop_declared === true && ["bound_prior_source", "bound_self"].includes(binding.e2e_loop_binding_status));
  return [
    checkpoint("package_script_registered", Boolean(packageScripts["personal-dev:e2e-freeze"]) && !readErrors.packageJson, "package.json exposes personal-dev:e2e-freeze."),
    checkpoint("roadmap_slot_declared", !readErrors.roadmapText && String(roadmapText ?? "").includes("P230") && String(roadmapText ?? "").includes("Personal Dev E2E freeze"), "Final completion ledger declares P230 Personal Dev E2E freeze."),
    checkpoint("sources_complete", allSourcesComplete, "P213-P229 personal-dev source artifacts are complete with zero validation errors."),
    checkpoint("issue_to_plan_path_complete", s("issue_intake_adapter").issue_intake_status === "complete" && s("plan_request_contract").plan_request_status === "complete" && s("plan_reconciliation").plan_reconciliation_status === "complete" && s("scope_freeze_gate").scope_freeze_gate_status === "complete" && (s("plan_reconciliation").unresolved_conflict_count ?? 1) === 0, "Issue intake, plan request, reconciliation, and scope freeze path is complete."),
    checkpoint("worktree_diff_path_complete", s("dev_lane_ledger").dev_lane_ledger_status === "complete" && s("implementation_patch_capture").implementation_patch_capture_status === "complete" && s("diff_review_gate").diff_review_gate_status === "complete" && (s("dev_lane_ledger").dev_lane_count ?? 0) >= 2 && (s("diff_review_gate").diff_review_result_count ?? 0) >= 2, "Worktree, patch capture, and diff review path is complete."),
    checkpoint("test_and_protected_scan_complete", s("canonical_test_matrix").canonical_test_matrix_status === "complete" && s("dev_protected_scan").dev_protected_scan_status === "complete" && s("canonical_test_matrix").passed_required_dimension_count === s("canonical_test_matrix").required_dimension_count && (s("dev_protected_scan").raw_secret_material_exposed_count ?? 0) === 0, "Canonical test matrix and protected scan are complete."),
    checkpoint("pr_review_path_complete", s("pr_draft_artifact").pr_draft_artifact_status === "complete" && s("release_note_artifact").release_note_artifact_status === "complete" && s("rollback_plan_artifact").rollback_plan_artifact_status === "complete" && s("technical_debt_ledger").technical_debt_ledger_status === "complete", "PR draft, release note, rollback plan, and technical debt ledger are complete."),
    checkpoint("dashboard_api_read_only", s("personal_dev_dashboard_api").personal_dev_dashboard_api_status === "complete" && s("personal_dev_dashboard_api").desktop_read_only === true && s("personal_dev_dashboard_api").desktop_source_of_truth === false && s("personal_dev_dashboard_api").mutation_performed !== true, "Personal-dev dashboard/API projection is read-only."),
    checkpoint("e2e_traces_passed", allTracesPassed, "Issue, plan, worktree, diff, test, PR, and dashboard/API traces pass."),
    checkpoint("control_plane_loop_binding_ready", !readErrors.controlPlaneLoopText && allLoopBindingsReady, "Control-plane loop declares all prior personal-dev steps and P230 self step."),
    checkpoint("dashboard_stage_declared", !readErrors.reviewDashboardText && String(reviewDashboardText ?? "").includes("personal_dev_e2e_freeze") && String(reviewDashboardText ?? "").includes("buildPersonalDevE2eFreezeStage"), "Review dashboard declares the P230 E2E freeze source and stage."),
    checkpoint("review_api_routes_declared", !readErrors.reviewApiText && String(reviewApiText ?? "").includes("/api/personal-dev-e2e-freezes") && String(reviewApiText ?? "").includes("/api/personal-dev-e2e-traces"), "Review API exposes P230 E2E freeze read-only routes."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.command_execution_allowed === false && desktopBoundary.github_api_allowed === false && desktopBoundary.source_of_truth === false, "Desktop E2E freeze boundary is read-only."),
    checkpoint("no_mutation_performed", noMutationPerformed(artifacts), "P213-P229 source path remains non-mutating: no issue writes, task writes, commands, git writes, PR creation, merge, release, rollback, protected mutation, or patch application."),
    checkpoint("no_secret_or_external_agent_exposure", noSecretOrExternalAgentExposure(artifacts), "No external agent execution, raw secret exposure, or provider key exposure is recorded."),
  ];
}

function checkpoint(checkpointId, condition, message) {
  return {
    schema_version: "personal-dev-e2e-freeze-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
  };
}

function summarizePersonalDevE2eFreeze({
  artifacts,
  freezeSources,
  e2eTraces,
  loopBindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const s = (sourceId) => artifacts[sourceId]?.summary ?? {};
  const traceByStage = Object.fromEntries(e2eTraces.map((traceItem) => [traceItem.trace_stage, traceItem]));
  const sourceStatusSummary = Object.fromEntries(SOURCE_DEFINITIONS.map((definition) => [
    `source_${definition.source_id}_status`,
    s(definition.source_id)[definition.status_key] ?? "unknown",
  ]));
  return {
    personal_dev_e2e_freeze_status: validation.valid ? "complete" : "blocked",
    personal_dev_e2e_freeze_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    phase_range: "P213-P230",
    source_phase_range: "P213-P229",
    next_phase_slot: "P231",
    ...sourceStatusSummary,
    source_count: freezeSources.length,
    passed_source_count: freezeSources.filter((source) => source.source_status === "complete" && source.validation_error_count === 0).length,
    trace_count: e2eTraces.length,
    passed_trace_count: e2eTraces.filter((traceItem) => traceItem.trace_status === "passed").length,
    issue_trace_status: traceByStage.issue?.trace_status ?? "missing",
    plan_trace_status: traceByStage.plan?.trace_status ?? "missing",
    worktree_trace_status: traceByStage.worktree?.trace_status ?? "missing",
    diff_trace_status: traceByStage.diff?.trace_status ?? "missing",
    test_trace_status: traceByStage.test?.trace_status ?? "missing",
    pr_trace_status: traceByStage.pr?.trace_status ?? "missing",
    dashboard_api_trace_status: traceByStage.dashboard_api?.trace_status ?? "missing",
    loop_binding_count: loopBindings.length,
    bound_loop_binding_count: loopBindings.filter((binding) => ["bound_prior_source", "bound_self"].includes(binding.e2e_loop_binding_status)).length,
    self_loop_binding_status: loopBindings.find((binding) => binding.source_id === "personal_dev_e2e_freeze")?.e2e_loop_binding_status ?? "missing",
    issue_to_pr_path_complete: e2eTraces.every((traceItem) => traceItem.trace_status === "passed"),
    issue_source_count: s("issue_intake_adapter").issue_source_count ?? 0,
    normalized_task_count: s("issue_intake_adapter").normalized_task_count ?? 0,
    issue_task_binding_count: s("issue_intake_adapter").issue_task_binding_count ?? 0,
    plan_request_count: s("plan_request_contract").plan_request_count ?? 0,
    ready_plan_request_count: s("plan_request_contract").ready_plan_request_count ?? 0,
    plan_candidate_count: s("plan_reconciliation").plan_candidate_count ?? 0,
    selected_scope_item_count: s("plan_reconciliation").selected_scope_item_count ?? 0,
    unresolved_conflict_count: s("plan_reconciliation").unresolved_conflict_count ?? 0,
    scope_freeze_performed_count: s("scope_freeze_gate").scope_freeze_performed_count ?? 0,
    frozen_scope_item_count: s("scope_freeze_gate").frozen_scope_item_count ?? 0,
    dev_lane_count: s("dev_lane_ledger").dev_lane_count ?? 0,
    branch_record_count: s("dev_lane_ledger").branch_record_count ?? 0,
    worktree_record_count: s("dev_lane_ledger").worktree_record_count ?? 0,
    patch_record_count: s("implementation_patch_capture").patch_record_count ?? 0,
    diff_review_result_count: s("diff_review_gate").diff_review_result_count ?? 0,
    required_test_dimension_count: s("canonical_test_matrix").required_dimension_count ?? 0,
    passed_required_test_dimension_count: s("canonical_test_matrix").passed_required_dimension_count ?? 0,
    protected_scan_result_count: s("dev_protected_scan").scan_result_count ?? 0,
    protected_candidate_count: s("dev_protected_scan").protected_candidate_count ?? 0,
    blocked_before_approval_count: s("dev_protected_scan").blocked_before_approval_count ?? 0,
    pr_draft_output_artifact_count: s("pr_draft_artifact").pr_draft_output_artifact_count ?? 0,
    release_note_output_artifact_count: s("release_note_artifact").release_note_output_artifact_count ?? 0,
    rollback_output_artifact_count: s("rollback_plan_artifact").rollback_output_artifact_count ?? 0,
    technical_debt_task_count: s("technical_debt_ledger").technical_debt_task_count ?? 0,
    dashboard_panel_row_count: s("personal_dev_dashboard_api").panel_row_count ?? 0,
    dashboard_route_binding_count: s("personal_dev_dashboard_api").api_route_binding_count ?? 0,
    mutation_performed: false,
    source_artifact_mutation_performed: false,
    command_execution_performed: false,
    task_state_write_performed: false,
    issue_mutation_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    pull_request_creation_performed: false,
    merge_performed: false,
    release_performed: false,
    rollback_execution_performed: false,
    patch_application_performed: false,
    protected_mutation_performed: false,
    external_agent_invocation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    human_review_required: true,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    desktop_issue_mutation_allowed: desktopBoundary.issue_mutation_allowed,
    desktop_command_execution_allowed: desktopBoundary.command_execution_allowed,
    desktop_github_api_allowed: desktopBoundary.github_api_allowed,
    desktop_branch_push_allowed: desktopBoundary.branch_push_allowed,
    desktop_pull_request_creation_allowed: desktopBoundary.pull_request_creation_allowed,
    desktop_merge_allowed: desktopBoundary.merge_allowed,
    desktop_release_allowed: desktopBoundary.release_allowed,
    desktop_rollback_execution_allowed: desktopBoundary.rollback_execution_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((item) => item.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((item) => item.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_source_status: countBy(freezeSources, "source_status"),
    by_trace_status: countBy(e2eTraces, "trace_status"),
    by_loop_binding_status: countBy(loopBindings, "e2e_loop_binding_status"),
  };
}

function buildSourceContracts({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, readResults }) {
  const contracts = [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("control_plane_loop", "src/control-plane-loop.mjs", controlPlaneLoopText),
    sourceContract("review_dashboard", "src/review-dashboard.mjs", reviewDashboardText),
    sourceContract("review_api", "src/review-api.mjs", reviewApiText),
  ];
  for (const definition of SOURCE_DEFINITIONS) {
    contracts.push(sourceContract(definition.source_id, DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS[definition.option_key], readResults[definition.source_id]));
  }
  return contracts;
}

function sourceContract(sourceId, sourcePath, readResult) {
  const value = readResult.value ?? readResult;
  return {
    schema_version: "personal-dev-e2e-freeze-source-contract.v1",
    source_id: sourceId,
    source_path: sourcePath,
    source_status: readResult.error ? "missing" : "available",
    error: readResult.error ?? null,
    source_hash: hashObject(value ?? {}),
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, status: item.status }));
  return {
    schema_version: "personal-dev-e2e-freeze-validation.v1",
    valid: errors.length === 0,
    errors,
  };
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Personal Dev E2E Freeze");
  lines.push("");
  lines.push(`Status: ${result.summary.personal_dev_e2e_freeze_status}`);
  lines.push(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
  lines.push(`E2E traces: ${result.summary.passed_trace_count}/${result.summary.trace_count}`);
  lines.push(`Loop bindings: ${result.summary.bound_loop_binding_count}/${result.summary.loop_binding_count}`);
  lines.push(`Issue to PR path complete: ${result.summary.issue_to_pr_path_complete}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Trace Status");
  for (const traceItem of result.personal_dev_e2e_traces) {
    lines.push(`- ${traceItem.trace_stage}: ${traceItem.trace_status}; ${traceItem.trace_label}`);
  }
  lines.push("");
  lines.push("Human review note: this freeze is a read-only operational baseline. Issue writes, task updates, command execution, worktree materialization, PR creation, merge, release, rollback execution, protected writes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function noMutationPerformed(artifacts) {
  const summaries = Object.values(artifacts).map((artifact) => artifact.summary ?? {});
  const numericKeys = [
    "issue_mutation_performed_count",
    "task_state_write_performed_count",
    "task_state_mutation_performed_count",
    "command_execution_performed_count",
    "git_command_executed_count",
    "filesystem_mutation_performed_count",
    "protected_mutation_performed_count",
    "patch_application_performed_count",
    "plan_acceptance_performed_count",
    "file_restore_performed_count",
    "commit_revert_performed_count",
    "command_executed_count",
  ];
  const booleanKeys = [
    "pull_request_creation_performed",
    "github_api_called",
    "branch_push_performed",
    "merge_performed",
    "release_performed",
    "rollback_execution_performed",
    "command_execution_performed",
    "filesystem_mutation_performed",
    "protected_mutation_performed",
  ];
  return summaries.every((summary) => numericKeys.every((key) => (summary[key] ?? 0) === 0)
    && booleanKeys.every((key) => summary[key] !== true));
}

function noSecretOrExternalAgentExposure(artifacts) {
  const summaries = Object.values(artifacts).map((artifact) => artifact.summary ?? {});
  return summaries.every((summary) => (summary.external_agent_invocation_performed_count ?? 0) === 0
    && (summary.raw_secret_material_exposed_count ?? 0) === 0
    && summary.raw_secret_material_exposed !== true
    && (summary.provider_key_exposed_count ?? 0) === 0
    && summary.provider_key_exposed !== true);
}

function serializablePersonalDevE2eFreeze(result) {
  const { summary_markdown: _summaryMarkdown, output_dir: _outputDir, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  const inputs = {
    repo_root: options.repoRoot ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS.roadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS.reviewApiPath,
  };
  for (const definition of SOURCE_DEFINITIONS) {
    inputs[definition.input_key] = path.resolve(options[definition.option_key] ?? DEFAULT_PERSONAL_DEV_E2E_FREEZE_INPUTS[definition.option_key]);
  }
  return inputs;
}

function parseArgs(argv) {
  const parsed = {};
  const flagMap = {
    "--repo-root": "repoRoot",
    "--package": "packagePath",
    "--roadmap": "roadmapPath",
    "--control-plane-loop": "controlPlaneLoopPath",
    "--review-dashboard": "reviewDashboardPath",
    "--review-api": "reviewApiPath",
    "--personal-dev-pack-manifest": "personalDevPackManifestPath",
    "--repo-profile-detector": "repoProfileDetectorPath",
    "--agent-instruction-registry": "agentInstructionRegistryPath",
    "--issue-intake-adapter": "issueIntakeAdapterPath",
    "--plan-request-contract": "planRequestContractPath",
    "--plan-reconciliation": "planReconciliationPath",
    "--scope-freeze-gate": "scopeFreezeGatePath",
    "--dev-lane-ledger": "devLaneLedgerPath",
    "--implementation-patch-capture": "implementationPatchCapturePath",
    "--diff-review-gate": "diffReviewGatePath",
    "--canonical-test-matrix": "canonicalTestMatrixPath",
    "--dev-protected-scan": "devProtectedScanPath",
    "--pr-draft-artifact": "prDraftArtifactPath",
    "--release-note-artifact": "releaseNoteArtifactPath",
    "--rollback-plan-artifact": "rollbackPlanArtifactPath",
    "--technical-debt-ledger": "technicalDebtLedgerPath",
    "--personal-dev-dashboard-api": "personalDevDashboardApiPath",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (flagMap[arg]) parsed[flagMap[arg]] = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/personal-dev-e2e-freeze.mjs [options]

Options:
  --check                                  Fail when validation does not pass
  --no-write                               Build without writing artifacts
  --out-dir <path>                         Output directory
  --repo-root <path>                       Repository root
  --package <path>                         package.json path relative to repo root
  --roadmap <path>                         final completion ledger path relative to repo root
  --control-plane-loop <path>              control-plane-loop source path relative to repo root
  --review-dashboard <path>                review-dashboard source path relative to repo root
  --review-api <path>                      review-api source path relative to repo root
  --personal-dev-pack-manifest <path>      personal-dev-pack-manifest.json path
  --repo-profile-detector <path>           repo-profile-detector.json path
  --agent-instruction-registry <path>      agent-instruction-registry.json path
  --issue-intake-adapter <path>            issue-intake-adapter.json path
  --plan-request-contract <path>           plan-request-contract.json path
  --plan-reconciliation <path>             plan-reconciliation.json path
  --scope-freeze-gate <path>               scope-freeze-gate.json path
  --dev-lane-ledger <path>                 dev-lane-ledger.json path
  --implementation-patch-capture <path>    implementation-patch-capture.json path
  --diff-review-gate <path>                diff-review-gate.json path
  --canonical-test-matrix <path>           canonical-test-matrix.json path
  --dev-protected-scan <path>              dev-protected-scan.json path
  --pr-draft-artifact <path>               pr-draft-artifact.json path
  --release-note-artifact <path>           release-note-artifact.json path
  --rollback-plan-artifact <path>          rollback-plan-artifact.json path
  --technical-debt-ledger <path>           technical-debt-ledger.json path
  --personal-dev-dashboard-api <path>      personal-dev-dashboard-api.json path`);
}

async function readJsonOrError(filePath) {
  try {
    return { path: filePath, value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { path: filePath, value: null, error: `${error.name}: ${error.message}` };
  }
}

async function readTextOrError(filePath) {
  try {
    return { path: filePath, value: await readFile(filePath, "utf8") };
  } catch (error) {
    return { path: filePath, value: "", error: `${error.name}: ${error.message}` };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (match) => `_${match.toLowerCase()}`);
}

function hashObject(value) {
  return hashText(JSON.stringify(value ?? null));
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function dateStamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
