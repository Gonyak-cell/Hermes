import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WALL_POLICY_CONTRACT_OUT_DIR = "artifacts/wall-policy-contract/latest";
export const DEFAULT_WALL_POLICY_CONTRACT_INPUTS = {
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
  clientCounterpartyRegistryPath: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
};

const REQUIRED_RETRIEVAL_FILTER_KEYS = ["tenant_id", "client_id", "matter_id", "wall_ids", "classification"];
const ACCESS_DECISIONS = new Set(["allow", "deny", "review"]);

export async function runWallPolicyContract(options = {}) {
  const result = await buildWallPolicyContract(options);
  if (options.write !== false) await writeWallPolicyContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Wall policy contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWallPolicyContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WALL_POLICY_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const matterContractFreeze = await readJson(inputs.matter_contract_freeze_path);
  const clientCounterpartyRegistry = await readJson(inputs.client_counterparty_registry_path);
  const matterProfileTeamLedger = await readJson(inputs.matter_profile_team_ledger_path);
  const projected = projectWallPolicyContract({ matterContractFreeze, clientCounterpartyRegistry, matterProfileTeamLedger, generatedAt });
  const validationItems = validateWallPolicyContract({ matterContractFreeze, clientCounterpartyRegistry, matterProfileTeamLedger, projected });
  const validation = summarizeValidation(validationItems, projected);
  const result = {
    schema_version: "wall-policy-contract-ledger.v1",
    generated_at: generatedAt,
    wall_policy_ledger_id: `wall-policy-contract.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_matter_contract: summarizeMatterContractSource(matterContractFreeze),
    source_client_counterparty_registry: summarizeClientCounterpartyRegistrySource(clientCounterpartyRegistry),
    source_matter_profile_team_ledger: summarizeMatterProfileTeamSource(matterProfileTeamLedger),
    wall_policy_contract: {
      schema_version: "wall-policy-contract.v1",
      generated_at: generatedAt,
      wall_policy_rules: projected.wallPolicyRules,
      retrieval_wall_filters: projected.retrievalWallFilters,
      wall_subject_bindings: projected.wallSubjectBindings,
      conflict_wall_bindings: projected.conflictWallBindings,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeWallPolicyContract(projected, validationItems, validation, {
      matterContractFreeze,
      clientCounterpartyRegistry,
      matterProfileTeamLedger,
    }),
  };
  return {
    ...result,
    markdown: renderWallPolicyContractMarkdown(result),
  };
}

export async function writeWallPolicyContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLedger(result);
  await writeJson(path.join(outDir, "wall-policy-contract.json"), serializable);
  await writeJson(path.join(outDir, "wall-policy-rules.json"), {
    generated_at: result.generated_at,
    wall_policy_rule_count: result.wall_policy_contract.wall_policy_rules.length,
    wall_policy_rules: result.wall_policy_contract.wall_policy_rules,
  });
  await writeJson(path.join(outDir, "retrieval-wall-filters.json"), {
    generated_at: result.generated_at,
    retrieval_wall_filter_count: result.wall_policy_contract.retrieval_wall_filters.length,
    retrieval_wall_filters: result.wall_policy_contract.retrieval_wall_filters,
  });
  await writeJson(path.join(outDir, "wall-subject-bindings.json"), {
    generated_at: result.generated_at,
    wall_subject_binding_count: result.wall_policy_contract.wall_subject_bindings.length,
    wall_subject_bindings: result.wall_policy_contract.wall_subject_bindings,
  });
  await writeJson(path.join(outDir, "conflict-wall-bindings.json"), {
    generated_at: result.generated_at,
    conflict_wall_binding_count: result.wall_policy_contract.conflict_wall_bindings.length,
    conflict_wall_bindings: result.wall_policy_contract.conflict_wall_bindings,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    wall_policy_ledger_id: result.wall_policy_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWallPolicyContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWallPolicyContract(args);
    console.log(`Wall policy contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.wall_policy_status}`);
    console.log(`Wall policy rules: ${result.summary.wall_policy_rule_count}`);
    console.log(`Retrieval wall filters: ${result.summary.retrieval_wall_filter_count}`);
    console.log(`Wall subject bindings: ${result.summary.wall_subject_binding_count}`);
    console.log(`Conflict wall bindings: ${result.summary.conflict_wall_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectWallPolicyContract({ matterContractFreeze, clientCounterpartyRegistry, matterProfileTeamLedger, generatedAt }) {
  const matterContract = matterContractFreeze.matter_contract ?? {};
  const registryContract = clientCounterpartyRegistry.registry_contract ?? {};
  const teamContract = matterProfileTeamLedger.matter_team_contract ?? {};
  const boundaries = matterContract.matter_boundaries ?? [];
  const profiles = teamContract.matter_profiles ?? [];
  const accessSubjects = teamContract.matter_access_subjects ?? [];
  const conflictReferenceIndex = registryContract.conflict_reference_index ?? [];

  const profileByMatterId = new Map(profiles.map((profile) => [profile.matter_id, profile]));
  const accessSubjectsByMatterId = groupBy(accessSubjects, "matter_id");
  const conflictReferenceByStablePartyId = new Map(conflictReferenceIndex.map((entry) => [entry.stable_party_id, entry]));

  const wallPolicyRules = [];
  const retrievalWallFilters = [];
  const wallSubjectBindings = [];
  const conflictWallBindings = [];

  for (const boundary of boundaries) {
    const profile = profileByMatterId.get(boundary.matter_id);
    const boundaryAccessSubjects = accessSubjectsByMatterId.get(boundary.matter_id) ?? [];
    for (const wallId of boundary.wall_ids ?? []) {
      const wallPolicyRuleId = wallPolicyRuleIdFor(boundary.matter_id, wallId);
      const retrievalWallFilterId = retrievalWallFilterIdFor(boundary.matter_id, wallId);
      const allowedSubjects = boundaryAccessSubjects.filter((subject) => subject.access_decision === "allow");
      const deniedSubjects = boundaryAccessSubjects.filter((subject) => subject.access_decision === "deny");
      wallPolicyRules.push({
        schema_version: "wall-policy-rule.v1",
        wall_policy_rule_id: wallPolicyRuleId,
        wall_id: wallId,
        wall_type: "matter_ethical_wall",
        tenant_id: boundary.tenant_id,
        client_id: boundary.client_id,
        matter_id: boundary.matter_id,
        matter_boundary_id: boundary.matter_boundary_id,
        rule_status: boundary.boundary_status === "active" ? "active" : "inactive",
        enforcement_stage: "pre_retrieval",
        decision_mode: "deny_unless_allowed",
        access_scope: boundary.access_scope,
        retrieval_wall_filter_id: retrievalWallFilterId,
        allowed_access_subject_ids: allowedSubjects.map((subject) => subject.access_subject_id).sort(),
        denied_access_subject_ids: deniedSubjects.map((subject) => subject.access_subject_id).sort(),
        allowed_user_ids: allowedSubjects.map((subject) => subject.user_id).sort(),
        allowed_membership_ids: allowedSubjects.map((subject) => subject.membership_id).filter(Boolean).sort(),
        conflict_ref_ids: [...(profile?.conflict_ref_ids ?? [])].sort(),
        party_ids: [...(boundary.party_ids ?? [])].sort(),
        counterparty_party_ids: [...(boundary.counterparty_party_ids ?? [])].sort(),
        classification_floor: boundary.classification_floor,
        policy_snapshot_id: boundary.policy_snapshot_id,
        created_at: boundary.created_at ?? generatedAt,
        source_schema_version: boundary.schema_version ?? null,
        metadata: {
          source_access_scope: boundary.access_scope,
          source_boundary_status: boundary.boundary_status,
        },
      });

      retrievalWallFilters.push({
        schema_version: "retrieval-wall-filter.v1",
        retrieval_wall_filter_id: retrievalWallFilterId,
        wall_policy_rule_id: wallPolicyRuleId,
        wall_id: wallId,
        tenant_id: boundary.tenant_id,
        client_id: boundary.client_id,
        matter_id: boundary.matter_id,
        matter_boundary_id: boundary.matter_boundary_id,
        enforcement_stage: "pre_retrieval",
        filter_status: "complete",
        required_filter_keys: REQUIRED_RETRIEVAL_FILTER_KEYS,
        deny_if_missing_keys: true,
        resource_query_policy: "must_match_all",
        access_scope: boundary.access_scope,
        wall_ids: [...(boundary.retrieval_filters?.wall_ids ?? boundary.wall_ids ?? [])].sort(),
        classification: boundary.retrieval_filters?.classification ?? boundary.classification,
        retrieval_filters: {
          tenant_id: boundary.retrieval_filters?.tenant_id ?? boundary.tenant_id,
          client_id: boundary.retrieval_filters?.client_id ?? boundary.client_id,
          matter_id: boundary.retrieval_filters?.matter_id ?? boundary.matter_id,
          wall_ids: [...(boundary.retrieval_filters?.wall_ids ?? boundary.wall_ids ?? [])].sort(),
          classification: boundary.retrieval_filters?.classification ?? boundary.classification,
        },
        created_at: boundary.created_at ?? generatedAt,
        metadata: {},
      });

      for (const subject of boundaryAccessSubjects) {
        const allowed = subject.access_decision === "allow" && subject.can_read === true;
        wallSubjectBindings.push({
          schema_version: "wall-subject-binding.v1",
          wall_subject_binding_id: `wall-subject-binding.${slugify(boundary.matter_id)}.${slugify(wallId)}.${slugify(subject.access_subject_id)}`,
          wall_policy_rule_id: wallPolicyRuleId,
          wall_id: wallId,
          matter_id: boundary.matter_id,
          tenant_id: boundary.tenant_id,
          client_id: boundary.client_id,
          access_subject_id: subject.access_subject_id,
          user_id: subject.user_id,
          membership_id: subject.membership_id,
          subject_type: subject.subject_type,
          binding_basis: subject.access_basis,
          access_decision: subject.access_decision,
          pre_retrieval_effect: allowed ? "allow" : "deny",
          can_retrieve: allowed,
          wall_ids: [...(subject.wall_ids ?? [])].sort(),
          created_at: subject.created_at ?? generatedAt,
          metadata: {
            matter_roles: subject.matter_roles ?? [],
          },
        });
      }

      for (const partyId of boundary.party_ids ?? []) {
        const conflictReference = conflictReferenceByStablePartyId.get(partyId);
        conflictWallBindings.push({
          schema_version: "conflict-wall-binding.v1",
          conflict_wall_binding_id: `conflict-wall-binding.${slugify(boundary.matter_id)}.${slugify(wallId)}.${slugify(partyId)}`,
          wall_policy_rule_id: wallPolicyRuleId,
          wall_id: wallId,
          matter_id: boundary.matter_id,
          tenant_id: boundary.tenant_id,
          client_id: boundary.client_id,
          stable_party_id: partyId,
          conflict_ref_id: conflictReference?.conflict_ref_id ?? null,
          party_type: conflictReference?.party_type ?? "unknown",
          conflict_check_status: conflictReference?.conflict_check_status ?? "missing",
          binding_status: conflictReference ? "active" : "quarantined",
          applies_to_stage: "conflict_check_before_retrieval",
          created_at: generatedAt,
          metadata: {
            counterparty_role: conflictReference?.counterparty_role ?? null,
          },
        });
      }
    }
  }

  return {
    wallPolicyRules: wallPolicyRules.sort(by("wall_policy_rule_id")),
    retrievalWallFilters: retrievalWallFilters.sort(by("retrieval_wall_filter_id")),
    wallSubjectBindings: wallSubjectBindings.sort(by("wall_subject_binding_id")),
    conflictWallBindings: conflictWallBindings.sort(by("conflict_wall_binding_id")),
    boundaries,
    profiles,
    accessSubjects,
    conflictReferenceIndex,
  };
}

function validateWallPolicyContract({ matterContractFreeze, clientCounterpartyRegistry, matterProfileTeamLedger, projected }) {
  const validationItems = [];
  const boundaries = matterContractFreeze.matter_contract?.matter_boundaries ?? [];
  const profiles = matterProfileTeamLedger.matter_team_contract?.matter_profiles ?? [];
  const profileByMatterId = new Map(profiles.map((profile) => [profile.matter_id, profile]));
  const accessSubjectsByMatterId = groupBy(matterProfileTeamLedger.matter_team_contract?.matter_access_subjects ?? [], "matter_id");
  const rulesByMatterWall = new Map(projected.wallPolicyRules.map((rule) => [`${rule.matter_id}::${rule.wall_id}`, rule]));
  const filtersByRuleId = new Map(projected.retrievalWallFilters.map((filter) => [filter.wall_policy_rule_id, filter]));
  const subjectBindingsByRuleId = groupBy(projected.wallSubjectBindings, "wall_policy_rule_id");
  const conflictBindingsByRuleId = groupBy(projected.conflictWallBindings, "wall_policy_rule_id");

  pushCheck(validationItems, "source", matterContractFreeze.freeze_id ?? "matter-contract-freeze", "matter_contract_complete", matterContractFreeze.summary?.freeze_status === "complete", "Wall policy contract requires a complete matter contract freeze.");
  pushCheck(validationItems, "source", clientCounterpartyRegistry.registry_id ?? "client-counterparty-registry", "client_counterparty_registry_complete", clientCounterpartyRegistry.summary?.registry_status === "complete", "Wall policy contract requires a complete client/counterparty registry.");
  pushCheck(validationItems, "source", matterProfileTeamLedger.ledger_id ?? "matter-profile-team-ledger", "matter_profile_team_ledger_complete", matterProfileTeamLedger.summary?.ledger_status === "complete", "Wall policy contract requires a complete matter profile/team ledger.");

  pushUniqueIdChecks(validationItems, projected.wallPolicyRules, "wall_policy_rule", "wall_policy_rule_id");
  pushUniqueIdChecks(validationItems, projected.retrievalWallFilters, "retrieval_wall_filter", "retrieval_wall_filter_id");
  pushUniqueIdChecks(validationItems, projected.wallSubjectBindings, "wall_subject_binding", "wall_subject_binding_id");
  pushUniqueIdChecks(validationItems, projected.conflictWallBindings, "conflict_wall_binding", "conflict_wall_binding_id");

  for (const boundary of boundaries) {
    for (const wallId of boundary.wall_ids ?? []) {
      const rule = rulesByMatterWall.get(`${boundary.matter_id}::${wallId}`);
      const filter = rule ? filtersByRuleId.get(rule.wall_policy_rule_id) : null;
      const profile = profileByMatterId.get(boundary.matter_id);
      const accessSubjects = accessSubjectsByMatterId.get(boundary.matter_id) ?? [];
      const subjectBindings = rule ? subjectBindingsByRuleId.get(rule.wall_policy_rule_id) ?? [] : [];
      const conflictBindings = rule ? conflictBindingsByRuleId.get(rule.wall_policy_rule_id) ?? [] : [];
      pushCheck(validationItems, "wall_policy_rule", `${boundary.matter_id}.${wallId}`, "boundary_wall_projected", Boolean(rule), "Each boundary wall id must have a wall policy rule.");
      pushCheck(validationItems, "wall_policy_rule", `${boundary.matter_id}.${wallId}`, "pre_retrieval_enforced", rule?.enforcement_stage === "pre_retrieval", "Wall rule must be enforced before retrieval.");
      pushCheck(validationItems, "wall_policy_rule", `${boundary.matter_id}.${wallId}`, "deny_unless_allowed", rule?.decision_mode === "deny_unless_allowed", "Wall rule must deny unless an allowed team subject is present.");
      pushCheck(validationItems, "wall_policy_rule", `${boundary.matter_id}.${wallId}`, "team_only_scope", rule?.access_scope === "matter_team_only", "Wall rule access scope must be matter_team_only.");
      pushCheck(validationItems, "wall_policy_rule", `${boundary.matter_id}.${wallId}`, "allowed_subject_present", (rule?.allowed_access_subject_ids ?? []).length > 0, "Wall rule must preserve at least one allowed access subject.");
      pushCheck(validationItems, "wall_policy_rule", `${boundary.matter_id}.${wallId}`, "conflict_refs_bound", (rule?.conflict_ref_ids ?? []).length === (profile?.conflict_ref_ids ?? []).length && (rule?.conflict_ref_ids ?? []).length > 0, "Wall rule must bind all profile conflict references.");
      pushCheck(validationItems, "retrieval_wall_filter", `${boundary.matter_id}.${wallId}`, "filter_projected", Boolean(filter), "Each wall policy rule must have a retrieval wall filter.");
      pushCheck(validationItems, "retrieval_wall_filter", `${boundary.matter_id}.${wallId}`, "filter_pre_retrieval", filter?.enforcement_stage === "pre_retrieval", "Retrieval wall filter must run before retrieval.");
      pushCheck(validationItems, "retrieval_wall_filter", `${boundary.matter_id}.${wallId}`, "filter_keys_complete", REQUIRED_RETRIEVAL_FILTER_KEYS.every((key) => filter?.required_filter_keys?.includes(key)), "Retrieval wall filter must include tenant, client, matter, wall, and classification keys.");
      pushCheck(validationItems, "retrieval_wall_filter", `${boundary.matter_id}.${wallId}`, "wall_filter_matches_boundary", Boolean(filter?.wall_ids?.includes(wallId) && filter?.retrieval_filters?.matter_id === boundary.matter_id), "Retrieval wall filter must match the source boundary.");
      pushCheck(validationItems, "wall_subject_binding", `${boundary.matter_id}.${wallId}`, "subject_bindings_complete", subjectBindings.length === accessSubjects.length && subjectBindings.length > 0, "Each matter access subject must have a wall subject binding.");
      pushCheck(validationItems, "wall_subject_binding", `${boundary.matter_id}.${wallId}`, "allowed_bindings_can_retrieve", subjectBindings.filter((binding) => binding.access_decision === "allow").every((binding) => binding.can_retrieve === true), "Allowed subject bindings must be retrieval-capable.");
      pushCheck(validationItems, "conflict_wall_binding", `${boundary.matter_id}.${wallId}`, "conflict_bindings_complete", conflictBindings.length === (boundary.party_ids ?? []).length && conflictBindings.length > 0, "Each boundary party must have a conflict wall binding.");
      pushCheck(validationItems, "conflict_wall_binding", `${boundary.matter_id}.${wallId}`, "conflict_bindings_ready", conflictBindings.every((binding) => binding.conflict_check_status === "ready"), "Conflict wall bindings must be ready before retrieval.");
    }
  }

  for (const binding of projected.wallSubjectBindings) {
    pushCheck(validationItems, "wall_subject_binding", binding.wall_subject_binding_id, "decision_supported", ACCESS_DECISIONS.has(binding.access_decision), "Wall subject binding access decision must be supported.");
    pushCheck(validationItems, "wall_subject_binding", binding.wall_subject_binding_id, "pre_retrieval_effect_matches_decision", binding.pre_retrieval_effect === (binding.access_decision === "allow" ? "allow" : "deny"), "Pre-retrieval effect must match access decision.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function summarizeValidation(validationItems, projected) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projected.wallPolicyRules.length === 0) errors.push({ path: "wall_policy_contract.wall_policy_rules", message: "At least one wall policy rule is required." });
  if (projected.retrievalWallFilters.length === 0) errors.push({ path: "wall_policy_contract.retrieval_wall_filters", message: "At least one retrieval wall filter is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeWallPolicyContract(projected, validationItems, validation, sources) {
  return {
    wall_policy_status: validation.valid ? "complete" : "blocked",
    source_matter_contract_status: sources.matterContractFreeze.summary?.freeze_status ?? "unknown",
    source_client_counterparty_registry_status: sources.clientCounterpartyRegistry.summary?.registry_status ?? "unknown",
    source_matter_profile_team_ledger_status: sources.matterProfileTeamLedger.summary?.ledger_status ?? "unknown",
    wall_policy_rule_count: projected.wallPolicyRules.length,
    active_wall_policy_rule_count: projected.wallPolicyRules.filter((rule) => rule.rule_status === "active").length,
    pre_retrieval_rule_count: projected.wallPolicyRules.filter((rule) => rule.enforcement_stage === "pre_retrieval").length,
    deny_unless_allowed_rule_count: projected.wallPolicyRules.filter((rule) => rule.decision_mode === "deny_unless_allowed").length,
    retrieval_wall_filter_count: projected.retrievalWallFilters.length,
    complete_retrieval_wall_filter_count: projected.retrievalWallFilters.filter((filter) => filter.filter_status === "complete").length,
    wall_subject_binding_count: projected.wallSubjectBindings.length,
    allowed_wall_subject_binding_count: projected.wallSubjectBindings.filter((binding) => binding.pre_retrieval_effect === "allow").length,
    denied_wall_subject_binding_count: projected.wallSubjectBindings.filter((binding) => binding.pre_retrieval_effect === "deny").length,
    conflict_wall_binding_count: projected.conflictWallBindings.length,
    ready_conflict_wall_binding_count: projected.conflictWallBindings.filter((binding) => binding.conflict_check_status === "ready").length,
    matter_with_wall_policy_count: new Set(projected.wallPolicyRules.map((rule) => rule.matter_id)).size,
    wall_id_count: new Set(projected.wallPolicyRules.map((rule) => rule.wall_id)).size,
    required_filter_key_count: new Set(projected.retrievalWallFilters.flatMap((filter) => filter.required_filter_keys)).size,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_rule_status: countBy(projected.wallPolicyRules, "rule_status"),
    by_enforcement_stage: countBy(projected.wallPolicyRules, "enforcement_stage"),
    by_pre_retrieval_effect: countBy(projected.wallSubjectBindings, "pre_retrieval_effect"),
    by_tenant_id: countBy(projected.wallPolicyRules, "tenant_id"),
  };
}

function summarizeMatterContractSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    freeze_id: source.freeze_id ?? null,
    freeze_status: source.summary?.freeze_status ?? "unknown",
    matter_count: source.matter_contract?.matters?.length ?? 0,
    matter_boundary_count: source.matter_contract?.matter_boundaries?.length ?? 0,
    matter_with_wall_count: source.summary?.matter_with_wall_count ?? 0,
  };
}

function summarizeClientCounterpartyRegistrySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    registry_id: source.registry_id ?? null,
    registry_status: source.summary?.registry_status ?? "unknown",
    conflict_reference_count: source.summary?.conflict_reference_count ?? 0,
    matter_party_link_count: source.summary?.matter_party_link_count ?? 0,
  };
}

function summarizeMatterProfileTeamSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    ledger_id: source.ledger_id ?? null,
    ledger_status: source.summary?.ledger_status ?? "unknown",
    matter_profile_count: source.summary?.matter_profile_count ?? 0,
    matter_access_subject_count: source.summary?.matter_access_subject_count ?? 0,
    allowed_access_subject_count: source.summary?.allowed_access_subject_count ?? 0,
  };
}

function renderWallPolicyContractMarkdown(result) {
  const lines = [];
  lines.push("# Wall Policy Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.wall_policy_status}`);
  lines.push("");
  lines.push(`- Wall policy rules: ${result.summary.wall_policy_rule_count}`);
  lines.push(`- Retrieval wall filters: ${result.summary.retrieval_wall_filter_count}`);
  lines.push(`- Wall subject bindings: ${result.summary.wall_subject_binding_count}`);
  lines.push(`- Conflict wall bindings: ${result.summary.conflict_wall_binding_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Rules");
  for (const rule of result.wall_policy_contract.wall_policy_rules) {
    lines.push(`- ${rule.wall_policy_rule_id}: ${rule.matter_id} (${rule.enforcement_stage}, ${rule.decision_mode})`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    matter_contract_freeze_path: path.resolve(options.matterContractFreezePath ?? DEFAULT_WALL_POLICY_CONTRACT_INPUTS.matterContractFreezePath),
    client_counterparty_registry_path: path.resolve(options.clientCounterpartyRegistryPath ?? DEFAULT_WALL_POLICY_CONTRACT_INPUTS.clientCounterpartyRegistryPath),
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_WALL_POLICY_CONTRACT_INPUTS.matterProfileTeamLedgerPath),
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
    else if (arg === "--client-counterparty-registry") parsed.clientCounterpartyRegistryPath = argv[++index];
    else if (arg === "--matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/wall-policy-contract.mjs [options]

Options:
  --matter-contract-freeze <path>        matter-contract-freeze.json path.
  --client-counterparty-registry <path>  client-counterparty-registry.json path.
  --matter-profile-team-ledger <path>    matter-profile-team-ledger.json path.
  --out-dir <path>                       Output directory.
  --run-at <iso>                         Deterministic timestamp.
  --check                                Exit non-zero when validation fails.
  --no-write                             Build without writing artifacts.
`);
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
    validation_id: `wall-policy-contract-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
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

function wallPolicyRuleIdFor(matterId, wallId) {
  return `wall-policy-rule.${slugify(matterId)}.${slugify(wallId)}`;
}

function retrievalWallFilterIdFor(matterId, wallId) {
  return `retrieval-wall-filter.${slugify(matterId)}.${slugify(wallId)}`;
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
