import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DIFF_REVIEW_GATE_OUT_DIR = "artifacts/diff-review-gate/latest";
export const DEFAULT_DIFF_REVIEW_GATE_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationPatchCapturePath: "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json",
  protectedFileGatePath: "artifacts/protected-file-gate/latest/protected-file-gate.json",
};

const CONTRACT_ID = "diff-review-gate.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "captured_implementation_diff_touched_file_and_output_artifact_records";
const DESKTOP_SURFACE_POLICY = "read_only_diff_review_gate_surface";

export async function runDiffReviewGate(options = {}) {
  const result = await buildDiffReviewGate(options);
  if (options.write !== false) await writeDiffReviewGate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Diff review gate validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDiffReviewGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DIFF_REVIEW_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationPatchCapture = await readJsonOrError(inputs.implementation_patch_capture_path);
  const protectedFileGate = await readJsonOrError(inputs.protected_file_gate_path);
  const patchCaptureArtifact = implementationPatchCapture.value ?? {};
  const protectedFileGateArtifact = protectedFileGate.value ?? {};
  const patchRecords = patchCaptureArtifact.implementation_patch_records ?? [];
  const diffCaptures = patchCaptureArtifact.implementation_diff_captures ?? [];
  const touchedFiles = patchCaptureArtifact.implementation_touched_files ?? [];
  const generatedArtifacts = patchCaptureArtifact.implementation_generated_artifacts ?? [];
  const protectedEvaluations = protectedFileGateArtifact.protected_file_change_evaluations ?? [];
  const diffReviewResults = buildDiffReviewResults({
    patchRecords,
    diffCaptures,
    touchedFiles,
    generatedArtifacts,
    protectedEvaluations,
    generatedAt,
  });
  const fileFindings = buildFileFindings({ touchedFiles, protectedEvaluations, generatedAt });
  const artifactFindings = buildArtifactFindings({ generatedArtifacts, generatedAt });
  const gateResults = buildGateResults({ diffReviewResults, generatedAt });
  const desktopBoundary = buildDesktopBoundary({ diffReviewResults, fileFindings, artifactFindings, gateResults, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    implementationPatchCapture: patchCaptureArtifact,
    implementationPatchCaptureError: implementationPatchCapture.error,
    protectedFileGate: protectedFileGateArtifact,
    protectedFileGateError: protectedFileGate.error,
    diffReviewResults,
    fileFindings,
    artifactFindings,
    gateResults,
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
  const summary = summarizeDiffReviewGate({
    implementationPatchCapture: patchCaptureArtifact,
    protectedFileGate: protectedFileGateArtifact,
    diffReviewResults,
    fileFindings,
    artifactFindings,
    gateResults,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    diff_review_gate_id: `diff-review-gate.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    diff_review_gate_status: summary.diff_review_gate_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, protectedFileGate }),
    diff_review_gate_contract: buildContract(generatedAt),
    source_implementation_patch_capture: buildSourceImplementationPatchCapture(patchCaptureArtifact),
    source_protected_file_gate: buildSourceProtectedFileGate(protectedFileGateArtifact),
    diff_review_results: diffReviewResults,
    diff_review_file_findings: fileFindings,
    diff_review_artifact_findings: artifactFindings,
    diff_review_gate_results: gateResults,
    diff_review_desktop_boundary: desktopBoundary,
    diff_review_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderDiffReviewGateMarkdown(result),
  };
}

export async function writeDiffReviewGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDiffReviewGate(result);
  await writeJson(path.join(outDir, "diff-review-gate.json"), serializable);
  await writeJson(path.join(outDir, "diff-review-results.json"), {
    schema_version: "diff-review-results.v1",
    generated_at: result.generated_at,
    diff_review_result_count: result.diff_review_results.length,
    diff_review_results: result.diff_review_results,
  });
  await writeJson(path.join(outDir, "diff-review-file-findings.json"), {
    schema_version: "diff-review-file-findings.v1",
    generated_at: result.generated_at,
    diff_review_file_finding_count: result.diff_review_file_findings.length,
    diff_review_file_findings: result.diff_review_file_findings,
  });
  await writeJson(path.join(outDir, "diff-review-artifact-findings.json"), {
    schema_version: "diff-review-artifact-findings.v1",
    generated_at: result.generated_at,
    diff_review_artifact_finding_count: result.diff_review_artifact_findings.length,
    diff_review_artifact_findings: result.diff_review_artifact_findings,
  });
  await writeJson(path.join(outDir, "diff-review-gate-results.json"), {
    schema_version: "diff-review-gate-results.v1",
    generated_at: result.generated_at,
    diff_review_gate_result_count: result.diff_review_gate_results.length,
    diff_review_gate_results: result.diff_review_gate_results,
  });
  await writeJson(path.join(outDir, "diff-review-desktop-boundary.json"), {
    schema_version: "diff-review-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    diff_review_desktop_boundary: result.diff_review_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "diff-review-gate-validation-report.v1",
    generated_at: result.generated_at,
    diff_review_gate_id: result.diff_review_gate_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDiffReviewGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDiffReviewGate(args);
    console.log(`Diff review gate ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.diff_review_gate_status}`);
    console.log(`Diff review results: ${result.summary.diff_review_result_count}`);
    console.log(`File findings: ${result.summary.file_finding_count}`);
    console.log(`Gate results: ${result.summary.gate_result_count}`);
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
    schema_version: "diff-review-gate-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    review_rule: "diff_review_uses_captured_diff_touched_file_and_output_artifact_records_instead_of_agent_self_report",
    gate_rule: "reviewed_diffs_can_advance_to_canonical_tests_and_protected_scan_but_cannot_be_applied_or_merged",
    protected_file_rule: "protected_file_decisions_are_read_from_the_protected_file_gate_and_remain_blocked_before_explicit_approval",
    execution_rule: "diff_review_gate_does_not_run_git_commands_mutate_files_invoke_external_agents_accept_plans_or_apply_patches",
    desktop_companion_rule: "desktop_companion_reads_diff_review_results_file_findings_artifact_findings_gate_results_and_validation_status_only",
    mutation_policy: "canonical_tests_protected_scan_patch_application_merge_release_and_client_facing_outputs_remain_follow_on_human_gated_actions",
    created_at: generatedAt,
  };
}

function buildSourceImplementationPatchCapture(patchCapture) {
  return {
    schema_version: "source-implementation-patch-capture.v1",
    implementation_patch_capture_id: patchCapture.implementation_patch_capture_id ?? null,
    implementation_patch_capture_status: patchCapture.summary?.implementation_patch_capture_status ?? patchCapture.implementation_patch_capture_status ?? "unknown",
    patch_record_count: patchCapture.summary?.patch_record_count ?? patchCapture.implementation_patch_records?.length ?? 0,
    captured_patch_record_count: patchCapture.summary?.captured_patch_record_count ?? (patchCapture.implementation_patch_records ?? []).filter((record) => record.patch_record_status === "captured").length,
    diff_capture_count: patchCapture.summary?.diff_capture_count ?? patchCapture.implementation_diff_captures?.length ?? 0,
    captured_diff_capture_count: patchCapture.summary?.captured_diff_capture_count ?? (patchCapture.implementation_diff_captures ?? []).filter((record) => record.diff_capture_status === "captured").length,
    touched_file_count: patchCapture.summary?.touched_file_count ?? patchCapture.implementation_touched_files?.length ?? 0,
    in_scope_touched_file_count: patchCapture.summary?.in_scope_touched_file_count ?? (patchCapture.implementation_touched_files ?? []).filter((record) => record.in_frozen_scope).length,
    generated_artifact_count: patchCapture.summary?.generated_artifact_count ?? patchCapture.implementation_generated_artifacts?.length ?? 0,
    captured_generated_artifact_count: patchCapture.summary?.captured_generated_artifact_count ?? (patchCapture.implementation_generated_artifacts ?? []).filter((record) => record.generated_artifact_status === "captured").length,
    runtime_self_report_trusted: patchCapture.summary?.runtime_self_report_trusted ?? true,
    patch_application_performed_count: patchCapture.summary?.patch_application_performed_count ?? 0,
    git_command_executed_count: patchCapture.summary?.git_command_executed_count ?? 0,
    filesystem_mutation_performed_count: patchCapture.summary?.filesystem_mutation_performed_count ?? 0,
    protected_mutation_performed_count: patchCapture.summary?.protected_mutation_performed_count ?? 0,
    validation_error_count: patchCapture.summary?.validation_error_count ?? patchCapture.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      implementation_patch_capture_id: patchCapture.implementation_patch_capture_id ?? null,
      implementation_patch_records: patchCapture.implementation_patch_records ?? [],
      implementation_diff_captures: patchCapture.implementation_diff_captures ?? [],
      implementation_touched_files: patchCapture.implementation_touched_files ?? [],
      implementation_generated_artifacts: patchCapture.implementation_generated_artifacts ?? [],
    }),
  };
}

function buildSourceProtectedFileGate(protectedFileGate) {
  return {
    schema_version: "source-protected-file-gate-for-diff-review.v1",
    protected_file_gate_id: protectedFileGate.protected_file_gate_id ?? null,
    protected_file_gate_status: protectedFileGate.summary?.protected_file_gate_status ?? protectedFileGate.protected_file_gate_status ?? "unknown",
    change_evaluation_count: protectedFileGate.summary?.change_evaluation_count ?? protectedFileGate.protected_file_change_evaluations?.length ?? 0,
    protected_file_detected_count: protectedFileGate.summary?.protected_file_detected_count ?? (protectedFileGate.protected_file_change_evaluations ?? []).filter((record) => record.protected_file_detected).length,
    write_allowed_before_approval_count: protectedFileGate.summary?.write_allowed_before_approval_count ?? 0,
    mutation_allowed_before_approval_count: protectedFileGate.summary?.mutation_allowed_before_approval_count ?? 0,
    direct_apply_allowed_count: protectedFileGate.summary?.direct_apply_allowed_count ?? 0,
    direct_merge_allowed_count: protectedFileGate.summary?.direct_merge_allowed_count ?? 0,
    protected_action_executed_count: protectedFileGate.summary?.protected_action_executed_count ?? 0,
    runtime_self_report_trusted: protectedFileGate.summary?.runtime_self_report_trusted ?? true,
    validation_error_count: protectedFileGate.summary?.validation_error_count ?? protectedFileGate.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      protected_file_gate_id: protectedFileGate.protected_file_gate_id ?? null,
      protected_file_change_evaluations: protectedFileGate.protected_file_change_evaluations ?? [],
    }),
  };
}

function buildDiffReviewResults({ patchRecords, diffCaptures, touchedFiles, generatedArtifacts, protectedEvaluations, generatedAt }) {
  const diffById = new Map(diffCaptures.map((record) => [record.implementation_diff_capture_id, record]));
  const generatedByOutput = groupBy(generatedArtifacts, "output_artifact_id");
  const protectedByDiff = groupBy(protectedEvaluations, "source_diff_capture_record_id");
  return patchRecords.map((patchRecord, index) => {
    const diffCapture = diffById.get(patchRecord.implementation_diff_capture_id) ?? {};
    const generatedArtifactIds = (generatedByOutput.get(patchRecord.output_artifact_id) ?? []).map((artifact) => artifact.generated_artifact_id);
    const relatedProtectedEvaluations = protectedByDiff.get(patchRecord.source_diff_capture_record_id) ?? [];
    const protectedDetectedCount = relatedProtectedEvaluations.filter((evaluation) => evaluation.protected_file_detected).length;
    const result = {
      schema_version: "diff-review-result.v1",
      diff_review_result_id: `diff-review-result.${slugify(patchRecord.implementation_patch_record_id ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      agent: patchRecord.agent ?? diffCapture.agent ?? "unknown",
      runtime_id: patchRecord.runtime_id ?? diffCapture.runtime_id ?? "unknown",
      adapter_id: patchRecord.adapter_id ?? diffCapture.adapter_id ?? null,
      diff_review_status: diffCapture.diff_capture_status === "captured" && patchRecord.patch_record_status === "captured" ? "reviewed_with_human_gate" : "blocked",
      review_basis: "captured_diff_touched_file_and_output_artifact_records",
      review_decision: "advance_to_canonical_test_gate_without_patch_application",
      agent_self_report_trusted: false,
      actual_diff_basis_available: diffCapture.diff_capture_status === "captured" && touchedFiles.length > 0,
      source_implementation_patch_record_id: patchRecord.implementation_patch_record_id ?? null,
      source_implementation_diff_capture_id: diffCapture.implementation_diff_capture_id ?? patchRecord.implementation_diff_capture_id ?? null,
      source_diff_capture_record_id: patchRecord.source_diff_capture_record_id ?? diffCapture.source_diff_capture_record_id ?? null,
      source_diff_gate_contract_id: diffCapture.diff_gate_contract_id ?? null,
      agent_run_id: patchRecord.agent_run_id ?? diffCapture.agent_run_id ?? null,
      workflow_run_id: patchRecord.workflow_run_id ?? diffCapture.workflow_run_id ?? null,
      output_artifact_id: patchRecord.output_artifact_id ?? diffCapture.output_artifact_id ?? null,
      output_artifact_binding_status: patchRecord.output_artifact_binding_status ?? diffCapture.output_artifact_binding_status ?? "missing_output_artifact",
      touched_file_count: touchedFiles.length,
      in_scope_touched_file_count: touchedFiles.filter((file) => file.in_frozen_scope).length,
      protected_touched_file_count: touchedFiles.filter((file) => file.protected_file_detected).length,
      protected_gate_evaluation_count: relatedProtectedEvaluations.length,
      protected_gate_detected_count: protectedDetectedCount,
      generated_artifact_count: generatedArtifactIds.length,
      generated_artifact_ids: generatedArtifactIds,
      diff_review_gate_required: true,
      canonical_test_gate_required: true,
      protected_file_scan_gate_required: true,
      human_merge_approval_gate_required: true,
      patch_application_allowed: false,
      patch_application_blocked: true,
      patch_application_performed: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      protected_file_write_allowed_without_approval: false,
      human_review_required: true,
      next_gate: "canonical_test_gate",
      human_review_note: "Diff review uses captured diff and file/artifact records instead of agent self-report. Patch application, protected writes, merge, release, and legal/client-facing outputs remain human-gated.",
      reviewed_at: generatedAt,
    };
    return {
      ...result,
      diff_review_result_hash: hashObject(result),
    };
  });
}

function buildFileFindings({ touchedFiles, protectedEvaluations, generatedAt }) {
  const protectedByFile = groupBy(protectedEvaluations, "file_path");
  return touchedFiles.map((file, index) => {
    const relatedProtectedEvaluations = protectedByFile.get(file.file_path) ?? [];
    const protectedDetected = file.protected_file_detected || relatedProtectedEvaluations.some((evaluation) => evaluation.protected_file_detected);
    const finding = {
      schema_version: "diff-review-file-finding.v1",
      diff_review_file_finding_id: `diff-review-file-finding.${slugify(file.touched_file_id ?? file.file_path ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      source_touched_file_id: file.touched_file_id ?? null,
      source_scope_file_boundary_id: file.source_scope_file_boundary_id ?? null,
      file_path: file.file_path ?? null,
      file_finding_status: file.in_frozen_scope ? "reviewed_in_scope" : "blocked_out_of_scope",
      actual_diff_basis: "frozen_scope_file_boundary",
      in_frozen_scope: Boolean(file.in_frozen_scope),
      protected_file_detected: Boolean(protectedDetected),
      protected_gate_evaluation_count: relatedProtectedEvaluations.length,
      protected_gate_blocked_before_approval_count: relatedProtectedEvaluations.filter((evaluation) => evaluation.blocked_before_approval).length,
      write_allowed_before_approval: false,
      mutation_allowed_before_approval: false,
      protected_action_executed: false,
      diff_review_gate_required: true,
      canonical_test_gate_required: true,
      human_merge_approval_gate_required: true,
      human_review_required: true,
      reviewed_at: generatedAt,
    };
    return {
      ...finding,
      file_finding_hash: hashObject(finding),
    };
  });
}

function buildArtifactFindings({ generatedArtifacts, generatedAt }) {
  return generatedArtifacts.map((artifact, index) => {
    const finding = {
      schema_version: "diff-review-artifact-finding.v1",
      diff_review_artifact_finding_id: `diff-review-artifact-finding.${slugify(artifact.generated_artifact_id ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      source_generated_artifact_id: artifact.generated_artifact_id ?? null,
      runtime_artifact_id: artifact.runtime_artifact_id ?? null,
      agent_run_id: artifact.agent_run_id ?? null,
      workflow_run_id: artifact.workflow_run_id ?? null,
      runtime_id: artifact.runtime_id ?? "unknown",
      output_artifact_id: artifact.output_artifact_id ?? null,
      artifact_id: artifact.artifact_id ?? null,
      artifact_type: artifact.artifact_type ?? "unknown",
      artifact_uri: artifact.artifact_uri ?? null,
      content_hash: artifact.content_hash ?? null,
      artifact_finding_status: artifact.generated_artifact_status === "captured" ? "reviewed_output_bound" : "blocked",
      output_artifact_binding_status: artifact.output_artifact_binding_status ?? "missing_output_artifact",
      delivery_state: artifact.delivery_state ?? "blocked_pending_approval",
      approval_status: artifact.approval_status ?? "pending",
      runtime_self_report_trusted: false,
      human_review_required: true,
      patch_application_allowed: false,
      reviewed_at: generatedAt,
    };
    return {
      ...finding,
      artifact_finding_hash: hashObject(finding),
    };
  });
}

function buildGateResults({ diffReviewResults, generatedAt }) {
  return diffReviewResults.map((reviewResult, index) => {
    const gateResult = {
      schema_version: "diff-review-gate-result.v1",
      diff_review_gate_result_id: `diff-review-gate-result.${slugify(reviewResult.diff_review_result_id ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      gate_result_status: reviewResult.diff_review_status === "reviewed_with_human_gate" ? "passed_with_human_gate" : "blocked",
      gate_passed: reviewResult.diff_review_status === "reviewed_with_human_gate",
      human_review_required: true,
      source_diff_review_result_id: reviewResult.diff_review_result_id,
      source_implementation_patch_record_id: reviewResult.source_implementation_patch_record_id,
      source_implementation_diff_capture_id: reviewResult.source_implementation_diff_capture_id,
      source_diff_capture_record_id: reviewResult.source_diff_capture_record_id,
      agent: reviewResult.agent,
      runtime_id: reviewResult.runtime_id,
      agent_self_report_trusted: false,
      actual_diff_basis_available: reviewResult.actual_diff_basis_available,
      patch_application_allowed: false,
      patch_application_blocked: true,
      patch_application_performed: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      protected_file_write_allowed_without_approval: false,
      next_gate: "canonical_test_gate",
      decided_at: generatedAt,
    };
    return {
      ...gateResult,
      gate_result_hash: hashObject(gateResult),
    };
  });
}

function buildDesktopBoundary({ diffReviewResults, fileFindings, artifactFindings, gateResults, generatedAt }) {
  return {
    schema_version: "diff-review-desktop-boundary.v1",
    boundary_id: "diff-review-desktop-boundary.personal-dev",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    patch_application_allowed: false,
    git_command_allowed: false,
    filesystem_mutation_allowed: false,
    protected_file_write_allowed: false,
    runtime_execution_allowed: false,
    external_agent_invocation_allowed: false,
    plan_acceptance_allowed: false,
    merge_allowed: false,
    release_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    visible_collections: ["diff_review_results", "diff_review_file_findings", "diff_review_artifact_findings", "diff_review_gate_results", "validation_items"],
    denied_actions: ["run_git_diff", "apply_patch", "write_file", "write_protected_file", "invoke_agent", "accept_plan", "merge_branch", "release"],
    diff_review_result_count: diffReviewResults.length,
    file_finding_count: fileFindings.length,
    artifact_finding_count: artifactFindings.length,
    gate_result_count: gateResults.length,
    enforced_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  implementationPatchCapture,
  implementationPatchCaptureError,
  protectedFileGate,
  protectedFileGateError,
  diffReviewResults,
  fileFindings,
  artifactFindings,
  gateResults,
  desktopBoundary,
}) {
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:diff-review"]), "package.json exposes personal-dev:diff-review."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P222") && String(roadmapText ?? "").includes("diff review gate"), "Final completion ledger declares P222 diff review gate."),
    checkpoint("implementation_patch_capture_available", !implementationPatchCaptureError && Boolean(implementationPatchCapture?.schema_version), "Implementation Patch Capture artifact is available."),
    checkpoint("implementation_patch_capture_complete", implementationPatchCapture?.summary?.implementation_patch_capture_status === "complete" && implementationPatchCapture?.summary?.validation_error_count === 0, "Implementation Patch Capture is complete before diff review."),
    checkpoint("protected_file_gate_available", !protectedFileGateError && Boolean(protectedFileGate?.schema_version), "Protected File Gate artifact is available."),
    checkpoint("protected_file_gate_complete", protectedFileGate?.summary?.protected_file_gate_status === "complete" && protectedFileGate?.summary?.validation_error_count === 0, "Protected File Gate is complete before diff review."),
    checkpoint("diff_review_results_reviewed", diffReviewResults.length === 2 && diffReviewResults.every((record) => record.diff_review_status === "reviewed_with_human_gate" && record.agent_self_report_trusted === false && record.actual_diff_basis_available === true), "Claude Code and Codex diff captures are reviewed using captured diff basis, not self-report."),
    checkpoint("file_findings_in_scope", fileFindings.length > 0 && fileFindings.every((record) => record.file_finding_status === "reviewed_in_scope" && record.in_frozen_scope && record.write_allowed_before_approval === false && record.mutation_allowed_before_approval === false), "Touched file findings are in frozen scope and cannot be written before approval."),
    checkpoint("artifact_findings_output_bound", artifactFindings.length > 0 && artifactFindings.every((record) => record.artifact_finding_status === "reviewed_output_bound" && record.output_artifact_binding_status === "bound_to_output_artifact"), "Generated artifact findings are reviewed and output-bound."),
    checkpoint("gate_results_human_gated", gateResults.length === diffReviewResults.length && gateResults.every((record) => record.gate_result_status === "passed_with_human_gate" && record.human_review_required === true && record.patch_application_allowed === false && record.patch_application_blocked === true), "Diff review gate results pass only into the next human-gated checks."),
    checkpoint("no_patch_application_or_mutation", gateResults.every((record) => record.patch_application_performed === false && record.git_command_executed === false && record.filesystem_mutation_performed === false && record.external_agent_invocation_performed === false && record.plan_acceptance_performed === false && record.protected_mutation_performed === false), "Diff review does not apply patches, run git commands, invoke agents, accept plans, or mutate files."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.patch_application_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot apply reviewed diffs."),
  ];
}

function summarizeDiffReviewGate({
  implementationPatchCapture,
  protectedFileGate,
  diffReviewResults,
  fileFindings,
  artifactFindings,
  gateResults,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    diff_review_gate_status: validation.valid ? "complete" : "blocked",
    diff_review_gate_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_implementation_patch_capture_id: implementationPatchCapture.implementation_patch_capture_id ?? null,
    source_implementation_patch_capture_status: implementationPatchCapture.summary?.implementation_patch_capture_status ?? implementationPatchCapture.implementation_patch_capture_status ?? "unknown",
    source_protected_file_gate_id: protectedFileGate.protected_file_gate_id ?? null,
    source_protected_file_gate_status: protectedFileGate.summary?.protected_file_gate_status ?? protectedFileGate.protected_file_gate_status ?? "unknown",
    source_patch_record_count: implementationPatchCapture.summary?.patch_record_count ?? implementationPatchCapture.implementation_patch_records?.length ?? 0,
    source_diff_capture_count: implementationPatchCapture.summary?.diff_capture_count ?? implementationPatchCapture.implementation_diff_captures?.length ?? 0,
    source_touched_file_count: implementationPatchCapture.summary?.touched_file_count ?? implementationPatchCapture.implementation_touched_files?.length ?? 0,
    source_generated_artifact_count: implementationPatchCapture.summary?.generated_artifact_count ?? implementationPatchCapture.implementation_generated_artifacts?.length ?? 0,
    patch_record_count: implementationPatchCapture.summary?.patch_record_count ?? implementationPatchCapture.implementation_patch_records?.length ?? 0,
    diff_review_result_count: diffReviewResults.length,
    reviewed_diff_review_result_count: diffReviewResults.filter((record) => record.diff_review_status === "reviewed_with_human_gate").length,
    claude_code_review_result_count: diffReviewResults.filter((record) => record.agent === "claude_code").length,
    codex_review_result_count: diffReviewResults.filter((record) => record.agent === "codex").length,
    actual_diff_basis_available_count: diffReviewResults.filter((record) => record.actual_diff_basis_available).length,
    agent_self_report_trusted_count: diffReviewResults.filter((record) => record.agent_self_report_trusted).length,
    file_finding_count: fileFindings.length,
    reviewed_file_finding_count: fileFindings.filter((record) => record.file_finding_status === "reviewed_in_scope").length,
    in_scope_file_finding_count: fileFindings.filter((record) => record.in_frozen_scope).length,
    protected_file_finding_count: fileFindings.filter((record) => record.protected_file_detected).length,
    write_allowed_before_approval_count: fileFindings.filter((record) => record.write_allowed_before_approval).length,
    mutation_allowed_before_approval_count: fileFindings.filter((record) => record.mutation_allowed_before_approval).length,
    artifact_finding_count: artifactFindings.length,
    reviewed_artifact_finding_count: artifactFindings.filter((record) => record.artifact_finding_status === "reviewed_output_bound").length,
    generated_artifact_count: artifactFindings.length,
    gate_result_count: gateResults.length,
    passed_with_human_gate_count: gateResults.filter((record) => record.gate_result_status === "passed_with_human_gate").length,
    patch_application_allowed_count: gateResults.filter((record) => record.patch_application_allowed).length,
    patch_application_blocked_count: gateResults.filter((record) => record.patch_application_blocked).length,
    patch_application_performed_count: gateResults.filter((record) => record.patch_application_performed).length,
    git_command_executed_count: gateResults.filter((record) => record.git_command_executed).length,
    filesystem_mutation_performed_count: gateResults.filter((record) => record.filesystem_mutation_performed).length,
    protected_file_write_allowed_without_approval: fileFindings.some((record) => record.write_allowed_before_approval),
    protected_mutation_performed_count: gateResults.filter((record) => record.protected_mutation_performed).length + fileFindings.filter((record) => record.protected_action_executed).length,
    external_agent_invocation_performed_count: gateResults.filter((record) => record.external_agent_invocation_performed).length,
    plan_acceptance_performed_count: gateResults.filter((record) => record.plan_acceptance_performed).length,
    human_review_required: diffReviewResults.every((record) => record.human_review_required) && gateResults.every((record) => record.human_review_required),
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_patch_application_allowed: desktopBoundary.patch_application_allowed,
    desktop_git_command_allowed: desktopBoundary.git_command_allowed,
    desktop_filesystem_mutation_allowed: desktopBoundary.filesystem_mutation_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    desktop_external_agent_invocation_allowed: desktopBoundary.external_agent_invocation_allowed,
    desktop_plan_acceptance_allowed: desktopBoundary.plan_acceptance_allowed,
    desktop_merge_allowed: desktopBoundary.merge_allowed,
    desktop_release_allowed: desktopBoundary.release_allowed,
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
    by_agent: countBy(diffReviewResults, "agent"),
    by_diff_review_status: countBy(diffReviewResults, "diff_review_status"),
    by_file_finding_status: countBy(fileFindings, "file_finding_status"),
    by_artifact_finding_status: countBy(artifactFindings, "artifact_finding_status"),
    by_gate_result_status: countBy(gateResults, "gate_result_status"),
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    diff_review_gate_performed: true,
    patch_application_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    protected_mutation_performed: false,
    task_state_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, protectedFileGate }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("implementation_patch_capture", "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json", implementationPatchCapture),
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
    schema_version: "diff-review-checkpoint.v1",
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
    repo_root: options.repoRoot ?? DEFAULT_DIFF_REVIEW_GATE_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_DIFF_REVIEW_GATE_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_DIFF_REVIEW_GATE_INPUTS.roadmapPath,
    implementation_patch_capture_path: path.resolve(options.implementationPatchCapturePath ?? DEFAULT_DIFF_REVIEW_GATE_INPUTS.implementationPatchCapturePath),
    protected_file_gate_path: path.resolve(options.protectedFileGatePath ?? DEFAULT_DIFF_REVIEW_GATE_INPUTS.protectedFileGatePath),
  };
}

function serializableDiffReviewGate(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderDiffReviewGateMarkdown(result) {
  const lines = [];
  lines.push("# Diff Review Gate");
  lines.push("");
  lines.push(`Status: ${result.summary.diff_review_gate_status}`);
  lines.push(`Diff review results: ${result.summary.diff_review_result_count}`);
  lines.push(`File findings: ${result.summary.file_finding_count}`);
  lines.push(`Artifact findings: ${result.summary.artifact_finding_count}`);
  lines.push(`Gate results: ${result.summary.gate_result_count}`);
  lines.push("");
  lines.push("## Review Results");
  for (const record of result.diff_review_results) {
    lines.push(`- ${record.agent}: ${record.diff_review_status} -> ${record.next_gate}`);
  }
  lines.push("");
  lines.push("Human review note: diff review uses captured diff, touched file, and output artifact records instead of agent self-report. Patch application, protected writes, merge, release, and legal/client-facing outputs remain human-gated.");
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
    else if (arg === "--implementation-patch-capture") parsed.implementationPatchCapturePath = argv[++index];
    else if (arg === "--protected-file-gate") parsed.protectedFileGatePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/diff-review-gate.mjs [options]

Options:
  --check                                   Fail if validation errors are present
  --out-dir <path>                          Output directory
  --run-at <iso>                            Generated-at timestamp
  --repo-root <path>                        Repository root
  --package <path>                          package.json path relative to repo root
  --roadmap <path>                          final completion ledger path relative to repo root
  --implementation-patch-capture <path>     Implementation Patch Capture artifact path
  --protected-file-gate <path>              Protected File Gate artifact path
`);
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return { value: JSON.parse(text), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupBy(records, key) {
  const map = new Map();
  for (const record of records ?? []) {
    const value = record?.[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(record);
  }
  return map;
}

function countBy(records, key) {
  return (records ?? []).reduce((acc, record) => {
    const value = record?.[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function hashObject(value) {
  return createHash("sha256").update(JSON.stringify(sortObject(value))).digest("hex");
}

function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
