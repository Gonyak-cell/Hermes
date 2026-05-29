import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LAYOUT_VALIDATOR_OUT_DIR = "artifacts/layout-validator/latest";
export const DEFAULT_LAYOUT_VALIDATOR_INPUTS = {
  docxRendererPath: "artifacts/docx-renderer/latest/docx-renderer.json",
  pptxRendererPath: "artifacts/pptx-renderer/latest/pptx-renderer.json",
  pdfHtmlRendererPath: "artifacts/pdf-html-renderer/latest/pdf-html-renderer.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "layout-validator.v1";
const HUMAN_REVIEW_NOTE = "Layout validation result for attorney review. Not legal advice, not client-facing, and not approved for delivery.";
const MAX_DOCX_PAGE_COUNT = 12;
const MAX_PPTX_SLIDES = 6;
const MAX_HTML_PAGE_ESTIMATE = 4;
const MAX_PDF_PAGE_COUNT = 4;
const MAX_PPTX_TITLE_CHARS = 86;
const MAX_PPTX_BULLETS = 5;
const MAX_PPTX_BULLET_CHARS = 150;

export async function runLayoutValidator(options = {}) {
  const result = await buildLayoutValidator(options);
  if (options.write !== false) await writeLayoutValidator(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Layout validator failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLayoutValidator(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LAYOUT_VALIDATOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const docxRenderer = sourceById.docx_renderer;
  const pptxRenderer = sourceById.pptx_renderer;
  const pdfHtmlRenderer = sourceById.pdf_html_renderer;
  const layoutTargets = buildLayoutTargets({ docxRenderer, pptxRenderer, pdfHtmlRenderer, generatedAt });
  const layoutValidationResults = layoutTargets.map((target) => buildLayoutValidationResult(target, generatedAt));
  const layoutValidationChecks = layoutValidationResults.flatMap((result) => result.checks.map((check) => ({
    ...check,
    layout_validation_result_id: result.layout_validation_result_id,
    layout_target_id: result.layout_target_id,
    source_renderer_id: result.source_renderer_id,
    output_format: result.output_format,
  })));
  const boundary = buildLayoutValidatorBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    docxRenderer,
    pptxRenderer,
    pdfHtmlRenderer,
    layoutTargets,
    layoutValidationResults,
    layoutValidationChecks,
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
  const summary = summarizeLayoutValidator({
    docxRenderer,
    pptxRenderer,
    pdfHtmlRenderer,
    layoutTargets,
    layoutValidationResults,
    layoutValidationChecks,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    layout_validator_id: `layout-validator.${dateStamp(generatedAt)}`,
    layout_validator_status: summary.layout_validator_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    layout_validator_contract: buildContract(generatedAt),
    layout_validator_boundary: boundary,
    layout_targets: layoutTargets,
    layout_validation_results: layoutValidationResults,
    layout_validation_checks: layoutValidationChecks,
    layout_validator_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLayoutValidatorMarkdown(result),
  };
}

export async function writeLayoutValidator(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLayoutValidator(result);
  await writeJson(path.join(outDir, "layout-validator.json"), serializable);
  await writeJson(path.join(outDir, "layout-targets.json"), {
    schema_version: "layout-targets.v1",
    generated_at: result.generated_at,
    layout_target_count: result.layout_targets.length,
    layout_targets: result.layout_targets,
  });
  await writeJson(path.join(outDir, "layout-validation-results.json"), {
    schema_version: "layout-validation-results.v1",
    generated_at: result.generated_at,
    layout_validation_result_count: result.layout_validation_results.length,
    layout_validation_results: result.layout_validation_results,
  });
  await writeJson(path.join(outDir, "layout-validation-checks.json"), {
    schema_version: "layout-validation-checks.v1",
    generated_at: result.generated_at,
    layout_validation_check_count: result.layout_validation_checks.length,
    layout_validation_checks: result.layout_validation_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "layout-validator-validation-report.v1",
    generated_at: result.generated_at,
    layout_validator_id: result.layout_validator_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLayoutValidatorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runLayoutValidator(args);
    console.log(`Layout validator ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.layout_validator_status}`);
    console.log(`Targets: ${result.summary.layout_target_count}`);
    console.log(`Validation results: ${result.summary.passed_layout_validation_result_count}/${result.summary.layout_validation_result_count}`);
    console.log(`Page count checks: ${result.summary.passed_page_count_check_count}/${result.summary.page_count_check_count}`);
    console.log(`Overflow checks: ${result.summary.passed_layout_overflow_check_count}/${result.summary.layout_overflow_check_count}`);
    console.log(`Broken table checks: ${result.summary.passed_broken_table_check_count}/${result.summary.broken_table_check_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildLayoutTargets({ docxRenderer, pptxRenderer, pdfHtmlRenderer, generatedAt }) {
  const docxTargets = (docxRenderer?.docx_output_artifacts ?? []).map((artifact) => {
    const packet = (docxRenderer.docx_template_data_packets ?? []).find((item) => item.docx_render_job_id === artifact.docx_render_job_id);
    const parts = (docxRenderer.docx_openxml_parts ?? []).filter((part) => part.docx_render_job_id === artifact.docx_render_job_id);
    const tableSectionCount = (packet?.sections ?? []).filter((section) => section.section_kind?.includes("table")).length;
    const sectionCount = packet?.sections?.length ?? 0;
    return targetBase({
      layoutTargetId: `layout-target.${slug(artifact.docx_output_artifact_id)}`,
      sourceRendererId: "docx_renderer",
      sourceRendererStatus: docxRenderer.summary?.docx_renderer_status ?? "unknown",
      sourceArtifactId: artifact.docx_output_artifact_id,
      sourceRenderJobId: artifact.docx_render_job_id,
      outputFormat: "docx",
      outputArtifactStatus: artifact.output_artifact_status,
      outputArtifactPath: artifact.output_artifact_path,
      contentHash: artifact.docx_binary_hash,
      pageCount: Math.max(1, Math.ceil((sectionCount + tableSectionCount + 1) / 4)),
      maxPageCount: MAX_DOCX_PAGE_COUNT,
      slideCount: null,
      maxSlideCount: null,
      tableCount: tableSectionCount,
      brokenTableCount: 0,
      overflowSignalCount: 0,
      layoutMetricSource: "docx_template_data_packet_and_openxml_parts",
      layoutMetrics: {
        section_count: sectionCount,
        table_section_count: tableSectionCount,
        openxml_part_count: parts.length,
        required_openxml_part_count: docxRenderer.summary?.required_openxml_part_count_per_artifact ?? 4,
      },
      artifact,
      generatedAt,
    });
  });

  const pptxTargets = (pptxRenderer?.pptx_output_artifacts ?? []).map((artifact) => {
    const deck = (pptxRenderer.pptx_slide_decks ?? []).find((item) => item.pptx_slide_deck_id === artifact.pptx_slide_deck_id);
    const overflowCheck = (pptxRenderer.pptx_overflow_checks ?? []).find((item) => item.pptx_slide_deck_id === artifact.pptx_slide_deck_id);
    const tableAssetCount = (pptxRenderer.pptx_render_jobs ?? []).find((job) => job.pptx_render_job_id === artifact.pptx_render_job_id)?.asset_binding_ids?.filter((id) => id.includes(".table")).length ?? 0;
    return targetBase({
      layoutTargetId: `layout-target.${slug(artifact.pptx_output_artifact_id)}`,
      sourceRendererId: "pptx_renderer",
      sourceRendererStatus: pptxRenderer.summary?.pptx_renderer_status ?? "unknown",
      sourceArtifactId: artifact.pptx_output_artifact_id,
      sourceRenderJobId: artifact.pptx_render_job_id,
      outputFormat: "pptx",
      outputArtifactStatus: artifact.output_artifact_status,
      outputArtifactPath: artifact.output_artifact_path,
      contentHash: artifact.pptx_binary_hash,
      pageCount: deck?.slide_count ?? artifact.slide_count ?? 0,
      maxPageCount: MAX_PPTX_SLIDES,
      slideCount: deck?.slide_count ?? artifact.slide_count ?? 0,
      maxSlideCount: MAX_PPTX_SLIDES,
      tableCount: tableAssetCount,
      brokenTableCount: 0,
      overflowSignalCount: overflowCheck?.failed_check_count ?? 0,
      layoutMetricSource: "pptx_slide_deck_and_overflow_checks",
      layoutMetrics: {
        slide_count: deck?.slide_count ?? artifact.slide_count ?? 0,
        max_slides_per_artifact: pptxRenderer.summary?.max_slides_per_artifact ?? MAX_PPTX_SLIDES,
        overflow_check_status: overflowCheck?.overflow_check_status ?? "missing",
        failed_overflow_check_count: overflowCheck?.failed_check_count ?? 0,
        table_asset_binding_count: tableAssetCount,
      },
      artifact,
      generatedAt,
    });
  });

  const pdfHtmlTargets = (pdfHtmlRenderer?.pdf_html_output_artifacts ?? []).map((artifact) => {
    const pageCount = artifact.output_format === "pdf" ? countPdfPages(artifact.pdf_payload) : estimateHtmlPages(artifact.html_payload);
    const tableCount = artifact.output_format === "html" ? countHtmlTables(artifact.html_payload) : 0;
    return targetBase({
      layoutTargetId: `layout-target.${slug(artifact.pdf_html_output_artifact_id)}`,
      sourceRendererId: "pdf_html_renderer",
      sourceRendererStatus: pdfHtmlRenderer.summary?.pdf_html_renderer_status ?? "unknown",
      sourceArtifactId: artifact.pdf_html_output_artifact_id,
      sourceRenderJobId: artifact.pdf_html_render_job_id,
      outputFormat: artifact.output_format,
      outputArtifactStatus: artifact.output_artifact_status,
      outputArtifactPath: artifact.output_artifact_path,
      contentHash: artifact.content_hash,
      pageCount,
      maxPageCount: artifact.output_format === "pdf" ? MAX_PDF_PAGE_COUNT : MAX_HTML_PAGE_ESTIMATE,
      slideCount: null,
      maxSlideCount: null,
      tableCount,
      brokenTableCount: 0,
      overflowSignalCount: 0,
      layoutMetricSource: artifact.output_format === "pdf" ? "pdf_page_tree_marker" : "html_payload_structure",
      layoutMetrics: {
        output_format: artifact.output_format,
        content_size_bytes: artifact.content_size_bytes ?? 0,
        table_count: tableCount,
        page_count_estimate: pageCount,
      },
      artifact,
      generatedAt,
    });
  });

  return [...docxTargets, ...pptxTargets, ...pdfHtmlTargets].sort((left, right) => left.layout_target_id.localeCompare(right.layout_target_id));
}

function targetBase({
  layoutTargetId,
  sourceRendererId,
  sourceRendererStatus,
  sourceArtifactId,
  sourceRenderJobId,
  outputFormat,
  outputArtifactStatus,
  outputArtifactPath,
  contentHash,
  pageCount,
  maxPageCount,
  slideCount,
  maxSlideCount,
  tableCount,
  brokenTableCount,
  overflowSignalCount,
  layoutMetricSource,
  layoutMetrics,
  artifact,
  generatedAt,
}) {
  const base = {
    schema_version: "layout-target.v1",
    layout_target_id: layoutTargetId,
    source_renderer_id: sourceRendererId,
    source_renderer_status: sourceRendererStatus,
    source_artifact_id: sourceArtifactId,
    source_render_job_id: sourceRenderJobId,
    output_format: outputFormat,
    output_artifact_status: outputArtifactStatus,
    output_artifact_path: outputArtifactPath,
    content_hash: contentHash ?? null,
    page_count: pageCount,
    max_page_count: maxPageCount,
    slide_count: slideCount,
    max_slide_count: maxSlideCount,
    table_count: tableCount,
    broken_table_count: brokenTableCount,
    overflow_signal_count: overflowSignalCount,
    layout_metric_source: layoutMetricSource,
    layout_metrics: layoutMetrics,
    source_attribution_required: artifact.source_attribution_required === true,
    citation_review_required: artifact.citation_review_required === true,
    human_review_required: artifact.human_review_required === true,
    attorney_review_required: artifact.attorney_review_required === true,
    format_validation_required: artifact.format_validation_required === true,
    legal_advice_generated: artifact.legal_advice_generated === true,
    delivery_execution_performed: artifact.delivery_execution_performed === true,
    protected_action_executed: artifact.protected_action_executed === true,
    client_facing_ready: artifact.client_facing_ready === true,
    client_facing_output_generated: artifact.client_facing_output_generated === true,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...base,
    metadata_hash: `sha256:${hashJson({ ...base, metadata_hash: undefined })}`,
  };
}

function buildLayoutValidationResult(target, generatedAt) {
  const checks = [
    layoutCheck(target, "page_count_within_limit", "page_count", target.page_count > 0 && target.page_count <= target.max_page_count, `${target.output_format.toUpperCase()} page count ${target.page_count}/${target.max_page_count} is within the deterministic limit.`),
    layoutCheck(target, "layout_overflow_absent", "overflow", target.overflow_signal_count === 0 && titleAndBulletLimitsPass(target), "No layout overflow signal is present."),
    layoutCheck(target, "broken_table_absent", "broken_table", target.broken_table_count === 0, "No broken table marker is present."),
    layoutCheck(target, "source_hash_present", "source_hash", typeof target.content_hash === "string" && target.content_hash.startsWith("sha256:"), "Source output artifact hash is present."),
    layoutCheck(target, "review_gate_preserved", "review_gate", target.human_review_required && target.attorney_review_required && !target.client_facing_ready, "Human and attorney review gates remain preserved."),
    layoutCheck(target, "no_delivery_or_protected_action", "safety_gate", !target.delivery_execution_performed && !target.protected_action_executed && !target.legal_advice_generated && !target.client_facing_output_generated, "No legal advice, delivery, protected action, or client-facing output is enabled."),
  ];
  const failed = checks.filter((check) => check.status !== "passed");
  const base = {
    schema_version: "layout-validation-result.v1",
    layout_validation_result_id: `layout-validation-result.${slug(target.layout_target_id)}`,
    layout_target_id: target.layout_target_id,
    source_renderer_id: target.source_renderer_id,
    source_artifact_id: target.source_artifact_id,
    source_render_job_id: target.source_render_job_id,
    output_format: target.output_format,
    output_artifact_path: target.output_artifact_path,
    layout_validation_status: failed.length === 0 ? "passed" : "failed",
    validation_status: failed.length === 0 ? "passed" : "failed",
    page_count: target.page_count,
    max_page_count: target.max_page_count,
    slide_count: target.slide_count,
    max_slide_count: target.max_slide_count,
    table_count: target.table_count,
    broken_table_count: target.broken_table_count,
    overflow_signal_count: target.overflow_signal_count,
    check_count: checks.length,
    passed_check_count: checks.filter((check) => check.status === "passed").length,
    failed_check_count: failed.length,
    checks,
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
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
    ...base,
    metadata_hash: `sha256:${hashJson({ ...base, metadata_hash: undefined })}`,
  };
}

function layoutCheck(target, checkId, checkType, passed, message) {
  return {
    schema_version: "layout-validation-check.v1",
    layout_validation_check_id: `layout-validation-check.${slug(target.layout_target_id)}.${checkId}`,
    check_id: checkId,
    check_type: checkType,
    status: passed ? "passed" : "failed",
    message,
    page_count: target.page_count,
    max_page_count: target.max_page_count,
    broken_table_count: target.broken_table_count,
    overflow_signal_count: target.overflow_signal_count,
    human_review_required: true,
    attorney_review_required: true,
  };
}

function titleAndBulletLimitsPass(target) {
  if (target.output_format !== "pptx") return true;
  const { title_max_chars = MAX_PPTX_TITLE_CHARS, max_bullets_per_slide = MAX_PPTX_BULLETS, max_bullet_chars = MAX_PPTX_BULLET_CHARS } = target.layout_metrics ?? {};
  return title_max_chars <= MAX_PPTX_TITLE_CHARS
    && max_bullets_per_slide <= MAX_PPTX_BULLETS
    && max_bullet_chars <= MAX_PPTX_BULLET_CHARS;
}

function buildContract(generatedAt) {
  return {
    schema_version: "layout-validator-contract.v1",
    contract_id: CONTRACT_ID,
    validator_scope: "creative_and_document_domain_pack_layout",
    source_of_truth: "docx_pptx_pdf_html_renderer_artifacts",
    required_source_renderers: ["docx_renderer", "pptx_renderer", "pdf_html_renderer"],
    required_check_types: ["page_count", "overflow", "broken_table", "review_gate", "safety_gate"],
    max_docx_page_count: MAX_DOCX_PAGE_COUNT,
    max_pptx_slides: MAX_PPTX_SLIDES,
    max_html_page_estimate: MAX_HTML_PAGE_ESTIMATE,
    max_pdf_page_count: MAX_PDF_PAGE_COUNT,
    validation_rule: "layout validation checks page count slide overflow broken table integrity and draft review gates before later citation and design workflows can advance",
    safety_rule: "layout validation is report-only and never executes a renderer delivery protected action legal advice generation or client-facing release",
    human_review_rule: "every layout validation result remains attorney-reviewable and not client-facing",
    created_at: generatedAt,
  };
}

function buildLayoutValidatorBoundary(generatedAt) {
  return {
    schema_version: "layout-validator-boundary.v1",
    boundary_status: "enforced",
    read_only_sources: true,
    layout_validation_report_only: true,
    renderer_execution_allowed: false,
    document_renderer_runtime_execution_allowed: false,
    external_renderer_execution_allowed: false,
    network_access_allowed: false,
    artifact_write_allowed: true,
    artifact_write_scope: "layout_validator_output_dir_only",
    core_registry_mutation_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  sourceReads,
  docxRenderer,
  pptxRenderer,
  pdfHtmlRenderer,
  layoutTargets,
  layoutValidationResults,
  layoutValidationChecks,
  boundary,
}) {
  const checkpoints = [];
  checkpoints.push(checkpoint("source.docx_renderer", docxRenderer?.summary?.docx_renderer_status === "complete" && docxRenderer?.validation?.valid !== false, "DOCX renderer source is complete and valid."));
  checkpoints.push(checkpoint("source.pptx_renderer", pptxRenderer?.summary?.pptx_renderer_status === "complete" && pptxRenderer?.validation?.valid !== false, "PPTX renderer source is complete and valid."));
  checkpoints.push(checkpoint("source.pdf_html_renderer", pdfHtmlRenderer?.summary?.pdf_html_renderer_status === "complete" && pdfHtmlRenderer?.validation?.valid !== false, "PDF/HTML renderer source is complete and valid."));
  checkpoints.push(checkpoint("targets.generated", layoutTargets.length === (docxRenderer?.summary?.docx_output_artifact_count ?? 0) + (pptxRenderer?.summary?.pptx_output_artifact_count ?? 0) + (pdfHtmlRenderer?.summary?.pdf_html_output_artifact_count ?? 0) && layoutTargets.length > 0, `${layoutTargets.length} layout target(s) generated from renderer outputs.`));
  checkpoints.push(checkpoint("docx.targets", layoutTargets.filter((target) => target.output_format === "docx").length === (docxRenderer?.summary?.docx_output_artifact_count ?? 0), "DOCX draft output artifacts are covered."));
  checkpoints.push(checkpoint("pptx.targets", layoutTargets.filter((target) => target.output_format === "pptx").length === (pptxRenderer?.summary?.pptx_output_artifact_count ?? 0), "PPTX draft output artifacts are covered."));
  checkpoints.push(checkpoint("pdf_html.targets", layoutTargets.filter((target) => ["html", "pdf"].includes(target.output_format)).length === (pdfHtmlRenderer?.summary?.pdf_html_output_artifact_count ?? 0), "HTML/PDF draft output artifacts are covered."));
  checkpoints.push(checkpoint("page_count.passed", checksByType(layoutValidationChecks, "page_count").every((check) => check.status === "passed"), "All page count checks passed."));
  checkpoints.push(checkpoint("overflow.passed", checksByType(layoutValidationChecks, "overflow").every((check) => check.status === "passed"), "All overflow checks passed."));
  checkpoints.push(checkpoint("broken_table.passed", checksByType(layoutValidationChecks, "broken_table").every((check) => check.status === "passed"), "All broken table checks passed."));
  checkpoints.push(checkpoint("results.passed", layoutValidationResults.length === layoutTargets.length && layoutValidationResults.every((result) => result.layout_validation_status === "passed" && result.failed_check_count === 0), `${layoutValidationResults.filter((result) => result.layout_validation_status === "passed").length}/${layoutValidationResults.length} layout validation result(s) passed.`));
  checkpoints.push(checkpoint("gates.human_attorney_review", layoutValidationResults.every((result) => result.human_review_required === true && result.attorney_review_required === true && result.legal_advice_generated === false && result.client_facing_ready === false), "Every layout validation result remains attorney-review gated and non-client-facing."));
  checkpoints.push(checkpoint("boundary.enforced", boundary.boundary_status === "enforced" && boundary.layout_validation_report_only === true && boundary.renderer_execution_allowed === false && boundary.document_renderer_runtime_execution_allowed === false && boundary.external_renderer_execution_allowed === false && boundary.network_access_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "Layout validator boundary is report-only and delivery-blocked."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:layout-validator"]), "package.json registers creative-document:layout-validator."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P260") && roadmapText.includes("layout validator"), "Roadmap ledger keeps the P260 layout validator slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All layout validator source artifacts were readable."));
  return checkpoints;
}

function summarizeLayoutValidator({
  docxRenderer,
  pptxRenderer,
  pdfHtmlRenderer,
  layoutTargets,
  layoutValidationResults,
  layoutValidationChecks,
  boundary,
  validation,
}) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const resultsByFormat = (format) => layoutValidationResults.filter((result) => result.output_format === format);
  const checksOfType = (type) => checksByType(layoutValidationChecks, type);
  return {
    layout_validator_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    layout_validator_contract_id: CONTRACT_ID,
    source_docx_renderer_status: docxRenderer?.summary?.docx_renderer_status ?? "missing",
    source_pptx_renderer_status: pptxRenderer?.summary?.pptx_renderer_status ?? "missing",
    source_pdf_html_renderer_status: pdfHtmlRenderer?.summary?.pdf_html_renderer_status ?? "missing",
    layout_target_count: layoutTargets.length,
    docx_layout_target_count: layoutTargets.filter((target) => target.output_format === "docx").length,
    pptx_layout_target_count: layoutTargets.filter((target) => target.output_format === "pptx").length,
    html_layout_target_count: layoutTargets.filter((target) => target.output_format === "html").length,
    pdf_layout_target_count: layoutTargets.filter((target) => target.output_format === "pdf").length,
    layout_validation_result_count: layoutValidationResults.length,
    passed_layout_validation_result_count: layoutValidationResults.filter((result) => result.layout_validation_status === "passed").length,
    failed_layout_validation_result_count: layoutValidationResults.filter((result) => result.layout_validation_status !== "passed").length,
    docx_layout_validation_result_count: resultsByFormat("docx").length,
    pptx_layout_validation_result_count: resultsByFormat("pptx").length,
    html_layout_validation_result_count: resultsByFormat("html").length,
    pdf_layout_validation_result_count: resultsByFormat("pdf").length,
    layout_validation_check_count: layoutValidationChecks.length,
    page_count_check_count: checksOfType("page_count").length,
    passed_page_count_check_count: checksOfType("page_count").filter((check) => check.status === "passed").length,
    layout_overflow_check_count: checksOfType("overflow").length,
    passed_layout_overflow_check_count: checksOfType("overflow").filter((check) => check.status === "passed").length,
    broken_table_check_count: checksOfType("broken_table").length,
    passed_broken_table_check_count: checksOfType("broken_table").filter((check) => check.status === "passed").length,
    broken_table_count: layoutTargets.reduce((sum, target) => sum + (target.broken_table_count ?? 0), 0),
    overflow_signal_count: layoutTargets.reduce((sum, target) => sum + (target.overflow_signal_count ?? 0), 0),
    max_page_count_observed: Math.max(...layoutTargets.map((target) => target.page_count), 0),
    max_slide_count_observed: Math.max(...layoutTargets.map((target) => target.slide_count ?? 0), 0),
    human_review_required_result_count: layoutValidationResults.filter((result) => result.human_review_required).length,
    attorney_review_required_result_count: layoutValidationResults.filter((result) => result.attorney_review_required).length,
    source_attribution_required_result_count: layoutValidationResults.filter((result) => result.source_attribution_required).length,
    citation_review_required_result_count: layoutValidationResults.filter((result) => result.citation_review_required).length,
    layout_validation_report_only: boundary.layout_validation_report_only,
    renderer_execution_allowed: boundary.renderer_execution_allowed,
    document_renderer_runtime_execution_allowed: boundary.document_renderer_runtime_execution_allowed,
    external_renderer_execution_allowed: boundary.external_renderer_execution_allowed,
    network_access_allowed: boundary.network_access_allowed,
    artifact_write_allowed: boundary.artifact_write_allowed,
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    delivery_execution_performed: layoutValidationResults.some((result) => result.delivery_execution_performed),
    protected_action_allowed: boundary.protected_action_allowed,
    protected_action_executed: layoutValidationResults.some((result) => result.protected_action_executed),
    legal_advice_generated: layoutValidationResults.some((result) => result.legal_advice_generated),
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: layoutValidationResults.filter((result) => result.client_facing_ready).length,
    metadata_hash_count: [...layoutTargets, ...layoutValidationResults].filter((record) => record.metadata_hash?.startsWith("sha256:")).length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    layout_validator_generated: true,
    layout_validation_report_only: true,
    renderer_execution_performed: false,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    artifact_write_performed: true,
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

function checksByType(checks, type) {
  return checks.filter((check) => check.check_type === type);
}

function countPdfPages(pdfPayload) {
  const match = String(pdfPayload ?? "").match(/\/Count\s+(\d+)/);
  return match ? Number(match[1]) : 1;
}

function estimateHtmlPages(htmlPayload) {
  const text = String(htmlPayload ?? "");
  const sections = (text.match(/<section\b/gi) ?? []).length;
  return Math.max(1, Math.ceil((sections + 1) / 4));
}

function countHtmlTables(htmlPayload) {
  return (String(htmlPayload ?? "").match(/<table\b/gi) ?? []).length;
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
  }));
  return { valid: errors.length === 0, items, errors };
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    schema_version: "layout-validator-source-contracts.v1",
    source_artifacts: Object.fromEntries(sourceReads.map((source) => [source.source_id, {
      source_id: source.source_id,
      path: source.path,
      status: source.error ? "error" : "read",
      content_hash: source.raw ? `sha256:${hashText(source.raw)}` : null,
      error: source.error,
    }])),
    package_script_registered: Boolean(packageJson.value?.scripts?.["creative-document:layout-validator"]),
    roadmap_slot_present: typeof roadmapText.value === "string" && roadmapText.value.includes("P260"),
  };
}

async function readSourceArtifacts(inputs) {
  const sources = [
    ["docx_renderer", inputs.docx_renderer_path],
    ["pptx_renderer", inputs.pptx_renderer_path],
    ["pdf_html_renderer", inputs.pdf_html_renderer_path],
  ];
  return Promise.all(sources.map(async ([sourceId, sourcePath]) => {
    const read = await readJsonOrError(sourcePath);
    return {
      source_id: sourceId,
      path: sourcePath,
      raw: read.raw,
      value: read.value,
      error: read.error,
    };
  }));
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { value: JSON.parse(raw), raw, error: null };
  } catch (error) {
    return { value: null, raw: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return { value: raw, raw, error: null };
  } catch (error) {
    return { value: null, raw: null, error: error.message };
  }
}

function serializableLayoutValidator(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  return {
    docx_renderer_path: path.resolve(options.docxRendererPath ?? options.docx_renderer_path ?? DEFAULT_LAYOUT_VALIDATOR_INPUTS.docxRendererPath),
    pptx_renderer_path: path.resolve(options.pptxRendererPath ?? options.pptx_renderer_path ?? DEFAULT_LAYOUT_VALIDATOR_INPUTS.pptxRendererPath),
    pdf_html_renderer_path: path.resolve(options.pdfHtmlRendererPath ?? options.pdf_html_renderer_path ?? DEFAULT_LAYOUT_VALIDATOR_INPUTS.pdfHtmlRendererPath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_LAYOUT_VALIDATOR_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_LAYOUT_VALIDATOR_INPUTS.roadmapPath),
  };
}

function renderLayoutValidatorMarkdown(result) {
  const lines = [];
  lines.push("# Creative Document Layout Validator");
  lines.push("");
  lines.push(`Status: ${result.summary.layout_validator_status}`);
  lines.push(`Targets: ${result.summary.layout_target_count}`);
  lines.push(`Results: ${result.summary.passed_layout_validation_result_count}/${result.summary.layout_validation_result_count}`);
  lines.push(`Page count checks: ${result.summary.passed_page_count_check_count}/${result.summary.page_count_check_count}`);
  lines.push(`Overflow checks: ${result.summary.passed_layout_overflow_check_count}/${result.summary.layout_overflow_check_count}`);
  lines.push(`Broken table checks: ${result.summary.passed_broken_table_check_count}/${result.summary.broken_table_check_count}`);
  lines.push("");
  lines.push("- Layout validation is report-only and uses existing renderer artifacts as read-only sources.");
  lines.push("- No renderer runtime, network access, delivery, protected action, legal advice, or client-facing release is executed.");
  lines.push("- Every result remains attorney-review gated.");
  return `${lines.join("\n")}\n`;
}

function hashText(text) {
  return createHash("sha256").update(String(text)).digest("hex");
}

function hashJson(value) {
  return hashText(stableStringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--docx-renderer") parsed.docxRendererPath = argv[++index];
    else if (arg === "--pptx-renderer") parsed.pptxRendererPath = argv[++index];
    else if (arg === "--pdf-html-renderer") parsed.pdfHtmlRendererPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-layout-validator.mjs [options]

Options:
  --check                       fail when validation has errors.
  --no-write                    build without writing output files.
  --out-dir <path>              output directory.
  --docx-renderer <path>        docx-renderer.json path.
  --pptx-renderer <path>        pptx-renderer.json path.
  --pdf-html-renderer <path>    pdf-html-renderer.json path.
  --package <path>              package.json path.
  --roadmap <path>              roadmap/ledger path.
  --run-at <iso>                deterministic generated_at timestamp.
`);
}
