import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_VIDEO_PPT_WORKFLOW_OUT_DIR = "artifacts/video-ppt-workflow/latest";
export const DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS = {
  creativeDocumentBriefPath: "examples/creative-document-brief.json",
  creativeDocumentPackManifestPath: "artifacts/creative-document-pack-manifest/latest/creative-document-pack-manifest.json",
  assetRegistryPath: "artifacts/asset-registry/latest/asset-registry.json",
  pptxRendererPath: "artifacts/pptx-renderer/latest/pptx-renderer.json",
  designSystemProfilePath: "artifacts/design-system-profile/latest/design-system-profile.json",
  webNovelWorkflowPath: "artifacts/web-novel-workflow/latest/web-novel-workflow.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "video-ppt-workflow.v1";
const WORKFLOW_ID = "workflow.creative_document.video_ppt_production.v1";
const HUMAN_REVIEW_NOTE = "Draft video/PPT production workflow artifact for human review. It is not legal advice, not client-facing, and not approved for delivery.";
const REQUIRED_OUTPUT_STAGES = ["script", "storyboard", "slide_deck", "approval_artifact"];

export async function runVideoPptWorkflow(options = {}) {
  const result = await buildVideoPptWorkflow(options);
  if (options.write !== false) await writeVideoPptWorkflow(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Video/PPT workflow validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildVideoPptWorkflow(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VIDEO_PPT_WORKFLOW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const brief = normalizeBrief(sourceById.creative_document_brief);
  const creativeDocumentPackManifest = sourceById.creative_document_pack_manifest;
  const assetRegistry = sourceById.asset_registry;
  const pptxRenderer = sourceById.pptx_renderer;
  const designSystemProfile = sourceById.design_system_profile;
  const webNovelWorkflow = sourceById.web_novel_workflow;
  const outputDeliveryContractFreeze = sourceById.output_delivery_contract_freeze;
  const videoAssets = (assetRegistry?.asset_records ?? []).filter((asset) => asset.asset_type === "video");
  const pptxSlideDecks = (pptxRenderer?.pptx_slide_decks ?? []).filter((deck) => deck.slide_deck_status === "generated");

  const videoPptWorkflows = buildWorkflowRecords({ brief, generatedAt });
  const videoPptScripts = buildScripts({ brief, webNovelWorkflow, videoPptWorkflows, generatedAt });
  const videoPptStoryboards = buildStoryboards({ videoPptScripts, videoAssets, generatedAt });
  const videoPptSlideDecks = buildSlideDecks({ brief, pptxSlideDecks, designSystemProfile, videoPptStoryboards, generatedAt });
  const videoPptApprovalArtifacts = buildApprovalArtifacts({ videoPptWorkflows, videoPptScripts, videoPptStoryboards, videoPptSlideDecks, generatedAt });
  const storyboardMarkdown = renderStoryboardMarkdown({ brief, videoPptScripts, videoPptStoryboards, videoPptSlideDecks, videoPptApprovalArtifacts });
  const slideDeckPlanJson = {
    schema_version: "video-ppt-slide-deck-plan.v1",
    generated_at: generatedAt,
    video_ppt_slide_deck_count: videoPptSlideDecks.length,
    video_ppt_slide_decks: videoPptSlideDecks,
  };
  const videoPptOutputArtifacts = buildOutputArtifacts({
    videoPptWorkflows,
    videoPptScripts,
    videoPptStoryboards,
    videoPptSlideDecks,
    storyboardMarkdown,
    slideDeckPlanJson,
    outputDir,
    generatedAt,
  });
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    brief,
    creativeDocumentPackManifest,
    assetRegistry,
    pptxRenderer,
    designSystemProfile,
    webNovelWorkflow,
    outputDeliveryContractFreeze,
    videoAssets,
    pptxSlideDecks,
    videoPptWorkflows,
    videoPptScripts,
    videoPptStoryboards,
    videoPptSlideDecks,
    videoPptApprovalArtifacts,
    videoPptOutputArtifacts,
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
  const summary = summarizeWorkflow({
    brief,
    creativeDocumentPackManifest,
    assetRegistry,
    pptxRenderer,
    designSystemProfile,
    webNovelWorkflow,
    outputDeliveryContractFreeze,
    videoAssets,
    pptxSlideDecks,
    videoPptWorkflows,
    videoPptScripts,
    videoPptStoryboards,
    videoPptSlideDecks,
    videoPptApprovalArtifacts,
    videoPptOutputArtifacts,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    video_ppt_workflow_id: `video-ppt-workflow.${dateStamp(generatedAt)}`,
    video_ppt_workflow_status: summary.video_ppt_workflow_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    video_ppt_workflow_contract: buildContract(generatedAt),
    video_ppt_workflow_boundary: boundary,
    video_ppt_workflows: videoPptWorkflows,
    video_ppt_scripts: videoPptScripts,
    video_ppt_storyboards: videoPptStoryboards,
    video_ppt_slide_decks: videoPptSlideDecks,
    video_ppt_approval_artifacts: videoPptApprovalArtifacts,
    video_ppt_output_artifacts: videoPptOutputArtifacts,
    video_ppt_workflow_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    storyboard_markdown: storyboardMarkdown,
    slide_deck_plan_json: slideDeckPlanJson,
    markdown: renderVideoPptWorkflowMarkdown(result),
  };
}

export async function writeVideoPptWorkflow(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableVideoPptWorkflow(result);
  await writeJson(path.join(outDir, "video-ppt-workflow.json"), serializable);
  await writeJson(path.join(outDir, "video-ppt-workflows.json"), {
    schema_version: "video-ppt-workflows.v1",
    generated_at: result.generated_at,
    video_ppt_workflow_record_count: result.video_ppt_workflows.length,
    video_ppt_workflows: result.video_ppt_workflows,
  });
  await writeJson(path.join(outDir, "video-ppt-scripts.json"), {
    schema_version: "video-ppt-scripts.v1",
    generated_at: result.generated_at,
    video_ppt_script_count: result.video_ppt_scripts.length,
    video_ppt_scripts: result.video_ppt_scripts,
  });
  await writeJson(path.join(outDir, "video-ppt-storyboards.json"), {
    schema_version: "video-ppt-storyboards.v1",
    generated_at: result.generated_at,
    video_ppt_storyboard_count: result.video_ppt_storyboards.length,
    video_ppt_storyboards: result.video_ppt_storyboards,
  });
  await writeJson(path.join(outDir, "video-ppt-slide-decks.json"), {
    schema_version: "video-ppt-slide-decks.v1",
    generated_at: result.generated_at,
    video_ppt_slide_deck_count: result.video_ppt_slide_decks.length,
    video_ppt_slide_decks: result.video_ppt_slide_decks,
  });
  await writeJson(path.join(outDir, "video-ppt-approval-artifacts.json"), {
    schema_version: "video-ppt-approval-artifacts.v1",
    generated_at: result.generated_at,
    video_ppt_approval_artifact_count: result.video_ppt_approval_artifacts.length,
    video_ppt_approval_artifacts: result.video_ppt_approval_artifacts,
  });
  await writeJson(path.join(outDir, "video-ppt-output-artifacts.json"), {
    schema_version: "video-ppt-output-artifacts.v1",
    generated_at: result.generated_at,
    video_ppt_output_artifact_count: result.video_ppt_output_artifacts.length,
    video_ppt_output_artifacts: result.video_ppt_output_artifacts,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "video-ppt-workflow-validation-report.v1",
    generated_at: result.generated_at,
    video_ppt_workflow_id: result.video_ppt_workflow_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "storyboard.md"), result.storyboard_markdown, "utf8");
  await writeJson(path.join(outDir, "slide-deck-plan.json"), result.slide_deck_plan_json);
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runVideoPptWorkflowCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runVideoPptWorkflow(args);
    console.log(`Video/PPT workflow ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.video_ppt_workflow_status}`);
    console.log(`Scripts: ${result.summary.video_ppt_script_count}`);
    console.log(`Storyboards: ${result.summary.video_ppt_storyboard_count}`);
    console.log(`Slide decks: ${result.summary.video_ppt_slide_deck_count}`);
    console.log(`Approval artifacts: ${result.summary.video_ppt_approval_artifact_count}`);
    console.log(`Output artifacts: ${result.summary.video_ppt_output_artifact_count}`);
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
    schema_version: "video-ppt-workflow-contract.v1",
    contract_id: CONTRACT_ID,
    workflow_scope: "creative_document_video_ppt_production",
    source_of_truth: "creative_document_brief_asset_registry_pptx_renderer_design_system_web_novel_and_output_delivery_freeze",
    required_output_stages: REQUIRED_OUTPUT_STAGES,
    safety_rule: "video_ppt_workflow_generates_deterministic_script_storyboard_slide_deck_plan_and_approval_artifact_only",
    review_rule: "script_storyboard_slide_deck_and_approval_artifact_remain_human_review_required_before_any_delivery",
    created_at: generatedAt,
  };
}

function buildWorkflowRecords({ brief, generatedAt }) {
  const recordBase = {
    schema_version: "video-ppt-workflow-record.v1",
    video_ppt_workflow_record_id: "video-ppt-workflow-record.current",
    workflow_id: WORKFLOW_ID,
    workflow_name: "Creative Document Video/PPT Production Workflow",
    workflow_status: "complete",
    video_ppt_workflow_status: "complete",
    project_id: brief.project_id,
    title: `${brief.title} Video/PPT Production Draft`,
    language: brief.language,
    audience: brief.audience,
    classification: brief.classification,
    output_stage_count: REQUIRED_OUTPUT_STAGES.length,
    output_stages: REQUIRED_OUTPUT_STAGES,
    deterministic_generation_performed: true,
    external_model_execution_performed: false,
    network_access_performed: false,
    media_generation_performed: false,
    renderer_execution_performed: false,
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

function buildScripts({ brief, webNovelWorkflow, videoPptWorkflows, generatedAt }) {
  const chapterByTitle = new Map((webNovelWorkflow?.web_novel_chapters ?? []).map((chapter) => [chapter.source_section_title, chapter]));
  return brief.sections.map((section, index) => {
    const sceneNumber = index + 1;
    const chapter = chapterByTitle.get(section.title);
    const recordBase = {
      schema_version: "video-ppt-script.v1",
      video_ppt_script_id: `video-ppt-script.${slug(brief.project_id)}.${pad(sceneNumber)}`,
      video_ppt_workflow_record_id: videoPptWorkflows[0]?.video_ppt_workflow_record_id ?? null,
      script_status: "draft_needs_review",
      scene_number: sceneNumber,
      source_section_title: section.title,
      source_chapter_id: chapter?.web_novel_chapter_id ?? null,
      voiceover_text: `Scene ${sceneNumber} introduces ${section.title} and keeps the production draft behind human review.`,
      narration_beats: section.bullets.map((bullet, bulletIndex) => ({
        beat_number: bulletIndex + 1,
        source_bullet: bullet,
        narration_line: `Narration beat ${bulletIndex + 1}: ${bullet}`,
      })),
      target_duration_seconds: Math.max(30, section.bullets.length * 18),
      source_attribution_required: true,
      caption_required: true,
      human_review_required: true,
      format_validation_required: true,
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
  });
}

function buildStoryboards({ videoPptScripts, videoAssets, generatedAt }) {
  const videoAsset = videoAssets[0] ?? {};
  return videoPptScripts.map((script) => {
    const recordBase = {
      schema_version: "video-ppt-storyboard.v1",
      video_ppt_storyboard_id: `video-ppt-storyboard.${slug(script.video_ppt_script_id)}`,
      video_ppt_script_id: script.video_ppt_script_id,
      storyboard_status: "draft_needs_review",
      scene_number: script.scene_number,
      source_section_title: script.source_section_title,
      frame_count: script.narration_beats.length,
      frames: script.narration_beats.map((beat) => ({
        frame_number: beat.beat_number,
        visual_direction: `Use registered metadata-only visual treatment for ${script.source_section_title}.`,
        narration_line: beat.narration_line,
        source_bullet: beat.source_bullet,
      })),
      video_asset_id: videoAsset.asset_id ?? null,
      video_asset_status: videoAsset.asset_status ?? "missing",
      caption_required: true,
      transcript_required: true,
      source_attribution_required: true,
      license_review_required: true,
      human_review_required: true,
      format_validation_required: true,
      media_generation_performed: false,
      asset_binary_write_performed: false,
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
  });
}

function buildSlideDecks({ brief, pptxSlideDecks, designSystemProfile, videoPptStoryboards, generatedAt }) {
  const sourceDeck = pptxSlideDecks[0] ?? {};
  const designProfile = designSystemProfile?.design_system_profiles?.[0] ?? {};
  const slides = brief.sections.map((section, index) => ({
    slide_number: index + 1,
    title: section.title,
    layout_name: "video_ppt_storyboard_slide",
    source_storyboard_id: videoPptStoryboards[index]?.video_ppt_storyboard_id ?? null,
    bullets: section.bullets.slice(0, 5),
    speaker_note: `Review script and storyboard for ${section.title} before any delivery.`,
  }));
  const recordBase = {
    schema_version: "video-ppt-slide-deck.v1",
    video_ppt_slide_deck_id: `video-ppt-slide-deck.${slug(brief.project_id)}`,
    slide_deck_status: "draft_needs_review",
    source_pptx_slide_deck_id: sourceDeck.pptx_slide_deck_id ?? null,
    source_pptx_slide_deck_status: sourceDeck.slide_deck_status ?? "missing",
    design_system_profile_id: designProfile.design_system_profile_id ?? null,
    title: `${brief.title} Video/PPT Draft Deck`,
    slide_count: slides.length,
    max_slide_count: 6,
    slides,
    human_review_note: HUMAN_REVIEW_NOTE,
    source_attribution_required: true,
    caption_required: true,
    human_review_required: true,
    format_validation_required: true,
    layout_validation_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    deck_hash: null,
    generated_at: generatedAt,
  };
  return [{
    ...recordBase,
    deck_hash: `sha256:${hashJson({ ...recordBase, deck_hash: undefined })}`,
  }];
}

function buildApprovalArtifacts({ videoPptWorkflows, videoPptScripts, videoPptStoryboards, videoPptSlideDecks, generatedAt }) {
  return videoPptSlideDecks.map((deck) => {
    const recordBase = {
      schema_version: "video-ppt-approval-artifact.v1",
      video_ppt_approval_artifact_id: `video-ppt-approval-artifact.${slug(deck.video_ppt_slide_deck_id)}`,
      video_ppt_workflow_record_id: videoPptWorkflows[0]?.video_ppt_workflow_record_id ?? null,
      video_ppt_slide_deck_id: deck.video_ppt_slide_deck_id,
      approval_artifact_status: "ready_for_human_review",
      script_count: videoPptScripts.length,
      storyboard_count: videoPptStoryboards.length,
      slide_count: deck.slide_count,
      required_reviewer_actions: [
        "confirm_script_source_attribution",
        "confirm_storyboard_caption_and_license_review",
        "confirm_slide_deck_layout_and_format_validation",
        "approve_or_request_revision_before_delivery",
      ],
      human_review_required: true,
      format_validation_required: true,
      layout_validation_required: true,
      source_attribution_required: true,
      license_review_required: true,
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
  });
}

function buildOutputArtifacts({ videoPptWorkflows, videoPptScripts, videoPptStoryboards, videoPptSlideDecks, storyboardMarkdown, slideDeckPlanJson, outputDir, generatedAt }) {
  const artifacts = [
    {
      artifact_kind: "video_ppt_storyboard_markdown_draft",
      output_format: "markdown",
      output_artifact_path: path.join(outputDir, "storyboard.md"),
      content_hash: `sha256:${hashText(storyboardMarkdown)}`,
      content_size_bytes: Buffer.byteLength(storyboardMarkdown, "utf8"),
    },
    {
      artifact_kind: "video_ppt_slide_deck_plan_json",
      output_format: "json",
      output_artifact_path: path.join(outputDir, "slide-deck-plan.json"),
      content_hash: `sha256:${hashJson(slideDeckPlanJson)}`,
      content_size_bytes: Buffer.byteLength(JSON.stringify(slideDeckPlanJson), "utf8"),
    },
  ];
  return artifacts.map((artifact, index) => {
    const recordBase = {
      schema_version: "video-ppt-output-artifact.v1",
      video_ppt_output_artifact_id: `video-ppt-output-artifact.${artifact.output_format}.${pad(index + 1)}`,
      video_ppt_workflow_record_id: videoPptWorkflows[0]?.video_ppt_workflow_record_id ?? null,
      output_artifact_status: "draft_generated_needs_review",
      script_count: videoPptScripts.length,
      storyboard_count: videoPptStoryboards.length,
      slide_deck_count: videoPptSlideDecks.length,
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
      ...artifact,
    };
    return {
      ...recordBase,
      metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
    };
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "video-ppt-workflow-boundary.v1",
    boundary_status: "enforced",
    draft_production_only: true,
    deterministic_generation_only: true,
    external_model_execution_allowed: false,
    network_access_allowed: false,
    media_generation_allowed: false,
    video_binary_generation_allowed: false,
    pptx_binary_generation_allowed: false,
    existing_pptx_artifact_reuse_allowed: true,
    template_mutation_allowed: false,
    style_mutation_allowed: false,
    asset_mutation_allowed: false,
    document_runtime_mutation_allowed: false,
    renderer_execution_allowed: false,
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

function buildCheckpoints({ packageJson, roadmapText, sourceReads, brief, creativeDocumentPackManifest, assetRegistry, pptxRenderer, designSystemProfile, webNovelWorkflow, outputDeliveryContractFreeze, videoAssets, pptxSlideDecks, videoPptWorkflows, videoPptScripts, videoPptStoryboards, videoPptSlideDecks, videoPptApprovalArtifacts, videoPptOutputArtifacts, boundary }) {
  const checkpoints = [];
  checkpoints.push(checkpoint("source.brief", brief.schema_version === "creative-document-brief.v1" && brief.sections.length > 0, "Creative-document brief is readable and has sections."));
  checkpoints.push(checkpoint("source.pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.asset_registry", assetRegistry?.summary?.asset_registry_status === "complete" && assetRegistry?.validation?.valid !== false && videoAssets.length >= 1, "Asset registry is complete and has a video asset."));
  checkpoints.push(checkpoint("source.pptx_renderer", pptxRenderer?.summary?.pptx_renderer_status === "complete" && pptxRenderer?.validation?.valid !== false && pptxSlideDecks.length >= 1, "PPTX renderer is complete and has generated slide decks."));
  checkpoints.push(checkpoint("source.design_system_profile", designSystemProfile?.summary?.design_system_profile_status === "complete" && designSystemProfile?.validation?.valid !== false, "Design system profile is complete and valid."));
  checkpoints.push(checkpoint("source.web_novel_workflow", webNovelWorkflow?.summary?.web_novel_workflow_status === "complete" && webNovelWorkflow?.validation?.valid !== false, "Web novel workflow is complete and valid."));
  checkpoints.push(checkpoint("source.output_delivery_freeze", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && outputDeliveryContractFreeze?.validation?.valid !== false, "Output delivery freeze is complete and valid."));
  checkpoints.push(checkpoint("workflow.complete", videoPptWorkflows.length === 1 && videoPptWorkflows.every((record) => record.video_ppt_workflow_status === "complete" && record.metadata_hash?.startsWith("sha256:")), "One video/PPT workflow record is complete."));
  checkpoints.push(checkpoint("scripts.generated", videoPptScripts.length === brief.sections.length && videoPptScripts.every((record) => record.script_status === "draft_needs_review" && record.metadata_hash?.startsWith("sha256:")), `${videoPptScripts.length}/${brief.sections.length} draft script row(s) are generated.`));
  checkpoints.push(checkpoint("storyboards.generated", videoPptStoryboards.length === videoPptScripts.length && videoPptStoryboards.every((record) => record.storyboard_status === "draft_needs_review" && record.caption_required === true && record.metadata_hash?.startsWith("sha256:")), `${videoPptStoryboards.length}/${videoPptScripts.length} storyboard row(s) are generated.`));
  checkpoints.push(checkpoint("slide_decks.generated", videoPptSlideDecks.length === 1 && videoPptSlideDecks.every((record) => record.slide_deck_status === "draft_needs_review" && record.slide_count === brief.sections.length && record.deck_hash?.startsWith("sha256:")), "One draft slide deck plan is generated."));
  checkpoints.push(checkpoint("approvals.ready", videoPptApprovalArtifacts.length === videoPptSlideDecks.length && videoPptApprovalArtifacts.every((record) => record.approval_artifact_status === "ready_for_human_review" && record.metadata_hash?.startsWith("sha256:")), `${videoPptApprovalArtifacts.length}/${videoPptSlideDecks.length} approval artifact(s) are ready.`));
  checkpoints.push(checkpoint("outputs.draft", videoPptOutputArtifacts.length === 2 && videoPptOutputArtifacts.every((record) => record.output_artifact_status === "draft_generated_needs_review" && record.metadata_hash?.startsWith("sha256:")), "Storyboard markdown and slide deck plan artifacts are generated."));
  checkpoints.push(checkpoint("gates.human_format", [...videoPptWorkflows, ...videoPptScripts, ...videoPptStoryboards, ...videoPptSlideDecks, ...videoPptApprovalArtifacts, ...videoPptOutputArtifacts].every((record) => record.human_review_required === true && record.format_validation_required === true && record.client_facing_ready === false), "Every video/PPT row remains human-review and format-validation gated."));
  checkpoints.push(checkpoint("boundary.draft_only", boundary.boundary_status === "enforced" && boundary.draft_production_only === true && boundary.external_model_execution_allowed === false && boundary.network_access_allowed === false && boundary.media_generation_allowed === false && boundary.renderer_execution_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false && boundary.client_facing_ready_count === 0, "Video/PPT workflow boundary is draft-only with media generation, rendering, delivery, and protected actions disabled."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:video-ppt-workflow"]), "package.json registers creative-document:video-ppt-workflow."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P265") && roadmapText.includes("video/PPT"), "Roadmap ledger keeps the P265 video/PPT workflow slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All video/PPT workflow source contracts were readable."));
  return checkpoints;
}

function summarizeWorkflow({ brief, creativeDocumentPackManifest, assetRegistry, pptxRenderer, designSystemProfile, webNovelWorkflow, outputDeliveryContractFreeze, videoAssets, pptxSlideDecks, videoPptWorkflows, videoPptScripts, videoPptStoryboards, videoPptSlideDecks, videoPptApprovalArtifacts, videoPptOutputArtifacts, boundary, validation }) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const metadataHashCount = [...videoPptWorkflows, ...videoPptScripts, ...videoPptStoryboards, ...videoPptSlideDecks, ...videoPptApprovalArtifacts, ...videoPptOutputArtifacts].filter((record) => (record.metadata_hash ?? record.deck_hash)?.startsWith("sha256:")).length;
  return {
    video_ppt_workflow_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    video_ppt_workflow_contract_id: CONTRACT_ID,
    source_brief_status: brief.schema_version === "creative-document-brief.v1" ? "complete" : "missing",
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_asset_registry_status: assetRegistry?.summary?.asset_registry_status ?? "missing",
    source_pptx_renderer_status: pptxRenderer?.summary?.pptx_renderer_status ?? "missing",
    source_design_system_profile_status: designSystemProfile?.summary?.design_system_profile_status ?? "missing",
    source_web_novel_workflow_status: webNovelWorkflow?.summary?.web_novel_workflow_status ?? "missing",
    source_output_delivery_contract_freeze_status: outputDeliveryContractFreeze?.summary?.freeze_status ?? "missing",
    project_id: brief.project_id,
    language: brief.language,
    source_section_count: brief.sections.length,
    source_video_asset_count: videoAssets.length,
    source_pptx_slide_deck_count: pptxSlideDecks.length,
    video_ppt_workflow_record_count: videoPptWorkflows.length,
    complete_workflow_record_count: videoPptWorkflows.filter((record) => record.video_ppt_workflow_status === "complete").length,
    video_ppt_script_count: videoPptScripts.length,
    draft_script_count: videoPptScripts.filter((record) => record.script_status === "draft_needs_review").length,
    video_ppt_storyboard_count: videoPptStoryboards.length,
    draft_storyboard_count: videoPptStoryboards.filter((record) => record.storyboard_status === "draft_needs_review").length,
    caption_required_storyboard_count: videoPptStoryboards.filter((record) => record.caption_required).length,
    video_ppt_slide_deck_count: videoPptSlideDecks.length,
    draft_slide_deck_count: videoPptSlideDecks.filter((record) => record.slide_deck_status === "draft_needs_review").length,
    total_slide_count: videoPptSlideDecks.reduce((sum, deck) => sum + (deck.slide_count ?? 0), 0),
    video_ppt_approval_artifact_count: videoPptApprovalArtifacts.length,
    ready_approval_artifact_count: videoPptApprovalArtifacts.filter((record) => record.approval_artifact_status === "ready_for_human_review").length,
    video_ppt_output_artifact_count: videoPptOutputArtifacts.length,
    draft_output_artifact_count: videoPptOutputArtifacts.filter((record) => record.output_artifact_status === "draft_generated_needs_review").length,
    markdown_output_artifact_count: videoPptOutputArtifacts.filter((record) => record.output_format === "markdown").length,
    json_output_artifact_count: videoPptOutputArtifacts.filter((record) => record.output_format === "json").length,
    human_review_required_output_count: videoPptOutputArtifacts.filter((record) => record.human_review_required).length,
    format_validation_required_output_count: videoPptOutputArtifacts.filter((record) => record.format_validation_required).length,
    source_attribution_required_output_count: videoPptOutputArtifacts.filter((record) => record.source_attribution_required).length,
    metadata_hash_count: metadataHashCount,
    draft_production_only: boundary.draft_production_only,
    deterministic_generation_performed: true,
    deterministic_generation_only: boundary.deterministic_generation_only,
    external_model_execution_performed: false,
    external_model_execution_allowed: boundary.external_model_execution_allowed,
    network_access_performed: false,
    network_access_allowed: boundary.network_access_allowed,
    media_generation_performed: false,
    media_generation_allowed: boundary.media_generation_allowed,
    video_binary_generation_allowed: boundary.video_binary_generation_allowed,
    pptx_binary_generation_allowed: boundary.pptx_binary_generation_allowed,
    existing_pptx_artifact_reuse_allowed: boundary.existing_pptx_artifact_reuse_allowed,
    template_mutation_allowed: boundary.template_mutation_allowed,
    style_mutation_allowed: boundary.style_mutation_allowed,
    asset_mutation_allowed: boundary.asset_mutation_allowed,
    document_runtime_mutation_allowed: boundary.document_runtime_mutation_allowed,
    renderer_execution_allowed: boundary.renderer_execution_allowed,
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
    video_ppt_workflow_generated: true,
    deterministic_draft_generation: true,
    external_model_execution_performed: false,
    network_access_performed: false,
    media_generation_performed: false,
    video_binary_generation_performed: false,
    pptx_binary_generation_performed: false,
    template_mutation_performed: false,
    style_mutation_performed: false,
    asset_mutation_performed: false,
    document_runtime_mutation_performed: false,
    renderer_execution_performed: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    source_attribution_required: true,
    caption_required: true,
    format_validation_required: true,
    human_review_required: true,
    legal_advice_generated: false,
    client_facing_output_generated: false,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "video-ppt-workflow-checkpoint.v1",
    checkpoint_id: `video-ppt-workflow.${checkpointId}`,
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
    await sourceRead("creative_document_pack_manifest", inputs.creative_document_pack_manifest_path, readJsonOrError),
    await sourceRead("asset_registry", inputs.asset_registry_path, readJsonOrError),
    await sourceRead("pptx_renderer", inputs.pptx_renderer_path, readJsonOrError),
    await sourceRead("design_system_profile", inputs.design_system_profile_path, readJsonOrError),
    await sourceRead("web_novel_workflow", inputs.web_novel_workflow_path, readJsonOrError),
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

function serializableVideoPptWorkflow(result) {
  const { markdown, storyboard_markdown: _storyboardMarkdown, slide_deck_plan_json: _slideDeckPlanJson, ...rest } = result;
  return rest;
}

function renderVideoPptWorkflowMarkdown(result) {
  const lines = [];
  lines.push("# Video/PPT Workflow");
  lines.push("");
  lines.push(`Status: ${result.summary.video_ppt_workflow_status}`);
  lines.push(`Scripts: ${result.summary.video_ppt_script_count}`);
  lines.push(`Storyboards: ${result.summary.video_ppt_storyboard_count}`);
  lines.push(`Slide decks: ${result.summary.video_ppt_slide_deck_count}`);
  lines.push(`Approval artifacts: ${result.summary.video_ppt_approval_artifact_count}`);
  lines.push(`Output artifacts: ${result.summary.video_ppt_output_artifact_count}`);
  lines.push(`Draft-only: ${result.summary.draft_production_only}`);
  lines.push("");
  lines.push("## Slide Decks");
  for (const deck of result.video_ppt_slide_decks) {
    lines.push(`- ${deck.video_ppt_slide_deck_id}: ${deck.slide_deck_status} (${deck.slide_count} slide(s))`);
  }
  return `${lines.join("\n")}\n`;
}

function renderStoryboardMarkdown({ brief, videoPptScripts, videoPptStoryboards, videoPptSlideDecks, videoPptApprovalArtifacts }) {
  const lines = [];
  lines.push(`# ${brief.title} Video/PPT Production Draft`);
  lines.push("");
  lines.push(`> ${HUMAN_REVIEW_NOTE}`);
  lines.push("");
  lines.push("## Scripts");
  for (const script of videoPptScripts) {
    lines.push(`- Scene ${script.scene_number}: ${script.source_section_title} (${script.target_duration_seconds}s)`);
  }
  lines.push("");
  lines.push("## Storyboard");
  for (const storyboard of videoPptStoryboards) {
    lines.push(`### Scene ${storyboard.scene_number}: ${storyboard.source_section_title}`);
    for (const frame of storyboard.frames) {
      lines.push(`- Frame ${frame.frame_number}: ${frame.visual_direction} / ${frame.narration_line}`);
    }
    lines.push("");
  }
  lines.push("## Slide Deck");
  for (const deck of videoPptSlideDecks) {
    lines.push(`- ${deck.title}: ${deck.slide_count} slide(s), ${deck.slide_deck_status}`);
  }
  lines.push("");
  lines.push("## Approval");
  for (const approval of videoPptApprovalArtifacts) {
    lines.push(`- ${approval.video_ppt_approval_artifact_id}: ${approval.approval_artifact_status}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeBrief(raw) {
  const brief = raw && typeof raw === "object" ? raw : {};
  return {
    schema_version: brief.schema_version ?? "missing",
    project_id: brief.project_id ?? "creative-document-video-ppt",
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
    creative_document_brief_path: path.resolve(options.creativeDocumentBriefPath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.creativeDocumentBriefPath),
    creative_document_pack_manifest_path: path.resolve(options.creativeDocumentPackManifestPath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.creativeDocumentPackManifestPath),
    asset_registry_path: path.resolve(options.assetRegistryPath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.assetRegistryPath),
    pptx_renderer_path: path.resolve(options.pptxRendererPath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.pptxRendererPath),
    design_system_profile_path: path.resolve(options.designSystemProfilePath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.designSystemProfilePath),
    web_novel_workflow_path: path.resolve(options.webNovelWorkflowPath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.webNovelWorkflowPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_VIDEO_PPT_WORKFLOW_INPUTS.roadmapPath),
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
    else if (arg === "--creative-document-pack-manifest") parsed.creativeDocumentPackManifestPath = argv[++index];
    else if (arg === "--asset-registry") parsed.assetRegistryPath = argv[++index];
    else if (arg === "--pptx-renderer") parsed.pptxRendererPath = argv[++index];
    else if (arg === "--design-system-profile") parsed.designSystemProfilePath = argv[++index];
    else if (arg === "--web-novel-workflow") parsed.webNovelWorkflowPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-video-ppt-workflow.mjs [options]

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
  --creative-document-brief <path>            Creative document brief input path.
  --creative-document-pack-manifest <path>    Creative-document pack manifest path.
  --asset-registry <path>                     Asset registry path.
  --pptx-renderer <path>                      PPTX renderer path.
  --design-system-profile <path>              Design system profile path.
  --web-novel-workflow <path>                 Web novel workflow path.
  --output-delivery-contract-freeze <path>    Output delivery contract freeze path.
  --package <path>                            package.json path.
  --roadmap <path>                            Roadmap/ledger path.
  --run-at <iso>                              Deterministic timestamp.
`);
}

async function readJsonOrError(filePath) {
  try {
    return {
      value: JSON.parse(await readFileWithRetry(filePath, "utf8")),
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
      value: await readFileWithRetry(filePath, "utf8"),
    };
  } catch (error) {
    return {
      value: "",
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 10) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EISDIR", "ENOENT"].includes(error.code) || attempt === attempts) throw error;
      await sleep(100 * attempt);
    }
  }
  throw lastError;
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
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
  return createHash("sha256").update(String(value)).digest("hex");
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
