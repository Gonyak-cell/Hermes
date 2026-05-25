import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_PROFILE_TEAM_LEDGER_OUT_DIR = "artifacts/matter-profile-team-ledger/latest";
export const DEFAULT_MATTER_PROFILE_TEAM_LEDGER_INPUTS = {
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
  identityModelPath: "artifacts/identity-model/latest/identity-model.json",
  clientCounterpartyRegistryPath: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
};

const ACCESS_DECISIONS = new Set(["allow", "deny", "review"]);
const MEMBERSHIP_STATUSES = new Set(["active", "inactive", "superseded"]);

export async function runMatterProfileTeamLedger(options = {}) {
  const result = await buildMatterProfileTeamLedger(options);
  if (options.write !== false) await writeMatterProfileTeamLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter profile/team ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterProfileTeamLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_PROFILE_TEAM_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const matterContractFreeze = await readJson(inputs.matter_contract_freeze_path);
  const identityModel = await readJson(inputs.identity_model_path);
  const clientCounterpartyRegistry = await readJson(inputs.client_counterparty_registry_path);
  const projected = projectMatterProfileTeamLedger({ matterContractFreeze, identityModel, clientCounterpartyRegistry, generatedAt });
  const validationItems = validateMatterProfileTeamLedger({ matterContractFreeze, identityModel, clientCounterpartyRegistry, projected });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "matter-profile-team-ledger.v1",
    generated_at: generatedAt,
    ledger_id: `matter-profile-team-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_matter_contract: summarizeMatterContractSource(matterContractFreeze),
    source_identity_model: summarizeIdentityModelSource(identityModel),
    source_client_counterparty_registry: summarizeClientCounterpartyRegistrySource(clientCounterpartyRegistry),
    matter_team_contract: {
      schema_version: "matter-profile-team-contract.v1",
      generated_at: generatedAt,
      matter_profiles: projected.matterProfiles,
      matter_team_rosters: projected.matterTeamRosters,
      matter_team_memberships: projected.matterTeamMemberships,
      matter_access_subjects: projected.matterAccessSubjects,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeMatterProfileTeamLedger(projected, validationItems, validation, {
      matterContractFreeze,
      identityModel,
      clientCounterpartyRegistry,
    }),
  };
  return {
    ...result,
    markdown: renderMatterProfileTeamLedgerMarkdown(result),
  };
}

export async function writeMatterProfileTeamLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "matter-profile-team-ledger.json"), serializable);
  await writeJson(path.join(outDir, "matter-profiles.json"), {
    generated_at: result.generated_at,
    matter_profile_count: result.matter_team_contract.matter_profiles.length,
    matter_profiles: result.matter_team_contract.matter_profiles,
  });
  await writeJson(path.join(outDir, "matter-team-rosters.json"), {
    generated_at: result.generated_at,
    matter_team_roster_count: result.matter_team_contract.matter_team_rosters.length,
    matter_team_rosters: result.matter_team_contract.matter_team_rosters,
  });
  await writeJson(path.join(outDir, "matter-team-memberships.json"), {
    generated_at: result.generated_at,
    matter_team_membership_count: result.matter_team_contract.matter_team_memberships.length,
    matter_team_memberships: result.matter_team_contract.matter_team_memberships,
  });
  await writeJson(path.join(outDir, "matter-access-subjects.json"), {
    generated_at: result.generated_at,
    matter_access_subject_count: result.matter_team_contract.matter_access_subjects.length,
    matter_access_subjects: result.matter_team_contract.matter_access_subjects,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    ledger_id: result.ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterProfileTeamLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterProfileTeamLedger(args);
    console.log(`Matter profile/team ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.ledger_status}`);
    console.log(`Matter profiles: ${result.summary.matter_profile_count}`);
    console.log(`Team memberships: ${result.summary.team_membership_count}`);
    console.log(`Access subjects: ${result.summary.matter_access_subject_count}`);
    console.log(`Allowed access subjects: ${result.summary.allowed_access_subject_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectMatterProfileTeamLedger({ matterContractFreeze, identityModel, clientCounterpartyRegistry, generatedAt }) {
  const matterContract = matterContractFreeze.matter_contract ?? {};
  const identityContract = identityModel.identity_contract ?? {};
  const registryContract = clientCounterpartyRegistry.registry_contract ?? {};
  const matters = matterContract.matters ?? [];
  const matterTeams = matterContract.matter_teams ?? [];
  const matterBoundaries = matterContract.matter_boundaries ?? [];
  const users = identityContract.users ?? [];
  const roleAssignments = identityContract.role_assignments ?? [];
  const clientRegistry = registryContract.client_registry ?? [];
  const matterPartyLinks = registryContract.matter_party_links ?? [];
  const conflictReferenceIndex = registryContract.conflict_reference_index ?? [];

  const teamByMatterId = new Map(matterTeams.map((team) => [team.matter_id, team]));
  const boundaryByMatterId = new Map(matterBoundaries.map((boundary) => [boundary.matter_id, boundary]));
  const clientRegistryByClientId = new Map(clientRegistry.map((client) => [client.client_id, client]));
  const userById = new Map(users.map((user) => [user.user_id, user]));
  const conflictReferenceByPartyId = new Map(conflictReferenceIndex.map((entry) => [entry.stable_party_id, entry]));
  const partyLinksByMatterId = groupBy(matterPartyLinks, "matter_id");
  const roleAssignmentsByUserMatter = groupRoleAssignments(roleAssignments);

  const matterProfiles = matters.map((matter) => {
    const team = teamByMatterId.get(matter.matter_id);
    const boundary = boundaryByMatterId.get(matter.matter_id);
    const client = clientRegistryByClientId.get(matter.client_id);
    const partyLinks = partyLinksByMatterId.get(matter.matter_id) ?? [];
    const conflictRefIds = partyLinks.map((link) => link.conflict_ref_id).filter(Boolean).sort();
    return {
      schema_version: "matter-profile.v1",
      matter_profile_id: `matter-profile.${slugify(matter.matter_id)}`,
      matter_id: matter.matter_id,
      tenant_id: matter.tenant_id,
      client_id: matter.client_id,
      client_registry_id: client?.client_registry_id ?? null,
      stable_client_party_id: client?.stable_party_id ?? null,
      matter_name: matter.matter_name,
      practice_area: matter.practice_area,
      matter_status: matter.matter_status,
      classification: matter.classification,
      classification_floor: matter.classification_floor,
      default_policy_snapshot_id: matter.default_policy_snapshot_id ?? null,
      matter_team_id: matter.matter_team_id ?? null,
      matter_team_roster_id: team ? teamRosterId(team.matter_team_id) : null,
      matter_boundary_id: boundary?.matter_boundary_id ?? null,
      access_scope: boundary?.access_scope ?? "unknown",
      wall_ids: [...(matter.wall_ids ?? [])].sort(),
      party_ids: [...(matter.party_ids ?? [])].sort(),
      counterparty_party_ids: [...(matter.counterparty_party_ids ?? [])].sort(),
      conflict_ref_ids: conflictRefIds,
      team_member_user_ids: [...(boundary?.team_member_user_ids ?? team?.members?.map((member) => member.user_id) ?? [])].sort(),
      responsible_partner_user_ids: [...(matter.responsible_partner_user_ids ?? team?.responsible_partner_user_ids ?? [])].sort(),
      reviewer_user_ids: [...(team?.reviewer_user_ids ?? [])].sort(),
      profile_status: matter.matter_status === "archived" ? "archived" : "active",
      created_at: matter.created_at ?? generatedAt,
      source_schema_version: matter.schema_version ?? null,
      metadata: {
        client_matter_code: matter.metadata?.client_matter_code ?? null,
        source_matter_metadata: matter.metadata ?? {},
      },
    };
  }).sort(by("matter_profile_id"));

  const matterTeamMemberships = [];
  for (const team of matterTeams) {
    for (const member of team.members ?? []) {
      const user = userById.get(member.user_id);
      const assignmentIds = roleAssignmentsByUserMatter.get(`${member.user_id}::${team.matter_id}`) ?? [];
      matterTeamMemberships.push({
        schema_version: "matter-team-membership.v1",
        membership_id: membershipId(team.matter_id, member.user_id, member.matter_role),
        matter_id: team.matter_id,
        matter_team_id: team.matter_team_id,
        tenant_id: team.tenant_id,
        client_id: team.client_id,
        user_id: member.user_id,
        display_name: member.display_name,
        human_actor_principal_id: user?.human_actor_principal_id ?? null,
        matter_role: member.matter_role,
        role_assignment_ids: assignmentIds,
        membership_status: team.team_status === "active" ? "active" : "inactive",
        access_basis: "team_membership",
        access_decision: "allow",
        access_scope: "matter_team_only",
        can_read: true,
        can_write: ["responsible_partner", "reviewer", "drafter", "paralegal", "developer"].includes(member.matter_role),
        can_approve: ["responsible_partner", "reviewer"].includes(member.matter_role),
        wall_ids: [...(team.wall_ids ?? [])].sort(),
        classification_floor: matterProfiles.find((profile) => profile.matter_id === team.matter_id)?.classification_floor ?? null,
        created_at: team.created_at ?? generatedAt,
        source_schema_version: team.schema_version ?? null,
        metadata: {},
      });
    }
  }
  matterTeamMemberships.sort(by("membership_id"));

  const membershipsByMatterUser = new Map(matterTeamMemberships.map((membership) => [`${membership.matter_id}::${membership.user_id}`, membership]));
  const membershipsByMatter = groupBy(matterTeamMemberships, "matter_id");

  const matterTeamRosters = matterTeams.map((team) => {
    const memberships = membershipsByMatter.get(team.matter_id) ?? [];
    return {
      schema_version: "matter-team-roster.v1",
      team_roster_id: teamRosterId(team.matter_team_id),
      matter_team_id: team.matter_team_id,
      matter_id: team.matter_id,
      tenant_id: team.tenant_id,
      client_id: team.client_id,
      team_status: team.team_status,
      access_scope: "matter_team_only",
      member_count: memberships.length,
      active_member_count: memberships.filter((membership) => membership.membership_status === "active").length,
      membership_ids: memberships.map((membership) => membership.membership_id).sort(),
      member_user_ids: memberships.map((membership) => membership.user_id).sort(),
      responsible_partner_user_ids: [...(team.responsible_partner_user_ids ?? [])].sort(),
      reviewer_user_ids: [...(team.reviewer_user_ids ?? [])].sort(),
      wall_ids: [...(team.wall_ids ?? [])].sort(),
      created_at: team.created_at ?? generatedAt,
      source_schema_version: team.schema_version ?? null,
      metadata: {
        source_member_count: team.member_count ?? 0,
      },
    };
  }).sort(by("team_roster_id"));

  const matterAccessSubjects = [];
  for (const matter of matters) {
    const profile = matterProfiles.find((item) => item.matter_id === matter.matter_id);
    for (const user of users.filter((candidate) => candidate.tenant_id === matter.tenant_id)) {
      const membership = membershipsByMatterUser.get(`${matter.matter_id}::${user.user_id}`);
      const allowed = Boolean(membership && membership.membership_status === "active");
      matterAccessSubjects.push({
        schema_version: "matter-access-subject.v1",
        access_subject_id: `matter-access-subject.${slugify(matter.matter_id)}.${slugify(user.user_id)}`,
        matter_id: matter.matter_id,
        tenant_id: matter.tenant_id,
        client_id: matter.client_id,
        subject_type: "human_user",
        user_id: user.user_id,
        human_actor_principal_id: user.human_actor_principal_id,
        membership_id: membership?.membership_id ?? null,
        matter_role_ids: membership ? [`matter-role.${slugify(membership.matter_role).replace(/-/g, ".")}`] : [],
        matter_roles: membership ? [membership.matter_role] : [],
        tenant_role_ids: [...(user.tenant_role_ids ?? [])].sort(),
        access_basis: allowed ? "team_membership" : "no_team_membership",
        access_decision: allowed ? "allow" : "deny",
        access_scope: profile?.access_scope ?? "matter_team_only",
        can_read: allowed,
        can_write: allowed && Boolean(membership?.can_write),
        can_approve: allowed && Boolean(membership?.can_approve),
        wall_ids: [...(profile?.wall_ids ?? [])].sort(),
        classification_floor: profile?.classification_floor ?? null,
        policy_snapshot_id: profile?.default_policy_snapshot_id ?? null,
        created_at: generatedAt,
        metadata: {
          display_name: user.display_name,
          user_status: user.status,
        },
      });
    }
  }
  matterAccessSubjects.sort(by("access_subject_id"));

  return {
    matterProfiles,
    matterTeamRosters,
    matterTeamMemberships,
    matterAccessSubjects,
    users,
    matters,
    matterTeams,
    matterBoundaries,
    clientRegistry,
    conflictReferenceIndex,
  };
}

function validateMatterProfileTeamLedger({ matterContractFreeze, identityModel, clientCounterpartyRegistry, projected }) {
  const validationItems = [];
  const matterContract = matterContractFreeze.matter_contract ?? {};
  const identityContract = identityModel.identity_contract ?? {};
  const registryContract = clientCounterpartyRegistry.registry_contract ?? {};
  const sourceMatterIds = new Set((matterContract.matters ?? []).map((matter) => matter.matter_id));
  const sourceTeamIds = new Set((matterContract.matter_teams ?? []).map((team) => team.matter_team_id));
  const sourceBoundaryMatterIds = new Set((matterContract.matter_boundaries ?? []).map((boundary) => boundary.matter_id));
  const identityUserIds = new Set((identityContract.users ?? []).map((user) => user.user_id));
  const clientRegistryIds = new Set((registryContract.client_registry ?? []).map((client) => client.client_registry_id));
  const membershipsById = new Map(projected.matterTeamMemberships.map((membership) => [membership.membership_id, membership]));
  const rostersByTeamId = new Map(projected.matterTeamRosters.map((roster) => [roster.matter_team_id, roster]));
  const profilesByMatterId = new Map(projected.matterProfiles.map((profile) => [profile.matter_id, profile]));
  const accessSubjectsByMatter = groupBy(projected.matterAccessSubjects, "matter_id");

  pushCheck(validationItems, "source", matterContractFreeze.freeze_id ?? "matter-contract-freeze", "matter_contract_complete", matterContractFreeze.summary?.freeze_status === "complete", "Matter team ledger requires a complete matter contract freeze.");
  pushCheck(validationItems, "source", identityModel.identity_model_id ?? "identity-model", "identity_model_complete", identityModel.summary?.identity_model_status === "complete", "Matter team ledger requires a complete identity model.");
  pushCheck(validationItems, "source", clientCounterpartyRegistry.registry_id ?? "client-counterparty-registry", "client_counterparty_registry_complete", clientCounterpartyRegistry.summary?.registry_status === "complete", "Matter team ledger requires a complete client/counterparty registry.");

  pushUniqueIdChecks(validationItems, projected.matterProfiles, "matter_profile", "matter_profile_id");
  pushUniqueIdChecks(validationItems, projected.matterTeamRosters, "matter_team_roster", "team_roster_id");
  pushUniqueIdChecks(validationItems, projected.matterTeamMemberships, "matter_team_membership", "membership_id");
  pushUniqueIdChecks(validationItems, projected.matterAccessSubjects, "matter_access_subject", "access_subject_id");

  for (const matter of matterContract.matters ?? []) {
    const profile = profilesByMatterId.get(matter.matter_id);
    pushCheck(validationItems, "matter_profile", matter.matter_id, "source_matter_projected", Boolean(profile), "Every Matter v2 row must have a matter profile.");
    pushCheck(validationItems, "matter_profile", matter.matter_id, "team_link_present", Boolean(profile?.matter_team_id && sourceTeamIds.has(profile.matter_team_id)), "Matter profile must link to a known matter team.");
    pushCheck(validationItems, "matter_profile", matter.matter_id, "boundary_link_present", Boolean(profile?.matter_boundary_id && sourceBoundaryMatterIds.has(matter.matter_id)), "Matter profile must link to a known matter boundary.");
    pushCheck(validationItems, "matter_profile", matter.matter_id, "client_registry_link_present", Boolean(profile?.client_registry_id && clientRegistryIds.has(profile.client_registry_id)), "Matter profile must link to a client registry row.");
    pushCheck(validationItems, "matter_profile", matter.matter_id, "access_scope_team_only", profile?.access_scope === "matter_team_only", "Matter profile access scope must be matter_team_only at this phase.");
    pushCheck(validationItems, "matter_profile", matter.matter_id, "responsible_partner_present", (profile?.responsible_partner_user_ids ?? []).length > 0, "Matter profile must preserve a responsible partner.");
    pushCheck(validationItems, "matter_profile", matter.matter_id, "conflict_refs_present", (profile?.conflict_ref_ids ?? []).length > 0, "Matter profile must preserve party conflict reference ids.");
  }

  for (const team of matterContract.matter_teams ?? []) {
    const roster = rostersByTeamId.get(team.matter_team_id);
    pushCheck(validationItems, "matter_team_roster", team.matter_team_id, "source_team_projected", Boolean(roster), "Every MatterTeam v2 row must have a roster.");
    pushCheck(validationItems, "matter_team_roster", team.matter_team_id, "matter_link_present", Boolean(roster?.matter_id && sourceMatterIds.has(roster.matter_id)), "Roster must link to a known matter.");
    pushCheck(validationItems, "matter_team_roster", team.matter_team_id, "member_count_matches_memberships", roster?.member_count === (team.members ?? []).length, "Roster member count must match source team members.");
    pushCheck(validationItems, "matter_team_roster", team.matter_team_id, "active_member_present", (roster?.active_member_count ?? 0) > 0, "Roster must have at least one active member.");
    pushCheck(validationItems, "matter_team_roster", team.matter_team_id, "responsible_partner_present", (roster?.responsible_partner_user_ids ?? []).length > 0, "Roster must preserve responsible partner ids.");
  }

  for (const membership of projected.matterTeamMemberships) {
    pushCheck(validationItems, "matter_team_membership", membership.membership_id, "user_known", identityUserIds.has(membership.user_id), "Team membership user must exist in identity model.");
    pushCheck(validationItems, "matter_team_membership", membership.membership_id, "human_actor_present", Boolean(membership.human_actor_principal_id), "Team membership must bind to a human actor principal.");
    pushCheck(validationItems, "matter_team_membership", membership.membership_id, "role_assignment_present", membership.role_assignment_ids.length > 0, "Team membership must link to a matter role assignment.");
    pushCheck(validationItems, "matter_team_membership", membership.membership_id, "membership_status_supported", MEMBERSHIP_STATUSES.has(membership.membership_status), "Team membership status must be supported.");
    pushCheck(validationItems, "matter_team_membership", membership.membership_id, "access_allows_membership", membership.access_decision === "allow", "Active team membership must allow matter access.");
  }

  for (const accessSubject of projected.matterAccessSubjects) {
    const membership = accessSubject.membership_id ? membershipsById.get(accessSubject.membership_id) : null;
    pushCheck(validationItems, "matter_access_subject", accessSubject.access_subject_id, "matter_known", sourceMatterIds.has(accessSubject.matter_id), "Access subject must link to a known matter.");
    pushCheck(validationItems, "matter_access_subject", accessSubject.access_subject_id, "user_known", identityUserIds.has(accessSubject.user_id), "Access subject user must exist in identity model.");
    pushCheck(validationItems, "matter_access_subject", accessSubject.access_subject_id, "access_decision_supported", ACCESS_DECISIONS.has(accessSubject.access_decision), "Access subject decision must be allow, deny, or review.");
    pushCheck(validationItems, "matter_access_subject", accessSubject.access_subject_id, "team_membership_decides_access", membership ? accessSubject.access_decision === "allow" : accessSubject.access_decision === "deny", "Matter access must be decided by team membership.");
    pushCheck(validationItems, "matter_access_subject", accessSubject.access_subject_id, "read_permission_matches_decision", accessSubject.can_read === (accessSubject.access_decision === "allow"), "Read permission must match the access decision.");
  }

  for (const matterId of sourceMatterIds) {
    const subjects = accessSubjectsByMatter.get(matterId) ?? [];
    pushCheck(validationItems, "matter_access_subject", matterId, "allowed_subject_present", subjects.some((subject) => subject.access_decision === "allow"), "Each matter must have at least one allowed team member access subject.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.matterProfiles.length === 0) errors.push({ path: "matter_team_contract.matter_profiles", message: "At least one matter profile is required." });
  if (projected.matterTeamRosters.length === 0) errors.push({ path: "matter_team_contract.matter_team_rosters", message: "At least one matter team roster is required." });
  if (projected.matterTeamMemberships.length === 0) errors.push({ path: "matter_team_contract.matter_team_memberships", message: "At least one matter team membership is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeMatterProfileTeamLedger(projected, validationItems, validation, sources) {
  return {
    ledger_status: validation.valid ? "complete" : "blocked",
    source_matter_contract_status: sources.matterContractFreeze.summary?.freeze_status ?? "unknown",
    source_identity_model_status: sources.identityModel.summary?.identity_model_status ?? "unknown",
    source_client_counterparty_registry_status: sources.clientCounterpartyRegistry.summary?.registry_status ?? "unknown",
    matter_profile_count: projected.matterProfiles.length,
    matter_team_roster_count: projected.matterTeamRosters.length,
    team_membership_count: projected.matterTeamMemberships.length,
    active_team_membership_count: projected.matterTeamMemberships.filter((membership) => membership.membership_status === "active").length,
    matter_access_subject_count: projected.matterAccessSubjects.length,
    allowed_access_subject_count: projected.matterAccessSubjects.filter((subject) => subject.access_decision === "allow").length,
    denied_access_subject_count: projected.matterAccessSubjects.filter((subject) => subject.access_decision === "deny").length,
    matter_with_team_count: projected.matterProfiles.filter((profile) => profile.matter_team_id).length,
    matter_with_responsible_partner_count: projected.matterProfiles.filter((profile) => profile.responsible_partner_user_ids.length > 0).length,
    team_member_user_count: new Set(projected.matterTeamMemberships.map((membership) => membership.user_id)).size,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_status: countBy(projected.matterProfiles, "matter_status"),
    by_practice_area: countBy(projected.matterProfiles, "practice_area"),
    by_matter_role: countBy(projected.matterTeamMemberships, "matter_role"),
    by_access_decision: countBy(projected.matterAccessSubjects, "access_decision"),
    by_tenant_id: countBy(projected.matterProfiles, "tenant_id"),
  };
}

function summarizeMatterContractSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    matter_count: source.matter_contract?.matters?.length ?? 0,
    matter_team_count: source.matter_contract?.matter_teams?.length ?? 0,
    matter_boundary_count: source.matter_contract?.matter_boundaries?.length ?? 0,
  };
}

function summarizeIdentityModelSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    identity_model_id: source.identity_model_id ?? null,
    identity_model_status: source.summary?.identity_model_status ?? "unknown",
    user_count: source.identity_contract?.users?.length ?? 0,
    role_assignment_count: source.identity_contract?.role_assignments?.length ?? 0,
  };
}

function summarizeClientCounterpartyRegistrySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    registry_id: source.registry_id ?? null,
    registry_status: source.summary?.registry_status ?? "unknown",
    client_count: source.registry_contract?.client_registry?.length ?? 0,
    matter_party_link_count: source.registry_contract?.matter_party_links?.length ?? 0,
    conflict_reference_count: source.registry_contract?.conflict_reference_index?.length ?? 0,
  };
}

function renderMatterProfileTeamLedgerMarkdown(result) {
  const lines = [];
  lines.push("# Matter Profile/Team Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.ledger_status}`);
  lines.push("");
  lines.push(`- Matter profiles: ${result.summary.matter_profile_count}`);
  lines.push(`- Team rosters: ${result.summary.matter_team_roster_count}`);
  lines.push(`- Team memberships: ${result.summary.team_membership_count}`);
  lines.push(`- Access subjects: ${result.summary.matter_access_subject_count}`);
  lines.push(`- Allowed access subjects: ${result.summary.allowed_access_subject_count}`);
  lines.push(`- Denied access subjects: ${result.summary.denied_access_subject_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Matters");
  for (const profile of result.matter_team_contract.matter_profiles) {
    lines.push(`- ${profile.matter_id}: ${profile.matter_name} (${profile.access_scope}, team ${profile.matter_team_id})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    matter_contract_freeze_path: path.resolve(options.matterContractFreezePath ?? DEFAULT_MATTER_PROFILE_TEAM_LEDGER_INPUTS.matterContractFreezePath),
    identity_model_path: path.resolve(options.identityModelPath ?? DEFAULT_MATTER_PROFILE_TEAM_LEDGER_INPUTS.identityModelPath),
    client_counterparty_registry_path: path.resolve(options.clientCounterpartyRegistryPath ?? DEFAULT_MATTER_PROFILE_TEAM_LEDGER_INPUTS.clientCounterpartyRegistryPath),
  };
}

function serializableLedger(result) {
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
    else if (arg === "--identity-model") parsed.identityModelPath = argv[++index];
    else if (arg === "--client-counterparty-registry") parsed.clientCounterpartyRegistryPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-profile-team-ledger.mjs [options]

Options:
  --matter-contract-freeze <path>        matter-contract-freeze.json path.
  --identity-model <path>                identity-model.json path.
  --client-counterparty-registry <path>  client-counterparty-registry.json path.
  --out-dir <path>                       Output directory.
  --run-at <iso>                         Deterministic timestamp.
  --check                                Exit non-zero when validation fails.
  --no-write                             Build without writing artifacts.
`);
}

function groupRoleAssignments(assignments) {
  const grouped = new Map();
  for (const assignment of assignments) {
    if (assignment.assignment_scope !== "matter" || !assignment.user_id || !assignment.matter_id) continue;
    const key = `${assignment.user_id}::${assignment.matter_id}`;
    grouped.set(key, [...(grouped.get(key) ?? []), assignment.role_assignment_id].sort());
  }
  return grouped;
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  }
  return grouped;
}

function pushUniqueIdChecks(validationItems, items, subjectType, key) {
  const owners = new Map();
  for (const item of items) {
    const id = item[key];
    if (owners.has(id)) {
      pushCheck(validationItems, subjectType, id, "id_unique", false, `${subjectType} id ${id} is already present.`);
    } else {
      owners.set(id, true);
      pushCheck(validationItems, subjectType, id, "id_unique", true, `${subjectType} id ${id} is unique in the ledger.`);
    }
  }
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `matter-profile-team-ledger-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
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

function teamRosterId(matterTeamId) {
  return `matter-team-roster.${slugify(matterTeamId)}`;
}

function membershipId(matterId, userId, matterRole) {
  return `matter-team-membership.${slugify(matterId)}.${slugify(userId)}.${slugify(matterRole)}`;
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
