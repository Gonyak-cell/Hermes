import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CLIENT_COUNTERPARTY_REGISTRY_OUT_DIR = "artifacts/client-counterparty-registry/latest";
export const DEFAULT_CLIENT_COUNTERPARTY_REGISTRY_INPUTS = {
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
};

const PARTY_TYPES = new Set(["client", "counterparty", "affiliate", "third_party", "unknown"]);
const REGISTRY_STATUSES = new Set(["active", "inactive", "superseded", "quarantined"]);

export async function runClientCounterpartyRegistry(options = {}) {
  const result = await buildClientCounterpartyRegistry(options);
  if (options.write !== false) await writeClientCounterpartyRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Client/counterparty registry validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildClientCounterpartyRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CLIENT_COUNTERPARTY_REGISTRY_OUT_DIR);
  const matterContractFreezePath = path.resolve(
    options.matterContractFreezePath ?? DEFAULT_CLIENT_COUNTERPARTY_REGISTRY_INPUTS.matterContractFreezePath,
  );
  const source = await readJson(matterContractFreezePath);
  const projected = projectClientCounterpartyRegistry(source, generatedAt);
  const validationItems = validateClientCounterpartyRegistry(source, projected);
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "client-counterparty-registry.v1",
    generated_at: generatedAt,
    registry_id: `client-counterparty-registry.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: {
      matter_contract_freeze_path: matterContractFreezePath,
    },
    source_matter_contract: summarizeSourceMatterContract(source),
    registry_contract: {
      schema_version: "client-counterparty-registry-contract.v1",
      generated_at: generatedAt,
      party_registry: projected.partyRegistry,
      client_registry: projected.clientRegistry,
      counterparty_registry: projected.counterpartyRegistry,
      matter_party_links: projected.matterPartyLinks,
      conflict_reference_index: projected.conflictReferenceIndex,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeRegistry(projected, validationItems, validation, source),
  };
  return {
    ...result,
    markdown: renderClientCounterpartyRegistryMarkdown(result),
  };
}

export async function writeClientCounterpartyRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableRegistry(result);
  await writeJson(path.join(outDir, "client-counterparty-registry.json"), serializable);
  await writeJson(path.join(outDir, "party-registry.json"), {
    generated_at: result.generated_at,
    party_count: result.registry_contract.party_registry.length,
    party_registry: result.registry_contract.party_registry,
  });
  await writeJson(path.join(outDir, "client-registry.json"), {
    generated_at: result.generated_at,
    client_count: result.registry_contract.client_registry.length,
    client_registry: result.registry_contract.client_registry,
  });
  await writeJson(path.join(outDir, "counterparty-registry.json"), {
    generated_at: result.generated_at,
    counterparty_count: result.registry_contract.counterparty_registry.length,
    counterparty_registry: result.registry_contract.counterparty_registry,
  });
  await writeJson(path.join(outDir, "matter-party-links.json"), {
    generated_at: result.generated_at,
    matter_party_link_count: result.registry_contract.matter_party_links.length,
    matter_party_links: result.registry_contract.matter_party_links,
  });
  await writeJson(path.join(outDir, "conflict-reference-index.json"), {
    generated_at: result.generated_at,
    conflict_reference_count: result.registry_contract.conflict_reference_index.length,
    conflict_reference_index: result.registry_contract.conflict_reference_index,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    registry_id: result.registry_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runClientCounterpartyRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runClientCounterpartyRegistry(args);
    console.log(`Client/counterparty registry written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.registry_status}`);
    console.log(`Parties: ${result.summary.party_count}`);
    console.log(`Clients: ${result.summary.client_count}`);
    console.log(`Counterparties: ${result.summary.counterparty_count}`);
    console.log(`Conflict references: ${result.summary.conflict_reference_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectClientCounterpartyRegistry(source, generatedAt) {
  const contract = source.matter_contract ?? {};
  const clients = contract.clients ?? [];
  const parties = contract.parties ?? [];
  const matters = contract.matters ?? [];
  const clientById = new Map(clients.map((client) => [client.client_id, client]));
  const matterById = new Map(matters.map((matter) => [matter.matter_id, matter]));
  const partyRegistry = parties.map((party) => buildPartyRegistryEntry(party, generatedAt)).sort(by("stable_party_id"));
  const partyEntryByStableId = new Map(partyRegistry.map((entry) => [entry.stable_party_id, entry]));
  const clientRegistry = clients.map((client) => {
    const partyEntry = partyRegistry.find((entry) => entry.client_id === client.client_id && entry.party_type === "client");
    return buildClientRegistryEntry(client, partyEntry, matters, generatedAt);
  }).sort(by("client_id"));
  const counterpartyRegistry = partyRegistry
    .filter((entry) => entry.party_type !== "client")
    .map((entry) => buildCounterpartyRegistryEntry(entry, generatedAt))
    .sort(by("stable_party_id"));
  const matterPartyLinks = [];
  for (const matter of matters) {
    for (const partyId of matter.party_ids ?? []) {
      const entry = partyEntryByStableId.get(partyId);
      matterPartyLinks.push(buildMatterPartyLink(matter, entry, generatedAt));
    }
  }
  const conflictReferenceIndex = partyRegistry.map((entry) => ({
    schema_version: "conflict-reference-entry.v1",
    conflict_ref_id: entry.conflict_ref_id,
    stable_party_id: entry.stable_party_id,
    tenant_id: entry.tenant_id,
    party_type: entry.party_type,
    client_id: entry.client_id,
    display_name: entry.display_name,
    canonical_name: entry.canonical_name,
    alias_keys: entry.alias_keys,
    matter_ids: entry.matter_ids,
    counterparty_role: entry.counterparty_role,
    classification_floor: entry.classification_floor,
    conflict_check_status: "ready",
    source_registry_id: entry.party_registry_id,
    metadata: {
      source_party_schema_version: entry.source_schema_version,
    },
  })).sort(by("conflict_ref_id"));

  return {
    clients,
    parties,
    matters,
    clientById,
    matterById,
    partyRegistry,
    clientRegistry,
    counterpartyRegistry,
    matterPartyLinks: matterPartyLinks.sort(by("matter_party_link_id")),
    conflictReferenceIndex,
  };
}

function buildPartyRegistryEntry(party, generatedAt) {
  const canonicalName = canonicalizeName(party.display_name ?? party.party_id);
  const conflictRefId = `conflict-ref.${slugify(`${party.tenant_id}.${canonicalName || party.party_id}`)}`;
  return {
    schema_version: "party-registry-entry.v1",
    party_registry_id: `party-registry.${slugify(party.party_id)}`,
    stable_party_id: party.party_id,
    tenant_id: party.tenant_id,
    party_type: party.party_type ?? "unknown",
    display_name: party.display_name ?? party.party_id,
    canonical_name: canonicalName,
    alias_keys: unique([
      aliasKey(party.party_id),
      aliasKey(party.source_entity_id),
      aliasKey(party.display_name),
      aliasKey(party.client_id),
      ...arrayValue(party.metadata?.aliases).map(aliasKey),
    ]).filter(Boolean).sort(),
    client_id: party.client_id ?? null,
    source_entity_id: party.source_entity_id ?? null,
    matter_ids: [...(party.matter_ids ?? [])].sort(),
    counterparty_role: party.counterparty_role ?? null,
    classification_floor: party.classification_floor ?? null,
    conflict_ref_id: conflictRefId,
    registry_status: "active",
    created_at: party.created_at ?? generatedAt,
    source_schema_version: party.schema_version ?? null,
    metadata: {
      source_metadata: party.metadata ?? {},
    },
  };
}

function buildClientRegistryEntry(client, partyEntry, matters, generatedAt) {
  const matterIds = unique([
    ...(partyEntry?.matter_ids ?? []),
    ...matters.filter((matter) => matter.client_id === client.client_id).map((matter) => matter.matter_id),
  ]).sort();
  return {
    schema_version: "client-registry-entry.v1",
    client_registry_id: `client-registry.${slugify(client.client_id)}`,
    client_id: client.client_id,
    stable_party_id: partyEntry?.stable_party_id ?? null,
    tenant_id: client.tenant_id,
    display_name: client.display_name,
    legal_name: client.legal_name ?? client.display_name,
    canonical_name: canonicalizeName(client.legal_name ?? client.display_name ?? client.client_id),
    alias_keys: unique([
      ...(partyEntry?.alias_keys ?? []),
      aliasKey(client.client_id),
      aliasKey(client.display_name),
      aliasKey(client.legal_name),
      ...arrayValue(client.metadata?.aliases).map(aliasKey),
    ]).filter(Boolean).sort(),
    matter_ids: matterIds,
    classification_floor: client.classification_floor,
    default_policy_snapshot_id: client.default_policy_snapshot_id ?? null,
    conflict_ref_id: partyEntry?.conflict_ref_id ?? null,
    registry_status: partyEntry ? "active" : "quarantined",
    created_at: client.created_at ?? generatedAt,
    source_schema_version: client.schema_version ?? null,
    metadata: {
      source_metadata: client.metadata ?? {},
    },
  };
}

function buildCounterpartyRegistryEntry(entry, generatedAt) {
  return {
    schema_version: "counterparty-registry-entry.v1",
    counterparty_registry_id: `counterparty-registry.${slugify(entry.stable_party_id)}`,
    counterparty_id: entry.stable_party_id,
    stable_party_id: entry.stable_party_id,
    tenant_id: entry.tenant_id,
    party_type: entry.party_type,
    display_name: entry.display_name,
    canonical_name: entry.canonical_name,
    alias_keys: entry.alias_keys,
    matter_ids: entry.matter_ids,
    counterparty_role: entry.counterparty_role ?? "other",
    classification_floor: entry.classification_floor,
    conflict_ref_id: entry.conflict_ref_id,
    registry_status: "active",
    created_at: entry.created_at ?? generatedAt,
    source_schema_version: entry.source_schema_version,
    metadata: entry.metadata,
  };
}

function buildMatterPartyLink(matter, entry, generatedAt) {
  const stablePartyId = entry?.stable_party_id ?? "missing-party";
  return {
    schema_version: "matter-party-link.v1",
    matter_party_link_id: `matter-party-link.${slugify(matter.matter_id)}.${slugify(stablePartyId)}`,
    matter_id: matter.matter_id,
    tenant_id: matter.tenant_id,
    client_id: matter.client_id,
    stable_party_id: stablePartyId,
    party_type: entry?.party_type ?? "unknown",
    link_role: entry?.party_type === "client" ? "client" : "counterparty",
    counterparty_role: entry?.counterparty_role ?? null,
    link_status: "active",
    wall_ids: [...(matter.wall_ids ?? [])].sort(),
    classification: matter.classification,
    classification_floor: matter.classification_floor,
    conflict_ref_id: entry?.conflict_ref_id ?? null,
    created_at: matter.created_at ?? generatedAt,
    source_matter_schema_version: matter.schema_version ?? null,
    metadata: {
      source_matter_name: matter.matter_name ?? null,
    },
  };
}

function validateClientCounterpartyRegistry(source, projected) {
  const validationItems = [];
  const contract = source.matter_contract ?? {};
  const sourceClients = contract.clients ?? [];
  const sourceParties = contract.parties ?? [];
  const sourceMatters = contract.matters ?? [];
  const partyRegistryById = new Map(projected.partyRegistry.map((entry) => [entry.stable_party_id, entry]));
  const clientRegistryById = new Map(projected.clientRegistry.map((entry) => [entry.client_id, entry]));
  const counterpartyRegistryById = new Map(projected.counterpartyRegistry.map((entry) => [entry.stable_party_id, entry]));
  const conflictReferenceByPartyId = new Map(projected.conflictReferenceIndex.map((entry) => [entry.stable_party_id, entry]));
  const matterIds = new Set(sourceMatters.map((matter) => matter.matter_id));
  const sourcePartyIds = new Set(sourceParties.map((party) => party.party_id));
  const expectedMatterPartyLinks = new Set();

  pushCheck(validationItems, "source", source.freeze_id ?? "matter-contract-freeze", "schema_version_supported", source.schema_version === "matter-contract-freeze.v1", "Registry source must be a Matter Contract Freeze artifact.");
  pushCheck(validationItems, "source", source.freeze_id ?? "matter-contract-freeze", "matter_contract_version_supported", contract.schema_version === "matter-contract.v2", "Registry source must expose Matter Contract v2.");
  pushCheck(validationItems, "source", source.freeze_id ?? "matter-contract-freeze", "source_freeze_complete", source.summary?.freeze_status === "complete", "Registry should be built from a complete matter contract freeze.");

  pushUniqueIdChecks(validationItems, projected.partyRegistry, "party_registry", "stable_party_id");
  pushUniqueIdChecks(validationItems, projected.clientRegistry, "client_registry", "client_id");
  pushUniqueIdChecks(validationItems, projected.counterpartyRegistry, "counterparty_registry", "stable_party_id");
  pushUniqueIdChecks(validationItems, projected.conflictReferenceIndex, "conflict_reference", "conflict_ref_id");
  pushUniqueIdChecks(validationItems, projected.matterPartyLinks, "matter_party_link", "matter_party_link_id");

  for (const party of sourceParties) {
    pushCheck(validationItems, "party_registry", party.party_id, "source_party_projected", partyRegistryById.has(party.party_id), "Every Party v2 fixture must have one stable party registry row.");
  }

  for (const entry of projected.partyRegistry) {
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "party_type_supported", PARTY_TYPES.has(entry.party_type), "Party registry entry must preserve a supported party type.");
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "registry_status_supported", REGISTRY_STATUSES.has(entry.registry_status), "Party registry entry must carry a supported registry status.");
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "source_party_link_present", sourcePartyIds.has(entry.stable_party_id), "Party registry entry must link back to a source Party v2 id.");
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "display_name_present", Boolean(entry.display_name), "Party registry entry must preserve display name.");
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "canonical_name_present", Boolean(entry.canonical_name), "Party registry entry must expose a canonical conflict-check name.");
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "alias_keys_present", entry.alias_keys.length > 0, "Party registry entry must expose at least one alias key.");
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "conflict_reference_present", Boolean(entry.conflict_ref_id && conflictReferenceByPartyId.has(entry.stable_party_id)), "Party registry entry must have a conflict reference.");
    if (entry.party_type !== "client") {
      pushCheck(validationItems, "party_registry", entry.stable_party_id, "counterparty_matter_link_present", entry.matter_ids.length > 0, "Counterparty registry entry must be linked to at least one matter.");
    }
    pushCheck(validationItems, "party_registry", entry.stable_party_id, "matter_links_known", entry.matter_ids.every((matterId) => matterIds.has(matterId)), "Party registry matter links must point to known matters.");
  }

  for (const client of sourceClients) {
    const clientEntry = clientRegistryById.get(client.client_id);
    pushCheck(validationItems, "client_registry", client.client_id, "source_client_projected", Boolean(clientEntry), "Every Client v2 fixture must have one client registry row.");
    pushCheck(validationItems, "client_registry", client.client_id, "stable_party_link_present", Boolean(clientEntry?.stable_party_id && partyRegistryById.get(clientEntry.stable_party_id)?.party_type === "client"), "Client registry row must link to its stable client party id.");
    pushCheck(validationItems, "client_registry", client.client_id, "conflict_reference_present", Boolean(clientEntry?.conflict_ref_id), "Client registry row must expose a conflict-check reference.");
  }

  for (const entry of projected.counterpartyRegistry) {
    pushCheck(validationItems, "counterparty_registry", entry.stable_party_id, "source_counterparty_projected", Boolean(counterpartyRegistryById.get(entry.stable_party_id)), "Every counterparty party row must be projected into the counterparty registry.");
    pushCheck(validationItems, "counterparty_registry", entry.stable_party_id, "matter_link_present", entry.matter_ids.length > 0, "Counterparty registry row must link to at least one matter.");
    pushCheck(validationItems, "counterparty_registry", entry.stable_party_id, "conflict_reference_present", Boolean(entry.conflict_ref_id && conflictReferenceByPartyId.has(entry.stable_party_id)), "Counterparty registry row must expose a conflict-check reference.");
  }

  for (const matter of sourceMatters) {
    for (const partyId of matter.party_ids ?? []) {
      expectedMatterPartyLinks.add(`${matter.matter_id}::${partyId}`);
    }
  }

  const actualMatterPartyLinks = new Set(projected.matterPartyLinks.map((link) => `${link.matter_id}::${link.stable_party_id}`));
  for (const expectedLink of expectedMatterPartyLinks) {
    pushCheck(validationItems, "matter_party_link", expectedLink, "source_link_projected", actualMatterPartyLinks.has(expectedLink), "Every matter.party_ids link must be projected into the matter-party link table.");
  }

  for (const link of projected.matterPartyLinks) {
    pushCheck(validationItems, "matter_party_link", link.matter_party_link_id, "matter_known", matterIds.has(link.matter_id), "Matter-party link must point to a known matter.");
    pushCheck(validationItems, "matter_party_link", link.matter_party_link_id, "party_known", partyRegistryById.has(link.stable_party_id), "Matter-party link must point to a known stable party id.");
    pushCheck(validationItems, "matter_party_link", link.matter_party_link_id, "conflict_reference_present", Boolean(link.conflict_ref_id), "Matter-party link must carry the linked party conflict reference.");
  }

  pushAliasCollisionChecks(validationItems, projected.partyRegistry);

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function pushAliasCollisionChecks(validationItems, partyRegistry) {
  const ownersByTenantAlias = new Map();
  for (const entry of partyRegistry) {
    for (const alias of entry.alias_keys) {
      const key = `${entry.tenant_id}::${alias}`;
      const existing = ownersByTenantAlias.get(key);
      if (existing && existing !== entry.stable_party_id) {
        pushCheck(validationItems, "party_registry", entry.stable_party_id, `alias_unique.${slugify(alias)}`, false, `Alias ${alias} is already used by ${existing} in tenant ${entry.tenant_id}.`);
      } else {
        ownersByTenantAlias.set(key, entry.stable_party_id);
        pushCheck(validationItems, "party_registry", entry.stable_party_id, `alias_unique.${slugify(alias)}`, true, `Alias ${alias} is unique for tenant ${entry.tenant_id}.`);
      }
    }
  }
}

function pushUniqueIdChecks(validationItems, items, subjectType, key) {
  const owners = new Map();
  for (const item of items) {
    const id = item[key];
    if (owners.has(id)) {
      pushCheck(validationItems, subjectType, id, "id_unique", false, `${subjectType} id ${id} is already present.`);
    } else {
      owners.set(id, true);
      pushCheck(validationItems, subjectType, id, "id_unique", true, `${subjectType} id ${id} is unique in the registry.`);
    }
  }
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `client-counterparty-registry-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.partyRegistry.length === 0) errors.push({ path: "registry_contract.party_registry", message: "At least one stable party registry row is required." });
  if (projected.clientRegistry.length === 0) errors.push({ path: "registry_contract.client_registry", message: "At least one client registry row is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeRegistry(projected, validationItems, validation, source) {
  const duplicateAliasCount = validationItems.filter((item) => item.check_id.startsWith("alias_unique.") && item.status === "failed").length;
  return {
    registry_status: validation.valid ? "complete" : "blocked",
    source_matter_contract_status: source.summary?.freeze_status ?? "unknown",
    party_count: projected.partyRegistry.length,
    client_count: projected.clientRegistry.length,
    counterparty_count: projected.counterpartyRegistry.length,
    stable_party_id_count: new Set(projected.partyRegistry.map((entry) => entry.stable_party_id)).size,
    alias_key_count: projected.partyRegistry.reduce((sum, entry) => sum + entry.alias_keys.length, 0),
    conflict_reference_count: projected.conflictReferenceIndex.length,
    matter_party_link_count: projected.matterPartyLinks.length,
    matter_with_client_link_count: new Set(projected.matterPartyLinks.filter((link) => link.link_role === "client").map((link) => link.matter_id)).size,
    matter_with_counterparty_link_count: new Set(projected.matterPartyLinks.filter((link) => link.link_role === "counterparty").map((link) => link.matter_id)).size,
    duplicate_alias_count: duplicateAliasCount,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_party_type: countBy(projected.partyRegistry, "party_type"),
    by_counterparty_role: countBy(projected.counterpartyRegistry, "counterparty_role"),
    by_tenant_id: countBy(projected.partyRegistry, "tenant_id"),
  };
}

function summarizeSourceMatterContract(source) {
  const contract = source.matter_contract ?? {};
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    matter_contract_schema_version: contract.schema_version ?? null,
    client_count: contract.clients?.length ?? 0,
    party_count: contract.parties?.length ?? 0,
    matter_count: contract.matters?.length ?? 0,
    counterparty_count: (contract.parties ?? []).filter((party) => party.party_type !== "client").length,
  };
}

function renderClientCounterpartyRegistryMarkdown(result) {
  const lines = [];
  lines.push("# Client/Counterparty Registry");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.registry_status}`);
  lines.push("");
  lines.push(`- Source matter contract: ${result.summary.source_matter_contract_status}`);
  lines.push(`- Parties: ${result.summary.party_count}`);
  lines.push(`- Clients: ${result.summary.client_count}`);
  lines.push(`- Counterparties: ${result.summary.counterparty_count}`);
  lines.push(`- Stable party ids: ${result.summary.stable_party_id_count}`);
  lines.push(`- Alias keys: ${result.summary.alias_key_count}`);
  lines.push(`- Conflict references: ${result.summary.conflict_reference_count}`);
  lines.push(`- Matter-party links: ${result.summary.matter_party_link_count}`);
  lines.push(`- Duplicate aliases: ${result.summary.duplicate_alias_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Registry Entries");
  for (const entry of result.registry_contract.party_registry) {
    lines.push(`- ${entry.stable_party_id}: ${entry.display_name} (${entry.party_type}, ${entry.conflict_ref_id})`);
  }
  return `${lines.join("\n")}\n`;
}

function serializableRegistry(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--matter-contract-freeze") parsed.matterContractFreezePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/client-counterparty-registry.mjs [options]

Options:
  --matter-contract-freeze <path>  matter-contract-freeze.json path.
  --out-dir <path>                 Output directory.
  --run-at <iso>                   Deterministic timestamp.
  --check                          Exit non-zero when validation fails.
  --no-write                       Build without writing artifacts.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function arrayValue(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function canonicalizeName(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function aliasKey(value) {
  const canonical = canonicalizeName(value);
  if (!canonical) return "";
  return canonical.replace(/[^\p{Letter}\p{Number}]+/gu, "-").replace(/^-+|-+$/g, "");
}

function slugify(value) {
  return String(value ?? "unknown")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\..+$/, "Z");
}
