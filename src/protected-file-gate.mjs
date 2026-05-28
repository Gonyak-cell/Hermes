import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PROTECTED_FILE_GATE_OUT_DIR = "artifacts/protected-file-gate/latest";
export const DEFAULT_PROTECTED_FILE_GATE_INPUTS = {
  runtimeArtifactCapturePath: "artifacts/runtime-artifact-capture/latest/runtime-artifact-capture.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  claudeCodeAdapterContractPath: "artifacts/claude-code-adapter-contract/latest/claude-code-adapter-contract.json",
  codexAdapterContractPath: "artifacts/codex-adapter-contract/latest/codex-adapter-contract.json",
  runtimeControlCommandsPath: "artifacts/runtime-control-commands/latest/runtime-control-commands.json",
  policyMatrixPath: "examples/core/policy-matrix.json",
  prDraftPath: "artifacts/personal-dev-slice/latest/pr-draft.md",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const GATE_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "runtime_artifact_capture_adapter_gate_contracts_and_policy_matrix";
const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";

const PROTECTED_FIXTURE_PATHS = [
  ".env",
  "configs/hermes/production/provider-keys.json",
  "migrations/20260528-add-runtime-state.sql",
  "infra/prod/deploy.yaml",
  "src/credential-loader.mjs",
];

const FALLBACK_DECLARED_CHANGE_PATHS = [
  "scripts/dev-project-brief.mjs",
  "src/dev-projects.mjs",
  "test/matter-harness.test.mjs",
];

export async function runProtectedFileGate(options = {}) {
  const result = await buildProtectedFileGate(options);
  if (options.write !== false) await writeProtectedFileGate(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Protected file gate validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildProtectedFileGate(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PROTECTED_FILE_GATE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const runtimeArtifactCapture = await readJson(inputs.runtime_artifact_capture_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const claudeCodeAdapterContract = await readJson(inputs.claude_code_adapter_contract_path);
  const codexAdapterContract = await readJson(inputs.codex_adapter_contract_path);
  const runtimeControlCommands = await readJson(inputs.runtime_control_commands_path);
  const policyMatrix = await readJson(inputs.policy_matrix_path);
  const prDraft = await readFile(inputs.pr_draft_path, "utf8");
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");
  const projection = projectProtectedFileGate({
    runtimeArtifactCapture,
    runtimeAgentRunContractFreeze,
    claudeCodeAdapterContract,
    codexAdapterContract,
    runtimeControlCommands,
    policyMatrix,
    prDraft,
    generatedAt,
  });
  const validationItems = validateProtectedFileGate({
    runtimeArtifactCapture,
    runtimeAgentRunContractFreeze,
    claudeCodeAdapterContract,
    codexAdapterContract,
    runtimeControlCommands,
    policyMatrix,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "protected-file-gate.v1",
    generated_at: generatedAt,
    protected_file_gate_id: `protected-file-gate.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeArtifactCapture,
      runtimeAgentRunContractFreeze,
      claudeCodeAdapterContract,
      codexAdapterContract,
      runtimeControlCommands,
      policyMatrix,
      desktopCompanionIntegration,
      projection,
    }),
    protected_file_gate_contract: buildProtectedFileGateContract(generatedAt),
    protected_file_gate_rules: projection.protectedFileGateRules,
    protected_file_change_evaluations: projection.protectedFileChangeEvaluations,
    protected_file_approval_requirements: projection.protectedFileApprovalRequirements,
    protected_file_gate_desktop_boundary: projection.protectedFileGateDesktopBoundary,
    summary: summarizeProtectedFileGate(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderProtectedFileGateMarkdown(result),
  };
}

export async function writeProtectedFileGate(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "protected-file-gate.json"), serializableProtectedFileGate(result));
  await writeJson(path.join(outDir, "protected-file-gate-rules.json"), {
    schema_version: "protected-file-gate-rules.v1",
    generated_at: result.generated_at,
    protected_file_gate_rule_count: result.protected_file_gate_rules.length,
    protected_file_gate_rules: result.protected_file_gate_rules,
  });
  await writeJson(path.join(outDir, "protected-file-change-evaluations.json"), {
    schema_version: "protected-file-change-evaluations.v1",
    generated_at: result.generated_at,
    protected_file_change_evaluation_count: result.protected_file_change_evaluations.length,
    protected_file_change_evaluations: result.protected_file_change_evaluations,
  });
  await writeJson(path.join(outDir, "protected-file-approval-requirements.json"), {
    schema_version: "protected-file-approval-requirements.v1",
    generated_at: result.generated_at,
    protected_file_approval_requirement_count: result.protected_file_approval_requirements.length,
    protected_file_approval_requirements: result.protected_file_approval_requirements,
  });
  await writeJson(path.join(outDir, "protected-file-gate-desktop-boundary.json"), result.protected_file_gate_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "protected-file-gate-validation-report.v1",
    generated_at: result.generated_at,
    protected_file_gate_id: result.protected_file_gate_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runProtectedFileGateCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runProtectedFileGate(args);
    console.log(`Protected file gate written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.protected_file_gate_status}`);
    console.log(`Evaluations: ${result.summary.change_evaluation_count}`);
    console.log(`Blocked before approval: ${result.summary.blocked_before_approval_count}`);
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
    runtime_artifact_capture_path: path.resolve(options.runtimeArtifactCapturePath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.runtimeArtifactCapturePath),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.runtimeAgentRunContractFreezePath),
    claude_code_adapter_contract_path: path.resolve(options.claudeCodeAdapterContractPath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.claudeCodeAdapterContractPath),
    codex_adapter_contract_path: path.resolve(options.codexAdapterContractPath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.codexAdapterContractPath),
    runtime_control_commands_path: path.resolve(options.runtimeControlCommandsPath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.runtimeControlCommandsPath),
    policy_matrix_path: path.resolve(options.policyMatrixPath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.policyMatrixPath),
    pr_draft_path: path.resolve(options.prDraftPath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.prDraftPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_PROTECTED_FILE_GATE_INPUTS.desktopCompanionIntegrationPath),
  };
}

function projectProtectedFileGate({
  runtimeArtifactCapture,
  runtimeAgentRunContractFreeze,
  claudeCodeAdapterContract,
  codexAdapterContract,
  runtimeControlCommands,
  policyMatrix,
  prDraft,
  generatedAt,
}) {
  const diffCaptures = (runtimeArtifactCapture.diff_capture_records ?? []).filter((record) => record.required_gates?.includes("protected_file_gate"));
  const agentRuns = runtimeAgentRunContractFreeze.runtime_agentrun_contract?.agent_runs ?? [];
  const protectedPathPatterns = collectProtectedPathPatterns(agentRuns);
  const protectedFileGateRule = (policyMatrix.gate_rules ?? []).find((rule) => rule.gate_id === "protected_file_gate") ?? {};
  const declaredChangePaths = extractDeclaredChangePaths(prDraft);
  const protectedFileGateRules = buildProtectedFileGateRules({
    protectedPathPatterns,
    protectedFileGateRule,
    generatedAt,
  });

  const protectedFileChangeEvaluations = diffCaptures.flatMap((diffCapture) => {
    const candidatePaths = [
      ...declaredChangePaths.map((file_path) => ({ file_path, candidate_origin: "pr_draft_declared_change" })),
      ...PROTECTED_FIXTURE_PATHS.map((file_path) => ({ file_path, candidate_origin: "protected_rule_fixture" })),
    ];
    return candidatePaths.map((candidate) => evaluateProtectedFileChange({
      candidate,
      diffCapture,
      protectedFileGateRules,
      claudeCodeAdapterContract,
      codexAdapterContract,
      runtimeControlCommands,
      generatedAt,
    }));
  });

  const protectedFileApprovalRequirements = protectedFileChangeEvaluations
    .filter((evaluation) => evaluation.protected_file_detected)
    .map((evaluation) => ({
      schema_version: "protected-file-approval-requirement.v1",
      protected_file_approval_requirement_id: `protected-file-approval.${slugify(evaluation.protected_file_change_evaluation_id)}`,
      protected_file_change_evaluation_id: evaluation.protected_file_change_evaluation_id,
      source_diff_capture_record_id: evaluation.source_diff_capture_record_id,
      agent_run_id: evaluation.agent_run_id,
      workflow_run_id: evaluation.workflow_run_id,
      runtime_id: evaluation.runtime_id,
      adapter_id: evaluation.adapter_id,
      file_path: evaluation.file_path,
      matched_rule_ids: evaluation.matched_rule_ids,
      approval_requirement_status: "pending_explicit_approval",
      approval_authority: "human_gate",
      protected_mutation_route: PROTECTED_MUTATION_ROUTE,
      explicit_approval_required: true,
      human_gate_required: true,
      write_allowed_before_approval: false,
      mutation_allowed_before_approval: false,
      protected_action_executed: false,
      audit_event_append_required: true,
      reason_codes: evaluation.reason_codes,
      recorded_at: generatedAt,
    }));

  const protectedFileGateDesktopBoundary = {
    schema_version: "protected-file-gate-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "protected-file-gate.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "protected_file_gate",
    desktop_surface_policy: "read_only_protected_file_status_with_approval_request_drafts",
    source_of_truth: GATE_AUTHORITY,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: true,
    protected_mutation_execution_allowed: false,
    direct_file_write_allowed: false,
    protected_file_write_allowed: false,
    approval_bypass_allowed: false,
    rule_edit_allowed: false,
    runtime_process_control_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
    allowed_operator_actions: ["view_protected_file_gate", "view_blocked_paths", "draft_explicit_approval_request"],
    denied_operator_actions: ["write_protected_file", "apply_diff", "bypass_protected_file_gate", "edit_protected_file_rules", "execute_approval"],
    protected_file_gate_rule_count: protectedFileGateRules.length,
    change_evaluation_count: protectedFileChangeEvaluations.length,
    blocked_before_approval_count: protectedFileChangeEvaluations.filter((evaluation) => evaluation.blocked_before_approval).length,
    approval_requirement_count: protectedFileApprovalRequirements.length,
  };

  return {
    protectedFileGateRules,
    protectedFileChangeEvaluations,
    protectedFileApprovalRequirements,
    protectedFileGateDesktopBoundary,
  };
}

function collectProtectedPathPatterns(agentRuns) {
  const patterns = new Set([
    ".env",
    "**/*secret*",
    "**/*credential*",
    "configs/**/prod/**",
    "configs/**/production/**",
    "infra/**",
    "migrations/**",
    "package-lock.json",
  ]);
  for (const run of agentRuns) {
    if (!["claude_code", "codex"].includes(run.runtime_id)) continue;
    for (const pattern of run.workspace_policy?.protected_paths ?? []) patterns.add(pattern);
  }
  return [...patterns].sort();
}

function buildProtectedFileGateRules({ protectedPathPatterns, protectedFileGateRule, generatedAt }) {
  return [
    rule("protected-path-policy", "workspace_policy_pattern", "protected_path", protectedPathPatterns, "block_pending_explicit_approval", generatedAt),
    rule("secret-material-path", "semantic_path_pattern", "secret", [".env", "**/*secret*", "**/*credential*", "**/*.pem", "**/*.key"], "block_pending_explicit_approval", generatedAt),
    rule("production-config-path", "semantic_path_pattern", "production_config", ["configs/**/prod/**", "configs/**/production/**", "infra/**", "deploy/**", "k8s/**", "*.prod.*", "production.*"], "block_pending_explicit_approval", generatedAt),
    rule("migration-path", "semantic_path_pattern", "migration", ["migrations/**", "schema/migrations/**", "db/migrations/**"], "block_pending_explicit_approval", generatedAt),
  ];
}

function rule(id, ruleType, protectedClass, patterns, gateDecision, generatedAt) {
  return {
    schema_version: "protected-file-gate-rule.v1",
    protected_file_gate_rule_id: `protected-file-rule.${id}`,
    rule_type: ruleType,
    protected_class: protectedClass,
    pattern_count: patterns.length,
    patterns,
    gate_decision: gateDecision,
    blocking_by_default: true,
    explicit_approval_required: true,
    human_gate_required: true,
    write_allowed_before_approval: false,
    mutation_allowed_before_approval: false,
    protected_action_executed: false,
    rule_status: "locked",
    recorded_at: generatedAt,
  };
}

function evaluateProtectedFileChange({
  candidate,
  diffCapture,
  protectedFileGateRules,
  claudeCodeAdapterContract,
  codexAdapterContract,
  runtimeControlCommands,
  generatedAt,
}) {
  const normalizedPath = normalizeFilePath(candidate.file_path);
  const matchedRules = protectedFileGateRules.filter((ruleRecord) => ruleRecord.patterns.some((pattern) => matchesPattern(normalizedPath, pattern)));
  const protectedFileDetected = matchedRules.length > 0;
  const matchedRuleIds = matchedRules.map((ruleRecord) => ruleRecord.protected_file_gate_rule_id);
  const pathClasses = unique(matchedRules.map((ruleRecord) => ruleRecord.protected_class));
  const adapterSummary = diffCapture.runtime_id === "claude_code" ? claudeCodeAdapterContract.summary : codexAdapterContract.summary;
  return {
    schema_version: "protected-file-change-evaluation.v1",
    protected_file_change_evaluation_id: `protected-file-evaluation.${slugify(diffCapture.diff_capture_record_id)}.${slugify(normalizedPath)}`,
    protected_file_gate_contract_id: "protected-file-gate.default",
    source_diff_capture_record_id: diffCapture.diff_capture_record_id,
    source_diff_capture_kind: diffCapture.diff_capture_kind,
    agent_run_id: diffCapture.agent_run_id,
    workflow_run_id: diffCapture.workflow_run_id,
    runtime_id: diffCapture.runtime_id,
    adapter_id: diffCapture.adapter_id,
    output_artifact_id: diffCapture.output_artifact_id,
    candidate_origin: candidate.candidate_origin,
    file_path: normalizedPath,
    path_classes: pathClasses,
    matched_rule_ids: matchedRuleIds,
    protected_file_detected: protectedFileDetected,
    gate_status: protectedFileDetected ? "blocked_pending_explicit_approval" : "passed_unprotected",
    gate_decision: protectedFileDetected ? "block" : "allow_with_downstream_diff_review",
    blocked_before_approval: protectedFileDetected,
    explicit_approval_required: protectedFileDetected,
    human_gate_required: true,
    write_allowed_before_approval: false,
    mutation_allowed_before_approval: false,
    direct_apply_allowed: false,
    direct_merge_allowed: false,
    protected_path_write_allowed: false,
    diff_review_gate_required: diffCapture.required_gates?.includes("diff_review_gate") ?? true,
    test_gate_required: diffCapture.required_gates?.includes("test_gate") ?? true,
    human_approval_gate_required: diffCapture.required_gates?.includes("human_approval_gate") ?? true,
    protected_action_executed: false,
    runtime_self_report_trusted: false,
    adapter_protected_file_gate_required: adapterSummary?.protected_file_gate_required === true,
    runtime_control_execution_allowed: runtimeControlCommands.summary?.command_execution_allowed === true,
    reason_codes: buildReasonCodes({ protectedFileDetected, pathClasses }),
    gate_hash: sha256(JSON.stringify({
      diff_capture_record_id: diffCapture.diff_capture_record_id,
      file_path: normalizedPath,
      matched_rule_ids: matchedRuleIds,
      protected_file_detected: protectedFileDetected,
    })),
    recorded_at: generatedAt,
  };
}

function buildReasonCodes({ protectedFileDetected, pathClasses }) {
  if (!protectedFileDetected) return ["no_protected_file_rule_match", "downstream_diff_review_still_required"];
  return [
    ...pathClasses.map((pathClass) => `${pathClass}_protected_file_rule_matched`),
    "blocked_before_explicit_approval",
  ];
}

function buildProtectedFileGateContract(generatedAt) {
  return {
    schema_version: "protected-file-gate-contract.v1",
    generated_at: generatedAt,
    protected_file_gate_contract_id: "protected-file-gate.default",
    contract_status: "locked",
    gate_authority: GATE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    blocking_by_default: true,
    explicit_approval_required_for_protected_paths: true,
    human_gate_required: true,
    audit_event_append_required: true,
    direct_apply_allowed: false,
    direct_merge_allowed: false,
    protected_path_write_allowed: false,
    write_allowed_before_approval: false,
    mutation_allowed_before_approval: false,
    protected_action_executed: false,
    runtime_self_report_trusted: false,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: true,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
  };
}

function buildSourceContracts({
  runtimeArtifactCapture,
  runtimeAgentRunContractFreeze,
  claudeCodeAdapterContract,
  codexAdapterContract,
  runtimeControlCommands,
  policyMatrix,
  desktopCompanionIntegration,
  projection,
}) {
  const protectedFileGateRule = (policyMatrix.gate_rules ?? []).find((ruleRecord) => ruleRecord.gate_id === "protected_file_gate");
  return {
    runtime_artifact_capture: {
      schema_version: runtimeArtifactCapture.schema_version ?? null,
      runtime_artifact_capture_status: runtimeArtifactCapture.summary?.runtime_artifact_capture_status ?? "unknown",
      diff_capture_record_count: runtimeArtifactCapture.summary?.diff_capture_record_count ?? 0,
      bound_diff_capture_count: runtimeArtifactCapture.summary?.bound_diff_capture_count ?? 0,
      diff_apply_allowed: runtimeArtifactCapture.summary?.diff_apply_allowed ?? false,
      validation_error_count: runtimeArtifactCapture.summary?.validation_error_count ?? runtimeArtifactCapture.validation?.errors?.length ?? 0,
    },
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      protected_path_policy_count: projection.protectedFileGateRules.find((ruleRecord) => ruleRecord.protected_class === "protected_path")?.pattern_count ?? 0,
      validation_error_count: runtimeAgentRunContractFreeze.summary?.validation_error_count ?? runtimeAgentRunContractFreeze.validation?.errors?.length ?? 0,
    },
    claude_code_adapter_contract: {
      schema_version: claudeCodeAdapterContract.schema_version ?? null,
      claude_code_adapter_contract_status: claudeCodeAdapterContract.summary?.claude_code_adapter_contract_status ?? "unknown",
      protected_file_gate_required: claudeCodeAdapterContract.summary?.protected_file_gate_required === true,
      protected_path_write_allowed: claudeCodeAdapterContract.summary?.protected_path_write_allowed ?? false,
      direct_apply_allowed: claudeCodeAdapterContract.summary?.direct_apply_allowed ?? false,
    },
    codex_adapter_contract: {
      schema_version: codexAdapterContract.schema_version ?? null,
      codex_adapter_contract_status: codexAdapterContract.summary?.codex_adapter_contract_status ?? "unknown",
      protected_file_gate_required: codexAdapterContract.summary?.protected_file_gate_required === true,
      protected_path_write_allowed: codexAdapterContract.summary?.protected_path_write_allowed ?? false,
      direct_apply_allowed: codexAdapterContract.summary?.direct_apply_allowed ?? false,
    },
    runtime_control_commands: {
      schema_version: runtimeControlCommands.schema_version ?? null,
      runtime_control_command_status: runtimeControlCommands.summary?.runtime_control_command_status ?? "unknown",
      command_execution_allowed: runtimeControlCommands.summary?.command_execution_allowed ?? false,
      runtime_process_control_allowed: runtimeControlCommands.summary?.runtime_process_control_allowed ?? false,
      protected_action_executed_count: runtimeControlCommands.summary?.protected_action_executed_count ?? 0,
    },
    policy_matrix: {
      schema_version: policyMatrix.schema_version ?? null,
      protected_file_gate_defined: Boolean(protectedFileGateRule),
      protected_file_gate_blocking_by_default: protectedFileGateRule?.blocking_by_default === true,
      protected_file_gate_stage: protectedFileGateRule?.stage ?? null,
    },
    desktop_companion_integration: {
      declares_read_only: /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /source of truth가 아니라|not.*source of truth|source_of_truth=false/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /Human Gate|human gate|protected action request|protected_action_request/i.test(desktopCompanionIntegration),
      declares_protected_mutation_boundary: /protected execution|mutation_allowed=false|protected mutation|직접 제어하지 않는다|runtime source of truth/i.test(desktopCompanionIntegration),
    },
  };
}

function validateProtectedFileGate({
  runtimeArtifactCapture,
  runtimeAgentRunContractFreeze,
  claudeCodeAdapterContract,
  codexAdapterContract,
  runtimeControlCommands,
  policyMatrix,
  desktopCompanionIntegration,
  protectedFileGateRules,
  protectedFileChangeEvaluations,
  protectedFileApprovalRequirements,
  protectedFileGateDesktopBoundary,
}) {
  const diffCaptureCount = runtimeArtifactCapture.summary?.diff_capture_record_count ?? runtimeArtifactCapture.diff_capture_records?.length ?? 0;
  const protectedEvaluations = protectedFileChangeEvaluations.filter((evaluation) => evaluation.protected_file_detected);
  const declaredEvaluations = protectedFileChangeEvaluations.filter((evaluation) => evaluation.candidate_origin === "pr_draft_declared_change");
  const policyGate = (policyMatrix.gate_rules ?? []).find((ruleRecord) => ruleRecord.gate_id === "protected_file_gate");
  const items = [];
  items.push(validationItem("source.runtime_artifact_capture", "diff_captures_available", runtimeArtifactCapture.summary?.runtime_artifact_capture_status === "complete" && diffCaptureCount > 0 && runtimeArtifactCapture.summary?.diff_apply_allowed === false && runtimeArtifactCapture.validation?.valid !== false, "Runtime Artifact Capture has human-gated diff captures and cannot apply diffs directly."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_workspace_protected_paths_present", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete" && protectedFileGateRules.some((ruleRecord) => ruleRecord.protected_class === "protected_path" && ruleRecord.pattern_count >= 5), "Runtime/AgentRun freeze provides protected workspace path patterns."));
  items.push(validationItem("source.claude_code_adapter_contract", "claude_code_requires_protected_file_gate", claudeCodeAdapterContract.summary?.claude_code_adapter_contract_status === "complete" && claudeCodeAdapterContract.summary?.protected_file_gate_required === true && claudeCodeAdapterContract.summary?.protected_path_write_allowed === false, "Claude Code adapter requires protected file gate and cannot write protected paths."));
  items.push(validationItem("source.codex_adapter_contract", "codex_requires_protected_file_gate", codexAdapterContract.summary?.codex_adapter_contract_status === "complete" && codexAdapterContract.summary?.protected_file_gate_required === true && codexAdapterContract.summary?.protected_path_write_allowed === false, "Codex adapter requires protected file gate and cannot write protected paths."));
  items.push(validationItem("source.runtime_control_commands", "runtime_control_non_executing", runtimeControlCommands.summary?.runtime_control_command_status === "complete" && runtimeControlCommands.summary?.command_execution_allowed === false && runtimeControlCommands.summary?.protected_action_executed_count === 0, "Runtime control commands remain non-executing."));
  items.push(validationItem("source.policy_matrix", "protected_file_gate_policy_defined", Boolean(policyGate) && policyGate.blocking_by_default === true, "Policy matrix defines protected_file_gate as blocking by default."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_declares_protected_boundary", /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration) && /protected action request|Human Gate|human gate/i.test(desktopCompanionIntegration), "Desktop companion remains read-only with protected mutation routed through human gates."));
  items.push(validationItem("protected_file_gate_rules", "rules_cover_secret_config_migration_prod", protectedFileGateRules.some((ruleRecord) => ruleRecord.protected_class === "secret") && protectedFileGateRules.some((ruleRecord) => ruleRecord.protected_class === "production_config") && protectedFileGateRules.some((ruleRecord) => ruleRecord.protected_class === "migration"), "Protected file rules cover secrets, production config, and migrations."));
  items.push(validationItem("protected_file_change_evaluations", "evaluations_cover_diff_captures", protectedFileChangeEvaluations.length >= diffCaptureCount * (PROTECTED_FIXTURE_PATHS.length + 1), "Protected file evaluations cover each captured diff/patch."));
  items.push(validationItem("protected_file_change_evaluations", "declared_changes_not_directly_applied", declaredEvaluations.length > 0 && declaredEvaluations.every((evaluation) => evaluation.direct_apply_allowed === false && evaluation.write_allowed_before_approval === false), "Declared change paths are evaluated and still cannot be directly applied."));
  items.push(validationItem("protected_file_change_evaluations", "protected_paths_blocked_before_approval", protectedEvaluations.length > 0 && protectedEvaluations.every((evaluation) => evaluation.gate_status === "blocked_pending_explicit_approval" && evaluation.blocked_before_approval === true && evaluation.write_allowed_before_approval === false && evaluation.protected_action_executed === false), "Secret, config, migration, and production protected paths are blocked before explicit approval."));
  items.push(validationItem("protected_file_approval_requirements", "approval_requirements_cover_protected_changes", protectedFileApprovalRequirements.length === protectedEvaluations.length && protectedFileApprovalRequirements.every((requirement) => requirement.approval_requirement_status === "pending_explicit_approval" && requirement.write_allowed_before_approval === false), "Every protected file evaluation has a pending explicit approval requirement."));
  items.push(validationItem("protected_file_gate_desktop_boundary", "desktop_boundary_locked_read_only", protectedFileGateDesktopBoundary.boundary_status === "locked" && protectedFileGateDesktopBoundary.read_only === true && protectedFileGateDesktopBoundary.mutation_allowed === false && protectedFileGateDesktopBoundary.protected_mutation_execution_allowed === false && protectedFileGateDesktopBoundary.desktop_source_of_truth === false, "Desktop protected file boundary is locked read-only with request drafts only."));
  items.push(validationItem("protected_file_gate_desktop_boundary", "desktop_cannot_write_or_bypass", protectedFileGateDesktopBoundary.direct_file_write_allowed === false && protectedFileGateDesktopBoundary.protected_file_write_allowed === false && protectedFileGateDesktopBoundary.approval_bypass_allowed === false && protectedFileGateDesktopBoundary.rule_edit_allowed === false, "Desktop cannot write protected files, bypass approval, or edit protected file rules."));
  return items;
}

function summarizeProtectedFileGate(projection, validationItems, validation) {
  const rules = projection.protectedFileGateRules;
  const evaluations = projection.protectedFileChangeEvaluations;
  const approvals = projection.protectedFileApprovalRequirements;
  return {
    protected_file_gate_status: validation.valid ? "complete" : "blocked",
    protected_file_gate_contract_id: "protected-file-gate.default",
    contract_status: "locked",
    gate_authority: GATE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    runtime_self_report_trusted: false,
    rule_count: rules.length,
    locked_rule_count: rules.filter((ruleRecord) => ruleRecord.rule_status === "locked").length,
    secret_rule_count: rules.filter((ruleRecord) => ruleRecord.protected_class === "secret").length,
    production_config_rule_count: rules.filter((ruleRecord) => ruleRecord.protected_class === "production_config").length,
    migration_rule_count: rules.filter((ruleRecord) => ruleRecord.protected_class === "migration").length,
    change_evaluation_count: evaluations.length,
    diff_capture_evaluated_count: new Set(evaluations.map((evaluation) => evaluation.source_diff_capture_record_id)).size,
    declared_change_evaluation_count: evaluations.filter((evaluation) => evaluation.candidate_origin === "pr_draft_declared_change").length,
    protected_fixture_evaluation_count: evaluations.filter((evaluation) => evaluation.candidate_origin === "protected_rule_fixture").length,
    protected_file_detected_count: evaluations.filter((evaluation) => evaluation.protected_file_detected).length,
    unprotected_change_count: evaluations.filter((evaluation) => !evaluation.protected_file_detected).length,
    blocked_before_approval_count: evaluations.filter((evaluation) => evaluation.blocked_before_approval).length,
    explicit_approval_required_count: evaluations.filter((evaluation) => evaluation.explicit_approval_required).length,
    approval_requirement_count: approvals.length,
    pending_explicit_approval_count: approvals.filter((requirement) => requirement.approval_requirement_status === "pending_explicit_approval").length,
    secret_file_block_count: evaluations.filter((evaluation) => evaluation.path_classes.includes("secret") && evaluation.blocked_before_approval).length,
    production_config_block_count: evaluations.filter((evaluation) => evaluation.path_classes.includes("production_config") && evaluation.blocked_before_approval).length,
    migration_block_count: evaluations.filter((evaluation) => evaluation.path_classes.includes("migration") && evaluation.blocked_before_approval).length,
    direct_apply_allowed_count: evaluations.filter((evaluation) => evaluation.direct_apply_allowed).length,
    direct_merge_allowed_count: evaluations.filter((evaluation) => evaluation.direct_merge_allowed).length,
    protected_path_write_allowed_count: evaluations.filter((evaluation) => evaluation.protected_path_write_allowed).length,
    write_allowed_before_approval_count: evaluations.filter((evaluation) => evaluation.write_allowed_before_approval).length,
    mutation_allowed_before_approval_count: evaluations.filter((evaluation) => evaluation.mutation_allowed_before_approval).length,
    protected_action_executed_count: evaluations.filter((evaluation) => evaluation.protected_action_executed).length,
    desktop_surface_policy: "read_only_protected_file_status_with_approval_request_drafts",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: true,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    direct_file_write_allowed: false,
    protected_file_write_allowed: false,
    approval_bypass_allowed: false,
    rule_edit_allowed: false,
    runtime_process_control_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(evaluations, "runtime_id"),
    by_gate_status: countBy(evaluations, "gate_status"),
    by_candidate_origin: countBy(evaluations, "candidate_origin"),
  };
}

function renderProtectedFileGateMarkdown(result) {
  const lines = [];
  lines.push("# Protected File Gate");
  lines.push("");
  lines.push(`- Status: ${result.summary.protected_file_gate_status}`);
  lines.push(`- Evaluations: ${result.summary.change_evaluation_count}`);
  lines.push(`- Blocked before approval: ${result.summary.blocked_before_approval_count}`);
  lines.push(`- Pending explicit approvals: ${result.summary.pending_explicit_approval_count}`);
  lines.push(`- Desktop: ${result.summary.desktop_surface_policy}, write_allowed=${result.summary.direct_file_write_allowed}`);
  lines.push("");
  lines.push("## Validation");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.path} (${item.check}) - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function extractDeclaredChangePaths(prDraft) {
  const lines = prDraft.split(/\r?\n/);
  const collected = [];
  let inImplementationPlan = false;
  for (const line of lines) {
    if (/^##\s+Codex Implementation Plan/i.test(line)) {
      inImplementationPlan = true;
      continue;
    }
    if (inImplementationPlan && /^##\s+/.test(line)) break;
    if (!inImplementationPlan) continue;
    const match = line.match(/^-\s+`?([^`\n]+?)`?\s*$/);
    if (match) collected.push(normalizeFilePath(match[1]));
  }
  return collected.length > 0 ? unique(collected) : FALLBACK_DECLARED_CHANGE_PATHS;
}

function normalizeFilePath(value) {
  return String(value ?? "").trim().replaceAll("\\", "/").replace(/^\.\/+/, "");
}

function matchesPattern(filePath, pattern) {
  const normalizedPattern = normalizeFilePath(pattern).toLowerCase();
  const normalizedPath = normalizeFilePath(filePath).toLowerCase();
  if (normalizedPattern === normalizedPath) return true;
  if (normalizedPattern === ".env" && normalizedPath.endsWith("/.env")) return true;
  if (normalizedPattern.includes("**")) {
    const regex = new RegExp(`^${globToRegexSource(normalizedPattern)}$`);
    return regex.test(normalizedPath);
  }
  if (normalizedPattern.endsWith("/**")) return normalizedPath.startsWith(normalizedPattern.slice(0, -3));
  if (normalizedPattern.includes("*")) {
    const regex = new RegExp(`^${globToRegexSource(normalizedPattern)}$`);
    return regex.test(normalizedPath);
  }
  return false;
}

function globToRegexSource(value) {
  let source = "";
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === "*") {
      if (value[index + 1] === "*") {
        source += ".*";
        index += 1;
      } else {
        source += "[^/]*";
      }
      continue;
    }
    source += escapeRegexCharacter(character);
  }
  return source;
}

function escapeRegexCharacter(value) {
  return value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

function serializableProtectedFileGate(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function validationItem(pathLabel, check, passed, message, details = {}) {
  return {
    path: pathLabel,
    check,
    status: passed ? "passed" : "failed",
    message,
    ...details,
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function dateStamp(value) {
  return value.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, ".").replaceAll(/^\.+|\.+$/g, "");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") args.check = true;
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--runtime-artifact-capture") args.runtimeArtifactCapturePath = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") args.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--claude-code-adapter-contract") args.claudeCodeAdapterContractPath = argv[++index];
    else if (arg === "--codex-adapter-contract") args.codexAdapterContractPath = argv[++index];
    else if (arg === "--runtime-control-commands") args.runtimeControlCommandsPath = argv[++index];
    else if (arg === "--policy-matrix") args.policyMatrixPath = argv[++index];
    else if (arg === "--pr-draft") args.prDraftPath = argv[++index];
    else if (arg === "--desktop-companion-integration") args.desktopCompanionIntegrationPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/protected-file-gate.mjs [options]

Options:
  --check                                      Fail when validation errors are present.
  --no-write                                   Build without writing artifacts.
  --out-dir <path>                             Output directory.
  --runtime-artifact-capture <path>            Runtime Artifact Capture artifact.
  --runtime-agentrun-contract-freeze <path>    Runtime/AgentRun freeze artifact.
  --claude-code-adapter-contract <path>        Claude Code adapter artifact.
  --codex-adapter-contract <path>              Codex adapter artifact.
  --runtime-control-commands <path>            Runtime Control Commands artifact.
  --policy-matrix <path>                       Core policy matrix.
  --pr-draft <path>                            PR draft containing declared changed files.
  --desktop-companion-integration <path>       Desktop Companion integration note.
`);
}
