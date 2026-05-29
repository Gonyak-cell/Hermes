import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PR_DRAFT_ARTIFACT_OUT_DIR = "artifacts/pr-draft-artifact/latest";
export const DEFAULT_PR_DRAFT_ARTIFACT_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationPatchCapturePath: "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json",
  diffReviewGatePath: "artifacts/diff-review-gate/latest/diff-review-gate.json",
  canonicalTestMatrixPath: "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json",
  devProtectedScanPath: "artifacts/dev-protected-scan/latest/dev-protected-scan.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
};

const CONTRACT_ID = "pr-draft-artifact.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const DRAFT_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "validated_diff_test_protected_scan_and_output_artifact_contracts";
const DESKTOP_SURFACE_POLICY = "read_only_pr_draft_review_surface";
const REQUIRED_SECTION_TYPES = ["summary", "tests", "risks", "rollback"];

export async function runPrDraftArtifact(options = {}) {
  const result = await buildPrDraftArtifact(options);
  if (options.write !== false) await writePrDraftArtifact(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`PR draft artifact validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPrDraftArtifact(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PR_DRAFT_ARTIFACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationPatchCapture = await readJsonOrError(inputs.implementation_patch_capture_path);
  const diffReviewGate = await readJsonOrError(inputs.diff_review_gate_path);
  const canonicalTestMatrix = await readJsonOrError(inputs.canonical_test_matrix_path);
  const devProtectedScan = await readJsonOrError(inputs.dev_protected_scan_path);
  const outputDeliveryContractFreeze = await readJsonOrError(inputs.output_delivery_contract_freeze_path);
  const implementationArtifact = implementationPatchCapture.value ?? {};
  const diffReviewArtifact = diffReviewGate.value ?? {};
  const canonicalMatrixArtifact = canonicalTestMatrix.value ?? {};
  const protectedScanArtifact = devProtectedScan.value ?? {};
  const outputDeliveryArtifact = outputDeliveryContractFreeze.value ?? {};
  const sourceOutputArtifact = findSourcePrDraftOutputArtifact(outputDeliveryArtifact);
  const testEvidence = buildTestEvidence(canonicalMatrixArtifact, generatedAt);
  const riskRegister = buildRiskRegister({ devProtectedScan: protectedScanArtifact, diffReviewGate: diffReviewArtifact, generatedAt });
  const rollbackPlan = buildRollbackPlan({ generatedAt, outputDir });
  const sections = buildPrDraftSections({
    implementationPatchCapture: implementationArtifact,
    diffReviewGate: diffReviewArtifact,
    canonicalTestMatrix: canonicalMatrixArtifact,
    devProtectedScan: protectedScanArtifact,
    sourceOutputArtifact,
    testEvidence,
    riskRegister,
    rollbackPlan,
    generatedAt,
  });
  const markdown = renderPrDraftMarkdown({ sections, testEvidence, riskRegister, rollbackPlan, generatedAt });
  const outputArtifacts = buildOutputArtifacts({ sourceOutputArtifact, markdown, generatedAt });
  const bindings = buildBindings({ devProtectedScan: protectedScanArtifact, outputArtifacts, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    implementationPatchCapture: implementationArtifact,
    implementationPatchCaptureError: implementationPatchCapture.error,
    diffReviewGate: diffReviewArtifact,
    diffReviewGateError: diffReviewGate.error,
    canonicalTestMatrix: canonicalMatrixArtifact,
    canonicalTestMatrixError: canonicalTestMatrix.error,
    devProtectedScan: protectedScanArtifact,
    devProtectedScanError: devProtectedScan.error,
    outputDeliveryContractFreeze: outputDeliveryArtifact,
    outputDeliveryContractFreezeError: outputDeliveryContractFreeze.error,
    sourceOutputArtifact,
    outputArtifacts,
    sections,
    testEvidence,
    riskRegister,
    rollbackPlan,
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
  const summary = summarizePrDraftArtifact({
    implementationPatchCapture: implementationArtifact,
    diffReviewGate: diffReviewArtifact,
    canonicalTestMatrix: canonicalMatrixArtifact,
    devProtectedScan: protectedScanArtifact,
    outputDeliveryContractFreeze: outputDeliveryArtifact,
    sourceOutputArtifact,
    outputArtifacts,
    sections,
    testEvidence,
    riskRegister,
    rollbackPlan,
    bindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    pr_draft_artifact_id: `pr-draft-artifact.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    pr_draft_artifact_status: summary.pr_draft_artifact_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, diffReviewGate, canonicalTestMatrix, devProtectedScan, outputDeliveryContractFreeze }),
    pr_draft_contract: buildContract(generatedAt),
    source_implementation_patch_capture: buildSourceImplementationPatchCapture(implementationArtifact),
    source_diff_review_gate: buildSourceDiffReviewGate(diffReviewArtifact),
    source_canonical_test_matrix: buildSourceCanonicalTestMatrix(canonicalMatrixArtifact),
    source_dev_protected_scan: buildSourceDevProtectedScan(protectedScanArtifact),
    source_output_delivery_contract_freeze: buildSourceOutputDeliveryContractFreeze(outputDeliveryArtifact, sourceOutputArtifact),
    pr_draft_output_artifacts: outputArtifacts,
    pr_draft_sections: sections,
    pr_draft_test_evidence: testEvidence,
    pr_draft_risks: riskRegister,
    pr_draft_rollback_plan: rollbackPlan,
    pr_draft_bindings: bindings,
    pr_draft_desktop_boundary: desktopBoundary,
    pr_draft_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown,
    summary_markdown: renderPrDraftSummaryMarkdown(result),
  };
}

export async function writePrDraftArtifact(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePrDraftArtifact(result);
  await writeJson(path.join(outDir, "pr-draft-artifact.json"), serializable);
  await writeFile(path.join(outDir, "pr-draft.md"), result.markdown, "utf8");
  await writeJson(path.join(outDir, "pr-draft-output-artifacts.json"), {
    schema_version: "pr-draft-output-artifacts.v1",
    generated_at: result.generated_at,
    pr_draft_output_artifact_count: result.pr_draft_output_artifacts.length,
    pr_draft_output_artifacts: result.pr_draft_output_artifacts,
  });
  await writeJson(path.join(outDir, "pr-draft-sections.json"), {
    schema_version: "pr-draft-sections.v1",
    generated_at: result.generated_at,
    pr_draft_section_count: result.pr_draft_sections.length,
    pr_draft_sections: result.pr_draft_sections,
  });
  await writeJson(path.join(outDir, "pr-draft-test-evidence.json"), {
    schema_version: "pr-draft-test-evidence.v1",
    generated_at: result.generated_at,
    pr_draft_test_evidence_count: result.pr_draft_test_evidence.length,
    pr_draft_test_evidence: result.pr_draft_test_evidence,
  });
  await writeJson(path.join(outDir, "pr-draft-risks.json"), {
    schema_version: "pr-draft-risks.v1",
    generated_at: result.generated_at,
    pr_draft_risk_count: result.pr_draft_risks.length,
    pr_draft_risks: result.pr_draft_risks,
  });
  await writeJson(path.join(outDir, "pr-draft-rollback-plan.json"), {
    schema_version: "pr-draft-rollback-plan.v1",
    generated_at: result.generated_at,
    pr_draft_rollback_step_count: result.pr_draft_rollback_plan.length,
    pr_draft_rollback_plan: result.pr_draft_rollback_plan,
  });
  await writeJson(path.join(outDir, "pr-draft-bindings.json"), {
    schema_version: "pr-draft-bindings.v1",
    generated_at: result.generated_at,
    pr_draft_binding_count: result.pr_draft_bindings.length,
    pr_draft_bindings: result.pr_draft_bindings,
  });
  await writeJson(path.join(outDir, "pr-draft-desktop-boundary.json"), {
    schema_version: "pr-draft-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    pr_draft_desktop_boundary: result.pr_draft_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "pr-draft-validation-report.v1",
    generated_at: result.generated_at,
    pr_draft_artifact_id: result.pr_draft_artifact_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runPrDraftArtifactCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPrDraftArtifact(args);
    console.log(`PR draft artifact ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.pr_draft_artifact_status}`);
    console.log(`Output artifacts: ${result.summary.pr_draft_output_artifact_count}`);
    console.log(`Sections: ${result.summary.pr_draft_section_count}`);
    console.log(`Test evidence: ${result.summary.test_evidence_count}`);
    console.log(`Risks: ${result.summary.risk_count}`);
    console.log(`Rollback steps: ${result.summary.rollback_step_count}`);
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
    schema_version: "pr-draft-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    draft_authority: DRAFT_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    required_section_rule: "summary_tests_risks_and_rollback_sections_are_required",
    output_artifact_rule: "pr_draft_markdown_is_stored_as_output_artifact_v2_with_content_hash",
    gate_rule: "draft_can_be_reviewed_after_diff_review_canonical_tests_and_protected_scan_pass",
    execution_rule: "pr_draft_generation_does_not_call_github_create_pr_push_merge_release_apply_patches_or_mutate_files_outside_the_artifact_directory",
    desktop_companion_rule: "desktop_companion_reads_pr_draft_sections_test_evidence_risks_rollback_and_validation_only",
    human_review_rule: "actual_pr_creation_merge_release_and_client_facing_outputs_remain_human_gated",
    created_at: generatedAt,
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    pr_draft_artifact_generated: true,
    pull_request_creation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    merge_performed: false,
    release_performed: false,
    command_execution_performed: false,
    patch_application_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed_outside_artifact_dir: false,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    protected_mutation_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function buildSourceImplementationPatchCapture(artifact) {
  return {
    schema_version: "source-implementation-patch-capture-for-pr-draft.v1",
    implementation_patch_capture_id: artifact.implementation_patch_capture_id ?? null,
    implementation_patch_capture_status: artifact.summary?.implementation_patch_capture_status ?? artifact.implementation_patch_capture_status ?? "unknown",
    patch_record_count: artifact.summary?.patch_record_count ?? artifact.implementation_patch_records?.length ?? 0,
    touched_file_count: artifact.summary?.touched_file_count ?? artifact.implementation_touched_files?.length ?? 0,
    generated_artifact_count: artifact.summary?.generated_artifact_count ?? artifact.implementation_generated_artifacts?.length ?? 0,
    patch_application_performed_count: artifact.summary?.patch_application_performed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceDiffReviewGate(artifact) {
  return {
    schema_version: "source-diff-review-gate-for-pr-draft.v1",
    diff_review_gate_id: artifact.diff_review_gate_id ?? null,
    diff_review_gate_status: artifact.summary?.diff_review_gate_status ?? artifact.diff_review_gate_status ?? "unknown",
    gate_result_count: artifact.summary?.gate_result_count ?? artifact.diff_review_gate_results?.length ?? 0,
    passed_with_human_gate_count: artifact.summary?.passed_with_human_gate_count ?? 0,
    patch_application_allowed_count: artifact.summary?.patch_application_allowed_count ?? 0,
    direct_merge_allowed_count: artifact.summary?.direct_merge_allowed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceCanonicalTestMatrix(artifact) {
  return {
    schema_version: "source-canonical-test-matrix-for-pr-draft.v1",
    canonical_test_matrix_id: artifact.canonical_test_matrix_id ?? null,
    canonical_test_matrix_status: artifact.summary?.canonical_test_matrix_status ?? artifact.canonical_test_matrix_status ?? "unknown",
    required_dimension_count: artifact.summary?.required_dimension_count ?? 0,
    passed_required_dimension_count: artifact.summary?.passed_required_dimension_count ?? 0,
    failed_dimension_count: artifact.summary?.failed_dimension_count ?? 0,
    timed_out_dimension_count: artifact.summary?.timed_out_dimension_count ?? 0,
    binding_count: artifact.summary?.binding_count ?? artifact.canonical_test_matrix_bindings?.length ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceDevProtectedScan(artifact) {
  return {
    schema_version: "source-dev-protected-scan-for-pr-draft.v1",
    dev_protected_scan_id: artifact.dev_protected_scan_id ?? null,
    dev_protected_scan_status: artifact.summary?.dev_protected_scan_status ?? artifact.dev_protected_scan_status ?? "unknown",
    protected_candidate_count: artifact.summary?.protected_candidate_count ?? 0,
    blocked_before_approval_count: artifact.summary?.blocked_before_approval_count ?? 0,
    credential_or_secret_candidate_count: artifact.summary?.credential_or_secret_candidate_count ?? 0,
    credential_or_secret_change_blocked_count: artifact.summary?.credential_or_secret_change_blocked_count ?? 0,
    production_config_candidate_count: artifact.summary?.production_config_candidate_count ?? 0,
    production_config_change_blocked_count: artifact.summary?.production_config_change_blocked_count ?? 0,
    secret_value_materialized_count: artifact.summary?.secret_value_materialized_count ?? 0,
    raw_secret_material_exposed: artifact.summary?.raw_secret_material_exposed ?? false,
    provider_key_exposed: artifact.summary?.provider_key_exposed ?? false,
    binding_count: artifact.summary?.binding_count ?? artifact.pr_draft_bindings?.length ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function buildSourceOutputDeliveryContractFreeze(artifact, sourceOutputArtifact) {
  const outputArtifacts = artifact.output_artifacts ?? artifact.output_delivery_contract?.output_artifacts ?? [];
  const prDraftArtifacts = outputArtifacts.filter((item) => item.artifact_type === "pr_draft");
  return {
    schema_version: "source-output-delivery-contract-freeze-for-pr-draft.v1",
    freeze_id: artifact.freeze_id ?? null,
    freeze_status: artifact.summary?.freeze_status ?? artifact.freeze_status ?? "unknown",
    output_artifact_count: artifact.summary?.output_artifact_count ?? outputArtifacts.length,
    pr_draft_source_output_artifact_count: prDraftArtifacts.length,
    source_output_artifact_id: sourceOutputArtifact?.output_artifact_id ?? null,
    source_output_artifact_status: sourceOutputArtifact ? "available" : "missing",
    source_delivery_state: sourceOutputArtifact?.delivery_state ?? null,
    source_approval_status: sourceOutputArtifact?.approval_status ?? null,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject(artifact),
  };
}

function findSourcePrDraftOutputArtifact(outputDeliveryContractFreeze) {
  const outputArtifacts = outputDeliveryContractFreeze.output_artifacts ?? outputDeliveryContractFreeze.output_delivery_contract?.output_artifacts ?? [];
  return outputArtifacts.find((artifact) => (
    artifact.artifact_type === "pr_draft"
    && artifact.domain_pack === "personal-dev"
    && artifact.capability_id === CAPABILITY_ID
  )) ?? null;
}

function buildPrDraftSections({
  implementationPatchCapture,
  diffReviewGate,
  canonicalTestMatrix,
  devProtectedScan,
  sourceOutputArtifact,
  testEvidence,
  riskRegister,
  rollbackPlan,
  generatedAt,
}) {
  const summaryLines = [
    `Captured patch records: ${implementationPatchCapture.summary?.patch_record_count ?? implementationPatchCapture.implementation_patch_records?.length ?? 0}`,
    `Touched files: ${implementationPatchCapture.summary?.touched_file_count ?? implementationPatchCapture.implementation_touched_files?.length ?? 0}`,
    `Diff review gate results: ${diffReviewGate.summary?.gate_result_count ?? diffReviewGate.diff_review_gate_results?.length ?? 0}`,
    `Protected candidates blocked before approval: ${devProtectedScan.summary?.blocked_before_approval_count ?? 0}`,
    `Source OutputArtifact: ${sourceOutputArtifact?.output_artifact_id ?? "not_available"}`,
  ];
  const testLines = testEvidence.map((item) => `${item.test_dimension}: ${item.test_evidence_status}`);
  const riskLines = riskRegister.map((item) => `${item.risk_id}: ${item.risk_status} (${item.risk_level})`);
  const rollbackLines = rollbackPlan.map((item) => `${item.sequence}. ${item.rollback_action}: ${item.rollback_status}`);
  return [
    section("summary", "Summary", summaryLines, generatedAt),
    section("tests", "Tests", testLines, generatedAt),
    section("risks", "Risks", riskLines, generatedAt),
    section("rollback", "Rollback", rollbackLines, generatedAt),
  ];
}

function section(sectionType, title, contentLines, generatedAt) {
  return {
    schema_version: "pr-draft-section.v1",
    pr_draft_section_id: `pr-draft-section.${sectionType}`,
    generated_at: generatedAt,
    section_type: sectionType,
    section_status: "ready_for_human_review",
    title,
    content_lines: contentLines,
    content_hash: hashObject({ sectionType, title, contentLines }),
    human_review_required: true,
  };
}

function buildTestEvidence(canonicalTestMatrix, generatedAt) {
  return (canonicalTestMatrix.canonical_test_matrix_results ?? [])
    .filter((result) => result.execution_required !== false)
    .map((result, index) => ({
      schema_version: "pr-draft-test-evidence.v1",
      pr_draft_test_evidence_id: `pr-draft-test-evidence.${slugify(result.test_dimension ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      source_canonical_test_matrix_result_id: result.canonical_test_matrix_result_id ?? null,
      source_canonical_test_matrix_execution_id: result.canonical_test_matrix_execution_id ?? null,
      test_dimension: result.test_dimension ?? "unknown",
      test_evidence_status: result.matrix_result_status === "passed" ? "passed" : "attention",
      execution_required: result.execution_required !== false,
      execution_performed: result.execution_performed === true,
      command: result.command ?? result.command_display ?? null,
      exit_code: result.exit_code ?? 0,
      agent_self_report_trusted: result.agent_self_report_trusted ?? false,
      runtime_self_report_trusted: result.runtime_self_report_trusted ?? false,
      direct_merge_allowed: result.direct_merge_allowed ?? false,
      human_review_required: true,
      evidence_hash: hashObject(result),
    }));
}

function buildRiskRegister({ devProtectedScan, diffReviewGate, generatedAt }) {
  const protectedCount = devProtectedScan.summary?.protected_candidate_count ?? 0;
  const secretCount = devProtectedScan.summary?.credential_or_secret_candidate_count ?? 0;
  const prodConfigCount = devProtectedScan.summary?.production_config_candidate_count ?? 0;
  const diffGateCount = diffReviewGate.summary?.gate_result_count ?? 0;
  return [
    risk("protected-file-approval", "high", "documented_for_human_review", `${protectedCount} protected candidate(s) remain blocked pending explicit approval.`, "Do not merge until protected approval request is reviewed.", generatedAt),
    risk("secret-credential-change", "high", "blocked_without_materialization", `${secretCount} credential or secret candidate(s) were blocked without materializing raw secret values.`, "Keep secret material out of PR body and require explicit approval for any credential change.", generatedAt),
    risk("production-config-change", "high", "blocked_pending_explicit_approval", `${prodConfigCount} production config candidate(s) were blocked before approval.`, "Keep production config write/merge blocked until the approving actor signs off.", generatedAt),
    risk("diff-review-human-gate", "medium", "documented_for_human_review", `${diffGateCount} diff review gate result(s) require human review before merge.`, "Review captured diff, test evidence, protected scan, and rollback before creating or merging a PR.", generatedAt),
  ];
}

function risk(riskKey, riskLevel, riskStatus, riskSummary, mitigation, generatedAt) {
  return {
    schema_version: "pr-draft-risk.v1",
    pr_draft_risk_id: `pr-draft-risk.${riskKey}`,
    generated_at: generatedAt,
    risk_key: riskKey,
    risk_level: riskLevel,
    risk_status: riskStatus,
    risk_summary: riskSummary,
    mitigation,
    human_review_required: true,
    risk_hash: hashObject({ riskKey, riskLevel, riskStatus, riskSummary, mitigation }),
  };
}

function buildRollbackPlan({ generatedAt, outputDir }) {
  return [
    rollbackStep(1, "do_not_merge_without_approval", "Keep the PR draft in review-only state; no branch push, GitHub PR creation, merge, or release is executed by this artifact.", generatedAt),
    rollbackStep(2, "discard_generated_pr_draft", `If the draft is rejected, archive or remove ${normalizePath(path.join(outputDir, "pr-draft.md"))} and rerun P225 after corrections.`, generatedAt),
    rollbackStep(3, "rerun_validation_gates", "Rerun implementation patch capture, diff review, canonical test matrix, protected scan, dashboard, API smoke, loop, and goal checkpoint before a new review.", generatedAt),
  ];
}

function rollbackStep(sequence, rollbackAction, instruction, generatedAt) {
  return {
    schema_version: "pr-draft-rollback-step.v1",
    pr_draft_rollback_step_id: `pr-draft-rollback-step.${sequence}`,
    generated_at: generatedAt,
    sequence,
    rollback_action: rollbackAction,
    rollback_status: "draft_not_executed",
    instruction,
    command_execution_allowed: false,
    protected_action_allowed: false,
    merge_reversal_required: false,
    human_review_required: true,
    rollback_hash: hashObject({ sequence, rollbackAction, instruction }),
  };
}

function buildOutputArtifacts({ sourceOutputArtifact, markdown, generatedAt }) {
  const outputArtifactId = "output.personal_dev.p225.pr_draft";
  return [{
    schema_version: "output-artifact.v2",
    output_artifact_id: outputArtifactId,
    source_output_artifact_id: sourceOutputArtifact?.output_artifact_id ?? null,
    source_id: "pr_draft_artifact",
    source_label: "PR Draft Artifact",
    domain_pack: "personal-dev",
    capability_id: CAPABILITY_ID,
    workflow_run_id: sourceOutputArtifact?.workflow_run_id ?? "workflow-run.personal_dev.p225.pr_draft_artifact",
    tenant_id: sourceOutputArtifact?.tenant_id ?? "tenant.personal.jws",
    matter_id: sourceOutputArtifact?.matter_id ?? "matter.personal_dev.hermes",
    artifact_type: "pr_draft",
    artifact_uri: "artifacts/pr-draft-artifact/latest/pr-draft.md",
    content_hash: hashText(markdown),
    hash_algorithm: "sha256",
    hash_status: "present",
    output_status: "draft",
    delivery_state: "blocked_pending_approval",
    delivery_state_after_receipt: "ready_for_delivery",
    approval_id: "approval.personal_dev.p225.pr_draft.human_review",
    approval_status: "pending",
    approval_request_ids: ["approval.personal_dev.p225.pr_draft.human_review"],
    approval_request_count: 1,
    delivery_action_ids: ["delivery.personal_dev.p225.pr_draft"],
    delivery_action_count: 1,
    delivery_receipt_ids: [],
    delivery_receipt_count: 0,
    blocking_gate_ids: ["human_approval_gate"],
    blocking_gate_count: 1,
    citation_count: 0,
    created_by_run_id: "agent-run.personal_dev.p225.pr_draft_artifact",
    created_at: generatedAt,
    recorded_at: generatedAt,
    approval_separation_status: "approval_required_not_applied",
    delivery_separation_status: "separate_delivery_action_declared",
    receipt_separation_status: "receipt_required_before_delivery",
    event_id: "event.output.rendered.personal_dev.p225.pr_draft",
    policy_snapshot_id: sourceOutputArtifact?.policy_snapshot_id ?? "policy.default.personal_dev.v1",
    metadata: {
      title: "Hermes Personal Dev PR draft",
      required_sections: REQUIRED_SECTION_TYPES,
      source_pr_draft_output_artifact_id: sourceOutputArtifact?.output_artifact_id ?? null,
    },
  }];
}

function buildBindings({ devProtectedScan, outputArtifacts, generatedAt }) {
  const outputArtifact = outputArtifacts[0];
  return (devProtectedScan.dev_protected_scan_bindings ?? []).map((binding, index) => ({
    schema_version: "pr-draft-binding.v1",
    pr_draft_binding_id: `pr-draft-binding.${slugify(binding.dev_protected_scan_binding_id ?? index + 1)}`,
    generated_at: generatedAt,
    sequence: index + 1,
    source_dev_protected_scan_binding_id: binding.dev_protected_scan_binding_id ?? null,
    source_dev_protected_scan_result_id: binding.dev_protected_scan_result_id ?? null,
    source_canonical_test_matrix_binding_id: binding.source_canonical_test_matrix_binding_id ?? null,
    source_diff_review_gate_result_id: binding.source_diff_review_gate_result_id ?? null,
    output_artifact_id: outputArtifact.output_artifact_id,
    pr_draft_binding_status: "bound_after_protected_scan",
    canonical_matrix_required_tests_passed: true,
    protected_scan_result_status: binding.protected_scan_result_status ?? "passed_with_protected_blocks",
    output_artifact_binding_status: "bound_to_output_artifact",
    pull_request_creation_allowed: false,
    direct_merge_allowed: false,
    direct_apply_allowed: false,
    release_allowed: false,
    human_review_required: true,
    binding_hash: hashObject({ binding, outputArtifact }),
  }));
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "pr-draft-desktop-boundary.v1",
    boundary_id: "pr-draft-desktop-boundary.personal-dev",
    generated_at: generatedAt,
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    visible_collections: ["pr_draft_output_artifacts", "pr_draft_sections", "pr_draft_test_evidence", "pr_draft_risks", "pr_draft_rollback_plan", "pr_draft_bindings", "validation_items"],
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed: false,
    github_api_allowed: false,
    pull_request_creation_allowed: false,
    branch_push_allowed: false,
    patch_application_allowed: false,
    git_command_allowed: false,
    filesystem_mutation_allowed: false,
    protected_file_write_allowed: false,
    secret_material_read_allowed: false,
    production_config_write_allowed: false,
    direct_merge_allowed: false,
    release_allowed: false,
    external_agent_invocation_allowed: false,
    plan_acceptance_allowed: false,
    source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    human_review_required: true,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  implementationPatchCapture,
  implementationPatchCaptureError,
  diffReviewGate,
  diffReviewGateError,
  canonicalTestMatrix,
  canonicalTestMatrixError,
  devProtectedScan,
  devProtectedScanError,
  outputDeliveryContractFreeze,
  outputDeliveryContractFreezeError,
  sourceOutputArtifact,
  outputArtifacts,
  sections,
  testEvidence,
  riskRegister,
  rollbackPlan,
  bindings,
  desktopBoundary,
}) {
  const protectedSummary = devProtectedScan.summary ?? {};
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:pr-draft"]), "package.json exposes personal-dev:pr-draft."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P225") && String(roadmapText ?? "").includes("PR draft artifact"), "Final completion ledger declares P225 PR draft artifact."),
    checkpoint("implementation_patch_capture_complete", !implementationPatchCaptureError && implementationPatchCapture.summary?.implementation_patch_capture_status === "complete" && implementationPatchCapture.summary?.validation_error_count === 0, "Implementation Patch Capture is complete before PR draft artifact generation."),
    checkpoint("diff_review_gate_complete", !diffReviewGateError && diffReviewGate.summary?.diff_review_gate_status === "complete" && diffReviewGate.summary?.passed_with_human_gate_count === 2 && diffReviewGate.summary?.validation_error_count === 0, "Diff Review Gate is complete before PR draft artifact generation."),
    checkpoint("canonical_test_matrix_complete", !canonicalTestMatrixError && canonicalTestMatrix.summary?.canonical_test_matrix_status === "complete" && canonicalTestMatrix.summary?.passed_required_dimension_count === canonicalTestMatrix.summary?.required_dimension_count && canonicalTestMatrix.summary?.validation_error_count === 0, "Canonical Test Matrix is complete before PR draft artifact generation."),
    checkpoint("dev_protected_scan_complete", !devProtectedScanError && protectedSummary.dev_protected_scan_status === "complete" && protectedSummary.validation_error_count === 0 && protectedSummary.secret_value_materialized_count === 0, "Dev Protected Scan is complete and does not materialize secret values."),
    checkpoint("output_delivery_source_pr_draft_available", !outputDeliveryContractFreezeError && (outputDeliveryContractFreeze.summary?.freeze_status ?? outputDeliveryContractFreeze.freeze_status) === "complete" && Boolean(sourceOutputArtifact), "Output Delivery Contract Freeze exposes a source personal-dev PR draft OutputArtifact."),
    checkpoint("output_artifact_v2_stored", outputArtifacts.length === 1 && outputArtifacts.every((artifact) => artifact.schema_version === "output-artifact.v2" && artifact.artifact_type === "pr_draft" && artifact.hash_status === "present" && artifact.output_status === "draft" && artifact.delivery_state === "blocked_pending_approval" && artifact.approval_status === "pending"), "PR draft is stored as draft OutputArtifact v2 blocked pending approval."),
    checkpoint("required_sections_present", REQUIRED_SECTION_TYPES.every((sectionType) => sections.some((sectionItem) => sectionItem.section_type === sectionType && sectionItem.section_status === "ready_for_human_review")), "Summary, tests, risks, and rollback sections are present."),
    checkpoint("test_evidence_passed", testEvidence.length >= 3 && testEvidence.every((evidence) => evidence.test_evidence_status === "passed" && evidence.agent_self_report_trusted === false && evidence.direct_merge_allowed === false), "Required canonical test evidence is passed and not sourced from agent self-report."),
    checkpoint("risks_and_rollback_documented", riskRegister.length >= 4 && rollbackPlan.length >= 3 && rollbackPlan.every((step) => step.rollback_status === "draft_not_executed" && step.command_execution_allowed === false), "Risks and rollback plan are documented without executing rollback commands."),
    checkpoint("bindings_after_protected_scan", bindings.length === 2 && bindings.every((binding) => binding.pr_draft_binding_status === "bound_after_protected_scan" && binding.pull_request_creation_allowed === false && binding.direct_merge_allowed === false), "PR draft bindings are created after protected scan and do not allow PR creation or merge."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.github_api_allowed === false && desktopBoundary.pull_request_creation_allowed === false && desktopBoundary.direct_merge_allowed === false && desktopBoundary.source_of_truth === false, "Desktop PR draft boundary is read-only and not source of truth."),
    checkpoint("human_review_gate_preserved", outputArtifacts.every((artifact) => artifact.blocking_gate_ids.includes("human_approval_gate")) && desktopBoundary.human_review_required === true, "Human review gate remains required before PR creation, merge, release, or client-facing output."),
  ];
}

function summarizePrDraftArtifact({
  implementationPatchCapture,
  diffReviewGate,
  canonicalTestMatrix,
  devProtectedScan,
  outputDeliveryContractFreeze,
  sourceOutputArtifact,
  outputArtifacts,
  sections,
  testEvidence,
  riskRegister,
  rollbackPlan,
  bindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  return {
    pr_draft_artifact_status: validation.valid ? "complete" : "blocked",
    pr_draft_artifact_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    draft_authority: DRAFT_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_implementation_patch_capture_status: implementationPatchCapture.summary?.implementation_patch_capture_status ?? "unknown",
    source_diff_review_gate_status: diffReviewGate.summary?.diff_review_gate_status ?? "unknown",
    source_canonical_test_matrix_status: canonicalTestMatrix.summary?.canonical_test_matrix_status ?? "unknown",
    source_dev_protected_scan_status: devProtectedScan.summary?.dev_protected_scan_status ?? "unknown",
    source_output_delivery_contract_freeze_status: outputDeliveryContractFreeze.summary?.freeze_status ?? outputDeliveryContractFreeze.freeze_status ?? "unknown",
    source_patch_record_count: implementationPatchCapture.summary?.patch_record_count ?? 0,
    source_touched_file_count: implementationPatchCapture.summary?.touched_file_count ?? 0,
    source_diff_review_gate_result_count: diffReviewGate.summary?.gate_result_count ?? 0,
    source_required_test_count: canonicalTestMatrix.summary?.required_dimension_count ?? 0,
    source_passed_required_test_count: canonicalTestMatrix.summary?.passed_required_dimension_count ?? 0,
    source_protected_candidate_count: devProtectedScan.summary?.protected_candidate_count ?? 0,
    source_blocked_before_approval_count: devProtectedScan.summary?.blocked_before_approval_count ?? 0,
    source_secret_candidate_count: devProtectedScan.summary?.credential_or_secret_candidate_count ?? 0,
    source_prod_config_candidate_count: devProtectedScan.summary?.production_config_candidate_count ?? 0,
    source_pr_draft_output_artifact_available: Boolean(sourceOutputArtifact),
    pr_draft_output_artifact_count: outputArtifacts.length,
    output_artifact_v2_count: outputArtifacts.filter((artifact) => artifact.schema_version === "output-artifact.v2").length,
    output_artifact_hash_present_count: outputArtifacts.filter((artifact) => artifact.hash_status === "present").length,
    output_artifact_draft_count: outputArtifacts.filter((artifact) => artifact.output_status === "draft").length,
    output_artifact_blocked_pending_approval_count: outputArtifacts.filter((artifact) => artifact.delivery_state === "blocked_pending_approval").length,
    output_artifact_pending_approval_count: outputArtifacts.filter((artifact) => artifact.approval_status === "pending").length,
    pr_draft_section_count: sections.length,
    summary_section_present: sections.some((sectionItem) => sectionItem.section_type === "summary"),
    tests_section_present: sections.some((sectionItem) => sectionItem.section_type === "tests"),
    risks_section_present: sections.some((sectionItem) => sectionItem.section_type === "risks"),
    rollback_section_present: sections.some((sectionItem) => sectionItem.section_type === "rollback"),
    ready_section_count: sections.filter((sectionItem) => sectionItem.section_status === "ready_for_human_review").length,
    test_evidence_count: testEvidence.length,
    passed_test_evidence_count: testEvidence.filter((evidence) => evidence.test_evidence_status === "passed").length,
    agent_self_report_trusted_test_count: testEvidence.filter((evidence) => evidence.agent_self_report_trusted).length,
    runtime_self_report_trusted_test_count: testEvidence.filter((evidence) => evidence.runtime_self_report_trusted).length,
    risk_count: riskRegister.length,
    high_risk_count: riskRegister.filter((riskItem) => riskItem.risk_level === "high").length,
    documented_risk_count: riskRegister.filter((riskItem) => ["documented_for_human_review", "blocked_without_materialization", "blocked_pending_explicit_approval"].includes(riskItem.risk_status)).length,
    rollback_step_count: rollbackPlan.length,
    draft_not_executed_rollback_step_count: rollbackPlan.filter((step) => step.rollback_status === "draft_not_executed").length,
    rollback_command_execution_allowed_count: rollbackPlan.filter((step) => step.command_execution_allowed).length,
    pr_draft_binding_count: bindings.length,
    bound_after_protected_scan_count: bindings.filter((binding) => binding.pr_draft_binding_status === "bound_after_protected_scan").length,
    pull_request_creation_allowed_count: bindings.filter((binding) => binding.pull_request_creation_allowed).length,
    direct_merge_allowed_count: bindings.filter((binding) => binding.direct_merge_allowed).length,
    direct_apply_allowed_count: bindings.filter((binding) => binding.direct_apply_allowed).length,
    release_allowed_count: bindings.filter((binding) => binding.release_allowed).length,
    pull_request_creation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    merge_performed: false,
    release_performed: false,
    patch_application_performed_count: 0,
    git_command_executed_count: 0,
    filesystem_mutation_performed_count: 0,
    protected_mutation_performed_count: 0,
    external_agent_invocation_performed_count: 0,
    plan_acceptance_performed_count: 0,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    human_review_required: true,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_command_execution_allowed: desktopBoundary.command_execution_allowed,
    desktop_github_api_allowed: desktopBoundary.github_api_allowed,
    desktop_pull_request_creation_allowed: desktopBoundary.pull_request_creation_allowed,
    desktop_branch_push_allowed: desktopBoundary.branch_push_allowed,
    desktop_patch_application_allowed: desktopBoundary.patch_application_allowed,
    desktop_git_command_allowed: desktopBoundary.git_command_allowed,
    desktop_filesystem_mutation_allowed: desktopBoundary.filesystem_mutation_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
    desktop_secret_material_read_allowed: desktopBoundary.secret_material_read_allowed,
    desktop_production_config_write_allowed: desktopBoundary.production_config_write_allowed,
    desktop_direct_merge_allowed: desktopBoundary.direct_merge_allowed,
    desktop_release_allowed: desktopBoundary.release_allowed,
    desktop_external_agent_invocation_allowed: desktopBoundary.external_agent_invocation_allowed,
    desktop_plan_acceptance_allowed: desktopBoundary.plan_acceptance_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_section_type: countBy(sections, "section_type"),
    by_test_evidence_status: countBy(testEvidence, "test_evidence_status"),
    by_risk_status: countBy(riskRegister, "risk_status"),
    by_rollback_status: countBy(rollbackPlan, "rollback_status"),
    by_binding_status: countBy(bindings, "pr_draft_binding_status"),
  };
}

function buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, diffReviewGate, canonicalTestMatrix, devProtectedScan, outputDeliveryContractFreeze }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("implementation_patch_capture", "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json", implementationPatchCapture),
    sourceContract("diff_review_gate", "artifacts/diff-review-gate/latest/diff-review-gate.json", diffReviewGate),
    sourceContract("canonical_test_matrix", "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json", canonicalTestMatrix),
    sourceContract("dev_protected_scan", "artifacts/dev-protected-scan/latest/dev-protected-scan.json", devProtectedScan),
    sourceContract("output_delivery_contract_freeze", "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json", outputDeliveryContractFreeze),
  ];
}

function sourceContract(sourceId, sourcePath, readResult) {
  const value = readResult.value ?? readResult;
  return {
    schema_version: "pr-draft-source-contract.v1",
    source_id: sourceId,
    source_path: sourcePath,
    source_status: readResult.error ? "missing" : "available",
    error: readResult.error ?? null,
    source_hash: hashObject(value ?? {}),
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    schema_version: "pr-draft-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    schema_version: "pr-draft-validation.v1",
    valid: errors.length === 0,
    errors,
  };
}

function renderPrDraftMarkdown({ sections, testEvidence, riskRegister, rollbackPlan, generatedAt }) {
  const sectionByType = new Map(sections.map((sectionItem) => [sectionItem.section_type, sectionItem]));
  const lines = [];
  lines.push("# PR Draft: Hermes Personal Dev validated change");
  lines.push("");
  lines.push(`Generated: ${generatedAt}`);
  lines.push("");
  lines.push("## Summary");
  for (const line of sectionByType.get("summary")?.content_lines ?? []) lines.push(`- ${line}`);
  lines.push("");
  lines.push("## Tests");
  for (const evidence of testEvidence) {
    lines.push(`- ${evidence.test_dimension}: ${evidence.test_evidence_status}`);
  }
  lines.push("");
  lines.push("## Risks");
  for (const riskItem of riskRegister) {
    lines.push(`- ${riskItem.risk_key}: ${riskItem.risk_summary} Mitigation: ${riskItem.mitigation}`);
  }
  lines.push("");
  lines.push("## Rollback");
  for (const step of rollbackPlan) {
    lines.push(`${step.sequence}. ${step.instruction}`);
  }
  lines.push("");
  lines.push("## Human Review");
  lines.push("");
  lines.push("This is a draft output artifact. Creating a GitHub PR, pushing a branch, merging, releasing, protected writes, production config changes, credential changes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function renderPrDraftSummaryMarkdown(result) {
  const lines = [];
  lines.push("# PR Draft Artifact");
  lines.push("");
  lines.push(`Status: ${result.summary.pr_draft_artifact_status}`);
  lines.push(`Output artifacts: ${result.summary.pr_draft_output_artifact_count}`);
  lines.push(`Sections: ${result.summary.pr_draft_section_count}`);
  lines.push(`Test evidence: ${result.summary.passed_test_evidence_count}/${result.summary.test_evidence_count}`);
  lines.push(`Risks: ${result.summary.risk_count}`);
  lines.push(`Rollback steps: ${result.summary.rollback_step_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: PR creation, merge, release, protected writes, credential changes, production config changes, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function serializablePrDraftArtifact(result) {
  const { markdown: _markdown, summary_markdown: _summaryMarkdown, output_dir: _outputDir, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.roadmapPath,
    implementation_patch_capture_path: path.resolve(options.implementationPatchCapturePath ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.implementationPatchCapturePath),
    diff_review_gate_path: path.resolve(options.diffReviewGatePath ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.diffReviewGatePath),
    canonical_test_matrix_path: path.resolve(options.canonicalTestMatrixPath ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.canonicalTestMatrixPath),
    dev_protected_scan_path: path.resolve(options.devProtectedScanPath ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.devProtectedScanPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_PR_DRAFT_ARTIFACT_INPUTS.outputDeliveryContractFreezePath),
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
    else if (arg === "--canonical-test-matrix") parsed.canonicalTestMatrixPath = argv[++index];
    else if (arg === "--dev-protected-scan") parsed.devProtectedScanPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/pr-draft-artifact.mjs [options]

Options:
  --check                                  Fail when validation does not pass
  --no-write                               Build without writing artifacts
  --out-dir <path>                         Output directory
  --repo-root <path>                       Repository root
  --package <path>                         package.json path relative to repo root
  --roadmap <path>                         final completion ledger path relative to repo root
  --implementation-patch-capture <path>    implementation-patch-capture.json path
  --diff-review-gate <path>                diff-review-gate.json path
  --canonical-test-matrix <path>           canonical-test-matrix.json path
  --dev-protected-scan <path>              dev-protected-scan.json path
  --output-delivery-contract-freeze <path> output-delivery-contract-freeze.json path`);
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

function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "item";
}

function normalizePath(filePath) {
  return String(filePath ?? "").replace(/\\/g, "/");
}
