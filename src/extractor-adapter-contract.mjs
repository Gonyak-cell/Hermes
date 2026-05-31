import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXTRACTOR_ADAPTER_CONTRACT_OUT_DIR = "artifacts/extractor-adapter-contract/latest";
export const DEFAULT_EXTRACTOR_ADAPTER_CONTRACT_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "extractor-adapter-contract.v1";
const INPUT_SCHEMA_ID = "extractor-input.v1";
const OUTPUT_SCHEMA_ID = "extractor-output.v1";
const OFFSET_UNIT = "utf16_code_unit";

const OCR_POLICIES = [
  {
    schema_version: "ocr-fallback-policy.v1",
    ocr_fallback_policy_id: "ocr-fallback-policy.none.v1",
    policy_name: "No OCR Required",
    fallback_mode: "not_applicable",
    execution_boundary: "local_deterministic",
    external_service_allowed: false,
    human_review_required: false,
    allowed_tools: [],
    blocked_tools: ["external_ocr_api", "cloud_document_ai"],
    quarantine_when_unreadable: false,
    review_note: "Text-oriented and structured XML extractors do not need OCR fallback.",
  },
  {
    schema_version: "ocr-fallback-policy.v1",
    ocr_fallback_policy_id: "ocr-fallback-policy.pdf_local_or_manual.v1",
    policy_name: "PDF Local or Manual OCR",
    fallback_mode: "local_or_manual_only",
    execution_boundary: "local_deterministic_or_manual",
    external_service_allowed: false,
    human_review_required: true,
    allowed_tools: ["pdftotext", "local_ocr", "manual_review"],
    blocked_tools: ["external_ocr_api", "cloud_document_ai"],
    quarantine_when_unreadable: true,
    review_note: "Unreadable PDFs must remain local/manual unless a separate policy snapshot explicitly authorizes external processing.",
  },
  {
    schema_version: "ocr-fallback-policy.v1",
    ocr_fallback_policy_id: "ocr-fallback-policy.paddleocr_local_only.v1",
    policy_name: "PaddleOCR Local Fallback",
    fallback_mode: "local_ocr_only",
    execution_boundary: "local_deterministic",
    external_service_allowed: false,
    human_review_required: true,
    allowed_tools: ["filesystem.read", "paddleocr"],
    blocked_tools: ["external_ocr_api", "cloud_document_ai", "network.fetch"],
    quarantine_when_unreadable: true,
    review_note: "OCR fallback may run only through a local PaddleOCR command or an explicitly local OCR server contract.",
  },
  {
    schema_version: "ocr-fallback-policy.v1",
    ocr_fallback_policy_id: "ocr-fallback-policy.archive_header_quarantine.v1",
    policy_name: "Archive Header Quarantine",
    fallback_mode: "metadata_only_then_quarantine",
    execution_boundary: "local_deterministic",
    external_service_allowed: false,
    human_review_required: true,
    allowed_tools: ["filesystem.read", "manual_review"],
    blocked_tools: ["external_ocr_api", "cloud_document_ai", "network.fetch"],
    quarantine_when_unreadable: true,
    review_note: "Malformed archives expose only safe headers and require manual follow-up before deeper extraction.",
  },
];

const ADAPTER_DEFINITIONS = [
  adapterDefinition({
    key: "plain_text_probe",
    extractor_family: "plain_text",
    display_name: "Plain Text Probe",
    document_types: ["text", "markdown", "json", "yaml", "toml", "code", "config", "html", "svg", "csv"],
    extensions: ["bat", "css", "csv", "html", "js", "json", "jsonl", "jsx", "lock", "md", "mjs", "ps1", "py", "sample", "sh", "skill", "svg", "template", "toml", "txt", "yaml", "yml"],
    media_types: ["text/plain", "application/json", "text/markdown", "text/yaml"],
    parser_strategy: "read_utf8_preview_and_infer_metadata",
    ocr_fallback_policy_id: "ocr-fallback-policy.none.v1",
    required_tools: ["filesystem.read"],
    metadata_fields: ["text_length", "text_truncated", "headings", "signals"],
  }),
  adapterDefinition({
    key: "docx_word_xml_probe",
    extractor_family: "office_open_xml",
    display_name: "DOCX Word XML Probe",
    document_types: ["word_document", "contract", "legal_memo", "brief"],
    extensions: ["docx"],
    media_types: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    parser_strategy: "unzip_word_document_xml_and_strip_office_markup",
    ocr_fallback_policy_id: "ocr-fallback-policy.none.v1",
    required_tools: ["filesystem.read", "zip.read"],
    metadata_fields: ["table_count", "paragraph_count", "xml_truncated"],
  }),
  adapterDefinition({
    key: "pptx_open_xml_probe",
    extractor_family: "office_open_xml",
    display_name: "PPTX Open XML Probe",
    document_types: ["presentation", "deck", "reporting_slide"],
    extensions: ["pptx"],
    media_types: ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
    parser_strategy: "unzip_slide_xml_entries_and_prefix_slide_markers",
    ocr_fallback_policy_id: "ocr-fallback-policy.none.v1",
    required_tools: ["filesystem.read", "zip.read"],
    metadata_fields: ["entry_count", "slide_count", "master_count", "layout_count"],
  }),
  adapterDefinition({
    key: "xlsx_open_xml_probe",
    extractor_family: "office_open_xml",
    display_name: "XLSX Open XML Probe",
    document_types: ["spreadsheet", "vdr_index", "financial_schedule"],
    extensions: ["xlsx"],
    media_types: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    parser_strategy: "unzip_shared_strings_and_sheet_xml",
    ocr_fallback_policy_id: "ocr-fallback-policy.none.v1",
    required_tools: ["filesystem.read", "zip.read"],
    metadata_fields: ["entry_count", "sheet_count", "has_shared_strings"],
  }),
  adapterDefinition({
    key: "pdf_pdftotext_probe",
    extractor_family: "pdf_text",
    display_name: "PDF pdftotext Probe",
    document_types: ["pdf", "scanned_or_native_pdf"],
    extensions: ["pdf"],
    media_types: ["application/pdf"],
    parser_strategy: "local_pdftotext_sample_then_normalize",
    ocr_fallback_policy_id: "ocr-fallback-policy.pdf_local_or_manual.v1",
    required_tools: ["filesystem.read", "pdftotext"],
    metadata_fields: ["pages_sampled"],
  }),
  adapterDefinition({
    key: "pdf_header_probe",
    extractor_family: "pdf_header",
    display_name: "PDF Header Probe",
    document_types: ["pdf", "unreadable_pdf"],
    extensions: ["pdf"],
    media_types: ["application/pdf"],
    parser_strategy: "read_pdf_header_when_pdftotext_unavailable",
    ocr_fallback_policy_id: "ocr-fallback-policy.pdf_local_or_manual.v1",
    required_tools: ["filesystem.read"],
    metadata_fields: ["pdftotext_available"],
    quality_floor: "low",
  }),
  adapterDefinition({
    key: "liteparse_local",
    extractor_family: "document_structure",
    display_name: "LiteParse Local Document Parser",
    document_types: ["pdf", "scanned_or_native_pdf", "image", "evidence_image"],
    extensions: ["pdf", "png", "jpg", "jpeg", "webp"],
    media_types: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    parser_strategy: "local_liteparse_json_text_bbox_screenshot_probe",
    ocr_fallback_policy_id: "ocr-fallback-policy.paddleocr_local_only.v1",
    required_tools: ["filesystem.read", "lit.optional"],
    metadata_fields: ["page_count", "bbox_count", "table_signal_count", "mean_confidence", "source_spans", "screenshot_refs", "adapter_chain"],
  }),
  adapterDefinition({
    key: "liteparse_layout_sidecar",
    extractor_family: "layout_sidecar",
    display_name: "LiteParse Layout Sidecar",
    document_types: ["word_document", "presentation", "spreadsheet", "layout_enrichment"],
    extensions: ["docx", "pptx", "xlsx"],
    media_types: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
    parser_strategy: "local_liteparse_layout_metadata_sidecar_without_primary_replacement",
    ocr_fallback_policy_id: "ocr-fallback-policy.none.v1",
    required_tools: ["filesystem.read", "lit.optional"],
    metadata_fields: ["page_count", "bbox_count", "table_signal_count", "mean_confidence", "source_spans", "screenshot_refs", "adapter_chain"],
  }),
  adapterDefinition({
    key: "paddleocr_local",
    extractor_family: "ocr",
    display_name: "PaddleOCR Local Fallback",
    document_types: ["pdf", "scanned_or_native_pdf", "image", "evidence_image"],
    extensions: ["pdf", "png", "jpg", "jpeg", "webp"],
    media_types: ["application/pdf", "image/png", "image/jpeg", "image/webp"],
    parser_strategy: "local_paddleocr_text_bbox_confidence_fallback",
    ocr_fallback_policy_id: "ocr-fallback-policy.paddleocr_local_only.v1",
    required_tools: ["filesystem.read", "paddleocr.optional"],
    metadata_fields: ["page_count", "bbox_count", "mean_confidence", "language", "source_spans", "model_hash", "adapter_chain"],
  }),
  adapterDefinition({
    key: "manual_review_image_probe",
    extractor_family: "manual_review",
    display_name: "Manual Review Image Probe",
    document_types: ["image", "evidence_image", "unreadable_image"],
    extensions: ["png", "jpg", "jpeg", "webp"],
    media_types: ["image/png", "image/jpeg", "image/webp"],
    parser_strategy: "metadata_only_manual_review_when_local_parsers_unavailable",
    ocr_fallback_policy_id: "ocr-fallback-policy.paddleocr_local_only.v1",
    required_tools: ["filesystem.read", "manual_review"],
    metadata_fields: ["review_reason", "attempted_extractors", "adapter_chain"],
    quality_floor: "low",
  }),
  adapterDefinition({
    key: "outlook_eml_probe",
    extractor_family: "email",
    display_name: "Outlook EML Probe",
    document_types: ["email", "outlook_message"],
    extensions: ["eml"],
    media_types: ["message/rfc822"],
    parser_strategy: "parse_rfc822_headers_and_body_locally",
    ocr_fallback_policy_id: "ocr-fallback-policy.none.v1",
    required_tools: ["filesystem.read"],
    metadata_fields: ["parsed_message_id", "source_type", "source_id", "author", "date", "raw_size_bytes"],
  }),
  adapterDefinition({
    key: "claude_plugin_archive_probe",
    extractor_family: "archive",
    display_name: "Claude Plugin Archive Probe",
    document_types: ["claude_plugin", "skill_pack", "plugin_archive"],
    extensions: ["plugin"],
    media_types: ["application/zip"],
    parser_strategy: "inspect_archive_manifest_skill_and_command_entries",
    ocr_fallback_policy_id: "ocr-fallback-policy.archive_header_quarantine.v1",
    required_tools: ["filesystem.read", "zip.read"],
    metadata_fields: ["entry_count", "interesting_entry_count", "extension_counts", "manifests", "skill_count", "command_count", "script_count"],
  }),
  adapterDefinition({
    key: "zip_archive_probe",
    extractor_family: "archive",
    display_name: "ZIP Archive Probe",
    document_types: ["zip_archive", "resource_bundle"],
    extensions: ["zip"],
    media_types: ["application/zip"],
    parser_strategy: "inspect_safe_archive_entries_and_manifest_files",
    ocr_fallback_policy_id: "ocr-fallback-policy.archive_header_quarantine.v1",
    required_tools: ["filesystem.read", "zip.read"],
    metadata_fields: ["entry_count", "interesting_entry_count", "extension_counts", "manifests"],
  }),
  adapterDefinition({
    key: "archive_header_probe",
    extractor_family: "archive_header",
    display_name: "Archive Header Probe",
    document_types: ["malformed_archive", "unreadable_archive"],
    extensions: ["plugin", "zip"],
    media_types: ["application/octet-stream"],
    parser_strategy: "read_safe_header_bytes_and_quarantine",
    ocr_fallback_policy_id: "ocr-fallback-policy.archive_header_quarantine.v1",
    required_tools: ["filesystem.read"],
    metadata_fields: ["archive_valid", "archive_error"],
    quality_floor: "low",
  }),
];

export async function runExtractorAdapterContract(options = {}) {
  const result = await buildExtractorAdapterContract(options);
  if (options.write !== false) await writeExtractorAdapterContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Extractor adapter contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExtractorAdapterContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXTRACTOR_ADAPTER_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceIngest = await readJson(inputs.resource_ingest_path);
  const normalizedTextContract = await readJson(inputs.normalized_text_contract_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const resourceRecords = resourceIngest.resource_evidence?.resources ?? [];
  const normalizedTextArtifacts = normalizedTextContract.normalized_text_catalog?.normalized_text_artifacts ?? [];
  const extractorAdapters = ADAPTER_DEFINITIONS.map((adapter) => ({
    ...adapter,
    generated_at: generatedAt,
  }));
  const extractorIoContracts = extractorAdapters.map((adapter) => buildIoContract(adapter, generatedAt));
  const documentTypeBindings = extractorAdapters.flatMap((adapter) => buildDocumentTypeBindings(adapter, generatedAt));
  const normalizedTextBindings = normalizedTextArtifacts.map((artifact) => buildNormalizedTextBinding(artifact, {
    generatedAt,
    resourceById: new Map(resourceRecords.map((record) => [record.id, record])),
    adapterByExtractorId: new Map(extractorAdapters.map((adapter) => [adapter.extractor_id, adapter])),
    ioContractByAdapterId: new Map(extractorIoContracts.map((contract) => [contract.adapter_id, contract])),
    documentTypeBindings,
    normalizedTextContract,
  }));
  const validationItems = validateExtractorAdapterContract({
    resourceIngest,
    normalizedTextContract,
    packageText,
    roadmapText,
    extractorAdapters,
    extractorIoContracts,
    documentTypeBindings,
    ocrFallbackPolicies: OCR_POLICIES,
    normalizedTextArtifacts,
    normalizedTextBindings,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeContract({
    validation,
    validationItems,
    extractorAdapters,
    extractorIoContracts,
    documentTypeBindings,
    ocrFallbackPolicies: OCR_POLICIES,
    normalizedTextArtifacts,
    normalizedTextBindings,
  });

  const result = {
    schema_version: "extractor-adapter-contract.v1",
    generated_at: generatedAt,
    extractor_adapter_contract_id: `extractor-adapter-contract.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_ingest: summarizeSource("resource_ingest", resourceIngest),
    source_normalized_text_contract: summarizeSource("normalized_text_contract", normalizedTextContract),
    extractor_adapter_contract: buildContract(generatedAt),
    extractor_adapter_catalog: {
      schema_version: "extractor-adapter-catalog.v1",
      generated_at: generatedAt,
      extractor_adapters: extractorAdapters,
      extractor_io_contracts: extractorIoContracts,
      document_type_bindings: documentTypeBindings,
      ocr_fallback_policies: OCR_POLICIES,
      normalized_text_bindings: normalizedTextBindings,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderExtractorAdapterContractMarkdown(result),
  };
}

export async function writeExtractorAdapterContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableContract(result);
  await writeJson(path.join(outDir, "extractor-adapter-contract.json"), serializable);
  await writeJson(path.join(outDir, "extractor-adapters.json"), {
    generated_at: result.generated_at,
    extractor_adapter_count: result.extractor_adapter_catalog.extractor_adapters.length,
    extractor_adapters: result.extractor_adapter_catalog.extractor_adapters,
  });
  await writeJson(path.join(outDir, "extractor-io-contracts.json"), {
    generated_at: result.generated_at,
    extractor_io_contract_count: result.extractor_adapter_catalog.extractor_io_contracts.length,
    extractor_io_contracts: result.extractor_adapter_catalog.extractor_io_contracts,
  });
  await writeJson(path.join(outDir, "extractor-document-type-bindings.json"), {
    generated_at: result.generated_at,
    document_type_binding_count: result.extractor_adapter_catalog.document_type_bindings.length,
    document_type_bindings: result.extractor_adapter_catalog.document_type_bindings,
  });
  await writeJson(path.join(outDir, "ocr-fallback-policies.json"), {
    generated_at: result.generated_at,
    ocr_fallback_policy_count: result.extractor_adapter_catalog.ocr_fallback_policies.length,
    ocr_fallback_policies: result.extractor_adapter_catalog.ocr_fallback_policies,
  });
  await writeJson(path.join(outDir, "normalized-text-bindings.json"), {
    generated_at: result.generated_at,
    normalized_text_binding_count: result.extractor_adapter_catalog.normalized_text_bindings.length,
    normalized_text_bindings: result.extractor_adapter_catalog.normalized_text_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    extractor_adapter_contract_id: result.extractor_adapter_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runExtractorAdapterContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runExtractorAdapterContract(args);
    console.log(`Extractor adapter contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.extractor_adapter_contract_status}`);
    console.log(`Adapters: ${result.summary.extractor_adapter_count}`);
    console.log(`I/O contracts: ${result.summary.extractor_io_contract_count}`);
    console.log(`Normalized text bindings: ${result.summary.normalized_text_binding_count}`);
    console.log(`Unbound normalized text: ${result.summary.unbound_normalized_text_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function adapterDefinition({
  key,
  extractor_family,
  display_name,
  document_types,
  extensions,
  media_types,
  parser_strategy,
  ocr_fallback_policy_id,
  required_tools,
  metadata_fields,
  quality_floor = "medium",
}) {
  return {
    schema_version: "extractor-adapter.v1",
    adapter_id: `extractor-adapter.${key}.v1`,
    extractor_id: `extractor.${key}.v1`,
    extractor_name: key,
    extractor_family,
    display_name,
    adapter_version: "1.0.0",
    input_contract: INPUT_SCHEMA_ID,
    output_contract: OUTPUT_SCHEMA_ID,
    supported_document_types: document_types,
    supported_extensions: extensions,
    media_types,
    parser_strategy,
    ocr_fallback_policy_id,
    execution_boundary: "local_deterministic",
    runtime_type: "node_local_script",
    external_service_allowed: false,
    network_access_allowed: false,
    required_tools,
    produced_contracts: ["normalized-text.v1", "normalized-text-artifact.v1", "normalized-source-span-seed.v1"],
    required_identity_fields: ["tenant_id", "matter_id", "classification", "resource_id", "resource_version_id"],
    metadata_fields,
    quality_floor,
  };
}

function buildContract(generatedAt) {
  return {
    schema_version: "extractor-adapter-contract-spec.v1",
    extractor_adapter_contract_id: CONTRACT_ID,
    generated_at: generatedAt,
    input_schema_id: INPUT_SCHEMA_ID,
    output_schema_id: OUTPUT_SCHEMA_ID,
    normalized_text_contract_id: "normalized-text-artifact.v1",
    offset_unit: OFFSET_UNIT,
    required_input_fields: ["resource_id", "resource_version_id", "tenant_id", "matter_id", "classification", "source_uri", "content_hash", "extension"],
    required_output_fields: ["extractor_id", "normalized_text_id", "text_hash", "text_preview", "quality", "metadata"],
    required_adapter_guards: ["local_deterministic_execution", "no_external_service_by_default", "matter_boundary_preserved", "policy_snapshot_preserved"],
    binding_rule: "every_normalized_text_artifact_must_bind_to_one_registered_extractor_adapter_and_io_contract",
    ocr_rule: "ocr_fallback_must_be_local_or_manual_unless_policy_snapshot_overrides_it",
  };
}

function buildIoContract(adapter, generatedAt) {
  return {
    schema_version: "extractor-io-contract.v1",
    extractor_io_contract_id: `extractor-io.${adapter.extractor_name}.v1`,
    adapter_id: adapter.adapter_id,
    extractor_id: adapter.extractor_id,
    generated_at: generatedAt,
    input_schema: {
      schema_id: INPUT_SCHEMA_ID,
      required_fields: ["resource_id", "resource_version_id", "tenant_id", "matter_id", "classification", "source_uri", "content_hash", "extension"],
      optional_fields: ["raw_source_object_key", "source_system", "external_id", "policy_snapshot_id", "resource_metadata"],
      policy_filters_required: ["tenant_id", "matter_id", "classification"],
    },
    output_schema: {
      schema_id: OUTPUT_SCHEMA_ID,
      required_fields: ["extractor_id", "normalized_text_id", "resource_id", "resource_version_id", "text_hash", "text_preview", "quality", "metadata"],
      optional_fields: ["headings", "page_markers", "source_span_seed_ids", "warnings"],
      produced_contracts: adapter.produced_contracts,
      offset_unit: OFFSET_UNIT,
    },
    idempotency_fields: ["resource_version_id", "content_hash", "extractor_id"],
    failure_contract: {
      failure_schema_id: "extractor-failure.v1",
      required_fields: ["resource_id", "resource_version_id", "extractor_id", "error", "quarantine_recommended"],
    },
  };
}

function buildDocumentTypeBindings(adapter, generatedAt) {
  return adapter.supported_document_types.map((documentType) => ({
    schema_version: "extractor-document-type-binding.v1",
    document_type_binding_id: `extractor-document-type-binding.${adapter.extractor_name}.${slugify(documentType)}.v1`,
    adapter_id: adapter.adapter_id,
    extractor_id: adapter.extractor_id,
    extractor_family: adapter.extractor_family,
    document_type: documentType,
    supported_extensions: adapter.supported_extensions,
    media_types: adapter.media_types,
    parser_strategy: adapter.parser_strategy,
    ocr_fallback_policy_id: adapter.ocr_fallback_policy_id,
    binding_status: "active",
    generated_at: generatedAt,
  }));
}

function buildNormalizedTextBinding(artifact, context) {
  const extractorId = normalizeExtractorId(artifact.extractor_id);
  const adapter = context.adapterByExtractorId.get(extractorId);
  const ioContract = adapter ? context.ioContractByAdapterId.get(adapter.adapter_id) : null;
  const resource = context.resourceById.get(artifact.resource_id) ?? {};
  const extension = resource.metadata?.extension ?? inferExtension(resource.source_uri);
  const documentTypeBinding = adapter ? selectDocumentTypeBinding(adapter, context.documentTypeBindings, extension) : null;
  return {
    schema_version: "extractor-normalized-text-binding.v1",
    normalized_text_binding_id: `extractor-normalized-text-binding.${slugify(artifact.normalized_text_id)}`,
    normalized_text_id: artifact.normalized_text_id,
    normalized_text_artifact_id: artifact.normalized_text_artifact_id,
    resource_id: artifact.resource_id,
    resource_version_id: artifact.resource_version_id,
    tenant_id: artifact.tenant_id ?? null,
    matter_id: artifact.matter_id ?? null,
    classification: artifact.classification ?? null,
    source_system: artifact.source_system ?? null,
    source_uri: resource.source_uri ?? null,
    source_extension: extension,
    external_id: artifact.external_id ?? null,
    content_hash: artifact.content_hash ?? null,
    text_hash: artifact.text_hash ?? null,
    quality: artifact.quality ?? "unknown",
    source_extractor_id: artifact.extractor_id ?? null,
    extractor_id: extractorId,
    adapter_id: adapter?.adapter_id ?? null,
    extractor_io_contract_id: ioContract?.extractor_io_contract_id ?? null,
    document_type_binding_id: documentTypeBinding?.document_type_binding_id ?? null,
    ocr_fallback_policy_id: documentTypeBinding?.ocr_fallback_policy_id ?? adapter?.ocr_fallback_policy_id ?? null,
    normalized_text_contract_id: context.normalizedTextContract.summary?.normalized_text_contract_id ?? null,
    binding_status: adapter && ioContract && documentTypeBinding ? "bound" : "unbound",
    execution_boundary: adapter?.execution_boundary ?? "unknown",
    external_service_allowed: adapter?.external_service_allowed ?? null,
    network_access_allowed: adapter?.network_access_allowed ?? null,
    required_identity_fields_preserved: Boolean(artifact.tenant_id && artifact.matter_id && artifact.classification && artifact.resource_id && artifact.resource_version_id),
    lineage_fields_preserved: Boolean(artifact.resource_version_id && artifact.content_hash && artifact.text_hash),
    metadata_signals: artifact.metadata?.signals ?? {},
    text_profile: artifact.text_profile ?? {},
  };
}

function selectDocumentTypeBinding(adapter, documentTypeBindings, extension) {
  const bindings = documentTypeBindings.filter((binding) => binding.adapter_id === adapter.adapter_id);
  return bindings.find((binding) => (binding.supported_extensions ?? []).includes(extension)) ?? bindings[0] ?? null;
}

function validateExtractorAdapterContract({
  resourceIngest,
  normalizedTextContract,
  packageText,
  roadmapText,
  extractorAdapters,
  extractorIoContracts,
  documentTypeBindings,
  ocrFallbackPolicies,
  normalizedTextArtifacts,
  normalizedTextBindings,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const adapterIds = new Set(extractorAdapters.map((adapter) => adapter.adapter_id));
  const adapterNames = new Set(extractorAdapters.map((adapter) => adapter.extractor_name));
  const adapterIdsWithIo = new Set(extractorIoContracts.map((contract) => contract.adapter_id));
  const adapterIdsWithDocumentBindings = new Set(documentTypeBindings.map((binding) => binding.adapter_id));
  const policyIds = new Set(ocrFallbackPolicies.map((policy) => policy.ocr_fallback_policy_id));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:extractor-adapters"]), "package.json must expose resource:extractor-adapters.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 137: Extractor Adapter Contract"), "Implementation roadmap must document Phase 137.");
  pushCheck(validationItems, "source", "resource_ingest_available", resourceIngest.schema_version === "resource-ingest.v1", "Resource ingest source must be available.");
  pushCheck(validationItems, "source", "normalized_text_contract_complete", normalizedTextContract.summary?.normalized_text_contract_status === "complete", "Normalized Text Contract must be complete.");
  pushCheck(validationItems, "catalog", "adapters_present", extractorAdapters.length > 0, "At least one extractor adapter must be declared.");
  pushCheck(validationItems, "catalog", "io_contract_count_matches_adapters", extractorIoContracts.length === extractorAdapters.length, "Every adapter must have one I/O contract.");
  pushCheck(validationItems, "catalog", "document_type_bindings_present", documentTypeBindings.length >= extractorAdapters.length, "Every adapter must have document type bindings.");
  pushCheck(validationItems, "catalog", "ocr_policies_present", ocrFallbackPolicies.length > 0, "OCR fallback policies must be declared.");
  pushCheck(validationItems, "catalog", "pdf_ocr_policy_local_only", Boolean(ocrFallbackPolicies.find((policy) => policy.ocr_fallback_policy_id === "ocr-fallback-policy.pdf_local_or_manual.v1" && policy.external_service_allowed === false)), "PDF OCR fallback must be local/manual by default.");
  pushCheck(validationItems, "catalog", "paddleocr_policy_local_only", Boolean(ocrFallbackPolicies.find((policy) => policy.ocr_fallback_policy_id === "ocr-fallback-policy.paddleocr_local_only.v1" && policy.external_service_allowed === false && policy.blocked_tools.includes("network.fetch"))), "PaddleOCR fallback policy must remain local-only.");
  pushCheck(validationItems, "catalog", "liteparse_registered", adapterNames.has("liteparse_local") && adapterNames.has("liteparse_layout_sidecar"), "LiteParse primary and sidecar adapters must be registered.");
  pushCheck(validationItems, "catalog", "paddleocr_registered", adapterNames.has("paddleocr_local"), "PaddleOCR local fallback adapter must be registered.");
  pushCheck(validationItems, "catalog", "normalized_text_binding_count_matches_source", normalizedTextBindings.length === normalizedTextArtifacts.length, "Every normalized text artifact must receive one extractor binding.");
  pushCheck(validationItems, "catalog", "all_adapters_local_only", extractorAdapters.every((adapter) => adapter.execution_boundary === "local_deterministic" && adapter.external_service_allowed === false && adapter.network_access_allowed === false), "Extractor adapters must be local-only and deterministic by default.");

  for (const adapter of extractorAdapters) {
    const pathPrefix = `extractor_adapters.${adapter.adapter_id}`;
    pushCheck(validationItems, pathPrefix, "io_contract_present", adapterIdsWithIo.has(adapter.adapter_id), "Adapter must have an I/O contract.");
    pushCheck(validationItems, pathPrefix, "document_binding_present", adapterIdsWithDocumentBindings.has(adapter.adapter_id), "Adapter must have at least one document type binding.");
    pushCheck(validationItems, pathPrefix, "ocr_policy_bound", policyIds.has(adapter.ocr_fallback_policy_id), "Adapter must bind to a known OCR fallback policy.");
    pushCheck(validationItems, pathPrefix, "identity_fields_declared", ["tenant_id", "matter_id", "classification", "resource_id", "resource_version_id"].every((field) => adapter.required_identity_fields.includes(field)), "Adapter must preserve matter boundary identity fields.");
  }

  for (const ioContract of extractorIoContracts) {
    const pathPrefix = `extractor_io_contracts.${ioContract.extractor_io_contract_id}`;
    pushCheck(validationItems, pathPrefix, "adapter_link_present", adapterIds.has(ioContract.adapter_id), "I/O contract must link to an adapter.");
    pushCheck(validationItems, pathPrefix, "input_schema_canonical", ioContract.input_schema?.schema_id === INPUT_SCHEMA_ID, "I/O contract must use canonical extractor input schema.");
    pushCheck(validationItems, pathPrefix, "output_schema_canonical", ioContract.output_schema?.schema_id === OUTPUT_SCHEMA_ID, "I/O contract must use canonical extractor output schema.");
    pushCheck(validationItems, pathPrefix, "offset_unit_canonical", ioContract.output_schema?.offset_unit === OFFSET_UNIT, "Extractor output must use canonical offset unit.");
  }

  for (const binding of documentTypeBindings) {
    const pathPrefix = `document_type_bindings.${binding.document_type_binding_id}`;
    pushCheck(validationItems, pathPrefix, "adapter_link_present", adapterIds.has(binding.adapter_id), "Document type binding must link to an adapter.");
    pushCheck(validationItems, pathPrefix, "binding_active", binding.binding_status === "active", "Document type binding must be active.");
    pushCheck(validationItems, pathPrefix, "ocr_policy_bound", policyIds.has(binding.ocr_fallback_policy_id), "Document type binding must reference an OCR fallback policy.");
  }

  for (const binding of normalizedTextBindings) {
    const pathPrefix = `normalized_text_bindings.${binding.normalized_text_id}`;
    pushCheck(validationItems, pathPrefix, "binding_bound", binding.binding_status === "bound", "Normalized text artifact must bind to a registered extractor adapter.");
    pushCheck(validationItems, pathPrefix, "adapter_link_present", adapterIds.has(binding.adapter_id), "Normalized text binding must link to an adapter.");
    pushCheck(validationItems, pathPrefix, "io_contract_present", Boolean(binding.extractor_io_contract_id), "Normalized text binding must carry the extractor I/O contract.");
    pushCheck(validationItems, pathPrefix, "document_type_binding_present", Boolean(binding.document_type_binding_id), "Normalized text binding must carry a document type binding.");
    pushCheck(validationItems, pathPrefix, "local_only", binding.external_service_allowed === false && binding.network_access_allowed === false, "Normalized text binding must be local-only by default.");
    pushCheck(validationItems, pathPrefix, "identity_fields_preserved", binding.required_identity_fields_preserved === true, "Normalized text binding must preserve tenant, matter, classification, resource, and version.");
    pushCheck(validationItems, pathPrefix, "lineage_fields_preserved", binding.lineage_fields_preserved === true, "Normalized text binding must preserve content and text lineage fields.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `extractor-adapter-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.path}.${item.check_id}`, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeContract({
  validation,
  validationItems,
  extractorAdapters,
  extractorIoContracts,
  documentTypeBindings,
  ocrFallbackPolicies,
  normalizedTextArtifacts,
  normalizedTextBindings,
}) {
  const boundBindings = normalizedTextBindings.filter((binding) => binding.binding_status === "bound");
  return {
    extractor_adapter_contract_status: validation.valid ? "complete" : "blocked",
    extractor_adapter_contract_id: CONTRACT_ID,
    extractor_adapter_count: extractorAdapters.length,
    extractor_io_contract_count: extractorIoContracts.length,
    document_type_binding_count: documentTypeBindings.length,
    ocr_fallback_policy_count: ocrFallbackPolicies.length,
    normalized_text_artifact_count: normalizedTextArtifacts.length,
    normalized_text_binding_count: normalizedTextBindings.length,
    bound_normalized_text_count: boundBindings.length,
    unbound_normalized_text_count: normalizedTextBindings.length - boundBindings.length,
    local_only_adapter_count: extractorAdapters.filter((adapter) => adapter.execution_boundary === "local_deterministic" && adapter.external_service_allowed === false && adapter.network_access_allowed === false).length,
    external_service_adapter_count: extractorAdapters.filter((adapter) => adapter.external_service_allowed === true || adapter.network_access_allowed === true).length,
    ocr_policy_external_service_count: ocrFallbackPolicies.filter((policy) => policy.external_service_allowed === true).length,
    pdf_ocr_local_manual_policy_count: ocrFallbackPolicies.filter((policy) => policy.ocr_fallback_policy_id === "ocr-fallback-policy.pdf_local_or_manual.v1" && policy.external_service_allowed === false).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
  };
}

function renderExtractorAdapterContractMarkdown(result) {
  const lines = [];
  lines.push("# Extractor Adapter Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.extractor_adapter_contract_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.extractor_adapter_contract_id}`);
  lines.push(`- Extractor adapters: ${result.summary.extractor_adapter_count}`);
  lines.push(`- I/O contracts: ${result.summary.extractor_io_contract_count}`);
  lines.push(`- Document type bindings: ${result.summary.document_type_binding_count}`);
  lines.push(`- OCR fallback policies: ${result.summary.ocr_fallback_policy_count}`);
  lines.push(`- Normalized text bindings: ${result.summary.normalized_text_binding_count}`);
  lines.push(`- Bound normalized text: ${result.summary.bound_normalized_text_count}`);
  lines.push(`- Unbound normalized text: ${result.summary.unbound_normalized_text_count}`);
  lines.push(`- External-service adapters: ${result.summary.external_service_adapter_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? DEFAULT_EXTRACTOR_ADAPTER_CONTRACT_INPUTS.resourceIngestPath),
    normalized_text_contract_path: path.resolve(options.normalizedTextContractPath ?? DEFAULT_EXTRACTOR_ADAPTER_CONTRACT_INPUTS.normalizedTextContractPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EXTRACTOR_ADAPTER_CONTRACT_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EXTRACTOR_ADAPTER_CONTRACT_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--normalized-text-contract") parsed.normalizedTextContractPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/extractor-adapter-contract.mjs [options]

Options:
  --resource-ingest <path>              resource-ingest.json path.
  --normalized-text-contract <path>     normalized-text-contract.json path.
  --out-dir <path>                      Output directory.
  --run-at <iso>                        Deterministic generated_at timestamp.
  --check                               Exit non-zero when validation fails.
  --no-write                            Build without writing artifacts.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableContract(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeSource(sourceId, data) {
  return {
    source_id: sourceId,
    schema_version: data.schema_version ?? null,
    generated_at: data.generated_at ?? null,
    summary: data.summary ?? null,
  };
}

function normalizeExtractorId(value) {
  const text = String(value ?? "unknown");
  if (text.startsWith("extractor.")) return text;
  return `extractor.${text}.v1`;
}

function inferExtension(sourceUri) {
  const extension = path.extname(String(sourceUri ?? "")).replace(/^\./, "").toLowerCase();
  return extension || null;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runExtractorAdapterContractCli();
}
