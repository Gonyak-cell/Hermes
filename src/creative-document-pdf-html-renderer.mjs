import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PDF_HTML_RENDERER_OUT_DIR = "artifacts/pdf-html-renderer/latest";
export const DEFAULT_PDF_HTML_RENDERER_INPUTS = {
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

const CONTRACT_ID = "pdf-html-renderer.v1";
const HUMAN_REVIEW_NOTE = "Draft operational HTML/PDF artifact for attorney review. Not legal advice, not client-facing, and not approved for delivery.";
const REQUIRED_HTML_MARKERS = ["<!doctype html>", "<main", "data-human-review-required=\"true\""];
const REQUIRED_PDF_MARKERS = ["%PDF-1.4", "%%EOF"];

export async function runPdfHtmlRenderer(options = {}) {
  const result = await buildPdfHtmlRenderer(options);
  if (options.write !== false) await writePdfHtmlRenderer(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`PDF/HTML renderer validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPdfHtmlRenderer(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PDF_HTML_RENDERER_OUT_DIR);
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

  const htmlTemplates = (templateRegistry?.template_records ?? [])
    .filter((template) => template.template_format === "html")
    .sort((left, right) => left.template_id.localeCompare(right.template_id));
  const pdfHtmlRenderJobs = buildPdfHtmlRenderJobs(htmlTemplates, styleRegistry, assetRegistry, outputDir, generatedAt);
  const htmlPreviewArtifacts = pdfHtmlRenderJobs.map((job) => buildHtmlPreviewArtifact(job, generatedAt));
  const pdfExportArtifacts = pdfHtmlRenderJobs.map((job) => buildPdfExportArtifact(job, htmlPreviewArtifacts, generatedAt));
  const pdfHtmlOutputArtifacts = [...htmlPreviewArtifacts, ...pdfExportArtifacts].map((artifact) => buildOutputArtifact(artifact, generatedAt));
  const pdfHtmlFormatValidationResults = pdfHtmlOutputArtifacts.map((artifact) => buildFormatValidationResult(artifact, generatedAt));
  const boundary = buildPdfHtmlRendererBoundary({
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
    htmlTemplates,
    pdfHtmlRenderJobs,
    htmlPreviewArtifacts,
    pdfExportArtifacts,
    pdfHtmlOutputArtifacts,
    pdfHtmlFormatValidationResults,
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
  const summary = summarizePdfHtmlRenderer({
    assetRegistry,
    styleRegistry,
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    htmlTemplates,
    pdfHtmlRenderJobs,
    htmlPreviewArtifacts,
    pdfExportArtifacts,
    pdfHtmlOutputArtifacts,
    pdfHtmlFormatValidationResults,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    pdf_html_renderer_id: `pdf-html-renderer.${dateStamp(generatedAt)}`,
    pdf_html_renderer_status: summary.pdf_html_renderer_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    pdf_html_renderer_contract: buildContract(generatedAt),
    pdf_html_renderer_boundary: boundary,
    pdf_html_render_jobs: pdfHtmlRenderJobs,
    html_preview_artifacts: htmlPreviewArtifacts,
    pdf_export_artifacts: pdfExportArtifacts,
    pdf_html_output_artifacts: pdfHtmlOutputArtifacts,
    pdf_html_format_validation_results: pdfHtmlFormatValidationResults,
    pdf_html_renderer_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderPdfHtmlRendererMarkdown(result),
  };
}

export async function writePdfHtmlRenderer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePdfHtmlRenderer(result);
  await writeJson(path.join(outDir, "pdf-html-renderer.json"), serializable);
  await writeJson(path.join(outDir, "pdf-html-render-jobs.json"), {
    schema_version: "pdf-html-render-jobs.v1",
    generated_at: result.generated_at,
    pdf_html_render_job_count: result.pdf_html_render_jobs.length,
    pdf_html_render_jobs: result.pdf_html_render_jobs,
  });
  await writeJson(path.join(outDir, "html-preview-artifacts.json"), {
    schema_version: "html-preview-artifacts.v1",
    generated_at: result.generated_at,
    html_preview_artifact_count: result.html_preview_artifacts.length,
    html_preview_artifacts: result.html_preview_artifacts,
  });
  await writeJson(path.join(outDir, "pdf-export-artifacts.json"), {
    schema_version: "pdf-export-artifacts.v1",
    generated_at: result.generated_at,
    pdf_export_artifact_count: result.pdf_export_artifacts.length,
    pdf_export_artifacts: result.pdf_export_artifacts,
  });
  await writeJson(path.join(outDir, "pdf-html-output-artifacts.json"), {
    schema_version: "pdf-html-output-artifacts.v1",
    generated_at: result.generated_at,
    pdf_html_output_artifact_count: result.pdf_html_output_artifacts.length,
    pdf_html_output_artifacts: result.pdf_html_output_artifacts,
  });
  await writeJson(path.join(outDir, "pdf-html-format-validation-results.json"), {
    schema_version: "pdf-html-format-validation-results.v1",
    generated_at: result.generated_at,
    pdf_html_format_validation_result_count: result.pdf_html_format_validation_results.length,
    pdf_html_format_validation_results: result.pdf_html_format_validation_results,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "pdf-html-renderer-validation-report.v1",
    generated_at: result.generated_at,
    pdf_html_renderer_id: result.pdf_html_renderer_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  for (const artifact of result.html_preview_artifacts) {
    await writeFile(artifact.html_preview_path, artifact.html_payload, "utf8");
  }
  for (const artifact of result.pdf_export_artifacts) {
    await writeFile(artifact.pdf_export_path, Buffer.from(artifact.pdf_payload, "utf8"));
  }
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPdfHtmlRendererCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPdfHtmlRenderer(args);
    console.log(`PDF/HTML renderer ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.pdf_html_renderer_status}`);
    console.log(`HTML templates: ${result.summary.html_template_count}`);
    console.log(`Render jobs: ${result.summary.completed_render_job_count}/${result.summary.pdf_html_render_job_count}`);
    console.log(`HTML previews: ${result.summary.html_preview_artifact_count}`);
    console.log(`PDF exports: ${result.summary.pdf_export_artifact_count}`);
    console.log(`Output artifacts: ${result.summary.draft_output_artifact_count}/${result.summary.pdf_html_output_artifact_count}`);
    console.log(`Format validations: ${result.summary.passed_format_validation_result_count}/${result.summary.pdf_html_format_validation_result_count}`);
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
    schema_version: "pdf-html-renderer-contract.v1",
    contract_id: CONTRACT_ID,
    renderer_scope: "creative_and_document_domain_pack_pdf_html",
    source_of_truth: "template_registry_style_registry_asset_registry_and_document_renderer_adapter",
    required_template_format: "html",
    required_output_formats: ["html", "pdf"],
    required_html_markers: REQUIRED_HTML_MARKERS,
    required_pdf_markers: REQUIRED_PDF_MARKERS,
    renderer_rule: "local_deterministic_renderer_generates_html_preview_and_pdf_export_draft_artifacts_from_html_templates_only",
    validation_rule: "html_preview_and_pdf_export_artifacts_must_pass_format_validation_before_any_delivery_gate_can_be_requested",
    safety_rule: "pdf_html_outputs_remain_draft_artifacts_pending_format_validation_human_review_and_attorney_approval_with_no_delivery_or_client_facing_release",
    human_review_rule: "every_html_preview_and_pdf_export_contains_an_explicit_attorney_review_note_and_is_not_legal_advice",
    created_at: generatedAt,
  };
}

function buildPdfHtmlRenderJobs(htmlTemplates, styleRegistry, assetRegistry, outputDir, generatedAt) {
  const styleBindingByTemplateId = new Map((styleRegistry?.template_style_bindings ?? []).map((binding) => [binding.template_id, binding]));
  const assetBindingsByTemplateId = groupBy(assetRegistry?.template_asset_bindings ?? [], "template_id");
  return htmlTemplates.map((template, index) => {
    const styleBinding = styleBindingByTemplateId.get(template.template_id);
    const assetBindings = assetBindingsByTemplateId.get(template.template_id) ?? [];
    const outputStem = `draft-${String(index + 1).padStart(2, "0")}-${slug(template.template_family)}`;
    const recordBase = {
      schema_version: "pdf-html-render-job.v1",
      pdf_html_render_job_id: `pdf-html-render-job.${slug(template.template_id)}`,
      pdf_html_renderer_id: "pdf-html-renderer.current",
      render_job_status: "complete",
      pdf_html_render_job_status: "complete",
      renderer_mode: "local_deterministic_html_pdf",
      renderer_lane: "pdf_html_renderer",
      template_id: template.template_id,
      template_path: template.template_path,
      template_family: template.template_family,
      template_version_id: template.latest_version_id,
      template_format: template.template_format,
      pack_id: template.pack_id,
      matter_id: template.pack_id === "personal-dev" ? "matter.personal.dev" : "matter.alpha.ldd",
      style_profile_id: styleBinding?.style_profile_id ?? "style-profile.common.review-html",
      style_format: styleBinding?.style_format ?? "html",
      asset_binding_count: assetBindings.length,
      asset_binding_ids: assetBindings.map((binding) => binding.template_asset_binding_id),
      html_preview_artifact_id: `html-preview-artifact.${slug(template.template_id)}`,
      html_preview_path: path.join(outputDir, `${outputStem}.html`),
      pdf_export_artifact_id: `pdf-export-artifact.${slug(template.template_id)}`,
      pdf_export_path: path.join(outputDir, `${outputStem}.pdf`),
      output_artifact_ids: [
        `pdf-html-output-artifact.${slug(template.template_id)}.html`,
        `pdf-html-output-artifact.${slug(template.template_id)}.pdf`,
      ],
      renderer_execution_performed: true,
      local_deterministic_render_performed: true,
      document_renderer_runtime_execution_performed: false,
      external_renderer_execution_performed: false,
      network_access_performed: false,
      html_preview_write_performed: true,
      pdf_export_write_performed: true,
      format_validation_required: true,
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

function buildHtmlPreviewArtifact(job, generatedAt) {
  const htmlPayload = renderHtmlPreview(job, generatedAt);
  const recordBase = {
    schema_version: "html-preview-artifact.v1",
    html_preview_artifact_id: job.html_preview_artifact_id,
    pdf_html_render_job_id: job.pdf_html_render_job_id,
    template_id: job.template_id,
    template_family: job.template_family,
    output_artifact_id: job.output_artifact_ids[0],
    artifact_kind: "html_preview_artifact",
    output_format: "html",
    html_preview_status: "draft_generated",
    output_artifact_status: "draft_generated",
    html_preview_path: job.html_preview_path,
    html_payload: htmlPayload,
    html_payload_size_bytes: Buffer.byteLength(htmlPayload, "utf8"),
    html_payload_hash: `sha256:${hashText(htmlPayload)}`,
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    html_preview_write_performed: true,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...recordBase,
    metadata_hash: `sha256:${hashJson({ ...recordBase, html_payload: undefined, metadata_hash: undefined })}`,
  };
}

function buildPdfExportArtifact(job, htmlPreviewArtifacts, generatedAt) {
  const preview = htmlPreviewArtifacts.find((artifact) => artifact.pdf_html_render_job_id === job.pdf_html_render_job_id);
  const pdfPayload = buildPdfPayload(job, preview, generatedAt);
  const recordBase = {
    schema_version: "pdf-export-artifact.v1",
    pdf_export_artifact_id: job.pdf_export_artifact_id,
    pdf_html_render_job_id: job.pdf_html_render_job_id,
    source_html_preview_artifact_id: preview?.html_preview_artifact_id ?? null,
    template_id: job.template_id,
    template_family: job.template_family,
    output_artifact_id: job.output_artifact_ids[1],
    artifact_kind: "pdf_export_artifact",
    output_format: "pdf",
    pdf_export_status: "draft_generated",
    output_artifact_status: "draft_generated",
    pdf_export_path: job.pdf_export_path,
    pdf_payload: pdfPayload,
    pdf_binary_size_bytes: Buffer.byteLength(pdfPayload, "utf8"),
    pdf_binary_hash: `sha256:${hashText(pdfPayload)}`,
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    pdf_export_write_performed: true,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...recordBase,
    metadata_hash: `sha256:${hashJson({ ...recordBase, pdf_payload: undefined, metadata_hash: undefined })}`,
  };
}

function buildOutputArtifact(artifact, generatedAt) {
  const contentHash = artifact.output_format === "html" ? artifact.html_payload_hash : artifact.pdf_binary_hash;
  const contentSize = artifact.output_format === "html" ? artifact.html_payload_size_bytes : artifact.pdf_binary_size_bytes;
  const outputPath = artifact.output_format === "html" ? artifact.html_preview_path : artifact.pdf_export_path;
  const recordBase = {
    schema_version: "pdf-html-output-artifact.v1",
    pdf_html_output_artifact_id: artifact.output_artifact_id,
    pdf_html_render_job_id: artifact.pdf_html_render_job_id,
    source_artifact_id: artifact.html_preview_artifact_id ?? artifact.pdf_export_artifact_id,
    artifact_kind: artifact.artifact_kind,
    output_format: artifact.output_format,
    output_artifact_status: "draft_generated",
    output_artifact_path: outputPath,
    content_hash: contentHash,
    content_size_bytes: contentSize,
    html_payload: artifact.output_format === "html" ? artifact.html_payload : null,
    pdf_payload: artifact.output_format === "pdf" ? artifact.pdf_payload : null,
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
    format_validation_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    artifact_write_performed: true,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...recordBase,
    metadata_hash: `sha256:${hashJson({ ...recordBase, metadata_hash: undefined })}`,
  };
}

function buildFormatValidationResult(artifact, generatedAt) {
  const content = readEmbeddedArtifactPayload(artifact);
  const checks = artifact.output_format === "html"
    ? [
        validationCheck("doctype_present", content.toLowerCase().includes("<!doctype html>"), "HTML preview includes a doctype."),
        validationCheck("main_region_present", content.includes("<main"), "HTML preview includes a main review region."),
        validationCheck("human_review_note_present", content.includes(HUMAN_REVIEW_NOTE), "Human review note is embedded in the HTML preview."),
        validationCheck("no_external_links", !/(href|src)=["']https?:\/\//i.test(content), "HTML preview has no external href/src references."),
        validationCheck("draft_gate_preserved", artifact.human_review_required === true && artifact.attorney_review_required === true && artifact.client_facing_ready === false, "Draft gate and attorney review requirements are preserved."),
      ]
    : [
        validationCheck("pdf_header_present", content.startsWith("%PDF-1.4"), "PDF export starts with a PDF header."),
        validationCheck("pdf_eof_present", content.trimEnd().endsWith("%%EOF"), "PDF export includes an EOF marker."),
        validationCheck("human_review_note_present", content.includes(HUMAN_REVIEW_NOTE), "Human review note is embedded in the PDF export."),
        validationCheck("no_external_links", !/https?:\/\//i.test(content), "PDF export has no external URL references."),
        validationCheck("draft_gate_preserved", artifact.human_review_required === true && artifact.attorney_review_required === true && artifact.client_facing_ready === false, "Draft gate and attorney review requirements are preserved."),
      ];
  const failed = checks.filter((check) => !check.passed);
  return {
    schema_version: "pdf-html-format-validation-result.v1",
    pdf_html_format_validation_result_id: `pdf-html-format-validation.${slug(artifact.pdf_html_output_artifact_id)}`,
    pdf_html_output_artifact_id: artifact.pdf_html_output_artifact_id,
    pdf_html_render_job_id: artifact.pdf_html_render_job_id,
    output_format: artifact.output_format,
    pdf_html_format_validation_status: failed.length === 0 ? "passed" : "failed",
    validation_status: failed.length === 0 ? "passed" : "failed",
    checks,
    failed_check_count: failed.length,
    checked_content_hash: artifact.content_hash,
    generated_at: generatedAt,
  };
}

function readEmbeddedArtifactPayload(artifact) {
  if (artifact.output_format === "html") return artifact.html_payload ?? "";
  if (artifact.output_format === "pdf") return artifact.pdf_payload ?? "";
  return "";
}

function validationCheck(checkId, passed, message) {
  return {
    check_id: checkId,
    status: passed ? "passed" : "failed",
    passed,
    message,
  };
}

function buildPdfHtmlRendererBoundary({ generatedAt, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze }) {
  return {
    schema_version: "pdf-html-renderer-boundary.v1",
    boundary_status: "enforced",
    read_only_sources: true,
    local_deterministic_renderer: true,
    renderer_execution_allowed: true,
    document_renderer_runtime_execution_allowed: false,
    external_renderer_execution_allowed: false,
    network_access_allowed: false,
    html_preview_write_allowed: true,
    pdf_export_write_allowed: true,
    artifact_write_scope: "artifact_output_dir_only",
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
    document_renderer_pdf_target_supported: documentRendererAdapter?.summary?.pdf_target_supported === true,
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
  htmlTemplates,
  pdfHtmlRenderJobs,
  htmlPreviewArtifacts,
  pdfExportArtifacts,
  pdfHtmlOutputArtifacts,
  pdfHtmlFormatValidationResults,
  boundary,
}) {
  const checkpoints = [];
  checkpoints.push(checkpoint("source.asset_registry", assetRegistry?.summary?.asset_registry_status === "complete" && assetRegistry?.validation?.valid !== false, "Asset registry is complete and valid."));
  checkpoints.push(checkpoint("source.style_registry", styleRegistry?.summary?.style_registry_status === "complete" && styleRegistry?.validation?.valid !== false, "Style registry is complete and valid."));
  checkpoints.push(checkpoint("source.template_registry", templateRegistry?.summary?.template_registry_status === "complete" && templateRegistry?.validation?.valid !== false, "Template registry is complete and valid."));
  checkpoints.push(checkpoint("source.creative_document_pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.domain_pack_registry", domainPackRegistry?.validation?.valid === true && (domainPackRegistry?.summary?.pack_count ?? 0) > 0, "Domain pack registry is valid and readable."));
  checkpoints.push(checkpoint("templates.html_found", htmlTemplates.length >= 1 && htmlTemplates.every((template) => template.template_format === "html" && template.human_review_required === true), `${htmlTemplates.length} HTML template(s) are available and review-gated.`));
  checkpoints.push(checkpoint("render_jobs.complete", pdfHtmlRenderJobs.length === htmlTemplates.length && pdfHtmlRenderJobs.length > 0 && pdfHtmlRenderJobs.every((job) => job.pdf_html_render_job_status === "complete" && job.metadata_hash?.startsWith("sha256:")), `${pdfHtmlRenderJobs.filter((job) => job.pdf_html_render_job_status === "complete").length}/${pdfHtmlRenderJobs.length} PDF/HTML render job(s) completed.`));
  checkpoints.push(checkpoint("html_previews.generated", htmlPreviewArtifacts.length === pdfHtmlRenderJobs.length && htmlPreviewArtifacts.every((artifact) => artifact.html_preview_status === "draft_generated" && artifact.html_payload_hash?.startsWith("sha256:") && artifact.html_payload.includes(HUMAN_REVIEW_NOTE)), `${htmlPreviewArtifacts.length} HTML preview artifact(s) generated with review notes.`));
  checkpoints.push(checkpoint("pdf_exports.generated", pdfExportArtifacts.length === pdfHtmlRenderJobs.length && pdfExportArtifacts.every((artifact) => artifact.pdf_export_status === "draft_generated" && artifact.pdf_binary_hash?.startsWith("sha256:") && artifact.pdf_payload.startsWith("%PDF-1.4") && artifact.pdf_payload.includes(HUMAN_REVIEW_NOTE)), `${pdfExportArtifacts.length} PDF export artifact(s) generated with review notes.`));
  checkpoints.push(checkpoint("output_artifacts.draft_generated", pdfHtmlOutputArtifacts.length === pdfHtmlRenderJobs.length * 2 && pdfHtmlOutputArtifacts.every((artifact) => artifact.output_artifact_status === "draft_generated" && ["html", "pdf"].includes(artifact.output_format) && artifact.content_hash?.startsWith("sha256:") && artifact.artifact_write_performed === true), `${pdfHtmlOutputArtifacts.length} draft PDF/HTML output artifact(s) generated.`));
  checkpoints.push(checkpoint("format_validation.passed", pdfHtmlFormatValidationResults.length === pdfHtmlOutputArtifacts.length && pdfHtmlFormatValidationResults.every((result) => result.pdf_html_format_validation_status === "passed" && result.failed_check_count === 0), `${pdfHtmlFormatValidationResults.filter((result) => result.pdf_html_format_validation_status === "passed").length}/${pdfHtmlFormatValidationResults.length} PDF/HTML format validation result(s) passed.`));
  checkpoints.push(checkpoint("gates.human_attorney_review", pdfHtmlOutputArtifacts.every((artifact) => artifact.human_review_required === true && artifact.attorney_review_required === true && artifact.legal_advice_generated === false && artifact.client_facing_ready === false && artifact.client_facing_output_generated === false), "Every PDF/HTML draft remains attorney-review gated and non-client-facing."));
  checkpoints.push(checkpoint("runtime.boundary", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_runtime_execution_allowed === false, "Runtime freeze keeps Desktop execution disabled."));
  checkpoints.push(checkpoint("renderer.adapter_pdf_supported", documentRendererAdapter?.summary?.document_renderer_adapter_status === "complete" && documentRendererAdapter?.summary?.pdf_target_supported === true && documentRendererAdapter?.summary?.direct_final_delivery_allowed === false, "Document renderer adapter supports PDF while direct final delivery remains disabled."));
  checkpoints.push(checkpoint("delivery.boundary", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && boundary.delivery_execution_allowed === false, "Output delivery contract is frozen while PDF/HTML renderer delivery execution stays disabled."));
  checkpoints.push(checkpoint("boundary.enforced", boundary.boundary_status === "enforced" && boundary.local_deterministic_renderer === true && boundary.html_preview_write_allowed === true && boundary.pdf_export_write_allowed === true && boundary.document_renderer_runtime_execution_allowed === false && boundary.external_renderer_execution_allowed === false && boundary.network_access_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "PDF/HTML renderer boundary is deterministic, artifact-scoped, and delivery-blocked."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:pdf-html-renderer"]), "package.json registers creative-document:pdf-html-renderer."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P259") && roadmapText.includes("PDF/HTML renderer"), "Roadmap ledger keeps the P259 PDF/HTML renderer slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All PDF/HTML renderer source contracts were readable."));
  return checkpoints;
}

function summarizePdfHtmlRenderer({
  assetRegistry,
  styleRegistry,
  templateRegistry,
  creativeDocumentPackManifest,
  domainPackRegistry,
  runtimeFreeze,
  documentRendererAdapter,
  outputDeliveryContractFreeze,
  htmlTemplates,
  pdfHtmlRenderJobs,
  htmlPreviewArtifacts,
  pdfExportArtifacts,
  pdfHtmlOutputArtifacts,
  pdfHtmlFormatValidationResults,
  boundary,
  validation,
}) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const metadataHashCount = [...pdfHtmlRenderJobs, ...htmlPreviewArtifacts, ...pdfExportArtifacts, ...pdfHtmlOutputArtifacts].filter((record) => record.metadata_hash?.startsWith("sha256:")).length;
  return {
    pdf_html_renderer_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    pdf_html_renderer_contract_id: CONTRACT_ID,
    source_asset_registry_status: assetRegistry?.summary?.asset_registry_status ?? "missing",
    source_style_registry_status: styleRegistry?.summary?.style_registry_status ?? "missing",
    source_template_registry_status: templateRegistry?.summary?.template_registry_status ?? "missing",
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_domain_pack_registry_status: domainPackRegistry?.validation?.valid === true ? "complete" : "blocked",
    html_template_count: htmlTemplates.length,
    pdf_html_render_job_count: pdfHtmlRenderJobs.length,
    completed_render_job_count: pdfHtmlRenderJobs.filter((job) => job.pdf_html_render_job_status === "complete").length,
    html_preview_artifact_count: htmlPreviewArtifacts.length,
    generated_html_preview_artifact_count: htmlPreviewArtifacts.filter((artifact) => artifact.html_preview_status === "draft_generated").length,
    pdf_export_artifact_count: pdfExportArtifacts.length,
    generated_pdf_export_artifact_count: pdfExportArtifacts.filter((artifact) => artifact.pdf_export_status === "draft_generated").length,
    pdf_html_output_artifact_count: pdfHtmlOutputArtifacts.length,
    draft_output_artifact_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.output_artifact_status === "draft_generated").length,
    html_output_artifact_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.output_format === "html").length,
    pdf_output_artifact_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.output_format === "pdf").length,
    content_hash_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.content_hash?.startsWith("sha256:")).length,
    html_preview_write_count: htmlPreviewArtifacts.filter((artifact) => artifact.html_preview_write_performed === true).length,
    pdf_export_write_count: pdfExportArtifacts.filter((artifact) => artifact.pdf_export_write_performed === true).length,
    pdf_html_format_validation_result_count: pdfHtmlFormatValidationResults.length,
    passed_format_validation_result_count: pdfHtmlFormatValidationResults.filter((result) => result.pdf_html_format_validation_status === "passed").length,
    human_review_required_output_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.human_review_required).length,
    attorney_review_required_output_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.attorney_review_required).length,
    source_attribution_required_output_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.source_attribution_required).length,
    citation_review_required_output_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.citation_review_required).length,
    format_validation_required_output_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.format_validation_required).length,
    local_deterministic_renderer: boundary.local_deterministic_renderer,
    renderer_execution_performed: pdfHtmlRenderJobs.some((job) => job.renderer_execution_performed),
    local_deterministic_render_performed: pdfHtmlRenderJobs.some((job) => job.local_deterministic_render_performed),
    document_renderer_runtime_execution_performed: pdfHtmlRenderJobs.some((job) => job.document_renderer_runtime_execution_performed),
    external_renderer_execution_performed: pdfHtmlRenderJobs.some((job) => job.external_renderer_execution_performed),
    network_access_performed: pdfHtmlRenderJobs.some((job) => job.network_access_performed),
    artifact_write_performed: pdfHtmlOutputArtifacts.some((artifact) => artifact.artifact_write_performed),
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    delivery_execution_performed: pdfHtmlOutputArtifacts.some((artifact) => artifact.delivery_execution_performed),
    protected_action_allowed: boundary.protected_action_allowed,
    protected_action_executed: pdfHtmlOutputArtifacts.some((artifact) => artifact.protected_action_executed),
    legal_advice_generated: pdfHtmlOutputArtifacts.some((artifact) => artifact.legal_advice_generated),
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: pdfHtmlOutputArtifacts.filter((artifact) => artifact.client_facing_ready).length,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    document_renderer_pdf_target_supported: documentRendererAdapter?.summary?.pdf_target_supported === true,
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
    pdf_html_renderer_generated: true,
    draft_artifact_only: true,
    html_preview_generated: true,
    pdf_export_generated: true,
    local_deterministic_render_performed: true,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    html_preview_write_performed: true,
    pdf_export_write_performed: true,
    artifact_write_scope: "artifact_output_dir_only",
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
    schema_version: "pdf-html-renderer-checkpoint.v1",
    checkpoint_id: `pdf-html-renderer.${checkpointId}`,
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
    schema_version: "pdf-html-renderer-source-contracts.v1",
    source_artifacts: Object.fromEntries(sourceReads.map((source) => [
      source.source_id,
      contractRef(source.source_id, source),
    ])),
    package_script_registered: Boolean(packageJson.value?.scripts?.["creative-document:pdf-html-renderer"]),
    roadmap_slot_present: typeof roadmapText.value === "string" && roadmapText.value.includes("P259") && roadmapText.value.includes("PDF/HTML renderer"),
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

function renderPdfHtmlRendererMarkdown(result) {
  const lines = [];
  lines.push("# PDF/HTML Renderer");
  lines.push("");
  lines.push(`Status: ${result.summary.pdf_html_renderer_status}`);
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push("");
  lines.push(`HTML templates: ${result.summary.html_template_count}`);
  lines.push(`Render jobs: ${result.summary.completed_render_job_count}/${result.summary.pdf_html_render_job_count}`);
  lines.push(`HTML previews: ${result.summary.generated_html_preview_artifact_count}/${result.summary.html_preview_artifact_count}`);
  lines.push(`PDF exports: ${result.summary.generated_pdf_export_artifact_count}/${result.summary.pdf_export_artifact_count}`);
  lines.push(`Output artifacts: ${result.summary.draft_output_artifact_count}/${result.summary.pdf_html_output_artifact_count}`);
  lines.push(`Format validations: ${result.summary.passed_format_validation_result_count}/${result.summary.pdf_html_format_validation_result_count}`);
  lines.push("");
  lines.push("## Output Artifacts");
  for (const artifact of result.pdf_html_output_artifacts) {
    lines.push(`- ${artifact.pdf_html_output_artifact_id}: ${artifact.output_artifact_status} (${artifact.output_artifact_path})`);
  }
  lines.push("");
  lines.push(HUMAN_REVIEW_NOTE);
  return `${lines.join("\n")}\n`;
}

function renderHtmlPreview(job, generatedAt) {
  const title = `${titleCase(job.template_family)} Preview`;
  const sections = [
    ["Renderer Boundary", "This preview is generated from registered HTML template metadata and local deterministic renderer rules."],
    ["Review Gates", "Attorney review, source attribution, citation review, format validation, and human approval remain required."],
    ["Delivery State", "No client-facing release, delivery action, protected action, or legal advice is enabled."],
  ];
  const sectionHtml = sections.map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`).join("");
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "  <meta charset=\"utf-8\">",
    "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    `  <title>${escapeHtml(title)}</title>`,
    "  <style>body{font-family:Arial,sans-serif;color:#17202a;background:#fff;margin:40px;line-height:1.5}main{max-width:840px}h1{font-size:28px}h2{font-size:18px;margin-top:24px}.note{border:1px solid #94a3b8;padding:12px;background:#f8fafc}</style>",
    "</head>",
    "<body>",
    `  <main data-human-review-required=\"true\" data-client-facing-ready=\"false\" data-template-id=\"${escapeHtml(job.template_id)}\">`,
    `    <h1>${escapeHtml(title)}</h1>`,
    `    <p>Template: ${escapeHtml(job.template_path)}</p>`,
    sectionHtml,
    `    <p class=\"note\">${escapeHtml(HUMAN_REVIEW_NOTE)}</p>`,
    `    <p>Generated at: ${escapeHtml(generatedAt)}</p>`,
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}

function buildPdfPayload(job, preview, generatedAt) {
  const lines = [
    `${titleCase(job.template_family)} PDF Export`,
    `Template: ${job.template_path}`,
    `HTML source: ${preview?.html_preview_artifact_id ?? "missing"}`,
    HUMAN_REVIEW_NOTE,
    `Generated at: ${generatedAt}`,
  ];
  const text = lines.join(" | ");
  const stream = `BT /F1 11 Tf 72 720 Td (${escapePdfText(text)}) Tj ET`;
  return buildSimplePdf(stream);
}

function buildSimplePdf(stream) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index <= objects.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

function serializablePdfHtmlRenderer(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    asset_registry_path: options.assetRegistryPath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.assetRegistryPath,
    style_registry_path: options.styleRegistryPath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.styleRegistryPath,
    template_registry_path: options.templateRegistryPath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.templateRegistryPath,
    creative_document_pack_manifest_path: options.creativeDocumentPackManifestPath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.creativeDocumentPackManifestPath,
    domain_pack_registry_path: options.domainPackRegistryPath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.domainPackRegistryPath,
    runtime_freeze_path: options.runtimeFreezePath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.runtimeFreezePath,
    document_renderer_adapter_path: options.documentRendererAdapterPath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.documentRendererAdapterPath,
    output_delivery_contract_freeze_path: options.outputDeliveryContractFreezePath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.outputDeliveryContractFreezePath,
    package_path: options.packagePath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_PDF_HTML_RENDERER_INPUTS.roadmapPath,
  };
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_PDF_HTML_RENDERER_OUT_DIR,
    write: true,
    check: false,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
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
  console.log(`Usage: node scripts/creative-document-pdf-html-renderer.mjs [options]

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

function titleCase(value) {
  return String(value ?? "review")
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapePdfText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)")
    .replace(/[^\x20-\x7e]/g, "?");
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

function dateStamp(iso) {
  return iso.replace(/[-:.TZ]/g, "").slice(0, 14);
}
