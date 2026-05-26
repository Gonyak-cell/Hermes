import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PACK_MANIFEST_COMPATIBILITY_OUT_DIR = "artifacts/pack-manifest-compatibility/latest";
export const DEFAULT_PACK_MANIFEST_COMPATIBILITY_INPUTS = {
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

export async function runPackManifestCompatibility(options = {}) {
  const result = await buildPackManifestCompatibility(options);
  if (options.write !== false) await writePackManifestCompatibility(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Pack manifest compatibility validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPackManifestCompatibility(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PACK_MANIFEST_COMPATIBILITY_OUT_DIR);
  const inputs = {
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_PACK_MANIFEST_COMPATIBILITY_INPUTS.domainPackRegistryPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_PACK_MANIFEST_COMPATIBILITY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_PACK_MANIFEST_COMPATIBILITY_INPUTS.roadmapPath),
  };
  const domainPackRegistry = await readJson(inputs.domain_pack_registry_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");
  const packs = domainPackRegistry.packs ?? [];
  const coreVersion = packageJson.version ?? "0.0.0";
  const packCompatibilityRecords = buildPackCompatibilityRecords(packs, coreVersion, generatedAt);
  const dependencyEdges = buildDependencyEdges(packs, generatedAt);
  const compatibilityMatrix = buildCompatibilityMatrix(packCompatibilityRecords, dependencyEdges, generatedAt);
  const validationItems = validatePackManifestCompatibility({
    domainPackRegistry,
    packageJson,
    roadmapText,
    packCompatibilityRecords,
    dependencyEdges,
    compatibilityMatrix,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "pack-manifest-compatibility.v1",
    generated_at: generatedAt,
    compatibility_check_id: `pack-manifest-compatibility.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      domain_pack_registry: {
        schema_version: domainPackRegistry.schema_version,
        registry_status: domainPackRegistry.validation?.valid ? "passed" : "failed",
        pack_count: domainPackRegistry.summary?.pack_count ?? packs.length,
        capability_count: domainPackRegistry.summary?.capability_count ?? 0,
        validation_error_count: domainPackRegistry.summary?.error_count ?? domainPackRegistry.validation?.errors?.length ?? 0,
      },
      core_package: {
        package_name: packageJson.name ?? "hermes-agent-starter",
        core_version: coreVersion,
        package_script_registered: Boolean(packageJson.scripts?.["packs:compatibility"]),
      },
    },
    pack_manifest_compatibility: {
      schema_version: "pack-manifest-compatibility.v1",
      core_version: coreVersion,
      pack_compatibility_records: packCompatibilityRecords,
      dependency_edges: dependencyEdges,
      compatibility_matrix: compatibilityMatrix,
    },
    pack_compatibility_records: packCompatibilityRecords,
    dependency_edges: dependencyEdges,
    compatibility_matrix: compatibilityMatrix,
    summary: summarizePackManifestCompatibility({
      coreVersion,
      packCompatibilityRecords,
      dependencyEdges,
      compatibilityMatrix,
      validation,
      validationItems,
    }),
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderPackManifestCompatibilityMarkdown(result),
  };
}

export async function writePackManifestCompatibility(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializablePackManifestCompatibility(result);
  await writeJson(path.join(outDir, "pack-manifest-compatibility.json"), serializable);
  await writeJson(path.join(outDir, "pack-compatibility-records.json"), {
    generated_at: result.generated_at,
    record_count: result.pack_compatibility_records.length,
    pack_compatibility_records: result.pack_compatibility_records,
  });
  await writeJson(path.join(outDir, "pack-dependency-edges.json"), {
    generated_at: result.generated_at,
    edge_count: result.dependency_edges.length,
    dependency_edges: result.dependency_edges,
  });
  await writeJson(path.join(outDir, "pack-compatibility-matrix.json"), {
    generated_at: result.generated_at,
    matrix_count: result.compatibility_matrix.length,
    compatibility_matrix: result.compatibility_matrix,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    compatibility_check_id: result.compatibility_check_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPackManifestCompatibilityCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPackManifestCompatibility(args);
    console.log(`Pack manifest compatibility written to ${result.output_dir}`);
    console.log(`Packs: ${result.summary.pack_count}`);
    console.log(`Core-compatible packs: ${result.summary.core_compatible_pack_count}`);
    console.log(`Dependency edges: ${result.summary.dependency_edge_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildPackCompatibilityRecords(packs, coreVersion, generatedAt) {
  const packIds = new Set(packs.map((pack) => pack.pack_id));
  return packs.map((pack) => {
    const manifest = pack.manifest ?? {};
    const dependencies = manifest.dependencies ?? [];
    const minCoreVersion = manifest.core_compatibility?.min_core_version ?? null;
    const coreDeclared = Boolean(minCoreVersion);
    const coreCompatible = coreDeclared && compareVersions(coreVersion, minCoreVersion) >= 0;
    const missingDependencies = dependencies.filter((dependency) => !packIds.has(dependency.pack_id));
    const versionMismatches = dependencies.filter((dependency) => {
      const targetPack = packs.find((candidate) => candidate.pack_id === dependency.pack_id);
      return targetPack && dependency.version && compareVersions(targetPack.pack_version, dependency.version) < 0;
    });
    const commonDependencyDeclared = pack.pack_id === "common" || dependencies.some((dependency) => dependency.pack_id === "common");
    const dependencyStatus = missingDependencies.length === 0 && versionMismatches.length === 0 && commonDependencyDeclared
      ? "complete"
      : "blocked";
    const compatibilityStatus = coreCompatible && dependencyStatus === "complete" && pack.validation?.valid !== false
      ? "compatible"
      : "blocked";

    return {
      schema_version: "pack-compatibility-record.v1",
      pack_id: pack.pack_id,
      pack_version: pack.pack_version,
      display_name: pack.display_name,
      enabled: pack.enabled !== false,
      manifest_path: pack.path ?? null,
      core_version: coreVersion,
      min_core_version: minCoreVersion,
      core_version_declared: coreDeclared,
      core_compatibility_status: coreCompatible ? "compatible" : "blocked",
      dependency_status: dependencyStatus,
      compatibility_status: compatibilityStatus,
      dependency_count: dependencies.length,
      dependency_pack_ids: dependencies.map((dependency) => dependency.pack_id),
      common_dependency_declared: commonDependencyDeclared,
      missing_dependency_count: missingDependencies.length,
      missing_dependency_pack_ids: missingDependencies.map((dependency) => dependency.pack_id),
      dependency_version_mismatch_count: versionMismatches.length,
      dependency_version_mismatches: versionMismatches.map((dependency) => ({
        pack_id: dependency.pack_id,
        required_version: dependency.version ?? null,
        actual_version: packs.find((candidate) => candidate.pack_id === dependency.pack_id)?.pack_version ?? null,
      })),
      registry_validation_status: pack.validation?.valid === false ? "failed" : "passed",
      law_firm_human_review_required: pack.pack_id === "law-firm",
      default_output_status: manifest.permissions?.default_output_status ?? null,
      external_model_policy: manifest.permissions?.external_model_policy ?? null,
      created_at: generatedAt,
    };
  });
}

function buildDependencyEdges(packs, generatedAt) {
  const byPack = new Map(packs.map((pack) => [pack.pack_id, pack]));
  const edges = [];
  for (const pack of packs) {
    for (const dependency of pack.manifest?.dependencies ?? []) {
      const targetPack = byPack.get(dependency.pack_id);
      const versionSatisfied = targetPack && dependency.version
        ? compareVersions(targetPack.pack_version, dependency.version) >= 0
        : Boolean(targetPack);
      edges.push({
        schema_version: "pack-dependency-edge.v1",
        source_pack_id: pack.pack_id,
        target_pack_id: dependency.pack_id,
        required_version: dependency.version ?? null,
        target_version: targetPack?.pack_version ?? null,
        dependency_status: targetPack && versionSatisfied ? "satisfied" : "blocked",
        dependency_exists: Boolean(targetPack),
        dependency_version_declared: Boolean(dependency.version),
        version_satisfied: Boolean(versionSatisfied),
        edge_id: `${pack.pack_id}->${dependency.pack_id}`,
        created_at: generatedAt,
      });
    }
  }
  return edges.sort((left, right) => left.edge_id.localeCompare(right.edge_id));
}

function buildCompatibilityMatrix(packCompatibilityRecords, dependencyEdges, generatedAt) {
  return packCompatibilityRecords.map((record) => {
    const outgoingEdges = dependencyEdges.filter((edge) => edge.source_pack_id === record.pack_id);
    return {
      schema_version: "pack-compatibility-matrix-row.v1",
      pack_id: record.pack_id,
      pack_version: record.pack_version,
      core_version: record.core_version,
      min_core_version: record.min_core_version,
      core_compatibility_status: record.core_compatibility_status,
      dependency_status: record.dependency_status,
      compatibility_status: record.compatibility_status,
      dependency_edge_count: outgoingEdges.length,
      satisfied_dependency_edge_count: outgoingEdges.filter((edge) => edge.dependency_status === "satisfied").length,
      blocked_dependency_edge_count: outgoingEdges.filter((edge) => edge.dependency_status !== "satisfied").length,
      created_at: generatedAt,
    };
  });
}

function validatePackManifestCompatibility({
  domainPackRegistry,
  packageJson,
  roadmapText,
  packCompatibilityRecords,
  dependencyEdges,
  compatibilityMatrix,
}) {
  const items = [];
  pushCheck(
    items,
    "source.domain_pack_registry",
    "domain_pack_registry_valid",
    domainPackRegistry.validation?.valid === true,
    "Domain pack registry must be valid before compatibility checking.",
  );
  pushCheck(
    items,
    "source.package",
    "package_version_declared",
    Boolean(packageJson.version),
    "package.json must declare the core harness version.",
  );
  pushCheck(
    items,
    "source.package.scripts",
    "package_script_registered",
    Boolean(packageJson.scripts?.["packs:compatibility"]),
    "package.json must expose npm run packs:compatibility.",
  );
  pushCheck(
    items,
    "roadmap.phase_178",
    "phase_178_documented",
    roadmapText.includes("P178") && roadmapText.includes("pack manifest compatibility"),
    "Roadmap must keep the P178 pack manifest compatibility slot visible.",
  );
  pushCheck(
    items,
    "pack_compatibility_records",
    "pack_records_present",
    packCompatibilityRecords.length > 0,
    "At least one pack compatibility record must be generated.",
  );
  pushCheck(
    items,
    "pack_compatibility_records.core",
    "all_packs_declare_core_version",
    packCompatibilityRecords.every((record) => record.core_version_declared),
    "Every pack manifest must declare core_compatibility.min_core_version.",
  );
  pushCheck(
    items,
    "pack_compatibility_records.core",
    "all_packs_core_compatible",
    packCompatibilityRecords.every((record) => record.core_compatibility_status === "compatible"),
    "Every pack must be compatible with the current core version.",
  );
  pushCheck(
    items,
    "pack_compatibility_records.dependencies",
    "all_non_common_packs_depend_on_common",
    packCompatibilityRecords.every((record) => record.pack_id === "common" || record.common_dependency_declared),
    "Every domain pack except common must depend on common.",
  );
  pushCheck(
    items,
    "dependency_edges",
    "all_dependency_edges_satisfied",
    dependencyEdges.every((edge) => edge.dependency_status === "satisfied"),
    "Every declared pack dependency must resolve to an installed compatible pack version.",
  );
  pushCheck(
    items,
    "compatibility_matrix",
    "compatibility_matrix_covers_packs",
    compatibilityMatrix.length === packCompatibilityRecords.length,
    "Compatibility matrix must include one row per pack.",
  );
  pushCheck(
    items,
    "compatibility_matrix",
    "all_packs_compatible",
    compatibilityMatrix.every((row) => row.compatibility_status === "compatible"),
    "Every pack must pass core and dependency compatibility.",
  );
  pushCheck(
    items,
    "pack_compatibility_records.law_firm",
    "law_firm_pack_keeps_human_review_boundary",
    packCompatibilityRecords.some((record) => record.pack_id === "law-firm" && record.law_firm_human_review_required && record.default_output_status === "pending_review"),
    "Law-firm pack outputs must remain pending human review by default.",
  );
  return items;
}

function summarizePackManifestCompatibility({ coreVersion, packCompatibilityRecords, dependencyEdges, compatibilityMatrix, validation, validationItems }) {
  const coreDeclaredPackCount = packCompatibilityRecords.filter((record) => record.core_version_declared).length;
  const coreCompatiblePackCount = packCompatibilityRecords.filter((record) => record.core_compatibility_status === "compatible").length;
  const compatiblePackCount = packCompatibilityRecords.filter((record) => record.compatibility_status === "compatible").length;
  const dependencyDeclaredPackCount = packCompatibilityRecords.filter((record) => record.pack_id === "common" || record.dependency_count > 0).length;
  const dependencySatisfiedCount = dependencyEdges.filter((edge) => edge.dependency_status === "satisfied").length;
  const dependencyMissingCount = dependencyEdges.filter((edge) => !edge.dependency_exists).length;
  const dependencyVersionMismatchCount = dependencyEdges.filter((edge) => edge.dependency_exists && !edge.version_satisfied).length;
  const commonDependencyGapCount = packCompatibilityRecords.filter((record) => record.pack_id !== "common" && !record.common_dependency_declared).length;
  return {
    compatibility_status: validation.valid && compatiblePackCount === packCompatibilityRecords.length ? "complete" : "blocked",
    core_version: coreVersion,
    pack_count: packCompatibilityRecords.length,
    compatible_pack_count: compatiblePackCount,
    core_declared_pack_count: coreDeclaredPackCount,
    core_compatible_pack_count: coreCompatiblePackCount,
    dependency_declared_pack_count: dependencyDeclaredPackCount,
    dependency_edge_count: dependencyEdges.length,
    dependency_satisfied_count: dependencySatisfiedCount,
    dependency_missing_count: dependencyMissingCount,
    dependency_version_mismatch_count: dependencyVersionMismatchCount,
    common_dependency_gap_count: commonDependencyGapCount,
    matrix_row_count: compatibilityMatrix.length,
    validation_item_count: validationItems.length,
    validation_error_count: validation.errors.length,
    by_pack_id: Object.fromEntries(
      packCompatibilityRecords.map((record) => [record.pack_id, {
        pack_version: record.pack_version,
        min_core_version: record.min_core_version,
        core_compatibility_status: record.core_compatibility_status,
        dependency_status: record.dependency_status,
        compatibility_status: record.compatibility_status,
      }]),
    ),
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function renderPackManifestCompatibilityMarkdown(result) {
  const lines = [];
  lines.push("# Pack Manifest Compatibility");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Core version: ${result.summary.core_version}`);
  lines.push(`Status: ${result.summary.compatibility_status}`);
  lines.push("");
  lines.push(`- Packs: ${result.summary.pack_count}`);
  lines.push(`- Compatible packs: ${result.summary.compatible_pack_count}`);
  lines.push(`- Core-compatible packs: ${result.summary.core_compatible_pack_count}`);
  lines.push(`- Dependency edges: ${result.summary.dependency_edge_count}`);
  lines.push(`- Satisfied dependency edges: ${result.summary.dependency_satisfied_count}`);
  lines.push(`- Missing dependencies: ${result.summary.dependency_missing_count}`);
  lines.push(`- Dependency version mismatches: ${result.summary.dependency_version_mismatch_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Packs");
  lines.push("");
  for (const record of result.pack_compatibility_records) {
    lines.push(`- ${record.pack_id}@${record.pack_version}: core ${record.core_compatibility_status}, dependencies ${record.dependency_status}, overall ${record.compatibility_status}`);
  }
  lines.push("");
  lines.push("## Dependency Edges");
  lines.push("");
  if (result.dependency_edges.length === 0) {
    lines.push("- none");
  } else {
    for (const edge of result.dependency_edges) {
      lines.push(`- ${edge.source_pack_id} -> ${edge.target_pack_id}@${edge.required_version}: ${edge.dependency_status}`);
    }
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    lines.push("");
    for (const error of result.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

function serializablePackManifestCompatibility(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    domainPackRegistryPath: DEFAULT_PACK_MANIFEST_COMPATIBILITY_INPUTS.domainPackRegistryPath,
    packagePath: DEFAULT_PACK_MANIFEST_COMPATIBILITY_INPUTS.packagePath,
    roadmapPath: DEFAULT_PACK_MANIFEST_COMPATIBILITY_INPUTS.roadmapPath,
    outDir: DEFAULT_PACK_MANIFEST_COMPATIBILITY_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
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
  console.log(`Usage: node scripts/pack-manifest-compatibility.mjs [options]

Options:
  --domain-pack-registry <path> domain-pack-registry.json path.
  --package <path>              package.json path.
  --roadmap <path>              implementation roadmap path.
  --out-dir <folder>            Output directory.
  --run-at <iso>                Deterministic generated_at timestamp.
  --check                       Validate only, do not write artifacts.
  -h, --help                    Show this help.
`);
}

function compareVersions(left, right) {
  const leftParts = parseVersion(left);
  const rightParts = parseVersion(right);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index] ?? 0;
    const rightPart = rightParts[index] ?? 0;
    if (leftPart > rightPart) return 1;
    if (leftPart < rightPart) return -1;
  }
  return 0;
}

function parseVersion(version) {
  return String(version ?? "0.0.0")
    .split(".")
    .map((part) => Number.parseInt(part.replace(/[^0-9].*$/, ""), 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

function dateStamp(isoTimestamp) {
  return String(isoTimestamp).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
