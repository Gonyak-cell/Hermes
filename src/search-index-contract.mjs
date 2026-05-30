import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SEARCH_INDEX_CONTRACT_OUT_DIR = "artifacts/search-index/latest";
export const DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS = {
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  normalizedTextContractPath: "artifacts/normalized-text-contract/latest/normalized-text-contract.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  exhibitMapPath: "artifacts/exhibit-map/latest/exhibit-map.json",
  chainOfCustodyEventsPath: "artifacts/chain-of-custody/latest/chain-of-custody-events.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const SEARCH_INDEX_CONTRACT_ID = "search-index-contract.v1";
const SEARCH_INDEX_MANIFEST_SCHEMA_VERSION = "search-index-manifest.v1";
const SEARCH_INDEX_FIELD_SCHEMA_VERSION = "search-index-field.v1";
const SEARCH_INDEX_QUERY_PLAN_SCHEMA_VERSION = "search-index-query-plan.v1";
const REQUIRED_QUERY_FILTERS = ["tenant_id", "matter_id", "classification", "policy_snapshot_id"];
const BLOCKED_WITHOUT_FILTERS = ["matter_id", "classification"];
const QUERY_STATUS = "held_for_retrieval_filter_compiler";

export async function runSearchIndexContract(options = {}) {
  const result = await buildSearchIndexContract(options);
  if (options.write !== false) await writeSearchIndexContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Search index contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSearchIndexContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SEARCH_INDEX_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceStoreInterface = await readJson(inputs.resource_store_interface_path);
  const normalizedTextContract = await readJson(inputs.normalized_text_contract_path);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const evidenceItemStore = await readJson(inputs.evidence_item_store_path);
  const factClaimStore = await readJson(inputs.fact_claim_store_path);
  const issueGraphStore = await readJson(inputs.issue_graph_store_path);
  const citationObjectStore = await readJson(inputs.citation_object_store_path);
  const lineageGraph = await readJson(inputs.lineage_graph_path);
  const exhibitMap = await readJson(inputs.exhibit_map_path);
  const chainOfCustodyEvents = await readJson(inputs.chain_of_custody_events_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const sourceStores = {
    resourceStoreInterface,
    normalizedTextContract,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
    lineageGraph,
    exhibitMap,
    chainOfCustodyEvents,
  };
  const sourceCollections = buildSourceCollections(sourceStores);
  const searchIndexManifests = buildSearchIndexManifests(sourceCollections, generatedAt);
  const searchIndexFields = buildSearchIndexFields(searchIndexManifests, generatedAt);
  const searchIndexQueryPlans = buildSearchIndexQueryPlans(searchIndexManifests, generatedAt);
  const validationItems = validateSearchIndexContract({
    packageText,
    roadmapText,
    sourceStores,
    sourceCollections,
    searchIndexManifests,
    searchIndexFields,
    searchIndexQueryPlans,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeSearchIndexContract({
    sourceStores,
    sourceCollections,
    searchIndexManifests,
    searchIndexFields,
    searchIndexQueryPlans,
    validationItems,
    validation,
  });

  const result = {
    schema_version: "search-index-contract.v1",
    generated_at: generatedAt,
    search_index_contract_id: `search-index-contract.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("resource_store_interface", resourceStoreInterface),
      summarizeSource("normalized_text_contract", normalizedTextContract),
      summarizeSource("source_span_store", sourceSpanStore),
      summarizeSource("evidence_item_store", evidenceItemStore),
      summarizeSource("fact_claim_store", factClaimStore),
      summarizeSource("issue_graph_store", issueGraphStore),
      summarizeSource("citation_object_store", citationObjectStore),
      summarizeSource("lineage_graph_builder", lineageGraph),
      summarizeSource("exhibit_map", exhibitMap),
      summarizeSource("chain_of_custody_events", chainOfCustodyEvents),
    ],
    search_index_contract: buildSearchIndexContractDefinition(generatedAt),
    search_index_catalog: {
      schema_version: "search-index-catalog.v1",
      generated_at: generatedAt,
      source_collections: sourceCollections,
      search_index_manifests: searchIndexManifests,
      search_index_fields: searchIndexFields,
      search_index_query_plans: searchIndexQueryPlans,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderSearchIndexContractMarkdown(result),
  };
}

export async function writeSearchIndexContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableSearchIndexContract(result);
  await writeJson(path.join(outDir, "search-index-contract.json"), serializable);
  await writeJson(path.join(outDir, "search-index-manifest.json"), {
    schema_version: "search-index-manifest-set.v1",
    generated_at: result.generated_at,
    search_index_manifest_count: result.search_index_catalog.search_index_manifests.length,
    search_index_manifests: result.search_index_catalog.search_index_manifests,
  });
  await writeJson(path.join(outDir, "search-index-fields.json"), {
    schema_version: "search-index-field-set.v1",
    generated_at: result.generated_at,
    search_index_field_count: result.search_index_catalog.search_index_fields.length,
    search_index_fields: result.search_index_catalog.search_index_fields,
  });
  await writeJson(path.join(outDir, "search-index-query-plans.json"), {
    schema_version: "search-index-query-plan-set.v1",
    generated_at: result.generated_at,
    search_index_query_plan_count: result.search_index_catalog.search_index_query_plans.length,
    search_index_query_plans: result.search_index_catalog.search_index_query_plans,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    search_index_contract_id: result.search_index_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runSearchIndexContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runSearchIndexContract(args);
    console.log(`Search index contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.search_index_contract_status}`);
    console.log(`Manifests: ${result.summary.search_index_manifest_count}`);
    console.log(`Query plans: ${result.summary.search_index_query_plan_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildSearchIndexContractDefinition(generatedAt) {
  return {
    schema_version: "search-index-contract-definition.v1",
    search_index_contract_id: SEARCH_INDEX_CONTRACT_ID,
    generated_at: generatedAt,
    search_index_manifest_schema_version: SEARCH_INDEX_MANIFEST_SCHEMA_VERSION,
    search_index_field_schema_version: SEARCH_INDEX_FIELD_SCHEMA_VERSION,
    search_index_query_plan_schema_version: SEARCH_INDEX_QUERY_PLAN_SCHEMA_VERSION,
    required_query_filters: REQUIRED_QUERY_FILTERS,
    blocked_without_filters: BLOCKED_WITHOUT_FILTERS,
    enforcement_rule: "search index access is rejected before retrieval unless tenant_id, matter_id, classification, and policy_snapshot_id are bound",
    execution_rule: "manifests are non-executable until the retrieval filter compiler builds bounded queries",
    source_ref_rule: "every search result must preserve source artifact, source schema, record id, matter, classification, and policy snapshot references",
    output_rule: "search results are evidence candidates only and do not authorize legal or client-facing output",
  };
}

function buildSourceCollections(stores) {
  const resourceCatalog = stores.resourceStoreInterface.resource_store_catalog ?? {};
  return [
    collection({
      collectionId: "resource_store_records",
      label: "Resource Store Records",
      sourceArtifactId: "resource_store_interface",
      sourceSchemaVersion: stores.resourceStoreInterface.schema_version,
      records: resourceCatalog.resource_store_records ?? [],
      recordIdField: "store_record_id",
      recordType: "resource",
      indexedIdentifierFields: ["resource_id", "latest_resource_version_id", "external_id", "source_system"],
      indexedTextFields: ["source_uri", "resource_type", "materialization_status", "ingestion_status"],
      sourceRefFields: ["resource_id", "latest_resource_version_id", "content_hash"],
    }),
    collection({
      collectionId: "resource_version_store_records",
      label: "Resource Version Store Records",
      sourceArtifactId: "resource_store_interface",
      sourceSchemaVersion: stores.resourceStoreInterface.schema_version,
      records: resourceCatalog.resource_version_store_records ?? [],
      recordIdField: "store_record_id",
      recordType: "resource_version",
      indexedIdentifierFields: ["resource_version_id", "resource_id", "external_version_id", "source_system"],
      indexedTextFields: ["version_label", "version_status"],
      sourceRefFields: ["resource_id", "resource_version_id", "content_hash"],
    }),
    collection({
      collectionId: "normalized_text_artifacts",
      label: "Normalized Text Artifacts",
      sourceArtifactId: "normalized_text_contract",
      sourceSchemaVersion: stores.normalizedTextContract.schema_version,
      records: stores.normalizedTextContract.normalized_text_catalog?.normalized_text_artifacts ?? [],
      recordIdField: "normalized_text_artifact_id",
      recordType: "normalized_text_artifact",
      indexedIdentifierFields: ["normalized_text_id", "resource_id", "resource_version_id", "extractor_id"],
      indexedTextFields: ["language", "quality", "offset_unit"],
      sourceRefFields: ["normalized_text_artifact_id", "resource_version_id", "text_hash"],
    }),
    collection({
      collectionId: "source_spans",
      label: "Source Spans",
      sourceArtifactId: "source_span_store",
      sourceSchemaVersion: stores.sourceSpanStore.schema_version,
      records: stores.sourceSpanStore.source_span_catalog?.source_spans ?? [],
      recordIdField: "source_span_id",
      recordType: "source_span",
      indexedIdentifierFields: ["source_span_store_record_id", "normalized_text_artifact_id", "resource_version_id"],
      indexedTextFields: ["location_type", "extractor_id", "timestamp_status"],
      sourceRefFields: ["source_span_id", "normalized_text_artifact_id", "resource_version_id"],
    }),
    collection({
      collectionId: "evidence_items",
      label: "Evidence Items",
      sourceArtifactId: "evidence_item_store",
      sourceSchemaVersion: stores.evidenceItemStore.schema_version,
      records: stores.evidenceItemStore.evidence_item_catalog?.evidence_items ?? [],
      recordIdField: "evidence_id",
      recordType: "evidence_item",
      indexedIdentifierFields: ["evidence_store_record_id", "primary_source_span_id", "resource_version_id"],
      indexedTextFields: ["evidence_type", "location_type", "review_status", "reliability"],
      sourceRefFields: ["evidence_id", "primary_source_span_id", "resource_version_id"],
    }),
    collection({
      collectionId: "fact_claims",
      label: "Fact Claims",
      sourceArtifactId: "fact_claim_store",
      sourceSchemaVersion: stores.factClaimStore.schema_version,
      records: stores.factClaimStore.fact_claim_catalog?.fact_claims ?? [],
      recordIdField: "fact_id",
      recordType: "fact_claim",
      indexedIdentifierFields: ["fact_store_record_id", "primary_evidence_item_id"],
      indexedTextFields: ["statement", "fact_type", "review_status", "reliability"],
      sourceRefFields: ["fact_id", "primary_evidence_item_id", "source_span_ids"],
    }),
    collection({
      collectionId: "issues",
      label: "Issue Graph Records",
      sourceArtifactId: "issue_graph_store",
      sourceSchemaVersion: stores.issueGraphStore.schema_version,
      records: stores.issueGraphStore.issue_graph_catalog?.issues ?? [],
      recordIdField: "issue_id",
      recordType: "issue",
      indexedIdentifierFields: ["issue_graph_record_id", "primary_fact_id"],
      indexedTextFields: ["issue_type", "title", "severity", "risk_severity", "status", "review_status"],
      sourceRefFields: ["issue_id", "primary_fact_id", "evidence_item_ids"],
    }),
    collection({
      collectionId: "citations",
      label: "Citation Objects",
      sourceArtifactId: "citation_object_store",
      sourceSchemaVersion: stores.citationObjectStore.schema_version,
      records: stores.citationObjectStore.citation_catalog?.citations ?? [],
      recordIdField: "citation_id",
      recordType: "citation",
      indexedIdentifierFields: ["output_paragraph_id", "issue_id", "fact_id", "evidence_item_id", "source_span_id"],
      indexedTextFields: ["citation_style", "citation_status", "verification_status", "source_binding_status"],
      sourceRefFields: ["citation_id", "output_paragraph_id", "source_span_id"],
    }),
    collection({
      collectionId: "lineage_paths",
      label: "Lineage Paths",
      sourceArtifactId: "lineage_graph_builder",
      sourceSchemaVersion: stores.lineageGraph.schema_version,
      records: stores.lineageGraph.lineage_graph_catalog?.lineage_paths ?? [],
      recordIdField: "lineage_path_id",
      recordType: "lineage_path",
      indexedIdentifierFields: ["citation_id", "source_span_id", "evidence_item_id", "fact_id", "issue_id", "output_paragraph_id"],
      indexedTextFields: ["path_status", "review_status", "output_client_facing_status"],
      sourceRefFields: ["lineage_path_id", "citation_id", "source_span_id"],
    }),
    collection({
      collectionId: "exhibit_records",
      label: "Exhibit Records",
      sourceArtifactId: "exhibit_map",
      sourceSchemaVersion: stores.exhibitMap.schema_version,
      records: stores.exhibitMap.exhibit_catalog?.exhibit_records ?? [],
      recordIdField: "exhibit_id",
      recordType: "exhibit",
      indexedIdentifierFields: ["exhibit_label", "exhibit_reference", "citation_id", "lineage_path_id", "output_paragraph_id"],
      indexedTextFields: ["exhibit_title", "exhibit_status", "review_status"],
      sourceRefFields: ["exhibit_id", "citation_id", "lineage_path_id", "output_paragraph_id"],
    }),
    collection({
      collectionId: "custody_events",
      label: "Chain of Custody Events",
      sourceArtifactId: "chain_of_custody_events",
      sourceSchemaVersion: stores.chainOfCustodyEvents.schema_version,
      records: stores.chainOfCustodyEvents.custody_event_catalog?.custody_events ?? [],
      recordIdField: "custody_event_id",
      recordType: "custody_event",
      indexedIdentifierFields: ["custody_chain_id", "event_stage", "event_type", "event_status"],
      indexedTextFields: ["event_stage", "event_type", "event_status"],
      sourceRefFields: ["custody_event_id", "custody_chain_id", "event_hash"],
    }),
  ];
}

function collection({
  collectionId,
  label,
  sourceArtifactId,
  sourceSchemaVersion,
  records,
  recordIdField,
  recordType,
  indexedIdentifierFields,
  indexedTextFields,
  sourceRefFields,
}) {
  return {
    schema_version: "search-source-collection.v1",
    collection_id: collectionId,
    label,
    source_artifact_id: sourceArtifactId,
    source_schema_version: sourceSchemaVersion ?? null,
    record_schema_version: firstRecordSchemaVersion(records),
    record_type: recordType,
    record_id_field: recordIdField,
    record_count: records.length,
    required_filter_fields: REQUIRED_QUERY_FILTERS,
    indexed_identifier_fields: indexedIdentifierFields,
    indexed_text_fields: indexedTextFields,
    source_ref_fields: sourceRefFields,
  };
}

function buildSearchIndexManifests(collections, generatedAt) {
  return collections.map((sourceCollection) => {
    const sourceRefFields = unique([
      sourceCollection.record_id_field,
      ...sourceCollection.source_ref_fields,
      "tenant_id",
      "matter_id",
      "classification",
      "policy_snapshot_id",
    ]);
    return {
      schema_version: SEARCH_INDEX_MANIFEST_SCHEMA_VERSION,
      search_index_id: `search-index.${sourceCollection.collection_id}`,
      collection_id: sourceCollection.collection_id,
      label: sourceCollection.label,
      source_artifact_id: sourceCollection.source_artifact_id,
      source_schema_version: sourceCollection.source_schema_version,
      record_schema_version: sourceCollection.record_schema_version,
      record_type: sourceCollection.record_type,
      record_id_field: sourceCollection.record_id_field,
      record_count: sourceCollection.record_count,
      index_kind: "keyword_manifest",
      index_status: "manifest_ready",
      materialization_status: "not_materialized",
      query_execution_status: QUERY_STATUS,
      tenant_id_field: "tenant_id",
      matter_id_field: "matter_id",
      classification_field: "classification",
      policy_snapshot_id_field: "policy_snapshot_id",
      required_query_filters: REQUIRED_QUERY_FILTERS,
      blocked_without_filters: BLOCKED_WITHOUT_FILTERS,
      indexed_identifier_fields: unique(sourceCollection.indexed_identifier_fields),
      indexed_text_fields: unique(sourceCollection.indexed_text_fields),
      source_ref_fields: sourceRefFields,
      result_ref_fields: sourceRefFields,
      filter_policy: {
        tenant_filter_required: true,
        matter_filter_required: true,
        classification_filter_required: true,
        policy_snapshot_filter_required: true,
        pre_retrieval_gate_required: true,
        matter_wall_enforced: true,
        classification_enforced: true,
        policy_snapshot_bound: true,
        reject_unscoped_queries: true,
      },
      created_at: generatedAt,
    };
  });
}

function buildSearchIndexFields(manifests, generatedAt) {
  return manifests.flatMap((manifest) => {
    const requiredFilterRows = REQUIRED_QUERY_FILTERS.map((filterName) => buildFieldRow(manifest, filterName, "required_filter", generatedAt, {
      query_required: true,
      must_be_bound_before_search: true,
    }));
    const identifierRows = manifest.indexed_identifier_fields.map((fieldName) => buildFieldRow(manifest, fieldName, "indexed_identifier", generatedAt));
    const textRows = manifest.indexed_text_fields.map((fieldName) => buildFieldRow(manifest, fieldName, "indexed_text", generatedAt));
    const sourceRefRows = manifest.source_ref_fields.map((fieldName) => buildFieldRow(manifest, fieldName, "source_ref", generatedAt));
    return dedupeFields([...requiredFilterRows, ...identifierRows, ...textRows, ...sourceRefRows]);
  });
}

function buildFieldRow(manifest, fieldName, fieldRole, generatedAt, overrides = {}) {
  return {
    schema_version: SEARCH_INDEX_FIELD_SCHEMA_VERSION,
    search_index_field_id: `search-index-field.${slugify(manifest.collection_id)}.${slugify(fieldRole)}.${slugify(fieldName)}`,
    search_index_id: manifest.search_index_id,
    collection_id: manifest.collection_id,
    field_name: fieldName,
    field_role: fieldRole,
    field_required: fieldRole === "required_filter" || fieldRole === "source_ref",
    query_required: false,
    must_be_bound_before_search: false,
    preserves_source_ref: fieldRole === "source_ref",
    generated_at: generatedAt,
    ...overrides,
  };
}

function buildSearchIndexQueryPlans(manifests, generatedAt) {
  return manifests.map((manifest) => ({
    schema_version: SEARCH_INDEX_QUERY_PLAN_SCHEMA_VERSION,
    search_index_query_plan_id: `search-index-query-plan.${slugify(manifest.collection_id)}.matter-classification-scoped-lookup`,
    search_index_id: manifest.search_index_id,
    collection_id: manifest.collection_id,
    source_artifact_id: manifest.source_artifact_id,
    query_profile: "matter_classification_scoped_lookup",
    allowed_query_modes: ["exact_id_lookup", "keyword_lookup", "source_ref_lookup"],
    query_status: QUERY_STATUS,
    executable: false,
    failure_mode: "reject_query_before_index_access",
    required_filters: REQUIRED_QUERY_FILTERS,
    blocked_without_filters: BLOCKED_WITHOUT_FILTERS,
    provided_filter_placeholders: Object.fromEntries(REQUIRED_QUERY_FILTERS.map((filterName) => [filterName, `$${filterName}`])),
    filters_enforced: true,
    tenant_filter_required: true,
    matter_filter_required: true,
    classification_filter_required: true,
    policy_snapshot_filter_required: true,
    pre_retrieval_gate_required: true,
    matter_wall_enforced: true,
    classification_enforced: true,
    policy_snapshot_bound: true,
    result_shape: {
      source_ref_preserved: true,
      result_ref_fields: manifest.result_ref_fields,
      default_limit: 25,
      max_limit: 100,
    },
    created_at: generatedAt,
  }));
}

function validateSearchIndexContract({
  packageText,
  roadmapText,
  sourceStores,
  sourceCollections,
  searchIndexManifests,
  searchIndexFields,
  searchIndexQueryPlans,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const manifestById = indexBy(searchIndexManifests, "search_index_id");
  const requiredFilterFieldCount = searchIndexFields.filter((field) => field.field_role === "required_filter").length;

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:search-index"]), "package.json must expose resource:search-index.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 148: Search Index Contract"), "Implementation roadmap must document Phase 148.");
  pushCheck(validationItems, "source", "resource_store_interface_complete", sourceStores.resourceStoreInterface.summary?.resource_store_interface_status === "complete", "Resource Store Interface must be complete.");
  pushCheck(validationItems, "source", "normalized_text_contract_complete", sourceStores.normalizedTextContract.summary?.normalized_text_contract_status === "complete", "Normalized Text Contract must be complete.");
  pushCheck(validationItems, "source", "source_span_store_complete", sourceStores.sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store must be complete.");
  pushCheck(validationItems, "source", "evidence_item_store_complete", sourceStores.evidenceItemStore.summary?.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(validationItems, "source", "fact_claim_store_complete", sourceStores.factClaimStore.summary?.fact_claim_store_status === "complete", "Fact Claim Store must be complete.");
  pushCheck(validationItems, "source", "issue_graph_store_complete", sourceStores.issueGraphStore.summary?.issue_graph_store_status === "complete", "Issue Graph Store must be complete.");
  pushCheck(validationItems, "source", "citation_object_store_complete", sourceStores.citationObjectStore.summary?.citation_object_store_status === "complete", "Citation Object Store must be complete.");
  pushCheck(validationItems, "source", "lineage_graph_complete", sourceStores.lineageGraph.summary?.lineage_graph_status === "complete", "Lineage Graph Builder must be complete.");
  pushCheck(validationItems, "source", "exhibit_map_complete", sourceStores.exhibitMap.summary?.exhibit_map_status === "complete", "Exhibit Map must be complete.");
  pushCheck(validationItems, "source", "chain_of_custody_events_complete", sourceStores.chainOfCustodyEvents.summary?.custody_event_ledger_status === "complete", "Chain of Custody Events must be complete.");
  pushCheck(validationItems, "catalog", "source_collection_count", sourceCollections.length >= 10, "Search index contract must cover the resource/evidence/custody collections.");
  pushCheck(validationItems, "catalog", "manifest_count_matches_collections", searchIndexManifests.length === sourceCollections.length, "Every source collection must have a search index manifest.");
  pushCheck(validationItems, "catalog", "query_plan_count_matches_manifests", searchIndexQueryPlans.length === searchIndexManifests.length, "Every search index manifest must have a bounded query plan.");
  pushCheck(validationItems, "catalog", "required_filter_field_rows_complete", requiredFilterFieldCount === searchIndexManifests.length * REQUIRED_QUERY_FILTERS.length, "Every search index must declare the required query filter fields.");

  for (const manifest of searchIndexManifests) {
    const prefix = `search_index_manifests.${manifest.search_index_id}`;
    pushCheck(validationItems, prefix, "required_filters_declared", hasAll(manifest.required_query_filters, REQUIRED_QUERY_FILTERS), "Search index manifest must require tenant, matter, classification, and policy snapshot filters.");
    pushCheck(validationItems, prefix, "blocked_without_matter_classification", hasAll(manifest.blocked_without_filters, BLOCKED_WITHOUT_FILTERS), "Search index manifest must block queries without matter and classification.");
    pushCheck(validationItems, prefix, "filter_policy_enforced", manifest.filter_policy?.matter_wall_enforced === true && manifest.filter_policy?.classification_enforced === true && manifest.filter_policy?.policy_snapshot_bound === true, "Search index manifest must enforce matter wall, classification, and policy snapshot boundaries.");
    pushCheck(validationItems, prefix, "manifest_is_non_materialized", manifest.materialization_status === "not_materialized" && manifest.query_execution_status === QUERY_STATUS, "Search index manifest must remain non-materialized until retrieval filters are compiled.");
    pushCheck(validationItems, prefix, "source_refs_preserved", manifest.source_ref_fields?.length > 0 && hasAll(manifest.source_ref_fields, ["tenant_id", "matter_id", "classification", "policy_snapshot_id"]), "Search index manifest must preserve source refs and access boundary refs.");
    pushCheck(validationItems, prefix, "records_available", (manifest.record_count ?? 0) > 0, "Search index manifest should point to a populated source collection.");
  }

  for (const field of searchIndexFields.filter((item) => item.field_role === "required_filter")) {
    const prefix = `search_index_fields.${field.search_index_field_id}`;
    pushCheck(validationItems, prefix, "filter_field_required", field.field_required === true && field.query_required === true && field.must_be_bound_before_search === true, "Required filter fields must be query-required and bound before search.");
  }

  for (const queryPlan of searchIndexQueryPlans) {
    const prefix = `search_index_query_plans.${queryPlan.search_index_query_plan_id}`;
    pushCheck(validationItems, prefix, "manifest_resolves", manifestById.has(queryPlan.search_index_id), "Search index query plan must resolve a manifest.");
    pushCheck(validationItems, prefix, "required_filters_declared", hasAll(queryPlan.required_filters, REQUIRED_QUERY_FILTERS), "Search index query plan must require tenant, matter, classification, and policy snapshot filters.");
    pushCheck(validationItems, prefix, "matter_classification_filters_required", queryPlan.matter_filter_required === true && queryPlan.classification_filter_required === true, "Search index query plan must require matter and classification filters.");
    pushCheck(validationItems, prefix, "filters_enforced", queryPlan.filters_enforced === true && queryPlan.pre_retrieval_gate_required === true, "Search index query plan must enforce filters before retrieval.");
    pushCheck(validationItems, prefix, "policy_boundary_enforced", queryPlan.matter_wall_enforced === true && queryPlan.policy_snapshot_bound === true, "Search index query plan must enforce matter wall and policy snapshot.");
    pushCheck(validationItems, prefix, "not_executable", queryPlan.executable === false && queryPlan.query_status === QUERY_STATUS, "Search index query plan must remain held until the retrieval filter compiler is implemented.");
    pushCheck(validationItems, prefix, "source_ref_preserved", queryPlan.result_shape?.source_ref_preserved === true, "Search index results must preserve source refs.");
  }

  return validationItems;
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

function summarizeSearchIndexContract({
  sourceStores,
  sourceCollections,
  searchIndexManifests,
  searchIndexFields,
  searchIndexQueryPlans,
  validationItems,
  validation,
}) {
  return {
    search_index_contract_status: validation.valid ? "complete" : "blocked",
    search_index_contract_id: SEARCH_INDEX_CONTRACT_ID,
    search_index_manifest_schema_version: SEARCH_INDEX_MANIFEST_SCHEMA_VERSION,
    search_index_field_schema_version: SEARCH_INDEX_FIELD_SCHEMA_VERSION,
    search_index_query_plan_schema_version: SEARCH_INDEX_QUERY_PLAN_SCHEMA_VERSION,
    resource_store_interface_status: sourceStores.resourceStoreInterface.summary?.resource_store_interface_status ?? "unknown",
    normalized_text_contract_status: sourceStores.normalizedTextContract.summary?.normalized_text_contract_status ?? "unknown",
    source_span_store_status: sourceStores.sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    evidence_item_store_status: sourceStores.evidenceItemStore.summary?.evidence_item_store_status ?? "unknown",
    fact_claim_store_status: sourceStores.factClaimStore.summary?.fact_claim_store_status ?? "unknown",
    issue_graph_store_status: sourceStores.issueGraphStore.summary?.issue_graph_store_status ?? "unknown",
    citation_object_store_status: sourceStores.citationObjectStore.summary?.citation_object_store_status ?? "unknown",
    lineage_graph_status: sourceStores.lineageGraph.summary?.lineage_graph_status ?? "unknown",
    exhibit_map_status: sourceStores.exhibitMap.summary?.exhibit_map_status ?? "unknown",
    custody_event_ledger_status: sourceStores.chainOfCustodyEvents.summary?.custody_event_ledger_status ?? "unknown",
    source_collection_count: sourceCollections.length,
    indexed_record_count: sourceCollections.reduce((total, item) => total + (item.record_count ?? 0), 0),
    search_index_manifest_count: searchIndexManifests.length,
    search_index_field_count: searchIndexFields.length,
    required_filter_field_count: searchIndexFields.filter((field) => field.field_role === "required_filter").length,
    source_ref_field_count: searchIndexFields.filter((field) => field.field_role === "source_ref").length,
    search_index_query_plan_count: searchIndexQueryPlans.length,
    filters_enforced_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.filters_enforced === true).length,
    tenant_filter_required_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.tenant_filter_required === true).length,
    matter_filter_required_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.matter_filter_required === true).length,
    classification_filter_required_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.classification_filter_required === true).length,
    policy_snapshot_filter_required_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.policy_snapshot_filter_required === true).length,
    pre_retrieval_gate_required_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.pre_retrieval_gate_required === true).length,
    matter_wall_enforced_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.matter_wall_enforced === true).length,
    classification_enforced_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.classification_enforced === true).length,
    policy_snapshot_bound_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.policy_snapshot_bound === true).length,
    held_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.query_status === QUERY_STATUS).length,
    executable_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.executable === true).length,
    source_ref_preserved_query_plan_count: searchIndexQueryPlans.filter((plan) => plan.result_shape?.source_ref_preserved === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_source_artifact_id: countBy(searchIndexManifests, "source_artifact_id"),
    by_query_status: countBy(searchIndexQueryPlans, "query_status"),
    by_index_status: countBy(searchIndexManifests, "index_status"),
  };
}

function renderSearchIndexContractMarkdown(result) {
  const lines = [];
  lines.push("# Search Index Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.search_index_contract_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.search_index_contract_id}`);
  lines.push(`- Source collections: ${result.summary.source_collection_count}`);
  lines.push(`- Search manifests: ${result.summary.search_index_manifest_count}`);
  lines.push(`- Query plans: ${result.summary.search_index_query_plan_count}`);
  lines.push(`- Held query plans: ${result.summary.held_query_plan_count}`);
  lines.push(`- Executable query plans: ${result.summary.executable_query_plan_count}`);
  lines.push(`- Required filter fields: ${result.summary.required_filter_field_count}`);
  lines.push(`- Matter-filtered query plans: ${result.summary.matter_filter_required_query_plan_count}`);
  lines.push(`- Classification-filtered query plans: ${result.summary.classification_filter_required_query_plan_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `search-index-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function normalizeInputs(options) {
  return {
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.resourceStoreInterfacePath),
    normalized_text_contract_path: path.resolve(options.normalizedTextContractPath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.normalizedTextContractPath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.evidenceItemStorePath),
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.factClaimStorePath),
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.issueGraphStorePath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.citationObjectStorePath),
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.lineageGraphPath),
    exhibit_map_path: path.resolve(options.exhibitMapPath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.exhibitMapPath),
    chain_of_custody_events_path: path.resolve(options.chainOfCustodyEventsPath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.chainOfCustodyEventsPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_SEARCH_INDEX_CONTRACT_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--resource-store-interface") parsed.resourceStoreInterfacePath = argv[++index];
    else if (arg === "--normalized-text-contract") parsed.normalizedTextContractPath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--exhibit-map") parsed.exhibitMapPath = argv[++index];
    else if (arg === "--chain-of-custody") parsed.chainOfCustodyEventsPath = argv[++index];
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
  console.log(`Usage: node scripts/search-index-contract.mjs [options]

Options:
  --resource-store-interface <path>   resource-store-interface.json path.
  --normalized-text-contract <path>   normalized-text-contract.json path.
  --source-span-store <path>          source-span-store.json path.
  --evidence-item-store <path>        evidence-item-store.json path.
  --fact-claim-store <path>           fact-claim-store.json path.
  --issue-graph-store <path>          issue-graph-store.json path.
  --citation-object-store <path>      citation-object-store.json path.
  --lineage-graph <path>              lineage-graph.json path.
  --exhibit-map <path>                exhibit-map.json path.
  --chain-of-custody <path>           chain-of-custody-events.json path.
  --out-dir <path>                    Output directory.
  --run-at <iso>                      Deterministic generated_at timestamp.
  --check                             Exit non-zero when validation fails.
  --no-write                          Build without writing artifacts.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readTextFileWithWindowsRetry(filePath));
}

async function readText(filePath) {
  return readTextFileWithWindowsRetry(filePath);
}

async function readTextFileWithWindowsRetry(filePath) {
  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await readFile(filePath, "utf8");
    } catch (error) {
      lastError = error;
      if (process.platform !== "win32" || !/EISDIR|EBUSY|EPERM/i.test(error.message) || attempt === 4) break;
      await delay(500 * attempt);
    }
  }
  throw lastError;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableSearchIndexContract(result) {
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

function firstRecordSchemaVersion(records) {
  return records.find((record) => record.schema_version)?.schema_version ?? null;
}

function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

function hasAll(values = [], required = []) {
  const present = new Set(values);
  return required.every((value) => present.has(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function dedupeFields(fields) {
  const seen = new Set();
  const deduped = [];
  for (const field of fields) {
    const key = `${field.search_index_id}:${field.field_role}:${field.field_name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(field);
  }
  return deduped;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
