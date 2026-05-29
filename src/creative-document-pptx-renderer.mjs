import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PPTX_RENDERER_OUT_DIR = "artifacts/pptx-renderer/latest";
export const DEFAULT_PPTX_RENDERER_INPUTS = {
  assetRegistryPath: "artifacts/asset-registry/latest/asset-registry.json",
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

const CONTRACT_ID = "pptx-renderer.v1";
const REQUIRED_BASE_OPENXML_PARTS = [
  "[Content_Types].xml",
  "_rels/.rels",
  "docProps/core.xml",
  "docProps/app.xml",
  "ppt/presentation.xml",
  "ppt/_rels/presentation.xml.rels",
  "ppt/theme/theme1.xml",
];
const MAX_SLIDES_PER_ARTIFACT = 6;
const MAX_TITLE_CHARS = 86;
const MAX_BULLETS_PER_SLIDE = 5;
const MAX_BULLET_CHARS = 150;
const HUMAN_REVIEW_NOTE = "Draft operational PPTX artifact for attorney review. Not legal advice, not client-facing, and not approved for delivery.";

export async function runPptxRenderer(options = {}) {
  const result = await buildPptxRenderer(options);
  if (options.write !== false) await writePptxRenderer(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`PPTX renderer validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPptxRenderer(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PPTX_RENDERER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const assetRegistry = sourceById.asset_registry;
  const styleRegistry = sourceById.style_registry;
  const templateRegistry = sourceById.template_registry;
  const creativeDocumentPackManifest = sourceById.creative_document_pack_manifest;
  const domainPackRegistry = sourceById.domain_pack_registry;
  const runtimeFreeze = sourceById.runtime_freeze;
  const documentRendererAdapter = sourceById.document_renderer_adapter;
  const outputDeliveryContractFreeze = sourceById.output_delivery_contract_freeze;

  const pptxTemplates = (templateRegistry?.template_records ?? [])
    .filter((template) => template.template_format === "pptx")
    .sort((left, right) => left.template_id.localeCompare(right.template_id));
  const pptxRenderJobs = buildPptxRenderJobs(pptxTemplates, styleRegistry, assetRegistry, outputDir, generatedAt);
  const pptxSlideTemplates = pptxRenderJobs.map((job) => buildSlideTemplate(job, generatedAt));
  const pptxSlideDecks = pptxRenderJobs.map((job) => buildSlideDeck(job, pptxSlideTemplates, generatedAt));
  const pptxOpenXmlParts = pptxSlideDecks.flatMap((deck) => buildOpenXmlParts(deck, generatedAt));
  const pptxOutputArtifacts = pptxRenderJobs.map((job) => buildOutputArtifact(job, pptxSlideDecks, pptxOpenXmlParts, generatedAt));
  const pptxOverflowChecks = pptxSlideDecks.map((deck) => buildOverflowCheck(deck, generatedAt));
  const pptxFormatValidationResults = pptxOutputArtifacts.map((artifact) => buildFormatValidationResult(artifact, pptxSlideDecks, pptxOpenXmlParts, pptxOverflowChecks, generatedAt));
  const boundary = buildPptxRendererBoundary({
    generatedAt,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
  });
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    assetRegistry,
    styleRegistry,
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    pptxTemplates,
    pptxRenderJobs,
    pptxSlideTemplates,
    pptxSlideDecks,
    pptxOpenXmlParts,
    pptxOutputArtifacts,
    pptxOverflowChecks,
    pptxFormatValidationResults,
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
  const summary = summarizePptxRenderer({
    assetRegistry,
    styleRegistry,
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    pptxTemplates,
    pptxRenderJobs,
    pptxSlideTemplates,
    pptxSlideDecks,
    pptxOpenXmlParts,
    pptxOutputArtifacts,
    pptxOverflowChecks,
    pptxFormatValidationResults,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    pptx_renderer_id: `pptx-renderer.${dateStamp(generatedAt)}`,
    pptx_renderer_status: summary.pptx_renderer_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    pptx_renderer_contract: buildContract(generatedAt),
    pptx_renderer_boundary: boundary,
    pptx_render_jobs: pptxRenderJobs,
    pptx_slide_templates: pptxSlideTemplates,
    pptx_slide_decks: pptxSlideDecks,
    pptx_openxml_parts: pptxOpenXmlParts,
    pptx_output_artifacts: pptxOutputArtifacts,
    pptx_overflow_checks: pptxOverflowChecks,
    pptx_format_validation_results: pptxFormatValidationResults,
    pptx_renderer_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderPptxRendererMarkdown(result),
  };
}

export async function writePptxRenderer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePptxRenderer(result);
  await writeJson(path.join(outDir, "pptx-renderer.json"), serializable);
  await writeJson(path.join(outDir, "pptx-render-jobs.json"), {
    schema_version: "pptx-render-jobs.v1",
    generated_at: result.generated_at,
    pptx_render_job_count: result.pptx_render_jobs.length,
    pptx_render_jobs: result.pptx_render_jobs,
  });
  await writeJson(path.join(outDir, "pptx-slide-templates.json"), {
    schema_version: "pptx-slide-templates.v1",
    generated_at: result.generated_at,
    pptx_slide_template_count: result.pptx_slide_templates.length,
    pptx_slide_templates: result.pptx_slide_templates,
  });
  await writeJson(path.join(outDir, "pptx-slide-decks.json"), {
    schema_version: "pptx-slide-decks.v1",
    generated_at: result.generated_at,
    pptx_slide_deck_count: result.pptx_slide_decks.length,
    pptx_slide_decks: result.pptx_slide_decks,
  });
  await writeJson(path.join(outDir, "pptx-openxml-parts.json"), {
    schema_version: "pptx-openxml-parts.v1",
    generated_at: result.generated_at,
    pptx_openxml_part_count: result.pptx_openxml_parts.length,
    pptx_openxml_parts: result.pptx_openxml_parts,
  });
  await writeJson(path.join(outDir, "pptx-output-artifacts.json"), {
    schema_version: "pptx-output-artifacts.v1",
    generated_at: result.generated_at,
    pptx_output_artifact_count: result.pptx_output_artifacts.length,
    pptx_output_artifacts: result.pptx_output_artifacts,
  });
  await writeJson(path.join(outDir, "pptx-overflow-checks.json"), {
    schema_version: "pptx-overflow-checks.v1",
    generated_at: result.generated_at,
    pptx_overflow_check_count: result.pptx_overflow_checks.length,
    pptx_overflow_checks: result.pptx_overflow_checks,
  });
  await writeJson(path.join(outDir, "pptx-format-validation-results.json"), {
    schema_version: "pptx-format-validation-results.v1",
    generated_at: result.generated_at,
    pptx_format_validation_result_count: result.pptx_format_validation_results.length,
    pptx_format_validation_results: result.pptx_format_validation_results,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "pptx-renderer-validation-report.v1",
    generated_at: result.generated_at,
    pptx_renderer_id: result.pptx_renderer_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  for (const artifact of result.pptx_output_artifacts) {
    const parts = result.pptx_openxml_parts.filter((part) => part.pptx_render_job_id === artifact.pptx_render_job_id);
    const files = parts.map((part) => ({ name: part.openxml_part_name, content: part.openxml_payload }));
    await writeFile(artifact.pptx_binary_path, buildZip(files));
  }
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPptxRendererCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPptxRenderer(args);
    console.log(`PPTX renderer ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.pptx_renderer_status}`);
    console.log(`PPTX templates: ${result.summary.pptx_template_count}`);
    console.log(`Render jobs: ${result.summary.completed_render_job_count}/${result.summary.pptx_render_job_count}`);
    console.log(`Slide decks: ${result.summary.pptx_slide_deck_count}`);
    console.log(`Overflow checks: ${result.summary.passed_overflow_check_count}/${result.summary.pptx_overflow_check_count}`);
    console.log(`Output artifacts: ${result.summary.draft_output_artifact_count}/${result.summary.pptx_output_artifact_count}`);
    console.log(`Format validations: ${result.summary.passed_format_validation_result_count}/${result.summary.pptx_format_validation_result_count}`);
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
    schema_version: "pptx-renderer-contract.v1",
    contract_id: CONTRACT_ID,
    renderer_scope: "creative_and_document_domain_pack_pptx",
    source_of_truth: "template_registry_style_registry_asset_registry_and_document_renderer_adapter",
    required_template_format: "pptx",
    required_base_openxml_parts: REQUIRED_BASE_OPENXML_PARTS,
    max_slides_per_artifact: MAX_SLIDES_PER_ARTIFACT,
    max_title_chars: MAX_TITLE_CHARS,
    max_bullets_per_slide: MAX_BULLETS_PER_SLIDE,
    max_bullet_chars: MAX_BULLET_CHARS,
    renderer_rule: "local_deterministic_openxml_renderer_generates_draft_pptx_artifacts_from_slide_templates_only",
    overflow_rule: "each_slide_title_bullet_and_deck_size_is_checked_before_the_pptx_output_artifact_is_marked_format_valid",
    safety_rule: "pptx_outputs_remain_draft_artifacts_pending_format_validation_human_review_and_attorney_approval_with_no_delivery_or_client_facing_release",
    human_review_rule: "every_pptx_output_artifact_contains_an_explicit_attorney_review_note_and_is_not_legal_advice",
    created_at: generatedAt,
  };
}

function buildPptxRenderJobs(pptxTemplates, styleRegistry, assetRegistry, outputDir, generatedAt) {
  const styleBindingByTemplateId = new Map((styleRegistry?.template_style_bindings ?? []).map((binding) => [binding.template_id, binding]));
  const assetBindingsByTemplateId = groupBy(assetRegistry?.template_asset_bindings ?? [], "template_id");
  return pptxTemplates.map((template, index) => {
    const styleBinding = styleBindingByTemplateId.get(template.template_id);
    const assetBindings = assetBindingsByTemplateId.get(template.template_id) ?? [];
    const recordBase = {
      schema_version: "pptx-render-job.v1",
      pptx_render_job_id: `pptx-render-job.${slug(template.template_id)}`,
      pptx_renderer_id: "pptx-renderer.current",
      render_job_status: "complete",
      pptx_render_job_status: "complete",
      renderer_mode: "local_deterministic_openxml",
      renderer_lane: "pptx_renderer",
      template_id: template.template_id,
      template_path: template.template_path,
      template_family: template.template_family,
      template_version_id: template.latest_version_id,
      template_format: template.template_format,
      pack_id: template.pack_id,
      matter_id: "matter.alpha.ldd",
      style_profile_id: styleBinding?.style_profile_id ?? "style-profile.creative-document.presentation-pptx",
      style_format: styleBinding?.style_format ?? "pptx",
      asset_binding_count: assetBindings.length,
      asset_binding_ids: assetBindings.map((binding) => binding.template_asset_binding_id),
      output_artifact_id: `pptx-output-artifact.${slug(template.template_id)}`,
      output_artifact_path: path.join(outputDir, `draft-${String(index + 1).padStart(2, "0")}-${slug(template.template_family)}.pptx`),
      slide_template_id: `pptx-slide-template.${slug(template.template_id)}`,
      slide_deck_id: `pptx-slide-deck.${slug(template.template_id)}`,
      renderer_execution_performed: true,
      local_deterministic_render_performed: true,
      document_renderer_runtime_execution_performed: false,
      external_renderer_execution_performed: false,
      network_access_performed: false,
      pptx_binary_write_performed: true,
      format_validation_required: true,
      overflow_check_required: true,
      human_review_required: true,
      attorney_review_required: true,
      source_attribution_required: true,
      citation_review_required: true,
      legal_advice_generated: false,
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

function buildSlideTemplate(job, generatedAt) {
  const recordBase = {
    schema_version: "pptx-slide-template.v1",
    pptx_slide_template_id: job.slide_template_id,
    pptx_render_job_id: job.pptx_render_job_id,
    template_id: job.template_id,
    template_family: job.template_family,
    template_format: job.template_format,
    slide_template_status: "generated",
    layout_family: inferLayoutFamily(job.template_family),
    slide_size: "16:9",
    placeholder_count: 4,
    placeholders: [
      { placeholder_id: "title", placeholder_type: "title", max_chars: MAX_TITLE_CHARS },
      { placeholder_id: "body", placeholder_type: "bullet_list", max_bullets: MAX_BULLETS_PER_SLIDE, max_chars_per_bullet: MAX_BULLET_CHARS },
      { placeholder_id: "footer", placeholder_type: "review_note", required_text: HUMAN_REVIEW_NOTE },
      { placeholder_id: "source", placeholder_type: "source_attribution", required: true },
    ],
    overflow_rule_set_id: "pptx-overflow-rules.v1",
    human_review_required: true,
    attorney_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    client_facing_ready: false,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...recordBase,
    metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
  };
}

function buildSlideDeck(job, slideTemplates, generatedAt) {
  const slideTemplate = slideTemplates.find((template) => template.pptx_slide_template_id === job.slide_template_id);
  const slides = [
    {
      slide_number: 1,
      layout_name: "review_gate_overview",
      title: titleFor(job, "Review gate"),
      bullets: [
        "Draft deck generated from registered PPTX template metadata.",
        "Attorney review, source attribution, citation review, and format validation remain required.",
        "No client-facing release or delivery action is enabled.",
      ],
      source_refs: ["template_registry", "style_registry", "asset_registry"],
    },
    {
      slide_number: 2,
      layout_name: "source_and_assets",
      title: titleFor(job, "Source controls"),
      bullets: [
        `${job.asset_binding_count} registered asset binding(s) remain metadata-only.`,
        "Slide content is derived from deterministic registry rows, not external services.",
        "Output artifact hash and OpenXML part hashes are captured for audit.",
      ],
      source_refs: ["asset_registry", "document_renderer_adapter"],
    },
    {
      slide_number: 3,
      layout_name: "delivery_boundary",
      title: titleFor(job, "Delivery boundary"),
      bullets: [
        "Document Renderer runtime execution is not invoked by this local workflow.",
        "Network access, protected action, and delivery execution stay blocked.",
        "The deck is a draft artifact only until human approval gates pass.",
      ],
      source_refs: ["runtime_freeze", "output_delivery_contract_freeze"],
    },
  ];
  const recordBase = {
    schema_version: "pptx-slide-deck.v1",
    pptx_slide_deck_id: job.slide_deck_id,
    pptx_render_job_id: job.pptx_render_job_id,
    pptx_slide_template_id: job.slide_template_id,
    template_id: job.template_id,
    template_family: job.template_family,
    template_format: job.template_format,
    slide_deck_status: "generated",
    title: `${job.template_family} draft deck`,
    slide_count: slides.length,
    slides,
    style_profile_id: job.style_profile_id,
    style_profile: {
      font_family: "Aptos",
      title_font_size: 32,
      body_font_size: 22,
      accent_color: "#0f766e",
      background_color: "#ffffff",
      layout_family: slideTemplate?.layout_family ?? "executive_review_deck",
    },
    human_review_note: HUMAN_REVIEW_NOTE,
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
    format_validation_required: true,
    overflow_check_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    deck_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...recordBase,
    deck_hash: `sha256:${hashJson({ ...recordBase, deck_hash: undefined })}`,
  };
}

function buildOpenXmlParts(deck, generatedAt) {
  const slideParts = deck.slides.map((slide) => part(deck, `ppt/slides/slide${slide.slide_number}.xml`, "application/vnd.openxmlformats-officedocument.presentationml.slide+xml", renderSlideXml(deck, slide), generatedAt));
  const slideRels = deck.slides.map((slide) => part(deck, `ppt/slides/_rels/slide${slide.slide_number}.xml.rels`, "application/vnd.openxmlformats-package.relationships+xml", renderEmptyRelationshipsXml(), generatedAt));
  return [
    part(deck, "[Content_Types].xml", "application/xml", renderContentTypesXml(deck), generatedAt),
    part(deck, "_rels/.rels", "application/vnd.openxmlformats-package.relationships+xml", renderPackageRelsXml(), generatedAt),
    part(deck, "docProps/core.xml", "application/vnd.openxmlformats-package.core-properties+xml", renderCorePropsXml(deck), generatedAt),
    part(deck, "docProps/app.xml", "application/vnd.openxmlformats-officedocument.extended-properties+xml", renderAppPropsXml(deck), generatedAt),
    part(deck, "ppt/presentation.xml", "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml", renderPresentationXml(deck), generatedAt),
    part(deck, "ppt/_rels/presentation.xml.rels", "application/vnd.openxmlformats-package.relationships+xml", renderPresentationRelsXml(deck), generatedAt),
    part(deck, "ppt/theme/theme1.xml", "application/vnd.openxmlformats-officedocument.theme+xml", renderThemeXml(deck), generatedAt),
    ...slideParts,
    ...slideRels,
  ];
}

function part(deck, partName, contentType, payload, generatedAt) {
  return {
    schema_version: "pptx-openxml-part.v1",
    pptx_openxml_part_id: `pptx-openxml-part.${slug(deck.pptx_slide_deck_id)}.${slug(partName)}`,
    pptx_render_job_id: deck.pptx_render_job_id,
    pptx_slide_deck_id: deck.pptx_slide_deck_id,
    openxml_part_name: partName,
    openxml_part_status: "generated",
    openxml_content_type: contentType,
    openxml_payload: payload,
    openxml_payload_size_bytes: Buffer.byteLength(payload, "utf8"),
    openxml_payload_hash: `sha256:${hashText(payload)}`,
    generated_at: generatedAt,
  };
}

function buildOutputArtifact(job, decks, parts, generatedAt) {
  const deck = decks.find((item) => item.pptx_render_job_id === job.pptx_render_job_id);
  const matchingParts = parts.filter((partRecord) => partRecord.pptx_render_job_id === job.pptx_render_job_id);
  const zipBytes = buildZip(matchingParts.map((partRecord) => ({ name: partRecord.openxml_part_name, content: partRecord.openxml_payload })));
  const artifactBase = {
    schema_version: "pptx-output-artifact.v1",
    pptx_output_artifact_id: job.output_artifact_id,
    pptx_render_job_id: job.pptx_render_job_id,
    pptx_slide_deck_id: deck?.pptx_slide_deck_id ?? null,
    artifact_kind: "pptx_draft_artifact",
    output_format: "pptx",
    output_artifact_status: "draft_generated",
    output_artifact_path: job.output_artifact_path,
    pptx_binary_path: job.output_artifact_path,
    pptx_binary_hash: `sha256:${hashBuffer(zipBytes)}`,
    pptx_binary_size_bytes: zipBytes.length,
    slide_count: deck?.slide_count ?? 0,
    openxml_part_count: matchingParts.length,
    openxml_part_hashes: matchingParts.map((partRecord) => partRecord.openxml_payload_hash),
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
    format_validation_required: true,
    overflow_check_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    pptx_binary_write_performed: true,
    generated_at: generatedAt,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
  };
  return {
    ...artifactBase,
    metadata_hash: `sha256:${hashJson({ ...artifactBase, metadata_hash: undefined })}`,
  };
}

function buildOverflowCheck(deck, generatedAt) {
  const checks = [
    validationCheck("slide_count_within_limit", deck.slide_count > 0 && deck.slide_count <= MAX_SLIDES_PER_ARTIFACT, `${deck.slide_count} slide(s) within ${MAX_SLIDES_PER_ARTIFACT} slide limit.`),
    validationCheck("titles_within_limit", deck.slides.every((slide) => slide.title.length <= MAX_TITLE_CHARS), "Slide titles fit the registered title placeholder."),
    validationCheck("bullet_count_within_limit", deck.slides.every((slide) => slide.bullets.length <= MAX_BULLETS_PER_SLIDE), "Slide bullet counts fit the registered body placeholder."),
    validationCheck("bullet_text_within_limit", deck.slides.every((slide) => slide.bullets.every((bullet) => bullet.length <= MAX_BULLET_CHARS)), "Slide bullet text fits the registered body placeholder."),
    validationCheck("review_note_present", deck.human_review_note === HUMAN_REVIEW_NOTE, "Human review note is carried with the deck manifest."),
  ];
  const failed = checks.filter((check) => !check.passed);
  return {
    schema_version: "pptx-overflow-check.v1",
    pptx_overflow_check_id: `pptx-overflow-check.${slug(deck.pptx_slide_deck_id)}`,
    pptx_render_job_id: deck.pptx_render_job_id,
    pptx_slide_deck_id: deck.pptx_slide_deck_id,
    overflow_check_status: failed.length === 0 ? "passed" : "failed",
    validation_status: failed.length === 0 ? "passed" : "failed",
    checked_slide_count: deck.slide_count,
    max_slides_per_artifact: MAX_SLIDES_PER_ARTIFACT,
    max_title_chars: MAX_TITLE_CHARS,
    max_bullets_per_slide: MAX_BULLETS_PER_SLIDE,
    max_bullet_chars: MAX_BULLET_CHARS,
    checks,
    failed_check_count: failed.length,
    generated_at: generatedAt,
  };
}

function buildFormatValidationResult(artifact, decks, parts, overflowChecks, generatedAt) {
  const deck = decks.find((item) => item.pptx_slide_deck_id === artifact.pptx_slide_deck_id);
  const matchingParts = parts.filter((partRecord) => partRecord.pptx_render_job_id === artifact.pptx_render_job_id);
  const partNames = new Set(matchingParts.map((partRecord) => partRecord.openxml_part_name));
  const pptxBytes = buildZip(matchingParts.map((partRecord) => ({ name: partRecord.openxml_part_name, content: partRecord.openxml_payload })));
  const overflowCheck = overflowChecks.find((check) => check.pptx_slide_deck_id === artifact.pptx_slide_deck_id);
  const checks = [
    validationCheck("zip_signature_present", pptxBytes.subarray(0, 2).equals(Buffer.from("PK")), "PPTX package starts with a ZIP signature."),
    validationCheck("required_base_openxml_parts_present", REQUIRED_BASE_OPENXML_PARTS.every((partName) => partNames.has(partName)), "Required base OpenXML parts are present."),
    validationCheck("all_slide_parts_present", (deck?.slides ?? []).every((slide) => partNames.has(`ppt/slides/slide${slide.slide_number}.xml`)), "Every deck slide has a slide OpenXML part."),
    validationCheck("human_review_note_present", matchingParts.some((partRecord) => partRecord.openxml_payload.includes(HUMAN_REVIEW_NOTE)), "Human review note is embedded in the slide payload."),
    validationCheck("overflow_check_passed", overflowCheck?.overflow_check_status === "passed" && overflowCheck.failed_check_count === 0, "Slide overflow check passed."),
    validationCheck("no_external_relationships", matchingParts.every((partRecord) => !partRecord.openxml_payload.includes("TargetMode=\"External\"")), "No external relationships are present."),
    validationCheck("draft_gate_preserved", artifact.human_review_required === true && artifact.attorney_review_required === true && artifact.client_facing_ready === false, "Draft gate and attorney review requirements are preserved."),
  ];
  const failed = checks.filter((check) => !check.passed);
  return {
    schema_version: "pptx-format-validation-result.v1",
    pptx_format_validation_result_id: `pptx-format-validation.${slug(artifact.pptx_output_artifact_id)}`,
    pptx_output_artifact_id: artifact.pptx_output_artifact_id,
    pptx_render_job_id: artifact.pptx_render_job_id,
    pptx_slide_deck_id: artifact.pptx_slide_deck_id,
    pptx_format_validation_status: failed.length === 0 ? "passed" : "failed",
    validation_status: failed.length === 0 ? "passed" : "failed",
    checks,
    failed_check_count: failed.length,
    checked_openxml_part_count: matchingParts.length,
    checked_slide_count: deck?.slide_count ?? 0,
    package_signature: pptxBytes.subarray(0, 2).toString("utf8"),
    generated_at: generatedAt,
  };
}

function validationCheck(checkId, passed, message) {
  return {
    check_id: checkId,
    status: passed ? "passed" : "failed",
    passed,
    message,
  };
}

function buildPptxRendererBoundary({ generatedAt, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze }) {
  return {
    schema_version: "pptx-renderer-boundary.v1",
    boundary_status: "enforced",
    read_only_sources: true,
    local_deterministic_renderer: true,
    renderer_execution_allowed: true,
    document_renderer_runtime_execution_allowed: false,
    external_renderer_execution_allowed: false,
    network_access_allowed: false,
    pptx_binary_write_allowed: true,
    pptx_binary_write_scope: "artifact_output_dir_only",
    core_registry_mutation_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    document_renderer_pptx_target_supported: documentRendererAdapter?.summary?.pptx_target_supported === true,
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    desktop_runtime_source_of_truth: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  sourceReads,
  assetRegistry,
  styleRegistry,
  templateRegistry,
  creativeDocumentPackManifest,
  domainPackRegistry,
  runtimeFreeze,
  documentRendererAdapter,
  outputDeliveryContractFreeze,
  pptxTemplates,
  pptxRenderJobs,
  pptxSlideTemplates,
  pptxSlideDecks,
  pptxOpenXmlParts,
  pptxOutputArtifacts,
  pptxOverflowChecks,
  pptxFormatValidationResults,
  boundary,
}) {
  const checkpoints = [];
  checkpoints.push(checkpoint("source.asset_registry", assetRegistry?.summary?.asset_registry_status === "complete" && assetRegistry?.validation?.valid !== false, "Asset registry is complete and valid."));
  checkpoints.push(checkpoint("source.style_registry", styleRegistry?.summary?.style_registry_status === "complete" && styleRegistry?.validation?.valid !== false, "Style registry is complete and valid."));
  checkpoints.push(checkpoint("source.template_registry", templateRegistry?.summary?.template_registry_status === "complete" && templateRegistry?.validation?.valid !== false, "Template registry is complete and valid."));
  checkpoints.push(checkpoint("source.creative_document_pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.domain_pack_registry", domainPackRegistry?.validation?.valid === true && (domainPackRegistry?.summary?.pack_count ?? 0) > 0, "Domain pack registry is valid and readable."));
  checkpoints.push(checkpoint("templates.pptx_found", pptxTemplates.length >= 1 && pptxTemplates.every((template) => template.template_format === "pptx" && template.human_review_required === true), `${pptxTemplates.length} PPTX template(s) are available and review-gated.`));
  checkpoints.push(checkpoint("render_jobs.complete", pptxRenderJobs.length === pptxTemplates.length && pptxRenderJobs.length > 0 && pptxRenderJobs.every((job) => job.pptx_render_job_status === "complete" && job.metadata_hash?.startsWith("sha256:")), `${pptxRenderJobs.filter((job) => job.pptx_render_job_status === "complete").length}/${pptxRenderJobs.length} PPTX render job(s) completed.`));
  checkpoints.push(checkpoint("slide_templates.generated", pptxSlideTemplates.length === pptxRenderJobs.length && pptxSlideTemplates.every((template) => template.slide_template_status === "generated" && template.metadata_hash?.startsWith("sha256:") && template.placeholder_count >= 4), `${pptxSlideTemplates.length} slide template(s) generated with overflow rules.`));
  checkpoints.push(checkpoint("slide_decks.generated", pptxSlideDecks.length === pptxRenderJobs.length && pptxSlideDecks.every((deck) => deck.slide_deck_status === "generated" && deck.deck_hash?.startsWith("sha256:") && deck.slide_count > 0 && deck.human_review_note === HUMAN_REVIEW_NOTE), `${pptxSlideDecks.length} slide deck(s) generated with review notes.`));
  checkpoints.push(checkpoint("openxml_parts.generated", pptxOpenXmlParts.length >= pptxRenderJobs.length * REQUIRED_BASE_OPENXML_PARTS.length && pptxOpenXmlParts.every((partRecord) => partRecord.openxml_part_status === "generated" && partRecord.openxml_payload_hash?.startsWith("sha256:")), `${pptxOpenXmlParts.length} OpenXML part(s) generated with hashes.`));
  checkpoints.push(checkpoint("overflow_checks.passed", pptxOverflowChecks.length === pptxSlideDecks.length && pptxOverflowChecks.every((check) => check.overflow_check_status === "passed" && check.failed_check_count === 0), `${pptxOverflowChecks.filter((check) => check.overflow_check_status === "passed").length}/${pptxOverflowChecks.length} PPTX overflow check(s) passed.`));
  checkpoints.push(checkpoint("output_artifacts.draft_generated", pptxOutputArtifacts.length === pptxRenderJobs.length && pptxOutputArtifacts.every((artifact) => artifact.output_artifact_status === "draft_generated" && artifact.output_format === "pptx" && artifact.pptx_binary_hash?.startsWith("sha256:") && artifact.pptx_binary_write_performed === true), `${pptxOutputArtifacts.length} draft PPTX artifact(s) generated.`));
  checkpoints.push(checkpoint("format_validation.passed", pptxFormatValidationResults.length === pptxOutputArtifacts.length && pptxFormatValidationResults.every((result) => result.pptx_format_validation_status === "passed" && result.failed_check_count === 0), `${pptxFormatValidationResults.filter((result) => result.pptx_format_validation_status === "passed").length}/${pptxFormatValidationResults.length} PPTX format validation result(s) passed.`));
  checkpoints.push(checkpoint("gates.human_attorney_review", pptxOutputArtifacts.every((artifact) => artifact.human_review_required === true && artifact.attorney_review_required === true && artifact.legal_advice_generated === false && artifact.client_facing_ready === false && artifact.client_facing_output_generated === false), "Every PPTX draft remains attorney-review gated and non-client-facing."));
  checkpoints.push(checkpoint("runtime.boundary", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_runtime_execution_allowed === false, "Runtime freeze keeps Desktop execution disabled."));
  checkpoints.push(checkpoint("renderer.adapter_pptx_supported", documentRendererAdapter?.summary?.document_renderer_adapter_status === "complete" && documentRendererAdapter?.summary?.pptx_target_supported === true && documentRendererAdapter?.summary?.direct_final_delivery_allowed === false, "Document renderer adapter supports PPTX while direct final delivery remains disabled."));
  checkpoints.push(checkpoint("delivery.boundary", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && boundary.delivery_execution_allowed === false, "Output delivery contract is frozen while PPTX renderer delivery execution stays disabled."));
  checkpoints.push(checkpoint("boundary.enforced", boundary.boundary_status === "enforced" && boundary.local_deterministic_renderer === true && boundary.pptx_binary_write_allowed === true && boundary.document_renderer_runtime_execution_allowed === false && boundary.external_renderer_execution_allowed === false && boundary.network_access_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "PPTX renderer boundary is deterministic, artifact-scoped, and delivery-blocked."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:pptx-renderer"]), "package.json registers creative-document:pptx-renderer."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P258") && roadmapText.includes("PPTX renderer"), "Roadmap ledger keeps the P258 PPTX renderer slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All PPTX renderer source contracts were readable."));
  return checkpoints;
}

function summarizePptxRenderer({
  assetRegistry,
  styleRegistry,
  templateRegistry,
  creativeDocumentPackManifest,
  domainPackRegistry,
  runtimeFreeze,
  documentRendererAdapter,
  outputDeliveryContractFreeze,
  pptxTemplates,
  pptxRenderJobs,
  pptxSlideTemplates,
  pptxSlideDecks,
  pptxOpenXmlParts,
  pptxOutputArtifacts,
  pptxOverflowChecks,
  pptxFormatValidationResults,
  boundary,
  validation,
}) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const outputHashCount = pptxOutputArtifacts.filter((artifact) => artifact.pptx_binary_hash?.startsWith("sha256:")).length;
  const openXmlHashCount = pptxOpenXmlParts.filter((partRecord) => partRecord.openxml_payload_hash?.startsWith("sha256:")).length;
  const metadataHashCount = [...pptxRenderJobs, ...pptxSlideTemplates, ...pptxOutputArtifacts].filter((record) => record.metadata_hash?.startsWith("sha256:")).length;
  const slideCount = pptxSlideDecks.reduce((sum, deck) => sum + (deck.slide_count ?? 0), 0);
  return {
    pptx_renderer_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    pptx_renderer_contract_id: CONTRACT_ID,
    source_asset_registry_status: assetRegistry?.summary?.asset_registry_status ?? "missing",
    source_style_registry_status: styleRegistry?.summary?.style_registry_status ?? "missing",
    source_template_registry_status: templateRegistry?.summary?.template_registry_status ?? "missing",
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_domain_pack_registry_status: domainPackRegistry?.validation?.valid === true ? "complete" : "blocked",
    pptx_template_count: pptxTemplates.length,
    pptx_render_job_count: pptxRenderJobs.length,
    completed_render_job_count: pptxRenderJobs.filter((job) => job.pptx_render_job_status === "complete").length,
    pptx_slide_template_count: pptxSlideTemplates.length,
    generated_slide_template_count: pptxSlideTemplates.filter((template) => template.slide_template_status === "generated").length,
    pptx_slide_deck_count: pptxSlideDecks.length,
    generated_slide_deck_count: pptxSlideDecks.filter((deck) => deck.slide_deck_status === "generated").length,
    total_slide_count: slideCount,
    max_slides_per_artifact: MAX_SLIDES_PER_ARTIFACT,
    pptx_openxml_part_count: pptxOpenXmlParts.length,
    generated_openxml_part_count: pptxOpenXmlParts.filter((partRecord) => partRecord.openxml_part_status === "generated").length,
    required_base_openxml_part_count_per_artifact: REQUIRED_BASE_OPENXML_PARTS.length,
    openxml_payload_hash_count: openXmlHashCount,
    pptx_output_artifact_count: pptxOutputArtifacts.length,
    draft_output_artifact_count: pptxOutputArtifacts.filter((artifact) => artifact.output_artifact_status === "draft_generated").length,
    pptx_binary_hash_count: outputHashCount,
    pptx_binary_write_count: pptxOutputArtifacts.filter((artifact) => artifact.pptx_binary_write_performed === true).length,
    pptx_overflow_check_count: pptxOverflowChecks.length,
    passed_overflow_check_count: pptxOverflowChecks.filter((check) => check.overflow_check_status === "passed").length,
    overflow_failed_check_count: pptxOverflowChecks.reduce((sum, check) => sum + (check.failed_check_count ?? 0), 0),
    pptx_format_validation_result_count: pptxFormatValidationResults.length,
    passed_format_validation_result_count: pptxFormatValidationResults.filter((result) => result.pptx_format_validation_status === "passed").length,
    human_review_required_output_count: pptxOutputArtifacts.filter((artifact) => artifact.human_review_required).length,
    attorney_review_required_output_count: pptxOutputArtifacts.filter((artifact) => artifact.attorney_review_required).length,
    source_attribution_required_output_count: pptxOutputArtifacts.filter((artifact) => artifact.source_attribution_required).length,
    citation_review_required_output_count: pptxOutputArtifacts.filter((artifact) => artifact.citation_review_required).length,
    format_validation_required_output_count: pptxOutputArtifacts.filter((artifact) => artifact.format_validation_required).length,
    local_deterministic_renderer: boundary.local_deterministic_renderer,
    renderer_execution_performed: pptxRenderJobs.some((job) => job.renderer_execution_performed),
    local_deterministic_render_performed: pptxRenderJobs.some((job) => job.local_deterministic_render_performed),
    document_renderer_runtime_execution_performed: pptxRenderJobs.some((job) => job.document_renderer_runtime_execution_performed),
    external_renderer_execution_performed: pptxRenderJobs.some((job) => job.external_renderer_execution_performed),
    network_access_performed: pptxRenderJobs.some((job) => job.network_access_performed),
    pptx_binary_write_performed: pptxOutputArtifacts.some((artifact) => artifact.pptx_binary_write_performed),
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    delivery_execution_performed: pptxOutputArtifacts.some((artifact) => artifact.delivery_execution_performed),
    protected_action_allowed: boundary.protected_action_allowed,
    protected_action_executed: pptxOutputArtifacts.some((artifact) => artifact.protected_action_executed),
    legal_advice_generated: pptxOutputArtifacts.some((artifact) => artifact.legal_advice_generated),
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: pptxOutputArtifacts.filter((artifact) => artifact.client_facing_ready).length,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    document_renderer_pptx_target_supported: documentRendererAdapter?.summary?.pptx_target_supported === true,
    output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    metadata_hash_count: metadataHashCount,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    pptx_renderer_generated: true,
    draft_artifact_only: true,
    slide_template_generated: true,
    slide_deck_generated: true,
    overflow_check_performed: true,
    local_deterministic_render_performed: true,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    pptx_binary_write_performed: true,
    pptx_binary_write_scope: "artifact_output_dir_only",
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    core_registry_mutation_performed: false,
    client_facing_output_generated: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "pptx-renderer-checkpoint.v1",
    checkpoint_id: `pptx-renderer.${checkpointId}`,
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
    schema_version: "pptx-renderer-source-contracts.v1",
    source_artifacts: Object.fromEntries(sourceReads.map((source) => [
      source.source_id,
      contractRef(source.source_id, source),
    ])),
    package_script_registered: Boolean(packageJson.value?.scripts?.["creative-document:pptx-renderer"]),
    roadmap_slot_present: typeof roadmapText.value === "string" && roadmapText.value.includes("P258") && roadmapText.value.includes("PPTX renderer"),
  };
}

async function readSourceArtifacts(inputs) {
  return Promise.all([
    sourceRead("asset_registry", inputs.asset_registry_path, readJsonOrError),
    sourceRead("style_registry", inputs.style_registry_path, readJsonOrError),
    sourceRead("template_registry", inputs.template_registry_path, readJsonOrError),
    sourceRead("creative_document_pack_manifest", inputs.creative_document_pack_manifest_path, readJsonOrError),
    sourceRead("domain_pack_registry", inputs.domain_pack_registry_path, readJsonOrError),
    sourceRead("runtime_freeze", inputs.runtime_freeze_path, readJsonOrError),
    sourceRead("document_renderer_adapter", inputs.document_renderer_adapter_path, readJsonOrError),
    sourceRead("output_delivery_contract_freeze", inputs.output_delivery_contract_freeze_path, readJsonOrError),
  ]);
}

async function sourceRead(sourceId, sourcePath, reader) {
  try {
    const result = await reader(sourcePath);
    return {
      source_id: sourceId,
      path: sourcePath,
      status: "read",
      content_hash: result.content_hash,
      value: result.value,
    };
  } catch (error) {
    return {
      source_id: sourceId,
      path: sourcePath,
      status: "missing",
      error: error.message,
      value: null,
    };
  }
}

function renderPptxRendererMarkdown(result) {
  const lines = [];
  lines.push("# PPTX Renderer");
  lines.push("");
  lines.push(`Status: ${result.summary.pptx_renderer_status}`);
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push("");
  lines.push(`PPTX templates: ${result.summary.pptx_template_count}`);
  lines.push(`Render jobs: ${result.summary.completed_render_job_count}/${result.summary.pptx_render_job_count}`);
  lines.push(`Slide templates: ${result.summary.generated_slide_template_count}/${result.summary.pptx_slide_template_count}`);
  lines.push(`Slide decks: ${result.summary.generated_slide_deck_count}/${result.summary.pptx_slide_deck_count}`);
  lines.push(`OpenXML parts: ${result.summary.generated_openxml_part_count}/${result.summary.pptx_openxml_part_count}`);
  lines.push(`Overflow checks: ${result.summary.passed_overflow_check_count}/${result.summary.pptx_overflow_check_count}`);
  lines.push(`Draft artifacts: ${result.summary.draft_output_artifact_count}/${result.summary.pptx_output_artifact_count}`);
  lines.push("");
  lines.push("## Output Artifacts");
  for (const artifact of result.pptx_output_artifacts) {
    lines.push(`- ${artifact.pptx_output_artifact_id}: ${artifact.output_artifact_status} (${artifact.output_artifact_path})`);
  }
  lines.push("");
  lines.push(HUMAN_REVIEW_NOTE);
  return `${lines.join("\n")}\n`;
}

function renderContentTypesXml(deck) {
  const slideOverrides = deck.slides
    .map((slide) => `  <Override PartName="/ppt/slides/slide${slide.slide_number}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
${slideOverrides}
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
</Types>`;
}

function renderPackageRelsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function renderCorePropsXml(deck) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(deck.title)}</dc:title>
  <dc:creator>Hermes Harness</dc:creator>
  <cp:lastModifiedBy>Hermes Harness</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">${deck.generated_at}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${deck.generated_at}</dcterms:modified>
</cp:coreProperties>`;
}

function renderAppPropsXml(deck) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Hermes Harness</Application>
  <PresentationFormat>On-screen Show (16:9)</PresentationFormat>
  <Slides>${deck.slide_count}</Slides>
</Properties>`;
}

function renderPresentationXml(deck) {
  const slideIds = deck.slides
    .map((slide) => `<p:sldId id="${255 + slide.slide_number}" r:id="rId${slide.slide_number}"/>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:sldIdLst>${slideIds}</p:sldIdLst>
  <p:sldSz cx="12192000" cy="6858000" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`;
}

function renderPresentationRelsXml(deck) {
  const slideRels = deck.slides
    .map((slide) => `  <Relationship Id="rId${slide.slide_number}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slide.slide_number}.xml"/>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${slideRels}
  <Relationship Id="rIdTheme" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;
}

function renderEmptyRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
}

function renderSlideXml(deck, slide) {
  const accent = colorToHex(deck.style_profile.accent_color);
  const bullets = slide.bullets.map((bullet, index) => `<a:p><a:pPr lvl="0"><a:buChar char="*"/></a:pPr><a:r><a:rPr lang="ko-KR" sz="2200"/><a:t>${escapeXml(bullet)}</a:t></a:r></a:p>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:bg><p:bgPr><a:solidFill><a:srgbClr val="${colorToHex(deck.style_profile.background_color)}"/></a:solidFill></p:bgPr></p:bg>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="548640" y="457200"/><a:ext cx="11094720" cy="914400"/></a:xfrm><a:solidFill><a:srgbClr val="${accent}"/></a:solidFill></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="ko-KR" sz="3200" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:rPr><a:t>${escapeXml(slide.title)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Body"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="822960" y="1645920"/><a:ext cx="10668000" cy="3840480"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${bullets}</p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="4" name="ReviewNote"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
        <p:spPr><a:xfrm><a:off x="822960" y="5943600"/><a:ext cx="10668000" cy="548640"/></a:xfrm></p:spPr>
        <p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="en-US" sz="1200"><a:solidFill><a:srgbClr val="64748B"/></a:solidFill></a:rPr><a:t>${escapeXml(HUMAN_REVIEW_NOTE)}</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

function renderThemeXml(deck) {
  const accent = colorToHex(deck.style_profile.accent_color);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Hermes">
  <a:themeElements>
    <a:clrScheme name="Hermes">
      <a:dk1><a:srgbClr val="17202A"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="334155"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2>
      <a:accent1><a:srgbClr val="${accent}"/></a:accent1>
      <a:accent2><a:srgbClr val="F59E0B"/></a:accent2>
      <a:accent3><a:srgbClr val="2563EB"/></a:accent3>
      <a:accent4><a:srgbClr val="16A34A"/></a:accent4>
      <a:accent5><a:srgbClr val="DC2626"/></a:accent5>
      <a:accent6><a:srgbClr val="7C3AED"/></a:accent6>
      <a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Hermes"><a:majorFont><a:latin typeface="Aptos Display"/></a:majorFont><a:minorFont><a:latin typeface="Aptos"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Hermes"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const data = Buffer.isBuffer(file.content) ? file.content : Buffer.from(String(file.content), "utf8");
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuffer, data);
    central.push({ nameBuffer, dataLength: data.length, crc, offset });
    offset += local.length + nameBuffer.length + data.length;
  }
  const centralStart = offset;
  for (const entry of central) {
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt16LE(0, 10);
    header.writeUInt16LE(0, 12);
    header.writeUInt16LE(0, 14);
    header.writeUInt32LE(entry.crc, 16);
    header.writeUInt32LE(entry.dataLength, 20);
    header.writeUInt32LE(entry.dataLength, 24);
    header.writeUInt16LE(entry.nameBuffer.length, 28);
    header.writeUInt16LE(0, 30);
    header.writeUInt16LE(0, 32);
    header.writeUInt16LE(0, 34);
    header.writeUInt16LE(0, 36);
    header.writeUInt32LE(0, 38);
    header.writeUInt32LE(entry.offset, 42);
    chunks.push(header, entry.nameBuffer);
    offset += header.length + entry.nameBuffer.length;
  }
  const centralSize = offset - centralStart;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(central.length, 8);
  end.writeUInt16LE(central.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);
  chunks.push(end);
  return Buffer.concat(chunks);
}

const CRC32_TABLE = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function serializablePptxRenderer(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    asset_registry_path: options.assetRegistryPath ?? DEFAULT_PPTX_RENDERER_INPUTS.assetRegistryPath,
    style_registry_path: options.styleRegistryPath ?? DEFAULT_PPTX_RENDERER_INPUTS.styleRegistryPath,
    template_registry_path: options.templateRegistryPath ?? DEFAULT_PPTX_RENDERER_INPUTS.templateRegistryPath,
    creative_document_pack_manifest_path: options.creativeDocumentPackManifestPath ?? DEFAULT_PPTX_RENDERER_INPUTS.creativeDocumentPackManifestPath,
    domain_pack_registry_path: options.domainPackRegistryPath ?? DEFAULT_PPTX_RENDERER_INPUTS.domainPackRegistryPath,
    runtime_freeze_path: options.runtimeFreezePath ?? DEFAULT_PPTX_RENDERER_INPUTS.runtimeFreezePath,
    document_renderer_adapter_path: options.documentRendererAdapterPath ?? DEFAULT_PPTX_RENDERER_INPUTS.documentRendererAdapterPath,
    output_delivery_contract_freeze_path: options.outputDeliveryContractFreezePath ?? DEFAULT_PPTX_RENDERER_INPUTS.outputDeliveryContractFreezePath,
    package_path: options.packagePath ?? DEFAULT_PPTX_RENDERER_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_PPTX_RENDERER_INPUTS.roadmapPath,
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_PPTX_RENDERER_OUT_DIR,
    write: true,
    check: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--asset-registry") parsed.assetRegistryPath = argv[++index];
    else if (arg === "--style-registry") parsed.styleRegistryPath = argv[++index];
    else if (arg === "--template-registry") parsed.templateRegistryPath = argv[++index];
    else if (arg === "--creative-document-pack-manifest") parsed.creativeDocumentPackManifestPath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--runtime-freeze") parsed.runtimeFreezePath = argv[++index];
    else if (arg === "--document-renderer-adapter") parsed.documentRendererAdapterPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-pptx-renderer.mjs [options]

Options:
  --check                                     Fail if validation does not pass.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
  --asset-registry <path>                     Asset registry artifact.
  --style-registry <path>                     Style registry artifact.
  --template-registry <path>                  Template registry artifact.
  --creative-document-pack-manifest <path>    Creative-document pack manifest artifact.
  --domain-pack-registry <path>               Domain pack registry artifact.
  --runtime-freeze <path>                     Runtime freeze artifact.
  --document-renderer-adapter <path>          Document renderer adapter artifact.
  --output-delivery-contract-freeze <path>    Output delivery contract freeze artifact.
  --package <path>                            package.json path.
  --roadmap <path>                            Roadmap ledger path.
  --run-at <iso>                              Deterministic timestamp.
  --help                                      Show this message.`);
}

async function readJsonOrError(filePath) {
  const text = await readFile(filePath, "utf8");
  return { value: JSON.parse(text), content_hash: `sha256:${hashText(text)}` };
}

async function readTextOrError(filePath) {
  const text = await readFile(filePath, "utf8");
  return { value: text, content_hash: `sha256:${hashText(text)}` };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function contractRef(label, result) {
  return {
    source_id: label,
    path: result.path,
    status: result.status,
    content_hash: result.content_hash ?? null,
    error: result.error ?? null,
  };
}

function inferLayoutFamily(templateFamily) {
  if (String(templateFamily).includes("style")) return "style_profile_reference_deck";
  if (String(templateFamily).includes("outline")) return "report_outline_deck";
  return "executive_review_deck";
}

function titleFor(job, suffix) {
  const cleanFamily = String(job.template_family ?? "pptx").replace(/_/g, " ");
  const title = `${cleanFamily} ${suffix}`;
  return title.length > MAX_TITLE_CHARS ? title.slice(0, MAX_TITLE_CHARS) : title;
}

function colorToHex(value) {
  const normalized = String(value ?? "#0f766e").replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : "0F766E";
}

function hashJson(value) {
  return hashText(stableStringify(value));
}

function hashText(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function hashBuffer(value) {
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
  for (const item of items ?? []) {
    const groupKey = item?.[key] ?? "";
    const group = groups.get(groupKey) ?? [];
    group.push(item);
    groups.set(groupKey, group);
  }
  return groups;
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function dateStamp(iso) {
  return iso.replace(/[-:.TZ]/g, "").slice(0, 14);
}
