import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PERSONAL_DEV_DASHBOARD_API_OUT_DIR = "artifacts/personal-dev-dashboard-api/latest";
export const DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  repoProfileDetectorPath: "artifacts/repo-profile-detector/latest/repo-profile-detector.json",
  devLaneLedgerPath: "artifacts/dev-lane-ledger/latest/dev-lane-ledger.json",
  planReconciliationPath: "artifacts/plan-reconciliation/latest/plan-reconciliation.json",
  scopeFreezeGatePath: "artifacts/scope-freeze-gate/latest/scope-freeze-gate.json",
  implementationPatchCapturePath: "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json",
  diffReviewGatePath: "artifacts/diff-review-gate/latest/diff-review-gate.json",
  canonicalTestMatrixPath: "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json",
  prDraftArtifactPath: "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json",
  releaseNoteArtifactPath: "artifacts/release-note-artifact/latest/release-note-artifact.json",
  rollbackPlanArtifactPath: "artifacts/rollback-plan-artifact/latest/rollback-plan-artifact.json",
  technicalDebtLedgerPath: "artifacts/technical-debt-ledger/latest/technical-debt-ledger.json",
};

const CONTRACT_ID = "personal-dev-dashboard-api.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const API_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "personal_dev_phase_artifacts_projected_to_read_only_dashboard_api";
const DESKTOP_SURFACE_POLICY = "read_only_personal_dev_dashboard_api_surface";
const REQUIRED_PANEL_SECTIONS = ["repo", "worktree", "plan", "diff", "test", "pr"];

export async function runPersonalDevDashboardApi(options = {}) {
  const result = await buildPersonalDevDashboardApi(options);
  if (options.write !== false) await writePersonalDevDashboardApi(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Personal dev dashboard API validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPersonalDevDashboardApi(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const repoProfileDetector = await readJsonOrError(inputs.repo_profile_detector_path);
  const devLaneLedger = await readJsonOrError(inputs.dev_lane_ledger_path);
  const planReconciliation = await readJsonOrError(inputs.plan_reconciliation_path);
  const scopeFreezeGate = await readJsonOrError(inputs.scope_freeze_gate_path);
  const implementationPatchCapture = await readJsonOrError(inputs.implementation_patch_capture_path);
  const diffReviewGate = await readJsonOrError(inputs.diff_review_gate_path);
  const canonicalTestMatrix = await readJsonOrError(inputs.canonical_test_matrix_path);
  const prDraftArtifact = await readJsonOrError(inputs.pr_draft_artifact_path);
  const releaseNoteArtifact = await readJsonOrError(inputs.release_note_artifact_path);
  const rollbackPlanArtifact = await readJsonOrError(inputs.rollback_plan_artifact_path);
  const technicalDebtLedger = await readJsonOrError(inputs.technical_debt_ledger_path);
  const sources = {
    repoProfile: repoProfileDetector.value ?? {},
    devLane: devLaneLedger.value ?? {},
    plan: planReconciliation.value ?? {},
    scopeFreeze: scopeFreezeGate.value ?? {},
    implementationPatch: implementationPatchCapture.value ?? {},
    diffReview: diffReviewGate.value ?? {},
    testMatrix: canonicalTestMatrix.value ?? {},
    prDraft: prDraftArtifact.value ?? {},
    releaseNote: releaseNoteArtifact.value ?? {},
    rollbackPlan: rollbackPlanArtifact.value ?? {},
    technicalDebt: technicalDebtLedger.value ?? {},
  };
  const panelRows = buildPanelRows({ sources, generatedAt });
  const statusRollups = buildStatusRollups({ panelRows, sources, generatedAt });
  const apiRouteBindings = buildApiRouteBindings({ panelRows, generatedAt });
  const markdown = renderPanelMarkdown({ panelRows, apiRouteBindings, generatedAt });
  const outputArtifacts = buildOutputArtifacts({ prDraft: sources.prDraft, technicalDebt: sources.technicalDebt, markdown, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    readErrors: {
      repoProfileDetector: repoProfileDetector.error,
      devLaneLedger: devLaneLedger.error,
      planReconciliation: planReconciliation.error,
      scopeFreezeGate: scopeFreezeGate.error,
      implementationPatchCapture: implementationPatchCapture.error,
      diffReviewGate: diffReviewGate.error,
      canonicalTestMatrix: canonicalTestMatrix.error,
      prDraftArtifact: prDraftArtifact.error,
      releaseNoteArtifact: releaseNoteArtifact.error,
      rollbackPlanArtifact: rollbackPlanArtifact.error,
      technicalDebtLedger: technicalDebtLedger.error,
    },
    sources,
    panelRows,
    statusRollups,
    apiRouteBindings,
    outputArtifacts,
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
  const summary = summarizePersonalDevDashboardApi({
    sources,
    panelRows,
    statusRollups,
    apiRouteBindings,
    outputArtifacts,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    personal_dev_dashboard_api_id: `personal-dev-dashboard-api.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    personal_dev_dashboard_api_status: summary.personal_dev_dashboard_api_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      repoProfileDetector,
      devLaneLedger,
      planReconciliation,
      scopeFreezeGate,
      implementationPatchCapture,
      diffReviewGate,
      canonicalTestMatrix,
      prDraftArtifact,
      releaseNoteArtifact,
      rollbackPlanArtifact,
      technicalDebtLedger,
    }),
    personal_dev_dashboard_api_contract: buildContract(generatedAt),
    source_repo_profile_detector: buildSourceSummary("repo_profile_detector", sources.repoProfile, sources.repoProfile.summary?.repo_profile_detector_status),
    source_dev_lane_ledger: buildSourceSummary("dev_lane_ledger", sources.devLane, sources.devLane.summary?.dev_lane_ledger_status),
    source_plan_reconciliation: buildSourceSummary("plan_reconciliation", sources.plan, sources.plan.summary?.plan_reconciliation_status),
    source_scope_freeze_gate: buildSourceSummary("scope_freeze_gate", sources.scopeFreeze, sources.scopeFreeze.summary?.scope_freeze_gate_status),
    source_implementation_patch_capture: buildSourceSummary("implementation_patch_capture", sources.implementationPatch, sources.implementationPatch.summary?.implementation_patch_capture_status),
    source_diff_review_gate: buildSourceSummary("diff_review_gate", sources.diffReview, sources.diffReview.summary?.diff_review_gate_status),
    source_canonical_test_matrix: buildSourceSummary("canonical_test_matrix", sources.testMatrix, sources.testMatrix.summary?.canonical_test_matrix_status),
    source_pr_draft_artifact: buildSourceSummary("pr_draft_artifact", sources.prDraft, sources.prDraft.summary?.pr_draft_artifact_status),
    source_release_note_artifact: buildSourceSummary("release_note_artifact", sources.releaseNote, sources.releaseNote.summary?.release_note_artifact_status),
    source_rollback_plan_artifact: buildSourceSummary("rollback_plan_artifact", sources.rollbackPlan, sources.rollbackPlan.summary?.rollback_plan_artifact_status),
    source_technical_debt_ledger: buildSourceSummary("technical_debt_ledger", sources.technicalDebt, sources.technicalDebt.summary?.technical_debt_ledger_status),
    personal_dev_output_artifacts: outputArtifacts,
    personal_dev_panel_rows: panelRows,
    personal_dev_status_rollups: statusRollups,
    personal_dev_api_route_bindings: apiRouteBindings,
    personal_dev_dashboard_desktop_boundary: desktopBoundary,
    personal_dev_dashboard_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown,
    summary_markdown: renderSummaryMarkdown(result),
  };
}

export async function writePersonalDevDashboardApi(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePersonalDevDashboardApi(result);
  await writeJson(path.join(outDir, "personal-dev-dashboard-api.json"), serializable);
  await writeFile(path.join(outDir, "personal-dev-panel.md"), result.markdown, "utf8");
  await writeJson(path.join(outDir, "personal-dev-panel-rows.json"), {
    schema_version: "personal-dev-panel-rows.v1",
    generated_at: result.generated_at,
    panel_row_count: result.personal_dev_panel_rows.length,
    personal_dev_panel_rows: result.personal_dev_panel_rows,
  });
  await writeJson(path.join(outDir, "personal-dev-status-rollups.json"), {
    schema_version: "personal-dev-status-rollups.v1",
    generated_at: result.generated_at,
    status_rollup_count: result.personal_dev_status_rollups.length,
    personal_dev_status_rollups: result.personal_dev_status_rollups,
  });
  await writeJson(path.join(outDir, "personal-dev-api-route-bindings.json"), {
    schema_version: "personal-dev-api-route-bindings.v1",
    generated_at: result.generated_at,
    api_route_binding_count: result.personal_dev_api_route_bindings.length,
    personal_dev_api_route_bindings: result.personal_dev_api_route_bindings,
  });
  await writeJson(path.join(outDir, "personal-dev-dashboard-desktop-boundary.json"), {
    schema_version: "personal-dev-dashboard-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    personal_dev_dashboard_desktop_boundary: result.personal_dev_dashboard_desktop_boundary,
  });
  await writeJson(path.join(outDir, "personal-dev-output-artifacts.json"), {
    schema_version: "personal-dev-output-artifacts.v1",
    generated_at: result.generated_at,
    personal_dev_output_artifact_count: result.personal_dev_output_artifacts.length,
    personal_dev_output_artifacts: result.personal_dev_output_artifacts,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "personal-dev-dashboard-api-validation-report.v1",
    generated_at: result.generated_at,
    personal_dev_dashboard_api_id: result.personal_dev_dashboard_api_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runPersonalDevDashboardApiCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPersonalDevDashboardApi(args);
    console.log(`Personal dev dashboard API ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.personal_dev_dashboard_api_status}`);
    console.log(`Panel rows: ${result.summary.panel_row_count}`);
    console.log(`Route bindings: ${result.summary.api_route_binding_count}`);
    console.log(`Mutation performed: ${result.summary.mutation_performed}`);
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
    schema_version: "personal-dev-dashboard-api-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    api_authority: API_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    panel_rule: "repo_worktree_plan_diff_test_and_pr_status_are_projected_into_read_only_panel_rows",
    api_rule: "personal_dev_dashboard_routes_bind_existing_read_only_review_api_collections_without_writes",
    route_rule: "route_bindings_are_declared_for_lookup_only_and_do_not_create_prs_mutate_issues_execute_commands_or_write_task_state",
    desktop_companion_rule: "desktop_companion_reads_panel_rows_status_rollups_route_bindings_and_validation_only",
    human_review_rule: "reruns_task_updates_pr_creation_merge_release_and_client_facing_outputs_remain_human_gated",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    personal_dev_dashboard_api_generated: true,
    route_binding_generated: true,
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
    patch_application_performed: false,
    external_agent_invocation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function buildPanelRows({ sources, generatedAt }) {
  const repo = sources.repoProfile.summary ?? {};
  const lane = sources.devLane.summary ?? {};
  const plan = sources.plan.summary ?? {};
  const implementation = sources.implementationPatch.summary ?? {};
  const diff = sources.diffReview.summary ?? {};
  const test = sources.testMatrix.summary ?? {};
  const pr = sources.prDraft.summary ?? {};
  const release = sources.releaseNote.summary ?? {};
  const rollback = sources.rollbackPlan.summary ?? {};
  const debt = sources.technicalDebt.summary ?? {};
  return [
    panelRow({
      section: "repo",
      label: "Repository",
      status: repo.repo_profile_detector_status,
      summaryLine: `${repo.primary_language_id ?? "unknown"} repository with ${repo.command_profile_count ?? 0} command profile(s).`,
      metrics: {
        primary_language_id: repo.primary_language_id ?? "unknown",
        command_profile_count: repo.command_profile_count ?? 0,
        test_command_detected: repo.test_command_detected ?? false,
        build_command_detected: repo.build_command_detected ?? false,
        lint_command_detected: repo.lint_command_detected ?? false,
        command_execution_performed_count: repo.command_execution_performed_count ?? 0,
      },
      sourceArtifactIds: [sources.repoProfile.repo_profile_detector_id],
      routeGroupId: "personal-dev-api-route-group.repo",
      generatedAt,
    }),
    panelRow({
      section: "worktree",
      label: "Worktree Lanes",
      status: lane.dev_lane_ledger_status,
      summaryLine: `${lane.dev_lane_count ?? 0} lane(s), ${lane.branch_record_count ?? 0} branch record(s), ${lane.worktree_record_count ?? 0} worktree record(s).`,
      metrics: {
        dev_lane_count: lane.dev_lane_count ?? 0,
        provisioned_dev_lane_count: lane.provisioned_dev_lane_count ?? 0,
        branch_record_count: lane.branch_record_count ?? 0,
        worktree_record_count: lane.worktree_record_count ?? 0,
        materialized_branch_count: lane.materialized_branch_count ?? 0,
        materialized_worktree_count: lane.materialized_worktree_count ?? 0,
        git_command_executed_count: lane.git_command_executed_count ?? 0,
        filesystem_mutation_performed_count: lane.filesystem_mutation_performed_count ?? 0,
      },
      sourceArtifactIds: [sources.devLane.dev_lane_ledger_id],
      routeGroupId: "personal-dev-api-route-group.worktree",
      generatedAt,
    }),
    panelRow({
      section: "plan",
      label: "Plan",
      status: plan.plan_reconciliation_status,
      summaryLine: `${plan.plan_candidate_count ?? 0} candidate(s), ${plan.resolved_conflict_count ?? 0}/${plan.conflict_count ?? 0} conflict(s) resolved.`,
      metrics: {
        plan_candidate_count: plan.plan_candidate_count ?? 0,
        ready_plan_candidate_count: plan.ready_plan_candidate_count ?? 0,
        selected_scope_status: plan.selected_scope_status ?? "unknown",
        selected_scope_item_count: plan.selected_scope_item_count ?? 0,
        conflict_count: plan.conflict_count ?? 0,
        resolved_conflict_count: plan.resolved_conflict_count ?? 0,
        unresolved_conflict_count: plan.unresolved_conflict_count ?? 0,
        unresolved_question_count: plan.unresolved_question_count ?? 0,
        scope_freeze_status: sources.scopeFreeze.summary?.scope_freeze_gate_status ?? "unknown",
        scope_freeze_performed_count: sources.scopeFreeze.summary?.scope_freeze_performed_count ?? 0,
      },
      sourceArtifactIds: [sources.plan.plan_reconciliation_id, sources.scopeFreeze.scope_freeze_gate_id],
      routeGroupId: "personal-dev-api-route-group.plan",
      generatedAt,
    }),
    panelRow({
      section: "diff",
      label: "Diff",
      status: diff.diff_review_gate_status,
      summaryLine: `${implementation.patch_record_count ?? 0} patch record(s), ${diff.diff_review_result_count ?? 0} diff review result(s).`,
      metrics: {
        implementation_patch_capture_status: implementation.implementation_patch_capture_status ?? "unknown",
        patch_record_count: implementation.patch_record_count ?? 0,
        diff_capture_count: implementation.diff_capture_count ?? 0,
        touched_file_count: implementation.touched_file_count ?? 0,
        generated_artifact_count: implementation.generated_artifact_count ?? 0,
        diff_review_gate_status: diff.diff_review_gate_status ?? "unknown",
        diff_review_result_count: diff.diff_review_result_count ?? 0,
        passed_with_human_gate_count: diff.passed_with_human_gate_count ?? 0,
        patch_application_performed_count: diff.patch_application_performed_count ?? 0,
      },
      sourceArtifactIds: [sources.implementationPatch.implementation_patch_capture_id, sources.diffReview.diff_review_gate_id],
      routeGroupId: "personal-dev-api-route-group.diff",
      generatedAt,
    }),
    panelRow({
      section: "test",
      label: "Tests",
      status: test.canonical_test_matrix_status,
      summaryLine: `${test.passed_required_dimension_count ?? 0}/${test.required_dimension_count ?? 0} required test dimension(s) passed.`,
      metrics: {
        canonical_test_matrix_status: test.canonical_test_matrix_status ?? "unknown",
        test_dimension_count: test.test_dimension_count ?? 0,
        required_dimension_count: test.required_dimension_count ?? 0,
        executed_dimension_count: test.executed_dimension_count ?? 0,
        passed_required_dimension_count: test.passed_required_dimension_count ?? 0,
        failed_dimension_count: test.failed_dimension_count ?? 0,
        timed_out_dimension_count: test.timed_out_dimension_count ?? 0,
        agent_self_report_trusted_count: test.agent_self_report_trusted_count ?? 0,
      },
      sourceArtifactIds: [sources.testMatrix.canonical_test_matrix_id],
      routeGroupId: "personal-dev-api-route-group.test",
      generatedAt,
    }),
    panelRow({
      section: "pr",
      label: "PR Review",
      status: pr.pr_draft_artifact_status,
      summaryLine: `${pr.pr_draft_output_artifact_count ?? 0} PR draft artifact(s), ${debt.technical_debt_task_count ?? 0} debt task(s).`,
      metrics: {
        pr_draft_artifact_status: pr.pr_draft_artifact_status ?? "unknown",
        pr_draft_output_artifact_count: pr.pr_draft_output_artifact_count ?? 0,
        risk_count: pr.risk_count ?? 0,
        release_note_artifact_status: release.release_note_artifact_status ?? "unknown",
        rollback_plan_artifact_status: rollback.rollback_plan_artifact_status ?? "unknown",
        rollback_command_target_count: rollback.rollback_command_target_count ?? 0,
        technical_debt_ledger_status: debt.technical_debt_ledger_status ?? "unknown",
        technical_debt_task_count: debt.technical_debt_task_count ?? 0,
        pull_request_creation_performed: pr.pull_request_creation_performed ?? false,
        github_api_called: pr.github_api_called ?? false,
        branch_push_performed: pr.branch_push_performed ?? false,
        merge_performed: pr.merge_performed ?? false,
        release_performed: pr.release_performed ?? false,
      },
      sourceArtifactIds: [
        sources.prDraft.pr_draft_artifact_id,
        sources.releaseNote.release_note_artifact_id,
        sources.rollbackPlan.rollback_plan_artifact_id,
        sources.technicalDebt.technical_debt_ledger_id,
      ],
      routeGroupId: "personal-dev-api-route-group.pr",
      generatedAt,
    }),
  ];
}

function panelRow({ section, label, status, summaryLine, metrics, sourceArtifactIds, routeGroupId, generatedAt }) {
  const row = {
    schema_version: "personal-dev-panel-row.v1",
    panel_row_id: `personal-dev-panel-row.${section}`,
    generated_at: generatedAt,
    panel_section: section,
    label,
    panel_status: status === "complete" ? "ready" : "attention",
    source_status: status ?? "unknown",
    summary_line: summaryLine,
    metrics,
    source_artifact_ids: sourceArtifactIds.filter(Boolean),
    api_route_group_id: routeGroupId,
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed: false,
    human_review_required: true,
  };
  return {
    ...row,
    panel_row_hash: hashObject(row),
  };
}

function buildStatusRollups({ panelRows, sources, generatedAt }) {
  return panelRows.map((row) => {
    const rollup = {
      schema_version: "personal-dev-status-rollup.v1",
      status_rollup_id: `personal-dev-status-rollup.${row.panel_section}`,
      generated_at: generatedAt,
      rollup_key: row.panel_section,
      rollup_status: row.panel_status,
      panel_row_id: row.panel_row_id,
      source_status: row.source_status,
      summary_line: row.summary_line,
      source_artifact_ids: row.source_artifact_ids,
      read_only: true,
      mutation_allowed: false,
      command_execution_allowed: false,
      human_review_required: true,
    };
    return {
      ...rollup,
      status_rollup_hash: hashObject({ rollup, sourceHash: hashObject(sources[row.panel_section] ?? {}) }),
    };
  });
}

function buildApiRouteBindings({ panelRows, generatedAt }) {
  const routeGroups = {
    repo: ["/api/repo-profile-detectors", "/api/repo-profiles", "/api/repo-profile-commands", "/api/repo-profile-validations"],
    worktree: ["/api/dev-lane-ledgers", "/api/dev-lanes", "/api/dev-lane-branch-records", "/api/dev-lane-worktree-records", "/api/dev-lane-validations"],
    plan: ["/api/plan-reconciliations", "/api/plan-candidates", "/api/selected-plan-scopes", "/api/unresolved-plan-questions", "/api/scope-freeze-gates"],
    diff: ["/api/implementation-patch-captures", "/api/implementation-diff-captures", "/api/implementation-touched-files", "/api/diff-review-gates", "/api/diff-review-results"],
    test: ["/api/canonical-test-matrices", "/api/canonical-test-matrix-commands", "/api/canonical-test-matrix-executions", "/api/canonical-test-matrix-results"],
    pr: ["/api/pr-draft-artifacts", "/api/release-note-artifacts", "/api/rollback-plan-artifacts", "/api/technical-debt-ledgers"],
  };
  return panelRows.map((row) => {
    const binding = {
      schema_version: "personal-dev-api-route-binding.v1",
      api_route_binding_id: `personal-dev-api-route-binding.${row.panel_section}`,
      api_route_group_id: row.api_route_group_id,
      generated_at: generatedAt,
      route_group: row.panel_section,
      panel_row_id: row.panel_row_id,
      route_paths: routeGroups[row.panel_section] ?? [],
      route_count: (routeGroups[row.panel_section] ?? []).length,
      route_binding_status: "active",
      route_surface: "review_api",
      read_only: true,
      mutation_allowed: false,
      issue_mutation_allowed: false,
      task_state_write_allowed: false,
      command_execution_allowed: false,
      github_api_allowed: false,
      branch_push_allowed: false,
      pull_request_creation_allowed: false,
      merge_allowed: false,
      release_allowed: false,
      source_of_truth: false,
      human_review_required: true,
    };
    return {
      ...binding,
      api_route_binding_hash: hashObject(binding),
    };
  });
}

function buildOutputArtifacts({ prDraft, technicalDebt, markdown, generatedAt }) {
  const sourceOutput = technicalDebt.technical_debt_output_artifacts?.[0] ?? prDraft.pr_draft_output_artifacts?.[0] ?? {};
  return [{
    schema_version: "output-artifact.v2",
    output_artifact_id: "output.personal_dev.p229.dashboard_api",
    source_output_artifact_id: sourceOutput.output_artifact_id ?? null,
    source_id: "personal_dev_dashboard_api",
    source_label: "Personal Dev Dashboard API",
    domain_pack: "personal-dev",
    capability_id: CAPABILITY_ID,
    workflow_run_id: sourceOutput.workflow_run_id ?? "workflow-run.personal_dev.p229.dashboard_api",
    tenant_id: sourceOutput.tenant_id ?? "tenant.personal.jws",
    matter_id: sourceOutput.matter_id ?? "matter.personal_dev.hermes",
    artifact_type: "json",
    artifact_uri: "artifacts/personal-dev-dashboard-api/latest/personal-dev-dashboard-api.json",
    content_hash: hashText(markdown),
    hash_algorithm: "sha256",
    hash_status: "present",
    output_status: "draft",
    delivery_state: "blocked_pending_approval",
    delivery_state_after_receipt: "ready_for_delivery",
    approval_id: "approval.personal_dev.p229.dashboard_api.human_review",
    approval_status: "pending",
    approval_request_ids: ["approval.personal_dev.p229.dashboard_api.human_review"],
    approval_request_count: 1,
    delivery_action_ids: ["delivery.personal_dev.p229.dashboard_api"],
    delivery_action_count: 1,
    delivery_receipt_ids: [],
    delivery_receipt_count: 0,
    blocking_gate_ids: ["human_approval_gate"],
    blocking_gate_count: 1,
    citation_count: 0,
    created_by_run_id: "agent-run.personal_dev.p229.dashboard_api",
    created_at: generatedAt,
    recorded_at: generatedAt,
    approval_separation_status: "approval_required_not_applied",
    delivery_separation_status: "separate_delivery_action_declared",
    receipt_separation_status: "receipt_required_before_delivery",
    event_id: "event.output.rendered.personal_dev.p229.dashboard_api",
    policy_snapshot_id: sourceOutput.policy_snapshot_id ?? "policy.default.personal_dev.v1",
    metadata: {
      title: "Hermes Personal Dev dashboard API panel",
      panel_sections: REQUIRED_PANEL_SECTIONS,
      read_only_api_surface: true,
    },
  }];
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "personal-dev-dashboard-desktop-boundary.v1",
    boundary_id: "personal-dev-dashboard-api-desktop-boundary.personal-dev",
    generated_at: generatedAt,
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    visible_collections: ["personal_dev_panel_rows", "personal_dev_status_rollups", "personal_dev_api_route_bindings", "validation_items"],
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
  readErrors,
  sources,
  panelRows,
  statusRollups,
  apiRouteBindings,
  outputArtifacts,
  desktopBoundary,
}) {
  const summary = {
    repo: sources.repoProfile.summary ?? {},
    lane: sources.devLane.summary ?? {},
    plan: sources.plan.summary ?? {},
    implementation: sources.implementationPatch.summary ?? {},
    diff: sources.diffReview.summary ?? {},
    test: sources.testMatrix.summary ?? {},
    pr: sources.prDraft.summary ?? {},
    release: sources.releaseNote.summary ?? {},
    rollback: sources.rollbackPlan.summary ?? {},
    debt: sources.technicalDebt.summary ?? {},
  };
  const sections = new Set(panelRows.map((row) => row.panel_section));
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:dashboard-api"]), "package.json exposes personal-dev:dashboard-api."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P229") && String(roadmapText ?? "").includes("personal-dev dashboard/API"), "Final completion ledger declares P229 personal-dev dashboard/API."),
    checkpoint("repo_status_source_complete", !readErrors.repoProfileDetector && summary.repo.repo_profile_detector_status === "complete" && summary.repo.validation_error_count === 0, "Repo profile source is complete."),
    checkpoint("worktree_status_source_complete", !readErrors.devLaneLedger && summary.lane.dev_lane_ledger_status === "complete" && summary.lane.dev_lane_count >= 2 && summary.lane.validation_error_count === 0, "Worktree lane source is complete."),
    checkpoint("plan_status_source_complete", !readErrors.planReconciliation && !readErrors.scopeFreezeGate && summary.plan.plan_reconciliation_status === "complete" && summary.plan.unresolved_conflict_count === 0 && summary.plan.validation_error_count === 0, "Plan source is complete."),
    checkpoint("diff_status_source_complete", !readErrors.implementationPatchCapture && !readErrors.diffReviewGate && summary.implementation.implementation_patch_capture_status === "complete" && summary.diff.diff_review_gate_status === "complete" && summary.diff.validation_error_count === 0, "Diff source is complete."),
    checkpoint("test_status_source_complete", !readErrors.canonicalTestMatrix && summary.test.canonical_test_matrix_status === "complete" && summary.test.passed_required_dimension_count === summary.test.required_dimension_count && summary.test.validation_error_count === 0, "Test source is complete."),
    checkpoint("pr_status_source_complete", !readErrors.prDraftArtifact && !readErrors.releaseNoteArtifact && !readErrors.rollbackPlanArtifact && !readErrors.technicalDebtLedger && summary.pr.pr_draft_artifact_status === "complete" && summary.release.release_note_artifact_status === "complete" && summary.rollback.rollback_plan_artifact_status === "complete" && summary.debt.technical_debt_ledger_status === "complete", "PR review sources are complete."),
    checkpoint("required_panel_rows_declared", panelRows.length === REQUIRED_PANEL_SECTIONS.length && REQUIRED_PANEL_SECTIONS.every((section) => sections.has(section)) && panelRows.every((row) => row.panel_status === "ready" && row.read_only === true), "Repo, worktree, plan, diff, test, and PR panel rows are ready."),
    checkpoint("status_rollups_declared", statusRollups.length === panelRows.length && statusRollups.every((rollup) => rollup.rollup_status === "ready" && rollup.read_only === true), "Status rollups mirror panel rows."),
    checkpoint("api_route_bindings_declared", apiRouteBindings.length === REQUIRED_PANEL_SECTIONS.length && apiRouteBindings.every((binding) => binding.route_binding_status === "active" && binding.read_only === true && binding.mutation_allowed === false && binding.command_execution_allowed === false), "API route bindings are active and read-only."),
    checkpoint("output_artifact_stored", outputArtifacts.length === 1 && outputArtifacts.every((artifact) => artifact.schema_version === "output-artifact.v2" && artifact.artifact_type === "json" && artifact.output_status === "draft" && artifact.delivery_state === "blocked_pending_approval"), "Personal-dev panel is stored as draft JSON OutputArtifact v2."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.command_execution_allowed === false && desktopBoundary.github_api_allowed === false && desktopBoundary.source_of_truth === false, "Desktop personal-dev dashboard/API boundary is read-only."),
  ];
}

function summarizePersonalDevDashboardApi({
  sources,
  panelRows,
  statusRollups,
  apiRouteBindings,
  outputArtifacts,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const rowBySection = Object.fromEntries(panelRows.map((row) => [row.panel_section, row]));
  const repo = sources.repoProfile.summary ?? {};
  const lane = sources.devLane.summary ?? {};
  const plan = sources.plan.summary ?? {};
  const implementation = sources.implementationPatch.summary ?? {};
  const diff = sources.diffReview.summary ?? {};
  const test = sources.testMatrix.summary ?? {};
  const pr = sources.prDraft.summary ?? {};
  const release = sources.releaseNote.summary ?? {};
  const rollback = sources.rollbackPlan.summary ?? {};
  const debt = sources.technicalDebt.summary ?? {};
  return {
    personal_dev_dashboard_api_status: validation.valid ? "complete" : "blocked",
    personal_dev_dashboard_api_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    api_authority: API_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_repo_profile_detector_status: repo.repo_profile_detector_status ?? "unknown",
    source_dev_lane_ledger_status: lane.dev_lane_ledger_status ?? "unknown",
    source_plan_reconciliation_status: plan.plan_reconciliation_status ?? "unknown",
    source_scope_freeze_gate_status: sources.scopeFreeze.summary?.scope_freeze_gate_status ?? "unknown",
    source_implementation_patch_capture_status: implementation.implementation_patch_capture_status ?? "unknown",
    source_diff_review_gate_status: diff.diff_review_gate_status ?? "unknown",
    source_canonical_test_matrix_status: test.canonical_test_matrix_status ?? "unknown",
    source_pr_draft_artifact_status: pr.pr_draft_artifact_status ?? "unknown",
    source_release_note_artifact_status: release.release_note_artifact_status ?? "unknown",
    source_rollback_plan_artifact_status: rollback.rollback_plan_artifact_status ?? "unknown",
    source_technical_debt_ledger_status: debt.technical_debt_ledger_status ?? "unknown",
    personal_dev_output_artifact_count: outputArtifacts.length,
    output_artifact_v2_count: outputArtifacts.filter((artifact) => artifact.schema_version === "output-artifact.v2").length,
    output_artifact_hash_present_count: outputArtifacts.filter((artifact) => artifact.hash_status === "present").length,
    output_artifact_draft_count: outputArtifacts.filter((artifact) => artifact.output_status === "draft").length,
    output_artifact_blocked_pending_approval_count: outputArtifacts.filter((artifact) => artifact.delivery_state === "blocked_pending_approval").length,
    output_artifact_pending_approval_count: outputArtifacts.filter((artifact) => artifact.approval_status === "pending").length,
    panel_row_count: panelRows.length,
    ready_panel_row_count: panelRows.filter((row) => row.panel_status === "ready").length,
    repo_panel_status: rowBySection.repo?.panel_status ?? "missing",
    worktree_panel_status: rowBySection.worktree?.panel_status ?? "missing",
    plan_panel_status: rowBySection.plan?.panel_status ?? "missing",
    diff_panel_status: rowBySection.diff?.panel_status ?? "missing",
    test_panel_status: rowBySection.test?.panel_status ?? "missing",
    pr_panel_status: rowBySection.pr?.panel_status ?? "missing",
    repo_command_profile_count: repo.command_profile_count ?? 0,
    repo_test_command_detected: repo.test_command_detected ?? false,
    repo_build_command_detected: repo.build_command_detected ?? false,
    worktree_dev_lane_count: lane.dev_lane_count ?? 0,
    worktree_branch_record_count: lane.branch_record_count ?? 0,
    worktree_worktree_record_count: lane.worktree_record_count ?? 0,
    worktree_materialized_worktree_count: lane.materialized_worktree_count ?? 0,
    plan_candidate_count: plan.plan_candidate_count ?? 0,
    plan_resolved_conflict_count: plan.resolved_conflict_count ?? 0,
    plan_unresolved_conflict_count: plan.unresolved_conflict_count ?? 0,
    plan_unresolved_question_count: plan.unresolved_question_count ?? 0,
    diff_patch_record_count: implementation.patch_record_count ?? 0,
    diff_review_result_count: diff.diff_review_result_count ?? 0,
    diff_touched_file_count: implementation.touched_file_count ?? 0,
    test_required_dimension_count: test.required_dimension_count ?? 0,
    test_passed_required_dimension_count: test.passed_required_dimension_count ?? 0,
    test_failed_dimension_count: test.failed_dimension_count ?? 0,
    pr_draft_output_artifact_count: pr.pr_draft_output_artifact_count ?? 0,
    pr_risk_count: pr.risk_count ?? 0,
    pr_rollback_command_target_count: rollback.rollback_command_target_count ?? 0,
    pr_technical_debt_task_count: debt.technical_debt_task_count ?? 0,
    status_rollup_count: statusRollups.length,
    ready_status_rollup_count: statusRollups.filter((rollup) => rollup.rollup_status === "ready").length,
    api_route_binding_count: apiRouteBindings.length,
    active_api_route_binding_count: apiRouteBindings.filter((binding) => binding.route_binding_status === "active").length,
    read_only_api_route_binding_count: apiRouteBindings.filter((binding) => binding.read_only === true && binding.mutation_allowed === false).length,
    route_count: apiRouteBindings.reduce((total, binding) => total + (binding.route_count ?? 0), 0),
    mutation_performed: false,
    command_execution_performed: false,
    task_state_write_performed: false,
    issue_mutation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    pull_request_creation_performed: false,
    merge_performed: false,
    release_performed: false,
    protected_mutation_performed: false,
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
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((item) => item.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((item) => item.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_panel_section: countBy(panelRows, "panel_section"),
    by_panel_status: countBy(panelRows, "panel_status"),
    by_route_group: countBy(apiRouteBindings, "route_group"),
    by_route_binding_status: countBy(apiRouteBindings, "route_binding_status"),
  };
}

function buildSourceSummary(sourceId, artifact, status) {
  return {
    schema_version: "personal-dev-dashboard-source-summary.v1",
    source_id: sourceId,
    source_status: status ?? "unknown",
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceContracts(readResults) {
  return [
    sourceContract("package_json", "package.json", readResults.packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", readResults.roadmapText),
    sourceContract("repo_profile_detector", "artifacts/repo-profile-detector/latest/repo-profile-detector.json", readResults.repoProfileDetector),
    sourceContract("dev_lane_ledger", "artifacts/dev-lane-ledger/latest/dev-lane-ledger.json", readResults.devLaneLedger),
    sourceContract("plan_reconciliation", "artifacts/plan-reconciliation/latest/plan-reconciliation.json", readResults.planReconciliation),
    sourceContract("scope_freeze_gate", "artifacts/scope-freeze-gate/latest/scope-freeze-gate.json", readResults.scopeFreezeGate),
    sourceContract("implementation_patch_capture", "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json", readResults.implementationPatchCapture),
    sourceContract("diff_review_gate", "artifacts/diff-review-gate/latest/diff-review-gate.json", readResults.diffReviewGate),
    sourceContract("canonical_test_matrix", "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json", readResults.canonicalTestMatrix),
    sourceContract("pr_draft_artifact", "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json", readResults.prDraftArtifact),
    sourceContract("release_note_artifact", "artifacts/release-note-artifact/latest/release-note-artifact.json", readResults.releaseNoteArtifact),
    sourceContract("rollback_plan_artifact", "artifacts/rollback-plan-artifact/latest/rollback-plan-artifact.json", readResults.rollbackPlanArtifact),
    sourceContract("technical_debt_ledger", "artifacts/technical-debt-ledger/latest/technical-debt-ledger.json", readResults.technicalDebtLedger),
  ];
}

function sourceContract(sourceId, sourcePath, readResult) {
  const value = readResult.value ?? readResult;
  return {
    schema_version: "personal-dev-dashboard-api-source-contract.v1",
    source_id: sourceId,
    source_path: sourcePath,
    source_status: readResult.error ? "missing" : "available",
    error: readResult.error ?? null,
    source_hash: hashObject(value ?? {}),
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    schema_version: "personal-dev-dashboard-api-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message, status: item.status }));
  return {
    schema_version: "personal-dev-dashboard-api-validation.v1",
    valid: errors.length === 0,
    errors,
  };
}

function renderPanelMarkdown({ panelRows, apiRouteBindings, generatedAt }) {
  const lines = [];
  lines.push("# Personal Dev Dashboard/API Panel");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("## Panel Rows");
  for (const row of panelRows) lines.push(`- ${row.panel_section}: ${row.panel_status}; ${row.summary_line}`);
  lines.push("");
  lines.push("## API Route Bindings");
  for (const binding of apiRouteBindings) lines.push(`- ${binding.route_group}: ${binding.route_count} route(s), ${binding.route_binding_status}, read-only true`);
  lines.push("");
  lines.push("Human review note: this panel is a read-only operational view. Task writes, issue mutation, command execution, PR creation, branch push, merge, release, protected writes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Personal Dev Dashboard API");
  lines.push("");
  lines.push(`Status: ${result.summary.personal_dev_dashboard_api_status}`);
  lines.push(`Panel rows: ${result.summary.panel_row_count}`);
  lines.push(`API route bindings: ${result.summary.api_route_binding_count}`);
  lines.push(`Routes: ${result.summary.route_count}`);
  lines.push(`Mutation performed: ${result.summary.mutation_performed}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: the personal-dev panel/API is read-only. Writes, command execution, PR creation, merge, release, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function serializablePersonalDevDashboardApi(result) {
  const { markdown: _markdown, summary_markdown: _summaryMarkdown, output_dir: _outputDir, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.roadmapPath,
    repo_profile_detector_path: path.resolve(options.repoProfileDetectorPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.repoProfileDetectorPath),
    dev_lane_ledger_path: path.resolve(options.devLaneLedgerPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.devLaneLedgerPath),
    plan_reconciliation_path: path.resolve(options.planReconciliationPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.planReconciliationPath),
    scope_freeze_gate_path: path.resolve(options.scopeFreezeGatePath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.scopeFreezeGatePath),
    implementation_patch_capture_path: path.resolve(options.implementationPatchCapturePath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.implementationPatchCapturePath),
    diff_review_gate_path: path.resolve(options.diffReviewGatePath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.diffReviewGatePath),
    canonical_test_matrix_path: path.resolve(options.canonicalTestMatrixPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.canonicalTestMatrixPath),
    pr_draft_artifact_path: path.resolve(options.prDraftArtifactPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.prDraftArtifactPath),
    release_note_artifact_path: path.resolve(options.releaseNoteArtifactPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.releaseNoteArtifactPath),
    rollback_plan_artifact_path: path.resolve(options.rollbackPlanArtifactPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.rollbackPlanArtifactPath),
    technical_debt_ledger_path: path.resolve(options.technicalDebtLedgerPath ?? DEFAULT_PERSONAL_DEV_DASHBOARD_API_INPUTS.technicalDebtLedgerPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--repo-profile-detector") parsed.repoProfileDetectorPath = argv[++index];
    else if (arg === "--dev-lane-ledger") parsed.devLaneLedgerPath = argv[++index];
    else if (arg === "--plan-reconciliation") parsed.planReconciliationPath = argv[++index];
    else if (arg === "--scope-freeze-gate") parsed.scopeFreezeGatePath = argv[++index];
    else if (arg === "--implementation-patch-capture") parsed.implementationPatchCapturePath = argv[++index];
    else if (arg === "--diff-review-gate") parsed.diffReviewGatePath = argv[++index];
    else if (arg === "--canonical-test-matrix") parsed.canonicalTestMatrixPath = argv[++index];
    else if (arg === "--pr-draft-artifact") parsed.prDraftArtifactPath = argv[++index];
    else if (arg === "--release-note-artifact") parsed.releaseNoteArtifactPath = argv[++index];
    else if (arg === "--rollback-plan-artifact") parsed.rollbackPlanArtifactPath = argv[++index];
    else if (arg === "--technical-debt-ledger") parsed.technicalDebtLedgerPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/personal-dev-dashboard-api.mjs [options]

Options:
  --check                             Fail when validation does not pass
  --no-write                          Build without writing artifacts
  --out-dir <path>                    Output directory
  --repo-root <path>                  Repository root
  --package <path>                    package.json path relative to repo root
  --roadmap <path>                    final completion ledger path relative to repo root
  --repo-profile-detector <path>      repo-profile-detector.json path
  --dev-lane-ledger <path>            dev-lane-ledger.json path
  --plan-reconciliation <path>        plan-reconciliation.json path
  --scope-freeze-gate <path>          scope-freeze-gate.json path
  --implementation-patch-capture <path> implementation-patch-capture.json path
  --diff-review-gate <path>           diff-review-gate.json path
  --canonical-test-matrix <path>      canonical-test-matrix.json path
  --pr-draft-artifact <path>          pr-draft-artifact.json path
  --release-note-artifact <path>      release-note-artifact.json path
  --rollback-plan-artifact <path>     rollback-plan-artifact.json path
  --technical-debt-ledger <path>      technical-debt-ledger.json path`);
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { value: null, error: `${error.name}: ${error.message}` };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8") };
  } catch (error) {
    return { value: "", error: `${error.name}: ${error.message}` };
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

function hashObject(value) {
  return hashText(JSON.stringify(value ?? null));
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function dateStamp(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
