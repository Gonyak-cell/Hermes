import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_SCHEMA_VERSIONING_RULES_OUT_DIR = "artifacts/schema-versioning-rules/latest";
export const DEFAULT_SCHEMA_VERSIONING_RULES_INPUTS = {
  contractInventoryPath: "artifacts/contract-inventory/latest/contract-inventory.json",
  schemaDir: "schemas",
};

const LEGACY_SCHEMA_EXCEPTIONS = [
  {
    legacy_exception_id: "legacy-schema.dev-projects",
    schema_id: "dev-projects",
    exception_status: "allowed",
    reason: "Pre-control-plane demo data schema that predates schema_version envelopes.",
    containment: "Read-only example contract; no new control-plane artifact may copy this pattern.",
    migration_target: "Add schema_version during the P110-P112 migration/golden-fixture pass.",
  },
  {
    legacy_exception_id: "legacy-schema.matter",
    schema_id: "matter",
    exception_status: "allowed",
    reason: "Original matter sample schema retained for backward-compatible demo validation.",
    containment: "Matter v2 contracts are already frozen separately; this legacy schema remains sample-only.",
    migration_target: "Bridge to Matter/Client/Party v2 contract fixtures during the P110-P112 migration/golden-fixture pass.",
  },
];

const VERSION_PATTERN = /^.+\.v\d+$/;

export async function runSchemaVersioningRules(options = {}) {
  const result = await buildSchemaVersioningRules(options);
  if (options.write !== false) await writeSchemaVersioningRules(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Schema versioning rules validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSchemaVersioningRules(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SCHEMA_VERSIONING_RULES_OUT_DIR);
  const inputs = normalizeInputs(options);
  const contractInventory = await readJson(inputs.contract_inventory_path);
  const rulebook = buildRulebook(generatedAt);
  const schemaVersions = await buildSchemaVersionRecords(contractInventory, rulebook);
  const validationItems = buildValidationItems(contractInventory, rulebook, schemaVersions);
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "schema-versioning-rules.v1",
    generated_at: generatedAt,
    rules_id: `schema-versioning-rules.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_inventory: {
      inventory_id: contractInventory.inventory_id ?? null,
      inventory_status: contractInventory.summary?.inventory_status ?? "unknown",
      schema_count: contractInventory.summary?.schema_count ?? contractInventory.schemas?.length ?? 0,
      parsed_schema_count: contractInventory.summary?.parsed_schema_count ?? 0,
      content_hash: hashValue({
        inventory_id: contractInventory.inventory_id ?? null,
        schema_count: contractInventory.summary?.schema_count ?? contractInventory.schemas?.length ?? 0,
        parsed_schema_count: contractInventory.summary?.parsed_schema_count ?? 0,
      }),
    },
    rulebook,
    schema_versions: schemaVersions,
    legacy_exceptions: LEGACY_SCHEMA_EXCEPTIONS,
    migration_contract: buildMigrationContract(generatedAt),
    validation_items: validationItems,
    validation,
    summary: summarizeSchemaVersioning(schemaVersions, validationItems, validation, contractInventory),
  };
  return {
    ...result,
    markdown: renderSchemaVersioningRulesMarkdown(result),
  };
}

export async function writeSchemaVersioningRules(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableRules(result);
  await writeJson(path.join(outDir, "schema-versioning-rules.json"), serializable);
  await writeJson(path.join(outDir, "schema-versioning-guideline.json"), {
    generated_at: result.generated_at,
    rules_id: result.rules_id,
    rulebook: result.rulebook,
    migration_contract: result.migration_contract,
  });
  await writeJson(path.join(outDir, "schema-version-records.json"), {
    generated_at: result.generated_at,
    schema_count: result.schema_versions.length,
    schema_versions: result.schema_versions,
  });
  await writeJson(path.join(outDir, "legacy-schema-exceptions.json"), {
    generated_at: result.generated_at,
    legacy_exception_count: result.legacy_exceptions.length,
    legacy_exceptions: result.legacy_exceptions,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    rules_id: result.rules_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runSchemaVersioningRulesCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runSchemaVersioningRules(args);
    console.log(`Schema versioning rules written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.guideline_status}`);
    console.log(`Schemas: ${result.summary.schema_count}`);
    console.log(`Versioned schemas: ${result.summary.versioned_schema_count}`);
    console.log(`Legacy exceptions: ${result.summary.legacy_exception_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRulebook(generatedAt) {
  return {
    schema_version: "schema-versioning-guideline.v1",
    policy_id: "hermes.schema-versioning.v1",
    generated_at: generatedAt,
    compatibility_mode: "additive_minor_breaking_major",
    version_const_pattern: "*.vN",
    required_rules: [
      rule("schema_version_const_required", "Every non-legacy schema declares a top-level schema_version const."),
      rule("schema_version_required_field", "Every non-legacy artifact envelope requires schema_version."),
      rule("optional_addition_default", "New fields are optional by default and existing field meaning is not changed in-place."),
      rule("deprecation_before_removal", "Fields are deprecated before removal and retain reader compatibility during the deprecation window."),
      rule("migration_manifest_required", "Breaking schema changes require a separate migration manifest and cannot be hidden in runtime code."),
      rule("unknown_fields_preserved", "Adapters and migrations preserve unknown metadata fields instead of dropping them."),
      rule("version_pin_supported", "Workflow, capability, output, and run ledgers can pin the schema version used at execution time."),
    ],
    optional_addition_policy: {
      policy_id: "optional_addition_default",
      default_new_field_required: false,
      required_field_addition_allowed_without_major_version: false,
      additional_properties_false_allowed: false,
      forward_compatible_metadata_required: true,
    },
    deprecation_policy: {
      policy_id: "deprecation_before_removal",
      deprecation_marker: "deprecated",
      replacement_marker: "replaced_by",
      removal_marker: "removed_at",
      minimum_state_order: ["active", "deprecated", "removed"],
    },
    migration_policy: {
      policy_id: "migration_manifest_required",
      manifest_required_for: ["required_field_addition", "field_removal", "field_type_narrowing", "semantic_change", "index_rebuild"],
      data_migration_and_index_migration_separated: true,
      migration_records_required: true,
      dry_run_required: true,
      rollback_note_required: true,
    },
  };
}

function rule(ruleId, description) {
  return {
    rule_id: ruleId,
    status: "active",
    description,
  };
}

async function buildSchemaVersionRecords(contractInventory, rulebook) {
  const legacyBySchemaId = new Map(LEGACY_SCHEMA_EXCEPTIONS.map((item) => [item.schema_id, item]));
  const records = [];
  for (const schemaRecord of contractInventory.schemas ?? []) {
    const schema = await readJsonOrNull(schemaRecord.path);
    const required = Array.isArray(schema?.required) ? schema.required : [];
    const properties = schema?.properties ?? {};
    const propertyNames = Object.keys(properties);
    const schemaVersionConst = properties.schema_version?.const ?? schemaRecord.schema_version_const ?? null;
    const versionMatch = String(schemaVersionConst ?? "").match(/\.v(\d+)$/);
    const legacyException = legacyBySchemaId.get(schemaRecord.schema_id);
    const deprecatedFields = collectDeprecatedFields(schema);
    const additionalPropertiesPolicy = schema?.additionalProperties === false ? "closed_world" : "open_or_unspecified";
    const versionStatus = schemaVersionConst && required.includes("schema_version") && VERSION_PATTERN.test(schemaVersionConst)
      ? "versioned"
      : legacyException
        ? "legacy_exception"
        : "non_compliant";
    records.push({
      schema_version_record_id: `schema-version.${schemaRecord.schema_id}`,
      schema_id: schemaRecord.schema_id,
      schema_path: schemaRecord.path,
      owner_area: schemaRecord.owner_area ?? "unknown",
      schema_version_const: schemaVersionConst,
      version_family: schemaVersionConst ? schemaVersionConst.replace(/\.v\d+$/, "") : schemaRecord.schema_id,
      major_version: versionMatch ? Number(versionMatch[1]) : null,
      version_status: versionStatus,
      legacy_exception_id: legacyException?.legacy_exception_id ?? null,
      parse_status: schemaRecord.parse_status,
      schema_version_required: required.includes("schema_version"),
      required_field_count: required.length,
      top_level_property_count: propertyNames.length,
      optional_field_count: Math.max(0, propertyNames.length - required.length),
      additional_properties_policy: additionalPropertiesPolicy,
      optional_addition_policy: rulebook.optional_addition_policy.policy_id,
      deprecation_policy: rulebook.deprecation_policy.policy_id,
      migration_policy: rulebook.migration_policy.policy_id,
      deprecated_field_count: deprecatedFields.length,
      deprecated_fields: deprecatedFields,
      migration_required_on_breaking_change: true,
      unknown_fields_preserved: additionalPropertiesPolicy !== "closed_world",
      content_hash: schemaRecord.content_hash ?? null,
    });
  }
  return records.sort((left, right) => left.schema_id.localeCompare(right.schema_id));
}

function buildMigrationContract(generatedAt) {
  return {
    schema_version: "schema-migration-rule.v1",
    migration_policy_id: "migration_manifest_required",
    generated_at: generatedAt,
    migration_manifest_status: "declared_for_p110",
    required_manifest_sections: [
      "migration_id",
      "from_schema_version",
      "to_schema_version",
      "change_type",
      "data_migration_steps",
      "index_migration_steps",
      "dry_run_command",
      "rollback_note",
      "validation_command",
    ],
    forward_compatibility_rules: [
      "New fields must be optional until the next major schema.",
      "Deprecated fields remain readable during the deprecation window.",
      "Unknown metadata fields are preserved by adapters.",
      "Workflow and output artifacts record the schema version used to create them.",
    ],
  };
}

function buildValidationItems(contractInventory, rulebook, schemaVersions) {
  const items = [];
  addValidation(items, {
    path: "source_inventory",
    check_id: "contract_inventory_complete",
    passed: contractInventory.summary?.inventory_status === "complete" && contractInventory.validation?.valid !== false,
    message: `Contract inventory status is ${contractInventory.summary?.inventory_status ?? "unknown"}.`,
  });
  for (const ruleId of ["schema_version_const_required", "optional_addition_default", "deprecation_before_removal", "migration_manifest_required"]) {
    addValidation(items, {
      path: `rulebook.required_rules.${ruleId}`,
      check_id: "schema_versioning_rule_declared",
      passed: rulebook.required_rules.some((ruleItem) => ruleItem.rule_id === ruleId && ruleItem.status === "active"),
      message: `${ruleId} is declared in the schema versioning guideline.`,
    });
  }
  addValidation(items, {
    path: "rulebook.migration_policy",
    check_id: "migration_policy_separates_data_and_index",
    passed: rulebook.migration_policy.data_migration_and_index_migration_separated === true,
    message: "Migration policy separates data migration and index migration.",
  });
  for (const record of schemaVersions) {
    const legacyAllowed = record.version_status === "legacy_exception";
    addValidation(items, {
      path: `schema_versions.${record.schema_id}.schema_version_const`,
      check_id: "schema_version_const_present_or_legacy",
      passed: Boolean(record.schema_version_const) || legacyAllowed,
      message: record.schema_version_const ? `${record.schema_id} declares ${record.schema_version_const}.` : `${record.schema_id} is covered by ${record.legacy_exception_id ?? "no exception"}.`,
    });
    addValidation(items, {
      path: `schema_versions.${record.schema_id}.schema_version_required`,
      check_id: "schema_version_required_or_legacy",
      passed: record.schema_version_required || legacyAllowed,
      message: `${record.schema_id} schema_version required field is ${record.schema_version_required ? "present" : "absent"}.`,
    });
    addValidation(items, {
      path: `schema_versions.${record.schema_id}.version_pattern`,
      check_id: "schema_version_pattern_or_legacy",
      passed: record.version_status === "versioned" || legacyAllowed,
      message: `${record.schema_id} version status is ${record.version_status}.`,
    });
    addValidation(items, {
      path: `schema_versions.${record.schema_id}.optional_addition_policy`,
      check_id: "optional_addition_forward_compatible",
      passed: record.additional_properties_policy !== "closed_world",
      message: `${record.schema_id} additional properties policy is ${record.additional_properties_policy}.`,
    });
    addValidation(items, {
      path: `schema_versions.${record.schema_id}.migration_policy`,
      check_id: "breaking_change_requires_migration_manifest",
      passed: record.migration_required_on_breaking_change === true,
      message: `${record.schema_id} requires migration manifest on breaking changes.`,
    });
    for (const deprecatedField of record.deprecated_fields) {
      addValidation(items, {
        path: `schema_versions.${record.schema_id}.deprecated_fields.${deprecatedField.field_path}`,
        check_id: "deprecated_field_has_metadata",
        passed: Boolean(deprecatedField.description || deprecatedField.replaced_by || deprecatedField.removed_at),
        message: `${deprecatedField.field_path} has deprecation metadata.`,
      });
    }
  }
  for (const exception of LEGACY_SCHEMA_EXCEPTIONS) {
    addValidation(items, {
      path: `legacy_exceptions.${exception.schema_id}`,
      check_id: "legacy_exception_has_migration_target",
      passed: Boolean(exception.reason && exception.containment && exception.migration_target),
      message: `${exception.schema_id} legacy exception is documented with containment and migration target.`,
    });
  }
  return items;
}

function summarizeSchemaVersioning(schemaVersions, validationItems, validation, contractInventory) {
  const failedValidationItems = validationItems.filter((item) => item.status === "failed");
  return {
    guideline_status: validation.valid ? "complete" : "blocked",
    source_inventory_id: contractInventory.inventory_id ?? null,
    source_inventory_status: contractInventory.summary?.inventory_status ?? "unknown",
    schema_count: schemaVersions.length,
    parsed_schema_count: schemaVersions.filter((record) => record.parse_status === "parsed").length,
    versioned_schema_count: schemaVersions.filter((record) => record.version_status === "versioned").length,
    legacy_exception_count: schemaVersions.filter((record) => record.version_status === "legacy_exception").length,
    non_compliant_schema_count: schemaVersions.filter((record) => record.version_status === "non_compliant").length,
    optional_addition_compatible_count: schemaVersions.filter((record) => record.additional_properties_policy !== "closed_world").length,
    closed_world_schema_count: schemaVersions.filter((record) => record.additional_properties_policy === "closed_world").length,
    deprecated_field_count: schemaVersions.reduce((sum, record) => sum + record.deprecated_field_count, 0),
    migration_manifest_rule_count: 1,
    deprecation_rule_count: 1,
    optional_addition_rule_count: 1,
    unknown_field_preservation_count: schemaVersions.filter((record) => record.unknown_fields_preserved).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: failedValidationItems.length,
    validation_error_count: validation.errors.length,
    by_version_status: countBy(schemaVersions, "version_status"),
    by_owner_area: countBy(schemaVersions, "owner_area"),
  };
}

function collectDeprecatedFields(schema) {
  const deprecatedFields = [];
  walk(schema, [], (node, nodePath) => {
    if (!node || typeof node !== "object" || node.deprecated !== true) return;
    deprecatedFields.push({
      field_path: nodePath.join(".") || "$",
      description: node.description ?? null,
      replaced_by: node.replaced_by ?? null,
      removed_at: node.removed_at ?? null,
    });
  });
  return deprecatedFields;
}

function walk(node, nodePath, visitor) {
  visitor(node, nodePath);
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === "object") walk(value, [...nodePath, key], visitor);
  }
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message }) {
  items.push({
    validation_item_id: `schema-versioning.${slugify(itemPath)}.${checkId}`,
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

function renderSchemaVersioningRulesMarkdown(result) {
  const lines = [];
  lines.push("# Schema Versioning Rules");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.guideline_status}`);
  lines.push("");
  lines.push(`- Schemas: ${result.summary.schema_count}`);
  lines.push(`- Versioned schemas: ${result.summary.versioned_schema_count}`);
  lines.push(`- Legacy exceptions: ${result.summary.legacy_exception_count}`);
  lines.push(`- Non-compliant schemas: ${result.summary.non_compliant_schema_count}`);
  lines.push(`- Optional-addition compatible schemas: ${result.summary.optional_addition_compatible_count}`);
  lines.push(`- Closed-world schemas: ${result.summary.closed_world_schema_count}`);
  lines.push(`- Deprecated fields: ${result.summary.deprecated_field_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Rules");
  for (const ruleItem of result.rulebook.required_rules) {
    lines.push(`- ${ruleItem.rule_id}: ${ruleItem.description}`);
  }
  lines.push("");
  lines.push("## Legacy Exceptions");
  for (const exception of result.legacy_exceptions) {
    lines.push(`- ${exception.schema_id}: ${exception.reason}`);
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
    contract_inventory_path: path.resolve(options.contractInventoryPath ?? DEFAULT_SCHEMA_VERSIONING_RULES_INPUTS.contractInventoryPath),
    schema_dir: path.resolve(options.schemaDir ?? DEFAULT_SCHEMA_VERSIONING_RULES_INPUTS.schemaDir),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--contract-inventory") parsed.contractInventoryPath = argv[++index];
    else if (arg === "--schema-dir") parsed.schemaDir = argv[++index];
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
  console.log(`Usage: node scripts/schema-versioning-rules.mjs [options]

Options:
  --contract-inventory <path>  Contract inventory JSON path
  --schema-dir <path>          Schema directory used for local parsing
  --out-dir <path>             Output directory
  --run-at <iso>               Fixed generation timestamp
  --check                      Exit non-zero when validation fails
  -h, --help                   Show this help
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readJsonOrNull(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableRules(result) {
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
