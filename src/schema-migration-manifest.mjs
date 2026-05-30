import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SCHEMA_MIGRATION_MANIFEST_OUT_DIR = "artifacts/schema-migration-manifest/latest";
export const DEFAULT_SCHEMA_MIGRATION_MANIFEST_INPUTS = {
  schemaVersioningRulesPath: "artifacts/schema-versioning-rules/latest/schema-versioning-rules.json",
  contractInventoryPath: "artifacts/contract-inventory/latest/contract-inventory.json",
};

const REQUIRED_MANIFEST_SECTIONS = [
  "migration_id",
  "from_schema_version",
  "to_schema_version",
  "change_type",
  "data_migration_steps",
  "index_migration_steps",
  "dry_run_command",
  "rollback_note",
  "validation_command",
];

const REQUIRED_SCOPES = ["core", "pack", "index"];

export async function runSchemaMigrationManifest(options = {}) {
  const result = await buildSchemaMigrationManifest(options);
  if (options.write !== false) await writeSchemaMigrationManifest(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Schema migration manifest validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSchemaMigrationManifest(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SCHEMA_MIGRATION_MANIFEST_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schemaVersioningRules = await readJson(inputs.schema_versioning_rules_path);
  const contractInventory = await readJson(inputs.contract_inventory_path);
  const migrationManifestSchema = buildMigrationManifestSchema(generatedAt);
  const migrationManifests = buildMigrationManifests({
    schemaVersioningRules,
    contractInventory,
    generatedAt,
  });
  const migrationRecords = buildMigrationRecords(migrationManifests, generatedAt);
  const validationItems = buildValidationItems({
    schemaVersioningRules,
    contractInventory,
    migrationManifestSchema,
    migrationManifests,
    migrationRecords,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "schema-migration-manifest-ledger.v1",
    generated_at: generatedAt,
    migration_ledger_id: `schema-migration-manifest.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_versioning_rules: {
      rules_id: schemaVersioningRules.rules_id ?? null,
      guideline_status: schemaVersioningRules.summary?.guideline_status ?? "unknown",
      schema_count: schemaVersioningRules.summary?.schema_count ?? 0,
      legacy_exception_count: schemaVersioningRules.summary?.legacy_exception_count ?? 0,
      content_hash: hashValue({
        rules_id: schemaVersioningRules.rules_id ?? null,
        guideline_status: schemaVersioningRules.summary?.guideline_status ?? "unknown",
        legacy_exception_count: schemaVersioningRules.summary?.legacy_exception_count ?? 0,
      }),
    },
    source_inventory: {
      inventory_id: contractInventory.inventory_id ?? null,
      inventory_status: contractInventory.summary?.inventory_status ?? "unknown",
      schema_count: contractInventory.summary?.schema_count ?? 0,
      artifact_contract_count: contractInventory.summary?.artifact_contract_count ?? 0,
    },
    migration_manifest_schema: migrationManifestSchema,
    migration_manifests: migrationManifests,
    migration_records: migrationRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeMigrationManifest(migrationManifests, migrationRecords, validationItems, validation, schemaVersioningRules),
  };
  return {
    ...result,
    markdown: renderSchemaMigrationManifestMarkdown(result),
  };
}

export async function writeSchemaMigrationManifest(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableManifest(result);
  await writeJson(path.join(outDir, "schema-migration-manifest-ledger.json"), serializable);
  await writeJson(path.join(outDir, "migration-manifest-schema.json"), result.migration_manifest_schema);
  for (const manifest of result.migration_manifests) {
    await writeJson(path.join(outDir, `${manifest.migration_scope}-migration-manifest.json`), manifest);
  }
  await writeJson(path.join(outDir, "migration-records.json"), {
    generated_at: result.generated_at,
    migration_record_count: result.migration_records.length,
    migration_records: result.migration_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    migration_ledger_id: result.migration_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runSchemaMigrationManifestCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runSchemaMigrationManifest(args);
    console.log(`Schema migration manifest written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.migration_manifest_status}`);
    console.log(`Manifests: ${result.summary.manifest_count}`);
    console.log(`Core/Pack/Index: ${result.summary.core_migration_count}/${result.summary.pack_migration_count}/${result.summary.index_migration_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildMigrationManifestSchema(generatedAt) {
  return {
    schema_version: "schema-migration-manifest-schema.v1",
    generated_at: generatedAt,
    required_sections: REQUIRED_MANIFEST_SECTIONS,
    required_scopes: REQUIRED_SCOPES,
    manifest_contract: {
      migration_id: "stable unique id",
      migration_scope: "core | pack | index",
      from_schema_version: "source schema version or legacy family",
      to_schema_version: "target schema version",
      change_type: "optional_addition | deprecation | breaking_bridge | index_rebuild",
      data_migration_steps: "ordered data migration steps, empty only for pure index work",
      index_migration_steps: "ordered index/search/dashboard/API rebuild steps",
      dry_run_command: "command that verifies migration without mutating production state",
      rollback_note: "operator-readable rollback guidance",
      validation_command: "post-migration validation command",
    },
  };
}

function buildMigrationManifests({ schemaVersioningRules, contractInventory, generatedAt }) {
  const legacySchemaIds = (schemaVersioningRules.legacy_exceptions ?? []).map((exception) => exception.schema_id).sort();
  const schemaCount = contractInventory.summary?.schema_count ?? 0;
  const artifactContractCount = contractInventory.summary?.artifact_contract_count ?? 0;
  return [
    migrationManifest({
      generatedAt,
      migrationId: "migration.core.schema_version_legacy_bridge.v1",
      migrationScope: "core",
      fromSchemaVersion: legacySchemaIds.map((schemaId) => `${schemaId}.legacy`),
      toSchemaVersion: "schema-versioned-envelope.v1",
      changeType: "breaking_bridge",
      sourceSchemaIds: legacySchemaIds,
      targetSchemaIds: ["matter-contract-freeze", "personal-dev-slice"],
      dataMigrationSteps: [
        "Add explicit schema_version envelope when legacy matter/dev-project records are promoted into control-plane artifacts.",
        "Preserve original external_id, matter_id, owner, and metadata fields during the bridge.",
        "Record the source legacy schema id in metadata.source_schema_id.",
      ],
      indexMigrationSteps: [
        "Refresh contract inventory after bridged records are written.",
        "Refresh dashboard source and API route projections for bridged artifacts.",
      ],
      dryRunCommand: "npm run contracts:versioning -- --check && npm run contracts:migrations -- --check",
      rollbackNote: "Keep legacy sample schemas read-only and discard generated bridge artifacts; no source legacy file is mutated.",
      validationCommand: "npm run validate && npm test",
      dependencies: ["schema_versioning_rules", "contract_inventory"],
    }),
    migrationManifest({
      generatedAt,
      migrationId: "migration.pack.manifest_compatibility.v1",
      migrationScope: "pack",
      fromSchemaVersion: "domain-pack-registry.v1",
      toSchemaVersion: "domain-pack-manifest.versioned.v1",
      changeType: "optional_addition",
      sourceSchemaIds: ["domain-pack-registry"],
      targetSchemaIds: ["domain-pack-registry"],
      dataMigrationSteps: [
        "Add pack manifest compatibility metadata without changing existing capability ids.",
        "Pin pack compatibility to the core contract version used by the generated capability records.",
      ],
      indexMigrationSteps: [
        "Rebuild domain pack registry projections.",
        "Refresh capability API route filters by pack id and capability id.",
      ],
      dryRunCommand: "npm run packs:validate && npm run contracts:inventory",
      rollbackNote: "Remove generated compatibility metadata from pack projection artifacts; source pack definitions remain unchanged.",
      validationCommand: "npm run validate && npm run api:smoke",
      dependencies: ["domain_pack_registry", "capability_workflow_contract_freeze"],
    }),
    migrationManifest({
      generatedAt,
      migrationId: "migration.index.contract_surface_rebuild.v1",
      migrationScope: "index",
      fromSchemaVersion: `contract-inventory.schemas.${schemaCount}`,
      toSchemaVersion: `contract-inventory.artifacts.${artifactContractCount}`,
      changeType: "index_rebuild",
      sourceSchemaIds: ["contract-inventory", "contract-dependency-map", "review-dashboard"],
      targetSchemaIds: ["contract-inventory", "contract-dependency-map", "review-dashboard"],
      dataMigrationSteps: [
        "Keep source contract artifacts immutable; rebuild derived index artifacts only.",
      ],
      indexMigrationSteps: [
        "Re-run contract inventory to refresh schema, dashboard source, API route, and artifact indexes.",
        "Re-run contract dependency map to refresh breaking-change risk projections.",
        "Re-run dashboard and API smoke tests against the refreshed indexes.",
      ],
      dryRunCommand: "npm run contracts:inventory && npm run contracts:dependencies -- --check",
      rollbackNote: "Restore previous generated inventory/dependency artifacts or rerun the prior committed tool version.",
      validationCommand: "npm run dashboard:build && npm run api:smoke",
      dependencies: ["contract_inventory", "contract_dependency_map", "review_dashboard"],
    }),
  ];
}

function migrationManifest({
  generatedAt,
  migrationId,
  migrationScope,
  fromSchemaVersion,
  toSchemaVersion,
  changeType,
  sourceSchemaIds,
  targetSchemaIds,
  dataMigrationSteps,
  indexMigrationSteps,
  dryRunCommand,
  rollbackNote,
  validationCommand,
  dependencies,
}) {
  return {
    schema_version: "schema-migration-manifest.v1",
    generated_at: generatedAt,
    migration_id: migrationId,
    migration_scope: migrationScope,
    manifest_status: "declared",
    from_schema_version: fromSchemaVersion,
    to_schema_version: toSchemaVersion,
    change_type: changeType,
    source_schema_ids: sourceSchemaIds,
    target_schema_ids: targetSchemaIds,
    data_migration_steps: dataMigrationSteps,
    index_migration_steps: indexMigrationSteps,
    dry_run_command: dryRunCommand,
    rollback_note: rollbackNote,
    validation_command: validationCommand,
    dependencies,
    data_and_index_separated: true,
    manifest_hash: hashValue({
      migrationId,
      migrationScope,
      fromSchemaVersion,
      toSchemaVersion,
      changeType,
      dataMigrationSteps,
      indexMigrationSteps,
    }),
  };
}

function buildMigrationRecords(migrationManifests, generatedAt) {
  return migrationManifests.map((manifest) => ({
    schema_version: "schema-migration-record.v1",
    migration_record_id: `migration-record.${manifest.migration_id}`,
    migration_id: manifest.migration_id,
    migration_scope: manifest.migration_scope,
    migration_status: "planned",
    dry_run_status: "not_run",
    validation_status: "declared",
    data_migration_step_count: manifest.data_migration_steps.length,
    index_migration_step_count: manifest.index_migration_steps.length,
    rollback_available: Boolean(manifest.rollback_note),
    source_schema_ids: manifest.source_schema_ids,
    target_schema_ids: manifest.target_schema_ids,
    created_at: generatedAt,
    updated_at: generatedAt,
    record_hash: hashValue({
      migration_id: manifest.migration_id,
      migration_scope: manifest.migration_scope,
      migration_status: "planned",
      dry_run_status: "not_run",
      validation_status: "declared",
    }),
  }));
}

function buildValidationItems({ schemaVersioningRules, contractInventory, migrationManifestSchema, migrationManifests, migrationRecords }) {
  const items = [];
  addValidation(items, {
    path: "source.schema_versioning_rules",
    check_id: "schema_versioning_rules_complete",
    passed: schemaVersioningRules.summary?.guideline_status === "complete" && schemaVersioningRules.validation?.valid !== false,
    message: `Schema versioning rule status is ${schemaVersioningRules.summary?.guideline_status ?? "unknown"}.`,
  });
  addValidation(items, {
    path: "source.contract_inventory",
    check_id: "contract_inventory_complete",
    passed: contractInventory.summary?.inventory_status === "complete" && contractInventory.validation?.valid !== false,
    message: `Contract inventory status is ${contractInventory.summary?.inventory_status ?? "unknown"}.`,
  });
  for (const scope of REQUIRED_SCOPES) {
    addValidation(items, {
      path: `migration_manifests.scope.${scope}`,
      check_id: "required_migration_scope_present",
      passed: migrationManifests.some((manifest) => manifest.migration_scope === scope),
      message: `${scope} migration scope is declared.`,
    });
  }
  for (const section of REQUIRED_MANIFEST_SECTIONS) {
    addValidation(items, {
      path: `migration_manifest_schema.required_sections.${section}`,
      check_id: "required_manifest_section_declared",
      passed: migrationManifestSchema.required_sections.includes(section),
      message: `${section} is declared as a required migration manifest section.`,
    });
  }
  const recordByMigrationId = new Map(migrationRecords.map((record) => [record.migration_id, record]));
  for (const manifest of migrationManifests) {
    for (const section of REQUIRED_MANIFEST_SECTIONS) {
      addValidation(items, {
        path: `migration_manifests.${manifest.migration_id}.${section}`,
        check_id: "manifest_required_section_present",
        passed: sectionPresent(manifest, section),
        message: `${manifest.migration_id} ${section} is ${sectionPresent(manifest, section) ? "present" : "missing"}.`,
      });
    }
    addValidation(items, {
      path: `migration_manifests.${manifest.migration_id}.data_and_index_separated`,
      check_id: "data_and_index_migration_separated",
      passed: manifest.data_and_index_separated === true && Array.isArray(manifest.data_migration_steps) && Array.isArray(manifest.index_migration_steps),
      message: `${manifest.migration_id} separates data migration steps from index migration steps.`,
    });
    addValidation(items, {
      path: `migration_records.${manifest.migration_id}`,
      check_id: "migration_record_declared",
      passed: Boolean(recordByMigrationId.get(manifest.migration_id)),
      message: `${manifest.migration_id} has a migration record.`,
    });
  }
  const legacySchemaIds = new Set((schemaVersioningRules.legacy_exceptions ?? []).map((exception) => exception.schema_id));
  const coreManifest = migrationManifests.find((manifest) => manifest.migration_scope === "core");
  for (const schemaId of legacySchemaIds) {
    addValidation(items, {
      path: `legacy_exceptions.${schemaId}.core_migration_coverage`,
      check_id: "legacy_exception_covered_by_core_migration",
      passed: coreManifest?.source_schema_ids?.includes(schemaId) === true,
      message: `${schemaId} legacy exception is ${coreManifest?.source_schema_ids?.includes(schemaId) ? "covered" : "not covered"} by core migration manifest.`,
    });
  }
  for (const record of migrationRecords) {
    addValidation(items, {
      path: `migration_records.${record.migration_record_id}.rollback_available`,
      check_id: "migration_record_has_rollback",
      passed: record.rollback_available === true,
      message: `${record.migration_record_id} rollback availability is ${record.rollback_available}.`,
    });
    addValidation(items, {
      path: `migration_records.${record.migration_record_id}.dry_run_status`,
      check_id: "migration_record_has_dry_run_status",
      passed: record.dry_run_status === "not_run",
      message: `${record.migration_record_id} dry run status is ${record.dry_run_status}.`,
    });
  }
  return items;
}

function sectionPresent(manifest, section) {
  const value = manifest[section];
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== "";
}

function summarizeMigrationManifest(migrationManifests, migrationRecords, validationItems, validation, schemaVersioningRules) {
  const legacySchemaIds = new Set((schemaVersioningRules.legacy_exceptions ?? []).map((exception) => exception.schema_id));
  const coreManifest = migrationManifests.find((manifest) => manifest.migration_scope === "core");
  const coveredLegacyCount = [...legacySchemaIds].filter((schemaId) => coreManifest?.source_schema_ids?.includes(schemaId)).length;
  const failedValidationItems = validationItems.filter((item) => item.status === "failed");
  return {
    migration_manifest_status: validation.valid ? "complete" : "blocked",
    source_guideline_status: schemaVersioningRules.summary?.guideline_status ?? "unknown",
    manifest_count: migrationManifests.length,
    migration_record_count: migrationRecords.length,
    declared_manifest_count: migrationManifests.filter((manifest) => manifest.manifest_status === "declared").length,
    planned_record_count: migrationRecords.filter((record) => record.migration_status === "planned").length,
    not_run_dry_run_record_count: migrationRecords.filter((record) => record.dry_run_status === "not_run").length,
    core_migration_count: migrationManifests.filter((manifest) => manifest.migration_scope === "core").length,
    pack_migration_count: migrationManifests.filter((manifest) => manifest.migration_scope === "pack").length,
    index_migration_count: migrationManifests.filter((manifest) => manifest.migration_scope === "index").length,
    data_migration_step_count: migrationManifests.reduce((sum, manifest) => sum + manifest.data_migration_steps.length, 0),
    index_migration_step_count: migrationManifests.reduce((sum, manifest) => sum + manifest.index_migration_steps.length, 0),
    dry_run_command_count: migrationManifests.filter((manifest) => manifest.dry_run_command).length,
    rollback_note_count: migrationManifests.filter((manifest) => manifest.rollback_note).length,
    validation_command_count: migrationManifests.filter((manifest) => manifest.validation_command).length,
    separated_data_index_count: migrationManifests.filter((manifest) => manifest.data_and_index_separated).length,
    legacy_exception_count: legacySchemaIds.size,
    legacy_exception_covered_count: coveredLegacyCount,
    missing_legacy_exception_count: Math.max(0, legacySchemaIds.size - coveredLegacyCount),
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItems.length,
    validation_error_count: validation.errors.length,
    by_scope: countBy(migrationManifests, "migration_scope"),
    by_change_type: countBy(migrationManifests, "change_type"),
    by_record_status: countBy(migrationRecords, "migration_status"),
    by_dry_run_status: countBy(migrationRecords, "dry_run_status"),
  };
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message }) {
  items.push({
    validation_item_id: `schema-migration.${slugify(itemPath)}.${checkId}`,
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function renderSchemaMigrationManifestMarkdown(result) {
  const lines = [];
  lines.push("# Schema Migration Manifest");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.migration_manifest_status}`);
  lines.push("");
  lines.push(`- Manifests: ${result.summary.manifest_count}`);
  lines.push(`- Core migrations: ${result.summary.core_migration_count}`);
  lines.push(`- Pack migrations: ${result.summary.pack_migration_count}`);
  lines.push(`- Index migrations: ${result.summary.index_migration_count}`);
  lines.push(`- Data migration steps: ${result.summary.data_migration_step_count}`);
  lines.push(`- Index migration steps: ${result.summary.index_migration_step_count}`);
  lines.push(`- Legacy exceptions covered: ${result.summary.legacy_exception_covered_count}/${result.summary.legacy_exception_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Manifests");
  for (const manifest of result.migration_manifests) {
    lines.push(`- ${manifest.migration_id}: ${manifest.migration_scope} / ${manifest.change_type}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    schema_versioning_rules_path: path.resolve(options.schemaVersioningRulesPath ?? DEFAULT_SCHEMA_MIGRATION_MANIFEST_INPUTS.schemaVersioningRulesPath),
    contract_inventory_path: path.resolve(options.contractInventoryPath ?? DEFAULT_SCHEMA_MIGRATION_MANIFEST_INPUTS.contractInventoryPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--schema-versioning-rules") parsed.schemaVersioningRulesPath = argv[++index];
    else if (arg === "--contract-inventory") parsed.contractInventoryPath = argv[++index];
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
  console.log(`Usage: node scripts/schema-migration-manifest.mjs [options]

Options:
  --schema-versioning-rules <path>  schema-versioning-rules.json path
  --contract-inventory <path>       contract-inventory.json path
  --out-dir <path>                  Output directory
  --run-at <iso>                    Fixed generation timestamp
  --check                           Exit non-zero when validation fails
  -h, --help                        Show this help
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableManifest(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function hashValue(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
