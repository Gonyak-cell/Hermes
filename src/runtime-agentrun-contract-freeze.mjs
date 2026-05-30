import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_OUT_DIR = "artifacts/runtime-agentrun-contract-freeze/latest";
export const DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_INPUTS = {
  runtimeAdapterRegistryPath: "examples/core/runtime-adapters.json",
  runtimeCommandBindingsPath: "examples/core/runtime-command-bindings.json",
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  observabilityCatalogPath: "artifacts/observability/latest/observability-catalog.json",
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
};

const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const OUTPUT_TRUST_LEVELS = new Set(["trusted_after_deterministic_validation", "untrusted_until_verified", "draft_only", "human_attested"]);

export async function runRuntimeAgentRunContractFreeze(options = {}) {
  const result = await buildRuntimeAgentRunContractFreeze(options);
  if (options.write !== false) await writeRuntimeAgentRunContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime/AgentRun contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeAgentRunContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_OUT_DIR);
  const inputs = {
    runtime_adapter_registry_path: path.resolve(options.runtimeAdapterRegistryPath ?? DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_INPUTS.runtimeAdapterRegistryPath),
    runtime_command_bindings_path: path.resolve(options.runtimeCommandBindingsPath ?? DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_INPUTS.runtimeCommandBindingsPath),
    capability_workflow_contract_freeze_path: path.resolve(options.capabilityWorkflowContractFreezePath ?? DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_INPUTS.capabilityWorkflowContractFreezePath),
    observability_catalog_path: path.resolve(options.observabilityCatalogPath ?? DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_INPUTS.observabilityCatalogPath),
    output_artifact_catalog_path: path.resolve(options.outputArtifactCatalogPath ?? DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_INPUTS.outputArtifactCatalogPath),
  };

  const runtimeAdapterRegistry = await readJson(inputs.runtime_adapter_registry_path);
  const runtimeCommandBindings = await readJson(inputs.runtime_command_bindings_path);
  const capabilityWorkflowContractFreeze = await readJson(inputs.capability_workflow_contract_freeze_path);
  const observabilityCatalog = await readJson(inputs.observability_catalog_path);
  const outputArtifactCatalog = await readJson(inputs.output_artifact_catalog_path);

  const projection = projectRuntimeAgentRunContracts({
    runtimeAdapterRegistry,
    runtimeCommandBindings,
    capabilityWorkflowContractFreeze,
    observabilityCatalog,
    outputArtifactCatalog,
    generatedAt,
  });
  const validationItems = validateRuntimeAgentRunContracts({
    runtimeAdapterRegistry,
    runtimeCommandBindings,
    capabilityWorkflowContractFreeze,
    observabilityCatalog,
    outputArtifactCatalog,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "runtime-agentrun-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `runtime-agentrun-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      runtime_adapter_registry: {
        schema_version: runtimeAdapterRegistry.schema_version,
        registry_id: runtimeAdapterRegistry.registry_id,
        adapter_count: runtimeAdapterRegistry.adapters?.length ?? 0,
      },
      runtime_command_bindings: {
        schema_version: runtimeCommandBindings.schema_version,
        binding_registry_id: runtimeCommandBindings.binding_registry_id,
        binding_count: runtimeCommandBindings.bindings?.length ?? 0,
      },
      capability_workflow_contract_freeze: {
        schema_version: capabilityWorkflowContractFreeze.schema_version,
        freeze_id: capabilityWorkflowContractFreeze.freeze_id,
        freeze_status: capabilityWorkflowContractFreeze.summary?.freeze_status ?? null,
        agent_run_count: capabilityWorkflowContractFreeze.summary?.agent_run_count ?? 0,
      },
      observability_catalog: {
        schema_version: observabilityCatalog.schema_version,
        run_record_count: observabilityCatalog.run_records?.length ?? 0,
        agent_run_count: observabilityCatalog.summary?.agent_run_count ?? 0,
      },
      output_artifact_catalog: {
        schema_version: outputArtifactCatalog.schema_version,
        artifact_count: outputArtifactCatalog.summary?.artifact_count ?? 0,
      },
    },
    contract_versions: {
      runtime_adapter_schema_version: "runtime-adapter.v2",
      runtime_execution_contract_schema_version: "runtime-execution-contract.v2",
      agent_run_runtime_schema_version: "agent-run-runtime.v2",
      runtime_output_schema_version: "runtime-output-contract.v2",
      runtime_log_schema_version: "runtime-log-contract.v2",
      runtime_artifact_schema_version: "runtime-artifact-contract.v2",
      runtime_verification_schema_version: "runtime-verification-contract.v2",
      compatibility_floor: "runtime-adapter-registry.v1+capability-workflow-contract.v2",
    },
    field_requirements: buildFieldRequirements(),
    summary: summarizeFreeze(projection, validationItems, validation),
    runtime_agentrun_contract: {
      schema_version: "runtime-agentrun-contract.v2",
      generated_at: generatedAt,
      runtime_adapters: projection.runtimeAdaptersV2,
      runtime_execution_contracts: projection.runtimeExecutionContractsV2,
      agent_runs: projection.agentRunRuntimeContractsV2,
      runtime_outputs: projection.runtimeOutputContractsV2,
      runtime_logs: projection.runtimeLogContractsV2,
      runtime_artifacts: projection.runtimeArtifactContractsV2,
      runtime_verifications: projection.runtimeVerificationContractsV2,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderRuntimeAgentRunContractFreezeMarkdown(result),
  };
}

export async function writeRuntimeAgentRunContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "runtime-agentrun-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "runtime-adapter-v2-fixture.json"), {
    generated_at: result.generated_at,
    runtime_adapter_schema_version: result.contract_versions.runtime_adapter_schema_version,
    runtime_adapter_count: result.runtime_agentrun_contract.runtime_adapters.length,
    runtime_adapters: result.runtime_agentrun_contract.runtime_adapters,
  });
  await writeJson(path.join(outDir, "runtime-execution-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    runtime_execution_contract_schema_version: result.contract_versions.runtime_execution_contract_schema_version,
    runtime_execution_contract_count: result.runtime_agentrun_contract.runtime_execution_contracts.length,
    runtime_execution_contracts: result.runtime_agentrun_contract.runtime_execution_contracts,
  });
  await writeJson(path.join(outDir, "agent-run-runtime-v2-fixture.json"), {
    generated_at: result.generated_at,
    agent_run_runtime_schema_version: result.contract_versions.agent_run_runtime_schema_version,
    agent_run_count: result.runtime_agentrun_contract.agent_runs.length,
    agent_runs: result.runtime_agentrun_contract.agent_runs,
  });
  await writeJson(path.join(outDir, "runtime-output-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    runtime_output_schema_version: result.contract_versions.runtime_output_schema_version,
    runtime_output_count: result.runtime_agentrun_contract.runtime_outputs.length,
    runtime_outputs: result.runtime_agentrun_contract.runtime_outputs,
  });
  await writeJson(path.join(outDir, "runtime-log-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    runtime_log_schema_version: result.contract_versions.runtime_log_schema_version,
    runtime_log_count: result.runtime_agentrun_contract.runtime_logs.length,
    runtime_logs: result.runtime_agentrun_contract.runtime_logs,
  });
  await writeJson(path.join(outDir, "runtime-artifact-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    runtime_artifact_schema_version: result.contract_versions.runtime_artifact_schema_version,
    runtime_artifact_count: result.runtime_agentrun_contract.runtime_artifacts.length,
    runtime_artifacts: result.runtime_agentrun_contract.runtime_artifacts,
  });
  await writeJson(path.join(outDir, "runtime-verification-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    runtime_verification_schema_version: result.contract_versions.runtime_verification_schema_version,
    runtime_verification_count: result.runtime_agentrun_contract.runtime_verifications.length,
    runtime_verifications: result.runtime_agentrun_contract.runtime_verifications,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeAgentRunContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRuntimeAgentRunContractFreeze(args);
    console.log(`Runtime/AgentRun contract freeze written to ${result.output_dir}`);
    console.log(`Runtime adapters v2: ${result.summary.runtime_adapter_count}`);
    console.log(`AgentRun runtime v2: ${result.summary.agent_run_count}`);
    console.log(`Runtime outputs: ${result.summary.runtime_output_count}`);
    console.log(`Runtime logs captured: ${result.summary.agent_log_bound_count}/${result.summary.log_required_agent_run_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectRuntimeAgentRunContracts({
  runtimeAdapterRegistry,
  runtimeCommandBindings,
  capabilityWorkflowContractFreeze,
  observabilityCatalog,
  outputArtifactCatalog,
  generatedAt,
}) {
  const adapters = runtimeAdapterRegistry.adapters ?? [];
  const commandBindingsByRuntimeId = new Map((runtimeCommandBindings.bindings ?? []).map((binding) => [binding.runtime_id, binding]));
  const capabilityContract = capabilityWorkflowContractFreeze.capability_workflow_contract ?? {};
  const agentRuns = capabilityContract.agent_runs ?? [];
  const gateRuntimeContracts = capabilityContract.gate_runtime_contracts ?? [];
  const runRecords = observabilityCatalog.run_records ?? [];
  const outputArtifacts = outputArtifactCatalog.artifacts ?? outputArtifactCatalog.output_artifact_catalog?.output_artifacts ?? [];
  const adapterByRuntimeId = new Map(adapters.map((adapter) => [adapter.runtime_id, adapter]));

  const runtimeAdaptersV2 = adapters.map((adapter) => runtimeAdapterV2({
    adapter,
    commandBinding: commandBindingsByRuntimeId.get(adapter.runtime_id),
    agentRuns,
    gateRuntimeContracts,
    generatedAt,
  }));
  const runtimeExecutionContractsV2 = runtimeAdaptersV2.map((adapter) => runtimeExecutionContractV2(adapter, generatedAt));
  const artifactsByAgentRunId = buildArtifactsByAgentRunId(agentRuns, outputArtifacts);
  const runRecordByWorkflowRunId = new Map(runRecords.map((record) => [record.workflow_run_id, record]));

  const agentRunRuntimeContractsV2 = agentRuns.map((agentRun) => {
    const adapter = adapterByRuntimeId.get(agentRun.runtime_id);
    return agentRunRuntimeContractV2({
      agentRun,
      adapter,
      commandBinding: commandBindingsByRuntimeId.get(agentRun.runtime_id),
      artifacts: artifactsByAgentRunId.get(agentRun.agent_run_id) ?? [],
      runRecord: runRecordByWorkflowRunId.get(agentRun.workflow_run_id),
      generatedAt,
    });
  });
  const runtimeOutputContractsV2 = agentRunRuntimeContractsV2.map((agentRun) => runtimeOutputContractV2(agentRun, generatedAt));
  const runtimeLogContractsV2 = agentRunRuntimeContractsV2.map((agentRun) => runtimeLogContractV2(agentRun, generatedAt));
  const runtimeArtifactContractsV2 = agentRunRuntimeContractsV2.flatMap((agentRun) => runtimeArtifactContractsForAgentRun(agentRun, generatedAt));
  const runtimeVerificationContractsV2 = agentRunRuntimeContractsV2.map((agentRun) => runtimeVerificationContractV2(agentRun, generatedAt));

  return {
    runtimeAdaptersV2,
    runtimeExecutionContractsV2,
    agentRunRuntimeContractsV2,
    runtimeOutputContractsV2,
    runtimeLogContractsV2,
    runtimeArtifactContractsV2,
    runtimeVerificationContractsV2,
  };
}

function runtimeAdapterV2({ adapter, commandBinding, agentRuns, gateRuntimeContracts, generatedAt }) {
  const capabilityBindings = gateRuntimeContracts
    .filter((contract) => (contract.runtime_bindings ?? []).some((binding) => binding.runtime_id === adapter.runtime_id))
    .map((contract) => ({
      capability_id: contract.capability_id,
      domain_pack: contract.domain_pack,
      allowed_by_capability: true,
      required_gate_count: contract.required_gate_count ?? 0,
      human_review_gate_required: Boolean(contract.human_review_gate_required),
    }));
  return {
    schema_version: "runtime-adapter.v2",
    adapter_id: adapter.adapter_id,
    runtime_id: adapter.runtime_id,
    version: adapter.version,
    display_name: adapter.display_name,
    description: adapter.description,
    source_schema_version: adapter.schema_version,
    risk_level: adapter.risk_level,
    execution_environment: adapter.execution_environment,
    input_contract: {
      schema_version: "runtime-input-contract.v2",
      ...adapter.input_contract,
    },
    output_contract: {
      schema_version: "runtime-output-policy.v2",
      ...adapter.output_contract,
      output_hash_required: Boolean(adapter.observability?.output_hash_required),
    },
    workspace_policy: adapter.workspace_policy,
    tool_policy: adapter.tool_policy,
    lifecycle: adapter.lifecycle,
    observability: adapter.observability,
    verification: adapter.verification,
    data_access: adapter.data_access,
    command_binding: commandBinding ? {
      binding_id: commandBinding.binding_id,
      display_name: commandBinding.display_name,
      candidate_command_count: commandBinding.candidate_commands?.length ?? 0,
      prompt_delivery: commandBinding.prompt_delivery,
      execute_requires_git_worktree: Boolean(commandBinding.execute_requires_git_worktree),
      command_availability_status: "not_checked",
      install_hint: commandBinding.install_hint,
    } : {
      binding_id: null,
      display_name: null,
      candidate_command_count: 0,
      prompt_delivery: "not_applicable",
      execute_requires_git_worktree: false,
      command_availability_status: "not_required",
      install_hint: null,
    },
    capability_bindings: capabilityBindings,
    used_by_agent_run_count: agentRuns.filter((agentRun) => agentRun.runtime_id === adapter.runtime_id).length,
    used_by_capability_count: capabilityBindings.length,
    verification_required: Boolean(adapter.verification?.verification_required),
    logs_required: Boolean(adapter.observability?.logs_required),
    artifact_capture_required: Boolean(adapter.observability?.artifact_capture_required),
    output_trust: adapter.output_contract?.output_trust ?? null,
    output_artifact_types: adapter.output_contract?.artifact_types ?? [],
    created_at: generatedAt,
    metadata: adapter.metadata ?? {},
  };
}

function runtimeExecutionContractV2(adapter, generatedAt) {
  return {
    schema_version: "runtime-execution-contract.v2",
    execution_contract_id: `runtime-execution.${adapter.runtime_id}`,
    adapter_id: adapter.adapter_id,
    runtime_id: adapter.runtime_id,
    risk_level: adapter.risk_level,
    execution_mode: adapter.execution_environment?.execution_mode ?? null,
    network_policy: adapter.execution_environment?.network_policy ?? null,
    external_execution: Boolean(adapter.execution_environment?.external_execution),
    sandbox_required: Boolean(adapter.execution_environment?.sandbox_required),
    workspace_isolation_type: adapter.workspace_policy?.isolation_type ?? null,
    dirty_checkout_policy: adapter.workspace_policy?.dirty_checkout_policy ?? null,
    protected_paths: adapter.workspace_policy?.protected_paths ?? [],
    cleanup_policy: adapter.workspace_policy?.cleanup_policy ?? null,
    timeout_seconds: adapter.lifecycle?.timeout_seconds ?? null,
    heartbeat_seconds: adapter.lifecycle?.heartbeat_seconds ?? null,
    cancellable: Boolean(adapter.lifecycle?.cancellable),
    resumable: Boolean(adapter.lifecycle?.resumable),
    max_retries: adapter.lifecycle?.max_retries ?? 0,
    command_binding_id: adapter.command_binding?.binding_id ?? null,
    command_availability_status: adapter.command_binding?.command_availability_status ?? "not_required",
    created_at: generatedAt,
    metadata: {},
  };
}

function agentRunRuntimeContractV2({ agentRun, adapter, commandBinding, artifacts, runRecord, generatedAt }) {
  const outputHash = artifacts[0]?.content_hash ?? stableHash([agentRun.agent_run_id, agentRun.output_ref, agentRun.runtime_id].join("|"));
  const verificationRequired = Boolean(adapter?.verification?.verification_required);
  const outputTrust = adapter?.output_contract?.output_trust ?? agentRun.metadata?.output_trust ?? "untrusted_until_verified";
  const artifactCaptureStatus = inferArtifactCaptureStatus({ adapter, agentRun, artifacts });
  const verificationStatus = inferVerificationStatus({ adapter, outputTrust, artifacts });
  const logCaptureStatus = inferLogCaptureStatus(adapter, agentRun);
  return {
    schema_version: "agent-run-runtime.v2",
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    workflow_id: agentRun.workflow_id ?? null,
    capability_id: agentRun.capability_id ?? runRecord?.capability_id ?? null,
    domain_pack: runRecord?.domain_pack ?? inferDomainPack(agentRun.capability_id),
    runtime_id: agentRun.runtime_id,
    adapter_id: adapter?.adapter_id ?? null,
    runtime_known: Boolean(adapter),
    runtime_allowed_by_capability: Boolean(agentRun.runtime_allowed_by_capability),
    status: agentRun.status,
    risk_level: adapter?.risk_level ?? "critical",
    input_ref: agentRun.input_ref ?? null,
    output_ref: agentRun.output_ref ?? null,
    output_hash: outputHash,
    output_trust: outputTrust,
    output_contract_ref: adapter?.output_contract?.schema_ref ?? null,
    output_artifact_types: adapter?.output_contract?.artifact_types ?? [],
    logs_ref: agentRun.logs_ref ?? null,
    logs_required: Boolean(adapter?.observability?.logs_required),
    log_capture_status: logCaptureStatus,
    trace_required: Boolean(adapter?.observability?.trace_required),
    prompt_hash_required: Boolean(adapter?.observability?.prompt_hash_required),
    output_hash_required: Boolean(adapter?.observability?.output_hash_required),
    cost_tracking_required: Boolean(adapter?.observability?.cost_tracking_required),
    artifact_capture_required: Boolean(adapter?.observability?.artifact_capture_required),
    artifact_capture_status: artifactCaptureStatus,
    artifact_ids: artifacts.map((artifact) => artifact.artifact_id),
    artifact_count: artifacts.length,
    verification_required: verificationRequired,
    verifier_runtime_ids: adapter?.verification?.verifier_runtime_ids ?? [],
    required_gates: adapter?.verification?.required_gates ?? [],
    acceptance_authority: adapter?.verification?.acceptance_authority ?? null,
    verification_status: verificationStatus,
    command_binding_id: commandBinding?.binding_id ?? null,
    lifecycle_policy: adapter?.lifecycle ?? null,
    workspace_policy: adapter?.workspace_policy ?? null,
    run_record_id: runRecord?.run_id ?? null,
    blocked_reason: runRecord?.blocked_reason ?? null,
    started_at: agentRun.started_at ?? generatedAt,
    completed_at: agentRun.completed_at ?? null,
    created_at: generatedAt,
    metadata: {
      source_schema_version: agentRun.schema_version,
      source_slice_id: agentRun.source_slice_id ?? null,
      source_metadata: agentRun.metadata ?? {},
      runtime_artifacts: artifacts,
    },
  };
}

function runtimeOutputContractV2(agentRun, generatedAt) {
  const artifacts = agentRun.metadata?.runtime_artifacts ?? [];
  return {
    schema_version: "runtime-output-contract.v2",
    runtime_output_id: `runtime-output.${slugify(agentRun.agent_run_id)}`,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    capability_id: agentRun.capability_id,
    runtime_id: agentRun.runtime_id,
    output_ref: agentRun.output_ref,
    output_hash: agentRun.output_hash,
    output_hash_required: agentRun.output_hash_required,
    output_hash_status: agentRun.output_hash ? "present" : "missing",
    output_contract_ref: agentRun.output_contract_ref,
    output_trust: agentRun.output_trust,
    artifact_ids: agentRun.artifact_ids,
    artifact_types: unique(artifacts.map((artifact) => artifact.artifact_type)),
    artifact_count: agentRun.artifact_count,
    delivery_states: unique(artifacts.map((artifact) => artifact.delivery_state).filter(Boolean)),
    approval_statuses: unique(artifacts.map((artifact) => artifact.approval_status).filter(Boolean)),
    blocking_gate_ids: unique(artifacts.flatMap((artifact) => artifact.blocking_gate_ids ?? [])),
    created_at: generatedAt,
    metadata: {},
  };
}

function runtimeLogContractV2(agentRun, generatedAt) {
  return {
    schema_version: "runtime-log-contract.v2",
    runtime_log_id: `runtime-log.${slugify(agentRun.agent_run_id)}`,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    runtime_id: agentRun.runtime_id,
    logs_ref: agentRun.logs_ref,
    logs_required: agentRun.logs_required,
    log_capture_status: agentRun.log_capture_status,
    trace_required: agentRun.trace_required,
    prompt_hash_required: agentRun.prompt_hash_required,
    output_hash_required: agentRun.output_hash_required,
    cost_tracking_required: agentRun.cost_tracking_required,
    created_at: generatedAt,
    metadata: {},
  };
}

function runtimeArtifactContractsForAgentRun(agentRun, generatedAt) {
  const artifacts = agentRun.metadata?.runtime_artifacts ?? [];
  return artifacts.map((artifact) => ({
    schema_version: "runtime-artifact-contract.v2",
    runtime_artifact_id: `runtime-artifact.${slugify(agentRun.agent_run_id)}.${slugify(artifact.artifact_id)}`,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    capability_id: agentRun.capability_id,
    runtime_id: agentRun.runtime_id,
    artifact_id: artifact.artifact_id,
    artifact_type: artifact.artifact_type,
    artifact_uri: artifact.artifact_uri,
    content_hash: artifact.content_hash,
    status: artifact.status,
    delivery_state: artifact.delivery_state,
    approval_id: artifact.approval_id ?? null,
    approval_status: artifact.approval_status ?? null,
    blocking_gate_count: artifact.blocking_gate_count ?? 0,
    blocking_gate_ids: artifact.blocking_gate_ids ?? [],
    created_by_run_id: artifact.created_by_run_id ?? null,
    created_at: artifact.created_at ?? generatedAt,
    metadata: artifact.metadata ?? {},
  }));
}

function runtimeVerificationContractV2(agentRun, generatedAt) {
  return {
    schema_version: "runtime-verification-contract.v2",
    runtime_verification_id: `runtime-verification.${slugify(agentRun.agent_run_id)}`,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    capability_id: agentRun.capability_id,
    runtime_id: agentRun.runtime_id,
    risk_level: agentRun.risk_level,
    output_trust: agentRun.output_trust,
    verification_required: agentRun.verification_required,
    verification_status: agentRun.verification_status,
    verifier_runtime_ids: agentRun.verifier_runtime_ids,
    required_gates: agentRun.required_gates,
    required_gate_count: agentRun.required_gates.length,
    human_review_required: agentRun.required_gates.includes("human_approval_gate") || agentRun.metadata?.runtime_artifacts?.some((artifact) => artifact.approval_status === "pending") === true,
    acceptance_authority: agentRun.acceptance_authority,
    high_or_external_risk: ["high", "critical"].includes(agentRun.risk_level),
    created_at: generatedAt,
    metadata: {},
  };
}

function validateRuntimeAgentRunContracts({
  runtimeAdapterRegistry,
  runtimeCommandBindings,
  capabilityWorkflowContractFreeze,
  observabilityCatalog,
  outputArtifactCatalog,
  runtimeAdaptersV2,
  runtimeExecutionContractsV2,
  agentRunRuntimeContractsV2,
  runtimeOutputContractsV2,
  runtimeLogContractsV2,
  runtimeArtifactContractsV2,
  runtimeVerificationContractsV2,
}) {
  const items = [];
  const adaptersByRuntimeId = new Map(runtimeAdaptersV2.map((adapter) => [adapter.runtime_id, adapter]));
  const outputByAgentRunId = new Map(runtimeOutputContractsV2.map((contract) => [contract.agent_run_id, contract]));
  const logByAgentRunId = new Map(runtimeLogContractsV2.map((contract) => [contract.agent_run_id, contract]));
  const verificationByAgentRunId = new Map(runtimeVerificationContractsV2.map((contract) => [contract.agent_run_id, contract]));
  const runtimeIds = runtimeAdaptersV2.map((adapter) => adapter.runtime_id);

  items.push(validationItem("source.runtime_adapter_registry", "runtime_adapter_registry_present", runtimeAdapterRegistry.schema_version === "runtime-adapter-registry.v1" && (runtimeAdapterRegistry.adapters ?? []).length > 0, "Runtime adapter registry v1 is available."));
  items.push(validationItem("source.runtime_command_bindings", "runtime_command_bindings_present", runtimeCommandBindings.schema_version === "runtime-command-bindings.v1" && Array.isArray(runtimeCommandBindings.bindings), "Runtime command binding registry is available."));
  items.push(validationItem("source.capability_workflow_contract_freeze", "capability_workflow_freeze_complete", capabilityWorkflowContractFreeze.summary?.freeze_status === "complete", "Capability/workflow contract freeze is complete."));
  items.push(validationItem("source.observability_catalog", "observability_catalog_present", Array.isArray(observabilityCatalog.run_records), "Observability run records are available."));
  items.push(validationItem("source.output_artifact_catalog", "output_artifact_catalog_present", Array.isArray(outputArtifactCatalog.artifacts ?? []), "Output artifact catalog is available."));
  items.push(validationItem("runtime_adapters", "unique_runtime_ids", duplicates(runtimeIds).length === 0, "Runtime ids are unique.", { duplicates: duplicates(runtimeIds) }));

  for (const adapter of runtimeAdaptersV2) {
    const pathLabel = `runtime_adapters.${adapter.runtime_id}`;
    items.push(validationItem(pathLabel, "risk_level_declared", RISK_LEVELS.has(adapter.risk_level), "Runtime adapter declares risk level."));
    items.push(validationItem(pathLabel, "output_contract_declared", Boolean(adapter.output_contract?.schema_ref && OUTPUT_TRUST_LEVELS.has(adapter.output_trust)), "Runtime adapter declares output schema and trust policy."));
    items.push(validationItem(pathLabel, "observability_declared", typeof adapter.logs_required === "boolean" && typeof adapter.artifact_capture_required === "boolean" && typeof adapter.observability?.output_hash_required === "boolean", "Runtime adapter declares log, artifact, and output hash observability flags."));
    items.push(validationItem(pathLabel, "verification_flag_declared", typeof adapter.verification_required === "boolean", "Runtime adapter declares verification_required."));
    items.push(validationItem(pathLabel, "execution_contract_projected", runtimeExecutionContractsV2.some((contract) => contract.runtime_id === adapter.runtime_id), "Runtime execution contract is projected."));
  }

  for (const agentRun of agentRunRuntimeContractsV2) {
    const pathLabel = `agent_runs.${agentRun.agent_run_id}`;
    items.push(validationItem(pathLabel, "runtime_adapter_linked", adaptersByRuntimeId.has(agentRun.runtime_id), "AgentRun links to a RuntimeAdapter v2."));
    items.push(validationItem(pathLabel, "risk_level_declared", RISK_LEVELS.has(agentRun.risk_level), "AgentRun inherits runtime risk level."));
    items.push(validationItem(pathLabel, "output_trust_declared", OUTPUT_TRUST_LEVELS.has(agentRun.output_trust), "AgentRun inherits runtime output trust policy."));
    items.push(validationItem(pathLabel, "output_contract_present", outputByAgentRunId.has(agentRun.agent_run_id) && Boolean(agentRun.output_ref), "AgentRun has runtime output contract."));
    items.push(validationItem(pathLabel, "output_hash_present", Boolean(agentRun.output_hash), "AgentRun output hash is present."));
    items.push(validationItem(pathLabel, "log_contract_present", logByAgentRunId.has(agentRun.agent_run_id), "AgentRun has runtime log contract."));
    items.push(validationItem(pathLabel, "logs_captured_when_required", !agentRun.logs_required || agentRun.log_capture_status === "captured", "Required runtime logs are captured."));
    items.push(validationItem(pathLabel, "artifact_capture_tracked", !agentRun.artifact_capture_required || ["captured", "reference_only"].includes(agentRun.artifact_capture_status), "Required artifact capture is tracked."));
    items.push(validationItem(pathLabel, "verification_contract_present", verificationByAgentRunId.has(agentRun.agent_run_id), "AgentRun has runtime verification contract."));
    items.push(validationItem(pathLabel, "verification_required_for_high_risk", !["high", "critical"].includes(agentRun.risk_level) || agentRun.verification_required, "High or critical risk runtime requires verification."));
    items.push(validationItem(pathLabel, "untrusted_output_requires_verification", agentRun.output_trust !== "untrusted_until_verified" || agentRun.verification_required, "Untrusted runtime output requires verification."));
  }

  for (const output of runtimeOutputContractsV2) {
    items.push(validationItem(`runtime_outputs.${output.runtime_output_id}`, "runtime_output_hash_present", output.output_hash_status === "present", "Runtime output contract has an output hash."));
  }
  for (const log of runtimeLogContractsV2) {
    items.push(validationItem(`runtime_logs.${log.runtime_log_id}`, "runtime_log_capture_status_valid", ["captured", "optional_missing", "required_missing"].includes(log.log_capture_status), "Runtime log capture status is explicit."));
  }
  for (const artifact of runtimeArtifactContractsV2) {
    items.push(validationItem(`runtime_artifacts.${artifact.runtime_artifact_id}`, "runtime_artifact_hash_present", Boolean(artifact.content_hash), "Runtime artifact contract has content hash."));
  }
  for (const verification of runtimeVerificationContractsV2) {
    items.push(validationItem(`runtime_verifications.${verification.runtime_verification_id}`, "verification_gate_contract_declared", !verification.verification_required || verification.required_gate_count > 0, "Required verification declares gates."));
  }

  return items;
}

function summarizeFreeze(projection, validationItems, validation) {
  const agentRuns = projection.agentRunRuntimeContractsV2;
  const adapters = projection.runtimeAdaptersV2;
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    runtime_adapter_schema_version: "runtime-adapter.v2",
    runtime_execution_contract_schema_version: "runtime-execution-contract.v2",
    agent_run_runtime_schema_version: "agent-run-runtime.v2",
    runtime_output_schema_version: "runtime-output-contract.v2",
    runtime_log_schema_version: "runtime-log-contract.v2",
    runtime_artifact_schema_version: "runtime-artifact-contract.v2",
    runtime_verification_schema_version: "runtime-verification-contract.v2",
    runtime_adapter_count: adapters.length,
    runtime_execution_contract_count: projection.runtimeExecutionContractsV2.length,
    used_runtime_count: unique(agentRuns.map((run) => run.runtime_id)).length,
    agent_run_count: agentRuns.length,
    runtime_output_count: projection.runtimeOutputContractsV2.length,
    runtime_log_count: projection.runtimeLogContractsV2.length,
    runtime_artifact_count: projection.runtimeArtifactContractsV2.length,
    runtime_verification_count: projection.runtimeVerificationContractsV2.length,
    risk_declared_count: adapters.filter((adapter) => RISK_LEVELS.has(adapter.risk_level)).length,
    verification_flag_declared_count: adapters.filter((adapter) => typeof adapter.verification_required === "boolean").length,
    log_required_adapter_count: adapters.filter((adapter) => adapter.logs_required).length,
    artifact_capture_required_adapter_count: adapters.filter((adapter) => adapter.artifact_capture_required).length,
    log_required_agent_run_count: agentRuns.filter((run) => run.logs_required).length,
    agent_log_bound_count: agentRuns.filter((run) => !run.logs_required || run.log_capture_status === "captured").length,
    output_hash_count: agentRuns.filter((run) => Boolean(run.output_hash)).length,
    artifact_capture_required_agent_run_count: agentRuns.filter((run) => run.artifact_capture_required).length,
    artifact_capture_bound_count: agentRuns.filter((run) => !run.artifact_capture_required || ["captured", "reference_only"].includes(run.artifact_capture_status)).length,
    high_risk_agent_run_count: agentRuns.filter((run) => ["high", "critical"].includes(run.risk_level)).length,
    untrusted_output_agent_run_count: agentRuns.filter((run) => run.output_trust === "untrusted_until_verified").length,
    verification_required_agent_run_count: agentRuns.filter((run) => run.verification_required).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(agentRuns, "runtime_id"),
    by_risk_level: countBy(agentRuns, "risk_level"),
    by_output_trust: countBy(agentRuns, "output_trust"),
    by_verification_status: countBy(agentRuns, "verification_status"),
    by_log_capture_status: countBy(agentRuns, "log_capture_status"),
    by_artifact_capture_status: countBy(agentRuns, "artifact_capture_status"),
  };
}

function renderRuntimeAgentRunContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Runtime/AgentRun Contract Freeze");
  lines.push("");
  lines.push(`- Freeze ID: ${result.freeze_id}`);
  lines.push(`- Status: ${result.summary.freeze_status}`);
  lines.push(`- Runtime adapters v2: ${result.summary.runtime_adapter_count}`);
  lines.push(`- Runtime execution contracts: ${result.summary.runtime_execution_contract_count}`);
  lines.push(`- AgentRun runtime contracts: ${result.summary.agent_run_count}`);
  lines.push(`- Runtime outputs: ${result.summary.runtime_output_count}`);
  lines.push(`- Runtime logs: ${result.summary.runtime_log_count}`);
  lines.push(`- Runtime artifact contracts: ${result.summary.runtime_artifact_count}`);
  lines.push(`- Runtime verification contracts: ${result.summary.runtime_verification_count}`);
  lines.push(`- Logs captured: ${result.summary.agent_log_bound_count}/${result.summary.log_required_agent_run_count}`);
  lines.push(`- Artifact capture tracked: ${result.summary.artifact_capture_bound_count}/${result.summary.artifact_capture_required_agent_run_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Runtime Adapters");
  for (const adapter of result.runtime_agentrun_contract.runtime_adapters) {
    lines.push(`- ${adapter.runtime_id}: risk ${adapter.risk_level}, trust ${adapter.output_trust}, verification ${adapter.verification_required ? "required" : "not required"}`);
  }
  lines.push("");
  lines.push("## Agent Runs");
  for (const agentRun of result.runtime_agentrun_contract.agent_runs) {
    lines.push(`- ${agentRun.agent_run_id}: runtime ${agentRun.runtime_id}, risk ${agentRun.risk_level}, log ${agentRun.log_capture_status}, artifact ${agentRun.artifact_capture_status}, verification ${agentRun.verification_status}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function buildArtifactsByAgentRunId(agentRuns, artifacts) {
  const map = new Map(agentRuns.map((run) => [run.agent_run_id, []]));
  for (const artifact of artifacts) {
    for (const agentRun of agentRuns) {
      if (artifact.created_by_run_id === agentRun.agent_run_id || artifact.artifact_id === agentRun.output_ref) {
        const existing = map.get(agentRun.agent_run_id) ?? [];
        if (!existing.some((candidate) => candidate.artifact_id === artifact.artifact_id)) existing.push(artifact);
        map.set(agentRun.agent_run_id, existing);
      }
    }
  }
  return map;
}

function inferArtifactCaptureStatus({ adapter, agentRun, artifacts }) {
  if (!adapter?.observability?.artifact_capture_required) return "optional_missing";
  if (artifacts.length > 0) return "captured";
  if (agentRun.output_ref) return "reference_only";
  return "missing";
}

function inferLogCaptureStatus(adapter, agentRun) {
  if (agentRun.logs_ref) return "captured";
  if (adapter?.observability?.logs_required) return "required_missing";
  return "optional_missing";
}

function inferVerificationStatus({ adapter, outputTrust, artifacts }) {
  if (!adapter?.verification?.verification_required) return "not_required";
  if (outputTrust === "untrusted_until_verified") return "pending_gate_review";
  if (artifacts.some((artifact) => artifact.approval_status === "pending" || artifact.delivery_state?.startsWith("blocked"))) return "pending_human_approval";
  return "contract_ready";
}

function buildFieldRequirements() {
  return {
    runtime_adapter_v2: fieldRequirement(
      ["schema_version", "adapter_id", "runtime_id", "version", "risk_level", "execution_environment", "output_contract", "observability", "verification", "data_access"],
      ["command_binding", "capability_bindings", "metadata"],
    ),
    runtime_execution_contract_v2: fieldRequirement(
      ["schema_version", "execution_contract_id", "adapter_id", "runtime_id", "risk_level", "execution_mode", "sandbox_required", "timeout_seconds"],
      ["command_binding_id", "metadata"],
    ),
    agent_run_runtime_v2: fieldRequirement(
      ["schema_version", "agent_run_id", "workflow_run_id", "runtime_id", "adapter_id", "risk_level", "output_ref", "output_hash", "logs_required", "artifact_capture_required", "verification_required"],
      ["run_record_id", "metadata"],
    ),
    runtime_output_contract_v2: fieldRequirement(
      ["schema_version", "runtime_output_id", "agent_run_id", "runtime_id", "output_ref", "output_hash", "output_trust"],
      ["artifact_ids", "delivery_states", "approval_statuses"],
    ),
    runtime_log_contract_v2: fieldRequirement(
      ["schema_version", "runtime_log_id", "agent_run_id", "runtime_id", "logs_required", "log_capture_status"],
      ["logs_ref", "metadata"],
    ),
    runtime_artifact_contract_v2: fieldRequirement(
      ["schema_version", "runtime_artifact_id", "agent_run_id", "runtime_id", "artifact_id", "artifact_type", "content_hash"],
      ["approval_id", "approval_status", "metadata"],
    ),
    runtime_verification_contract_v2: fieldRequirement(
      ["schema_version", "runtime_verification_id", "agent_run_id", "runtime_id", "risk_level", "output_trust", "verification_required", "verification_status"],
      ["verifier_runtime_ids", "required_gates", "metadata"],
    ),
  };
}

function fieldRequirement(requiredFields, optionalFields) {
  return {
    required_fields: requiredFields,
    optional_fields: optionalFields,
    required_groups: {},
  };
}

function validationItem(pathLabel, check_id, passed, message, metadata = {}) {
  return {
    path: pathLabel,
    check_id,
    status: passed ? "passed" : "failed",
    message,
    metadata,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_RUNTIME_AGENTRUN_CONTRACT_FREEZE_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--runtime-adapter-registry") parsed.runtimeAdapterRegistryPath = argv[++index];
    else if (arg === "--runtime-command-bindings") parsed.runtimeCommandBindingsPath = argv[++index];
    else if (arg === "--capability-workflow-contract-freeze") parsed.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--observability-catalog") parsed.observabilityCatalogPath = argv[++index];
    else if (arg === "--output-artifact-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-agentrun-contract-freeze.mjs [options]

Options:
  --runtime-adapter-registry <path>          Runtime adapter registry JSON
  --runtime-command-bindings <path>          Runtime command bindings JSON
  --capability-workflow-contract-freeze <path>
  --observability-catalog <path>
  --output-artifact-catalog <path>
  --out-dir <path>                           Output directory
  --run-at <iso>                             Fixed generated_at timestamp
  --check                                    Exit non-zero when validation fails
  --no-write                                 Build without writing artifacts
  --help                                     Show this help
`);
}

function stableHash(value) {
  return createHash("sha256").update(String(value)).digest("hex");
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

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))].sort();
}

function duplicates(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value);
}

function countBy(records, field) {
  const counts = {};
  for (const record of records) {
    const key = record[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

function inferDomainPack(capabilityId) {
  if (capabilityId?.startsWith("law_firm.")) return "law-firm";
  if (capabilityId?.startsWith("personal_dev.")) return "personal-dev";
  if (capabilityId?.startsWith("creative_document.")) return "creative-document";
  return null;
}
