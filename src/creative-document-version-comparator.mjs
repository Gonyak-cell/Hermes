import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_VERSION_COMPARATOR_OUT_DIR = "artifacts/version-comparator/latest";
export const DEFAULT_VERSION_COMPARATOR_INPUTS = {
  docxRendererPath: "artifacts/docx-renderer/latest/docx-renderer.json",
  pptxRendererPath: "artifacts/pptx-renderer/latest/pptx-renderer.json",
  pdfHtmlRendererPath: "artifacts/pdf-html-renderer/latest/pdf-html-renderer.json",
  layoutValidatorPath: "artifacts/layout-validator/latest/layout-validator.json",
  citationRendererPath: "artifacts/citation-renderer/latest/citation-renderer.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "version-comparator.v1";
const HUMAN_REVIEW_NOTE = "Document comparison artifact for attorney review. It is not legal advice, not client-facing, and not approved for delivery.";

export async function runVersionComparator(options = {}) {
  const result = await buildVersionComparator(options);
  if (options.write !== false) await writeVersionComparator(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Version comparator failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildVersionComparator(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VERSION_COMPARATOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const docxRenderer = sourceById.docx_renderer;
  const pptxRenderer = sourceById.pptx_renderer;
  const pdfHtmlRenderer = sourceById.pdf_html_renderer;
  const layoutValidator = sourceById.layout_validator;
  const citationRenderer = sourceById.citation_renderer;
  const contexts = buildDocumentVersionContexts({
    docxRenderer,
    pptxRenderer,
    pdfHtmlRenderer,
    layoutValidator,
    citationRenderer,
    generatedAt,
  });
  const documentVersionPairs = contexts.map((context, index) => buildDocumentVersionPair(context, index, generatedAt));
  const documentChangeRecords = documentVersionPairs.flatMap((pair) => buildDocumentChangeRecords(pair, generatedAt));
  const comparisonPackets = documentVersionPairs.map((pair) => buildComparisonPacket({
    pair,
    changeRecords: documentChangeRecords.filter((record) => record.document_version_pair_id === pair.document_version_pair_id),
    generatedAt,
  }));
  const boundary = buildVersionComparatorBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    docxRenderer,
    pptxRenderer,
    pdfHtmlRenderer,
    layoutValidator,
    citationRenderer,
    contexts,
    documentVersionPairs,
    documentChangeRecords,
    comparisonPackets,
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
  const summary = summarizeVersionComparator({
    docxRenderer,
    pptxRenderer,
    pdfHtmlRenderer,
    layoutValidator,
    citationRenderer,
    contexts,
    documentVersionPairs,
    documentChangeRecords,
    comparisonPackets,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    version_comparator_id: `version-comparator.${dateStamp(generatedAt)}`,
    version_comparator_status: summary.version_comparator_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    version_comparator_contract: buildContract(generatedAt),
    version_comparator_boundary: boundary,
    document_version_pairs: documentVersionPairs,
    document_change_records: documentChangeRecords,
    comparison_packets: comparisonPackets,
    version_comparator_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderVersionComparatorMarkdown(result),
  };
}

export async function writeVersionComparator(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableVersionComparator(result);
  await writeJson(path.join(outDir, "version-comparator.json"), serializable);
  await writeJson(path.join(outDir, "document-version-pairs.json"), {
    schema_version: "document-version-pairs.v1",
    generated_at: result.generated_at,
    document_version_pair_count: result.document_version_pairs.length,
    document_version_pairs: result.document_version_pairs,
  });
  await writeJson(path.join(outDir, "document-change-records.json"), {
    schema_version: "document-change-records.v1",
    generated_at: result.generated_at,
    document_change_record_count: result.document_change_records.length,
    document_change_records: result.document_change_records,
  });
  await writeJson(path.join(outDir, "comparison-packets.json"), {
    schema_version: "document-comparison-packets.v1",
    generated_at: result.generated_at,
    comparison_packet_count: result.comparison_packets.length,
    comparison_packets: result.comparison_packets,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "version-comparator-validation-report.v1",
    generated_at: result.generated_at,
    version_comparator_id: result.version_comparator_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runVersionComparatorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runVersionComparator(args);
    console.log(`Version comparator ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.version_comparator_status}`);
    console.log(`Version pairs: ${result.summary.document_version_pair_count}`);
    console.log(`Change records: ${result.summary.document_change_record_count}`);
    console.log(`Comparison packets: ${result.summary.comparison_packet_count}`);
    console.log(`Content hash changes: ${result.summary.content_hash_changed_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildDocumentVersionContexts({ docxRenderer, pptxRenderer, pdfHtmlRenderer, layoutValidator, citationRenderer, generatedAt }) {
  const layoutTargets = layoutValidator?.layout_targets ?? [];
  const layoutResultByTarget = indexBy(layoutValidator?.layout_validation_results ?? [], "layout_target_id");
  const citationPacketByTarget = indexBy(citationRenderer?.citation_render_packets ?? [], "layout_target_id");
  const lookups = buildRendererLookups({ docxRenderer, pptxRenderer, pdfHtmlRenderer });
  return layoutTargets.map((target) => {
    const artifact = lookups.artifactById.get(target.source_artifact_id) ?? {};
    const job = lookups.jobById.get(target.source_render_job_id) ?? {};
    const layoutResult = layoutResultByTarget.get(target.layout_target_id) ?? {};
    const citationPacket = citationPacketByTarget.get(target.layout_target_id) ?? {};
    return {
      generatedAt,
      target,
      artifact,
      job,
      layoutResult,
      citationPacket,
      sourceRendererStatus: target.source_renderer_status ?? sourceRendererStatus(target.source_renderer_id, { docxRenderer, pptxRenderer, pdfHtmlRenderer }),
      currentHash: target.content_hash ?? artifact.content_hash ?? artifact.docx_binary_hash ?? artifact.pptx_binary_hash ?? artifact.html_payload_hash ?? artifact.pdf_binary_hash ?? null,
      currentSizeBytes: artifact.content_size_bytes ?? artifact.docx_binary_size_bytes ?? artifact.pptx_binary_size_bytes ?? artifact.html_payload_size_bytes ?? artifact.pdf_binary_size_bytes ?? 0,
    };
  });
}

function buildRendererLookups({ docxRenderer, pptxRenderer, pdfHtmlRenderer }) {
  const artifactById = new Map();
  const jobById = new Map();
  for (const job of docxRenderer?.docx_render_jobs ?? []) jobById.set(job.docx_render_job_id, job);
  for (const job of pptxRenderer?.pptx_render_jobs ?? []) jobById.set(job.pptx_render_job_id, job);
  for (const job of pdfHtmlRenderer?.pdf_html_render_jobs ?? []) jobById.set(job.pdf_html_render_job_id, job);
  for (const artifact of docxRenderer?.docx_output_artifacts ?? []) artifactById.set(artifact.docx_output_artifact_id, artifact);
  for (const artifact of pptxRenderer?.pptx_output_artifacts ?? []) artifactById.set(artifact.pptx_output_artifact_id, artifact);
  for (const artifact of pdfHtmlRenderer?.pdf_html_output_artifacts ?? []) artifactById.set(artifact.pdf_html_output_artifact_id, artifact);
  return { artifactById, jobById };
}

function buildDocumentVersionPair(context, index, generatedAt) {
  const { target, artifact, job, layoutResult, citationPacket, sourceRendererStatus, currentHash, currentSizeBytes } = context;
  const baselineSeed = {
    source_renderer_id: target.source_renderer_id,
    source_render_job_id: target.source_render_job_id,
    source_artifact_id: target.source_artifact_id,
    template_id: job.template_id ?? artifact.template_id ?? target.source_artifact_id,
    template_version_id: job.template_version_id ?? `${job.template_id ?? target.source_artifact_id}.version.source`,
    template_family: job.template_family ?? artifact.template_family ?? "unknown",
    style_profile_id: job.style_profile_id ?? null,
    asset_binding_ids: job.asset_binding_ids ?? [],
    output_format: target.output_format,
  };
  const previousHash = `sha256:${hashJson(baselineSeed)}`;
  const pair = {
    schema_version: "document-version-pair.v1",
    document_version_pair_id: `document-version-pair.${slug(target.layout_target_id)}`,
    version_comparator_id: "version-comparator.current",
    comparison_sequence: index + 1,
    comparison_scope: "template_baseline_to_rendered_draft",
    source_renderer_id: target.source_renderer_id,
    source_renderer_status: sourceRendererStatus,
    source_render_job_id: target.source_render_job_id,
    source_artifact_id: target.source_artifact_id,
    layout_target_id: target.layout_target_id,
    output_format: target.output_format,
    output_artifact_path: target.output_artifact_path,
    previous_version: {
      schema_version: "document-draft-version.v1",
      document_version_id: `document-version.${slug(target.source_artifact_id)}.source-baseline`,
      version_role: "source_template_baseline",
      template_id: baselineSeed.template_id,
      template_version_id: baselineSeed.template_version_id,
      content_hash: previousHash,
      content_size_bytes: 0,
      version_status: "baseline_read_only",
    },
    current_version: {
      schema_version: "document-draft-version.v1",
      document_version_id: `document-version.${slug(target.source_artifact_id)}.rendered-draft`,
      version_role: "rendered_draft",
      output_artifact_id: target.source_artifact_id,
      output_artifact_status: target.output_artifact_status,
      content_hash: currentHash,
      content_size_bytes: currentSizeBytes,
      version_status: target.output_artifact_status ?? "unknown",
    },
    previous_version_hash: previousHash,
    current_version_hash: currentHash,
    baseline_to_current_hash_changed: Boolean(currentHash && previousHash !== currentHash),
    layout_validation_result_id: layoutResult.layout_validation_result_id ?? null,
    layout_validation_status: layoutResult.layout_validation_status ?? "unknown",
    citation_render_packet_id: citationPacket.citation_render_packet_id ?? null,
    citation_render_packet_status: citationPacket.citation_render_packet_status ?? "missing",
    rendered_citation_unit_count: citationPacket.rendered_citation_unit_count ?? 0,
    document_version_pair_status: currentHash && layoutResult.layout_validation_status === "passed" && citationPacket.citation_render_packet_status === "rendered_needs_review"
      ? "comparison_ready_needs_review"
      : "blocked",
    source_attribution_required: true,
    citation_review_required: true,
    currentness_review_required: true,
    format_validation_required: true,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
    generated_at: generatedAt,
  };
  return {
    ...pair,
    metadata_hash: `sha256:${hashJson(pair)}`,
  };
}

function buildDocumentChangeRecords(pair, generatedAt) {
  const base = {
    document_version_pair_id: pair.document_version_pair_id,
    layout_target_id: pair.layout_target_id,
    source_artifact_id: pair.source_artifact_id,
    output_format: pair.output_format,
    source_attribution_required: true,
    citation_review_required: true,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    generated_at: generatedAt,
  };
  return [
    changeRecord(base, {
      type: "content_hash_delta",
      status: pair.baseline_to_current_hash_changed ? "changed_needs_review" : "unchanged_needs_review",
      before: pair.previous_version_hash,
      after: pair.current_version_hash,
      reviewArea: "rendered_content",
      summary: "Rendered draft hash differs from the read-only template baseline hash and is queued for human comparison review.",
    }),
    changeRecord(base, {
      type: "layout_validation_delta",
      status: pair.layout_validation_status === "passed" ? "validated_no_layout_regression" : "blocked",
      before: "layout_not_validated",
      after: pair.layout_validation_status,
      reviewArea: "layout",
      summary: "Rendered draft is bound to the layout validation result for reviewer inspection.",
    }),
    changeRecord(base, {
      type: "citation_rendering_delta",
      status: pair.citation_render_packet_status === "rendered_needs_review" ? "citation_packet_bound_needs_review" : "blocked",
      before: "citation_packet_not_bound",
      after: `${pair.citation_render_packet_status}:${pair.rendered_citation_unit_count}`,
      reviewArea: "citations",
      summary: "Rendered draft is bound to citation render packets while currentness and source verification remain required.",
    }),
    changeRecord(base, {
      type: "review_gate_delta",
      status: pair.human_review_required && pair.attorney_review_required && !pair.client_facing_ready ? "review_gates_preserved" : "blocked",
      before: "source_baseline_review_required",
      after: "draft_human_attorney_citation_format_review_required",
      reviewArea: "approval",
      summary: "Human, attorney, citation, format, and delivery gates remain preserved for this draft comparison.",
    }),
  ];
}

function changeRecord(base, { type, status, before, after, reviewArea, summary }) {
  const record = {
    schema_version: "document-change-record.v1",
    document_change_record_id: `document-change-record.${slug(base.document_version_pair_id)}.${type}`,
    change_type: type,
    change_status: status,
    review_area: reviewArea,
    before_value: before,
    after_value: after,
    review_summary: summary,
    ...base,
  };
  return {
    ...record,
    metadata_hash: `sha256:${hashJson(record)}`,
  };
}

function buildComparisonPacket({ pair, changeRecords, generatedAt }) {
  const blockedChangeCount = changeRecords.filter((record) => record.change_status === "blocked").length;
  const packet = {
    schema_version: "document-comparison-packet.v1",
    comparison_packet_id: `comparison-packet.${slug(pair.document_version_pair_id)}`,
    document_version_pair_id: pair.document_version_pair_id,
    layout_target_id: pair.layout_target_id,
    source_artifact_id: pair.source_artifact_id,
    output_format: pair.output_format,
    comparison_packet_status: pair.document_version_pair_status === "comparison_ready_needs_review" && blockedChangeCount === 0
      ? "ready_for_attorney_review"
      : "blocked",
    change_record_count: changeRecords.length,
    content_hash_changed: pair.baseline_to_current_hash_changed,
    layout_validation_status: pair.layout_validation_status,
    citation_render_packet_status: pair.citation_render_packet_status,
    rendered_citation_unit_count: pair.rendered_citation_unit_count,
    review_summary: changeRecords.map((record) => ({
      document_change_record_id: record.document_change_record_id,
      change_type: record.change_type,
      change_status: record.change_status,
      review_area: record.review_area,
      review_summary: record.review_summary,
    })),
    source_attribution_required: true,
    citation_review_required: true,
    currentness_review_required: true,
    format_validation_required: true,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
    generated_at: generatedAt,
  };
  return {
    ...packet,
    metadata_hash: `sha256:${hashJson(packet)}`,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  sourceReads,
  docxRenderer,
  pptxRenderer,
  pdfHtmlRenderer,
  layoutValidator,
  citationRenderer,
  contexts,
  documentVersionPairs,
  documentChangeRecords,
  comparisonPackets,
  boundary,
}) {
  const sourceErrors = sourceReads.filter((source) => source.error);
  return [
    checkpoint("package_script_registered", Boolean(packageJson?.scripts?.["creative-document:version-comparator"]), "package.json registers creative-document:version-comparator."),
    checkpoint("roadmap_slot_present", typeof roadmapText === "string" && roadmapText.includes("P262"), "Final completion ledger contains the P262 planned slot."),
    checkpoint("source_artifacts_read", sourceErrors.length === 0, sourceErrors.length === 0 ? "All source artifacts are readable." : `${sourceErrors.length} source artifact(s) failed to read.`),
    checkpoint("renderer_sources_complete", docxRenderer?.summary?.docx_renderer_status === "complete" && pptxRenderer?.summary?.pptx_renderer_status === "complete" && pdfHtmlRenderer?.summary?.pdf_html_renderer_status === "complete", "DOCX, PPTX, and PDF/HTML renderer sources are complete."),
    checkpoint("layout_and_citation_sources_complete", layoutValidator?.summary?.layout_validator_status === "complete" && citationRenderer?.summary?.citation_renderer_status === "complete", "Layout validator and citation renderer sources are complete."),
    checkpoint("layout_targets_compared", contexts.length > 0 && documentVersionPairs.length === (layoutValidator?.layout_targets?.length ?? 0), "Every layout target receives a document version pair."),
    checkpoint("comparison_change_records_present", documentChangeRecords.length === documentVersionPairs.length * 4, "Each document version pair has content, layout, citation, and review-gate change records."),
    checkpoint("comparison_packets_present", comparisonPackets.length === documentVersionPairs.length, "Each document version pair has a comparison packet."),
    checkpoint("comparison_packets_review_ready", comparisonPackets.length > 0 && comparisonPackets.every((packet) => packet.comparison_packet_status === "ready_for_attorney_review"), "All comparison packets are ready for attorney review."),
    checkpoint("citation_packets_bound", documentVersionPairs.length > 0 && documentVersionPairs.every((pair) => pair.citation_render_packet_status === "rendered_needs_review" && pair.rendered_citation_unit_count > 0), "Every compared draft has a bound citation render packet."),
    checkpoint("layout_validation_bound", documentVersionPairs.length > 0 && documentVersionPairs.every((pair) => pair.layout_validation_status === "passed"), "Every compared draft is bound to a passed layout validation result."),
    checkpoint("review_gates_preserved", [...documentVersionPairs, ...comparisonPackets].every((item) => item.human_review_required && item.attorney_review_required && item.citation_review_required && !item.client_facing_ready), "Human, attorney, citation, and client-facing gates remain preserved."),
    checkpoint("comparison_boundary_enforced", boundary.version_comparison_report_only && !boundary.draft_source_mutation_allowed && !boundary.document_runtime_mutation_allowed && !boundary.delivery_execution_allowed && !boundary.protected_action_allowed, "Version comparison is report-only with draft/source/runtime/delivery/protected mutation disabled."),
    checkpoint("no_legal_or_client_output", !boundary.legal_advice_generated && !boundary.client_facing_output_generated && comparisonPackets.every((packet) => !packet.legal_advice_generated && !packet.client_facing_output_generated), "No legal advice or client-facing output is generated."),
  ];
}

function buildContract(generatedAt) {
  return {
    schema_version: "version-comparator-contract.v1",
    contract_id: CONTRACT_ID,
    comparator_scope: "creative_and_document_domain_pack_draft_versions",
    source_of_truth: "docx_pptx_pdf_html_renderers_layout_validator_and_citation_renderer",
    required_source_artifacts: [
      "docx-renderer.v1",
      "pptx-renderer.v1",
      "pdf-html-renderer.v1",
      "layout-validator.v1",
      "citation-renderer.v1",
    ],
    required_change_types: [
      "content_hash_delta",
      "layout_validation_delta",
      "citation_rendering_delta",
      "review_gate_delta",
    ],
    comparison_rule: "each rendered draft artifact is compared against its read-only template baseline and receives a reviewer packet before later design and production workflows advance",
    safety_rule: "comparison artifacts are internal review aids only and never mutate draft sources execute renderers deliver outputs perform protected actions or generate legal advice",
    human_review_rule: "every comparison packet remains human attorney citation currentness source and format review gated",
    created_at: generatedAt,
  };
}

function buildVersionComparatorBoundary(generatedAt) {
  return {
    schema_version: "version-comparator-boundary.v1",
    boundary_status: "enforced",
    read_only_sources: true,
    version_comparison_report_only: true,
    draft_source_mutation_allowed: false,
    source_artifact_mutation_allowed: false,
    document_runtime_mutation_allowed: false,
    external_renderer_execution_allowed: false,
    network_access_allowed: false,
    artifact_write_allowed: true,
    artifact_write_scope: "version_comparator_output_dir_only",
    core_registry_mutation_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    attorney_review_required: true,
    citation_currentness_review_required: true,
    source_verification_required: true,
    format_validation_required: true,
    generated_at: generatedAt,
  };
}

function summarizeVersionComparator({
  docxRenderer,
  pptxRenderer,
  pdfHtmlRenderer,
  layoutValidator,
  citationRenderer,
  contexts,
  documentVersionPairs,
  documentChangeRecords,
  comparisonPackets,
  boundary,
  validation,
}) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  return {
    version_comparator_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    version_comparator_contract_id: CONTRACT_ID,
    source_docx_renderer_status: docxRenderer?.summary?.docx_renderer_status ?? "missing",
    source_pptx_renderer_status: pptxRenderer?.summary?.pptx_renderer_status ?? "missing",
    source_pdf_html_renderer_status: pdfHtmlRenderer?.summary?.pdf_html_renderer_status ?? "missing",
    source_layout_validator_status: layoutValidator?.summary?.layout_validator_status ?? "missing",
    source_citation_renderer_status: citationRenderer?.summary?.citation_renderer_status ?? "missing",
    docx_output_artifact_count: docxRenderer?.summary?.docx_output_artifact_count ?? (docxRenderer?.docx_output_artifacts?.length ?? 0),
    pptx_output_artifact_count: pptxRenderer?.summary?.pptx_output_artifact_count ?? (pptxRenderer?.pptx_output_artifacts?.length ?? 0),
    pdf_html_output_artifact_count: pdfHtmlRenderer?.summary?.pdf_html_output_artifact_count ?? (pdfHtmlRenderer?.pdf_html_output_artifacts?.length ?? 0),
    layout_target_count: layoutValidator?.summary?.layout_target_count ?? contexts.length,
    citation_render_packet_count: citationRenderer?.summary?.citation_render_packet_count ?? 0,
    document_version_pair_count: documentVersionPairs.length,
    compared_draft_artifact_count: documentVersionPairs.length,
    document_change_record_count: documentChangeRecords.length,
    content_hash_change_record_count: documentChangeRecords.filter((record) => record.change_type === "content_hash_delta").length,
    content_hash_changed_count: documentVersionPairs.filter((pair) => pair.baseline_to_current_hash_changed).length,
    layout_validated_pair_count: documentVersionPairs.filter((pair) => pair.layout_validation_status === "passed").length,
    citation_bound_pair_count: documentVersionPairs.filter((pair) => pair.citation_render_packet_status === "rendered_needs_review").length,
    comparison_packet_count: comparisonPackets.length,
    ready_for_review_packet_count: comparisonPackets.filter((packet) => packet.comparison_packet_status === "ready_for_attorney_review").length,
    human_review_required_comparison_count: comparisonPackets.filter((packet) => packet.human_review_required).length,
    attorney_review_required_comparison_count: comparisonPackets.filter((packet) => packet.attorney_review_required).length,
    citation_review_required_comparison_count: comparisonPackets.filter((packet) => packet.citation_review_required).length,
    currentness_review_required_comparison_count: comparisonPackets.filter((packet) => packet.currentness_review_required).length,
    source_verification_required_comparison_count: comparisonPackets.filter((packet) => packet.source_attribution_required).length,
    format_validation_required_comparison_count: comparisonPackets.filter((packet) => packet.format_validation_required).length,
    version_comparison_report_only: boundary.version_comparison_report_only,
    draft_source_mutation_allowed: boundary.draft_source_mutation_allowed,
    source_artifact_mutation_allowed: boundary.source_artifact_mutation_allowed,
    document_runtime_mutation_allowed: boundary.document_runtime_mutation_allowed,
    external_renderer_execution_allowed: boundary.external_renderer_execution_allowed,
    network_access_allowed: boundary.network_access_allowed,
    artifact_write_allowed: boundary.artifact_write_allowed,
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    delivery_execution_performed: comparisonPackets.some((packet) => packet.delivery_execution_performed),
    protected_action_allowed: boundary.protected_action_allowed,
    protected_action_executed: comparisonPackets.some((packet) => packet.protected_action_executed),
    legal_advice_generated: boundary.legal_advice_generated || comparisonPackets.some((packet) => packet.legal_advice_generated),
    client_facing_output_generated: boundary.client_facing_output_generated || comparisonPackets.some((packet) => packet.client_facing_output_generated),
    client_facing_ready_count: [...documentVersionPairs, ...comparisonPackets].filter((row) => row.client_facing_ready).length,
    metadata_hash_count: [...documentVersionPairs, ...documentChangeRecords, ...comparisonPackets].filter((record) => record.metadata_hash?.startsWith("sha256:")).length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    version_comparator_generated: true,
    version_comparison_report_only: true,
    read_only_source_comparison: true,
    draft_source_mutation_performed: false,
    source_artifact_mutation_performed: false,
    document_runtime_mutation_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    artifact_write_performed: true,
    source_attribution_required: true,
    citation_review_required: true,
    citation_currentness_review_required: true,
    format_validation_required: true,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_mutation_performed: false,
    core_registry_mutation_performed: false,
    client_facing_output_generated: false,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    schema_version: "version-comparator-source-contracts.v1",
    source_artifacts: Object.fromEntries(sourceReads.map((source) => [source.source_id, {
      source_id: source.source_id,
      path: source.path,
      status: source.error ? "error" : "read",
      content_hash: source.raw ? `sha256:${hashText(source.raw)}` : null,
      error: source.error,
    }])),
    package_script_registered: Boolean(packageJson.value?.scripts?.["creative-document:version-comparator"]),
    roadmap_slot_present: typeof roadmapText.value === "string" && roadmapText.value.includes("P262"),
  };
}

async function readSourceArtifacts(inputs) {
  const sources = [
    ["docx_renderer", inputs.docx_renderer_path],
    ["pptx_renderer", inputs.pptx_renderer_path],
    ["pdf_html_renderer", inputs.pdf_html_renderer_path],
    ["layout_validator", inputs.layout_validator_path],
    ["citation_renderer", inputs.citation_renderer_path],
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

function sourceRendererStatus(sourceRendererId, { docxRenderer, pptxRenderer, pdfHtmlRenderer }) {
  if (sourceRendererId === "docx_renderer") return docxRenderer?.summary?.docx_renderer_status ?? "missing";
  if (sourceRendererId === "pptx_renderer") return pptxRenderer?.summary?.pptx_renderer_status ?? "missing";
  if (sourceRendererId === "pdf_html_renderer") return pdfHtmlRenderer?.summary?.pdf_html_renderer_status ?? "missing";
  return "unknown";
}

function indexBy(items, key) {
  const map = new Map();
  for (const item of items ?? []) {
    if (item?.[key]) map.set(item[key], item);
  }
  return map;
}

function serializableVersionComparator(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  return {
    docx_renderer_path: path.resolve(options.docxRendererPath ?? options.docx_renderer_path ?? DEFAULT_VERSION_COMPARATOR_INPUTS.docxRendererPath),
    pptx_renderer_path: path.resolve(options.pptxRendererPath ?? options.pptx_renderer_path ?? DEFAULT_VERSION_COMPARATOR_INPUTS.pptxRendererPath),
    pdf_html_renderer_path: path.resolve(options.pdfHtmlRendererPath ?? options.pdf_html_renderer_path ?? DEFAULT_VERSION_COMPARATOR_INPUTS.pdfHtmlRendererPath),
    layout_validator_path: path.resolve(options.layoutValidatorPath ?? options.layout_validator_path ?? DEFAULT_VERSION_COMPARATOR_INPUTS.layoutValidatorPath),
    citation_renderer_path: path.resolve(options.citationRendererPath ?? options.citation_renderer_path ?? DEFAULT_VERSION_COMPARATOR_INPUTS.citationRendererPath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_VERSION_COMPARATOR_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_VERSION_COMPARATOR_INPUTS.roadmapPath),
  };
}

function renderVersionComparatorMarkdown(result) {
  const lines = [];
  lines.push("# Creative Document Version Comparator");
  lines.push("");
  lines.push(`Status: ${result.summary.version_comparator_status}`);
  lines.push(`Version pairs: ${result.summary.document_version_pair_count}`);
  lines.push(`Change records: ${result.summary.document_change_record_count}`);
  lines.push(`Comparison packets: ${result.summary.comparison_packet_count}`);
  lines.push(`Content hash changes: ${result.summary.content_hash_changed_count}`);
  lines.push("");
  lines.push("- Draft outputs are compared against read-only template/source baselines using deterministic hashes and renderer metadata.");
  lines.push("- Layout validation and citation rendering bindings are included in each reviewer packet.");
  lines.push("- No draft/source mutation, document runtime mutation, network access, delivery, protected action, legal advice, or client-facing release is executed.");
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
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120);
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
    else if (arg === "--layout-validator") parsed.layoutValidatorPath = argv[++index];
    else if (arg === "--citation-renderer") parsed.citationRendererPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-version-comparator.mjs [options]

Options:
  --check                              Fail if validation does not pass.
  --no-write                           Build without writing artifacts.
  --out-dir <dir>                      Output directory.
  --docx-renderer <file>               DOCX renderer artifact.
  --pptx-renderer <file>               PPTX renderer artifact.
  --pdf-html-renderer <file>           PDF/HTML renderer artifact.
  --layout-validator <file>            Layout validator artifact.
  --citation-renderer <file>           Citation renderer artifact.
  --package <file>                     package.json path.
  --roadmap <file>                     Roadmap ledger path.
`);
}
