import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CANONICAL_TEST_MATRIX_OUT_DIR = "artifacts/canonical-test-matrix/latest";
export const DEFAULT_CANONICAL_TEST_MATRIX_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  repoProfileDetectorPath: "artifacts/repo-profile-detector/latest/repo-profile-detector.json",
  canonicalTestRunnerPath: "artifacts/canonical-test-runner/latest/canonical-test-runner.json",
  diffReviewGatePath: "artifacts/diff-review-gate/latest/diff-review-gate.json",
};

const CONTRACT_ID = "canonical-test-matrix.v1";
const PACK_ID = "personal-dev";
const CAPABILITY_ID = "personal_dev.codex.worktree_patch";
const SOURCE_OF_TRUTH = "repo_detected_test_commands_harness_executed_after_diff_review";
const TEST_MATRIX_AUTHORITY = "harness_control_plane";
const DESKTOP_SURFACE_POLICY = "read_only_canonical_test_matrix_surface";
const DEFAULT_TEST_TIMEOUT_MS = 120_000;

export async function runCanonicalTestMatrix(options = {}) {
  const result = await buildCanonicalTestMatrix(options);
  if (options.write !== false) await writeCanonicalTestMatrix(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Canonical test matrix validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCanonicalTestMatrix(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CANONICAL_TEST_MATRIX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const repoProfileDetector = await readJsonOrError(inputs.repo_profile_detector_path);
  const canonicalTestRunner = await readJsonOrError(inputs.canonical_test_runner_path);
  const diffReviewGate = await readJsonOrError(inputs.diff_review_gate_path);
  const packageArtifact = packageJson.value ?? {};
  const repoProfileArtifact = repoProfileDetector.value ?? {};
  const runnerArtifact = canonicalTestRunner.value ?? {};
  const diffReviewArtifact = diffReviewGate.value ?? {};
  const repos = buildMatrixRepos({ repoRoot, packageJson: packageArtifact, repoProfileDetector: repoProfileArtifact, generatedAt });
  const commands = buildMatrixCommands({ repoRoot, packageJson: packageArtifact, repoProfileDetector: repoProfileArtifact, generatedAt });
  const executions = [];
  for (const command of commands) {
    executions.push(await executeMatrixCommand({
      command,
      cwd: command.cwd ?? repoRoot,
      timeoutMs: Number(options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS),
    }));
  }
  const results = buildMatrixResults({ commands, executions, canonicalTestRunner: runnerArtifact, generatedAt });
  const bindings = buildDiffReviewBindings({ diffReviewGate: diffReviewArtifact, results, generatedAt });
  const desktopBoundary = buildDesktopBoundary({ repos, commands, executions, results, bindings, generatedAt });
  const checkpoints = buildCheckpoints({
    packageJson: packageArtifact,
    roadmapText: roadmapText.value,
    repoProfileDetector: repoProfileArtifact,
    repoProfileDetectorError: repoProfileDetector.error,
    canonicalTestRunner: runnerArtifact,
    canonicalTestRunnerError: canonicalTestRunner.error,
    diffReviewGate: diffReviewArtifact,
    diffReviewGateError: diffReviewGate.error,
    repos,
    commands,
    executions,
    results,
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
  const summary = summarizeCanonicalTestMatrix({
    repoProfileDetector: repoProfileArtifact,
    canonicalTestRunner: runnerArtifact,
    diffReviewGate: diffReviewArtifact,
    repos,
    commands,
    executions,
    results,
    bindings,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    canonical_test_matrix_id: `canonical-test-matrix.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    canonical_test_matrix_status: summary.canonical_test_matrix_status,
    safe_handling: buildSafeHandling(executions),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, repoProfileDetector, canonicalTestRunner, diffReviewGate }),
    canonical_test_matrix_contract: buildContract(generatedAt),
    source_repo_profile_detector: buildSourceRepoProfileDetector(repoProfileArtifact),
    source_canonical_test_runner: buildSourceCanonicalTestRunner(runnerArtifact),
    source_diff_review_gate: buildSourceDiffReviewGate(diffReviewArtifact),
    canonical_test_matrix_repos: repos,
    canonical_test_matrix_commands: commands,
    canonical_test_matrix_executions: executions,
    canonical_test_matrix_results: results,
    canonical_test_matrix_bindings: bindings,
    canonical_test_matrix_desktop_boundary: desktopBoundary,
    canonical_test_matrix_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderCanonicalTestMatrixMarkdown(result),
  };
}

export async function writeCanonicalTestMatrix(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableCanonicalTestMatrix(result);
  await writeJson(path.join(outDir, "canonical-test-matrix.json"), serializable);
  await writeJson(path.join(outDir, "canonical-test-matrix-repos.json"), {
    schema_version: "canonical-test-matrix-repos.v1",
    generated_at: result.generated_at,
    canonical_test_matrix_repo_count: result.canonical_test_matrix_repos.length,
    canonical_test_matrix_repos: result.canonical_test_matrix_repos,
  });
  await writeJson(path.join(outDir, "canonical-test-matrix-commands.json"), {
    schema_version: "canonical-test-matrix-commands.v1",
    generated_at: result.generated_at,
    canonical_test_matrix_command_count: result.canonical_test_matrix_commands.length,
    canonical_test_matrix_commands: result.canonical_test_matrix_commands,
  });
  await writeJson(path.join(outDir, "canonical-test-matrix-executions.json"), {
    schema_version: "canonical-test-matrix-executions.v1",
    generated_at: result.generated_at,
    canonical_test_matrix_execution_count: result.canonical_test_matrix_executions.length,
    canonical_test_matrix_executions: result.canonical_test_matrix_executions,
  });
  await writeJson(path.join(outDir, "canonical-test-matrix-results.json"), {
    schema_version: "canonical-test-matrix-results.v1",
    generated_at: result.generated_at,
    canonical_test_matrix_result_count: result.canonical_test_matrix_results.length,
    canonical_test_matrix_results: result.canonical_test_matrix_results,
  });
  await writeJson(path.join(outDir, "canonical-test-matrix-bindings.json"), {
    schema_version: "canonical-test-matrix-bindings.v1",
    generated_at: result.generated_at,
    canonical_test_matrix_binding_count: result.canonical_test_matrix_bindings.length,
    canonical_test_matrix_bindings: result.canonical_test_matrix_bindings,
  });
  await writeJson(path.join(outDir, "canonical-test-matrix-desktop-boundary.json"), {
    schema_version: "canonical-test-matrix-desktop-boundary-artifact.v1",
    generated_at: result.generated_at,
    canonical_test_matrix_desktop_boundary: result.canonical_test_matrix_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "canonical-test-matrix-validation-report.v1",
    generated_at: result.generated_at,
    canonical_test_matrix_id: result.canonical_test_matrix_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCanonicalTestMatrixCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runCanonicalTestMatrix(args);
    console.log(`Canonical test matrix ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.canonical_test_matrix_status}`);
    console.log(`Required dimensions: ${result.summary.required_dimension_count}`);
    console.log(`Executed dimensions: ${result.summary.executed_dimension_count}`);
    console.log(`Passed dimensions: ${result.summary.passed_required_dimension_count}`);
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
    schema_version: "canonical-test-matrix-contract-definition.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    test_matrix_authority: TEST_MATRIX_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    dimension_rule: "unit_typecheck_lint_and_e2e_dimensions_are_resolved_from_repo_commands_or_marked_not_configured_when_optional",
    execution_rule: "configured_required_dimensions_are_executed_by_the_harness_after_diff_review_gate_passes",
    canonical_runner_rule: "P210_canonical_test_runner_results_must_already_be_complete_and_passing",
    mutation_policy: "test_matrix_execution_does_not_apply_patches_merge_branches_accept_plans_or_write_protected_files",
    desktop_companion_rule: "desktop_companion_reads_matrix_status_and_can_draft_rerun_requests_only",
    created_at: generatedAt,
  };
}

function buildSourceRepoProfileDetector(repoProfileDetector) {
  return {
    schema_version: "source-repo-profile-detector-for-test-matrix.v1",
    repo_profile_detector_id: repoProfileDetector.repo_profile_detector_id ?? null,
    repo_profile_detector_status: repoProfileDetector.summary?.repo_profile_detector_status ?? repoProfileDetector.repo_profile_detector_status ?? "unknown",
    repo_profile_status: repoProfileDetector.summary?.repo_profile_status ?? repoProfileDetector.repo_profile?.profile_status ?? "unknown",
    command_profile_count: repoProfileDetector.summary?.command_profile_count ?? repoProfileDetector.repo_command_profiles?.length ?? 0,
    configured_command_count: repoProfileDetector.summary?.configured_command_count ?? (repoProfileDetector.repo_command_profiles ?? []).filter((record) => record.command_status !== "not_configured").length,
    test_command_detected: repoProfileDetector.summary?.test_command_detected ?? false,
    build_command_detected: repoProfileDetector.summary?.build_command_detected ?? false,
    lint_command_detected: repoProfileDetector.summary?.lint_command_detected ?? false,
    command_execution_performed_count: repoProfileDetector.summary?.command_execution_performed_count ?? 0,
    validation_error_count: repoProfileDetector.summary?.validation_error_count ?? repoProfileDetector.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      repo_profile_detector_id: repoProfileDetector.repo_profile_detector_id ?? null,
      repo_profile: repoProfileDetector.repo_profile ?? null,
      repo_command_profiles: repoProfileDetector.repo_command_profiles ?? [],
    }),
  };
}

function buildSourceCanonicalTestRunner(canonicalTestRunner) {
  return {
    schema_version: "source-canonical-test-runner-for-test-matrix.v1",
    canonical_test_runner_id: canonicalTestRunner.canonical_test_runner_id ?? null,
    canonical_test_runner_status: canonicalTestRunner.summary?.canonical_test_runner_status ?? "unknown",
    canonical_command_count: canonicalTestRunner.summary?.canonical_command_count ?? 0,
    canonical_test_plan_count: canonicalTestRunner.summary?.canonical_test_plan_count ?? canonicalTestRunner.canonical_test_plans?.length ?? 0,
    canonical_test_execution_count: canonicalTestRunner.summary?.canonical_test_execution_count ?? canonicalTestRunner.canonical_test_executions?.length ?? 0,
    passed_execution_count: canonicalTestRunner.summary?.passed_execution_count ?? 0,
    failed_execution_count: canonicalTestRunner.summary?.failed_execution_count ?? 0,
    agent_self_report_trusted: canonicalTestRunner.summary?.agent_self_report_trusted ?? true,
    direct_merge_allowed_count: canonicalTestRunner.summary?.direct_merge_allowed_count ?? 0,
    direct_apply_allowed_count: canonicalTestRunner.summary?.direct_apply_allowed_count ?? 0,
    validation_error_count: canonicalTestRunner.summary?.validation_error_count ?? canonicalTestRunner.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      canonical_test_runner_id: canonicalTestRunner.canonical_test_runner_id ?? null,
      canonical_test_executions: canonicalTestRunner.canonical_test_executions ?? [],
      canonical_test_gate_results: canonicalTestRunner.canonical_test_gate_results ?? [],
    }),
  };
}

function buildSourceDiffReviewGate(diffReviewGate) {
  return {
    schema_version: "source-diff-review-gate-for-test-matrix.v1",
    diff_review_gate_id: diffReviewGate.diff_review_gate_id ?? null,
    diff_review_gate_status: diffReviewGate.summary?.diff_review_gate_status ?? diffReviewGate.diff_review_gate_status ?? "unknown",
    diff_review_result_count: diffReviewGate.summary?.diff_review_result_count ?? diffReviewGate.diff_review_results?.length ?? 0,
    reviewed_diff_review_result_count: diffReviewGate.summary?.reviewed_diff_review_result_count ?? (diffReviewGate.diff_review_results ?? []).filter((record) => record.diff_review_status === "reviewed_with_human_gate").length,
    gate_result_count: diffReviewGate.summary?.gate_result_count ?? diffReviewGate.diff_review_gate_results?.length ?? 0,
    passed_with_human_gate_count: diffReviewGate.summary?.passed_with_human_gate_count ?? 0,
    patch_application_allowed_count: diffReviewGate.summary?.patch_application_allowed_count ?? 0,
    patch_application_performed_count: diffReviewGate.summary?.patch_application_performed_count ?? 0,
    validation_error_count: diffReviewGate.summary?.validation_error_count ?? diffReviewGate.validation?.errors?.length ?? 0,
    source_hash: hashObject({
      diff_review_gate_id: diffReviewGate.diff_review_gate_id ?? null,
      diff_review_results: diffReviewGate.diff_review_results ?? [],
      diff_review_gate_results: diffReviewGate.diff_review_gate_results ?? [],
    }),
  };
}

function buildMatrixRepos({ repoRoot, packageJson, repoProfileDetector, generatedAt }) {
  const repoProfile = repoProfileDetector.repo_profile ?? {};
  const record = {
    schema_version: "canonical-test-matrix-repo.v1",
    canonical_test_matrix_repo_id: `canonical-test-matrix-repo.${slugify(packageJson.name ?? repoProfile.package_name ?? path.basename(repoRoot))}`,
    generated_at: generatedAt,
    repo_root: repoRoot,
    package_name: packageJson.name ?? repoProfile.package_name ?? null,
    package_version: packageJson.version ?? repoProfile.package_version ?? null,
    primary_language_id: repoProfile.primary_language_id ?? "unknown",
    primary_framework_id: repoProfile.primary_framework_id ?? "unknown",
    repo_profile_id: repoProfile.repo_profile_id ?? null,
    repo_matrix_status: "ready",
    command_execution_policy: "harness_executes_required_matrix_dimensions",
    human_review_required: true,
    recorded_at: generatedAt,
  };
  return [{ ...record, repo_hash: hashObject(record) }];
}

function buildMatrixCommands({ repoRoot, packageJson, repoProfileDetector, generatedAt }) {
  const scripts = packageJson.scripts ?? {};
  const repoId = `canonical-test-matrix-repo.${slugify(packageJson.name ?? repoProfileDetector.repo_profile?.package_name ?? path.basename(repoRoot))}`;
  const unit = scripts.test
    ? npmCommand({ repoId, dimension: "unit", scriptName: "test", command: "npm test", status: "configured", source: "package.json#scripts.test", required: true, generatedAt })
    : missingCommand({ repoId, dimension: "unit", required: true, generatedAt });
  const typecheck = scripts.typecheck
    ? npmCommand({ repoId, dimension: "typecheck", scriptName: "typecheck", command: "npm run typecheck", status: "configured", source: "package.json#scripts.typecheck", required: true, generatedAt })
    : localCommand({ repoId, dimension: "typecheck", command: "node --check src/canonical-test-matrix.mjs", executable: "node", args: ["--check", "src/canonical-test-matrix.mjs"], status: "derived", source: "local_syntax_check", required: true, generatedAt });
  const lintScript = scripts.lint ? "lint" : scripts["validate:core"] ? "validate:core" : scripts.validate ? "validate" : null;
  const lint = lintScript
    ? npmCommand({ repoId, dimension: "lint", scriptName: lintScript, command: `npm run ${lintScript}`, status: scripts.lint ? "configured" : "derived", source: `package.json#scripts.${lintScript}`, required: true, generatedAt })
    : missingCommand({ repoId, dimension: "lint", required: true, generatedAt });
  const e2eScript = scripts.e2e ? "e2e" : scripts["test:e2e"] ? "test:e2e" : null;
  const e2e = e2eScript
    ? npmCommand({ repoId, dimension: "e2e", scriptName: e2eScript, command: `npm run ${e2eScript}`, status: "configured", source: `package.json#scripts.${e2eScript}`, required: false, generatedAt })
    : missingCommand({ repoId, dimension: "e2e", required: false, generatedAt });
  return [unit, typecheck, lint, e2e].map((record, index) => ({
    ...record,
    sequence: index + 1,
    command_hash: hashObject({ ...record, sequence: index + 1 }),
  }));
}

function npmCommand({ repoId, dimension, scriptName, command, status, source, required, generatedAt }) {
  return {
    schema_version: "canonical-test-matrix-command.v1",
    canonical_test_matrix_command_id: `canonical-test-matrix-command.${dimension}`,
    canonical_test_matrix_repo_id: repoId,
    generated_at: generatedAt,
    test_dimension: dimension,
    command,
    executable: "npm",
    args: ["run", scriptName],
    package_script_name: scriptName,
    command_source: source,
    matrix_command_status: status,
    execution_required: required,
    execution_allowed: true,
    command_execution_policy: "harness_execute",
    timeout_ms: DEFAULT_TEST_TIMEOUT_MS,
    expected_status: "passed",
    human_review_required: true,
  };
}

function localCommand({ repoId, dimension, command, executable, args, status, source, required, generatedAt }) {
  return {
    schema_version: "canonical-test-matrix-command.v1",
    canonical_test_matrix_command_id: `canonical-test-matrix-command.${dimension}`,
    canonical_test_matrix_repo_id: repoId,
    generated_at: generatedAt,
    test_dimension: dimension,
    command,
    executable,
    args,
    package_script_name: null,
    command_source: source,
    matrix_command_status: status,
    execution_required: required,
    execution_allowed: true,
    command_execution_policy: "harness_execute",
    timeout_ms: DEFAULT_TEST_TIMEOUT_MS,
    expected_status: "passed",
    human_review_required: true,
  };
}

function missingCommand({ repoId, dimension, required, generatedAt }) {
  return {
    schema_version: "canonical-test-matrix-command.v1",
    canonical_test_matrix_command_id: `canonical-test-matrix-command.${dimension}`,
    canonical_test_matrix_repo_id: repoId,
    generated_at: generatedAt,
    test_dimension: dimension,
    command: null,
    executable: null,
    args: [],
    package_script_name: null,
    command_source: "package.json#scripts",
    matrix_command_status: "not_configured",
    execution_required: required,
    execution_allowed: false,
    command_execution_policy: required ? "blocked_missing_required_command" : "optional_not_configured",
    timeout_ms: DEFAULT_TEST_TIMEOUT_MS,
    expected_status: required ? "passed" : "not_applicable",
    human_review_required: true,
  };
}

async function executeMatrixCommand({ command, cwd, timeoutMs }) {
  if (!command.execution_allowed || !command.command) {
    const now = new Date().toISOString();
    const execution = {
      schema_version: "canonical-test-matrix-execution.v1",
      canonical_test_matrix_execution_id: `canonical-test-matrix-execution.${slugify(command.test_dimension)}`,
      canonical_test_matrix_command_id: command.canonical_test_matrix_command_id,
      canonical_test_matrix_repo_id: command.canonical_test_matrix_repo_id,
      generated_at: command.generated_at,
      test_dimension: command.test_dimension,
      command: command.command,
      execution_authority: TEST_MATRIX_AUTHORITY,
      execution_source: "harness_matrix_run",
      execution_status: command.execution_required ? "blocked_missing_required_command" : "not_configured",
      harness_exit_code: command.execution_required ? 127 : 0,
      timed_out: false,
      execution_required: command.execution_required,
      execution_allowed: false,
      execution_performed: false,
      stdout_hash: `sha256:${sha256("")}`,
      stderr_hash: `sha256:${sha256(command.command_execution_policy)}`,
      output_hash: `sha256:${sha256(command.command_execution_policy)}`,
      stdout_preview: "",
      stderr_preview: command.command_execution_policy,
      patch_application_performed: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      started_at: now,
      completed_at: now,
      duration_ms: 0,
    };
    return { ...execution, execution_hash: hashObject(execution) };
  }
  const startedAt = new Date();
  const execution = await runCommand(command, { cwd, timeoutMs: Number(command.timeout_ms ?? timeoutMs) });
  const status = execution.timed_out
    ? "timed_out"
    : execution.exit_code === 0
      ? "passed"
      : "failed";
  const record = {
    schema_version: "canonical-test-matrix-execution.v1",
    canonical_test_matrix_execution_id: `canonical-test-matrix-execution.${slugify(command.test_dimension)}`,
    canonical_test_matrix_command_id: command.canonical_test_matrix_command_id,
    canonical_test_matrix_repo_id: command.canonical_test_matrix_repo_id,
    generated_at: command.generated_at,
    test_dimension: command.test_dimension,
    command: command.command,
    execution_authority: TEST_MATRIX_AUTHORITY,
    execution_source: "harness_matrix_run",
    execution_status: status,
    harness_exit_code: execution.exit_code,
    timed_out: execution.timed_out,
    execution_required: command.execution_required,
    execution_allowed: command.execution_allowed,
    execution_performed: true,
    stdout_hash: `sha256:${sha256(execution.stdout ?? "")}`,
    stderr_hash: `sha256:${sha256(execution.stderr ?? "")}`,
    output_hash: `sha256:${sha256(`${execution.stdout ?? ""}\n${execution.stderr ?? ""}`)}`,
    stdout_preview: preview(execution.stdout),
    stderr_preview: preview(execution.stderr),
    patch_application_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    protected_mutation_performed: false,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    started_at: startedAt.toISOString(),
    completed_at: execution.completed_at,
    duration_ms: execution.duration_ms,
  };
  return { ...record, execution_hash: hashObject(record) };
}

function buildMatrixResults({ commands, executions, canonicalTestRunner, generatedAt }) {
  return commands.map((command) => {
    const execution = executions.find((item) => item.canonical_test_matrix_command_id === command.canonical_test_matrix_command_id) ?? {};
    const resultStatus = execution.execution_status === "passed"
      ? "passed"
      : command.execution_required
        ? "blocked"
        : "not_configured";
    const record = {
      schema_version: "canonical-test-matrix-result.v1",
      canonical_test_matrix_result_id: `canonical-test-matrix-result.${slugify(command.test_dimension)}`,
      canonical_test_matrix_command_id: command.canonical_test_matrix_command_id,
      canonical_test_matrix_execution_id: execution.canonical_test_matrix_execution_id ?? null,
      canonical_test_matrix_repo_id: command.canonical_test_matrix_repo_id,
      generated_at: generatedAt,
      test_dimension: command.test_dimension,
      matrix_result_status: resultStatus,
      command_status: command.matrix_command_status,
      execution_status: execution.execution_status ?? "unknown",
      execution_required: command.execution_required,
      execution_performed: execution.execution_performed === true,
      harness_exit_code: execution.harness_exit_code ?? null,
      source_canonical_test_runner_status: canonicalTestRunner.summary?.canonical_test_runner_status ?? "unknown",
      source_canonical_runner_passed_execution_count: canonicalTestRunner.summary?.passed_execution_count ?? 0,
      source_canonical_runner_execution_count: canonicalTestRunner.summary?.canonical_test_execution_count ?? 0,
      agent_self_report_trusted: false,
      runtime_self_report_trusted: false,
      human_review_required: true,
      merge_ready: false,
      direct_merge_allowed: false,
      direct_apply_allowed: false,
      patch_application_performed: false,
      git_command_executed: false,
      filesystem_mutation_performed: false,
      protected_mutation_performed: false,
      external_agent_invocation_performed: false,
      plan_acceptance_performed: false,
      recorded_at: generatedAt,
    };
    return { ...record, result_hash: hashObject(record) };
  });
}

function buildDiffReviewBindings({ diffReviewGate, results, generatedAt }) {
  const passingRequiredResults = results.filter((result) => result.execution_required && result.matrix_result_status === "passed");
  return (diffReviewGate.diff_review_gate_results ?? []).map((gateResult, index) => {
    const record = {
      schema_version: "canonical-test-matrix-binding.v1",
      canonical_test_matrix_binding_id: `canonical-test-matrix-binding.${slugify(gateResult.diff_review_gate_result_id ?? index + 1)}`,
      generated_at: generatedAt,
      sequence: index + 1,
      binding_status: gateResult.gate_result_status === "passed_with_human_gate" && passingRequiredResults.length > 0 ? "bound_to_passing_matrix" : "blocked",
      source_diff_review_gate_result_id: gateResult.diff_review_gate_result_id ?? null,
      source_diff_review_result_id: gateResult.source_diff_review_result_id ?? null,
      source_implementation_patch_record_id: gateResult.source_implementation_patch_record_id ?? null,
      source_implementation_diff_capture_id: gateResult.source_implementation_diff_capture_id ?? null,
      source_diff_capture_record_id: gateResult.source_diff_capture_record_id ?? null,
      agent: gateResult.agent ?? "unknown",
      runtime_id: gateResult.runtime_id ?? "unknown",
      matrix_result_ids: passingRequiredResults.map((result) => result.canonical_test_matrix_result_id),
      required_matrix_result_count: passingRequiredResults.length,
      human_review_required: true,
      patch_application_allowed: false,
      patch_application_performed: false,
      direct_merge_allowed: false,
      direct_apply_allowed: false,
      bound_at: generatedAt,
    };
    return { ...record, binding_hash: hashObject(record) };
  });
}

function buildDesktopBoundary({ repos, commands, executions, results, bindings, generatedAt }) {
  return {
    schema_version: "canonical-test-matrix-desktop-boundary.v1",
    boundary_id: "canonical-test-matrix-desktop-boundary.personal-dev",
    boundary_status: "enforced",
    surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    command_execution_allowed: false,
    rerun_request_allowed: true,
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
    visible_collections: ["canonical_test_matrix_repos", "canonical_test_matrix_commands", "canonical_test_matrix_executions", "canonical_test_matrix_results", "canonical_test_matrix_bindings", "validation_items"],
    denied_actions: ["execute_matrix_command", "mark_test_passed", "apply_patch", "write_file", "write_protected_file", "invoke_agent", "accept_plan", "merge_branch", "release"],
    repo_count: repos.length,
    command_count: commands.length,
    execution_count: executions.length,
    result_count: results.length,
    binding_count: bindings.length,
    enforced_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  repoProfileDetector,
  repoProfileDetectorError,
  canonicalTestRunner,
  canonicalTestRunnerError,
  diffReviewGate,
  diffReviewGateError,
  repos,
  commands,
  executions,
  results,
  bindings,
  desktopBoundary,
}) {
  const requiredCommands = commands.filter((record) => record.execution_required);
  const requiredExecutions = executions.filter((record) => record.execution_required);
  const requiredResults = results.filter((record) => record.execution_required);
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["personal-dev:test-matrix"]), "package.json exposes personal-dev:test-matrix."),
    checkpoint("roadmap_slot_declared", String(roadmapText ?? "").includes("P223") && String(roadmapText ?? "").includes("canonical test matrix"), "Final completion ledger declares P223 canonical test matrix."),
    checkpoint("repo_profile_detector_available", !repoProfileDetectorError && Boolean(repoProfileDetector?.schema_version), "Repo Profile Detector artifact is available."),
    checkpoint("repo_profile_detector_complete", repoProfileDetector?.summary?.repo_profile_detector_status === "complete" && repoProfileDetector?.summary?.validation_error_count === 0, "Repo Profile Detector is complete before matrix execution."),
    checkpoint("canonical_test_runner_available", !canonicalTestRunnerError && Boolean(canonicalTestRunner?.schema_version), "Canonical Test Runner artifact is available."),
    checkpoint("canonical_test_runner_complete", canonicalTestRunner?.summary?.canonical_test_runner_status === "complete" && canonicalTestRunner?.summary?.validation_error_count === 0 && canonicalTestRunner?.summary?.passed_execution_count === canonicalTestRunner?.summary?.canonical_test_execution_count, "Canonical Test Runner is complete and passing before matrix execution."),
    checkpoint("diff_review_gate_available", !diffReviewGateError && Boolean(diffReviewGate?.schema_version), "Diff Review Gate artifact is available."),
    checkpoint("diff_review_gate_complete", diffReviewGate?.summary?.diff_review_gate_status === "complete" && diffReviewGate?.summary?.validation_error_count === 0 && diffReviewGate?.summary?.passed_with_human_gate_count === diffReviewGate?.summary?.gate_result_count, "Diff Review Gate is complete before canonical matrix execution."),
    checkpoint("matrix_repo_ready", repos.length === 1 && repos.every((record) => record.repo_matrix_status === "ready"), "One repository is ready for canonical test matrix execution."),
    checkpoint("required_dimensions_configured", requiredCommands.length >= 3 && requiredCommands.every((record) => record.matrix_command_status !== "not_configured" && record.execution_allowed === true), "Required unit/typecheck/lint dimensions are configured or derived."),
    checkpoint("required_dimensions_executed", requiredExecutions.length === requiredCommands.length && requiredExecutions.every((record) => record.execution_performed === true), "Harness executed every required matrix dimension."),
    checkpoint("required_dimensions_passed", requiredResults.length === requiredCommands.length && requiredResults.every((record) => record.matrix_result_status === "passed" && record.direct_apply_allowed === false && record.direct_merge_allowed === false), "All required canonical test matrix dimensions passed without direct apply or merge readiness."),
    checkpoint("diff_review_bindings_bound", bindings.length === (diffReviewGate?.summary?.gate_result_count ?? 0) && bindings.every((record) => record.binding_status === "bound_to_passing_matrix" && record.patch_application_allowed === false), "Diff review gate results are bound to passing matrix results without patch application."),
    checkpoint("no_patch_application_or_mutation", executions.every((record) => record.patch_application_performed === false && record.git_command_executed === false && record.filesystem_mutation_performed === false && record.external_agent_invocation_performed === false && record.plan_acceptance_performed === false && record.protected_mutation_performed === false), "Canonical test matrix does not apply patches, run git commands, invoke agents, accept plans, or mutate project files."),
    checkpoint("desktop_boundary_read_only", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.command_execution_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and cannot execute matrix commands directly."),
  ];
}

function summarizeCanonicalTestMatrix({
  repoProfileDetector,
  canonicalTestRunner,
  diffReviewGate,
  repos,
  commands,
  executions,
  results,
  bindings,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const requiredCommands = commands.filter((record) => record.execution_required);
  const requiredResults = results.filter((record) => record.execution_required);
  return {
    canonical_test_matrix_status: validation.valid ? "complete" : "blocked",
    canonical_test_matrix_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    test_matrix_authority: TEST_MATRIX_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_repo_profile_detector_id: repoProfileDetector.repo_profile_detector_id ?? null,
    source_repo_profile_detector_status: repoProfileDetector.summary?.repo_profile_detector_status ?? repoProfileDetector.repo_profile_detector_status ?? "unknown",
    source_canonical_test_runner_id: canonicalTestRunner.canonical_test_runner_id ?? null,
    source_canonical_test_runner_status: canonicalTestRunner.summary?.canonical_test_runner_status ?? "unknown",
    source_canonical_test_runner_execution_count: canonicalTestRunner.summary?.canonical_test_execution_count ?? 0,
    source_canonical_test_runner_passed_execution_count: canonicalTestRunner.summary?.passed_execution_count ?? 0,
    source_diff_review_gate_id: diffReviewGate.diff_review_gate_id ?? null,
    source_diff_review_gate_status: diffReviewGate.summary?.diff_review_gate_status ?? diffReviewGate.diff_review_gate_status ?? "unknown",
    source_diff_review_gate_result_count: diffReviewGate.summary?.gate_result_count ?? 0,
    source_diff_review_passed_with_human_gate_count: diffReviewGate.summary?.passed_with_human_gate_count ?? 0,
    matrix_repo_count: repos.length,
    test_dimension_count: commands.length,
    required_dimension_count: requiredCommands.length,
    optional_dimension_count: commands.filter((record) => !record.execution_required).length,
    configured_dimension_count: commands.filter((record) => record.matrix_command_status !== "not_configured").length,
    derived_dimension_count: commands.filter((record) => record.matrix_command_status === "derived").length,
    optional_not_configured_dimension_count: commands.filter((record) => !record.execution_required && record.matrix_command_status === "not_configured").length,
    executed_dimension_count: executions.filter((record) => record.execution_performed).length,
    required_execution_count: executions.filter((record) => record.execution_required).length,
    passed_dimension_count: results.filter((record) => record.matrix_result_status === "passed").length,
    passed_required_dimension_count: requiredResults.filter((record) => record.matrix_result_status === "passed").length,
    failed_dimension_count: executions.filter((record) => record.execution_status === "failed").length,
    timed_out_dimension_count: executions.filter((record) => record.execution_status === "timed_out").length,
    skipped_dimension_count: executions.filter((record) => record.execution_status === "not_configured" || record.execution_status === "blocked_missing_required_command").length,
    unit_dimension_passed: results.some((record) => record.test_dimension === "unit" && record.matrix_result_status === "passed"),
    typecheck_dimension_passed: results.some((record) => record.test_dimension === "typecheck" && record.matrix_result_status === "passed"),
    lint_dimension_passed: results.some((record) => record.test_dimension === "lint" && record.matrix_result_status === "passed"),
    e2e_dimension_configured: commands.some((record) => record.test_dimension === "e2e" && record.matrix_command_status !== "not_configured"),
    agent_self_report_trusted_count: results.filter((record) => record.agent_self_report_trusted).length,
    runtime_self_report_trusted_count: results.filter((record) => record.runtime_self_report_trusted).length,
    binding_count: bindings.length,
    bound_to_passing_matrix_count: bindings.filter((record) => record.binding_status === "bound_to_passing_matrix").length,
    merge_ready_count: results.filter((record) => record.merge_ready).length,
    direct_merge_allowed_count: results.filter((record) => record.direct_merge_allowed).length + bindings.filter((record) => record.direct_merge_allowed).length,
    direct_apply_allowed_count: results.filter((record) => record.direct_apply_allowed).length + bindings.filter((record) => record.direct_apply_allowed).length,
    patch_application_allowed_count: bindings.filter((record) => record.patch_application_allowed).length,
    patch_application_performed_count: executions.filter((record) => record.patch_application_performed).length + results.filter((record) => record.patch_application_performed).length + bindings.filter((record) => record.patch_application_performed).length,
    git_command_executed_count: executions.filter((record) => record.git_command_executed).length + results.filter((record) => record.git_command_executed).length,
    filesystem_mutation_performed_count: executions.filter((record) => record.filesystem_mutation_performed).length + results.filter((record) => record.filesystem_mutation_performed).length,
    protected_file_write_allowed_without_approval: false,
    protected_mutation_performed_count: executions.filter((record) => record.protected_mutation_performed).length + results.filter((record) => record.protected_mutation_performed).length,
    external_agent_invocation_performed_count: executions.filter((record) => record.external_agent_invocation_performed).length + results.filter((record) => record.external_agent_invocation_performed).length,
    plan_acceptance_performed_count: executions.filter((record) => record.plan_acceptance_performed).length + results.filter((record) => record.plan_acceptance_performed).length,
    human_review_required: results.every((record) => record.human_review_required) && bindings.every((record) => record.human_review_required),
    desktop_surface_policy: desktopBoundary.surface_policy,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_command_execution_allowed: desktopBoundary.command_execution_allowed,
    desktop_rerun_request_allowed: desktopBoundary.rerun_request_allowed,
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
    by_dimension: countBy(commands, "test_dimension"),
    by_matrix_command_status: countBy(commands, "matrix_command_status"),
    by_execution_status: countBy(executions, "execution_status"),
    by_matrix_result_status: countBy(results, "matrix_result_status"),
    by_binding_status: countBy(bindings, "binding_status"),
  };
}

function buildSafeHandling(executions) {
  return {
    legal_advice: "not_provided",
    client_facing_output: "not_generated",
    human_review_required: true,
    canonical_test_matrix_performed: true,
    command_execution_performed: executions.some((record) => record.execution_performed),
    patch_application_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    external_agent_invocation_performed: false,
    plan_acceptance_performed: false,
    protected_mutation_performed: false,
    task_state_mutation_performed: false,
  };
}

function buildSourceContracts({ packageJson, roadmapText, repoProfileDetector, canonicalTestRunner, diffReviewGate }) {
  return [
    sourceContract("package_json", "package.json", packageJson),
    sourceContract("final_completion_ledger", "docs/final-completion-phase-ledger.md", roadmapText),
    sourceContract("repo_profile_detector", "artifacts/repo-profile-detector/latest/repo-profile-detector.json", repoProfileDetector),
    sourceContract("canonical_test_runner", "artifacts/canonical-test-runner/latest/canonical-test-runner.json", canonicalTestRunner),
    sourceContract("diff_review_gate", "artifacts/diff-review-gate/latest/diff-review-gate.json", diffReviewGate),
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
    schema_version: "canonical-test-matrix-checkpoint.v1",
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
    repo_root: options.repoRoot ?? DEFAULT_CANONICAL_TEST_MATRIX_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_CANONICAL_TEST_MATRIX_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_CANONICAL_TEST_MATRIX_INPUTS.roadmapPath,
    repo_profile_detector_path: path.resolve(options.repoProfileDetectorPath ?? DEFAULT_CANONICAL_TEST_MATRIX_INPUTS.repoProfileDetectorPath),
    canonical_test_runner_path: path.resolve(options.canonicalTestRunnerPath ?? DEFAULT_CANONICAL_TEST_MATRIX_INPUTS.canonicalTestRunnerPath),
    diff_review_gate_path: path.resolve(options.diffReviewGatePath ?? DEFAULT_CANONICAL_TEST_MATRIX_INPUTS.diffReviewGatePath),
  };
}

function serializableCanonicalTestMatrix(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderCanonicalTestMatrixMarkdown(result) {
  const lines = [];
  lines.push("# Canonical Test Matrix");
  lines.push("");
  lines.push(`Status: ${result.summary.canonical_test_matrix_status}`);
  lines.push(`Required dimensions: ${result.summary.required_dimension_count}`);
  lines.push(`Executed dimensions: ${result.summary.executed_dimension_count}`);
  lines.push(`Passed required dimensions: ${result.summary.passed_required_dimension_count}`);
  lines.push(`Diff review bindings: ${result.summary.bound_to_passing_matrix_count}/${result.summary.binding_count}`);
  lines.push("");
  lines.push("## Matrix Results");
  for (const record of result.canonical_test_matrix_results) {
    lines.push(`- ${record.test_dimension}: ${record.matrix_result_status} (${record.execution_status})`);
  }
  lines.push("");
  lines.push("Human review note: canonical test matrix records harness-executed repo test dimensions after diff review. Patch application, protected writes, merge, release, and legal/client-facing outputs remain human-gated.");
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
    else if (arg === "--timeout-ms") parsed.timeoutMs = Number(argv[++index]);
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--repo-profile-detector") parsed.repoProfileDetectorPath = argv[++index];
    else if (arg === "--canonical-test-runner") parsed.canonicalTestRunnerPath = argv[++index];
    else if (arg === "--diff-review-gate") parsed.diffReviewGatePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/canonical-test-matrix.mjs [options]

Options:
  --check                                Fail if validation errors are present
  --out-dir <path>                       Output directory
  --run-at <iso>                         Generated-at timestamp
  --timeout-ms <ms>                      Per-command timeout
  --repo-root <path>                     Repository root for command execution
  --package <path>                       package.json path relative to repo root
  --roadmap <path>                       final completion ledger path relative to repo root
  --repo-profile-detector <path>         Repo Profile Detector artifact path
  --canonical-test-runner <path>         Canonical Test Runner artifact path
  --diff-review-gate <path>              Diff Review Gate artifact path
`);
}

function runCommand(command, options) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const spawnSpec = resolveCommandSpawn(command);
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        HERMES_CANONICAL_TEST_MATRIX_CHILD: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      child.kill("SIGTERM");
      const completedAt = new Date();
      resolve({
        exit_code: 124,
        timed_out: true,
        stdout,
        stderr,
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      });
    }, options.timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const completedAt = new Date();
      resolve({
        exit_code: code ?? 1,
        timed_out: false,
        stdout,
        stderr,
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      });
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const completedAt = new Date();
      resolve({
        exit_code: 127,
        timed_out: false,
        stdout,
        stderr: String(error.message ?? error),
        completed_at: completedAt.toISOString(),
        duration_ms: completedAt.getTime() - startedAt.getTime(),
      });
    });
  });
}

function resolveCommandSpawn(command) {
  if (process.platform !== "win32") {
    return { command: command.executable, args: command.args };
  }
  const executable = command.executable === "npm" ? "npm.cmd" : command.executable;
  const commandLine = [executable, ...command.args].map(quoteWindowsCommandArg).join(" ");
  return { command: "cmd.exe", args: ["/d", "/s", "/c", commandLine] };
}

function quoteWindowsCommandArg(value) {
  const text = String(value);
  if (/^[A-Za-z0-9_./:=+-]+$/.test(text)) return text;
  return `"${text.replace(/"/g, '\\"')}"`;
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

function countBy(records, key) {
  return (records ?? []).reduce((acc, record) => {
    const value = record?.[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function preview(value, maxLength = 500) {
  const text = String(value ?? "");
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
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
