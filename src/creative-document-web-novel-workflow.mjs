import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WEB_NOVEL_WORKFLOW_OUT_DIR = "artifacts/web-novel-workflow/latest";
export const DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS = {
  creativeDocumentBriefPath: "examples/creative-document-brief.json",
  creativeDocumentPackPath: "packs/creative-document/pack.json",
  creativeDocumentPackManifestPath: "artifacts/creative-document-pack-manifest/latest/creative-document-pack-manifest.json",
  templateRegistryPath: "artifacts/template-registry/latest/template-registry.json",
  styleRegistryPath: "artifacts/style-registry/latest/style-registry.json",
  designSystemProfilePath: "artifacts/design-system-profile/latest/design-system-profile.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "web-novel-workflow.v1";
const WORKFLOW_ID = "workflow.creative_document.content_script.v1";
const HUMAN_REVIEW_NOTE = "Draft web novel workflow artifact for human review. It is not legal advice, not client-facing, and not approved for delivery.";
const REQUIRED_OUTPUT_STAGES = ["synopsis", "style_guide", "chapter", "revision", "output_artifact"];

export async function runWebNovelWorkflow(options = {}) {
  const result = await buildWebNovelWorkflow(options);
  if (options.write !== false) await writeWebNovelWorkflow(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Web novel workflow validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWebNovelWorkflow(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WEB_NOVEL_WORKFLOW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const brief = normalizeBrief(sourceById.creative_document_brief);
  const creativeDocumentPack = sourceById.creative_document_pack;
  const creativeDocumentPackManifest = sourceById.creative_document_pack_manifest;
  const templateRegistry = sourceById.template_registry;
  const styleRegistry = sourceById.style_registry;
  const designSystemProfile = sourceById.design_system_profile;
  const outputDeliveryContractFreeze = sourceById.output_delivery_contract_freeze;

  const webNovelWorkflows = buildWorkflowRecords({ brief, creativeDocumentPack, generatedAt });
  const webNovelSynopses = buildSynopses({ brief, webNovelWorkflows, generatedAt });
  const webNovelStyleGuides = buildStyleGuides({ brief, styleRegistry, designSystemProfile, webNovelWorkflows, generatedAt });
  const webNovelChapters = buildChapters({ brief, webNovelSynopses, webNovelStyleGuides, generatedAt });
  const webNovelRevisionPackets = buildRevisionPackets({ webNovelChapters, webNovelStyleGuides, generatedAt });
  const manuscriptMarkdown = renderManuscript({ brief, webNovelSynopses, webNovelStyleGuides, webNovelChapters, webNovelRevisionPackets });
  const webNovelOutputArtifacts = buildOutputArtifacts({
    brief,
    webNovelWorkflows,
    webNovelChapters,
    webNovelRevisionPackets,
    manuscriptMarkdown,
    outputDir,
    generatedAt,
  });
  const boundary = buildWebNovelWorkflowBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    brief,
    creativeDocumentPack,
    creativeDocumentPackManifest,
    templateRegistry,
    styleRegistry,
    designSystemProfile,
    outputDeliveryContractFreeze,
    webNovelWorkflows,
    webNovelSynopses,
    webNovelStyleGuides,
    webNovelChapters,
    webNovelRevisionPackets,
    webNovelOutputArtifacts,
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
  const summary = summarizeWebNovelWorkflow({
    brief,
    creativeDocumentPackManifest,
    templateRegistry,
    styleRegistry,
    designSystemProfile,
    outputDeliveryContractFreeze,
    webNovelWorkflows,
    webNovelSynopses,
    webNovelStyleGuides,
    webNovelChapters,
    webNovelRevisionPackets,
    webNovelOutputArtifacts,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    web_novel_workflow_id: `web-novel-workflow.${dateStamp(generatedAt)}`,
    web_novel_workflow_status: summary.web_novel_workflow_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    web_novel_workflow_contract: buildContract(generatedAt),
    web_novel_workflow_boundary: boundary,
    web_novel_workflows: webNovelWorkflows,
    web_novel_synopses: webNovelSynopses,
    web_novel_style_guides: webNovelStyleGuides,
    web_novel_chapters: webNovelChapters,
    web_novel_revision_packets: webNovelRevisionPackets,
    web_novel_output_artifacts: webNovelOutputArtifacts,
    web_novel_workflow_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    manuscript_markdown: manuscriptMarkdown,
    markdown: renderWebNovelWorkflowMarkdown(result),
  };
}

export async function writeWebNovelWorkflow(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableWebNovelWorkflow(result);
  await writeJson(path.join(outDir, "web-novel-workflow.json"), serializable);
  await writeJson(path.join(outDir, "web-novel-workflows.json"), {
    schema_version: "web-novel-workflows.v1",
    generated_at: result.generated_at,
    web_novel_workflow_record_count: result.web_novel_workflows.length,
    web_novel_workflows: result.web_novel_workflows,
  });
  await writeJson(path.join(outDir, "web-novel-synopses.json"), {
    schema_version: "web-novel-synopses.v1",
    generated_at: result.generated_at,
    web_novel_synopsis_count: result.web_novel_synopses.length,
    web_novel_synopses: result.web_novel_synopses,
  });
  await writeJson(path.join(outDir, "web-novel-style-guides.json"), {
    schema_version: "web-novel-style-guides.v1",
    generated_at: result.generated_at,
    web_novel_style_guide_count: result.web_novel_style_guides.length,
    web_novel_style_guides: result.web_novel_style_guides,
  });
  await writeJson(path.join(outDir, "web-novel-chapters.json"), {
    schema_version: "web-novel-chapters.v1",
    generated_at: result.generated_at,
    web_novel_chapter_count: result.web_novel_chapters.length,
    web_novel_chapters: result.web_novel_chapters,
  });
  await writeJson(path.join(outDir, "web-novel-revision-packets.json"), {
    schema_version: "web-novel-revision-packets.v1",
    generated_at: result.generated_at,
    web_novel_revision_packet_count: result.web_novel_revision_packets.length,
    web_novel_revision_packets: result.web_novel_revision_packets,
  });
  await writeJson(path.join(outDir, "web-novel-output-artifacts.json"), {
    schema_version: "web-novel-output-artifacts.v1",
    generated_at: result.generated_at,
    web_novel_output_artifact_count: result.web_novel_output_artifacts.length,
    web_novel_output_artifacts: result.web_novel_output_artifacts,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "web-novel-workflow-validation-report.v1",
    generated_at: result.generated_at,
    web_novel_workflow_id: result.web_novel_workflow_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "web-novel-draft.md"), result.manuscript_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWebNovelWorkflowCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWebNovelWorkflow(args);
    console.log(`Web novel workflow ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.web_novel_workflow_status}`);
    console.log(`Synopses: ${result.summary.web_novel_synopsis_count}`);
    console.log(`Chapters: ${result.summary.web_novel_chapter_count}`);
    console.log(`Revision packets: ${result.summary.web_novel_revision_packet_count}`);
    console.log(`Output artifacts: ${result.summary.web_novel_output_artifact_count}`);
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
    schema_version: "web-novel-workflow-contract.v1",
    contract_id: CONTRACT_ID,
    workflow_scope: "creative_document_web_novel_generator",
    source_of_truth: "creative_document_brief_pack_template_style_design_system_and_output_delivery_freeze",
    required_output_stages: REQUIRED_OUTPUT_STAGES,
    safety_rule: "web_novel_workflow_generates_deterministic_draft_content_only_and_never_delivers_client_facing_outputs",
    review_rule: "synopsis_chapters_style_revisions_and_output_artifacts_remain_human_review_required",
    created_at: generatedAt,
  };
}

function buildWorkflowRecords({ brief, creativeDocumentPack, generatedAt }) {
  const recordBase = {
    schema_version: "web-novel-workflow-record.v1",
    web_novel_workflow_record_id: "web-novel-workflow-record.current",
    workflow_id: WORKFLOW_ID,
    workflow_name: "Creative Document Web Novel Workflow",
    workflow_status: "complete",
    web_novel_workflow_status: "complete",
    project_id: brief.project_id,
    title: `${brief.title} Web Novel Draft`,
    source_brief_schema_version: brief.schema_version,
    language: brief.language,
    audience: brief.audience,
    classification: brief.classification,
    domain_pack: creativeDocumentPack?.pack_id ?? "creative-document",
    output_stage_count: REQUIRED_OUTPUT_STAGES.length,
    output_stages: REQUIRED_OUTPUT_STAGES,
    deterministic_generation_performed: true,
    external_model_execution_performed: false,
    network_access_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    human_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return [{
    ...recordBase,
    metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
  }];
}

function buildSynopses({ brief, webNovelWorkflows, generatedAt }) {
  const recordBase = {
    schema_version: "web-novel-synopsis.v1",
    web_novel_synopsis_id: `web-novel-synopsis.${slug(brief.project_id)}`,
    web_novel_workflow_record_id: webNovelWorkflows[0]?.web_novel_workflow_record_id ?? null,
    synopsis_status: "draft_needs_review",
    project_id: brief.project_id,
    title: `${brief.title}: Control Plane Chronicle`,
    logline: `${brief.title} becomes a serialized operational story about keeping draft outputs behind review gates.`,
    premise: `${brief.sections.length} structured source section(s) are transformed into a safe internal web novel outline without using client-confidential source text.`,
    audience: brief.audience,
    classification: brief.classification,
    source_section_titles: brief.sections.map((section) => section.title),
    conflict_axis: "speed_of_generation_vs_review_gate_integrity",
    resolution_target: "draft_artifact_ready_for_human_review",
    human_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return [{
    ...recordBase,
    metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
  }];
}

function buildStyleGuides({ brief, styleRegistry, designSystemProfile, webNovelWorkflows, generatedAt }) {
  const pptxStyleProfile = (styleRegistry?.style_profile_records ?? []).find((profile) => profile.style_format === "pptx") ?? {};
  const designProfile = designSystemProfile?.design_system_profiles?.[0] ?? {};
  const recordBase = {
    schema_version: "web-novel-style-guide.v1",
    web_novel_style_guide_id: `web-novel-style-guide.${slug(brief.project_id)}`,
    web_novel_workflow_record_id: webNovelWorkflows[0]?.web_novel_workflow_record_id ?? null,
    style_guide_status: "draft_needs_review",
    language: brief.language,
    tone_profile: brief.style_profile?.tone ?? pptxStyleProfile.tone_profile ?? "calm_operational",
    voice_profile: pptxStyleProfile.voice_profile ?? "serialized_operational",
    brand_profile: pptxStyleProfile.brand_profile ?? "creative_document",
    pacing_rule: "short_scene_then_review_checkpoint",
    point_of_view: "third_person_limited",
    chapter_count_target: brief.sections.length,
    design_system_profile_id: designProfile.design_system_profile_id ?? null,
    style_constraints: [
      "No client-confidential source text.",
      "No legal advice or filing recommendation.",
      "Draft-only manuscript until human approval.",
      "Each chapter ends with a review gate cue.",
    ],
    human_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return [{
    ...recordBase,
    metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
  }];
}

function buildChapters({ brief, webNovelSynopses, webNovelStyleGuides, generatedAt }) {
  return brief.sections.map((section, index) => {
    const chapterNumber = index + 1;
    const chapterBase = {
      schema_version: "web-novel-chapter.v1",
      web_novel_chapter_id: `web-novel-chapter.${slug(brief.project_id)}.${pad(chapterNumber)}`,
      web_novel_synopsis_id: webNovelSynopses[0]?.web_novel_synopsis_id ?? null,
      web_novel_style_guide_id: webNovelStyleGuides[0]?.web_novel_style_guide_id ?? null,
      chapter_number: chapterNumber,
      chapter_status: "draft_needs_review",
      title: `Chapter ${chapterNumber}: ${section.title}`,
      source_section_title: section.title,
      scene_goal: section.bullets[0] ?? section.title,
      continuity_anchor: chapterNumber === 1 ? "control_plane_opens" : `chapter_${pad(chapterNumber - 1)}_review_gate`,
      beat_count: section.bullets.length,
      beats: section.bullets.map((bullet, bulletIndex) => ({
        beat_number: bulletIndex + 1,
        source_bullet: bullet,
        draft_beat: `Scene beat ${bulletIndex + 1} reframes the source point as internal creative-document progress.`,
      })),
      draft_excerpt: renderChapterExcerpt({ section, chapterNumber }),
      source_attribution_required: true,
      human_review_required: true,
      format_validation_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      metadata_hash: null,
      generated_at: generatedAt,
    };
    return {
      ...chapterBase,
      metadata_hash: `sha256:${hashJson({ ...chapterBase, metadata_hash: undefined })}`,
    };
  });
}

function buildRevisionPackets({ webNovelChapters, webNovelStyleGuides, generatedAt }) {
  return webNovelChapters.map((chapter) => {
    const recordBase = {
      schema_version: "web-novel-revision-packet.v1",
      web_novel_revision_packet_id: `web-novel-revision-packet.${slug(chapter.web_novel_chapter_id)}`,
      web_novel_chapter_id: chapter.web_novel_chapter_id,
      web_novel_style_guide_id: webNovelStyleGuides[0]?.web_novel_style_guide_id ?? null,
      revision_packet_status: "ready_for_human_review",
      revision_round: 1,
      revision_focus: [
        "continuity",
        "style_alignment",
        "source_attribution",
        "format_validation",
        "human_approval_gate",
      ],
      required_reviewer_actions: [
        "confirm_no_client_confidential_source_text",
        "confirm_no_legal_advice",
        "approve_or_request_rewrite_before_delivery",
      ],
      human_review_required: true,
      format_validation_required: true,
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

function buildOutputArtifacts({ brief, webNovelWorkflows, webNovelChapters, webNovelRevisionPackets, manuscriptMarkdown, outputDir, generatedAt }) {
  const artifactPath = path.join(outputDir, "web-novel-draft.md");
  const artifactBase = {
    schema_version: "web-novel-output-artifact.v1",
    web_novel_output_artifact_id: `web-novel-output-artifact.${slug(brief.project_id)}.markdown`,
    web_novel_workflow_record_id: webNovelWorkflows[0]?.web_novel_workflow_record_id ?? null,
    artifact_kind: "web_novel_markdown_draft",
    output_format: "markdown",
    output_artifact_status: "draft_generated_needs_review",
    output_artifact_path: artifactPath,
    content_hash: `sha256:${hashText(manuscriptMarkdown)}`,
    content_size_bytes: Buffer.byteLength(manuscriptMarkdown, "utf8"),
    chapter_count: webNovelChapters.length,
    revision_packet_count: webNovelRevisionPackets.length,
    source_attribution_required: true,
    human_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return [{
    ...artifactBase,
    metadata_hash: `sha256:${hashJson({ ...artifactBase, metadata_hash: undefined })}`,
  }];
}

function buildWebNovelWorkflowBoundary(generatedAt) {
  return {
    schema_version: "web-novel-workflow-boundary.v1",
    boundary_status: "enforced",
    draft_generation_only: true,
    deterministic_generation_only: true,
    external_model_execution_allowed: false,
    network_access_allowed: false,
    template_mutation_allowed: false,
    style_mutation_allowed: false,
    asset_mutation_allowed: false,
    document_runtime_mutation_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    format_validation_required: true,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ packageJson, roadmapText, sourceReads, brief, creativeDocumentPack, creativeDocumentPackManifest, templateRegistry, styleRegistry, designSystemProfile, outputDeliveryContractFreeze, webNovelWorkflows, webNovelSynopses, webNovelStyleGuides, webNovelChapters, webNovelRevisionPackets, webNovelOutputArtifacts, boundary }) {
  const checkpoints = [];
  checkpoints.push(checkpoint("source.brief", brief.schema_version === "creative-document-brief.v1" && brief.sections.length > 0, "Creative-document brief is readable and has sections."));
  checkpoints.push(checkpoint("source.pack", creativeDocumentPack?.pack_id === "creative-document" && (creativeDocumentPack.workflows ?? []).includes(WORKFLOW_ID), "Creative-document pack declares the content script workflow."));
  checkpoints.push(checkpoint("source.pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.template_registry", templateRegistry?.summary?.template_registry_status === "complete" && templateRegistry?.validation?.valid !== false, "Template registry is complete and valid."));
  checkpoints.push(checkpoint("source.style_registry", styleRegistry?.summary?.style_registry_status === "complete" && styleRegistry?.validation?.valid !== false, "Style registry is complete and valid."));
  checkpoints.push(checkpoint("source.design_system_profile", designSystemProfile?.summary?.design_system_profile_status === "complete" && designSystemProfile?.validation?.valid !== false, "Design system profile is complete and valid."));
  checkpoints.push(checkpoint("source.output_delivery_freeze", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && outputDeliveryContractFreeze?.validation?.valid !== false, "Output delivery freeze is complete and valid."));
  checkpoints.push(checkpoint("workflow.complete", webNovelWorkflows.length === 1 && webNovelWorkflows.every((record) => record.web_novel_workflow_status === "complete" && record.metadata_hash?.startsWith("sha256:")), "One web novel workflow record is complete."));
  checkpoints.push(checkpoint("synopsis.generated", webNovelSynopses.length === 1 && webNovelSynopses.every((record) => record.synopsis_status === "draft_needs_review" && record.metadata_hash?.startsWith("sha256:")), "One draft synopsis is generated."));
  checkpoints.push(checkpoint("style_guide.generated", webNovelStyleGuides.length === 1 && webNovelStyleGuides.every((record) => record.style_guide_status === "draft_needs_review" && record.metadata_hash?.startsWith("sha256:")), "One draft style guide is generated."));
  checkpoints.push(checkpoint("chapters.generated", webNovelChapters.length === brief.sections.length && webNovelChapters.length > 0 && webNovelChapters.every((record) => record.chapter_status === "draft_needs_review" && record.metadata_hash?.startsWith("sha256:")), `${webNovelChapters.length}/${brief.sections.length} draft chapter(s) are generated.`));
  checkpoints.push(checkpoint("revisions.ready", webNovelRevisionPackets.length === webNovelChapters.length && webNovelRevisionPackets.every((record) => record.revision_packet_status === "ready_for_human_review" && record.metadata_hash?.startsWith("sha256:")), `${webNovelRevisionPackets.length}/${webNovelChapters.length} revision packet(s) are ready.`));
  checkpoints.push(checkpoint("outputs.draft", webNovelOutputArtifacts.length === 1 && webNovelOutputArtifacts.every((record) => record.output_artifact_status === "draft_generated_needs_review" && record.output_format === "markdown" && record.metadata_hash?.startsWith("sha256:")), "One draft markdown output artifact is generated."));
  checkpoints.push(checkpoint("gates.human_format", [...webNovelWorkflows, ...webNovelSynopses, ...webNovelStyleGuides, ...webNovelChapters, ...webNovelRevisionPackets, ...webNovelOutputArtifacts].every((record) => record.human_review_required === true && record.format_validation_required === true && record.client_facing_ready === false), "Every workflow row remains human-review and format-validation gated."));
  checkpoints.push(checkpoint("boundary.draft_only", boundary.boundary_status === "enforced" && boundary.draft_generation_only === true && boundary.external_model_execution_allowed === false && boundary.network_access_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false && boundary.client_facing_ready_count === 0, "Web novel workflow boundary is draft-only with delivery and protected actions disabled."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:web-novel-workflow"]), "package.json registers creative-document:web-novel-workflow."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P264") && roadmapText.includes("web novel"), "Roadmap ledger keeps the P264 web novel workflow slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All web novel workflow source contracts were readable."));
  return checkpoints;
}

function summarizeWebNovelWorkflow({ brief, creativeDocumentPackManifest, templateRegistry, styleRegistry, designSystemProfile, outputDeliveryContractFreeze, webNovelWorkflows, webNovelSynopses, webNovelStyleGuides, webNovelChapters, webNovelRevisionPackets, webNovelOutputArtifacts, boundary, validation }) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const metadataHashCount = [...webNovelWorkflows, ...webNovelSynopses, ...webNovelStyleGuides, ...webNovelChapters, ...webNovelRevisionPackets, ...webNovelOutputArtifacts].filter((record) => record.metadata_hash?.startsWith("sha256:")).length;
  return {
    web_novel_workflow_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    web_novel_workflow_contract_id: CONTRACT_ID,
    source_brief_status: brief.schema_version === "creative-document-brief.v1" ? "complete" : "missing",
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_template_registry_status: templateRegistry?.summary?.template_registry_status ?? "missing",
    source_style_registry_status: styleRegistry?.summary?.style_registry_status ?? "missing",
    source_design_system_profile_status: designSystemProfile?.summary?.design_system_profile_status ?? "missing",
    source_output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    project_id: brief.project_id,
    language: brief.language,
    source_section_count: brief.sections.length,
    web_novel_workflow_record_count: webNovelWorkflows.length,
    complete_workflow_record_count: webNovelWorkflows.filter((record) => record.web_novel_workflow_status === "complete").length,
    web_novel_synopsis_count: webNovelSynopses.length,
    draft_synopsis_count: webNovelSynopses.filter((record) => record.synopsis_status === "draft_needs_review").length,
    web_novel_style_guide_count: webNovelStyleGuides.length,
    draft_style_guide_count: webNovelStyleGuides.filter((record) => record.style_guide_status === "draft_needs_review").length,
    web_novel_chapter_count: webNovelChapters.length,
    draft_chapter_count: webNovelChapters.filter((record) => record.chapter_status === "draft_needs_review").length,
    web_novel_revision_packet_count: webNovelRevisionPackets.length,
    ready_revision_packet_count: webNovelRevisionPackets.filter((record) => record.revision_packet_status === "ready_for_human_review").length,
    web_novel_output_artifact_count: webNovelOutputArtifacts.length,
    draft_output_artifact_count: webNovelOutputArtifacts.filter((record) => record.output_artifact_status === "draft_generated_needs_review").length,
    markdown_output_artifact_count: webNovelOutputArtifacts.filter((record) => record.output_format === "markdown").length,
    human_review_required_output_count: webNovelOutputArtifacts.filter((record) => record.human_review_required).length,
    format_validation_required_output_count: webNovelOutputArtifacts.filter((record) => record.format_validation_required).length,
    source_attribution_required_output_count: webNovelOutputArtifacts.filter((record) => record.source_attribution_required).length,
    revision_required_chapter_count: webNovelChapters.filter((chapter) => webNovelRevisionPackets.some((packet) => packet.web_novel_chapter_id === chapter.web_novel_chapter_id)).length,
    metadata_hash_count: metadataHashCount,
    draft_generation_only: boundary.draft_generation_only,
    deterministic_generation_performed: true,
    deterministic_generation_only: boundary.deterministic_generation_only,
    external_model_execution_performed: false,
    external_model_execution_allowed: boundary.external_model_execution_allowed,
    network_access_performed: false,
    network_access_allowed: boundary.network_access_allowed,
    template_mutation_allowed: boundary.template_mutation_allowed,
    style_mutation_allowed: boundary.style_mutation_allowed,
    asset_mutation_allowed: boundary.asset_mutation_allowed,
    document_runtime_mutation_allowed: boundary.document_runtime_mutation_allowed,
    renderer_execution_allowed: false,
    artifact_write_allowed: true,
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

function buildSafeHandling() {
  return {
    draft_only: true,
    web_novel_workflow_generated: true,
    deterministic_draft_generation: true,
    external_model_execution_performed: false,
    network_access_performed: false,
    template_mutation_performed: false,
    style_mutation_performed: false,
    asset_mutation_performed: false,
    document_runtime_mutation_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    source_attribution_required: true,
    format_validation_required: true,
    human_review_required: true,
    legal_advice_generated: false,
    client_facing_output_generated: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "web-novel-workflow-checkpoint.v1",
    checkpoint_id: `web-novel-workflow.${checkpointId}`,
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
    await sourceRead("creative_document_brief", inputs.creative_document_brief_path, readJsonOrError),
    await sourceRead("creative_document_pack", inputs.creative_document_pack_path, readJsonOrError),
    await sourceRead("creative_document_pack_manifest", inputs.creative_document_pack_manifest_path, readJsonOrError),
    await sourceRead("template_registry", inputs.template_registry_path, readJsonOrError),
    await sourceRead("style_registry", inputs.style_registry_path, readJsonOrError),
    await sourceRead("design_system_profile", inputs.design_system_profile_path, readJsonOrError),
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

function serializableWebNovelWorkflow(result) {
  const { markdown, manuscript_markdown: _manuscriptMarkdown, ...rest } = result;
  return rest;
}

function renderWebNovelWorkflowMarkdown(result) {
  const lines = [];
  lines.push("# Web Novel Workflow");
  lines.push("");
  lines.push(`Status: ${result.summary.web_novel_workflow_status}`);
  lines.push(`Synopses: ${result.summary.web_novel_synopsis_count}`);
  lines.push(`Style guides: ${result.summary.web_novel_style_guide_count}`);
  lines.push(`Chapters: ${result.summary.web_novel_chapter_count}`);
  lines.push(`Revision packets: ${result.summary.web_novel_revision_packet_count}`);
  lines.push(`Output artifacts: ${result.summary.web_novel_output_artifact_count}`);
  lines.push(`Draft-only: ${result.summary.draft_generation_only}`);
  lines.push("");
  lines.push("## Chapters");
  for (const chapter of result.web_novel_chapters) {
    lines.push(`- ${chapter.title}: ${chapter.chapter_status} (${chapter.beat_count} beat(s))`);
  }
  return `${lines.join("\n")}\n`;
}

function renderManuscript({ brief, webNovelSynopses, webNovelStyleGuides, webNovelChapters, webNovelRevisionPackets }) {
  const lines = [];
  lines.push(`# ${webNovelSynopses[0]?.title ?? brief.title}`);
  lines.push("");
  lines.push(`> ${HUMAN_REVIEW_NOTE}`);
  lines.push("");
  lines.push("## Synopsis");
  lines.push("");
  lines.push(webNovelSynopses[0]?.premise ?? "");
  lines.push("");
  lines.push("## Style Guide");
  lines.push("");
  lines.push(`- Language: ${webNovelStyleGuides[0]?.language ?? brief.language}`);
  lines.push(`- Tone: ${webNovelStyleGuides[0]?.tone_profile ?? "review_required"}`);
  lines.push(`- Point of view: ${webNovelStyleGuides[0]?.point_of_view ?? "third_person_limited"}`);
  lines.push("");
  for (const chapter of webNovelChapters) {
    lines.push(`## ${chapter.title}`);
    lines.push("");
    lines.push(chapter.draft_excerpt);
    lines.push("");
    lines.push(`Revision packet: ${webNovelRevisionPackets.find((packet) => packet.web_novel_chapter_id === chapter.web_novel_chapter_id)?.revision_packet_status ?? "missing"}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function renderChapterExcerpt({ section, chapterNumber }) {
  const sourceBullets = section.bullets.map((bullet) => `- ${bullet}`).join(" ");
  return `Chapter ${chapterNumber} opens with ${section.title}. The operator turns the source notes into a draft scene, keeps every output behind review, and records the source beats for later approval. Source beats: ${sourceBullets}`;
}

function normalizeBrief(raw) {
  const brief = raw && typeof raw === "object" ? raw : {};
  return {
    schema_version: brief.schema_version ?? "missing",
    project_id: brief.project_id ?? "creative-document-web-novel",
    title: brief.title ?? "Creative Document Draft",
    audience: brief.audience ?? "internal reviewer",
    classification: brief.classification ?? "P1_INTERNAL",
    language: brief.language ?? "en",
    style_profile: brief.style_profile ?? {},
    constraints: Array.isArray(brief.constraints) ? brief.constraints : [],
    sections: Array.isArray(brief.sections) ? brief.sections.map((section, index) => ({
      title: section.title ?? `Section ${index + 1}`,
      bullets: Array.isArray(section.bullets) && section.bullets.length > 0 ? section.bullets : [section.title ?? `Section ${index + 1}`],
    })) : [],
  };
}

function normalizeInputs(options) {
  return {
    creative_document_brief_path: path.resolve(options.creativeDocumentBriefPath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.creativeDocumentBriefPath),
    creative_document_pack_path: path.resolve(options.creativeDocumentPackPath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.creativeDocumentPackPath),
    creative_document_pack_manifest_path: path.resolve(options.creativeDocumentPackManifestPath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.creativeDocumentPackManifestPath),
    template_registry_path: path.resolve(options.templateRegistryPath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.templateRegistryPath),
    style_registry_path: path.resolve(options.styleRegistryPath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.styleRegistryPath),
    design_system_profile_path: path.resolve(options.designSystemProfilePath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.designSystemProfilePath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WEB_NOVEL_WORKFLOW_INPUTS.roadmapPath),
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
    else if (arg === "--creative-document-brief") parsed.creativeDocumentBriefPath = argv[++index];
    else if (arg === "--creative-document-pack") parsed.creativeDocumentPackPath = argv[++index];
    else if (arg === "--creative-document-pack-manifest") parsed.creativeDocumentPackManifestPath = argv[++index];
    else if (arg === "--template-registry") parsed.templateRegistryPath = argv[++index];
    else if (arg === "--style-registry") parsed.styleRegistryPath = argv[++index];
    else if (arg === "--design-system-profile") parsed.designSystemProfilePath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-web-novel-workflow.mjs [options]

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
  --creative-document-brief <path>            Creative document brief input path.
  --creative-document-pack <path>             Creative-document pack.json path.
  --creative-document-pack-manifest <path>    Creative-document pack manifest path.
  --template-registry <path>                  Template registry path.
  --style-registry <path>                     Style registry path.
  --design-system-profile <path>              Design system profile path.
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

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
