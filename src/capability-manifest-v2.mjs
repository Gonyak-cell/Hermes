import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CAPABILITY_MANIFEST_V2_OUT_DIR = "artifacts/capability-manifest-v2/latest";
export const DEFAULT_CAPABILITY_MANIFEST_V2_INPUTS = {
  capabilityWorkflowContractFreezePath: "artifacts/capability-workflow-contract-freeze/latest/capability-workflow-contract-freeze.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const REQUIRED_POLICY_FIELDS = [
  "data_policy",
  "approval_policy",
  "idempotency_policy",
  "retry_policy",
  "timeout_policy",
  "cost_policy",
  "observability_policy",
];

const GATE_PHASES = ["pre_run", "in_run", "post_run"];

export async function runCapabilityManifestV2(options = {}) {
  const result = await buildCapabilityManifestV2(options);
  if (options.write !== false) await writeCapabilityManifestV2(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Capability manifest v2 validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCapabilityManifestV2(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CAPABILITY_MANIFEST_V2_OUT_DIR);
  const inputs = {
    capability_workflow_contract_freeze_path: path.resolve(
      options.capabilityWorkflowContractFreezePath ?? DEFAULT_CAPABILITY_MANIFEST_V2_INPUTS.capabilityWorkflowContractFreezePath,
    ),
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_CAPABILITY_MANIFEST_V2_INPUTS.domainPackRegistryPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CAPABILITY_MANIFEST_V2_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_CAPABILITY_MANIFEST_V2_INPUTS.roadmapPath),
  };

  const capabilityWorkflowContractFreeze = await readJson(inputs.capability_workflow_contract_freeze_path);
  const domainPackRegistry = await readJson(inputs.domain_pack_registry_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");
  const manifests = capabilityWorkflowContractFreeze.capability_workflow_contract?.capability_manifests ?? [];
  const gateRuntimeContracts = capabilityWorkflowContractFreeze.capability_workflow_contract?.gate_runtime_contracts ?? [];
  const ioContracts = capabilityWorkflowContractFreeze.capability_workflow_contract?.capability_io_contracts ?? [];
  const registryCapabilities = domainPackRegistry.capabilities ?? [];

  const fieldMatrix = buildFieldMatrix(manifests, ioContracts, registryCapabilities, generatedAt);
  const gateRuntimeMatrix = buildGateRuntimeMatrix(manifests, gateRuntimeContracts, generatedAt);
  const policyIndex = buildPolicyIndex(manifests, generatedAt);
  const versionPolicyIndex = buildVersionPolicyIndex(manifests, generatedAt);
  const validationItems = validateCapabilityManifestV2({
    capabilityWorkflowContractFreeze,
    domainPackRegistry,
    packageJson,
    roadmapText,
    manifests,
    fieldMatrix,
    gateRuntimeMatrix,
    policyIndex,
    versionPolicyIndex,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "capability-manifest-v2-catalog.v1",
    generated_at: generatedAt,
    capability_manifest_v2_id: `capability-manifest-v2.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      capability_workflow_contract_freeze: {
        schema_version: capabilityWorkflowContractFreeze.schema_version,
        freeze_id: capabilityWorkflowContractFreeze.freeze_id,
        freeze_status: capabilityWorkflowContractFreeze.summary?.freeze_status ?? null,
        capability_manifest_schema_version: capabilityWorkflowContractFreeze.summary?.capability_manifest_schema_version ?? null,
        capability_manifest_count: capabilityWorkflowContractFreeze.summary?.capability_manifest_count ?? 0,
        validation_error_count: capabilityWorkflowContractFreeze.summary?.validation_error_count ?? capabilityWorkflowContractFreeze.validation?.errors?.length ?? 0,
      },
      domain_pack_registry: {
        schema_version: domainPackRegistry.schema_version,
        registry_status: domainPackRegistry.validation?.valid ? "passed" : "failed",
        capability_count: domainPackRegistry.summary?.capability_count ?? registryCapabilities.length,
        valid_capability_count: domainPackRegistry.summary?.valid_capability_count ?? 0,
        error_count: domainPackRegistry.summary?.error_count ?? 0,
      },
    },
    capability_manifest_v2_catalog: {
      schema_version: "capability-manifest-v2-catalog.v1",
      capability_manifest_schema_version: "capability-manifest.v2",
      capability_manifests: manifests,
      field_matrix: fieldMatrix,
      gate_runtime_matrix: gateRuntimeMatrix,
      policy_index: policyIndex,
      version_policy_index: versionPolicyIndex,
    },
    capability_manifests: manifests,
    capability_field_matrix: fieldMatrix,
    capability_gate_runtime_matrix: gateRuntimeMatrix,
    capability_policy_index: policyIndex,
    capability_version_policy_index: versionPolicyIndex,
    summary: summarizeCapabilityManifestV2({
      manifests,
      fieldMatrix,
      gateRuntimeMatrix,
      policyIndex,
      versionPolicyIndex,
      registryCapabilities,
      validationItems,
      validation,
    }),
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderCapabilityManifestV2Markdown(result),
  };
}

export async function writeCapabilityManifestV2(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableCapabilityManifestV2(result);
  await writeJson(path.join(outDir, "capability-manifest-v2.json"), serializable);
  await writeJson(path.join(outDir, "capability-manifests.json"), {
    generated_at: result.generated_at,
    capability_manifest_schema_version: "capability-manifest.v2",
    capability_manifest_count: result.capability_manifests.length,
    capability_manifests: result.capability_manifests,
  });
  await writeJson(path.join(outDir, "capability-field-matrix.json"), {
    generated_at: result.generated_at,
    matrix_count: result.capability_field_matrix.length,
    capability_field_matrix: result.capability_field_matrix,
  });
  await writeJson(path.join(outDir, "capability-gate-runtime-matrix.json"), {
    generated_at: result.generated_at,
    matrix_count: result.capability_gate_runtime_matrix.length,
    capability_gate_runtime_matrix: result.capability_gate_runtime_matrix,
  });
  await writeJson(path.join(outDir, "capability-policy-index.json"), {
    generated_at: result.generated_at,
    index_count: result.capability_policy_index.length,
    capability_policy_index: result.capability_policy_index,
  });
  await writeJson(path.join(outDir, "capability-version-policy-index.json"), {
    generated_at: result.generated_at,
    index_count: result.capability_version_policy_index.length,
    capability_version_policy_index: result.capability_version_policy_index,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    capability_manifest_v2_id: result.capability_manifest_v2_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCapabilityManifestV2Cli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCapabilityManifestV2(args);
    console.log(`Capability manifest v2 catalog written to ${result.output_dir}`);
    console.log(`Capability manifests: ${result.summary.capability_manifest_count}`);
    console.log(`Input/output complete: ${result.summary.capability_with_input_output_count}`);
    console.log(`Gate requirements: ${result.summary.gate_requirement_count}`);
    console.log(`Runtime requirements: ${result.summary.runtime_requirement_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildFieldMatrix(manifests, ioContracts, registryCapabilities, generatedAt) {
  const ioByCapability = new Map(ioContracts.map((contract) => [contract.capability_id, contract]));
  const registryByCapability = new Map(registryCapabilities.map((capability) => [capability.capability_id, capability]));
  return manifests.map((manifest) => {
    const missingRequiredFields = manifest.field_requirements?.missing_required_fields ?? [];
    const presentRequiredFields = manifest.field_requirements?.present_required_fields ?? [];
    const requiredFields = manifest.field_requirements?.required_fields ?? [];
    const ioContract = ioByCapability.get(manifest.capability_id);
    return {
      schema_version: "capability-manifest-field-matrix.v1",
      capability_id: manifest.capability_id,
      version: manifest.version ?? null,
      domain_pack: manifest.domain_pack ?? null,
      pack_id: manifest.pack_id ?? registryByCapability.get(manifest.capability_id)?.pack_id ?? manifest.domain_pack ?? null,
      registry_link_status: registryByCapability.has(manifest.capability_id) ? "linked" : "missing",
      manifest_status: missingRequiredFields.length === 0 ? "complete" : "blocked",
      field_status: missingRequiredFields.length === 0 && Boolean(manifest.input_contract?.schema_ref && manifest.output_contract?.schema_ref) ? "complete" : "blocked",
      required_field_count: requiredFields.length,
      present_required_field_count: presentRequiredFields.length,
      missing_required_field_count: missingRequiredFields.length,
      missing_required_fields: missingRequiredFields,
      input_contract_declared: Boolean(manifest.input_contract?.schema_ref),
      input_schema_ref: manifest.input_contract?.schema_ref ?? null,
      output_contract_declared: Boolean(manifest.output_contract?.schema_ref),
      output_schema_ref: manifest.output_contract?.schema_ref ?? null,
      io_contract_link_status: ioContract?.input_output_status === "complete" ? "linked" : "missing",
      version_declared: Boolean(manifest.version),
      source_manifest_path: manifest.source_manifest_path ?? null,
      created_at: generatedAt,
    };
  });
}

function buildGateRuntimeMatrix(manifests, gateRuntimeContracts, generatedAt) {
  const contractByCapability = new Map(gateRuntimeContracts.map((contract) => [contract.capability_id, contract]));
  return manifests.map((manifest) => {
    const gateRequirements = manifest.gate_requirements ?? [];
    const runtimeRequirements = manifest.runtime_requirements ?? [];
    const contract = contractByCapability.get(manifest.capability_id);
    const runtimeBindings = contract?.runtime_bindings ?? [];
    const unknownRuntimes = runtimeRequirements.filter((runtime) => !runtime.runtime_known).map((runtime) => runtime.runtime_id);
    const blockedRuntimeBindings = runtimeBindings.filter((binding) => !binding.allowed_by_capability).map((binding) => binding.runtime_id);
    const gatePhaseCounts = Object.fromEntries(GATE_PHASES.map((phase) => [phase, gateRequirements.filter((gate) => gate.phase === phase).length]));
    return {
      schema_version: "capability-manifest-gate-runtime-matrix.v1",
      capability_id: manifest.capability_id,
      version: manifest.version ?? null,
      domain_pack: manifest.domain_pack ?? null,
      gate_runtime_status: gateRequirements.length > 0 && runtimeRequirements.length > 0 && unknownRuntimes.length === 0 && blockedRuntimeBindings.length === 0 ? "complete" : "blocked",
      required_gate_count: gateRequirements.length,
      required_gate_ids: gateRequirements.map((gate) => gate.gate_id),
      gate_phase_counts: gatePhaseCounts,
      runtime_requirement_count: runtimeRequirements.length,
      runtime_ids: runtimeRequirements.map((runtime) => runtime.runtime_id),
      runtime_known_count: runtimeRequirements.filter((runtime) => runtime.runtime_known).length,
      runtime_unknown_count: unknownRuntimes.length,
      unknown_runtime_ids: unknownRuntimes,
      runtime_binding_count: runtimeBindings.length,
      blocked_runtime_binding_count: blockedRuntimeBindings.length,
      blocked_runtime_ids: blockedRuntimeBindings,
      approval_required: manifest.approval_policy?.required === true,
      human_review_gate_required: gateRequirements.some((gate) => gate.gate_id === "human_approval_gate"),
      created_at: generatedAt,
    };
  });
}

function buildPolicyIndex(manifests, generatedAt) {
  return manifests.map((manifest) => {
    const missingPolicyFields = REQUIRED_POLICY_FIELDS.filter((field) => !hasValue(manifest[field]));
    const outputArtifacts = manifest.output_artifacts ?? [];
    const clientFacingReadyOutputs = outputArtifacts.filter((artifact) => artifact.delivery_policy === "client_facing" && artifact.default_status === "ready");
    return {
      schema_version: "capability-manifest-policy-index.v1",
      capability_id: manifest.capability_id,
      version: manifest.version ?? null,
      domain_pack: manifest.domain_pack ?? null,
      policy_status: missingPolicyFields.length === 0 && clientFacingReadyOutputs.length === 0 ? "complete" : "blocked",
      missing_policy_fields: missingPolicyFields,
      data_classification: manifest.data_policy?.max_input_classification ?? null,
      external_model_policy: manifest.data_policy?.external_model_policy ?? null,
      retrieval_filters_required: manifest.data_policy?.retrieval_filters_required ?? [],
      redaction_required: manifest.data_policy?.redaction_required ?? false,
      approval_required: manifest.approval_policy?.required === true,
      approval_type: manifest.approval_policy?.approval_type ?? null,
      default_output_status: manifest.approval_policy?.default_output_status ?? null,
      attorney_review_required: manifest.approval_policy?.approval_type === "attorney_review",
      human_review_required: Boolean(manifest.approval_policy?.required),
      idempotency_required: manifest.idempotency_policy?.required === true,
      idempotency_key_fields: manifest.idempotency_policy?.key_fields ?? [],
      retry_max_attempts: manifest.retry_policy?.max_attempts ?? null,
      timeout_max_seconds: manifest.timeout_policy?.max_seconds ?? null,
      cost_max_usd: manifest.cost_policy?.max_usd ?? null,
      token_tracking_required: manifest.cost_policy?.track_tokens === true,
      trace_required: manifest.observability_policy?.record_trace === true,
      prompt_hash_required: manifest.observability_policy?.record_prompt_hash === true,
      output_hash_required: manifest.observability_policy?.record_output_hash === true,
      cost_record_required: manifest.observability_policy?.record_cost === true,
      output_artifact_count: outputArtifacts.length,
      client_facing_ready_output_count: clientFacingReadyOutputs.length,
      protected_action_executed_count: 0,
      created_at: generatedAt,
    };
  });
}

function buildVersionPolicyIndex(manifests, generatedAt) {
  return manifests.map((manifest) => ({
    schema_version: "capability-manifest-version-policy.v1",
    capability_id: manifest.capability_id,
    version: manifest.version ?? null,
    domain_pack: manifest.domain_pack ?? null,
    version_status: manifest.version && manifest.schema_version === "capability-manifest.v2" ? "complete" : "blocked",
    manifest_schema_version: manifest.schema_version ?? null,
    source_schema_version: manifest.source_schema_version ?? null,
    source_manifest_path: manifest.source_manifest_path ?? null,
    source_workflow_count: manifest.source_workflow_count ?? (manifest.source_workflow_ids ?? []).length,
    source_workflow_ids: manifest.source_workflow_ids ?? [],
    created_at: generatedAt,
  }));
}

function validateCapabilityManifestV2({
  capabilityWorkflowContractFreeze,
  domainPackRegistry,
  packageJson,
  roadmapText,
  manifests,
  fieldMatrix,
  gateRuntimeMatrix,
  policyIndex,
  versionPolicyIndex,
}) {
  const items = [];
  const registryCapabilityIds = new Set((domainPackRegistry.capabilities ?? []).map((capability) => capability.capability_id));
  const duplicateIds = duplicates(manifests.map((manifest) => manifest.capability_id));
  const missingRegistryLinks = fieldMatrix.filter((row) => row.registry_link_status !== "linked").map((row) => row.capability_id);
  const missingRequiredFieldRows = fieldMatrix.filter((row) => row.missing_required_field_count > 0);
  const missingIoRows = fieldMatrix.filter((row) => !(row.input_contract_declared && row.output_contract_declared));
  const unknownRuntimeRows = gateRuntimeMatrix.filter((row) => row.runtime_unknown_count > 0);
  const blockedRuntimeRows = gateRuntimeMatrix.filter((row) => row.blocked_runtime_binding_count > 0);
  const missingGateRuntimeRows = gateRuntimeMatrix.filter((row) => row.required_gate_count === 0 || row.runtime_requirement_count === 0);
  const blockedPolicyRows = policyIndex.filter((row) => row.policy_status !== "complete");
  const missingHumanReviewRows = policyIndex.filter((row) => row.approval_required && !row.approval_type);
  const blockedVersionRows = versionPolicyIndex.filter((row) => row.version_status !== "complete");
  const clientFacingReadyRows = policyIndex.filter((row) => row.client_facing_ready_output_count > 0);
  const protectedActionRows = policyIndex.filter((row) => row.protected_action_executed_count > 0);

  items.push(validationItem("source.capability_workflow_contract_freeze", "freeze_complete", capabilityWorkflowContractFreeze.summary?.freeze_status === "complete", "Capability/workflow contract freeze is complete."));
  items.push(validationItem("source.capability_workflow_contract_freeze", "source_validation_clean", (capabilityWorkflowContractFreeze.summary?.validation_error_count ?? capabilityWorkflowContractFreeze.validation?.errors?.length ?? 0) === 0, "Capability/workflow contract freeze has no validation errors."));
  items.push(validationItem("source.domain_pack_registry", "registry_valid", domainPackRegistry.validation?.valid === true, "Domain Pack Registry is valid."));
  items.push(validationItem("capability_manifests", "count_matches_registry", manifests.length === registryCapabilityIds.size, "Capability manifest count matches registry."));
  items.push(validationItem("capability_manifests", "unique_ids", duplicateIds.length === 0, "Capability manifest ids are unique.", { duplicates: duplicateIds }));
  items.push(validationItem("capability_manifests", "schema_version_v2", manifests.every((manifest) => manifest.schema_version === "capability-manifest.v2"), "All manifests use capability-manifest.v2."));
  items.push(validationItem("capability_manifests", "registry_links_complete", missingRegistryLinks.length === 0, "All capability manifests link to Domain Pack Registry.", { missing_capability_ids: missingRegistryLinks }));
  items.push(validationItem("field_matrix", "required_fields_complete", missingRequiredFieldRows.length === 0, "Required field coverage is complete.", { blocked_capability_ids: missingRequiredFieldRows.map((row) => row.capability_id) }));
  items.push(validationItem("field_matrix", "input_output_declared", missingIoRows.length === 0, "Input and output contracts are declared.", { blocked_capability_ids: missingIoRows.map((row) => row.capability_id) }));
  items.push(validationItem("gate_runtime_matrix", "gate_runtime_declared", missingGateRuntimeRows.length === 0, "Gate and runtime requirements are declared.", { blocked_capability_ids: missingGateRuntimeRows.map((row) => row.capability_id) }));
  items.push(validationItem("gate_runtime_matrix", "runtimes_known", unknownRuntimeRows.length === 0, "Runtime requirements are known.", { blocked_capability_ids: unknownRuntimeRows.map((row) => row.capability_id) }));
  items.push(validationItem("gate_runtime_matrix", "runtime_bindings_allowed", blockedRuntimeRows.length === 0, "Runtime bindings are allowed by capability manifests.", { blocked_capability_ids: blockedRuntimeRows.map((row) => row.capability_id) }));
  items.push(validationItem("policy_index", "policy_fields_complete", blockedPolicyRows.length === 0, "Policy fields are complete and no client-facing ready output is declared.", { blocked_capability_ids: blockedPolicyRows.map((row) => row.capability_id) }));
  items.push(validationItem("policy_index", "human_review_guardrail", missingHumanReviewRows.length === 0, "Approval-required capabilities declare a human or attorney review type.", { blocked_capability_ids: missingHumanReviewRows.map((row) => row.capability_id) }));
  items.push(validationItem("policy_index", "no_client_facing_ready_output", clientFacingReadyRows.length === 0, "Capability manifests do not mark client-facing outputs ready."));
  items.push(validationItem("policy_index", "no_protected_action_execution", protectedActionRows.length === 0, "Capability manifest catalog does not execute protected actions."));
  items.push(validationItem("version_policy_index", "version_policy_complete", blockedVersionRows.length === 0, "Schema and capability versions are declared.", { blocked_capability_ids: blockedVersionRows.map((row) => row.capability_id) }));
  items.push(validationItem("support.package", "script_registered", Boolean(packageJson.scripts?.["capabilities:manifest-v2"]), "P177 capability manifest v2 script is registered."));
  items.push(validationItem("support.roadmap", "roadmap_mentions_phase_177", roadmapText.includes("Phase 177") && roadmapText.includes("capability manifest v2"), "Roadmap documents Phase 177 capability manifest v2."));

  return items;
}

function summarizeCapabilityManifestV2({
  manifests,
  fieldMatrix,
  gateRuntimeMatrix,
  policyIndex,
  versionPolicyIndex,
  registryCapabilities,
  validationItems,
  validation,
}) {
  const gateRequirementCount = gateRuntimeMatrix.reduce((sum, row) => sum + row.required_gate_count, 0);
  const runtimeRequirementCount = gateRuntimeMatrix.reduce((sum, row) => sum + row.runtime_requirement_count, 0);
  const runtimeBindingCount = gateRuntimeMatrix.reduce((sum, row) => sum + row.runtime_binding_count, 0);
  const missingRequiredFieldCount = fieldMatrix.reduce((sum, row) => sum + row.missing_required_field_count, 0);
  const clientFacingReadyCount = policyIndex.reduce((sum, row) => sum + row.client_facing_ready_output_count, 0);
  const protectedActionExecutedCount = policyIndex.reduce((sum, row) => sum + row.protected_action_executed_count, 0);
  const status = validation.valid ? "complete" : "blocked";
  return {
    capability_manifest_v2_status: status,
    capability_manifest_v2_contract_id: "capability-manifest-v2-catalog.v1",
    capability_manifest_schema_version: "capability-manifest.v2",
    capability_manifest_count: manifests.length,
    registry_capability_count: registryCapabilities.length,
    registry_linked_capability_count: fieldMatrix.filter((row) => row.registry_link_status === "linked").length,
    input_contract_count: fieldMatrix.filter((row) => row.input_contract_declared).length,
    output_contract_count: fieldMatrix.filter((row) => row.output_contract_declared).length,
    capability_with_input_output_count: fieldMatrix.filter((row) => row.input_contract_declared && row.output_contract_declared).length,
    required_field_declared_count: fieldMatrix.reduce((sum, row) => sum + row.present_required_field_count, 0),
    missing_required_field_count: missingRequiredFieldCount,
    capability_with_missing_required_field_count: fieldMatrix.filter((row) => row.missing_required_field_count > 0).length,
    field_matrix_count: fieldMatrix.length,
    gate_runtime_matrix_count: gateRuntimeMatrix.length,
    gate_requirement_count: gateRequirementCount,
    pre_run_gate_count: gateRuntimeMatrix.reduce((sum, row) => sum + (row.gate_phase_counts.pre_run ?? 0), 0),
    in_run_gate_count: gateRuntimeMatrix.reduce((sum, row) => sum + (row.gate_phase_counts.in_run ?? 0), 0),
    post_run_gate_count: gateRuntimeMatrix.reduce((sum, row) => sum + (row.gate_phase_counts.post_run ?? 0), 0),
    runtime_requirement_count: runtimeRequirementCount,
    known_runtime_requirement_count: gateRuntimeMatrix.reduce((sum, row) => sum + row.runtime_known_count, 0),
    unknown_runtime_requirement_count: gateRuntimeMatrix.reduce((sum, row) => sum + row.runtime_unknown_count, 0),
    runtime_binding_count: runtimeBindingCount,
    runtime_blocked_count: gateRuntimeMatrix.reduce((sum, row) => sum + row.blocked_runtime_binding_count, 0),
    policy_index_count: policyIndex.length,
    policy_bound_capability_count: policyIndex.filter((row) => row.policy_status === "complete").length,
    approval_required_capability_count: policyIndex.filter((row) => row.approval_required).length,
    attorney_review_capability_count: policyIndex.filter((row) => row.attorney_review_required).length,
    human_review_capability_count: policyIndex.filter((row) => row.human_review_required).length,
    idempotency_key_count: policyIndex.reduce((sum, row) => sum + row.idempotency_key_fields.length, 0),
    retry_policy_count: policyIndex.filter((row) => Number.isFinite(row.retry_max_attempts)).length,
    timeout_policy_count: policyIndex.filter((row) => Number.isFinite(row.timeout_max_seconds)).length,
    cost_policy_count: policyIndex.filter((row) => Number.isFinite(row.cost_max_usd)).length,
    observability_policy_count: policyIndex.filter((row) => row.trace_required && row.output_hash_required && row.cost_record_required).length,
    output_artifact_count: policyIndex.reduce((sum, row) => sum + row.output_artifact_count, 0),
    version_index_count: versionPolicyIndex.length,
    version_declared_count: versionPolicyIndex.filter((row) => row.version_status === "complete").length,
    client_facing_ready_count: clientFacingReadyCount,
    protected_action_executed_count: protectedActionExecutedCount,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_domain_pack: countBy(manifests, "domain_pack"),
    by_runtime_id: countValues(gateRuntimeMatrix.flatMap((row) => row.runtime_ids)),
    by_gate_id: countValues(gateRuntimeMatrix.flatMap((row) => row.required_gate_ids)),
    by_approval_type: countValues(policyIndex.map((row) => row.approval_type ?? "none")),
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

function renderCapabilityManifestV2Markdown(result) {
  const lines = [];
  lines.push("# Capability Manifest v2 Catalog");
  lines.push("");
  lines.push(`- Catalog ID: ${result.capability_manifest_v2_id}`);
  lines.push(`- Status: ${result.summary.capability_manifest_v2_status}`);
  lines.push(`- Capability manifests: ${result.summary.capability_manifest_count}`);
  lines.push(`- Input/output complete: ${result.summary.capability_with_input_output_count}`);
  lines.push(`- Required fields missing: ${result.summary.missing_required_field_count}`);
  lines.push(`- Gate requirements: ${result.summary.gate_requirement_count}`);
  lines.push(`- Runtime requirements: ${result.summary.runtime_requirement_count}`);
  lines.push(`- Unknown runtimes: ${result.summary.unknown_runtime_requirement_count}`);
  lines.push(`- Policy-bound capabilities: ${result.summary.policy_bound_capability_count}`);
  lines.push(`- Version-declared capabilities: ${result.summary.version_declared_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Capability Matrix");
  for (const row of result.capability_field_matrix) {
    lines.push(`- ${row.capability_id}@${row.version}: ${row.input_schema_ref} -> ${row.output_schema_ref}, fields ${row.field_status}`);
  }
  lines.push("");
  lines.push("## Gate And Runtime Matrix");
  for (const row of result.capability_gate_runtime_matrix) {
    lines.push(`- ${row.capability_id}: gates ${row.required_gate_count}, runtimes ${row.runtime_requirement_count}, status ${row.gate_runtime_status}`);
  }
  lines.push("");
  lines.push("## Review Guardrails");
  lines.push("- Client-facing ready outputs: 0");
  lines.push("- Protected action executions: 0");
  lines.push("- Attorney/human review remains required by capability approval policies.");
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
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

function serializableCapabilityManifestV2(result) {
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
    else if (arg === "--capability-workflow-contract-freeze") args.capabilityWorkflowContractFreezePath = argv[++index];
    else if (arg === "--domain-pack-registry") args.domainPackRegistryPath = argv[++index];
    else if (arg === "--package") args.packagePath = argv[++index];
    else if (arg === "--roadmap") args.roadmapPath = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/capability-manifest-v2.mjs [options]

Options:
  --check                                  Exit non-zero when validation fails
  --no-write                               Build without writing artifacts
  --out-dir <path>                         Output directory
  --capability-workflow-contract-freeze <path>
                                           Phase 103 capability/workflow freeze artifact
  --domain-pack-registry <path>            Domain pack registry artifact
  --package <path>                         package.json for script registration check
  --roadmap <path>                         Implementation roadmap path
  --run-at <iso>                           Fixed generated_at timestamp`);
}

function dateStamp(value) {
  return value.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return String(value).length > 0;
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
