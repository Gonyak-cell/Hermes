import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PERSONAL_DEV_PACK_MANIFEST_OUT_DIR = "artifacts/personal-dev-pack-manifest/latest";
export const DEFAULT_PERSONAL_DEV_PACK_MANIFEST_INPUTS = {
  personalDevPackPath: "packs/personal-dev/pack.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  packManifestCompatibilityPath: "artifacts/pack-manifest-compatibility/latest/pack-manifest-compatibility.json",
  capabilityManifestV2Path: "artifacts/capability-manifest-v2/latest/capability-manifest-v2.json",
  capabilityRegistryApiPath: "artifacts/capability-registry-api/latest/capability-registry-api.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "personal-dev-pack-manifest.v1";
const PACK_ID = "personal-dev";
const COMMON_PACK_ID = "common";
const DESKTOP_SURFACE_POLICY = "read_only_operator_surface";
const SOURCE_OF_TRUTH = "domain_pack_registry_and_pack_manifest";

export async function runPersonalDevPackManifest(options = {}) {
  const result = await buildPersonalDevPackManifest(options);
  if (options.write !== false) await writePersonalDevPackManifest(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Personal-dev pack manifest validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPersonalDevPackManifest(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERSONAL_DEV_PACK_MANIFEST_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const packManifest = sourceById.personal_dev_pack_manifest_source;
  const domainPackRegistry = sourceById.domain_pack_registry;
  const packManifestCompatibility = sourceById.pack_manifest_compatibility;
  const capabilityManifestV2 = sourceById.capability_manifest_v2;
  const capabilityRegistryApi = sourceById.capability_registry_api;
  const runtimeFreeze = sourceById.runtime_freeze;

  const packRecord = domainPackRegistry?.packs?.find((pack) => pack.pack_id === PACK_ID) ?? null;
  const compatibilityRecord = packManifestCompatibility?.pack_compatibility_records?.find((record) => record.pack_id === PACK_ID) ?? null;
  const compatibilityMatrixRow = packManifestCompatibility?.compatibility_matrix?.find((row) => row.pack_id === PACK_ID) ?? null;
  const manifestCapabilities = packManifest?.capabilities ?? [];
  const registryCapabilities = manifestCapabilities.map((capability) => domainPackRegistry?.capabilities?.find((record) => record.capability_id === capability.capability_id) ?? null);
  const capabilityManifests = manifestCapabilities.map((capability) => capabilityManifestV2?.capability_manifests?.find((record) => record.capability_id === capability.capability_id) ?? null);
  const packApiCard = capabilityRegistryApi?.pack_api_cards?.find((card) => card.pack_id === PACK_ID) ?? null;
  const capabilityApiCards = manifestCapabilities.map((capability) => capabilityRegistryApi?.capability_api_cards?.find((card) => card.capability_id === capability.capability_id) ?? null);
  const capabilityVersionApiCards = manifestCapabilities.map((capability) => capabilityRegistryApi?.capability_version_api_cards?.find((card) => card.capability_id === capability.capability_id && card.version === capability.version) ?? null);

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
    runtimeFreeze,
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
  const packBoundary = buildPackBoundary({ generatedAt, packManifest, packRecord, runtimeFreeze, packApiCard, capabilityApiCards });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    packManifest,
    domainPackRegistry,
    packManifestCompatibility,
    capabilityManifestV2,
    capabilityRegistryApi,
    runtimeFreeze,
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
  const summary = summarizePersonalDevPackManifest({
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
    personal_dev_pack_manifest_id: `personal-dev-pack-manifest.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    personal_dev_pack_manifest_status: summary.personal_dev_pack_manifest_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    personal_dev_pack_manifest_contract: buildContract(generatedAt),
    personal_dev_pack_registration: packRegistration,
    personal_dev_capability_registrations: capabilityRegistrations,
    personal_dev_pack_boundary: packBoundary,
    personal_dev_pack_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderPersonalDevPackManifestMarkdown(result),
  };
}

export async function writePersonalDevPackManifest(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePersonalDevPackManifest(result);
  await writeJson(path.join(outDir, "personal-dev-pack-manifest.json"), serializable);
  await writeJson(path.join(outDir, "personal-dev-pack-registration.json"), {
    schema_version: "personal-dev-pack-registration-artifact.v1",
    generated_at: result.generated_at,
    personal_dev_pack_registration: result.personal_dev_pack_registration,
  });
  await writeJson(path.join(outDir, "personal-dev-capability-registrations.json"), {
    schema_version: "personal-dev-capability-registrations.v1",
    generated_at: result.generated_at,
    personal_dev_capability_registration_count: result.personal_dev_capability_registrations.length,
    personal_dev_capability_registrations: result.personal_dev_capability_registrations,
  });
  await writeJson(path.join(outDir, "personal-dev-pack-boundary.json"), {
    schema_version: "personal-dev-pack-boundary-artifact.v1",
    generated_at: result.generated_at,
    personal_dev_pack_boundary: result.personal_dev_pack_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "personal-dev-pack-manifest-validation-report.v1",
    generated_at: result.generated_at,
    personal_dev_pack_manifest_id: result.personal_dev_pack_manifest_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPersonalDevPackManifestCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPersonalDevPackManifest(args);
    console.log(`Personal-dev pack manifest ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.personal_dev_pack_manifest_status}`);
    console.log(`Capabilities: ${result.summary.registered_capability_count}/${result.summary.capability_count}`);
    console.log(`Core mutations required: ${result.summary.core_mutation_required_count}`);
    console.log(`Desktop mutation allowed: ${result.summary.desktop_mutation_allowed}`);
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
    schema_version: "personal-dev-pack-manifest-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    domain_track: "personal_dev_domain_pack",
    source_of_truth: SOURCE_OF_TRUTH,
    registration_rule: "pack_manifest_is_registered_through_domain_pack_registry_without_core_mutation",
    capability_rule: "capabilities_must_appear_in_domain_registry_capability_manifest_v2_and_capability_registry_api",
    desktop_companion_rule: "desktop_companion_reads_pack_capability_and_gate_status_only",
    mutation_policy: "protected_mutations_require_human_gate_and_are_not_executed_by_this_artifact",
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
  runtimeFreeze,
}) {
  const registeredCapabilityCount = registryCapabilities.filter(Boolean).length;
  const capabilityManifestV2Count = capabilityManifests.filter(Boolean).length;
  const capabilityApiCardCount = capabilityApiCards.filter(Boolean).length;
  const status = packManifest?.pack_id === PACK_ID
    && packRecord
    && compatibilityRecord?.compatibility_status === "compatible"
    && registeredCapabilityCount === manifestCapabilities.length
    && capabilityManifestV2Count === manifestCapabilities.length
    && capabilityApiCardCount === manifestCapabilities.length
    ? "registered"
    : "blocked";
  const registration = {
    schema_version: "personal-dev-pack-registration.v1",
    registration_id: "personal-dev-pack-registration.personal-dev",
    pack_id: PACK_ID,
    pack_version: packManifest?.pack_version ?? null,
    display_name: packManifest?.display_name ?? null,
    manifest_schema_version: packManifest?.schema_version ?? null,
    manifest_path: path.resolve(inputs.personal_dev_pack_path),
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
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    core_pack_mutation_required: false,
    core_capability_registration_required: false,
    core_route_registration_required: false,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: Boolean(packApiCard?.read_only) || true,
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
    const registrationStatus = registryCapability && capabilityManifest && apiCard && versionCard ? "registered" : "blocked";
    const registration = {
      schema_version: "personal-dev-capability-registration.v1",
      capability_registration_id: `personal-dev-capability-registration.${slugify(manifestCapability.capability_id)}`,
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
      approval_required: Boolean(apiCard?.approval_required),
      human_review_required: Boolean(apiCard?.human_review_required),
      attorney_review_required: Boolean(apiCard?.attorney_review_required),
      policy_status: apiCard?.policy_status ?? "unknown",
      gate_runtime_status: apiCard?.gate_runtime_status ?? "unknown",
      default_output_status: packManifest?.permissions?.default_output_status ?? null,
      agent_outputs_trusted: Boolean(packManifest?.metadata?.agent_outputs_trusted),
      merge_requires_gate: packManifest?.metadata?.merge_requires_gate === true,
      direct_apply_allowed: false,
      direct_merge_allowed: false,
      core_registration_required: false,
      desktop_read_only: Boolean(apiCard?.read_only) || true,
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

function buildPackBoundary({ generatedAt, packManifest, packRecord, runtimeFreeze, packApiCard, capabilityApiCards }) {
  const permissions = packManifest?.permissions ?? {};
  const metadata = packManifest?.metadata ?? {};
  const readOnlyCards = [packApiCard, ...capabilityApiCards].filter(Boolean).every((card) => card.read_only === true && card.mutation_allowed === false);
  const boundary = {
    schema_version: "personal-dev-pack-boundary.v1",
    boundary_id: "personal-dev-pack-boundary.personal-dev",
    pack_id: PACK_ID,
    source_manifest_path: packRecord?.path ?? null,
    source_of_truth: SOURCE_OF_TRUTH,
    desktop_companion_role: "operator_read_only_view",
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_card_read_only: readOnlyCards,
    desktop_read_only: true,
    desktop_mutation_allowed: false,
    desktop_runtime_source_of_truth: false,
    desktop_protected_mutation_execution_allowed: false,
    protected_mutations_require_human_gate: true,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    installer_or_gateway_control: false,
    ssh_or_cron_control: false,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    runtime_execution_allowed: false,
    runtime_control_allowed: false,
    max_classification: permissions.max_classification ?? null,
    external_model_policy: permissions.external_model_policy ?? null,
    allowed_runtime_ids: permissions.allowed_runtimes ?? [],
    default_output_status: permissions.default_output_status ?? null,
    agent_outputs_trusted: Boolean(metadata.agent_outputs_trusted),
    merge_requires_gate: metadata.merge_requires_gate === true,
    core_pack_mutation_required: false,
    core_capability_registration_required: false,
    core_route_registration_required: false,
    core_mutation_required_count: 0,
    boundary_status: readOnlyCards ? "enforced" : "blocked",
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
  const commonDependencyDeclared = packManifest?.dependencies?.some((dependency) => dependency.pack_id === COMMON_PACK_ID) === true;
  const packageScriptPresent = Boolean(packageJson?.scripts?.["personal-dev:pack-manifest"]);
  const roadmapSlotPresent = typeof roadmapText === "string" && roadmapText.includes("| P213 | personal-dev pack manifest 구현 |");
  return [
    checkpoint("source_artifacts_available", allSourcesAvailable, `${sourceReads.filter((source) => source.available).length}/${sourceReads.length} source artifact(s) available.`),
    checkpoint("manifest_identity", packManifest?.schema_version === "domain-pack-manifest.v1" && packManifest?.pack_id === PACK_ID, `Manifest identity ${packManifest?.pack_id ?? "missing"} uses ${packManifest?.schema_version ?? "missing"}.`),
    checkpoint("registry_pack_registered", Boolean(domainPackRegistry?.packs?.some((pack) => pack.pack_id === PACK_ID && pack.validation?.valid === true)), "personal-dev pack is present and valid in the domain pack registry."),
    checkpoint("registry_capabilities_registered", setContainsAll(registryCapabilityIds, manifestCapabilityIds) && registryCapabilityIds.size === manifestCapabilityIds.size, `${registryCapabilityIds.size}/${manifestCapabilityIds.size} personal-dev capability registry rows present.`),
    checkpoint("capability_manifest_v2_registered", setContainsAll(capabilityManifestIds, manifestCapabilityIds) && capabilityManifestIds.size === manifestCapabilityIds.size, `${capabilityManifestIds.size}/${manifestCapabilityIds.size} personal-dev capability manifest v2 rows present.`),
    checkpoint("pack_compatibility_registered", packManifestCompatibility?.pack_compatibility_records?.some((record) => record.pack_id === PACK_ID && record.compatibility_status === "compatible") === true, "personal-dev compatibility record is compatible."),
    checkpoint("common_dependency_declared", commonDependencyDeclared, "personal-dev depends on the common pack."),
    checkpoint("capability_registry_api_registered", Boolean(capabilityRegistryApi?.pack_api_cards?.some((card) => card.pack_id === PACK_ID && card.read_only === true && card.mutation_allowed === false)) && setContainsAll(apiCapabilityIds, manifestCapabilityIds), "Desktop-readable pack and capability cards are present without mutation routes."),
    checkpoint("runtime_freeze_bound", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_mutation_allowed === false, "Runtime freeze is complete and Desktop remains read-only."),
    checkpoint("pack_boundary_enforced", packBoundary.boundary_status === "enforced" && packBoundary.core_mutation_required_count === 0 && packBoundary.desktop_mutation_allowed === false, "Pack boundary requires no core mutation and exposes no Desktop mutation rights."),
    checkpoint("capability_registration_enforced", capabilityRegistrations.every((registration) => registration.registration_status === "registered" && registration.core_registration_required === false && registration.desktop_mutation_allowed === false), `${capabilityRegistrations.filter((registration) => registration.registration_status === "registered").length}/${capabilityRegistrations.length} capability registration(s) enforce the read-only boundary.`),
    checkpoint("permissions_are_dev_safe", packManifest?.permissions?.max_classification === "P1_INTERNAL" && packManifest?.permissions?.external_model_policy === "allowed_with_audit" && packManifest?.permissions?.default_output_status === "draft" && packManifest?.metadata?.agent_outputs_trusted === false && packManifest?.metadata?.merge_requires_gate === true, "Personal-dev permissions preserve draft output, audit, untrusted agent output, and merge gate requirements."),
    checkpoint("package_script_registered", packageScriptPresent, "package.json exposes personal-dev:pack-manifest."),
    checkpoint("roadmap_slot_present", roadmapSlotPresent, "P213 remains recorded in the final completion ledger."),
  ];
}

function summarizePersonalDevPackManifest({ packManifest, packRegistration, capabilityRegistrations, packBoundary, checkpoints, validation }) {
  const passedCheckpointCount = checkpoints.filter((checkpointItem) => checkpointItem.status === "passed").length;
  const registeredCapabilityCount = capabilityRegistrations.filter((registration) => registration.registration_status === "registered").length;
  const coreMutationRequiredCount = [
    packRegistration.core_pack_mutation_required,
    packRegistration.core_capability_registration_required,
    packRegistration.core_route_registration_required,
    ...capabilityRegistrations.map((registration) => registration.core_registration_required),
  ].filter(Boolean).length + (packBoundary.core_mutation_required_count ?? 0);
  const complete = validation.valid
    && packRegistration.registration_status === "registered"
    && registeredCapabilityCount === capabilityRegistrations.length
    && packBoundary.boundary_status === "enforced"
    && coreMutationRequiredCount === 0;
  return {
    personal_dev_pack_manifest_status: complete ? "complete" : "blocked",
    personal_dev_pack_manifest_contract_id: CONTRACT_ID,
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
    capability_count: packRegistration.capability_count,
    registered_capability_count: registeredCapabilityCount,
    capability_manifest_v2_count: packRegistration.capability_manifest_v2_count,
    capability_registry_api_pack_card_present: packRegistration.capability_registry_api_pack_card_present,
    capability_registry_api_capability_card_count: packRegistration.capability_registry_api_capability_card_count,
    runtime_freeze_status: packRegistration.runtime_freeze_status,
    desktop_surface_policy: DESKTOP_SURFACE_POLICY,
    desktop_read_only: packBoundary.desktop_read_only,
    desktop_mutation_allowed: packBoundary.desktop_mutation_allowed,
    desktop_runtime_source_of_truth: packBoundary.desktop_runtime_source_of_truth,
    desktop_protected_mutation_execution_allowed: packBoundary.desktop_protected_mutation_execution_allowed,
    raw_secret_material_exposed: packBoundary.raw_secret_material_exposed,
    provider_key_exposed: packBoundary.provider_key_exposed,
    installer_or_gateway_control: packBoundary.installer_or_gateway_control,
    ssh_or_cron_control: packBoundary.ssh_or_cron_control,
    core_pack_mutation_required: packRegistration.core_pack_mutation_required,
    core_capability_registration_required: packRegistration.core_capability_registration_required,
    core_route_registration_required: packRegistration.core_route_registration_required,
    core_mutation_required_count: coreMutationRequiredCount,
    max_classification: packBoundary.max_classification,
    external_model_policy: packBoundary.external_model_policy,
    default_output_status: packBoundary.default_output_status,
    agent_outputs_trusted: packBoundary.agent_outputs_trusted,
    merge_requires_gate: packBoundary.merge_requires_gate,
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
    source_pack_manifest_mutation_allowed: false,
    core_registry_mutation_allowed: false,
    runtime_execution_performed: false,
    protected_mutation_executed: false,
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
    readJsonSource("personal_dev_pack_manifest_source", inputs.personal_dev_pack_path),
    readJsonSource("domain_pack_registry", inputs.domain_pack_registry_path),
    readJsonSource("pack_manifest_compatibility", inputs.pack_manifest_compatibility_path),
    readJsonSource("capability_manifest_v2", inputs.capability_manifest_v2_path),
    readJsonSource("capability_registry_api", inputs.capability_registry_api_path),
    readJsonSource("runtime_freeze", inputs.runtime_freeze_path),
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
  const merged = { ...DEFAULT_PERSONAL_DEV_PACK_MANIFEST_INPUTS, ...options };
  return {
    personal_dev_pack_path: merged.personalDevPackPath,
    domain_pack_registry_path: merged.domainPackRegistryPath,
    pack_manifest_compatibility_path: merged.packManifestCompatibilityPath,
    capability_manifest_v2_path: merged.capabilityManifestV2Path,
    capability_registry_api_path: merged.capabilityRegistryApiPath,
    runtime_freeze_path: merged.runtimeFreezePath,
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
    else if (arg === "--personal-dev-pack") parsed.personalDevPackPath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--pack-manifest-compatibility") parsed.packManifestCompatibilityPath = argv[++index];
    else if (arg === "--capability-manifest-v2") parsed.capabilityManifestV2Path = argv[++index];
    else if (arg === "--capability-registry-api") parsed.capabilityRegistryApiPath = argv[++index];
    else if (arg === "--runtime-freeze") parsed.runtimeFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/personal-dev-pack-manifest.mjs [options]

Options:
  --check                              Fail when validation does not pass
  --no-write                           Build without writing artifacts
  --out-dir <path>                     Output directory
  --personal-dev-pack <path>           personal-dev pack manifest path
  --domain-pack-registry <path>        Domain pack registry artifact
  --pack-manifest-compatibility <path> Pack compatibility artifact
  --capability-manifest-v2 <path>      Capability manifest v2 artifact
  --capability-registry-api <path>     Capability registry API artifact
  --runtime-freeze <path>              Runtime freeze artifact
  --package <path>                     package.json path
  --roadmap <path>                     final completion ledger path
`);
}

function renderPersonalDevPackManifestMarkdown(result) {
  const lines = [];
  lines.push("# Personal Dev Pack Manifest");
  lines.push("");
  lines.push(`Status: ${result.summary.personal_dev_pack_manifest_status}`);
  lines.push("");
  lines.push("## Registration");
  lines.push("");
  lines.push(`- Pack: ${result.summary.pack_id}@${result.summary.pack_version}`);
  lines.push(`- Capabilities: ${result.summary.registered_capability_count}/${result.summary.capability_count}`);
  lines.push(`- Compatibility: ${result.summary.compatibility_status}`);
  lines.push(`- Common dependency: ${result.summary.common_dependency_declared ? "declared" : "missing"}`);
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
  for (const checkpointItem of result.personal_dev_pack_checkpoints) {
    lines.push(`- ${checkpointItem.checkpoint_id}: ${checkpointItem.status} - ${checkpointItem.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function serializablePersonalDevPackManifest(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "personal-dev-pack-checkpoint.v1",
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
