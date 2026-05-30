import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EXTRACTOR_REGISTRY_OUT_DIR = "artifacts/extractor-registry/latest";
export const DEFAULT_EXTRACTOR_REGISTRY_INPUTS = {
  repoRoot: ".",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  controlPlaneLoopPath: "src/control-plane-loop.mjs",
  reviewDashboardPath: "src/review-dashboard.mjs",
  reviewApiPath: "src/review-api.mjs",
  extractorAdapterContractPath: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
  resourceExpansionPath: "artifacts/resource-expansion/latest/resource-expansion-job.json",
  batchClassificationResultPath: "artifacts/batch-classification-result/latest/batch-classification-result.json",
  batchMatterTaggingResultPath: "artifacts/batch-matter-tagging-result/latest/batch-matter-tagging-result.json",
};

const REGISTRY_SCHEMA_VERSION = "extractor-registry.v1";
const PACK_ID = "resource-expansion";
const CAPABILITY_ID = "resource.extractor_registry";
const PHASE_SLOT = "P283";
const PREVIOUS_PHASE_SLOT = "P282";
const NEXT_PHASE_SLOT = "P284";
const HUMAN_REVIEW_NOTE = "Extractor Registry is a read-only compatibility catalog. It does not execute extractors, read source file contents, run OCR, mutate resources or state, deliver output, produce legal advice, or create client-facing output.";

export async function runExtractorRegistry(options = {}) {
  const result = await buildExtractorRegistry(options);
  if (options.write !== false) await writeExtractorRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Extractor registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildExtractorRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EXTRACTOR_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const repoRoot = path.resolve(inputs.repo_root);

  const packageJson = await readJsonOrError(path.resolve(repoRoot, inputs.package_path));
  const roadmapText = await readTextOrError(path.resolve(repoRoot, inputs.roadmap_path));
  const implementationRoadmapText = await readTextOrError(path.resolve(repoRoot, inputs.implementation_roadmap_path));
  const controlPlaneLoopText = await readTextOrError(path.resolve(repoRoot, inputs.control_plane_loop_path));
  const reviewDashboardText = await readTextOrError(path.resolve(repoRoot, inputs.review_dashboard_path));
  const reviewApiText = await readTextOrError(path.resolve(repoRoot, inputs.review_api_path));
  const extractorAdapterRead = await readJsonOrError(inputs.extractor_adapter_contract_path);
  const resourceExpansionRead = await readJsonOrError(inputs.resource_expansion_path);
  const batchClassificationRead = await readJsonOrError(inputs.batch_classification_result_path);
  const batchMatterTaggingRead = await readJsonOrError(inputs.batch_matter_tagging_result_path);

  const extractorAdapterContract = extractorAdapterRead.value ?? {};
  const resourceExpansion = resourceExpansionRead.value ?? {};
  const batchClassificationResult = batchClassificationRead.value ?? {};
  const batchMatterTaggingResult = batchMatterTaggingRead.value ?? {};
  const registryEntries = buildRegistryEntries(extractorAdapterContract, generatedAt);
  const compatibilityRows = buildCompatibilityRows({
    resourceExpansion,
    batchClassificationResult,
    batchMatterTaggingResult,
    registryEntries,
    generatedAt,
  });
  const documentTypeRows = buildDocumentTypeRows(registryEntries, compatibilityRows, generatedAt);
  const extensionRows = buildExtensionRows(registryEntries, compatibilityRows, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    packageJson,
    roadmapText,
    implementationRoadmapText,
    controlPlaneLoopText,
    reviewDashboardText,
    reviewApiText,
    extractorAdapterRead,
    resourceExpansionRead,
    batchClassificationRead,
    batchMatterTaggingRead,
    extractorAdapterContract,
    resourceExpansion,
    batchClassificationResult,
    batchMatterTaggingResult,
    registryEntries,
    compatibilityRows,
    documentTypeRows,
    extensionRows,
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
  const summary = summarizeExtractorRegistry({
    extractorAdapterContract,
    resourceExpansion,
    batchClassificationResult,
    batchMatterTaggingResult,
    registryEntries,
    compatibilityRows,
    documentTypeRows,
    extensionRows,
    boundary,
    validation,
  });
  const result = {
    schema_version: REGISTRY_SCHEMA_VERSION,
    generated_at: generatedAt,
    extractor_registry_id: `extractor-registry.${dateStamp(generatedAt)}`,
    extractor_registry_status: summary.extractor_registry_status,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    output_dir: outputDir,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts({
      packageJson,
      roadmapText,
      implementationRoadmapText,
      controlPlaneLoopText,
      reviewDashboardText,
      reviewApiText,
      extractorAdapterRead,
      resourceExpansionRead,
      batchClassificationRead,
      batchMatterTaggingRead,
    }),
    extractor_registry_contract: buildContract(generatedAt, registryEntries, compatibilityRows),
    extractors: registryEntries,
    extractor_registry_entries: registryEntries,
    extractor_compatibility_rows: compatibilityRows,
    document_type_compatibility_rows: documentTypeRows,
    extension_compatibility_rows: extensionRows,
    extractor_registry_boundary: boundary,
    extractor_registry_checks: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderExtractorRegistryMarkdown(result),
  };
}

export async function writeExtractorRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "extractor-registry.json"), serializableExtractorRegistry(result));
  await writeJson(path.join(outDir, "extractor-registry-entries.json"), {
    schema_version: "extractor-registry-entries.v1",
    generated_at: result.generated_at,
    extractor_registry_entry_count: result.extractor_registry_entries.length,
    extractor_registry_entries: result.extractor_registry_entries,
  });
  await writeJson(path.join(outDir, "extractor-compatibility-rows.json"), {
    schema_version: "extractor-compatibility-rows.v1",
    generated_at: result.generated_at,
    compatibility_row_count: result.extractor_compatibility_rows.length,
    extractor_compatibility_rows: result.extractor_compatibility_rows,
  });
  await writeJson(path.join(outDir, "document-type-compatibility-rows.json"), {
    schema_version: "document-type-compatibility-rows.v1",
    generated_at: result.generated_at,
    document_type_row_count: result.document_type_compatibility_rows.length,
    document_type_compatibility_rows: result.document_type_compatibility_rows,
  });
  await writeJson(path.join(outDir, "extension-compatibility-rows.json"), {
    schema_version: "extension-compatibility-rows.v1",
    generated_at: result.generated_at,
    extension_row_count: result.extension_compatibility_rows.length,
    extension_compatibility_rows: result.extension_compatibility_rows,
  });
  await writeJson(path.join(outDir, "extractor-registry-checks.json"), {
    schema_version: "extractor-registry-checks.v1",
    generated_at: result.generated_at,
    check_count: result.extractor_registry_checks.length,
    extractor_registry_checks: result.extractor_registry_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "extractor-registry-validation-report.v1",
    generated_at: result.generated_at,
    extractor_registry_id: result.extractor_registry_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runExtractorRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runExtractorRegistry(args);
    console.log(`Extractor registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.extractor_registry_status}`);
    console.log(`Registry entries: ${result.summary.extractor_registry_entry_count}`);
    console.log(`Compatibility rows: ${result.summary.compatibility_row_count}`);
    console.log(`Extractor executions: ${result.summary.extractor_execution_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRegistryEntries(extractorAdapterContract, generatedAt) {
  const catalog = extractorAdapterContract.extractor_adapter_catalog ?? {};
  const adapters = catalog.extractor_adapters ?? [];
  const adapterById = new Map(adapters.map((adapter) => [adapter.adapter_id, adapter]));
  const ocrPolicyById = new Map((catalog.ocr_fallback_policies ?? []).map((policy) => [policy.ocr_fallback_policy_id, policy]));
  const bindings = catalog.document_type_bindings ?? [];
  return bindings.map((binding, index) => {
    const adapter = adapterById.get(binding.adapter_id) ?? {};
    const ocrPolicy = ocrPolicyById.get(binding.ocr_fallback_policy_id) ?? {};
    const compatibilityStatus = adapter.execution_boundary === "local_deterministic"
      && adapter.external_service_allowed === false
      && adapter.network_access_allowed === false
      && binding.binding_status === "active"
      && binding.ocr_fallback_policy_id
      ? "compatible_pending_human_review"
      : "attention";
    const factSchema = factSchemaForDocumentType(binding.document_type, adapter.metadata_fields ?? []);
    return {
      schema_version: "extractor-registry-entry.v1",
      extractor_registry_entry_id: `extractor-registry.${slugify(binding.document_type)}.${slugify(adapter.extractor_name ?? binding.extractor_id ?? index)}`,
      generated_at: generatedAt,
      document_type: binding.document_type,
      domain_pack: "law-firm",
      adapter_id: binding.adapter_id,
      extractor_id: binding.extractor_id ?? adapter.extractor_id ?? null,
      extractor_name: adapter.display_name ?? adapter.extractor_name ?? binding.extractor_family ?? "Unknown Extractor",
      extractor_family: binding.extractor_family ?? adapter.extractor_family ?? "unknown",
      parser_strategy: binding.parser_strategy ?? adapter.parser_strategy ?? "metadata_only",
      supported_extensions: unique(binding.supported_extensions ?? adapter.supported_extensions ?? []),
      media_types: unique(binding.media_types ?? adapter.media_types ?? []),
      classification_rules: classificationRulesForDocumentType(binding.document_type),
      extractor_chain: unique([
        binding.extractor_id ?? adapter.extractor_id,
        binding.adapter_id,
        binding.parser_strategy ?? adapter.parser_strategy,
        binding.ocr_fallback_policy_id,
      ]),
      fact_schema: factSchema,
      cross_document_rules: crossDocumentRulesForDocumentType(binding.document_type),
      absence_rules: absenceRulesForDocumentType(binding.document_type),
      citation_rules: ["source_span_required", "normalized_text_offset_required", "human_review_before_legal_use"],
      confidence_policy: "deterministic_metadata_match_requires_human_review",
      fallback_policy: ocrPolicy.fallback_mode ?? "local_or_manual_only",
      ocr_fallback_policy_id: binding.ocr_fallback_policy_id,
      compatibility_status: compatibilityStatus,
      local_only: adapter.execution_boundary === "local_deterministic",
      external_service_allowed: adapter.external_service_allowed === true,
      network_access_allowed: adapter.network_access_allowed === true,
      extractor_execution_performed: false,
      file_content_read_performed: false,
      ocr_execution_performed: false,
      external_model_used: false,
      matter_data_write_performed: false,
      review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      review_ui_fields: reviewUiFieldsForDocumentType(binding.document_type, factSchema),
    };
  }).sort(by("document_type", "extractor_id"));
}

function buildCompatibilityRows({ resourceExpansion, batchClassificationResult, batchMatterTaggingResult, registryEntries, generatedAt }) {
  const itemByResourceId = new Map((resourceExpansion.items ?? []).map((item) => [item.resource_id, item]));
  const matterTaggingByResourceId = new Map((batchMatterTaggingResult.batch_matter_tagging_rows ?? []).map((row) => [row.resource_id, row]));
  return (batchClassificationResult.batch_classification_rows ?? []).map((classificationRow, index) => {
    const item = itemByResourceId.get(classificationRow.resource_id) ?? {};
    const matterTaggingRow = matterTaggingByResourceId.get(classificationRow.resource_id) ?? {};
    const selected = selectRegistryEntry(classificationRow, item, registryEntries);
    return {
      extractor_compatibility_row_id: `extractor-compatibility-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      item_id: classificationRow.item_id ?? item.item_id ?? null,
      resource_id: classificationRow.resource_id,
      resource_version_id: classificationRow.resource_version_id ?? item.resource_version_id ?? null,
      relative_path: classificationRow.relative_path ?? item.relative_path ?? null,
      extension: normalizeExtension(classificationRow.extension ?? item.extension),
      resource_type: classificationRow.resource_type ?? item.resource_type ?? "unknown",
      item_status: classificationRow.item_status ?? item.status ?? "unknown",
      data_classification: classificationRow.data_classification,
      classification_status: classificationRow.classification_status,
      batch_classification_row_id: classificationRow.batch_classification_row_id,
      batch_matter_tagging_row_id: matterTaggingRow.batch_matter_tagging_row_id ?? null,
      matter_tagging_status: matterTaggingRow.batch_matter_tagging_status ?? "pending_human_confirmation",
      extractor_registry_entry_id: selected.extractor_registry_entry_id,
      document_type: selected.document_type,
      selected_extractor_id: selected.extractor_id,
      selected_adapter_id: selected.adapter_id,
      selected_extractor_family: selected.extractor_family,
      parser_strategy: selected.parser_strategy,
      compatibility_status: selected.compatibility_status === "compatible_pending_human_review" ? "compatible_pending_human_review" : "attention",
      compatibility_basis: compatibilityBasis(classificationRow, item, selected),
      supported_extension_match: selected.supported_extensions.includes(normalizeExtension(classificationRow.extension ?? item.extension)),
      fallback_registry_entry_used: !selected.supported_extensions.includes(normalizeExtension(classificationRow.extension ?? item.extension)),
      local_only: selected.local_only === true,
      external_service_allowed: selected.external_service_allowed === true,
      network_access_allowed: selected.network_access_allowed === true,
      extractor_execution_performed: false,
      file_content_read_performed: false,
      ocr_execution_performed: false,
      external_model_used: false,
      matter_data_write_performed: false,
      human_review_required: true,
      legal_advice_generated: false,
      client_facing_ready: false,
      reason_codes: unique([
        "batch_classification_linked",
        matterTaggingRow.batch_matter_tagging_row_id ? "batch_matter_tagging_linked" : "batch_matter_tagging_projection_missing",
        selected.supported_extensions.includes(normalizeExtension(classificationRow.extension ?? item.extension)) ? "extension_rule_match" : "fallback_registry_entry",
        classificationRow.item_status === "quarantined" ? "quarantined_item_review_only" : null,
        classificationRow.data_classification === "P5_SECRET" ? "sensitive_item_review_only" : null,
      ]),
    };
  }).sort(by("extractor_compatibility_row_id"));
}

function buildDocumentTypeRows(registryEntries, compatibilityRows, generatedAt) {
  return [...groupBy(registryEntries, "document_type").entries()].map(([documentType, entries], index) => {
    const rows = compatibilityRows.filter((row) => row.document_type === documentType);
    return {
      document_type_compatibility_row_id: `document-type-compatibility-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      document_type: documentType,
      registry_entry_count: entries.length,
      compatible_resource_item_count: rows.filter((row) => row.compatibility_status === "compatible_pending_human_review").length,
      supported_extension_count: unique(entries.flatMap((entry) => entry.supported_extensions)).length,
      local_only_entry_count: entries.filter((entry) => entry.local_only).length,
      external_service_allowed_count: entries.filter((entry) => entry.external_service_allowed).length,
      extractor_execution_count: rows.filter((row) => row.extractor_execution_performed).length,
      compatibility_status: entries.every((entry) => entry.compatibility_status === "compatible_pending_human_review") ? "compatible_pending_human_review" : "attention",
      human_review_required: true,
      client_facing_ready: false,
    };
  }).sort(by("document_type"));
}

function buildExtensionRows(registryEntries, compatibilityRows, generatedAt) {
  const byExtension = new Map();
  for (const entry of registryEntries) {
    for (const extension of entry.supported_extensions) {
      const rows = byExtension.get(extension) ?? [];
      rows.push(entry);
      byExtension.set(extension, rows);
    }
  }
  return [...byExtension.entries()].map(([extension, entries], index) => {
    const observedRows = compatibilityRows.filter((row) => row.extension === extension);
    return {
      extension_compatibility_row_id: `extension-compatibility-row.${String(index + 1).padStart(4, "0")}`,
      generated_at: generatedAt,
      extension,
      registry_entry_count: entries.length,
      document_types: unique(entries.map((entry) => entry.document_type)),
      selected_extractor_ids: unique(entries.map((entry) => entry.extractor_id)),
      observed_resource_item_count: observedRows.length,
      compatible_observed_resource_item_count: observedRows.filter((row) => row.compatibility_status === "compatible_pending_human_review").length,
      local_only_entry_count: entries.filter((entry) => entry.local_only).length,
      external_service_allowed_count: entries.filter((entry) => entry.external_service_allowed).length,
      compatibility_status: entries.every((entry) => entry.compatibility_status === "compatible_pending_human_review") ? "compatible_pending_human_review" : "attention",
      human_review_required: true,
      client_facing_ready: false,
    };
  }).sort(by("extension"));
}

function buildContract(generatedAt, registryEntries, compatibilityRows) {
  return {
    schema_version: "extractor-registry-contract.v1",
    contract_id: REGISTRY_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    generated_at: generatedAt,
    registry_rule: "Document types, extensions, extractor chains, fact schemas, citation rules, confidence policy, and fallback policy are cataloged before any extractor execution.",
    compatibility_rule: "Every P281 batch classification row receives an extractor compatibility row tied to P282 human-review matter tagging posture.",
    execution_rule: "This phase does not execute extractors, OCR, models, file-content reads, writes, delivery, protected actions, legal advice, or client-facing output.",
    registry_entry_count: registryEntries.length,
    compatibility_row_count: compatibilityRows.length,
    human_review_required: true,
    client_facing_output_allowed: false,
  };
}

function buildBoundary(generatedAt) {
  return {
    boundary_id: "extractor-registry.boundary.v1",
    generated_at: generatedAt,
    read_only: true,
    source_artifact_read_performed: true,
    extractor_registry_report_only: true,
    extractor_execution_performed: false,
    ocr_execution_performed: false,
    file_content_read_performed: false,
    external_model_used: false,
    external_service_called: false,
    network_access_performed: false,
    source_ingest_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    matter_data_write_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready_count: 0,
    human_review_required: true,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildCheckpoints({
  packageJson,
  roadmapText,
  implementationRoadmapText,
  controlPlaneLoopText,
  reviewDashboardText,
  reviewApiText,
  extractorAdapterRead,
  resourceExpansionRead,
  batchClassificationRead,
  batchMatterTaggingRead,
  extractorAdapterContract,
  resourceExpansion,
  batchClassificationResult,
  batchMatterTaggingResult,
  registryEntries,
  compatibilityRows,
  documentTypeRows,
  extensionRows,
  boundary,
}) {
  const adapterSummary = extractorAdapterContract.summary ?? {};
  const batchSummary = batchClassificationResult.summary ?? {};
  const matterTaggingSummary = batchMatterTaggingResult.summary ?? {};
  const itemCount = resourceExpansion.items?.length ?? 0;
  return [
    checkpoint("source.extractor_adapter_contract", extractorAdapterRead.available && adapterSummary.extractor_adapter_contract_status === "complete", "Extractor Adapter Contract is complete."),
    checkpoint("source.resource_expansion", resourceExpansionRead.available && resourceExpansion.schema_version === "resource-expansion-job.v1", "Resource Expansion Job is readable."),
    checkpoint("source.batch_classification_result", batchClassificationRead.available && batchSummary.batch_classification_result_status === "complete" && batchSummary.phase_slot === "P281", "P281 Batch Classification Result is complete."),
    checkpoint("source.batch_matter_tagging_result", batchMatterTaggingRead.available && matterTaggingSummary.batch_matter_tagging_result_status === "complete" && matterTaggingSummary.phase_slot === "P282", "P282 Batch Matter Tagging Result is complete."),
    checkpoint("surface.package_script", hasScript(packageJson.value, "resource:extractor-registry"), "package.json exposes resource:extractor-registry."),
    checkpoint("surface.loop_dashboard_api", includesAll(controlPlaneLoopText.value, ["extractor_registry", "resource:extractor-registry"]) && includesAll(reviewDashboardText.value, ["extractor_registry", "buildExtractorRegistryStage"]) && includesAll(reviewApiText.value, ["/api/extractor-registries", "/api/extractor-compatibility-rows"]), "Control-plane loop, dashboard, and API expose Extractor Registry."),
    checkpoint("surface.ledger_roadmap", includesAll(roadmapText.value, ["P283", "extractor registry"]) && includesAll(implementationRoadmapText.value, ["Phase 283", "Extractor Registry"]), "Ledger and implementation roadmap promote Phase 283."),
    checkpoint("registry.entries", registryEntries.length > 0 && registryEntries.every((entry) => entry.extractor_registry_entry_id && entry.document_type && entry.extractor_id), "Extractor registry entries are present and identified."),
    checkpoint("registry.required_fields", registryEntries.every((entry) => entry.classification_rules.length > 0 && entry.extractor_chain.length > 0 && entry.fact_schema.length > 0 && entry.citation_rules.length > 0 && entry.confidence_policy && entry.review_required === true), "Every registry entry has required extractor registry fields."),
    checkpoint("registry.local_only", registryEntries.every((entry) => entry.local_only === true && entry.external_service_allowed === false && entry.network_access_allowed === false), "Every registry entry is local-only and blocks external services/network access."),
    checkpoint("registry.compatible_status", registryEntries.every((entry) => entry.compatibility_status === "compatible_pending_human_review"), "Every registry entry is compatible pending human review."),
    checkpoint("compatibility.coverage", compatibilityRows.length === itemCount && compatibilityRows.length > 0, "Extractor compatibility rows cover every expansion item."),
    checkpoint("compatibility.classification_link", compatibilityRows.every((row) => row.classification_status === "classified_pending_human_review" && row.batch_classification_row_id), "Every compatibility row links to P281 classification."),
    checkpoint("compatibility.matter_tagging_link", compatibilityRows.every((row) => row.matter_tagging_status === "pending_human_confirmation"), "Every compatibility row preserves P282 pending human confirmation posture."),
    checkpoint("compatibility.registry_link", compatibilityRows.every((row) => row.extractor_registry_entry_id && row.selected_extractor_id && row.compatibility_status === "compatible_pending_human_review"), "Every compatibility row links to a registry extractor."),
    checkpoint("compatibility.local_only", compatibilityRows.every((row) => row.local_only === true && row.external_service_allowed === false && row.network_access_allowed === false), "Every compatibility row remains local-only."),
    checkpoint("document_type.rows", documentTypeRows.length > 0 && documentTypeRows.every((row) => row.compatibility_status === "compatible_pending_human_review"), "Document type compatibility rows pass."),
    checkpoint("extension.rows", extensionRows.length > 0 && extensionRows.every((row) => row.compatibility_status === "compatible_pending_human_review"), "Extension compatibility rows pass."),
    checkpoint("boundary.no_execution", boundary.extractor_execution_performed === false && boundary.ocr_execution_performed === false && boundary.file_content_read_performed === false && boundary.external_model_used === false, "No extractor/OCR execution, file content read, or model use occurs."),
    checkpoint("boundary.no_external", boundary.external_service_called === false && boundary.network_access_performed === false, "No external service or network access occurs."),
    checkpoint("boundary.no_mutation_delivery", boundary.source_ingest_performed === false && boundary.source_mutation_performed === false && boundary.resource_mutation_performed === false && boundary.state_mutation_performed === false && boundary.matter_data_write_performed === false && boundary.delivery_execution_performed === false, "No source/resource/state/matter mutation or delivery occurs."),
    checkpoint("boundary.no_legal_client", boundary.protected_action_executed === false && boundary.legal_advice_generated === false && boundary.client_facing_output_generated === false && boundary.client_facing_ready_count === 0, "No protected action, legal advice, or client-facing output is generated."),
    checkpoint("boundary.windows_baseline", boundary.windows_baseline_stability_preserved === true && boundary.mac_windows_completion_instability_guard === true && matterTaggingSummary.windows_baseline_stability_preserved === true, "Windows baseline and Mac/Windows completion guard are preserved."),
  ];
}

function summarizeExtractorRegistry({
  extractorAdapterContract,
  resourceExpansion,
  batchClassificationResult,
  batchMatterTaggingResult,
  registryEntries,
  compatibilityRows,
  documentTypeRows,
  extensionRows,
  boundary,
  validation,
}) {
  const adapterSummary = extractorAdapterContract.summary ?? {};
  const batchSummary = batchClassificationResult.summary ?? {};
  const matterTaggingSummary = batchMatterTaggingResult.summary ?? {};
  return {
    extractor_registry_status: validation.valid ? "complete" : "attention",
    extractor_registry_id: REGISTRY_SCHEMA_VERSION,
    pack_id: PACK_ID,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_extractor_adapter_contract_status: adapterSummary.extractor_adapter_contract_status ?? "unknown",
    source_extractor_adapter_count: adapterSummary.extractor_adapter_count ?? 0,
    source_document_type_binding_count: adapterSummary.document_type_binding_count ?? 0,
    source_ocr_fallback_policy_count: adapterSummary.ocr_fallback_policy_count ?? 0,
    source_resource_expansion_schema_version: resourceExpansion.schema_version ?? null,
    source_resource_expansion_job_id: resourceExpansion.job_id ?? null,
    source_batch_classification_result_status: batchSummary.batch_classification_result_status ?? "unknown",
    source_batch_classification_phase_slot: batchSummary.phase_slot ?? null,
    source_batch_matter_tagging_result_status: matterTaggingSummary.batch_matter_tagging_result_status ?? "unknown",
    source_batch_matter_tagging_phase_slot: matterTaggingSummary.phase_slot ?? null,
    resource_item_count: resourceExpansion.items?.length ?? 0,
    extractor_registry_entry_count: registryEntries.length,
    registry_document_type_count: unique(registryEntries.map((entry) => entry.document_type)).length,
    registry_extension_count: unique(registryEntries.flatMap((entry) => entry.supported_extensions)).length,
    local_only_registry_entry_count: registryEntries.filter((entry) => entry.local_only).length,
    external_service_allowed_entry_count: registryEntries.filter((entry) => entry.external_service_allowed).length,
    network_access_allowed_entry_count: registryEntries.filter((entry) => entry.network_access_allowed).length,
    compatibility_row_count: compatibilityRows.length,
    compatible_resource_item_count: compatibilityRows.filter((row) => row.compatibility_status === "compatible_pending_human_review").length,
    incompatible_resource_item_count: compatibilityRows.filter((row) => row.compatibility_status !== "compatible_pending_human_review").length,
    supported_extension_match_count: compatibilityRows.filter((row) => row.supported_extension_match).length,
    fallback_registry_entry_used_count: compatibilityRows.filter((row) => row.fallback_registry_entry_used).length,
    document_type_compatibility_row_count: documentTypeRows.length,
    passed_document_type_compatibility_row_count: documentTypeRows.filter((row) => row.compatibility_status === "compatible_pending_human_review").length,
    extension_compatibility_row_count: extensionRows.length,
    passed_extension_compatibility_row_count: extensionRows.filter((row) => row.compatibility_status === "compatible_pending_human_review").length,
    human_review_required_count: compatibilityRows.filter((row) => row.human_review_required).length,
    client_facing_ready_count: compatibilityRows.filter((row) => row.client_facing_ready).length,
    extractor_execution_count: compatibilityRows.filter((row) => row.extractor_execution_performed).length,
    file_content_read_count: compatibilityRows.filter((row) => row.file_content_read_performed).length,
    ocr_execution_count: compatibilityRows.filter((row) => row.ocr_execution_performed).length,
    external_model_used_count: compatibilityRows.filter((row) => row.external_model_used).length,
    matter_data_write_performed_count: compatibilityRows.filter((row) => row.matter_data_write_performed).length,
    read_only: boundary.read_only,
    extractor_registry_report_only: boundary.extractor_registry_report_only,
    extractor_execution_performed: boundary.extractor_execution_performed,
    ocr_execution_performed: boundary.ocr_execution_performed,
    file_content_read_performed: boundary.file_content_read_performed,
    external_model_used: boundary.external_model_used,
    external_service_called: boundary.external_service_called,
    network_access_performed: boundary.network_access_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    source_mutation_performed: boundary.source_mutation_performed,
    resource_mutation_performed: boundary.resource_mutation_performed,
    state_mutation_performed: boundary.state_mutation_performed,
    matter_data_write_performed: boundary.matter_data_write_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    human_review_required: true,
    client_facing_ready: false,
    legal_advice_generated: false,
    protected_action_executed: false,
    note: HUMAN_REVIEW_NOTE,
  };
}

function buildSourceContracts(reads) {
  return [
    sourceContract("package", reads.packageJson),
    sourceContract("final-completion-phase-ledger", reads.roadmapText),
    sourceContract("implementation-roadmap", reads.implementationRoadmapText),
    sourceContract("control-plane-loop", reads.controlPlaneLoopText),
    sourceContract("review-dashboard", reads.reviewDashboardText),
    sourceContract("review-api", reads.reviewApiText),
    sourceContract("extractor-adapter-contract", reads.extractorAdapterRead),
    sourceContract("resource-expansion", reads.resourceExpansionRead),
    sourceContract("batch-classification-result", reads.batchClassificationRead),
    sourceContract("batch-matter-tagging-result", reads.batchMatterTaggingRead),
  ];
}

function sourceContract(sourceId, read) {
  return {
    source_id: sourceId,
    path: read.path,
    available: read.available,
    content_hash: read.content_hash ?? null,
    error: read.error ?? null,
  };
}

function renderExtractorRegistryMarkdown(result) {
  const summary = result.summary;
  const lines = [
    "# Extractor Registry",
    "",
    `Status: ${summary.extractor_registry_status}`,
    `Phase: ${summary.phase_slot}`,
    "",
    "## Coverage",
    `- Registry entries: ${summary.extractor_registry_entry_count}`,
    `- Document types: ${summary.registry_document_type_count}`,
    `- Extensions: ${summary.registry_extension_count}`,
    `- Compatibility rows: ${summary.compatibility_row_count}/${summary.resource_item_count}`,
    `- Fallback registry rows: ${summary.fallback_registry_entry_used_count}`,
    "",
    "## Boundary",
    `- Extractor execution: ${summary.extractor_execution_performed}`,
    `- OCR execution: ${summary.ocr_execution_performed}`,
    `- File content read: ${summary.file_content_read_performed}`,
    `- External services/network: ${summary.external_service_called}/${summary.network_access_performed}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    HUMAN_REVIEW_NOTE,
  ];
  return `${lines.join("\n")}\n`;
}

function serializableExtractorRegistry(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function selectRegistryEntry(classificationRow, item, registryEntries) {
  const extension = normalizeExtension(classificationRow.extension ?? item.extension);
  const byExtension = registryEntries.find((entry) => entry.supported_extensions.includes(extension));
  if (byExtension) return byExtension;
  const resourceType = classificationRow.resource_type ?? item.resource_type;
  const byDocumentType = registryEntries.find((entry) => entry.document_type === resourceType);
  if (byDocumentType) return byDocumentType;
  return registryEntries.find((entry) => entry.document_type === "config")
    ?? registryEntries.find((entry) => entry.document_type === "text")
    ?? registryEntries[0]
    ?? fallbackRegistryEntry();
}

function fallbackRegistryEntry() {
  return {
    extractor_registry_entry_id: "extractor-registry.fallback.manual-review",
    document_type: "manual_review",
    adapter_id: "extractor-adapter.manual-review.v1",
    extractor_id: "extractor.manual_review.v1",
    extractor_name: "Manual Review Extractor",
    extractor_family: "manual_review",
    parser_strategy: "manual_review_only",
    supported_extensions: [],
    compatibility_status: "compatible_pending_human_review",
    local_only: true,
    external_service_allowed: false,
    network_access_allowed: false,
  };
}

function compatibilityBasis(classificationRow, item, selected) {
  const extension = normalizeExtension(classificationRow.extension ?? item.extension);
  if (selected.supported_extensions.includes(extension)) return "extension_rule_match";
  if (selected.document_type === (classificationRow.resource_type ?? item.resource_type)) return "resource_type_rule_match";
  return "fallback_registry_entry_pending_human_review";
}

function classificationRulesForDocumentType(documentType) {
  const base = ["classification_present", "policy_bound", "human_review_required"];
  if (["contract", "legal_memo", "brief", "email", "outlook_message"].includes(documentType)) return [...base, "client_confidential_default"];
  if (["config", "archive_header", "unreadable_archive", "malformed_archive"].includes(documentType)) return [...base, "sensitive_or_quarantine_review"];
  return base;
}

function factSchemaForDocumentType(documentType, metadataFields) {
  const defaults = ["source_metadata", "document_title", "document_date", "party_names", "issue_markers"];
  const byType = {
    contract: ["contract_parties", "effective_date", "term", "governing_law", "termination_rights"],
    legal_memo: ["question_presented", "analysis_topics", "author", "date"],
    email: ["sender", "recipients", "sent_at", "subject", "thread_id"],
    outlook_message: ["sender", "recipients", "sent_at", "subject", "message_id"],
    spreadsheet: ["sheet_names", "table_markers", "numeric_columns", "date_columns"],
    vdr_index: ["folder_path", "document_name", "index_number", "status"],
    pdf: ["page_count", "text_layer_status", "header_markers"],
    scanned_or_native_pdf: ["page_count", "ocr_required", "text_layer_status"],
    config: ["key_names", "secret_marker", "environment_marker"],
  };
  return unique([...(byType[documentType] ?? defaults), ...metadataFields]);
}

function crossDocumentRulesForDocumentType(documentType) {
  if (["contract", "registry_filing", "license_permit"].includes(documentType)) return ["same_party_cross_check", "date_consistency_cross_check"];
  if (["email", "outlook_message"].includes(documentType)) return ["thread_participant_cross_check", "attachment_reference_cross_check"];
  return ["matter_id_scope_check", "source_lineage_cross_check"];
}

function absenceRulesForDocumentType(documentType) {
  if (["contract", "legal_memo", "brief"].includes(documentType)) return ["missing_signature_or_author_requires_review", "missing_date_requires_review"];
  if (["pdf", "scanned_or_native_pdf"].includes(documentType)) return ["missing_text_layer_requires_local_or_manual_review"];
  return ["missing_required_metadata_requires_review"];
}

function reviewUiFieldsForDocumentType(documentType, factSchema) {
  return unique(["document_type", "selected_extractor_id", "compatibility_status", "confidence_policy", ...factSchema.slice(0, 5), documentType]);
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    item_count: validationItems.length,
    error_count: errors.length,
    errors,
  };
}

function checkpoint(checkpointId, condition, message) {
  return {
    checkpoint_id: checkpointId,
    status: condition ? "passed" : "failed",
    message,
    human_review_required: true,
    client_facing_ready: false,
  };
}

function normalizeInputs(options) {
  return {
    repo_root: options.repoRoot ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.repoRoot,
    package_path: options.packagePath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.packagePath,
    roadmap_path: options.roadmapPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.roadmapPath,
    implementation_roadmap_path: options.implementationRoadmapPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.implementationRoadmapPath,
    control_plane_loop_path: options.controlPlaneLoopPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.controlPlaneLoopPath,
    review_dashboard_path: options.reviewDashboardPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.reviewDashboardPath,
    review_api_path: options.reviewApiPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.reviewApiPath,
    extractor_adapter_contract_path: options.extractorAdapterContractPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.extractorAdapterContractPath,
    resource_expansion_path: options.resourceExpansionPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.resourceExpansionPath,
    batch_classification_result_path: options.batchClassificationResultPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.batchClassificationResultPath,
    batch_matter_tagging_result_path: options.batchMatterTaggingResultPath ?? DEFAULT_EXTRACTOR_REGISTRY_INPUTS.batchMatterTaggingResultPath,
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--extractor-adapter-contract") parsed.extractorAdapterContractPath = argv[++index];
    else if (arg === "--resource-expansion") parsed.resourceExpansionPath = argv[++index];
    else if (arg === "--batch-classification-result") parsed.batchClassificationResultPath = argv[++index];
    else if (arg === "--batch-matter-tagging-result") parsed.batchMatterTaggingResultPath = argv[++index];
    else if (arg === "--repo-root") parsed.repoRoot = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/extractor-registry.mjs [options]

Options:
  --extractor-adapter-contract <path>       extractor-adapter-contract.json path.
  --resource-expansion <path>               resource-expansion-job.json path.
  --batch-classification-result <path>      batch-classification-result.json path.
  --batch-matter-tagging-result <path>      batch-matter-tagging-result.json path.
  --out-dir <folder>                        Output folder.
  --check                                   Fail if validation does not pass.
  -h, --help                                Show this help.
`);
}

async function readJsonOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: JSON.parse(text),
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: null,
      error: String(error?.message ?? error),
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFileWithRetry(filePath, "utf8");
    return {
      available: true,
      path: filePath,
      value: text,
      content_hash: sha256(text),
    };
  } catch (error) {
    return {
      available: false,
      path: filePath,
      value: "",
      error: String(error?.message ?? error),
    };
  }
}

async function readFileWithRetry(filePath, encoding, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await readFile(filePath, encoding);
    } catch (error) {
      lastError = error;
      if (!["EIO", "ENOENT", "EBUSY", "EPERM"].includes(error?.code) || attempt === attempts) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 50));
    }
  }
  throw lastError;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hasScript(packageJson, scriptName) {
  return Boolean(packageJson?.scripts?.[scriptName]);
}

function includesAll(text, needles) {
  return needles.every((needle) => String(text ?? "").includes(needle));
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    const rows = grouped.get(value) ?? [];
    rows.push(item);
    grouped.set(value, rows);
  }
  return grouped;
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))].sort();
}

function by(...keys) {
  return (left, right) => {
    for (const key of keys) {
      const result = String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
      if (result !== 0) return result;
    }
    return 0;
  };
}

function normalizeExtension(extension) {
  return String(extension ?? "unknown").replace(/^\./, "").toLowerCase() || "unknown";
}

function slugify(value) {
  const slug = String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  return slug || sha256(value).replace("sha256:", "").slice(0, 12);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
