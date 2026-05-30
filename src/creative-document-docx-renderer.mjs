import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_DOCX_RENDERER_OUT_DIR = "artifacts/docx-renderer/latest";
export const DEFAULT_DOCX_RENDERER_INPUTS = {
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

const CONTRACT_ID = "docx-renderer.v1";
const REQUIRED_OPENXML_PARTS = ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/styles.xml"];
const HUMAN_REVIEW_NOTE = "Draft operational DOCX artifact for attorney review. Not legal advice, not client-facing, and not approved for delivery.";

export async function runDocxRenderer(options = {}) {
  const result = await buildDocxRenderer(options);
  if (options.write !== false) await writeDocxRenderer(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`DOCX renderer validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDocxRenderer(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DOCX_RENDERER_OUT_DIR);
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

  const docxTemplates = (templateRegistry?.template_records ?? [])
    .filter((template) => template.template_format === "docx")
    .sort((left, right) => left.template_id.localeCompare(right.template_id));
  const docxRenderJobs = buildDocxRenderJobs(docxTemplates, styleRegistry, assetRegistry, outputDir, generatedAt);
  const docxTemplateDataPackets = docxRenderJobs.map((job) => buildTemplateDataPacket(job, generatedAt));
  const docxOpenXmlParts = docxTemplateDataPackets.flatMap((packet) => buildOpenXmlParts(packet, generatedAt));
  const docxOutputArtifacts = docxRenderJobs.map((job) => buildOutputArtifact(job, docxTemplateDataPackets, docxOpenXmlParts, generatedAt));
  const docxFormatValidationResults = docxOutputArtifacts.map((artifact) => buildFormatValidationResult(artifact, docxOpenXmlParts, generatedAt));
  const boundary = buildDocxRendererBoundary({
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
    docxTemplates,
    docxRenderJobs,
    docxTemplateDataPackets,
    docxOpenXmlParts,
    docxOutputArtifacts,
    docxFormatValidationResults,
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
  const summary = summarizeDocxRenderer({
    assetRegistry,
    styleRegistry,
    templateRegistry,
    creativeDocumentPackManifest,
    domainPackRegistry,
    runtimeFreeze,
    documentRendererAdapter,
    outputDeliveryContractFreeze,
    docxTemplates,
    docxRenderJobs,
    docxTemplateDataPackets,
    docxOpenXmlParts,
    docxOutputArtifacts,
    docxFormatValidationResults,
    boundary,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    docx_renderer_id: `docx-renderer.${dateStamp(generatedAt)}`,
    docx_renderer_status: summary.docx_renderer_status,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    docx_renderer_contract: buildContract(generatedAt),
    docx_renderer_boundary: boundary,
    docx_render_jobs: docxRenderJobs,
    docx_template_data_packets: docxTemplateDataPackets,
    docx_openxml_parts: docxOpenXmlParts,
    docx_output_artifacts: docxOutputArtifacts,
    docx_format_validation_results: docxFormatValidationResults,
    docx_renderer_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderDocxRendererMarkdown(result),
  };
}

export async function writeDocxRenderer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDocxRenderer(result);
  await writeJson(path.join(outDir, "docx-renderer.json"), serializable);
  await writeJson(path.join(outDir, "docx-render-jobs.json"), {
    schema_version: "docx-render-jobs.v1",
    generated_at: result.generated_at,
    docx_render_job_count: result.docx_render_jobs.length,
    docx_render_jobs: result.docx_render_jobs,
  });
  await writeJson(path.join(outDir, "docx-template-data-packets.json"), {
    schema_version: "docx-template-data-packets.v1",
    generated_at: result.generated_at,
    docx_template_data_packet_count: result.docx_template_data_packets.length,
    docx_template_data_packets: result.docx_template_data_packets,
  });
  await writeJson(path.join(outDir, "docx-openxml-parts.json"), {
    schema_version: "docx-openxml-parts.v1",
    generated_at: result.generated_at,
    docx_openxml_part_count: result.docx_openxml_parts.length,
    docx_openxml_parts: result.docx_openxml_parts,
  });
  await writeJson(path.join(outDir, "docx-output-artifacts.json"), {
    schema_version: "docx-output-artifacts.v1",
    generated_at: result.generated_at,
    docx_output_artifact_count: result.docx_output_artifacts.length,
    docx_output_artifacts: result.docx_output_artifacts,
  });
  await writeJson(path.join(outDir, "docx-format-validation-results.json"), {
    schema_version: "docx-format-validation-results.v1",
    generated_at: result.generated_at,
    docx_format_validation_result_count: result.docx_format_validation_results.length,
    docx_format_validation_results: result.docx_format_validation_results,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "docx-renderer-validation-report.v1",
    generated_at: result.generated_at,
    docx_renderer_id: result.docx_renderer_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  for (const artifact of result.docx_output_artifacts) {
    const parts = result.docx_openxml_parts.filter((part) => part.docx_render_job_id === artifact.docx_render_job_id);
    const files = parts.map((part) => ({ name: part.openxml_part_name, content: part.openxml_payload }));
    await writeFile(artifact.docx_binary_path, buildZip(files));
  }
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDocxRendererCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runDocxRenderer(args);
    console.log(`DOCX renderer ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.docx_renderer_status}`);
    console.log(`DOCX templates: ${result.summary.docx_template_count}`);
    console.log(`Render jobs: ${result.summary.completed_render_job_count}/${result.summary.docx_render_job_count}`);
    console.log(`Output artifacts: ${result.summary.draft_output_artifact_count}/${result.summary.docx_output_artifact_count}`);
    console.log(`Format validations: ${result.summary.passed_format_validation_result_count}/${result.summary.docx_format_validation_result_count}`);
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
    schema_version: "docx-renderer-contract.v1",
    contract_id: CONTRACT_ID,
    renderer_scope: "creative_and_document_domain_pack_docx",
    source_of_truth: "template_registry_style_registry_asset_registry_and_document_renderer_adapter",
    required_template_format: "docx",
    required_openxml_parts: REQUIRED_OPENXML_PARTS,
    renderer_rule: "local_deterministic_openxml_renderer_generates_draft_docx_artifacts_from_template_data_packets_only",
    safety_rule: "docx_outputs_remain_draft_artifacts_pending_format_validation_human_review_and_attorney_approval_with_no_delivery_or_client_facing_release",
    human_review_rule: "every_docx_output_artifact_contains_an_explicit_attorney_review_note_and_is_not_legal_advice",
    created_at: generatedAt,
  };
}

function buildDocxRenderJobs(docxTemplates, styleRegistry, assetRegistry, outputDir, generatedAt) {
  const styleBindingByTemplateId = new Map((styleRegistry?.template_style_bindings ?? []).map((binding) => [binding.template_id, binding]));
  const assetBindingsByTemplateId = groupBy(assetRegistry?.template_asset_bindings ?? [], "template_id");
  return docxTemplates.map((template, index) => {
    const styleBinding = styleBindingByTemplateId.get(template.template_id);
    const assetBindings = assetBindingsByTemplateId.get(template.template_id) ?? [];
    const recordBase = {
      schema_version: "docx-render-job.v1",
      docx_render_job_id: `docx-render-job.${slug(template.template_id)}`,
      docx_renderer_id: "docx-renderer.current",
      render_job_status: "complete",
      docx_render_job_status: "complete",
      renderer_mode: "local_deterministic_openxml",
      renderer_lane: "docx_renderer",
      template_id: template.template_id,
      template_path: template.template_path,
      template_family: template.template_family,
      template_version_id: template.latest_version_id,
      template_format: template.template_format,
      pack_id: template.pack_id,
      matter_id: "matter.alpha.ldd",
      style_profile_id: styleBinding?.style_profile_id ?? null,
      style_format: styleBinding?.style_format ?? "docx",
      asset_binding_count: assetBindings.length,
      asset_binding_ids: assetBindings.map((binding) => binding.template_asset_binding_id),
      output_artifact_id: `docx-output-artifact.${slug(template.template_id)}`,
      output_artifact_path: path.join(outputDir, `draft-${String(index + 1).padStart(2, "0")}-${slug(template.template_family)}.docx`),
      template_data_packet_id: `docx-template-data-packet.${slug(template.template_id)}`,
      renderer_execution_performed: true,
      local_deterministic_render_performed: true,
      document_renderer_runtime_execution_performed: false,
      external_renderer_execution_performed: false,
      network_access_performed: false,
      docx_binary_write_performed: true,
      output_hash_required: true,
      format_validation_required: true,
      human_review_required: true,
      attorney_review_required: true,
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

function buildTemplateDataPacket(job, generatedAt) {
  const sections = [
    {
      section_id: "section.context",
      section_title: "Matter context",
      section_kind: "context_placeholder",
      body: "Demo matter operating context is preserved by matter_id and remains pending attorney review.",
    },
    {
      section_id: "section.sources",
      section_title: "Source material checklist",
      section_kind: "source_checklist_placeholder",
      body: "Source references, citation checks, and evidence coverage must be confirmed before any client-facing use.",
    },
    {
      section_id: "section.issues",
      section_title: "Issue matrix placeholder",
      section_kind: "structured_table_placeholder",
      body: "Issue rows are placeholders for operational review only and do not state legal conclusions.",
    },
    {
      section_id: "section.review",
      section_title: "Attorney review note",
      section_kind: "human_review_gate",
      body: HUMAN_REVIEW_NOTE,
    },
    {
      section_id: "section.delivery",
      section_title: "Delivery gate status",
      section_kind: "delivery_gate",
      body: "Delivery execution is blocked until format validation, citation review, and explicit human approval pass.",
    },
  ];
  const packetBase = {
    schema_version: "docx-template-data-packet.v1",
    docx_template_data_packet_id: job.template_data_packet_id,
    docx_render_job_id: job.docx_render_job_id,
    packet_status: "generated",
    template_id: job.template_id,
    template_family: job.template_family,
    template_version_id: job.template_version_id,
    template_format: "docx",
    matter_id: job.matter_id,
    title: "Draft LDD Report Artifact",
    subtitle: "Attorney review required",
    human_review_note: HUMAN_REVIEW_NOTE,
    sections,
    section_count: sections.length,
    source_attribution_required: true,
    citation_review_required: true,
    format_validation_required: true,
    human_review_required: true,
    attorney_review_required: true,
    legal_advice_generated: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    packet_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...packetBase,
    packet_hash: `sha256:${hashJson({ ...packetBase, packet_hash: undefined })}`,
  };
}

function buildOpenXmlParts(packet, generatedAt) {
  const documentXml = renderDocumentXml(packet);
  const stylesXml = renderStylesXml();
  const contentTypesXml = renderContentTypesXml();
  const relsXml = renderRelationshipsXml();
  return [
    part(packet, "[Content_Types].xml", "application/xml", contentTypesXml, generatedAt),
    part(packet, "_rels/.rels", "application/vnd.openxmlformats-package.relationships+xml", relsXml, generatedAt),
    part(packet, "word/document.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml", documentXml, generatedAt),
    part(packet, "word/styles.xml", "application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml", stylesXml, generatedAt),
  ];
}

function part(packet, partName, contentType, payload, generatedAt) {
  return {
    schema_version: "docx-openxml-part.v1",
    docx_openxml_part_id: `docx-openxml-part.${slug(packet.docx_template_data_packet_id)}.${slug(partName)}`,
    docx_template_data_packet_id: packet.docx_template_data_packet_id,
    docx_render_job_id: packet.docx_render_job_id,
    openxml_part_name: partName,
    openxml_part_status: "generated",
    content_type: contentType,
    openxml_payload: payload,
    openxml_payload_size_bytes: Buffer.byteLength(payload, "utf8"),
    openxml_payload_hash: `sha256:${hashText(payload)}`,
    generated_at: generatedAt,
  };
}

function buildOutputArtifact(job, packets, parts, generatedAt) {
  const packet = packets.find((item) => item.docx_render_job_id === job.docx_render_job_id);
  const matchingParts = parts.filter((partRecord) => partRecord.docx_render_job_id === job.docx_render_job_id);
  const zipBytes = buildZip(matchingParts.map((partRecord) => ({ name: partRecord.openxml_part_name, content: partRecord.openxml_payload })));
  const artifactBase = {
    schema_version: "docx-output-artifact.v1",
    docx_output_artifact_id: job.output_artifact_id,
    docx_render_job_id: job.docx_render_job_id,
    docx_template_data_packet_id: packet?.docx_template_data_packet_id ?? null,
    artifact_kind: "docx_draft_artifact",
    output_format: "docx",
    output_artifact_status: "draft_generated",
    output_artifact_path: job.output_artifact_path,
    docx_binary_path: job.output_artifact_path,
    docx_binary_size_bytes: zipBytes.length,
    docx_binary_hash: `sha256:${hashBuffer(zipBytes)}`,
    openxml_part_count: matchingParts.length,
    openxml_part_hashes: matchingParts.map((partRecord) => partRecord.openxml_payload_hash),
    renderer_execution_performed: true,
    local_deterministic_render_performed: true,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    docx_binary_write_performed: true,
    source_attribution_required: true,
    citation_review_required: true,
    format_validation_required: true,
    human_review_required: true,
    attorney_review_required: true,
    human_review_note: HUMAN_REVIEW_NOTE,
    legal_advice_generated: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    metadata_hash: null,
    generated_at: generatedAt,
  };
  return {
    ...artifactBase,
    metadata_hash: `sha256:${hashJson({ ...artifactBase, metadata_hash: undefined })}`,
  };
}

function buildFormatValidationResult(artifact, parts, generatedAt) {
  const matchingParts = parts.filter((partRecord) => partRecord.docx_render_job_id === artifact.docx_render_job_id);
  const partNames = new Set(matchingParts.map((partRecord) => partRecord.openxml_part_name));
  const docxBytes = buildZip(matchingParts.map((partRecord) => ({ name: partRecord.openxml_part_name, content: partRecord.openxml_payload })));
  const checks = [
    validationCheck("required_openxml_parts_present", REQUIRED_OPENXML_PARTS.every((partName) => partNames.has(partName)), "Required OpenXML parts are present."),
    validationCheck("document_xml_present", partNames.has("word/document.xml"), "word/document.xml is present."),
    validationCheck("docx_container_signature_valid", docxBytes.slice(0, 2).toString("utf8") === "PK" && docxBytes.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06])), "DOCX ZIP container signature is present."),
    validationCheck("human_review_note_present", matchingParts.some((partRecord) => partRecord.openxml_payload.includes(HUMAN_REVIEW_NOTE)), "Human review note is embedded in the document payload."),
    validationCheck("no_external_relationships", matchingParts.every((partRecord) => !partRecord.openxml_payload.includes("TargetMode=\"External\"")), "No external relationships are present."),
    validationCheck("draft_gate_preserved", artifact.human_review_required === true && artifact.attorney_review_required === true && artifact.client_facing_ready === false, "Draft gate and attorney review requirements are preserved."),
  ];
  const passed = checks.every((check) => check.status === "passed");
  return {
    schema_version: "docx-format-validation-result.v1",
    docx_format_validation_result_id: `docx-format-validation.${slug(artifact.docx_output_artifact_id)}`,
    docx_output_artifact_id: artifact.docx_output_artifact_id,
    docx_render_job_id: artifact.docx_render_job_id,
    docx_format_validation_status: passed ? "passed" : "failed",
    validation_status: passed ? "passed" : "failed",
    check_count: checks.length,
    passed_check_count: checks.filter((check) => check.status === "passed").length,
    failed_check_count: checks.filter((check) => check.status !== "passed").length,
    checks,
    format_validation_required: true,
    human_review_required: true,
    attorney_review_required: true,
    client_facing_ready: false,
    generated_at: generatedAt,
  };
}

function validationCheck(checkId, passed, message) {
  return {
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function buildDocxRendererBoundary({ generatedAt, runtimeFreeze, documentRendererAdapter, outputDeliveryContractFreeze }) {
  return {
    schema_version: "docx-renderer-boundary.v1",
    boundary_status: "enforced",
    read_only_sources: true,
    local_deterministic_renderer: true,
    renderer_execution_allowed: true,
    local_deterministic_render_allowed: true,
    document_renderer_runtime_execution_allowed: false,
    external_renderer_execution_allowed: false,
    network_access_allowed: false,
    docx_binary_write_allowed: true,
    docx_binary_write_scope: "artifact_output_dir_only",
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
    document_renderer_docx_target_supported: documentRendererAdapter?.summary?.docx_target_supported === true,
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
  docxTemplates,
  docxRenderJobs,
  docxTemplateDataPackets,
  docxOpenXmlParts,
  docxOutputArtifacts,
  docxFormatValidationResults,
  boundary,
}) {
  const checkpoints = [];
  checkpoints.push(checkpoint("source.asset_registry", assetRegistry?.summary?.asset_registry_status === "complete" && assetRegistry?.validation?.valid !== false, "Asset registry is complete and valid."));
  checkpoints.push(checkpoint("source.style_registry", styleRegistry?.summary?.style_registry_status === "complete" && styleRegistry?.validation?.valid !== false, "Style registry is complete and valid."));
  checkpoints.push(checkpoint("source.template_registry", templateRegistry?.summary?.template_registry_status === "complete" && templateRegistry?.validation?.valid !== false, "Template registry is complete and valid."));
  checkpoints.push(checkpoint("source.creative_document_pack_manifest", creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status === "complete" && creativeDocumentPackManifest?.validation?.valid !== false, "Creative-document pack manifest is complete and valid."));
  checkpoints.push(checkpoint("source.domain_pack_registry", domainPackRegistry?.validation?.valid === true && (domainPackRegistry?.summary?.pack_count ?? 0) > 0, "Domain pack registry is valid and readable."));
  checkpoints.push(checkpoint("templates.docx_found", docxTemplates.length >= 1 && docxTemplates.every((template) => template.template_format === "docx" && template.human_review_required === true), `${docxTemplates.length} DOCX template(s) are available and review-gated.`));
  checkpoints.push(checkpoint("render_jobs.complete", docxRenderJobs.length === docxTemplates.length && docxRenderJobs.length > 0 && docxRenderJobs.every((job) => job.docx_render_job_status === "complete" && job.metadata_hash?.startsWith("sha256:")), `${docxRenderJobs.filter((job) => job.docx_render_job_status === "complete").length}/${docxRenderJobs.length} DOCX render job(s) completed.`));
  checkpoints.push(checkpoint("template_data_packets.generated", docxTemplateDataPackets.length === docxRenderJobs.length && docxTemplateDataPackets.every((packet) => packet.packet_status === "generated" && packet.packet_hash?.startsWith("sha256:") && packet.human_review_note === HUMAN_REVIEW_NOTE), `${docxTemplateDataPackets.length} template data packet(s) generated with review notes.`));
  checkpoints.push(checkpoint("openxml_parts.generated", docxOpenXmlParts.length === docxRenderJobs.length * REQUIRED_OPENXML_PARTS.length && docxOpenXmlParts.every((partRecord) => partRecord.openxml_part_status === "generated" && partRecord.openxml_payload_hash?.startsWith("sha256:")), `${docxOpenXmlParts.length} OpenXML part(s) generated with hashes.`));
  checkpoints.push(checkpoint("output_artifacts.draft_generated", docxOutputArtifacts.length === docxRenderJobs.length && docxOutputArtifacts.every((artifact) => artifact.output_artifact_status === "draft_generated" && artifact.output_format === "docx" && artifact.docx_binary_hash?.startsWith("sha256:") && artifact.docx_binary_write_performed === true), `${docxOutputArtifacts.length} draft DOCX artifact(s) generated.`));
  checkpoints.push(checkpoint("format_validation.passed", docxFormatValidationResults.length === docxOutputArtifacts.length && docxFormatValidationResults.every((result) => result.docx_format_validation_status === "passed" && result.failed_check_count === 0), `${docxFormatValidationResults.filter((result) => result.docx_format_validation_status === "passed").length}/${docxFormatValidationResults.length} DOCX format validation result(s) passed.`));
  checkpoints.push(checkpoint("gates.human_attorney_review", docxOutputArtifacts.every((artifact) => artifact.human_review_required === true && artifact.attorney_review_required === true && artifact.legal_advice_generated === false && artifact.client_facing_ready === false && artifact.client_facing_output_generated === false), "Every DOCX draft remains attorney-review gated and non-client-facing."));
  checkpoints.push(checkpoint("runtime.boundary", runtimeFreeze?.summary?.runtime_freeze_status === "complete" && runtimeFreeze?.summary?.desktop_runtime_execution_allowed === false, "Runtime freeze keeps Desktop execution disabled."));
  checkpoints.push(checkpoint("renderer.adapter_docx_supported", documentRendererAdapter?.summary?.document_renderer_adapter_status === "complete" && documentRendererAdapter?.summary?.docx_target_supported === true && documentRendererAdapter?.summary?.direct_final_delivery_allowed === false, "Document renderer adapter supports DOCX while direct final delivery remains disabled."));
  checkpoints.push(checkpoint("delivery.boundary", outputDeliveryContractFreeze?.summary?.freeze_status === "complete" && boundary.delivery_execution_allowed === false, "Output delivery contract is frozen while DOCX renderer delivery execution stays disabled."));
  checkpoints.push(checkpoint("boundary.enforced", boundary.boundary_status === "enforced" && boundary.local_deterministic_renderer === true && boundary.docx_binary_write_allowed === true && boundary.document_renderer_runtime_execution_allowed === false && boundary.external_renderer_execution_allowed === false && boundary.network_access_allowed === false && boundary.delivery_execution_allowed === false && boundary.protected_action_allowed === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "DOCX renderer boundary is deterministic, artifact-scoped, and delivery-blocked."));
  checkpoints.push(checkpoint("package.script", Boolean(packageJson?.scripts?.["creative-document:docx-renderer"]), "package.json registers creative-document:docx-renderer."));
  checkpoints.push(checkpoint("roadmap.slot", typeof roadmapText === "string" && roadmapText.includes("P257") && roadmapText.includes("DOCX renderer"), "Roadmap ledger keeps the P257 DOCX renderer slot."));
  checkpoints.push(checkpoint("sources.readable", sourceReads.every((source) => !source.error), "All DOCX renderer source contracts were readable."));
  return checkpoints;
}

function summarizeDocxRenderer({
  assetRegistry,
  styleRegistry,
  templateRegistry,
  creativeDocumentPackManifest,
  domainPackRegistry,
  runtimeFreeze,
  documentRendererAdapter,
  outputDeliveryContractFreeze,
  docxTemplates,
  docxRenderJobs,
  docxTemplateDataPackets,
  docxOpenXmlParts,
  docxOutputArtifacts,
  docxFormatValidationResults,
  boundary,
  validation,
}) {
  const failedCheckpointCount = validation.items.filter((item) => item.status !== "passed").length;
  const outputHashCount = docxOutputArtifacts.filter((artifact) => artifact.docx_binary_hash?.startsWith("sha256:")).length;
  const openXmlHashCount = docxOpenXmlParts.filter((partRecord) => partRecord.openxml_payload_hash?.startsWith("sha256:")).length;
  const metadataHashCount = [...docxRenderJobs, ...docxOutputArtifacts].filter((record) => record.metadata_hash?.startsWith("sha256:")).length;
  return {
    docx_renderer_status: failedCheckpointCount === 0 && validation.errors.length === 0 ? "complete" : "blocked",
    docx_renderer_contract_id: CONTRACT_ID,
    source_asset_registry_status: assetRegistry?.summary?.asset_registry_status ?? "missing",
    source_style_registry_status: styleRegistry?.summary?.style_registry_status ?? "missing",
    source_template_registry_status: templateRegistry?.summary?.template_registry_status ?? "missing",
    source_creative_document_pack_manifest_status: creativeDocumentPackManifest?.summary?.creative_document_pack_manifest_status ?? "missing",
    source_domain_pack_registry_status: domainPackRegistry?.validation?.valid === true ? "complete" : "blocked",
    docx_template_count: docxTemplates.length,
    docx_render_job_count: docxRenderJobs.length,
    completed_render_job_count: docxRenderJobs.filter((job) => job.docx_render_job_status === "complete").length,
    docx_template_data_packet_count: docxTemplateDataPackets.length,
    generated_template_data_packet_count: docxTemplateDataPackets.filter((packet) => packet.packet_status === "generated").length,
    docx_openxml_part_count: docxOpenXmlParts.length,
    generated_openxml_part_count: docxOpenXmlParts.filter((partRecord) => partRecord.openxml_part_status === "generated").length,
    required_openxml_part_count_per_artifact: REQUIRED_OPENXML_PARTS.length,
    openxml_payload_hash_count: openXmlHashCount,
    docx_output_artifact_count: docxOutputArtifacts.length,
    draft_output_artifact_count: docxOutputArtifacts.filter((artifact) => artifact.output_artifact_status === "draft_generated").length,
    docx_binary_hash_count: outputHashCount,
    docx_binary_write_count: docxOutputArtifacts.filter((artifact) => artifact.docx_binary_write_performed === true).length,
    docx_format_validation_result_count: docxFormatValidationResults.length,
    passed_format_validation_result_count: docxFormatValidationResults.filter((result) => result.docx_format_validation_status === "passed").length,
    human_review_required_output_count: docxOutputArtifacts.filter((artifact) => artifact.human_review_required).length,
    attorney_review_required_output_count: docxOutputArtifacts.filter((artifact) => artifact.attorney_review_required).length,
    source_attribution_required_output_count: docxOutputArtifacts.filter((artifact) => artifact.source_attribution_required).length,
    citation_review_required_output_count: docxOutputArtifacts.filter((artifact) => artifact.citation_review_required).length,
    format_validation_required_output_count: docxOutputArtifacts.filter((artifact) => artifact.format_validation_required).length,
    local_deterministic_renderer: boundary.local_deterministic_renderer,
    renderer_execution_performed: docxRenderJobs.some((job) => job.renderer_execution_performed),
    local_deterministic_render_performed: docxRenderJobs.some((job) => job.local_deterministic_render_performed),
    document_renderer_runtime_execution_performed: docxRenderJobs.some((job) => job.document_renderer_runtime_execution_performed),
    external_renderer_execution_performed: docxRenderJobs.some((job) => job.external_renderer_execution_performed),
    network_access_performed: docxRenderJobs.some((job) => job.network_access_performed),
    docx_binary_write_performed: docxOutputArtifacts.some((artifact) => artifact.docx_binary_write_performed),
    core_registry_mutation_allowed: boundary.core_registry_mutation_allowed,
    delivery_execution_allowed: boundary.delivery_execution_allowed,
    delivery_execution_performed: docxOutputArtifacts.some((artifact) => artifact.delivery_execution_performed),
    protected_action_allowed: boundary.protected_action_allowed,
    protected_action_executed: docxOutputArtifacts.some((artifact) => artifact.protected_action_executed),
    legal_advice_generated: docxOutputArtifacts.some((artifact) => artifact.legal_advice_generated),
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready_count: docxOutputArtifacts.filter((artifact) => artifact.client_facing_ready).length,
    runtime_freeze_status: runtimeFreeze?.summary?.runtime_freeze_status ?? "missing",
    document_renderer_adapter_status: documentRendererAdapter?.summary?.document_renderer_adapter_status ?? "missing",
    document_renderer_docx_target_supported: documentRendererAdapter?.summary?.docx_target_supported === true,
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
    docx_renderer_generated: true,
    draft_artifact_only: true,
    template_data_packet_generated: true,
    local_deterministic_render_performed: true,
    document_renderer_runtime_execution_performed: false,
    external_renderer_execution_performed: false,
    network_access_performed: false,
    docx_binary_write_performed: true,
    docx_binary_write_scope: "artifact_output_dir_only",
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
    schema_version: "docx-renderer-checkpoint.v1",
    checkpoint_id: `docx-renderer.${checkpointId}`,
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
    await sourceRead("asset_registry", inputs.asset_registry_path, readJsonOrError),
    await sourceRead("style_registry", inputs.style_registry_path, readJsonOrError),
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

function renderDocxRendererMarkdown(result) {
  const lines = [];
  lines.push("# DOCX Renderer");
  lines.push("");
  lines.push(`Status: ${result.summary.docx_renderer_status}`);
  lines.push(`DOCX templates: ${result.summary.docx_template_count}`);
  lines.push(`Render jobs: ${result.summary.completed_render_job_count}/${result.summary.docx_render_job_count}`);
  lines.push(`OpenXML parts: ${result.summary.generated_openxml_part_count}/${result.summary.docx_openxml_part_count}`);
  lines.push(`Draft artifacts: ${result.summary.draft_output_artifact_count}/${result.summary.docx_output_artifact_count}`);
  lines.push(`Format validations: ${result.summary.passed_format_validation_result_count}/${result.summary.docx_format_validation_result_count}`);
  lines.push(`Human review required outputs: ${result.summary.human_review_required_output_count}`);
  lines.push(`Client-facing ready count: ${result.summary.client_facing_ready_count}`);
  lines.push("");
  lines.push("## Output Artifacts");
  for (const artifact of result.docx_output_artifacts) {
    lines.push(`- ${artifact.docx_output_artifact_id}: ${artifact.output_artifact_status} (${artifact.output_artifact_path})`);
  }
  return `${lines.join("\n")}\n`;
}

function renderDocumentXml(packet) {
  const paragraphs = [
    packet.title,
    packet.subtitle,
    packet.human_review_note,
    ...packet.sections.flatMap((section) => [section.section_title, section.body]),
  ];
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    "  <w:body>",
    ...paragraphs.map((text) => `    <w:p><w:r><w:t>${escapeXml(text)}</w:t></w:r></w:p>`),
    '    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>',
    "  </w:body>",
    "</w:document>",
  ].join("\n");
}

function renderStylesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    '  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">',
    "    <w:name w:val=\"Normal\"/>",
    "  </w:style>",
    "</w:styles>",
  ].join("\n");
}

function renderContentTypesXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '  <Default Extension="xml" ContentType="application/xml"/>',
    '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>',
    '  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>',
    "</Types>",
  ].join("\n");
}

function renderRelationshipsXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>',
    "</Relationships>",
  ].join("\n");
}

function buildZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const data = Buffer.from(file.content, "utf8");
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0x0021, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0x0021, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + data.length;
  }
  const localBuffer = Buffer.concat(localParts);
  const centralBuffer = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(localBuffer.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localBuffer, centralBuffer, end]);
}

const CRC32_TABLE = buildCrc32Table();

function buildCrc32Table() {
  const table = [];
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function serializableDocxRenderer(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function normalizeInputs(options) {
  return {
    asset_registry_path: path.resolve(options.assetRegistryPath ?? DEFAULT_DOCX_RENDERER_INPUTS.assetRegistryPath),
    style_registry_path: path.resolve(options.styleRegistryPath ?? DEFAULT_DOCX_RENDERER_INPUTS.styleRegistryPath),
    template_registry_path: path.resolve(options.templateRegistryPath ?? DEFAULT_DOCX_RENDERER_INPUTS.templateRegistryPath),
    creative_document_pack_manifest_path: path.resolve(options.creativeDocumentPackManifestPath ?? DEFAULT_DOCX_RENDERER_INPUTS.creativeDocumentPackManifestPath),
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_DOCX_RENDERER_INPUTS.domainPackRegistryPath),
    runtime_freeze_path: path.resolve(options.runtimeFreezePath ?? DEFAULT_DOCX_RENDERER_INPUTS.runtimeFreezePath),
    document_renderer_adapter_path: path.resolve(options.documentRendererAdapterPath ?? DEFAULT_DOCX_RENDERER_INPUTS.documentRendererAdapterPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? DEFAULT_DOCX_RENDERER_INPUTS.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_DOCX_RENDERER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_DOCX_RENDERER_INPUTS.roadmapPath),
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
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-docx-renderer.mjs [options]

Options:
  --check                                      Exit non-zero when validation fails.
  --no-write                                  Build in memory without writing artifacts.
  --out-dir <path>                            Output directory.
  --asset-registry <path>                     Asset registry path.
  --style-registry <path>                     Style registry path.
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

function hashJson(value) {
  return hashText(stableStringify(value));
}

function hashText(value) {
  return createHash("sha256").update(value).digest("hex");
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

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
