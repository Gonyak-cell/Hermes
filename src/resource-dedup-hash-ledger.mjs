import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_OUT_DIR = "artifacts/resource-dedup-hash/latest";
export const DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_INPUTS = {
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  resourceVersionLedgerPath: "artifacts/resource-version-ledger/latest/resource-version-ledger.json",
  immutableObjectStoreLayoutPath: "artifacts/immutable-object-store-layout/latest/immutable-object-store-layout.json",
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const DEDUP_HASH_LEDGER_ID = "resource-dedup-hash-ledger.v1";
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const REQUIRED_CRITERIA = ["content_hash", "external_id", "resource_version"];

export async function runResourceDedupHashLedger(options = {}) {
  const result = await buildResourceDedupHashLedger(options);
  if (options.write !== false) await writeResourceDedupHashLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Resource dedup/hash ledger failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildResourceDedupHashLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    resourceStoreInterface,
    resourceVersionLedger,
    immutableObjectStoreLayout,
    resourceIngest,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.resource_store_interface_path),
    readJson(inputs.resource_version_ledger_path),
    readJson(inputs.immutable_object_store_layout_path),
    readJson(inputs.resource_ingest_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const resourceRecords = resourceStoreInterface.resource_store_catalog?.resource_store_records ?? [];
  const versionRecords = resourceStoreInterface.resource_store_catalog?.resource_version_store_records ?? [];
  const versionFamilies = resourceVersionLedger.version_ledger_catalog?.version_families ?? [];
  const versionEvents = resourceVersionLedger.version_ledger_catalog?.version_events ?? [];
  const duplicateCandidates = resourceVersionLedger.version_ledger_catalog?.duplicate_candidates ?? [];
  const objectPathBindings = resourceVersionLedger.version_ledger_catalog?.object_path_bindings ?? [];
  const rawObjectPaths = immutableObjectStoreLayout.object_store_catalog?.raw_source_object_paths ?? [];

  const hashGroups = buildHashGroups(versionRecords, resourceRecords);
  const externalIdGroups = buildExternalIdGroups(versionRecords);
  const dedupDecisions = buildDedupDecisions({
    versionRecords,
    versionFamilies,
    hashGroups,
    duplicateCandidates,
    objectPathBindings,
    generatedAt,
  });
  const candidateLinks = buildCandidateLinks({
    hashGroups,
    externalIdGroups,
    duplicateCandidates,
    versionEvents,
    generatedAt,
  });
  const hashIntegrityChecks = buildHashIntegrityChecks({
    resourceRecords,
    versionRecords,
    rawObjectPaths,
    generatedAt,
  });
  const validationItems = validateResourceDedupHashLedger({
    resourceStoreInterface,
    resourceVersionLedger,
    immutableObjectStoreLayout,
    resourceIngest,
    packageText,
    roadmapText,
    versionRecords,
    hashGroups,
    externalIdGroups,
    dedupDecisions,
    candidateLinks,
    hashIntegrityChecks,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeDedupHashLedger({
    validation,
    validationItems,
    resourceRecords,
    versionRecords,
    hashGroups,
    externalIdGroups,
    dedupDecisions,
    candidateLinks,
    hashIntegrityChecks,
  });

  const result = {
    schema_version: "resource-dedup-hash-ledger.v1",
    generated_at: generatedAt,
    resource_dedup_hash_ledger_id: `resource-dedup-hash-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("resource_store_interface", resourceStoreInterface),
      summarizeSource("resource_version_ledger", resourceVersionLedger),
      summarizeSource("immutable_object_store_layout", immutableObjectStoreLayout),
      summarizeSource("resource_ingest", resourceIngest),
    ],
    dedup_hash_contract: buildDedupHashContract(generatedAt),
    dedup_hash_catalog: {
      schema_version: "resource-dedup-hash-catalog.v1",
      generated_at: generatedAt,
      hash_groups: hashGroups,
      external_id_groups: externalIdGroups,
      dedup_decisions: dedupDecisions,
      duplicate_candidate_links: candidateLinks,
      hash_integrity_checks: hashIntegrityChecks,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderResourceDedupHashLedgerMarkdown(result),
  };
}

export async function writeResourceDedupHashLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableDedupHashLedger(result);
  await writeJson(path.join(outDir, "resource-dedup-hash-ledger.json"), serializable);
  await writeJson(path.join(outDir, "hash-groups.json"), {
    schema_version: "resource-hash-group-set.v1",
    generated_at: result.generated_at,
    hash_group_count: result.dedup_hash_catalog.hash_groups.length,
    hash_groups: result.dedup_hash_catalog.hash_groups,
  });
  await writeJson(path.join(outDir, "external-id-groups.json"), {
    schema_version: "resource-external-id-group-set.v1",
    generated_at: result.generated_at,
    external_id_group_count: result.dedup_hash_catalog.external_id_groups.length,
    external_id_groups: result.dedup_hash_catalog.external_id_groups,
  });
  await writeJson(path.join(outDir, "dedup-decisions.json"), {
    schema_version: "resource-dedup-decision-set.v1",
    generated_at: result.generated_at,
    dedup_decision_count: result.dedup_hash_catalog.dedup_decisions.length,
    dedup_decisions: result.dedup_hash_catalog.dedup_decisions,
  });
  await writeJson(path.join(outDir, "duplicate-candidate-links.json"), {
    schema_version: "resource-duplicate-candidate-link-set.v1",
    generated_at: result.generated_at,
    duplicate_candidate_link_count: result.dedup_hash_catalog.duplicate_candidate_links.length,
    duplicate_candidate_links: result.dedup_hash_catalog.duplicate_candidate_links,
  });
  await writeJson(path.join(outDir, "hash-integrity-checks.json"), {
    schema_version: "resource-hash-integrity-check-set.v1",
    generated_at: result.generated_at,
    hash_integrity_check_count: result.dedup_hash_catalog.hash_integrity_checks.length,
    hash_integrity_checks: result.dedup_hash_catalog.hash_integrity_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    resource_dedup_hash_ledger_id: result.resource_dedup_hash_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runResourceDedupHashLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runResourceDedupHashLedger(args);
    console.log(`Resource dedup/hash ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.resource_dedup_hash_status}`);
    console.log(`Hash groups: ${result.summary.hash_group_count}`);
    console.log(`External id groups: ${result.summary.external_id_group_count}`);
    console.log(`Dedup decisions: ${result.summary.dedup_decision_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildDedupHashContract(generatedAt) {
  return {
    schema_version: "resource-dedup-hash-contract.v1",
    dedup_hash_ledger_id: DEDUP_HASH_LEDGER_ID,
    generated_at: generatedAt,
    required_criteria: REQUIRED_CRITERIA,
    hash_algorithm: "sha256",
    content_hash_rule: "64-character sha256 content hashes group byte-identical raw resources before extraction or retrieval",
    external_id_rule: "source_system plus external_id groups resource versions into upstream identity families",
    resource_version_rule: "resource_version_id and version family transitions distinguish current, changed, and duplicate versions",
    duplicate_candidate_rule: "skipped_duplicate items remain metadata-only candidates and are never silently promoted",
    mutation_rule: "dedup decisions are classification records only; no source, object, evidence, or output record is deleted",
  };
}

function buildHashGroups(versionRecords, resourceRecords) {
  const resourceById = new Map(resourceRecords.map((record) => [record.resource_id, record]));
  return [...groupBy(versionRecords, (record) => record.content_hash ?? "unknown").entries()]
    .map(([contentHash, records]) => {
      const resources = records.map((record) => resourceById.get(record.resource_id)).filter(Boolean);
      return {
        schema_version: "resource-hash-group.v1",
        hash_group_id: `resource-hash-group.${slugify(contentHash)}`,
        content_hash: contentHash,
        content_hash_algorithm: "sha256",
        group_status: records.length > 1 ? "duplicate_content_hash" : "unique_content_hash",
        resource_version_ids: unique(records.map((record) => record.resource_version_id)),
        resource_ids: unique(records.map((record) => record.resource_id)),
        tenant_ids: unique(records.map((record) => record.tenant_id).filter(Boolean)),
        matter_ids: unique(records.map((record) => record.matter_id).filter(Boolean)),
        classifications: unique(records.map((record) => record.classification).filter(Boolean)),
        source_system_external_ids: unique(records.map((record) => externalKey(record))),
        source_uris: unique(resources.map((record) => record.source_uri).filter(Boolean)),
        version_count: records.length,
        resource_count: unique(records.map((record) => record.resource_id)).length,
      };
    })
    .sort(by("hash_group_id"));
}

function buildExternalIdGroups(versionRecords) {
  return [...groupBy(versionRecords, externalKey).entries()]
    .map(([key, records]) => {
      const contentHashes = unique(records.map((record) => record.content_hash).filter(Boolean));
      const status = contentHashes.length > 1
        ? "changed_external_id"
        : records.length > contentHashes.length
          ? "duplicate_external_id_version"
          : "singleton_external_id";
      const [sourceSystem, externalId] = key.split("::");
      return {
        schema_version: "resource-external-id-group.v1",
        external_id_group_id: `resource-external-id-group.${slugify(key)}`,
        external_id_group_key: key,
        source_system: sourceSystem ?? "unknown",
        external_id: externalId ?? "unknown",
        group_status: status,
        resource_version_ids: unique(records.map((record) => record.resource_version_id)),
        resource_ids: unique(records.map((record) => record.resource_id)),
        content_hashes: contentHashes,
        version_count: records.length,
        distinct_content_hash_count: contentHashes.length,
      };
    })
    .sort(by("external_id_group_id"));
}

function buildDedupDecisions({ versionRecords, versionFamilies, hashGroups, duplicateCandidates, objectPathBindings, generatedAt }) {
  const familyByVersionId = new Map();
  for (const family of versionFamilies) {
    for (const versionId of family.resource_version_ids ?? []) {
      familyByVersionId.set(versionId, family);
    }
  }
  const hashGroupByHash = new Map(hashGroups.map((group) => [group.content_hash, group]));
  const objectBindingByVersionId = new Map(objectPathBindings.map((binding) => [binding.resource_version_id, binding]));
  const seenInFamily = new Map();
  const decisions = versionRecords.map((record) => {
    const family = familyByVersionId.get(record.resource_version_id);
    const hashGroup = hashGroupByHash.get(record.content_hash);
    const familySeenKey = `${family?.version_family_id ?? externalKey(record)}::${record.content_hash}`;
    const duplicateWithinFamily = seenInFamily.has(familySeenKey);
    seenInFamily.set(familySeenKey, true);
    const dedupStatus = duplicateWithinFamily
      ? "duplicate_version"
      : (family?.distinct_content_hash_count ?? 1) > 1
        ? "changed_version"
        : (hashGroup?.version_count ?? 1) > 1
          ? "duplicate_content_hash"
          : "unique_version";
    return {
      schema_version: "resource-dedup-decision.v1",
      dedup_decision_id: `resource-dedup-decision.${slugify(record.resource_version_id)}`,
      decision_scope: "resource_version",
      dedup_status: dedupStatus,
      decision_status: dedupStatus === "unique_version" || dedupStatus === "changed_version" ? "promote_or_keep" : "hold_duplicate",
      source_system: record.source_system,
      external_id: record.external_id,
      resource_id: record.resource_id,
      resource_version_id: record.resource_version_id,
      content_hash: record.content_hash,
      content_hash_algorithm: record.content_hash_algorithm ?? "sha256",
      hash_group_id: hashGroup?.hash_group_id ?? null,
      external_id_group_key: externalKey(record),
      version_family_id: family?.version_family_id ?? null,
      object_path_id: objectBindingByVersionId.get(record.resource_version_id)?.object_path_id ?? null,
      criteria: buildCriteria(record),
      mutation_allowed: false,
      human_review_required: dedupStatus !== "unique_version",
      decided_at: generatedAt,
    };
  });

  for (const candidate of duplicateCandidates) {
    decisions.push({
      schema_version: "resource-dedup-decision.v1",
      dedup_decision_id: `resource-dedup-decision.${slugify(candidate.duplicate_candidate_id)}`,
      decision_scope: "skipped_duplicate_candidate",
      dedup_status: "skipped_duplicate_candidate",
      decision_status: "metadata_only_skip",
      source_system: "resource_expansion",
      external_id: candidate.item_id,
      resource_id: null,
      resource_version_id: null,
      content_hash: candidate.raw_hash_sha256,
      content_hash_algorithm: "sha256",
      hash_group_id: candidate.raw_hash_sha256 ? `resource-hash-group.${slugify(candidate.raw_hash_sha256)}` : null,
      external_id_group_key: `resource_expansion::${candidate.item_id}`,
      version_family_id: candidate.matched_version_family_id ?? null,
      object_path_id: null,
      criteria: {
        content_hash: candidate.raw_hash_sha256 ?? null,
        external_id: candidate.item_id,
        resource_version_id: null,
        duplicate_of: candidate.duplicate_of ?? null,
      },
      mutation_allowed: false,
      human_review_required: true,
      decided_at: generatedAt,
    });
  }
  return decisions.sort(by("dedup_decision_id"));
}

function buildCandidateLinks({ hashGroups, externalIdGroups, duplicateCandidates, versionEvents, generatedAt }) {
  const links = [];
  for (const hashGroup of hashGroups.filter((group) => group.group_status === "duplicate_content_hash")) {
    links.push({
      schema_version: "resource-duplicate-candidate-link.v1",
      duplicate_candidate_link_id: `resource-duplicate-candidate-link.${slugify(hashGroup.hash_group_id)}`,
      link_type: "content_hash_group",
      link_status: "classified",
      content_hash: hashGroup.content_hash,
      resource_version_ids: hashGroup.resource_version_ids,
      matched_version_family_ids: [],
      generated_at: generatedAt,
    });
  }
  for (const externalGroup of externalIdGroups.filter((group) => group.group_status !== "singleton_external_id")) {
    links.push({
      schema_version: "resource-duplicate-candidate-link.v1",
      duplicate_candidate_link_id: `resource-duplicate-candidate-link.${slugify(externalGroup.external_id_group_id)}`,
      link_type: externalGroup.group_status,
      link_status: "classified",
      content_hash: externalGroup.content_hashes[0] ?? null,
      resource_version_ids: externalGroup.resource_version_ids,
      matched_version_family_ids: [],
      generated_at: generatedAt,
    });
  }
  for (const candidate of duplicateCandidates) {
    const event = versionEvents.find((item) => item.event_type === "duplicate_candidate_skipped" && item.external_id === candidate.item_id);
    links.push({
      schema_version: "resource-duplicate-candidate-link.v1",
      duplicate_candidate_link_id: `resource-duplicate-candidate-link.${slugify(candidate.duplicate_candidate_id)}`,
      link_type: "skipped_duplicate_candidate",
      link_status: candidate.duplicate_resolution_status,
      content_hash: candidate.raw_hash_sha256 ?? null,
      resource_version_ids: candidate.matched_resource_version_ids ?? [],
      matched_version_family_ids: candidate.matched_version_family_id ? [candidate.matched_version_family_id] : [],
      source_version_event_id: event?.version_event_id ?? null,
      generated_at: generatedAt,
    });
  }
  return links.sort(by("duplicate_candidate_link_id"));
}

function buildHashIntegrityChecks({ resourceRecords, versionRecords, rawObjectPaths, generatedAt }) {
  const rawObjectPathByVersionId = new Map(rawObjectPaths.map((record) => [record.resource_version_id, record]));
  const resourceChecks = resourceRecords.map((record) => buildHashIntegrityCheck({
    entityType: "resource",
    entityId: record.resource_id,
    contentHash: record.content_hash,
    algorithm: record.content_hash_algorithm,
    objectKey: null,
    generatedAt,
  }));
  const versionChecks = versionRecords.map((record) => buildHashIntegrityCheck({
    entityType: "resource_version",
    entityId: record.resource_version_id,
    contentHash: record.content_hash,
    algorithm: record.content_hash_algorithm,
    objectKey: rawObjectPathByVersionId.get(record.resource_version_id)?.object_key ?? null,
    generatedAt,
  }));
  return [...resourceChecks, ...versionChecks].sort(by("hash_integrity_check_id"));
}

function buildHashIntegrityCheck({ entityType, entityId, contentHash, algorithm, objectKey, generatedAt }) {
  const algorithmStatus = (algorithm ?? "sha256") === "sha256" ? "passed" : "failed";
  const hashStatus = HASH_PATTERN.test(String(contentHash ?? "")) ? "passed" : "failed";
  return {
    schema_version: "resource-hash-integrity-check.v1",
    hash_integrity_check_id: `resource-hash-integrity-check.${slugify(entityType)}.${slugify(entityId)}`,
    entity_type: entityType,
    entity_id: entityId,
    content_hash: contentHash ?? null,
    content_hash_algorithm: algorithm ?? null,
    object_key: objectKey,
    algorithm_status: algorithmStatus,
    hash_format_status: hashStatus,
    integrity_status: algorithmStatus === "passed" && hashStatus === "passed" ? "passed" : "failed",
    checked_at: generatedAt,
  };
}

function validateResourceDedupHashLedger(context) {
  const items = [];
  const {
    resourceStoreInterface,
    resourceVersionLedger,
    immutableObjectStoreLayout,
    resourceIngest,
    packageText,
    roadmapText,
    versionRecords,
    hashGroups,
    externalIdGroups,
    dedupDecisions,
    candidateLinks,
    hashIntegrityChecks,
  } = context;
  const duplicateCandidateCount = resourceVersionLedger.summary?.duplicate_candidate_count ?? 0;
  const expectedDecisionCount = versionRecords.length + duplicateCandidateCount;
  const versionDecisionCount = dedupDecisions.filter((decision) => decision.decision_scope === "resource_version").length;
  const skippedDecisionCount = dedupDecisions.filter((decision) => decision.decision_scope === "skipped_duplicate_candidate").length;

  pushCheck(items, "source.resource_store_interface", "source_complete", resourceStoreInterface?.summary?.resource_store_interface_status === "complete", "Resource store interface must be complete.");
  pushCheck(items, "source.resource_version_ledger", "source_complete", resourceVersionLedger?.summary?.resource_version_ledger_status === "complete", "Resource version ledger must be complete.");
  pushCheck(items, "source.immutable_object_store_layout", "source_complete", immutableObjectStoreLayout?.summary?.object_store_layout_status === "complete", "Immutable object store layout must be complete.");
  pushCheck(items, "source.resource_ingest", "source_available", Boolean(resourceIngest?.schema_version), "Resource ingest source must be readable.");
  pushCheck(items, "package_json", "resource_dedup_hash_script_registered", String(packageText).includes("\"resource:dedup-hash\""), "package.json must expose npm run resource:dedup-hash.");
  pushCheck(items, "implementation_roadmap", "phase_152_recorded", String(roadmapText).includes("## Phase 152: Resource Dedup/Hash Ledger"), "Roadmap must record Phase 152 completion.");
  pushCheck(items, "dedup_hash_contract", "required_criteria_declared", REQUIRED_CRITERIA.every(Boolean), "Dedup contract must declare content hash, external id, and resource version criteria.");
  pushCheck(items, "hash_groups", "hash_groups_cover_versions", hashGroups.reduce((count, group) => count + group.version_count, 0) === versionRecords.length, "Hash groups must cover every ResourceVersion store record.");
  pushCheck(items, "external_id_groups", "external_id_groups_cover_versions", externalIdGroups.reduce((count, group) => count + group.version_count, 0) === versionRecords.length, "External id groups must cover every ResourceVersion store record.");
  pushCheck(items, "dedup_decisions", "decisions_cover_versions_and_skipped_duplicates", dedupDecisions.length === expectedDecisionCount && versionDecisionCount === versionRecords.length && skippedDecisionCount === duplicateCandidateCount, "Dedup decisions must cover every ResourceVersion and skipped duplicate candidate.");
  pushCheck(items, "dedup_decisions", "all_decisions_are_classification_only", dedupDecisions.every((decision) => decision.mutation_allowed === false), "Dedup decisions must not mutate or delete source records.");
  pushCheck(items, "dedup_decisions", "all_resource_version_decisions_have_required_criteria", dedupDecisions.filter((decision) => decision.decision_scope === "resource_version").every((decision) => REQUIRED_CRITERIA.every((criterion) => decision.criteria?.[criterion] || (criterion === "resource_version" && decision.criteria?.resource_version_id))), "Every resource-version decision must include content hash, external id, and resource version criteria.");
  pushCheck(items, "duplicate_candidate_links", "candidate_links_cover_skipped_duplicates", candidateLinks.filter((link) => link.link_type === "skipped_duplicate_candidate").length === duplicateCandidateCount, "Skipped duplicate candidates must have explicit dedup links.");
  pushCheck(items, "hash_integrity_checks", "hash_checks_cover_resources_and_versions", hashIntegrityChecks.length === (resourceStoreInterface.summary?.resource_store_record_count ?? 0) + versionRecords.length, "Hash integrity checks must cover resources and resource versions.");
  pushCheck(items, "hash_integrity_checks", "all_hash_checks_passed", hashIntegrityChecks.every((check) => check.integrity_status === "passed"), "All content hashes must use sha256 and match the 64-character lowercase hex format.");

  return items.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeDedupHashLedger(context) {
  const {
    validation,
    validationItems,
    resourceRecords,
    versionRecords,
    hashGroups,
    externalIdGroups,
    dedupDecisions,
    candidateLinks,
    hashIntegrityChecks,
  } = context;
  const failedValidationItemCount = validationItems.filter((item) => item.status === "failed").length;
  return {
    resource_dedup_hash_status: validation.valid ? "complete" : "blocked",
    dedup_hash_contract_id: DEDUP_HASH_LEDGER_ID,
    resource_count: resourceRecords.length,
    resource_version_count: versionRecords.length,
    hash_group_count: hashGroups.length,
    unique_hash_group_count: hashGroups.filter((group) => group.group_status === "unique_content_hash").length,
    duplicate_hash_group_count: hashGroups.filter((group) => group.group_status === "duplicate_content_hash").length,
    external_id_group_count: externalIdGroups.length,
    singleton_external_id_group_count: externalIdGroups.filter((group) => group.group_status === "singleton_external_id").length,
    changed_external_id_group_count: externalIdGroups.filter((group) => group.group_status === "changed_external_id").length,
    duplicate_external_id_group_count: externalIdGroups.filter((group) => group.group_status === "duplicate_external_id_version").length,
    dedup_decision_count: dedupDecisions.length,
    unique_version_decision_count: dedupDecisions.filter((decision) => decision.dedup_status === "unique_version").length,
    changed_version_decision_count: dedupDecisions.filter((decision) => decision.dedup_status === "changed_version").length,
    duplicate_version_decision_count: dedupDecisions.filter((decision) => ["duplicate_version", "duplicate_content_hash"].includes(decision.dedup_status)).length,
    skipped_duplicate_decision_count: dedupDecisions.filter((decision) => decision.dedup_status === "skipped_duplicate_candidate").length,
    human_review_required_decision_count: dedupDecisions.filter((decision) => decision.human_review_required).length,
    content_hash_criteria_count: dedupDecisions.filter((decision) => Boolean(decision.criteria?.content_hash)).length,
    external_id_criteria_count: dedupDecisions.filter((decision) => Boolean(decision.criteria?.external_id)).length,
    resource_version_criteria_count: dedupDecisions.filter((decision) => Boolean(decision.criteria?.resource_version_id) || decision.decision_scope === "skipped_duplicate_candidate").length,
    duplicate_candidate_link_count: candidateLinks.length,
    skipped_duplicate_candidate_link_count: candidateLinks.filter((link) => link.link_type === "skipped_duplicate_candidate").length,
    hash_integrity_check_count: hashIntegrityChecks.length,
    passed_hash_integrity_check_count: hashIntegrityChecks.filter((check) => check.integrity_status === "passed").length,
    failed_hash_integrity_check_count: hashIntegrityChecks.filter((check) => check.integrity_status === "failed").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItemCount,
    validation_error_count: validation.errors.length,
  };
}

function buildCriteria(record) {
  return {
    content_hash: record.content_hash ?? null,
    external_id: record.external_id ?? null,
    resource_version_id: record.resource_version_id ?? null,
    source_system: record.source_system ?? null,
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
    validation_id: `resource-dedup-hash-ledger.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function renderResourceDedupHashLedgerMarkdown(result) {
  const lines = [];
  lines.push("# Resource Dedup/Hash Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.resource_dedup_hash_status}`);
  lines.push(`Contract: ${result.summary.dedup_hash_contract_id}`);
  lines.push(`Hash groups: ${result.summary.hash_group_count}`);
  lines.push(`External id groups: ${result.summary.external_id_group_count}`);
  lines.push(`Dedup decisions: ${result.summary.dedup_decision_count}`);
  lines.push(`Hash checks: ${result.summary.passed_hash_integrity_check_count}/${result.summary.hash_integrity_check_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Rules");
  lines.push("");
  lines.push("- Content hashes classify byte-identical resources before retrieval or extraction.");
  lines.push("- `source_system + external_id` keeps upstream identity families separate from content hashes.");
  lines.push("- Resource version ids distinguish current, changed, duplicate, and skipped duplicate candidates.");
  lines.push("- Decisions are classification-only; no source, object, evidence, or output record is deleted.");
  return lines.join("\n");
}

function normalizeInputs(options = {}) {
  return {
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? options.resource_store_interface_path ?? DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_INPUTS.resourceStoreInterfacePath),
    resource_version_ledger_path: path.resolve(options.resourceVersionLedgerPath ?? options.resource_version_ledger_path ?? DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_INPUTS.resourceVersionLedgerPath),
    immutable_object_store_layout_path: path.resolve(options.immutableObjectStoreLayoutPath ?? options.immutable_object_store_layout_path ?? DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_INPUTS.immutableObjectStoreLayoutPath),
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? options.resource_ingest_path ?? DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_INPUTS.resourceIngestPath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_RESOURCE_DEDUP_HASH_LEDGER_INPUTS.roadmapPath),
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
    else if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--resource-version-ledger") parsed.resourceVersionLedgerPath = argv[++index];
    else if (arg === "--immutable-object-store-layout") parsed.immutableObjectStoreLayoutPath = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: node scripts/resource-dedup-hash-ledger.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --out-dir <path>                Output directory.
  --resource-store-interface <p>  resource-store-interface.json path.
  --resource-version-ledger <p>   resource-version-ledger.json path.
  --immutable-object-store-layout <p>
                                  immutable-object-store-layout.json path.
  --resource-ingest <p>           resource-ingest.json path.
  --run-at <iso>                  Override generated_at.
  --help                          Show this help.
`);
}

function serializableDedupHashLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function externalKey(record) {
  return `${record.source_system ?? "unknown"}::${record.external_id ?? "unknown"}`;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function unique(values) {
  return [...new Set(values)];
}

function by(field) {
  return (left, right) => String(left[field]).localeCompare(String(right[field]));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:.]/g, "").replace("T", ".").replace("Z", "Z");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

async function readText(filePath) {
  return readFile(path.resolve(filePath), "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
