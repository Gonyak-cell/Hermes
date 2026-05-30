import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DOCUMENT_RENDERER_ADAPTER_OUT_DIR = "artifacts/document-renderer-adapter/latest";
export const DEFAULT_DOCUMENT_RENDERER_ADAPTER_INPUTS = {
  runtimeAdapterInterfaceV2Path: "artifacts/runtime-adapter-interface-v2/latest/runtime-adapter-interface-v2.json",
  runtimeAgentRunContractFreezePath: "artifacts/runtime-agentrun-contract-freeze/latest/runtime-agentrun-contract-freeze.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  workflowGateFreezePath: "artifacts/workflow-gate-freeze/latest/workflow-gate-freeze.json",
  desktopCompanionIntegrationPath: "docs/desktop-companion-integration.md",
};

const DOCUMENT_RENDERER_RUNTIME_ID = "document_renderer";
const REQUIRED_RENDER_TARGETS = ["docx", "pptx", "pdf"];

export async function runDocumentRendererAdapter(options = {}) {
  const result = await buildDocumentRendererAdapter(options);
  if (options.write !== false) await writeDocumentRendererAdapter(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Document renderer adapter validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDocumentRendererAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DOCUMENT_RENDERER_ADAPTER_OUT_DIR);
  const inputs = {
    runtime_adapter_interface_v2_path: path.resolve(options.runtimeAdapterInterfaceV2Path ?? DEFAULT_DOCUMENT_RENDERER_ADAPTER_INPUTS.runtimeAdapterInterfaceV2Path),
    runtime_agentrun_contract_freeze_path: path.resolve(options.runtimeAgentRunContractFreezePath ?? DEFAULT_DOCUMENT_RENDERER_ADAPTER_INPUTS.runtimeAgentRunContractFreezePath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_DOCUMENT_RENDERER_ADAPTER_INPUTS.agentRunLedgerPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_DOCUMENT_RENDERER_ADAPTER_INPUTS.outputDeliveryContractFreezePath),
    workflow_gate_freeze_path: path.resolve(options.workflowGateFreezePath ?? DEFAULT_DOCUMENT_RENDERER_ADAPTER_INPUTS.workflowGateFreezePath),
    desktop_companion_integration_path: path.resolve(options.desktopCompanionIntegrationPath ?? DEFAULT_DOCUMENT_RENDERER_ADAPTER_INPUTS.desktopCompanionIntegrationPath),
  };

  const runtimeAdapterInterfaceV2 = await readJson(inputs.runtime_adapter_interface_v2_path);
  const runtimeAgentRunContractFreeze = await readJson(inputs.runtime_agentrun_contract_freeze_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const outputDeliveryContractFreeze = await readJson(inputs.output_delivery_contract_freeze_path);
  const workflowGateFreeze = await readJson(inputs.workflow_gate_freeze_path);
  const desktopCompanionIntegration = await readFile(inputs.desktop_companion_integration_path, "utf8");

  const projection = projectDocumentRendererAdapter({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    outputDeliveryContractFreeze,
    workflowGateFreeze,
    desktopCompanionIntegration,
    generatedAt,
  });
  const validationItems = validateDocumentRendererAdapter({
    runtimeAdapterInterfaceV2,
    runtimeAgentRunContractFreeze,
    agentRunLedger,
    outputDeliveryContractFreeze,
    workflowGateFreeze,
    desktopCompanionIntegration,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "document-renderer-adapter.v1",
    generated_at: generatedAt,
    adapter_projection_id: `document-renderer-adapter.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: buildSourceContracts({
      runtimeAdapterInterfaceV2,
      runtimeAgentRunContractFreeze,
      agentRunLedger,
      outputDeliveryContractFreeze,
      workflowGateFreeze,
      desktopCompanionIntegration,
      desktopCompanionIntegrationPath: inputs.desktop_companion_integration_path,
      projection,
    }),
    document_renderer_adapter_contract: projection.documentRendererAdapterContract,
    document_renderer_output_contracts: projection.documentRendererOutputContracts,
    document_renderer_agent_run_ledger_bindings: projection.documentRendererAgentRunLedgerBindings,
    document_renderer_desktop_boundary: projection.documentRendererDesktopBoundary,
    summary: summarizeDocumentRendererAdapter(projection, validationItems, validation),
    validation_items: validationItems,
    validation,
    markdown: "",
  };
  return {
    ...result,
    markdown: renderDocumentRendererAdapterMarkdown(result),
  };
}

export async function writeDocumentRendererAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDocumentRendererAdapter(result);
  await writeJson(path.join(outDir, "document-renderer-adapter.json"), serializable);
  await writeJson(path.join(outDir, "document-renderer-output-contracts.json"), {
    schema_version: "document-renderer-output-contracts.v1",
    generated_at: result.generated_at,
    contract_count: result.document_renderer_output_contracts.length,
    document_renderer_output_contracts: result.document_renderer_output_contracts,
  });
  await writeJson(path.join(outDir, "document-renderer-agent-run-ledger-bindings.json"), {
    schema_version: "document-renderer-agent-run-ledger-bindings.v1",
    generated_at: result.generated_at,
    binding_count: result.document_renderer_agent_run_ledger_bindings.length,
    document_renderer_agent_run_ledger_bindings: result.document_renderer_agent_run_ledger_bindings,
  });
  await writeJson(path.join(outDir, "document-renderer-desktop-boundary.json"), result.document_renderer_desktop_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "document-renderer-adapter-validation-report.v1",
    generated_at: result.generated_at,
    adapter_projection_id: result.adapter_projection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDocumentRendererAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runDocumentRendererAdapter(args);
    console.log(`Document renderer adapter written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.document_renderer_adapter_status}`);
    console.log(`AgentRun ledger bound: ${result.summary.agent_run_ledger_bound}`);
    console.log(`Output contracts: ${result.summary.output_contract_count}`);
    console.log(`Render targets: ${result.summary.required_render_targets.join(", ")}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectDocumentRendererAdapter({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  outputDeliveryContractFreeze,
  workflowGateFreeze,
  desktopCompanionIntegration,
  generatedAt,
}) {
  const interfaceContract = runtimeAdapterInterfaceV2.runtime_adapter_interface_contract ?? {};
  const rendererInterface = (interfaceContract.runtime_adapter_interfaces ?? []).find((item) => item.runtime_id === DOCUMENT_RENDERER_RUNTIME_ID) ?? null;
  const rendererOperatorPolicy = (interfaceContract.operator_surface_policies ?? []).find((item) => item.runtime_id === DOCUMENT_RENDERER_RUNTIME_ID) ?? null;
  const runtimeContract = runtimeAgentRunContractFreeze.runtime_agentrun_contract ?? {};
  const rendererRuntimeAdapter = (runtimeContract.runtime_adapters ?? []).find((item) => item.runtime_id === DOCUMENT_RENDERER_RUNTIME_ID) ?? null;
  const rendererRuntimeExecutionContract = (runtimeContract.runtime_execution_contracts ?? []).find((item) => item.runtime_id === DOCUMENT_RENDERER_RUNTIME_ID) ?? null;
  const rendererAgentRunContracts = (runtimeContract.agent_runs ?? []).filter((item) => item.runtime_id === DOCUMENT_RENDERER_RUNTIME_ID);
  const agentRunRecords = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const rendererAgentRunRecords = agentRunRecords.filter((record) => record.runtime_id === DOCUMENT_RENDERER_RUNTIME_ID);
  const outputDeliveryContract = outputDeliveryContractFreeze.output_delivery_contract ?? {};
  const outputArtifacts = outputDeliveryContract.output_artifacts ?? [];
  const deliveryActions = outputDeliveryContract.delivery_actions ?? [];
  const outputDeliveryBindings = outputDeliveryContract.output_delivery_bindings ?? [];
  const workflowGateVerticalSlices = workflowGateFreeze.workflow_gate_vertical_slices ?? [];
  const supportedRenderTargets = unique([
    ...(rendererRuntimeAdapter?.output_contract?.artifact_types ?? []),
    ...(rendererInterface?.output_artifact_types ?? []),
  ]);
  const requiredGates = unique([
    ...(rendererRuntimeAdapter?.tool_policy?.required_gates ?? []),
    ...(rendererRuntimeAdapter?.verification?.required_gates ?? []),
    "human_approval_gate",
  ]);
  const documentRendererAdapterContract = {
    schema_version: "document-renderer-adapter-contract.v1",
    generated_at: generatedAt,
    contract_id: "document-renderer-adapter.default",
    runtime_id: DOCUMENT_RENDERER_RUNTIME_ID,
    adapter_id: rendererRuntimeAdapter?.adapter_id ?? "runtime.document_renderer.default",
    adapter_interface_id: rendererInterface?.interface_id ?? null,
    runtime_execution_contract_id: rendererRuntimeExecutionContract?.execution_contract_id ?? rendererInterface?.execution_contract_id ?? null,
    command_binding_id: rendererRuntimeExecutionContract?.command_binding_id ?? null,
    command_binding_required: false,
    adapter_status: "locked",
    execution_authority: "harness_control_plane",
    source_of_truth: "agent_run_ledger",
    output_trust: rendererRuntimeAdapter?.output_trust ?? rendererInterface?.output_trust ?? "draft_only",
    verification_required: rendererRuntimeAdapter?.verification_required ?? rendererInterface?.verification_required ?? true,
    supported_render_targets: supportedRenderTargets,
    required_render_targets: REQUIRED_RENDER_TARGETS,
    renderer_execution_policy: {
      schema_version: "document-renderer-execution-policy.v1",
      execution_mode: rendererRuntimeExecutionContract?.execution_mode ?? "docker",
      network_policy: rendererRuntimeExecutionContract?.network_policy ?? "disabled",
      network_access_allowed: false,
      external_execution_allowed: false,
      sandbox_required: rendererRuntimeExecutionContract?.sandbox_required === true,
      workspace_isolation_type: rendererRuntimeExecutionContract?.workspace_isolation_type ?? "docker_container",
      dirty_checkout_policy: rendererRuntimeExecutionContract?.dirty_checkout_policy ?? "not_applicable",
      cleanup_policy: rendererRuntimeExecutionContract?.cleanup_policy ?? "retain_for_audit",
      direct_final_delivery_allowed: false,
      protected_path_write_allowed: false,
      secret_material_allowed: false,
      runtime_self_report_trusted: false,
      draft_only_output_required: true,
      output_hash_required: rendererRuntimeAdapter?.observability?.output_hash_required ?? rendererInterface?.output_hash_required ?? true,
      log_capture_required: rendererRuntimeAdapter?.logs_required ?? rendererInterface?.logs_required ?? true,
      artifact_capture_required: rendererRuntimeAdapter?.artifact_capture_required ?? rendererInterface?.artifact_capture_required ?? true,
      docx_target_supported: supportedRenderTargets.includes("docx"),
      pptx_target_supported: supportedRenderTargets.includes("pptx"),
      pdf_target_supported: supportedRenderTargets.includes("pdf"),
      format_validation_required: requiredGates.includes("format_validation_gate"),
      citation_gate_required: requiredGates.includes("citation_gate"),
      human_approval_gate_required: requiredGates.includes("human_approval_gate"),
      timeout_seconds: rendererRuntimeExecutionContract?.timeout_seconds ?? rendererRuntimeAdapter?.lifecycle?.timeout_seconds ?? 1800,
    },
    gate_policy: {
      schema_version: "document-renderer-gate-policy.v1",
      mutation_route: "protected_action_request_only",
      acceptance_authority: rendererRuntimeAdapter?.verification?.acceptance_authority ?? "gate_engine",
      required_gates: requiredGates,
      classification_gate_required: requiredGates.includes("classification_gate"),
      tool_permission_gate_required: requiredGates.includes("tool_permission_gate"),
      evidence_coverage_gate_required: requiredGates.includes("evidence_coverage_gate"),
      citation_gate_required: requiredGates.includes("citation_gate"),
      format_validation_gate_required: requiredGates.includes("format_validation_gate"),
      human_approval_gate_required: requiredGates.includes("human_approval_gate"),
      bypass_allowed: false,
      gate_binding_status: "ready",
    },
    collection_policy: buildCollectionPolicy({
      rendererRuntimeAdapter,
      rendererInterface,
      agentRunLedger,
    }),
    desktop_boundary_ref: "document-renderer-desktop-boundary.document_renderer",
  };
  const documentRendererOutputContracts = rendererAgentRunContracts.map((contract) => buildOutputContract({
    contract,
    documentRendererAdapterContract,
    matchingRecord: rendererAgentRunRecords.find((record) => record.agent_run_id === contract.agent_run_id),
    outputArtifacts,
    deliveryActions,
    outputDeliveryBindings,
    workflowGateVerticalSlices,
    generatedAt,
  }));
  const documentRendererAgentRunLedgerBindings = [
    buildAgentRunLedgerBinding({
      documentRendererAdapterContract,
      agentRunLedger,
      rendererAgentRunRecords,
      documentRendererOutputContracts,
      generatedAt,
    }),
  ];
  const documentRendererDesktopBoundary = buildDesktopBoundary({
    rendererOperatorPolicy,
    desktopCompanionIntegration,
    generatedAt,
  });
  return {
    rendererInterface,
    rendererOperatorPolicy,
    rendererRuntimeAdapter,
    rendererRuntimeExecutionContract,
    rendererAgentRunContracts,
    agentRunRecords,
    rendererAgentRunRecords,
    outputArtifacts,
    deliveryActions,
    outputDeliveryBindings,
    workflowGateVerticalSlices,
    documentRendererAdapterContract,
    documentRendererOutputContracts,
    documentRendererAgentRunLedgerBindings,
    documentRendererDesktopBoundary,
  };
}

function buildCollectionPolicy({ rendererRuntimeAdapter, rendererInterface, agentRunLedger }) {
  return {
    schema_version: "document-renderer-agent-run-collection-policy.v1",
    sink_ledger: "agent_run_ledger",
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? "agent-run-ledger.v1",
    collect_runtime_invocation_id: true,
    collect_workflow_run_id: true,
    collect_input_ref: true,
    collect_output_ref: true,
    collect_output_hash: rendererRuntimeAdapter?.observability?.output_hash_required ?? rendererInterface?.output_hash_required ?? true,
    collect_logs_ref: rendererRuntimeAdapter?.logs_required ?? rendererInterface?.logs_required ?? true,
    collect_artifact_refs: rendererRuntimeAdapter?.artifact_capture_required ?? rendererInterface?.artifact_capture_required ?? true,
    collect_runtime_verification: rendererRuntimeAdapter?.verification_required ?? rendererInterface?.verification_required ?? true,
    collect_output_delivery_bindings: true,
    collect_render_target_matrix: true,
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    collection_status: "ready",
  };
}

function buildOutputContract({
  contract,
  documentRendererAdapterContract,
  matchingRecord,
  outputArtifacts,
  deliveryActions,
  outputDeliveryBindings,
  workflowGateVerticalSlices,
  generatedAt,
}) {
  const contractRuntimeArtifacts = contract.metadata?.runtime_artifacts ?? [];
  const renderedArtifactIds = unique([...(contract.artifact_ids ?? []), ...(matchingRecord?.artifact_ids ?? [])]);
  const renderedArtifacts = uniqueById([
    ...contractRuntimeArtifacts,
    ...outputArtifacts.filter((artifact) => renderedArtifactIds.includes(artifact.output_artifact_id) || artifact.created_by_run_id === contract.agent_run_id),
  ], "artifact_id", "output_artifact_id");
  const renderedArtifactIdSet = new Set(renderedArtifacts.map((artifact) => artifact.artifact_id ?? artifact.output_artifact_id).filter(Boolean));
  const rendererDeliveryBindings = outputDeliveryBindings.filter((binding) => renderedArtifactIdSet.has(binding.output_artifact_id));
  const rendererDeliveryActions = deliveryActions.filter((action) => renderedArtifactIdSet.has(action.output_artifact_id));
  const targetCaptureMatrix = REQUIRED_RENDER_TARGETS.map((target) => {
    const targetArtifacts = renderedArtifacts.filter((artifact) => artifact.artifact_type === target);
    return {
      artifact_type: target,
      supported_by_runtime_contract: documentRendererAdapterContract.supported_render_targets.includes(target),
      current_artifact_ids: targetArtifacts.map((artifact) => artifact.artifact_id ?? artifact.output_artifact_id).filter(Boolean),
      current_artifact_count: targetArtifacts.length,
      artifact_capture_required: true,
      log_capture_required: true,
      output_hash_required: true,
      collection_status: targetArtifacts.length > 0 ? "captured" : "ready",
    };
  });
  const requiredGates = unique([...(contract.required_gates ?? []), ...documentRendererAdapterContract.gate_policy.required_gates]);
  return {
    schema_version: "document-renderer-output-contract.v1",
    generated_at: generatedAt,
    document_renderer_output_contract_id: `document-renderer-output.${normalizeId(contract.agent_run_id)}`,
    runtime_id: DOCUMENT_RENDERER_RUNTIME_ID,
    adapter_id: documentRendererAdapterContract.adapter_id,
    agent_run_id: contract.agent_run_id,
    agent_run_record_id: matchingRecord?.agent_run_record_id ?? null,
    workflow_run_id: contract.workflow_run_id,
    domain_pack: contract.domain_pack,
    capability_id: contract.capability_id,
    renderer_lane: contract.metadata?.source_metadata?.lane ?? "document_renderer",
    execution_mode: documentRendererAdapterContract.renderer_execution_policy.execution_mode,
    network_access_allowed: false,
    external_execution_allowed: false,
    sandbox_required: documentRendererAdapterContract.renderer_execution_policy.sandbox_required,
    workspace_isolation_type: documentRendererAdapterContract.renderer_execution_policy.workspace_isolation_type,
    input_ref: contract.input_ref ?? matchingRecord?.input_ref ?? null,
    output_ref: contract.output_ref ?? matchingRecord?.output_ref ?? null,
    output_hash: contract.output_hash ?? matchingRecord?.output_hash ?? null,
    output_hash_status: contract.output_hash ?? matchingRecord?.output_hash ? "present" : "missing",
    output_trust: contract.output_trust ?? documentRendererAdapterContract.output_trust,
    output_contract_ref: contract.output_contract_ref ?? "governance-output.v1",
    logs_ref: contract.logs_ref ?? matchingRecord?.logs_ref ?? null,
    log_capture_status: contract.log_capture_status ?? matchingRecord?.log_reference_status ?? "unknown",
    artifact_ids: renderedArtifactIds,
    runtime_artifact_ids: matchingRecord?.runtime_artifact_ids ?? [],
    rendered_artifacts: renderedArtifacts.map((artifact) => ({
      artifact_id: artifact.artifact_id ?? artifact.output_artifact_id,
      artifact_type: artifact.artifact_type,
      artifact_uri: artifact.artifact_uri ?? null,
      content_hash: artifact.content_hash ?? null,
      delivery_state: artifact.delivery_state ?? artifact.status ?? null,
      approval_status: artifact.approval_status ?? null,
      created_by_run_id: artifact.created_by_run_id ?? contract.agent_run_id,
    })),
    rendered_artifact_count: renderedArtifacts.length,
    rendered_document_artifact_count: renderedArtifacts.filter((artifact) => REQUIRED_RENDER_TARGETS.includes(artifact.artifact_type)).length,
    target_capture_matrix: targetCaptureMatrix,
    delivery_action_ids: rendererDeliveryActions.map((action) => action.delivery_action_id).filter(Boolean),
    output_delivery_binding_ids: rendererDeliveryBindings.map((binding) => binding.output_delivery_binding_id).filter(Boolean),
    output_delivery_binding_count: rendererDeliveryBindings.length,
    draft_only_delivery_action_count: rendererDeliveryActions.filter((action) => action.draft_only === true || action.delivery_status === "blocked_pending_approval" || action.delivery_status === "blocked_by_gate").length,
    verification_required: contract.verification_required ?? true,
    verification_status: contract.verification_status ?? matchingRecord?.verification_status ?? "unknown",
    required_gates: requiredGates,
    format_validation_gate_required: requiredGates.includes("format_validation_gate"),
    citation_gate_required: requiredGates.includes("citation_gate"),
    human_approval_gate_required: requiredGates.includes("human_approval_gate"),
    acceptance_authority: contract.acceptance_authority ?? "gate_engine",
    direct_final_delivery_allowed: false,
    protected_path_write_allowed: false,
    secret_material_allowed: false,
    runtime_self_report_trusted: false,
    workflow_gate_vertical_slice_refs: workflowGateVerticalSlices
      .filter((slice) => slice.domain_pack === contract.domain_pack || slice.capability_id === contract.capability_id)
      .map((slice) => slice.workflow_gate_vertical_slice_id)
      .filter(Boolean),
    contract_status: "locked",
  };
}

function buildAgentRunLedgerBinding({
  documentRendererAdapterContract,
  agentRunLedger,
  rendererAgentRunRecords,
  documentRendererOutputContracts,
  generatedAt,
}) {
  return {
    schema_version: "document-renderer-agent-run-ledger-binding.v1",
    generated_at: generatedAt,
    binding_id: "document-renderer-agent-run-ledger-binding.default",
    runtime_id: DOCUMENT_RENDERER_RUNTIME_ID,
    adapter_id: documentRendererAdapterContract.adapter_id,
    command_binding_id: documentRendererAdapterContract.command_binding_id,
    sink_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
    sink_ledger_contract_id: agentRunLedger.summary?.agent_run_ledger_contract_id ?? null,
    sink_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    current_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    current_document_renderer_agent_run_record_count: rendererAgentRunRecords.length,
    output_contract_count: documentRendererOutputContracts.length,
    rendered_artifact_count: sum(documentRendererOutputContracts, "rendered_artifact_count"),
    rendered_document_artifact_count: sum(documentRendererOutputContracts, "rendered_document_artifact_count"),
    output_delivery_binding_count: sum(documentRendererOutputContracts, "output_delivery_binding_count"),
    collection_status: "ready",
    output_capture_status: "ready",
    log_capture_status: "ready",
    artifact_capture_status: "ready",
    verification_capture_status: "ready",
    output_delivery_binding_capture_status: "ready",
    ledger_write_owner: "harness_control_plane",
    runtime_self_report_trusted: false,
    binding_status: "locked",
  };
}

function buildDesktopBoundary({ rendererOperatorPolicy, desktopCompanionIntegration, generatedAt }) {
  return {
    schema_version: "document-renderer-desktop-boundary.v1",
    generated_at: generatedAt,
    desktop_boundary_id: "document-renderer-desktop-boundary.document_renderer",
    runtime_id: DOCUMENT_RENDERER_RUNTIME_ID,
    desktop_surface_policy: rendererOperatorPolicy?.desktop_surface_policy ?? "read_only_runtime_status",
    source_of_truth: "harness_control_plane",
    runtime_source_of_truth: false,
    desktop_source_of_truth: false,
    read_only: true,
    mutation_allowed: false,
    protected_mutation_request_allowed: false,
    protected_mutation_execution_allowed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    auto_update_control: false,
    skill_install_control: false,
    allowed_operator_actions: rendererOperatorPolicy?.allowed_operator_actions ?? ["view_status", "view_logs", "view_artifacts", "view_verification", "draft_receipt_reference"],
    denied_operator_actions: unique([
      ...(rendererOperatorPolicy?.denied_operator_actions ?? []),
      "execute_runtime",
      "approve_protected_mutation",
      "write_secret",
      "start_gateway",
      "schedule_cron",
    ]),
    human_gate_required_for_execution: true,
    protected_mutation_route: "receipt_draft_or_human_gate_only",
    integration_doc_declares_read_only: desktopCompanionIntegration.includes("읽기 전용") || desktopCompanionIntegration.includes("read_only=true"),
    boundary_status: "locked",
  };
}

function buildSourceContracts({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  outputDeliveryContractFreeze,
  workflowGateFreeze,
  desktopCompanionIntegration,
  desktopCompanionIntegrationPath,
  projection,
}) {
  return {
    runtime_adapter_interface_v2: {
      schema_version: runtimeAdapterInterfaceV2.schema_version ?? null,
      runtime_adapter_interface_status: runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status ?? "unknown",
      document_renderer_interface_status: projection.rendererInterface?.interface_status ?? "missing",
      document_renderer_operator_surface_policy_status: projection.rendererOperatorPolicy?.policy_status ?? "missing",
      document_renderer_supported_render_targets: projection.documentRendererAdapterContract.supported_render_targets,
    },
    runtime_agentrun_contract_freeze: {
      schema_version: runtimeAgentRunContractFreeze.schema_version ?? null,
      freeze_status: runtimeAgentRunContractFreeze.summary?.freeze_status ?? "unknown",
      document_renderer_runtime_adapter_found: Boolean(projection.rendererRuntimeAdapter),
      document_renderer_runtime_execution_contract_found: Boolean(projection.rendererRuntimeExecutionContract),
      current_document_renderer_agent_run_contract_count: projection.rendererAgentRunContracts.length,
    },
    agent_run_ledger: {
      schema_version: agentRunLedger.schema_version ?? null,
      agent_run_ledger_id: agentRunLedger.agent_run_ledger_id ?? null,
      agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
      agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
      current_document_renderer_agent_run_record_count: projection.rendererAgentRunRecords.length,
    },
    output_delivery_contract_freeze: {
      schema_version: outputDeliveryContractFreeze.schema_version ?? null,
      freeze_status: outputDeliveryContractFreeze.summary?.freeze_status ?? "unknown",
      output_artifact_count: outputDeliveryContractFreeze.summary?.output_artifact_count ?? 0,
      renderer_output_artifact_count: projection.documentRendererOutputContracts.reduce((total, contract) => total + contract.rendered_artifact_count, 0),
      renderer_output_delivery_binding_count: projection.documentRendererOutputContracts.reduce((total, contract) => total + contract.output_delivery_binding_count, 0),
    },
    workflow_gate_freeze: {
      schema_version: workflowGateFreeze.schema_version ?? null,
      workflow_gate_freeze_status: workflowGateFreeze.summary?.workflow_gate_freeze_status ?? "unknown",
      workflow_gate_vertical_slice_count: workflowGateFreeze.summary?.workflow_gate_vertical_slice_count ?? 0,
    },
    desktop_companion_integration: {
      document_path: desktopCompanionIntegrationPath,
      declares_read_only: desktopCompanionIntegration.includes("읽기 전용") || desktopCompanionIntegration.includes("read_only=true"),
      declares_not_runtime_source_of_truth: desktopCompanionIntegration.includes("source of truth가 아니라") || desktopCompanionIntegration.includes("not a runtime"),
    },
  };
}

function validateDocumentRendererAdapter({
  runtimeAdapterInterfaceV2,
  runtimeAgentRunContractFreeze,
  agentRunLedger,
  outputDeliveryContractFreeze,
  workflowGateFreeze,
  desktopCompanionIntegration,
  rendererInterface,
  rendererOperatorPolicy,
  rendererRuntimeAdapter,
  rendererRuntimeExecutionContract,
  rendererAgentRunContracts,
  documentRendererAdapterContract,
  documentRendererOutputContracts,
  documentRendererAgentRunLedgerBindings,
  documentRendererDesktopBoundary,
}) {
  const items = [];
  const supportedTargets = documentRendererAdapterContract.supported_render_targets ?? [];
  const outputContractCount = documentRendererOutputContracts.length;
  items.push(validationItem("source.runtime_adapter_interface_v2", "runtime_adapter_interface_v2_complete", runtimeAdapterInterfaceV2.summary?.runtime_adapter_interface_status === "complete", "Runtime Adapter Interface v2 is complete."));
  items.push(validationItem("source.runtime_agentrun_contract_freeze", "runtime_agentrun_contract_freeze_complete", runtimeAgentRunContractFreeze.summary?.freeze_status === "complete", "Runtime/AgentRun contract freeze is complete."));
  items.push(validationItem("source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete", "AgentRun ledger is available as the Document Renderer result sink."));
  items.push(validationItem("source.output_delivery_contract_freeze", "output_delivery_contract_freeze_complete", outputDeliveryContractFreeze.summary?.freeze_status === "complete", "Output Delivery contract freeze is complete."));
  items.push(validationItem("source.workflow_gate_freeze", "workflow_gate_freeze_complete", workflowGateFreeze.summary?.workflow_gate_freeze_status === "complete", "Workflow/Gate freeze is complete."));
  items.push(validationItem("source.desktop_companion_integration", "desktop_companion_boundary_documented", desktopCompanionIntegration.includes("source of truth가 아니라") && desktopCompanionIntegration.includes("읽기 전용"), "Desktop companion boundary is documented as read-only and not source of truth."));
  items.push(validationItem("document_renderer.interface", "document_renderer_interface_locked", rendererInterface?.interface_status === "locked", "Document Renderer runtime interface is locked."));
  items.push(validationItem("document_renderer.interface", "document_renderer_output_trust_draft_only", rendererInterface?.output_trust === "draft_only", "Document Renderer output trust is draft-only."));
  items.push(validationItem("document_renderer.interface", "document_renderer_required_targets_supported", REQUIRED_RENDER_TARGETS.every((target) => supportedTargets.includes(target)), "Document Renderer supports DOCX, PPTX, and PDF render targets."));
  items.push(validationItem("document_renderer.runtime_contract", "document_renderer_runtime_adapter_found", Boolean(rendererRuntimeAdapter), "Document Renderer runtime adapter exists in Runtime/AgentRun freeze."));
  items.push(validationItem("document_renderer.runtime_contract", "document_renderer_execution_contract_found", Boolean(rendererRuntimeExecutionContract), "Document Renderer runtime execution contract exists."));
  items.push(validationItem("document_renderer.runtime_contract", "document_renderer_network_disabled", rendererRuntimeExecutionContract?.network_policy === "disabled" && rendererRuntimeExecutionContract?.external_execution === false, "Document Renderer execution has network disabled and no external execution."));
  items.push(validationItem("document_renderer.runtime_contract", "document_renderer_docker_isolation", rendererRuntimeExecutionContract?.workspace_isolation_type === "docker_container", "Document Renderer uses docker container isolation."));
  items.push(validationItem("document_renderer.command_binding", "document_renderer_command_binding_not_required", rendererRuntimeExecutionContract?.command_availability_status === "not_required" && !rendererRuntimeExecutionContract?.command_binding_id, "Document Renderer has no direct desktop command binding requirement."));
  items.push(validationItem("document_renderer.adapter_contract", "document_renderer_adapter_contract_locked", documentRendererAdapterContract.adapter_status === "locked", "Document Renderer adapter contract is locked."));
  items.push(validationItem("document_renderer.adapter_contract", "document_renderer_no_network_or_external_execution", documentRendererAdapterContract.renderer_execution_policy.network_access_allowed === false && documentRendererAdapterContract.renderer_execution_policy.external_execution_allowed === false, "Document Renderer cannot use network or external execution."));
  items.push(validationItem("document_renderer.adapter_contract", "document_renderer_no_direct_delivery_or_protected_writes", documentRendererAdapterContract.renderer_execution_policy.direct_final_delivery_allowed === false && documentRendererAdapterContract.renderer_execution_policy.protected_path_write_allowed === false, "Document Renderer cannot directly deliver final outputs or write protected paths."));
  items.push(validationItem("document_renderer.adapter_contract", "document_renderer_agent_run_ledger_sink_required", documentRendererAdapterContract.collection_policy.sink_ledger === "agent_run_ledger" && documentRendererAdapterContract.collection_policy.collect_output_delivery_bindings === true, "Document Renderer outputs and delivery bindings are collected into ledger references."));
  items.push(validationItem("document_renderer.output_contracts", "document_renderer_output_contracts_materialized", outputContractCount === rendererAgentRunContracts.length && outputContractCount >= 1, "Document Renderer output contracts are materialized for current AgentRun contracts."));
  items.push(validationItem("document_renderer.output_contracts", "document_renderer_output_contracts_locked", documentRendererOutputContracts.every((contract) => contract.contract_status === "locked"), "Document Renderer output contracts are locked."));
  items.push(validationItem("document_renderer.output_contracts", "document_renderer_output_capture_ready", documentRendererOutputContracts.every((contract) => contract.output_hash_status === "present" && contract.log_capture_status === "captured" && contract.rendered_artifact_count >= 1), "Document Renderer output contracts capture output hash, logs, and artifacts."));
  items.push(validationItem("document_renderer.output_contracts", "document_renderer_required_target_matrix_ready", documentRendererOutputContracts.every((contract) => contract.target_capture_matrix.every((target) => target.supported_by_runtime_contract === true && ["captured", "ready"].includes(target.collection_status))), "Document Renderer output contracts declare DOCX/PPTX/PDF capture readiness."));
  items.push(validationItem("document_renderer.output_contracts", "document_renderer_delivery_bindings_collected", documentRendererOutputContracts.every((contract) => contract.output_delivery_binding_count >= contract.rendered_document_artifact_count), "Document Renderer rendered document artifacts are bound to output delivery records."));
  items.push(validationItem("document_renderer.output_contracts", "document_renderer_human_approval_gate_required", documentRendererOutputContracts.every((contract) => contract.human_approval_gate_required === true), "Document Renderer output contracts require human approval."));
  items.push(validationItem("document_renderer.agent_run_ledger_binding", "document_renderer_agent_run_ledger_binding_locked", documentRendererAgentRunLedgerBindings.every((binding) => binding.binding_status === "locked" && binding.collection_status === "ready"), "Document Renderer AgentRun ledger binding is locked."));
  items.push(validationItem("document_renderer.desktop_boundary", "desktop_read_only", documentRendererDesktopBoundary.read_only === true && documentRendererDesktopBoundary.mutation_allowed === false, "Document Renderer Desktop surface is read-only."));
  items.push(validationItem("document_renderer.desktop_boundary", "desktop_not_runtime_source_of_truth", documentRendererDesktopBoundary.runtime_source_of_truth === false && documentRendererDesktopBoundary.desktop_source_of_truth === false, "Desktop is not a runtime or source of truth for Document Renderer."));
  items.push(validationItem("document_renderer.desktop_boundary", "desktop_sensitive_controls_absent", documentRendererDesktopBoundary.secret_material_exposed === false && documentRendererDesktopBoundary.installer_or_gateway_control === false && documentRendererDesktopBoundary.ssh_or_cron_control === false && documentRendererDesktopBoundary.skill_install_control === false, "Desktop exposes no secrets, installer, gateway, SSH, cron, or skill-install controls."));
  items.push(validationItem("document_renderer.operator_policy", "operator_policy_read_only", rendererOperatorPolicy?.read_only === true && rendererOperatorPolicy?.runtime_source_of_truth === false, "Document Renderer operator policy remains read-only and not source of truth."));
  return items;
}

function summarizeDocumentRendererAdapter(projection, validationItems, validation) {
  const boundary = projection.documentRendererDesktopBoundary;
  const binding = projection.documentRendererAgentRunLedgerBindings[0] ?? {};
  const policy = projection.documentRendererAdapterContract.renderer_execution_policy;
  const gatePolicy = projection.documentRendererAdapterContract.gate_policy;
  const outputContracts = projection.documentRendererOutputContracts;
  const targetCounts = countRenderedTargets(outputContracts);
  return {
    document_renderer_adapter_status: validation.valid ? "complete" : "attention",
    runtime_id: DOCUMENT_RENDERER_RUNTIME_ID,
    adapter_id: projection.documentRendererAdapterContract.adapter_id,
    adapter_status: projection.documentRendererAdapterContract.adapter_status,
    document_renderer_interface_bound: Boolean(projection.rendererInterface),
    document_renderer_runtime_execution_contract_bound: Boolean(projection.rendererRuntimeExecutionContract),
    document_renderer_command_binding_required: projection.documentRendererAdapterContract.command_binding_required,
    command_binding_id: projection.documentRendererAdapterContract.command_binding_id,
    agent_run_ledger_bound: binding.sink_ledger_status === "complete",
    agent_run_ledger_status: binding.sink_ledger_status ?? "unknown",
    current_agent_run_record_count: binding.current_agent_run_record_count ?? 0,
    current_document_renderer_agent_run_record_count: binding.current_document_renderer_agent_run_record_count ?? 0,
    output_contract_count: outputContracts.length,
    output_contract_locked_count: outputContracts.filter((contract) => contract.contract_status === "locked").length,
    supported_render_targets: projection.documentRendererAdapterContract.supported_render_targets,
    required_render_targets: projection.documentRendererAdapterContract.required_render_targets,
    docx_target_supported: policy.docx_target_supported,
    pptx_target_supported: policy.pptx_target_supported,
    pdf_target_supported: policy.pdf_target_supported,
    rendered_artifact_count: binding.rendered_artifact_count ?? 0,
    rendered_document_artifact_count: binding.rendered_document_artifact_count ?? 0,
    rendered_docx_artifact_count: targetCounts.docx ?? 0,
    rendered_pptx_artifact_count: targetCounts.pptx ?? 0,
    rendered_pdf_artifact_count: targetCounts.pdf ?? 0,
    output_delivery_binding_count: binding.output_delivery_binding_count ?? 0,
    output_hash_present_count: outputContracts.filter((contract) => contract.output_hash_status === "present").length,
    log_capture_ready_count: outputContracts.filter((contract) => contract.log_capture_status === "captured").length,
    artifact_capture_ready_count: outputContracts.filter((contract) => contract.rendered_artifact_count >= 1).length,
    target_capture_matrix_ready_count: outputContracts.filter((contract) => contract.target_capture_matrix.every((target) => ["captured", "ready"].includes(target.collection_status))).length,
    draft_only_delivery_action_count: sum(outputContracts, "draft_only_delivery_action_count"),
    network_access_allowed: policy.network_access_allowed,
    external_execution_allowed: policy.external_execution_allowed,
    sandbox_required: policy.sandbox_required,
    workspace_isolation_type: policy.workspace_isolation_type,
    direct_final_delivery_allowed: policy.direct_final_delivery_allowed,
    protected_path_write_allowed: policy.protected_path_write_allowed,
    secret_material_allowed: policy.secret_material_allowed,
    runtime_self_report_trusted: policy.runtime_self_report_trusted,
    draft_only_output_required: policy.draft_only_output_required,
    output_trust: projection.documentRendererAdapterContract.output_trust,
    verification_required: projection.documentRendererAdapterContract.verification_required,
    classification_gate_required: gatePolicy.classification_gate_required,
    tool_permission_gate_required: gatePolicy.tool_permission_gate_required,
    evidence_coverage_gate_required: gatePolicy.evidence_coverage_gate_required,
    citation_gate_required: gatePolicy.citation_gate_required,
    format_validation_gate_required: gatePolicy.format_validation_gate_required,
    human_review_required: gatePolicy.human_approval_gate_required,
    gate_binding_status: gatePolicy.gate_binding_status,
    output_capture_ready: binding.output_capture_status === "ready",
    log_capture_ready: binding.log_capture_status === "ready",
    artifact_capture_ready: binding.artifact_capture_status === "ready",
    verification_capture_ready: binding.verification_capture_status === "ready",
    output_delivery_binding_capture_ready: binding.output_delivery_binding_capture_status === "ready",
    desktop_surface_policy: boundary.desktop_surface_policy,
    desktop_read_only: boundary.read_only,
    desktop_mutation_allowed: boundary.mutation_allowed,
    desktop_protected_mutation_request_allowed: boundary.protected_mutation_request_allowed,
    desktop_protected_mutation_execution_allowed: boundary.protected_mutation_execution_allowed,
    desktop_secret_material_exposed: boundary.secret_material_exposed,
    desktop_installer_or_gateway_control: boundary.installer_or_gateway_control,
    desktop_runtime_source_of_truth: boundary.runtime_source_of_truth,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
  };
}

function countRenderedTargets(outputContracts) {
  const counts = {};
  for (const contract of outputContracts) {
    for (const artifact of contract.rendered_artifacts ?? []) {
      counts[artifact.artifact_type] = (counts[artifact.artifact_type] ?? 0) + 1;
    }
  }
  return counts;
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

function validationItem(pathName, check, passed, message) {
  return {
    path: pathName,
    check,
    status: passed ? "passed" : "failed",
    message,
  };
}

function renderDocumentRendererAdapterMarkdown(result) {
  const summary = result.summary;
  return [
    "# Document Renderer Adapter",
    "",
    `- Status: ${summary.document_renderer_adapter_status}`,
    `- Runtime: ${summary.runtime_id}`,
    `- Adapter: ${summary.adapter_id}`,
    `- Interface bound: ${summary.document_renderer_interface_bound}`,
    `- AgentRun ledger bound: ${summary.agent_run_ledger_bound}`,
    `- Current Document Renderer AgentRun records: ${summary.current_document_renderer_agent_run_record_count}`,
    `- Output contracts: ${summary.output_contract_count}`,
    `- Required render targets: ${summary.required_render_targets.join(", ")}`,
    `- Rendered artifacts: ${summary.rendered_artifact_count}`,
    `- Output delivery bindings: ${summary.output_delivery_binding_count}`,
    `- Output trust: ${summary.output_trust}`,
    `- Network access allowed: ${summary.network_access_allowed}`,
    `- Draft-only output required: ${summary.draft_only_output_required}`,
    `- Desktop read-only: ${summary.desktop_read_only}`,
    `- Desktop runtime source of truth: ${summary.desktop_runtime_source_of_truth}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
  ].join("\n");
}

function serializableDocumentRendererAdapter(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_DOCUMENT_RENDERER_ADAPTER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--runtime-adapter-interface-v2") parsed.runtimeAdapterInterfaceV2Path = argv[++index];
    else if (arg === "--runtime-agentrun-contract-freeze") parsed.runtimeAgentRunContractFreezePath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--workflow-gate-freeze") parsed.workflowGateFreezePath = argv[++index];
    else if (arg === "--desktop-companion-integration") parsed.desktopCompanionIntegrationPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/document-renderer-adapter.mjs [options]

Options:
  --runtime-adapter-interface-v2 <path>
                                  Runtime Adapter Interface v2 artifact.
  --runtime-agentrun-contract-freeze <path>
                                  Runtime/AgentRun contract freeze artifact.
  --agent-run-ledger <path>       AgentRun ledger artifact.
  --output-delivery-contract-freeze <path>
                                  Output Delivery contract freeze artifact.
  --workflow-gate-freeze <path>   Workflow/Gate freeze artifact.
  --desktop-companion-integration <path>
                                  Desktop Companion integration document.
  --out-dir <path>                Output directory.
  --check                         Exit non-zero when validation fails.
  -h, --help                      Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function uniqueById(items, ...idKeys) {
  const seen = new Set();
  const uniqueItems = [];
  for (const item of items) {
    const id = idKeys.map((key) => item?.[key]).find(Boolean);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    uniqueItems.push(item);
  }
  return uniqueItems;
}

function sum(items, key) {
  return items.reduce((total, item) => total + (Number(item?.[key]) || 0), 0);
}

function normalizeId(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
