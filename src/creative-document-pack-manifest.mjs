import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CREATIVE_DOCUMENT_PACK_MANIFEST_OUT_DIR = "artifacts/creative-document-pack-manifest/latest";
export const DEFAULT_CREATIVE_DOCUMENT_PACK_MANIFEST_INPUTS = {
  creativeDocumentPackPath: "packs/creative-document/pack.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  packManifestCompatibilityPath: "artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json",
  capabilityManifestV2Path: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  documentRendererAdapterPath: "artifacts/document-renderer-adapter/latest/document-renderer-adapter.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "creative-document-pack-manifest.v1";
const PACK_ID = "creative-document";
const COMMON_PACK_ID = "common";
const DESKTOP_SURFACE_POLICY = "read_only_creative_document_operator_surface";
const SOURCE_OF_TRUTH = "domain_pack_registry_and_creative_document_pack_manifest";

export async function runCreativeDocumentPackManifest(options = {}) {
  const result = await buildCreativeDocumentPackManifest(options);
  if (options.write !== false) await writeCreativeDocumentPackManifest(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Creative-document pack manifest validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCreativeDocumentPackManifest(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CREATIVE_DOCUMENT_PACK_MANIFEST_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const packManifest = sourceById.creative_document_pack_manifest_source;
  const domainPackRegistry = sourceById.domain_pack_registry;
  const packManifestCompatibility = sourceById.pack_manifest_compatibility;
  const capabilityManifestV2 = sourceById.capability_manifest_v2;
  const capabilityRegistryApi = sourceById.capability_registry_api;
  const runtimeFreeze = sourceById.runtime_freeze;
  const documentRendererAdapter = sourceById.document_renderer_adapter;
  const outputDeliveryContractFreeze = sourceById.output_delivery_contract_freeze;

  const packRecord = domainPackRegistry?.packs?.find((pack) => pack.pack_id === PACK_ID) ?? null;
  const compatibilityRecord = packManifestCompatibility?.pack_compatibility_records?.find((record) => record.pack_id === PACK_ID) ?? null;
  const compatibilityMatrixRow = packManifestCompatibility?.compatibility_matrix?.find((row) => row.pack_id === PACK_ID) ?? null;
  const manifestCapabilities = packManifest?.capabilities ?? [];
  const registryCapabilities = manifestCapabilities.map((capability) => domainPackRegistry?.capabilities?.find((record) => record.capability_id === capability.capability_id && record.pack_id === PACK_ID) ?? null);
  const capabilityManifests = manifestCapabilities.map((capability) => capabilityManifestV2?.capability_manifests?.find((record) => record.capability_id === capability.capability_id && (record.pack_id === PACK_ID || record.domain_pack === PACK_ID)) ?? null);
  const packApiCard = capabilityRegistryApi?.pack_api_cards?.find((card) => card.pack_id === PACK_ID) ?? null;
  const capabilityApiCards = manifestCapabilities.map((capability) => capabilityRegistryApi?.capability_api_cards?.find((card) => card.capability_id === capability.capability_id && card.pack_id === PACK_ID) ?? null);
  const capabilityVersionApiCards = manifestCapabilities.map((capability) => capabilityRegistryApi?.capability_version_api_cards?.find((card) => card.capability_id === capability.capability_id && card.version === capability.version && (card.pack_id === PACK_ID || card.domain_pack === PACK_ID)) ?? null);

  const packRegistration = buildPackRegistration({
    generatedAt,
    inputs,
    packManifest,
    packRecord,
    compatibilityRecord,
    compatibilityMatrixRow,
    manifestCapabilities,
    registryCapabilities,
    capabilityManifests,
    packApiCard,
    capabilityApiCards,
    capabilityVersionApiCards,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
  });
  const capabilityRegistrations = buildCapabilityRegistrations({
    generatedAt,
    packManifest,
    manifestCapabilities,
    registryCapabilities,
    capabilityManifests,
    capabilityApiCards,
    capabilityVersionApiCards,
  });
  const packBoundary = buildPackBoundary({
    generatedAt,
    packManifest,
    packRecord,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    packApiCard,
    capabilityRegistrations,
  });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    packManifest,
    domainPackRegistry,
    packManifestCompatibility,
    capabilityManifestV2,
    capabilityRegistryApi,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    sourceReads,
    packRegistration,
    capabilityRegistrations,
    packBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeCreativeDocumentPackManifest({
    packManifest,
    packRegistration,
    capabilityRegistrations,
    packBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    creative_document_pack_manifest_id: `creative-document-pack-manifest.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    creative_document_pack_manifest_status: summary.creative_document_pack_manifest_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    creative_document_pack_manifest_contract: buildContract(generatedAt),
    creative_document_pack_registration: packRegistration,
    creative_document_capability_registrations: capabilityRegistrations,
    creative_document_pack_boundary: packBoundary,
    creative_document_pack_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderCreativeDocumentPackManifestMarkdown(result),
  };
}

export async function writeCreativeDocumentPackManifest(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableCreativeDocumentPackManifest(result);
  await writeJson(path.join(outDir, "creative-document-pack-manifest.json"), serializable);
  await writeJson(path.join(outDir, "creative-document-pack-registration.json"), {
    schema_version: "creative-document-pack-registration-artifact.v1",
    generated_at: result.generated_at,
    creative_document_pack_registration: result.creative_document_pack_registration,
  });
  await writeJson(path.join(outDir, "creative-document-capability-registrations.json"), {
    schema_version: "creative-document-capability-registrations.v1",
    generated_at: result.generated_at,
    creative_document_capability_registration_count: result.creative_document_capability_registrations.length,
    creative_document_capability_registrations: result.creative_document_capability_registrations,
  });
  await writeJson(path.join(outDir, "creative-document-pack-boundary.json"), {
    schema_version: "creative-document-pack-boundary-artifact.v1",
    generated_at: result.generated_at,
    creative_document_pack_boundary: result.creative_document_pack_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "creative-document-pack-manifest-validation-report.v1",
    generated_at: result.generated_at,
    creative_document_pack_manifest_id: result.creative_document_pack_manifest_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCreativeDocumentPackManifestCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runCreativeDocumentPackManifest(args);
    console.log(`Creative-document pack manifest ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.creative_document_pack_manifest_status}`);
    console.log(`Capabilities: ${result.summary.registered_capability_count}/${result.summary.capability_count}`);
    console.log(`Format validation required: ${result.summary.format_validation_required}`);
    console.log(`Core mutations required: ${result.summary.core_mutation_required_count}`);
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
    schema_version: "creative-document-pack-manifest-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    domain_track: "creative_document_domain_pack",
    source_of_truth: SOURCE_OF_TRUTH,
    registration_rule: "creative_document_capabilities_must_be_registered_through_domain_pack_registry_without_core_mutation",
    document_boundary_rule: "template_style_asset_and_renderer_capabilities_remain_draft_only_until_format_validation_and_human_approval",
    desktop_companion_rule: "desktop_companion_reads_creative_document_pack_capability_renderer_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_execute_renderers_delivery_core_registry_or_protected_mutations",
    created_at: generatedAt,
  };
}

function buildPackRegistration({
  generatedAt,
  inputs,
  packManifest,
  packRecord,
  compatibilityRecord,
  compatibilityMatrixRow,
  manifestCapabilities,
  registryCapabilities,
  capabilityManifests,
  packApiCard,
  capabilityApiCards,
  capabilityVersionApiCards,
  runtimeFreeze,
  documentRendererAdapter,
  outputDeliveryContractFreeze,
}) {
  const registeredCapabilityCount = registryCapabilities.filter(Boolean).length;
  const capabilityManifestV2Count = capabilityManifests.filter(Boolean).length;
  const capabilityApiCardCount = capabilityApiCards.filter(Boolean).length;
  const capabilityVersionApiCardCount = capabilityVersionApiCards.filter(Boolean).length;
  const status = packManifest?.pack_id === PACK_ID
    && packRecord
    && compatibilityRecord?.compatibility_status === "compatible"
    && registeredCapabilityCount === manifestCapabilities.length
    && capabilityManifestV2Count === manifestCapabilities.length
    && capabilityApiCardCount === manifestCapabilities.length
    && capabilityVersionApiCardCount === manifestCapabilities.length
    ? "registered"
    : "blocked";
  const permissions = packManifest?.permissions ?? {};
  return {
    schema_version: "creative-document-pack-registration.v1",
    registration_id: "creative-document-pack-registration.creative-document",
    pack_id: PACK_ID,
    pack_version: packManifest?.pack_version ?? null,
    display_name: packManifest?.display_name ?? null,
    manifest_schema_version: packManifest?.schema_version ?? null,
    manifest_path: path.resolve(inputs.creative_document_pack_path),
    registry_pack_present: Boolean(packRecord),
    registry_pack_path: packRecord?.path ?? null,
    registry_validation_status: packRecord?.validation?.valid ? "passed" : "failed",
    compatibility_status: compatibilityRecord?.compatibility_status ?? "missing",
    core_compatibility_status: compatibilityRecord?.core_compatibility_status ?? "missing",
    dependency_status: compatibilityRecord?.dependency_status ?? "missing",
    compatibility_matrix_status: compatibilityMatrixRow?.compatibility_status ?? "missing",
    common_dependency_declared: Boolean(compatibilityRecord?.common_dependency_declared),
    dependency_pack_ids: packManifest?.dependencies?.map((dependency) => dependency.pack_id) ?? [],
    capability_count: manifestCapabilities.length,
    registered_capability_count: registeredCapabilityCount,
    capability_manifest_v2_count: capabilityManifestV2Count,
    capability_registry_api_pack_card_present: Boolean(packApiCard),
    capability_registry_api_capability_card_count: capabilityApiCardCount,
    capability_version_api_card_count: capabilityVersionApiCardCount,
    workflow_declared_count: packManifest?.workflows?.length ?? 0,
    template_declared_count: packManifest?.templates?.length ?? 0,
    renderer_declared_count: packManifest?.renderers?.length ?? 0,
    extractor_declared_count: packManifest?.extractors?.length ?? 0,
    golden_case_count: packManifest?.golden_cases?.length ?? 0,
    required_gate_count: packManifest?.gates?.length ?? 0,
    format_validation_required: packManifest?.gates?.includes("format_validation_gate") ?? false,
    human_review_required: packManifest?.gates?.includes("human_approval_gate") ?? false,
    layout_validation_required: packManifest?.metadata?.layout_validation_required === true,
    document_renderer_runtime_declared: permissions.allowed_runtimes?.includes("document_renderer") ?? false,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    creative_document_output_artifact_count: outputDeliveryContractFreeze?.summary?.by_domain_pack?.[PACK_ID] ?? 0,
    default_output_status: permissions.default_output_status ?? null,
    external_model_policy: permissions.external_model_policy ?? null,
    max_classification: permissions.max_classification ?? null,
    core_pack_mutation_required: false,
    core_capability_registration_required: false,
    core_route_registration_required: false,
    core_mutation_required_count: 0,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_runtime_source_of_truth: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    registration_status: status,
    generated_at: generatedAt,
  };
}

function buildCapabilityRegistrations({
  generatedAt,
  packManifest,
  manifestCapabilities,
  registryCapabilities,
  capabilityManifests,
  capabilityApiCards,
  capabilityVersionApiCards,
}) {
  return manifestCapabilities.map((capability, index) => {
    const registryCapability = registryCapabilities[index];
    const capabilityManifest = capabilityManifests[index];
    const apiCard = capabilityApiCards[index];
    const versionApiCard = capabilityVersionApiCards[index];
    const phaseGateIds = (phase) => (capabilityManifest?.gate_requirements ?? [])
      .filter((gate) => gate.phase === phase && gate.required !== false)
      .map((gate) => gate.gate_id);
    const requiredGates = [...new Set([
      ...(capabilityManifest?.required_gates?.pre_run ?? []),
      ...(capabilityManifest?.required_gates?.in_run ?? []),
      ...(capabilityManifest?.required_gates?.post_run ?? []),
      ...(capabilityManifest?.gate_requirements ?? []).filter((gate) => gate.required !== false).map((gate) => gate.gate_id),
    ])];
    const status = registryCapability && capabilityManifest && apiCard && versionApiCard ? "registered" : "blocked";
    return {
      schema_version: "creative-document-capability-registration.v1",
      capability_registration_id: `creative-document-capability-registration.${slug(capability.capability_id)}`,
      pack_id: PACK_ID,
      capability_id: capability.capability_id,
      version: capability.version,
      display_name: capabilityManifest?.display_name ?? registryCapability?.display_name ?? capability.capability_id,
      manifest_path: capability.path ?? null,
      domain_registry_present: Boolean(registryCapability),
      capability_manifest_v2_present: Boolean(capabilityManifest),
      capability_registry_api_card_present: Boolean(apiCard),
      capability_version_api_card_present: Boolean(versionApiCard),
      input_contract: capabilityManifest?.input_contract ?? registryCapability?.input_contract ?? null,
      output_contract: capabilityManifest?.output_contract ?? registryCapability?.output_contract ?? null,
      allowed_runtimes: capabilityManifest?.allowed_runtimes ?? capabilityManifest?.runtime_requirements?.map((runtime) => runtime.runtime_id) ?? registryCapability?.allowed_runtimes ?? [],
      required_gate_count: requiredGates.length,
      required_gate_ids: requiredGates,
      pre_run_gate_count: capabilityManifest?.required_gates?.pre_run?.length ?? phaseGateIds("pre_run").length,
      post_run_gate_count: capabilityManifest?.required_gates?.post_run?.length ?? phaseGateIds("post_run").length,
      format_validation_gate_required: requiredGates.includes("format_validation_gate"),
      human_approval_gate_required: requiredGates.includes("human_approval_gate"),
      output_artifact_type_count: capabilityManifest?.output_artifacts?.length ?? 0,
      draft_only_output_required: (capabilityManifest?.output_artifacts ?? []).every((artifact) => artifact.default_status === "draft"),
      layout_validation_required: packManifest?.metadata?.layout_validation_required === true || capabilityManifest?.metadata?.layout_validation_required === true,
      client_facing_ready: false,
      renderer_execution_performed: false,
      protected_action_executed: false,
      registration_status: status,
      generated_at: generatedAt,
    };
  });
}

function buildPackBoundary({ generatedAt, packManifest, packRecord, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, packApiCard, capabilityRegistrations }) {
  return {
    schema_version: "creative-document-pack-boundary.v1",
    boundary_status: packRecord && packApiCard && capabilityRegistrations.every((capability) => capability.registration_status === "registered") ? "enforced" : "attention",
    pack_id: PACK_ID,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    read_only: true,
    mutation_allowed: false,
    core_registry_mutation_allowed: false,
    core_capability_mutation_allowed: false,
    core_route_mutation_allowed: false,
    runtime_execution_allowed: false,
    renderer_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    final_output_delivery_allowed: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    draft_only_output_required: (packManifest?.permissions?.default_output_status ?? null) === "draft",
    format_validation_required: packManifest?.gates?.includes("format_validation_gate") ?? false,
    human_review_required: packManifest?.gates?.includes("human_approval_gate") ?? false,
    layout_validation_required: packManifest?.metadata?.layout_validation_required === true,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    desktop_runtime_source_of_truth: false,
    desktop_secret_material_exposed: false,
    desktop_provider_key_visible: false,
    desktop_installer_or_gateway_control: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ packageJson, roadmapText, packManifest, domainPackRegistry, packManifestCompatibility, capabilityManifestV2, capabilityRegistryApi, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, sourceReads, packRegistration, capabilityRegistrations, packBoundary }) {
  const checkpoints = [];
  checkpoints.push(checkpoint("manifest.present", packManifest?.pack_id === PACK_ID, "Creative-document pack manifest is readable and has the expected pack_id."));
  checkpoints.push(checkpoint("registry.pack", Boolean(domainPackRegistry?.packs?.some((pack) => pack.pack_id === PACK_ID && pack.validation?.valid === true)), "Domain pack registry includes a valid creative-document pack record."));
  checkpoints.push(checkpoint("compatibility.complete", packManifestCompatibility?.summary?.compatibility_status === "complete" && packRegistration.compatibility_status === "compatible" && packRegistration.common_dependency_declared === true, "Pack manifest compatibility marks creative-document compatible with common dependency declared."));
  checkpoints.push(checkpoint("capabilities.registered", capabilityRegistrations.length === packRegistration.capability_count && capabilityRegistrations.every((capability) => capability.registration_status === "registered"), `${capabilityRegistrations.filter((capability) => capability.registration_status === "registered").length}/${packRegistration.capability_count} creative-document capability registration(s) are linked.`));
  checkpoints.push(checkpoint("capability_manifest_v2.bound", capabilityManifestV2?.summary?.capability_manifest_v2_status === "complete" && packRegistration.capability_manifest_v2_count === packRegistration.capability_count, "Capability Manifest v2 includes every creative-document capability."));
  checkpoints.push(checkpoint("capability_registry_api.bound", capabilityRegistryApi?.summary?.capability_registry_api_status === "complete" && packRegistration.capability_registry_api_pack_card_present && packRegistration.capability_registry_api_capability_card_count === packRegistration.capability_count, "Capability Registry API exposes the creative-document pack and capabilities as read-only cards."));
  checkpoints.push(checkpoint("document_renderer.boundary", documentRendererAdapter?.summary?.document_renderer_adapter_status === "complete" && documentRendererAdapter?.summary?.desktop_read_only === true && documentRendererAdapter?.summary?.desktop_runtime_source_of_truth === false, "Document renderer adapter is available as a read-only, non-source-of-truth runtime contract."));
  checkpoints.push(checkpoint("runtime.freeze", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_runtime_execution_allowed === false, "Runtime freeze keeps Desktop runtime execution disabled."));
  const outputDeliveryFreezeStatus = outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing";
  const executedDeliveryActionCount = outputDeliveryContractFreeze?.summary?.executed_delivery_action_count ?? 0;
  checkpoints.push(checkpoint("output.delivery.boundary", outputDeliveryFreezeStatus === "complete" && packBoundary.delivery_execution_allowed === false && packBoundary.final_output_delivery_allowed === false, `Output delivery freeze status ${outputDeliveryFreezeStatus}; source executed delivery action count ${executedDeliveryActionCount}; creative-document delivery execution allowed ${packBoundary.delivery_execution_allowed}; final delivery allowed ${packBoundary.final_output_delivery_allowed}.`));
  checkpoints.push(checkpoint("format.human.gates", packRegistration.format_validation_required === true && packRegistration.human_review_required === true && packRegistration.default_output_status === "draft", "Creative-document outputs require format validation, human approval, and draft-only default status."));
  checkpoints.push(checkpoint("boundary.read_only", packBoundary.boundary_status === "enforced" && packBoundary.read_only === true && packBoundary.mutation_allowed === false && packBoundary.core_registry_mutation_allowed === false && packBoundary.renderer_execution_allowed === false && packBoundary.delivery_execution_allowed === false, "Creative-document pack boundary is read-only and performs no core, renderer, or delivery mutation."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:pack-manifest"]), "package.json registers creative-document:pack-manifest."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P253") && roadmapText.includes("creative-document pack manifest"), "Roadmap ledger keeps the P253 creative-document pack manifest slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All creative-document pack manifest source contracts were readable."));
  return checkpoints;
}

function summarizeCreativeDocumentPackManifest({ packManifest, packRegistration, capabilityRegistrations, packBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  return {
    creative_document_pack_manifest_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    creative_document_pack_manifest_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    pack_version: packRegistration.pack_version,
    display_name: packRegistration.display_name,
    source_of_truth: SOURCE_OF_TRUTH,
    registration_status: packRegistration.registration_status,
    compatibility_status: packRegistration.compatibility_status,
    common_dependency_declared: packRegistration.common_dependency_declared,
    capability_count: packRegistration.capability_count,
    registered_capability_count: packRegistration.registered_capability_count,
    capability_manifest_v2_count: packRegistration.capability_manifest_v2_count,
    capability_registry_api_pack_card_present: packRegistration.capability_registry_api_pack_card_present,
    capability_registry_api_capability_card_count: packRegistration.capability_registry_api_capability_card_count,
    capability_version_api_card_count: packRegistration.capability_version_api_card_count,
    workflow_declared_count: packRegistration.workflow_declared_count,
    template_declared_count: packRegistration.template_declared_count,
    renderer_declared_count: packRegistration.renderer_declared_count,
    extractor_declared_count: packRegistration.extractor_declared_count,
    golden_case_count: packRegistration.golden_case_count,
    required_gate_count: packRegistration.required_gate_count,
    format_validation_required: packRegistration.format_validation_required,
    human_review_required: packRegistration.human_review_required,
    layout_validation_required: packRegistration.layout_validation_required,
    document_renderer_runtime_declared: packRegistration.document_renderer_runtime_declared,
    runtime_freeze_status: packRegistration.runtime_freeze_status,
    document_renderer_adapter_status: packRegistration.document_renderer_adapter_status,
    output_delivery_contract_freeze_status: packRegistration.output_delivery_contract_freeze_status,
    creative_document_output_artifact_count: packRegistration.creative_document_output_artifact_count,
    default_output_status: packRegistration.default_output_status,
    external_model_policy: packRegistration.external_model_policy,
    max_classification: packRegistration.max_classification,
    core_pack_mutation_required: packRegistration.core_pack_mutation_required,
    core_capability_registration_required: packRegistration.core_capability_registration_required,
    core_route_registration_required: packRegistration.core_route_registration_required,
    core_mutation_required_count: packRegistration.core_mutation_required_count,
    desktop_read_only: packBoundary.read_only,
    desktop_mutation_allowed: packBoundary.mutation_allowed,
    desktop_runtime_source_of_truth: packBoundary.desktop_runtime_source_of_truth,
    renderer_execution_allowed: packBoundary.renderer_execution_allowed,
    delivery_execution_allowed: packBoundary.delivery_execution_allowed,
    protected_action_allowed: packBoundary.protected_action_allowed,
    client_facing_output_generated: packBoundary.client_facing_output_generated,
    client_facing_ready_count: packBoundary.client_facing_ready_count,
    raw_secret_material_exposed: packRegistration.raw_secret_material_exposed,
    provider_key_exposed: packRegistration.provider_key_exposed,
    installer_or_gateway_control: packRegistration.installer_or_gateway_control,
    draft_only_capability_count: capabilityRegistrations.filter((capability) => capability.draft_only_output_required).length,
    format_validation_capability_count: capabilityRegistrations.filter((capability) => capability.format_validation_gate_required).length,
    human_approval_capability_count: capabilityRegistrations.filter((capability) => capability.human_approval_gate_required).length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    creative_document_pack_manifest_generated: true,
    deterministic_registration_check_performed: true,
    human_review_required: true,
    format_validation_required: true,
    draft_only_output_required: true,
    renderer_execution_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    core_registry_mutation_performed: false,
    core_capability_mutation_performed: false,
    core_route_mutation_performed: false,
    client_facing_output_generated: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "creative-document-pack-checkpoint.v1",
    checkpoint_id: `creative-document-pack.${checkpointId}`,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.check_id,
    message: item.message,
    status: item.status,
  }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    package_json: contractRef("package.json", packageJson),
    roadmap: textContractRef("docs/final-completion-phase-ledger.md", roadmapText),
    source_artifacts: Object.fromEntries(sourceReads.map((source) => [
      source.source_id,
      contractRef(source.source_id, source),
    ])),
  };
}

function renderCreativeDocumentPackManifestMarkdown(result) {
  const lines = [];
  lines.push("# Creative Document Pack Manifest");
  lines.push("");
  lines.push(`Status: ${result.summary.creative_document_pack_manifest_status}`);
  lines.push(`Capabilities: ${result.summary.registered_capability_count}/${result.summary.capability_count}`);
  lines.push(`Templates: ${result.summary.template_declared_count}`);
  lines.push(`Renderers: ${result.summary.renderer_declared_count}`);
  lines.push(`Format validation required: ${result.summary.format_validation_required}`);
  lines.push(`Human review required: ${result.summary.human_review_required}`);
  lines.push(`Core mutations required: ${result.summary.core_mutation_required_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("This artifact is a read-only pack registration report. It does not execute renderers, deliver outputs, mutate core registries, or mark client-facing material ready.");
  return lines.join("\n");
}

async function readSourceArtifacts(inputs) {
  return [
    await sourceRead("creative_document_pack_manifest_source", inputs.creative_document_pack_path, readJsonOrError),
    await sourceRead("domain_pack_registry", inputs.domain_pack_registry_path, readJsonOrError),
    await sourceRead("pack_manifest_compatibility", inputs.pack_manifest_compatibility_path, readJsonOrError),
    await sourceRead("capability_manifest_v2", inputs.capability_manifest_v2_path, readJsonOrError),
    await sourceRead("capability_registry_api", inputs.capability_registry_api_path, readJsonOrError),
    await sourceRead("runtime_freeze", inputs.runtime_freeze_path, readJsonOrError),
    await sourceRead("document_renderer_adapter", inputs.document_renderer_adapter_path, readJsonOrError),
    await sourceRead("output_delivery_contract_freeze", inputs.output_delivery_contract_freeze_path, readJsonOrError),
  ];
}

async function sourceRead(sourceId, filePath, reader) {
  const read = await reader(filePath);
  return {
    source_id: sourceId,
    path: path.resolve(filePath),
    ...read,
  };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      value: JSON.parse(raw),
      raw,
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      raw: null,
      error: `${filePath}: ${error.message}`,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      value: await readFile(filePath, "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      value: null,
      error: `${filePath}: ${error.message}`,
    };
  }
}

function contractRef(label, read) {
  const value = read?.value;
  return {
    label,
    read_status: read?.error ? "error" : "read",
    content_hash: read?.raw ? `sha256:${sha256(read.raw)}` : null,
    schema_version: value?.schema_version ?? null,
    error: read?.error ?? null,
  };
}

function textContractRef(label, read) {
  return {
    label,
    read_status: read?.error ? "error" : "read",
    content_hash: read?.value ? `sha256:${sha256(read.value)}` : null,
    error: read?.error ?? null,
  };
}

function serializableCreativeDocumentPackManifest(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  const merged = { ...DEFAULT_CREATIVE_DOCUMENT_PACK_MANIFEST_INPUTS, ...options };
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [camelToSnake(key), value]));
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
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--creative-document-pack") parsed.creativeDocumentPackPath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--pack-manifest-compatibility") parsed.packManifestCompatibilityPath = argv[++index];
    else if (arg === "--capability-manifest-v2") parsed.capabilityManifestV2Path = argv[++index];
    else if (arg === "--capability-registry-api") parsed.capabilityRegistryApiPath = argv[++index];
    else if (arg === "--runtime-freeze") parsed.runtimeFreezePath = argv[++index];
    else if (arg === "--document-renderer-adapter") parsed.documentRendererAdapterPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown option: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-pack-manifest.mjs [options]

Options:
  --check                                  Fail when validation does not pass.
  --out-dir <path>                         Output directory.
  --creative-document-pack <path>          Creative-document pack manifest path.
  --domain-pack-registry <path>            Domain pack registry artifact path.
  --pack-manifest-compatibility <path>     Pack compatibility artifact path.
  --capability-manifest-v2 <path>          Capability Manifest v2 artifact path.
  --capability-registry-api <path>         Capability Registry API artifact path.
  --runtime-freeze <path>                  Runtime freeze artifact path.
  --document-renderer-adapter <path>       Document renderer adapter artifact path.
  --output-delivery-contract-freeze <path> Output delivery contract freeze artifact path.
  --package <path>                         package.json path.
  --roadmap <path>                         completion ledger path.
`);
}

function camelToSnake(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function dateStamp(value) {
  return value.slice(0, 10).replace(/-/g, "");
}
