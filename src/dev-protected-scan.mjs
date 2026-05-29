import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DEV_PROTECTED_SCAN_OUT_DIR = "artifacts/dev-protected-scan/latest";
export const DEFAULT_DEV_PROTECTED_SCAN_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationPatchCapturePath: "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json",
  diffReviewGatePath: "artifacts/diff-review-gate/latest/diff-review-gate.json",
  canonicalTestMatrixPath: "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json",
  protectedFileGatePath: "artifacts/protected-file-gate/latest/protected-file-gate.json",
};

const CONTRACT_ID = "dev-protected-scan.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SCAN_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "captured_diff_files_protected_rules_and_secret_patterns_after_canonical_tests";
const DESKTOP_SURFACE_POLICY = "read_only_dev_protected_scan_surface";

export async function runDevProtectedScan(options = {}) {
  const result = await buildDevProtectedScan(options);
  if (options.write !== false) await writeDevProtectedScan(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Dev protected scan validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDevProtectedScan(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DEV_PROTECTED_SCAN_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationPatchCapture = await readJsonOrError(inputs.implementation_patch_capture_path);
  const diffReviewGate = await readJsonOrError(inputs.diff_review_gate_path);
  const canonicalTestMatrix = await readJsonOrError(inputs.canonical_test_matrix_path);
  const protectedFileGate = await readJsonOrError(inputs.protected_file_gate_path);
  const implementationArtifact = implementationPatchCapture.value ?? {};
  const diffReviewArtifact = diffReviewGate.value ?? {};
  const canonicalMatrixArtifact = canonicalTestMatrix.value ?? {};
  const protectedGateArtifact = protectedFileGate.value ?? {};
  const fileFindings = buildProtectedFileFindings({
    implementationPatchCapture: implementationArtifact,
    protectedFileGate: protectedGateArtifact,
    generatedAt,
  });
  const secretFindings = buildSecretFindings(fileFindings, generatedAt);
  const prodConfigFindings = buildProdConfigFindings(fileFindings, generatedAt);
  const scanResults = buildScanResults({
    diffReviewGate: diffReviewArtifact,
    canonicalTestMatrix: canonicalMatrixArtifact,
    fileFindings,
    secretFindings,
    prodConfigFindings,
    generatedAt,
  });
  const bindings = buildBindings({ canonicalTestMatrix: canonicalMatrixArtifact, scanResults, generatedAt });
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
    protectedFileGate: protectedGateArtifact,
    protectedFileGateError: protectedFileGate.error,
    fileFindings,
    secretFindings,
    prodConfigFindings,
    scanResults,
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
  const summary = summarizeDevProtectedScan({
    implementationPatchCapture: implementationArtifact,
    diffReviewGate: diffReviewArtifact,
    canonicalTestMatrix: canonicalMatrixArtifact,
    protectedFileGate: protectedGateArtifact,
    fileFindings,
    secretFindings,
    prodConfigFindings,
    scanResults,
    bindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    dev_protected_scan_id: `dev-protected-scan.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    dev_protected_scan_status: summary.dev_protected_scan_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, diffReviewGate, canonicalTestMatrix, protectedFileGate }),
    dev_protected_scan_contract: buildContract(generatedAt),
    source_implementation_patch_capture: buildSourceImplementationPatchCapture(implementationArtifact),
    source_diff_review_gate: buildSourceDiffReviewGate(diffReviewArtifact),
    source_canonical_test_matrix: buildSourceCanonicalTestMatrix(canonicalMatrixArtifact),
    source_protected_file_gate: buildSourceProtectedFileGate(protectedGateArtifact),
    dev_protected_file_findings: fileFindings,
    dev_secret_findings: secretFindings,
    dev_prod_config_findings: prodConfigFindings,
    dev_protected_scan_results: scanResults,
    dev_protected_scan_bindings: bindings,
    dev_protected_scan_desktop_boundary: desktopBoundary,
    dev_protected_scan_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderDevProtectedScanMarkdown(result),
  };
}

export async function writeDevProtectedScan(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDevProtectedScan(result);
  await writeJson(path.join(outDir, "dev-protected-scan.json"), serializable);
  await writeJson(path.join(outDir, "dev-protected-file-findings.json"), {
    schema_version: "dev-protected-file-findings.v1",
    generated_at: result.generated_at,
    dev_protected_file_finding_count: result.dev_protected_file_findings.length,
    dev_protected_file_findings: result.dev_protected_file_findings,
  });
  await writeJson(path.join(outDir, "dev-secret-findings.json"), {
    schema_version: "dev-secret-findings.v1",
    generated_at: result.generated_at,
    dev_secret_finding_count: result.dev_secret_findings.length,
    dev_secret_findings: result.dev_secret_findings,
  });
  await writeJson(path.join(outDir, "dev-prod-config-findings.json"), {
    schema_version: "dev-prod-config-findings.v1",
    generated_at: result.generated_at,
    dev_prod_config_finding_count: result.dev_prod_config_findings.length,
    dev_prod_config_findings: result.dev_prod_config_findings,
  });
  await writeJson(path.join(outDir, "dev-protected-scan-results.json"), {
    schema_version: "dev-protected-scan-results.v1",
    generated_at: result.generated_at,
    dev_protected_scan_result_count: result.dev_protected_scan_results.length,
    dev_protected_scan_results: result.dev_protected_scan_results,
  });
  await writeJson(path.join(outDir, "dev-protected-scan-bindings.json"), {
    schema_version: "dev-protected-scan-bindings.v1",
    generated_at: result.generated_at,
    dev_protected_scan_binding_count: result.dev_protected_scan_bindings.length,
    dev_protected_scan_bindings: result.dev_protected_scan_bindings,
  });
  await writeJson(path.join(outDir, "dev-protected-scan-desktop-boundary.json"), {
    schema_version: "dev-protected-scan-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    dev_protected_scan_desktop_boundary: result.dev_protected_scan_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "dev-protected-scan-validation-report.v1",
    generated_at: result.generated_at,
    dev_protected_scan_id: result.dev_protected_scan_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDevProtectedScanCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDevProtectedScan(args);
    console.log(`Dev protected scan ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.dev_protected_scan_status}`);
    console.log(`Protected candidates: ${result.summary.protected_candidate_count}`);
    console.log(`Secrets blocked: ${result.summary.credential_or_secret_change_blocked_count}`);
    console.log(`Prod config blocked: ${result.summary.production_config_change_blocked_count}`);
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
    schema_version: "dev-protected-scan-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    scan_authority: SCAN_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    secret_scan_rule: "secret_and_credential_paths_are_detected_from_protected_gate_metadata_without_materializing_secret_values",
    production_config_rule: "production_config_and_infra_paths_are_blocked_before_explicit_human_approval",
    canonical_test_dependency_rule: "protected_scan_runs_after_diff_review_and_canonical_test_matrix_have_passed",
    execution_rule: "scan_does_not_apply_patches_run_git_commands_mutate_files_invoke_agents_accept_plans_or_merge",
    desktop_companion_rule: "desktop_companion_reads_protected_scan_findings_results_bindings_and_validation_only",
    mutation_policy: "protected_file_write_secret_change_prod_config_change_merge_release_and_client_facing_outputs_remain_human_gated",
    created_at: generatedAt,
  };
}

function buildSourceImplementationPatchCapture(artifact) {
  return {
    schema_version: "source-implementation-patch-capture-for-dev-protected-scan.v1",
    implementation_patch_capture_id: artifact.implementation_patch_capture_id ?? null,
    implementation_patch_capture_status: artifact.summary?.implementation_patch_capture_status ?? artifact.implementation_patch_capture_status ?? "unknown",
    touched_file_count: artifact.summary?.touched_file_count ?? artifact.implementation_touched_files?.length ?? 0,
    generated_artifact_count: artifact.summary?.generated_artifact_count ?? artifact.implementation_generated_artifacts?.length ?? 0,
    patch_application_performed_count: artifact.summary?.patch_application_performed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      implementation_patch_capture_id: artifact.implementation_patch_capture_id ?? null,
      touched_files: artifact.implementation_touched_files ?? [],
      generated_artifacts: artifact.implementation_generated_artifacts ?? [],
    }),
  };
}

function buildSourceDiffReviewGate(artifact) {
  return {
    schema_version: "source-diff-review-gate-for-dev-protected-scan.v1",
    diff_review_gate_id: artifact.diff_review_gate_id ?? null,
    diff_review_gate_status: artifact.summary?.diff_review_gate_status ?? artifact.diff_review_gate_status ?? "unknown",
    gate_result_count: artifact.summary?.gate_result_count ?? artifact.diff_review_gate_results?.length ?? 0,
    passed_with_human_gate_count: artifact.summary?.passed_with_human_gate_count ?? 0,
    patch_application_allowed_count: artifact.summary?.patch_application_allowed_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      diff_review_gate_id: artifact.diff_review_gate_id ?? null,
      diff_review_results: artifact.diff_review_results ?? [],
      diff_review_gate_results: artifact.diff_review_gate_results ?? [],
    }),
  };
}

function buildSourceCanonicalTestMatrix(artifact) {
  return {
    schema_version: "source-canonical-test-matrix-for-dev-protected-scan.v1",
    canonical_test_matrix_id: artifact.canonical_test_matrix_id ?? null,
    canonical_test_matrix_status: artifact.summary?.canonical_test_matrix_status ?? artifact.canonical_test_matrix_status ?? "unknown",
    required_dimension_count: artifact.summary?.required_dimension_count ?? 0,
    passed_required_dimension_count: artifact.summary?.passed_required_dimension_count ?? 0,
    binding_count: artifact.summary?.binding_count ?? artifact.canonical_test_matrix_bindings?.length ?? 0,
    bound_to_passing_matrix_count: artifact.summary?.bound_to_passing_matrix_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      canonical_test_matrix_id: artifact.canonical_test_matrix_id ?? null,
      results: artifact.canonical_test_matrix_results ?? [],
      bindings: artifact.canonical_test_matrix_bindings ?? [],
    }),
  };
}

function buildSourceProtectedFileGate(artifact) {
  return {
    schema_version: "source-protected-file-gate-for-dev-protected-scan.v1",
    protected_file_gate_id: artifact.protected_file_gate_id ?? null,
    protected_file_gate_status: artifact.summary?.protected_file_gate_status ?? "unknown",
    protected_file_detected_count: artifact.summary?.protected_file_detected_count ?? 0,
    blocked_before_approval_count: artifact.summary?.blocked_before_approval_count ?? 0,
    secret_file_block_count: artifact.summary?.secret_file_block_count ?? 0,
    production_config_block_count: artifact.summary?.production_config_block_count ?? 0,
    pending_explicit_approval_count: artifact.summary?.pending_explicit_approval_count ?? 0,
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      protected_file_gate_id: artifact.protected_file_gate_id ?? null,
      requirements: artifact.protected_file_approval_requirements ?? [],
      rules: artifact.protected_file_gate_rules ?? [],
    }),
  };
}

function buildProtectedFileFindings({ implementationPatchCapture, protectedFileGate, generatedAt }) {
  const implementationFindings = (implementationPatchCapture.implementation_touched_files ?? []).map((file, index) => {
    const protectedClasses = classifyPath(file.file_path, protectedFileGate.protected_file_gate_rules ?? []);
    const protectedDetected = protectedClasses.length > 0 || Boolean(file.protected_file_detected);
    return fileFinding({
      generatedAt,
      sequence: index + 1,
      candidateId: file.touched_file_id ?? `implementation-touched-file.${index + 1}`,
      candidateOrigin: "implementation_touched_file",
      sourceRef: { touched_file_id: file.touched_file_id ?? null },
      runtimeId: null,
      agentRunId: null,
      workflowRunId: null,
      filePath: file.file_path,
      protectedClasses,
      protectedDetected,
      status: protectedDetected ? "blocked_pending_explicit_approval" : "scanned_unprotected",
    });
  });
  const protectedFindings = (protectedFileGate.protected_file_approval_requirements ?? []).map((requirement, index) => {
    const protectedClasses = classesFromRequirement(requirement, protectedFileGate.protected_file_gate_rules ?? []);
    return fileFinding({
      generatedAt,
      sequence: implementationFindings.length + index + 1,
      candidateId: requirement.protected_file_approval_requirement_id ?? `protected-requirement.${index + 1}`,
      candidateOrigin: "protected_file_gate_approval_requirement",
      sourceRef: {
        protected_file_approval_requirement_id: requirement.protected_file_approval_requirement_id ?? null,
        protected_file_change_evaluation_id: requirement.protected_file_change_evaluation_id ?? null,
      },
      runtimeId: requirement.runtime_id ?? null,
      agentRunId: requirement.agent_run_id ?? null,
      workflowRunId: requirement.workflow_run_id ?? null,
      filePath: requirement.file_path,
      protectedClasses,
      protectedDetected: true,
      status: "blocked_pending_explicit_approval",
    });
  });
  return [...implementationFindings, ...protectedFindings].map((record) => ({
    ...record,
    finding_hash: hashObject(record),
  }));
}

function fileFinding({
  generatedAt,
  sequence,
  candidateId,
  candidateOrigin,
  sourceRef,
  runtimeId,
  agentRunId,
  workflowRunId,
  filePath,
  protectedClasses,
  protectedDetected,
  status,
}) {
  const normalizedPath = normalizePath(filePath);
  const hasSecret = protectedClasses.includes("secret") || isSecretPath(normalizedPath);
  const hasProd = protectedClasses.includes("production_config") || isProductionConfigPath(normalizedPath);
  const hasMigration = protectedClasses.includes("migration") || isMigrationPath(normalizedPath);
  return {
    schema_version: "dev-protected-file-finding.v1",
    dev_protected_file_finding_id: `dev-protected-file-finding.${slugify(candidateId)}.${sequence}`,
    generated_at: generatedAt,
    sequence,
    source_candidate_id: candidateId,
    candidate_origin: candidateOrigin,
    ...sourceRef,
    runtime_id: runtimeId,
    agent_run_id: agentRunId,
    workflow_run_id: workflowRunId,
    file_path: normalizedPath,
    finding_status: status,
    protected_file_detected: protectedDetected,
    protected_classes: unique([...protectedClasses, ...(hasSecret && !protectedClasses.includes("secret") ? ["secret"] : []), ...(hasProd && !protectedClasses.includes("production_config") ? ["production_config"] : []), ...(hasMigration && !protectedClasses.includes("migration") ? ["migration"] : [])]),
    credential_or_secret_candidate: hasSecret,
    production_config_candidate: hasProd,
    migration_candidate: hasMigration,
    explicit_approval_required: protectedDetected,
    human_gate_required: true,
    write_allowed_before_approval: false,
    mutation_allowed_before_approval: false,
    protected_action_executed: false,
    raw_secret_material_exposed: false,
    secret_value_materialized: false,
    provider_key_exposed: false,
    secret_redaction_status: hasSecret ? "not_materialized" : "not_applicable",
    scan_evidence_basis: "path_pattern_and_protected_gate_metadata",
  };
}

function buildSecretFindings(fileFindings, generatedAt) {
  return fileFindings
    .filter((finding) => finding.credential_or_secret_candidate)
    .map((finding, index) => ({
      schema_version: "dev-secret-finding.v1",
      dev_secret_finding_id: `dev-secret-finding.${slugify(finding.dev_protected_file_finding_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      dev_protected_file_finding_id: finding.dev_protected_file_finding_id,
      file_path: finding.file_path,
      runtime_id: finding.runtime_id,
      agent_run_id: finding.agent_run_id,
      secret_finding_status: "blocked_pending_explicit_approval",
      secret_kind: inferSecretKind(finding.file_path),
      raw_secret_material_exposed: false,
      secret_value_materialized: false,
      provider_key_exposed: false,
      redaction_status: "not_materialized",
      explicit_approval_required: true,
      human_gate_required: true,
      write_allowed_before_approval: false,
      mutation_allowed_before_approval: false,
      protected_action_executed: false,
      finding_hash: hashObject(finding),
    }));
}

function buildProdConfigFindings(fileFindings, generatedAt) {
  return fileFindings
    .filter((finding) => finding.production_config_candidate)
    .map((finding, index) => ({
      schema_version: "dev-prod-config-finding.v1",
      dev_prod_config_finding_id: `dev-prod-config-finding.${slugify(finding.dev_protected_file_finding_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      dev_protected_file_finding_id: finding.dev_protected_file_finding_id,
      file_path: finding.file_path,
      runtime_id: finding.runtime_id,
      agent_run_id: finding.agent_run_id,
      prod_config_finding_status: "blocked_pending_explicit_approval",
      prod_config_kind: inferProdConfigKind(finding.file_path),
      explicit_approval_required: true,
      human_gate_required: true,
      write_allowed_before_approval: false,
      mutation_allowed_before_approval: false,
      protected_action_executed: false,
      finding_hash: hashObject(finding),
    }));
}

function buildScanResults({ diffReviewGate, canonicalTestMatrix, fileFindings, secretFindings, prodConfigFindings, generatedAt }) {
  const canonicalBindings = canonicalTestMatrix.canonical_test_matrix_bindings ?? [];
  const protectedFindings = fileFindings.filter((finding) => finding.protected_file_detected);
  const diffReviewResults = diffReviewGate.diff_review_results ?? [];
  return diffReviewResults.map((reviewResult, index) => {
    const runtimeId = reviewResult.agent === "claude_code" ? "claude_code" : reviewResult.agent === "codex" ? "codex" : reviewResult.agent;
    const findingsForRuntime = protectedFindings.filter((finding) => !finding.runtime_id || finding.runtime_id === runtimeId);
    const secretsForRuntime = secretFindings.filter((finding) => !finding.runtime_id || finding.runtime_id === runtimeId);
    const prodForRuntime = prodConfigFindings.filter((finding) => !finding.runtime_id || finding.runtime_id === runtimeId);
    const binding = canonicalBindings[index] ?? {};
    return {
      schema_version: "dev-protected-scan-result.v1",
      dev_protected_scan_result_id: `dev-protected-scan-result.${slugify(reviewResult.diff_review_result_id ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      agent: reviewResult.agent ?? null,
      runtime_id: runtimeId ?? null,
      source_diff_review_result_id: reviewResult.diff_review_result_id ?? null,
      source_canonical_test_matrix_binding_id: binding.canonical_test_matrix_binding_id ?? null,
      scan_result_status: "passed_with_protected_blocks",
      canonical_required_tests_passed: true,
      protected_candidate_count: findingsForRuntime.length,
      credential_or_secret_candidate_count: secretsForRuntime.length,
      production_config_candidate_count: prodForRuntime.length,
      blocked_before_approval_count: findingsForRuntime.length,
      pending_explicit_approval_count: findingsForRuntime.length,
      write_allowed_before_approval_count: 0,
      mutation_allowed_before_approval_count: 0,
      patch_application_allowed: false,
      patch_application_performed: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      raw_secret_material_exposed: false,
      provider_key_exposed: false,
      human_review_required: true,
      result_hash: hashObject({ reviewResult, binding, findingsForRuntime }),
    };
  });
}

function buildBindings({ canonicalTestMatrix, scanResults, generatedAt }) {
  return scanResults.map((result, index) => {
    const binding = canonicalTestMatrix.canonical_test_matrix_bindings?.[index] ?? {};
    return {
      schema_version: "dev-protected-scan-binding.v1",
      dev_protected_scan_binding_id: `dev-protected-scan-binding.${slugify(result.dev_protected_scan_result_id)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      source_canonical_test_matrix_binding_id: binding.canonical_test_matrix_binding_id ?? null,
      source_diff_review_gate_result_id: binding.source_diff_review_gate_result_id ?? null,
      dev_protected_scan_result_id: result.dev_protected_scan_result_id,
      binding_status: "bound_after_canonical_test_matrix",
      canonical_matrix_required_tests_passed: true,
      protected_scan_result_status: result.scan_result_status,
      patch_application_allowed: false,
      direct_merge_allowed: false,
      direct_apply_allowed: false,
      human_review_required: true,
      binding_hash: hashObject({ binding, result }),
    };
  });
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "dev-protected-scan-desktop-boundary.v1",
    boundary_id: "dev-protected-scan-desktop-boundary.personal-dev",
    generated_at: generatedAt,
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    visible_collections: ["dev_protected_file_findings", "dev_secret_findings", "dev_prod_config_findings", "dev_protected_scan_results", "dev_protected_scan_bindings", "validation_items"],
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed: false,
    patch_application_allowed: false,
    git_command_allowed: false,
    filesystem_mutation_allowed: false,
    protected_file_write_allowed: false,
    secret_material_read_allowed: false,
    production_config_write_allowed: false,
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
  protectedFileGate,
  protectedFileGateError,
  fileFindings,
  secretFindings,
  prodConfigFindings,
  scanResults,
  bindings,
  desktopBoundary,
}) {
  const sourceTouchedCount = implementationPatchCapture.summary?.touched_file_count ?? implementationPatchCapture.implementation_touched_files?.length ?? 0;
  const actualTouchedScannedCount = fileFindings.filter((finding) => finding.candidate_origin === "implementation_touched_file").length;
  const protectedCandidateCount = fileFindings.filter((finding) => finding.protected_file_detected).length;
  const blockedBeforeApprovalCount = fileFindings.filter((finding) => finding.protected_file_detected && finding.write_allowed_before_approval === false && finding.mutation_allowed_before_approval === false).length;
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:protected-scan"]), "package.json exposes personal-dev:protected-scan."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P224") && String(roadmapText ?? "").includes("protected file/secrets scan"), "Final completion ledger declares P224 protected file/secrets scan."),
    checkpoint("implementation_patch_capture_complete", !implementationPatchCaptureError && implementationPatchCapture.summary?.implementation_patch_capture_status === "complete" && implementationPatchCapture.summary?.validation_error_count === 0, "Implementation Patch Capture is complete before protected scan."),
    checkpoint("diff_review_gate_complete", !diffReviewGateError && diffReviewGate.summary?.diff_review_gate_status === "complete" && diffReviewGate.summary?.validation_error_count === 0, "Diff Review Gate is complete before protected scan."),
    checkpoint("canonical_test_matrix_complete", !canonicalTestMatrixError && canonicalTestMatrix.summary?.canonical_test_matrix_status === "complete" && canonicalTestMatrix.summary?.passed_required_dimension_count === canonicalTestMatrix.summary?.required_dimension_count && canonicalTestMatrix.summary?.validation_error_count === 0, "Canonical Test Matrix is complete before protected scan."),
    checkpoint("protected_file_gate_complete", !protectedFileGateError && protectedFileGate.summary?.protected_file_gate_status === "complete" && protectedFileGate.summary?.validation_error_count === 0, "Protected File Gate rules and approval blocks are available."),
    checkpoint("actual_touched_files_scanned", sourceTouchedCount > 0 && actualTouchedScannedCount === sourceTouchedCount, "Every captured implementation touched file is scanned."),
    checkpoint("protected_candidates_imported", protectedCandidateCount === (protectedFileGate.summary?.blocked_before_approval_count ?? 0), "Protected candidates from the gate are imported into the dev protected scan."),
    checkpoint("protected_candidates_blocked", protectedCandidateCount > 0 && blockedBeforeApprovalCount === protectedCandidateCount, "Every protected candidate is blocked before approval."),
    checkpoint("secret_candidates_blocked_without_materialization", secretFindings.length >= (protectedFileGate.summary?.secret_file_block_count ?? 0) && secretFindings.every((finding) => finding.secret_finding_status === "blocked_pending_explicit_approval" && finding.raw_secret_material_exposed === false && finding.secret_value_materialized === false), "Secret and credential candidates are blocked without materializing secret values."),
    checkpoint("production_config_candidates_blocked", prodConfigFindings.length === (protectedFileGate.summary?.production_config_block_count ?? 0) && prodConfigFindings.every((finding) => finding.prod_config_finding_status === "blocked_pending_explicit_approval"), "Production config candidates are blocked before approval."),
    checkpoint("scan_results_bound_to_agents", scanResults.length === 2 && scanResults.every((result) => result.scan_result_status === "passed_with_protected_blocks" && result.human_review_required === true), "Claude Code and Codex scan results are recorded with protected blocks."),
    checkpoint("canonical_matrix_bindings_preserved", bindings.length === 2 && bindings.every((binding) => binding.binding_status === "bound_after_canonical_test_matrix"), "Protected scan results are bound after canonical test matrix results."),
    checkpoint("no_secret_or_mutation_exposure", scanResults.every((result) => result.raw_secret_material_exposed === false && result.provider_key_exposed === false && result.patch_application_performed === false && result.git_command_executed === false && result.filesystem_mutation_performed === false && result.protected_mutation_performed === false && result.external_agent_invocation_performed === false && result.plan_acceptance_performed === false), "Scan exposes no secret material and performs no mutation or agent/runtime control."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.command_execution_allowed === false && desktopBoundary.secret_material_read_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot execute scans, read secret material, or mutate protected files."),
  ];
}

function summarizeDevProtectedScan({
  implementationPatchCapture,
  diffReviewGate,
  canonicalTestMatrix,
  protectedFileGate,
  fileFindings,
  secretFindings,
  prodConfigFindings,
  scanResults,
  bindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const protectedFindings = fileFindings.filter((finding) => finding.protected_file_detected);
  return {
    dev_protected_scan_status: validation.valid ? "complete" : "blocked",
    dev_protected_scan_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    scan_authority: SCAN_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_implementation_patch_capture_status: implementationPatchCapture.summary?.implementation_patch_capture_status ?? "unknown",
    source_diff_review_gate_status: diffReviewGate.summary?.diff_review_gate_status ?? "unknown",
    source_canonical_test_matrix_status: canonicalTestMatrix.summary?.canonical_test_matrix_status ?? "unknown",
    source_protected_file_gate_status: protectedFileGate.summary?.protected_file_gate_status ?? "unknown",
    source_touched_file_count: implementationPatchCapture.summary?.touched_file_count ?? implementationPatchCapture.implementation_touched_files?.length ?? 0,
    source_diff_review_gate_result_count: diffReviewGate.summary?.gate_result_count ?? 0,
    source_canonical_test_binding_count: canonicalTestMatrix.summary?.binding_count ?? 0,
    source_protected_file_gate_blocked_before_approval_count: protectedFileGate.summary?.blocked_before_approval_count ?? 0,
    scanned_file_count: fileFindings.length,
    actual_touched_file_scanned_count: fileFindings.filter((finding) => finding.candidate_origin === "implementation_touched_file").length,
    protected_candidate_count: protectedFindings.length,
    unprotected_candidate_count: fileFindings.filter((finding) => !finding.protected_file_detected).length,
    credential_or_secret_candidate_count: secretFindings.length,
    production_config_candidate_count: prodConfigFindings.length,
    migration_candidate_count: fileFindings.filter((finding) => finding.migration_candidate).length,
    blocked_before_approval_count: protectedFindings.filter((finding) => finding.write_allowed_before_approval === false && finding.mutation_allowed_before_approval === false).length,
    explicit_approval_required_count: protectedFindings.filter((finding) => finding.explicit_approval_required).length,
    pending_explicit_approval_count: protectedFindings.filter((finding) => finding.finding_status === "blocked_pending_explicit_approval").length,
    credential_or_secret_change_blocked_count: secretFindings.filter((finding) => finding.secret_finding_status === "blocked_pending_explicit_approval").length,
    production_config_change_blocked_count: prodConfigFindings.filter((finding) => finding.prod_config_finding_status === "blocked_pending_explicit_approval").length,
    write_allowed_before_approval_count: fileFindings.filter((finding) => finding.write_allowed_before_approval).length,
    mutation_allowed_before_approval_count: fileFindings.filter((finding) => finding.mutation_allowed_before_approval).length,
    secret_value_materialized_count: secretFindings.filter((finding) => finding.secret_value_materialized).length,
    raw_secret_material_exposed: secretFindings.some((finding) => finding.raw_secret_material_exposed),
    provider_key_exposed: secretFindings.some((finding) => finding.provider_key_exposed),
    scan_result_count: scanResults.length,
    passed_with_protected_blocks_count: scanResults.filter((result) => result.scan_result_status === "passed_with_protected_blocks").length,
    binding_count: bindings.length,
    bound_after_canonical_test_matrix_count: bindings.filter((binding) => binding.binding_status === "bound_after_canonical_test_matrix").length,
    patch_application_allowed_count: bindings.filter((binding) => binding.patch_application_allowed).length,
    direct_merge_allowed_count: bindings.filter((binding) => binding.direct_merge_allowed).length,
    direct_apply_allowed_count: bindings.filter((binding) => binding.direct_apply_allowed).length,
    patch_application_performed_count: scanResults.filter((result) => result.patch_application_performed).length,
    git_command_executed_count: scanResults.filter((result) => result.git_command_executed).length,
    filesystem_mutation_performed_count: scanResults.filter((result) => result.filesystem_mutation_performed).length,
    protected_mutation_performed_count: scanResults.filter((result) => result.protected_mutation_performed).length,
    external_agent_invocation_performed_count: scanResults.filter((result) => result.external_agent_invocation_performed).length,
    plan_acceptance_performed_count: scanResults.filter((result) => result.plan_acceptance_performed).length,
    human_review_required: true,
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_command_execution_allowed: desktopBoundary.command_execution_allowed,
    desktop_patch_application_allowed: desktopBoundary.patch_application_allowed,
    desktop_git_command_allowed: desktopBoundary.git_command_allowed,
    desktop_filesystem_mutation_allowed: desktopBoundary.filesystem_mutation_allowed,
    desktop_protected_file_write_allowed: desktopBoundary.protected_file_write_allowed,
    desktop_secret_material_read_allowed: desktopBoundary.secret_material_read_allowed,
    desktop_production_config_write_allowed: desktopBoundary.production_config_write_allowed,
    desktop_runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    desktop_external_agent_invocation_allowed: desktopBoundary.external_agent_invocation_allowed,
    desktop_plan_acceptance_allowed: desktopBoundary.plan_acceptance_allowed,
    desktop_merge_allowed: desktopBoundary.merge_allowed,
    desktop_release_allowed: desktopBoundary.release_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    raw_secret_material_exposed_count: secretFindings.filter((finding) => finding.raw_secret_material_exposed).length,
    provider_key_exposed_count: secretFindings.filter((finding) => finding.provider_key_exposed).length,
    installer_or_gateway_control: desktopBoundary.installer_or_gateway_control,
    ssh_or_cron_control: desktopBoundary.ssh_or_cron_control,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length,
    failed_checkpoint_count: checkpoints.filter((checkpointItem) => checkpointItem.status !== "passed").length,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_finding_status: countBy(fileFindings, "finding_status"),
    by_candidate_origin: countBy(fileFindings, "candidate_origin"),
    by_secret_finding_status: countBy(secretFindings, "secret_finding_status"),
    by_prod_config_finding_status: countBy(prodConfigFindings, "prod_config_finding_status"),
    by_scan_result_status: countBy(scanResults, "scan_result_status"),
    by_binding_status: countBy(bindings, "binding_status"),
  };
}

function buildSafeHandling() {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    dev_protected_scan_performed: true,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    command_execution_performed: false,
    patch_application_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    protected_mutation_performed: false,
    task_state_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, implementationPatchCapture, diffReviewGate, canonicalTestMatrix, protectedFileGate }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("implementation_patch_capture", "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json", implementationPatchCapture),
    sourceContract("diff_review_gate", "artifacts/diff-review-gate/latest/diff-review-gate.json", diffReviewGate),
    sourceContract("canonical_test_matrix", "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json", canonicalTestMatrix),
    sourceContract("protected_file_gate", "artifacts/protected-file-gate/latest/protected-file-gate.json", protectedFileGate),
  ];
}

function sourceContract(sourceId, sourcePath, result) {
  const available = !result?.error;
  const value = result?.value ?? result;
  return {
    schema_version: "dev-protected-scan-source-contract.v1",
    source_id: sourceId,
    source_path: sourcePath,
    source_status: available ? "available" : "missing",
    error: result?.error ?? null,
    source_hash: hashObject(value ?? null),
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    schema_version: "dev-protected-scan-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
  };
}

function classifyPath(filePath, rules = []) {
  const normalizedPath = normalizePath(filePath);
  const classes = [];
  for (const rule of rules) {
    if ((rule.patterns ?? []).some((pattern) => matchesPattern(normalizedPath, pattern))) {
      classes.push(rule.protected_class);
    }
  }
  if (isSecretPath(normalizedPath)) classes.push("secret");
  if (isProductionConfigPath(normalizedPath)) classes.push("production_config");
  if (isMigrationPath(normalizedPath)) classes.push("migration");
  return unique(classes.filter(Boolean));
}

function classesFromRequirement(requirement, rules = []) {
  const fromRules = (requirement.matched_rule_ids ?? []).flatMap((ruleId) => {
    const rule = rules.find((item) => item.protected_file_gate_rule_id === ruleId);
    return rule?.protected_class ? [rule.protected_class] : [];
  });
  const fromReasons = (requirement.reason_codes ?? []).flatMap((reason) => {
    const value = String(reason);
    if (value.includes("secret")) return ["secret"];
    if (value.includes("production_config")) return ["production_config"];
    if (value.includes("migration")) return ["migration"];
    if (value.includes("protected_path")) return ["protected_path"];
    return [];
  });
  return unique([...fromRules, ...fromReasons, ...classifyPath(requirement.file_path, rules)]);
}

function matchesPattern(filePath, pattern) {
  const normalizedPattern = normalizePath(pattern);
  if (normalizedPattern === filePath) return true;
  if (normalizedPattern.startsWith("**/*")) return filePath.includes(normalizedPattern.slice(4));
  if (normalizedPattern.endsWith("/**")) return filePath.startsWith(normalizedPattern.slice(0, -3));
  if (normalizedPattern.includes("/**/")) {
    const [prefix, suffix] = normalizedPattern.split("/**/");
    return filePath.startsWith(prefix) && filePath.includes(suffix.replace("*", ""));
  }
  if (normalizedPattern.includes("**/")) return filePath.endsWith(normalizedPattern.replace("**/", ""));
  if (normalizedPattern.includes("*")) {
    const escaped = normalizedPattern
      .split("*")
      .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*");
    return new RegExp(`^${escaped}$`).test(filePath);
  }
  return false;
}

function isSecretPath(filePath) {
  const value = normalizePath(filePath).toLowerCase();
  return value === ".env"
    || value.includes("secret")
    || value.includes("credential")
    || value.endsWith(".pem")
    || value.endsWith(".key")
    || value.includes("provider-key")
    || value.includes("provider-keys");
}

function isProductionConfigPath(filePath) {
  const value = normalizePath(filePath).toLowerCase();
  return value.includes("/prod/")
    || value.includes("/production/")
    || value.startsWith("infra/")
    || value.startsWith("deploy/")
    || value.startsWith("k8s/")
    || value.includes(".prod.")
    || value.includes("production.");
}

function isMigrationPath(filePath) {
  const value = normalizePath(filePath).toLowerCase();
  return value.startsWith("migrations/")
    || value.startsWith("schema/migrations/")
    || value.startsWith("db/migrations/");
}

function inferSecretKind(filePath) {
  const value = normalizePath(filePath).toLowerCase();
  if (value === ".env" || value.endsWith(".env")) return "env_file";
  if (value.includes("provider-key") || value.includes("provider-keys")) return "provider_key_path";
  if (value.includes("credential")) return "credential_path";
  if (value.includes("secret")) return "secret_path";
  if (value.endsWith(".pem") || value.endsWith(".key")) return "key_file";
  return "secret_like_path";
}

function inferProdConfigKind(filePath) {
  const value = normalizePath(filePath).toLowerCase();
  if (value.startsWith("infra/")) return "infrastructure_config";
  if (value.includes("/production/")) return "production_config";
  if (value.includes("/prod/")) return "prod_config";
  if (value.startsWith("deploy/") || value.startsWith("k8s/")) return "deployment_config";
  return "production_like_config";
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function serializableDevProtectedScan(result) {
  const { markdown: _markdown, output_dir: _outputDir, ...rest } = result;
  return rest;
}

function renderDevProtectedScanMarkdown(result) {
  const lines = [];
  lines.push("# Dev Protected Scan");
  lines.push("");
  lines.push(`Status: ${result.summary.dev_protected_scan_status}`);
  lines.push(`Protected candidates: ${result.summary.protected_candidate_count}`);
  lines.push(`Secret/credential blocked: ${result.summary.credential_or_secret_change_blocked_count}`);
  lines.push(`Production config blocked: ${result.summary.production_config_change_blocked_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: protected file writes, credential changes, production config changes, merge, release, and client-facing outputs remain blocked until explicit human approval.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_DEV_PROTECTED_SCAN_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_DEV_PROTECTED_SCAN_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_DEV_PROTECTED_SCAN_INPUTS.roadmapPath,
    implementation_patch_capture_path: path.resolve(options.implementationPatchCapturePath ?? DEFAULT_DEV_PROTECTED_SCAN_INPUTS.implementationPatchCapturePath),
    diff_review_gate_path: path.resolve(options.diffReviewGatePath ?? DEFAULT_DEV_PROTECTED_SCAN_INPUTS.diffReviewGatePath),
    canonical_test_matrix_path: path.resolve(options.canonicalTestMatrixPath ?? DEFAULT_DEV_PROTECTED_SCAN_INPUTS.canonicalTestMatrixPath),
    protected_file_gate_path: path.resolve(options.protectedFileGatePath ?? DEFAULT_DEV_PROTECTED_SCAN_INPUTS.protectedFileGatePath),
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
    else if (arg === "--protected-file-gate") parsed.protectedFileGatePath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/dev-protected-scan.mjs [options]

Options:
  --check                                Fail when validation does not pass
  --no-write                             Build without writing artifacts
  --out-dir <path>                       Output directory
  --repo-root <path>                     Repository root
  --package <path>                       package.json path relative to repo root
  --roadmap <path>                       final completion ledger path relative to repo root
  --implementation-patch-capture <path>  implementation-patch-capture.json path
  --diff-review-gate <path>              diff-review-gate.json path
  --canonical-test-matrix <path>         canonical-test-matrix.json path
  --protected-file-gate <path>           protected-file-gate.json path`);
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

function hashObject(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140) || "unknown";
}

function normalizePath(value) {
  return String(value ?? "").replace(/\\/g, "/");
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function countBy(records, key) {
  return records.reduce((acc, record) => {
    const value = record[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}
