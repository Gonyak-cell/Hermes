import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RESOURCE_STORE_INTERFACE_OUT_DIR = "artifacts/resource-store-interface/latest";
export const DEFAULT_RESOURCE_STORE_INTERFACE_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  identityPolicyMatterFreezePath: "artifacts/identity-policy-matter-freeze/latest/identity-policy-matter-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const INTERFACE_CONTRACT_ID = "resource-store-interface.v1";
const RESOURCE_STORE_COLLECTION_ID = "resource_store";
const RESOURCE_VERSION_STORE_COLLECTION_ID = "resource_version_store";
const REQUIRED_RESOURCE_FILTERS = ["tenant_id", "matter_id", "classification", "resource_id"];
const REQUIRED_RESOURCE_VERSION_FILTERS = ["tenant_id", "matter_id", "classification", "resource_id", "resource_version_id"];
const REQUIRED_CONSUMER_LAYERS = ["registry", "ingestion", "dashboard"];

export async function runResourceStoreInterface(options = {}) {
  const result = await buildResourceStoreInterface(options);
  if (options.write !== false) await writeResourceStoreInterface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Resource store interface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildResourceStoreInterface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_STORE_INTERFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceIngest = await readJson(inputs.resource_ingest_path);
  const resourceContractFreeze = await readJson(inputs.resource_contract_freeze_path);
  const storePolicyAdapter = await readJson(inputs.store_policy_adapter_path);
  const identityPolicyMatterFreeze = await readJson(inputs.identity_policy_matter_freeze_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const resources = resourceContractFreeze.resource_contract?.resources ?? [];
  const resourceVersions = resourceContractFreeze.resource_contract?.resource_versions ?? [];
  const sourceResources = resourceIngest.resource_evidence?.resources ?? [];
  const sourceResourceVersions = resourceIngest.resource_evidence?.resource_versions ?? [];
  const storePolicyCatalog = storePolicyAdapter.store_policy_catalog ?? {};
  const resourceStoreRecords = resources.map((resource) => buildResourceStoreRecord(resource, generatedAt));
  const versionByResourceId = groupBy(resourceVersions, "resource_id");
  const resourceVersionStoreRecords = resourceVersions.map((version) => buildResourceVersionStoreRecord(version, resources, generatedAt));
  const interfaceContract = buildInterfaceContract(generatedAt);
  const adapterBindings = buildAdapterBindings({
    generatedAt,
    resourceCount: resources.length,
    sourceResourceCount: sourceResources.length,
    sourceResourceVersionCount: sourceResourceVersions.length,
    resourceVersionCount: resourceVersions.length,
  });
  const queryInterface = buildQueryInterface(storePolicyCatalog, generatedAt);
  const registryProjection = buildRegistryProjection(resources, sourceResources, versionByResourceId);
  const dashboardProjection = buildDashboardProjection(resources, resourceVersions, queryInterface);
  const validationItems = validateResourceStoreInterface({
    resourceIngest,
    resourceContractFreeze,
    storePolicyAdapter,
    identityPolicyMatterFreeze,
    packageText,
    roadmapText,
    resources,
    resourceVersions,
    resourceStoreRecords,
    resourceVersionStoreRecords,
    interfaceContract,
    adapterBindings,
    queryInterface,
    registryProjection,
    dashboardProjection,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeInterface({
    validation,
    validationItems,
    resources,
    resourceVersions,
    resourceStoreRecords,
    resourceVersionStoreRecords,
    adapterBindings,
    queryInterface,
    registryProjection,
    dashboardProjection,
  });

  const result = {
    schema_version: "resource-store-interface.v1",
    generated_at: generatedAt,
    resource_store_interface_id: `resource-store-interface.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_ingest: summarizeSource("resource_ingest", resourceIngest),
    source_resource_contract_freeze: summarizeSource("resource_contract_freeze", resourceContractFreeze),
    source_store_policy_adapter: summarizeSource("store_policy_adapter", storePolicyAdapter),
    source_identity_policy_matter_freeze: summarizeSource("identity_policy_matter_freeze", identityPolicyMatterFreeze),
    interface_contract: interfaceContract,
    resource_store_catalog: {
      schema_version: "resource-store-catalog.v1",
      generated_at: generatedAt,
      resource_store_records: resourceStoreRecords,
      resource_version_store_records: resourceVersionStoreRecords,
      resource_registry_projection: registryProjection,
      dashboard_projection: dashboardProjection,
    },
    adapter_bindings: adapterBindings,
    query_interface: queryInterface,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderResourceStoreInterfaceMarkdown(result),
  };
}

export async function writeResourceStoreInterface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableInterface(result);
  await writeJson(path.join(outDir, "resource-store-interface.json"), serializable);
  await writeJson(path.join(outDir, "resource-store-records.json"), {
    generated_at: result.generated_at,
    resource_store_record_count: result.resource_store_catalog.resource_store_records.length,
    resource_store_records: result.resource_store_catalog.resource_store_records,
  });
  await writeJson(path.join(outDir, "resource-version-store-records.json"), {
    generated_at: result.generated_at,
    resource_version_store_record_count: result.resource_store_catalog.resource_version_store_records.length,
    resource_version_store_records: result.resource_store_catalog.resource_version_store_records,
  });
  await writeJson(path.join(outDir, "resource-store-adapter-bindings.json"), {
    generated_at: result.generated_at,
    adapter_binding_count: result.adapter_bindings.length,
    adapter_bindings: result.adapter_bindings,
  });
  await writeJson(path.join(outDir, "resource-store-query-interface.json"), result.query_interface);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    resource_store_interface_id: result.resource_store_interface_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runResourceStoreInterfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runResourceStoreInterface(args);
    console.log(`Resource store interface written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.resource_store_interface_status}`);
    console.log(`Resources: ${result.summary.resource_store_record_count}`);
    console.log(`Resource versions: ${result.summary.resource_version_store_record_count}`);
    console.log(`Adapter bindings: ${result.summary.adapter_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildInterfaceContract(generatedAt) {
  return {
    schema_version: "resource-store-interface-contract.v1",
    interface_contract_id: INTERFACE_CONTRACT_ID,
    generated_at: generatedAt,
    canonical_resource_schema_version: "resource-core.v2",
    canonical_resource_version_schema_version: "resource-version.v2",
    resource_store_collection_id: RESOURCE_STORE_COLLECTION_ID,
    resource_version_store_collection_id: RESOURCE_VERSION_STORE_COLLECTION_ID,
    required_resource_keys: [
      "resource_id",
      "tenant_id",
      "matter_id",
      "source_system",
      "external_id",
      "content_hash",
      "classification",
      "policy_snapshot_id",
      "latest_resource_version_id",
    ],
    required_resource_version_keys: [
      "resource_version_id",
      "resource_id",
      "tenant_id",
      "matter_id",
      "source_system",
      "external_id",
      "content_hash",
      "classification",
      "version_status",
    ],
    required_resource_query_filters: REQUIRED_RESOURCE_FILTERS,
    required_resource_version_query_filters: REQUIRED_RESOURCE_VERSION_FILTERS,
    consumer_layers: REQUIRED_CONSUMER_LAYERS,
    mutation_model: "append_or_upsert_by_source_system_external_id_and_content_hash",
    dashboard_projection_contract: {
      collection_ids: ["resource_store_records", "resource_version_store_records", "resource_store_validations"],
      route_prefix: "/api/resource-store",
      read_only: true,
    },
  };
}

function buildResourceStoreRecord(resource, generatedAt) {
  return {
    schema_version: "resource-store-record.v1",
    store_record_id: `resource-store-record.${slugify(resource.resource_id)}`,
    collection_id: RESOURCE_STORE_COLLECTION_ID,
    resource_id: resource.resource_id,
    tenant_id: resource.tenant_id,
    matter_id: resource.matter_id,
    source_system: resource.source_system,
    external_id: resource.external_id,
    external_version_id: resource.external_version_id,
    source_uri: resource.source_uri,
    resource_type: resource.resource_type,
    content_hash: resource.content_hash,
    content_hash_algorithm: resource.content_hash_algorithm ?? "sha256",
    classification: resource.classification,
    policy_snapshot_id: resource.policy_snapshot_id,
    latest_resource_version_id: resource.latest_resource_version_id,
    materialization_status: resource.materialization_status,
    ingestion_status: resource.ingestion_status,
    store_status: resource.ingestion_status === "indexed" ? "indexed" : "registered",
    created_at: resource.created_at,
    registered_at: generatedAt,
    metadata: {
      ...(resource.metadata ?? {}),
      interface_contract_id: INTERFACE_CONTRACT_ID,
      adapter_binding_ids: [
        "resource-store-binding.registry",
        "resource-store-binding.ingestion",
        "resource-store-binding.dashboard",
      ],
    },
  };
}

function buildResourceVersionStoreRecord(version, resources, generatedAt) {
  const resource = resources.find((candidate) => candidate.resource_id === version.resource_id);
  return {
    schema_version: "resource-version-store-record.v1",
    store_record_id: `resource-version-store-record.${slugify(version.resource_version_id)}`,
    collection_id: RESOURCE_VERSION_STORE_COLLECTION_ID,
    resource_version_id: version.resource_version_id,
    resource_id: version.resource_id,
    tenant_id: resource?.tenant_id ?? null,
    matter_id: version.matter_id,
    source_system: version.source_system,
    external_id: version.external_id,
    external_version_id: version.external_version_id,
    version_label: version.version_label,
    version_status: version.version_status,
    content_hash: version.content_hash,
    content_hash_algorithm: version.content_hash_algorithm ?? "sha256",
    classification: version.classification,
    captured_at: version.captured_at,
    created_at: version.created_at,
    registered_at: generatedAt,
    metadata: {
      ...(version.metadata ?? {}),
      interface_contract_id: INTERFACE_CONTRACT_ID,
      current_resource_record_id: resource ? `resource-store-record.${slugify(resource.resource_id)}` : null,
    },
  };
}

function buildAdapterBindings({ generatedAt, resourceCount, sourceResourceCount, sourceResourceVersionCount, resourceVersionCount }) {
  return [
    {
      schema_version: "resource-store-adapter-binding.v1",
      adapter_binding_id: "resource-store-binding.registry",
      interface_contract_id: INTERFACE_CONTRACT_ID,
      consumer_layer: "registry",
      source_artifact_id: "resource_contract_freeze",
      source_collection: "resource_contract.resources",
      target_collection_id: RESOURCE_STORE_COLLECTION_ID,
      entity_schema_version: "resource-core.v2",
      operation: "register_resource",
      operation_semantics: "idempotent_upsert",
      key_fields: ["source_system", "external_id", "content_hash"],
      required_filter_keys: REQUIRED_RESOURCE_FILTERS,
      bound_record_count: resourceCount,
      generated_at: generatedAt,
    },
    {
      schema_version: "resource-store-adapter-binding.v1",
      adapter_binding_id: "resource-store-binding.ingestion",
      interface_contract_id: INTERFACE_CONTRACT_ID,
      consumer_layer: "ingestion",
      source_artifact_id: "resource_ingest",
      source_collection: "resource_evidence.resources/resource_evidence.resource_versions",
      target_collection_id: RESOURCE_STORE_COLLECTION_ID,
      entity_schema_version: "resource-core.v2",
      operation: "promote_ingested_resource",
      operation_semantics: "append_version_then_upsert_resource_pointer",
      key_fields: ["resource_id", "resource_version_id", "content_hash"],
      required_filter_keys: REQUIRED_RESOURCE_FILTERS,
      bound_record_count: Math.min(resourceCount, sourceResourceCount),
      source_resource_count: sourceResourceCount,
      source_resource_version_count: sourceResourceVersionCount,
      generated_at: generatedAt,
    },
    {
      schema_version: "resource-store-adapter-binding.v1",
      adapter_binding_id: "resource-store-binding.dashboard",
      interface_contract_id: INTERFACE_CONTRACT_ID,
      consumer_layer: "dashboard",
      source_artifact_id: "resource_store_interface",
      source_collection: "resource_store_catalog.resource_store_records",
      target_collection_id: "review_dashboard.resource_summary",
      entity_schema_version: "resource-store-record.v1",
      operation: "project_resource_store_status",
      operation_semantics: "read_only_projection",
      key_fields: ["resource_id", "tenant_id", "matter_id", "classification"],
      required_filter_keys: REQUIRED_RESOURCE_FILTERS,
      bound_record_count: resourceCount,
      generated_at: generatedAt,
    },
    {
      schema_version: "resource-store-adapter-binding.v1",
      adapter_binding_id: "resource-store-binding.policy-query",
      interface_contract_id: INTERFACE_CONTRACT_ID,
      consumer_layer: "policy_query",
      source_artifact_id: "store_policy_adapter",
      source_collection: "store_policy_catalog.store_query_plans",
      target_collection_id: RESOURCE_STORE_COLLECTION_ID,
      entity_schema_version: "store-query-plan.v1",
      operation: "compile_policy_filtered_query",
      operation_semantics: "deny_or_hold_without_required_filters",
      key_fields: ["tenant_id", "matter_id", "classification", "resource_id"],
      required_filter_keys: REQUIRED_RESOURCE_FILTERS,
      bound_record_count: resourceVersionCount > 0 ? resourceCount : 0,
      generated_at: generatedAt,
    },
  ];
}

function buildQueryInterface(storePolicyCatalog, generatedAt) {
  const rlsTemplates = storePolicyCatalog.rls_filter_templates ?? [];
  const queryPlans = storePolicyCatalog.store_query_plans ?? [];
  const resourceTemplates = rlsTemplates.filter((template) => template.collection_id === RESOURCE_STORE_COLLECTION_ID);
  const resourcePlans = queryPlans.filter((plan) => plan.collection_id === RESOURCE_STORE_COLLECTION_ID || plan.target_type === "resource");
  return {
    schema_version: "resource-store-query-interface.v1",
    generated_at: generatedAt,
    interface_contract_id: INTERFACE_CONTRACT_ID,
    resource_collection_id: RESOURCE_STORE_COLLECTION_ID,
    resource_version_collection_id: RESOURCE_VERSION_STORE_COLLECTION_ID,
    required_resource_filters: REQUIRED_RESOURCE_FILTERS,
    required_resource_version_filters: REQUIRED_RESOURCE_VERSION_FILTERS,
    rls_filter_templates: resourceTemplates,
    compiled_resource_query_plans: resourcePlans,
    query_policy: {
      retrieval_before_prompt: true,
      require_tenant_filter: true,
      require_matter_filter: true,
      require_classification_filter: true,
      require_resource_id_for_resource_detail: true,
      unassigned_resources_executable: false,
    },
  };
}

function buildRegistryProjection(resources, sourceResources, versionByResourceId) {
  const sourceByResourceId = new Map(sourceResources.map((resource) => [resource.id, resource]));
  return resources.map((resource) => {
    const source = sourceByResourceId.get(resource.resource_id);
    const versions = versionByResourceId.get(resource.resource_id) ?? [];
    return {
      schema_version: "resource-registry-projection.v1",
      resource_id: resource.resource_id,
      registry_status: "registered",
      tenant_id: resource.tenant_id,
      matter_id: resource.matter_id,
      source_system: resource.source_system,
      external_id: resource.external_id,
      source_uri: resource.source_uri,
      content_hash: resource.content_hash,
      classification: resource.classification,
      version_count: versions.length,
      latest_resource_version_id: resource.latest_resource_version_id,
      source_expansion_item_id: source?.metadata?.source_expansion_item_id ?? resource.metadata?.source_expansion_item_id ?? null,
      interface_contract_id: INTERFACE_CONTRACT_ID,
    };
  }).sort(by("resource_id"));
}

function buildDashboardProjection(resources, resourceVersions, queryInterface) {
  return {
    schema_version: "resource-dashboard-projection.v1",
    interface_contract_id: INTERFACE_CONTRACT_ID,
    summary_fields: [
      "resource_store_interface_status",
      "resource_store_record_count",
      "resource_version_store_record_count",
      "resource_store_adapter_binding_count",
      "resource_store_required_filter_count",
      "resource_store_validation_error_count",
    ],
    api_routes: [
      "/api/resource-store-interfaces",
      "/api/resource-store-records",
      "/api/resource-version-store-records",
      "/api/resource-store-adapter-bindings",
      "/api/resource-store-validations",
    ],
    projected_resource_count: resources.length,
    projected_resource_version_count: resourceVersions.length,
    policy_filtered_query_plan_count: queryInterface.compiled_resource_query_plans.length,
  };
}

function validateResourceStoreInterface(context) {
  const items = [];
  const {
    resourceIngest,
    resourceContractFreeze,
    storePolicyAdapter,
    identityPolicyMatterFreeze,
    packageText,
    roadmapText,
    resources,
    resourceVersions,
    resourceStoreRecords,
    resourceVersionStoreRecords,
    interfaceContract,
    adapterBindings,
    queryInterface,
    registryProjection,
    dashboardProjection,
  } = context;

  pushCheck(items, "source.resource_ingest", "source_available", Boolean(resourceIngest?.schema_version), "Resource ingest source must be readable.");
  pushCheck(items, "source.resource_contract_freeze", "source_complete", resourceContractFreeze?.summary?.freeze_status === "complete", "Resource contract freeze must be complete.");
  pushCheck(items, "source.store_policy_adapter", "source_complete", storePolicyAdapter?.summary?.store_policy_adapter_status === "complete", "Store policy adapter must be complete.");
  pushCheck(items, "source.identity_policy_matter_freeze", "source_not_blocked", identityPolicyMatterFreeze?.summary?.freeze_status !== "blocked", "Identity/Policy/Matter freeze must not be blocked.");
  pushCheck(items, "package_json", "resource_store_interface_script_registered", String(packageText).includes("\"resource:store-interface\""), "package.json must expose npm run resource:store-interface.");
  pushCheck(items, "implementation_roadmap", "phase_133_recorded", String(roadmapText).includes("## Phase 133: Resource Store Interface"), "Roadmap must record Phase 133 completion.");
  pushCheck(items, "interface_contract", "canonical_resource_schema", interfaceContract.canonical_resource_schema_version === "resource-core.v2", "Interface must consume Resource v2.");
  pushCheck(items, "interface_contract", "canonical_resource_version_schema", interfaceContract.canonical_resource_version_schema_version === "resource-version.v2", "Interface must consume ResourceVersion v2.");
  pushCheck(items, "interface_contract", "required_resource_filters", REQUIRED_RESOURCE_FILTERS.every((filter) => interfaceContract.required_resource_query_filters.includes(filter)), "Interface must require tenant, matter, classification, and resource filters.");
  pushCheck(items, "interface_contract", "required_consumer_layers", REQUIRED_CONSUMER_LAYERS.every((layer) => interfaceContract.consumer_layers.includes(layer)), "Interface must declare registry, ingestion, and dashboard consumers.");
  pushCheck(items, "resource_records", "record_count_matches_contract", resourceStoreRecords.length === resources.length && resources.length > 0, "Resource store records must match Resource contract count.");
  pushCheck(items, "resource_version_records", "record_count_matches_contract", resourceVersionStoreRecords.length === resourceVersions.length && resourceVersions.length > 0, "ResourceVersion store records must match ResourceVersion contract count.");
  pushCheck(items, "registry_projection", "registry_uses_same_interface", registryProjection.length === resources.length && registryProjection.every((record) => record.interface_contract_id === INTERFACE_CONTRACT_ID), "Registry projection must bind each resource to the same interface contract.");
  pushCheck(items, "dashboard_projection", "dashboard_uses_same_interface", dashboardProjection.interface_contract_id === INTERFACE_CONTRACT_ID && dashboardProjection.projected_resource_count === resources.length, "Dashboard projection must bind to the same interface contract.");
  pushCheck(items, "adapter_bindings", "required_consumers_bound", REQUIRED_CONSUMER_LAYERS.every((layer) => adapterBindings.some((binding) => binding.consumer_layer === layer)), "Registry, ingestion, and dashboard adapter bindings must exist.");
  pushCheck(items, "adapter_bindings", "single_interface_contract", adapterBindings.every((binding) => binding.interface_contract_id === INTERFACE_CONTRACT_ID), "All adapter bindings must point to the same interface contract.");
  pushCheck(items, "store_policy", "resource_store_collection_bound", queryInterface.resource_collection_id === RESOURCE_STORE_COLLECTION_ID, "Query interface must bind the resource_store collection.");
  pushCheck(items, "store_policy", "resource_store_rls_template_present", queryInterface.rls_filter_templates.length > 0, "Store policy adapter must provide an RLS/filter template for resource_store.");
  pushCheck(items, "store_policy", "resource_query_plans_present", queryInterface.compiled_resource_query_plans.length > 0, "Store policy adapter must provide resource query plans.");
  pushCheck(items, "store_policy", "resource_query_plans_not_executable_without_human_confirmation", queryInterface.compiled_resource_query_plans.every((plan) => plan.query_status !== "executable"), "Current unconfirmed resource query plans must remain non-executable.");

  for (const record of resourceStoreRecords) {
    pushCheck(items, record.store_record_id, "resource_record_required_fields", [
      record.resource_id,
      record.tenant_id,
      record.matter_id,
      record.source_system,
      record.external_id,
      record.content_hash,
      record.classification,
      record.policy_snapshot_id,
      record.latest_resource_version_id,
    ].every(Boolean), "Resource store record must preserve identity, source, content hash, policy, and latest version keys.");
  }
  for (const record of resourceVersionStoreRecords) {
    pushCheck(items, record.store_record_id, "resource_version_record_required_fields", [
      record.resource_version_id,
      record.resource_id,
      record.tenant_id,
      record.matter_id,
      record.source_system,
      record.external_id,
      record.content_hash,
      record.classification,
    ].every(Boolean), "ResourceVersion store record must preserve identity, source, content hash, and classification keys.");
  }
  return items.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeInterface(context) {
  const {
    validation,
    validationItems,
    resources,
    resourceVersions,
    resourceStoreRecords,
    resourceVersionStoreRecords,
    adapterBindings,
    queryInterface,
    registryProjection,
    dashboardProjection,
  } = context;
  const failedValidationItemCount = validationItems.filter((item) => item.status === "failed").length;
  return {
    resource_store_interface_status: validation.valid ? "complete" : "blocked",
    interface_contract_id: INTERFACE_CONTRACT_ID,
    resource_store_collection_id: RESOURCE_STORE_COLLECTION_ID,
    resource_version_store_collection_id: RESOURCE_VERSION_STORE_COLLECTION_ID,
    resource_count: resources.length,
    resource_version_count: resourceVersions.length,
    resource_store_record_count: resourceStoreRecords.length,
    resource_version_store_record_count: resourceVersionStoreRecords.length,
    registry_projection_count: registryProjection.length,
    dashboard_projection_route_count: dashboardProjection.api_routes.length,
    adapter_binding_count: adapterBindings.length,
    registry_adapter_binding_count: adapterBindings.filter((binding) => binding.consumer_layer === "registry").length,
    ingestion_adapter_binding_count: adapterBindings.filter((binding) => binding.consumer_layer === "ingestion").length,
    dashboard_adapter_binding_count: adapterBindings.filter((binding) => binding.consumer_layer === "dashboard").length,
    required_consumer_layer_count: REQUIRED_CONSUMER_LAYERS.length,
    bound_required_consumer_layer_count: REQUIRED_CONSUMER_LAYERS.filter((layer) => adapterBindings.some((binding) => binding.consumer_layer === layer)).length,
    required_resource_filter_count: REQUIRED_RESOURCE_FILTERS.length,
    required_resource_version_filter_count: REQUIRED_RESOURCE_VERSION_FILTERS.length,
    resource_store_rls_template_count: queryInterface.rls_filter_templates.length,
    compiled_resource_query_plan_count: queryInterface.compiled_resource_query_plans.length,
    executable_resource_query_plan_count: queryInterface.compiled_resource_query_plans.filter((plan) => plan.query_status === "executable").length,
    held_resource_query_plan_count: queryInterface.compiled_resource_query_plans.filter((plan) => plan.query_status === "held_for_human_confirmation").length,
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
    validation_id: `resource-store-interface.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function renderResourceStoreInterfaceMarkdown(result) {
  const lines = [];
  lines.push("# Resource Store Interface");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.resource_store_interface_status}`);
  lines.push(`Interface: ${result.summary.interface_contract_id}`);
  lines.push(`Resources: ${result.summary.resource_store_record_count}`);
  lines.push(`Resource versions: ${result.summary.resource_version_store_record_count}`);
  lines.push(`Adapter bindings: ${result.summary.adapter_binding_count}`);
  lines.push(`Required consumer layers bound: ${result.summary.bound_required_consumer_layer_count}/${result.summary.required_consumer_layer_count}`);
  lines.push(`Resource query plans: ${result.summary.compiled_resource_query_plan_count}`);
  lines.push(`Executable resource query plans: ${result.summary.executable_resource_query_plan_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Contract");
  lines.push("");
  lines.push("- Registry, ingestion, and dashboard consumers share `resource-store-interface.v1`.");
  lines.push("- Resource detail queries require tenant, matter, classification, and resource filters before retrieval.");
  lines.push("- Current unconfirmed resource query plans stay non-executable until human confirmation binds the matter/resource decision.");
  return lines.join("\n");
}

function serializableInterface(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function normalizeInputs(options = {}) {
  return {
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? options.resource_ingest_path ?? DEFAULT_RESOURCE_STORE_INTERFACE_INPUTS.resourceIngestPath),
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? options.resource_contract_freeze_path ?? DEFAULT_RESOURCE_STORE_INTERFACE_INPUTS.resourceContractFreezePath),
    store_policy_adapter_path: path.resolve(options.storePolicyAdapterPath ?? options.store_policy_adapter_path ?? DEFAULT_RESOURCE_STORE_INTERFACE_INPUTS.storePolicyAdapterPath),
    identity_policy_matter_freeze_path: path.resolve(options.identityPolicyMatterFreezePath ?? options.identity_policy_matter_freeze_path ?? DEFAULT_RESOURCE_STORE_INTERFACE_INPUTS.identityPolicyMatterFreezePath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_RESOURCE_STORE_INTERFACE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_RESOURCE_STORE_INTERFACE_INPUTS.roadmapPath),
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
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--store-policy-adapter") parsed.storePolicyAdapterPath = argv[++index];
    else if (arg === "--identity-policy-matter-freeze") parsed.identityPolicyMatterFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/resource-store-interface.mjs [options]

Options:
  --resource-ingest <path>                 resource-ingest.json path.
  --resource-contract-freeze <path>        resource-contract-freeze.json path.
  --store-policy-adapter <path>            store-policy-adapter.json path.
  --identity-policy-matter-freeze <path>   identity-policy-matter-freeze.json path.
  --package <path>                         package.json path.
  --roadmap <path>                         implementation-roadmap.md path.
  --out-dir <path>                         Output directory.
  --run-at <iso>                           Fixed generated_at timestamp.
  --check                                  Exit non-zero on validation errors.
  --help                                   Show this message.
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

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const groupKey = item[key];
    if (!grouped.has(groupKey)) grouped.set(groupKey, []);
    grouped.get(groupKey).push(item);
  }
  return grouped;
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
