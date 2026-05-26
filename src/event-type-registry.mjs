import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVENT_TYPE_REGISTRY_OUT_DIR = "artifacts/event-type-registry/latest";
export const DEFAULT_EVENT_TYPE_REGISTRY_INPUTS = {
  eventEnvelopeLedgerPath: "artifacts/event-envelope-ledger/latest/event-envelope-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVENT_TYPE_REGISTRY_SCHEMA_VERSION = "event-type-registry.v1";
const EVENT_TYPE_RECORD_SCHEMA_VERSION = "event-type-record.v1";
const EVENT_FAMILY_RECORD_SCHEMA_VERSION = "event-family-record.v1";
const EVENT_TYPE_BINDING_SCHEMA_VERSION = "event-type-binding.v1";
const EVENT_TYPE_REGISTRY_CONTRACT_SCHEMA_VERSION = "event-type-registry-contract.v1";
const EVENT_TYPE_REGISTRY_CONTRACT_ID = "event-type-registry.v1";
const REQUIRED_EVENT_FAMILIES = ["resource", "workflow", "agent", "gate", "approval", "output"];
const REQUIRED_FAMILY_SET = new Set(REQUIRED_EVENT_FAMILIES);

export async function runEventTypeRegistry(options = {}) {
  const result = await buildEventTypeRegistry(options);
  if (options.write !== false) await writeEventTypeRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Event type registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEventTypeRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVENT_TYPE_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const eventEnvelopeLedger = await readJson(inputs.event_envelope_ledger_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const catalog = buildEventTypeCatalog(eventEnvelopeLedger, generatedAt);
  const validationItems = validateEventTypeRegistry({
    eventEnvelopeLedger,
    packageJson,
    roadmapText,
    ...catalog,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: EVENT_TYPE_REGISTRY_SCHEMA_VERSION,
    generated_at: generatedAt,
    event_type_registry_id: `event-type-registry.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      event_envelope_ledger: {
        schema_version: eventEnvelopeLedger.schema_version ?? null,
        event_envelope_ledger_id: eventEnvelopeLedger.event_envelope_ledger_id ?? null,
        event_envelope_status: eventEnvelopeLedger.summary?.event_envelope_status ?? "unknown",
        event_envelope_count: eventEnvelopeLedger.summary?.event_envelope_count ?? 0,
        source_binding_count: eventEnvelopeLedger.summary?.source_binding_count ?? 0,
        validation_error_count: eventEnvelopeLedger.summary?.validation_error_count ?? eventEnvelopeLedger.validation?.errors?.length ?? 0,
      },
    },
    event_type_registry_contract: buildEventTypeRegistryContract(generatedAt),
    event_type_catalog: {
      schema_version: "event-type-catalog.v1",
      generated_at: generatedAt,
      event_type_records: catalog.eventTypeRecords,
      event_family_records: catalog.eventFamilyRecords,
      event_type_bindings: catalog.eventTypeBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeEventTypeRegistry({
      eventEnvelopeLedger,
      eventTypeRecords: catalog.eventTypeRecords,
      eventFamilyRecords: catalog.eventFamilyRecords,
      eventTypeBindings: catalog.eventTypeBindings,
      validationItems,
      validation,
    }),
  };
  return {
    ...result,
    markdown: renderEventTypeRegistryMarkdown(result),
  };
}

export async function writeEventTypeRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "event-type-registry.json"), serializableEventTypeRegistry(result));
  await writeJson(path.join(outDir, "event-type-records.json"), {
    schema_version: "event-type-records.v1",
    generated_at: result.generated_at,
    event_type_count: result.event_type_catalog.event_type_records.length,
    event_type_records: result.event_type_catalog.event_type_records,
  });
  await writeJson(path.join(outDir, "event-family-records.json"), {
    schema_version: "event-family-records.v1",
    generated_at: result.generated_at,
    event_family_count: result.event_type_catalog.event_family_records.length,
    event_family_records: result.event_type_catalog.event_family_records,
  });
  await writeJson(path.join(outDir, "event-type-bindings.json"), {
    schema_version: "event-type-bindings.v1",
    generated_at: result.generated_at,
    event_type_binding_count: result.event_type_catalog.event_type_bindings.length,
    event_type_bindings: result.event_type_catalog.event_type_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "event-type-registry-validation-report.v1",
    generated_at: result.generated_at,
    event_type_registry_id: result.event_type_registry_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEventTypeRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEventTypeRegistry(args);
    console.log(`Event type registry written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.event_type_registry_status}`);
    console.log(`Event types: ${result.summary.event_type_count}`);
    console.log(`Required families covered: ${result.summary.covered_required_family_count}/${result.summary.required_family_count}`);
    console.log(`Bindings: ${result.summary.bound_event_type_binding_count}/${result.summary.event_type_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildEventTypeRegistryContract(generatedAt) {
  return {
    schema_version: EVENT_TYPE_REGISTRY_CONTRACT_SCHEMA_VERSION,
    generated_at: generatedAt,
    event_type_registry_contract_id: EVENT_TYPE_REGISTRY_CONTRACT_ID,
    required_event_families: REQUIRED_EVENT_FAMILIES,
    required_binding_fields: [
      "event_type",
      "event_family",
      "event_envelope_id",
      "source_kind",
      "schema_version_binding_status",
      "dataschema_binding_status",
    ],
    notes: [
      "The registry catalogs envelope type semantics; EventRecord, AuditEvent, and envelope ledgers remain authoritative.",
      "New event families can be added without changing core if every source envelope is still bound and classified.",
    ],
  };
}

function buildEventTypeCatalog(eventEnvelopeLedger, generatedAt) {
  const eventEnvelopes = eventEnvelopeLedger.event_envelope_catalog?.event_envelopes ?? [];
  const recordsByType = new Map();
  const eventTypeBindings = eventEnvelopes.map((envelope) => buildEventTypeBinding(envelope, generatedAt));
  for (const binding of eventTypeBindings) {
    const existing = recordsByType.get(binding.event_type) ?? createEventTypeRecord(binding, generatedAt);
    existing.event_count += 1;
    existing.event_envelope_ids.push(binding.event_envelope_id);
    existing.source_kinds = sortedUnique([...existing.source_kinds, binding.source_kind]);
    existing.actor_types = sortedUnique([...existing.actor_types, binding.actor_type].filter(Boolean));
    existing.tenant_ids = sortedUnique([...existing.tenant_ids, binding.tenant_id].filter(Boolean));
    existing.matter_ids = sortedUnique([...existing.matter_ids, binding.matter_id].filter(Boolean));
    existing.policy_snapshot_ids = sortedUnique([...existing.policy_snapshot_ids, binding.policy_snapshot_id].filter(Boolean));
    existing.data_schema_refs = sortedUnique([...existing.data_schema_refs, binding.dataschema].filter(Boolean));
    existing.schema_versions = sortedUnique([...existing.schema_versions, binding.source_schema_version].filter(Boolean));
    existing.first_seen_at = minIso(existing.first_seen_at, binding.event_time);
    existing.last_seen_at = maxIso(existing.last_seen_at, binding.event_time);
    recordsByType.set(binding.event_type, existing);
  }
  const eventTypeRecords = [...recordsByType.values()].sort((left, right) => left.event_type.localeCompare(right.event_type));
  const eventFamilyRecords = buildEventFamilyRecords(eventTypeRecords, generatedAt);
  return { eventTypeRecords, eventFamilyRecords, eventTypeBindings };
}

function buildEventTypeBinding(envelope, generatedAt) {
  const eventType = envelope.type ?? "unknown";
  const eventFamily = classifyEventFamily(eventType);
  const eventCategory = eventType.split(".")[0] || "unknown";
  const eventTypeId = `event-type.${slugify(eventType)}`;
  return {
    schema_version: EVENT_TYPE_BINDING_SCHEMA_VERSION,
    event_type_binding_id: `event-type-binding.${slugify(envelope.id)}`,
    event_type_id: eventTypeId,
    event_type: eventType,
    event_envelope_id: envelope.id,
    event_family: eventFamily,
    event_category: eventCategory,
    source_kind: envelope.sourcekind ?? envelope.envelope_kind ?? "unknown",
    source_event_id: envelope.sourceid ?? null,
    actor_type: envelope.actortype ?? null,
    tenant_id: envelope.tenantid ?? null,
    matter_id: envelope.matterid ?? null,
    workflow_run_id: envelope.workflowrunid ?? null,
    policy_snapshot_id: envelope.policysnapshotid ?? null,
    source_schema_version: envelope.schemaversion ?? null,
    dataschema: envelope.dataschema ?? null,
    event_time: envelope.time ?? generatedAt,
    binding_status: envelope.id && eventTypeId ? "bound" : "unbound",
    classification_status: eventFamily === "unknown" ? "unclassified" : "classified",
    schema_version_binding_status: envelope.schemaversion ? "bound" : "missing_schema_version",
    dataschema_binding_status: envelope.dataschema ? "bound" : "missing_dataschema",
    required_family: REQUIRED_FAMILY_SET.has(eventFamily),
    recorded_at: generatedAt,
  };
}

function createEventTypeRecord(binding, generatedAt) {
  return {
    schema_version: EVENT_TYPE_RECORD_SCHEMA_VERSION,
    event_type_id: binding.event_type_id,
    event_type: binding.event_type,
    event_family: binding.event_family,
    event_category: binding.event_category,
    required_family: binding.required_family,
    event_count: 0,
    event_envelope_ids: [],
    source_kinds: [],
    actor_types: [],
    tenant_ids: [],
    matter_ids: [],
    policy_snapshot_ids: [],
    data_schema_refs: [],
    schema_versions: [],
    first_seen_at: binding.event_time ?? generatedAt,
    last_seen_at: binding.event_time ?? generatedAt,
    registry_status: "registered",
    classification_status: binding.classification_status,
    schema_version_binding_status: binding.source_schema_version ? "bound" : "missing_schema_version",
    dataschema_binding_status: binding.dataschema ? "bound" : "missing_dataschema",
    recorded_at: generatedAt,
  };
}

function buildEventFamilyRecords(eventTypeRecords, generatedAt) {
  const recordsByFamily = new Map();
  for (const record of eventTypeRecords) {
    const existing = recordsByFamily.get(record.event_family) ?? createEventFamilyRecord(record.event_family, generatedAt);
    existing.event_type_count += 1;
    existing.event_count += record.event_count;
    existing.event_types.push(record.event_type);
    existing.event_type_ids.push(record.event_type_id);
    recordsByFamily.set(record.event_family, existing);
  }
  for (const family of REQUIRED_EVENT_FAMILIES) {
    if (!recordsByFamily.has(family)) recordsByFamily.set(family, createEventFamilyRecord(family, generatedAt));
  }
  return [...recordsByFamily.values()]
    .map((record) => ({
      ...record,
      event_types: sortedUnique(record.event_types),
      event_type_ids: sortedUnique(record.event_type_ids),
      coverage_status: record.required_family
        ? (record.event_type_count > 0 ? "covered" : "missing_required_family")
        : "extra_cataloged",
    }))
    .sort((left, right) => left.event_family.localeCompare(right.event_family));
}

function createEventFamilyRecord(eventFamily, generatedAt) {
  return {
    schema_version: EVENT_FAMILY_RECORD_SCHEMA_VERSION,
    event_family_id: `event-family.${slugify(eventFamily)}`,
    event_family: eventFamily,
    required_family: REQUIRED_FAMILY_SET.has(eventFamily),
    event_type_count: 0,
    event_count: 0,
    event_types: [],
    event_type_ids: [],
    coverage_status: REQUIRED_FAMILY_SET.has(eventFamily) ? "missing_required_family" : "extra_cataloged",
    recorded_at: generatedAt,
  };
}

function classifyEventFamily(eventType) {
  const lower = String(eventType ?? "").toLowerCase();
  const category = lower.split(".")[0] || "unknown";
  if (category === "agent_run" || category === "agent") return "agent";
  if (category === "resource") return "resource";
  if (category === "workflow") return "workflow";
  if (category === "gate") return "gate";
  if (category === "approval" || category === "approval_inbox") return "approval";
  if (category === "output" || category === "delivery") return "output";
  if (category) return category;
  return "unknown";
}

function validateEventTypeRegistry({ eventEnvelopeLedger, packageJson, roadmapText, eventTypeRecords, eventFamilyRecords, eventTypeBindings }) {
  const items = [];
  const sourceEnvelopeCount = eventEnvelopeLedger.summary?.event_envelope_count ?? 0;
  const requiredFamilyRecords = eventFamilyRecords.filter((record) => record.required_family);
  addValidation(items, {
    path: "source.event_envelope_ledger",
    check_id: "source_event_envelope_ledger_complete",
    passed: eventEnvelopeLedger.summary?.event_envelope_status === "complete" && eventEnvelopeLedger.validation?.valid !== false,
    message: eventEnvelopeLedger.summary?.event_envelope_status === "complete"
      ? "Event envelope ledger is complete."
      : "Event envelope ledger must be complete before event type cataloging.",
  });
  addValidation(items, {
    path: "event_type_catalog.event_type_bindings",
    check_id: "event_type_binding_count_matches_envelopes",
    passed: eventTypeBindings.length === sourceEnvelopeCount,
    message: `${eventTypeBindings.length}/${sourceEnvelopeCount} envelope(s) have event type bindings.`,
  });
  addValidation(items, {
    path: "event_type_catalog.event_type_records",
    check_id: "event_type_records_registered",
    passed: eventTypeRecords.length > 0 && eventTypeRecords.every((record) => record.registry_status === "registered"),
    message: `${eventTypeRecords.filter((record) => record.registry_status === "registered").length}/${eventTypeRecords.length} event type record(s) are registered.`,
  });
  addValidation(items, {
    path: "event_type_catalog.event_family_records.required",
    check_id: "required_event_families_covered",
    passed: requiredFamilyRecords.length === REQUIRED_EVENT_FAMILIES.length && requiredFamilyRecords.every((record) => record.coverage_status === "covered"),
    message: `${requiredFamilyRecords.filter((record) => record.coverage_status === "covered").length}/${REQUIRED_EVENT_FAMILIES.length} required event family/families covered.`,
  });
  addValidation(items, {
    path: "event_type_catalog.event_type_bindings.classification_status",
    check_id: "event_type_bindings_classified",
    passed: eventTypeBindings.every((binding) => binding.classification_status === "classified"),
    message: `${eventTypeBindings.filter((binding) => binding.classification_status === "classified").length}/${eventTypeBindings.length} event type binding(s) classified.`,
  });
  addValidation(items, {
    path: "event_type_catalog.event_type_bindings.binding_status",
    check_id: "event_type_bindings_bound",
    passed: eventTypeBindings.every((binding) => binding.binding_status === "bound"),
    message: `${eventTypeBindings.filter((binding) => binding.binding_status === "bound").length}/${eventTypeBindings.length} event type binding(s) bound.`,
  });
  addValidation(items, {
    path: "event_type_catalog.event_type_bindings.source_schema_version",
    check_id: "schema_versions_bound",
    passed: eventTypeBindings.every((binding) => binding.schema_version_binding_status === "bound"),
    message: `${eventTypeBindings.filter((binding) => binding.schema_version_binding_status === "bound").length}/${eventTypeBindings.length} event type binding(s) preserve schema version.`,
  });
  addValidation(items, {
    path: "event_type_catalog.event_type_bindings.dataschema",
    check_id: "dataschemas_bound",
    passed: eventTypeBindings.every((binding) => binding.dataschema_binding_status === "bound"),
    message: `${eventTypeBindings.filter((binding) => binding.dataschema_binding_status === "bound").length}/${eventTypeBindings.length} event type binding(s) preserve dataschema.`,
  });
  addValidation(items, {
    path: "package.scripts.events:types",
    check_id: "package_script_registered",
    passed: Boolean(packageJson.scripts?.["events:types"]),
    message: packageJson.scripts?.["events:types"]
      ? "package.json registers events:types."
      : "package.json must register events:types.",
  });
  addValidation(items, {
    path: "docs.implementation_roadmap.phase_160",
    check_id: "roadmap_phase_160_recorded",
    passed: String(roadmapText).includes("## Phase 160: Event Type Registry") || String(roadmapText).includes("| P160 | event type registry 구현 |"),
    message: "Roadmap must record Phase 160 completion or planned slot.",
  });
  return items;
}

function summarizeEventTypeRegistry({ eventEnvelopeLedger, eventTypeRecords, eventFamilyRecords, eventTypeBindings, validationItems, validation }) {
  const requiredFamilyRecords = eventFamilyRecords.filter((record) => record.required_family);
  const sourceEnvelopeCount = eventEnvelopeLedger.summary?.event_envelope_count ?? 0;
  return {
    event_type_registry_status: validation.valid ? "complete" : "blocked",
    event_type_registry_contract_id: EVENT_TYPE_REGISTRY_CONTRACT_ID,
    source_event_envelope_status: eventEnvelopeLedger.summary?.event_envelope_status ?? "unknown",
    source_event_envelope_count: sourceEnvelopeCount,
    event_type_count: eventTypeRecords.length,
    event_family_count: eventFamilyRecords.length,
    event_type_binding_count: eventTypeBindings.length,
    bound_event_type_binding_count: eventTypeBindings.filter((binding) => binding.binding_status === "bound").length,
    unbound_event_type_binding_count: eventTypeBindings.filter((binding) => binding.binding_status !== "bound").length,
    required_family_count: REQUIRED_EVENT_FAMILIES.length,
    covered_required_family_count: requiredFamilyRecords.filter((record) => record.coverage_status === "covered").length,
    missing_required_family_count: requiredFamilyRecords.filter((record) => record.coverage_status === "missing_required_family").length,
    extra_event_family_count: eventFamilyRecords.filter((record) => !record.required_family).length,
    unclassified_event_type_count: eventTypeRecords.filter((record) => record.classification_status !== "classified").length,
    unclassified_event_type_binding_count: eventTypeBindings.filter((binding) => binding.classification_status !== "classified").length,
    registered_event_type_count: eventTypeRecords.filter((record) => record.registry_status === "registered").length,
    required_event_type_count: eventTypeRecords.filter((record) => record.required_family).length,
    schema_version_bound_event_type_count: eventTypeRecords.filter((record) => record.schema_version_binding_status === "bound").length,
    dataschema_bound_event_type_count: eventTypeRecords.filter((record) => record.dataschema_binding_status === "bound").length,
    schema_version_bound_binding_count: eventTypeBindings.filter((binding) => binding.schema_version_binding_status === "bound").length,
    dataschema_bound_binding_count: eventTypeBindings.filter((binding) => binding.dataschema_binding_status === "bound").length,
    resource_event_type_count: familyEventTypeCount(eventFamilyRecords, "resource"),
    workflow_event_type_count: familyEventTypeCount(eventFamilyRecords, "workflow"),
    agent_event_type_count: familyEventTypeCount(eventFamilyRecords, "agent"),
    gate_event_type_count: familyEventTypeCount(eventFamilyRecords, "gate"),
    approval_event_type_count: familyEventTypeCount(eventFamilyRecords, "approval"),
    output_event_type_count: familyEventTypeCount(eventFamilyRecords, "output"),
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_event_family: countBy(eventTypeRecords, "event_family"),
    by_event_category: countBy(eventTypeRecords, "event_category"),
    by_registry_status: countBy(eventTypeRecords, "registry_status"),
    by_binding_status: countBy(eventTypeBindings, "binding_status"),
    by_coverage_status: countBy(eventFamilyRecords, "coverage_status"),
  };
}

function renderEventTypeRegistryMarkdown(result) {
  const lines = [];
  lines.push("# Event Type Registry");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Registry ID: ${result.event_type_registry_id}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Status: ${result.summary.event_type_registry_status}`);
  lines.push(`- Contract: ${result.summary.event_type_registry_contract_id}`);
  lines.push(`- Source envelope ledger: ${result.summary.source_event_envelope_status}`);
  lines.push(`- Event types: ${result.summary.event_type_count}`);
  lines.push(`- Event families: ${result.summary.event_family_count}`);
  lines.push(`- Envelope bindings: ${result.summary.bound_event_type_binding_count}/${result.summary.event_type_binding_count}`);
  lines.push(`- Required families covered: ${result.summary.covered_required_family_count}/${result.summary.required_family_count}`);
  lines.push(`- Unclassified event types: ${result.summary.unclassified_event_type_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Required Family Coverage");
  lines.push("");
  for (const family of REQUIRED_EVENT_FAMILIES) {
    const record = result.event_type_catalog.event_family_records.find((item) => item.event_family === family);
    lines.push(`- ${family}: ${record?.coverage_status ?? "missing"} (${record?.event_type_count ?? 0} type(s), ${record?.event_count ?? 0} event(s))`);
  }
  lines.push("");
  lines.push("## Boundary");
  lines.push("");
  lines.push("- This registry is a deterministic catalog used by adapters, dashboards, and replay tooling.");
  lines.push("- It does not authorize tool execution or client delivery; policy, gate, and approval layers remain authoritative.");
  return `${lines.join("\n")}\n`;
}

function familyEventTypeCount(records, family) {
  return records.find((record) => record.event_family === family)?.event_type_count ?? 0;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_EVENT_TYPE_REGISTRY_INPUTS;
  return {
    event_envelope_ledger_path: path.resolve(options.eventEnvelopeLedgerPath ?? defaults.eventEnvelopeLedgerPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function serializableEventTypeRegistry(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function addValidation(items, { path: itemPath, check_id: checkId, passed, message, metadata = {} }) {
  items.push({
    path: itemPath,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    metadata,
  });
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status === "failed")
    .map((item) => ({
      path: item.path,
      check_id: item.check_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right)));
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

function minIso(left, right) {
  if (!left) return right;
  if (!right) return left;
  return String(left) <= String(right) ? left : right;
}

function maxIso(left, right) {
  if (!left) return right;
  if (!right) return left;
  return String(left) >= String(right) ? left : right;
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 160) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replaceAll(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function parseArgs(argv) {
  const parsed = {
    outDir: DEFAULT_EVENT_TYPE_REGISTRY_OUT_DIR,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--event-envelope-ledger") parsed.eventEnvelopeLedgerPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/event-type-registry.mjs [options]

Catalog CloudEvents-style envelope types into event families and source bindings.

Options:
  --check                           Exit non-zero when validation fails.
  --out-dir, --out <path>          Output directory.
  --run-at <iso>                   Override generated_at timestamp.
  --event-envelope-ledger <path>   event-envelope-ledger.json path.
  --package <path>                 package.json path.
  --roadmap <path>                 implementation roadmap path.
`);
}
