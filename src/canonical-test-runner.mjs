import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CANONICAL_TEST_RUNNER_OUT_DIR = "artifacts/canonical-test-runner/latest";
export const DEFAULT_CANONICAL_TEST_RUNNER_INPUTS = {
  runtimeArtifactCapturePath: "artifacts/runtime-artifact-capture/latest/runtime-artifact-capture.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  protectedFileGatePath: "artifacts/protected-file-gate/latest/protected-file-gate.json",
  personalDevSlicePath: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
  personalDevPlanPath: "artifacts/personal-dev-slice/latest/plan.json",
  personalDevTestResultPath: "artifacts/personal-dev-slice/latest/test-result.json",
  policyMatrixPath: "examples/core/policy-matrix.json",
  packagePath: "package.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const TEST_RUNNER_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "harness_executed_canonical_tests_and_runtime_verification_contracts";
const DESKTOP_SURFACE_POLICY = "read_only_test_status_with_rerun_request_drafts";
const DEFAULT_TEST_TIMEOUT_MS = 60_000;

export async function runCanonicalTestRunner(options = {}) {
  const result = await buildCanonicalTestRunner(options);
  if (options.write !== false) await writeCanonicalTestRunner(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Canonical test runner validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCanonicalTestRunner(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CANONICAL_TEST_RUNNER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const runtimeArtifactCapture = await readJson(inputs.runtime_artifact_capture_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const protectedFileGate = await readJson(inputs.protected_file_gate_path);
  const personalDevSlice = await readJson(inputs.personal_dev_slice_path);
  const personalDevPlan = await readJson(inputs.personal_dev_plan_path);
  const personalDevTestResult = await readJson(inputs.personal_dev_test_result_path);
  const policyMatrix = await readJson(inputs.policy_matrix_path);
  const packageJson = await readJson(inputs.package_json_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");
  const canonicalTestCommands = buildCanonicalTestCommands(personalDevPlan, packageJson);
  const canonicalTestPlans = buildCanonicalTestPlans({
    runtimeArtifactCapture,
    runtimeAgentRunContractFreeze,
    personalDevSlice,
    personalDevPlan,
    canonicalTestCommands,
    generatedAt,
  });
  const canonicalTestExecutions = [];
  for (const plan of canonicalTestPlans) {
    for (const command of plan.canonical_test_commands) {
      canonicalTestExecutions.push(await executeCanonicalTestCommand({
        plan,
        command,
        personalDevTestResult,
        cwd: options.cwd ?? process.cwd(),
        timeoutMs: Number(options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS),
      }));
    }
  }
  const canonicalTestGateResults = buildCanonicalTestGateResults({
    canonicalTestPlans,
    canonicalTestExecutions,
    protectedFileGate,
    generatedAt,
  });
  const canonicalTestDesktopBoundary = buildCanonicalTestDesktopBoundary({
    canonicalTestPlans,
    canonicalTestExecutions,
    canonicalTestGateResults,
    generatedAt,
  });
  const validationItems = validateCanonicalTestRunner({
    runtimeArtifactCapture,
    runtimeAgentRunContractFreeze,
    protectedFileGate,
    personalDevPlan,
    personalDevTestResult,
    policyMatrix,
    packageJson,
    desktopCompanionIntegration,
    canonicalTestCommands,
    canonicalTestPlans,
    canonicalTestExecutions,
    canonicalTestGateResults,
    canonicalTestDesktopBoundary,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "canonical-test-runner.v1",
    generated_at: generatedAt,
    canonical_test_runner_id: `canonical-test-runner.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeArtifactCapture,
      runtimeAgentRunContractFreeze,
      protectedFileGate,
      personalDevSlice,
      personalDevPlan,
      personalDevTestResult,
      policyMatrix,
      packageJson,
      desktopCompanionIntegration,
      canonicalTestCommands,
    }),
    canonical_test_runner_contract: buildCanonicalTestRunnerContract(generatedAt),
    canonical_test_plans: canonicalTestPlans,
    canonical_test_executions: canonicalTestExecutions,
    canonical_test_gate_results: canonicalTestGateResults,
    canonical_test_desktop_boundary: canonicalTestDesktopBoundary,
    summary: summarizeCanonicalTestRunner({
      validation,
      validationItems,
      canonicalTestCommands,
      canonicalTestPlans,
      canonicalTestExecutions,
      canonicalTestGateResults,
      canonicalTestDesktopBoundary,
      personalDevTestResult,
      protectedFileGate,
    }),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderCanonicalTestRunnerMarkdown(result),
  };
}

export async function writeCanonicalTestRunner(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "canonical-test-runner.json"), serializableCanonicalTestRunner(result));
  await writeJson(path.join(outDir, "canonical-test-plans.json"), {
    schema_version: "canonical-test-plans.v1",
    generated_at: result.generated_at,
    canonical_test_plan_count: result.canonical_test_plans.length,
    canonical_test_plans: result.canonical_test_plans,
  });
  await writeJson(path.join(outDir, "canonical-test-executions.json"), {
    schema_version: "canonical-test-executions.v1",
    generated_at: result.generated_at,
    canonical_test_execution_count: result.canonical_test_executions.length,
    canonical_test_executions: result.canonical_test_executions,
  });
  await writeJson(path.join(outDir, "canonical-test-gate-results.json"), {
    schema_version: "canonical-test-gate-results.v1",
    generated_at: result.generated_at,
    canonical_test_gate_result_count: result.canonical_test_gate_results.length,
    canonical_test_gate_results: result.canonical_test_gate_results,
  });
  await writeJson(path.join(outDir, "canonical-test-desktop-boundary.json"), result.canonical_test_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "canonical-test-runner-validation-report.v1",
    generated_at: result.generated_at,
    canonical_test_runner_id: result.canonical_test_runner_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCanonicalTestRunnerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCanonicalTestRunner(args);
    console.log(`Canonical test runner written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.canonical_test_runner_status}`);
    console.log(`Plans: ${result.summary.canonical_test_plan_count}`);
    console.log(`Executions: ${result.summary.canonical_test_execution_count}`);
    console.log(`Passed executions: ${result.summary.passed_execution_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function normalizeInputs(options) {
  return {
    runtime_artifact_capture_path: path.resolve(options.runtimeArtifactCapturePath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.runtimeArtifactCapturePath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.runtimeAgentRunContractFreezePath),
    protected_file_gate_path: path.resolve(options.protectedFileGatePath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.protectedFileGatePath),
    personal_dev_slice_path: path.resolve(options.personalDevSlicePath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.personalDevSlicePath),
    personal_dev_plan_path: path.resolve(options.personalDevPlanPath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.personalDevPlanPath),
    personal_dev_test_result_path: path.resolve(options.personalDevTestResultPath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.personalDevTestResultPath),
    policy_matrix_path: path.resolve(options.policyMatrixPath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.policyMatrixPath),
    package_json_path: path.resolve(options.packagePath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.packagePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_CANONICAL_TEST_RUNNER_INPUTS.desktopCompanionIntegrationPath),
  };
}

function buildCanonicalTestCommands(personalDevPlan, packageJson) {
  const declaredCommands = personalDevPlan.codex_plan?.commands?.length > 0
    ? personalDevPlan.codex_plan.commands
    : ["npm run dev:validate", "npm run dev:brief"];
  const scripts = packageJson.scripts ?? {};
  return declaredCommands.map((commandText) => {
    const parsed = parseNpmRunCommand(commandText);
    const scriptExists = Boolean(scripts[parsed.script_name]);
    return {
      schema_version: "canonical-test-command.v1",
      command_id: commandId(parsed.script_name),
      command: `npm run ${parsed.script_name}`,
      executable: "npm",
      args: ["run", parsed.script_name],
      script_name: parsed.script_name,
      command_source: "personal_dev_reconciled_plan",
      script_exists: scriptExists,
      command_allowed: scriptExists,
      timeout_ms: DEFAULT_TEST_TIMEOUT_MS,
      expected_status: "passed",
    };
  });
}

function buildCanonicalTestPlans({
  runtimeArtifactCapture,
  runtimeAgentRunContractFreeze,
  personalDevSlice,
  personalDevPlan,
  canonicalTestCommands,
  generatedAt,
}) {
  const diffCaptures = (runtimeArtifactCapture.diff_capture_records ?? [])
    .filter((record) => record.required_gates?.includes("test_gate"));
  const runtimeVerifications = readRuntimeVerifications(runtimeAgentRunContractFreeze);
  return diffCaptures.map((diffCapture) => {
    const relatedVerification = runtimeVerifications.find((record) => record.agent_run_id === diffCapture.agent_run_id);
    return {
      schema_version: "canonical-test-plan.v1",
      canonical_test_plan_id: `canonical-test-plan.${slugify(diffCapture.diff_capture_record_id)}`,
      canonical_test_runner_contract_id: "canonical-test-runner.default",
      plan_status: "ready",
      execution_authority: TEST_RUNNER_AUTHORITY,
      source_diff_capture_record_id: diffCapture.diff_capture_record_id,
      diff_capture_kind: diffCapture.diff_capture_kind,
      runtime_id: diffCapture.runtime_id,
      adapter_id: diffCapture.adapter_id,
      agent_run_id: diffCapture.agent_run_id,
      workflow_run_id: diffCapture.workflow_run_id,
      output_artifact_id: diffCapture.output_artifact_id,
      capability_id: personalDevSlice.workflow_runtime?.capabilities?.[0]?.id ?? "personal_dev.codex.worktree_patch",
      task_id: personalDevPlan.reconciled?.task_id ?? "unknown",
      branch_name: personalDevPlan.reconciled?.branch_name ?? null,
      required_gates: diffCapture.required_gates ?? [],
      test_gate_required: diffCapture.required_gates?.includes("test_gate") ?? true,
      protected_file_gate_required: diffCapture.required_gates?.includes("protected_file_gate") ?? true,
      diff_review_gate_required: diffCapture.required_gates?.includes("diff_review_gate") ?? true,
      human_approval_gate_required: diffCapture.required_gates?.includes("human_approval_gate") ?? true,
      runtime_verification_id: relatedVerification?.runtime_verification_id ?? null,
      verification_required: relatedVerification?.verification_required ?? true,
      agent_self_report_trusted: false,
      runtime_self_report_trusted: false,
      canonical_test_commands: canonicalTestCommands,
      command_count: canonicalTestCommands.length,
      recorded_at: generatedAt,
    };
  });
}

async function executeCanonicalTestCommand({ plan, command, personalDevTestResult, cwd, timeoutMs }) {
  const agentReportedCommand = (personalDevTestResult.commands ?? []).find((record) => normalizeCommand(record.command) === command.command);
  if (!command.command_allowed) {
    return buildSkippedExecution({ plan, command, agentReportedCommand, reason: "package_script_missing" });
  }
  const execution = await runCommand(command, { cwd, timeoutMs });
  const harnessStatus = execution.timed_out
    ? "timed_out"
    : execution.exit_code === 0
      ? "passed"
      : "failed";
  return {
    schema_version: "canonical-test-execution.v1",
    canonical_test_execution_id: `canonical-test-execution.${slugify(plan.canonical_test_plan_id)}.${command.command_id}`,
    canonical_test_plan_id: plan.canonical_test_plan_id,
    source_diff_capture_record_id: plan.source_diff_capture_record_id,
    runtime_id: plan.runtime_id,
    adapter_id: plan.adapter_id,
    agent_run_id: plan.agent_run_id,
    workflow_run_id: plan.workflow_run_id,
    command_id: command.command_id,
    command: command.command,
    script_name: command.script_name,
    execution_authority: TEST_RUNNER_AUTHORITY,
    execution_source: "harness_rerun",
    agent_self_report_trusted: false,
    agent_reported_status: agentReportedCommand ? commandStatus(agentReportedCommand) : "missing",
    agent_reported_exit_code: agentReportedCommand?.exit_code ?? null,
    harness_status: harnessStatus,
    harness_exit_code: execution.exit_code,
    timed_out: execution.timed_out,
    command_execution_allowed: true,
    execution_performed: true,
    stdout_hash: `sha256:${sha256(execution.stdout ?? "")}`,
    stderr_hash: `sha256:${sha256(execution.stderr ?? "")}`,
    output_hash: `sha256:${sha256(`${execution.stdout ?? ""}\n${execution.stderr ?? ""}`)}`,
    stdout_preview: preview(execution.stdout),
    stderr_preview: preview(execution.stderr),
    started_at: execution.started_at,
    completed_at: execution.completed_at,
    duration_ms: execution.duration_ms,
  };
}

function buildSkippedExecution({ plan, command, agentReportedCommand, reason }) {
  const now = new Date().toISOString();
  return {
    schema_version: "canonical-test-execution.v1",
    canonical_test_execution_id: `canonical-test-execution.${slugify(plan.canonical_test_plan_id)}.${command.command_id}`,
    canonical_test_plan_id: plan.canonical_test_plan_id,
    source_diff_capture_record_id: plan.source_diff_capture_record_id,
    runtime_id: plan.runtime_id,
    adapter_id: plan.adapter_id,
    agent_run_id: plan.agent_run_id,
    workflow_run_id: plan.workflow_run_id,
    command_id: command.command_id,
    command: command.command,
    script_name: command.script_name,
    execution_authority: TEST_RUNNER_AUTHORITY,
    execution_source: "harness_rerun",
    agent_self_report_trusted: false,
    agent_reported_status: agentReportedCommand ? commandStatus(agentReportedCommand) : "missing",
    agent_reported_exit_code: agentReportedCommand?.exit_code ?? null,
    harness_status: "skipped",
    harness_exit_code: 127,
    timed_out: false,
    command_execution_allowed: false,
    execution_performed: false,
    skip_reason: reason,
    stdout_hash: `sha256:${sha256("")}`,
    stderr_hash: `sha256:${sha256(reason)}`,
    output_hash: `sha256:${sha256(reason)}`,
    stdout_preview: "",
    stderr_preview: reason,
    started_at: now,
    completed_at: now,
    duration_ms: 0,
  };
}

function buildCanonicalTestGateResults({
  canonicalTestPlans,
  canonicalTestExecutions,
  protectedFileGate,
  generatedAt,
}) {
  return canonicalTestPlans.map((plan) => {
    const planExecutions = canonicalTestExecutions.filter((execution) => execution.canonical_test_plan_id === plan.canonical_test_plan_id);
    const allPassed = planExecutions.length === plan.command_count && planExecutions.every((execution) => execution.harness_status === "passed");
    return {
      schema_version: "canonical-test-gate-result.v1",
      canonical_test_gate_result_id: `canonical-test-gate-result.${slugify(plan.canonical_test_plan_id)}`,
      canonical_test_runner_contract_id: "canonical-test-runner.default",
      canonical_test_plan_id: plan.canonical_test_plan_id,
      source_diff_capture_record_id: plan.source_diff_capture_record_id,
      runtime_id: plan.runtime_id,
      adapter_id: plan.adapter_id,
      agent_run_id: plan.agent_run_id,
      workflow_run_id: plan.workflow_run_id,
      test_gate_status: allPassed ? "passed" : "blocked",
      test_gate_decision: allPassed ? "allow_human_review_after_tests" : "block_until_canonical_tests_pass",
      execution_count: planExecutions.length,
      passed_execution_count: planExecutions.filter((execution) => execution.harness_status === "passed").length,
      failed_execution_count: planExecutions.filter((execution) => execution.harness_status === "failed").length,
      timed_out_execution_count: planExecutions.filter((execution) => execution.harness_status === "timed_out").length,
      protected_file_gate_status: protectedFileGate.summary?.protected_file_gate_status ?? "unknown",
      protected_file_gate_required: plan.protected_file_gate_required,
      diff_review_gate_required: plan.diff_review_gate_required,
      human_approval_gate_required: plan.human_approval_gate_required,
      human_review_required: true,
      human_gate_required: true,
      merge_ready: false,
      direct_merge_allowed: false,
      direct_apply_allowed: false,
      agent_self_report_trusted: false,
      recorded_at: generatedAt,
    };
  });
}

function buildCanonicalTestDesktopBoundary({
  canonicalTestPlans,
  canonicalTestExecutions,
  canonicalTestGateResults,
  generatedAt,
}) {
  return {
    schema_version: "canonical-test-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "canonical-test-runner.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "canonical_test_runner",
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    source_of_truth: TEST_RUNNER_AUTHORITY,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    canonical_test_rerun_request_allowed: true,
    canonical_test_execution_allowed: false,
    protected_mutation_request_allowed: true,
    protected_mutation_execution_allowed: false,
    direct_merge_allowed: false,
    direct_apply_allowed: false,
    agent_self_report_trusted: false,
    allowed_operator_actions: ["view_canonical_test_status", "view_test_output_previews", "draft_canonical_test_rerun_request"],
    denied_operator_actions: ["execute_canonical_test", "mark_test_passed", "apply_diff", "merge_branch", "bypass_human_gate"],
    canonical_test_plan_count: canonicalTestPlans.length,
    canonical_test_execution_count: canonicalTestExecutions.length,
    canonical_test_gate_result_count: canonicalTestGateResults.length,
  };
}

function buildCanonicalTestRunnerContract(generatedAt) {
  return {
    schema_version: "canonical-test-runner-contract.v1",
    generated_at: generatedAt,
    canonical_test_runner_contract_id: "canonical-test-runner.default",
    contract_status: "locked",
    test_runner_authority: TEST_RUNNER_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    execution_source: "harness_rerun",
    agent_self_report_trusted: false,
    runtime_self_report_trusted: false,
    harness_reexecution_required: true,
    diff_review_gate_required: true,
    protected_file_gate_required: true,
    human_approval_gate_required: true,
    direct_merge_allowed: false,
    direct_apply_allowed: false,
    merge_ready_without_human_approval: false,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_canonical_test_execution_allowed: false,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
  };
}

function buildSourceContracts({
  runtimeArtifactCapture,
  runtimeAgentRunContractFreeze,
  protectedFileGate,
  personalDevSlice,
  personalDevPlan,
  personalDevTestResult,
  policyMatrix,
  packageJson,
  desktopCompanionIntegration,
  canonicalTestCommands,
}) {
  const testGateRule = (policyMatrix.gate_rules ?? []).find((ruleRecord) => ruleRecord.gate_id === "test_gate");
  const scripts = packageJson.scripts ?? {};
  return {
    runtime_artifact_capture: {
      schema_version: runtimeArtifactCapture.schema_version ?? null,
      runtime_artifact_capture_status: runtimeArtifactCapture.summary?.runtime_artifact_capture_status ?? "unknown",
      diff_capture_record_count: runtimeArtifactCapture.summary?.diff_capture_record_count ?? runtimeArtifactCapture.diff_capture_records?.length ?? 0,
      diff_apply_allowed: runtimeArtifactCapture.summary?.diff_apply_allowed ?? false,
      runtime_self_report_trusted: runtimeArtifactCapture.summary?.runtime_self_report_trusted ?? true,
    },
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      runtime_verification_count: runtimeAgentRunContractFreeze.summary?.runtime_verification_count ?? readRuntimeVerifications(runtimeAgentRunContractFreeze).length,
      verification_required_agent_run_count: runtimeAgentRunContractFreeze.summary?.verification_required_agent_run_count ?? 0,
    },
    protected_file_gate: {
      schema_version: protectedFileGate.schema_version ?? null,
      protected_file_gate_status: protectedFileGate.summary?.protected_file_gate_status ?? "unknown",
      protected_file_gate_required: protectedFileGate.summary?.protected_file_gate_status === "complete",
      direct_apply_allowed_count: protectedFileGate.summary?.direct_apply_allowed_count ?? 0,
      direct_merge_allowed_count: protectedFileGate.summary?.direct_merge_allowed_count ?? 0,
      protected_action_executed_count: protectedFileGate.summary?.protected_action_executed_count ?? 0,
    },
    personal_dev_slice: {
      schema_version: personalDevSlice.schema_version ?? null,
      slice_status: personalDevSlice.summary?.status ?? personalDevSlice.status ?? "unknown",
      capability_count: personalDevSlice.workflow_runtime?.capabilities?.length ?? 0,
      workflow_count: personalDevSlice.workflow_runtime?.workflows?.length ?? 0,
    },
    personal_dev_plan: {
      schema_version: personalDevPlan.schema_version ?? null,
      task_id: personalDevPlan.reconciled?.task_id ?? null,
      required_gates: personalDevPlan.reconciled?.required_gates ?? [],
      declared_command_count: personalDevPlan.codex_plan?.commands?.length ?? 0,
    },
    personal_dev_test_result: {
      schema_version: personalDevTestResult.schema_version ?? null,
      agent_reported_status: personalDevTestResult.status ?? "unknown",
      agent_reported_command_count: personalDevTestResult.commands?.length ?? 0,
      agent_report_used_as_source_of_truth: false,
      agent_self_report_trusted: false,
    },
    policy_matrix: {
      schema_version: policyMatrix.schema_version ?? null,
      test_gate_defined: Boolean(testGateRule),
      test_gate_blocking_by_default: testGateRule?.blocking_by_default === true,
      test_gate_stage: testGateRule?.stage ?? null,
    },
    package_json: {
      package_name: packageJson.name ?? null,
      command_script_count: canonicalTestCommands.filter((command) => Boolean(scripts[command.script_name])).length,
      required_script_names: canonicalTestCommands.map((command) => command.script_name),
    },
    desktop_companion_integration: {
      declares_read_only: /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /source of truth가 아니라|not.*source of truth|source_of_truth=false/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /Human Gate|human gate|protected action request|protected_action_request/i.test(desktopCompanionIntegration),
    },
  };
}

function readRuntimeVerifications(runtimeAgentRunContractFreeze) {
  return runtimeAgentRunContractFreeze.runtime_verifications
    ?? runtimeAgentRunContractFreeze.runtime_agentrun_contract?.runtime_verifications
    ?? [];
}

function validateCanonicalTestRunner({
  runtimeArtifactCapture,
  runtimeAgentRunContractFreeze,
  protectedFileGate,
  personalDevPlan,
  personalDevTestResult,
  policyMatrix,
  packageJson,
  desktopCompanionIntegration,
  canonicalTestCommands,
  canonicalTestPlans,
  canonicalTestExecutions,
  canonicalTestGateResults,
  canonicalTestDesktopBoundary,
}) {
  const scripts = packageJson.scripts ?? {};
  const testGateRule = (policyMatrix.gate_rules ?? []).find((ruleRecord) => ruleRecord.gate_id === "test_gate");
  const items = [];
  items.push(validationItem("source.runtime_artifact_capture", "test_gate_diff_captures_available", runtimeArtifactCapture.summary?.runtime_artifact_capture_status === "complete" && canonicalTestPlans.length > 0 && runtimeArtifactCapture.summary?.diff_apply_allowed === false, "Runtime Artifact Capture provides test-gated diff captures without direct apply."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_verification_requires_test_gate", readRuntimeVerifications(runtimeAgentRunContractFreeze).some((record) => record.required_gates?.includes("test_gate")), "Runtime verification records require test_gate."));
  items.push(validationItem("source.protected_file_gate", "protected_file_gate_complete_before_tests", protectedFileGate.summary?.protected_file_gate_status === "complete" && protectedFileGate.summary?.direct_apply_allowed_count === 0 && protectedFileGate.summary?.protected_action_executed_count === 0, "Protected file gate is complete and no protected action was executed."));
  items.push(validationItem("source.personal_dev_plan", "canonical_commands_declared", personalDevPlan.codex_plan?.commands?.length >= 2 && personalDevPlan.reconciled?.required_gates?.includes("test_gate"), "Personal Dev plan declares canonical commands and test_gate."));
  items.push(validationItem("source.personal_dev_test_result", "agent_report_is_reference_only", personalDevTestResult.status === "passed" && personalDevTestResult.commands?.length >= 2, "Agent-reported test result is present but remains reference-only."));
  items.push(validationItem("source.policy_matrix", "test_gate_policy_defined", Boolean(testGateRule) && testGateRule.blocking_by_default === true && testGateRule.stage === "post_run", "Policy matrix defines post-run blocking test_gate."));
  items.push(validationItem("source.package_json", "canonical_package_scripts_exist", canonicalTestCommands.every((command) => Boolean(scripts[command.script_name])), "Every canonical test command maps to an npm script."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_read_only_for_test_surface", /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration) && /Human Gate|human gate|protected action request|protected_action_request/i.test(desktopCompanionIntegration), "Desktop companion remains read-only and routes mutation through human gates."));
  items.push(validationItem("canonical_test_plans", "plans_cover_test_gated_diffs", canonicalTestPlans.length > 0 && canonicalTestPlans.every((plan) => plan.test_gate_required && plan.agent_self_report_trusted === false), "Canonical test plans cover every test-gated diff and distrust agent self-report."));
  items.push(validationItem("canonical_test_executions", "harness_reexecuted_all_commands", canonicalTestExecutions.length === canonicalTestPlans.length * canonicalTestCommands.length && canonicalTestExecutions.every((execution) => execution.execution_source === "harness_rerun" && execution.agent_self_report_trusted === false && execution.execution_performed === true), "Harness re-executed each canonical command for each test plan."));
  items.push(validationItem("canonical_test_executions", "canonical_commands_passed", canonicalTestExecutions.length > 0 && canonicalTestExecutions.every((execution) => execution.harness_status === "passed" && execution.harness_exit_code === 0 && execution.timed_out === false), "All harness-executed canonical commands passed."));
  items.push(validationItem("canonical_test_gate_results", "test_gate_results_passed_but_not_merge_ready", canonicalTestGateResults.length === canonicalTestPlans.length && canonicalTestGateResults.every((gateResult) => gateResult.test_gate_status === "passed" && gateResult.merge_ready === false && gateResult.human_review_required === true), "Test gate passes only advance to human review; they do not make a merge-ready state."));
  items.push(validationItem("canonical_test_desktop_boundary", "desktop_boundary_locked_read_only", canonicalTestDesktopBoundary.boundary_status === "locked" && canonicalTestDesktopBoundary.read_only === true && canonicalTestDesktopBoundary.mutation_allowed === false && canonicalTestDesktopBoundary.canonical_test_execution_allowed === false && canonicalTestDesktopBoundary.desktop_source_of_truth === false, "Desktop canonical test surface is read-only and cannot execute tests directly."));
  items.push(validationItem("canonical_test_desktop_boundary", "desktop_cannot_apply_or_merge", canonicalTestDesktopBoundary.direct_apply_allowed === false && canonicalTestDesktopBoundary.direct_merge_allowed === false && canonicalTestDesktopBoundary.protected_mutation_execution_allowed === false, "Desktop cannot apply diffs, merge branches, or execute protected mutations."));
  return items;
}

function summarizeCanonicalTestRunner({
  validation,
  validationItems,
  canonicalTestCommands,
  canonicalTestPlans,
  canonicalTestExecutions,
  canonicalTestGateResults,
  canonicalTestDesktopBoundary,
  personalDevTestResult,
  protectedFileGate,
}) {
  return {
    canonical_test_runner_status: validation.valid ? "complete" : "blocked",
    canonical_test_runner_contract_id: "canonical-test-runner.default",
    contract_status: "locked",
    test_runner_authority: TEST_RUNNER_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    execution_source: "harness_rerun",
    agent_self_report_trusted: false,
    runtime_self_report_trusted: false,
    harness_reexecution_required: true,
    canonical_command_count: canonicalTestCommands.length,
    canonical_test_plan_count: canonicalTestPlans.length,
    canonical_test_execution_count: canonicalTestExecutions.length,
    passed_execution_count: canonicalTestExecutions.filter((execution) => execution.harness_status === "passed").length,
    failed_execution_count: canonicalTestExecutions.filter((execution) => execution.harness_status === "failed").length,
    timed_out_execution_count: canonicalTestExecutions.filter((execution) => execution.harness_status === "timed_out").length,
    skipped_execution_count: canonicalTestExecutions.filter((execution) => execution.harness_status === "skipped").length,
    command_execution_allowed_count: canonicalTestExecutions.filter((execution) => execution.command_execution_allowed).length,
    execution_performed_count: canonicalTestExecutions.filter((execution) => execution.execution_performed).length,
    agent_reported_command_count: personalDevTestResult.commands?.length ?? 0,
    agent_report_used_as_source_of_truth: false,
    agent_reported_status: personalDevTestResult.status ?? "unknown",
    gate_result_count: canonicalTestGateResults.length,
    passed_gate_result_count: canonicalTestGateResults.filter((gateResult) => gateResult.test_gate_status === "passed").length,
    blocked_gate_result_count: canonicalTestGateResults.filter((gateResult) => gateResult.test_gate_status !== "passed").length,
    human_approval_required_count: canonicalTestGateResults.filter((gateResult) => gateResult.human_approval_gate_required).length,
    human_review_required_count: canonicalTestGateResults.filter((gateResult) => gateResult.human_review_required).length,
    merge_ready_count: canonicalTestGateResults.filter((gateResult) => gateResult.merge_ready).length,
    direct_merge_allowed_count: canonicalTestGateResults.filter((gateResult) => gateResult.direct_merge_allowed).length,
    direct_apply_allowed_count: canonicalTestGateResults.filter((gateResult) => gateResult.direct_apply_allowed).length,
    protected_file_gate_status: protectedFileGate.summary?.protected_file_gate_status ?? "unknown",
    protected_file_gate_required: true,
    diff_review_gate_required: true,
    human_approval_gate_required: true,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: canonicalTestDesktopBoundary.read_only === true,
    desktop_mutation_allowed: canonicalTestDesktopBoundary.mutation_allowed === true,
    desktop_canonical_test_rerun_request_allowed: canonicalTestDesktopBoundary.canonical_test_rerun_request_allowed === true,
    desktop_canonical_test_execution_allowed: canonicalTestDesktopBoundary.canonical_test_execution_allowed === true,
    desktop_protected_mutation_execution_allowed: canonicalTestDesktopBoundary.protected_mutation_execution_allowed === true,
    desktop_source_of_truth: canonicalTestDesktopBoundary.desktop_source_of_truth === true,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(canonicalTestPlans, "runtime_id"),
    by_harness_status: countBy(canonicalTestExecutions, "harness_status"),
    by_test_gate_status: countBy(canonicalTestGateResults, "test_gate_status"),
  };
}

function renderCanonicalTestRunnerMarkdown(result) {
  const lines = [];
  lines.push("# Canonical Test Runner");
  lines.push("");
  lines.push(`- Status: ${result.summary.canonical_test_runner_status}`);
  lines.push(`- Plans: ${result.summary.canonical_test_plan_count}`);
  lines.push(`- Executions: ${result.summary.passed_execution_count}/${result.summary.canonical_test_execution_count} passed`);
  lines.push(`- Agent self-report trusted: ${result.summary.agent_self_report_trusted}`);
  lines.push(`- Desktop: ${result.summary.desktop_surface_policy}, execution_allowed=${result.summary.desktop_canonical_test_execution_allowed}`);
  lines.push("");
  lines.push("## Commands");
  for (const execution of result.canonical_test_executions) {
    lines.push(`- ${execution.harness_status}: ${execution.canonical_test_plan_id} ${execution.command}`);
  }
  lines.push("");
  lines.push("## Validation");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.path} (${item.check}) - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function runCommand(command, options) {
  return new Promise((resolve) => {
    const startedAt = new Date();
    const spawnSpec = resolveCommandSpawn(command);
    const child = spawn(spawnSpec.command, spawnSpec.args, {
      cwd: options.cwd,
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
        started_at: startedAt.toISOString(),
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
        started_at: startedAt.toISOString(),
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
        started_at: startedAt.toISOString(),
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

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_CANONICAL_TEST_RUNNER_OUT_DIR,
  };
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
    else if (arg === "--runtime-artifact-capture") parsed.runtimeArtifactCapturePath = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--protected-file-gate") parsed.protectedFileGatePath = argv[++index];
    else if (arg === "--personal-dev-slice") parsed.personalDevSlicePath = argv[++index];
    else if (arg === "--personal-dev-plan") parsed.personalDevPlanPath = argv[++index];
    else if (arg === "--personal-dev-test-result") parsed.personalDevTestResultPath = argv[++index];
    else if (arg === "--policy-matrix") parsed.policyMatrixPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/canonical-test-runner.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --runtime-artifact-capture <p>   runtime-artifact-capture.json path.
  --runtime-agentrun-contract-freeze <p>
                                  runtime-agentrun-contract-freeze.json path.
  --protected-file-gate <p>        protected-file-gate.json path.
  --personal-dev-slice <p>         personal-dev-slice.json path.
  --personal-dev-plan <p>          personal-dev plan.json path.
  --personal-dev-test-result <p>   personal-dev test-result.json path.
  --policy-matrix <p>              policy-matrix.json path.
  --package <p>                    package.json path.
  --desktop-companion-integration <p>
                                  desktop companion integration doc path.
  --timeout-ms <n>                 Per-command timeout, default ${DEFAULT_TEST_TIMEOUT_MS}.
  --out-dir <folder>               Output directory.
  --run-at <iso>                   Deterministic generated_at timestamp.
  -h, --help                       Show this help.
`);
}

function parseNpmRunCommand(commandText) {
  const match = String(commandText ?? "").trim().match(/^npm\s+run\s+([A-Za-z0-9:_-]+)$/);
  if (!match) throw new Error(`Unsupported canonical test command: ${commandText}`);
  return { script_name: match[1] };
}

function commandId(scriptName) {
  return scriptName.replaceAll(":", "_").replaceAll("-", "_");
}

function commandStatus(command) {
  if (command.timed_out) return "timed_out";
  return command.exit_code === 0 ? "passed" : "failed";
}

function normalizeCommand(command) {
  return String(command ?? "").trim().replace(/\s+/g, " ");
}

function preview(value) {
  return String(value ?? "").slice(0, 4000);
}

function serializableCanonicalTestRunner(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function validationItem(pathLabel, check, passed, message) {
  return {
    path: pathLabel,
    check,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      check: item.check,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 120) || "unknown";
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function dateStamp(value) {
  return String(value).replace(/[-:TZ.]/g, "").slice(0, 14);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
