import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_OS_PROFILE_OUT_DIR = "artifacts/matter-os-profile/latest";
export const DEFAULT_MATTER_OS_PROFILE_INPUTS = {
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  clientCounterpartyRegistryPath: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
  lawFirmPackManifestPath: "artifacts/law-firm-pack-manifest/latest/law-firm-pack-manifest.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "matter-os-profile.v1";
const SOURCE_OF_TRUTH = "matter_profile_team_ledger_and_client_counterparty_registry";

export async function runMatterOsProfile(options = {}) {
  const result = await buildMatterOsProfile(options);
  if (options.write !== false) await writeMatterOsProfile(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter OS profile validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterOsProfile(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_OS_PROFILE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const matterProfileTeamLedger = sourceById.matter_profile_team_ledger;
  const clientCounterpartyRegistry = sourceById.client_counterparty_registry;
  const matterContractFreeze = sourceById.matter_contract_freeze;
  const lawFirmPackManifest = sourceById.law_firm_pack_manifest;
  const matterOsProfiles = buildMatterOsProfiles({
    generatedAt,
    matterProfileTeamLedger,
    clientCounterpartyRegistry,
    matterContractFreeze,
    lawFirmPackManifest,
  });
  const displayFields = matterOsProfiles.map((profile) => profile.display_fields);
  const desktopBoundary = buildDesktopBoundary(generatedAt, lawFirmPackManifest);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matterProfileTeamLedger,
    clientCounterpartyRegistry,
    matterContractFreeze,
    lawFirmPackManifest,
    matterOsProfiles,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeMatterOsProfile({
    matterProfileTeamLedger,
    clientCounterpartyRegistry,
    matterContractFreeze,
    lawFirmPackManifest,
    matterOsProfiles,
    displayFields,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    matter_os_profile_id: `matter-os-profile.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    matter_os_profile_status: summary.matter_os_profile_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    matter_os_profile_contract: buildContract(generatedAt),
    matter_os_profiles: matterOsProfiles,
    matter_os_display_fields: displayFields,
    matter_os_profile_desktop_boundary: desktopBoundary,
    matter_os_profile_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMatterOsProfileMarkdown(result),
  };
}

export async function writeMatterOsProfile(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterOsProfile(result);
  await writeJson(path.join(outDir, "matter-os-profile.json"), serializable);
  await writeJson(path.join(outDir, "matter-os-profile-cards.json"), {
    schema_version: "matter-os-profile-cards.v1",
    generated_at: result.generated_at,
    matter_os_profile_count: result.matter_os_profiles.length,
    matter_os_profiles: result.matter_os_profiles,
  });
  await writeJson(path.join(outDir, "matter-os-display-fields.json"), {
    schema_version: "matter-os-display-fields.v1",
    generated_at: result.generated_at,
    display_field_count: result.matter_os_display_fields.length,
    matter_os_display_fields: result.matter_os_display_fields,
  });
  await writeJson(path.join(outDir, "matter-os-profile-boundary.json"), {
    schema_version: "matter-os-profile-boundary-artifact.v1",
    generated_at: result.generated_at,
    matter_os_profile_desktop_boundary: result.matter_os_profile_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-os-profile-validation-report.v1",
    generated_at: result.generated_at,
    matter_os_profile_id: result.matter_os_profile_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterOsProfileCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterOsProfile(args);
    console.log(`Matter OS profile ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_os_profile_status}`);
    console.log(`Profiles: ${result.summary.matter_os_profile_count}`);
    console.log(`Complete profile cards: ${result.summary.complete_profile_card_count}`);
    console.log(`Display field coverage: ${result.summary.display_field_coverage_count}/${result.summary.matter_os_profile_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "matter-os-profile-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    profile_card_rule: "each_matter_os_profile_card_must_display_client_counterparty_matter_number_security_grade_and_responsible_owner",
    matter_boundary_rule: "profile_cards_are_scoped_by_matter_id_and_access_scope",
    attorney_review_rule: "profile_cards_are_operational_context_only_and_do_not_create_legal_or_client_facing_outputs",
    desktop_companion_rule: "desktop_companion_reads_profile_cards_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_write_matter_data_execute_runtime_actions_or_deliver_outputs",
    created_at: generatedAt,
  };
}

function buildMatterOsProfiles({
  generatedAt,
  matterProfileTeamLedger,
  clientCounterpartyRegistry,
  matterContractFreeze,
  lawFirmPackManifest,
}) {
  const matterTeamContract = matterProfileTeamLedger?.matter_team_contract ?? {};
  const registryContract = clientCounterpartyRegistry?.registry_contract ?? {};
  const matterContract = matterContractFreeze?.matter_contract ?? {};
  const profiles = matterTeamContract.matter_profiles ?? [];
  const memberships = matterTeamContract.matter_team_memberships ?? [];
  const rosters = matterTeamContract.matter_team_rosters ?? [];
  const clientRegistry = registryContract.client_registry ?? [];
  const counterpartyRegistry = registryContract.counterparty_registry ?? [];
  const matterPartyLinks = registryContract.matter_party_links ?? [];
  const matters = matterContract.matters ?? [];

  const clientById = new Map(clientRegistry.map((client) => [client.client_id, client]));
  const counterpartyByStableId = new Map(counterpartyRegistry.map((counterparty) => [counterparty.stable_party_id, counterparty]));
  const membershipsByMatter = groupBy(memberships, "matter_id");
  const rosterByMatter = new Map(rosters.map((roster) => [roster.matter_id, roster]));
  const matterById = new Map(matters.map((matter) => [matter.matter_id, matter]));
  const partyLinksByMatter = groupBy(matterPartyLinks, "matter_id");
  const attorneyReviewRequired = lawFirmPackManifest?.summary?.attorney_review_required === true;
  const humanReviewRequired = lawFirmPackManifest?.summary?.human_review_required === true
    || lawFirmPackManifest?.summary?.law_firm_human_review_required === true;

  return profiles.map((profile) => {
    const client = clientById.get(profile.client_id);
    const matter = matterById.get(profile.matter_id);
    const roster = rosterByMatter.get(profile.matter_id);
    const matterMemberships = membershipsByMatter.get(profile.matter_id) ?? [];
    const partyLinks = partyLinksByMatter.get(profile.matter_id) ?? [];
    const counterpartyPartyIds = unique([
      ...(profile.counterparty_party_ids ?? []),
      ...partyLinks.filter((link) => link.party_type !== "client").map((link) => link.stable_party_id),
    ]).sort();
    const counterparties = counterpartyPartyIds
      .map((partyId) => counterpartyByStableId.get(partyId))
      .filter(Boolean)
      .sort(by("stable_party_id"));
    const responsibleOwnerUserIds = unique([
      ...(profile.responsible_partner_user_ids ?? []),
      ...(roster?.responsible_partner_user_ids ?? []),
    ]).sort();
    const reviewerUserIds = unique([...(profile.reviewer_user_ids ?? []), ...(roster?.reviewer_user_ids ?? [])]).sort();
    const displayNameByUserId = new Map(matterMemberships.map((membership) => [membership.user_id, membership.display_name]));
    const responsibleOwnerDisplayNames = responsibleOwnerUserIds.map((userId) => displayNameByUserId.get(userId) ?? userId);
    const reviewerDisplayNames = reviewerUserIds.map((userId) => displayNameByUserId.get(userId) ?? userId);
    const matterNumber = profile.metadata?.client_matter_code
      ?? matter?.metadata?.client_matter_code
      ?? profile.matter_id;
    const displayFields = {
      schema_version: "matter-os-display-fields.v1",
      matter_id: profile.matter_id,
      client: client?.display_name ?? profile.client_id,
      counterparty: counterparties.length > 0 ? counterparties.map((counterparty) => counterparty.display_name).join("; ") : "None recorded",
      matter_number: matterNumber,
      security_grade: profile.classification_floor ?? profile.classification,
      responsible_owner: responsibleOwnerDisplayNames.join("; ") || "Unassigned",
      display_field_status: hasDisplayCoverage({
        clientDisplayName: client?.display_name ?? profile.client_id,
        counterpartyDisplayNames: counterparties.map((counterparty) => counterparty.display_name),
        matterNumber,
        securityGrade: profile.classification_floor ?? profile.classification,
        responsibleOwnerDisplayNames,
      }) ? "complete" : "blocked",
    };

    return {
      schema_version: "matter-os-profile-card.v1",
      matter_os_profile_card_id: `matter-os-profile-card.${slugify(profile.matter_id)}`,
      matter_id: profile.matter_id,
      tenant_id: profile.tenant_id,
      client_id: profile.client_id,
      client_registry_id: profile.client_registry_id,
      client_display_name: client?.display_name ?? profile.client_id,
      client_legal_name: client?.legal_name ?? client?.display_name ?? profile.client_id,
      counterparty_party_ids: counterpartyPartyIds,
      counterparty_display_names: counterparties.map((counterparty) => counterparty.display_name),
      counterparty_roles: counterparties.map((counterparty) => counterparty.counterparty_role ?? "unknown"),
      matter_number: matterNumber,
      matter_name: profile.matter_name,
      practice_area: profile.practice_area,
      matter_status: profile.matter_status,
      profile_status: profile.profile_status,
      security_grade: profile.classification_floor ?? profile.classification,
      classification: profile.classification,
      classification_floor: profile.classification_floor,
      access_scope: profile.access_scope,
      matter_boundary_id: profile.matter_boundary_id,
      wall_ids: [...(profile.wall_ids ?? [])].sort(),
      conflict_ref_ids: [...(profile.conflict_ref_ids ?? [])].sort(),
      default_policy_snapshot_id: profile.default_policy_snapshot_id,
      responsible_owner_user_ids: responsibleOwnerUserIds,
      responsible_owner_display_names: responsibleOwnerDisplayNames,
      reviewer_user_ids: reviewerUserIds,
      reviewer_display_names: reviewerDisplayNames,
      team_member_count: roster?.member_count ?? profile.team_member_user_ids?.length ?? 0,
      active_team_member_count: roster?.active_member_count ?? profile.team_member_user_ids?.length ?? 0,
      attorney_review_required: attorneyReviewRequired,
      human_review_required: humanReviewRequired,
      default_output_status: lawFirmPackManifest?.summary?.default_output_status ?? "pending_review",
      client_facing_output_generated: false,
      legal_advice_provided: false,
      desktop_read_only: true,
      desktop_mutation_allowed: false,
      created_at: profile.created_at ?? generatedAt,
      source_profile_id: profile.matter_profile_id,
      source_team_roster_id: profile.matter_team_roster_id,
      source_schema_version: profile.schema_version,
      display_fields: displayFields,
      profile_card_status: displayFields.display_field_status === "complete"
        && attorneyReviewRequired
        && humanReviewRequired
        && profile.access_scope === "matter_team_only"
        ? "complete"
        : "blocked",
      metadata: {
        source_client_matter_code: profile.metadata?.client_matter_code ?? null,
        source_matter_metadata: profile.metadata?.source_matter_metadata ?? {},
      },
    };
  }).sort(by("matter_os_profile_card_id"));
}

function buildDesktopBoundary(generatedAt, lawFirmPackManifest) {
  return {
    schema_version: "matter-os-profile-desktop-boundary.v1",
    boundary_id: "matter-os-profile-desktop-boundary.read-only",
    boundary_status: "enforced",
    read_only: true,
    mutation_allowed: false,
    source_of_truth: false,
    matter_data_write_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    legal_advice_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    attorney_review_required: lawFirmPackManifest?.summary?.attorney_review_required === true,
    human_review_required: lawFirmPackManifest?.summary?.human_review_required === true
      || lawFirmPackManifest?.summary?.law_firm_human_review_required === true,
    default_output_status: lawFirmPackManifest?.summary?.default_output_status ?? "pending_review",
    created_at: generatedAt,
  };
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  matterProfileTeamLedger,
  clientCounterpartyRegistry,
  matterContractFreeze,
  lawFirmPackManifest,
  matterOsProfiles,
  desktopBoundary,
}) {
  const sourceAvailable = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.available === true;
  const packageScriptPresent = Boolean(packageJson?.scripts?.["matter-os:profile"]);
  const roadmapSlotDeclared = typeof roadmapText === "string" && /P232\s*\|\s*Matter OS profile/.test(roadmapText);
  const completeProfileCards = matterOsProfiles.filter((profile) => profile.profile_card_status === "complete");
  const profilesWithClient = matterOsProfiles.filter((profile) => Boolean(profile.client_display_name));
  const profilesWithCounterparty = matterOsProfiles.filter((profile) => profile.counterparty_display_names.length > 0);
  const profilesWithMatterNumber = matterOsProfiles.filter((profile) => Boolean(profile.matter_number));
  const profilesWithSecurityGrade = matterOsProfiles.filter((profile) => Boolean(profile.security_grade));
  const profilesWithResponsibleOwner = matterOsProfiles.filter((profile) => profile.responsible_owner_display_names.length > 0);
  const profilesWithMatterBoundary = matterOsProfiles.filter((profile) => profile.access_scope === "matter_team_only" && profile.matter_boundary_id);
  const profileCount = matterOsProfiles.length;

  return [
    checkpoint("source_matter_profile_team_ledger_available", sourceAvailable("matter_profile_team_ledger"), "Matter profile/team ledger source is readable."),
    checkpoint("source_client_counterparty_registry_available", sourceAvailable("client_counterparty_registry"), "Client/counterparty registry source is readable."),
    checkpoint("source_matter_contract_freeze_available", sourceAvailable("matter_contract_freeze"), "Matter contract freeze source is readable."),
    checkpoint("source_law_firm_pack_manifest_available", sourceAvailable("law_firm_pack_manifest"), "Law-firm pack manifest source is readable."),
    checkpoint("source_matter_profile_team_ledger_complete", matterProfileTeamLedger?.summary?.ledger_status === "complete", "Matter profile/team ledger is complete."),
    checkpoint("source_client_counterparty_registry_complete", clientCounterpartyRegistry?.summary?.registry_status === "complete", "Client/counterparty registry is complete."),
    checkpoint("source_matter_contract_freeze_complete", matterContractFreeze?.summary?.freeze_status === "complete", "Matter contract freeze is complete."),
    checkpoint("source_law_firm_pack_manifest_complete", lawFirmPackManifest?.summary?.law_firm_pack_manifest_status === "complete", "Law-firm pack manifest is complete."),
    checkpoint("package_script_registered", packageScriptPresent, "package.json exposes matter-os:profile."),
    checkpoint("roadmap_slot_declared", roadmapSlotDeclared, "P232 Matter OS profile planned slot is declared."),
    checkpoint("matter_profile_cards_created", profileCount > 0, "At least one Matter OS profile card is created."),
    checkpoint("client_display_covered", profilesWithClient.length === profileCount && profileCount > 0, "Every Matter OS profile card displays a client.", { passed_count: profilesWithClient.length, expected_count: profileCount }),
    checkpoint("counterparty_display_covered", profilesWithCounterparty.length === profileCount && profileCount > 0, "Every Matter OS profile card displays at least one counterparty.", { passed_count: profilesWithCounterparty.length, expected_count: profileCount }),
    checkpoint("matter_number_display_covered", profilesWithMatterNumber.length === profileCount && profileCount > 0, "Every Matter OS profile card displays a matter number.", { passed_count: profilesWithMatterNumber.length, expected_count: profileCount }),
    checkpoint("security_grade_display_covered", profilesWithSecurityGrade.length === profileCount && profileCount > 0, "Every Matter OS profile card displays a security grade.", { passed_count: profilesWithSecurityGrade.length, expected_count: profileCount }),
    checkpoint("responsible_owner_display_covered", profilesWithResponsibleOwner.length === profileCount && profileCount > 0, "Every Matter OS profile card displays a responsible owner.", { passed_count: profilesWithResponsibleOwner.length, expected_count: profileCount }),
    checkpoint("matter_boundary_preserved", profilesWithMatterBoundary.length === profileCount && profileCount > 0, "Every Matter OS profile card preserves matter-team boundary scope.", { passed_count: profilesWithMatterBoundary.length, expected_count: profileCount }),
    checkpoint("attorney_review_gate_preserved", matterOsProfiles.every((profile) => profile.attorney_review_required === true), "Attorney review remains required for law-firm profile context."),
    checkpoint("default_output_pending_review", matterOsProfiles.every((profile) => profile.default_output_status === "pending_review"), "Profile cards inherit pending_review default output posture."),
    checkpoint("no_legal_or_client_facing_output", matterOsProfiles.every((profile) => profile.legal_advice_provided === false && profile.client_facing_output_generated === false), "Matter OS profile cards do not provide legal advice or generate client-facing output."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false && desktopBoundary.source_of_truth === false, "Desktop boundary is read-only and not source of truth."),
    checkpoint("profile_cards_complete", completeProfileCards.length === profileCount && profileCount > 0, "All Matter OS profile cards are complete.", { passed_count: completeProfileCards.length, expected_count: profileCount }),
  ];
}

function summarizeMatterOsProfile({
  matterProfileTeamLedger,
  clientCounterpartyRegistry,
  matterContractFreeze,
  lawFirmPackManifest,
  matterOsProfiles,
  displayFields,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const profileCount = matterOsProfiles.length;
  const completeProfileCardCount = matterOsProfiles.filter((profile) => profile.profile_card_status === "complete").length;
  const displayFieldCoverageCount = displayFields.filter((field) => field.display_field_status === "complete").length;
  const failedCheckpointCount = checkpoints.filter((checkpoint) => checkpoint.status !== "passed").length;
  const complete = validation.valid
    && failedCheckpointCount === 0
    && profileCount > 0
    && completeProfileCardCount === profileCount
    && displayFieldCoverageCount === profileCount;
  return {
    matter_os_profile_status: complete ? "complete" : "blocked",
    matter_os_profile_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_profile_team_ledger_status: matterProfileTeamLedger?.summary?.ledger_status ?? "unknown",
    source_client_counterparty_registry_status: clientCounterpartyRegistry?.summary?.registry_status ?? "unknown",
    source_matter_contract_freeze_status: matterContractFreeze?.summary?.freeze_status ?? "unknown",
    source_law_firm_pack_manifest_status: lawFirmPackManifest?.summary?.law_firm_pack_manifest_status ?? "unknown",
    matter_os_profile_count: profileCount,
    complete_profile_card_count: completeProfileCardCount,
    display_field_coverage_count: displayFieldCoverageCount,
    client_display_coverage_count: matterOsProfiles.filter((profile) => Boolean(profile.client_display_name)).length,
    counterparty_display_coverage_count: matterOsProfiles.filter((profile) => profile.counterparty_display_names.length > 0).length,
    matter_number_coverage_count: matterOsProfiles.filter((profile) => Boolean(profile.matter_number)).length,
    security_grade_coverage_count: matterOsProfiles.filter((profile) => Boolean(profile.security_grade)).length,
    responsible_owner_coverage_count: matterOsProfiles.filter((profile) => profile.responsible_owner_display_names.length > 0).length,
    matter_boundary_coverage_count: matterOsProfiles.filter((profile) => profile.access_scope === "matter_team_only" && profile.matter_boundary_id).length,
    profile_card_complete_count: completeProfileCardCount,
    attorney_review_required_profile_count: matterOsProfiles.filter((profile) => profile.attorney_review_required === true).length,
    human_review_required_profile_count: matterOsProfiles.filter((profile) => profile.human_review_required === true).length,
    default_pending_review_profile_count: matterOsProfiles.filter((profile) => profile.default_output_status === "pending_review").length,
    legal_advice_provided: matterOsProfiles.some((profile) => profile.legal_advice_provided === true),
    client_facing_output_generated: matterOsProfiles.some((profile) => profile.client_facing_output_generated === true),
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    matter_data_write_allowed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_executed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  const sourceContracts = {};
  for (const source of sourceReads) {
    sourceContracts[source.source_id] = {
      schema_version: source.value?.schema_version ?? null,
      path: source.path,
      available: source.available,
      content_hash: source.content_hash,
      error: source.error,
    };
  }
  sourceContracts.package_json = {
    schema_version: null,
    path: packageJson.path,
    available: packageJson.available,
    content_hash: packageJson.content_hash,
    error: packageJson.error,
  };
  sourceContracts.roadmap = {
    schema_version: null,
    path: roadmapText.path,
    available: roadmapText.available,
    content_hash: roadmapText.content_hash,
    error: roadmapText.error,
  };
  return sourceContracts;
}

function hasDisplayCoverage({
  clientDisplayName,
  counterpartyDisplayNames,
  matterNumber,
  securityGrade,
  responsibleOwnerDisplayNames,
}) {
  return Boolean(clientDisplayName)
    && counterpartyDisplayNames.length > 0
    && Boolean(matterNumber)
    && Boolean(securityGrade)
    && responsibleOwnerDisplayNames.length > 0;
}

async function readSourceArtifacts(inputs) {
  return Promise.all([
    readJsonSource("matter_profile_team_ledger", inputs.matter_profile_team_ledger_path),
    readJsonSource("client_counterparty_registry", inputs.client_counterparty_registry_path),
    readJsonSource("matter_contract_freeze", inputs.matter_contract_freeze_path),
    readJsonSource("law_firm_pack_manifest", inputs.law_firm_pack_manifest_path),
  ]);
}

async function readJsonSource(sourceId, configuredPath) {
  const sourcePath = path.resolve(configuredPath);
  try {
    const text = await readFile(sourcePath, "utf8");
    return {
      source_id: sourceId,
      path: sourcePath,
      available: true,
      value: JSON.parse(text),
      content_hash: hashText(text),
      error: null,
    };
  } catch (error) {
    return {
      source_id: sourceId,
      path: sourcePath,
      available: false,
      value: null,
      content_hash: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readJsonOrError(configuredPath) {
  const sourcePath = path.resolve(configuredPath);
  try {
    const text = await readFile(sourcePath, "utf8");
    return {
      path: sourcePath,
      available: true,
      value: JSON.parse(text),
      content_hash: hashText(text),
      error: null,
    };
  } catch (error) {
    return {
      path: sourcePath,
      available: false,
      value: null,
      content_hash: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

async function readTextOrError(configuredPath) {
  const sourcePath = path.resolve(configuredPath);
  try {
    const text = await readFile(sourcePath, "utf8");
    return {
      path: sourcePath,
      available: true,
      value: text,
      content_hash: hashText(text),
      error: null,
    };
  } catch (error) {
    return {
      path: sourcePath,
      available: false,
      value: null,
      content_hash: null,
      error: error.code === "ENOENT" ? "not_found" : error.message,
    };
  }
}

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    schema_version: "matter-os-profile-checkpoint.v1",
    checkpoint_id: checkpointId,
    checkpoint_status: passed ? "passed" : "failed",
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  return {
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_MATTER_OS_PROFILE_INPUTS.matterProfileTeamLedgerPath),
    client_counterparty_registry_path: path.resolve(options.clientCounterpartyRegistryPath ?? DEFAULT_MATTER_OS_PROFILE_INPUTS.clientCounterpartyRegistryPath),
    matter_contract_freeze_path: path.resolve(options.matterContractFreezePath ?? DEFAULT_MATTER_OS_PROFILE_INPUTS.matterContractFreezePath),
    law_firm_pack_manifest_path: path.resolve(options.lawFirmPackManifestPath ?? DEFAULT_MATTER_OS_PROFILE_INPUTS.lawFirmPackManifestPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_OS_PROFILE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_OS_PROFILE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--client-counterparty-registry") parsed.clientCounterpartyRegistryPath = argv[++index];
    else if (arg === "--matter-contract-freeze") parsed.matterContractFreezePath = argv[++index];
    else if (arg === "--law-firm-pack-manifest") parsed.lawFirmPackManifestPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-os-profile.mjs [options]

Options:
  --check                                      fail when validation errors exist
  --out-dir <path>                            output directory
  --matter-profile-team-ledger <path>         matter profile/team ledger path
  --client-counterparty-registry <path>       client/counterparty registry path
  --matter-contract-freeze <path>             matter contract freeze path
  --law-firm-pack-manifest <path>             law-firm pack manifest path
  --package <path>                            package.json path
  --roadmap <path>                            final phase ledger path
  --run-at <iso>                              deterministic generated_at timestamp
`);
}

function renderMatterOsProfileMarkdown(result) {
  const lines = [];
  lines.push("# Matter OS Profile");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_os_profile_status}`);
  lines.push(`Profiles: ${result.summary.complete_profile_card_count}/${result.summary.matter_os_profile_count}`);
  lines.push(`Display field coverage: ${result.summary.display_field_coverage_count}/${result.summary.matter_os_profile_count}`);
  lines.push(`Desktop boundary: ${result.summary.desktop_boundary_status}, read-only=${result.summary.desktop_read_only}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("| Matter | Client | Counterparty | Matter number | Security grade | Responsible owner | Status |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");
  for (const profile of result.matter_os_profiles) {
    lines.push(`| ${profile.matter_id} | ${profile.display_fields.client} | ${profile.display_fields.counterparty} | ${profile.display_fields.matter_number} | ${profile.display_fields.security_grade} | ${profile.display_fields.responsible_owner} | ${profile.profile_card_status} |`);
  }
  lines.push("");
  lines.push("Human review note: Matter OS profile cards are operational context only. They do not provide legal advice, generate client-facing output, write matter data, execute runtime actions, or deliver outputs; attorney/human review remains required.");
  return `${lines.join("\n")}\n`;
}

function serializableMatterOsProfile(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function hashText(text) {
  return `sha256:${createHash("sha256").update(text).digest("hex")}`;
}

function dateStamp(isoDate) {
  return isoDate.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))];
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (!grouped.has(value)) grouped.set(value, []);
    grouped.get(value).push(item);
  }
  return grouped;
}

function by(key) {
  return (left, right) => String(left?.[key] ?? "").localeCompare(String(right?.[key] ?? ""));
}
