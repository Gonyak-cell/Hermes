import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_OUT_DIR = "artifacts/immutable-object-store-layout/latest";
export const DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_INPUTS = {
  resourceStoreInterfacePath: "artifacts/resource-store-interface/latest/resource-store-interface.json",
  outputArtifactCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const LAYOUT_CONTRACT_ID = "immutable-object-store-layout.v1";
const RAW_SOURCE_NAMESPACE = "raw-source";
const GENERATED_OUTPUT_NAMESPACE = "generated-output";
const OBJECT_STORE_ROOT = "object-store/immutable";

export async function runImmutableObjectStoreLayout(options = {}) {
  const result = await buildImmutableObjectStoreLayout(options);
  if (options.write !== false) await writeImmutableObjectStoreLayout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Immutable object store layout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildImmutableObjectStoreLayout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const resourceStoreInterface = await readJson(inputs.resource_store_interface_path);
  const outputArtifactCatalog = await readJson(inputs.output_artifact_catalog_path);
  const outputDeliveryContractFreeze = await readJson(inputs.output_delivery_contract_freeze_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const resourceRecords = resourceStoreInterface.resource_store_catalog?.resource_store_records ?? [];
  const resourceVersionRecords = resourceStoreInterface.resource_store_catalog?.resource_version_store_records ?? [];
  const outputArtifacts = normalizeOutputArtifacts(outputDeliveryContractFreeze, outputArtifactCatalog);
  const pathResolvers = buildPathResolvers(generatedAt);
  const rawSourceObjectPaths = resourceVersionRecords.map((version) => buildRawSourceObjectPath(version, resourceRecords));
  const generatedOutputObjectPaths = outputArtifacts.map(buildGeneratedOutputObjectPath);
  const collisionReport = buildCollisionReport([...rawSourceObjectPaths, ...generatedOutputObjectPaths]);
  const namespaceIndex = buildNamespaceIndex(rawSourceObjectPaths, generatedOutputObjectPaths);
  const validationItems = validateImmutableObjectStoreLayout({
    resourceStoreInterface,
    outputArtifactCatalog,
    outputDeliveryContractFreeze,
    packageText,
    roadmapText,
    pathResolvers,
    rawSourceObjectPaths,
    generatedOutputObjectPaths,
    collisionReport,
    namespaceIndex,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeLayout({
    validation,
    validationItems,
    pathResolvers,
    rawSourceObjectPaths,
    generatedOutputObjectPaths,
    collisionReport,
    namespaceIndex,
  });

  const result = {
    schema_version: "immutable-object-store-layout.v1",
    generated_at: generatedAt,
    object_store_layout_id: `immutable-object-store-layout.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_resource_store_interface: summarizeSource("resource_store_interface", resourceStoreInterface),
    source_output_artifact_catalog: summarizeSource("output_artifact_catalog", outputArtifactCatalog),
    source_output_delivery_contract_freeze: summarizeSource("output_delivery_contract_freeze", outputDeliveryContractFreeze),
    layout_contract: buildLayoutContract(generatedAt),
    object_store_catalog: {
      schema_version: "immutable-object-store-catalog.v1",
      generated_at: generatedAt,
      path_resolvers: pathResolvers,
      raw_source_object_paths: rawSourceObjectPaths,
      generated_output_object_paths: generatedOutputObjectPaths,
      namespace_index: namespaceIndex,
      collision_report: collisionReport,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderImmutableObjectStoreLayoutMarkdown(result),
  };
}

export async function writeImmutableObjectStoreLayout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLayout(result);
  await writeJson(path.join(outDir, "immutable-object-store-layout.json"), serializable);
  await writeJson(path.join(outDir, "object-path-resolvers.json"), {
    generated_at: result.generated_at,
    path_resolver_count: result.object_store_catalog.path_resolvers.length,
    path_resolvers: result.object_store_catalog.path_resolvers,
  });
  await writeJson(path.join(outDir, "raw-source-object-paths.json"), {
    generated_at: result.generated_at,
    raw_source_object_path_count: result.object_store_catalog.raw_source_object_paths.length,
    raw_source_object_paths: result.object_store_catalog.raw_source_object_paths,
  });
  await writeJson(path.join(outDir, "generated-output-object-paths.json"), {
    generated_at: result.generated_at,
    generated_output_object_path_count: result.object_store_catalog.generated_output_object_paths.length,
    generated_output_object_paths: result.object_store_catalog.generated_output_object_paths,
  });
  await writeJson(path.join(outDir, "object-store-collision-report.json"), result.object_store_catalog.collision_report);
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    object_store_layout_id: result.object_store_layout_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runImmutableObjectStoreLayoutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runImmutableObjectStoreLayout(args);
    console.log(`Immutable object store layout written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.object_store_layout_status}`);
    console.log(`Raw source paths: ${result.summary.raw_source_object_path_count}`);
    console.log(`Generated output paths: ${result.summary.generated_output_object_path_count}`);
    console.log(`Collisions: ${result.summary.collision_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildLayoutContract(generatedAt) {
  return {
    schema_version: "object-store-layout-contract.v1",
    layout_contract_id: LAYOUT_CONTRACT_ID,
    generated_at: generatedAt,
    object_store_root: OBJECT_STORE_ROOT,
    immutability_model: "write_once_content_addressed",
    overwrite_policy: "forbidden",
    allowed_namespaces: [RAW_SOURCE_NAMESPACE, GENERATED_OUTPUT_NAMESPACE],
    raw_source_namespace: RAW_SOURCE_NAMESPACE,
    generated_output_namespace: GENERATED_OUTPUT_NAMESPACE,
    required_path_components: ["tenant_id", "matter_id", "namespace", "content_hash"],
    collision_strategy: "fail_on_duplicate_object_key",
    resolver_contract: {
      raw_source_resolver_id: "object-path-resolver.raw-source.v1",
      generated_output_resolver_id: "object-path-resolver.generated-output.v1",
      absolute_source_paths_in_object_key: false,
      content_hash_required: true,
    },
  };
}

function buildPathResolvers(generatedAt) {
  return [
    {
      schema_version: "object-path-resolver.v1",
      resolver_id: "object-path-resolver.raw-source.v1",
      namespace: RAW_SOURCE_NAMESPACE,
      generated_at: generatedAt,
      input_schema_versions: ["resource-version-store-record.v1", "resource-store-record.v1"],
      required_inputs: ["tenant_id", "matter_id", "classification", "source_system", "resource_id", "resource_version_id", "content_hash"],
      path_template: `${OBJECT_STORE_ROOT}/${RAW_SOURCE_NAMESPACE}/tenant={tenant_id}/matter={matter_id}/classification={classification}/source={source_system}/resource={resource_id}/version={resource_version_id}/sha256={content_hash}/{resource_version_id}.{extension}`,
      immutability_key_fields: ["namespace", "tenant_id", "matter_id", "resource_version_id", "content_hash"],
      collision_strategy: "fail_on_duplicate_object_key",
      overwrite_policy: "forbidden",
    },
    {
      schema_version: "object-path-resolver.v1",
      resolver_id: "object-path-resolver.generated-output.v1",
      namespace: GENERATED_OUTPUT_NAMESPACE,
      generated_at: generatedAt,
      input_schema_versions: ["output-artifact.v2", "output-artifact-catalog.v1"],
      required_inputs: ["tenant_id", "matter_id", "domain_pack", "output_artifact_id", "content_hash", "artifact_type"],
      path_template: `${OBJECT_STORE_ROOT}/${GENERATED_OUTPUT_NAMESPACE}/tenant={tenant_id}/matter={matter_id}/domain={domain_pack}/artifact={output_artifact_id}/sha256={content_hash}/{output_artifact_id}.{extension}`,
      immutability_key_fields: ["namespace", "tenant_id", "matter_id", "output_artifact_id", "content_hash"],
      collision_strategy: "fail_on_duplicate_object_key",
      overwrite_policy: "forbidden",
    },
  ];
}

function buildRawSourceObjectPath(version, resourceRecords) {
  const resource = resourceRecords.find((candidate) => candidate.resource_id === version.resource_id) ?? {};
  const tenantId = version.tenant_id ?? resource.tenant_id;
  const matterId = version.matter_id ?? resource.matter_id;
  const classification = version.classification ?? resource.classification;
  const extension = normalizeExtension(resource.metadata?.extension ?? extensionFromUri(resource.source_uri));
  const objectKey = [
    OBJECT_STORE_ROOT,
    RAW_SOURCE_NAMESPACE,
    `tenant=${safeSegment(tenantId)}`,
    `matter=${safeSegment(matterId)}`,
    `classification=${safeSegment(classification)}`,
    `source=${safeSegment(version.source_system ?? resource.source_system)}`,
    `resource=${safeSegment(version.resource_id)}`,
    `version=${safeSegment(version.resource_version_id)}`,
    `sha256=${safeSegment(version.content_hash)}`,
    `${safeSegment(version.resource_version_id)}.${extension}`,
  ].join("/");
  return {
    schema_version: "object-store-path.v1",
    object_path_id: `object-path.raw-source.${slugify(version.resource_version_id)}`,
    resolver_id: "object-path-resolver.raw-source.v1",
    namespace: RAW_SOURCE_NAMESPACE,
    object_key: objectKey,
    tenant_id: tenantId,
    matter_id: matterId,
    classification,
    source_system: version.source_system ?? resource.source_system,
    resource_id: version.resource_id,
    resource_version_id: version.resource_version_id,
    content_hash: version.content_hash,
    content_hash_algorithm: version.content_hash_algorithm ?? resource.content_hash_algorithm ?? "sha256",
    source_uri: resource.source_uri ?? null,
    source_uri_stored_as_metadata_only: true,
    object_status: "layout_only",
    overwrite_policy: "forbidden",
    metadata: {
      store_record_id: version.store_record_id,
      resource_store_record_id: resource.store_record_id ?? null,
      extension,
      source_relative_path: resource.metadata?.relative_path ?? null,
    },
  };
}

function buildGeneratedOutputObjectPath(artifact) {
  const outputArtifactId = artifact.output_artifact_id ?? artifact.artifact_id;
  const artifactType = artifact.artifact_type ?? "artifact";
  const extension = normalizeExtension(extensionFromUri(artifact.artifact_uri) ?? artifactType);
  const objectKey = [
    OBJECT_STORE_ROOT,
    GENERATED_OUTPUT_NAMESPACE,
    `tenant=${safeSegment(artifact.tenant_id)}`,
    `matter=${safeSegment(artifact.matter_id)}`,
    `domain=${safeSegment(artifact.domain_pack)}`,
    `artifact=${safeSegment(outputArtifactId)}`,
    `sha256=${safeSegment(artifact.content_hash)}`,
    `${safeSegment(outputArtifactId)}.${extension}`,
  ].join("/");
  return {
    schema_version: "object-store-path.v1",
    object_path_id: `object-path.generated-output.${slugify(outputArtifactId)}`,
    resolver_id: "object-path-resolver.generated-output.v1",
    namespace: GENERATED_OUTPUT_NAMESPACE,
    object_key: objectKey,
    tenant_id: artifact.tenant_id,
    matter_id: artifact.matter_id,
    domain_pack: artifact.domain_pack,
    output_artifact_id: outputArtifactId,
    artifact_type: artifactType,
    artifact_uri: artifact.artifact_uri ?? null,
    content_hash: artifact.content_hash,
    content_hash_algorithm: artifact.hash_algorithm ?? "sha256",
    output_status: artifact.output_status ?? artifact.status ?? null,
    object_status: "layout_only",
    overwrite_policy: "forbidden",
    metadata: {
      source_id: artifact.source_id ?? null,
      workflow_run_id: artifact.workflow_run_id ?? null,
      delivery_state: artifact.delivery_state ?? null,
      approval_status: artifact.approval_status ?? null,
      extension,
    },
  };
}

function normalizeOutputArtifacts(outputDeliveryContractFreeze, outputArtifactCatalog) {
  const outputArtifactsV2 = outputDeliveryContractFreeze.output_delivery_contract?.output_artifacts ?? [];
  if (outputArtifactsV2.length > 0) return outputArtifactsV2;
  return (outputArtifactCatalog.artifacts ?? []).map((artifact) => ({
    ...artifact,
    output_artifact_id: artifact.artifact_id,
    output_status: artifact.status,
    hash_algorithm: "sha256",
  }));
}

function buildCollisionReport(paths) {
  const byObjectKey = groupBy(paths, "object_key");
  const collisions = [...byObjectKey.entries()]
    .filter(([, records]) => records.length > 1)
    .map(([objectKey, records]) => ({
      object_key: objectKey,
      object_path_ids: records.map((record) => record.object_path_id),
      namespace_count: new Set(records.map((record) => record.namespace)).size,
    }));
  return {
    schema_version: "object-store-collision-report.v1",
    object_key_count: byObjectKey.size,
    object_path_count: paths.length,
    collision_count: collisions.length,
    collisions,
  };
}

function buildNamespaceIndex(rawSourceObjectPaths, generatedOutputObjectPaths) {
  return {
    schema_version: "object-store-namespace-index.v1",
    root: OBJECT_STORE_ROOT,
    namespaces: [
      {
        namespace: RAW_SOURCE_NAMESPACE,
        resolver_id: "object-path-resolver.raw-source.v1",
        object_path_count: rawSourceObjectPaths.length,
        path_prefix: `${OBJECT_STORE_ROOT}/${RAW_SOURCE_NAMESPACE}/`,
      },
      {
        namespace: GENERATED_OUTPUT_NAMESPACE,
        resolver_id: "object-path-resolver.generated-output.v1",
        object_path_count: generatedOutputObjectPaths.length,
        path_prefix: `${OBJECT_STORE_ROOT}/${GENERATED_OUTPUT_NAMESPACE}/`,
      },
    ],
  };
}

function validateImmutableObjectStoreLayout(context) {
  const items = [];
  const {
    resourceStoreInterface,
    outputArtifactCatalog,
    outputDeliveryContractFreeze,
    packageText,
    roadmapText,
    pathResolvers,
    rawSourceObjectPaths,
    generatedOutputObjectPaths,
    collisionReport,
    namespaceIndex,
  } = context;
  const allObjectPaths = [...rawSourceObjectPaths, ...generatedOutputObjectPaths];

  pushCheck(items, "source.resource_store_interface", "source_complete", resourceStoreInterface?.summary?.resource_store_interface_status === "complete", "Resource store interface must be complete before object layout paths are resolved.");
  pushCheck(items, "source.output_artifact_catalog", "source_available", Boolean(outputArtifactCatalog?.schema_version), "Output artifact catalog must be readable.");
  pushCheck(items, "source.output_delivery_contract_freeze", "source_complete", outputDeliveryContractFreeze?.summary?.freeze_status === "complete", "Output delivery contract freeze must be complete.");
  pushCheck(items, "package_json", "object_store_layout_script_registered", String(packageText).includes("\"object-store:layout\""), "package.json must expose npm run object-store:layout.");
  pushCheck(items, "implementation_roadmap", "phase_134_recorded", String(roadmapText).includes("## Phase 134: Immutable Object Store Layout"), "Roadmap must record Phase 134 completion.");
  pushCheck(items, "layout_contract", "two_namespaces_declared", namespaceIndex.namespaces.length === 2, "Object store layout must declare raw-source and generated-output namespaces.");
  pushCheck(items, "path_resolvers", "raw_and_generated_resolvers_present", pathResolvers.some((resolver) => resolver.namespace === RAW_SOURCE_NAMESPACE) && pathResolvers.some((resolver) => resolver.namespace === GENERATED_OUTPUT_NAMESPACE), "Raw source and generated output resolvers must be present.");
  pushCheck(items, "path_resolvers", "overwrite_forbidden", pathResolvers.every((resolver) => resolver.overwrite_policy === "forbidden"), "All object path resolvers must forbid overwrites.");
  pushCheck(items, "raw_source_paths", "raw_source_paths_present", rawSourceObjectPaths.length > 0, "At least one raw source object path must be resolved.");
  pushCheck(items, "generated_output_paths", "generated_output_paths_present", generatedOutputObjectPaths.length > 0, "At least one generated output object path must be resolved.");
  pushCheck(items, "collision_report", "no_object_key_collisions", collisionReport.collision_count === 0, "Raw source and generated output object keys must not collide.");
  pushCheck(items, "object_paths", "all_paths_under_immutable_root", allObjectPaths.every((record) => record.object_key.startsWith(`${OBJECT_STORE_ROOT}/`)), "Every object key must live under the immutable object store root.");
  pushCheck(items, "object_paths", "no_absolute_source_paths_in_keys", allObjectPaths.every((record) => !record.object_key.includes("/Users/") && !record.object_key.includes(":\\\\")), "Object keys must not embed local absolute source paths.");
  pushCheck(items, "object_paths", "all_paths_include_content_hash", allObjectPaths.every((record) => record.object_key.includes(`/sha256=${safeSegment(record.content_hash)}/`)), "Every object key must include the content hash segment.");
  pushCheck(items, "object_paths", "raw_and_generated_namespaces_separated", rawSourceObjectPaths.every((record) => record.object_key.includes(`/${RAW_SOURCE_NAMESPACE}/`)) && generatedOutputObjectPaths.every((record) => record.object_key.includes(`/${GENERATED_OUTPUT_NAMESPACE}/`)), "Raw source and generated output object keys must use separate namespaces.");

  for (const record of allObjectPaths) {
    pushCheck(items, record.object_path_id, "required_identity_fields", [
      record.object_key,
      record.tenant_id,
      record.matter_id,
      record.content_hash,
      record.resolver_id,
      record.namespace,
    ].every(Boolean), "Object path must preserve tenant, matter, resolver, namespace, and content hash fields.");
    pushCheck(items, record.object_path_id, "forbids_overwrite", record.overwrite_policy === "forbidden", "Object path must inherit the no-overwrite policy.");
  }
  return items.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeLayout(context) {
  const { validation, validationItems, pathResolvers, rawSourceObjectPaths, generatedOutputObjectPaths, collisionReport, namespaceIndex } = context;
  const failedValidationItemCount = validationItems.filter((item) => item.status === "failed").length;
  return {
    object_store_layout_status: validation.valid ? "complete" : "blocked",
    layout_contract_id: LAYOUT_CONTRACT_ID,
    object_store_root: OBJECT_STORE_ROOT,
    namespace_count: namespaceIndex.namespaces.length,
    path_resolver_count: pathResolvers.length,
    raw_source_object_path_count: rawSourceObjectPaths.length,
    generated_output_object_path_count: generatedOutputObjectPaths.length,
    total_object_path_count: rawSourceObjectPaths.length + generatedOutputObjectPaths.length,
    collision_count: collisionReport.collision_count,
    raw_source_namespace: RAW_SOURCE_NAMESPACE,
    generated_output_namespace: GENERATED_OUTPUT_NAMESPACE,
    overwrite_forbidden_resolver_count: pathResolvers.filter((resolver) => resolver.overwrite_policy === "forbidden").length,
    content_addressed_path_count: [...rawSourceObjectPaths, ...generatedOutputObjectPaths].filter((record) => record.object_key.includes(`/sha256=${safeSegment(record.content_hash)}/`)).length,
    absolute_source_path_key_count: [...rawSourceObjectPaths, ...generatedOutputObjectPaths].filter((record) => record.object_key.includes("/Users/") || record.object_key.includes(":\\")).length,
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
    validation_id: `immutable-object-store-layout.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function renderImmutableObjectStoreLayoutMarkdown(result) {
  const lines = [];
  lines.push("# Immutable Object Store Layout");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.object_store_layout_status}`);
  lines.push(`Layout contract: ${result.summary.layout_contract_id}`);
  lines.push(`Object store root: ${result.summary.object_store_root}`);
  lines.push(`Raw source object paths: ${result.summary.raw_source_object_path_count}`);
  lines.push(`Generated output object paths: ${result.summary.generated_output_object_path_count}`);
  lines.push(`Collisions: ${result.summary.collision_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Contract");
  lines.push("");
  lines.push("- Raw sources and generated outputs use separate immutable namespaces.");
  lines.push("- Object keys include tenant, matter, namespace, stable id, and content hash.");
  lines.push("- Local absolute source paths stay metadata-only and are never embedded into object keys.");
  lines.push("- The resolver is layout-only; no file copy, delivery, or overwrite action is performed.");
  return lines.join("\n");
}

function normalizeInputs(options = {}) {
  return {
    resource_store_interface_path: path.resolve(options.resourceStoreInterfacePath ?? options.resource_store_interface_path ?? DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_INPUTS.resourceStoreInterfacePath),
    output_artifact_catalog_path: path.resolve(options.outputArtifactCatalogPath ?? options.output_artifact_catalog_path ?? DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_INPUTS.outputArtifactCatalogPath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? options.output_delivery_contract_freeze_path ?? DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_INPUTS.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? options.package_path ?? DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? options.roadmap_path ?? DEFAULT_IMMUTABLE_OBJECT_STORE_LAYOUT_INPUTS.roadmapPath),
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
    else if (arg === "--output-artifact-catalog") parsed.outputArtifactCatalogPath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/immutable-object-store-layout.mjs [options]

Options:
  --resource-store-interface <path>          resource-store-interface.json path.
  --output-artifact-catalog <path>           output-catalog.json path.
  --output-delivery-contract-freeze <path>   output-delivery-contract-freeze.json path.
  --package <path>                           package.json path.
  --roadmap <path>                           implementation-roadmap.md path.
  --out-dir <path>                           Output directory.
  --run-at <iso>                             Fixed generated_at timestamp.
  --check                                    Exit non-zero on validation errors.
  --help                                     Show this message.
`);
}

function serializableLayout(result) {
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

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const groupKey = item[key];
    if (!grouped.has(groupKey)) grouped.set(groupKey, []);
    grouped.get(groupKey).push(item);
  }
  return grouped;
}

function extensionFromUri(value) {
  const extension = path.extname(String(value ?? "")).replace(/^\./, "");
  return extension || null;
}

function normalizeExtension(value) {
  const extension = String(value ?? "bin").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 16);
  return extension || "bin";
}

function safeSegment(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 128) || "unknown";
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
