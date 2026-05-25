import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RESOURCE_VERSION_LEDGER_OUT_DIR = "artifacts/resource-version-ledger/latest";
export const DEFAULT_RESOURCE_VERSION_LEDGER_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  immutableObjectStoreLayoutPath: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const LEDGER_CONTRACT_ID = "resource-version-ledger.v1";
const VERSION_EVENT_TYPES = ["version_recorded", "content_changed", "duplicate_content", "duplicate_candidate_skipped"];
const TRANSITION_TYPES = ["content_changed", "duplicate_content"];

export async function runResourceVersionLedger(options = {}) {
  const result = await buildResourceVersionLedger(options);
  if (options.write !== false) await writeResourceVersionLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Resource version ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildResourceVersionLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_VERSION_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceIngest = await readJson(inputs.resource_ingest_path);
  const resourceStoreInterface = await readJson(inputs.resource_store_interface_path);
  const immutableObjectStoreLayout = await readJson(inputs.immutable_object_store_layout_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const resourceRecords = resourceStoreInterface.resource_store_catalog?.resource_store_records ?? [];
  const versionRecords = resourceStoreInterface.resource_store_catalog?.resource_version_store_records ?? [];
  const rawObjectPaths = immutableObjectStoreLayout.object_store_catalog?.raw_source_object_paths ?? [];
  const duplicateItems = resourceIngest.duplicate_items ?? [];
  const pathByVersionId = new Map(rawObjectPaths.map((record) => [record.resource_version_id, record]));
  const families = buildVersionFamilies(versionRecords, resourceRecords, duplicateItems);
  const events = buildVersionEvents(families, duplicateItems, pathByVersionId);
  const transitions = buildVersionTransitions(families);
  const duplicateCandidates = buildDuplicateCandidates(duplicateItems, families);
  const objectPathBindings = buildObjectPathBindings(versionRecords, pathByVersionId);
  const validationItems = validateResourceVersionLedger({
    resourceIngest,
    resourceStoreInterface,
    immutableObjectStoreLayout,
    packageText,
    roadmapText,
    versionRecords,
    rawObjectPaths,
    families,
    events,
    transitions,
    duplicateCandidates,
    objectPathBindings,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeLedger({
    validation,
    validationItems,
    versionRecords,
    families,
    events,
    transitions,
    duplicateCandidates,
    objectPathBindings,
  });

  const result = {
    schema_version: "resource-version-ledger.v1",
    generated_at: generatedAt,
    resource_version_ledger_id: `resource-version-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_ingest: summarizeSource("resource_ingest", resourceIngest),
    source_resource_store_interface: summarizeSource("resource_store_interface", resourceStoreInterface),
    source_immutable_object_store_layout: summarizeSource("immutable_object_store_layout", immutableObjectStoreLayout),
    ledger_contract: buildLedgerContract(generatedAt),
    version_ledger_catalog: {
      schema_version: "resource-version-ledger-catalog.v1",
      generated_at: generatedAt,
      version_families: families,
      version_events: events,
      version_transitions: transitions,
      duplicate_candidates: duplicateCandidates,
      object_path_bindings: objectPathBindings,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderResourceVersionLedgerMarkdown(result),
  };
}

export async function writeResourceVersionLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "resource-version-ledger.json"), serializable);
  await writeJson(path.join(outDir, "version-families.json"), {
    generated_at: result.generated_at,
    version_family_count: result.version_ledger_catalog.version_families.length,
    version_families: result.version_ledger_catalog.version_families,
  });
  await writeJson(path.join(outDir, "version-events.json"), {
    generated_at: result.generated_at,
    version_event_count: result.version_ledger_catalog.version_events.length,
    version_events: result.version_ledger_catalog.version_events,
  });
  await writeJson(path.join(outDir, "version-transitions.json"), {
    generated_at: result.generated_at,
    version_transition_count: result.version_ledger_catalog.version_transitions.length,
    version_transitions: result.version_ledger_catalog.version_transitions,
  });
  await writeJson(path.join(outDir, "duplicate-candidates.json"), {
    generated_at: result.generated_at,
    duplicate_candidate_count: result.version_ledger_catalog.duplicate_candidates.length,
    duplicate_candidates: result.version_ledger_catalog.duplicate_candidates,
  });
  await writeJson(path.join(outDir, "object-path-bindings.json"), {
    generated_at: result.generated_at,
    object_path_binding_count: result.version_ledger_catalog.object_path_bindings.length,
    object_path_bindings: result.version_ledger_catalog.object_path_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    resource_version_ledger_id: result.resource_version_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runResourceVersionLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runResourceVersionLedger(args);
    console.log(`Resource version ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.resource_version_ledger_status}`);
    console.log(`Version families: ${result.summary.version_family_count}`);
    console.log(`Resource versions: ${result.summary.resource_version_count}`);
    console.log(`Duplicate candidates: ${result.summary.duplicate_candidate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildLedgerContract(generatedAt) {
  return {
    schema_version: "resource-version-ledger-contract.v1",
    ledger_contract_id: LEDGER_CONTRACT_ID,
    generated_at: generatedAt,
    family_key_fields: ["source_system", "external_id"],
    version_key_fields: ["resource_version_id", "content_hash"],
    duplicate_key_fields: ["raw_hash_sha256", "duplicate_of"],
    event_types: VERSION_EVENT_TYPES,
    transition_types: TRANSITION_TYPES,
    current_version_rule: "latest_resource_version_id_or_version_status_current",
    duplicate_rule: "same_content_hash_or_skipped_duplicate_item",
    change_rule: "same_external_id_with_different_content_hash",
    object_path_binding_required: true,
  };
}

function buildVersionFamilies(versionRecords, resourceRecords, duplicateItems) {
  const resourceById = new Map(resourceRecords.map((record) => [record.resource_id, record]));
  const versionsByFamilyKey = groupBy(versionRecords, (record) => familyKey(record.source_system, record.external_id));
  const duplicateByContentHash = groupBy(duplicateItems, (item) => item.raw_hash_sha256 ?? "unknown");
  const families = [];

  for (const [key, records] of versionsByFamilyKey.entries()) {
    const sortedRecords = sortVersions(records);
    const first = sortedRecords[0] ?? {};
    const resources = sortedRecords.map((record) => resourceById.get(record.resource_id)).filter(Boolean);
    const contentHashes = unique(sortedRecords.map((record) => record.content_hash).filter(Boolean));
    const duplicateCandidateCount = sortedRecords.reduce((count, record) => count + (duplicateByContentHash.get(record.content_hash)?.length ?? 0), 0);
    const currentVersions = sortedRecords.filter((record) => record.version_status === "current");
    const familyStatus = deriveFamilyStatus(sortedRecords, duplicateCandidateCount);
    families.push({
      schema_version: "resource-version-family.v1",
      version_family_id: `resource-version-family.${slugify(key)}`,
      family_key: key,
      source_system: first.source_system,
      external_id: first.external_id,
      tenant_ids: unique(sortedRecords.map((record) => record.tenant_id).filter(Boolean)),
      matter_ids: unique(sortedRecords.map((record) => record.matter_id).filter(Boolean)),
      classifications: unique(sortedRecords.map((record) => record.classification).filter(Boolean)),
      resource_ids: unique(sortedRecords.map((record) => record.resource_id).filter(Boolean)),
      resource_version_ids: sortedRecords.map((record) => record.resource_version_id),
      version_entries: sortedRecords.map((record) => ({
        resource_version_id: record.resource_version_id,
        resource_id: record.resource_id,
        version_status: record.version_status,
        content_hash: record.content_hash,
        captured_at: record.captured_at ?? record.created_at ?? null,
      })),
      current_resource_version_ids: currentVersions.map((record) => record.resource_version_id),
      latest_resource_version_ids: unique(resources.map((record) => record.latest_resource_version_id).filter(Boolean)),
      content_hashes: contentHashes,
      version_count: sortedRecords.length,
      distinct_content_hash_count: contentHashes.length,
      duplicate_content_version_count: sortedRecords.length - contentHashes.length,
      duplicate_candidate_count: duplicateCandidateCount,
      change_transition_count: Math.max(contentHashes.length - 1, 0),
      family_status: familyStatus,
      first_seen_at: sortedRecords[0]?.captured_at ?? sortedRecords[0]?.created_at ?? null,
      last_seen_at: sortedRecords.at(-1)?.captured_at ?? sortedRecords.at(-1)?.created_at ?? null,
    });
  }
  return families.sort(by("version_family_id"));
}

function buildVersionEvents(families, duplicateItems, pathByVersionId) {
  const events = [];
  for (const family of families) {
    const seenContentHashes = new Set();
    family.version_entries.forEach((entry, index) => {
      const resourceVersionId = entry.resource_version_id;
      const contentHash = entry.content_hash ?? null;
      const isDuplicate = contentHash ? seenContentHashes.has(contentHash) : false;
      const eventType = index === 0
        ? "version_recorded"
        : isDuplicate
          ? "duplicate_content"
          : "content_changed";
      if (contentHash) seenContentHashes.add(contentHash);
      events.push({
        schema_version: "resource-version-event.v1",
        version_event_id: `resource-version-event.${slugify(resourceVersionId)}.${eventType}`,
        version_family_id: family.version_family_id,
        event_type: eventType,
        source_system: family.source_system,
        external_id: family.external_id,
        resource_version_id: resourceVersionId,
        content_hash: contentHash,
        object_path_id: pathByVersionId.get(resourceVersionId)?.object_path_id ?? null,
        event_status: "recorded",
      });
    });
  }
  for (const item of duplicateItems) {
    const family = families.find((candidate) => candidate.content_hashes.includes(item.raw_hash_sha256));
    events.push({
      schema_version: "resource-version-event.v1",
      version_event_id: `resource-version-event.duplicate-candidate.${slugify(item.item_id)}`,
      version_family_id: family?.version_family_id ?? null,
      event_type: "duplicate_candidate_skipped",
      source_system: "resource_expansion",
      external_id: item.item_id,
      resource_version_id: null,
      content_hash: item.raw_hash_sha256 ?? null,
      object_path_id: null,
      event_status: family ? "matched_existing_content_hash" : "unmatched_duplicate_reference",
      metadata: {
        duplicate_of: item.duplicate_of ?? null,
        relative_path: item.relative_path ?? null,
      },
    });
  }
  return events.sort(by("version_event_id"));
}

function buildVersionTransitions(families) {
  const transitions = [];
  for (const family of families) {
    for (let index = 1; index < family.version_entries.length; index += 1) {
      const fromVersion = family.version_entries[index - 1];
      const toVersion = family.version_entries[index];
      const fromVersionId = fromVersion.resource_version_id;
      const toVersionId = toVersion.resource_version_id;
      const fromHash = fromVersion.content_hash ?? null;
      const toHash = toVersion.content_hash ?? null;
      const transitionType = fromHash === toHash ? "duplicate_content" : "content_changed";
      transitions.push({
        schema_version: "resource-version-transition.v1",
        version_transition_id: `resource-version-transition.${slugify(fromVersionId)}.${slugify(toVersionId)}`,
        version_family_id: family.version_family_id,
        transition_type: transitionType,
        from_resource_version_id: fromVersionId,
        to_resource_version_id: toVersionId,
        from_content_hash: fromHash,
        to_content_hash: toHash,
        transition_status: "recorded",
      });
    }
  }
  return transitions.sort(by("version_transition_id"));
}

function buildDuplicateCandidates(duplicateItems, families) {
  return duplicateItems.map((item) => {
    const family = families.find((candidate) => candidate.content_hashes.includes(item.raw_hash_sha256));
    return {
      schema_version: "resource-duplicate-candidate.v1",
      duplicate_candidate_id: `resource-duplicate-candidate.${slugify(item.item_id)}`,
      item_id: item.item_id,
      raw_hash_sha256: item.raw_hash_sha256,
      duplicate_of: item.duplicate_of,
      matched_version_family_id: family?.version_family_id ?? null,
      matched_resource_version_ids: family?.resource_version_ids ?? [],
      duplicate_resolution_status: family ? "matched_existing_content_hash" : "unmatched_duplicate_reference",
      source_path_stored_as_metadata_only: true,
      metadata: {
        source_path: item.source_path ?? null,
        relative_path: item.relative_path ?? null,
      },
    };
  }).sort(by("duplicate_candidate_id"));
}

function buildObjectPathBindings(versionRecords, pathByVersionId) {
  return versionRecords.map((record) => {
    const objectPath = pathByVersionId.get(record.resource_version_id);
    return {
      schema_version: "resource-version-object-path-binding.v1",
      object_path_binding_id: `resource-version-object-path-binding.${slugify(record.resource_version_id)}`,
      resource_version_id: record.resource_version_id,
      resource_id: record.resource_id,
      version_family_key: familyKey(record.source_system, record.external_id),
      object_path_id: objectPath?.object_path_id ?? null,
      object_key: objectPath?.object_key ?? null,
      content_hash: record.content_hash,
      binding_status: objectPath ? "bound" : "missing_object_path",
    };
  }).sort(by("object_path_binding_id"));
}

function validateResourceVersionLedger(context) {
  const items = [];
  const {
    resourceIngest,
    resourceStoreInterface,
    immutableObjectStoreLayout,
    packageText,
    roadmapText,
    versionRecords,
    rawObjectPaths,
    families,
    events,
    transitions,
    duplicateCandidates,
    objectPathBindings,
  } = context;
  const familyVersionIds = families.flatMap((family) => family.resource_version_ids);
  const objectPathBindingVersionIds = objectPathBindings.map((binding) => binding.resource_version_id);
  const duplicateCount = resourceIngest.summary?.duplicate_count ?? 0;

  pushCheck(items, "source.resource_ingest", "source_available", Boolean(resourceIngest?.schema_version), "Resource ingest source must be readable.");
  pushCheck(items, "source.resource_store_interface", "source_complete", resourceStoreInterface?.summary?.resource_store_interface_status === "complete", "Resource store interface must be complete.");
  pushCheck(items, "source.immutable_object_store_layout", "source_complete", immutableObjectStoreLayout?.summary?.object_store_layout_status === "complete", "Immutable object store layout must be complete.");
  pushCheck(items, "package_json", "resource_version_ledger_script_registered", String(packageText).includes("\"resource:version-ledger\""), "package.json must expose npm run resource:version-ledger.");
  pushCheck(items, "implementation_roadmap", "phase_135_recorded", String(roadmapText).includes("## Phase 135: Resource Version Ledger"), "Roadmap must record Phase 135 completion.");
  pushCheck(items, "ledger_contract", "event_types_distinguish_change_duplicate", VERSION_EVENT_TYPES.includes("content_changed") && VERSION_EVENT_TYPES.includes("duplicate_content") && VERSION_EVENT_TYPES.includes("duplicate_candidate_skipped"), "Ledger contract must distinguish changed content, duplicate content, and skipped duplicate candidates.");
  pushCheck(items, "version_families", "families_present", families.length > 0, "At least one resource version family must exist.");
  pushCheck(items, "version_families", "all_versions_assigned_once", unique(familyVersionIds).length === versionRecords.length && familyVersionIds.length === versionRecords.length, "Every ResourceVersion store record must belong to exactly one family.");
  pushCheck(items, "version_events", "events_cover_versions_and_duplicates", events.length === versionRecords.length + duplicateCandidates.length, "Version events must cover every version record and duplicate candidate.");
  pushCheck(items, "duplicate_candidates", "duplicate_count_matches_ingest", duplicateCandidates.length === duplicateCount, "Duplicate candidate count must match resource ingest duplicate count.");
  pushCheck(items, "object_path_bindings", "bindings_cover_versions", unique(objectPathBindingVersionIds).length === versionRecords.length && objectPathBindings.length === versionRecords.length, "Every ResourceVersion store record must have one object path binding row.");
  pushCheck(items, "object_path_bindings", "all_versions_bound_to_raw_object_paths", objectPathBindings.every((binding) => binding.binding_status === "bound"), "Every ResourceVersion must bind to a raw-source immutable object path.");
  pushCheck(items, "object_paths", "raw_object_paths_cover_versions", rawObjectPaths.length >= versionRecords.length, "Immutable object store layout must expose raw object paths for version records.");
  pushCheck(items, "version_transitions", "transition_types_are_explicit", transitions.every((transition) => TRANSITION_TYPES.includes(transition.transition_type)), "Every version transition must be classified as changed content or duplicate content.");

  for (const family of families) {
    pushCheck(items, family.version_family_id, "family_key_preserved", Boolean(family.source_system && family.external_id), "Version family must preserve source system and external id.");
    pushCheck(items, family.version_family_id, "current_version_recorded", family.current_resource_version_ids.length > 0 || family.latest_resource_version_ids.length > 0, "Version family must record a current/latest version pointer.");
    pushCheck(items, family.version_family_id, "content_hashes_tracked", family.distinct_content_hash_count > 0, "Version family must track content hash set.");
  }
  return items.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeLedger(context) {
  const { validation, validationItems, versionRecords, families, events, transitions, duplicateCandidates, objectPathBindings } = context;
  const failedValidationItemCount = validationItems.filter((item) => item.status === "failed").length;
  const contentHashes = unique(versionRecords.map((record) => record.content_hash).filter(Boolean));
  return {
    resource_version_ledger_status: validation.valid ? "complete" : "blocked",
    ledger_contract_id: LEDGER_CONTRACT_ID,
    version_family_count: families.length,
    resource_version_count: versionRecords.length,
    current_version_count: families.reduce((count, family) => count + family.current_resource_version_ids.length, 0),
    content_hash_group_count: contentHashes.length,
    singleton_family_count: families.filter((family) => family.version_count === 1).length,
    multi_version_family_count: families.filter((family) => family.version_count > 1).length,
    changed_content_family_count: families.filter((family) => family.distinct_content_hash_count > 1).length,
    duplicate_content_family_count: families.filter((family) => family.duplicate_content_version_count > 0).length,
    duplicate_candidate_count: duplicateCandidates.length,
    duplicate_candidate_matched_count: duplicateCandidates.filter((candidate) => candidate.duplicate_resolution_status === "matched_existing_content_hash").length,
    duplicate_candidate_unmatched_count: duplicateCandidates.filter((candidate) => candidate.duplicate_resolution_status === "unmatched_duplicate_reference").length,
    version_event_count: events.length,
    changed_content_event_count: events.filter((event) => event.event_type === "content_changed").length,
    duplicate_content_event_count: events.filter((event) => event.event_type === "duplicate_content").length,
    duplicate_candidate_event_count: events.filter((event) => event.event_type === "duplicate_candidate_skipped").length,
    version_transition_count: transitions.length,
    changed_content_transition_count: transitions.filter((transition) => transition.transition_type === "content_changed").length,
    duplicate_transition_count: transitions.filter((transition) => transition.transition_type === "duplicate_content").length,
    object_path_binding_count: objectPathBindings.length,
    bound_object_path_count: objectPathBindings.filter((binding) => binding.binding_status === "bound").length,
    unbound_object_path_count: objectPathBindings.filter((binding) => binding.binding_status !== "bound").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItemCount,
    validation_error_count: validation.errors.length,
  };
}

function summarizeSource(sourceId, artifact) {
  return {
    source_id: sourceId,
    schema_version: artifact?.schema_version ?? null,
    generated_at: artifact?.generated_at ?? null,
    summary: artifact?.summary ?? null,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.validation_id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, subjectId, checkId, passed, message) {
  items.push({
    validation_id: `resource-version-ledger.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function renderResourceVersionLedgerMarkdown(result) {
  const lines = [];
  lines.push("# Resource Version Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.resource_version_ledger_status}`);
  lines.push(`Ledger contract: ${result.summary.ledger_contract_id}`);
  lines.push(`Version families: ${result.summary.version_family_count}`);
  lines.push(`Resource versions: ${result.summary.resource_version_count}`);
  lines.push(`Duplicate candidates: ${result.summary.duplicate_candidate_count}`);
  lines.push(`Object path bindings: ${result.summary.bound_object_path_count}/${result.summary.object_path_binding_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Contract");
  lines.push("");
  lines.push("- Versions are grouped by `source_system + external_id`.");
  lines.push("- Same external id with a new content hash is classified as `content_changed`.");
  lines.push("- Same content hash or `skipped_duplicate` input is classified separately as duplicate content/candidate.");
  lines.push("- Every ResourceVersion must bind to the P134 raw-source immutable object path.");
  return lines.join("\n");
}

function deriveFamilyStatus(records, duplicateCandidateCount) {
  const contentHashCount = unique(records.map((record) => record.content_hash).filter(Boolean)).length;
  if (records.length > contentHashCount) return "has_duplicate_content_versions";
  if (contentHashCount > 1) return "has_changed_content_versions";
  if (duplicateCandidateCount > 0) return "has_skipped_duplicate_candidates";
  return "single_current_version";
}

function sortVersions(records) {
  return [...records].sort((left, right) => {
    const leftTime = left.captured_at ?? left.created_at ?? "";
    const rightTime = right.captured_at ?? right.created_at ?? "";
    const timeCompare = String(leftTime).localeCompare(String(rightTime));
    if (timeCompare !== 0) return timeCompare;
    return String(left.resource_version_id).localeCompare(String(right.resource_version_id));
  });
}

function familyKey(sourceSystem, externalId) {
  return `${sourceSystem ?? "unknown"}::${externalId ?? "unknown"}`;
}

function normalizeInputs(options = {}) {
  return {
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? options.resource_ingest_path ?? DEFAULT_RESOURCE_VERSION_LEDGER_INPUTS.resourceIngestPath),
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? options.resource_store_interface_path ?? DEFAULT_RESOURCE_VERSION_LEDGER_INPUTS.resourceStoreInterfacePath),
    immutable_object_store_layout_path: path.resolve(options.immutableObjectStoreLayoutPath ?? options.immutable_object_store_layout_path ?? DEFAULT_RESOURCE_VERSION_LEDGER_INPUTS.immutableObjectStoreLayoutPath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_RESOURCE_VERSION_LEDGER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_RESOURCE_VERSION_LEDGER_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--immutable-object-store-layout") parsed.immutableObjectStoreLayoutPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/resource-version-ledger.mjs [options]

Options:
  --resource-ingest <path>                 resource-ingest.json path.
  --resource-store-interface <path>        resource-store-interface.json path.
  --immutable-object-store-layout <path>   immutable-object-store-layout.json path.
  --package <path>                         package.json path.
  --roadmap <path>                         implementation-roadmap.md path.
  --out-dir <path>                         Output directory.
  --run-at <iso>                           Fixed generated_at timestamp.
  --check                                  Exit non-zero on validation errors.
  --help                                   Show this message.
`);
}

function serializableLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function groupBy(items, keyOrFn) {
  const grouped = new Map();
  for (const item of items) {
    const groupKey = typeof keyOrFn === "function" ? keyOrFn(item) : item[keyOrFn];
    if (!grouped.has(groupKey)) grouped.set(groupKey, []);
    grouped.get(groupKey).push(item);
  }
  return grouped;
}

function unique(values) {
  return [...new Set(values)].sort();
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function dateStamp(value) {
  return String(value).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}
