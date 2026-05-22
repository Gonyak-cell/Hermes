import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  loadCoreSchemas,
  validateCapabilityManifest,
} from "./core-contract-validator.mjs";

export const DEFAULT_DOMAIN_PACK_ROOT = "packs";
export const DEFAULT_DOMAIN_PACK_OUT_DIR = "artifacts/domain-packs/latest";
export const DEFAULT_DOMAIN_PACK_POLICY_MATRIX = "examples/core/policy-matrix.json";
export const DEFAULT_DOMAIN_PACK_REGISTRY_SCHEMA = "schemas/domain-pack-registry.schema.json";

const REQUIRED_PACK_SECTIONS = [
  "capabilities",
  "policies",
  "schemas",
  "workflows",
  "gates",
  "templates",
  "extractors",
  "renderers",
  "migrations",
  "golden_cases",
];

const KNOWN_PACK_IDS = new Set(["common", "law-firm", "personal-dev", "creative-document"]);

export async function runDomainPackRegistry(options = {}) {
  const result = await buildDomainPackRegistry(options);
  if (options.write !== false) await writeDomainPackRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Domain pack registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildDomainPackRegistry(options = {}) {
  const packRoot = path.resolve(options.packRoot ?? DEFAULT_DOMAIN_PACK_ROOT);
  const outputDir = path.resolve(options.outDir ?? DEFAULT_DOMAIN_PACK_OUT_DIR);
  const policyMatrixPath = path.resolve(options.policyMatrixPath ?? DEFAULT_DOMAIN_PACK_POLICY_MATRIX);
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const policyMatrix = JSON.parse(await readFile(policyMatrixPath, "utf8"));
  const coreSchemas = await loadCoreSchemas(options.schemaDir);
  const manifests = await readPackManifests(packRoot);
  const packIds = new Set(manifests.map((record) => record.manifest?.pack_id).filter(Boolean));
  const packs = [];
  const capabilities = [];
  const validationErrors = [];

  for (const record of manifests) {
    const packErrors = validatePackManifest(record.manifest, record.manifest_path, packIds);
    const capabilityRecords = await readPackCapabilities(record, coreSchemas, policyMatrix);
    const capabilityErrors = capabilityRecords.flatMap((capability) => capability.validation.errors);
    const validation = {
      valid: packErrors.length === 0 && capabilityErrors.length === 0,
      errors: [...packErrors, ...capabilityErrors],
    };

    packs.push({
      pack_id: record.manifest.pack_id,
      pack_version: record.manifest.pack_version,
      display_name: record.manifest.display_name,
      enabled: record.manifest.enabled !== false,
      path: record.manifest_path,
      capability_count: capabilityRecords.length,
      dependency_pack_ids: (record.manifest.dependencies ?? []).map((dependency) => dependency.pack_id),
      policy_overlay_count: record.manifest.policies?.length ?? 0,
      validation,
      manifest: record.manifest,
    });
    capabilities.push(...capabilityRecords);
    validationErrors.push(...validation.errors);
  }

  validationErrors.push(...validateRegistrySemantics(packs, capabilities));
  const registry = {
    schema_version: "domain-pack-registry.v1",
    generated_at: generatedAt,
    pack_root: packRoot,
    policy_matrix_path: policyMatrixPath,
    output_dir: outputDir,
    summary: summarizeRegistry(packs, capabilities, validationErrors),
    packs,
    capabilities,
    validation: {
      valid: validationErrors.length === 0,
      errors: validationErrors,
    },
  };

  return {
    ...registry,
    markdown: renderDomainPackRegistryMarkdown(registry),
  };
}

export async function writeDomainPackRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "domain-pack-registry.json"), {
    schema_version: result.schema_version,
    generated_at: result.generated_at,
    pack_root: result.pack_root,
    policy_matrix_path: result.policy_matrix_path,
    summary: result.summary,
    packs: result.packs,
    capabilities: result.capabilities,
    validation: result.validation,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runDomainPackRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runDomainPackRegistry(args);
    console.log(`Domain pack registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Packs: ${result.summary.pack_count}`);
    console.log(`Capabilities: ${result.summary.capability_count}`);
    console.log(`Valid: ${result.validation.valid}`);
    if (result.validation.errors.length > 0) {
      console.log(`Errors: ${result.validation.errors.length}`);
    }
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

async function readPackManifests(packRoot) {
  const entries = await readdir(packRoot, { withFileTypes: true });
  const manifests = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(packRoot, entry.name, "pack.json");
    try {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      manifests.push({
        manifest_path: manifestPath,
        manifest_dir: path.dirname(manifestPath),
        manifest,
      });
    } catch (error) {
      manifests.push({
        manifest_path: manifestPath,
        manifest_dir: path.dirname(manifestPath),
        manifest: {
          schema_version: "domain-pack-manifest.v1",
          pack_id: entry.name,
          pack_version: "0.0.0",
          display_name: entry.name,
          description: "",
          enabled: false,
          capabilities: [],
          policies: [],
          schemas: [],
          workflows: [],
          gates: [],
          templates: [],
          extractors: [],
          renderers: [],
          migrations: [],
          golden_cases: [],
          dependencies: [],
          permissions: {},
          metadata: {
            manifest_read_error: error.code === "ENOENT" ? "not_found" : error.message,
          },
        },
      });
    }
  }
  return manifests.sort((left, right) => left.manifest.pack_id.localeCompare(right.manifest.pack_id));
}

async function readPackCapabilities(record, coreSchemas, policyMatrix) {
  const capabilities = [];
  for (const capabilityRef of record.manifest.capabilities ?? []) {
    const capabilityPath = path.resolve(record.manifest_dir, capabilityRef.path);
    try {
      const capability = JSON.parse(await readFile(capabilityPath, "utf8"));
      const validation = validateCapabilityManifest(capability, coreSchemas, policyMatrix);
      const errors = [...validation.errors];
      if (capabilityRef.capability_id !== capability.capability_id) {
        errors.push({
          path: `packs.${record.manifest.pack_id}.capabilities.${capabilityRef.capability_id}`,
          message: `Capability ref points to ${capability.capability_id}`,
        });
      }
      if (capabilityRef.version !== capability.version) {
        errors.push({
          path: `packs.${record.manifest.pack_id}.capabilities.${capabilityRef.capability_id}`,
          message: `Capability ref version ${capabilityRef.version} does not match ${capability.version}`,
        });
      }
      if (capability.domain_pack !== record.manifest.pack_id) {
        errors.push({
          path: `packs.${record.manifest.pack_id}.capabilities.${capability.capability_id}`,
          message: `Capability domain_pack ${capability.domain_pack} does not match pack_id ${record.manifest.pack_id}`,
        });
      }
      capabilities.push(toCapabilityRecord(record.manifest.pack_id, capabilityPath, capability, {
        valid: errors.length === 0,
        errors,
      }));
    } catch (error) {
      capabilities.push({
        capability_id: capabilityRef.capability_id,
        version: capabilityRef.version,
        pack_id: record.manifest.pack_id,
        path: capabilityPath,
        display_name: capabilityRef.capability_id,
        input_contract: null,
        output_contract: null,
        allowed_runtimes: [],
        required_gate_count: 0,
        validation: {
          valid: false,
          errors: [
            {
              path: `packs.${record.manifest.pack_id}.capabilities.${capabilityRef.capability_id}`,
              message: error.code === "ENOENT" ? "Capability manifest not found" : error.message,
            },
          ],
        },
      });
    }
  }
  return capabilities;
}

function toCapabilityRecord(packId, capabilityPath, capability, validation) {
  return {
    capability_id: capability.capability_id,
    version: capability.version,
    pack_id: packId,
    path: capabilityPath,
    display_name: capability.display_name,
    input_contract: capability.input_contract,
    output_contract: capability.output_contract,
    allowed_runtimes: capability.allowed_runtimes ?? [],
    required_gate_count: [
      ...(capability.required_gates?.pre_run ?? []),
      ...(capability.required_gates?.in_run ?? []),
      ...(capability.required_gates?.post_run ?? []),
    ].length,
    validation,
  };
}

function validatePackManifest(manifest, manifestPath, packIds) {
  const errors = [];
  if (manifest.schema_version !== "domain-pack-manifest.v1") {
    errors.push({ path: manifestPath, message: "Expected schema_version domain-pack-manifest.v1" });
  }
  if (!KNOWN_PACK_IDS.has(manifest.pack_id)) {
    errors.push({ path: `${manifestPath}.pack_id`, message: `Unknown pack_id ${manifest.pack_id}` });
  }
  for (const section of REQUIRED_PACK_SECTIONS) {
    if (!Array.isArray(manifest[section])) {
      errors.push({ path: `${manifestPath}.${section}`, message: "Expected array section" });
    }
  }
  for (const dependency of manifest.dependencies ?? []) {
    if (!packIds.has(dependency.pack_id)) {
      errors.push({
        path: `${manifestPath}.dependencies`,
        message: `Unknown dependency pack ${dependency.pack_id}`,
      });
    }
  }
  if (!manifest.permissions?.max_classification) {
    errors.push({ path: `${manifestPath}.permissions.max_classification`, message: "Missing max_classification" });
  }
  if (!manifest.permissions?.external_model_policy) {
    errors.push({ path: `${manifestPath}.permissions.external_model_policy`, message: "Missing external_model_policy" });
  }
  return errors;
}

function validateRegistrySemantics(packs, capabilities) {
  const errors = [];
  errors.push(...validateUniqueBy(packs, "packs", "pack_id"));
  errors.push(...validateUniqueBy(capabilities, "capabilities", "capability_id"));
  for (const requiredPackId of KNOWN_PACK_IDS) {
    if (!packs.some((pack) => pack.pack_id === requiredPackId)) {
      errors.push({ path: "domain_pack_registry.packs", message: `Missing required pack ${requiredPackId}` });
    }
  }
  for (const pack of packs) {
    if (pack.pack_id !== "common" && !pack.dependency_pack_ids.includes("common")) {
      errors.push({ path: `packs.${pack.pack_id}.dependencies`, message: "Domain pack must depend on common pack" });
    }
  }
  return errors;
}

function summarizeRegistry(packs, capabilities, errors) {
  return {
    pack_count: packs.length,
    enabled_pack_count: packs.filter((pack) => pack.enabled).length,
    capability_count: capabilities.length,
    valid_pack_count: packs.filter((pack) => pack.validation.valid).length,
    invalid_pack_count: packs.filter((pack) => !pack.validation.valid).length,
    valid_capability_count: capabilities.filter((capability) => capability.validation.valid).length,
    invalid_capability_count: capabilities.filter((capability) => !capability.validation.valid).length,
    error_count: errors.length,
    by_pack_id: Object.fromEntries(
      packs.map((pack) => [pack.pack_id, {
        version: pack.pack_version,
        enabled: pack.enabled,
        capability_count: pack.capability_count,
        valid: pack.validation.valid,
      }]),
    ),
  };
}

function renderDomainPackRegistryMarkdown(registry) {
  const lines = [];
  lines.push("# Domain Pack Registry");
  lines.push("");
  lines.push(`Generated: ${registry.generated_at}`);
  lines.push(`Pack root: ${registry.pack_root}`);
  lines.push("");
  lines.push(`- Packs: ${registry.summary.pack_count}`);
  lines.push(`- Capabilities: ${registry.summary.capability_count}`);
  lines.push(`- Valid packs: ${registry.summary.valid_pack_count}`);
  lines.push(`- Invalid packs: ${registry.summary.invalid_pack_count}`);
  lines.push(`- Errors: ${registry.summary.error_count}`);
  lines.push("");
  lines.push("## Packs");
  lines.push("");
  for (const pack of registry.packs) {
    lines.push(`- ${pack.pack_id}@${pack.pack_version}: ${pack.display_name} (${pack.validation.valid ? "valid" : "invalid"})`);
  }
  lines.push("");
  lines.push("## Capabilities");
  lines.push("");
  for (const capability of registry.capabilities) {
    lines.push(`- ${capability.capability_id}@${capability.version} (${capability.pack_id})`);
  }
  if (registry.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    lines.push("");
    for (const error of registry.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function validateUniqueBy(items, pathPrefix, key) {
  const errors = [];
  const seen = new Set();
  for (const item of items) {
    const value = item[key];
    if (seen.has(value)) {
      errors.push({ path: pathPrefix, message: `Duplicate ${key} ${value}` });
    }
    seen.add(value);
  }
  return errors;
}

function parseArgs(argv) {
  const parsed = {
    packRoot: DEFAULT_DOMAIN_PACK_ROOT,
    outDir: DEFAULT_DOMAIN_PACK_OUT_DIR,
    policyMatrixPath: DEFAULT_DOMAIN_PACK_POLICY_MATRIX,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--pack-root") parsed.packRoot = argv[++index];
    else if (arg === "--policy-matrix") parsed.policyMatrixPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/domain-pack-registry.mjs [options]

Options:
  --pack-root <folder>      Domain pack root. Default: ${DEFAULT_DOMAIN_PACK_ROOT}
  --policy-matrix <path>    Policy matrix path.
  --out-dir <folder>        Output directory.
  --run-at <iso>            Deterministic generated_at timestamp.
  --check                   Validate only, do not write artifacts.
  -h, --help                Show this help.
`);
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
