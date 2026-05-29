import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ROLLBACK_PLAN_ARTIFACT_OUT_DIR = "artifacts/rollback-plan-artifact/latest";
export const DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationPatchCapturePath: "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json",
  diffReviewGatePath: "artifacts/diff-review-gate/latest/diff-review-gate.json",
  prDraftArtifactPath: "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json",
  releaseNoteArtifactPath: "artifacts/release-note-artifact/latest/release-note-artifact.json",
};

const CONTRACT_ID = "rollback-plan-artifact.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const PLAN_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "implementation_patch_pr_draft_release_note_and_human_gated_rollback_targets";
const DESKTOP_SURFACE_POLICY = "read_only_rollback_plan_review_surface";

export async function runRollbackPlanArtifact(options = {}) {
  const result = await buildRollbackPlanArtifact(options);
  if (options.write !== false) await writeRollbackPlanArtifact(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Rollback plan artifact validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRollbackPlanArtifact(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationPatchCapture = await readJsonOrError(inputs.implementation_patch_capture_path);
  const diffReviewGate = await readJsonOrError(inputs.diff_review_gate_path);
  const prDraftArtifact = await readJsonOrError(inputs.pr_draft_artifact_path);
  const releaseNoteArtifact = await readJsonOrError(inputs.release_note_artifact_path);
  const implementation = implementationPatchCapture.value ?? {};
  const diffReview = diffReviewGate.value ?? {};
  const prDraft = prDraftArtifact.value ?? {};
  const releaseNote = releaseNoteArtifact.value ?? {};
  const commitTargets = buildRollbackCommitTargets({ implementation, generatedAt });
  const fileTargets = buildRollbackFileTargets({ implementation, diffReview, generatedAt });
  const commandTargets = buildRollbackCommandTargets({ prDraft, releaseNote, commitTargets, fileTargets, generatedAt });
  const markdown = renderRollbackPlanMarkdown({ commitTargets, fileTargets, commandTargets, generatedAt });
  const outputArtifacts = buildOutputArtifacts({ prDraft, releaseNote, markdown, generatedAt });
  const bindings = buildRollbackPlanBindings({ implementation, diffReview, prDraft, releaseNote, outputArtifacts, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    implementation,
    implementationError: implementationPatchCapture.error,
    diffReview,
    diffReviewError: diffReviewGate.error,
    prDraft,
    prDraftError: prDraftArtifact.error,
    releaseNote,
    releaseNoteError: releaseNoteArtifact.error,
    commitTargets,
    fileTargets,
    commandTargets,
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
  const summary = summarizeRollbackPlanArtifact({
    implementation,
    diffReview,
    prDraft,
    releaseNote,
    commitTargets,
    fileTargets,
    commandTargets,
    outputArtifacts,
    bindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    rollback_plan_artifact_id: `rollback-plan-artifact.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    rollback_plan_artifact_status: summary.rollback_plan_artifact_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, diffReviewGate, prDraftArtifact, releaseNoteArtifact }),
    rollback_plan_contract: buildContract(generatedAt),
    source_implementation_patch_capture: buildSourceImplementationPatchCapture(implementation),
    source_diff_review_gate: buildSourceDiffReviewGate(diffReview),
    source_pr_draft_artifact: buildSourcePrDraftArtifact(prDraft),
    source_release_note_artifact: buildSourceReleaseNoteArtifact(releaseNote),
    rollback_output_artifacts: outputArtifacts,
    rollback_commit_targets: commitTargets,
    rollback_file_targets: fileTargets,
    rollback_command_targets: commandTargets,
    rollback_plan_bindings: bindings,
    rollback_plan_desktop_boundary: desktopBoundary,
    rollback_plan_checkpoints: checkpoints,
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

export async function writeRollbackPlanArtifact(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableRollbackPlanArtifact(result);
  await writeJson(path.join(outDir, "rollback-plan-artifact.json"), serializable);
  await writeFile(path.join(outDir, "rollback-plan.md"), result.markdown, "utf8");
  await writeJson(path.join(outDir, "rollback-plan-output-artifacts.json"), {
    schema_version: "rollback-plan-output-artifacts.v1",
    generated_at: result.generated_at,
    rollback_output_artifact_count: result.rollback_output_artifacts.length,
    rollback_output_artifacts: result.rollback_output_artifacts,
  });
  await writeJson(path.join(outDir, "rollback-commit-targets.json"), {
    schema_version: "rollback-commit-targets.v1",
    generated_at: result.generated_at,
    rollback_commit_target_count: result.rollback_commit_targets.length,
    rollback_commit_targets: result.rollback_commit_targets,
  });
  await writeJson(path.join(outDir, "rollback-file-targets.json"), {
    schema_version: "rollback-file-targets.v1",
    generated_at: result.generated_at,
    rollback_file_target_count: result.rollback_file_targets.length,
    rollback_file_targets: result.rollback_file_targets,
  });
  await writeJson(path.join(outDir, "rollback-command-targets.json"), {
    schema_version: "rollback-command-targets.v1",
    generated_at: result.generated_at,
    rollback_command_target_count: result.rollback_command_targets.length,
    rollback_command_targets: result.rollback_command_targets,
  });
  await writeJson(path.join(outDir, "rollback-plan-bindings.json"), {
    schema_version: "rollback-plan-bindings.v1",
    generated_at: result.generated_at,
    rollback_plan_binding_count: result.rollback_plan_bindings.length,
    rollback_plan_bindings: result.rollback_plan_bindings,
  });
  await writeJson(path.join(outDir, "rollback-plan-desktop-boundary.json"), {
    schema_version: "rollback-plan-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    rollback_plan_desktop_boundary: result.rollback_plan_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "rollback-plan-validation-report.v1",
    generated_at: result.generated_at,
    rollback_plan_artifact_id: result.rollback_plan_artifact_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runRollbackPlanArtifactCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runRollbackPlanArtifact(args);
    console.log(`Rollback plan artifact ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.rollback_plan_artifact_status}`);
    console.log(`Commit targets: ${result.summary.rollback_commit_target_count}`);
    console.log(`File targets: ${result.summary.rollback_file_target_count}`);
    console.log(`Command targets: ${result.summary.rollback_command_target_count}`);
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
    schema_version: "rollback-plan-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    plan_authority: PLAN_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    target_rule: "rollback_plan_declares_commit_file_and_command_targets_before_any_execution",
    command_rule: "rollback_commands_are_documented_as_human_review_drafts_and_are_never_executed_by_this_artifact",
    file_rule: "rollback_file_targets_are_read_only_restore_candidates_bound_to_captured_touched_files",
    commit_rule: "rollback_commit_targets_reference_unmerged_branch_or patch candidates_and_do_not_revert_commits",
    output_artifact_rule: "rollback_plan_markdown_is_stored_as_draft_output_artifact_with_content_hash",
    desktop_companion_rule: "desktop_companion_reads_rollback_targets_bindings_and_validation_only",
    human_review_rule: "rollback_execution_merge_release_and_client_facing_publication_remain_human_gated",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    rollback_plan_artifact_generated: true,
    rollback_execution_performed: false,
    command_execution_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed_outside_artifact_dir: false,
    file_restore_performed: false,
    commit_revert_performed: false,
    merge_performed: false,
    release_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    patch_application_performed: false,
    external_agent_invocation_performed: false,
    protected_mutation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function buildSourceImplementationPatchCapture(artifact) {
  return {
    schema_version: "source-implementation-patch-capture-for-rollback-plan.v1",
    implementation_patch_capture_id: artifact.implementation_patch_capture_id ?? null,
    implementation_patch_capture_status: artifact.summary?.implementation_patch_capture_status ?? artifact.implementation_patch_capture_status ?? "unknown",
    patch_record_count: artifact.summary?.patch_record_count ?? artifact.implementation_patch_records?.length ?? 0,
    touched_file_count: artifact.summary?.touched_file_count ?? artifact.implementation_touched_files?.length ?? 0,
    protected_touched_file_count: artifact.summary?.protected_touched_file_count ?? 0,
    patch_application_performed_count: artifact.summary?.patch_application_performed_count ?? 0,
    git_command_executed_count: artifact.summary?.git_command_executed_count ?? 0,
    filesystem_mutation_performed_count: artifact.summary?.filesystem_mutation_performed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceDiffReviewGate(artifact) {
  return {
    schema_version: "source-diff-review-gate-for-rollback-plan.v1",
    diff_review_gate_id: artifact.diff_review_gate_id ?? null,
    diff_review_gate_status: artifact.summary?.diff_review_gate_status ?? artifact.diff_review_gate_status ?? "unknown",
    gate_result_count: artifact.summary?.gate_result_count ?? artifact.diff_review_gate_results?.length ?? 0,
    passed_with_human_gate_count: artifact.summary?.passed_with_human_gate_count ?? 0,
    patch_application_allowed_count: artifact.summary?.patch_application_allowed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourcePrDraftArtifact(artifact) {
  return {
    schema_version: "source-pr-draft-artifact-for-rollback-plan.v1",
    pr_draft_artifact_id: artifact.pr_draft_artifact_id ?? null,
    pr_draft_artifact_status: artifact.summary?.pr_draft_artifact_status ?? artifact.pr_draft_artifact_status ?? "unknown",
    rollback_step_count: artifact.summary?.rollback_step_count ?? artifact.pr_draft_rollback_plan?.length ?? 0,
    draft_not_executed_rollback_step_count: artifact.summary?.draft_not_executed_rollback_step_count ?? 0,
    rollback_command_execution_allowed_count: artifact.summary?.rollback_command_execution_allowed_count ?? 0,
    merge_performed: artifact.summary?.merge_performed ?? false,
    release_performed: artifact.summary?.release_performed ?? false,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceReleaseNoteArtifact(artifact) {
  return {
    schema_version: "source-release-note-artifact-for-rollback-plan.v1",
    release_note_artifact_id: artifact.release_note_artifact_id ?? null,
    release_note_artifact_status: artifact.summary?.release_note_artifact_status ?? artifact.release_note_artifact_status ?? "unknown",
    change_record_count: artifact.summary?.release_note_change_record_count ?? artifact.release_note_change_records?.length ?? 0,
    merged_change_basis_count: artifact.summary?.merged_change_basis_count ?? 0,
    merge_performed: artifact.summary?.merge_performed ?? false,
    release_performed: artifact.summary?.release_performed ?? false,
    publication_performed: artifact.summary?.release_note_publication_performed ?? false,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildRollbackCommitTargets({ implementation, generatedAt }) {
  return (implementation.implementation_patch_records ?? []).map((record, index) => ({
    schema_version: "rollback-commit-target.v1",
    rollback_commit_target_id: `rollback-commit-target.${slugify(record.agent ?? `agent-${index + 1}`)}.${index + 1}`,
    generated_at: generatedAt,
    sequence: index + 1,
    source_implementation_patch_record_id: record.implementation_patch_record_id ?? null,
    source_branch_record_id: record.source_branch_record_id ?? null,
    source_worktree_record_id: record.source_worktree_record_id ?? null,
    agent: record.agent ?? "unknown",
    branch_name: record.branch_name ?? null,
    worktree_path: normalizePath(record.worktree_path ?? ""),
    candidate_commit_ref: record.source_diff_capture_record_id ?? record.output_artifact_id ?? null,
    merge_commit_id: null,
    rollback_commit_status: "pending_not_merged",
    rollback_strategy: "do_not_merge_or_discard_unmerged_branch_candidate_after_human_review",
    commit_revert_required: false,
    commit_revert_performed: false,
    git_command_allowed: false,
    command_execution_allowed: false,
    human_review_required: true,
    rollback_commit_hash: hashObject({ record, index }),
  }));
}

function buildRollbackFileTargets({ implementation, diffReview, generatedAt }) {
  const findingsByPath = new Map((diffReview.diff_review_file_findings ?? []).map((finding) => [finding.file_path, finding]));
  return (implementation.implementation_touched_files ?? []).map((file, index) => {
    const finding = findingsByPath.get(file.file_path) ?? {};
    return {
      schema_version: "rollback-file-target.v1",
      rollback_file_target_id: `rollback-file-target.${slugify(file.file_path ?? `file-${index + 1}`)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      source_touched_file_id: file.touched_file_id ?? null,
      source_diff_review_file_finding_id: finding.diff_review_file_finding_id ?? null,
      file_path: normalizePath(file.file_path ?? ""),
      rollback_file_status: "restore_candidate_declared",
      restore_strategy: file.protected_file_detected ? "requires_explicit_protected_approval_before_restore" : "restore_from_pre_patch_baseline_after_human_approval",
      in_frozen_scope: Boolean(file.in_frozen_scope),
      protected_file_detected: Boolean(file.protected_file_detected),
      protected_write_requires_explicit_approval: Boolean(file.protected_write_requires_explicit_approval),
      file_restore_allowed: false,
      file_restore_performed: false,
      command_execution_allowed: false,
      filesystem_mutation_allowed: false,
      human_review_required: true,
      rollback_file_hash: hashObject({ file, finding }),
    };
  });
}

function buildRollbackCommandTargets({ prDraft, releaseNote, commitTargets, fileTargets, generatedAt }) {
  const prRollback = prDraft.pr_draft_rollback_plan ?? [];
  const commands = [
    commandTarget(1, "hold_merge_and_release", "git merge --abort || true", "Document merge hold only; no merge exists and this command is not executed by the artifact.", generatedAt),
    commandTarget(2, "discard_unmerged_branch_candidates", `git branch -D ${commitTargets.map((target) => target.branch_name).filter(Boolean).join(" ") || "<branch-candidate>"}`, "Discard branch candidates only after explicit human approval; not executed by the artifact.", generatedAt),
    commandTarget(3, "restore_touched_files_from_baseline", `git restore --source=<approved-baseline> -- ${fileTargets.map((target) => target.file_path).join(" ") || "<captured-files>"}`, "Restore captured files only after human approval and protected-file checks; not executed by the artifact.", generatedAt),
    commandTarget(4, "remove_generated_review_artifacts", "Remove rejected PR draft, release note, and rollback draft artifacts after human approval.", "Generated review artifacts remain available until a reviewer approves archival or removal.", generatedAt),
    commandTarget(5, "rerun_validation_gates", "npm test && npm run validate && npm run control-plane:loop && npm run api:smoke", "Validation command bundle to run after any approved rollback; not executed by the artifact.", generatedAt),
  ];
  return commands.map((command) => ({
    ...command,
    source_pr_draft_rollback_step_ids: prRollback.map((step) => step.pr_draft_rollback_step_id).filter(Boolean),
    source_release_note_change_record_ids: (releaseNote.release_note_change_records ?? []).map((record) => record.release_note_change_record_id).filter(Boolean),
  }));
}

function commandTarget(sequence, rollbackCommandKey, command_preview, instruction, generatedAt) {
  return {
    schema_version: "rollback-command-target.v1",
    rollback_command_target_id: `rollback-command-target.${sequence}.${rollbackCommandKey}`,
    generated_at: generatedAt,
    sequence,
    rollback_command_key: rollbackCommandKey,
    rollback_command_status: "draft_not_executed",
    command_preview,
    instruction,
    command_execution_allowed: false,
    command_executed: false,
    git_command: command_preview.startsWith("git "),
    protected_action_allowed: false,
    protected_action_executed: false,
    human_review_required: true,
    rollback_command_hash: hashObject({ sequence, rollbackCommandKey, command_preview, instruction }),
  };
}

function buildOutputArtifacts({ prDraft, releaseNote, markdown, generatedAt }) {
  const sourceOutput = releaseNote.release_note_output_artifacts?.[0] ?? prDraft.pr_draft_output_artifacts?.[0] ?? {};
  return [{
    schema_version: "output-artifact.v2",
    output_artifact_id: "output.personal_dev.p227.rollback_plan",
    source_output_artifact_id: sourceOutput.output_artifact_id ?? null,
    source_id: "rollback_plan_artifact",
    source_label: "Rollback Plan Artifact",
    domain_pack: "personal-dev",
    capability_id: CAPABILITY_ID,
    workflow_run_id: sourceOutput.workflow_run_id ?? "workflow-run.personal_dev.p227.rollback_plan",
    tenant_id: sourceOutput.tenant_id ?? "tenant.personal.jws",
    matter_id: sourceOutput.matter_id ?? "matter.personal_dev.hermes",
    artifact_type: "rollback_plan",
    artifact_uri: "artifacts/rollback-plan-artifact/latest/rollback-plan.md",
    content_hash: hashText(markdown),
    hash_algorithm: "sha256",
    hash_status: "present",
    output_status: "draft",
    delivery_state: "blocked_pending_approval",
    delivery_state_after_receipt: "ready_for_delivery",
    approval_id: "approval.personal_dev.p227.rollback_plan.human_review",
    approval_status: "pending",
    approval_request_ids: ["approval.personal_dev.p227.rollback_plan.human_review"],
    approval_request_count: 1,
    delivery_action_ids: ["delivery.personal_dev.p227.rollback_plan"],
    delivery_action_count: 1,
    delivery_receipt_ids: [],
    delivery_receipt_count: 0,
    blocking_gate_ids: ["human_approval_gate"],
    blocking_gate_count: 1,
    citation_count: 0,
    created_by_run_id: "agent-run.personal_dev.p227.rollback_plan",
    created_at: generatedAt,
    recorded_at: generatedAt,
    approval_separation_status: "approval_required_not_applied",
    delivery_separation_status: "separate_delivery_action_declared",
    receipt_separation_status: "receipt_required_before_delivery",
    event_id: "event.output.rendered.personal_dev.p227.rollback_plan",
    policy_snapshot_id: sourceOutput.policy_snapshot_id ?? "policy.default.personal_dev.v1",
    metadata: {
      title: "Hermes Personal Dev rollback plan draft",
      rollback_basis: "unmerged_validated_change_candidate",
      commit_file_command_targets_declared: true,
    },
  }];
}

function buildRollbackPlanBindings({ implementation, diffReview, prDraft, releaseNote, outputArtifacts, generatedAt }) {
  const outputArtifact = outputArtifacts[0];
  return [
    binding("implementation_patch_capture", implementation.implementation_patch_capture_id, implementation.summary?.implementation_patch_capture_status, outputArtifact.output_artifact_id, generatedAt),
    binding("diff_review_gate", diffReview.diff_review_gate_id, diffReview.summary?.diff_review_gate_status, outputArtifact.output_artifact_id, generatedAt),
    binding("pr_draft_artifact", prDraft.pr_draft_artifact_id, prDraft.summary?.pr_draft_artifact_status, outputArtifact.output_artifact_id, generatedAt),
    binding("release_note_artifact", releaseNote.release_note_artifact_id, releaseNote.summary?.release_note_artifact_status, outputArtifact.output_artifact_id, generatedAt),
  ];
}

function binding(sourceType, sourceId, sourceStatus, outputArtifactId, generatedAt) {
  return {
    schema_version: "rollback-plan-binding.v1",
    rollback_plan_binding_id: `rollback-plan-binding.${sourceType}`,
    generated_at: generatedAt,
    source_type: sourceType,
    source_id: sourceId ?? null,
    source_status: sourceStatus ?? "unknown",
    output_artifact_id: outputArtifactId,
    rollback_plan_binding_status: "bound_to_rollback_plan_draft",
    rollback_execution_allowed: false,
    command_execution_allowed: false,
    file_restore_allowed: false,
    commit_revert_allowed: false,
    merge_allowed: false,
    release_allowed: false,
    human_review_required: true,
    binding_hash: hashObject({ sourceType, sourceId, sourceStatus, outputArtifactId }),
  };
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "rollback-plan-desktop-boundary.v1",
    boundary_id: "rollback-plan-desktop-boundary.personal-dev",
    generated_at: generatedAt,
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    visible_collections: ["rollback_commit_targets", "rollback_file_targets", "rollback_command_targets", "rollback_plan_bindings", "validation_items"],
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed: false,
    git_command_allowed: false,
    filesystem_mutation_allowed: false,
    file_restore_allowed: false,
    commit_revert_allowed: false,
    rollback_execution_allowed: false,
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
  implementation,
  implementationError,
  diffReview,
  diffReviewError,
  prDraft,
  prDraftError,
  releaseNote,
  releaseNoteError,
  commitTargets,
  fileTargets,
  commandTargets,
  outputArtifacts,
  bindings,
  desktopBoundary,
}) {
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:rollback-plan"]), "package.json exposes personal-dev:rollback-plan."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P227") && String(roadmapText ?? "").includes("rollback plan artifact"), "Final completion ledger declares P227 rollback plan artifact."),
    checkpoint("implementation_patch_capture_complete", !implementationError && implementation.summary?.implementation_patch_capture_status === "complete" && implementation.summary?.validation_error_count === 0, "Implementation Patch Capture is complete before rollback plan generation."),
    checkpoint("diff_review_gate_complete", !diffReviewError && diffReview.summary?.diff_review_gate_status === "complete" && diffReview.summary?.validation_error_count === 0, "Diff Review Gate is complete before rollback plan generation."),
    checkpoint("pr_draft_artifact_complete", !prDraftError && prDraft.summary?.pr_draft_artifact_status === "complete" && prDraft.summary?.rollback_step_count >= 3 && prDraft.summary?.rollback_command_execution_allowed_count === 0 && prDraft.summary?.validation_error_count === 0, "PR Draft Artifact contributes non-executed rollback steps."),
    checkpoint("release_note_artifact_complete", !releaseNoteError && releaseNote.summary?.release_note_artifact_status === "complete" && releaseNote.summary?.merge_performed === false && releaseNote.summary?.release_performed === false && releaseNote.summary?.validation_error_count === 0, "Release Note Artifact is complete and unmerged before rollback plan generation."),
    checkpoint("rollback_commit_targets_declared", commitTargets.length >= 2 && commitTargets.every((target) => target.rollback_commit_status === "pending_not_merged" && target.commit_revert_performed === false && target.command_execution_allowed === false), "Rollback commit targets are declared without reverting commits."),
    checkpoint("rollback_file_targets_declared", fileTargets.length >= 1 && fileTargets.every((target) => target.rollback_file_status === "restore_candidate_declared" && target.file_restore_performed === false && target.command_execution_allowed === false), "Rollback file targets are declared without restoring files."),
    checkpoint("rollback_command_targets_declared", commandTargets.length >= 3 && commandTargets.every((target) => target.rollback_command_status === "draft_not_executed" && target.command_execution_allowed === false && target.command_executed === false), "Rollback command targets are declared without command execution."),
    checkpoint("rollback_output_artifact_stored", outputArtifacts.length === 1 && outputArtifacts.every((artifact) => artifact.schema_version === "output-artifact.v2" && artifact.artifact_type === "rollback_plan" && artifact.hash_status === "present" && artifact.output_status === "draft" && artifact.delivery_state === "blocked_pending_approval"), "Rollback plan is stored as draft OutputArtifact v2 blocked pending approval."),
    checkpoint("rollback_bindings_preserve_human_review", bindings.length === 4 && bindings.every((item) => item.rollback_plan_binding_status === "bound_to_rollback_plan_draft" && item.rollback_execution_allowed === false && item.command_execution_allowed === false && item.merge_allowed === false && item.release_allowed === false), "Rollback bindings preserve human review before rollback, merge, or release."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.rollback_execution_allowed === false && desktopBoundary.command_execution_allowed === false && desktopBoundary.file_restore_allowed === false && desktopBoundary.source_of_truth === false, "Desktop rollback boundary is read-only and not source of truth."),
  ];
}

function summarizeRollbackPlanArtifact({
  implementation,
  diffReview,
  prDraft,
  releaseNote,
  commitTargets,
  fileTargets,
  commandTargets,
  outputArtifacts,
  bindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    rollback_plan_artifact_status: validation.valid ? "complete" : "blocked",
    rollback_plan_artifact_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    plan_authority: PLAN_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_implementation_patch_capture_status: implementation.summary?.implementation_patch_capture_status ?? "unknown",
    source_diff_review_gate_status: diffReview.summary?.diff_review_gate_status ?? "unknown",
    source_pr_draft_artifact_status: prDraft.summary?.pr_draft_artifact_status ?? "unknown",
    source_release_note_artifact_status: releaseNote.summary?.release_note_artifact_status ?? "unknown",
    source_patch_record_count: implementation.summary?.patch_record_count ?? 0,
    source_touched_file_count: implementation.summary?.touched_file_count ?? 0,
    source_pr_draft_rollback_step_count: prDraft.summary?.rollback_step_count ?? 0,
    source_release_note_change_record_count: releaseNote.summary?.release_note_change_record_count ?? 0,
    rollback_output_artifact_count: outputArtifacts.length,
    output_artifact_v2_count: outputArtifacts.filter((artifact) => artifact.schema_version === "output-artifact.v2").length,
    output_artifact_hash_present_count: outputArtifacts.filter((artifact) => artifact.hash_status === "present").length,
    output_artifact_draft_count: outputArtifacts.filter((artifact) => artifact.output_status === "draft").length,
    output_artifact_blocked_pending_approval_count: outputArtifacts.filter((artifact) => artifact.delivery_state === "blocked_pending_approval").length,
    output_artifact_pending_approval_count: outputArtifacts.filter((artifact) => artifact.approval_status === "pending").length,
    rollback_commit_target_count: commitTargets.length,
    pending_not_merged_commit_target_count: commitTargets.filter((target) => target.rollback_commit_status === "pending_not_merged").length,
    commit_revert_required_count: commitTargets.filter((target) => target.commit_revert_required).length,
    commit_revert_performed_count: commitTargets.filter((target) => target.commit_revert_performed).length,
    rollback_file_target_count: fileTargets.length,
    restore_candidate_file_target_count: fileTargets.filter((target) => target.rollback_file_status === "restore_candidate_declared").length,
    protected_file_target_count: fileTargets.filter((target) => target.protected_file_detected).length,
    file_restore_allowed_count: fileTargets.filter((target) => target.file_restore_allowed).length,
    file_restore_performed_count: fileTargets.filter((target) => target.file_restore_performed).length,
    rollback_command_target_count: commandTargets.length,
    draft_not_executed_command_target_count: commandTargets.filter((target) => target.rollback_command_status === "draft_not_executed").length,
    command_execution_allowed_count: commandTargets.filter((target) => target.command_execution_allowed).length,
    command_executed_count: commandTargets.filter((target) => target.command_executed).length,
    git_command_target_count: commandTargets.filter((target) => target.git_command).length,
    rollback_plan_binding_count: bindings.length,
    bound_rollback_plan_binding_count: bindings.filter((item) => item.rollback_plan_binding_status === "bound_to_rollback_plan_draft").length,
    rollback_execution_allowed_count: bindings.filter((item) => item.rollback_execution_allowed).length,
    merge_allowed_count: bindings.filter((item) => item.merge_allowed).length,
    release_allowed_count: bindings.filter((item) => item.release_allowed).length,
    rollback_execution_performed: false,
    command_execution_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    protected_mutation_performed: false,
    merge_performed: false,
    release_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    human_review_required: true,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_command_execution_allowed: desktopBoundary.command_execution_allowed,
    desktop_git_command_allowed: desktopBoundary.git_command_allowed,
    desktop_filesystem_mutation_allowed: desktopBoundary.filesystem_mutation_allowed,
    desktop_file_restore_allowed: desktopBoundary.file_restore_allowed,
    desktop_commit_revert_allowed: desktopBoundary.commit_revert_allowed,
    desktop_rollback_execution_allowed: desktopBoundary.rollback_execution_allowed,
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
    by_commit_status: countBy(commitTargets, "rollback_commit_status"),
    by_file_status: countBy(fileTargets, "rollback_file_status"),
    by_command_status: countBy(commandTargets, "rollback_command_status"),
    by_binding_status: countBy(bindings, "rollback_plan_binding_status"),
  };
}

function buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, diffReviewGate, prDraftArtifact, releaseNoteArtifact }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("implementation_patch_capture", "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json", implementationPatchCapture),
    sourceContract("diff_review_gate", "artifacts/diff-review-gate/latest/diff-review-gate.json", diffReviewGate),
    sourceContract("pr_draft_artifact", "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json", prDraftArtifact),
    sourceContract("release_note_artifact", "artifacts/release-note-artifact/latest/release-note-artifact.json", releaseNoteArtifact),
  ];
}

function sourceContract(sourceId, sourcePath, readResult) {
  const value = readResult.value ?? readResult;
  return {
    schema_version: "rollback-plan-source-contract.v1",
    source_id: sourceId,
    source_path: sourcePath,
    source_status: readResult.error ? "missing" : "available",
    error: readResult.error ?? null,
    source_hash: hashObject(value ?? {}),
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    schema_version: "rollback-plan-checkpoint.v1",
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
    schema_version: "rollback-plan-validation.v1",
    valid: errors.length === 0,
    errors,
  };
}

function renderRollbackPlanMarkdown({ commitTargets, fileTargets, commandTargets, generatedAt }) {
  const lines = [];
  lines.push("# Rollback Plan Draft: Hermes Personal Dev validated change");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("## Commit Targets");
  for (const target of commitTargets) lines.push(`- ${target.agent}: ${target.rollback_commit_status}; branch ${target.branch_name ?? "unavailable"}; revert performed false`);
  lines.push("");
  lines.push("## File Targets");
  for (const target of fileTargets) lines.push(`- ${target.file_path}: ${target.rollback_file_status}; restore performed false`);
  lines.push("");
  lines.push("## Command Targets");
  for (const target of commandTargets) lines.push(`- ${target.rollback_command_key}: ${target.rollback_command_status}; execution allowed false; ${target.command_preview}`);
  lines.push("");
  lines.push("This rollback plan is a draft. Command execution, git operations, file restore, commit revert, merge, release, protected writes, credential changes, production config changes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Rollback Plan Artifact");
  lines.push("");
  lines.push(`Status: ${result.summary.rollback_plan_artifact_status}`);
  lines.push(`Commit targets: ${result.summary.rollback_commit_target_count}`);
  lines.push(`File targets: ${result.summary.rollback_file_target_count}`);
  lines.push(`Command targets: ${result.summary.rollback_command_target_count}`);
  lines.push(`Bindings: ${result.summary.rollback_plan_binding_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: rollback execution, command execution, git operations, file restore, commit revert, merge, release, protected writes, credential changes, production config changes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function serializableRollbackPlanArtifact(result) {
  const { markdown: _markdown, summary_markdown: _summaryMarkdown, output_dir: _outputDir, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS.roadmapPath,
    implementation_patch_capture_path: path.resolve(options.implementationPatchCapturePath ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS.implementationPatchCapturePath),
    diff_review_gate_path: path.resolve(options.diffReviewGatePath ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS.diffReviewGatePath),
    pr_draft_artifact_path: path.resolve(options.prDraftArtifactPath ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS.prDraftArtifactPath),
    release_note_artifact_path: path.resolve(options.releaseNoteArtifactPath ?? DEFAULT_ROLLBACK_PLAN_ARTIFACT_INPUTS.releaseNoteArtifactPath),
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
    else if (arg === "--implementation-patch-capture") parsed.implementationPatchCapturePath = argv[++index];
    else if (arg === "--diff-review-gate") parsed.diffReviewGatePath = argv[++index];
    else if (arg === "--pr-draft-artifact") parsed.prDraftArtifactPath = argv[++index];
    else if (arg === "--release-note-artifact") parsed.releaseNoteArtifactPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/rollback-plan-artifact.mjs [options]

Options:
  --check                             Fail when validation does not pass
  --no-write                          Build without writing artifacts
  --out-dir <path>                    Output directory
  --repo-root <path>                  Repository root
  --package <path>                    package.json path relative to repo root
  --roadmap <path>                    final completion ledger path relative to repo root
  --implementation-patch-capture <path> implementation-patch-capture.json path
  --diff-review-gate <path>           diff-review-gate.json path
  --pr-draft-artifact <path>          pr-draft-artifact.json path
  --release-note-artifact <path>      release-note-artifact.json path`);
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

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/");
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
