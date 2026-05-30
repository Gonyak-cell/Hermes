import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNTIME_ARTIFACT_CAPTURE_OUT_DIR = "artifacts/runtime-artifact-capture/latest";
export const DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS = {
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  claudeCodeAdapterContractPath: "artifacts/claude-code-adapter-contract/latest/claude-code-adapter-contract.json",
  codexAdapterContractPath: "artifacts/codex-adapter-contract/latest/codex-adapter-contract.json",
  secretsBrokerContractPath: "artifacts/secrets-broker/latest/secrets-broker-contract.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const CAPTURE_AUTHORITY = "harness_control_plane";
const PROTECTED_MUTATION_ROUTE = "protected_action_request_only";

export async function runRuntimeArtifactCapture(options = {}) {
  const result = await buildRuntimeArtifactCapture(options);
  if (options.write !== false) await writeRuntimeArtifactCapture(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Runtime artifact capture validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRuntimeArtifactCapture(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const outputDeliveryContractFreeze = await readJson(inputs.output_delivery_contract_freeze_path);
  const claudeCodeAdapterContract = await readJson(inputs.claude_code_adapter_contract_path);
  const codexAdapterContract = await readJson(inputs.codex_adapter_contract_path);
  const secretsBrokerContract = await readJson(inputs.secrets_broker_contract_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");
  const projection = projectRuntimeArtifactCapture({
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    outputDeliveryContractFreeze,
    claudeCodeAdapterContract,
    codexAdapterContract,
    generatedAt,
  });
  const validationItems = validateRuntimeArtifactCapture({
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    outputDeliveryContractFreeze,
    claudeCodeAdapterContract,
    codexAdapterContract,
    secretsBrokerContract,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "runtime-artifact-capture.v1",
    generated_at: generatedAt,
    runtime_artifact_capture_id: `runtime-artifact-capture.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAgentRunContractFreeze,
      agentRunLedger,
      outputDeliveryContractFreeze,
      claudeCodeAdapterContract,
      codexAdapterContract,
      secretsBrokerContract,
      desktopCompanionIntegration,
    }),
    runtime_artifact_capture_contract: buildRuntimeArtifactCaptureContract(generatedAt),
    artifact_capture_records: projection.artifactCaptureRecords,
    diff_capture_records: projection.diffCaptureRecords,
    stream_capture_records: projection.streamCaptureRecords,
    metadata_capture_records: projection.metadataCaptureRecords,
    output_artifact_capture_bindings: projection.outputArtifactCaptureBindings,
    runtime_artifact_desktop_boundary: projection.runtimeArtifactDesktopBoundary,
    summary: summarizeRuntimeArtifactCapture(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderRuntimeArtifactCaptureMarkdown(result),
  };
}

export async function writeRuntimeArtifactCapture(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "runtime-artifact-capture.json"), serializableRuntimeArtifactCapture(result));
  await writeJson(path.join(outDir, "artifact-capture-records.json"), {
    schema_version: "artifact-capture-records.v1",
    generated_at: result.generated_at,
    artifact_capture_record_count: result.artifact_capture_records.length,
    artifact_capture_records: result.artifact_capture_records,
  });
  await writeJson(path.join(outDir, "diff-capture-records.json"), {
    schema_version: "diff-capture-records.v1",
    generated_at: result.generated_at,
    diff_capture_record_count: result.diff_capture_records.length,
    diff_capture_records: result.diff_capture_records,
  });
  await writeJson(path.join(outDir, "stream-capture-records.json"), {
    schema_version: "stream-capture-records.v1",
    generated_at: result.generated_at,
    stream_capture_record_count: result.stream_capture_records.length,
    stream_capture_records: result.stream_capture_records,
  });
  await writeJson(path.join(outDir, "metadata-capture-records.json"), {
    schema_version: "metadata-capture-records.v1",
    generated_at: result.generated_at,
    metadata_capture_record_count: result.metadata_capture_records.length,
    metadata_capture_records: result.metadata_capture_records,
  });
  await writeJson(path.join(outDir, "output-artifact-capture-bindings.json"), {
    schema_version: "output-artifact-capture-bindings.v1",
    generated_at: result.generated_at,
    output_artifact_capture_binding_count: result.output_artifact_capture_bindings.length,
    output_artifact_capture_bindings: result.output_artifact_capture_bindings,
  });
  await writeJson(path.join(outDir, "runtime-artifact-desktop-boundary.json"), result.runtime_artifact_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "runtime-artifact-capture-validation-report.v1",
    generated_at: result.generated_at,
    runtime_artifact_capture_id: result.runtime_artifact_capture_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRuntimeArtifactCaptureCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRuntimeArtifactCapture(args);
    console.log(`Runtime artifact capture written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.runtime_artifact_capture_status}`);
    console.log(`Artifact captures: ${result.summary.bound_artifact_capture_count}/${result.summary.artifact_capture_record_count}`);
    console.log(`Diff captures: ${result.summary.bound_diff_capture_count}/${result.summary.diff_capture_record_count}`);
    console.log(`Stream captures: ${result.summary.bound_stream_capture_count}/${result.summary.stream_capture_record_count}`);
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
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS.runtimeAgentRunContractFreezePath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS.agentRunLedgerPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS.outputDeliveryContractFreezePath),
    claude_code_adapter_contract_path: path.resolve(options.claudeCodeAdapterContractPath ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS.claudeCodeAdapterContractPath),
    codex_adapter_contract_path: path.resolve(options.codexAdapterContractPath ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS.codexAdapterContractPath),
    secrets_broker_contract_path: path.resolve(options.secretsBrokerContractPath ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS.secretsBrokerContractPath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_RUNTIME_ARTIFACT_CAPTURE_INPUTS.desktopCompanionIntegrationPath),
  };
}

function projectRuntimeArtifactCapture({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  outputDeliveryContractFreeze,
  claudeCodeAdapterContract,
  codexAdapterContract,
  generatedAt,
}) {
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const runtimeArtifacts = runtimeContract.runtime_artifacts ?? [];
  const runtimeOutputs = runtimeContract.runtime_outputs ?? [];
  const runtimeLogs = runtimeContract.runtime_logs ?? [];
  const agentRunCatalog = agentRunLedger.agent_run_catalog ?? {};
  const agentRunRecords = agentRunCatalog.agent_run_records ?? [];
  const agentRunArtifactReferences = agentRunCatalog.agent_run_artifact_references ?? [];
  const outputContract = outputDeliveryContractFreeze.output_delivery_contract ?? {};
  const outputArtifacts = outputContract.output_artifacts ?? [];
  const outputBindings = outputContract.output_delivery_bindings ?? [];
  const outputLookup = buildOutputArtifactLookup(outputArtifacts);
  const runtimeOutputByAgentRunId = new Map(runtimeOutputs.map((output) => [output.agent_run_id, output]));
  const agentRunRecordById = new Map(agentRunRecords.map((record) => [record.agent_run_id, record]));
  const artifactReferenceByRuntimeArtifactId = new Map(agentRunArtifactReferences.map((reference) => [reference.runtime_artifact_id, reference]));

  const artifactCaptureRecords = runtimeArtifacts.map((artifact) => {
    const runtimeOutput = runtimeOutputByAgentRunId.get(artifact.agent_run_id);
    const agentRunRecord = agentRunRecordById.get(artifact.agent_run_id);
    const outputArtifact = resolveOutputArtifact({
      artifact,
      runtimeOutput,
      agentRunRecord,
      outputLookup,
    });
    const agentRunArtifactReference = artifactReferenceByRuntimeArtifactId.get(artifact.runtime_artifact_id);
    return {
      schema_version: "runtime-artifact-capture-record.v1",
      artifact_capture_record_id: `artifact-capture.${slugify(artifact.runtime_artifact_id)}`,
      capture_authority: CAPTURE_AUTHORITY,
      capture_status: outputArtifact ? "bound" : "attention",
      capture_kind: classifyArtifactCaptureKind(artifact.artifact_type),
      runtime_artifact_id: artifact.runtime_artifact_id,
      agent_run_artifact_reference_id: agentRunArtifactReference?.agent_run_artifact_reference_id ?? null,
      runtime_output_id: runtimeOutput?.runtime_output_id ?? null,
      agent_run_id: artifact.agent_run_id,
      workflow_run_id: artifact.workflow_run_id,
      capability_id: artifact.capability_id,
      runtime_id: artifact.runtime_id,
      artifact_id: artifact.artifact_id,
      artifact_type: artifact.artifact_type,
      artifact_uri: artifact.artifact_uri,
      content_hash: artifact.content_hash,
      output_artifact_id: outputArtifact?.output_artifact_id ?? null,
      output_artifact_binding_status: outputArtifact ? "bound_to_output_artifact" : "missing_output_artifact",
      delivery_state: artifact.delivery_state ?? outputArtifact?.delivery_state ?? null,
      approval_status: artifact.approval_status ?? outputArtifact?.approval_status ?? null,
      blocking_gate_ids: unique([...(artifact.blocking_gate_ids ?? []), ...(outputArtifact?.blocking_gate_ids ?? [])]),
      metadata_key_count: Object.keys(artifact.metadata ?? {}).length,
      metadata_ref: `metadata://${artifact.runtime_artifact_id}`,
      runtime_self_report_trusted: false,
      recorded_at: generatedAt,
    };
  });

  const diffCaptureRecords = buildDiffCaptureRecords({
    claudeCodeAdapterContract,
    codexAdapterContract,
    agentRunRecords,
    outputLookup,
    generatedAt,
  });
  const streamCaptureRecords = runtimeLogs.flatMap((runtimeLog) => ["stdout", "stderr"].map((streamName) => {
    const runtimeOutput = runtimeOutputByAgentRunId.get(runtimeLog.agent_run_id);
    const agentRunRecord = agentRunRecordById.get(runtimeLog.agent_run_id);
    const outputArtifact = resolveOutputArtifact({
      artifact: null,
      runtimeOutput,
      agentRunRecord: agentRunRecord ?? runtimeLog,
      outputLookup,
    });
    return {
      schema_version: "runtime-stream-capture-record.v1",
      stream_capture_record_id: `stream-capture.${slugify(runtimeLog.runtime_log_id)}.${streamName}`,
      capture_authority: CAPTURE_AUTHORITY,
      capture_status: outputArtifact && runtimeLog.log_capture_status === "captured" ? "bound" : "attention",
      stream_name: streamName,
      stream_ref: `${runtimeLog.logs_ref}#${streamName}`,
      runtime_log_id: runtimeLog.runtime_log_id,
      agent_run_id: runtimeLog.agent_run_id,
      workflow_run_id: runtimeLog.workflow_run_id,
      runtime_id: runtimeLog.runtime_id,
      logs_ref: runtimeLog.logs_ref,
      log_capture_status: runtimeLog.log_capture_status,
      output_artifact_id: outputArtifact?.output_artifact_id ?? null,
      output_artifact_binding_status: outputArtifact ? "bound_to_output_artifact" : "missing_output_artifact",
      runtime_self_report_trusted: false,
      recorded_at: generatedAt,
    };
  }));
  const metadataCaptureRecords = artifactCaptureRecords.map((record) => ({
    schema_version: "runtime-metadata-capture-record.v1",
    metadata_capture_record_id: `metadata-capture.${slugify(record.runtime_artifact_id)}`,
    capture_authority: CAPTURE_AUTHORITY,
    capture_status: record.output_artifact_id ? "bound" : "attention",
    metadata_scope: "runtime_artifact_metadata",
    metadata_ref: record.metadata_ref,
    metadata_key_count: Math.max(record.metadata_key_count, 1),
    runtime_artifact_id: record.runtime_artifact_id,
    agent_run_id: record.agent_run_id,
    workflow_run_id: record.workflow_run_id,
    runtime_id: record.runtime_id,
    artifact_id: record.artifact_id,
    output_artifact_id: record.output_artifact_id,
    output_artifact_binding_status: record.output_artifact_binding_status,
    runtime_self_report_trusted: false,
    recorded_at: generatedAt,
  }));
  const outputArtifactCaptureBindings = [
    ...artifactCaptureRecords.map((record) => captureBinding(record, "runtime_artifact", record.artifact_capture_record_id, generatedAt)),
    ...diffCaptureRecords.map((record) => captureBinding(record, "runtime_diff", record.diff_capture_record_id, generatedAt)),
    ...streamCaptureRecords.map((record) => captureBinding(record, "runtime_stream", record.stream_capture_record_id, generatedAt)),
    ...metadataCaptureRecords.map((record) => captureBinding(record, "runtime_metadata", record.metadata_capture_record_id, generatedAt)),
  ];
  const runtimeArtifactDesktopBoundary = {
    schema_version: "runtime-artifact-desktop-boundary.v1",
    generated_at: generatedAt,
    boundary_id: "runtime-artifact-capture.desktop-boundary",
    boundary_status: "locked",
    desktop_surface: "runtime_artifact_capture",
    desktop_surface_policy: "read_only_runtime_artifact_status",
    source_of_truth: CAPTURE_AUTHORITY,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_execution_allowed: false,
    artifact_write_allowed: false,
    diff_apply_allowed: false,
    stream_write_allowed: false,
    metadata_edit_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    allowed_operator_actions: ["view_capture_status", "view_output_artifact_binding", "view_stream_capture_status", "view_diff_gate_status"],
    denied_operator_actions: ["write_artifact", "apply_diff", "edit_metadata", "start_runtime", "export_secret", "override_output_binding"],
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
    artifact_capture_record_count: artifactCaptureRecords.length,
    diff_capture_record_count: diffCaptureRecords.length,
    stream_capture_record_count: streamCaptureRecords.length,
    metadata_capture_record_count: metadataCaptureRecords.length,
    output_artifact_capture_binding_count: outputArtifactCaptureBindings.length,
  };

  return {
    artifactCaptureRecords,
    diffCaptureRecords,
    streamCaptureRecords,
    metadataCaptureRecords,
    outputArtifactCaptureBindings,
    runtimeArtifactDesktopBoundary,
    sourceOutputArtifactCount: outputArtifacts.length,
    sourceOutputDeliveryBindingCount: outputBindings.length,
  };
}

function buildDiffCaptureRecords({ claudeCodeAdapterContract, codexAdapterContract, agentRunRecords, outputLookup, generatedAt }) {
  const records = [];
  const claudeAgentRun = agentRunRecords.find((record) => record.runtime_id === "claude_code");
  for (const contract of claudeCodeAdapterContract.claude_code_diff_gate_contracts ?? []) {
    const outputArtifact = resolveOutputArtifact({ artifact: null, runtimeOutput: null, agentRunRecord: claudeAgentRun, outputLookup });
    records.push(diffCaptureRecord({
      kind: "claude_code_diff",
      contractId: contract.diff_gate_contract_id,
      runtimeId: contract.runtime_id,
      adapterId: contract.adapter_id,
      changeTarget: contract.change_target,
      patchTrust: contract.patch_output_trust,
      agentRunRecord: claudeAgentRun,
      outputArtifact,
      directApplyAllowed: contract.direct_apply_allowed,
      directMergeAllowed: contract.direct_merge_allowed,
      protectedPathWriteAllowed: contract.protected_path_write_allowed,
      humanReviewRequired: contract.human_review_required,
      requiredGates: contract.required_gates ?? [],
      gateBindingStatus: contract.gate_binding_status,
      generatedAt,
    }));
  }

  const codexAgentRun = agentRunRecords.find((record) => record.runtime_id === "codex");
  for (const contract of codexAdapterContract.codex_patch_gate_contracts ?? []) {
    const outputArtifact = resolveOutputArtifact({ artifact: null, runtimeOutput: null, agentRunRecord: codexAgentRun, outputLookup });
    records.push(diffCaptureRecord({
      kind: "codex_patch",
      contractId: contract.patch_gate_contract_id,
      runtimeId: contract.runtime_id,
      adapterId: contract.adapter_id,
      changeTarget: contract.change_target,
      patchTrust: contract.patch_output_trust,
      agentRunRecord: codexAgentRun,
      outputArtifact,
      directApplyAllowed: contract.direct_apply_allowed,
      directMergeAllowed: contract.direct_merge_allowed,
      protectedPathWriteAllowed: contract.protected_path_write_allowed,
      humanReviewRequired: contract.human_review_required,
      requiredGates: contract.required_gates ?? [],
      gateBindingStatus: contract.gate_binding_status,
      generatedAt,
    }));
  }
  return records;
}

function diffCaptureRecord({
  kind,
  contractId,
  runtimeId,
  adapterId,
  changeTarget,
  patchTrust,
  agentRunRecord,
  outputArtifact,
  directApplyAllowed,
  directMergeAllowed,
  protectedPathWriteAllowed,
  humanReviewRequired,
  requiredGates,
  gateBindingStatus,
  generatedAt,
}) {
  return {
    schema_version: "runtime-diff-capture-record.v1",
    diff_capture_record_id: `diff-capture.${slugify(contractId)}`,
    capture_authority: CAPTURE_AUTHORITY,
    capture_status: outputArtifact ? "bound" : "attention",
    diff_capture_kind: kind,
    diff_gate_contract_id: contractId,
    runtime_id: runtimeId,
    adapter_id: adapterId,
    agent_run_id: agentRunRecord?.agent_run_id ?? null,
    workflow_run_id: agentRunRecord?.workflow_run_id ?? null,
    change_target: changeTarget,
    patch_trust: patchTrust,
    output_artifact_id: outputArtifact?.output_artifact_id ?? null,
    output_artifact_binding_status: outputArtifact ? "bound_to_output_artifact" : "missing_output_artifact",
    direct_apply_allowed: Boolean(directApplyAllowed),
    direct_merge_allowed: Boolean(directMergeAllowed),
    protected_path_write_allowed: Boolean(protectedPathWriteAllowed),
    human_review_required: Boolean(humanReviewRequired),
    required_gates: requiredGates,
    gate_binding_status: gateBindingStatus,
    runtime_self_report_trusted: false,
    recorded_at: generatedAt,
  };
}

function buildOutputArtifactLookup(outputArtifacts) {
  return {
    byId: new Map(outputArtifacts.flatMap((artifact) => [
      [artifact.output_artifact_id, artifact],
      [artifact.source_output_artifact_id, artifact],
    ].filter(([key]) => Boolean(key)))),
    byHash: groupBy(outputArtifacts, (artifact) => artifact.content_hash),
    byWorkflowRunId: groupBy(outputArtifacts, (artifact) => artifact.workflow_run_id),
    byCreatedRunId: groupBy(outputArtifacts, (artifact) => artifact.created_by_run_id),
  };
}

function resolveOutputArtifact({ artifact, runtimeOutput, agentRunRecord, outputLookup }) {
  const directId = artifact?.artifact_id ?? runtimeOutput?.output_ref ?? null;
  if (directId && outputLookup.byId.has(directId)) return outputLookup.byId.get(directId);
  const hash = artifact?.content_hash ?? runtimeOutput?.output_hash ?? null;
  if (hash && (outputLookup.byHash.get(hash) ?? []).length > 0) return outputLookup.byHash.get(hash)[0];
  if (agentRunRecord?.agent_run_id && (outputLookup.byCreatedRunId.get(agentRunRecord.agent_run_id) ?? []).length > 0) {
    return outputLookup.byCreatedRunId.get(agentRunRecord.agent_run_id)[0];
  }
  const workflowRunId = artifact?.workflow_run_id ?? runtimeOutput?.workflow_run_id ?? agentRunRecord?.workflow_run_id ?? null;
  if (workflowRunId && (outputLookup.byWorkflowRunId.get(workflowRunId) ?? []).length > 0) {
    return outputLookup.byWorkflowRunId.get(workflowRunId)[0];
  }
  return null;
}

function captureBinding(record, sourceCaptureKind, sourceCaptureId, generatedAt) {
  return {
    schema_version: "output-artifact-capture-binding.v1",
    output_artifact_capture_binding_id: `output-artifact-capture-binding.${slugify(sourceCaptureId)}`,
    binding_authority: CAPTURE_AUTHORITY,
    binding_status: record.output_artifact_id ? "bound" : "attention",
    source_capture_kind: sourceCaptureKind,
    source_capture_id: sourceCaptureId,
    agent_run_id: record.agent_run_id ?? null,
    workflow_run_id: record.workflow_run_id ?? null,
    runtime_id: record.runtime_id ?? null,
    output_artifact_id: record.output_artifact_id ?? null,
    output_artifact_binding_status: record.output_artifact_binding_status ?? "missing_output_artifact",
    runtime_self_report_trusted: false,
    recorded_at: generatedAt,
  };
}

function buildRuntimeArtifactCaptureContract(generatedAt) {
  return {
    schema_version: "runtime-artifact-capture-contract.v1",
    generated_at: generatedAt,
    capture_contract_id: "runtime-artifact-capture.default",
    contract_status: "locked",
    capture_status: "locked",
    capture_authority: CAPTURE_AUTHORITY,
    source_of_truth: "runtime_agentrun_contract_freeze_and_agent_run_ledger",
    output_artifact_binding_required: true,
    generated_file_capture_required: true,
    diff_capture_required: true,
    stdout_stderr_capture_required: true,
    metadata_capture_required: true,
    runtime_self_report_trusted: false,
    desktop_surface_policy: "read_only_runtime_artifact_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: false,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    human_gate_required_for_exception: true,
  };
}

function buildSourceContracts({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  outputDeliveryContractFreeze,
  claudeCodeAdapterContract,
  codexAdapterContract,
  secretsBrokerContract,
  desktopCompanionIntegration,
}) {
  return {
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_id: runtimeAgentRunContractFreeze.freeze_id ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      runtime_artifact_count: runtimeAgentRunContractFreeze.summary?.runtime_artifact_count ?? 0,
      runtime_log_count: runtimeAgentRunContractFreeze.summary?.runtime_log_count ?? 0,
      runtime_output_count: runtimeAgentRunContractFreeze.summary?.runtime_output_count ?? 0,
      validation_error_count: runtimeAgentRunContractFreeze.summary?.validation_error_count ?? runtimeAgentRunContractFreeze.validation?.errors?.length ?? 0,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      agent_run_artifact_reference_count: agentRunLedger.summary?.agent_run_artifact_reference_count ?? 0,
      agent_run_log_reference_count: agentRunLedger.summary?.agent_run_log_reference_count ?? 0,
      validation_error_count: agentRunLedger.summary?.validation_error_count ?? agentRunLedger.validation?.errors?.length ?? 0,
    },
    output_delivery_contract_freeze: {
      schema_version: outputDeliveryContractFreeze.schema_version ?? null,
      freeze_status: outputDeliveryContractFreeze.summary?.freeze_status ?? "unknown",
      output_artifact_count: outputDeliveryContractFreeze.summary?.output_artifact_count ?? 0,
      output_delivery_binding_count: outputDeliveryContractFreeze.summary?.output_delivery_binding_count ?? 0,
      validation_error_count: outputDeliveryContractFreeze.summary?.validation_error_count ?? outputDeliveryContractFreeze.validation?.errors?.length ?? 0,
    },
    claude_code_adapter_contract: {
      schema_version: claudeCodeAdapterContract.schema_version ?? null,
      adapter_status: claudeCodeAdapterContract.summary?.claude_code_adapter_contract_status ?? "unknown",
      diff_gate_contract_count: claudeCodeAdapterContract.summary?.diff_gate_contract_count ?? 0,
      direct_apply_allowed: claudeCodeAdapterContract.summary?.direct_apply_allowed ?? false,
      direct_merge_allowed: claudeCodeAdapterContract.summary?.direct_merge_allowed ?? false,
      desktop_runtime_source_of_truth: claudeCodeAdapterContract.summary?.desktop_runtime_source_of_truth ?? false,
      validation_error_count: claudeCodeAdapterContract.summary?.validation_error_count ?? claudeCodeAdapterContract.validation?.errors?.length ?? 0,
    },
    codex_adapter_contract: {
      schema_version: codexAdapterContract.schema_version ?? null,
      adapter_status: codexAdapterContract.summary?.codex_adapter_contract_status ?? "unknown",
      patch_gate_contract_count: codexAdapterContract.summary?.patch_gate_contract_count ?? 0,
      direct_apply_allowed: codexAdapterContract.summary?.direct_apply_allowed ?? false,
      direct_merge_allowed: codexAdapterContract.summary?.direct_merge_allowed ?? false,
      desktop_runtime_source_of_truth: codexAdapterContract.summary?.desktop_runtime_source_of_truth ?? false,
      validation_error_count: codexAdapterContract.summary?.validation_error_count ?? codexAdapterContract.validation?.errors?.length ?? 0,
    },
    secrets_broker_contract: {
      schema_version: secretsBrokerContract.schema_version ?? null,
      secrets_broker_contract_status: secretsBrokerContract.summary?.secrets_broker_contract_status ?? "unknown",
      raw_secret_material_allowed_count: secretsBrokerContract.summary?.raw_secret_material_allowed_count ?? 0,
      desktop_secret_material_exposed: secretsBrokerContract.summary?.desktop_secret_material_exposed ?? false,
      provider_key_visible_to_desktop: secretsBrokerContract.summary?.provider_key_visible_to_desktop ?? false,
      desktop_source_of_truth: secretsBrokerContract.summary?.desktop_source_of_truth ?? false,
      validation_error_count: secretsBrokerContract.summary?.validation_error_count ?? secretsBrokerContract.validation?.errors?.length ?? 0,
    },
    desktop_companion_integration: {
      declares_read_only: /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration),
      declares_not_runtime_source_of_truth: /source of truth가 아니라|not.*source of truth|source_of_truth=false/i.test(desktopCompanionIntegration),
      declares_human_gate_for_mutation: /Human Gate|human gate|protected action request|protected_action_request/i.test(desktopCompanionIntegration),
      blocks_artifact_or_diff_mutation: /실행 버튼을 제공하지 않는다|protected execution|apply_diff|mutation_allowed=false|직접 제어하지 않는다/i.test(desktopCompanionIntegration),
      blocks_secret_or_provider_key_control: /secret 원문|provider key|provider_key|secret_material_exposed=false/i.test(desktopCompanionIntegration),
    },
  };
}

function validateRuntimeArtifactCapture({
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  outputDeliveryContractFreeze,
  claudeCodeAdapterContract,
  codexAdapterContract,
  secretsBrokerContract,
  desktopCompanionIntegration,
  artifactCaptureRecords,
  diffCaptureRecords,
  streamCaptureRecords,
  metadataCaptureRecords,
  outputArtifactCaptureBindings,
  runtimeArtifactDesktopBoundary,
}) {
  const items = [];
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete" && runtimeAgentRunContractFreeze.validation?.valid !== false, "Runtime/AgentRun freeze is complete."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunLedger.validation?.valid !== false, "AgentRun ledger is complete."));
  items.push(validationItem("source.output_delivery_contract_freeze", "output_delivery_freeze_complete", outputDeliveryContractFreeze.summary?.freeze_status === "complete" && outputDeliveryContractFreeze.validation?.valid !== false, "Output/Delivery contract freeze is complete."));
  items.push(validationItem("source.claude_code_adapter_contract", "claude_diff_gate_locked", claudeCodeAdapterContract.summary?.diff_gate_contract_count > 0 && claudeCodeAdapterContract.summary?.direct_apply_allowed === false && claudeCodeAdapterContract.summary?.direct_merge_allowed === false, "Claude Code diff gate exists and blocks direct apply/merge."));
  items.push(validationItem("source.codex_adapter_contract", "codex_patch_gate_locked", codexAdapterContract.summary?.patch_gate_contract_count > 0 && codexAdapterContract.summary?.direct_apply_allowed === false && codexAdapterContract.summary?.direct_merge_allowed === false, "Codex patch gate exists and blocks direct apply/merge."));
  items.push(validationItem("source.secrets_broker_contract", "secrets_not_exposed_to_capture_surface", secretsBrokerContract.summary?.raw_secret_material_allowed_count === 0 && secretsBrokerContract.summary?.desktop_secret_material_exposed === false && secretsBrokerContract.summary?.desktop_source_of_truth === false, "Artifact capture surface does not expose secret material or Desktop source-of-truth control."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_declares_read_only_capture", /read[-_ ]?only|읽기 전용/i.test(desktopCompanionIntegration) && /protected action request|Human Gate|human gate/i.test(desktopCompanionIntegration), "Desktop companion integration documents read-only and human-gated mutation boundaries."));

  items.push(validationItem("artifact_capture_records", "runtime_artifact_count_matched", artifactCaptureRecords.length === (runtimeAgentRunContractFreeze.summary?.runtime_artifact_count ?? 0), "Every runtime artifact contract has a capture record."));
  items.push(validationItem("artifact_capture_records", "all_artifacts_bound_to_output_artifacts", artifactCaptureRecords.every((record) => record.output_artifact_binding_status === "bound_to_output_artifact"), "Every runtime artifact capture is bound to OutputArtifact v2."));
  items.push(validationItem("artifact_capture_records", "all_artifacts_have_hashes", artifactCaptureRecords.every((record) => Boolean(record.content_hash)), "Every artifact capture has content hash."));
  items.push(validationItem("diff_capture_records", "diff_and_patch_captures_present", diffCaptureRecords.length >= 2, "Claude diff and Codex patch capture records are present."));
  items.push(validationItem("diff_capture_records", "diff_captures_bound_and_human_gated", diffCaptureRecords.every((record) => record.output_artifact_binding_status === "bound_to_output_artifact" && record.direct_apply_allowed === false && record.direct_merge_allowed === false && record.human_review_required === true), "Diff/patch captures bind to OutputArtifact and remain human-gated."));
  items.push(validationItem("stream_capture_records", "stdout_stderr_captured_for_logs", streamCaptureRecords.length === (runtimeAgentRunContractFreeze.summary?.runtime_log_count ?? 0) * 2 && streamCaptureRecords.every((record) => ["stdout", "stderr"].includes(record.stream_name) && record.output_artifact_binding_status === "bound_to_output_artifact"), "stdout/stderr stream capture rows are present and output-bound."));
  items.push(validationItem("metadata_capture_records", "metadata_captured_for_artifacts", metadataCaptureRecords.length === artifactCaptureRecords.length && metadataCaptureRecords.every((record) => record.metadata_key_count > 0 && record.output_artifact_binding_status === "bound_to_output_artifact"), "Runtime artifact metadata is captured and output-bound."));
  items.push(validationItem("output_artifact_capture_bindings", "all_capture_rows_have_output_bindings", outputArtifactCaptureBindings.length === artifactCaptureRecords.length + diffCaptureRecords.length + streamCaptureRecords.length + metadataCaptureRecords.length && outputArtifactCaptureBindings.every((binding) => binding.binding_status === "bound"), "Every capture row has an OutputArtifact binding."));
  items.push(validationItem("runtime_artifact_desktop_boundary", "desktop_boundary_locked_read_only", runtimeArtifactDesktopBoundary.boundary_status === "locked" && runtimeArtifactDesktopBoundary.read_only === true && runtimeArtifactDesktopBoundary.mutation_allowed === false && runtimeArtifactDesktopBoundary.protected_mutation_execution_allowed === false && runtimeArtifactDesktopBoundary.desktop_source_of_truth === false, "Desktop capture boundary is locked read-only and not source of truth."));
  items.push(validationItem("runtime_artifact_desktop_boundary", "desktop_cannot_apply_or_write_artifacts", runtimeArtifactDesktopBoundary.artifact_write_allowed === false && runtimeArtifactDesktopBoundary.diff_apply_allowed === false && runtimeArtifactDesktopBoundary.stream_write_allowed === false && runtimeArtifactDesktopBoundary.metadata_edit_allowed === false, "Desktop cannot write artifacts, apply diffs, stream logs, or edit metadata."));
  return items;
}

function summarizeRuntimeArtifactCapture(projection, validationItems, validation) {
  const artifactCaptureRecords = projection.artifactCaptureRecords;
  const diffCaptureRecords = projection.diffCaptureRecords;
  const streamCaptureRecords = projection.streamCaptureRecords;
  const metadataCaptureRecords = projection.metadataCaptureRecords;
  const outputArtifactCaptureBindings = projection.outputArtifactCaptureBindings;
  return {
    runtime_artifact_capture_status: validation.valid ? "complete" : "blocked",
    capture_contract_id: "runtime-artifact-capture.default",
    contract_status: "locked",
    capture_authority: CAPTURE_AUTHORITY,
    source_of_truth: "runtime_agentrun_contract_freeze_and_agent_run_ledger",
    output_artifact_binding_required: true,
    generated_file_capture_required: true,
    diff_capture_required: true,
    stdout_stderr_capture_required: true,
    metadata_capture_required: true,
    runtime_self_report_trusted: false,
    artifact_capture_record_count: artifactCaptureRecords.length,
    bound_artifact_capture_count: artifactCaptureRecords.filter((record) => record.output_artifact_binding_status === "bound_to_output_artifact").length,
    generated_file_capture_count: artifactCaptureRecords.filter((record) => record.capture_kind === "generated_file").length,
    diff_capture_record_count: diffCaptureRecords.length,
    bound_diff_capture_count: diffCaptureRecords.filter((record) => record.output_artifact_binding_status === "bound_to_output_artifact").length,
    stream_capture_record_count: streamCaptureRecords.length,
    stdout_capture_count: streamCaptureRecords.filter((record) => record.stream_name === "stdout").length,
    stderr_capture_count: streamCaptureRecords.filter((record) => record.stream_name === "stderr").length,
    bound_stream_capture_count: streamCaptureRecords.filter((record) => record.output_artifact_binding_status === "bound_to_output_artifact").length,
    metadata_capture_record_count: metadataCaptureRecords.length,
    bound_metadata_capture_count: metadataCaptureRecords.filter((record) => record.output_artifact_binding_status === "bound_to_output_artifact").length,
    output_artifact_capture_binding_count: outputArtifactCaptureBindings.length,
    bound_output_artifact_capture_binding_count: outputArtifactCaptureBindings.filter((binding) => binding.binding_status === "bound").length,
    unbound_output_artifact_capture_binding_count: outputArtifactCaptureBindings.filter((binding) => binding.binding_status !== "bound").length,
    desktop_surface_policy: "read_only_runtime_artifact_status",
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_protected_mutation_request_allowed: false,
    desktop_protected_mutation_execution_allowed: false,
    desktop_source_of_truth: false,
    artifact_write_allowed: false,
    diff_apply_allowed: false,
    stream_write_allowed: false,
    metadata_edit_allowed: false,
    protected_mutation_route: PROTECTED_MUTATION_ROUTE,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_runtime_id: countBy(artifactCaptureRecords, "runtime_id"),
    by_artifact_type: countBy(artifactCaptureRecords, "artifact_type"),
    by_capture_kind: countBy(artifactCaptureRecords, "capture_kind"),
  };
}

function renderRuntimeArtifactCaptureMarkdown(result) {
  const lines = [];
  lines.push("# Runtime Artifact Capture");
  lines.push("");
  lines.push(`- Status: ${result.summary.runtime_artifact_capture_status}`);
  lines.push(`- Artifact captures: ${result.summary.bound_artifact_capture_count}/${result.summary.artifact_capture_record_count}`);
  lines.push(`- Diff captures: ${result.summary.bound_diff_capture_count}/${result.summary.diff_capture_record_count}`);
  lines.push(`- Stream captures: ${result.summary.bound_stream_capture_count}/${result.summary.stream_capture_record_count}`);
  lines.push(`- Metadata captures: ${result.summary.bound_metadata_capture_count}/${result.summary.metadata_capture_record_count}`);
  lines.push(`- Desktop: ${result.summary.desktop_surface_policy}, mutation_allowed=${result.summary.desktop_mutation_allowed}`);
  lines.push("");
  lines.push("## Validation");
  for (const item of result.validation_items) {
    lines.push(`- ${item.status}: ${item.path} (${item.check}) - ${item.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function classifyArtifactCaptureKind(artifactType) {
  if (["diff", "patch"].includes(artifactType)) return "diff_material";
  return "generated_file";
}

function serializableRuntimeArtifactCapture(result) {
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

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const rawKey = keyFn(item);
    if (rawKey === undefined || rawKey === null || rawKey === "") continue;
    const keys = Array.isArray(rawKey) ? rawKey : [rawKey];
    for (const key of keys) {
      if (key === undefined || key === null || key === "") continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
  }
  return groups;
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
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") args.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--agent-run-ledger") args.agentRunLedgerPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") args.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--claude-code-adapter-contract") args.claudeCodeAdapterContractPath = argv[++index];
    else if (arg === "--codex-adapter-contract") args.codexAdapterContractPath = argv[++index];
    else if (arg === "--secrets-broker-contract") args.secretsBrokerContractPath = argv[++index];
    else if (arg === "--desktop-companion-integration") args.desktopCompanionIntegrationPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/runtime-artifact-capture.mjs [options]

Options:
  --check                                fail when validation has errors.
  --no-write                             build without writing artifacts.
  --out-dir <path>                       output directory.
  --runtime-agentrun-contract-freeze <path>
                                         runtime-agentrun-contract-freeze.json path.
  --agent-run-ledger <path>              agent-run-ledger.json path.
  --output-delivery-contract-freeze <path>
                                         output-delivery-contract-freeze.json path.
  --claude-code-adapter-contract <path>  claude-code-adapter-contract.json path.
  --codex-adapter-contract <path>        codex-adapter-contract.json path.
  --secrets-broker-contract <path>       secrets-broker-contract.json path.
  --desktop-companion-integration <path> desktop companion integration doc path.
`);
}
