import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LAW_FIRM_PACK_MANIFEST_OUT_DIR = "artifacts/law-firm-pack-manifest/latest";
export const DEFAULT_LAW_FIRM_PACK_MANIFEST_INPUTS = {
  lawFirmPackPath: "packs/law-firm/pack.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  packManifestCompatibilityPath: "artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json",
  capabilityManifestV2Path: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
  policyContractFreezePath: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
  evidenceContractFreezePath: "artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "law-firm-pack-manifest.v1";
const PACK_ID = "law-firm";
const COMMON_PACK_ID = "common";
const DESKTOP_SURFACE_POLICY = "read_only_attorney_review_operator_surface";
const SOURCE_OF_TRUTH = "domain_pack_registry_and_law_firm_pack_manifest";

export async function runLawFirmPackManifest(options = {}) {
  const result = await buildLawFirmPackManifest(options);
  if (options.write !== false) await writeLawFirmPackManifest(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Law-firm pack manifest validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLawFirmPackManifest(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LAW_FIRM_PACK_MANIFEST_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const packManifest = sourceById.law_firm_pack_manifest_source;
  const domainPackRegistry = sourceById.domain_pack_registry;
  const packManifestCompatibility = sourceById.pack_manifest_compatibility;
  const capabilityManifestV2 = sourceById.capability_manifest_v2;
  const capabilityRegistryApi = sourceById.capability_registry_api;
  const runtimeFreeze = sourceById.runtime_freeze;
  const matterContractFreeze = sourceById.matter_contract_freeze;
  const policyContractFreeze = sourceById.policy_contract_freeze;
  const evidenceContractFreeze = sourceById.evidence_contract_freeze;
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
    matterContractFreeze,
    policyContractFreeze,
    evidenceContractFreeze,
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
    matterContractFreeze,
    policyContractFreeze,
    evidenceContractFreeze,
    outputDeliveryContractFreeze,
    packApiCard,
    capabilityApiCards,
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
    matterContractFreeze,
    policyContractFreeze,
    evidenceContractFreeze,
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
  const summary = summarizeLawFirmPackManifest({
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
    law_firm_pack_manifest_id: `law-firm-pack-manifest.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    law_firm_pack_manifest_status: summary.law_firm_pack_manifest_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    law_firm_pack_manifest_contract: buildContract(generatedAt),
    law_firm_pack_registration: packRegistration,
    law_firm_capability_registrations: capabilityRegistrations,
    law_firm_pack_boundary: packBoundary,
    law_firm_pack_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLawFirmPackManifestMarkdown(result),
  };
}

export async function writeLawFirmPackManifest(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLawFirmPackManifest(result);
  await writeJson(path.join(outDir, "law-firm-pack-manifest.json"), serializable);
  await writeJson(path.join(outDir, "law-firm-pack-registration.json"), {
    schema_version: "law-firm-pack-registration-artifact.v1",
    generated_at: result.generated_at,
    law_firm_pack_registration: result.law_firm_pack_registration,
  });
  await writeJson(path.join(outDir, "law-firm-capability-registrations.json"), {
    schema_version: "law-firm-capability-registrations.v1",
    generated_at: result.generated_at,
    law_firm_capability_registration_count: result.law_firm_capability_registrations.length,
    law_firm_capability_registrations: result.law_firm_capability_registrations,
  });
  await writeJson(path.join(outDir, "law-firm-pack-boundary.json"), {
    schema_version: "law-firm-pack-boundary-artifact.v1",
    generated_at: result.generated_at,
    law_firm_pack_boundary: result.law_firm_pack_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "law-firm-pack-manifest-validation-report.v1",
    generated_at: result.generated_at,
    law_firm_pack_manifest_id: result.law_firm_pack_manifest_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLawFirmPackManifestCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runLawFirmPackManifest(args);
    console.log(`Law-firm pack manifest ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.law_firm_pack_manifest_status}`);
    console.log(`Capabilities: ${result.summary.registered_capability_count}/${result.summary.capability_count}`);
    console.log(`Attorney review required: ${result.summary.attorney_review_required}`);
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
    schema_version: "law-firm-pack-manifest-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    domain_track: "law_firm_domain_pack",
    source_of_truth: SOURCE_OF_TRUTH,
    registration_rule: "law_firm_capabilities_must_be_registered_through_domain_pack_registry_without_core_mutation",
    matter_boundary_rule: "every_law_firm_capability_requires_matter_boundary_and_classification_gate_context",
    attorney_review_rule: "legal_or_client_facing_outputs_remain_pending_review_until_attorney_approval",
    desktop_companion_rule: "desktop_companion_reads_law_firm_pack_capability_gate_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_execute_runtime_delivery_core_registry_or_protected_mutations",
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
  matterContractFreeze,
  policyContractFreeze,
  evidenceContractFreeze,
  outputDeliveryContractFreeze,
}) {
  const registeredCapabilityCount = registryCapabilities.filter(Boolean).length;
  const capabilityManifestV2Count = capabilityManifests.filter(Boolean).length;
  const capabilityApiCardCount = capabilityApiCards.filter(Boolean).length;
  const capabilityVersionApiCardCount = capabilityVersionApiCards.filter(Boolean).length;
  const lawFirmHumanReviewRequired = compatibilityRecord?.law_firm_human_review_required === true;
  const status = packManifest?.pack_id === PACK_ID
    && packRecord
    && compatibilityRecord?.compatibility_status === "compatible"
    && compatibilityRecord?.core_compatibility_status === "compatible"
    && compatibilityRecord?.dependency_status === "complete"
    && lawFirmHumanReviewRequired
    && packManifest?.metadata?.matter_boundary_required === true
    && packManifest?.metadata?.draft_only_by_default === true
    && packManifest?.permissions?.default_output_status === "pending_review"
    && registeredCapabilityCount === manifestCapabilities.length
    && capabilityManifestV2Count === manifestCapabilities.length
    && capabilityApiCardCount === manifestCapabilities.length
    && capabilityVersionApiCardCount === manifestCapabilities.length
    ? "registered"
    : "blocked";
  const registration = {
    schema_version: "law-firm-pack-registration.v1",
    registration_id: "law-firm-pack-registration.law-firm",
    pack_id: PACK_ID,
    pack_version: packManifest?.pack_version ?? null,
    display_name: packManifest?.display_name ?? null,
    manifest_schema_version: packManifest?.schema_version ?? null,
    manifest_path: path.resolve(inputs.law_firm_pack_path),
    registry_pack_present: Boolean(packRecord),
    registry_pack_path: packRecord?.path ?? null,
    registry_validation_status: packRecord?.validation?.valid ? "passed" : "failed",
    compatibility_status: compatibilityRecord?.compatibility_status ?? "missing",
    core_compatibility_status: compatibilityRecord?.core_compatibility_status ?? "missing",
    dependency_status: compatibilityRecord?.dependency_status ?? "missing",
    compatibility_matrix_status: compatibilityMatrixRow?.compatibility_status ?? "missing",
    common_dependency_declared: Boolean(compatibilityRecord?.common_dependency_declared),
    dependency_pack_ids: packManifest?.dependencies?.map((dependency) => dependency.pack_id) ?? [],
    law_firm_human_review_required: lawFirmHumanReviewRequired,
    matter_boundary_required: packManifest?.metadata?.matter_boundary_required === true,
    draft_only_by_default: packManifest?.metadata?.draft_only_by_default === true,
    attorney_review_required: true,
    human_review_required: true,
    capability_count: manifestCapabilities.length,
    registered_capability_count: registeredCapabilityCount,
    capability_manifest_v2_count: capabilityManifestV2Count,
    capability_registry_api_pack_card_present: Boolean(packApiCard),
    capability_registry_api_capability_card_count: capabilityApiCardCount,
    capability_version_api_card_count: capabilityVersionApiCardCount,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    matter_contract_freeze_status: matterContractFreeze?.summary?.freeze_status ?? "missing",
    policy_contract_freeze_status: policyContractFreeze?.summary?.freeze_status ?? "missing",
    evidence_contract_freeze_status: evidenceContractFreeze?.summary?.freeze_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    pending_approval_artifact_count: outputDeliveryContractFreeze?.summary?.pending_approval_artifact_count ?? 0,
    source_executed_delivery_action_count: outputDeliveryContractFreeze?.summary?.executed_delivery_action_count ?? 0,
    executed_delivery_action_count: 0,
    core_pack_mutation_required: false,
    core_capability_registration_required: false,
    core_route_registration_required: false,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_runtime_source_of_truth: false,
    registration_status: status,
    registered_at: generatedAt,
  };
  return {
    ...registration,
    registration_hash: hashObject(registration),
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
  return manifestCapabilities.map((manifestCapability, index) => {
    const registryCapability = registryCapabilities[index];
    const capabilityManifest = capabilityManifests[index];
    const apiCard = capabilityApiCards[index];
    const versionCard = capabilityVersionApiCards[index];
    const attorneyReviewRequired = apiCard?.attorney_review_required === true || capabilityManifest?.approval_policy?.approval_type === "attorney_review";
    const humanReviewRequired = apiCard?.human_review_required === true || capabilityManifest?.approval_policy?.required === true;
    const registrationStatus = registryCapability
      && capabilityManifest
      && apiCard
      && versionCard
      && apiCard.approval_required === true
      && attorneyReviewRequired
      && humanReviewRequired
      ? "registered"
      : "blocked";
    const registration = {
      schema_version: "law-firm-capability-registration.v1",
      capability_registration_id: `law-firm-capability-registration.${slugify(manifestCapability.capability_id)}`,
      capability_id: manifestCapability.capability_id,
      version: manifestCapability.version,
      pack_id: PACK_ID,
      domain_pack: PACK_ID,
      source_manifest_path: registryCapability?.path ?? capabilityManifest?.source_manifest_path ?? manifestCapability.path ?? null,
      registry_capability_present: Boolean(registryCapability),
      capability_manifest_v2_present: Boolean(capabilityManifest),
      capability_api_card_present: Boolean(apiCard),
      capability_version_api_card_present: Boolean(versionCard),
      registry_validation_status: registryCapability?.validation?.valid ? "passed" : "failed",
      manifest_schema_version: capabilityManifest?.schema_version ?? null,
      source_schema_version: capabilityManifest?.source_schema_version ?? null,
      input_schema_ref: apiCard?.input_schema_ref ?? capabilityManifest?.input_contract?.schema_ref ?? registryCapability?.input_contract ?? null,
      output_schema_ref: apiCard?.output_schema_ref ?? capabilityManifest?.output_contract?.schema_ref ?? registryCapability?.output_contract ?? null,
      runtime_ids: apiCard?.runtime_ids ?? registryCapability?.allowed_runtimes ?? [],
      required_gate_ids: apiCard?.required_gate_ids ?? [],
      required_gate_count: apiCard?.gate_requirement_count ?? registryCapability?.required_gate_count ?? 0,
      approval_required: apiCard?.approval_required === true,
      human_review_required: humanReviewRequired,
      attorney_review_required: attorneyReviewRequired,
      matter_boundary_required: packManifest?.metadata?.matter_boundary_required === true,
      draft_only_by_default: packManifest?.metadata?.draft_only_by_default === true,
      policy_status: apiCard?.policy_status ?? "unknown",
      gate_runtime_status: apiCard?.gate_runtime_status ?? "unknown",
      default_output_status: packManifest?.permissions?.default_output_status ?? capabilityManifest?.approval_policy?.default_output_status ?? null,
      legal_advice_provided: false,
      client_facing_ready: false,
      protected_action_executed: false,
      core_registration_required: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      registration_status: registrationStatus,
      registered_at: generatedAt,
    };
    return {
      ...registration,
      capability_registration_hash: hashObject(registration),
    };
  });
}

function buildPackBoundary({
  generatedAt,
  packManifest,
  packRecord,
  runtimeFreeze,
  matterContractFreeze,
  policyContractFreeze,
  evidenceContractFreeze,
  outputDeliveryContractFreeze,
  packApiCard,
  capabilityApiCards,
  capabilityRegistrations,
}) {
  const permissions = packManifest?.permissions ?? {};
  const metadata = packManifest?.metadata ?? {};
  const readOnlyCards = [packApiCard, ...capabilityApiCards].filter(Boolean).every((card) => card.read_only === true && card.mutation_allowed === false);
  const attorneyReviewRequired = capabilityRegistrations.length > 0 && capabilityRegistrations.every((registration) => registration.attorney_review_required === true);
  const humanReviewRequired = capabilityRegistrations.length > 0 && capabilityRegistrations.every((registration) => registration.human_review_required === true);
  const matterBoundaryRequired = metadata.matter_boundary_required === true;
  const outputDeliveryGateEnforced = outputDeliveryContractFreeze?.summary?.freeze_status === "complete";
  const boundary = {
    schema_version: "law-firm-pack-boundary.v1",
    boundary_id: "law-firm-pack-boundary.law-firm",
    pack_id: PACK_ID,
    source_manifest_path: packRecord?.path ?? null,
    source_of_truth: SOURCE_OF_TRUTH,
    desktop_companion_role: "attorney_review_operator_read_only_view",
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_card_read_only: readOnlyCards,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_runtime_source_of_truth: false,
    desktop_protected_mutation_execution_allowed: false,
    matter_boundary_required: matterBoundaryRequired,
    attorney_review_required: attorneyReviewRequired,
    human_review_required: humanReviewRequired,
    client_facing_output_allowed_without_attorney_review: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    protected_action_executed_count: 0,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    matter_contract_freeze_status: matterContractFreeze?.summary?.freeze_status ?? "missing",
    policy_contract_freeze_status: policyContractFreeze?.summary?.freeze_status ?? "missing",
    evidence_contract_freeze_status: evidenceContractFreeze?.summary?.freeze_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    output_delivery_gate_enforced: outputDeliveryGateEnforced,
    pending_approval_artifact_count: outputDeliveryContractFreeze?.summary?.pending_approval_artifact_count ?? 0,
    source_executed_delivery_action_count: outputDeliveryContractFreeze?.summary?.executed_delivery_action_count ?? 0,
    executed_delivery_action_count: 0,
    runtime_execution_allowed: false,
    runtime_control_allowed: false,
    max_classification: permissions.max_classification ?? null,
    external_model_policy: permissions.external_model_policy ?? null,
    allowed_runtime_ids: permissions.allowed_runtimes ?? [],
    default_output_status: permissions.default_output_status ?? null,
    draft_only_by_default: metadata.draft_only_by_default === true,
    core_pack_mutation_required: false,
    core_capability_registration_required: false,
    core_route_registration_required: false,
    core_mutation_required_count: 0,
    boundary_status: readOnlyCards && matterBoundaryRequired && attorneyReviewRequired && humanReviewRequired && outputDeliveryGateEnforced ? "enforced" : "blocked",
    recorded_at: generatedAt,
  };
  return {
    ...boundary,
    boundary_hash: hashObject(boundary),
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  packManifest,
  domainPackRegistry,
  packManifestCompatibility,
  capabilityManifestV2,
  capabilityRegistryApi,
  runtimeFreeze,
  matterContractFreeze,
  policyContractFreeze,
  evidenceContractFreeze,
  outputDeliveryContractFreeze,
  sourceReads,
  packRegistration,
  capabilityRegistrations,
  packBoundary,
}) {
  const allSourcesAvailable = sourceReads.every((source) => source.available);
  const manifestCapabilityIds = new Set((packManifest?.capabilities ?? []).map((capability) => capability.capability_id));
  const registryCapabilityIds = new Set((domainPackRegistry?.capabilities ?? []).filter((capability) => capability.pack_id === PACK_ID).map((capability) => capability.capability_id));
  const capabilityManifestIds = new Set((capabilityManifestV2?.capability_manifests ?? []).filter((capability) => capability.pack_id === PACK_ID || capability.domain_pack === PACK_ID).map((capability) => capability.capability_id));
  const apiCapabilityIds = new Set((capabilityRegistryApi?.capability_api_cards ?? []).filter((card) => card.pack_id === PACK_ID).map((card) => card.capability_id));
  const apiVersionCapabilityIds = new Set((capabilityRegistryApi?.capability_version_api_cards ?? []).filter((card) => card.pack_id === PACK_ID || card.domain_pack === PACK_ID).map((card) => card.capability_id));
  const commonDependencyDeclared = packManifest?.dependencies?.some((dependency) => dependency.pack_id === COMMON_PACK_ID) === true;
  const packageScriptPresent = Boolean(packageJson?.scripts?.["law-firm:pack-manifest"]);
  const roadmapSlotPresent = typeof roadmapText === "string" && roadmapText.includes("| P231 |") && roadmapText.includes("law-firm pack manifest");
  return [
    checkpoint("source_artifacts_available", allSourcesAvailable, `${sourceReads.filter((source) => source.available).length}/${sourceReads.length} source artifact(s) available.`),
    checkpoint("manifest_identity", packManifest?.schema_version === "domain-pack-manifest.v1" && packManifest?.pack_id === PACK_ID, `Manifest identity ${packManifest?.pack_id ?? "missing"} uses ${packManifest?.schema_version ?? "missing"}.`),
    checkpoint("registry_pack_registered", Boolean(domainPackRegistry?.packs?.some((pack) => pack.pack_id === PACK_ID && pack.validation?.valid === true)), "law-firm pack is present and valid in the domain pack registry."),
    checkpoint("registry_capabilities_registered", setContainsAll(registryCapabilityIds, manifestCapabilityIds) && registryCapabilityIds.size === manifestCapabilityIds.size, `${registryCapabilityIds.size}/${manifestCapabilityIds.size} law-firm capability registry rows present.`),
    checkpoint("capability_manifest_v2_registered", setContainsAll(capabilityManifestIds, manifestCapabilityIds) && capabilityManifestIds.size === manifestCapabilityIds.size, `${capabilityManifestIds.size}/${manifestCapabilityIds.size} law-firm capability manifest v2 rows present.`),
    checkpoint("pack_compatibility_registered", packManifestCompatibility?.pack_compatibility_records?.some((record) => record.pack_id === PACK_ID && record.compatibility_status === "compatible" && record.core_compatibility_status === "compatible" && record.dependency_status === "complete") === true, "law-firm compatibility record is compatible with complete dependencies."),
    checkpoint("common_dependency_declared", commonDependencyDeclared, "law-firm depends on the common pack."),
    checkpoint("capability_registry_api_registered", Boolean(capabilityRegistryApi?.pack_api_cards?.some((card) => card.pack_id === PACK_ID && card.read_only === true && card.mutation_allowed === false)) && setContainsAll(apiCapabilityIds, manifestCapabilityIds), "Desktop-readable pack and capability cards are present without mutation routes."),
    checkpoint("capability_version_cards_registered", setContainsAll(apiVersionCapabilityIds, manifestCapabilityIds) && apiVersionCapabilityIds.size === manifestCapabilityIds.size, `${apiVersionCapabilityIds.size}/${manifestCapabilityIds.size} law-firm capability version card(s) present.`),
    checkpoint("law_firm_human_review_required", packRegistration.law_firm_human_review_required === true, "Pack compatibility marks law-firm human review as required."),
    checkpoint("attorney_review_capabilities_required", capabilityRegistrations.every((registration) => registration.attorney_review_required === true && registration.human_review_required === true), "Every law-firm capability requires attorney/human review."),
    checkpoint("matter_boundary_required", packRegistration.matter_boundary_required === true, "Law-firm pack requires matter boundary enforcement."),
    checkpoint("policy_and_evidence_contracts_bound", matterContractFreeze?.summary?.freeze_status === "complete" && policyContractFreeze?.summary?.freeze_status === "complete" && evidenceContractFreeze?.summary?.freeze_status === "complete", "Matter, policy, and evidence contract freezes are complete."),
    checkpoint("runtime_freeze_bound", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_mutation_allowed === false, "Runtime freeze is complete and Desktop remains read-only."),
    checkpoint("output_delivery_human_gated", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && packManifest?.permissions?.default_output_status === "pending_review", "Output delivery freeze is complete and law-firm pack output defaults to pending review."),
    checkpoint("pack_boundary_enforced", packBoundary.boundary_status === "enforced" && packBoundary.core_mutation_required_count === 0 && packBoundary.desktop_mutation_allowed === false, "Pack boundary requires no core mutation and exposes no Desktop mutation rights."),
    checkpoint("capability_registration_enforced", capabilityRegistrations.every((registration) => registration.registration_status === "registered" && registration.core_registration_required === false && registration.desktop_mutation_allowed === false), `${capabilityRegistrations.filter((registration) => registration.registration_status === "registered").length}/${capabilityRegistrations.length} capability registration(s) enforce the attorney-review boundary.`),
    checkpoint("permissions_are_law_firm_safe", packManifest?.permissions?.max_classification === "P3_PRIVILEGED" && packManifest?.permissions?.external_model_policy === "approval_required" && packManifest?.permissions?.default_output_status === "pending_review" && packManifest?.metadata?.matter_boundary_required === true && packManifest?.metadata?.draft_only_by_default === true, "Law-firm permissions preserve privileged max classification, model approval, pending review, matter boundary, and draft-only defaults."),
    checkpoint("package_script_registered", packageScriptPresent, "package.json exposes law-firm:pack-manifest."),
    checkpoint("roadmap_slot_present", roadmapSlotPresent, "P231 remains recorded in the final completion ledger."),
  ];
}

function summarizeLawFirmPackManifest({ packManifest, packRegistration, capabilityRegistrations, packBoundary, checkpoints, validation }) {
  const passedCheckpointCount = checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length;
  const registeredCapabilityCount = capabilityRegistrations.filter((registration) => registration.registration_status === "registered").length;
  const attorneyReviewRequiredCapabilityCount = capabilityRegistrations.filter((registration) => registration.attorney_review_required).length;
  const humanReviewRequiredCapabilityCount = capabilityRegistrations.filter((registration) => registration.human_review_required).length;
  const coreMutationRequiredCount = [
    packRegistration.core_pack_mutation_required,
    packRegistration.core_capability_registration_required,
    packRegistration.core_route_registration_required,
    ...capabilityRegistrations.map((registration) => registration.core_registration_required),
  ].filter(Boolean).length + (packBoundary.core_mutation_required_count ?? 0);
  const complete = validation.valid
    && packRegistration.registration_status === "registered"
    && registeredCapabilityCount === capabilityRegistrations.length
    && attorneyReviewRequiredCapabilityCount === capabilityRegistrations.length
    && humanReviewRequiredCapabilityCount === capabilityRegistrations.length
    && packBoundary.boundary_status === "enforced"
    && coreMutationRequiredCount === 0;
  return {
    law_firm_pack_manifest_status: complete ? "complete" : "blocked",
    law_firm_pack_manifest_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    pack_version: packManifest?.pack_version ?? null,
    manifest_schema_version: packManifest?.schema_version ?? null,
    manifest_path: packRegistration.manifest_path,
    source_of_truth: SOURCE_OF_TRUTH,
    registration_status: packRegistration.registration_status,
    registry_pack_present: packRegistration.registry_pack_present,
    registry_validation_status: packRegistration.registry_validation_status,
    compatibility_status: packRegistration.compatibility_status,
    core_compatibility_status: packRegistration.core_compatibility_status,
    dependency_status: packRegistration.dependency_status,
    common_dependency_declared: packRegistration.common_dependency_declared,
    law_firm_human_review_required: packRegistration.law_firm_human_review_required,
    matter_boundary_required: packRegistration.matter_boundary_required,
    draft_only_by_default: packRegistration.draft_only_by_default,
    attorney_review_required: packBoundary.attorney_review_required,
    human_review_required: packBoundary.human_review_required,
    capability_count: packRegistration.capability_count,
    registered_capability_count: registeredCapabilityCount,
    capability_manifest_v2_count: packRegistration.capability_manifest_v2_count,
    capability_registry_api_pack_card_present: packRegistration.capability_registry_api_pack_card_present,
    capability_registry_api_capability_card_count: packRegistration.capability_registry_api_capability_card_count,
    capability_version_api_card_count: packRegistration.capability_version_api_card_count,
    attorney_review_required_capability_count: attorneyReviewRequiredCapabilityCount,
    human_review_required_capability_count: humanReviewRequiredCapabilityCount,
    runtime_freeze_status: packRegistration.runtime_freeze_status,
    matter_contract_freeze_status: packRegistration.matter_contract_freeze_status,
    policy_contract_freeze_status: packRegistration.policy_contract_freeze_status,
    evidence_contract_freeze_status: packRegistration.evidence_contract_freeze_status,
    output_delivery_contract_freeze_status: packRegistration.output_delivery_contract_freeze_status,
    pending_approval_artifact_count: packRegistration.pending_approval_artifact_count,
    source_executed_delivery_action_count: packRegistration.source_executed_delivery_action_count,
    executed_delivery_action_count: packRegistration.executed_delivery_action_count,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: packBoundary.desktop_read_only,
    desktop_mutation_allowed: packBoundary.desktop_mutation_allowed,
    desktop_runtime_source_of_truth: packBoundary.desktop_runtime_source_of_truth,
    desktop_protected_mutation_execution_allowed: packBoundary.desktop_protected_mutation_execution_allowed,
    raw_secret_material_exposed: packBoundary.raw_secret_material_exposed,
    provider_key_exposed: packBoundary.provider_key_exposed,
    installer_or_gateway_control: packBoundary.installer_or_gateway_control,
    ssh_or_cron_control: packBoundary.ssh_or_cron_control,
    legal_advice_provided: packBoundary.legal_advice_generated,
    client_facing_output_generated: packBoundary.client_facing_output_generated,
    client_facing_ready_count: packBoundary.client_facing_ready_count,
    client_facing_output_allowed_without_attorney_review: packBoundary.client_facing_output_allowed_without_attorney_review,
    protected_action_executed_count: packBoundary.protected_action_executed_count,
    core_pack_mutation_required: packRegistration.core_pack_mutation_required,
    core_capability_registration_required: packRegistration.core_capability_registration_required,
    core_route_registration_required: packRegistration.core_route_registration_required,
    core_mutation_required_count: coreMutationRequiredCount,
    max_classification: packBoundary.max_classification,
    external_model_policy: packBoundary.external_model_policy,
    default_output_status: packBoundary.default_output_status,
    checkpoint_count: checkpoints.length,
    passed_checkpoint_count: passedCheckpointCount,
    failed_checkpoint_count: checkpoints.length - passedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
    by_checkpoint_status: countBy(checkpoints, "status"),
    by_capability_registration_status: countBy(capabilityRegistrations, "registration_status"),
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    source_pack_manifest_mutation_allowed: false,
    core_registry_mutation_allowed: false,
    runtime_execution_performed: false,
    protected_mutation_executed: false,
    delivery_executed: false,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    secret_material_exposed: false,
    provider_key_visible: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return Object.fromEntries([
    ...sourceReads.map((source) => [source.source_id, {
      schema_version: source.value?.schema_version ?? null,
      path: source.path,
      available: source.available,
      content_hash: source.content_hash,
      error: source.error,
    }]),
    ["package_json", {
      schema_version: null,
      path: packageJson.path,
      available: packageJson.available,
      content_hash: packageJson.content_hash,
      error: packageJson.error,
    }],
    ["roadmap", {
      schema_version: null,
      path: roadmapText.path,
      available: roadmapText.available,
      content_hash: roadmapText.content_hash,
      error: roadmapText.error,
    }],
  ]);
}

async function readSourceArtifacts(inputs) {
  return Promise.all([
    readJsonSource("law_firm_pack_manifest_source", inputs.law_firm_pack_path),
    readJsonSource("domain_pack_registry", inputs.domain_pack_registry_path),
    readJsonSource("pack_manifest_compatibility", inputs.pack_manifest_compatibility_path),
    readJsonSource("capability_manifest_v2", inputs.capability_manifest_v2_path),
    readJsonSource("capability_registry_api", inputs.capability_registry_api_path),
    readJsonSource("runtime_freeze", inputs.runtime_freeze_path),
    readJsonSource("matter_contract_freeze", inputs.matter_contract_freeze_path),
    readJsonSource("policy_contract_freeze", inputs.policy_contract_freeze_path),
    readJsonSource("evidence_contract_freeze", inputs.evidence_contract_freeze_path),
    readJsonSource("output_delivery_contract_freeze", inputs.output_delivery_contract_freeze_path),
  ]);
}

async function readJsonSource(sourceId, filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return {
      source_id: sourceId,
      path: resolvedPath,
      available: true,
      value: JSON.parse(text),
      content_hash: hashValue(text),
      error: null,
    };
  } catch (error) {
    return {
      source_id: sourceId,
      path: resolvedPath,
      available: false,
      value: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readJsonOrError(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, value: JSON.parse(text), content_hash: hashValue(text), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, value: null, content_hash: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { path: resolvedPath, available: true, value: text, content_hash: hashValue(text), error: null };
  } catch (error) {
    return { path: resolvedPath, available: false, value: null, content_hash: null, error: error.message };
  }
}

function normalizeInputs(options) {
  const merged = { ...DEFAULT_LAW_FIRM_PACK_MANIFEST_INPUTS, ...options };
  return {
    law_firm_pack_path: merged.lawFirmPackPath,
    domain_pack_registry_path: merged.domainPackRegistryPath,
    pack_manifest_compatibility_path: merged.packManifestCompatibilityPath,
    capability_manifest_v2_path: merged.capabilityManifestV2Path,
    capability_registry_api_path: merged.capabilityRegistryApiPath,
    runtime_freeze_path: merged.runtimeFreezePath,
    matter_contract_freeze_path: merged.matterContractFreezePath,
    policy_contract_freeze_path: merged.policyContractFreezePath,
    evidence_contract_freeze_path: merged.evidenceContractFreezePath,
    output_delivery_contract_freeze_path: merged.outputDeliveryContractFreezePath,
    package_path: merged.packagePath,
    roadmap_path: merged.roadmapPath,
  };
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
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--law-firm-pack") parsed.lawFirmPackPath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--pack-manifest-compatibility") parsed.packManifestCompatibilityPath = argv[++index];
    else if (arg === "--capability-manifest-v2") parsed.capabilityManifestV2Path = argv[++index];
    else if (arg === "--capability-registry-api") parsed.capabilityRegistryApiPath = argv[++index];
    else if (arg === "--runtime-freeze") parsed.runtimeFreezePath = argv[++index];
    else if (arg === "--matter-contract-freeze") parsed.matterContractFreezePath = argv[++index];
    else if (arg === "--policy-contract-freeze") parsed.policyContractFreezePath = argv[++index];
    else if (arg === "--evidence-contract-freeze") parsed.evidenceContractFreezePath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/law-firm-pack-manifest.mjs [options]

Options:
  --check                                  Fail when validation does not pass
  --no-write                               Build without writing artifacts
  --out-dir <path>                         Output directory
  --law-firm-pack <path>                   law-firm pack manifest path
  --domain-pack-registry <path>            Domain pack registry artifact
  --pack-manifest-compatibility <path>     Pack compatibility artifact
  --capability-manifest-v2 <path>          Capability manifest v2 artifact
  --capability-registry-api <path>         Capability registry API artifact
  --runtime-freeze <path>                  Runtime freeze artifact
  --matter-contract-freeze <path>          Matter contract freeze artifact
  --policy-contract-freeze <path>          Policy contract freeze artifact
  --evidence-contract-freeze <path>        Evidence contract freeze artifact
  --output-delivery-contract-freeze <path> Output delivery contract freeze artifact
  --package <path>                         package.json path
  --roadmap <path>                         final completion ledger path
`);
}

function renderLawFirmPackManifestMarkdown(result) {
  const lines = [];
  lines.push("# Law Firm Pack Manifest");
  lines.push("");
  lines.push(`Status: ${result.summary.law_firm_pack_manifest_status}`);
  lines.push("");
  lines.push("## Registration");
  lines.push("");
  lines.push(`- Pack: ${result.summary.pack_id}@${result.summary.pack_version}`);
  lines.push(`- Capabilities: ${result.summary.registered_capability_count}/${result.summary.capability_count}`);
  lines.push(`- Compatibility: ${result.summary.compatibility_status}`);
  lines.push(`- Common dependency: ${result.summary.common_dependency_declared ? "declared" : "missing"}`);
  lines.push("");
  lines.push("## Law-Firm Boundary");
  lines.push("");
  lines.push(`- Matter boundary required: ${result.summary.matter_boundary_required}`);
  lines.push(`- Attorney review required: ${result.summary.attorney_review_required}`);
  lines.push(`- Default output status: ${result.summary.default_output_status}`);
  lines.push(`- Legal advice provided: ${result.summary.legal_advice_provided}`);
  lines.push(`- Client-facing output generated: ${result.summary.client_facing_output_generated}`);
  lines.push("");
  lines.push("## Desktop Boundary");
  lines.push("");
  lines.push(`- Read only: ${result.summary.desktop_read_only}`);
  lines.push(`- Mutation allowed: ${result.summary.desktop_mutation_allowed}`);
  lines.push(`- Runtime source of truth: ${result.summary.desktop_runtime_source_of_truth}`);
  lines.push(`- Core mutations required: ${result.summary.core_mutation_required_count}`);
  lines.push("");
  lines.push("## Checkpoints");
  lines.push("");
  for (const checkpointItem of result.law_firm_pack_checkpoints) {
    lines.push(`- ${checkpointItem.checkpoint_id}: ${checkpointItem.status} - ${checkpointItem.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableLawFirmPackManifest(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "law-firm-pack-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message ?? "Validation item failed." }));
  return { valid: errors.length === 0, errors };
}

function setContainsAll(candidate, expected) {
  return [...expected].every((item) => candidate.has(item));
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    const value = item[key] ?? "unknown";
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashObject(value) {
  return hashValue(JSON.stringify(value));
}

function hashValue(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.replaceAll(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value).replaceAll(/[^a-zA-Z0-9]+/g, "-").replaceAll(/^-|-$/g, "").toLowerCase();
}
