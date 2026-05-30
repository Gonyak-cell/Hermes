import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DESIGN_SYSTEM_PROFILE_OUT_DIR = "artifacts/design-system-profile/latest";
export const DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS = {
  templateRegistryPath: "artifacts/template-registry/latest/template-registry.json",
  styleRegistryPath: "artifacts/style-registry/latest/style-registry.json",
  assetRegistryPath: "artifacts/asset-registry/latest/asset-registry.json",
  pptxRendererPath: "artifacts/pptx-renderer/latest/pptx-renderer.json",
  versionComparatorPath: "artifacts/version-comparator/latest/version-comparator.json",
  pptxDesignSystemCapabilityPath: "packs/creative-document/capabilities/pptx-design-system.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "design-system-profile.v1";
const HUMAN_REVIEW_NOTE = "Design system profile artifact for attorney review. It is not legal advice, not client-facing, and not approved for delivery.";
const REQUIRED_DESIGN_RULE_TYPES = [
  "voice",
  "tone",
  "brand",
  "font",
  "layout",
  "color_palette",
  "spacing",
  "asset_treatment",
  "review_gate",
];

export async function runDesignSystemProfile(options = {}) {
  const result = await buildDesignSystemProfile(options);
  if (options.write !== false) await writeDesignSystemProfile(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Design system profile validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDesignSystemProfile(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DESIGN_SYSTEM_PROFILE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const templateRegistry = sourceById.template_registry;
  const styleRegistry = sourceById.style_registry;
  const assetRegistry = sourceById.asset_registry;
  const pptxRenderer = sourceById.pptx_renderer;
  const versionComparator = sourceById.version_comparator;
  const pptxDesignSystemCapability = sourceById.pptx_design_system_capability;

  const pptxTemplates = (templateRegistry?.template_records ?? [])
    .filter((template) => template.template_format === "pptx")
    .sort((left, right) => left.template_id.localeCompare(right.template_id));
  const pptxTemplateIds = new Set(pptxTemplates.map((template) => template.template_id));
  const pptxStyleProfiles = (styleRegistry?.style_profile_records ?? [])
    .filter((profile) => profile.style_format === "pptx")
    .sort((left, right) => left.style_profile_id.localeCompare(right.style_profile_id));
  const pptxTemplateStyleBindings = (styleRegistry?.template_style_bindings ?? [])
    .filter((binding) => pptxTemplateIds.has(binding.template_id))
    .sort((left, right) => left.template_id.localeCompare(right.template_id));
  const pptxAssetBindings = (assetRegistry?.template_asset_bindings ?? [])
    .filter((binding) => pptxTemplateIds.has(binding.template_id))
    .sort((left, right) => `${left.template_id}.${left.asset_type}`.localeCompare(`${right.template_id}.${right.asset_type}`));

  const lookups = buildLookups({
    pptxTemplates,
    pptxStyleProfiles,
    pptxTemplateStyleBindings,
    pptxAssetBindings,
    pptxRenderer,
    versionComparator,
  });
  const designSystemProfiles = buildDesignSystemProfiles({
    pptxStyleProfiles,
    pptxTemplates,
    pptxDesignSystemCapability,
    generatedAt,
  });
  const designSystemRules = buildDesignSystemRules(designSystemProfiles, pptxStyleProfiles, generatedAt);
  const templateDesignBindings = buildTemplateDesignBindings({
    pptxTemplates,
    designSystemProfiles,
    designSystemRules,
    lookups,
    generatedAt,
  });
  const assetDesignBindings = buildAssetDesignBindings({
    pptxAssetBindings,
    templateDesignBindings,
    designSystemRules,
    generatedAt,
  });
  const designReviewPackets = buildDesignReviewPackets({
    templateDesignBindings,
    assetDesignBindings,
    designSystemRules,
    generatedAt,
  });
  const boundary = buildDesignSystemProfileBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    templateRegistry,
    styleRegistry,
    assetRegistry,
    pptxRenderer,
    versionComparator,
    pptxDesignSystemCapability,
    pptxTemplates,
    pptxStyleProfiles,
    designSystemProfiles,
    designSystemRules,
    templateDesignBindings,
    assetDesignBindings,
    designReviewPackets,
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
  const summary = summarizeDesignSystemProfile({
    templateRegistry,
    styleRegistry,
    assetRegistry,
    pptxRenderer,
    versionComparator,
    pptxDesignSystemCapability,
    pptxTemplates,
    pptxStyleProfiles,
    designSystemProfiles,
    designSystemRules,
    templateDesignBindings,
    assetDesignBindings,
    designReviewPackets,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    design_system_profile_id: `design-system-profile.${dateStamp(generatedAt)}`,
    design_system_profile_status: summary.design_system_profile_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    design_system_profile_contract: buildContract(generatedAt),
    design_system_profile_boundary: boundary,
    design_system_profiles: designSystemProfiles,
    design_system_rules: designSystemRules,
    template_design_bindings: templateDesignBindings,
    asset_design_bindings: assetDesignBindings,
    design_review_packets: designReviewPackets,
    design_system_profile_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderDesignSystemProfileMarkdown(result),
  };
}

export async function writeDesignSystemProfile(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDesignSystemProfile(result);
  await writeJson(path.join(outDir, "design-system-profile.json"), serializable);
  await writeJson(path.join(outDir, "design-system-profiles.json"), {
    schema_version: "design-system-profiles.v1",
    generated_at: result.generated_at,
    design_system_profile_count: result.design_system_profiles.length,
    design_system_profiles: result.design_system_profiles,
  });
  await writeJson(path.join(outDir, "design-system-rules.json"), {
    schema_version: "design-system-rules.v1",
    generated_at: result.generated_at,
    design_system_rule_count: result.design_system_rules.length,
    design_system_rules: result.design_system_rules,
  });
  await writeJson(path.join(outDir, "template-design-bindings.json"), {
    schema_version: "template-design-bindings.v1",
    generated_at: result.generated_at,
    template_design_binding_count: result.template_design_bindings.length,
    template_design_bindings: result.template_design_bindings,
  });
  await writeJson(path.join(outDir, "asset-design-bindings.json"), {
    schema_version: "asset-design-bindings.v1",
    generated_at: result.generated_at,
    asset_design_binding_count: result.asset_design_bindings.length,
    asset_design_bindings: result.asset_design_bindings,
  });
  await writeJson(path.join(outDir, "design-review-packets.json"), {
    schema_version: "design-review-packets.v1",
    generated_at: result.generated_at,
    design_review_packet_count: result.design_review_packets.length,
    design_review_packets: result.design_review_packets,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "design-system-profile-validation-report.v1",
    generated_at: result.generated_at,
    design_system_profile_id: result.design_system_profile_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDesignSystemProfileCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDesignSystemProfile(args);
    console.log(`Design system profile ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.design_system_profile_status}`);
    console.log(`Profiles: ${result.summary.design_system_profile_count}`);
    console.log(`Rules: ${result.summary.design_system_rule_count}`);
    console.log(`Template bindings: ${result.summary.bound_template_design_binding_count}/${result.summary.template_design_binding_count}`);
    console.log(`Review packets: ${result.summary.ready_for_review_packet_count}/${result.summary.design_review_packet_count}`);
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
    schema_version: "design-system-profile-contract.v1",
    contract_id: CONTRACT_ID,
    profile_scope: "creative_document_pptx_report_material_design_rules",
    source_of_truth: "template_registry_style_registry_asset_registry_pptx_renderer_and_version_comparator",
    required_design_format: "pptx",
    required_design_rule_types: REQUIRED_DESIGN_RULE_TYPES,
    safety_rule: "design_system_profile_tracks_pptx_design_metadata_only_and_never_mutates_templates_styles_assets_or_delivery",
    human_review_rule: "all_design_profiles_bindings_and_packets_remain_attorney_review_required_until_human_approval",
    created_at: generatedAt,
  };
}

function buildDesignSystemProfiles({ pptxStyleProfiles, pptxTemplates, pptxDesignSystemCapability, generatedAt }) {
  return pptxStyleProfiles.map((styleProfile) => {
    const templateIds = pptxTemplates.map((template) => template.template_id);
    const recordBase = {
      schema_version: "design-system-profile-record.v1",
      design_system_profile_id: `design-system-profile.${slug(styleProfile.style_profile_id)}`,
      design_system_profile_status: "complete",
      design_system_format: "pptx",
      report_material_type: "presentation_report_material",
      capability_id: pptxDesignSystemCapability?.capability_id ?? null,
      style_profile_id: styleProfile.style_profile_id,
      style_profile_name: styleProfile.style_profile_name,
      voice_profile: styleProfile.voice_profile,
      tone_profile: styleProfile.tone_profile,
      brand_profile: styleProfile.brand_profile,
      font_system: styleProfile.font_system,
      layout_system: styleProfile.layout_system,
      color_palette: styleProfile.color_palette,
      spacing_system: styleProfile.spacing_system,
      template_count: templateIds.length,
      template_ids: templateIds,
      design_rule_types: REQUIRED_DESIGN_RULE_TYPES,
      human_review_required: true,
      attorney_review_required: true,
      format_validation_required: true,
      layout_validation_required: true,
      source_attribution_required: true,
      citation_review_required: true,
      template_mutation_performed: false,
      style_mutation_performed: false,
      asset_mutation_performed: false,
      renderer_execution_performed: false,
      delivery_execution_performed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      human_review_note: HUMAN_REVIEW_NOTE,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  });
}

function buildDesignSystemRules(designSystemProfiles, pptxStyleProfiles, generatedAt) {
  const styleById = new Map(pptxStyleProfiles.map((profile) => [profile.style_profile_id, profile]));
  return designSystemProfiles.flatMap((profile) => REQUIRED_DESIGN_RULE_TYPES.map((ruleType) => {
    const styleProfile = styleById.get(profile.style_profile_id) ?? {};
    const recordBase = {
      schema_version: "design-system-rule.v1",
      design_system_rule_id: `design-system-rule.${slug(profile.design_system_profile_id)}.${ruleType}`,
      design_system_profile_id: profile.design_system_profile_id,
      style_profile_id: profile.style_profile_id,
      design_system_format: "pptx",
      design_rule_type: ruleType,
      design_rule_name: designRuleName(ruleType),
      design_rule_status: "linked",
      deterministic_rule_source: "phase_263_design_system_profile",
      source_style_field: sourceStyleField(ruleType),
      rule_value: designRuleValue(ruleType, styleProfile),
      rule_summary: designRuleSummary(ruleType),
      human_review_required: true,
      attorney_review_required: true,
      format_validation_required: true,
      layout_validation_required: true,
      source_attribution_required: true,
      citation_review_required: true,
      template_mutation_performed: false,
      style_mutation_performed: false,
      asset_mutation_performed: false,
      renderer_execution_performed: false,
      delivery_execution_performed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  })).sort((left, right) => left.design_system_rule_id.localeCompare(right.design_system_rule_id));
}

function buildTemplateDesignBindings({ pptxTemplates, designSystemProfiles, designSystemRules, lookups, generatedAt }) {
  const defaultProfile = designSystemProfiles[0] ?? null;
  const ruleIds = designSystemRules.filter((rule) => rule.design_system_profile_id === defaultProfile?.design_system_profile_id).map((rule) => rule.design_system_rule_id);
  return pptxTemplates.map((template) => {
    const styleBinding = lookups.styleBindingByTemplateId.get(template.template_id);
    const renderJob = lookups.renderJobByTemplateId.get(template.template_id);
    const slideDeck = lookups.slideDeckByTemplateId.get(template.template_id);
    const outputArtifact = renderJob?.output_artifact_id ? lookups.outputArtifactById.get(renderJob.output_artifact_id) : null;
    const comparisonPacket = outputArtifact?.pptx_output_artifact_id ? lookups.comparisonPacketByArtifactId.get(outputArtifact.pptx_output_artifact_id) : null;
    const templateAssetBindings = lookups.assetBindingsByTemplateId.get(template.template_id) ?? [];
    const recordBase = {
      schema_version: "template-design-binding.v1",
      template_design_binding_id: `template-design-binding.${slug(template.template_id)}`,
      design_system_profile_id: defaultProfile?.design_system_profile_id ?? null,
      design_system_format: "pptx",
      template_id: template.template_id,
      template_path: template.template_path,
      template_family: template.template_family,
      template_format: template.template_format,
      template_version_id: template.latest_version_id,
      pack_id: template.pack_id,
      style_profile_id: styleBinding?.style_profile_id ?? renderJob?.style_profile_id ?? defaultProfile?.style_profile_id ?? null,
      template_style_binding_id: styleBinding?.template_style_binding_id ?? null,
      style_rule_types: styleBinding?.style_rule_types ?? [],
      design_rule_ids: ruleIds,
      asset_binding_count: templateAssetBindings.length,
      template_asset_binding_ids: templateAssetBindings.map((binding) => binding.template_asset_binding_id),
      pptx_render_job_id: renderJob?.pptx_render_job_id ?? null,
      pptx_render_job_status: renderJob?.pptx_render_job_status ?? renderJob?.render_job_status ?? "missing",
      pptx_slide_deck_id: slideDeck?.pptx_slide_deck_id ?? null,
      pptx_slide_deck_status: slideDeck?.slide_deck_status ?? "missing",
      slide_count: slideDeck?.slide_count ?? 0,
      pptx_output_artifact_id: outputArtifact?.pptx_output_artifact_id ?? null,
      comparison_packet_id: comparisonPacket?.comparison_packet_id ?? null,
      comparison_packet_status: comparisonPacket?.comparison_packet_status ?? "missing",
      design_binding_status: styleBinding && renderJob && slideDeck && comparisonPacket ? "bound_for_review" : "missing_source",
      source_attribution_required: true,
      citation_review_required: true,
      human_review_required: true,
      attorney_review_required: true,
      format_validation_required: true,
      layout_validation_required: true,
      template_mutation_performed: false,
      style_mutation_performed: false,
      asset_mutation_performed: false,
      renderer_execution_performed: false,
      delivery_execution_performed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      human_review_note: HUMAN_REVIEW_NOTE,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  }).sort((left, right) => left.template_id.localeCompare(right.template_id));
}

function buildAssetDesignBindings({ pptxAssetBindings, templateDesignBindings, designSystemRules, generatedAt }) {
  const templateDesignBindingByTemplateId = new Map(templateDesignBindings.map((binding) => [binding.template_id, binding]));
  const assetRuleIds = designSystemRules
    .filter((rule) => ["layout", "color_palette", "spacing", "asset_treatment", "review_gate"].includes(rule.design_rule_type))
    .map((rule) => rule.design_system_rule_id);
  return pptxAssetBindings.map((assetBinding) => {
    const templateDesignBinding = templateDesignBindingByTemplateId.get(assetBinding.template_id);
    const recordBase = {
      schema_version: "asset-design-binding.v1",
      asset_design_binding_id: `asset-design-binding.${slug(assetBinding.template_asset_binding_id)}`,
      template_design_binding_id: templateDesignBinding?.template_design_binding_id ?? null,
      design_system_profile_id: templateDesignBinding?.design_system_profile_id ?? null,
      design_system_format: "pptx",
      template_asset_binding_id: assetBinding.template_asset_binding_id,
      template_id: assetBinding.template_id,
      template_path: assetBinding.template_path,
      asset_id: assetBinding.asset_id,
      asset_type: assetBinding.asset_type,
      asset_family: assetBinding.asset_family,
      asset_artifact_policy_id: assetBinding.asset_artifact_policy_id,
      design_rule_ids: assetRuleIds,
      asset_design_binding_status: templateDesignBinding && assetBinding.binding_status === "linked" ? "linked_for_review" : "missing_source",
      source_attribution_required: assetBinding.source_attribution_required === true,
      license_review_required: assetBinding.license_review_required === true,
      accessibility_text_required: assetBinding.accessibility_text_required === true,
      human_review_required: true,
      attorney_review_required: true,
      format_validation_required: true,
      layout_validation_required: true,
      media_generation_performed: false,
      asset_file_ingestion_performed: false,
      asset_binary_write_performed: false,
      template_mutation_performed: false,
      style_mutation_performed: false,
      asset_mutation_performed: false,
      renderer_execution_performed: false,
      delivery_execution_performed: false,
      protected_action_executed: false,
      legal_advice_generated: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  }).sort((left, right) => `${left.template_id}.${left.asset_type}`.localeCompare(`${right.template_id}.${right.asset_type}`));
}

function buildDesignReviewPackets({ templateDesignBindings, assetDesignBindings, designSystemRules, generatedAt }) {
  const assetBindingsByTemplateId = groupBy(assetDesignBindings, "template_id");
  return templateDesignBindings.map((binding) => {
    const assetBindings = assetBindingsByTemplateId.get(binding.template_id) ?? [];
    const recordBase = {
      schema_version: "design-review-packet.v1",
      design_review_packet_id: `design-review-packet.${slug(binding.template_design_binding_id)}`,
      template_design_binding_id: binding.template_design_binding_id,
      design_system_profile_id: binding.design_system_profile_id,
      design_system_format: "pptx",
      template_id: binding.template_id,
      template_family: binding.template_family,
      style_profile_id: binding.style_profile_id,
      design_rule_count: binding.design_rule_ids.length,
      design_rule_ids: binding.design_rule_ids,
      asset_design_binding_count: assetBindings.length,
      asset_design_binding_ids: assetBindings.map((assetBinding) => assetBinding.asset_design_binding_id),
      pptx_render_job_id: binding.pptx_render_job_id,
      pptx_slide_deck_id: binding.pptx_slide_deck_id,
      comparison_packet_id: binding.comparison_packet_id,
      design_review_packet_status: binding.design_binding_status === "bound_for_review"
        && assetBindings.length > 0
        && assetBindings.every((assetBinding) => assetBinding.asset_design_binding_status === "linked_for_review")
        && designSystemRules.length >= REQUIRED_DESIGN_RULE_TYPES.length
        ? "ready_for_attorney_review"
        : "missing_source",
      review_focus: [
        "template_style_alignment",
        "slide_layout_rules",
        "asset_treatment_rules",
        "format_validation_gate",
        "human_approval_gate",
      ],
      source_attribution_required: true,
      citation_review_required: true,
      human_review_required: true,
      attorney_review_required: true,
      format_validation_required: true,
      layout_validation_required: true,
      legal_advice_generated: false,
      delivery_execution_performed: false,
      protected_action_executed: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      human_review_note: HUMAN_REVIEW_NOTE,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  }).sort((left, right) => left.template_id.localeCompare(right.template_id));
}

function buildDesignSystemProfileBoundary(generatedAt) {
  return {
    schema_version: "design-system-profile-boundary.v1",
    boundary_status: "enforced",
    read_only_sources: true,
    design_profile_metadata_only: true,
    design_system_profile_report_only: true,
    template_mutation_allowed: false,
    style_mutation_allowed: false,
    asset_mutation_allowed: false,
    document_runtime_mutation_allowed: false,
    renderer_execution_allowed: false,
    external_renderer_execution_allowed: false,
    network_access_allowed: false,
    artifact_write_allowed: true,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    attorney_review_required: true,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ packageJson, roadmapText, sourceReads, templateRegistry, styleRegistry, assetRegistry, pptxRenderer, versionComparator, pptxDesignSystemCapability, pptxTemplates, pptxStyleProfiles, designSystemProfiles, designSystemRules, templateDesignBindings, assetDesignBindings, designReviewPackets, boundary }) {
  const checkpoints = [];
  const ruleTypes = new Set(designSystemRules.map((record) => record.design_rule_type));
  checkpoints.push(checkpoint("source.template_registry", templateRegistry?.summary?.template_registry_status === "complete" && templateRegistry?.validation?.valid !== false, "Template registry is complete and valid."));
  checkpoints.push(checkpoint("source.style_registry", styleRegistry?.summary?.style_registry_status === "complete" && styleRegistry?.validation?.valid !== false, "Style registry is complete and valid."));
  checkpoints.push(checkpoint("source.asset_registry", assetRegistry?.summary?.asset_registry_status === "complete" && assetRegistry?.validation?.valid !== false, "Asset registry is complete and valid."));
  checkpoints.push(checkpoint("source.pptx_renderer", pptxRenderer?.summary?.pptx_renderer_status === "complete" && pptxRenderer?.validation?.valid !== false, "PPTX renderer is complete and valid."));
  checkpoints.push(checkpoint("source.version_comparator", versionComparator?.summary?.version_comparator_status === "complete" && versionComparator?.validation?.valid !== false, "Version comparator is complete and valid."));
  checkpoints.push(checkpoint("source.pptx_design_system_capability", pptxDesignSystemCapability?.capability_id === "creative_document.pptx.design_system", "PPTX design system capability manifest is readable."));
  checkpoints.push(checkpoint("profiles.pptx", designSystemProfiles.length === pptxStyleProfiles.length && designSystemProfiles.length > 0 && designSystemProfiles.every((record) => record.design_system_profile_status === "complete" && record.metadata_hash?.startsWith("sha256:")), `${designSystemProfiles.length}/${pptxStyleProfiles.length} PPTX design system profile(s) are complete.`));
  checkpoints.push(checkpoint("rules.linked", REQUIRED_DESIGN_RULE_TYPES.every((ruleType) => ruleTypes.has(ruleType)) && designSystemRules.every((record) => record.design_rule_status === "linked" && record.metadata_hash?.startsWith("sha256:")), `${ruleTypes.size}/${REQUIRED_DESIGN_RULE_TYPES.length} design rule type(s) are linked.`));
  checkpoints.push(checkpoint("bindings.templates", templateDesignBindings.length === pptxTemplates.length && templateDesignBindings.length > 0 && templateDesignBindings.every((record) => record.design_binding_status === "bound_for_review" && record.metadata_hash?.startsWith("sha256:")), `${templateDesignBindings.filter((record) => record.design_binding_status === "bound_for_review").length}/${templateDesignBindings.length} template design binding(s) are bound.`));
  checkpoints.push(checkpoint("bindings.assets", assetDesignBindings.length === pptxTemplates.length * 5 && assetDesignBindings.every((record) => record.asset_design_binding_status === "linked_for_review" && record.metadata_hash?.startsWith("sha256:")), `${assetDesignBindings.filter((record) => record.asset_design_binding_status === "linked_for_review").length}/${assetDesignBindings.length} asset design binding(s) are linked.`));
  checkpoints.push(checkpoint("review_packets.ready", designReviewPackets.length === templateDesignBindings.length && designReviewPackets.every((record) => record.design_review_packet_status === "ready_for_attorney_review" && record.metadata_hash?.startsWith("sha256:")), `${designReviewPackets.filter((record) => record.design_review_packet_status === "ready_for_attorney_review").length}/${designReviewPackets.length} design review packet(s) are ready.`));
  checkpoints.push(checkpoint("gates.human_format", [...designSystemProfiles, ...designSystemRules, ...templateDesignBindings, ...assetDesignBindings, ...designReviewPackets].every((record) => record.human_review_required === true && record.attorney_review_required === true && record.format_validation_required === true && record.client_facing_ready === false), "Every profile, rule, binding, and review packet remains attorney-review and format-validation gated."));
  checkpoints.push(checkpoint("boundary.read_only", boundary.boundary_status === "enforced" && boundary.read_only_sources === true && boundary.design_profile_metadata_only === true && boundary.template_mutation_allowed === false && boundary.style_mutation_allowed === false && boundary.asset_mutation_allowed === false && boundary.renderer_execution_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false, "Design system profile boundary is read-only and metadata-only."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:design-system-profile"]), "package.json registers creative-document:design-system-profile."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P263") && roadmapText.includes("design system profile"), "Roadmap ledger keeps the P263 design system profile slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All design system profile source contracts were readable."));
  return checkpoints;
}

function summarizeDesignSystemProfile({ templateRegistry, styleRegistry, assetRegistry, pptxRenderer, versionComparator, pptxDesignSystemCapability, pptxTemplates, pptxStyleProfiles, designSystemProfiles, designSystemRules, templateDesignBindings, assetDesignBindings, designReviewPackets, boundary, validation }) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const metadataHashCount = [...designSystemProfiles, ...designSystemRules, ...templateDesignBindings, ...assetDesignBindings, ...designReviewPackets].filter((record) => record.metadata_hash?.startsWith("sha256:")).length;
  return {
    design_system_profile_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    design_system_profile_contract_id: CONTRACT_ID,
    source_template_registry_status: templateRegistry?.summary?.template_registry_status ?? "missing",
    source_style_registry_status: styleRegistry?.summary?.style_registry_status ?? "missing",
    source_asset_registry_status: assetRegistry?.summary?.asset_registry_status ?? "missing",
    source_pptx_renderer_status: pptxRenderer?.summary?.pptx_renderer_status ?? "missing",
    source_version_comparator_status: versionComparator?.summary?.version_comparator_status ?? "missing",
    source_pptx_design_system_capability_id: pptxDesignSystemCapability?.capability_id ?? null,
    pptx_template_count: pptxTemplates.length,
    pptx_style_profile_count: pptxStyleProfiles.length,
    design_system_profile_count: designSystemProfiles.length,
    complete_design_system_profile_count: designSystemProfiles.filter((record) => record.design_system_profile_status === "complete").length,
    required_design_rule_type_count: REQUIRED_DESIGN_RULE_TYPES.length,
    design_system_rule_count: designSystemRules.length,
    linked_design_system_rule_count: designSystemRules.filter((record) => record.design_rule_status === "linked").length,
    covered_design_rule_type_count: new Set(designSystemRules.map((record) => record.design_rule_type)).size,
    template_design_binding_count: templateDesignBindings.length,
    bound_template_design_binding_count: templateDesignBindings.filter((record) => record.design_binding_status === "bound_for_review").length,
    asset_design_binding_count: assetDesignBindings.length,
    linked_asset_design_binding_count: assetDesignBindings.filter((record) => record.asset_design_binding_status === "linked_for_review").length,
    design_review_packet_count: designReviewPackets.length,
    ready_for_review_packet_count: designReviewPackets.filter((record) => record.design_review_packet_status === "ready_for_attorney_review").length,
    human_review_required_packet_count: designReviewPackets.filter((record) => record.human_review_required).length,
    attorney_review_required_packet_count: designReviewPackets.filter((record) => record.attorney_review_required).length,
    format_validation_required_packet_count: designReviewPackets.filter((record) => record.format_validation_required).length,
    layout_validation_required_packet_count: designReviewPackets.filter((record) => record.layout_validation_required).length,
    source_attribution_required_packet_count: designReviewPackets.filter((record) => record.source_attribution_required).length,
    citation_review_required_packet_count: designReviewPackets.filter((record) => record.citation_review_required).length,
    metadata_hash_count: metadataHashCount,
    design_profile_metadata_only: boundary.design_profile_metadata_only,
    design_system_profile_report_only: boundary.design_system_profile_report_only,
    template_mutation_allowed: boundary.template_mutation_allowed,
    style_mutation_allowed: boundary.style_mutation_allowed,
    asset_mutation_allowed: boundary.asset_mutation_allowed,
    document_runtime_mutation_allowed: boundary.document_runtime_mutation_allowed,
    renderer_execution_allowed: boundary.renderer_execution_allowed,
    external_renderer_execution_allowed: boundary.external_renderer_execution_allowed,
    network_access_allowed: boundary.network_access_allowed,
    artifact_write_allowed: boundary.artifact_write_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    delivery_execution_performed: false,
    protected_action_allowed: boundary.protected_action_allowed,
    protected_action_executed: false,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: boundary.client_facing_ready_count,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildLookups({ pptxTemplateStyleBindings, pptxAssetBindings, pptxRenderer, versionComparator }) {
  const styleBindingByTemplateId = new Map(pptxTemplateStyleBindings.map((binding) => [binding.template_id, binding]));
  const renderJobByTemplateId = new Map((pptxRenderer?.pptx_render_jobs ?? []).map((job) => [job.template_id, job]));
  const slideDeckByTemplateId = new Map((pptxRenderer?.pptx_slide_decks ?? []).map((deck) => [deck.template_id, deck]));
  const outputArtifactById = new Map((pptxRenderer?.pptx_output_artifacts ?? []).map((artifact) => [artifact.pptx_output_artifact_id, artifact]));
  const comparisonPacketByArtifactId = new Map((versionComparator?.comparison_packets ?? []).map((packet) => [packet.source_artifact_id, packet]));
  const assetBindingsByTemplateId = groupBy(pptxAssetBindings, "template_id");
  return {
    styleBindingByTemplateId,
    renderJobByTemplateId,
    slideDeckByTemplateId,
    outputArtifactById,
    comparisonPacketByArtifactId,
    assetBindingsByTemplateId,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    design_system_profile_generated: true,
    profile_metadata_only: true,
    read_only_source_binding: true,
    template_mutation_performed: false,
    style_mutation_performed: false,
    asset_mutation_performed: false,
    document_runtime_mutation_performed: false,
    renderer_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    artifact_write_performed: true,
    source_attribution_required: true,
    citation_review_required: true,
    format_validation_required: true,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    client_facing_output_generated: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "design-system-profile-checkpoint.v1",
    checkpoint_id: `design-system-profile.${checkpointId}`,
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
    await sourceRead("style_registry", inputs.style_registry_path, readJsonOrError),
    await sourceRead("asset_registry", inputs.asset_registry_path, readJsonOrError),
    await sourceRead("pptx_renderer", inputs.pptx_renderer_path, readJsonOrError),
    await sourceRead("version_comparator", inputs.version_comparator_path, readJsonOrError),
    await sourceRead("pptx_design_system_capability", inputs.pptx_design_system_capability_path, readJsonOrError),
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

function serializableDesignSystemProfile(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function renderDesignSystemProfileMarkdown(result) {
  const lines = [];
  lines.push("# Design System Profile");
  lines.push("");
  lines.push(`Status: ${result.summary.design_system_profile_status}`);
  lines.push(`PPTX templates: ${result.summary.pptx_template_count}`);
  lines.push(`Profiles: ${result.summary.design_system_profile_count}`);
  lines.push(`Rules: ${result.summary.linked_design_system_rule_count}/${result.summary.design_system_rule_count}`);
  lines.push(`Template bindings: ${result.summary.bound_template_design_binding_count}/${result.summary.template_design_binding_count}`);
  lines.push(`Asset bindings: ${result.summary.linked_asset_design_binding_count}/${result.summary.asset_design_binding_count}`);
  lines.push(`Review packets: ${result.summary.ready_for_review_packet_count}/${result.summary.design_review_packet_count}`);
  lines.push(`Report-only: ${result.summary.design_system_profile_report_only}`);
  lines.push("");
  lines.push("## Design Profiles");
  for (const profile of result.design_system_profiles) {
    lines.push(`- ${profile.design_system_profile_id}: ${profile.layout_system}/${profile.color_palette}/${profile.spacing_system} (${profile.design_system_profile_status})`);
  }
  lines.push("");
  lines.push("## Template Bindings");
  for (const binding of result.template_design_bindings) {
    lines.push(`- ${binding.template_id}: ${binding.design_binding_status}, ${binding.asset_binding_count} asset binding(s), ${binding.slide_count} slide(s)`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    template_registry_path: path.resolve(options.templateRegistryPath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.templateRegistryPath),
    style_registry_path: path.resolve(options.styleRegistryPath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.styleRegistryPath),
    asset_registry_path: path.resolve(options.assetRegistryPath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.assetRegistryPath),
    pptx_renderer_path: path.resolve(options.pptxRendererPath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.pptxRendererPath),
    version_comparator_path: path.resolve(options.versionComparatorPath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.versionComparatorPath),
    pptx_design_system_capability_path: path.resolve(options.pptxDesignSystemCapabilityPath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.pptxDesignSystemCapabilityPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_DESIGN_SYSTEM_PROFILE_INPUTS.roadmapPath),
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
    else if (arg === "--style-registry") parsed.styleRegistryPath = argv[++index];
    else if (arg === "--asset-registry") parsed.assetRegistryPath = argv[++index];
    else if (arg === "--pptx-renderer") parsed.pptxRendererPath = argv[++index];
    else if (arg === "--version-comparator") parsed.versionComparatorPath = argv[++index];
    else if (arg === "--pptx-design-system-capability") parsed.pptxDesignSystemCapabilityPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-design-system-profile.mjs [options]

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
  --template-registry <path>                  Template registry path.
  --style-registry <path>                     Style registry path.
  --asset-registry <path>                     Asset registry path.
  --pptx-renderer <path>                      PPTX renderer path.
  --version-comparator <path>                 Version comparator path.
  --pptx-design-system-capability <path>      PPTX design system capability manifest path.
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

function designRuleName(ruleType) {
  return {
    voice: "Voice Rule",
    tone: "Tone Rule",
    brand: "Brand Rule",
    font: "Font Rule",
    layout: "Slide Layout Rule",
    color_palette: "Color Palette Rule",
    spacing: "Slide Spacing Rule",
    asset_treatment: "Asset Treatment Rule",
    review_gate: "Review Gate Rule",
  }[ruleType];
}

function designRuleSummary(ruleType) {
  return {
    voice: "Binds the PPTX narrative voice to the style registry profile without drafting prose.",
    tone: "Keeps presentation tone behind human review and attorney approval gates.",
    brand: "Links brand metadata to the PPTX report material profile without writing style files.",
    font: "Records the presentation font system as metadata only.",
    layout: "Links slide-grid layout rules to templates, renderer outputs, and comparison packets.",
    color_palette: "Records color palette metadata for report materials without generating media.",
    spacing: "Records slide-safe spacing metadata for layout review.",
    asset_treatment: "Binds registered image, logo, table, graph, and video assets to review-only design handling.",
    review_gate: "Preserves source attribution, citation review, format validation, human review, and delivery blocks.",
  }[ruleType];
}

function sourceStyleField(ruleType) {
  return {
    voice: "voice_profile",
    tone: "tone_profile",
    brand: "brand_profile",
    font: "font_system",
    layout: "layout_system",
    color_palette: "color_palette",
    spacing: "spacing_system",
    asset_treatment: "asset_registry.template_asset_bindings",
    review_gate: "capability.required_gates.post_run",
  }[ruleType];
}

function designRuleValue(ruleType, styleProfile) {
  return {
    voice: styleProfile.voice_profile ?? "unknown",
    tone: styleProfile.tone_profile ?? "unknown",
    brand: styleProfile.brand_profile ?? "unknown",
    font: styleProfile.font_system ?? "unknown",
    layout: styleProfile.layout_system ?? "unknown",
    color_palette: styleProfile.color_palette ?? "unknown",
    spacing: styleProfile.spacing_system ?? "unknown",
    asset_treatment: "metadata_only_registered_assets_review_required",
    review_gate: "format_validation_and_human_approval_required_before_delivery",
  }[ruleType];
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

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const groupKey = item[key];
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  }
  return groups;
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
