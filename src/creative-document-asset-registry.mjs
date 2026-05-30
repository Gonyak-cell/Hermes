import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_ASSET_REGISTRY_OUT_DIR = "artifacts/asset-registry/latest";
export const DEFAULT_ASSET_REGISTRY_INPUTS = {
  styleRegistryPath: "artifacts/style-registry/latest/style-registry.json",
  templateRegistryPath: "artifacts/template-registry/latest/template-registry.json",
  creativeDocumentPackManifestPath: "artifacts/creative-document-pack-manifest/latest/creative-document-pack-manifest.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  documentRendererAdapterPath: "artifacts/document-renderer-adapter/latest/document-renderer-adapter.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "asset-registry.v1";
const REQUIRED_ASSET_TYPES = ["image", "logo", "graph", "table", "video"];
const REQUIRED_FORMATS = ["docx", "pptx", "html", "email"];
const ASSET_DEFINITIONS = [
  {
    asset_id: "asset.image.reference-visual",
    asset_name: "Reference Visual Image",
    asset_type: "image",
    asset_family: "reference_visual",
    preferred_file_formats: ["png", "jpg", "webp"],
    target_template_formats: ["docx", "pptx", "html"],
    accessibility_requirement: "alt_text_required",
    artifact_path_pattern: "artifacts/assets/image/{asset_id}.metadata.json",
  },
  {
    asset_id: "asset.logo.neutral-lockup",
    asset_name: "Neutral Logo Lockup",
    asset_type: "logo",
    asset_family: "brand_lockup",
    preferred_file_formats: ["svg", "png"],
    target_template_formats: ["docx", "pptx", "html", "email"],
    accessibility_requirement: "brand_label_required",
    artifact_path_pattern: "artifacts/assets/logo/{asset_id}.metadata.json",
  },
  {
    asset_id: "asset.graph.evidence-summary",
    asset_name: "Evidence Summary Graph",
    asset_type: "graph",
    asset_family: "data_visualization",
    preferred_file_formats: ["svg", "png", "json"],
    target_template_formats: ["docx", "pptx", "html"],
    accessibility_requirement: "chart_summary_required",
    artifact_path_pattern: "artifacts/assets/graph/{asset_id}.metadata.json",
  },
  {
    asset_id: "asset.table.issue-matrix",
    asset_name: "Issue Matrix Table",
    asset_type: "table",
    asset_family: "structured_table",
    preferred_file_formats: ["json", "csv", "html"],
    target_template_formats: ["docx", "pptx", "html", "email"],
    accessibility_requirement: "header_scope_required",
    artifact_path_pattern: "artifacts/assets/table/{asset_id}.metadata.json",
  },
  {
    asset_id: "asset.video.review-preview",
    asset_name: "Review Preview Video",
    asset_type: "video",
    asset_family: "preview_clip",
    preferred_file_formats: ["mp4", "webm"],
    target_template_formats: ["pptx", "html"],
    accessibility_requirement: "caption_or_transcript_required",
    artifact_path_pattern: "artifacts/assets/video/{asset_id}.metadata.json",
  },
];

export async function runAssetRegistry(options = {}) {
  const result = await buildAssetRegistry(options);
  if (options.write !== false) await writeAssetRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Asset registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAssetRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_ASSET_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const styleRegistry = sourceById.style_registry;
  const templateRegistry = sourceById.template_registry;
  const creativeDocumentPackManifest = sourceById.creative_document_pack_manifest;
  const domainPackRegistry = sourceById.domain_pack_registry;
  const runtimeFreeze = sourceById.runtime_freeze;
  const documentRendererAdapter = sourceById.document_renderer_adapter;
  const outputDeliveryContractFreeze = sourceById.output_delivery_contract_freeze;

  const assetRecords = buildAssetRecords(generatedAt);
  const assetTypeRecords = buildAssetTypeRecords(assetRecords, generatedAt);
  const assetArtifactPolicies = buildAssetArtifactPolicies(assetRecords, generatedAt);
  const templateAssetBindings = buildTemplateAssetBindings(templateRegistry, styleRegistry, assetRecords, assetArtifactPolicies, generatedAt);
  const assetFormatCoverage = buildAssetFormatCoverage(templateRegistry, templateAssetBindings, generatedAt);
  const boundary = buildAssetRegistryBoundary({
    generatedAt,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
  });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    styleRegistry,
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    assetRecords,
    assetTypeRecords,
    assetArtifactPolicies,
    templateAssetBindings,
    assetFormatCoverage,
    boundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeAssetRegistry({
    styleRegistry,
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    assetRecords,
    assetTypeRecords,
    assetArtifactPolicies,
    templateAssetBindings,
    assetFormatCoverage,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    asset_registry_id: `asset-registry.${dateStamp(generatedAt)}`,
    asset_registry_status: summary.asset_registry_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    asset_registry_contract: buildContract(generatedAt),
    asset_registry_boundary: boundary,
    asset_records: assetRecords,
    asset_type_records: assetTypeRecords,
    asset_artifact_policies: assetArtifactPolicies,
    template_asset_bindings: templateAssetBindings,
    asset_format_coverage: assetFormatCoverage,
    asset_registry_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderAssetRegistryMarkdown(result),
  };
}

export async function writeAssetRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableAssetRegistry(result);
  await writeJson(path.join(outDir, "asset-registry.json"), serializable);
  await writeJson(path.join(outDir, "asset-records.json"), {
    schema_version: "asset-records.v1",
    generated_at: result.generated_at,
    asset_record_count: result.asset_records.length,
    asset_records: result.asset_records,
  });
  await writeJson(path.join(outDir, "asset-type-records.json"), {
    schema_version: "asset-type-records.v1",
    generated_at: result.generated_at,
    asset_type_record_count: result.asset_type_records.length,
    asset_type_records: result.asset_type_records,
  });
  await writeJson(path.join(outDir, "asset-artifact-policies.json"), {
    schema_version: "asset-artifact-policies.v1",
    generated_at: result.generated_at,
    asset_artifact_policy_count: result.asset_artifact_policies.length,
    asset_artifact_policies: result.asset_artifact_policies,
  });
  await writeJson(path.join(outDir, "template-asset-bindings.json"), {
    schema_version: "template-asset-bindings.v1",
    generated_at: result.generated_at,
    template_asset_binding_count: result.template_asset_bindings.length,
    template_asset_bindings: result.template_asset_bindings,
  });
  await writeJson(path.join(outDir, "asset-format-coverage.json"), {
    schema_version: "asset-format-coverage.v1",
    generated_at: result.generated_at,
    asset_format_coverage: result.asset_format_coverage,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "asset-registry-validation-report.v1",
    generated_at: result.generated_at,
    asset_registry_id: result.asset_registry_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAssetRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runAssetRegistry(args);
    console.log(`Asset registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.asset_registry_status}`);
    console.log(`Assets: ${result.summary.registered_asset_record_count}/${result.summary.asset_record_count}`);
    console.log(`Asset types: ${result.summary.covered_asset_type_count}/${result.summary.required_asset_type_count}`);
    console.log(`Template bindings: ${result.summary.linked_template_asset_binding_count}/${result.summary.template_asset_binding_count}`);
    console.log(`Formats covered: ${result.summary.covered_format_count}/${result.summary.required_format_count}`);
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
    schema_version: "asset-registry-contract.v1",
    contract_id: CONTRACT_ID,
    registry_scope: "creative_and_document_domain_pack",
    source_of_truth: "style_registry_template_bindings_and_asset_metadata_policy",
    required_asset_types: REQUIRED_ASSET_TYPES,
    required_formats: REQUIRED_FORMATS,
    safety_rule: "asset_registry_tracks_metadata_artifact_refs_only_and_never_ingests_writes_generates_renders_delivers_or_publishes_media",
    human_review_rule: "asset_records_and_template_bindings_remain_review_required_until_source_attribution_license_format_validation_and_human_approval_pass",
    created_at: generatedAt,
  };
}

function buildAssetRecords(generatedAt) {
  return ASSET_DEFINITIONS.map((definition) => {
    const recordBase = {
      schema_version: "asset-record.v1",
      asset_id: definition.asset_id,
      asset_registry_id: "asset-registry.current",
      asset_name: definition.asset_name,
      asset_type: definition.asset_type,
      asset_family: definition.asset_family,
      preferred_file_formats: definition.preferred_file_formats,
      target_template_formats: definition.target_template_formats,
      artifact_path_pattern: definition.artifact_path_pattern,
      artifact_management_status: "metadata_registered",
      asset_status: "registered",
      file_presence_status: "metadata_only_no_binary",
      binary_content_required_for_phase: false,
      source_attribution_required: true,
      license_review_required: true,
      accessibility_requirement: definition.accessibility_requirement,
      accessibility_text_required: true,
      human_review_required: true,
      format_validation_required: true,
      layout_validation_required: definition.asset_type === "graph" || definition.asset_type === "video",
      media_generation_performed: false,
      asset_file_ingestion_performed: false,
      asset_binary_write_performed: false,
      renderer_execution_performed: false,
      delivery_execution_performed: false,
      protected_action_executed: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  });
}

function buildAssetTypeRecords(assetRecords, generatedAt) {
  return REQUIRED_ASSET_TYPES.map((assetType) => {
    const records = assetRecords.filter((record) => record.asset_type === assetType);
    const recordBase = {
      schema_version: "asset-type-record.v1",
      asset_type_id: `asset-type.${assetType}`,
      asset_registry_id: "asset-registry.current",
      asset_type: assetType,
      asset_type_status: records.length > 0 ? "covered" : "missing",
      asset_count: records.length,
      asset_ids: records.map((record) => record.asset_id),
      artifact_managed_asset_count: records.filter((record) => record.artifact_management_status === "metadata_registered").length,
      source_attribution_required_count: records.filter((record) => record.source_attribution_required).length,
      license_review_required_count: records.filter((record) => record.license_review_required).length,
      human_review_required_count: records.filter((record) => record.human_review_required).length,
      format_validation_required_count: records.filter((record) => record.format_validation_required).length,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  });
}

function buildAssetArtifactPolicies(assetRecords, generatedAt) {
  return assetRecords.map((asset) => {
    const recordBase = {
      schema_version: "asset-artifact-policy.v1",
      asset_artifact_policy_id: `asset-artifact-policy.${asset.asset_type}`,
      asset_registry_id: "asset-registry.current",
      asset_id: asset.asset_id,
      asset_type: asset.asset_type,
      asset_artifact_policy_status: "registered",
      artifact_path_pattern: asset.artifact_path_pattern,
      managed_as_artifact: true,
      metadata_artifact_required: true,
      binary_storage_allowed: false,
      source_attribution_required: true,
      license_review_required: true,
      accessibility_text_required: true,
      media_generation_allowed: false,
      asset_file_ingestion_allowed: false,
      asset_binary_write_allowed: false,
      renderer_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  });
}

function buildTemplateAssetBindings(templateRegistry, styleRegistry, assetRecords, assetArtifactPolicies, generatedAt) {
  const styleBindingByTemplateId = new Map((styleRegistry?.template_style_bindings ?? []).map((binding) => [binding.template_id, binding]));
  const policyByAssetId = new Map(assetArtifactPolicies.map((policy) => [policy.asset_id, policy]));
  const bindings = [];
  for (const template of templateRegistry?.template_records ?? []) {
    const styleBinding = styleBindingByTemplateId.get(template.template_id);
    const matchingAssets = assetRecords.filter((asset) => asset.target_template_formats.includes(template.template_format));
    for (const asset of matchingAssets) {
      const policy = policyByAssetId.get(asset.asset_id);
      const recordBase = {
        schema_version: "template-asset-binding.v1",
        template_asset_binding_id: `template-asset-binding.${slug(template.template_id)}.${slug(asset.asset_type)}`,
        asset_registry_id: "asset-registry.current",
        template_id: template.template_id,
        template_path: template.template_path,
        template_family: template.template_family,
        template_format: template.template_format,
        template_version_id: template.latest_version_id,
        pack_id: template.pack_id,
        style_profile_id: styleBinding?.style_profile_id ?? null,
        style_format: styleBinding?.style_format ?? template.template_format,
        asset_id: asset.asset_id,
        asset_type: asset.asset_type,
        asset_family: asset.asset_family,
        asset_artifact_policy_id: policy?.asset_artifact_policy_id ?? null,
        artifact_path_pattern: asset.artifact_path_pattern,
        binding_status: policy ? "linked" : "missing_policy",
        source_attribution_required: true,
        license_review_required: true,
        accessibility_text_required: true,
        human_review_required: true,
        format_validation_required: true,
        layout_validation_required: asset.layout_validation_required === true || template.layout_validation_required === true,
        media_generation_performed: false,
        asset_file_ingestion_performed: false,
        asset_binary_write_performed: false,
        renderer_execution_performed: false,
        delivery_execution_performed: false,
        protected_action_executed: false,
        client_facing_ready: false,
        client_facing_output_generated: false,
        metadata_hash: null,
        generated_at: generatedAt,
      };
      bindings.push({
        ...recordBase,
        metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
      });
    }
  }
  return bindings.sort((left, right) => `${left.template_id}:${left.asset_type}`.localeCompare(`${right.template_id}:${right.asset_type}`));
}

function buildAssetFormatCoverage(templateRegistry, templateAssetBindings, generatedAt) {
  return REQUIRED_FORMATS.map((assetFormat) => {
    const templates = (templateRegistry?.template_records ?? []).filter((template) => template.template_format === assetFormat);
    const bindings = templateAssetBindings.filter((binding) => binding.template_format === assetFormat);
    return {
      schema_version: "asset-format-coverage.v1",
      asset_format: assetFormat,
      template_format: assetFormat,
      asset_format_coverage_status: templates.length > 0 && bindings.length > 0 ? "covered" : "missing",
      format_coverage_status: templates.length > 0 && bindings.length > 0 ? "covered" : "missing",
      template_count: templates.length,
      asset_binding_count: bindings.length,
      linked_template_asset_binding_count: bindings.filter((binding) => binding.binding_status === "linked").length,
      asset_type_count: new Set(bindings.map((binding) => binding.asset_type)).size,
      asset_types: [...new Set(bindings.map((binding) => binding.asset_type))].sort(),
      asset_ids: [...new Set(bindings.map((binding) => binding.asset_id))].sort(),
      generated_at: generatedAt,
    };
  });
}

function buildAssetRegistryBoundary({ generatedAt, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze }) {
  return {
    schema_version: "asset-registry-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    metadata_registry_only: true,
    asset_binary_write_allowed: false,
    asset_file_ingestion_allowed: false,
    media_generation_allowed: false,
    core_registry_mutation_allowed: false,
    renderer_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    desktop_runtime_source_of_truth: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ packageJson, roadmapText, sourceReads, styleRegistry, templateRegistry, creativeDocumentPackManifest, domainPackRegistry, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, assetRecords, assetTypeRecords, assetArtifactPolicies, templateAssetBindings, assetFormatCoverage, boundary }) {
  const checkpoints = [];
  const assetTypes = new Set(assetRecords.map((record) => record.asset_type));
  checkpoints.push(checkpoint("source.style_registry", styleRegistry?.summary?.style_registry_status === "complete" && styleRegistry?.validation?.valid !== false, "Style registry is complete and valid."));
  checkpoints.push(checkpoint("source.template_registry", templateRegistry?.summary?.template_registry_status === "complete" && templateRegistry?.validation?.valid !== false, "Template registry is complete and valid."));
  checkpoints.push(checkpoint("source.creative_document_pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.domain_pack_registry", domainPackRegistry?.validation?.valid === true && (domainPackRegistry?.summary?.pack_count ?? 0) > 0, "Domain pack registry is valid and readable."));
  checkpoints.push(checkpoint("assets.registered", assetRecords.length === REQUIRED_ASSET_TYPES.length && assetRecords.every((record) => record.asset_status === "registered" && record.metadata_hash?.startsWith("sha256:")), `${assetRecords.length} asset metadata record(s) are registered with hashes.`));
  checkpoints.push(checkpoint("types.covered", assetTypeRecords.length === REQUIRED_ASSET_TYPES.length && REQUIRED_ASSET_TYPES.every((assetType) => assetTypes.has(assetType)) && assetTypeRecords.every((record) => record.asset_type_status === "covered" && record.metadata_hash?.startsWith("sha256:")), `${assetTypes.size}/${REQUIRED_ASSET_TYPES.length} required asset type(s) are covered.`));
  checkpoints.push(checkpoint("artifact_policies.registered", assetArtifactPolicies.length === assetRecords.length && assetArtifactPolicies.every((record) => record.asset_artifact_policy_status === "registered" && record.managed_as_artifact === true && record.binary_storage_allowed === false), `${assetArtifactPolicies.length} asset artifact policy record(s) are registered.`));
  checkpoints.push(checkpoint("bindings.linked", templateAssetBindings.length >= (templateRegistry?.template_records?.length ?? 0) && templateAssetBindings.length > 0 && templateAssetBindings.every((binding) => binding.binding_status === "linked" && binding.metadata_hash?.startsWith("sha256:")), `${templateAssetBindings.filter((binding) => binding.binding_status === "linked").length}/${templateAssetBindings.length} template asset binding(s) are linked.`));
  checkpoints.push(checkpoint("formats.covered", assetFormatCoverage.length === REQUIRED_FORMATS.length && assetFormatCoverage.every((record) => record.asset_format_coverage_status === "covered"), `${assetFormatCoverage.filter((record) => record.asset_format_coverage_status === "covered").length}/${REQUIRED_FORMATS.length} required asset format(s) are covered.`));
  checkpoints.push(checkpoint("gates.review_source_license", [...assetRecords, ...templateAssetBindings].every((record) => record.human_review_required === true && record.source_attribution_required === true && record.license_review_required === true && record.format_validation_required === true && record.client_facing_ready === false), "Every asset and template binding remains human-review, source-attribution, license-review, and format-validation gated."));
  checkpoints.push(checkpoint("runtime.boundary", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_runtime_execution_allowed === false, "Runtime freeze keeps Desktop execution disabled."));
  checkpoints.push(checkpoint("renderer.boundary", documentRendererAdapter?.summary?.document_renderer_adapter_status === "complete" && documentRendererAdapter?.summary?.desktop_read_only === true, "Document renderer adapter is available only as a read-only contract."));
  checkpoints.push(checkpoint("delivery.boundary", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && boundary.delivery_execution_allowed === false, "Output delivery contract is frozen while asset registry delivery execution stays disabled."));
  checkpoints.push(checkpoint("boundary.read_only", boundary.boundary_status === "enforced" && boundary.read_only === true && boundary.asset_binary_write_allowed === false && boundary.asset_file_ingestion_allowed === false && boundary.media_generation_allowed === false && boundary.renderer_execution_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false, "Asset registry boundary is read-only and metadata-only."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:asset-registry"]), "package.json registers creative-document:asset-registry."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P256") && roadmapText.includes("asset registry"), "Roadmap ledger keeps the P256 asset registry slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All asset registry source contracts were readable."));
  return checkpoints;
}

function summarizeAssetRegistry({ styleRegistry, templateRegistry, creativeDocumentPackManifest, domainPackRegistry, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, assetRecords, assetTypeRecords, assetArtifactPolicies, templateAssetBindings, assetFormatCoverage, boundary, validation }) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const assetByType = countBy(assetRecords, "asset_type");
  const bindingByFormat = countBy(templateAssetBindings, "template_format");
  const metadataHashCount = [...assetRecords, ...assetTypeRecords, ...assetArtifactPolicies, ...templateAssetBindings].filter((record) => record.metadata_hash?.startsWith("sha256:")).length;
  return {
    asset_registry_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    asset_registry_contract_id: CONTRACT_ID,
    source_style_registry_status: styleRegistry?.summary?.style_registry_status ?? "missing",
    source_template_registry_status: templateRegistry?.summary?.template_registry_status ?? "missing",
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_domain_pack_registry_status: domainPackRegistry?.validation?.valid === true ? "complete" : "blocked",
    asset_record_count: assetRecords.length,
    registered_asset_record_count: assetRecords.filter((record) => record.asset_status === "registered").length,
    required_asset_type_count: REQUIRED_ASSET_TYPES.length,
    covered_asset_type_count: assetTypeRecords.filter((record) => record.asset_type_status === "covered").length,
    asset_type_record_count: assetTypeRecords.length,
    asset_artifact_policy_count: assetArtifactPolicies.length,
    registered_asset_artifact_policy_count: assetArtifactPolicies.filter((record) => record.asset_artifact_policy_status === "registered").length,
    template_asset_binding_count: templateAssetBindings.length,
    linked_template_asset_binding_count: templateAssetBindings.filter((record) => record.binding_status === "linked").length,
    required_format_count: REQUIRED_FORMATS.length,
    covered_format_count: assetFormatCoverage.filter((record) => record.asset_format_coverage_status === "covered").length,
    image_asset_count: assetByType.image ?? 0,
    logo_asset_count: assetByType.logo ?? 0,
    graph_asset_count: assetByType.graph ?? 0,
    table_asset_count: assetByType.table ?? 0,
    video_asset_count: assetByType.video ?? 0,
    docx_template_asset_binding_count: bindingByFormat.docx ?? 0,
    pptx_template_asset_binding_count: bindingByFormat.pptx ?? 0,
    html_template_asset_binding_count: bindingByFormat.html ?? 0,
    email_template_asset_binding_count: bindingByFormat.email ?? 0,
    metadata_hash_count: metadataHashCount,
    human_review_required_asset_count: assetRecords.filter((record) => record.human_review_required).length,
    source_attribution_required_asset_count: assetRecords.filter((record) => record.source_attribution_required).length,
    license_review_required_asset_count: assetRecords.filter((record) => record.license_review_required).length,
    format_validation_required_asset_count: assetRecords.filter((record) => record.format_validation_required).length,
    source_attribution_required_binding_count: templateAssetBindings.filter((record) => record.source_attribution_required).length,
    license_review_required_binding_count: templateAssetBindings.filter((record) => record.license_review_required).length,
    format_validation_required_binding_count: templateAssetBindings.filter((record) => record.format_validation_required).length,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    read_only: boundary.read_only,
    metadata_registry_only: boundary.metadata_registry_only,
    asset_binary_write_allowed: boundary.asset_binary_write_allowed,
    asset_file_ingestion_allowed: boundary.asset_file_ingestion_allowed,
    media_generation_allowed: boundary.media_generation_allowed,
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    renderer_execution_allowed: boundary.renderer_execution_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    protected_action_allowed: boundary.protected_action_allowed,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: boundary.client_facing_ready_count,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    asset_registry_generated: true,
    metadata_registry_only: true,
    source_attribution_required: true,
    license_review_required: true,
    human_review_required: true,
    format_validation_required: true,
    media_generation_performed: false,
    asset_file_ingestion_performed: false,
    asset_binary_write_performed: false,
    renderer_execution_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    core_registry_mutation_performed: false,
    client_facing_output_generated: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "asset-registry-checkpoint.v1",
    checkpoint_id: `asset-registry.${checkpointId}`,
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

async function readSourceArtifacts(inputs) {
  return [
    await sourceRead("style_registry", inputs.style_registry_path, readJsonOrError),
    await sourceRead("template_registry", inputs.template_registry_path, readJsonOrError),
    await sourceRead("creative_document_pack_manifest", inputs.creative_document_pack_manifest_path, readJsonOrError),
    await sourceRead("domain_pack_registry", inputs.domain_pack_registry_path, readJsonOrError),
    await sourceRead("runtime_freeze", inputs.runtime_freeze_path, readJsonOrError),
    await sourceRead("document_renderer_adapter", inputs.document_renderer_adapter_path, readJsonOrError),
    await sourceRead("output_delivery_contract_freeze", inputs.output_delivery_contract_freeze_path, readJsonOrError),
  ];
}

async function sourceRead(sourceId, sourcePath, reader) {
  const result = await reader(sourcePath);
  return {
    source_id: sourceId,
    path: sourcePath,
    readable: !result.error,
    value: result.value,
    error: result.error,
  };
}

function serializableAssetRegistry(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function renderAssetRegistryMarkdown(result) {
  const lines = [];
  lines.push("# Asset Registry");
  lines.push("");
  lines.push(`Status: ${result.summary.asset_registry_status}`);
  lines.push(`Assets: ${result.summary.registered_asset_record_count}/${result.summary.asset_record_count}`);
  lines.push(`Asset types: ${result.summary.covered_asset_type_count}/${result.summary.required_asset_type_count}`);
  lines.push(`Template bindings: ${result.summary.linked_template_asset_binding_count}/${result.summary.template_asset_binding_count}`);
  lines.push(`Formats covered: ${result.summary.covered_format_count}/${result.summary.required_format_count}`);
  lines.push(`Read-only: ${result.summary.read_only}`);
  lines.push("");
  lines.push("## Asset Type Coverage");
  for (const row of result.asset_type_records) {
    lines.push(`- ${row.asset_type}: ${row.asset_type_status} (${row.asset_count})`);
  }
  lines.push("");
  lines.push("## Asset Format Coverage");
  for (const row of result.asset_format_coverage) {
    lines.push(`- ${row.asset_format}: ${row.asset_format_coverage_status} (${row.asset_binding_count})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    style_registry_path: path.resolve(options.styleRegistryPath ?? DEFAULT_ASSET_REGISTRY_INPUTS.styleRegistryPath),
    template_registry_path: path.resolve(options.templateRegistryPath ?? DEFAULT_ASSET_REGISTRY_INPUTS.templateRegistryPath),
    creative_document_pack_manifest_path: path.resolve(options.creativeDocumentPackManifestPath ?? DEFAULT_ASSET_REGISTRY_INPUTS.creativeDocumentPackManifestPath),
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_ASSET_REGISTRY_INPUTS.domainPackRegistryPath),
    runtime_freeze_path: path.resolve(options.runtimeFreezePath ?? DEFAULT_ASSET_REGISTRY_INPUTS.runtimeFreezePath),
    document_renderer_adapter_path: path.resolve(options.documentRendererAdapterPath ?? DEFAULT_ASSET_REGISTRY_INPUTS.documentRendererAdapterPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_ASSET_REGISTRY_INPUTS.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_ASSET_REGISTRY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_ASSET_REGISTRY_INPUTS.roadmapPath),
  };
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
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--style-registry") parsed.styleRegistryPath = argv[++index];
    else if (arg === "--template-registry") parsed.templateRegistryPath = argv[++index];
    else if (arg === "--creative-document-pack-manifest") parsed.creativeDocumentPackManifestPath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--runtime-freeze") parsed.runtimeFreezePath = argv[++index];
    else if (arg === "--document-renderer-adapter") parsed.documentRendererAdapterPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-asset-registry.mjs [options]

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
  --style-registry <path>                     Style registry path.
  --template-registry <path>                  Template registry path.
  --creative-document-pack-manifest <path>    Creative-document pack manifest path.
  --domain-pack-registry <path>               Domain pack registry path.
  --runtime-freeze <path>                     Runtime freeze path.
  --document-renderer-adapter <path>          Document renderer adapter path.
  --output-delivery-contract-freeze <path>    Output delivery contract freeze path.
  --package <path>                            package.json path.
  --roadmap <path>                            Roadmap/ledger path.
`);
}

async function readJsonOrError(filePath) {
  try {
    return {
      value: JSON.parse(await readFile(filePath, "utf8")),
    };
  } catch (error) {
    return {
      value: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    return {
      value: await readFile(filePath, "utf8"),
    };
  } catch (error) {
    return {
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function contractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  const value = result?.value ?? result;
  return {
    label,
    available: true,
    schema_version: value?.schema_version ?? null,
    content_hash: `sha256:${hashJson(value ?? {})}`,
  };
}

function textContractRef(label, result) {
  if (result?.error) {
    return {
      label,
      available: false,
      error: result.error,
    };
  }
  return {
    label,
    available: true,
    content_hash: `sha256:${hashText(result?.value ?? "")}`,
  };
}

function hashJson(value) {
  return hashText(stableStringify(value));
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) counts[item[key]] = (counts[item[key]] ?? 0) + 1;
  return counts;
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
