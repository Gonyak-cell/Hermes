import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SOURCE_SPAN_STORE_OUT_DIR = "artifacts/source-span-store/latest";
export const DEFAULT_SOURCE_SPAN_STORE_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  extractorAdapterContractPath: "artifacts/extractor-adapter-contract/latest/extractor-adapter-contract.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const SOURCE_SPAN_STORE_CONTRACT_ID = "source-span-store.v1";
const SOURCE_SPAN_SCHEMA_VERSION = "source-span.v2";
const OFFSET_UNIT = "utf16_code_unit";
const REQUIRED_LOCATION_TYPES = ["whole_document", "page", "paragraph", "line", "char_range"];

export async function runSourceSpanStore(options = {}) {
  const result = await buildSourceSpanStore(options);
  if (options.write !== false) await writeSourceSpanStore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Source span store failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSourceSpanStore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SOURCE_SPAN_STORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceIngest = await readJson(inputs.resource_ingest_path);
  const normalizedTextContract = await readJson(inputs.normalized_text_contract_path);
  const extractorAdapterContract = await readJson(inputs.extractor_adapter_contract_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const sourceSpans = resourceIngest.resource_evidence?.source_spans ?? [];
  const normalizedTextArtifacts = normalizedTextContract.normalized_text_catalog?.normalized_text_artifacts ?? [];
  const locationMaps = normalizedTextContract.normalized_text_catalog?.location_maps ?? [];
  const sourceSpanSeeds = normalizedTextContract.normalized_text_catalog?.source_span_seeds ?? [];
  const extractorBindings = extractorAdapterContract.extractor_adapter_catalog?.normalized_text_bindings ?? [];

  const context = buildProjectionContext({
    generatedAt,
    sourceSpans,
    normalizedTextArtifacts,
    locationMaps,
    sourceSpanSeeds,
    extractorBindings,
  });
  const sourceSpanRecords = normalizedTextArtifacts.flatMap((artifact) => buildSourceSpanRecords(artifact, context));
  const sourceSpanLocators = sourceSpanRecords.map(buildSourceSpanLocator);
  const sourceSpanLocationUnits = sourceSpanRecords.map(buildSourceSpanLocationUnit);
  const sourceSpanIndexes = buildSourceSpanIndexes(sourceSpanRecords, generatedAt);
  const validationItems = validateSourceSpanStore({
    resourceIngest,
    normalizedTextContract,
    extractorAdapterContract,
    packageText,
    roadmapText,
    normalizedTextArtifacts,
    sourceSpanSeeds,
    sourceSpanRecords,
    sourceSpanLocators,
    sourceSpanLocationUnits,
    sourceSpanIndexes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeStore({
    validation,
    validationItems,
    normalizedTextArtifacts,
    sourceSpanSeeds,
    sourceSpanRecords,
    sourceSpanLocators,
    sourceSpanLocationUnits,
  });

  const result = {
    schema_version: "source-span-store.v1",
    generated_at: generatedAt,
    source_span_store_id: `source-span-store.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_ingest: summarizeSource("resource_ingest", resourceIngest),
    source_normalized_text_contract: summarizeSource("normalized_text_contract", normalizedTextContract),
    source_extractor_adapter_contract: summarizeSource("extractor_adapter_contract", extractorAdapterContract),
    source_span_store_contract: buildStoreContract(generatedAt),
    source_span_catalog: {
      schema_version: "source-span-catalog.v1",
      generated_at: generatedAt,
      source_spans: sourceSpanRecords,
      source_span_locators: sourceSpanLocators,
      source_span_location_units: sourceSpanLocationUnits,
      source_span_indexes: sourceSpanIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderSourceSpanStoreMarkdown(result),
  };
}

export async function writeSourceSpanStore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableStore(result);
  await writeJson(path.join(outDir, "source-span-store.json"), serializable);
  await writeJson(path.join(outDir, "source-spans.json"), {
    generated_at: result.generated_at,
    source_span_count: result.source_span_catalog.source_spans.length,
    source_spans: result.source_span_catalog.source_spans,
  });
  await writeJson(path.join(outDir, "source-span-locators.json"), {
    generated_at: result.generated_at,
    source_span_locator_count: result.source_span_catalog.source_span_locators.length,
    source_span_locators: result.source_span_catalog.source_span_locators,
  });
  await writeJson(path.join(outDir, "source-span-location-units.json"), {
    generated_at: result.generated_at,
    source_span_location_unit_count: result.source_span_catalog.source_span_location_units.length,
    source_span_location_units: result.source_span_catalog.source_span_location_units,
  });
  await writeJson(path.join(outDir, "source-span-indexes.json"), {
    generated_at: result.generated_at,
    source_span_indexes: result.source_span_catalog.source_span_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    source_span_store_id: result.source_span_store_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runSourceSpanStoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runSourceSpanStore(args);
    console.log(`Source span store written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.source_span_store_status}`);
    console.log(`Source spans: ${result.summary.source_span_count}`);
    console.log(`Whole document spans: ${result.summary.whole_document_span_count}`);
    console.log(`Page spans: ${result.summary.page_span_count}`);
    console.log(`Paragraph spans: ${result.summary.paragraph_span_count}`);
    console.log(`Line spans: ${result.summary.line_span_count}`);
    console.log(`Char-range spans: ${result.summary.char_range_span_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildStoreContract(generatedAt) {
  return {
    schema_version: "source-span-store-contract.v1",
    source_span_store_contract_id: SOURCE_SPAN_STORE_CONTRACT_ID,
    generated_at: generatedAt,
    source_span_schema_version: SOURCE_SPAN_SCHEMA_VERSION,
    source_inputs: ["normalized-text-artifact.v1", "normalized-text-location-map.v1", "normalized-source-span-seed.v1", "extractor-normalized-text-binding.v1"],
    required_location_types: REQUIRED_LOCATION_TYPES,
    optional_location_types: ["timestamp", "cell", "slide", "message"],
    offset_unit: OFFSET_UNIT,
    locator_fields: ["page_start", "page_end", "paragraph_index", "line_index", "char_start", "char_end", "offset_unit", "timestamp_start", "timestamp_end", "timestamp_status"],
    required_identity_fields: ["tenant_id", "matter_id", "classification", "resource_id", "resource_version_id", "normalized_text_id"],
    required_lineage_links: ["source_span_seed_id", "normalized_text_artifact_id", "location_map_id", "extractor_binding_id"],
    timestamp_rule: "file_based_resources_emit_timestamp_status_not_applicable_until_a_timestamped_connector_supplies_offsets",
  };
}

function buildProjectionContext({
  generatedAt,
  sourceSpans,
  normalizedTextArtifacts,
  locationMaps,
  sourceSpanSeeds,
  extractorBindings,
}) {
  return {
    generatedAt,
    sourceSpanById: new Map(sourceSpans.map((span) => [span.id, span])),
    artifactByTextId: new Map(normalizedTextArtifacts.map((artifact) => [artifact.normalized_text_id, artifact])),
    locationMapByTextId: new Map(locationMaps.map((map) => [map.normalized_text_id, map])),
    seedByTextId: new Map(sourceSpanSeeds.map((seed) => [seed.normalized_text_id, seed])),
    extractorBindingByTextId: new Map(extractorBindings.map((binding) => [binding.normalized_text_id, binding])),
  };
}

function buildSourceSpanRecords(artifact, context) {
  const locationMap = context.locationMapByTextId.get(artifact.normalized_text_id);
  const seed = context.seedByTextId.get(artifact.normalized_text_id);
  const extractorBinding = context.extractorBindingByTextId.get(artifact.normalized_text_id);
  const textPreview = String(artifact.text_preview ?? "");
  const records = [];
  if (seed) {
    records.push(buildRecordFromSeed(artifact, seed, { context, extractorBinding, textPreview }));
  }
  for (const unit of locationMap?.page_units ?? []) {
    records.push(buildRecordFromUnit(artifact, unit, "page", { context, seed, locationMap, extractorBinding, textPreview }));
  }
  for (const unit of locationMap?.paragraph_units ?? []) {
    records.push(buildRecordFromUnit(artifact, unit, "paragraph", { context, seed, locationMap, extractorBinding, textPreview }));
  }
  for (const unit of locationMap?.line_units ?? []) {
    records.push(buildRecordFromUnit(artifact, unit, "line", { context, seed, locationMap, extractorBinding, textPreview }));
  }
  if (locationMap?.text_range) {
    records.push(buildRecordFromTextRange(artifact, locationMap, { context, seed, extractorBinding, textPreview }));
  }
  return records;
}

function buildRecordFromSeed(artifact, seed, { context, extractorBinding, textPreview }) {
  const locator = normalizeLocator(seed.locator, "whole_document", {
    timestampStatus: "not_applicable",
    locatorStatus: seed.seed_status === "ready" ? "seed_ready" : "seed_incomplete",
  });
  return sourceSpanRecord({
    artifact,
    context,
    extractorBinding,
    textPreview,
    sourceSpanSeedId: seed.source_span_seed_id,
    ingestSourceSpanId: seed.source_span_id,
    locationMapId: null,
    locationUnitId: seed.source_span_seed_id,
    locationType: "whole_document",
    locator,
    locatorStatus: locator.locator_status,
    locationOrdinal: 1,
    sourceLocatorStrategy: seed.locator?.source_locator_strategy ?? "normalized_text_seed",
  });
}

function buildRecordFromUnit(artifact, unit, locationType, { context, seed, locationMap, extractorBinding, textPreview }) {
  const indexValue = unit[`${locationType}_index`] ?? unit.page_number ?? 1;
  const locationUnitId = `${locationMap.location_map_id}.${locationType}.${indexValue}`;
  const locator = normalizeLocator(unit, locationType, {
    timestampStatus: "not_applicable",
    locatorStatus: unit.locator_status ?? "derived",
  });
  return sourceSpanRecord({
    artifact,
    context,
    extractorBinding,
    textPreview,
    sourceSpanSeedId: seed?.source_span_seed_id ?? null,
    ingestSourceSpanId: seed?.source_span_id ?? null,
    locationMapId: locationMap.location_map_id,
    locationUnitId,
    locationType,
    locator,
    locatorStatus: locator.locator_status,
    locationOrdinal: indexValue,
    sourceLocatorStrategy: "normalized_text_location_map",
  });
}

function buildRecordFromTextRange(artifact, locationMap, { context, seed, extractorBinding, textPreview }) {
  const range = locationMap.text_range;
  const locator = normalizeLocator(range, "char_range", {
    timestampStatus: "not_applicable",
    locatorStatus: "derived",
  });
  return sourceSpanRecord({
    artifact,
    context,
    extractorBinding,
    textPreview,
    sourceSpanSeedId: seed?.source_span_seed_id ?? null,
    ingestSourceSpanId: seed?.source_span_id ?? null,
    locationMapId: locationMap.location_map_id,
    locationUnitId: `${locationMap.location_map_id}.char_range.whole_preview`,
    locationType: "char_range",
    locator,
    locatorStatus: locator.locator_status,
    locationOrdinal: 1,
    sourceLocatorStrategy: "normalized_text_text_range",
  });
}

function sourceSpanRecord({
  artifact,
  context,
  extractorBinding,
  textPreview,
  sourceSpanSeedId,
  ingestSourceSpanId,
  locationMapId,
  locationUnitId,
  locationType,
  locator,
  locatorStatus,
  locationOrdinal,
  sourceLocatorStrategy,
}) {
  const contentPreview = slicePreview(textPreview, locator.char_start, locator.char_end, 500);
  const sourceSpanId = `source-span.${slugify(artifact.normalized_text_id)}.${locationType}.${slugify(locationOrdinal)}`;
  return {
    schema_version: SOURCE_SPAN_SCHEMA_VERSION,
    source_span_id: sourceSpanId,
    source_span_store_record_id: `source-span-store-record.${slugify(artifact.normalized_text_id)}.${locationType}.${slugify(locationOrdinal)}`,
    source_span_seed_id: sourceSpanSeedId,
    ingest_source_span_id: ingestSourceSpanId,
    normalized_text_artifact_id: artifact.normalized_text_artifact_id,
    normalized_text_id: artifact.normalized_text_id,
    location_map_id: locationMapId,
    location_unit_id: locationUnitId,
    resource_id: artifact.resource_id,
    resource_version_id: artifact.resource_version_id,
    version_family_id: artifact.version_family_id ?? null,
    tenant_id: artifact.tenant_id ?? null,
    matter_id: artifact.matter_id ?? null,
    classification: artifact.classification ?? null,
    policy_snapshot_id: artifact.policy_snapshot_id ?? null,
    source_system: artifact.source_system ?? null,
    external_id: artifact.external_id ?? null,
    content_hash: artifact.content_hash ?? null,
    text_hash: artifact.text_hash ?? null,
    extractor_id: extractorBinding?.extractor_id ?? artifact.extractor_id ?? null,
    adapter_id: extractorBinding?.adapter_id ?? null,
    extractor_io_contract_id: extractorBinding?.extractor_io_contract_id ?? null,
    document_type_binding_id: extractorBinding?.document_type_binding_id ?? null,
    location_type: locationType,
    locator,
    locator_status: locatorStatus,
    source_locator_strategy: sourceLocatorStrategy,
    timestamp_status: locator.timestamp_status,
    span_status: "active",
    review_status: "needs_review",
    content_preview: contentPreview,
    lineage_root_id: `lineage-root.${slugify(artifact.resource_version_id)}`,
    created_at: context.generatedAt,
    metadata: {
      source_span_store_contract_id: SOURCE_SPAN_STORE_CONTRACT_ID,
      source_normalized_text_contract_id: "normalized-text-artifact.v1",
      source_extractor_adapter_contract_id: "extractor-adapter-contract.v1",
      source_text_profile: artifact.text_profile ?? {},
      location_ordinal: locationOrdinal,
      preview_hash: artifact.text_hash ?? null,
    },
  };
}

function normalizeLocator(source, locationType, { timestampStatus, locatorStatus }) {
  const charStart = Number(source?.char_start ?? 0);
  const charEnd = Number(source?.char_end ?? source?.preview_text_length ?? charStart);
  const locator = {
    location_type: locationType,
    page_start: nullableNumber(source?.page_start ?? source?.page_number),
    page_end: nullableNumber(source?.page_end ?? source?.page_number),
    page_number: nullableNumber(source?.page_number),
    paragraph_index: nullableNumber(source?.paragraph_index),
    line_index: nullableNumber(source?.line_index),
    char_start: Number.isFinite(charStart) ? charStart : 0,
    char_end: Number.isFinite(charEnd) ? charEnd : Math.max(charStart, 0),
    offset_unit: source?.offset_unit ?? OFFSET_UNIT,
    timestamp_start: null,
    timestamp_end: null,
    timestamp_status: timestampStatus,
    locator_status: locatorStatus,
  };
  if (locator.page_start === null && locationType !== "line" && locationType !== "paragraph") locator.page_start = 1;
  if (locator.page_end === null && locator.page_start !== null) locator.page_end = locator.page_start;
  return locator;
}

function buildSourceSpanLocator(span) {
  return {
    schema_version: "source-span-locator.v1",
    source_span_locator_id: `source-span-locator.${slugify(span.source_span_id)}`,
    source_span_id: span.source_span_id,
    normalized_text_id: span.normalized_text_id,
    location_type: span.location_type,
    locator: span.locator,
    locator_status: span.locator_status,
    timestamp_status: span.timestamp_status,
    offset_unit: span.locator.offset_unit,
    char_start: span.locator.char_start,
    char_end: span.locator.char_end,
    page_start: span.locator.page_start,
    page_end: span.locator.page_end,
    paragraph_index: span.locator.paragraph_index,
    line_index: span.locator.line_index,
  };
}

function buildSourceSpanLocationUnit(span) {
  return {
    schema_version: "source-span-location-unit.v1",
    source_span_location_unit_id: `source-span-location-unit.${slugify(span.source_span_id)}`,
    source_span_id: span.source_span_id,
    normalized_text_id: span.normalized_text_id,
    location_unit_id: span.location_unit_id,
    location_type: span.location_type,
    location_ordinal: span.metadata?.location_ordinal ?? 1,
    locator_status: span.locator_status,
    char_start: span.locator.char_start,
    char_end: span.locator.char_end,
    offset_unit: span.locator.offset_unit,
    timestamp_status: span.timestamp_status,
  };
}

function buildSourceSpanIndexes(spans, generatedAt) {
  return {
    schema_version: "source-span-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(spans, "matter_id"),
    by_classification: countBy(spans, "classification"),
    by_resource_id: countBy(spans, "resource_id"),
    by_normalized_text_id: countBy(spans, "normalized_text_id"),
    by_location_type: countBy(spans, "location_type"),
    by_timestamp_status: countBy(spans, "timestamp_status"),
    by_locator_status: countBy(spans, "locator_status"),
  };
}

function validateSourceSpanStore({
  resourceIngest,
  normalizedTextContract,
  extractorAdapterContract,
  packageText,
  roadmapText,
  normalizedTextArtifacts,
  sourceSpanSeeds,
  sourceSpanRecords,
  sourceSpanLocators,
  sourceSpanLocationUnits,
  sourceSpanIndexes,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const spansByText = groupBy(sourceSpanRecords, "normalized_text_id");
  const requiredTypes = new Set(REQUIRED_LOCATION_TYPES);
  const sourceSpanSeedIds = new Set(sourceSpanSeeds.map((seed) => seed.source_span_seed_id));
  const locatorSpanIds = new Set(sourceSpanLocators.map((locator) => locator.source_span_id));
  const unitSpanIds = new Set(sourceSpanLocationUnits.map((unit) => unit.source_span_id));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:source-spans"]), "package.json must expose resource:source-spans.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 138: Source Span Store"), "Implementation roadmap must document Phase 138.");
  pushCheck(validationItems, "source", "resource_ingest_available", resourceIngest.schema_version === "resource-ingest.v1", "Resource ingest source must be available.");
  pushCheck(validationItems, "source", "normalized_text_contract_complete", normalizedTextContract.summary?.normalized_text_contract_status === "complete", "Normalized Text Contract must be complete.");
  pushCheck(validationItems, "source", "extractor_adapter_contract_complete", extractorAdapterContract.summary?.extractor_adapter_contract_status === "complete", "Extractor Adapter Contract must be complete.");
  pushCheck(validationItems, "catalog", "normalized_texts_present", normalizedTextArtifacts.length > 0, "At least one normalized text artifact is required.");
  pushCheck(validationItems, "catalog", "source_spans_present", sourceSpanRecords.length > 0, "At least one source span must be materialized.");
  pushCheck(validationItems, "catalog", "locator_count_matches_spans", sourceSpanLocators.length === sourceSpanRecords.length, "Every source span must have one locator row.");
  pushCheck(validationItems, "catalog", "location_unit_count_matches_spans", sourceSpanLocationUnits.length === sourceSpanRecords.length, "Every source span must have one location unit row.");
  pushCheck(validationItems, "catalog", "timestamp_status_index_present", Boolean(sourceSpanIndexes.by_timestamp_status), "Timestamp status index must be present even when timestamps are not applicable.");

  for (const artifact of normalizedTextArtifacts) {
    const spans = spansByText.get(artifact.normalized_text_id) ?? [];
    const actualTypes = new Set(spans.map((span) => span.location_type));
    const pathPrefix = `normalized_text.${artifact.normalized_text_id}`;
    pushCheck(validationItems, pathPrefix, "required_location_types_present", [...requiredTypes].every((type) => actualTypes.has(type)), "Every normalized text must have whole_document, page, paragraph, line, and char_range source spans.");
    pushCheck(validationItems, pathPrefix, "source_span_seed_linked", spans.some((span) => sourceSpanSeedIds.has(span.source_span_seed_id)), "At least one source span must link to a normalized source span seed.");
    pushCheck(validationItems, pathPrefix, "source_spans_bound_to_extractor", spans.every((span) => span.adapter_id && span.extractor_io_contract_id), "Every source span must preserve extractor adapter binding.");
  }

  for (const span of sourceSpanRecords) {
    const locator = span.locator ?? {};
    const pathPrefix = `source_spans.${span.source_span_id}`;
    pushCheck(validationItems, pathPrefix, "schema_version_canonical", span.schema_version === SOURCE_SPAN_SCHEMA_VERSION, "Source span must use source-span.v2.");
    pushCheck(validationItems, pathPrefix, "identity_boundary_present", Boolean(span.tenant_id && span.matter_id && span.classification && span.resource_id && span.resource_version_id), "Source span must preserve tenant, matter, classification, resource, and version.");
    pushCheck(validationItems, pathPrefix, "normalized_text_link_present", Boolean(span.normalized_text_id && span.normalized_text_artifact_id), "Source span must link to normalized text.");
    pushCheck(validationItems, pathPrefix, "locator_row_present", locatorSpanIds.has(span.source_span_id), "Source span must have locator projection.");
    pushCheck(validationItems, pathPrefix, "location_unit_row_present", unitSpanIds.has(span.source_span_id), "Source span must have location unit projection.");
    pushCheck(validationItems, pathPrefix, "char_range_valid", Number.isFinite(locator.char_start) && Number.isFinite(locator.char_end) && locator.char_end >= locator.char_start, "Source span locator must preserve a valid char range.");
    pushCheck(validationItems, pathPrefix, "offset_unit_canonical", locator.offset_unit === OFFSET_UNIT, "Source span locator must use the canonical offset unit.");
    pushCheck(validationItems, pathPrefix, "timestamp_status_present", ["not_applicable", "available", "missing"].includes(locator.timestamp_status), "Source span locator must explicitly state timestamp status.");
    pushCheck(validationItems, pathPrefix, "content_preview_present", typeof span.content_preview === "string", "Source span must carry a content preview string.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `source-span-store-validation.${slugify(pathLabel)}.${checkId}`,
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

function summarizeStore({ validation, validationItems, normalizedTextArtifacts, sourceSpanSeeds, sourceSpanRecords, sourceSpanLocators, sourceSpanLocationUnits }) {
  return {
    source_span_store_status: validation.valid ? "complete" : "blocked",
    source_span_store_contract_id: SOURCE_SPAN_STORE_CONTRACT_ID,
    source_span_schema_version: SOURCE_SPAN_SCHEMA_VERSION,
    normalized_text_artifact_count: normalizedTextArtifacts.length,
    source_span_seed_count: sourceSpanSeeds.length,
    source_span_count: sourceSpanRecords.length,
    source_span_locator_count: sourceSpanLocators.length,
    source_span_location_unit_count: sourceSpanLocationUnits.length,
    whole_document_span_count: sourceSpanRecords.filter((span) => span.location_type === "whole_document").length,
    page_span_count: sourceSpanRecords.filter((span) => span.location_type === "page").length,
    paragraph_span_count: sourceSpanRecords.filter((span) => span.location_type === "paragraph").length,
    line_span_count: sourceSpanRecords.filter((span) => span.location_type === "line").length,
    char_range_span_count: sourceSpanRecords.filter((span) => span.location_type === "char_range").length,
    timestamp_span_count: sourceSpanRecords.filter((span) => span.location_type === "timestamp").length,
    timestamp_not_applicable_count: sourceSpanRecords.filter((span) => span.timestamp_status === "not_applicable").length,
    extractor_bound_span_count: sourceSpanRecords.filter((span) => span.adapter_id && span.extractor_io_contract_id).length,
    seed_linked_span_count: sourceSpanRecords.filter((span) => span.source_span_seed_id).length,
    canonical_offset_span_count: sourceSpanRecords.filter((span) => span.locator?.offset_unit === OFFSET_UNIT).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_location_type: countBy(sourceSpanRecords, "location_type"),
    by_timestamp_status: countBy(sourceSpanRecords, "timestamp_status"),
  };
}

function renderSourceSpanStoreMarkdown(result) {
  const lines = [];
  lines.push("# Source Span Store");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.source_span_store_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.source_span_store_contract_id}`);
  lines.push(`- Source spans: ${result.summary.source_span_count}`);
  lines.push(`- Whole document: ${result.summary.whole_document_span_count}`);
  lines.push(`- Page: ${result.summary.page_span_count}`);
  lines.push(`- Paragraph: ${result.summary.paragraph_span_count}`);
  lines.push(`- Line: ${result.summary.line_span_count}`);
  lines.push(`- Char range: ${result.summary.char_range_span_count}`);
  lines.push(`- Timestamp not applicable: ${result.summary.timestamp_not_applicable_count}`);
  lines.push(`- Extractor-bound spans: ${result.summary.extractor_bound_span_count}`);
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
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? DEFAULT_SOURCE_SPAN_STORE_INPUTS.resourceIngestPath),
    normalized_text_contract_path: path.resolve(options.normalizedTextContractPath ?? DEFAULT_SOURCE_SPAN_STORE_INPUTS.normalizedTextContractPath),
    extractor_adapter_contract_path: path.resolve(options.extractorAdapterContractPath ?? DEFAULT_SOURCE_SPAN_STORE_INPUTS.extractorAdapterContractPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_SOURCE_SPAN_STORE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_SOURCE_SPAN_STORE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--normalized-text-contract") parsed.normalizedTextContractPath = argv[++index];
    else if (arg === "--extractor-adapter-contract") parsed.extractorAdapterContractPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/source-span-store.mjs [options]

Options:
  --resource-ingest <path>              resource-ingest.json path.
  --normalized-text-contract <path>     normalized-text-contract.json path.
  --extractor-adapter-contract <path>   extractor-adapter-contract.json path.
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

function serializableStore(result) {
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

function slicePreview(text, start, end, maxLength) {
  const normalizedStart = Math.max(0, Number.isFinite(start) ? start : 0);
  const normalizedEnd = Math.max(normalizedStart, Number.isFinite(end) ? end : normalizedStart);
  const value = text.slice(normalizedStart, normalizedEnd);
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}...` : value;
}

function nullableNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
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

if (import.meta.url === `file://${process.argv[1]}`) {
  await runSourceSpanStoreCli();
}
