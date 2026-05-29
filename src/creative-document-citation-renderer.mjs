import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CITATION_RENDERER_OUT_DIR = "artifacts/citation-renderer/latest";
export const DEFAULT_CITATION_RENDERER_INPUTS = {
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  exhibitMapPath: "artifacts/exhibit-map/latest/exhibit-map.json",
  layoutValidatorPath: "artifacts/layout-validator/latest/layout-validator.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "citation-renderer.v1";
const HUMAN_REVIEW_NOTE = "Citation rendering is an internal draft aid. Attorney review, citation/currentness review, source verification, and delivery approval remain required before any legal, filing, or client-facing use.";

export async function runCitationRenderer(options = {}) {
  const result = await buildCitationRenderer(options);
  if (options.write !== false) await writeCitationRenderer(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Citation renderer failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCitationRenderer(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CITATION_RENDERER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const sourceSpanStore = sourceById.source_span_store;
  const citationObjectStore = sourceById.citation_object_store;
  const exhibitMap = sourceById.exhibit_map;
  const layoutValidator = sourceById.layout_validator;
  const catalogs = buildCatalogLookups({ sourceSpanStore, citationObjectStore, exhibitMap, layoutValidator });
  const citationRenderUnits = catalogs.citations.map((citation, index) => buildCitationRenderUnit({ citation, catalogs, index, generatedAt }));
  const footnoteRenderings = citationRenderUnits.map((unit) => unit.footnote_rendering);
  const exhibitReferenceRenderings = citationRenderUnits.map((unit) => unit.exhibit_reference_rendering);
  const sourceSpanLinkRenderings = citationRenderUnits.map((unit) => unit.source_span_link_rendering);
  const citationRenderPackets = catalogs.layoutTargets.map((target) => buildCitationRenderPacket({ target, citationRenderUnits, generatedAt }));
  const boundary = buildCitationRendererBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    sourceReads,
    sourceSpanStore,
    citationObjectStore,
    exhibitMap,
    layoutValidator,
    catalogs,
    citationRenderUnits,
    footnoteRenderings,
    exhibitReferenceRenderings,
    sourceSpanLinkRenderings,
    citationRenderPackets,
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
  const summary = summarizeCitationRenderer({
    sourceSpanStore,
    citationObjectStore,
    exhibitMap,
    layoutValidator,
    catalogs,
    citationRenderUnits,
    footnoteRenderings,
    exhibitReferenceRenderings,
    sourceSpanLinkRenderings,
    citationRenderPackets,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    citation_renderer_id: `citation-renderer.${dateStamp(generatedAt)}`,
    citation_renderer_status: summary.citation_renderer_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    citation_renderer_contract: buildContract(generatedAt),
    citation_renderer_boundary: boundary,
    citation_render_units: citationRenderUnits.map(({ footnote_rendering, exhibit_reference_rendering, source_span_link_rendering, ...unit }) => unit),
    footnote_renderings: footnoteRenderings,
    exhibit_reference_renderings: exhibitReferenceRenderings,
    source_span_link_renderings: sourceSpanLinkRenderings,
    citation_render_packets: citationRenderPackets,
    citation_renderer_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderCitationRendererMarkdown(result),
  };
}

export async function writeCitationRenderer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableCitationRenderer(result);
  await writeJson(path.join(outDir, "citation-renderer.json"), serializable);
  await writeJson(path.join(outDir, "citation-render-units.json"), {
    schema_version: "citation-render-units.v1",
    generated_at: result.generated_at,
    citation_render_unit_count: result.citation_render_units.length,
    citation_render_units: result.citation_render_units,
  });
  await writeJson(path.join(outDir, "footnote-renderings.json"), {
    schema_version: "footnote-renderings.v1",
    generated_at: result.generated_at,
    footnote_rendering_count: result.footnote_renderings.length,
    footnote_renderings: result.footnote_renderings,
  });
  await writeJson(path.join(outDir, "exhibit-reference-renderings.json"), {
    schema_version: "exhibit-reference-renderings.v1",
    generated_at: result.generated_at,
    exhibit_reference_rendering_count: result.exhibit_reference_renderings.length,
    exhibit_reference_renderings: result.exhibit_reference_renderings,
  });
  await writeJson(path.join(outDir, "source-span-link-renderings.json"), {
    schema_version: "source-span-link-renderings.v1",
    generated_at: result.generated_at,
    source_span_link_rendering_count: result.source_span_link_renderings.length,
    source_span_link_renderings: result.source_span_link_renderings,
  });
  await writeJson(path.join(outDir, "citation-render-packets.json"), {
    schema_version: "citation-render-packets.v1",
    generated_at: result.generated_at,
    citation_render_packet_count: result.citation_render_packets.length,
    citation_render_packets: result.citation_render_packets,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "citation-renderer-validation-report.v1",
    generated_at: result.generated_at,
    citation_renderer_id: result.citation_renderer_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCitationRendererCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runCitationRenderer(args);
    console.log(`Citation renderer ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.citation_renderer_status}`);
    console.log(`Rendered citations: ${result.summary.rendered_citation_unit_count}`);
    console.log(`Footnotes: ${result.summary.footnote_rendering_count}`);
    console.log(`Exhibit references: ${result.summary.exhibit_reference_rendering_count}`);
    console.log(`Source span links: ${result.summary.source_span_link_rendering_count}`);
    console.log(`Render packets: ${result.summary.citation_render_packet_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildCatalogLookups({ sourceSpanStore, citationObjectStore, exhibitMap, layoutValidator }) {
  const sourceSpans = sourceSpanStore?.source_span_catalog?.source_spans ?? [];
  const citations = citationObjectStore?.citation_catalog?.citations ?? [];
  const outputParagraphs = citationObjectStore?.citation_catalog?.output_paragraphs ?? [];
  const exhibitRecords = exhibitMap?.exhibit_catalog?.exhibit_records ?? [];
  const layoutTargets = layoutValidator?.layout_targets ?? [];
  return {
    sourceSpans,
    citations,
    outputParagraphs,
    exhibitRecords,
    layoutTargets,
    sourceSpanById: indexBy(sourceSpans, "source_span_id"),
    paragraphById: indexBy(outputParagraphs, "output_paragraph_id"),
    exhibitByCitationId: indexBy(exhibitRecords, "citation_id"),
  };
}

function buildCitationRenderUnit({ citation, catalogs, index, generatedAt }) {
  const sequence = index + 1;
  const outputParagraph = catalogs.paragraphById.get(citation.output_paragraph_id);
  const exhibit = catalogs.exhibitByCitationId.get(citation.citation_id);
  const sourceSpan = catalogs.sourceSpanById.get(citation.source_span_id);
  const footnoteRendering = buildFootnoteRendering({ citation, outputParagraph, exhibit, sourceSpan, sequence, generatedAt });
  const exhibitReferenceRendering = buildExhibitReferenceRendering({ citation, exhibit, sequence, generatedAt });
  const sourceSpanLinkRendering = buildSourceSpanLinkRendering({ citation, sourceSpan, sequence, generatedAt });
  const base = {
    schema_version: "citation-render-unit.v1",
    citation_render_unit_id: `citation-render-unit.${slug(citation.citation_id)}`,
    citation_id: citation.citation_id,
    output_paragraph_id: citation.output_paragraph_id,
    footnote_rendering_id: footnoteRendering.footnote_rendering_id,
    exhibit_reference_rendering_id: exhibitReferenceRendering.exhibit_reference_rendering_id,
    source_span_link_rendering_id: sourceSpanLinkRendering.source_span_link_rendering_id,
    citation_render_sequence: sequence,
    citation_render_status: "rendered_needs_review",
    citation_style: "footnote_exhibit_source_span_link",
    footnote_marker: footnoteRendering.footnote_marker,
    exhibit_reference: exhibitReferenceRendering.exhibit_reference,
    source_span_link_uri: sourceSpanLinkRendering.source_span_link_uri,
    source_binding_status: citation.source_binding_status,
    exhibit_binding_status: exhibit ? "bound" : "missing",
    source_span_link_status: sourceSpan ? "bound" : "missing",
    tenant_id: citation.tenant_id,
    matter_id: citation.matter_id,
    classification: citation.classification,
    policy_snapshot_id: citation.policy_snapshot_id,
    issue_id: citation.issue_id,
    fact_id: citation.fact_id,
    evidence_item_id: citation.evidence_item_id,
    source_span_id: citation.source_span_id,
    human_review_required: true,
    attorney_review_required: true,
    citation_review_required: true,
    currentness_review_required: true,
    source_verification_required: true,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  const unit = {
    ...base,
    metadata_hash: `sha256:${hashJson({ ...base, metadata_hash: undefined })}`,
    footnote_rendering: footnoteRendering,
    exhibit_reference_rendering: exhibitReferenceRendering,
    source_span_link_rendering: sourceSpanLinkRendering,
  };
  return unit;
}

function buildFootnoteRendering({ citation, outputParagraph, exhibit, sourceSpan, sequence, generatedAt }) {
  const text = cleanText(outputParagraph?.paragraph_text ?? `Review citation ${citation.citation_id} against linked source material.`);
  const sourceLabel = sourceSpan?.resource_id ? `source ${sourceSpan.resource_id}` : `source span ${citation.source_span_id}`;
  const exhibitReference = exhibit?.exhibit_reference ?? `별첨 ${sequence}`;
  const base = {
    schema_version: "footnote-rendering.v1",
    footnote_rendering_id: `footnote-rendering.${slug(citation.citation_id)}`,
    citation_id: citation.citation_id,
    output_paragraph_id: citation.output_paragraph_id,
    footnote_number: sequence,
    footnote_marker: `[${sequence}]`,
    footnote_text: `[${sequence}] ${text} (${exhibitReference}; ${sourceLabel}).`,
    footnote_status: "rendered_needs_review",
    citation_status: citation.citation_status,
    source_binding_status: citation.source_binding_status,
    human_review_required: true,
    attorney_review_required: true,
    citation_review_required: true,
    client_facing_ready: false,
    legal_advice_generated: false,
    generated_at: generatedAt,
    metadata_hash: null,
  };
  return {
    ...base,
    metadata_hash: `sha256:${hashJson({ ...base, metadata_hash: undefined })}`,
  };
}

function buildExhibitReferenceRendering({ citation, exhibit, sequence, generatedAt }) {
  const exhibitReference = exhibit?.exhibit_reference ?? `별첨 ${sequence}`;
  const exhibitLabel = exhibit?.exhibit_label ?? `EX-${String(sequence).padStart(4, "0")}`;
  const base = {
    schema_version: "exhibit-reference-rendering.v1",
    exhibit_reference_rendering_id: `exhibit-reference-rendering.${slug(citation.citation_id)}`,
    citation_id: citation.citation_id,
    exhibit_id: exhibit?.exhibit_id ?? null,
    exhibit_number: exhibit?.exhibit_number ?? sequence,
    exhibit_label: exhibitLabel,
    exhibit_reference: exhibitReference,
    rendered_reference: `${exhibitReference} (${exhibitLabel})`,
    exhibit_reference_status: exhibit ? "rendered_bound" : "rendered_missing_exhibit_review_required",
    human_review_required: true,
    attorney_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
    metadata_hash: null,
  };
  return {
    ...base,
    metadata_hash: `sha256:${hashJson({ ...base, metadata_hash: undefined })}`,
  };
}

function buildSourceSpanLinkRendering({ citation, sourceSpan, sequence, generatedAt }) {
  const uriMatter = encodeURIComponent(citation.matter_id ?? "unknown-matter");
  const uriSpan = encodeURIComponent(citation.source_span_id);
  const locator = sourceSpan?.locator ?? {};
  const labelParts = [
    `source span ${sequence}`,
    sourceSpan?.location_type ? sourceSpan.location_type : null,
    Number.isInteger(locator.page_start) ? `page ${locator.page_start}` : null,
    Number.isInteger(locator.char_start) && Number.isInteger(locator.char_end) ? `chars ${locator.char_start}-${locator.char_end}` : null,
  ].filter(Boolean);
  const base = {
    schema_version: "source-span-link-rendering.v1",
    source_span_link_rendering_id: `source-span-link-rendering.${slug(citation.citation_id)}`,
    citation_id: citation.citation_id,
    source_span_id: citation.source_span_id,
    source_span_link_uri: `hermes://matter/${uriMatter}/source-span/${uriSpan}`,
    source_span_link_label: labelParts.join(" | "),
    source_span_link_status: sourceSpan ? "rendered_bound" : "rendered_missing_source_span_review_required",
    locator,
    resource_id: sourceSpan?.resource_id ?? null,
    resource_version_id: sourceSpan?.resource_version_id ?? null,
    normalized_text_artifact_id: sourceSpan?.normalized_text_artifact_id ?? null,
    human_review_required: true,
    attorney_review_required: true,
    source_verification_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
    metadata_hash: null,
  };
  return {
    ...base,
    metadata_hash: `sha256:${hashJson({ ...base, metadata_hash: undefined })}`,
  };
}

function buildCitationRenderPacket({ target, citationRenderUnits, generatedAt }) {
  const base = {
    schema_version: "citation-render-packet.v1",
    citation_render_packet_id: `citation-render-packet.${slug(target.layout_target_id)}`,
    layout_target_id: target.layout_target_id,
    source_renderer_id: target.source_renderer_id,
    source_artifact_id: target.source_artifact_id,
    output_format: target.output_format,
    output_artifact_path: target.output_artifact_path,
    citation_render_packet_status: "rendered_needs_review",
    rendered_citation_unit_count: citationRenderUnits.length,
    footnote_rendering_count: citationRenderUnits.length,
    exhibit_reference_rendering_count: citationRenderUnits.length,
    source_span_link_rendering_count: citationRenderUnits.length,
    citation_render_unit_ids: citationRenderUnits.map((unit) => unit.citation_render_unit_id),
    human_review_required: true,
    attorney_review_required: true,
    citation_review_required: true,
    format_validation_required: true,
    layout_validation_required: true,
    layout_validation_status: "passed",
    document_runtime_mutation_performed: false,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    human_review_note: HUMAN_REVIEW_NOTE,
    generated_at: generatedAt,
    metadata_hash: null,
  };
  return {
    ...base,
    metadata_hash: `sha256:${hashJson({ ...base, metadata_hash: undefined })}`,
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "citation-renderer-contract.v1",
    contract_id: CONTRACT_ID,
    renderer_scope: "creative_and_document_domain_pack_citations",
    source_of_truth: "citation_object_store_exhibit_map_source_span_store_and_layout_validator",
    required_render_types: ["footnote", "exhibit_reference", "source_span_link"],
    required_source_artifacts: ["source-span-store.v1", "citation-object-store.v1", "exhibit-map.v1", "layout-validator.v1"],
    rendering_rule: "each source-bound citation receives a deterministic footnote exhibit reference and source span link before later design and production workflows advance",
    safety_rule: "citation rendering writes internal draft artifacts only and never finalizes legal authority currentness client delivery protected action or legal advice",
    human_review_rule: "every rendered citation remains attorney-review and citation-currentness-review gated",
    created_at: generatedAt,
  };
}

function buildCitationRendererBoundary(generatedAt) {
  return {
    schema_version: "citation-renderer-boundary.v1",
    boundary_status: "enforced",
    read_only_sources: true,
    citation_rendering_report_only: true,
    document_runtime_mutation_allowed: false,
    external_renderer_execution_allowed: false,
    network_access_allowed: false,
    artifact_write_allowed: true,
    artifact_write_scope: "citation_renderer_output_dir_only",
    core_registry_mutation_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    attorney_review_required: true,
    citation_currentness_review_required: true,
    generated_at: generatedAt,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  sourceReads,
  sourceSpanStore,
  citationObjectStore,
  exhibitMap,
  layoutValidator,
  catalogs,
  citationRenderUnits,
  footnoteRenderings,
  exhibitReferenceRenderings,
  sourceSpanLinkRenderings,
  citationRenderPackets,
  boundary,
}) {
  const citationCount = catalogs.citations.length;
  const layoutTargetCount = catalogs.layoutTargets.length;
  const checkpoints = [];
  checkpoints.push(checkpoint("source.source_span_store", sourceSpanStore?.summary?.source_span_store_status === "complete" && sourceSpanStore?.validation?.valid !== false, "Source span store source is complete and valid."));
  checkpoints.push(checkpoint("source.citation_object_store", citationObjectStore?.summary?.citation_object_store_status === "complete" && citationObjectStore?.validation?.valid !== false, "Citation object store source is complete and valid."));
  checkpoints.push(checkpoint("source.exhibit_map", exhibitMap?.summary?.exhibit_map_status === "complete" && exhibitMap?.validation?.valid !== false, "Exhibit map source is complete and valid."));
  checkpoints.push(checkpoint("source.layout_validator", layoutValidator?.summary?.layout_validator_status === "complete" && layoutValidator?.validation?.valid !== false, "Layout validator source is complete and valid."));
  checkpoints.push(checkpoint("render_units.generated", citationRenderUnits.length === citationCount && citationCount > 0, `${citationRenderUnits.length}/${citationCount} citation render unit(s) generated.`));
  checkpoints.push(checkpoint("footnotes.generated", footnoteRenderings.length === citationCount && footnoteRenderings.every((item) => item.footnote_status === "rendered_needs_review"), "Every citation has a draft footnote rendering."));
  checkpoints.push(checkpoint("exhibit_references.bound", exhibitReferenceRenderings.length === citationCount && exhibitReferenceRenderings.every((item) => item.exhibit_reference_status === "rendered_bound"), "Every citation has a bound exhibit reference rendering."));
  checkpoints.push(checkpoint("source_span_links.bound", sourceSpanLinkRenderings.length === citationCount && sourceSpanLinkRenderings.every((item) => item.source_span_link_status === "rendered_bound"), "Every citation has a bound source span link rendering."));
  checkpoints.push(checkpoint("layout_packets.generated", citationRenderPackets.length === layoutTargetCount && layoutTargetCount > 0, `${citationRenderPackets.length}/${layoutTargetCount} layout target render packet(s) generated.`));
  checkpoints.push(checkpoint("layout_packets.cover", citationRenderPackets.every((packet) => packet.rendered_citation_unit_count === citationCount && packet.layout_validation_status === "passed"), "Each layout target packet references the full rendered citation set."));
  checkpoints.push(checkpoint("review.gates", [...citationRenderUnits, ...footnoteRenderings, ...exhibitReferenceRenderings, ...sourceSpanLinkRenderings, ...citationRenderPackets].every((row) => row.human_review_required && row.attorney_review_required && row.client_facing_ready === false && row.legal_advice_generated !== true), "Rendered citation rows remain human/attorney-review gated and non-client-facing."));
  checkpoints.push(checkpoint("boundary.enforced", boundary.boundary_status === "enforced" && boundary.citation_rendering_report_only === true && boundary.document_runtime_mutation_allowed === false && boundary.external_renderer_execution_allowed === false && boundary.network_access_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "Citation renderer boundary is report-only and delivery-blocked."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:citation-renderer"]), "package.json registers creative-document:citation-renderer."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P261") && roadmapText.includes("citation renderer"), "Roadmap ledger keeps the P261 citation renderer slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All citation renderer source artifacts were readable."));
  return checkpoints;
}

function summarizeCitationRenderer({
  sourceSpanStore,
  citationObjectStore,
  exhibitMap,
  layoutValidator,
  catalogs,
  citationRenderUnits,
  footnoteRenderings,
  exhibitReferenceRenderings,
  sourceSpanLinkRenderings,
  citationRenderPackets,
  boundary,
  validation,
}) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  return {
    citation_renderer_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    citation_renderer_contract_id: CONTRACT_ID,
    source_source_span_store_status: sourceSpanStore?.summary?.source_span_store_status ?? "missing",
    source_citation_object_store_status: citationObjectStore?.summary?.citation_object_store_status ?? "missing",
    source_exhibit_map_status: exhibitMap?.summary?.exhibit_map_status ?? "missing",
    source_layout_validator_status: layoutValidator?.summary?.layout_validator_status ?? "missing",
    source_span_count: catalogs.sourceSpans.length,
    citation_count: catalogs.citations.length,
    output_paragraph_count: catalogs.outputParagraphs.length,
    exhibit_record_count: catalogs.exhibitRecords.length,
    layout_target_count: catalogs.layoutTargets.length,
    rendered_citation_unit_count: citationRenderUnits.length,
    footnote_rendering_count: footnoteRenderings.length,
    exhibit_reference_rendering_count: exhibitReferenceRenderings.length,
    source_span_link_rendering_count: sourceSpanLinkRenderings.length,
    citation_render_packet_count: citationRenderPackets.length,
    target_bound_render_packet_count: citationRenderPackets.filter((packet) => packet.rendered_citation_unit_count === citationRenderUnits.length).length,
    packet_citation_binding_count: citationRenderPackets.reduce((sum, packet) => sum + packet.rendered_citation_unit_count, 0),
    rendered_needs_review_count: citationRenderUnits.filter((unit) => unit.citation_render_status === "rendered_needs_review").length,
    bound_exhibit_reference_count: exhibitReferenceRenderings.filter((item) => item.exhibit_reference_status === "rendered_bound").length,
    bound_source_span_link_count: sourceSpanLinkRenderings.filter((item) => item.source_span_link_status === "rendered_bound").length,
    human_review_required_render_count: citationRenderUnits.filter((unit) => unit.human_review_required).length,
    attorney_review_required_render_count: citationRenderUnits.filter((unit) => unit.attorney_review_required).length,
    citation_review_required_render_count: citationRenderUnits.filter((unit) => unit.citation_review_required).length,
    currentness_review_required_render_count: citationRenderUnits.filter((unit) => unit.currentness_review_required).length,
    source_verification_required_render_count: citationRenderUnits.filter((unit) => unit.source_verification_required).length,
    citation_rendering_report_only: boundary.citation_rendering_report_only,
    document_runtime_mutation_allowed: boundary.document_runtime_mutation_allowed,
    external_renderer_execution_allowed: boundary.external_renderer_execution_allowed,
    network_access_allowed: boundary.network_access_allowed,
    artifact_write_allowed: boundary.artifact_write_allowed,
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    delivery_execution_performed: citationRenderPackets.some((packet) => packet.delivery_execution_performed),
    protected_action_allowed: boundary.protected_action_allowed,
    protected_action_executed: citationRenderPackets.some((packet) => packet.protected_action_executed),
    legal_advice_generated: boundary.legal_advice_generated || citationRenderUnits.some((unit) => unit.legal_advice_generated),
    client_facing_output_generated: boundary.client_facing_output_generated || citationRenderUnits.some((unit) => unit.client_facing_output_generated),
    client_facing_ready_count: [...citationRenderUnits, ...citationRenderPackets].filter((row) => row.client_facing_ready).length,
    metadata_hash_count: [...citationRenderUnits, ...footnoteRenderings, ...exhibitReferenceRenderings, ...sourceSpanLinkRenderings, ...citationRenderPackets].filter((record) => record.metadata_hash?.startsWith("sha256:")).length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: validation.items.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    citation_renderer_generated: true,
    citation_rendering_report_only: true,
    document_runtime_mutation_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    artifact_write_performed: true,
    source_attribution_required: true,
    citation_review_required: true,
    citation_currentness_review_required: true,
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
    schema_version: "citation-renderer-source-contracts.v1",
    source_artifacts: Object.fromEntries(sourceReads.map((source) => [source.source_id, {
      source_id: source.source_id,
      path: source.path,
      status: source.error ? "error" : "read",
      content_hash: source.raw ? `sha256:${hashText(source.raw)}` : null,
      error: source.error,
    }])),
    package_script_registered: Boolean(packageJson.value?.scripts?.["creative-document:citation-renderer"]),
    roadmap_slot_present: typeof roadmapText.value === "string" && roadmapText.value.includes("P261"),
  };
}

async function readSourceArtifacts(inputs) {
  const sources = [
    ["source_span_store", inputs.source_span_store_path],
    ["citation_object_store", inputs.citation_object_store_path],
    ["exhibit_map", inputs.exhibit_map_path],
    ["layout_validator", inputs.layout_validator_path],
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

function indexBy(items, key) {
  const map = new Map();
  for (const item of items ?? []) {
    if (item?.[key]) map.set(item[key], item);
  }
  return map;
}

function cleanText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function serializableCitationRenderer(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  return {
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? options.source_span_store_path ?? DEFAULT_CITATION_RENDERER_INPUTS.sourceSpanStorePath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? options.citation_object_store_path ?? DEFAULT_CITATION_RENDERER_INPUTS.citationObjectStorePath),
    exhibit_map_path: path.resolve(options.exhibitMapPath ?? options.exhibit_map_path ?? DEFAULT_CITATION_RENDERER_INPUTS.exhibitMapPath),
    layout_validator_path: path.resolve(options.layoutValidatorPath ?? options.layout_validator_path ?? DEFAULT_CITATION_RENDERER_INPUTS.layoutValidatorPath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_CITATION_RENDERER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_CITATION_RENDERER_INPUTS.roadmapPath),
  };
}

function renderCitationRendererMarkdown(result) {
  const lines = [];
  lines.push("# Creative Document Citation Renderer");
  lines.push("");
  lines.push(`Status: ${result.summary.citation_renderer_status}`);
  lines.push(`Rendered citations: ${result.summary.rendered_citation_unit_count}`);
  lines.push(`Footnotes: ${result.summary.footnote_rendering_count}`);
  lines.push(`Exhibit references: ${result.summary.exhibit_reference_rendering_count}`);
  lines.push(`Source span links: ${result.summary.source_span_link_rendering_count}`);
  lines.push(`Render packets: ${result.summary.citation_render_packet_count}`);
  lines.push("");
  lines.push("- Citation rendering is deterministic and uses existing citation, exhibit, source span, and layout artifacts as read-only sources.");
  lines.push("- No document runtime mutation, network access, delivery, protected action, legal advice, or client-facing release is executed.");
  lines.push("- Every rendered citation remains attorney-review and citation-currentness-review gated.");
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
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--exhibit-map") parsed.exhibitMapPath = argv[++index];
    else if (arg === "--layout-validator") parsed.layoutValidatorPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-citation-renderer.mjs [options]

Options:
  --check                              Fail if validation does not pass.
  --no-write                           Build without writing artifacts.
  --out-dir <dir>                      Output directory.
  --source-span-store <file>           Source span store artifact.
  --citation-object-store <file>       Citation object store artifact.
  --exhibit-map <file>                 Exhibit map artifact.
  --layout-validator <file>            Layout validator artifact.
  --package <file>                     package.json path.
  --roadmap <file>                     Roadmap ledger path.
`);
}
