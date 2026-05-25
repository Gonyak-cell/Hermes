import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_NORMALIZED_TEXT_CONTRACT_OUT_DIR = "artifacts/normalized-text-contract/latest";
export const DEFAULT_NORMALIZED_TEXT_CONTRACT_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  immutableObjectStoreLayoutPath: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CONTRACT_ID = "normalized-text-artifact.v1";
const OFFSET_UNIT = "utf16_code_unit";
const LOCATION_UNIT_TYPES = ["page", "paragraph", "line", "char_range"];

export async function runNormalizedTextContract(options = {}) {
  const result = await buildNormalizedTextContract(options);
  if (options.write !== false) await writeNormalizedTextContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Normalized text contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildNormalizedTextContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_NORMALIZED_TEXT_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceIngest = await readJson(inputs.resource_ingest_path);
  const resourceStoreInterface = await readJson(inputs.resource_store_interface_path);
  const immutableObjectStoreLayout = await readJson(inputs.immutable_object_store_layout_path);
  const resourceVersionLedger = await readJson(inputs.resource_version_ledger_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const sourceNormalizedTexts = resourceIngest.resource_evidence?.normalized_texts ?? [];
  const sourceSpans = resourceIngest.resource_evidence?.source_spans ?? [];
  const resourceRecords = resourceStoreInterface.resource_store_catalog?.resource_store_records ?? [];
  const versionRecords = resourceStoreInterface.resource_store_catalog?.resource_version_store_records ?? [];
  const rawObjectPaths = immutableObjectStoreLayout.object_store_catalog?.raw_source_object_paths ?? [];
  const versionFamilies = resourceVersionLedger.version_ledger_catalog?.version_families ?? [];
  const objectPathBindings = resourceVersionLedger.version_ledger_catalog?.object_path_bindings ?? [];

  const context = buildProjectionContext({
    generatedAt,
    sourceSpans,
    resourceRecords,
    versionRecords,
    rawObjectPaths,
    versionFamilies,
    objectPathBindings,
  });
  const normalizedTextArtifacts = sourceNormalizedTexts.map((normalizedText) => buildNormalizedTextArtifact(normalizedText, context));
  const locationMaps = normalizedTextArtifacts.map((artifact) => artifact.location_map);
  const sourceSpanSeeds = normalizedTextArtifacts.flatMap((artifact) => artifact.source_span_seeds);
  const validationItems = validateNormalizedTextContract({
    resourceIngest,
    resourceStoreInterface,
    immutableObjectStoreLayout,
    resourceVersionLedger,
    packageText,
    roadmapText,
    sourceNormalizedTexts,
    normalizedTextArtifacts,
    locationMaps,
    sourceSpanSeeds,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeContract({
    validation,
    validationItems,
    sourceNormalizedTexts,
    normalizedTextArtifacts,
    locationMaps,
    sourceSpanSeeds,
  });

  const result = {
    schema_version: "normalized-text-contract.v1",
    generated_at: generatedAt,
    normalized_text_contract_id: `normalized-text-contract.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_ingest: summarizeSource("resource_ingest", resourceIngest),
    source_resource_store_interface: summarizeSource("resource_store_interface", resourceStoreInterface),
    source_immutable_object_store_layout: summarizeSource("immutable_object_store_layout", immutableObjectStoreLayout),
    source_resource_version_ledger: summarizeSource("resource_version_ledger", resourceVersionLedger),
    normalized_text_contract: buildContract(generatedAt),
    normalized_text_catalog: {
      schema_version: "normalized-text-catalog.v1",
      generated_at: generatedAt,
      normalized_text_artifacts: normalizedTextArtifacts.map(stripEmbeddedLocationObjects),
      location_maps: locationMaps,
      source_span_seeds: sourceSpanSeeds,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderNormalizedTextContractMarkdown(result),
  };
}

export async function writeNormalizedTextContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableContract(result);
  await writeJson(path.join(outDir, "normalized-text-contract.json"), serializable);
  await writeJson(path.join(outDir, "normalized-text-artifacts.json"), {
    generated_at: result.generated_at,
    normalized_text_artifact_count: result.normalized_text_catalog.normalized_text_artifacts.length,
    normalized_text_artifacts: result.normalized_text_catalog.normalized_text_artifacts,
  });
  await writeJson(path.join(outDir, "normalized-text-location-maps.json"), {
    generated_at: result.generated_at,
    location_map_count: result.normalized_text_catalog.location_maps.length,
    location_maps: result.normalized_text_catalog.location_maps,
  });
  await writeJson(path.join(outDir, "source-span-seeds.json"), {
    generated_at: result.generated_at,
    source_span_seed_count: result.normalized_text_catalog.source_span_seeds.length,
    source_span_seeds: result.normalized_text_catalog.source_span_seeds,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    normalized_text_contract_id: result.normalized_text_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runNormalizedTextContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runNormalizedTextContract(args);
    console.log(`Normalized text contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.normalized_text_contract_status}`);
    console.log(`Normalized text artifacts: ${result.summary.normalized_text_artifact_count}`);
    console.log(`Source span seeds: ${result.summary.source_span_seed_count}`);
    console.log(`Page units: ${result.summary.page_unit_count}`);
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
    schema_version: "normalized-text-artifact-contract.v1",
    normalized_text_contract_id: CONTRACT_ID,
    generated_at: generatedAt,
    source_schema_versions: ["normalized-text.v1", "resource-version-store-record.v1", "resource-version-ledger.v1"],
    artifact_schema_version: "normalized-text-artifact.v1",
    location_map_schema_version: "normalized-text-location-map.v1",
    source_span_seed_schema_version: "normalized-source-span-seed.v1",
    offset_unit: OFFSET_UNIT,
    location_unit_types: LOCATION_UNIT_TYPES,
    required_identity_fields: ["tenant_id", "matter_id", "classification", "resource_id", "resource_version_id"],
    required_lineage_links: ["resource_version_id", "version_family_id", "raw_source_object_key"],
    source_span_readiness_rule: "every_normalized_text_artifact_emits_a_whole_document_seed_with_char_offsets_and_page_range",
    page_locator_strategy: "preserve_extractor_markers_or_assign_synthetic_page_1",
  };
}

function buildProjectionContext({
  generatedAt,
  sourceSpans,
  resourceRecords,
  versionRecords,
  rawObjectPaths,
  versionFamilies,
  objectPathBindings,
}) {
  const resourceById = new Map(resourceRecords.map((record) => [record.resource_id, record]));
  const versionById = new Map(versionRecords.map((record) => [record.resource_version_id, record]));
  const spansByVersionId = groupBy(sourceSpans, "resource_version_id");
  const familyByVersionId = new Map();
  for (const family of versionFamilies) {
    for (const resourceVersionId of family.resource_version_ids ?? []) familyByVersionId.set(resourceVersionId, family);
  }
  const rawPathByVersionId = new Map(rawObjectPaths.map((record) => [record.resource_version_id, record]));
  const bindingByVersionId = new Map(objectPathBindings.map((binding) => [binding.resource_version_id, binding]));
  return {
    generatedAt,
    resourceById,
    versionById,
    spansByVersionId,
    familyByVersionId,
    rawPathByVersionId,
    bindingByVersionId,
  };
}

function buildNormalizedTextArtifact(normalizedText, context) {
  const version = context.versionById.get(normalizedText.resource_version_id) ?? {};
  const resource = context.resourceById.get(normalizedText.resource_id) ?? {};
  const versionFamily = context.familyByVersionId.get(normalizedText.resource_version_id);
  const rawObjectPath = context.rawPathByVersionId.get(normalizedText.resource_version_id);
  const objectPathBinding = context.bindingByVersionId.get(normalizedText.resource_version_id);
  const sourceSpan = (context.spansByVersionId.get(normalizedText.resource_version_id) ?? [])[0] ?? null;
  const textPreview = String(normalizedText.text_preview ?? "");
  const textHash = normalizedText.text_hash ?? sha256(textPreview);
  const locationMap = buildLocationMap(normalizedText, {
    textPreview,
    textHash,
    version,
    resource,
    versionFamily,
  });
  const sourceSpanSeed = buildSourceSpanSeed(normalizedText, {
    locationMap,
    textPreview,
    textHash,
    version,
    resource,
    versionFamily,
    sourceSpan,
  });
  const tenantId = version.tenant_id ?? resource.tenant_id ?? null;
  const matterId = version.matter_id ?? resource.matter_id ?? null;
  const classification = version.classification ?? resource.classification ?? null;
  const normalizedTextArtifactId = `normalized-text-artifact.${slugify(normalizedText.id)}`;

  return {
    schema_version: "normalized-text-artifact.v1",
    normalized_text_artifact_id: normalizedTextArtifactId,
    normalized_text_id: normalizedText.id,
    resource_id: normalizedText.resource_id,
    resource_version_id: normalizedText.resource_version_id,
    version_family_id: versionFamily?.version_family_id ?? null,
    tenant_id: tenantId,
    matter_id: matterId,
    classification,
    policy_snapshot_id: resource.policy_snapshot_id ?? null,
    source_system: version.source_system ?? resource.source_system ?? null,
    external_id: version.external_id ?? resource.external_id ?? null,
    external_version_id: version.external_version_id ?? resource.external_version_id ?? null,
    content_hash: version.content_hash ?? resource.content_hash ?? null,
    text_hash: textHash,
    language: normalizedText.language ?? "unknown",
    extractor_id: normalizedText.extractor_id ?? "unknown",
    quality: normalizedText.quality ?? "unknown",
    offset_unit: OFFSET_UNIT,
    text_storage: {
      storage_mode: "preview_embedded",
      normalized_text_object_key: normalizedTextObjectKey({ tenantId, matterId, classification, normalizedText, textHash }),
      raw_source_object_key: rawObjectPath?.object_key ?? objectPathBinding?.object_key ?? null,
      raw_source_binding_status: objectPathBinding?.binding_status ?? (rawObjectPath ? "bound" : "unbound"),
    },
    text_profile: {
      declared_text_length: Number(normalizedText.metadata?.text_length ?? textPreview.length),
      preview_text_length: textPreview.length,
      text_truncated: Boolean(normalizedText.metadata?.text_truncated),
      coverage_status: coverageStatus(normalizedText, textPreview),
      heading_count: normalizedText.metadata?.headings?.length ?? 0,
    },
    text_preview: textPreview,
    location_map_id: locationMap.location_map_id,
    source_span_seed_ids: [sourceSpanSeed.source_span_seed_id],
    metadata: {
      ...(normalizedText.metadata ?? {}),
      source_schema_version: normalizedText.schema_version,
      generated_at: context.generatedAt,
    },
    location_map: locationMap,
    source_span_seeds: [sourceSpanSeed],
  };
}

function buildLocationMap(normalizedText, { textPreview, textHash, version, resource, versionFamily }) {
  const normalizedTextId = normalizedText.id;
  const textLength = textPreview.length;
  const pageUnits = buildPageUnits(textPreview);
  const paragraphUnits = buildParagraphUnits(textPreview);
  const lineUnits = buildLineUnits(textPreview);
  return {
    schema_version: "normalized-text-location-map.v1",
    location_map_id: `normalized-text-location-map.${slugify(normalizedTextId)}`,
    normalized_text_id: normalizedTextId,
    resource_id: normalizedText.resource_id,
    resource_version_id: normalizedText.resource_version_id,
    version_family_id: versionFamily?.version_family_id ?? null,
    tenant_id: version.tenant_id ?? resource.tenant_id ?? null,
    matter_id: version.matter_id ?? resource.matter_id ?? null,
    classification: version.classification ?? resource.classification ?? null,
    text_hash: textHash,
    offset_unit: OFFSET_UNIT,
    text_range: {
      char_start: 0,
      char_end: textLength,
      preview_text_length: textLength,
      declared_text_length: Number(normalizedText.metadata?.text_length ?? textLength),
      text_truncated: Boolean(normalizedText.metadata?.text_truncated),
    },
    page_units: pageUnits,
    paragraph_units: paragraphUnits,
    line_units: lineUnits,
    location_unit_counts: {
      page: pageUnits.length,
      paragraph: paragraphUnits.length,
      line: lineUnits.length,
      char_range: 1,
    },
    source_span_generation: {
      ready: pageUnits.length > 0,
      recommended_location_types: ["whole_document", "page", "paragraph", "line"],
      required_fields_preserved: ["normalized_text_id", "resource_version_id", "page_number", "char_start", "char_end", "offset_unit"],
    },
  };
}

function buildSourceSpanSeed(normalizedText, { locationMap, textPreview, textHash, version, resource, versionFamily, sourceSpan }) {
  const pageNumbers = locationMap.page_units.map((page) => page.page_number).filter((pageNumber) => Number.isFinite(pageNumber));
  const firstPage = pageNumbers[0] ?? 1;
  const lastPage = pageNumbers.at(-1) ?? firstPage;
  return {
    schema_version: "normalized-source-span-seed.v1",
    source_span_seed_id: `normalized-source-span-seed.${slugify(normalizedText.id)}.whole_document`,
    normalized_text_id: normalizedText.id,
    source_span_id: sourceSpan?.id ?? null,
    resource_id: normalizedText.resource_id,
    resource_version_id: normalizedText.resource_version_id,
    version_family_id: versionFamily?.version_family_id ?? null,
    tenant_id: version.tenant_id ?? resource.tenant_id ?? null,
    matter_id: version.matter_id ?? resource.matter_id ?? null,
    classification: version.classification ?? resource.classification ?? null,
    location_type: "whole_document",
    locator: {
      page_start: firstPage,
      page_end: lastPage,
      char_start: 0,
      char_end: textPreview.length,
      offset_unit: OFFSET_UNIT,
      source_locator_strategy: sourceSpan ? "ingest_source_span_bound" : "normalized_text_seed",
    },
    seed_status: sourceSpan ? "ready" : "missing_source_span",
    text_hash: textHash,
    content_preview: truncate(textPreview, 500),
  };
}

function buildPageUnits(text) {
  const markerUnits = buildMarkerPageUnits(text);
  if (markerUnits.length > 0) return markerUnits;
  const formFeedUnits = buildFormFeedPageUnits(text);
  if (formFeedUnits.length > 0) return formFeedUnits;
  return [
    {
      schema_version: "normalized-location-unit.v1",
      unit_type: "page",
      page_number: 1,
      char_start: 0,
      char_end: text.length,
      locator_status: "synthetic",
      text_hash: sha256(text),
    },
  ];
}

function buildMarkerPageUnits(text) {
  const markers = [];
  const markerPattern = /(^|\n)(?:Page|페이지|Slide)\s+(\d+)\b/g;
  let match;
  while ((match = markerPattern.exec(text)) !== null) {
    markers.push({
      start: match.index + match[1].length,
      page_number: Number(match[2]),
    });
  }
  return markers.map((marker, index) => {
    const end = markers[index + 1]?.start ?? text.length;
    const chunk = text.slice(marker.start, end);
    return {
      schema_version: "normalized-location-unit.v1",
      unit_type: "page",
      page_number: marker.page_number,
      char_start: marker.start,
      char_end: end,
      locator_status: "detected_marker",
      text_hash: sha256(chunk),
    };
  });
}

function buildFormFeedPageUnits(text) {
  if (!text.includes("\f")) return [];
  const units = [];
  let start = 0;
  let pageNumber = 1;
  for (const part of text.split("\f")) {
    const end = start + part.length;
    units.push({
      schema_version: "normalized-location-unit.v1",
      unit_type: "page",
      page_number: pageNumber,
      char_start: start,
      char_end: end,
      locator_status: "detected_form_feed",
      text_hash: sha256(part),
    });
    start = end + 1;
    pageNumber += 1;
  }
  return units;
}

function buildParagraphUnits(text) {
  if (!text) return [locationUnit("paragraph", 1, 0, 0, "")];
  const parts = text.split(/\n\s*\n/g);
  const units = [];
  let searchStart = 0;
  for (const part of parts) {
    const start = text.indexOf(part, searchStart);
    const end = start + part.length;
    if (part.trim()) units.push(locationUnit("paragraph", units.length + 1, start, end, part));
    searchStart = Math.max(end, searchStart);
  }
  return units.length > 0 ? units : [locationUnit("paragraph", 1, 0, text.length, text)];
}

function buildLineUnits(text) {
  if (!text) return [locationUnit("line", 1, 0, 0, "")];
  const units = [];
  let start = 0;
  for (const line of text.split("\n")) {
    const end = start + line.length;
    units.push(locationUnit("line", units.length + 1, start, end, line));
    start = end + 1;
  }
  return units;
}

function locationUnit(unitType, index, charStart, charEnd, text) {
  return {
    schema_version: "normalized-location-unit.v1",
    unit_type: unitType,
    [`${unitType}_index`]: index,
    char_start: Math.max(charStart, 0),
    char_end: Math.max(charEnd, 0),
    locator_status: "derived",
    text_hash: sha256(text),
  };
}

function validateNormalizedTextContract({
  resourceIngest,
  resourceStoreInterface,
  immutableObjectStoreLayout,
  resourceVersionLedger,
  packageText,
  roadmapText,
  sourceNormalizedTexts,
  normalizedTextArtifacts,
  locationMaps,
  sourceSpanSeeds,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const resourceVersionIds = new Set((resourceStoreInterface.resource_store_catalog?.resource_version_store_records ?? []).map((record) => record.resource_version_id));
  const versionFamilyIdsByVersion = new Set((resourceVersionLedger.version_ledger_catalog?.version_families ?? []).flatMap((family) => family.resource_version_ids ?? []));
  const rawObjectVersionIds = new Set((immutableObjectStoreLayout.object_store_catalog?.raw_source_object_paths ?? []).map((record) => record.resource_version_id));
  const sourceNormalizedTextIds = new Set(sourceNormalizedTexts.map((text) => text.id));
  const locationMapByText = new Map(locationMaps.map((map) => [map.normalized_text_id, map]));
  const seedByText = new Map(sourceSpanSeeds.map((seed) => [seed.normalized_text_id, seed]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:normalized-text"]), "package.json must expose resource:normalized-text.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 136: Normalized Text Contract"), "Implementation roadmap must document Phase 136.");
  pushCheck(validationItems, "source", "resource_ingest_available", resourceIngest.schema_version === "resource-ingest.v1", "Resource ingest source must be available.");
  pushCheck(validationItems, "source", "resource_store_interface_complete", resourceStoreInterface.summary?.resource_store_interface_status === "complete", "Resource store interface must be complete.");
  pushCheck(validationItems, "source", "object_store_layout_complete", immutableObjectStoreLayout.summary?.object_store_layout_status === "complete", "Immutable object store layout must be complete.");
  pushCheck(validationItems, "source", "resource_version_ledger_complete", resourceVersionLedger.summary?.resource_version_ledger_status === "complete", "Resource version ledger must be complete.");
  pushCheck(validationItems, "catalog", "normalized_texts_present", sourceNormalizedTexts.length > 0, "At least one normalized text source record is required.");
  pushCheck(validationItems, "catalog", "artifact_count_matches_source", normalizedTextArtifacts.length === sourceNormalizedTexts.length, "Every source normalized text must produce one artifact.");
  pushCheck(validationItems, "catalog", "location_map_count_matches_artifacts", locationMaps.length === normalizedTextArtifacts.length, "Every normalized text artifact must produce one location map.");
  pushCheck(validationItems, "catalog", "source_span_seed_count_matches_artifacts", sourceSpanSeeds.length === normalizedTextArtifacts.length, "Every normalized text artifact must produce one source span seed.");

  for (const artifact of normalizedTextArtifacts) {
    const locationMap = locationMapByText.get(artifact.normalized_text_id);
    const seed = seedByText.get(artifact.normalized_text_id);
    const pathPrefix = `normalized_text_artifacts.${artifact.normalized_text_id}`;
    pushCheck(validationItems, pathPrefix, "source_record_present", sourceNormalizedTextIds.has(artifact.normalized_text_id), "Artifact must link to a source normalized text.");
    pushCheck(validationItems, pathPrefix, "resource_version_link_present", resourceVersionIds.has(artifact.resource_version_id), "Artifact must link to a ResourceVersion store record.");
    pushCheck(validationItems, pathPrefix, "version_family_link_present", versionFamilyIdsByVersion.has(artifact.resource_version_id), "Artifact must link to a Resource Version Ledger family.");
    pushCheck(validationItems, pathPrefix, "raw_object_path_bound", rawObjectVersionIds.has(artifact.resource_version_id) && artifact.text_storage.raw_source_binding_status === "bound", "Artifact must bind to a raw-source immutable object key.");
    pushCheck(validationItems, pathPrefix, "text_hash_present", Boolean(artifact.text_hash), "Artifact must carry a stable text hash.");
    pushCheck(validationItems, pathPrefix, "identity_boundary_present", Boolean(artifact.tenant_id && artifact.matter_id && artifact.classification), "Artifact must preserve tenant, matter, and classification.");
    pushCheck(validationItems, pathPrefix, "location_map_present", Boolean(locationMap), "Artifact must link to a location map.");
    pushCheck(validationItems, pathPrefix, "source_span_seed_present", Boolean(seed), "Artifact must link to a source span seed.");
  }

  for (const locationMap of locationMaps) {
    const pathPrefix = `location_maps.${locationMap.normalized_text_id}`;
    const range = locationMap.text_range ?? {};
    const pageUnits = locationMap.page_units ?? [];
    const paragraphUnits = locationMap.paragraph_units ?? [];
    const lineUnits = locationMap.line_units ?? [];
    pushCheck(validationItems, pathPrefix, "offset_unit_canonical", locationMap.offset_unit === OFFSET_UNIT, "Location map must use the canonical offset unit.");
    pushCheck(validationItems, pathPrefix, "text_range_valid", range.char_start === 0 && range.char_end >= range.char_start, "Location map text range must start at 0 and have a non-negative end.");
    pushCheck(validationItems, pathPrefix, "page_units_present", pageUnits.length > 0, "Location map must preserve at least one page unit.");
    pushCheck(validationItems, pathPrefix, "paragraph_units_present", paragraphUnits.length > 0, "Location map must preserve paragraph offsets.");
    pushCheck(validationItems, pathPrefix, "line_units_present", lineUnits.length > 0, "Location map must preserve line offsets.");
    pushCheck(validationItems, pathPrefix, "page_offsets_in_range", pageUnits.every((unit) => offsetsWithinRange(unit, range)), "Page unit offsets must fit inside the normalized text range.");
    pushCheck(validationItems, pathPrefix, "paragraph_offsets_in_range", paragraphUnits.every((unit) => offsetsWithinRange(unit, range)), "Paragraph offsets must fit inside the normalized text range.");
    pushCheck(validationItems, pathPrefix, "line_offsets_in_range", lineUnits.every((unit) => offsetsWithinRange(unit, range)), "Line offsets must fit inside the normalized text range.");
    pushCheck(validationItems, pathPrefix, "source_span_generation_ready", locationMap.source_span_generation?.ready === true, "Location map must be ready for source span generation.");
  }

  for (const seed of sourceSpanSeeds) {
    const locator = seed.locator ?? {};
    const pathPrefix = `source_span_seeds.${seed.source_span_seed_id}`;
    pushCheck(validationItems, pathPrefix, "seed_ready", seed.seed_status === "ready", "Source span seed must be linked to an ingest source span.");
    pushCheck(validationItems, pathPrefix, "page_range_present", Number.isFinite(locator.page_start) && Number.isFinite(locator.page_end), "Source span seed must preserve page range.");
    pushCheck(validationItems, pathPrefix, "char_range_present", Number.isFinite(locator.char_start) && Number.isFinite(locator.char_end) && locator.char_end >= locator.char_start, "Source span seed must preserve char offsets.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `normalized-text-validation.${slugify(pathLabel)}.${checkId}`,
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

function summarizeContract({ validation, validationItems, sourceNormalizedTexts, normalizedTextArtifacts, locationMaps, sourceSpanSeeds }) {
  const pageUnits = locationMaps.flatMap((map) => map.page_units ?? []);
  const paragraphUnits = locationMaps.flatMap((map) => map.paragraph_units ?? []);
  const lineUnits = locationMaps.flatMap((map) => map.line_units ?? []);
  return {
    normalized_text_contract_status: validation.valid ? "complete" : "blocked",
    normalized_text_contract_id: CONTRACT_ID,
    source_normalized_text_count: sourceNormalizedTexts.length,
    normalized_text_artifact_count: normalizedTextArtifacts.length,
    resource_version_link_count: normalizedTextArtifacts.filter((artifact) => artifact.resource_version_id).length,
    version_family_link_count: normalizedTextArtifacts.filter((artifact) => artifact.version_family_id).length,
    raw_source_bound_count: normalizedTextArtifacts.filter((artifact) => artifact.text_storage?.raw_source_binding_status === "bound").length,
    text_hash_count: normalizedTextArtifacts.filter((artifact) => artifact.text_hash).length,
    location_map_count: locationMaps.length,
    source_span_seed_count: sourceSpanSeeds.length,
    source_span_seed_ready_count: sourceSpanSeeds.filter((seed) => seed.seed_status === "ready").length,
    page_unit_count: pageUnits.length,
    synthetic_page_unit_count: pageUnits.filter((unit) => unit.locator_status === "synthetic").length,
    detected_page_unit_count: pageUnits.filter((unit) => unit.locator_status !== "synthetic").length,
    paragraph_unit_count: paragraphUnits.length,
    line_unit_count: lineUnits.length,
    complete_preview_count: normalizedTextArtifacts.filter((artifact) => artifact.text_profile?.coverage_status === "complete_preview").length,
    preview_only_count: normalizedTextArtifacts.filter((artifact) => artifact.text_profile?.coverage_status === "preview_only").length,
    truncated_text_count: normalizedTextArtifacts.filter((artifact) => artifact.text_profile?.text_truncated).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
  };
}

function renderNormalizedTextContractMarkdown(result) {
  const lines = [];
  lines.push("# Normalized Text Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.normalized_text_contract_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.normalized_text_contract_id}`);
  lines.push(`- Normalized text artifacts: ${result.summary.normalized_text_artifact_count}`);
  lines.push(`- Location maps: ${result.summary.location_map_count}`);
  lines.push(`- Source span seeds: ${result.summary.source_span_seed_count}`);
  lines.push(`- Page units: ${result.summary.page_unit_count}`);
  lines.push(`- Paragraph units: ${result.summary.paragraph_unit_count}`);
  lines.push(`- Line units: ${result.summary.line_unit_count}`);
  lines.push(`- Raw-source bindings: ${result.summary.raw_source_bound_count}`);
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
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? DEFAULT_NORMALIZED_TEXT_CONTRACT_INPUTS.resourceIngestPath),
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? DEFAULT_NORMALIZED_TEXT_CONTRACT_INPUTS.resourceStoreInterfacePath),
    immutable_object_store_layout_path: path.resolve(options.immutableObjectStoreLayoutPath ?? DEFAULT_NORMALIZED_TEXT_CONTRACT_INPUTS.immutableObjectStoreLayoutPath),
    resource_version_ledger_path: path.resolve(options.resourceVersionLedgerPath ?? DEFAULT_NORMALIZED_TEXT_CONTRACT_INPUTS.resourceVersionLedgerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_NORMALIZED_TEXT_CONTRACT_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_NORMALIZED_TEXT_CONTRACT_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--immutable-object-store-layout") parsed.immutableObjectStoreLayoutPath = argv[++index];
    else if (arg === "--resource-version-ledger") parsed.resourceVersionLedgerPath = argv[++index];
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
  console.log(`Usage: node scripts/normalized-text-contract.mjs [options]

Options:
  --resource-ingest <path>              resource-ingest.json path.
  --resource-store-interface <path>     resource-store-interface.json path.
  --immutable-object-store-layout <path>
                                      immutable-object-store-layout.json path.
  --resource-version-ledger <path>      resource-version-ledger.json path.
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

function stripEmbeddedLocationObjects(artifact) {
  const { location_map, source_span_seeds, ...serializable } = artifact;
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

function normalizedTextObjectKey({ tenantId, matterId, classification, normalizedText, textHash }) {
  return [
    "normalized-text",
    `tenant=${safeSegment(tenantId)}`,
    `matter=${safeSegment(matterId)}`,
    `classification=${safeSegment(classification)}`,
    `resource=${safeSegment(normalizedText.resource_id)}`,
    `version=${safeSegment(normalizedText.resource_version_id)}`,
    `sha256=${safeSegment(textHash)}`,
    `${safeSegment(normalizedText.id)}.txt`,
  ].join("/");
}

function coverageStatus(normalizedText, textPreview) {
  if (normalizedText.metadata?.text_truncated) return "preview_only";
  const declaredLength = Number(normalizedText.metadata?.text_length ?? textPreview.length);
  return declaredLength === textPreview.length ? "complete_preview" : "preview_only";
}

function offsetsWithinRange(unit, range) {
  return Number.isFinite(unit.char_start)
    && Number.isFinite(unit.char_end)
    && unit.char_start >= range.char_start
    && unit.char_end <= range.char_end
    && unit.char_end >= unit.char_start;
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

function truncate(value, maxLength) {
  const text = String(value ?? "");
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}...` : text;
}

function sha256(value) {
  return createHash("sha256").update(String(value ?? "")).digest("hex");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160) || "unknown";
}

function safeSegment(value) {
  return slugify(value ?? "unknown");
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await runNormalizedTextContractCli();
}
