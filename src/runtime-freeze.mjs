import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_FREEZE_OUT_DIR = "artifacts/runtime-freeze/latest";
export const DEFAULT_RUNTIME_FREEZE_INPUTS = {
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  hermesRuntimeAdapterPath: "artifacts/hermes-runtime-adapter/latest/hermes-runtime-adapter.json",
  claudeCodeAdapterContractPath: "artifacts/claude-code-adapter-contract/latest/claude-code-adapter-contract.json",
  codexAdapterContractPath: "artifacts/codex-adapter-contract/latest/codex-adapter-contract.json",
  localScriptAdapterPath: "artifacts/local-script-adapter/latest/local-script-adapter.json",
  documentRendererAdapterPath: "artifacts/document-renderer-adapter/latest/document-renderer-adapter.json",
  worktreeManagerV2Path: "artifacts/worktree-manager-v2/latest/worktree-manager-v2.json",
  sandboxPolicyModelPath: "artifacts/sandbox-policy-model/latest/sandbox-policy-model.json",
  dockerLocalBackendSelectorPath: "artifacts/docker-local-backend-selector/latest/docker-local-backend-selector.json",
  secretsBrokerContractPath: "artifacts/secrets-broker/latest/secrets-broker-contract.json",
  runtimeArtifactCapturePath: "artifacts/runtime-artifact-capture/latest/runtime-artifact-capture.json",
  runtimeLogNormalizationPath: "artifacts/runtime-log-normalization/latest/runtime-log-normalization.json",
  runtimeTimeoutHeartbeatPath: "artifacts/runtime-timeout-heartbeat/latest/runtime-timeout-heartbeat.json",
  runtimeControlCommandsPath: "artifacts/runtime-control-commands/latest/runtime-control-commands.json",
  protectedFileGatePath: "artifacts/protected-file-gate/latest/protected-file-gate.json",
  canonicalTestRunnerPath: "artifacts/canonical-test-runner/latest/canonical-test-runner.json",
  runtimeApiDashboardPath: "artifacts/runtime-api-dashboard/latest/runtime-api-dashboard.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  packagePath: "package.json",
  reviewApiPath: "src/review-api.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const RUNTIME_FREEZE_CONTRACT_ID = "runtime-freeze.v1";
const SOURCE_OF_TRUTH = "runtime_adapter_artifacts_agent_run_ledger_gates_and_runtime_api_dashboard";
const DESKTOP_SURFACE_POLICY = "read_only_runtime_operations_dashboard";
const REPRESENTATIVE_RUNTIME_IDS = ["hermes", "codex", "local_script"];

const SOURCE_DEFINITIONS = [
  sourceDefinition("runtime_agentrun_contract_freeze", "Runtime/AgentRun Contract Freeze", "runtime_agent_run_contract_freeze_path", "P104", "contract", "freeze_status", "complete"),
  sourceDefinition("runtime_adapter_interface_v2", "Runtime Adapter Interface v2", "runtime_adapter_interface_v2_path", "P195", "adapter", "runtime_adapter_interface_status", "complete"),
  sourceDefinition("hermes_runtime_adapter", "Hermes Runtime Adapter", "hermes_runtime_adapter_path", "P196", "adapter", "hermes_runtime_adapter_status", "complete"),
  sourceDefinition("claude_code_adapter_contract", "Claude Code Adapter Contract", "claude_code_adapter_contract_path", "P197", "adapter", "claude_code_adapter_contract_status", "complete"),
  sourceDefinition("codex_adapter_contract", "Codex Adapter Contract", "codex_adapter_contract_path", "P198", "adapter", "codex_adapter_contract_status", "complete"),
  sourceDefinition("local_script_adapter", "Local Script Adapter", "local_script_adapter_path", "P199", "adapter", "local_script_adapter_status", "complete"),
  sourceDefinition("document_renderer_adapter", "Document Renderer Adapter", "document_renderer_adapter_path", "P200", "adapter", "document_renderer_adapter_status", "complete"),
  sourceDefinition("worktree_manager_v2", "Worktree Manager v2", "worktree_manager_v2_path", "P201", "runtime_boundary", "worktree_manager_v2_status", "complete"),
  sourceDefinition("sandbox_policy_model", "Sandbox Policy Model", "sandbox_policy_model_path", "P202", "runtime_boundary", "sandbox_policy_model_status", "complete"),
  sourceDefinition("docker_local_backend_selector", "Docker/local Backend Selector", "docker_local_backend_selector_path", "P203", "runtime_boundary", "docker_local_backend_selector_status", "complete"),
  sourceDefinition("secrets_broker_contract", "Secrets Broker Contract", "secrets_broker_contract_path", "P204", "runtime_boundary", "secrets_broker_contract_status", "complete"),
  sourceDefinition("runtime_artifact_capture", "Runtime Artifact Capture", "runtime_artifact_capture_path", "P205", "capture", "runtime_artifact_capture_status", "complete"),
  sourceDefinition("runtime_log_normalization", "Runtime Log Normalization", "runtime_log_normalization_path", "P206", "capture", "runtime_log_normalization_status", "complete"),
  sourceDefinition("runtime_timeout_heartbeat", "Runtime Timeout/Heartbeat", "runtime_timeout_heartbeat_path", "P207", "lifecycle", "runtime_timeout_heartbeat_status", "complete"),
  sourceDefinition("runtime_control_commands", "Runtime Control Commands", "runtime_control_commands_path", "P208", "control", "runtime_control_command_status", "complete"),
  sourceDefinition("protected_file_gate", "Protected File Gate", "protected_file_gate_path", "P209", "gate", "protected_file_gate_status", "complete"),
  sourceDefinition("canonical_test_runner", "Canonical Test Runner", "canonical_test_runner_path", "P210", "gate", "canonical_test_runner_status", "complete"),
  sourceDefinition("runtime_api_dashboard", "Runtime API Dashboard", "runtime_api_dashboard_path", "P211", "api", "runtime_api_dashboard_status", "complete"),
  sourceDefinition("workflow_run_ledger", "Workflow Run Ledger", "workflow_run_ledger_path", "P163", "ledger", "workflow_run_ledger_status", "complete"),
  sourceDefinition("agent_run_ledger", "Agent Run Ledger", "agent_run_ledger_path", "P164", "ledger", "agent_run_ledger_status", "complete"),
  sourceDefinition("audit_event_ledger", "Audit Event Ledger", "audit_event_ledger_path", "P166", "ledger", "audit_event_ledger_status", "complete"),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "control_plane_loop_path", "P212", "control_plane", "loop_status", "passed"),
];

const LOOP_BINDING_STEP_IDS = [
  "runtime_adapter_interface_v2",
  "hermes_runtime_adapter",
  "claude_code_adapter_contract",
  "codex_adapter_contract",
  "local_script_adapter",
  "document_renderer_adapter",
  "worktree_manager_v2",
  "sandbox_policy_model",
  "docker_local_backend_selector",
  "secrets_broker_contract",
  "runtime_artifact_capture",
  "runtime_log_normalization",
  "runtime_timeout_heartbeat",
  "runtime_control_commands",
  "protected_file_gate",
  "canonical_test_runner",
  "runtime_api_dashboard",
];

export async function runRuntimeFreeze(options = {}) {
  const result = await buildRuntimeFreeze(options);
  if (options.write !== false) await writeRuntimeFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSources(inputs);
  const supportSources = {
    package_json: await readJsonOrError(inputs.package_path),
    review_api_source: await readTextOrError(inputs.review_api_path),
    review_dashboard_source: await readTextOrError(inputs.review_dashboard_path),
    roadmap_source: await readTextOrError(inputs.roadmap_path),
    desktop_companion_integration: await readTextOrError(inputs.desktop_companion_integration_path),
  };
  const artifacts = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const runtimeFreezeSources = sourceReads.map((source) => buildRuntimeFreezeSource(source));
  const runtimeFreezeSlices = buildRuntimeFreezeSlices(artifacts, generatedAt);
  const runtimeFreezeLoopBindings = buildRuntimeFreezeLoopBindings(artifacts.control_plane_loop, generatedAt);
  const runtimeFreezeCheckpoints = buildRuntimeFreezeCheckpoints({
    artifacts,
    runtimeFreezeSources,
    runtimeFreezeSlices,
    runtimeFreezeLoopBindings,
    supportSources,
  });
  const validationItems = runtimeFreezeCheckpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeRuntimeFreeze({
    runtimeFreezeSources,
    runtimeFreezeSlices,
    runtimeFreezeLoopBindings,
    runtimeFreezeCheckpoints,
    artifacts,
    supportSources,
    validation,
  });
  const result = {
    schema_version: RUNTIME_FREEZE_CONTRACT_ID,
    generated_at: generatedAt,
    runtime_freeze_id: `runtime-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    runtime_freeze_status: summary.runtime_freeze_status,
    safe_handling: buildSafeHandling(),
    freeze_scope: {
      track: "Runtime Adapter, Sandbox, Worktree, Secrets",
      frozen_slots: ["P195", "P196", "P197", "P198", "P199", "P200", "P201", "P202", "P203", "P204", "P205", "P206", "P207", "P208", "P209", "P210", "P211", "P212"],
      source_phase_range: "Phase 195-211",
      representative_runtime_ids: REPRESENTATIVE_RUNTIME_IDS,
      next_planned_slot: "P213",
      next_track: "Personal Dev Domain Pack",
    },
    inputs,
    source_contracts: buildSourceContracts(sourceReads, supportSources),
    runtime_freeze_contract: buildRuntimeFreezeContract(generatedAt),
    runtime_freeze_sources: runtimeFreezeSources,
    runtime_freeze_slices: runtimeFreezeSlices,
    runtime_freeze_loop_bindings: runtimeFreezeLoopBindings,
    runtime_freeze_checkpoints: runtimeFreezeCheckpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderRuntimeFreezeMarkdown(result),
  };
}

export async function writeRuntimeFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "runtime-freeze.json"), serializableRuntimeFreeze(result));
  await writeJson(path.join(outDir, "runtime-freeze-sources.json"), {
    schema_version: "runtime-freeze-sources.v1",
    generated_at: result.generated_at,
    runtime_freeze_source_count: result.runtime_freeze_sources.length,
    runtime_freeze_sources: result.runtime_freeze_sources,
  });
  await writeJson(path.join(outDir, "runtime-freeze-slices.json"), {
    schema_version: "runtime-freeze-slices.v1",
    generated_at: result.generated_at,
    runtime_freeze_slice_count: result.runtime_freeze_slices.length,
    runtime_freeze_slices: result.runtime_freeze_slices,
  });
  await writeJson(path.join(outDir, "runtime-freeze-loop-bindings.json"), {
    schema_version: "runtime-freeze-loop-bindings.v1",
    generated_at: result.generated_at,
    runtime_freeze_loop_binding_count: result.runtime_freeze_loop_bindings.length,
    runtime_freeze_loop_bindings: result.runtime_freeze_loop_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "runtime-freeze-validation-report.v1",
    generated_at: result.generated_at,
    runtime_freeze_id: result.runtime_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runRuntimeFreeze(args);
    console.log(`Runtime freeze written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.runtime_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_source_count}/${result.summary.runtime_freeze_source_count}`);
    console.log(`Runtime slices: ${result.summary.passed_runtime_slice_count}/${result.summary.runtime_freeze_slice_count}`);
    console.log(`Loop bindings: ${result.summary.passed_loop_binding_count}/${result.summary.runtime_freeze_loop_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRuntimeFreezeContract(generatedAt) {
  return {
    schema_version: "runtime-freeze-contract.v1",
    runtime_freeze_contract_id: RUNTIME_FREEZE_CONTRACT_ID,
    generated_at: generatedAt,
    freeze_scope: "runtime_adapter_sandbox_worktree_secrets",
    source_of_truth: SOURCE_OF_TRUTH,
    representative_runtime_ids: REPRESENTATIVE_RUNTIME_IDS,
    acceptance_rule: "Hermes, Codex, and local_script representative runtime slices must pass adapter, gate, capture, lifecycle, ledger, and Desktop read-only checks.",
    desktop_companion_rule: "Desktop Companion is an operator surface only; it can read runtime status and draft protected requests, but it cannot execute runtimes, control processes, run tests, read secrets, or become source of truth.",
    mutation_policy: "read_only_freeze_no_runtime_execution",
  };
}

function buildSafeHandling() {
  return {
    freeze_report_only: true,
    source_artifact_mutation_allowed: false,
    protected_actions_executed: false,
    runtime_execution_performed: false,
    runtime_process_control_executed: false,
    canonical_test_execution_performed_by_freeze: false,
    external_runtime_call_executed: false,
    external_delivery_executed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
  };
}

function buildRuntimeFreezeSlices(artifacts, generatedAt) {
  const agentRuns = artifacts.agent_run_ledger?.agent_run_catalog?.agent_run_records ?? [];
  return [
    buildHermesRuntimeSlice(artifacts, agentRuns, generatedAt),
    buildCodexRuntimeSlice(artifacts, agentRuns, generatedAt),
    buildLocalScriptRuntimeSlice(artifacts, agentRuns, generatedAt),
  ];
}

function buildHermesRuntimeSlice(artifacts, agentRuns, generatedAt) {
  const adapter = artifacts.hermes_runtime_adapter?.summary ?? {};
  const checks = {
    adapter_complete: adapter.hermes_runtime_adapter_status === "complete",
    adapter_locked: adapter.adapter_status === "locked",
    command_binding_declared: adapter.hermes_command_binding_declared === true,
    agent_run_ledger_bound: adapter.agent_run_ledger_bound === true,
    output_capture_ready: adapter.output_capture_ready === true,
    log_capture_ready: adapter.log_capture_ready === true,
    artifact_capture_ready: adapter.artifact_capture_ready === true,
    verification_capture_ready: adapter.verification_capture_ready === true,
    human_gate_required: adapter.execute_requires_human_gate === true,
    external_call_without_gate_blocked: adapter.external_runtime_call_allowed_without_gate === false,
    desktop_boundary_locked: adapter.desktop_read_only === true && adapter.desktop_mutation_allowed === false && adapter.desktop_runtime_source_of_truth === false,
  };
  return runtimeSlice({
    generatedAt,
    runtimeId: "hermes",
    sliceKind: "adapter_readiness",
    adapterSourceId: "hermes_runtime_adapter",
    agentRunCount: countRuntime(agentRuns, "hermes"),
    agentRunRequired: false,
    adapterStatus: adapter.adapter_status ?? "unknown",
    ledgerBindingStatus: adapter.agent_run_ledger_bound === true ? "bound" : "missing",
    agentRunLedgerStatus: adapter.agent_run_ledger_status ?? "unknown",
    artifactCaptureStatus: allTrue(adapter.output_capture_ready, adapter.artifact_capture_ready, adapter.verification_capture_ready) ? "ready" : "attention",
    logCaptureStatus: adapter.log_capture_ready === true ? "ready" : "attention",
    lifecycleStatus: "human_gate_required_before_external_runtime_call",
    controlRequestStatus: "protected_request_only",
    gateStatus: adapter.execute_requires_human_gate === true ? "passed_human_gate_required" : "failed_human_gate_missing",
    canonicalTestStatus: "not_applicable_no_diff",
    humanGateRequired: true,
    protectedFileGateRequired: false,
    diffReviewGateRequired: false,
    testGateRequired: false,
    directApplyAllowed: false,
    directMergeAllowed: false,
    protectedPathWriteAllowed: false,
    desktopReadOnly: adapter.desktop_read_only === true,
    desktopMutationAllowed: adapter.desktop_mutation_allowed === true,
    checks,
    freezeNote: "Hermes runtime is frozen as an adapter-ready external runtime lane; no Hermes process is launched by the freeze and execution remains human-gated.",
  });
}

function buildCodexRuntimeSlice(artifacts, agentRuns, generatedAt) {
  const adapter = artifacts.codex_adapter_contract?.summary ?? {};
  const artifactCapture = artifacts.runtime_artifact_capture?.summary ?? {};
  const protectedGate = artifacts.protected_file_gate?.summary ?? {};
  const canonical = artifacts.canonical_test_runner?.summary ?? {};
  const records = agentRuns.filter((record) => record.runtime_id === "codex");
  const checks = {
    adapter_complete: adapter.codex_adapter_contract_status === "complete",
    adapter_locked: adapter.adapter_status === "locked",
    agent_run_present: records.length > 0,
    agent_run_completed: records.every((record) => record.status === "completed"),
    agent_run_ledger_bound: adapter.agent_run_ledger_bound === true,
    diff_capture_bound: (artifactCapture.by_runtime_id?.codex ?? 0) > 0,
    protected_gate_complete: protectedGate.protected_file_gate_status === "complete",
    protected_file_gate_required: adapter.protected_file_gate_required === true,
    test_gate_required: adapter.test_gate_required === true,
    canonical_tests_passed: canonical.canonical_test_runner_status === "complete" && (canonical.by_runtime_id?.codex ?? 0) > 0 && canonical.failed_execution_count === 0,
    direct_apply_blocked: adapter.direct_apply_allowed === false && canonical.direct_apply_allowed_count === 0,
    direct_merge_blocked: adapter.direct_merge_allowed === false && canonical.direct_merge_allowed_count === 0,
    protected_write_blocked: adapter.protected_path_write_allowed === false,
    desktop_boundary_locked: adapter.desktop_read_only === true && adapter.desktop_mutation_allowed === false && adapter.desktop_runtime_source_of_truth === false,
  };
  return runtimeSlice({
    generatedAt,
    runtimeId: "codex",
    sliceKind: "patch_review_gate",
    adapterSourceId: "codex_adapter_contract",
    agentRunCount: records.length,
    agentRunRequired: true,
    adapterStatus: adapter.adapter_status ?? "unknown",
    ledgerBindingStatus: adapter.agent_run_ledger_bound === true ? "bound" : "missing",
    agentRunLedgerStatus: adapter.agent_run_ledger_status ?? "unknown",
    artifactCaptureStatus: checks.diff_capture_bound ? "bound" : "missing",
    logCaptureStatus: "captured",
    lifecycleStatus: "terminal_completed",
    controlRequestStatus: "protected_request_only",
    gateStatus: checks.protected_gate_complete ? "passed_with_protected_gate" : "failed",
    canonicalTestStatus: checks.canonical_tests_passed ? "passed" : "failed",
    humanGateRequired: adapter.human_review_required === true,
    protectedFileGateRequired: adapter.protected_file_gate_required === true,
    diffReviewGateRequired: adapter.diff_review_gate_required === true,
    testGateRequired: adapter.test_gate_required === true,
    directApplyAllowed: adapter.direct_apply_allowed === true,
    directMergeAllowed: adapter.direct_merge_allowed === true,
    protectedPathWriteAllowed: adapter.protected_path_write_allowed === true,
    desktopReadOnly: adapter.desktop_read_only === true,
    desktopMutationAllowed: adapter.desktop_mutation_allowed === true,
    checks,
    freezeNote: "Codex patch output is frozen as an untrusted PR/diff lane: protected-file gate, canonical tests, and human review are required before any apply or merge.",
  });
}

function buildLocalScriptRuntimeSlice(artifacts, agentRuns, generatedAt) {
  const adapter = artifacts.local_script_adapter?.summary ?? {};
  const artifactCapture = artifacts.runtime_artifact_capture?.summary ?? {};
  const logNormalization = artifacts.runtime_log_normalization?.summary ?? {};
  const timeoutHeartbeat = artifacts.runtime_timeout_heartbeat?.summary ?? {};
  const controlCommands = artifacts.runtime_control_commands?.summary ?? {};
  const records = agentRuns.filter((record) => record.runtime_id === "local_script");
  const checks = {
    adapter_complete: adapter.local_script_adapter_status === "complete",
    adapter_locked: adapter.adapter_status === "locked",
    execution_contracts_locked: adapter.execution_contract_count === adapter.execution_contract_locked_count,
    deterministic_validation_ready: adapter.deterministic_validation_ready_count === adapter.execution_contract_count,
    agent_runs_present: records.length >= 3,
    agent_runs_completed: records.every((record) => record.status === "completed"),
    generated_artifacts_bound: (artifactCapture.by_runtime_id?.local_script ?? 0) >= records.length,
    logs_indexed: (logNormalization.by_runtime_id?.local_script ?? 0) >= records.length,
    lifecycle_terminal: timeoutHeartbeat.timed_out_count === 0 && timeoutHeartbeat.timeout_action_required_count === 0,
    control_not_executed: controlCommands.execution_performed_count === 0 && controlCommands.runtime_process_control_allowed_count === 0,
    sandbox_locked: adapter.sandbox_required === true && adapter.workspace_isolation_type === "temp_dir",
    network_blocked: adapter.network_access_allowed === false && adapter.external_execution_allowed === false,
    direct_delivery_blocked: adapter.direct_final_delivery_allowed === false,
    desktop_boundary_locked: adapter.desktop_read_only === true && adapter.desktop_mutation_allowed === false && adapter.desktop_runtime_source_of_truth === false,
  };
  return runtimeSlice({
    generatedAt,
    runtimeId: "local_script",
    sliceKind: "deterministic_script",
    adapterSourceId: "local_script_adapter",
    agentRunCount: records.length,
    agentRunRequired: true,
    adapterStatus: adapter.adapter_status ?? "unknown",
    ledgerBindingStatus: adapter.agent_run_ledger_bound === true ? "bound" : "missing",
    agentRunLedgerStatus: adapter.agent_run_ledger_status ?? "unknown",
    artifactCaptureStatus: checks.generated_artifacts_bound ? "bound" : "missing",
    logCaptureStatus: checks.logs_indexed ? "captured_and_indexed" : "attention",
    lifecycleStatus: checks.lifecycle_terminal ? "terminal_within_timeout" : "attention",
    controlRequestStatus: checks.control_not_executed ? "recorded_not_executed" : "attention",
    gateStatus: adapter.gate_binding_status ?? "unknown",
    canonicalTestStatus: "not_applicable_deterministic_validation",
    humanGateRequired: adapter.human_review_required === true,
    protectedFileGateRequired: adapter.protected_file_gate_required === true,
    diffReviewGateRequired: false,
    testGateRequired: adapter.test_gate_required === true,
    directApplyAllowed: false,
    directMergeAllowed: false,
    protectedPathWriteAllowed: adapter.protected_path_write_allowed === true,
    desktopReadOnly: adapter.desktop_read_only === true,
    desktopMutationAllowed: adapter.desktop_mutation_allowed === true,
    checks,
    freezeNote: "Local script runtime is frozen as deterministic, sandboxed, network-disabled execution with captured artifacts/logs and human review before final delivery.",
  });
}

function runtimeSlice({
  generatedAt,
  runtimeId,
  sliceKind,
  adapterSourceId,
  agentRunCount,
  agentRunRequired,
  adapterStatus,
  ledgerBindingStatus,
  agentRunLedgerStatus,
  artifactCaptureStatus,
  logCaptureStatus,
  lifecycleStatus,
  controlRequestStatus,
  gateStatus,
  canonicalTestStatus,
  humanGateRequired,
  protectedFileGateRequired,
  diffReviewGateRequired,
  testGateRequired,
  directApplyAllowed,
  directMergeAllowed,
  protectedPathWriteAllowed,
  desktopReadOnly,
  desktopMutationAllowed,
  checks,
  freezeNote,
}) {
  const passed = Object.values(checks).every(Boolean)
    && (!agentRunRequired || agentRunCount > 0)
    && directApplyAllowed === false
    && directMergeAllowed === false
    && protectedPathWriteAllowed === false
    && desktopReadOnly === true
    && desktopMutationAllowed === false;
  const slice = {
    schema_version: "runtime-freeze-slice.v1",
    runtime_freeze_slice_id: `runtime-freeze-slice.${runtimeId}.${sliceKind}`,
    runtime_id: runtimeId,
    slice_kind: sliceKind,
    adapter_source_id: adapterSourceId,
    agent_run_count: agentRunCount,
    agent_run_required: agentRunRequired,
    adapter_status: adapterStatus,
    ledger_binding_status: ledgerBindingStatus,
    agent_run_ledger_status: agentRunLedgerStatus,
    artifact_capture_status: artifactCaptureStatus,
    log_capture_status: logCaptureStatus,
    lifecycle_status: lifecycleStatus,
    control_request_status: controlRequestStatus,
    gate_status: gateStatus,
    canonical_test_status: canonicalTestStatus,
    human_gate_required: humanGateRequired,
    protected_file_gate_required: protectedFileGateRequired,
    diff_review_gate_required: diffReviewGateRequired,
    test_gate_required: testGateRequired,
    direct_apply_allowed: directApplyAllowed,
    direct_merge_allowed: directMergeAllowed,
    protected_path_write_allowed: protectedPathWriteAllowed,
    desktop_read_only: desktopReadOnly,
    desktop_mutation_allowed: desktopMutationAllowed,
    desktop_runtime_execution_allowed: false,
    desktop_runtime_control_allowed: false,
    desktop_source_of_truth: false,
    pass_checks: checks,
    runtime_freeze_slice_status: passed ? "passed" : "failed",
    freeze_note: freezeNote,
    recorded_at: generatedAt,
  };
  return {
    ...slice,
    runtime_freeze_slice_hash: hashObject(slice),
  };
}

function buildRuntimeFreezeLoopBindings(controlPlaneLoop, generatedAt) {
  const stepResults = controlPlaneLoop?.step_results ?? [];
  return LOOP_BINDING_STEP_IDS.map((stepId) => {
    const step = stepResults.find((candidate) => candidate.step_id === stepId);
    const binding = {
      schema_version: "runtime-freeze-loop-binding.v1",
      runtime_freeze_loop_binding_id: `runtime-freeze-loop-binding.${stepId}`,
      loop_step_id: stepId,
      loop_step_label: step?.label ?? stepId,
      loop_category: step?.category ?? null,
      loop_status: step?.status ?? "missing",
      command: step?.command ?? null,
      artifact_paths: step?.artifact_paths ?? [],
      artifact_missing_count: step?.missing_artifact_paths?.length ?? 0,
      protected_action_count: step?.protected_action_count ?? 0,
      runtime_freeze_loop_binding_status: step?.status === "passed" ? "passed" : "failed",
      recorded_at: generatedAt,
    };
    return {
      ...binding,
      runtime_freeze_loop_binding_hash: hashObject(binding),
    };
  });
}

function buildRuntimeFreezeCheckpoints({ artifacts, runtimeFreezeSources, runtimeFreezeSlices, runtimeFreezeLoopBindings, supportSources }) {
  const apiSummary = artifacts.runtime_api_dashboard?.summary ?? {};
  const controlSummary = artifacts.runtime_control_commands?.summary ?? {};
  const secretSummary = artifacts.secrets_broker_contract?.summary ?? {};
  const sourcePassed = runtimeFreezeSources.every((source) => source.runtime_freeze_source_status === "passed");
  const slicesPassed = runtimeFreezeSlices.every((slice) => slice.runtime_freeze_slice_status === "passed");
  const loopPassed = runtimeFreezeLoopBindings.every((binding) => binding.runtime_freeze_loop_binding_status === "passed");
  const desktopSafe = apiSummary.desktop_read_only === true
    && apiSummary.desktop_mutation_allowed === false
    && apiSummary.desktop_protected_mutation_execution_allowed === false
    && apiSummary.desktop_runtime_source_of_truth === false
    && apiSummary.desktop_runtime_execution_allowed === false
    && apiSummary.desktop_runtime_control_allowed === false
    && apiSummary.desktop_test_execution_allowed === false
    && apiSummary.desktop_secret_material_exposed === false
    && apiSummary.desktop_provider_key_visible === false
    && apiSummary.desktop_installer_or_gateway_control === false
    && apiSummary.desktop_ssh_or_cron_control === false;
  return [
    checkpoint("runtime_sources_passed", sourcePassed, `${runtimeFreezeSources.filter((source) => source.runtime_freeze_source_status === "passed").length}/${runtimeFreezeSources.length} runtime source artifact(s) passed.`),
    checkpoint("representative_runtime_slices_passed", slicesPassed, `${runtimeFreezeSlices.filter((slice) => slice.runtime_freeze_slice_status === "passed").length}/${runtimeFreezeSlices.length} representative runtime slice(s) passed.`),
    checkpoint("runtime_loop_bindings_passed", loopPassed, `${runtimeFreezeLoopBindings.filter((binding) => binding.runtime_freeze_loop_binding_status === "passed").length}/${runtimeFreezeLoopBindings.length} runtime control-plane loop step(s) passed.`),
    checkpoint("runtime_api_dashboard_locked", apiSummary.runtime_api_dashboard_status === "complete" && apiSummary.validation_error_count === 0 && apiSummary.mutation_route_count === 0, "Runtime API Dashboard is complete, validation-clean, and mutation-free."),
    checkpoint("desktop_companion_boundary_locked", desktopSafe, "Desktop Companion remains read-only and cannot execute runtimes, control processes, run tests, expose secrets, or become source of truth."),
    checkpoint("runtime_control_no_execution", controlSummary.execution_performed_count === 0 && controlSummary.runtime_process_control_allowed_count === 0 && controlSummary.protected_action_executed_count === 0, "Runtime control commands are recorded as protected request receipts and no process control was executed."),
    checkpoint("secret_surface_sealed", (secretSummary.raw_secret_material_exposed_count ?? 0) === 0 && (secretSummary.provider_key_exposed_count ?? 0) === 0 && secretSummary.desktop_read_only === true, "Secrets broker exposes handles and audit receipts only, with no raw secret or provider key material."),
    checkpoint("support_surfaces_present", supportSources.review_api_source.available && supportSources.review_dashboard_source.available && supportSources.desktop_companion_integration.available, "Review API, dashboard, and Desktop Companion integration docs are available for the freeze boundary."),
  ];
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "runtime-freeze-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    passed,
    message,
  };
}

function summarizeRuntimeFreeze({ runtimeFreezeSources, runtimeFreezeSlices, runtimeFreezeLoopBindings, runtimeFreezeCheckpoints, artifacts, supportSources, validation }) {
  const apiSummary = artifacts.runtime_api_dashboard?.summary ?? {};
  const controlSummary = artifacts.runtime_control_commands?.summary ?? {};
  const protectedSummary = artifacts.protected_file_gate?.summary ?? {};
  const canonicalSummary = artifacts.canonical_test_runner?.summary ?? {};
  const secretSummary = artifacts.secrets_broker_contract?.summary ?? {};
  const passedSourceCount = runtimeFreezeSources.filter((source) => source.runtime_freeze_source_status === "passed").length;
  const passedSliceCount = runtimeFreezeSlices.filter((slice) => slice.runtime_freeze_slice_status === "passed").length;
  const passedLoopBindingCount = runtimeFreezeLoopBindings.filter((binding) => binding.runtime_freeze_loop_binding_status === "passed").length;
  const passedCheckpointCount = runtimeFreezeCheckpoints.filter((checkpointItem) => checkpointItem.status === "passed").length;
  const validationErrorCount = validation.errors.length;
  return {
    runtime_freeze_status: passedSourceCount === runtimeFreezeSources.length
      && passedSliceCount === runtimeFreezeSlices.length
      && passedLoopBindingCount === runtimeFreezeLoopBindings.length
      && passedCheckpointCount === runtimeFreezeCheckpoints.length
      && validationErrorCount === 0
      ? "complete"
      : "blocked",
    runtime_freeze_contract_id: RUNTIME_FREEZE_CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    runtime_freeze_source_count: runtimeFreezeSources.length,
    passed_source_count: passedSourceCount,
    failed_source_count: runtimeFreezeSources.length - passedSourceCount,
    runtime_freeze_slice_count: runtimeFreezeSlices.length,
    passed_runtime_slice_count: passedSliceCount,
    failed_runtime_slice_count: runtimeFreezeSlices.length - passedSliceCount,
    representative_runtime_count: REPRESENTATIVE_RUNTIME_IDS.length,
    hermes_slice_status: runtimeFreezeSlices.find((slice) => slice.runtime_id === "hermes")?.runtime_freeze_slice_status ?? "missing",
    codex_slice_status: runtimeFreezeSlices.find((slice) => slice.runtime_id === "codex")?.runtime_freeze_slice_status ?? "missing",
    local_script_slice_status: runtimeFreezeSlices.find((slice) => slice.runtime_id === "local_script")?.runtime_freeze_slice_status ?? "missing",
    runtime_freeze_loop_binding_count: runtimeFreezeLoopBindings.length,
    passed_loop_binding_count: passedLoopBindingCount,
    failed_loop_binding_count: runtimeFreezeLoopBindings.length - passedLoopBindingCount,
    runtime_freeze_checkpoint_count: runtimeFreezeCheckpoints.length,
    passed_checkpoint_count: passedCheckpointCount,
    failed_checkpoint_count: runtimeFreezeCheckpoints.length - passedCheckpointCount,
    runtime_api_dashboard_status: apiSummary.runtime_api_dashboard_status ?? "unknown",
    runtime_api_dashboard_validation_error_count: apiSummary.validation_error_count ?? 0,
    runtime_api_mutation_route_count: apiSummary.mutation_route_count ?? 0,
    runtime_api_missing_route_count: apiSummary.missing_route_count ?? 0,
    runtime_control_execution_performed_count: controlSummary.execution_performed_count ?? 0,
    runtime_process_control_allowed_count: controlSummary.runtime_process_control_allowed_count ?? 0,
    protected_action_executed_count: controlSummary.protected_action_executed_count ?? 0,
    protected_file_blocked_before_approval_count: protectedSummary.blocked_before_approval_count ?? 0,
    canonical_test_passed_execution_count: canonicalSummary.passed_execution_count ?? 0,
    canonical_test_failed_execution_count: canonicalSummary.failed_execution_count ?? 0,
    raw_secret_material_exposed_count: secretSummary.raw_secret_material_exposed_count ?? 0,
    provider_key_exposed_count: secretSummary.provider_key_exposed_count ?? 0,
    desktop_read_only: apiSummary.desktop_read_only ?? false,
    desktop_mutation_allowed: apiSummary.desktop_mutation_allowed ?? true,
    desktop_protected_mutation_execution_allowed: apiSummary.desktop_protected_mutation_execution_allowed ?? true,
    desktop_runtime_source_of_truth: apiSummary.desktop_runtime_source_of_truth ?? true,
    desktop_runtime_execution_allowed: apiSummary.desktop_runtime_execution_allowed ?? true,
    desktop_runtime_control_allowed: apiSummary.desktop_runtime_control_allowed ?? true,
    desktop_test_execution_allowed: apiSummary.desktop_test_execution_allowed ?? true,
    desktop_secret_material_exposed: apiSummary.desktop_secret_material_exposed ?? true,
    desktop_provider_key_visible: apiSummary.desktop_provider_key_visible ?? true,
    desktop_installer_or_gateway_control: apiSummary.desktop_installer_or_gateway_control ?? true,
    desktop_ssh_or_cron_control: apiSummary.desktop_ssh_or_cron_control ?? true,
    review_api_available: supportSources.review_api_source.available,
    review_dashboard_available: supportSources.review_dashboard_source.available,
    desktop_companion_doc_available: supportSources.desktop_companion_integration.available,
    validation_item_count: validation.item_count,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validationErrorCount,
    by_source_group: countBy(runtimeFreezeSources, "source_group"),
    by_slice_status: countBy(runtimeFreezeSlices, "runtime_freeze_slice_status"),
  };
}

function buildRuntimeFreezeSource(source) {
  const validationErrorCount = source.value?.summary?.validation_error_count
    ?? source.value?.validation?.errors?.length
    ?? 0;
  const observedStatus = source.value ? readStatus(source.value, source.status_key) : "missing";
  const passed = source.available
    && observedStatus === source.expected_status
    && validationErrorCount === 0;
  return {
    schema_version: "runtime-freeze-source.v1",
    source_id: source.source_id,
    label: source.label,
    planned_slot: source.planned_slot,
    source_group: source.source_group,
    path: source.path,
    available: source.available,
    source_schema_version: source.value?.schema_version ?? null,
    generated_at: source.value?.generated_at ?? null,
    status_key: source.status_key,
    expected_status: source.expected_status,
    observed_status: observedStatus,
    validation_error_count: validationErrorCount,
    runtime_freeze_source_status: passed ? "passed" : "failed",
    content_hash: source.content_hash,
    error: source.error,
  };
}

function buildSourceContracts(sourceReads, supportSources) {
  const contracts = {};
  for (const source of sourceReads) {
    contracts[source.source_id] = {
      schema_version: source.value?.schema_version ?? null,
      status: source.value ? readStatus(source.value, source.status_key) : "missing",
      validation_error_count: source.value?.summary?.validation_error_count ?? source.value?.validation?.errors?.length ?? 0,
      generated_at: source.value?.generated_at ?? null,
      content_hash: source.content_hash,
    };
  }
  for (const [sourceId, source] of Object.entries(supportSources)) {
    contracts[sourceId] = {
      schema_version: source.value?.schema_version ?? null,
      status: source.available ? "available" : "missing",
      validation_error_count: 0,
      generated_at: source.value?.generated_at ?? null,
      content_hash: source.content_hash,
    };
  }
  return contracts;
}

async function readSources(inputs) {
  const sources = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const result = await readJsonOrError(inputs[definition.input_key]);
    sources.push({
      ...definition,
      path: inputs[definition.input_key],
      ...result,
    });
  }
  return sources;
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      available: true,
      value: JSON.parse(text),
      content_hash: `sha256:${hashText(text)}`,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      value: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFile(filePath, "utf8");
    return {
      available: true,
      value: text,
      content_hash: `sha256:${hashText(text)}`,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      value: null,
      content_hash: null,
      error: error.message,
    };
  }
}

function readStatus(artifact, statusKey) {
  if (!artifact || !statusKey) return "available";
  return artifact.summary?.[statusKey] ?? artifact[statusKey] ?? artifact.summary?.overall_status ?? "unknown";
}

function sourceDefinition(sourceId, label, inputKey, plannedSlot, sourceGroup, statusKey, expectedStatus) {
  return {
    source_id: sourceId,
    label,
    input_key: inputKey,
    planned_slot: plannedSlot,
    source_group: sourceGroup,
    status_key: statusKey,
    expected_status: expectedStatus,
  };
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, value] of Object.entries(DEFAULT_RUNTIME_FREEZE_INPUTS)) {
    const snakeKey = camelToSnake(key);
    normalized[snakeKey] = options[key] ?? options[snakeKey] ?? value;
  }
  return normalized;
}

function countRuntime(records, runtimeId) {
  return records.filter((record) => record.runtime_id === runtimeId).length;
}

function allTrue(...values) {
  return values.every((value) => value === true);
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed");
  return {
    valid: errors.length === 0,
    item_count: items.length,
    error_count: errors.length,
    errors: errors.map((item) => ({
      path: item.path,
      message: item.message,
    })),
  };
}

function renderRuntimeFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Runtime Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.runtime_freeze_status}`);
  lines.push("");
  lines.push(`- Sources: ${result.summary.passed_source_count}/${result.summary.runtime_freeze_source_count}`);
  lines.push(`- Runtime slices: ${result.summary.passed_runtime_slice_count}/${result.summary.runtime_freeze_slice_count}`);
  lines.push(`- Loop bindings: ${result.summary.passed_loop_binding_count}/${result.summary.runtime_freeze_loop_binding_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push(`- Desktop policy: ${result.summary.desktop_surface_policy}`);
  lines.push("");
  lines.push("## Representative Runtime Slices");
  lines.push("");
  for (const slice of result.runtime_freeze_slices) {
    lines.push(`- ${slice.runtime_id}: ${slice.runtime_freeze_slice_status} (${slice.slice_kind}) - ${slice.freeze_note}`);
  }
  lines.push("");
  lines.push("## Checkpoints");
  lines.push("");
  for (const checkpointItem of result.runtime_freeze_checkpoints) {
    lines.push(`- ${checkpointItem.checkpoint_id}: ${checkpointItem.status} - ${checkpointItem.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableRuntimeFreeze(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function writeJson(filePath, value) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashObject(value) {
  return hashText(JSON.stringify(value));
}

function hashText(text) {
  return createHash("sha256").update(text).digest("hex");
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/runtime-freeze.mjs [--check] [--out-dir DIR] [--run-at ISO]");
}
