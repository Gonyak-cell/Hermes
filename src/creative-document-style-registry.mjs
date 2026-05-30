import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STYLE_REGISTRY_OUT_DIR = "artifacts/style-registry/latest";
export const DEFAULT_STYLE_REGISTRY_INPUTS = {
  templateRegistryPath: "artifacts/template-registry/latest/template-registry.json",
  creativeDocumentPackManifestPath: "artifacts/creative-document-pack-manifest/latest/creative-document-pack-manifest.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  runtimeFreezePath: "artifacts/runtime-freeze/latest/runtime-freeze.json",
  documentRendererAdapterPath: "artifacts/document-renderer-adapter/latest/document-renderer-adapter.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "style-registry.v1";
const REQUIRED_FORMATS = ["docx", "pptx", "html", "email"];
const REQUIRED_STYLE_RULE_TYPES = ["voice", "tone", "brand", "font", "layout"];
const STYLE_PROFILE_DEFINITIONS = [
  {
    style_profile_id: "style-profile.law-firm.formal-legal-docx",
    style_profile_name: "Law Firm Formal Legal DOCX",
    style_format: "docx",
    voice_profile: "formal_legal_operations",
    tone_profile: "attorney_review_required",
    brand_profile: "law_firm_neutral",
    font_system: "system_serif_document",
    layout_system: "numbered_report_sections",
    color_palette: "neutral_ink",
    spacing_system: "print_safe",
  },
  {
    style_profile_id: "style-profile.creative-document.presentation-pptx",
    style_profile_name: "Creative Presentation PPTX",
    style_format: "pptx",
    voice_profile: "executive_storyline",
    tone_profile: "polished_internal_draft",
    brand_profile: "creative_document",
    font_system: "presentation_sans",
    layout_system: "slide_grid_16_9",
    color_palette: "accented_neutral",
    spacing_system: "slide_safe",
  },
  {
    style_profile_id: "style-profile.common.review-html",
    style_profile_name: "Common Review HTML",
    style_format: "html",
    voice_profile: "concise_review",
    tone_profile: "internal_review",
    brand_profile: "hermes_neutral",
    font_system: "ui_sans",
    layout_system: "responsive_review_panel",
    color_palette: "accessible_status",
    spacing_system: "screen_safe",
  },
  {
    style_profile_id: "style-profile.law-firm.client-email",
    style_profile_name: "Law Firm Client Email",
    style_format: "email",
    voice_profile: "client_memo",
    tone_profile: "approval_required",
    brand_profile: "law_firm_neutral",
    font_system: "system_sans_email",
    layout_system: "email_brief",
    color_palette: "plain_text_safe",
    spacing_system: "email_safe",
  },
];

export async function runStyleRegistry(options = {}) {
  const result = await buildStyleRegistry(options);
  if (options.write !== false) await writeStyleRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Style registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildStyleRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_STYLE_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const templateRegistry = sourceById.template_registry;
  const creativeDocumentPackManifest = sourceById.creative_document_pack_manifest;
  const domainPackRegistry = sourceById.domain_pack_registry;
  const runtimeFreeze = sourceById.runtime_freeze;
  const documentRendererAdapter = sourceById.document_renderer_adapter;
  const outputDeliveryContractFreeze = sourceById.output_delivery_contract_freeze;

  const styleProfileRecords = buildStyleProfileRecords(generatedAt);
  const styleRuleRecords = buildStyleRuleRecords(styleProfileRecords, generatedAt);
  const templateStyleBindings = buildTemplateStyleBindings(templateRegistry, styleProfileRecords, styleRuleRecords, generatedAt);
  const styleFormatCoverage = buildStyleFormatCoverage(styleProfileRecords, templateStyleBindings, generatedAt);
  const boundary = buildStyleRegistryBoundary({
    generatedAt,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
  });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    styleProfileRecords,
    styleRuleRecords,
    templateStyleBindings,
    styleFormatCoverage,
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
  const summary = summarizeStyleRegistry({
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    styleProfileRecords,
    styleRuleRecords,
    templateStyleBindings,
    styleFormatCoverage,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    style_registry_id: `style-registry.${dateStamp(generatedAt)}`,
    style_registry_status: summary.style_registry_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    style_registry_contract: buildContract(generatedAt),
    style_registry_boundary: boundary,
    style_profile_records: styleProfileRecords,
    style_rule_records: styleRuleRecords,
    template_style_bindings: templateStyleBindings,
    style_format_coverage: styleFormatCoverage,
    style_registry_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderStyleRegistryMarkdown(result),
  };
}

export async function writeStyleRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableStyleRegistry(result);
  await writeJson(path.join(outDir, "style-registry.json"), serializable);
  await writeJson(path.join(outDir, "style-profile-records.json"), {
    schema_version: "style-profile-records.v1",
    generated_at: result.generated_at,
    style_profile_count: result.style_profile_records.length,
    style_profile_records: result.style_profile_records,
  });
  await writeJson(path.join(outDir, "style-rule-records.json"), {
    schema_version: "style-rule-records.v1",
    generated_at: result.generated_at,
    style_rule_count: result.style_rule_records.length,
    style_rule_records: result.style_rule_records,
  });
  await writeJson(path.join(outDir, "template-style-bindings.json"), {
    schema_version: "template-style-bindings.v1",
    generated_at: result.generated_at,
    template_style_binding_count: result.template_style_bindings.length,
    template_style_bindings: result.template_style_bindings,
  });
  await writeJson(path.join(outDir, "style-format-coverage.json"), {
    schema_version: "style-format-coverage.v1",
    generated_at: result.generated_at,
    style_format_coverage: result.style_format_coverage,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "style-registry-validation-report.v1",
    generated_at: result.generated_at,
    style_registry_id: result.style_registry_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runStyleRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runStyleRegistry(args);
    console.log(`Style registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.style_registry_status}`);
    console.log(`Style profiles: ${result.summary.style_profile_count}`);
    console.log(`Style rules: ${result.summary.covered_style_rule_type_count}/${result.summary.required_style_rule_type_count}`);
    console.log(`Template bindings: ${result.summary.linked_template_style_binding_count}/${result.summary.template_style_binding_count}`);
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
    schema_version: "style-registry-contract.v1",
    contract_id: CONTRACT_ID,
    registry_scope: "creative_and_document_domain_pack",
    source_of_truth: "template_registry_and_domain_pack_style_metadata",
    required_formats: REQUIRED_FORMATS,
    required_style_rule_types: REQUIRED_STYLE_RULE_TYPES,
    safety_rule: "style_registry_tracks_style_metadata_only_and_never_writes_style_files_executes_renderers_delivery_or_client_facing_output",
    human_review_rule: "style_profiles_and_template_bindings_remain_review_required_until_format_validation_and_human_approval",
    created_at: generatedAt,
  };
}

function buildStyleProfileRecords(generatedAt) {
  return STYLE_PROFILE_DEFINITIONS.map((definition) => {
    const recordBase = {
      schema_version: "style-profile-record.v1",
      style_profile_id: definition.style_profile_id,
      style_registry_id: "style-registry.current",
      style_profile_name: definition.style_profile_name,
      style_format: definition.style_format,
      voice_profile: definition.voice_profile,
      tone_profile: definition.tone_profile,
      brand_profile: definition.brand_profile,
      font_system: definition.font_system,
      layout_system: definition.layout_system,
      color_palette: definition.color_palette,
      spacing_system: definition.spacing_system,
      style_profile_status: "registered",
      human_review_required: true,
      format_validation_required: true,
      layout_validation_required: definition.style_format === "pptx" || definition.style_format === "docx",
      style_file_write_performed: false,
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

function buildStyleRuleRecords(styleProfileRecords, generatedAt) {
  const profileIds = styleProfileRecords.map((profile) => profile.style_profile_id);
  const formats = styleProfileRecords.map((profile) => profile.style_format);
  return REQUIRED_STYLE_RULE_TYPES.map((styleRuleType) => {
    const recordBase = {
      schema_version: "style-rule-record.v1",
      style_rule_id: `style-rule.${styleRuleType}`,
      style_registry_id: "style-registry.current",
      style_rule_type: styleRuleType,
      style_rule_name: styleRuleName(styleRuleType),
      style_rule_status: "registered",
      required_rule_type: true,
      applicable_style_profile_ids: profileIds,
      applicable_formats: formats,
      deterministic_rule_source: "phase_255_static_style_registry",
      rule_summary: styleRuleSummary(styleRuleType),
      human_review_required: true,
      format_validation_required: true,
      style_file_write_performed: false,
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

function buildTemplateStyleBindings(templateRegistry, styleProfileRecords, styleRuleRecords, generatedAt) {
  const profileByFormat = new Map(styleProfileRecords.map((profile) => [profile.style_format, profile]));
  const styleRuleTypes = styleRuleRecords.map((record) => record.style_rule_type);
  return (templateRegistry?.template_records ?? []).map((template) => {
    const profile = profileByFormat.get(template.template_format);
    const recordBase = {
      schema_version: "template-style-binding.v1",
      template_style_binding_id: `template-style-binding.${slug(template.template_id)}`,
      style_registry_id: "style-registry.current",
      template_id: template.template_id,
      template_path: template.template_path,
      template_family: template.template_family,
      template_format: template.template_format,
      style_format: profile?.style_format ?? template.template_format,
      pack_id: template.pack_id,
      template_version_id: template.latest_version_id,
      style_profile_id: profile?.style_profile_id ?? null,
      style_rule_types: styleRuleTypes,
      binding_status: profile ? "linked" : "missing_profile",
      template_metadata_hash: template.metadata_hash ?? null,
      style_profile_metadata_hash: profile?.metadata_hash ?? null,
      style_version_source: "style_registry_profile_by_template_format",
      human_review_required: true,
      format_validation_required: true,
      layout_validation_required: template.layout_validation_required === true || profile?.layout_validation_required === true,
      style_file_write_performed: false,
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
  }).sort((left, right) => left.template_id.localeCompare(right.template_id));
}

function buildStyleFormatCoverage(styleProfileRecords, templateStyleBindings, generatedAt) {
  return REQUIRED_FORMATS.map((styleFormat) => {
    const profiles = styleProfileRecords.filter((profile) => profile.style_format === styleFormat);
    const bindings = templateStyleBindings.filter((binding) => binding.style_format === styleFormat);
    return {
      schema_version: "style-format-coverage.v1",
      style_format: styleFormat,
      style_format_coverage_status: profiles.length > 0 && bindings.length > 0 ? "covered" : "missing",
      format_coverage_status: profiles.length > 0 && bindings.length > 0 ? "covered" : "missing",
      style_profile_count: profiles.length,
      style_profile_ids: profiles.map((profile) => profile.style_profile_id),
      template_style_binding_count: bindings.length,
      linked_template_style_binding_count: bindings.filter((binding) => binding.binding_status === "linked").length,
      style_rule_type_count: REQUIRED_STYLE_RULE_TYPES.length,
      generated_at: generatedAt,
    };
  });
}

function buildStyleRegistryBoundary({ generatedAt, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze }) {
  return {
    schema_version: "style-registry-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    metadata_registry_only: true,
    style_file_write_allowed: false,
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

function buildCheckpoints({ packageJson, roadmapText, sourceReads, templateRegistry, creativeDocumentPackManifest, domainPackRegistry, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, styleProfileRecords, styleRuleRecords, templateStyleBindings, styleFormatCoverage, boundary }) {
  const checkpoints = [];
  const styleRuleTypes = new Set(styleRuleRecords.map((record) => record.style_rule_type));
  checkpoints.push(checkpoint("source.template_registry", templateRegistry?.summary?.template_registry_status === "complete" && templateRegistry?.validation?.valid !== false, "Template registry is complete and valid."));
  checkpoints.push(checkpoint("source.creative_document_pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.domain_pack_registry", domainPackRegistry?.validation?.valid === true && (domainPackRegistry?.summary?.pack_count ?? 0) > 0, "Domain pack registry is valid and readable."));
  checkpoints.push(checkpoint("profiles.registered", styleProfileRecords.length === REQUIRED_FORMATS.length && styleProfileRecords.every((record) => record.style_profile_status === "registered" && record.metadata_hash?.startsWith("sha256:")), `${styleProfileRecords.length} style profile record(s) are registered with hashes.`));
  checkpoints.push(checkpoint("rules.covered", styleRuleRecords.length === REQUIRED_STYLE_RULE_TYPES.length && REQUIRED_STYLE_RULE_TYPES.every((ruleType) => styleRuleTypes.has(ruleType)) && styleRuleRecords.every((record) => record.style_rule_status === "registered" && record.metadata_hash?.startsWith("sha256:")), `${styleRuleTypes.size}/${REQUIRED_STYLE_RULE_TYPES.length} required style rule type(s) are registered.`));
  checkpoints.push(checkpoint("bindings.linked", templateStyleBindings.length === (templateRegistry?.template_records?.length ?? 0) && templateStyleBindings.length > 0 && templateStyleBindings.every((binding) => binding.binding_status === "linked" && binding.metadata_hash?.startsWith("sha256:")), `${templateStyleBindings.filter((binding) => binding.binding_status === "linked").length}/${templateStyleBindings.length} template style binding(s) are linked.`));
  checkpoints.push(checkpoint("formats.covered", styleFormatCoverage.length === REQUIRED_FORMATS.length && styleFormatCoverage.every((record) => record.style_format_coverage_status === "covered"), `${styleFormatCoverage.filter((record) => record.style_format_coverage_status === "covered").length}/${REQUIRED_FORMATS.length} required style format(s) are covered.`));
  checkpoints.push(checkpoint("gates.human_format", [...styleProfileRecords, ...styleRuleRecords, ...templateStyleBindings].every((record) => record.human_review_required === true && record.format_validation_required === true && record.client_facing_ready === false), "Every style profile, rule, and template binding remains human-review and format-validation gated."));
  checkpoints.push(checkpoint("runtime.boundary", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_runtime_execution_allowed === false, "Runtime freeze keeps Desktop execution disabled."));
  checkpoints.push(checkpoint("renderer.boundary", documentRendererAdapter?.summary?.document_renderer_adapter_status === "complete" && documentRendererAdapter?.summary?.desktop_read_only === true, "Document renderer adapter is available only as a read-only contract."));
  checkpoints.push(checkpoint("delivery.boundary", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && boundary.delivery_execution_allowed === false, "Output delivery contract is frozen while style registry delivery execution stays disabled."));
  checkpoints.push(checkpoint("boundary.read_only", boundary.boundary_status === "enforced" && boundary.read_only === true && boundary.style_file_write_allowed === false && boundary.renderer_execution_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false, "Style registry boundary is read-only and metadata-only."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:style-registry"]), "package.json registers creative-document:style-registry."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P255") && roadmapText.includes("style registry"), "Roadmap ledger keeps the P255 style registry slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All style registry source contracts were readable."));
  return checkpoints;
}

function summarizeStyleRegistry({ templateRegistry, creativeDocumentPackManifest, domainPackRegistry, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze, styleProfileRecords, styleRuleRecords, templateStyleBindings, styleFormatCoverage, boundary, validation }) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const profileByFormat = countBy(styleProfileRecords, "style_format");
  const bindingByFormat = countBy(templateStyleBindings, "style_format");
  const coveredStyleRuleTypeCount = new Set(styleRuleRecords.map((record) => record.style_rule_type)).size;
  const metadataHashCount = [...styleProfileRecords, ...styleRuleRecords, ...templateStyleBindings].filter((record) => record.metadata_hash?.startsWith("sha256:")).length;
  return {
    style_registry_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    style_registry_contract_id: CONTRACT_ID,
    source_template_registry_status: templateRegistry?.summary?.template_registry_status ?? "missing",
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_domain_pack_registry_status: domainPackRegistry?.validation?.valid === true ? "complete" : "blocked",
    style_profile_count: styleProfileRecords.length,
    registered_style_profile_count: styleProfileRecords.filter((record) => record.style_profile_status === "registered").length,
    style_rule_count: styleRuleRecords.length,
    registered_style_rule_count: styleRuleRecords.filter((record) => record.style_rule_status === "registered").length,
    required_style_rule_type_count: REQUIRED_STYLE_RULE_TYPES.length,
    covered_style_rule_type_count: coveredStyleRuleTypeCount,
    template_style_binding_count: templateStyleBindings.length,
    linked_template_style_binding_count: templateStyleBindings.filter((record) => record.binding_status === "linked").length,
    required_format_count: REQUIRED_FORMATS.length,
    covered_format_count: styleFormatCoverage.filter((record) => record.style_format_coverage_status === "covered").length,
    docx_style_profile_count: profileByFormat.docx ?? 0,
    pptx_style_profile_count: profileByFormat.pptx ?? 0,
    html_style_profile_count: profileByFormat.html ?? 0,
    email_style_profile_count: profileByFormat.email ?? 0,
    docx_template_style_binding_count: bindingByFormat.docx ?? 0,
    pptx_template_style_binding_count: bindingByFormat.pptx ?? 0,
    html_template_style_binding_count: bindingByFormat.html ?? 0,
    email_template_style_binding_count: bindingByFormat.email ?? 0,
    metadata_hash_count: metadataHashCount,
    human_review_required_rule_count: styleRuleRecords.filter((record) => record.human_review_required).length,
    format_validation_required_rule_count: styleRuleRecords.filter((record) => record.format_validation_required).length,
    human_review_required_binding_count: templateStyleBindings.filter((record) => record.human_review_required).length,
    format_validation_required_binding_count: templateStyleBindings.filter((record) => record.format_validation_required).length,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    read_only: boundary.read_only,
    metadata_registry_only: boundary.metadata_registry_only,
    style_file_write_allowed: boundary.style_file_write_allowed,
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
    style_registry_generated: true,
    metadata_registry_only: true,
    human_review_required: true,
    format_validation_required: true,
    renderer_execution_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    style_file_write_performed: false,
    core_registry_mutation_performed: false,
    client_facing_output_generated: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "style-registry-checkpoint.v1",
    checkpoint_id: `style-registry.${checkpointId}`,
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

function serializableStyleRegistry(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function renderStyleRegistryMarkdown(result) {
  const lines = [];
  lines.push("# Style Registry");
  lines.push("");
  lines.push(`Status: ${result.summary.style_registry_status}`);
  lines.push(`Style profiles: ${result.summary.style_profile_count}`);
  lines.push(`Style rules: ${result.summary.covered_style_rule_type_count}/${result.summary.required_style_rule_type_count}`);
  lines.push(`Template bindings: ${result.summary.linked_template_style_binding_count}/${result.summary.template_style_binding_count}`);
  lines.push(`Formats covered: ${result.summary.covered_format_count}/${result.summary.required_format_count}`);
  lines.push(`Read-only: ${result.summary.read_only}`);
  lines.push("");
  lines.push("## Format Coverage");
  for (const row of result.style_format_coverage) {
    lines.push(`- ${row.style_format}: ${row.style_format_coverage_status} (${row.template_style_binding_count})`);
  }
  lines.push("");
  lines.push("## Style Profiles");
  for (const record of result.style_profile_records) {
    lines.push(`- ${record.style_profile_id}: ${record.style_format} ${record.voice_profile}/${record.tone_profile} (${record.style_profile_status})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    template_registry_path: path.resolve(options.templateRegistryPath ?? DEFAULT_STYLE_REGISTRY_INPUTS.templateRegistryPath),
    creative_document_pack_manifest_path: path.resolve(options.creativeDocumentPackManifestPath ?? DEFAULT_STYLE_REGISTRY_INPUTS.creativeDocumentPackManifestPath),
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_STYLE_REGISTRY_INPUTS.domainPackRegistryPath),
    runtime_freeze_path: path.resolve(options.runtimeFreezePath ?? DEFAULT_STYLE_REGISTRY_INPUTS.runtimeFreezePath),
    document_renderer_adapter_path: path.resolve(options.documentRendererAdapterPath ?? DEFAULT_STYLE_REGISTRY_INPUTS.documentRendererAdapterPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_STYLE_REGISTRY_INPUTS.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_STYLE_REGISTRY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_STYLE_REGISTRY_INPUTS.roadmapPath),
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
  console.log(`Usage: node scripts/creative-document-style-registry.mjs [options]

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
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

function styleRuleName(styleRuleType) {
  return {
    voice: "Voice Profile Rule",
    tone: "Tone Review Rule",
    brand: "Brand System Rule",
    font: "Font System Rule",
    layout: "Layout System Rule",
  }[styleRuleType];
}

function styleRuleSummary(styleRuleType) {
  return {
    voice: "Registers the writing voice per output format without drafting prose.",
    tone: "Keeps all legal or client-facing tone choices behind review gates.",
    brand: "Maps neutral brand palettes and naming constraints as metadata only.",
    font: "Registers system-safe font families without writing style assets.",
    layout: "Maps responsive, print, email, and slide layout systems without rendering.",
  }[styleRuleType];
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
