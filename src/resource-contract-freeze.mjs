import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RESOURCE_CONTRACT_FREEZE_OUT_DIR = "artifacts/resource-contract-freeze/latest";
export const DEFAULT_RESOURCE_CONTRACT_FREEZE_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
};

const CLASSIFICATIONS = new Set([
  "P0_PUBLIC",
  "P1_INTERNAL",
  "P2_CLIENT_CONFIDENTIAL",
  "P3_PRIVILEGED",
  "P4_HIGHLY_RESTRICTED",
  "P5_SECRET",
]);

const SOURCE_SYSTEMS = new Set([
  "local_filesystem",
  "onedrive",
  "vdr",
  "outlook",
  "kakaotalk",
  "github",
  "plane",
  "manual",
]);

export async function runResourceContractFreeze(options = {}) {
  const result = await buildResourceContractFreeze(options);
  if (options.write !== false) await writeResourceContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Resource contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildResourceContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RESOURCE_CONTRACT_FREEZE_OUT_DIR);
  const resourceIngestPath = path.resolve(options.resourceIngestPath ?? DEFAULT_RESOURCE_CONTRACT_FREEZE_INPUTS.resourceIngestPath);
  const ingest = await readJson(resourceIngestPath);
  const resourceEvidence = ingest.schema_version === "resource-evidence.v1" ? ingest : ingest.resource_evidence;
  const sourceResources = resourceEvidence?.resources ?? [];
  const sourceResourceVersions = resourceEvidence?.resource_versions ?? [];
  const { resourcesV2, resourceVersionsV2 } = projectResourceContracts(sourceResources, sourceResourceVersions, generatedAt);
  const validationItems = validateResourceContracts(resourcesV2, resourceVersionsV2);
  const validation = summarizeValidation(validationItems, resourcesV2, resourceVersionsV2);
  const result = {
    schema_version: "resource-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `resource-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: {
      resource_ingest_path: resourceIngestPath,
    },
    source_resource_evidence: {
      schema_version: resourceEvidence?.schema_version ?? null,
      source_resource_count: sourceResources.length,
      source_resource_version_count: sourceResourceVersions.length,
      source_summary: ingest.summary ?? null,
    },
    contract_versions: {
      resource_schema_version: "resource-core.v2",
      resource_version_schema_version: "resource-version.v2",
      compatibility_floor: "resource-evidence.v1",
    },
    summary: summarizeFreeze(resourcesV2, resourceVersionsV2, validationItems, validation),
    resource_contract: {
      schema_version: "resource-contract.v2",
      generated_at: generatedAt,
      resources: resourcesV2,
      resource_versions: resourceVersionsV2,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderResourceContractFreezeMarkdown(result),
  };
}

export async function writeResourceContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "resource-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "resource-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    resource_schema_version: result.contract_versions.resource_schema_version,
    resource_count: result.resource_contract.resources.length,
    resources: result.resource_contract.resources,
  });
  await writeJson(path.join(outDir, "resource-version-v2-fixture.json"), {
    generated_at: result.generated_at,
    resource_version_schema_version: result.contract_versions.resource_version_schema_version,
    resource_version_count: result.resource_contract.resource_versions.length,
    resource_versions: result.resource_contract.resource_versions,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runResourceContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runResourceContractFreeze(args);
    console.log(`Resource contract freeze written to ${result.output_dir}`);
    console.log(`Resources v2: ${result.summary.resource_count}`);
    console.log(`Resource versions v2: ${result.summary.resource_version_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectResourceContracts(resources, resourceVersions, generatedAt) {
  const versionsByResource = groupBy(resourceVersions, "resource_id");
  const resourcesV2 = resources.map((resource) => {
    const versions = versionsByResource.get(resource.id) ?? [];
    const latestVersion = latestResourceVersion(versions);
    const externalId = externalIdFor(resource);
    return {
      schema_version: "resource-core.v2",
      resource_id: resource.id,
      tenant_id: resource.tenant_id,
      matter_id: resource.matter_id,
      source_system: resource.source_system,
      external_id: externalId,
      external_version_id: externalVersionIdFor(latestVersion, externalId),
      source_uri: resource.source_uri,
      resource_type: resource.resource_type,
      content_hash: resource.content_hash,
      content_hash_algorithm: "sha256",
      classification: resource.classification,
      classification_source: resource.metadata?.classification_source ?? "resource_expansion",
      policy_snapshot_id: resource.metadata?.policy_snapshot_id ?? "policy.default.law_firm.v1",
      latest_resource_version_id: latestVersion?.id ?? null,
      materialization_status: resource.materialization_status,
      ingestion_status: resource.ingestion_status,
      created_at: resource.created_at ?? generatedAt,
      created_by: resource.created_by ?? { actor_type: "harness", actor_id: "harness.resource_contract_freeze" },
      metadata: {
        ...(resource.metadata ?? {}),
        source_resource_schema_version: resource.schema_version,
      },
    };
  });

  const resourceById = new Map(resourcesV2.map((resource) => [resource.resource_id, resource]));
  const latestVersionIds = new Set(resourcesV2.map((resource) => resource.latest_resource_version_id).filter(Boolean));
  const resourceVersionsV2 = resourceVersions.map((version) => {
    const resource = resourceById.get(version.resource_id);
    const externalId = resource?.external_id ?? version.metadata?.external_id ?? version.resource_id;
    return {
      schema_version: "resource-version.v2",
      resource_version_id: version.id,
      resource_id: version.resource_id,
      version_label: version.version_label,
      source_system: resource?.source_system ?? version.metadata?.source_system ?? "manual",
      external_id: externalId,
      external_version_id: externalVersionIdFor(version, externalId),
      content_hash: version.content_hash,
      content_hash_algorithm: "sha256",
      classification: resource?.classification ?? version.metadata?.classification ?? null,
      matter_id: resource?.matter_id ?? version.metadata?.matter_id ?? null,
      version_status: latestVersionIds.has(version.id) ? "current" : "superseded",
      created_at: version.created_at,
      captured_at: version.metadata?.captured_at ?? version.created_at,
      metadata: {
        ...(version.metadata ?? {}),
        source_resource_version_schema_version: version.schema_version,
      },
    };
  });

  return {
    resourcesV2: resourcesV2.sort((left, right) => left.resource_id.localeCompare(right.resource_id)),
    resourceVersionsV2: resourceVersionsV2.sort((left, right) => left.resource_version_id.localeCompare(right.resource_version_id)),
  };
}

function validateResourceContracts(resources, resourceVersions) {
  const validationItems = [];
  const versionById = new Map(resourceVersions.map((version) => [version.resource_version_id, version]));
  const resourceById = new Map(resources.map((resource) => [resource.resource_id, resource]));
  const externalKeyOwners = new Map();

  for (const resource of resources) {
    pushCheck(validationItems, resource, "resource", "content_hash_present", Boolean(resource.content_hash), "Resource must carry a sha256 content hash.");
    pushCheck(validationItems, resource, "resource", "source_system_present", SOURCE_SYSTEMS.has(resource.source_system), "Resource source_system must be one of the canonical source systems.");
    pushCheck(validationItems, resource, "resource", "external_id_present", Boolean(resource.external_id), "Resource must carry an external_id for source-system reconciliation.");
    pushCheck(validationItems, resource, "resource", "classification_present", CLASSIFICATIONS.has(resource.classification), "Resource classification must be a P0-P5 policy class.");
    pushCheck(validationItems, resource, "resource", "matter_link_present", Boolean(resource.matter_id), "Resource must link to a matter boundary.");
    pushCheck(validationItems, resource, "resource", "latest_version_link_present", Boolean(resource.latest_resource_version_id && versionById.has(resource.latest_resource_version_id)), "Resource must link to a known latest resource version.");

    const externalKey = `${resource.source_system}:${resource.external_id}`;
    if (externalKeyOwners.has(externalKey) && externalKeyOwners.get(externalKey) !== resource.resource_id) {
      pushCheck(validationItems, resource, "resource", "external_id_unique", false, `External key ${externalKey} is already owned by ${externalKeyOwners.get(externalKey)}.`);
    } else {
      externalKeyOwners.set(externalKey, resource.resource_id);
      pushCheck(validationItems, resource, "resource", "external_id_unique", true, `External key ${externalKey} is unique in the fixture.`);
    }
  }

  for (const version of resourceVersions) {
    const resource = resourceById.get(version.resource_id);
    pushCheck(validationItems, version, "resource_version", "resource_link_present", Boolean(resource), "ResourceVersion must link to a known resource.");
    pushCheck(validationItems, version, "resource_version", "content_hash_present", Boolean(version.content_hash), "ResourceVersion must carry a sha256 content hash.");
    pushCheck(validationItems, version, "resource_version", "source_system_consistent", Boolean(resource && version.source_system === resource.source_system), "ResourceVersion source_system must match its resource.");
    pushCheck(validationItems, version, "resource_version", "external_id_present", Boolean(version.external_id), "ResourceVersion must preserve the resource external_id.");
    pushCheck(validationItems, version, "resource_version", "classification_present", CLASSIFICATIONS.has(version.classification), "ResourceVersion must preserve the resource classification.");
    pushCheck(validationItems, version, "resource_version", "matter_link_present", Boolean(version.matter_id), "ResourceVersion must preserve the resource matter link.");
    pushCheck(
      validationItems,
      version,
      "resource_version",
      "content_hash_matches_resource",
      Boolean(resource && (version.version_status !== "current" || version.content_hash === resource.content_hash)),
      "The current ResourceVersion content hash must match the Resource content hash.",
    );
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function pushCheck(validationItems, subject, subjectType, checkId, passed, message) {
  const subjectId = subjectType === "resource" ? subject.resource_id : subject.resource_version_id;
  validationItems.push({
    validation_id: `resource-contract-validation.${subjectType}.${slugify(subjectId)}.${checkId}`,
    subject_type: subjectType,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function summarizeValidation(validationItems, resources, resourceVersions) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (resources.length === 0) errors.push({ path: "resource_contract.resources", message: "At least one Resource v2 fixture is required." });
  if (resourceVersions.length === 0) errors.push({ path: "resource_contract.resource_versions", message: "At least one ResourceVersion v2 fixture is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFreeze(resources, resourceVersions, validationItems, validation) {
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    resource_schema_version: "resource-core.v2",
    resource_version_schema_version: "resource-version.v2",
    resource_count: resources.length,
    resource_version_count: resourceVersions.length,
    current_resource_version_count: resourceVersions.filter((version) => version.version_status === "current").length,
    content_hash_count: resources.filter((resource) => resource.content_hash).length,
    source_system_count: new Set(resources.map((resource) => resource.source_system)).size,
    external_id_count: resources.filter((resource) => resource.external_id).length,
    classification_count: resources.filter((resource) => resource.classification).length,
    matter_link_count: resources.filter((resource) => resource.matter_id).length,
    latest_version_link_count: resources.filter((resource) => resource.latest_resource_version_id).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_source_system: countBy(resources, "source_system"),
    by_classification: countBy(resources, "classification"),
    by_matter_id: countBy(resources, "matter_id"),
  };
}

function renderResourceContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Resource Contract Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.freeze_status}`);
  lines.push("");
  lines.push(`- Resource schema: ${result.summary.resource_schema_version}`);
  lines.push(`- ResourceVersion schema: ${result.summary.resource_version_schema_version}`);
  lines.push(`- Resources: ${result.summary.resource_count}`);
  lines.push(`- Resource versions: ${result.summary.resource_version_count}`);
  lines.push(`- Content hashes: ${result.summary.content_hash_count}`);
  lines.push(`- External IDs: ${result.summary.external_id_count}`);
  lines.push(`- Classifications: ${result.summary.classification_count}`);
  lines.push(`- Matter links: ${result.summary.matter_link_count}`);
  lines.push(`- Latest version links: ${result.summary.latest_version_link_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Source Systems");
  for (const [sourceSystem, count] of Object.entries(result.summary.by_source_system)) {
    lines.push(`- ${sourceSystem}: ${count}`);
  }
  lines.push("");
  lines.push("## Classifications");
  for (const [classification, count] of Object.entries(result.summary.by_classification)) {
    lines.push(`- ${classification}: ${count}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function latestResourceVersion(versions) {
  return [...versions].sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0] ?? null;
}

function externalIdFor(resource) {
  return resource.metadata?.external_id
    ?? resource.metadata?.source_expansion_item_id
    ?? resource.source_uri
    ?? resource.id;
}

function externalVersionIdFor(version, externalId) {
  return version?.metadata?.external_version_id ?? `${externalId ?? version?.resource_id ?? "unknown"}:${version?.version_label ?? "v1"}`;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 180) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/resource-contract-freeze.mjs [options]

Options:
  --out-dir <path>          Output directory.
  --resource-ingest <path>  resource-ingest.json or resource-evidence.json path.
  --run-at <iso>            Override generated_at.
  --check                   Exit non-zero on validation errors.
  --help                    Show this help.
`);
}
