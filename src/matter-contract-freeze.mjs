import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_CONTRACT_FREEZE_OUT_DIR = "artifacts/matter-contract-freeze/latest";
export const DEFAULT_MATTER_CONTRACT_FREEZE_INPUTS = {
  verticalSlicePath: "examples/core/vertical-slice-example.json",
};

const CLASSIFICATIONS = new Set([
  "P0_PUBLIC",
  "P1_INTERNAL",
  "P2_CLIENT_CONFIDENTIAL",
  "P3_PRIVILEGED",
  "P4_HIGHLY_RESTRICTED",
  "P5_SECRET",
]);

const PARTY_TYPES = new Set(["client", "counterparty", "affiliate", "third_party", "unknown"]);
const MATTER_STATUSES = new Set(["active", "paused", "closed", "archived"]);
const MATTER_ROLES = new Set(["responsible_partner", "reviewer", "drafter", "paralegal", "developer", "viewer"]);

export async function runMatterContractFreeze(options = {}) {
  const result = await buildMatterContractFreeze(options);
  if (options.write !== false) await writeMatterContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_CONTRACT_FREEZE_OUT_DIR);
  const verticalSlicePath = path.resolve(options.verticalSlicePath ?? options.identityPolicyPath ?? DEFAULT_MATTER_CONTRACT_FREEZE_INPUTS.verticalSlicePath);
  const source = await readJson(verticalSlicePath);
  const identityPolicy = source.schema_version === "identity-policy.v1" ? source : source.identity_policy;
  const { clients, parties, matters, matterTeams, matterBoundaries } = projectMatterContracts(identityPolicy, generatedAt);
  const validationItems = validateMatterContracts(identityPolicy, { clients, parties, matters, matterTeams, matterBoundaries });
  const validation = summarizeValidation(validationItems, { clients, parties, matters, matterTeams, matterBoundaries });
  const result = {
    schema_version: "matter-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `matter-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs: {
      vertical_slice_path: verticalSlicePath,
    },
    source_identity_policy: {
      schema_version: identityPolicy?.schema_version ?? null,
      tenant_count: identityPolicy?.tenants?.length ?? 0,
      user_count: identityPolicy?.users?.length ?? 0,
      client_count: identityPolicy?.clients?.length ?? 0,
      matter_count: identityPolicy?.matters?.length ?? 0,
      policy_snapshot_count: identityPolicy?.policy_snapshots?.length ?? 0,
    },
    contract_versions: {
      client_schema_version: "client.v2",
      party_schema_version: "party.v2",
      matter_schema_version: "matter-core.v2",
      matter_team_schema_version: "matter-team.v2",
      matter_boundary_schema_version: "matter-boundary.v2",
      compatibility_floor: "identity-policy.v1",
    },
    summary: summarizeFreeze({ clients, parties, matters, matterTeams, matterBoundaries }, validationItems, validation, identityPolicy),
    matter_contract: {
      schema_version: "matter-contract.v2",
      generated_at: generatedAt,
      clients,
      parties,
      matters,
      matter_teams: matterTeams,
      matter_boundaries: matterBoundaries,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderMatterContractFreezeMarkdown(result),
  };
}

export async function writeMatterContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "matter-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "matter-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    matter_schema_version: result.contract_versions.matter_schema_version,
    matter_count: result.matter_contract.matters.length,
    clients: result.matter_contract.clients,
    matters: result.matter_contract.matters,
    matter_teams: result.matter_contract.matter_teams,
    matter_boundaries: result.matter_contract.matter_boundaries,
  });
  await writeJson(path.join(outDir, "party-contract-v2-fixture.json"), {
    generated_at: result.generated_at,
    party_schema_version: result.contract_versions.party_schema_version,
    party_count: result.matter_contract.parties.length,
    parties: result.matter_contract.parties,
  });
  await writeJson(path.join(outDir, "matter-boundary-v2-fixture.json"), {
    generated_at: result.generated_at,
    matter_boundary_schema_version: result.contract_versions.matter_boundary_schema_version,
    matter_boundary_count: result.matter_contract.matter_boundaries.length,
    matter_boundaries: result.matter_contract.matter_boundaries,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterContractFreeze(args);
    console.log(`Matter contract freeze written to ${result.output_dir}`);
    console.log(`Matters v2: ${result.summary.matter_count}`);
    console.log(`Parties v2: ${result.summary.party_count}`);
    console.log(`Matter boundaries v2: ${result.summary.matter_boundary_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectMatterContracts(identityPolicy, generatedAt) {
  const tenants = identityPolicy?.tenants ?? [];
  const users = identityPolicy?.users ?? [];
  const clientsSource = identityPolicy?.clients ?? [];
  const mattersSource = identityPolicy?.matters ?? [];
  const policySnapshots = identityPolicy?.policy_snapshots ?? [];
  const tenantById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  const userById = new Map(users.map((user) => [user.id, user]));
  const clientById = new Map(clientsSource.map((client) => [client.id, client]));
  const policyByTenant = new Map(policySnapshots.map((snapshot) => [snapshot.tenant_id, snapshot.id]));
  const clientPartyByClientId = new Map();
  const partiesById = new Map();
  const counterpartyIdsByMatter = new Map();

  const clients = clientsSource.map((client) => {
    const tenant = tenantById.get(client.tenant_id);
    return {
      schema_version: "client.v2",
      client_id: client.id,
      tenant_id: client.tenant_id,
      display_name: client.name,
      legal_name: client.metadata?.legal_name ?? client.name,
      client_status: client.metadata?.client_status ?? "active",
      classification_floor: client.classification_floor,
      default_policy_snapshot_id: tenant?.default_policy_id ?? policyByTenant.get(client.tenant_id) ?? null,
      created_at: client.created_at ?? generatedAt,
      source_schema_version: client.schema_version,
      metadata: client.metadata ?? {},
    };
  }).sort((left, right) => left.client_id.localeCompare(right.client_id));

  for (const client of clients) {
    const party = {
      schema_version: "party.v2",
      party_id: `party.${client.client_id}`,
      tenant_id: client.tenant_id,
      party_type: "client",
      source_entity_id: client.client_id,
      display_name: client.display_name,
      client_id: client.client_id,
      matter_ids: mattersSource.filter((matter) => matter.client_id === client.client_id).map((matter) => matter.id).sort(),
      counterparty_role: null,
      classification_floor: client.classification_floor,
      created_at: client.created_at,
      metadata: {
        source_schema_version: client.source_schema_version,
      },
    };
    clientPartyByClientId.set(client.client_id, party.party_id);
    partiesById.set(party.party_id, party);
  }

  for (const matter of mattersSource) {
    const counterparties = normalizeCounterparties(matter);
    counterpartyIdsByMatter.set(matter.id, []);
    for (const counterparty of counterparties) {
      const partyId = counterparty.id ?? `party.counterparty.${slugify(matter.id)}.${slugify(counterparty.name ?? counterparty.display_name ?? "unknown")}`;
      if (!partiesById.has(partyId)) {
        partiesById.set(partyId, {
          schema_version: "party.v2",
          party_id: partyId,
          tenant_id: counterparty.tenant_id ?? matter.tenant_id,
          party_type: counterparty.party_type ?? "counterparty",
          source_entity_id: counterparty.source_entity_id ?? partyId,
          display_name: counterparty.name ?? counterparty.display_name ?? partyId,
          client_id: null,
          matter_ids: [],
          counterparty_role: counterparty.counterparty_role ?? counterparty.role ?? "other",
          classification_floor: counterparty.classification_floor ?? matter.classification,
          created_at: counterparty.created_at ?? matter.created_at ?? generatedAt,
          metadata: {
            ...(counterparty.metadata ?? {}),
            source_matter_id: matter.id,
            source_schema_version: counterparty.schema_version ?? "matter-metadata.counterparty.v1",
          },
        });
      }
      const party = partiesById.get(partyId);
      party.matter_ids = unique([...party.matter_ids, matter.id]).sort();
      counterpartyIdsByMatter.get(matter.id).push(partyId);
    }
  }

  const parties = [...partiesById.values()].sort((left, right) => left.party_id.localeCompare(right.party_id));
  const partyById = new Map(parties.map((party) => [party.party_id, party]));

  const matterTeams = mattersSource.map((matter) => {
    const members = (matter.matter_team ?? []).map((member) => ({
      user_id: member.user_id,
      display_name: userById.get(member.user_id)?.display_name ?? member.user_id,
      matter_role: member.matter_role,
      tenant_id: userById.get(member.user_id)?.tenant_id ?? matter.tenant_id,
    }));
    return {
      schema_version: "matter-team.v2",
      matter_team_id: `matter-team.${slugify(matter.id)}`,
      tenant_id: matter.tenant_id,
      client_id: matter.client_id,
      matter_id: matter.id,
      team_status: matter.status === "archived" ? "archived" : "active",
      member_count: members.length,
      members,
      responsible_partner_user_ids: members.filter((member) => member.matter_role === "responsible_partner").map((member) => member.user_id).sort(),
      reviewer_user_ids: members.filter((member) => member.matter_role === "reviewer").map((member) => member.user_id).sort(),
      wall_ids: [...(matter.wall_ids ?? [])].sort(),
      created_at: matter.created_at ?? generatedAt,
      metadata: {
        source_schema_version: matter.schema_version,
      },
    };
  }).sort((left, right) => left.matter_team_id.localeCompare(right.matter_team_id));

  const teamByMatter = new Map(matterTeams.map((team) => [team.matter_id, team]));

  const matters = mattersSource.map((matter) => {
    const client = clientById.get(matter.client_id);
    const clientPartyId = clientPartyByClientId.get(matter.client_id);
    const counterpartyPartyIds = unique(counterpartyIdsByMatter.get(matter.id) ?? []).sort();
    const team = teamByMatter.get(matter.id);
    const partyIds = unique([clientPartyId, ...counterpartyPartyIds].filter(Boolean)).sort();
    return {
      schema_version: "matter-core.v2",
      matter_id: matter.id,
      tenant_id: matter.tenant_id,
      client_id: matter.client_id,
      matter_name: matter.matter_name,
      practice_area: matter.practice_area,
      matter_status: matter.status,
      classification: matter.classification,
      classification_floor: client?.classification_floor ?? matter.classification,
      default_policy_snapshot_id: tenantById.get(matter.tenant_id)?.default_policy_id ?? policyByTenant.get(matter.tenant_id) ?? null,
      matter_team_id: team?.matter_team_id ?? null,
      wall_ids: [...(matter.wall_ids ?? [])].sort(),
      party_ids: partyIds,
      counterparty_party_ids: counterpartyPartyIds,
      responsible_partner_user_ids: team?.responsible_partner_user_ids ?? [],
      created_at: matter.created_at ?? generatedAt,
      source_schema_version: matter.schema_version,
      metadata: matter.metadata ?? {},
    };
  }).sort((left, right) => left.matter_id.localeCompare(right.matter_id));

  const matterById = new Map(matters.map((matter) => [matter.matter_id, matter]));
  const matterBoundaries = matters.map((matter) => {
    const team = teamByMatter.get(matter.matter_id);
    return {
      schema_version: "matter-boundary.v2",
      matter_boundary_id: `matter-boundary.${slugify(matter.matter_id)}`,
      tenant_id: matter.tenant_id,
      client_id: matter.client_id,
      matter_id: matter.matter_id,
      matter_team_id: matter.matter_team_id,
      party_ids: matter.party_ids,
      counterparty_party_ids: matter.counterparty_party_ids,
      wall_ids: matter.wall_ids,
      team_member_user_ids: (team?.members ?? []).map((member) => member.user_id).sort(),
      responsible_partner_user_ids: matter.responsible_partner_user_ids,
      classification: matter.classification,
      classification_floor: matter.classification_floor,
      policy_snapshot_id: matter.default_policy_snapshot_id,
      access_scope: "matter_team_only",
      retrieval_filters: {
        tenant_id: matter.tenant_id,
        client_id: matter.client_id,
        matter_id: matter.matter_id,
        wall_ids: matter.wall_ids,
        classification: matter.classification,
      },
      boundary_status: MATTER_STATUSES.has(matter.matter_status) ? matter.matter_status : "active",
      created_at: matter.created_at,
      metadata: {
        source_matter_schema_version: matter.source_schema_version,
        party_display_names: matter.party_ids.map((partyId) => partyById.get(partyId)?.display_name ?? partyId),
      },
    };
  }).filter((boundary) => matterById.has(boundary.matter_id)).sort((left, right) => left.matter_boundary_id.localeCompare(right.matter_boundary_id));

  return {
    clients,
    parties,
    matters,
    matterTeams,
    matterBoundaries,
  };
}

function normalizeCounterparties(matter) {
  const metadata = matter.metadata ?? {};
  const values = metadata.counterparties ?? metadata.counterparty_parties ?? [];
  if (!Array.isArray(values)) return [];
  return values.map((value, index) => {
    if (typeof value === "string") {
      return {
        id: `party.counterparty.${slugify(matter.id)}.${index + 1}`,
        name: value,
        counterparty_role: "other",
      };
    }
    return value ?? {};
  });
}

function validateMatterContracts(identityPolicy, contracts) {
  const validationItems = [];
  const tenants = identityPolicy?.tenants ?? [];
  const users = identityPolicy?.users ?? [];
  const policySnapshots = identityPolicy?.policy_snapshots ?? [];
  const tenantIds = new Set(tenants.map((tenant) => tenant.id));
  const userIds = new Set(users.map((user) => user.id));
  const policySnapshotIds = new Set(policySnapshots.map((snapshot) => snapshot.id));
  const clientsById = new Map(contracts.clients.map((client) => [client.client_id, client]));
  const partiesById = new Map(contracts.parties.map((party) => [party.party_id, party]));
  const teamsById = new Map(contracts.matterTeams.map((team) => [team.matter_team_id, team]));
  const mattersById = new Map(contracts.matters.map((matter) => [matter.matter_id, matter]));

  pushUniqueIdChecks(validationItems, contracts.clients, "client", "client_id");
  pushUniqueIdChecks(validationItems, contracts.parties, "party", "party_id");
  pushUniqueIdChecks(validationItems, contracts.matters, "matter", "matter_id");
  pushUniqueIdChecks(validationItems, contracts.matterTeams, "matter_team", "matter_team_id");
  pushUniqueIdChecks(validationItems, contracts.matterBoundaries, "matter_boundary", "matter_boundary_id");

  for (const client of contracts.clients) {
    pushCheck(validationItems, "client", client.client_id, "tenant_link_present", tenantIds.has(client.tenant_id), "Client must link to a known tenant.");
    pushCheck(validationItems, "client", client.client_id, "display_name_present", Boolean(client.display_name), "Client must preserve a display name.");
    pushCheck(validationItems, "client", client.client_id, "classification_floor_present", CLASSIFICATIONS.has(client.classification_floor), "Client must carry a P0-P5 classification floor.");
    pushCheck(validationItems, "client", client.client_id, "policy_snapshot_link_present", Boolean(client.default_policy_snapshot_id && policySnapshotIds.has(client.default_policy_snapshot_id)), "Client must link to a known default policy snapshot.");
  }

  for (const party of contracts.parties) {
    pushCheck(validationItems, "party", party.party_id, "tenant_link_present", tenantIds.has(party.tenant_id), "Party must link to a known tenant.");
    pushCheck(validationItems, "party", party.party_id, "party_type_present", PARTY_TYPES.has(party.party_type), "Party type must be one of the canonical party types.");
    pushCheck(validationItems, "party", party.party_id, "display_name_present", Boolean(party.display_name), "Party must preserve a display name.");
    pushCheck(validationItems, "party", party.party_id, "classification_floor_present", CLASSIFICATIONS.has(party.classification_floor), "Party must carry a P0-P5 classification floor.");
    if (party.party_type === "client") {
      pushCheck(validationItems, "party", party.party_id, "client_link_present", Boolean(party.client_id && clientsById.has(party.client_id)), "Client party must link back to a known client.");
    }
    if (party.party_type === "counterparty") {
      pushCheck(validationItems, "party", party.party_id, "matter_link_present", party.matter_ids.length > 0, "Counterparty party must link to at least one matter.");
    }
  }

  for (const team of contracts.matterTeams) {
    pushCheck(validationItems, "matter_team", team.matter_team_id, "matter_link_present", mattersById.has(team.matter_id), "Matter team must link to a known matter.");
    pushCheck(validationItems, "matter_team", team.matter_team_id, "client_link_present", clientsById.has(team.client_id), "Matter team must preserve the client boundary.");
    pushCheck(validationItems, "matter_team", team.matter_team_id, "member_count_present", team.member_count > 0, "Matter team must include at least one member.");
    pushCheck(validationItems, "matter_team", team.matter_team_id, "member_user_links_present", team.members.every((member) => userIds.has(member.user_id)), "Matter team members must link to known users.");
    pushCheck(validationItems, "matter_team", team.matter_team_id, "member_roles_present", team.members.every((member) => MATTER_ROLES.has(member.matter_role)), "Matter team members must carry canonical matter roles.");
    pushCheck(validationItems, "matter_team", team.matter_team_id, "responsible_partner_present", team.responsible_partner_user_ids.length > 0, "Matter team must identify at least one responsible partner.");
    pushCheck(validationItems, "matter_team", team.matter_team_id, "wall_ids_present", team.wall_ids.length > 0, "Matter team must preserve wall ids.");
  }

  for (const matter of contracts.matters) {
    pushCheck(validationItems, "matter", matter.matter_id, "tenant_link_present", tenantIds.has(matter.tenant_id), "Matter must link to a known tenant.");
    pushCheck(validationItems, "matter", matter.matter_id, "client_link_present", clientsById.has(matter.client_id), "Matter must link to a known client.");
    pushCheck(validationItems, "matter", matter.matter_id, "team_link_present", Boolean(matter.matter_team_id && teamsById.has(matter.matter_team_id)), "Matter must link to a MatterTeam v2 fixture.");
    pushCheck(validationItems, "matter", matter.matter_id, "classification_present", CLASSIFICATIONS.has(matter.classification), "Matter must carry a P0-P5 classification.");
    pushCheck(validationItems, "matter", matter.matter_id, "classification_floor_present", CLASSIFICATIONS.has(matter.classification_floor), "Matter must preserve the client classification floor.");
    pushCheck(validationItems, "matter", matter.matter_id, "wall_ids_present", matter.wall_ids.length > 0, "Matter must preserve wall ids.");
    pushCheck(validationItems, "matter", matter.matter_id, "policy_snapshot_link_present", Boolean(matter.default_policy_snapshot_id && policySnapshotIds.has(matter.default_policy_snapshot_id)), "Matter must link to a known default policy snapshot.");
    pushCheck(validationItems, "matter", matter.matter_id, "client_party_link_present", matter.party_ids.some((partyId) => partiesById.get(partyId)?.party_type === "client"), "Matter must include its client as a Party v2 link.");
  }

  for (const boundary of contracts.matterBoundaries) {
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "matter_link_present", mattersById.has(boundary.matter_id), "MatterBoundary must link to a known matter.");
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "client_link_present", clientsById.has(boundary.client_id), "MatterBoundary must preserve the client boundary.");
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "team_link_present", Boolean(boundary.matter_team_id && teamsById.has(boundary.matter_team_id)), "MatterBoundary must link to a MatterTeam v2 fixture.");
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "team_members_present", boundary.team_member_user_ids.length > 0, "MatterBoundary must carry team-member user ids.");
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "wall_ids_present", boundary.wall_ids.length > 0, "MatterBoundary must carry wall ids.");
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "classification_present", CLASSIFICATIONS.has(boundary.classification), "MatterBoundary must carry a P0-P5 classification.");
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "policy_snapshot_link_present", Boolean(boundary.policy_snapshot_id && policySnapshotIds.has(boundary.policy_snapshot_id)), "MatterBoundary must link to a known policy snapshot.");
    pushCheck(validationItems, "matter_boundary", boundary.matter_boundary_id, "retrieval_filters_present", hasBoundaryFilters(boundary), "MatterBoundary must expose tenant/client/matter/wall/classification retrieval filters.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function pushUniqueIdChecks(validationItems, items, subjectType, key) {
  const owners = new Map();
  for (const item of items) {
    const id = item[key];
    if (owners.has(id)) {
      pushCheck(validationItems, subjectType, id, "id_unique", false, `${subjectType} id ${id} is already present.`);
    } else {
      owners.set(id, true);
      pushCheck(validationItems, subjectType, id, "id_unique", true, `${subjectType} id ${id} is unique in the fixture.`);
    }
  }
}

function hasBoundaryFilters(boundary) {
  const filters = boundary.retrieval_filters ?? {};
  return Boolean(
    filters.tenant_id
      && filters.client_id
      && filters.matter_id
      && Array.isArray(filters.wall_ids)
      && filters.wall_ids.length > 0
      && CLASSIFICATIONS.has(filters.classification),
  );
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `matter-contract-validation.${subjectType}.${slugify(subjectId)}.${checkId}`,
    subject_type: subjectType,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function summarizeValidation(validationItems, contracts) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (contracts.clients.length === 0) errors.push({ path: "matter_contract.clients", message: "At least one Client v2 fixture is required." });
  if (contracts.parties.length === 0) errors.push({ path: "matter_contract.parties", message: "At least one Party v2 fixture is required." });
  if (contracts.matters.length === 0) errors.push({ path: "matter_contract.matters", message: "At least one Matter v2 fixture is required." });
  if (contracts.matterTeams.length === 0) errors.push({ path: "matter_contract.matter_teams", message: "At least one MatterTeam v2 fixture is required." });
  if (contracts.matterBoundaries.length === 0) errors.push({ path: "matter_contract.matter_boundaries", message: "At least one MatterBoundary v2 fixture is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFreeze(contracts, validationItems, validation, identityPolicy) {
  const counterpartyCount = contracts.parties.filter((party) => party.party_type === "counterparty").length;
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    client_schema_version: "client.v2",
    party_schema_version: "party.v2",
    matter_schema_version: "matter-core.v2",
    matter_team_schema_version: "matter-team.v2",
    matter_boundary_schema_version: "matter-boundary.v2",
    tenant_count: identityPolicy?.tenants?.length ?? 0,
    user_count: identityPolicy?.users?.length ?? 0,
    policy_snapshot_count: identityPolicy?.policy_snapshots?.length ?? 0,
    client_count: contracts.clients.length,
    party_count: contracts.parties.length,
    client_party_count: contracts.parties.filter((party) => party.party_type === "client").length,
    counterparty_count: counterpartyCount,
    matter_count: contracts.matters.length,
    matter_team_count: contracts.matterTeams.length,
    matter_boundary_count: contracts.matterBoundaries.length,
    matter_with_client_count: contracts.matters.filter((matter) => matter.client_id).length,
    matter_with_party_count: contracts.matters.filter((matter) => matter.party_ids.length > 0).length,
    matter_with_counterparty_count: contracts.matters.filter((matter) => matter.counterparty_party_ids.length > 0).length,
    matter_with_team_count: contracts.matters.filter((matter) => matter.matter_team_id).length,
    matter_with_wall_count: contracts.matters.filter((matter) => matter.wall_ids.length > 0).length,
    matter_with_policy_snapshot_count: contracts.matters.filter((matter) => matter.default_policy_snapshot_id).length,
    team_member_count: contracts.matterTeams.reduce((sum, team) => sum + team.member_count, 0),
    responsible_partner_count: new Set(contracts.matterTeams.flatMap((team) => team.responsible_partner_user_ids)).size,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_classification: countBy(contracts.matters, "classification"),
    by_practice_area: countBy(contracts.matters, "practice_area"),
    by_matter_status: countBy(contracts.matters, "matter_status"),
    by_tenant_id: countBy(contracts.matters, "tenant_id"),
  };
}

function renderMatterContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Matter Contract Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.freeze_status}`);
  lines.push("");
  lines.push(`- Client schema: ${result.summary.client_schema_version}`);
  lines.push(`- Party schema: ${result.summary.party_schema_version}`);
  lines.push(`- Matter schema: ${result.summary.matter_schema_version}`);
  lines.push(`- MatterTeam schema: ${result.summary.matter_team_schema_version}`);
  lines.push(`- MatterBoundary schema: ${result.summary.matter_boundary_schema_version}`);
  lines.push(`- Clients: ${result.summary.client_count}`);
  lines.push(`- Parties: ${result.summary.party_count}`);
  lines.push(`- Counterparties: ${result.summary.counterparty_count}`);
  lines.push(`- Matters: ${result.summary.matter_count}`);
  lines.push(`- Matter teams: ${result.summary.matter_team_count}`);
  lines.push(`- Matter boundaries: ${result.summary.matter_boundary_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Matter Status");
  for (const [status, count] of Object.entries(result.summary.by_matter_status)) {
    lines.push(`- ${status}: ${count}`);
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

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))),
  );
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
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
    else if (arg === "--vertical-slice") parsed.verticalSlicePath = argv[++index];
    else if (arg === "--identity-policy") parsed.identityPolicyPath = argv[++index];
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
  console.log(`Usage: node scripts/matter-contract-freeze.mjs [options]

Options:
  --out-dir <path>         Output directory.
  --vertical-slice <path>  vertical-slice-example.json path.
  --identity-policy <path> identity-policy.v1 JSON path.
  --run-at <iso>           Override generated_at.
  --check                  Exit non-zero on validation errors.
  --help                   Show this help.
`);
}
