import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_TECHNICAL_DEBT_LEDGER_OUT_DIR = "artifacts/technical-debt-ledger/latest";
export const DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  issueIntakeAdapterPath: "artifacts/issue-intake-adapter/latest/issue-intake-adapter.json",
  planReconciliationPath: "artifacts/plan-reconciliation/latest/plan-reconciliation.json",
  prDraftArtifactPath: "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json",
  releaseNoteArtifactPath: "artifacts/release-note-artifact/latest/release-note-artifact.json",
  rollbackPlanArtifactPath: "artifacts/rollback-plan-artifact/latest/rollback-plan-artifact.json",
};

const CONTRACT_ID = "technical-debt-ledger.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const LEDGER_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "human_gated_personal_dev_debt_findings_preserved_as_read_only_tasks";
const DESKTOP_SURFACE_POLICY = "read_only_technical_debt_task_review_surface";

export async function runTechnicalDebtLedger(options = {}) {
  const result = await buildTechnicalDebtLedger(options);
  if (options.write !== false) await writeTechnicalDebtLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Technical debt ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildTechnicalDebtLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_TECHNICAL_DEBT_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const issueIntakeAdapter = await readJsonOrError(inputs.issue_intake_adapter_path);
  const planReconciliation = await readJsonOrError(inputs.plan_reconciliation_path);
  const prDraftArtifact = await readJsonOrError(inputs.pr_draft_artifact_path);
  const releaseNoteArtifact = await readJsonOrError(inputs.release_note_artifact_path);
  const rollbackPlanArtifact = await readJsonOrError(inputs.rollback_plan_artifact_path);
  const issueIntake = issueIntakeAdapter.value ?? {};
  const plan = planReconciliation.value ?? {};
  const prDraft = prDraftArtifact.value ?? {};
  const releaseNote = releaseNoteArtifact.value ?? {};
  const rollbackPlan = rollbackPlanArtifact.value ?? {};
  const findings = buildDebtSourceFindings({ plan, prDraft, generatedAt });
  const tasks = buildTechnicalDebtTasks({ findings, issueIntake, generatedAt });
  const markdown = renderTechnicalDebtLedgerMarkdown({ findings, tasks, generatedAt });
  const outputArtifacts = buildOutputArtifacts({ releaseNote, rollbackPlan, markdown, generatedAt });
  const bindings = buildDebtTaskBindings({ findings, tasks, releaseNote, rollbackPlan, outputArtifacts, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    issueIntake,
    issueIntakeError: issueIntakeAdapter.error,
    plan,
    planError: planReconciliation.error,
    prDraft,
    prDraftError: prDraftArtifact.error,
    releaseNote,
    releaseNoteError: releaseNoteArtifact.error,
    rollbackPlan,
    rollbackPlanError: rollbackPlanArtifact.error,
    findings,
    tasks,
    outputArtifacts,
    bindings,
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
  const summary = summarizeTechnicalDebtLedger({
    issueIntake,
    plan,
    prDraft,
    releaseNote,
    rollbackPlan,
    findings,
    tasks,
    outputArtifacts,
    bindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    technical_debt_ledger_id: `technical-debt-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    technical_debt_ledger_status: summary.technical_debt_ledger_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, issueIntakeAdapter, planReconciliation, prDraftArtifact, releaseNoteArtifact, rollbackPlanArtifact }),
    technical_debt_contract: buildContract(generatedAt),
    source_issue_intake_adapter: buildSourceIssueIntakeAdapter(issueIntake),
    source_plan_reconciliation: buildSourcePlanReconciliation(plan),
    source_pr_draft_artifact: buildSourcePrDraftArtifact(prDraft),
    source_release_note_artifact: buildSourceReleaseNoteArtifact(releaseNote),
    source_rollback_plan_artifact: buildSourceRollbackPlanArtifact(rollbackPlan),
    technical_debt_output_artifacts: outputArtifacts,
    debt_source_findings: findings,
    technical_debt_tasks: tasks,
    debt_task_bindings: bindings,
    technical_debt_desktop_boundary: desktopBoundary,
    technical_debt_checkpoints: checkpoints,
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

export async function writeTechnicalDebtLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableTechnicalDebtLedger(result);
  await writeJson(path.join(outDir, "technical-debt-ledger.json"), serializable);
  await writeFile(path.join(outDir, "technical-debt-ledger.md"), result.markdown, "utf8");
  await writeJson(path.join(outDir, "technical-debt-output-artifacts.json"), {
    schema_version: "technical-debt-output-artifacts.v1",
    generated_at: result.generated_at,
    technical_debt_output_artifact_count: result.technical_debt_output_artifacts.length,
    technical_debt_output_artifacts: result.technical_debt_output_artifacts,
  });
  await writeJson(path.join(outDir, "debt-source-findings.json"), {
    schema_version: "debt-source-findings.v1",
    generated_at: result.generated_at,
    debt_source_finding_count: result.debt_source_findings.length,
    debt_source_findings: result.debt_source_findings,
  });
  await writeJson(path.join(outDir, "technical-debt-tasks.json"), {
    schema_version: "technical-debt-tasks.v1",
    generated_at: result.generated_at,
    technical_debt_task_count: result.technical_debt_tasks.length,
    technical_debt_tasks: result.technical_debt_tasks,
  });
  await writeJson(path.join(outDir, "debt-task-bindings.json"), {
    schema_version: "debt-task-bindings.v1",
    generated_at: result.generated_at,
    debt_task_binding_count: result.debt_task_bindings.length,
    debt_task_bindings: result.debt_task_bindings,
  });
  await writeJson(path.join(outDir, "technical-debt-desktop-boundary.json"), {
    schema_version: "technical-debt-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    technical_debt_desktop_boundary: result.technical_debt_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "technical-debt-validation-report.v1",
    generated_at: result.generated_at,
    technical_debt_ledger_id: result.technical_debt_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runTechnicalDebtLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runTechnicalDebtLedger(args);
    console.log(`Technical debt ledger ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.technical_debt_ledger_status}`);
    console.log(`Source findings: ${result.summary.debt_source_finding_count}`);
    console.log(`Technical debt tasks: ${result.summary.technical_debt_task_count}`);
    console.log(`Task-state writes: ${result.summary.task_state_write_performed_count}`);
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
    schema_version: "technical-debt-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    ledger_authority: LEDGER_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    finding_rule: "unresolved_plan_questions_and_pr_draft_risks_are_preserved_as_debt_findings",
    task_rule: "each_debt_finding_gets_one_read_only_technical_debt_task_without_mutating_task_state",
    binding_rule: "each_task_remains_bound_to_its_source_finding_and_human_review_output_artifact",
    desktop_companion_rule: "desktop_companion_reads_debt_findings_tasks_bindings_and_validation_only",
    human_review_rule: "task_creation_issue_tracker_updates_and_protected_remediation_remain_human_gated",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    technical_debt_ledger_generated: true,
    issue_mutation_performed: false,
    task_state_write_performed: false,
    external_fetch_performed: false,
    command_execution_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed_outside_artifact_dir: false,
    protected_mutation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    merge_performed: false,
    release_performed: false,
    patch_application_performed: false,
    external_agent_invocation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function buildSourceIssueIntakeAdapter(artifact) {
  return {
    schema_version: "source-issue-intake-adapter-for-technical-debt.v1",
    issue_intake_adapter_id: artifact.issue_intake_adapter_id ?? null,
    issue_intake_status: artifact.summary?.issue_intake_status ?? "unknown",
    normalized_task_count: artifact.summary?.normalized_task_count ?? 0,
    ready_normalized_task_count: artifact.summary?.ready_normalized_task_count ?? 0,
    task_state_write_allowed: artifact.summary?.desktop_task_state_write_allowed ?? false,
    task_state_write_performed_count: artifact.summary?.task_state_mutation_performed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourcePlanReconciliation(artifact) {
  return {
    schema_version: "source-plan-reconciliation-for-technical-debt.v1",
    plan_reconciliation_id: artifact.plan_reconciliation_id ?? null,
    plan_reconciliation_status: artifact.summary?.plan_reconciliation_status ?? "unknown",
    unresolved_question_count: artifact.summary?.unresolved_question_count ?? artifact.unresolved_plan_questions?.length ?? 0,
    non_blocking_unresolved_question_count: artifact.summary?.non_blocking_unresolved_question_count ?? 0,
    unresolved_conflict_count: artifact.summary?.unresolved_conflict_count ?? 0,
    plan_acceptance_performed_count: artifact.summary?.plan_acceptance_performed_count ?? 0,
    command_execution_performed_count: artifact.summary?.command_execution_performed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourcePrDraftArtifact(artifact) {
  return {
    schema_version: "source-pr-draft-artifact-for-technical-debt.v1",
    pr_draft_artifact_id: artifact.pr_draft_artifact_id ?? null,
    pr_draft_artifact_status: artifact.summary?.pr_draft_artifact_status ?? "unknown",
    risk_count: artifact.summary?.risk_count ?? artifact.pr_draft_risks?.length ?? 0,
    high_risk_count: artifact.summary?.high_risk_count ?? (artifact.pr_draft_risks ?? []).filter((risk) => risk.risk_level === "high").length,
    merge_performed: artifact.summary?.merge_performed ?? false,
    release_performed: artifact.summary?.release_performed ?? false,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceReleaseNoteArtifact(artifact) {
  const riskSection = (artifact.release_note_sections ?? []).find((section) => section.section_type === "risks");
  return {
    schema_version: "source-release-note-artifact-for-technical-debt.v1",
    release_note_artifact_id: artifact.release_note_artifact_id ?? null,
    release_note_artifact_status: artifact.summary?.release_note_artifact_status ?? "unknown",
    risks_section_present: Boolean(riskSection),
    ready_risks_section_count: riskSection?.section_status === "draft_ready_for_human_review" ? 1 : 0,
    merge_performed: artifact.summary?.merge_performed ?? false,
    release_performed: artifact.summary?.release_performed ?? false,
    publication_performed: artifact.summary?.release_note_publication_performed ?? false,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceRollbackPlanArtifact(artifact) {
  return {
    schema_version: "source-rollback-plan-artifact-for-technical-debt.v1",
    rollback_plan_artifact_id: artifact.rollback_plan_artifact_id ?? null,
    rollback_plan_artifact_status: artifact.summary?.rollback_plan_artifact_status ?? "unknown",
    rollback_command_target_count: artifact.summary?.rollback_command_target_count ?? artifact.rollback_command_targets?.length ?? 0,
    rollback_execution_performed: artifact.summary?.rollback_execution_performed ?? false,
    command_execution_performed: artifact.summary?.command_execution_performed ?? false,
    file_restore_performed_count: artifact.summary?.file_restore_performed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildDebtSourceFindings({ plan, prDraft, generatedAt }) {
  const planFindings = (plan.unresolved_plan_questions ?? []).map((question, index) => {
    const key = slugify(question.question_id ?? `plan-question-${index + 1}`);
    const finding = {
      schema_version: "debt-source-finding.v1",
      debt_source_finding_id: `debt-source-finding.plan.${key}`,
      generated_at: generatedAt,
      source_type: "plan_reconciliation_unresolved_question",
      source_artifact_id: plan.plan_reconciliation_id ?? null,
      source_record_id: question.question_id ?? null,
      finding_key: key,
      finding_title: question.question ?? "Unresolved plan question",
      finding_summary: question.question ?? "Unresolved plan question requires owner decision.",
      finding_status: "open_for_triage",
      source_status: question.question_status ?? "unknown",
      debt_category: question.related_scope_item === "future_external_plan_submission_policy" ? "future_agent_workflow_policy" : "scope_freeze_follow_up",
      severity: "medium",
      required_owner: question.required_owner ?? "human_reviewer",
      mitigation: "Convert the question into a reviewed backlog decision before live execution or scope changes.",
      preserve_as_task_required: true,
      resolved_by_current_phase: false,
      human_review_required: true,
    };
    return {
      ...finding,
      debt_source_finding_hash: hashObject(finding),
    };
  });

  const riskFindings = (prDraft.pr_draft_risks ?? []).map((risk, index) => {
    const key = slugify(risk.risk_key ?? `pr-risk-${index + 1}`);
    const finding = {
      schema_version: "debt-source-finding.v1",
      debt_source_finding_id: `debt-source-finding.pr-risk.${key}`,
      generated_at: generatedAt,
      source_type: "pr_draft_risk",
      source_artifact_id: prDraft.pr_draft_artifact_id ?? null,
      source_record_id: risk.pr_draft_risk_id ?? null,
      finding_key: key,
      finding_title: titleFromKey(risk.risk_key ?? key),
      finding_summary: risk.risk_summary ?? "PR draft risk requires follow-up.",
      finding_status: "open_for_triage",
      source_status: risk.risk_status ?? "unknown",
      debt_category: debtCategoryForRisk(risk.risk_key),
      severity: risk.risk_level ?? "medium",
      required_owner: "human_reviewer",
      mitigation: risk.mitigation ?? "Review and close the risk before merge or release.",
      preserve_as_task_required: true,
      resolved_by_current_phase: false,
      human_review_required: true,
    };
    return {
      ...finding,
      debt_source_finding_hash: hashObject(finding),
    };
  });

  return [...planFindings, ...riskFindings];
}

function buildTechnicalDebtTasks({ findings, issueIntake, generatedAt }) {
  const repoTask = issueIntake.normalized_task_contracts?.[0] ?? {};
  return findings.map((finding, index) => {
    const task = {
      schema_version: "technical-debt-task.v1",
      technical_debt_task_id: `technical-debt-task.${finding.finding_key}`,
      task_contract_id: `technical-debt-task-contract.${finding.finding_key}`,
      task_id: `task.personal-dev.tech-debt.${finding.finding_key}`,
      generated_at: generatedAt,
      sequence: index + 1,
      source_finding_id: finding.debt_source_finding_id,
      source_type: finding.source_type,
      source_artifact_id: finding.source_artifact_id,
      source_record_id: finding.source_record_id,
      task_title: finding.finding_title,
      task_description: `${finding.finding_summary} Mitigation: ${finding.mitigation}`,
      task_status: "backlog",
      normalized_task_status: "ready_for_backlog",
      preservation_status: "preserved_as_task",
      task_priority: priorityForSeverity(finding.severity),
      task_kind: "technical_debt",
      debt_category: finding.debt_category,
      owner: finding.required_owner,
      pack_id: PACK_ID,
      capability_id: CAPABILITY_ID,
      repository: repoTask.repository ?? null,
      repo_profile_id: repoTask.repo_profile_id ?? null,
      primary_language_id: repoTask.primary_language_id ?? null,
      source_system: "hermes_control_plane",
      labels: ["personal-dev", "technical-debt", finding.debt_category],
      due_date: null,
      estimate_minutes: null,
      human_review_required: true,
      task_state_write_allowed: false,
      task_state_write_performed: false,
      external_issue_mutation_allowed: false,
      external_issue_mutation_performed: false,
      command_execution_allowed: false,
      command_execution_performed: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      desktop_source_of_truth: false,
      protected_mutations_require_human_gate: true,
      source_payload_hash: `sha256:${finding.debt_source_finding_hash}`,
    };
    return {
      ...task,
      technical_debt_task_hash: hashObject(task),
    };
  });
}

function buildOutputArtifacts({ releaseNote, rollbackPlan, markdown, generatedAt }) {
  const sourceOutput = rollbackPlan.rollback_output_artifacts?.[0] ?? releaseNote.release_note_output_artifacts?.[0] ?? {};
  return [{
    schema_version: "output-artifact.v2",
    output_artifact_id: "output.personal_dev.p228.technical_debt_ledger",
    source_output_artifact_id: sourceOutput.output_artifact_id ?? null,
    source_id: "technical_debt_ledger",
    source_label: "Technical Debt Ledger",
    domain_pack: "personal-dev",
    capability_id: CAPABILITY_ID,
    workflow_run_id: sourceOutput.workflow_run_id ?? "workflow-run.personal_dev.p228.technical_debt_ledger",
    tenant_id: sourceOutput.tenant_id ?? "tenant.personal.jws",
    matter_id: sourceOutput.matter_id ?? "matter.personal_dev.hermes",
    artifact_type: "task_update",
    artifact_uri: "artifacts/technical-debt-ledger/latest/technical-debt-ledger.md",
    content_hash: hashText(markdown),
    hash_algorithm: "sha256",
    hash_status: "present",
    output_status: "draft",
    delivery_state: "blocked_pending_approval",
    delivery_state_after_receipt: "ready_for_delivery",
    approval_id: "approval.personal_dev.p228.technical_debt_ledger.human_review",
    approval_status: "pending",
    approval_request_ids: ["approval.personal_dev.p228.technical_debt_ledger.human_review"],
    approval_request_count: 1,
    delivery_action_ids: ["delivery.personal_dev.p228.technical_debt_ledger"],
    delivery_action_count: 1,
    delivery_receipt_ids: [],
    delivery_receipt_count: 0,
    blocking_gate_ids: ["human_approval_gate"],
    blocking_gate_count: 1,
    citation_count: 0,
    created_by_run_id: "agent-run.personal_dev.p228.technical_debt_ledger",
    created_at: generatedAt,
    recorded_at: generatedAt,
    approval_separation_status: "approval_required_not_applied",
    delivery_separation_status: "separate_delivery_action_declared",
    receipt_separation_status: "receipt_required_before_delivery",
    event_id: "event.output.rendered.personal_dev.p228.technical_debt_ledger",
    policy_snapshot_id: sourceOutput.policy_snapshot_id ?? "policy.default.personal_dev.v1",
    metadata: {
      title: "Hermes Personal Dev technical debt ledger draft",
      task_update_performed: false,
      debt_findings_preserved_as_tasks: true,
    },
  }];
}

function buildDebtTaskBindings({ findings, tasks, releaseNote, rollbackPlan, outputArtifacts, generatedAt }) {
  const outputArtifact = outputArtifacts[0];
  const riskSectionIds = (releaseNote.release_note_sections ?? [])
    .filter((section) => ["risks", "human_review"].includes(section.section_type))
    .map((section) => section.release_note_section_id)
    .filter(Boolean);
  const rollbackBindingIds = (rollbackPlan.rollback_plan_bindings ?? [])
    .map((binding) => binding.rollback_plan_binding_id)
    .filter(Boolean);
  return tasks.map((task) => {
    const finding = findings.find((item) => item.debt_source_finding_id === task.source_finding_id) ?? {};
    const binding = {
      schema_version: "debt-task-binding.v1",
      debt_task_binding_id: `debt-task-binding.${task.technical_debt_task_id.replace(/^technical-debt-task\./, "")}`,
      generated_at: generatedAt,
      source_finding_id: task.source_finding_id,
      source_type: task.source_type,
      source_record_id: task.source_record_id,
      technical_debt_task_id: task.technical_debt_task_id,
      task_id: task.task_id,
      output_artifact_id: outputArtifact.output_artifact_id,
      source_release_note_section_ids: riskSectionIds,
      source_rollback_plan_binding_ids: rollbackBindingIds,
      debt_task_binding_status: "bound_to_technical_debt_ledger",
      source_binding_status: "source_finding_preserved",
      preservation_status: task.preservation_status,
      task_state_write_allowed: false,
      task_state_write_performed: false,
      issue_mutation_allowed: false,
      issue_mutation_performed: false,
      command_execution_allowed: false,
      command_execution_performed: false,
      protected_mutation_allowed: false,
      protected_mutation_performed: false,
      human_review_required: true,
    };
    return {
      ...binding,
      debt_task_binding_hash: hashObject({ binding, finding }),
    };
  });
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "technical-debt-desktop-boundary.v1",
    boundary_id: "technical-debt-desktop-boundary.personal-dev",
    generated_at: generatedAt,
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    visible_collections: ["debt_source_findings", "technical_debt_tasks", "debt_task_bindings", "validation_items"],
    read_only: true,
    mutation_allowed: false,
    task_state_write_allowed: false,
    issue_mutation_allowed: false,
    external_fetch_allowed: false,
    command_execution_allowed: false,
    git_command_allowed: false,
    github_api_allowed: false,
    branch_push_allowed: false,
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
  issueIntake,
  issueIntakeError,
  plan,
  planError,
  prDraft,
  prDraftError,
  releaseNote,
  releaseNoteError,
  rollbackPlan,
  rollbackPlanError,
  findings,
  tasks,
  outputArtifacts,
  bindings,
  desktopBoundary,
}) {
  const sourceFindingCount = (plan.unresolved_plan_questions ?? []).length + (prDraft.pr_draft_risks ?? []).length;
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:technical-debt"]), "package.json exposes personal-dev:technical-debt."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P228") && String(roadmapText ?? "").includes("technical debt ledger"), "Final completion ledger declares P228 technical debt ledger."),
    checkpoint("issue_intake_adapter_complete", !issueIntakeError && issueIntake.summary?.issue_intake_status === "complete" && issueIntake.summary?.ready_normalized_task_count >= 3 && issueIntake.summary?.validation_error_count === 0, "Issue Intake Adapter contributes normalized task contract shape."),
    checkpoint("plan_reconciliation_questions_available", !planError && plan.summary?.plan_reconciliation_status === "complete" && plan.summary?.unresolved_question_count >= 1 && plan.summary?.validation_error_count === 0, "Plan Reconciliation contributes unresolved questions."),
    checkpoint("pr_draft_risks_available", !prDraftError && prDraft.summary?.pr_draft_artifact_status === "complete" && prDraft.summary?.risk_count >= 4 && prDraft.summary?.validation_error_count === 0, "PR Draft Artifact contributes documented risks."),
    checkpoint("release_note_risks_available", !releaseNoteError && releaseNote.summary?.release_note_artifact_status === "complete" && releaseNote.summary?.risks_section_present === true && releaseNote.summary?.validation_error_count === 0, "Release Note Artifact keeps risks visible for reviewers."),
    checkpoint("rollback_plan_available", !rollbackPlanError && rollbackPlan.summary?.rollback_plan_artifact_status === "complete" && rollbackPlan.summary?.rollback_command_target_count >= 3 && rollbackPlan.summary?.validation_error_count === 0, "Rollback Plan Artifact is available before debt preservation."),
    checkpoint("debt_source_findings_declared", findings.length === sourceFindingCount && findings.length >= 6 && findings.every((finding) => finding.finding_status === "open_for_triage" && finding.preserve_as_task_required === true), "Every unresolved question and PR draft risk is declared as a debt source finding."),
    checkpoint("technical_debt_tasks_preserved", tasks.length === findings.length && tasks.every((task) => task.preservation_status === "preserved_as_task" && task.task_status === "backlog" && task.task_state_write_performed === false && task.command_execution_performed === false), "Every debt finding is preserved as a backlog task without task-state writes."),
    checkpoint("debt_task_bindings_complete", bindings.length === tasks.length && bindings.every((binding) => binding.debt_task_binding_status === "bound_to_technical_debt_ledger" && binding.task_state_write_performed === false && binding.issue_mutation_performed === false), "Debt tasks remain bound to their source findings without issue mutation."),
    checkpoint("technical_debt_output_artifact_stored", outputArtifacts.length === 1 && outputArtifacts.every((artifact) => artifact.schema_version === "output-artifact.v2" && artifact.artifact_type === "task_update" && artifact.output_status === "draft" && artifact.delivery_state === "blocked_pending_approval"), "Technical debt ledger is stored as a draft task_update OutputArtifact v2."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.task_state_write_allowed === false && desktopBoundary.issue_mutation_allowed === false && desktopBoundary.command_execution_allowed === false && desktopBoundary.source_of_truth === false, "Desktop technical debt boundary is read-only and not source of truth."),
  ];
}

function summarizeTechnicalDebtLedger({
  issueIntake,
  plan,
  prDraft,
  releaseNote,
  rollbackPlan,
  findings,
  tasks,
  outputArtifacts,
  bindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    technical_debt_ledger_status: validation.valid ? "complete" : "blocked",
    technical_debt_ledger_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    ledger_authority: LEDGER_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_issue_intake_status: issueIntake.summary?.issue_intake_status ?? "unknown",
    source_plan_reconciliation_status: plan.summary?.plan_reconciliation_status ?? "unknown",
    source_pr_draft_artifact_status: prDraft.summary?.pr_draft_artifact_status ?? "unknown",
    source_release_note_artifact_status: releaseNote.summary?.release_note_artifact_status ?? "unknown",
    source_rollback_plan_artifact_status: rollbackPlan.summary?.rollback_plan_artifact_status ?? "unknown",
    source_normalized_task_count: issueIntake.summary?.normalized_task_count ?? 0,
    source_unresolved_question_count: plan.summary?.unresolved_question_count ?? 0,
    source_pr_draft_risk_count: prDraft.summary?.risk_count ?? 0,
    source_release_note_risks_section_present: releaseNote.summary?.risks_section_present ?? false,
    source_rollback_command_target_count: rollbackPlan.summary?.rollback_command_target_count ?? 0,
    technical_debt_output_artifact_count: outputArtifacts.length,
    output_artifact_v2_count: outputArtifacts.filter((artifact) => artifact.schema_version === "output-artifact.v2").length,
    output_artifact_hash_present_count: outputArtifacts.filter((artifact) => artifact.hash_status === "present").length,
    output_artifact_draft_count: outputArtifacts.filter((artifact) => artifact.output_status === "draft").length,
    output_artifact_blocked_pending_approval_count: outputArtifacts.filter((artifact) => artifact.delivery_state === "blocked_pending_approval").length,
    output_artifact_pending_approval_count: outputArtifacts.filter((artifact) => artifact.approval_status === "pending").length,
    debt_source_finding_count: findings.length,
    plan_question_finding_count: findings.filter((finding) => finding.source_type === "plan_reconciliation_unresolved_question").length,
    pr_risk_finding_count: findings.filter((finding) => finding.source_type === "pr_draft_risk").length,
    open_for_triage_finding_count: findings.filter((finding) => finding.finding_status === "open_for_triage").length,
    high_severity_finding_count: findings.filter((finding) => finding.severity === "high").length,
    technical_debt_task_count: tasks.length,
    preserved_task_count: tasks.filter((task) => task.preservation_status === "preserved_as_task").length,
    backlog_task_count: tasks.filter((task) => task.task_status === "backlog").length,
    p1_task_count: tasks.filter((task) => task.task_priority === "p1").length,
    p2_task_count: tasks.filter((task) => task.task_priority === "p2").length,
    debt_task_binding_count: bindings.length,
    bound_debt_task_binding_count: bindings.filter((binding) => binding.debt_task_binding_status === "bound_to_technical_debt_ledger").length,
    task_state_write_allowed_count: tasks.filter((task) => task.task_state_write_allowed).length + bindings.filter((binding) => binding.task_state_write_allowed).length,
    task_state_write_performed_count: tasks.filter((task) => task.task_state_write_performed).length + bindings.filter((binding) => binding.task_state_write_performed).length,
    issue_mutation_allowed_count: tasks.filter((task) => task.external_issue_mutation_allowed).length + bindings.filter((binding) => binding.issue_mutation_allowed).length,
    issue_mutation_performed_count: tasks.filter((task) => task.external_issue_mutation_performed).length + bindings.filter((binding) => binding.issue_mutation_performed).length,
    command_execution_allowed_count: tasks.filter((task) => task.command_execution_allowed).length + bindings.filter((binding) => binding.command_execution_allowed).length,
    command_execution_performed_count: tasks.filter((task) => task.command_execution_performed).length + bindings.filter((binding) => binding.command_execution_performed).length,
    github_api_called: false,
    branch_push_performed: false,
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
    desktop_external_fetch_allowed: desktopBoundary.external_fetch_allowed,
    desktop_command_execution_allowed: desktopBoundary.command_execution_allowed,
    desktop_git_command_allowed: desktopBoundary.git_command_allowed,
    desktop_github_api_allowed: desktopBoundary.github_api_allowed,
    desktop_branch_push_allowed: desktopBoundary.branch_push_allowed,
    desktop_merge_allowed: desktopBoundary.merge_allowed,
    desktop_release_allowed: desktopBoundary.release_allowed,
    desktop_patch_application_allowed: desktopBoundary.patch_application_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
    desktop_secret_material_read_allowed: desktopBoundary.secret_material_read_allowed,
    desktop_production_config_write_allowed: desktopBoundary.production_config_write_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((item) => item.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((item) => item.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_finding_source_type: countBy(findings, "source_type"),
    by_finding_status: countBy(findings, "finding_status"),
    by_task_status: countBy(tasks, "task_status"),
    by_task_priority: countBy(tasks, "task_priority"),
    by_binding_status: countBy(bindings, "debt_task_binding_status"),
  };
}

function buildSourceContracts({ packageJson, roadmapText, issueIntakeAdapter, planReconciliation, prDraftArtifact, releaseNoteArtifact, rollbackPlanArtifact }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("issue_intake_adapter", "artifacts/issue-intake-adapter/latest/issue-intake-adapter.json", issueIntakeAdapter),
    sourceContract("plan_reconciliation", "artifacts/plan-reconciliation/latest/plan-reconciliation.json", planReconciliation),
    sourceContract("pr_draft_artifact", "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json", prDraftArtifact),
    sourceContract("release_note_artifact", "artifacts/release-note-artifact/latest/release-note-artifact.json", releaseNoteArtifact),
    sourceContract("rollback_plan_artifact", "artifacts/rollback-plan-artifact/latest/rollback-plan-artifact.json", rollbackPlanArtifact),
  ];
}

function sourceContract(sourceId, sourcePath, readResult) {
  const value = readResult.value ?? readResult;
  return {
    schema_version: "technical-debt-source-contract.v1",
    source_id: sourceId,
    source_path: sourcePath,
    source_status: readResult.error ? "missing" : "available",
    error: readResult.error ?? null,
    source_hash: hashObject(value ?? {}),
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    schema_version: "technical-debt-checkpoint.v1",
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
    schema_version: "technical-debt-validation.v1",
    valid: errors.length === 0,
    errors,
  };
}

function renderTechnicalDebtLedgerMarkdown({ findings, tasks, generatedAt }) {
  const lines = [];
  lines.push("# Technical Debt Ledger Draft: Hermes Personal Dev");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("## Source Findings");
  for (const finding of findings) lines.push(`- ${finding.source_type}: ${finding.finding_title} (${finding.severity}, ${finding.finding_status})`);
  lines.push("");
  lines.push("## Preserved Tasks");
  for (const task of tasks) lines.push(`- ${task.task_priority} ${task.task_id}: ${task.task_title} (${task.task_status}, write performed false)`);
  lines.push("");
  lines.push("Human review note: this ledger preserves unresolved engineering issues as read-only backlog task drafts. Task state writes, issue tracker mutation, command execution, protected writes, branch pushes, merge, release, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Technical Debt Ledger");
  lines.push("");
  lines.push(`Status: ${result.summary.technical_debt_ledger_status}`);
  lines.push(`Source findings: ${result.summary.debt_source_finding_count}`);
  lines.push(`Technical debt tasks: ${result.summary.technical_debt_task_count}`);
  lines.push(`Bindings: ${result.summary.debt_task_binding_count}`);
  lines.push(`Task-state writes: ${result.summary.task_state_write_performed_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: task creation, task state writes, issue tracker mutation, command execution, protected remediation, merge, release, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function serializableTechnicalDebtLedger(result) {
  const { markdown: _markdown, summary_markdown: _summaryMarkdown, output_dir: _outputDir, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.roadmapPath,
    issue_intake_adapter_path: path.resolve(options.issueIntakeAdapterPath ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.issueIntakeAdapterPath),
    plan_reconciliation_path: path.resolve(options.planReconciliationPath ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.planReconciliationPath),
    pr_draft_artifact_path: path.resolve(options.prDraftArtifactPath ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.prDraftArtifactPath),
    release_note_artifact_path: path.resolve(options.releaseNoteArtifactPath ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.releaseNoteArtifactPath),
    rollback_plan_artifact_path: path.resolve(options.rollbackPlanArtifactPath ?? DEFAULT_TECHNICAL_DEBT_LEDGER_INPUTS.rollbackPlanArtifactPath),
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
    else if (arg === "--issue-intake-adapter") parsed.issueIntakeAdapterPath = argv[++index];
    else if (arg === "--plan-reconciliation") parsed.planReconciliationPath = argv[++index];
    else if (arg === "--pr-draft-artifact") parsed.prDraftArtifactPath = argv[++index];
    else if (arg === "--release-note-artifact") parsed.releaseNoteArtifactPath = argv[++index];
    else if (arg === "--rollback-plan-artifact") parsed.rollbackPlanArtifactPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/technical-debt-ledger.mjs [options]

Options:
  --check                             Fail when validation does not pass
  --no-write                          Build without writing artifacts
  --out-dir <path>                    Output directory
  --repo-root <path>                  Repository root
  --package <path>                    package.json path relative to repo root
  --roadmap <path>                    final completion ledger path relative to repo root
  --issue-intake-adapter <path>       issue-intake-adapter.json path
  --plan-reconciliation <path>        plan-reconciliation.json path
  --pr-draft-artifact <path>          pr-draft-artifact.json path
  --release-note-artifact <path>      release-note-artifact.json path
  --rollback-plan-artifact <path>     rollback-plan-artifact.json path`);
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

function debtCategoryForRisk(riskKey) {
  const value = String(riskKey ?? "");
  if (value.includes("protected-file")) return "protected_file_approval";
  if (value.includes("secret") || value.includes("credential")) return "secret_handling";
  if (value.includes("production-config")) return "production_config";
  if (value.includes("diff-review")) return "human_review_gate";
  return "technical_debt";
}

function priorityForSeverity(severity) {
  if (severity === "high" || severity === "critical") return "p1";
  if (severity === "medium") return "p2";
  return "p3";
}

function titleFromKey(value) {
  return String(value ?? "technical-debt")
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
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
