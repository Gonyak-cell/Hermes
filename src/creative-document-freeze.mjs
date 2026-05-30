import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CREATIVE_DOCUMENT_FREEZE_OUT_DIR = "artifacts/creative-document-freeze/latest";
export const DEFAULT_CREATIVE_DOCUMENT_FREEZE_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  creativeDocumentPackManifestPath: "artifacts/creative-document-pack-manifest/latest/creative-document-pack-manifest.json",
  templateRegistryPath: "artifacts/template-registry/latest/template-registry.json",
  styleRegistryPath: "artifacts/style-registry/latest/style-registry.json",
  assetRegistryPath: "artifacts/asset-registry/latest/asset-registry.json",
  docxRendererPath: "artifacts/docx-renderer/latest/docx-renderer.json",
  pptxRendererPath: "artifacts/pptx-renderer/latest/pptx-renderer.json",
  pdfHtmlRendererPath: "artifacts/pdf-html-renderer/latest/pdf-html-renderer.json",
  layoutValidatorPath: "artifacts/layout-validator/latest/layout-validator.json",
  citationRendererPath: "artifacts/citation-renderer/latest/citation-renderer.json",
  versionComparatorPath: "artifacts/version-comparator/latest/version-comparator.json",
  designSystemProfilePath: "artifacts/design-system-profile/latest/design-system-profile.json",
  webNovelWorkflowPath: "artifacts/web-novel-workflow/latest/web-novel-workflow.json",
  videoPptWorkflowPath: "artifacts/video-ppt-workflow/latest/video-ppt-workflow.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
};

const CONTRACT_ID = "creative-document-freeze.v1";
const PACK_ID = "creative-document";
const CAPABILITY_ID = "creative_document.freeze";
const FREEZE_AUTHORITY = "harness_control_plane";
const SOURCE_OF_TRUTH = "creative_document_phase_artifacts_freeze_report";
const HUMAN_REVIEW_NOTE = "Creative Document freeze is a read-only operational freeze report. It is not legal advice, not client-facing, and not approved for delivery.";

const SOURCE_DEFINITIONS = [
  sourceDefinition("creative_document_pack_manifest", "Creative Document Pack Manifest", "P253", "creativeDocumentPackManifestPath", "creative-document:pack-manifest", "creative_document_pack_manifest_status"),
  sourceDefinition("template_registry", "Template Registry", "P254", "templateRegistryPath", "creative-document:template-registry", "template_registry_status"),
  sourceDefinition("style_registry", "Style Registry", "P255", "styleRegistryPath", "creative-document:style-registry", "style_registry_status"),
  sourceDefinition("asset_registry", "Asset Registry", "P256", "assetRegistryPath", "creative-document:asset-registry", "asset_registry_status"),
  sourceDefinition("docx_renderer", "DOCX Renderer", "P257", "docxRendererPath", "creative-document:docx-renderer", "docx_renderer_status"),
  sourceDefinition("pptx_renderer", "PPTX Renderer", "P258", "pptxRendererPath", "creative-document:pptx-renderer", "pptx_renderer_status"),
  sourceDefinition("pdf_html_renderer", "PDF/HTML Renderer", "P259", "pdfHtmlRendererPath", "creative-document:pdf-html-renderer", "pdf_html_renderer_status"),
  sourceDefinition("layout_validator", "Layout Validator", "P260", "layoutValidatorPath", "creative-document:layout-validator", "layout_validator_status"),
  sourceDefinition("citation_renderer", "Citation Renderer", "P261", "citationRendererPath", "creative-document:citation-renderer", "citation_renderer_status"),
  sourceDefinition("version_comparator", "Version Comparator", "P262", "versionComparatorPath", "creative-document:version-comparator", "version_comparator_status"),
  sourceDefinition("design_system_profile", "Design System Profile", "P263", "designSystemProfilePath", "creative-document:design-system-profile", "design_system_profile_status"),
  sourceDefinition("web_novel_workflow", "Web Novel Workflow", "P264", "webNovelWorkflowPath", "creative-document:web-novel-workflow", "web_novel_workflow_status"),
  sourceDefinition("video_ppt_workflow", "Video/PPT Workflow", "P265", "videoPptWorkflowPath", "creative-document:video-ppt-workflow", "video_ppt_workflow_status"),
];

export async function runCreativeDocumentFreeze(options = {}) {
  const result = await buildCreativeDocumentFreeze(options);
  if (options.write !== false) await writeCreativeDocumentFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Creative Document freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCreativeDocumentFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CREATIVE_DOCUMENT_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);
  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const gateApprovalContractFreeze = await readJsonOrError(inputs.gate_approval_contract_freeze_path);
  const outputDeliveryContractFreeze = await readJsonOrError(inputs.output_delivery_contract_freeze_path);
  const sourceReads = {};
  for (const definition of SOURCE_DEFINITIONS) {
    sourceReads[definition.source_id] = await readJsonOrError(inputs[definition.input_key]);
  }
  const artifacts = Object.fromEntries(SOURCE_DEFINITIONS.map((definition) => [
    definition.source_id,
    sourceReads[definition.source_id].value ?? {},
  ]));
  artifacts.gate_approval_contract_freeze = gateApprovalContractFreeze.value ?? {};
  artifacts.output_delivery_contract_freeze = outputDeliveryContractFreeze.value ?? {};
  const freezeSources = buildFreezeSources({ sourceReads, artifacts, generatedAt });
  const sourceById = new Map(freezeSources.map((source) => [source.source_id, source]));
  const representativePaths = buildRepresentativePaths({ artifacts, sourceById, generatedAt });
  const freezeGates = buildFreezeGates({ artifacts, sourceById, representativePaths, generatedAt });
  const freezeBoundary = buildFreezeBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    controlPlaneLoopText: controlPlaneLoopText.value,
    reviewDashboardText: reviewDashboardText.value,
    reviewApiText: reviewApiText.value,
    gateApprovalContractFreeze,
    outputDeliveryContractFreeze,
    freezeSources,
    representativePaths,
    freezeGates,
    freezeBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    checkpoint_id: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeCreativeDocumentFreeze({
    artifacts,
    freezeSources,
    representativePaths,
    freezeGates,
    freezeBoundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    creative_document_freeze_id: `creative-document-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    creative_document_freeze_status: summary.creative_document_freeze_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, sourceReads, gateApprovalContractFreeze, outputDeliveryContractFreeze }),
    creative_document_freeze_contract: buildContract(generatedAt),
    creative_document_freeze_sources: freezeSources,
    creative_document_freeze_paths: representativePaths,
    creative_document_freeze_gates: freezeGates,
    creative_document_freeze_boundary: freezeBoundary,
    creative_document_freeze_checkpoints: checkpoints,
    freeze_note: buildFreezeNote({ generatedAt, summary, representativePaths, freezeGates }),
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    summary_markdown: renderSummaryMarkdown(result),
    freeze_note_markdown: renderFreezeNoteMarkdown(result),
  };
}

export async function writeCreativeDocumentFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "creative-document-freeze.json"), serializableCreativeDocumentFreeze(result));
  await writeJson(path.join(outDir, "creative-document-freeze-sources.json"), {
    schema_version: "creative-document-freeze-sources-artifact.v1",
    generated_at: result.generated_at,
    source_count: result.creative_document_freeze_sources.length,
    creative_document_freeze_sources: result.creative_document_freeze_sources,
  });
  await writeJson(path.join(outDir, "creative-document-freeze-paths.json"), {
    schema_version: "creative-document-freeze-paths-artifact.v1",
    generated_at: result.generated_at,
    path_count: result.creative_document_freeze_paths.length,
    creative_document_freeze_paths: result.creative_document_freeze_paths,
  });
  await writeJson(path.join(outDir, "creative-document-freeze-gates.json"), {
    schema_version: "creative-document-freeze-gates-artifact.v1",
    generated_at: result.generated_at,
    gate_count: result.creative_document_freeze_gates.length,
    creative_document_freeze_gates: result.creative_document_freeze_gates,
  });
  await writeJson(path.join(outDir, "creative-document-freeze-boundary.json"), {
    schema_version: "creative-document-freeze-boundary-artifact.v1",
    generated_at: result.generated_at,
    creative_document_freeze_boundary: result.creative_document_freeze_boundary,
  });
  await writeJson(path.join(outDir, "creative-document-freeze-checkpoints.json"), {
    schema_version: "creative-document-freeze-checkpoints-artifact.v1",
    generated_at: result.generated_at,
    checkpoint_count: result.creative_document_freeze_checkpoints.length,
    creative_document_freeze_checkpoints: result.creative_document_freeze_checkpoints,
  });
  await writeJson(path.join(outDir, "freeze-note.json"), result.freeze_note);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "creative-document-freeze-validation-report.v1",
    generated_at: result.generated_at,
    creative_document_freeze_id: result.creative_document_freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "freeze-note.md"), result.freeze_note_markdown, "utf8");
  await writeFile(path.join(outDir, "summary.md"), result.summary_markdown, "utf8");
}

export async function runCreativeDocumentFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runCreativeDocumentFreeze(args);
    console.log(`Creative Document freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.creative_document_freeze_status}`);
    console.log(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
    console.log(`Paths: ${result.summary.passed_path_count}/${result.summary.path_count}`);
    console.log(`Gates: ${result.summary.passed_gate_count}/${result.summary.gate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildFreezeSources({ sourceReads, artifacts, generatedAt }) {
  return SOURCE_DEFINITIONS.map((definition) => {
    const read = sourceReads[definition.source_id] ?? {};
    const artifact = artifacts[definition.source_id] ?? {};
    const summary = artifact.summary ?? {};
    const validationErrorCount = summary.validation_error_count ?? artifact.validation?.errors?.length ?? 0;
    const failedCheckpointCount = summary.failed_checkpoint_count ?? summary.failed_validation_item_count ?? summary.failed_validation_count ?? 0;
    const sourceStatus = !read.error
      && summary[definition.status_key] === "complete"
      && artifact.validation?.valid !== false
      && validationErrorCount === 0
      && failedCheckpointCount === 0
      ? "complete"
      : "attention";
    return {
      schema_version: "creative-document-freeze-source.v1",
      source_id: definition.source_id,
      source_label: definition.label,
      phase_slot: definition.phase_slot,
      source_command: definition.command,
      source_path: definition.path,
      source_status: sourceStatus,
      expected_status_key: definition.status_key,
      observed_status: summary[definition.status_key] ?? "unknown",
      validation_valid: artifact.validation?.valid !== false,
      validation_error_count: validationErrorCount,
      failed_checkpoint_count: failedCheckpointCount,
      human_review_required: Boolean(summary.human_review_required ?? summary.attorney_review_required ?? summary.human_review_required_output_count ?? summary.human_review_required_packet_count ?? false),
      client_facing_ready: Boolean(summary.client_facing_ready ?? false),
      source_contract_hash: read.value ? `sha256:${hashJson(read.value)}` : null,
      generated_at: generatedAt,
    };
  });
}

function buildRepresentativePaths({ artifacts, sourceById, generatedAt }) {
  const sourcePass = (sourceId) => sourceById.get(sourceId)?.source_status === "complete";
  const docx = artifacts.docx_renderer?.summary ?? {};
  const pptx = artifacts.pptx_renderer?.summary ?? {};
  const pdfHtml = artifacts.pdf_html_renderer?.summary ?? {};
  const layout = artifacts.layout_validator?.summary ?? {};
  const citation = artifacts.citation_renderer?.summary ?? {};
  const version = artifacts.version_comparator?.summary ?? {};
  const design = artifacts.design_system_profile?.summary ?? {};
  const webNovel = artifacts.web_novel_workflow?.summary ?? {};
  const videoPpt = artifacts.video_ppt_workflow?.summary ?? {};
  const gateApproval = artifacts.gate_approval_contract_freeze?.summary ?? {};
  const outputDelivery = artifacts.output_delivery_contract_freeze?.summary ?? {};
  const creativeDeliveryBoundaryPassed = creativeOutputDeliveryBoundaryPassed(artifacts);
  const approvalGate = gateApproval.freeze_status === "complete"
    && (gateApproval.failed_validation_item_count ?? 0) === 0
    && (gateApproval.validation_error_count ?? 0) === 0
    && outputDelivery.freeze_status === "complete"
    && creativeDeliveryBoundaryPassed;
  const renderGate = docx.docx_renderer_status === "complete"
    && pptx.pptx_renderer_status === "complete"
    && pdfHtml.pdf_html_renderer_status === "complete"
    && docx.completed_render_job_count === docx.docx_render_job_count
    && pptx.completed_render_job_count === pptx.pptx_render_job_count
    && pdfHtml.completed_render_job_count === pdfHtml.pdf_html_render_job_count
    && docx.passed_format_validation_result_count === docx.docx_format_validation_result_count
    && pptx.passed_format_validation_result_count === pptx.pptx_format_validation_result_count
    && pdfHtml.passed_format_validation_result_count === pdfHtml.pdf_html_format_validation_result_count;
  const layoutGate = layout.layout_validator_status === "complete"
    && layout.failed_layout_validation_result_count === 0
    && layout.passed_layout_validation_result_count === layout.layout_validation_result_count;
  const citationGate = citation.citation_renderer_status === "complete"
    && version.version_comparator_status === "complete"
    && version.ready_for_review_packet_count === version.comparison_packet_count;
  const designGate = design.design_system_profile_status === "complete"
    && design.ready_for_review_packet_count === design.design_review_packet_count;
  const contentGate = webNovel.web_novel_workflow_status === "complete"
    && videoPpt.video_ppt_workflow_status === "complete"
    && webNovel.client_facing_ready_count === 0
    && videoPpt.client_facing_ready_count === 0;
  const paths = [
    {
      path_id: "document_render_layout_review",
      path_label: "Document render, layout, citation, and approval review",
      path_kind: "document",
      source_ids: ["docx_renderer", "pdf_html_renderer", "layout_validator", "citation_renderer", "version_comparator"],
      render_gate_passed: renderGate,
      layout_gate_passed: layoutGate,
      content_gate_passed: true,
      approval_gate_passed: approvalGate,
      output_artifact_count: (docx.docx_output_artifact_count ?? 0) + (pdfHtml.pdf_html_output_artifact_count ?? 0),
    },
    {
      path_id: "presentation_design_review",
      path_label: "Presentation render, design-system, layout, and approval review",
      path_kind: "presentation",
      source_ids: ["pptx_renderer", "layout_validator", "version_comparator", "design_system_profile", "video_ppt_workflow"],
      render_gate_passed: renderGate,
      layout_gate_passed: layoutGate && designGate,
      content_gate_passed: videoPpt.video_ppt_workflow_status === "complete",
      approval_gate_passed: approvalGate,
      output_artifact_count: (pptx.pptx_output_artifact_count ?? 0) + (videoPpt.video_ppt_output_artifact_count ?? 0),
    },
    {
      path_id: "content_production_review",
      path_label: "Creative content production, storyboard, and approval review",
      path_kind: "content",
      source_ids: ["web_novel_workflow", "video_ppt_workflow", "design_system_profile"],
      render_gate_passed: true,
      layout_gate_passed: designGate,
      content_gate_passed: contentGate,
      approval_gate_passed: approvalGate,
      output_artifact_count: (webNovel.web_novel_output_artifact_count ?? 0) + (videoPpt.video_ppt_output_artifact_count ?? 0),
    },
  ];
  return paths.map((entry) => {
    const sourcesComplete = entry.source_ids.every(sourcePass);
    const pathStatus = sourcesComplete && entry.render_gate_passed && entry.layout_gate_passed && entry.content_gate_passed && entry.approval_gate_passed ? "passed" : "attention";
    return {
      schema_version: "creative-document-freeze-path.v1",
      ...entry,
      sources_complete: sourcesComplete,
      path_status: pathStatus,
      human_review_required: true,
      client_facing_ready: false,
      human_review_note: HUMAN_REVIEW_NOTE,
      generated_at: generatedAt,
    };
  });
}

function creativeOutputDeliveryBoundaryPassed(artifacts) {
  const summaries = [
    artifacts.docx_renderer?.summary,
    artifacts.pptx_renderer?.summary,
    artifacts.pdf_html_renderer?.summary,
    artifacts.web_novel_workflow?.summary,
    artifacts.video_ppt_workflow?.summary,
  ].filter(Boolean);
  return summaries.length === 5 && summaries.every((summary) =>
    (summary.delivery_execution_performed ?? false) === false
    && (summary.client_facing_ready_count ?? 0) === 0
    && (summary.legal_advice_generated ?? false) === false
  );
}

function buildFreezeGates({ artifacts, sourceById, representativePaths, generatedAt }) {
  const layout = artifacts.layout_validator?.summary ?? {};
  const citation = artifacts.citation_renderer?.summary ?? {};
  const gateApproval = artifacts.gate_approval_contract_freeze?.summary ?? {};
  const outputDelivery = artifacts.output_delivery_contract_freeze?.summary ?? {};
  const creativeDeliveryBoundaryPassed = creativeOutputDeliveryBoundaryPassed(artifacts);
  const allSourcesPassed = SOURCE_DEFINITIONS.every((definition) => sourceById.get(definition.source_id)?.source_status === "complete");
  const gateRecords = [
    gateRecord("source_integrity", "Source integrity", allSourcesPassed, "P253-P265 source artifacts are complete and validation-clean."),
    gateRecord("render_format", "Render and format validation", representativePaths.every((item) => item.render_gate_passed), "DOCX, PPTX, PDF, and HTML renderers have passed deterministic format checks."),
    gateRecord("layout_validation", "Layout validation", layout.layout_validator_status === "complete" && layout.failed_layout_validation_result_count === 0, "Layout validator has no failed layout validation results."),
    gateRecord("citation_version_review", "Citation and version review", citation.citation_renderer_status === "complete" && (artifacts.version_comparator?.summary?.version_comparator_status === "complete"), "Citation render packets and comparison packets are ready for review."),
    gateRecord("content_production_review", "Creative content production review", representativePaths.every((item) => item.content_gate_passed), "Web novel and Video/PPT production outputs are draft-only and review-gated."),
    gateRecord("approval_delivery_boundary", "Approval and delivery boundary", gateApproval.freeze_status === "complete" && outputDelivery.freeze_status === "complete" && creativeDeliveryBoundaryPassed, "Approval and delivery contracts remain complete, and P253-P265 creative artifacts record no delivery or client-facing readiness."),
  ];
  return gateRecords.map((record) => ({
    schema_version: "creative-document-freeze-gate.v1",
    ...record,
    generated_at: generatedAt,
  }));
}

function buildFreezeBoundary(generatedAt) {
  return {
    schema_version: "creative-document-freeze-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    freeze_report_only: true,
    source_artifact_mutation_allowed: false,
    template_mutation_allowed: false,
    style_mutation_allowed: false,
    asset_mutation_allowed: false,
    document_runtime_mutation_allowed: false,
    renderer_execution_performed: false,
    external_model_execution_performed: false,
    network_access_performed: false,
    media_generation_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, gateApprovalContractFreeze, outputDeliveryContractFreeze, freezeSources, representativePaths, freezeGates, freezeBoundary }) {
  return [
    checkpoint("sources.complete", freezeSources.every((source) => source.source_status === "complete"), `${freezeSources.filter((source) => source.source_status === "complete").length}/${freezeSources.length} creative-document source artifact(s) are complete.`),
    checkpoint("paths.passed", representativePaths.length === 3 && representativePaths.every((item) => item.path_status === "passed"), `${representativePaths.filter((item) => item.path_status === "passed").length}/${representativePaths.length} representative path(s) passed render/layout/content/approval gates.`),
    checkpoint("gates.passed", freezeGates.length >= 6 && freezeGates.every((gate) => gate.gate_status === "passed"), `${freezeGates.filter((gate) => gate.gate_status === "passed").length}/${freezeGates.length} freeze gate(s) passed.`),
    checkpoint("approval.contracts", gateApprovalContractFreeze.value?.summary?.freeze_status === "complete" && outputDeliveryContractFreeze.value?.summary?.freeze_status === "complete", "Gate approval and output delivery contract freezes are complete."),
    checkpoint("boundary.enforced", freezeBoundary.boundary_status === "enforced" && freezeBoundary.read_only && freezeBoundary.delivery_execution_performed === false && freezeBoundary.protected_action_executed === false && freezeBoundary.legal_advice_generated === false && freezeBoundary.client_facing_output_generated === false, "Creative Document freeze remains read-only, non-delivering, and non-client-facing."),
    checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:freeze"]), "package.json registers creative-document:freeze."),
    checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P266") && roadmapText.includes("Creative Document freeze"), "Roadmap ledger keeps the P266 Creative Document freeze slot."),
    checkpoint("loop.bound", typeof controlPlaneLoopText === "string" && controlPlaneLoopText.includes("creative_document_freeze") && controlPlaneLoopText.includes("creative-document:freeze"), "Control-plane loop includes the Creative Document freeze step."),
    checkpoint("dashboard.bound", typeof reviewDashboardText === "string" && reviewDashboardText.includes("creative_document_freeze"), "Review Dashboard includes the Creative Document freeze source and stage."),
    checkpoint("api.bound", typeof reviewApiText === "string" && reviewApiText.includes("/api/creative-document-freezes"), "Review API exposes Creative Document freeze routes."),
  ];
}

function summarizeCreativeDocumentFreeze({ artifacts, freezeSources, representativePaths, freezeGates, freezeBoundary, validation }) {
  const docx = artifacts.docx_renderer?.summary ?? {};
  const pptx = artifacts.pptx_renderer?.summary ?? {};
  const pdfHtml = artifacts.pdf_html_renderer?.summary ?? {};
  const layout = artifacts.layout_validator?.summary ?? {};
  const webNovel = artifacts.web_novel_workflow?.summary ?? {};
  const videoPpt = artifacts.video_ppt_workflow?.summary ?? {};
  const gateApproval = artifacts.gate_approval_contract_freeze?.summary ?? {};
  const outputDelivery = artifacts.output_delivery_contract_freeze?.summary ?? {};
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  return {
    creative_document_freeze_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    creative_document_freeze_contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    phase_range: "P253-P266",
    source_phase_range: "P253-P265",
    next_phase_slot: "P267",
    source_count: freezeSources.length,
    passed_source_count: freezeSources.filter((source) => source.source_status === "complete").length,
    path_count: representativePaths.length,
    passed_path_count: representativePaths.filter((item) => item.path_status === "passed").length,
    gate_count: freezeGates.length,
    passed_gate_count: freezeGates.filter((gate) => gate.gate_status === "passed").length,
    rendered_output_artifact_count: (docx.docx_output_artifact_count ?? 0) + (pptx.pptx_output_artifact_count ?? 0) + (pdfHtml.pdf_html_output_artifact_count ?? 0),
    draft_output_artifact_count: (docx.draft_output_artifact_count ?? 0) + (pptx.draft_output_artifact_count ?? 0) + (pdfHtml.draft_output_artifact_count ?? 0) + (webNovel.draft_output_artifact_count ?? 0) + (videoPpt.draft_output_artifact_count ?? 0),
    format_validation_result_count: (docx.docx_format_validation_result_count ?? 0) + (pptx.pptx_format_validation_result_count ?? 0) + (pdfHtml.pdf_html_format_validation_result_count ?? 0),
    passed_format_validation_result_count: (docx.passed_format_validation_result_count ?? 0) + (pptx.passed_format_validation_result_count ?? 0) + (pdfHtml.passed_format_validation_result_count ?? 0),
    layout_validation_result_count: layout.layout_validation_result_count ?? 0,
    passed_layout_validation_result_count: layout.passed_layout_validation_result_count ?? 0,
    failed_layout_validation_result_count: layout.failed_layout_validation_result_count ?? 0,
    citation_render_packet_count: artifacts.citation_renderer?.summary?.citation_render_packet_count ?? 0,
    comparison_packet_count: artifacts.version_comparator?.summary?.comparison_packet_count ?? 0,
    design_review_packet_count: artifacts.design_system_profile?.summary?.design_review_packet_count ?? 0,
    web_novel_output_artifact_count: webNovel.web_novel_output_artifact_count ?? 0,
    video_ppt_output_artifact_count: videoPpt.video_ppt_output_artifact_count ?? 0,
    approval_request_count: gateApproval.approval_request_count ?? 0,
    pending_approval_request_count: gateApproval.pending_approval_request_count ?? 0,
    approval_request_linked_artifact_count: outputDelivery.approval_request_linked_artifact_count ?? 0,
    source_output_delivery_executed_delivery_action_count: outputDelivery.executed_delivery_action_count ?? 0,
    source_output_delivery_ready_delivery_action_count: outputDelivery.ready_delivery_action_count ?? 0,
    executed_delivery_action_count: freezeBoundary.delivery_execution_performed ? 1 : 0,
    ready_delivery_action_count: 0,
    read_only: freezeBoundary.read_only,
    freeze_report_only: freezeBoundary.freeze_report_only,
    source_artifact_mutation_performed: false,
    template_mutation_performed: false,
    style_mutation_performed: false,
    asset_mutation_performed: false,
    document_runtime_mutation_performed: false,
    renderer_execution_performed: freezeBoundary.renderer_execution_performed,
    external_model_execution_performed: freezeBoundary.external_model_execution_performed,
    network_access_performed: freezeBoundary.network_access_performed,
    media_generation_performed: freezeBoundary.media_generation_performed,
    delivery_execution_performed: freezeBoundary.delivery_execution_performed,
    protected_action_executed: freezeBoundary.protected_action_executed,
    legal_advice_generated: freezeBoundary.legal_advice_generated,
    client_facing_output_generated: freezeBoundary.client_facing_output_generated,
    client_facing_ready_count: freezeBoundary.client_facing_ready_count,
    human_review_required: freezeBoundary.human_review_required,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    freeze_report_only: true,
    source_artifact_mutation_allowed: false,
    protected_actions_executed: false,
    external_delivery_executed: false,
    external_model_call_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
  };
}

function buildSourceContracts({ packageJson, roadmapText, controlPlaneLoopText, reviewDashboardText, reviewApiText, sourceReads, gateApprovalContractFreeze, outputDeliveryContractFreeze }) {
  return [
    textContractRef("package.json", packageJson),
    textContractRef("final-completion-phase-ledger", roadmapText),
    textContractRef("control-plane-loop", controlPlaneLoopText),
    textContractRef("review-dashboard", reviewDashboardText),
    textContractRef("review-api", reviewApiText),
    ...SOURCE_DEFINITIONS.map((definition) => contractRef(definition.label, sourceReads[definition.source_id])),
    contractRef("Gate Approval Contract Freeze", gateApprovalContractFreeze),
    contractRef("Output Delivery Contract Freeze", outputDeliveryContractFreeze),
  ];
}

function buildContract(generatedAt) {
  return {
    schema_version: "creative-document-freeze-contract.v1",
    contract_id: CONTRACT_ID,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    freeze_authority: FREEZE_AUTHORITY,
    source_of_truth: SOURCE_OF_TRUTH,
    source_phase_range: "P253-P265",
    freeze_phase: "P266",
    representative_path_count: 3,
    required_gate_ids: ["source_integrity", "render_format", "layout_validation", "citation_version_review", "content_production_review", "approval_delivery_boundary"],
    human_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  };
}

function buildFreezeNote({ generatedAt, summary, representativePaths, freezeGates }) {
  return {
    schema_version: "creative-document-freeze-note.v1",
    generated_at: generatedAt,
    freeze_status: summary.creative_document_freeze_status,
    freeze_note: HUMAN_REVIEW_NOTE,
    representative_path_ids: representativePaths.map((item) => item.path_id),
    passed_gate_ids: freezeGates.filter((gate) => gate.gate_status === "passed").map((gate) => gate.gate_id),
    remaining_slot: "P267",
    legal_advice_generated: false,
    client_facing_output_generated: false,
  };
}

function renderSummaryMarkdown(result) {
  const lines = [];
  lines.push("# Creative Document Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.creative_document_freeze_status}`);
  lines.push(`Sources: ${result.summary.passed_source_count}/${result.summary.source_count}`);
  lines.push(`Representative paths: ${result.summary.passed_path_count}/${result.summary.path_count}`);
  lines.push(`Freeze gates: ${result.summary.passed_gate_count}/${result.summary.gate_count}`);
  lines.push(`Rendered output artifacts: ${result.summary.rendered_output_artifact_count}`);
  lines.push(`Layout validation: ${result.summary.passed_layout_validation_result_count}/${result.summary.layout_validation_result_count}`);
  lines.push("");
  lines.push(HUMAN_REVIEW_NOTE);
  lines.push("");
  lines.push("## Representative Paths");
  for (const item of result.creative_document_freeze_paths) {
    lines.push(`- ${item.path_id}: ${item.path_status}`);
  }
  lines.push("");
  lines.push("## Gates");
  for (const gate of result.creative_document_freeze_gates) {
    lines.push(`- ${gate.gate_id}: ${gate.gate_status}`);
  }
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function renderFreezeNoteMarkdown(result) {
  return [
    "# Creative Document Freeze Note",
    "",
    `Status: ${result.summary.creative_document_freeze_status}`,
    "",
    HUMAN_REVIEW_NOTE,
    "",
    "This freeze report confirms the P253-P265 creative-document representative workflows are read-only, review-gated, and not approved for client delivery.",
    "",
  ].join("\n");
}

function serializableCreativeDocumentFreeze(result) {
  const { summary_markdown, freeze_note_markdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return {
    valid: errors.length === 0,
    items,
    item_count: items.length,
    passed_count: items.filter((item) => item.status === "passed").length,
    failed_count: errors.length,
    errors,
  };
}

function checkpoint(checkpointId, passed, message) {
  return {
    schema_version: "creative-document-freeze-checkpoint.v1",
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function gateRecord(gateId, label, passed, message) {
  return {
    gate_id: gateId,
    gate_label: label,
    gate_status: passed ? "passed" : "attention",
    message,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function sourceDefinition(sourceId, label, phaseSlot, inputKey, command, statusKey) {
  return {
    source_id: sourceId,
    label,
    phase_slot: phaseSlot,
    input_key: inputKey.replace(/Path$/, "_path").replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`),
    option_key: inputKey,
    command,
    status_key: statusKey,
    path: DEFAULT_CREATIVE_DOCUMENT_FREEZE_INPUTS[inputKey],
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_CREATIVE_DOCUMENT_FREEZE_INPUTS;
  return {
    repo_root: path.resolve(options.repoRoot ?? defaults.repoRoot),
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_path: options.roadmapPath ?? defaults.roadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? defaults.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? defaults.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? defaults.reviewApiPath,
    creative_document_pack_manifest_path: path.resolve(options.creativeDocumentPackManifestPath ?? defaults.creativeDocumentPackManifestPath),
    template_registry_path: path.resolve(options.templateRegistryPath ?? defaults.templateRegistryPath),
    style_registry_path: path.resolve(options.styleRegistryPath ?? defaults.styleRegistryPath),
    asset_registry_path: path.resolve(options.assetRegistryPath ?? defaults.assetRegistryPath),
    docx_renderer_path: path.resolve(options.docxRendererPath ?? defaults.docxRendererPath),
    pptx_renderer_path: path.resolve(options.pptxRendererPath ?? defaults.pptxRendererPath),
    pdf_html_renderer_path: path.resolve(options.pdfHtmlRendererPath ?? defaults.pdfHtmlRendererPath),
    layout_validator_path: path.resolve(options.layoutValidatorPath ?? defaults.layoutValidatorPath),
    citation_renderer_path: path.resolve(options.citationRendererPath ?? defaults.citationRendererPath),
    version_comparator_path: path.resolve(options.versionComparatorPath ?? defaults.versionComparatorPath),
    design_system_profile_path: path.resolve(options.designSystemProfilePath ?? defaults.designSystemProfilePath),
    web_novel_workflow_path: path.resolve(options.webNovelWorkflowPath ?? defaults.webNovelWorkflowPath),
    video_ppt_workflow_path: path.resolve(options.videoPptWorkflowPath ?? defaults.videoPptWorkflowPath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? defaults.gateApprovalContractFreezePath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? defaults.outputDeliveryContractFreezePath),
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
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--control-plane-loop") parsed.controlPlaneLoopPath = argv[++index];
    else if (arg === "--review-dashboard") parsed.reviewDashboardPath = argv[++index];
    else if (arg === "--review-api") parsed.reviewApiPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-freeze.mjs [options]

Options:
  --check                    Exit non-zero when validation fails.
  --no-write                 Build in memory without writing artifacts.
  --out-dir <path>           Output directory.
  --package <path>           package.json path.
  --roadmap <path>           Roadmap/ledger path.
  --control-plane-loop <path> Control-plane loop source path.
  --review-dashboard <path>  Review dashboard source path.
  --review-api <path>        Review API source path.
  --run-at <iso>             Deterministic timestamp.
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

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runCreativeDocumentFreezeCli();
}
