import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_OUT_DIR = "artifacts/capability-workflow-contract-freeze/latest";
export const DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_INPUTS = {
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  lawFirmSlicePath: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
  personalDevSlicePath: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
  creativeDocumentSlicePath: "artifacts/creative-document-slice/latest/creative-document-slice.json",
  policyContractFreezePath: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
  evidenceContractFreezePath: "artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json",
};

const CAPABILITY_REQUIRED_FIELDS = [
  "schema_version",
  "capability_id",
  "version",
  "domain_pack",
  "display_name",
  "description",
  "input_contract",
  "output_contract",
  "required_resources",
  "allowed_runtimes",
  "required_tools",
  "required_gates",
  "data_policy",
  "approval_policy",
  "idempotency_policy",
  "retry_policy",
  "timeout_policy",
  "cost_policy",
  "observability_policy",
  "output_artifacts",
  "entrypoints",
  "golden_cases",
];

const CAPABILITY_OPTIONAL_FIELDS = ["dependencies", "metadata"];
const WORKFLOW_REQUIRED_FIELDS = ["schema_version", "workflow_id", "capability_id", "version", "steps", "state_machine"];
const WORKFLOW_OPTIONAL_FIELDS = ["metadata"];
const WORKFLOW_RUN_REQUIRED_FIELDS = [
  "schema_version",
  "workflow_run_id",
  "workflow_id",
  "capability_id",
  "status",
  "input_refs",
  "output_refs",
  "policy_snapshot_id",
];
const WORKFLOW_RUN_OPTIONAL_FIELDS = ["tenant_id", "matter_id", "created_at", "created_by", "metadata"];
const AGENT_RUN_REQUIRED_FIELDS = ["schema_version", "agent_run_id", "workflow_run_id", "runtime_id", "status", "input_ref", "output_ref"];
const AGENT_RUN_OPTIONAL_FIELDS = ["logs_ref", "started_at", "completed_at", "metadata"];

const GATE_PHASES = ["pre_run", "in_run", "post_run"];
const RUNTIME_IDS = new Set(["harness", "hermes", "claude_code", "codex", "local_script", "document_renderer", "mcp_tool", "browser", "manual"]);
const RUN_STATUSES = new Set(["queued", "running", "completed", "blocked", "failed", "cancelled"]);

export async function runCapabilityWorkflowContractFreeze(options = {}) {
  const result = await buildCapabilityWorkflowContractFreeze(options);
  if (options.write !== false) await writeCapabilityWorkflowContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Capability/workflow contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCapabilityWorkflowContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_OUT_DIR);
  const inputs = {
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_INPUTS.domainPackRegistryPath),
    law_firm_slice_path: path.resolve(options.lawFirmSlicePath ?? DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_INPUTS.lawFirmSlicePath),
    personal_dev_slice_path: path.resolve(options.personalDevSlicePath ?? DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_INPUTS.personalDevSlicePath),
    creative_document_slice_path: path.resolve(options.creativeDocumentSlicePath ?? DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_INPUTS.creativeDocumentSlicePath),
    policy_contract_freeze_path: path.resolve(options.policyContractFreezePath ?? DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_INPUTS.policyContractFreezePath),
    evidence_contract_freeze_path: path.resolve(options.evidenceContractFreezePath ?? DEFAULT_CAPABILITY_WORKFLOW_CONTRACT_FREEZE_INPUTS.evidenceContractFreezePath),
  };

  const domainPackRegistry = await readJson(inputs.domain_pack_registry_path);
  const lawFirmSource = await readJson(inputs.law_firm_slice_path);
  const personalDevSource = await readJson(inputs.personal_dev_slice_path);
  const creativeDocumentSource = await readJson(inputs.creative_document_slice_path);
  const policyContractFreeze = await readJson(inputs.policy_contract_freeze_path);
  const evidenceContractFreeze = await readJson(inputs.evidence_contract_freeze_path);
  const sources = [
    sliceSource("law_firm_ldd_slice", "Law Firm LDD Slice", inputs.law_firm_slice_path, lawFirmSource.law_firm_slice ?? lawFirmSource),
    sliceSource("personal_dev_slice", "Personal Dev Slice", inputs.personal_dev_slice_path, personalDevSource.personal_dev_slice ?? personalDevSource),
    sliceSource("creative_document_slice", "Creative Document Slice", inputs.creative_document_slice_path, creativeDocumentSource.creative_document_slice ?? creativeDocumentSource),
  ];

  const projection = await projectCapabilityWorkflowContracts({
    domainPackRegistry,
    sources,
    policyContractFreeze,
    evidenceContractFreeze,
    generatedAt,
  });
  const validationItems = validateCapabilityWorkflowContracts({
    domainPackRegistry,
    sources,
    policyContractFreeze,
    evidenceContractFreeze,
    ...projection,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "capability-workflow-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `capability-workflow-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      domain_pack_registry: {
        schema_version: domainPackRegistry.schema_version,
        pack_count: domainPackRegistry.summary?.pack_count ?? 0,
        capability_count: domainPackRegistry.summary?.capability_count ?? 0,
        registry_valid: domainPackRegistry.validation?.valid ?? false,
      },
      law_firm_slice: sourceContract(sources[0]),
      personal_dev_slice: sourceContract(sources[1]),
      creative_document_slice: sourceContract(sources[2]),
      policy_contract_freeze: {
        schema_version: policyContractFreeze.schema_version,
        freeze_id: policyContractFreeze.freeze_id,
        freeze_status: policyContractFreeze.summary?.freeze_status ?? null,
      },
      evidence_contract_freeze: {
        schema_version: evidenceContractFreeze.schema_version,
        freeze_id: evidenceContractFreeze.freeze_id,
        freeze_status: evidenceContractFreeze.summary?.freeze_status ?? null,
      },
    },
    contract_versions: {
      capability_manifest_schema_version: "capability-manifest.v2",
      workflow_schema_version: "workflow.v2",
      workflow_run_schema_version: "workflow-run.v2",
      agent_run_schema_version: "agent-run.v2",
      capability_io_schema_version: "capability-io-contract.v2",
      gate_runtime_schema_version: "capability-gate-runtime-contract.v2",
      compatibility_floor: "domain-pack-registry.v1+workflow-runtime.v1",
    },
    field_requirements: buildFieldRequirements(),
    summary: summarizeFreeze(projection, validationItems, validation),
    capability_workflow_contract: {
      schema_version: "capability-workflow-contract.v2",
      generated_at: generatedAt,
      capability_manifests: projection.capabilityManifestsV2,
      workflows: projection.workflowsV2,
      workflow_runs: projection.workflowRunsV2,
      agent_runs: projection.agentRunsV2,
      capability_io_contracts: projection.capabilityIoContractsV2,
      gate_runtime_contracts: projection.gateRuntimeContractsV2,
      workflow_execution_bindings: projection.workflowExecutionBindings,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderCapabilityWorkflowContractFreezeMarkdown(result),
  };
}

export async function writeCapabilityWorkflowContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "capability-workflow-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "capability-manifest-v2-fixture.json"), {
    generated_at: result.generated_at,
    capability_manifest_schema_version: result.contract_versions.capability_manifest_schema_version,
    capability_manifest_count: result.capability_workflow_contract.capability_manifests.length,
    capability_manifests: result.capability_workflow_contract.capability_manifests,
  });
  await writeJson(path.join(outDir, "workflow-v2-fixture.json"), {
    generated_at: result.generated_at,
    workflow_schema_version: result.contract_versions.workflow_schema_version,
    workflow_count: result.capability_workflow_contract.workflows.length,
    workflows: result.capability_workflow_contract.workflows,
  });
  await writeJson(path.join(outDir, "workflow-run-v2-fixture.json"), {
    generated_at: result.generated_at,
    workflow_run_schema_version: result.contract_versions.workflow_run_schema_version,
    workflow_run_count: result.capability_workflow_contract.workflow_runs.length,
    workflow_runs: result.capability_workflow_contract.workflow_runs,
  });
  await writeJson(path.join(outDir, "agent-run-v2-fixture.json"), {
    generated_at: result.generated_at,
    agent_run_schema_version: result.contract_versions.agent_run_schema_version,
    agent_run_count: result.capability_workflow_contract.agent_runs.length,
    agent_runs: result.capability_workflow_contract.agent_runs,
  });
  await writeJson(path.join(outDir, "capability-io-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    capability_io_schema_version: result.contract_versions.capability_io_schema_version,
    capability_io_contract_count: result.capability_workflow_contract.capability_io_contracts.length,
    capability_io_contracts: result.capability_workflow_contract.capability_io_contracts,
  });
  await writeJson(path.join(outDir, "capability-gate-runtime-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    gate_runtime_schema_version: result.contract_versions.gate_runtime_schema_version,
    gate_runtime_contract_count: result.capability_workflow_contract.gate_runtime_contracts.length,
    gate_runtime_contracts: result.capability_workflow_contract.gate_runtime_contracts,
  });
  await writeJson(path.join(outDir, "workflow-execution-bindings.json"), {
    generated_at: result.generated_at,
    binding_count: result.capability_workflow_contract.workflow_execution_bindings.length,
    workflow_execution_bindings: result.capability_workflow_contract.workflow_execution_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCapabilityWorkflowContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCapabilityWorkflowContractFreeze(args);
    console.log(`Capability/workflow contract freeze written to ${result.output_dir}`);
    console.log(`Capability manifests v2: ${result.summary.capability_manifest_count}`);
    console.log(`Workflows v2: ${result.summary.workflow_count}`);
    console.log(`Workflow runs v2: ${result.summary.workflow_run_count}`);
    console.log(`Runtime bindings allowed: ${result.summary.runtime_binding_allowed_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function projectCapabilityWorkflowContracts({
  domainPackRegistry,
  sources,
  policyContractFreeze,
  evidenceContractFreeze,
  generatedAt,
}) {
  const registryCapabilities = domainPackRegistry.capabilities ?? [];
  const manifests = await readCapabilityManifests(registryCapabilities);
  const sourceContractsByCapabilityId = buildSourceContractsByCapabilityId(sources);
  const policyDecisionsByClassification = new Map((policyContractFreeze.policy_contract?.policy_decisions ?? [])
    .map((decision) => [decision.classification, decision]));
  const evidenceCapabilityIds = new Set((evidenceContractFreeze.evidence_contract?.evidence_items ?? [])
    .flatMap((item) => item.metadata?.source_capability_ids ?? item.metadata?.capability_ids ?? []));

  const capabilityManifestsV2 = manifests.map((record) => capabilityManifestV2({
    record,
    sourceContracts: sourceContractsByCapabilityId.get(record.manifest.capability_id) ?? [],
    policyDecision: policyDecisionsByClassification.get(record.manifest.data_policy?.max_input_classification),
    evidenceLinked: evidenceCapabilityIds.has(record.manifest.capability_id) || record.manifest.capability_id.startsWith("law_firm."),
    generatedAt,
  }));
  const capabilityById = new Map(capabilityManifestsV2.map((capability) => [capability.capability_id, capability]));

  const workflowsV2 = [];
  const workflowRunsV2 = [];
  const agentRunsV2 = [];
  const workflowExecutionBindings = [];
  for (const source of sources) {
    const workflowRuntime = source.slice.workflow_runtime ?? {};
    for (const workflow of workflowRuntime.workflows ?? []) {
      const capability = capabilityById.get(workflow.capability_id);
      workflowsV2.push(workflowV2({ workflow, capability, source, generatedAt }));
    }
    for (const workflowRun of workflowRuntime.workflow_runs ?? []) {
      const workflow = (workflowRuntime.workflows ?? []).find((candidate) => candidate.id === workflowRun.workflow_id);
      const capability = capabilityById.get(workflowRun.capability_id);
      const runAgentRuns = (workflowRuntime.agent_runs ?? []).filter((agentRun) => agentRun.workflow_run_id === workflowRun.id);
      workflowRunsV2.push(workflowRunV2({ workflowRun, workflow, capability, source, agentRuns: runAgentRuns, generatedAt }));
    }
    for (const agentRun of workflowRuntime.agent_runs ?? []) {
      const workflowRun = (workflowRuntime.workflow_runs ?? []).find((candidate) => candidate.id === agentRun.workflow_run_id);
      const capability = capabilityById.get(workflowRun?.capability_id);
      agentRunsV2.push(agentRunV2({ agentRun, workflowRun, capability, source, generatedAt }));
    }
  }

  const workflowById = new Map(workflowsV2.map((workflow) => [workflow.workflow_id, workflow]));
  const workflowRunById = new Map(workflowRunsV2.map((workflowRun) => [workflowRun.workflow_run_id, workflowRun]));
  for (const workflowRun of workflowRunsV2) {
    workflowExecutionBindings.push(executionBindingV2({
      workflowRun,
      workflow: workflowById.get(workflowRun.workflow_id),
      agentRuns: agentRunsV2.filter((agentRun) => agentRun.workflow_run_id === workflowRun.workflow_run_id),
      generatedAt,
    }));
  }
  for (const agentRun of agentRunsV2) {
    if (workflowRunById.has(agentRun.workflow_run_id)) continue;
    workflowExecutionBindings.push(executionBindingV2({
      workflowRun: null,
      workflow: null,
      agentRuns: [agentRun],
      generatedAt,
    }));
  }

  const capabilityIoContractsV2 = capabilityManifestsV2.map((capability) => capabilityIoContractV2(capability, generatedAt));
  const gateRuntimeContractsV2 = capabilityManifestsV2.map((capability) => gateRuntimeContractV2({
    capability,
    workflows: workflowsV2.filter((workflow) => workflow.capability_id === capability.capability_id),
    agentRuns: agentRunsV2.filter((agentRun) => agentRun.capability_id === capability.capability_id),
    generatedAt,
  }));

  return {
    capabilityManifestsV2,
    workflowsV2,
    workflowRunsV2,
    agentRunsV2,
    capabilityIoContractsV2,
    gateRuntimeContractsV2,
    workflowExecutionBindings,
  };
}

async function readCapabilityManifests(registryCapabilities) {
  const records = [];
  for (const registryRecord of registryCapabilities) {
    try {
      const manifest = await readJson(registryRecord.path);
      records.push({
        registry: registryRecord,
        manifest,
        manifest_path: registryRecord.path,
        validation: registryRecord.validation ?? { valid: false, errors: [{ path: registryRecord.path, message: "Registry validation missing" }] },
      });
    } catch (error) {
      records.push({
        registry: registryRecord,
        manifest: {
          schema_version: "capability-manifest.v1",
          capability_id: registryRecord.capability_id,
          version: registryRecord.version,
          domain_pack: registryRecord.pack_id,
          display_name: registryRecord.display_name ?? registryRecord.capability_id,
          description: "",
          input_contract: null,
          output_contract: null,
          required_resources: [],
          allowed_runtimes: [],
          required_tools: [],
          required_gates: { pre_run: [], in_run: [], post_run: [] },
          data_policy: {},
          approval_policy: {},
          idempotency_policy: {},
          retry_policy: {},
          timeout_policy: {},
          cost_policy: {},
          observability_policy: {},
          output_artifacts: [],
          entrypoints: [],
          golden_cases: [],
          metadata: { read_error: error.code === "ENOENT" ? "not_found" : error.message },
        },
        manifest_path: registryRecord.path,
        validation: {
          valid: false,
          errors: [{ path: registryRecord.path, message: error.code === "ENOENT" ? "Capability manifest not found" : error.message }],
        },
      });
    }
  }
  return records.sort((left, right) => left.manifest.capability_id.localeCompare(right.manifest.capability_id));
}

function capabilityManifestV2({ record, sourceContracts, policyDecision, evidenceLinked, generatedAt }) {
  const manifest = record.manifest;
  const requiredGates = normalizeGateMap(manifest.required_gates);
  const requiredResources = manifest.required_resources ?? [];
  const requiredFieldsPresent = CAPABILITY_REQUIRED_FIELDS.filter((field) => hasValue(manifest[field]));
  const missingRequiredFields = CAPABILITY_REQUIRED_FIELDS.filter((field) => !hasValue(manifest[field]));
  const optionalFieldsPresent = CAPABILITY_OPTIONAL_FIELDS.filter((field) => hasValue(manifest[field]));
  const requiredGateContracts = flattenGateMap(requiredGates).map((gate) => ({
    schema_version: "capability-gate-requirement.v2",
    gate_id: gate.gate_id,
    phase: gate.phase,
    required: true,
  }));
  return {
    schema_version: "capability-manifest.v2",
    capability_id: manifest.capability_id,
    version: manifest.version,
    domain_pack: manifest.domain_pack,
    pack_id: record.registry.pack_id ?? manifest.domain_pack,
    display_name: manifest.display_name,
    description: manifest.description,
    source_manifest_path: record.manifest_path,
    source_schema_version: manifest.schema_version,
    registry_validation_status: record.validation?.valid ? "passed" : "failed",
    input_contract: {
      schema_ref: manifest.input_contract,
      required: true,
      source_field: "input_contract",
    },
    output_contract: {
      schema_ref: manifest.output_contract,
      required: true,
      source_field: "output_contract",
    },
    field_requirements: {
      required_fields: CAPABILITY_REQUIRED_FIELDS,
      optional_fields: CAPABILITY_OPTIONAL_FIELDS,
      present_required_fields: requiredFieldsPresent,
      missing_required_fields: missingRequiredFields,
      present_optional_fields: optionalFieldsPresent,
    },
    resource_requirements: requiredResources.map((resource) => ({
      schema_version: "capability-resource-requirement.v2",
      resource_role: resource.resource_role,
      required: Boolean(resource.required),
      requirement_status: resource.required ? "required" : "optional",
      description: resource.description ?? "",
    })),
    runtime_requirements: (manifest.allowed_runtimes ?? []).map((runtimeId) => ({
      schema_version: "capability-runtime-requirement.v2",
      runtime_id: runtimeId,
      required: true,
      runtime_known: RUNTIME_IDS.has(runtimeId),
    })),
    gate_requirements: requiredGateContracts,
    required_tools: manifest.required_tools ?? [],
    data_policy: {
      max_input_classification: manifest.data_policy?.max_input_classification ?? null,
      external_model_policy: manifest.data_policy?.external_model_policy ?? null,
      redaction_required: Boolean(manifest.data_policy?.redaction_required),
      allowed_context_types: manifest.data_policy?.allowed_context_types ?? [],
      retrieval_filters_required: manifest.data_policy?.retrieval_filters_required ?? [],
      policy_decision_id: policyDecision?.decision_id ?? null,
      policy_decision_status: policyDecision?.decision_status ?? null,
    },
    approval_policy: {
      required: Boolean(manifest.approval_policy?.required),
      approval_type: manifest.approval_policy?.approval_type ?? null,
      default_output_status: manifest.approval_policy?.default_output_status ?? null,
    },
    idempotency_policy: {
      key_fields: manifest.idempotency_policy?.key_fields ?? [],
      required: true,
    },
    retry_policy: {
      max_attempts: manifest.retry_policy?.max_attempts ?? 0,
      retryable_failures: manifest.retry_policy?.retryable_failures ?? [],
    },
    timeout_policy: {
      max_seconds: manifest.timeout_policy?.max_seconds ?? null,
    },
    cost_policy: {
      max_usd: manifest.cost_policy?.max_usd ?? null,
      track_tokens: Boolean(manifest.cost_policy?.track_tokens),
    },
    observability_policy: manifest.observability_policy ?? {},
    output_artifacts: manifest.output_artifacts ?? [],
    entrypoints: manifest.entrypoints ?? [],
    dependencies: manifest.dependencies ?? [],
    golden_cases: manifest.golden_cases ?? [],
    source_workflow_ids: sourceContracts.map((source) => source.workflow_id).sort(),
    source_workflow_count: sourceContracts.length,
    evidence_contract_linked: evidenceLinked,
    created_at: generatedAt,
    metadata: {
      original_metadata: manifest.metadata ?? {},
      registry_errors: record.validation?.errors ?? [],
    },
  };
}

function workflowV2({ workflow, capability, source, generatedAt }) {
  const requiredFieldsPresent = ["schema_version", "id", "capability_id", "version", "steps", "state_machine"].filter((field) => hasValue(workflow[field]));
  const missingRequiredFields = ["schema_version", "id", "capability_id", "version", "steps", "state_machine"].filter((field) => !hasValue(workflow[field]));
  const steps = (workflow.steps ?? []).map((step, index) => ({
    schema_version: "workflow-step.v2",
    step_id: step.step_id,
    step_index: index,
    step_type: step.step_type,
    runtime_id: step.runtime_id,
    runtime_required: true,
    runtime_allowed_by_capability: capability?.runtime_requirements?.some((runtime) => runtime.runtime_id === step.runtime_id) ?? false,
    input_refs: step.input_refs ?? [],
    input_required: true,
    output_contract: step.output_contract ?? null,
    output_required: Boolean(step.output_contract),
    gate_phase: inferGatePhase(step, capability),
    metadata: {},
  }));
  return {
    schema_version: "workflow.v2",
    workflow_id: workflow.id,
    capability_id: workflow.capability_id,
    capability_version: capability?.version ?? null,
    domain_pack: capability?.domain_pack ?? inferDomainPack(workflow.capability_id),
    version: workflow.version,
    source_slice_id: source.source_id,
    source_schema_version: source.slice.schema_version,
    field_requirements: {
      required_fields: WORKFLOW_REQUIRED_FIELDS,
      optional_fields: WORKFLOW_OPTIONAL_FIELDS,
      present_required_fields: requiredFieldsPresent.map((field) => field === "id" ? "workflow_id" : field),
      missing_required_fields: missingRequiredFields.map((field) => field === "id" ? "workflow_id" : field),
      present_optional_fields: WORKFLOW_OPTIONAL_FIELDS.filter((field) => hasValue(workflow[field])),
    },
    steps,
    step_count: steps.length,
    runtime_contracts: unique(steps.map((step) => step.runtime_id)).map((runtimeId) => ({
      runtime_id: runtimeId,
      required: true,
      allowed_by_capability: capability?.runtime_requirements?.some((runtime) => runtime.runtime_id === runtimeId) ?? false,
    })),
    gate_contracts: capability?.gate_requirements ?? [],
    state_machine: workflow.state_machine ?? {},
    created_at: generatedAt,
    metadata: workflow.metadata ?? {},
  };
}

function workflowRunV2({ workflowRun, workflow, capability, source, agentRuns, generatedAt }) {
  const context = inferSliceContext(source.slice);
  const missingRequiredFields = ["id", "workflow_id", "capability_id", "status", "input_refs", "output_refs", "policy_snapshot_id"]
    .filter((field) => !hasValue(workflowRun[field]))
    .map((field) => field === "id" ? "workflow_run_id" : field);
  const runtimeIds = unique(agentRuns.map((agentRun) => agentRun.runtime_id));
  return {
    schema_version: "workflow-run.v2",
    workflow_run_id: workflowRun.id,
    workflow_id: workflowRun.workflow_id,
    capability_id: workflowRun.capability_id,
    capability_version: capability?.version ?? workflow?.version ?? null,
    domain_pack: capability?.domain_pack ?? inferDomainPack(workflowRun.capability_id),
    tenant_id: workflowRun.tenant_id ?? context.tenant_id,
    matter_id: workflowRun.matter_id ?? context.matter_id,
    status: workflowRun.status,
    input_refs: workflowRun.input_refs ?? [],
    output_refs: workflowRun.output_refs ?? [],
    policy_snapshot_id: workflowRun.policy_snapshot_id ?? context.policy_snapshot_id,
    runtime_ids: runtimeIds,
    agent_run_ids: agentRuns.map((agentRun) => agentRun.id),
    workflow_linked: Boolean(workflow),
    capability_linked: Boolean(capability),
    policy_snapshot_required: true,
    human_review_required: Boolean(capability?.approval_policy?.required),
    field_requirements: {
      required_fields: WORKFLOW_RUN_REQUIRED_FIELDS,
      optional_fields: WORKFLOW_RUN_OPTIONAL_FIELDS,
      present_required_fields: WORKFLOW_RUN_REQUIRED_FIELDS.filter((field) => {
        const sourceField = field === "workflow_run_id" ? "id" : field;
        return hasValue(workflowRun[sourceField]) || hasValue((field === "tenant_id" || field === "matter_id") ? context[field] : null);
      }),
      missing_required_fields: missingRequiredFields,
      present_optional_fields: WORKFLOW_RUN_OPTIONAL_FIELDS.filter((field) => hasValue(workflowRun[field]) || hasValue(context[field])),
    },
    created_at: workflowRun.created_at ?? generatedAt,
    created_by: workflowRun.created_by ?? { actor_type: "script", actor_id: "capability-workflow-contract-freeze" },
    metadata: workflowRun.metadata ?? {},
  };
}

function agentRunV2({ agentRun, workflowRun, capability, source, generatedAt }) {
  const runtimeAllowed = capability?.runtime_requirements?.some((runtime) => runtime.runtime_id === agentRun.runtime_id) ?? false;
  return {
    schema_version: "agent-run.v2",
    agent_run_id: agentRun.id,
    workflow_run_id: agentRun.workflow_run_id,
    workflow_id: workflowRun?.workflow_id ?? null,
    capability_id: workflowRun?.capability_id ?? null,
    runtime_id: agentRun.runtime_id,
    runtime_known: RUNTIME_IDS.has(agentRun.runtime_id),
    runtime_allowed_by_capability: runtimeAllowed,
    status: agentRun.status,
    input_ref: agentRun.input_ref ?? null,
    output_ref: agentRun.output_ref ?? null,
    logs_ref: agentRun.logs_ref ?? null,
    source_slice_id: source.source_id,
    field_requirements: {
      required_fields: AGENT_RUN_REQUIRED_FIELDS,
      optional_fields: AGENT_RUN_OPTIONAL_FIELDS,
      present_required_fields: AGENT_RUN_REQUIRED_FIELDS.filter((field) => {
        const sourceField = field === "agent_run_id" ? "id" : field;
        return hasValue(agentRun[sourceField]) || (field === "capability_id" && hasValue(workflowRun?.capability_id));
      }),
      missing_required_fields: AGENT_RUN_REQUIRED_FIELDS.filter((field) => {
        const sourceField = field === "agent_run_id" ? "id" : field;
        return !hasValue(agentRun[sourceField]) && !(field === "capability_id" && hasValue(workflowRun?.capability_id));
      }),
      present_optional_fields: AGENT_RUN_OPTIONAL_FIELDS.filter((field) => hasValue(agentRun[field])),
    },
    started_at: agentRun.started_at ?? generatedAt,
    completed_at: agentRun.completed_at ?? (agentRun.status === "completed" ? generatedAt : null),
    metadata: agentRun.metadata ?? {},
  };
}

function capabilityIoContractV2(capability, generatedAt) {
  return {
    schema_version: "capability-io-contract.v2",
    capability_id: capability.capability_id,
    version: capability.version,
    domain_pack: capability.domain_pack,
    input: {
      schema_ref: capability.input_contract.schema_ref,
      required: capability.input_contract.required,
      required_resource_roles: capability.resource_requirements.filter((resource) => resource.required).map((resource) => resource.resource_role),
      optional_resource_roles: capability.resource_requirements.filter((resource) => !resource.required).map((resource) => resource.resource_role),
    },
    output: {
      schema_ref: capability.output_contract.schema_ref,
      required: capability.output_contract.required,
      artifact_types: capability.output_artifacts.map((artifact) => artifact.artifact_type),
      default_statuses: unique(capability.output_artifacts.map((artifact) => artifact.default_status)),
      delivery_policies: unique(capability.output_artifacts.map((artifact) => artifact.delivery_policy)),
    },
    idempotency_key_fields: capability.idempotency_policy.key_fields,
    version_required: true,
    input_output_status: capability.input_contract.schema_ref && capability.output_contract.schema_ref ? "complete" : "incomplete",
    created_at: generatedAt,
    metadata: {},
  };
}

function gateRuntimeContractV2({ capability, workflows, agentRuns, generatedAt }) {
  const workflowRuntimeIds = unique(workflows.flatMap((workflow) => workflow.runtime_contracts.map((runtime) => runtime.runtime_id)));
  const agentRuntimeIds = unique(agentRuns.map((agentRun) => agentRun.runtime_id));
  const runtimeBindings = unique([...workflowRuntimeIds, ...agentRuntimeIds]).map((runtimeId) => ({
    runtime_id: runtimeId,
    used_by_workflow: workflowRuntimeIds.includes(runtimeId),
    used_by_agent_run: agentRuntimeIds.includes(runtimeId),
    allowed_by_capability: capability.runtime_requirements.some((runtime) => runtime.runtime_id === runtimeId),
  }));
  return {
    schema_version: "capability-gate-runtime-contract.v2",
    capability_id: capability.capability_id,
    version: capability.version,
    domain_pack: capability.domain_pack,
    required_gates: capability.gate_requirements,
    required_gate_count: capability.gate_requirements.length,
    allowed_runtimes: capability.runtime_requirements,
    allowed_runtime_count: capability.runtime_requirements.length,
    runtime_bindings: runtimeBindings,
    runtime_binding_count: runtimeBindings.length,
    blocked_runtime_binding_count: runtimeBindings.filter((binding) => !binding.allowed_by_capability).length,
    approval_required: capability.approval_policy.required,
    human_review_gate_required: capability.gate_requirements.some((gate) => gate.gate_id === "human_approval_gate"),
    version_required: true,
    created_at: generatedAt,
    metadata: {},
  };
}

function executionBindingV2({ workflowRun, workflow, agentRuns, generatedAt }) {
  return {
    schema_version: "workflow-execution-binding.v2",
    binding_id: workflowRun ? `workflow-execution-binding.${slugify(workflowRun.workflow_run_id)}` : `workflow-execution-binding.orphan.${slugify(agentRuns[0]?.agent_run_id ?? generatedAt)}`,
    workflow_run_id: workflowRun?.workflow_run_id ?? null,
    workflow_id: workflowRun?.workflow_id ?? workflow?.workflow_id ?? null,
    capability_id: workflowRun?.capability_id ?? workflow?.capability_id ?? agentRuns[0]?.capability_id ?? null,
    status: workflowRun?.status ?? "unknown",
    workflow_linked: Boolean(workflow),
    agent_run_count: agentRuns.length,
    agent_run_ids: agentRuns.map((agentRun) => agentRun.agent_run_id),
    runtime_ids: unique(agentRuns.map((agentRun) => agentRun.runtime_id)),
    input_refs: workflowRun?.input_refs ?? [],
    output_refs: workflowRun?.output_refs ?? [],
    policy_snapshot_id: workflowRun?.policy_snapshot_id ?? null,
    created_at: generatedAt,
    metadata: {},
  };
}

function validateCapabilityWorkflowContracts({
  domainPackRegistry,
  sources,
  policyContractFreeze,
  evidenceContractFreeze,
  capabilityManifestsV2,
  workflowsV2,
  workflowRunsV2,
  agentRunsV2,
  capabilityIoContractsV2,
  gateRuntimeContractsV2,
  workflowExecutionBindings,
}) {
  const items = [];
  const capabilityIds = new Set(capabilityManifestsV2.map((capability) => capability.capability_id));
  const workflowIds = new Set(workflowsV2.map((workflow) => workflow.workflow_id));
  const workflowRunIds = new Set(workflowRunsV2.map((workflowRun) => workflowRun.workflow_run_id));
  const duplicateCapabilities = duplicates(capabilityManifestsV2.map((capability) => capability.capability_id));
  const duplicateWorkflows = duplicates(workflowsV2.map((workflow) => workflow.workflow_id));
  const duplicateWorkflowRuns = duplicates(workflowRunsV2.map((workflowRun) => workflowRun.workflow_run_id));

  items.push(validationItem("source.domain_pack_registry", "domain_pack_registry_valid", domainPackRegistry.validation?.valid === true, "Domain pack registry is valid."));
  items.push(validationItem("source.policy_contract_freeze", "policy_contract_freeze_complete", policyContractFreeze.summary?.freeze_status === "complete", "Policy contract freeze is complete."));
  items.push(validationItem("source.evidence_contract_freeze", "evidence_contract_freeze_complete", evidenceContractFreeze.summary?.freeze_status === "complete", "Evidence contract freeze is complete."));
  for (const source of sources) {
    items.push(validationItem(`source.${source.source_id}`, "workflow_runtime_present", Boolean(source.slice.workflow_runtime), `${source.label} exposes workflow_runtime.`));
  }
  items.push(validationItem("capability_manifests", "capability_count_matches_registry", capabilityManifestsV2.length === (domainPackRegistry.summary?.capability_count ?? 0), "Capability v2 count matches registry."));
  items.push(validationItem("capability_manifests", "unique_capability_ids", duplicateCapabilities.length === 0, "Capability ids are unique.", { duplicates: duplicateCapabilities }));
  items.push(validationItem("workflows", "unique_workflow_ids", duplicateWorkflows.length === 0, "Workflow ids are unique.", { duplicates: duplicateWorkflows }));
  items.push(validationItem("workflow_runs", "unique_workflow_run_ids", duplicateWorkflowRuns.length === 0, "Workflow run ids are unique.", { duplicates: duplicateWorkflowRuns }));

  for (const capability of capabilityManifestsV2) {
    const pathLabel = `capability_manifests.${capability.capability_id}`;
    items.push(validationItem(pathLabel, "required_fields_declared", capability.field_requirements.missing_required_fields.length === 0, "Capability required fields are present.", { missing: capability.field_requirements.missing_required_fields }));
    items.push(validationItem(pathLabel, "input_output_required", Boolean(capability.input_contract.schema_ref && capability.output_contract.schema_ref), "Capability input/output contracts are required and present."));
    items.push(validationItem(pathLabel, "runtime_contract_required", capability.runtime_requirements.length > 0, "Capability declares at least one allowed runtime."));
    items.push(validationItem(pathLabel, "gate_contract_required", capability.gate_requirements.length > 0, "Capability declares gate requirements."));
    items.push(validationItem(pathLabel, "version_required", Boolean(capability.version), "Capability version is required."));
    items.push(validationItem(pathLabel, "policy_decision_linked", Boolean(capability.data_policy.policy_decision_id), "Capability classification policy links to PolicyDecision v2."));
  }

  for (const workflow of workflowsV2) {
    const pathLabel = `workflows.${workflow.workflow_id}`;
    items.push(validationItem(pathLabel, "capability_linked", capabilityIds.has(workflow.capability_id), "Workflow capability_id links to CapabilityManifest v2."));
    items.push(validationItem(pathLabel, "required_fields_declared", workflow.field_requirements.missing_required_fields.length === 0, "Workflow required fields are present.", { missing: workflow.field_requirements.missing_required_fields }));
    items.push(validationItem(pathLabel, "step_contracts_present", workflow.step_count > 0, "Workflow has at least one step."));
    for (const runtimeContract of workflow.runtime_contracts) {
      items.push(validationItem(`${pathLabel}.runtime_contracts.${runtimeContract.runtime_id}`, "runtime_allowed_by_capability", runtimeContract.allowed_by_capability, "Workflow step runtime is allowed by capability."));
    }
  }

  for (const workflowRun of workflowRunsV2) {
    const pathLabel = `workflow_runs.${workflowRun.workflow_run_id}`;
    items.push(validationItem(pathLabel, "workflow_linked", workflowIds.has(workflowRun.workflow_id), "WorkflowRun links to Workflow v2."));
    items.push(validationItem(pathLabel, "capability_linked", capabilityIds.has(workflowRun.capability_id), "WorkflowRun links to CapabilityManifest v2."));
    items.push(validationItem(pathLabel, "run_status_known", RUN_STATUSES.has(workflowRun.status), "WorkflowRun status is known."));
    items.push(validationItem(pathLabel, "policy_snapshot_present", Boolean(workflowRun.policy_snapshot_id), "WorkflowRun has policy_snapshot_id."));
  }

  for (const agentRun of agentRunsV2) {
    const pathLabel = `agent_runs.${agentRun.agent_run_id}`;
    items.push(validationItem(pathLabel, "workflow_run_linked", workflowRunIds.has(agentRun.workflow_run_id), "AgentRun links to WorkflowRun v2."));
    items.push(validationItem(pathLabel, "runtime_known", agentRun.runtime_known, "AgentRun runtime id is known."));
    items.push(validationItem(pathLabel, "runtime_allowed_by_capability", agentRun.runtime_allowed_by_capability, "AgentRun runtime is allowed by capability."));
  }

  for (const contract of capabilityIoContractsV2) {
    items.push(validationItem(`capability_io_contracts.${contract.capability_id}`, "input_output_contract_complete", contract.input_output_status === "complete", "Capability IO contract has required input/output schema refs."));
  }

  for (const contract of gateRuntimeContractsV2) {
    items.push(validationItem(`gate_runtime_contracts.${contract.capability_id}`, "runtime_bindings_allowed", contract.blocked_runtime_binding_count === 0, "Capability runtime bindings are all allowed."));
    items.push(validationItem(`gate_runtime_contracts.${contract.capability_id}`, "required_gates_declared", contract.required_gate_count > 0, "Capability gate requirements are declared."));
  }

  for (const binding of workflowExecutionBindings) {
    items.push(validationItem(`workflow_execution_bindings.${binding.binding_id}`, "workflow_execution_bound", Boolean(binding.workflow_run_id && binding.workflow_id && binding.capability_id), "Workflow execution binding connects run, workflow, and capability."));
  }

  return items;
}

function summarizeFreeze(projection, validationItems, validation) {
  const runtimeBindings = projection.gateRuntimeContractsV2.flatMap((contract) => contract.runtime_bindings);
  const gateRequirements = projection.gateRuntimeContractsV2.flatMap((contract) => contract.required_gates);
  const requiredFieldDeclaredCount = projection.capabilityManifestsV2
    .reduce((sum, capability) => sum + capability.field_requirements.required_fields.length, 0)
    + projection.workflowsV2.reduce((sum, workflow) => sum + workflow.field_requirements.required_fields.length, 0)
    + projection.workflowRunsV2.reduce((sum, workflowRun) => sum + workflowRun.field_requirements.required_fields.length, 0);
  const optionalFieldDeclaredCount = projection.capabilityManifestsV2
    .reduce((sum, capability) => sum + capability.field_requirements.optional_fields.length, 0)
    + projection.workflowsV2.reduce((sum, workflow) => sum + workflow.field_requirements.optional_fields.length, 0)
    + projection.workflowRunsV2.reduce((sum, workflowRun) => sum + workflowRun.field_requirements.optional_fields.length, 0);

  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    capability_manifest_schema_version: "capability-manifest.v2",
    workflow_schema_version: "workflow.v2",
    workflow_run_schema_version: "workflow-run.v2",
    agent_run_schema_version: "agent-run.v2",
    capability_io_schema_version: "capability-io-contract.v2",
    gate_runtime_schema_version: "capability-gate-runtime-contract.v2",
    capability_manifest_count: projection.capabilityManifestsV2.length,
    workflow_count: projection.workflowsV2.length,
    workflow_run_count: projection.workflowRunsV2.length,
    agent_run_count: projection.agentRunsV2.length,
    capability_io_contract_count: projection.capabilityIoContractsV2.length,
    gate_runtime_contract_count: projection.gateRuntimeContractsV2.length,
    workflow_execution_binding_count: projection.workflowExecutionBindings.length,
    capability_with_input_output_count: projection.capabilityIoContractsV2.filter((contract) => contract.input_output_status === "complete").length,
    capability_with_gate_contract_count: projection.gateRuntimeContractsV2.filter((contract) => contract.required_gate_count > 0).length,
    capability_with_runtime_contract_count: projection.gateRuntimeContractsV2.filter((contract) => contract.allowed_runtime_count > 0).length,
    workflow_linked_capability_count: projection.workflowsV2.filter((workflow) => projection.capabilityManifestsV2.some((capability) => capability.capability_id === workflow.capability_id)).length,
    workflow_run_linked_workflow_count: projection.workflowRunsV2.filter((workflowRun) => projection.workflowsV2.some((workflow) => workflow.workflow_id === workflowRun.workflow_id)).length,
    agent_run_linked_workflow_run_count: projection.agentRunsV2.filter((agentRun) => projection.workflowRunsV2.some((workflowRun) => workflowRun.workflow_run_id === agentRun.workflow_run_id)).length,
    runtime_binding_count: runtimeBindings.length,
    runtime_binding_allowed_count: runtimeBindings.filter((binding) => binding.allowed_by_capability).length,
    runtime_binding_blocked_count: runtimeBindings.filter((binding) => !binding.allowed_by_capability).length,
    gate_binding_count: gateRequirements.length,
    required_gate_count: gateRequirements.length,
    required_field_declared_count: requiredFieldDeclaredCount,
    optional_field_declared_count: optionalFieldDeclaredCount,
    version_required_count: projection.capabilityManifestsV2.filter((capability) => Boolean(capability.version)).length
      + projection.workflowsV2.filter((workflow) => Boolean(workflow.version)).length
      + projection.workflowRunsV2.filter((workflowRun) => Boolean(workflowRun.capability_version)).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_domain_pack: countBy(projection.capabilityManifestsV2, "domain_pack"),
    by_runtime_id: countValues(runtimeBindings.map((binding) => binding.runtime_id)),
    by_gate_id: countValues(gateRequirements.map((gate) => gate.gate_id)),
    by_workflow_status: countBy(projection.workflowRunsV2, "status"),
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

function renderCapabilityWorkflowContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Capability/Workflow Contract Freeze");
  lines.push("");
  lines.push(`- Freeze ID: ${result.freeze_id}`);
  lines.push(`- Status: ${result.summary.freeze_status}`);
  lines.push(`- Capability manifests v2: ${result.summary.capability_manifest_count}`);
  lines.push(`- Workflows v2: ${result.summary.workflow_count}`);
  lines.push(`- Workflow runs v2: ${result.summary.workflow_run_count}`);
  lines.push(`- Agent runs v2: ${result.summary.agent_run_count}`);
  lines.push(`- Capability IO contracts: ${result.summary.capability_io_contract_count}`);
  lines.push(`- Gate/runtime contracts: ${result.summary.gate_runtime_contract_count}`);
  lines.push(`- Runtime bindings allowed: ${result.summary.runtime_binding_allowed_count}/${result.summary.runtime_binding_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Field Requirements");
  for (const [contractId, requirement] of Object.entries(result.field_requirements)) {
    lines.push(`- ${contractId}: required ${requirement.required_fields.length}, optional ${requirement.optional_fields.length}`);
  }
  lines.push("");
  lines.push("## Capabilities");
  for (const capability of result.capability_workflow_contract.capability_manifests) {
    lines.push(`- ${capability.capability_id}@${capability.version}: input ${capability.input_contract.schema_ref}, output ${capability.output_contract.schema_ref}, gates ${capability.gate_requirements.length}, runtimes ${capability.runtime_requirements.length}`);
  }
  lines.push("");
  lines.push("## Workflows");
  for (const workflow of result.capability_workflow_contract.workflows) {
    lines.push(`- ${workflow.workflow_id}: ${workflow.step_count} step(s), capability ${workflow.capability_id}`);
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

function buildSourceContractsByCapabilityId(sources) {
  const map = new Map();
  for (const source of sources) {
    for (const workflow of source.slice.workflow_runtime?.workflows ?? []) {
      const records = map.get(workflow.capability_id) ?? [];
      records.push({
        source_id: source.source_id,
        workflow_id: workflow.id,
        workflow_version: workflow.version,
      });
      map.set(workflow.capability_id, records);
    }
  }
  return map;
}

function inferGatePhase(step, capability) {
  if (!capability) return null;
  if (step.step_type === "gate") {
    return capability.gate_requirements.find((gate) => gate.phase === "pre_run")?.phase ?? "pre_run";
  }
  if (step.step_type === "approval") return "post_run";
  return null;
}

function inferSliceContext(slice) {
  const resources = slice.resource_evidence?.resources ?? [];
  const firstResource = resources[0] ?? {};
  const firstMatter = slice.identity_policy?.matters?.[0] ?? {};
  return {
    tenant_id: firstResource.tenant_id ?? firstMatter.tenant_id ?? slice.tenant_id ?? "tenant.default",
    matter_id: firstResource.matter_id ?? firstMatter.id ?? firstMatter.matter_id ?? null,
    policy_snapshot_id: firstResource.policy_snapshot_id ?? firstMatter.policy_snapshot_id ?? null,
  };
}

function sourceContract(source) {
  return {
    schema_version: source.slice.schema_version,
    source_id: source.source_id,
    workflow_runtime_schema_version: source.slice.workflow_runtime?.schema_version ?? null,
    capability_count: source.slice.workflow_runtime?.capabilities?.length ?? 0,
    workflow_count: source.slice.workflow_runtime?.workflows?.length ?? 0,
    workflow_run_count: source.slice.workflow_runtime?.workflow_runs?.length ?? 0,
    agent_run_count: source.slice.workflow_runtime?.agent_runs?.length ?? 0,
  };
}

function sliceSource(sourceId, label, sourcePath, slice) {
  return {
    source_id: sourceId,
    label,
    path: sourcePath,
    slice,
  };
}

function buildFieldRequirements() {
  return {
    capability_manifest_v2: {
      required_fields: CAPABILITY_REQUIRED_FIELDS,
      optional_fields: CAPABILITY_OPTIONAL_FIELDS,
      required_groups: {
        input: ["input_contract", "required_resources"],
        output: ["output_contract", "output_artifacts"],
        gates: ["required_gates"],
        runtime: ["allowed_runtimes", "required_tools"],
        version: ["schema_version", "version"],
      },
    },
    workflow_v2: {
      required_fields: WORKFLOW_REQUIRED_FIELDS,
      optional_fields: WORKFLOW_OPTIONAL_FIELDS,
      required_groups: {
        input: ["steps.input_refs"],
        output: ["steps.output_contract"],
        gates: ["steps.step_type=gate", "gate_contracts"],
        runtime: ["steps.runtime_id", "runtime_contracts"],
        version: ["schema_version", "version"],
      },
    },
    workflow_run_v2: {
      required_fields: WORKFLOW_RUN_REQUIRED_FIELDS,
      optional_fields: WORKFLOW_RUN_OPTIONAL_FIELDS,
      required_groups: {
        input: ["input_refs"],
        output: ["output_refs"],
        gates: ["policy_snapshot_id"],
        runtime: ["runtime_ids", "agent_run_ids"],
        version: ["schema_version", "capability_version"],
      },
    },
    agent_run_v2: {
      required_fields: AGENT_RUN_REQUIRED_FIELDS,
      optional_fields: AGENT_RUN_OPTIONAL_FIELDS,
      required_groups: {
        input: ["input_ref"],
        output: ["output_ref"],
        gates: ["status"],
        runtime: ["runtime_id"],
        version: ["schema_version"],
      },
    },
  };
}

function flattenGateMap(gateMap) {
  return GATE_PHASES.flatMap((phase) => (gateMap[phase] ?? []).map((gateId) => ({ phase, gate_id: gateId })));
}

function normalizeGateMap(gateMap = {}) {
  return {
    pre_run: gateMap.pre_run ?? [],
    in_run: gateMap.in_run ?? [],
    post_run: gateMap.post_run ?? [],
  };
}

function validationItem(pathLabel, ruleId, passed, message, metadata = {}) {
  return {
    schema_version: "contract-validation-item.v1",
    path: pathLabel,
    rule_id: ruleId,
    status: passed ? "passed" : "failed",
    message: passed ? message : `${message} Validation failed.`,
    metadata,
  };
}

function inferDomainPack(capabilityId = "") {
  if (capabilityId.startsWith("law_firm.")) return "law-firm";
  if (capabilityId.startsWith("personal_dev.")) return "personal-dev";
  if (capabilityId.startsWith("creative_document.")) return "creative-document";
  return "platform";
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
    else if (arg === "--domain-pack-registry") args.domainPackRegistryPath = argv[++index];
    else if (arg === "--law-firm-slice") args.lawFirmSlicePath = argv[++index];
    else if (arg === "--personal-dev-slice") args.personalDevSlicePath = argv[++index];
    else if (arg === "--creative-document-slice") args.creativeDocumentSlicePath = argv[++index];
    else if (arg === "--policy-contract-freeze") args.policyContractFreezePath = argv[++index];
    else if (arg === "--evidence-contract-freeze") args.evidenceContractFreezePath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/capability-workflow-contract-freeze.mjs [options]

Options:
  --check                         Exit non-zero when validation fails
  --no-write                      Build without writing artifacts
  --out-dir <path>                Output directory
  --domain-pack-registry <path>   Domain pack registry artifact
  --law-firm-slice <path>         Law-firm slice artifact
  --personal-dev-slice <path>     Personal-dev slice artifact
  --creative-document-slice <path> Creative-document slice artifact
  --policy-contract-freeze <path> Policy contract freeze artifact
  --evidence-contract-freeze <path> Evidence contract freeze artifact
  --run-at <iso>                  Fixed generated_at timestamp`);
}

function dateStamp(value) {
  return value.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).length > 0;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined))].sort();
}

function duplicates(values) {
  const seen = new Set();
  const duplicated = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicated.add(value);
    seen.add(value);
  }
  return [...duplicated].sort();
}

function countBy(records, field) {
  return countValues(records.map((record) => record[field] ?? "unknown"));
}

function countValues(values) {
  return values.reduce((counts, value) => {
    const key = String(value ?? "unknown");
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
