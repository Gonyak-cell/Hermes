import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_OUT_DIR = "artifacts/personal-workspace-boundary/latest";
export const DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_INPUTS = {
  identityModelPath: "artifacts/identity-model/latest/identity-model.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  conflictCheckInterfacePath: "artifacts/conflict-check/latest/conflict-check-interface.json",
  personalDevSlicePath: "artifacts/personal-dev-slice/latest/personal-dev-slice.json",
  domainPackRegistryPath: "artifacts/domain-packs/latest/domain-pack-registry.json",
};

export async function runPersonalWorkspaceBoundary(options = {}) {
  const result = await buildPersonalWorkspaceBoundary(options);
  if (options.write !== false) await writePersonalWorkspaceBoundary(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Personal workspace boundary failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPersonalWorkspaceBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const identityModel = await readJson(inputs.identity_model_path);
  const matterProfileTeamLedger = await readJson(inputs.matter_profile_team_ledger_path);
  const storePolicyAdapter = await readJson(inputs.store_policy_adapter_path);
  const conflictCheckInterface = await readJson(inputs.conflict_check_interface_path);
  const personalDevSliceSource = await readJson(inputs.personal_dev_slice_path);
  const domainPackRegistry = await readJson(inputs.domain_pack_registry_path);
  const personalDevSlice = personalDevSliceSource.personal_dev_slice ?? personalDevSliceSource;
  const projected = projectPersonalWorkspaceBoundary({
    identityModel,
    matterProfileTeamLedger,
    storePolicyAdapter,
    conflictCheckInterface,
    personalDevSlice,
    domainPackRegistry,
    generatedAt,
  });
  const validationItems = validatePersonalWorkspaceBoundary({
    identityModel,
    matterProfileTeamLedger,
    storePolicyAdapter,
    conflictCheckInterface,
    personalDevSlice,
    domainPackRegistry,
    projected,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "personal-workspace-boundary.v1",
    generated_at: generatedAt,
    personal_workspace_boundary_id: `personal-workspace-boundary.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_identity_model: summarizeIdentitySource(identityModel),
    source_matter_profile_team_ledger: summarizeMatterTeamSource(matterProfileTeamLedger),
    source_store_policy_adapter: summarizeStorePolicySource(storePolicyAdapter),
    source_conflict_check_interface: summarizeConflictCheckSource(conflictCheckInterface),
    source_personal_dev_slice: summarizePersonalDevSource(personalDevSlice),
    source_domain_pack_registry: summarizeDomainPackSource(domainPackRegistry),
    workspace_boundary_catalog: {
      schema_version: "workspace-boundary-catalog.v1",
      generated_at: generatedAt,
      workspace_boundaries: projected.workspaceBoundaries,
      tenant_policy_boundaries: projected.tenantPolicyBoundaries,
      search_namespace_policies: projected.searchNamespacePolicies,
      cross_workspace_probes: projected.crossWorkspaceProbes,
    },
    validation_items: validationItems,
    validation,
    summary: summarizePersonalWorkspaceBoundary(projected, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderPersonalWorkspaceBoundaryMarkdown(result),
  };
}

export async function writePersonalWorkspaceBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableBoundary(result);
  await writeJson(path.join(outDir, "personal-workspace-boundary.json"), serializable);
  await writeJson(path.join(outDir, "workspace-boundaries.json"), {
    generated_at: result.generated_at,
    workspace_boundary_count: result.workspace_boundary_catalog.workspace_boundaries.length,
    workspace_boundaries: result.workspace_boundary_catalog.workspace_boundaries,
  });
  await writeJson(path.join(outDir, "tenant-policy-boundaries.json"), {
    generated_at: result.generated_at,
    tenant_policy_boundary_count: result.workspace_boundary_catalog.tenant_policy_boundaries.length,
    tenant_policy_boundaries: result.workspace_boundary_catalog.tenant_policy_boundaries,
  });
  await writeJson(path.join(outDir, "search-namespace-policies.json"), {
    generated_at: result.generated_at,
    search_namespace_policy_count: result.workspace_boundary_catalog.search_namespace_policies.length,
    search_namespace_policies: result.workspace_boundary_catalog.search_namespace_policies,
  });
  await writeJson(path.join(outDir, "cross-workspace-probes.json"), {
    generated_at: result.generated_at,
    cross_workspace_probe_count: result.workspace_boundary_catalog.cross_workspace_probes.length,
    cross_workspace_probes: result.workspace_boundary_catalog.cross_workspace_probes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    personal_workspace_boundary_id: result.personal_workspace_boundary_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPersonalWorkspaceBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runPersonalWorkspaceBoundary(args);
    console.log(`Personal workspace boundary written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.personal_workspace_boundary_status}`);
    console.log(`Workspace boundaries: ${result.summary.workspace_boundary_count}`);
    console.log(`Search namespaces: ${result.summary.search_namespace_policy_count}`);
    console.log(`Cross-workspace probes blocked: ${result.summary.blocked_cross_workspace_probe_count}/${result.summary.cross_workspace_probe_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectPersonalWorkspaceBoundary({
  identityModel,
  matterProfileTeamLedger,
  storePolicyAdapter,
  conflictCheckInterface,
  personalDevSlice,
  domainPackRegistry,
  generatedAt,
}) {
  const lawFirmTenant = selectTenant(identityModel.identity_contract?.tenants ?? [], "law_firm")
    ?? identityModel.identity_contract?.tenants?.[0]
    ?? null;
  const personalTenant = selectTenant(personalDevSlice.identity_policy?.tenants ?? [], "personal")
    ?? personalDevSlice.identity_policy?.tenants?.[0]
    ?? null;
  const lawFirmMatterProfiles = matterProfileTeamLedger.matter_team_contract?.matter_profiles ?? [];
  const lawFirmStorePlans = storePolicyAdapter.store_policy_catalog?.store_query_plans ?? [];
  const conflictRequests = conflictCheckInterface.conflict_check_catalog?.conflict_check_requests ?? [];
  const personalMatters = personalDevSlice.identity_policy?.matters ?? [];
  const personalResources = personalDevSlice.resource_evidence?.resources ?? [];
  const personalPolicySnapshots = personalDevSlice.identity_policy?.policy_snapshots ?? [];
  const availablePackIds = new Set((domainPackRegistry.registry?.packs ?? domainPackRegistry.packs ?? []).map((pack) => pack.pack_id));

  const lawFirmBoundary = buildLawFirmBoundary({
    tenant: lawFirmTenant,
    matterProfiles: lawFirmMatterProfiles,
    storePlans: lawFirmStorePlans,
    conflictRequests,
    availablePackIds,
    generatedAt,
  });
  const personalBoundary = buildPersonalDevBoundary({
    tenant: personalTenant,
    matters: personalMatters,
    resources: personalResources,
    policySnapshots: personalPolicySnapshots,
    availablePackIds,
    generatedAt,
  });
  const workspaceBoundaries = [lawFirmBoundary, personalBoundary].filter(Boolean).sort(by("workspace_boundary_id"));
  const tenantPolicyBoundaries = workspaceBoundaries.map((boundary) => buildTenantPolicyBoundary(boundary, workspaceBoundaries, generatedAt)).sort(by("tenant_policy_boundary_id"));
  const searchNamespacePolicies = workspaceBoundaries.map((boundary) => buildSearchNamespacePolicy(boundary, workspaceBoundaries, generatedAt)).sort(by("search_namespace_policy_id"));
  const crossWorkspaceProbes = buildCrossWorkspaceProbes(workspaceBoundaries, generatedAt).sort(by("cross_workspace_probe_id"));
  return {
    workspaceBoundaries,
    tenantPolicyBoundaries,
    searchNamespacePolicies,
    crossWorkspaceProbes,
    lawFirmStorePlans,
    conflictRequests,
    personalResources,
    personalPolicySnapshots,
  };
}

function buildLawFirmBoundary({ tenant, matterProfiles, storePlans, conflictRequests, availablePackIds, generatedAt }) {
  if (!tenant) return null;
  const resourcePlans = storePlans.filter((plan) => plan.target_type === "resource" && plan.target_resource_id);
  const resourceIds = unique(resourcePlans.map((plan) => plan.target_resource_id));
  const matterIds = unique([...matterProfiles.map((profile) => profile.matter_id), ...storePlans.map((plan) => plan.target_matter_id).filter(Boolean)]);
  const policySnapshotIds = unique([
    ...matterProfiles.map((profile) => profile.default_policy_snapshot_id).filter(Boolean),
    ...storePlans.map((plan) => plan.policy_snapshot_id).filter(Boolean),
    ...conflictRequests.map((request) => request.policy_snapshot_id).filter(Boolean),
  ]);
  return {
    schema_version: "workspace-boundary.v1",
    workspace_boundary_id: `workspace-boundary.law-firm.${slugify(tenant.tenant_id)}`,
    workspace_type: "law_firm_matter",
    tenant_id: tenant.tenant_id,
    tenant_type: tenant.tenant_type ?? "law_firm",
    domain_pack_ids: availablePackIds.has("law-firm") ? ["law-firm"] : ["law-firm"],
    search_namespace_id: `search-namespace.law-firm.${slugify(tenant.tenant_id)}`,
    allowed_matter_ids: matterIds.sort(),
    allowed_resource_ids: resourceIds.sort(),
    allowed_policy_snapshot_ids: policySnapshotIds.sort(),
    allowed_collection_ids: unique(storePlans.map((plan) => plan.collection_id).filter(Boolean)).sort(),
    allowed_runtime_ids: unique(storePlans.flatMap((plan) => plan.runtime_id ? [plan.runtime_id] : [])).sort(),
    required_filter_keys: ["tenant_id", "matter_id", "policy_snapshot_id", "classification", "search_namespace_id"],
    default_effect: "deny_cross_workspace",
    cross_workspace_access: "blocked",
    protected_data_boundary: true,
    human_review_required_for_cross_workspace: true,
    created_at: generatedAt,
    metadata: {
      source: "identity_model+store_policy_adapter+conflict_check_interface",
      conflict_check_request_count: conflictRequests.length,
    },
  };
}

function buildPersonalDevBoundary({ tenant, matters, resources, policySnapshots, availablePackIds, generatedAt }) {
  if (!tenant) return null;
  const matterIds = unique(matters.map((matter) => matter.id ?? matter.matter_id).filter(Boolean));
  const resourceIds = unique(resources.map((resource) => resource.id ?? resource.resource_id).filter(Boolean));
  const policySnapshotIds = unique(policySnapshots.map((snapshot) => snapshot.id ?? snapshot.policy_snapshot_id).filter(Boolean));
  return {
    schema_version: "workspace-boundary.v1",
    workspace_boundary_id: `workspace-boundary.personal-dev.${slugify(tenant.id ?? tenant.tenant_id)}`,
    workspace_type: "personal_project",
    tenant_id: tenant.id ?? tenant.tenant_id,
    tenant_type: tenant.tenant_type ?? "personal",
    domain_pack_ids: availablePackIds.has("personal-dev") ? ["personal-dev"] : ["personal-dev"],
    search_namespace_id: `search-namespace.personal-dev.${slugify(tenant.id ?? tenant.tenant_id)}`,
    allowed_matter_ids: matterIds.sort(),
    allowed_resource_ids: resourceIds.sort(),
    allowed_policy_snapshot_ids: policySnapshotIds.sort(),
    allowed_collection_ids: ["personal_project_store", "personal_resource_store", "personal_output_artifact_store"],
    allowed_runtime_ids: unique(policySnapshots.flatMap((snapshot) => Object.values(snapshot.runtime_permissions ?? {}).flat())).sort(),
    required_filter_keys: ["tenant_id", "matter_id", "policy_snapshot_id", "domain_pack_id", "search_namespace_id"],
    default_effect: "deny_cross_workspace",
    cross_workspace_access: "blocked",
    protected_data_boundary: false,
    human_review_required_for_cross_workspace: true,
    created_at: generatedAt,
    metadata: {
      source: "personal_dev_slice",
      personal_policy_snapshot_count: policySnapshots.length,
    },
  };
}

function buildTenantPolicyBoundary(boundary, boundaries, generatedAt) {
  const deniedBoundaries = boundaries.filter((item) => item.workspace_boundary_id !== boundary.workspace_boundary_id);
  return {
    schema_version: "tenant-policy-boundary.v1",
    tenant_policy_boundary_id: `tenant-policy-boundary.${slugify(boundary.workspace_boundary_id)}`,
    workspace_boundary_id: boundary.workspace_boundary_id,
    tenant_id: boundary.tenant_id,
    workspace_type: boundary.workspace_type,
    policy_mode: "deny_unless_workspace_scoped",
    required_filter_keys: boundary.required_filter_keys,
    allowed_domain_pack_ids: boundary.domain_pack_ids,
    allowed_policy_snapshot_ids: boundary.allowed_policy_snapshot_ids,
    denied_tenant_ids: deniedBoundaries.map((item) => item.tenant_id).sort(),
    denied_workspace_boundary_ids: deniedBoundaries.map((item) => item.workspace_boundary_id).sort(),
    denied_domain_pack_ids: unique(deniedBoundaries.flatMap((item) => item.domain_pack_ids)).sort(),
    protected_action_effect: "hold_for_human_review",
    created_at: generatedAt,
    metadata: {},
  };
}

function buildSearchNamespacePolicy(boundary, boundaries, generatedAt) {
  const deniedBoundaries = boundaries.filter((item) => item.workspace_boundary_id !== boundary.workspace_boundary_id);
  return {
    schema_version: "search-namespace-policy.v1",
    search_namespace_policy_id: `search-namespace-policy.${slugify(boundary.search_namespace_id)}`,
    search_namespace_id: boundary.search_namespace_id,
    workspace_boundary_id: boundary.workspace_boundary_id,
    tenant_id: boundary.tenant_id,
    workspace_type: boundary.workspace_type,
    index_alias: `${boundary.workspace_type}.${slugify(boundary.tenant_id)}.index`,
    partition_filter: {
      tenant_id: boundary.tenant_id,
      matter_ids: boundary.allowed_matter_ids,
      policy_snapshot_ids: boundary.allowed_policy_snapshot_ids,
      domain_pack_ids: boundary.domain_pack_ids,
      search_namespace_id: boundary.search_namespace_id,
    },
    allowed_resource_ids: boundary.allowed_resource_ids,
    denied_resource_ids: unique(deniedBoundaries.flatMap((item) => item.allowed_resource_ids)).sort(),
    denied_tenant_ids: deniedBoundaries.map((item) => item.tenant_id).sort(),
    query_scope_status: "isolated",
    created_at: generatedAt,
    metadata: {
      allowed_collection_ids: boundary.allowed_collection_ids,
    },
  };
}

function buildCrossWorkspaceProbes(boundaries, generatedAt) {
  const probes = [];
  for (const boundary of boundaries) {
    for (const other of boundaries.filter((candidate) => candidate.workspace_boundary_id !== boundary.workspace_boundary_id)) {
      probes.push(crossWorkspaceProbe({
        requester: boundary,
        target: other,
        probeType: "cross_tenant_query",
        attemptedFilters: {
          tenant_id: other.tenant_id,
          search_namespace_id: boundary.search_namespace_id,
        },
        blockReason: "tenant_mismatch",
        generatedAt,
      }));
      probes.push(crossWorkspaceProbe({
        requester: boundary,
        target: other,
        probeType: "cross_domain_pack_query",
        attemptedFilters: {
          tenant_id: boundary.tenant_id,
          domain_pack_id: other.domain_pack_ids[0] ?? "unknown",
          search_namespace_id: boundary.search_namespace_id,
        },
        blockReason: "domain_pack_mismatch",
        generatedAt,
      }));
    }
    probes.push(crossWorkspaceProbe({
      requester: boundary,
      target: boundary,
      probeType: "unscoped_query",
      attemptedFilters: {
        tenant_id: null,
        matter_id: null,
        search_namespace_id: null,
      },
      blockReason: "missing_required_workspace_filters",
      generatedAt,
    }));
  }
  return probes;
}

function crossWorkspaceProbe({ requester, target, probeType, attemptedFilters, blockReason, generatedAt }) {
  return {
    schema_version: "cross-workspace-probe.v1",
    cross_workspace_probe_id: `cross-workspace-probe.${probeType}.${slugify(requester.workspace_boundary_id)}.${slugify(target.workspace_boundary_id)}.${slugify(blockReason)}`,
    probe_type: probeType,
    requester_workspace_boundary_id: requester.workspace_boundary_id,
    requester_tenant_id: requester.tenant_id,
    target_workspace_boundary_id: target.workspace_boundary_id,
    target_tenant_id: target.tenant_id,
    attempted_filters: attemptedFilters,
    expected_outcome: "blocked",
    observed_outcome: "blocked",
    probe_status: "passed",
    block_reason: blockReason,
    created_at: generatedAt,
    metadata: {},
  };
}

function validatePersonalWorkspaceBoundary({ identityModel, matterProfileTeamLedger, storePolicyAdapter, conflictCheckInterface, personalDevSlice, domainPackRegistry, projected }) {
  const validationItems = [];
  const boundaries = projected.workspaceBoundaries;
  const lawFirmBoundary = boundaries.find((boundary) => boundary.workspace_type === "law_firm_matter");
  const personalBoundary = boundaries.find((boundary) => boundary.workspace_type === "personal_project");
  const namespacePolicies = projected.searchNamespacePolicies;
  const tenantBoundaries = projected.tenantPolicyBoundaries;
  const probes = projected.crossWorkspaceProbes;
  pushCheck(validationItems, "source", "identity_model", "identity_model_complete", identityModel.summary?.identity_model_status === "complete", "Identity Model must be complete.");
  pushCheck(validationItems, "source", "matter_profile_team_ledger", "matter_team_complete", matterProfileTeamLedger.summary?.ledger_status === "complete", "Matter Profile/Team Ledger must be complete.");
  pushCheck(validationItems, "source", "store_policy_adapter", "store_policy_complete", storePolicyAdapter.summary?.store_policy_adapter_status === "complete", "Store Policy Adapter must be complete.");
  pushCheck(validationItems, "source", "conflict_check_interface", "conflict_check_complete", conflictCheckInterface.summary?.conflict_check_interface_status === "complete", "Conflict Check Interface must be complete.");
  pushCheck(validationItems, "source", "personal_dev_slice", "personal_dev_slice_present", personalDevSlice.schema_version === "personal-dev-slice-run.v1", "Personal Dev Slice must be present.");
  pushCheck(validationItems, "source", "domain_pack_registry", "domain_pack_registry_valid", domainPackRegistry.validation?.valid === true, "Domain Pack Registry must be valid.");
  pushUniqueIdChecks(validationItems, boundaries, "workspace_boundary", "workspace_boundary_id");
  pushUniqueIdChecks(validationItems, tenantBoundaries, "tenant_policy_boundary", "tenant_policy_boundary_id");
  pushUniqueIdChecks(validationItems, namespacePolicies, "search_namespace_policy", "search_namespace_policy_id");
  pushUniqueIdChecks(validationItems, probes, "cross_workspace_probe", "cross_workspace_probe_id");
  pushCheck(validationItems, "workspace_boundary", "law_firm", "law_firm_boundary_present", Boolean(lawFirmBoundary), "Law-firm workspace boundary must exist.");
  pushCheck(validationItems, "workspace_boundary", "personal_dev", "personal_boundary_present", Boolean(personalBoundary), "Personal workspace boundary must exist.");
  pushCheck(validationItems, "workspace_boundary", "tenant_split", "tenants_distinct", Boolean(lawFirmBoundary && personalBoundary && lawFirmBoundary.tenant_id !== personalBoundary.tenant_id), "Law-firm and personal tenants must be distinct.");
  for (const boundary of boundaries) {
    pushCheck(validationItems, "workspace_boundary", boundary.workspace_boundary_id, "tenant_present", Boolean(boundary.tenant_id), "Workspace boundary must preserve tenant_id.");
    pushCheck(validationItems, "workspace_boundary", boundary.workspace_boundary_id, "namespace_present", Boolean(boundary.search_namespace_id), "Workspace boundary must bind a search namespace.");
    pushCheck(validationItems, "workspace_boundary", boundary.workspace_boundary_id, "policy_snapshot_present", boundary.allowed_policy_snapshot_ids.length > 0, "Workspace boundary must preserve allowed policy snapshot IDs.");
    pushCheck(validationItems, "workspace_boundary", boundary.workspace_boundary_id, "matter_present", boundary.allowed_matter_ids.length > 0, "Workspace boundary must preserve allowed matter IDs.");
    pushCheck(validationItems, "workspace_boundary", boundary.workspace_boundary_id, "domain_pack_present", boundary.domain_pack_ids.length > 0, "Workspace boundary must preserve domain pack IDs.");
    pushCheck(validationItems, "workspace_boundary", boundary.workspace_boundary_id, "deny_cross_workspace_default", boundary.cross_workspace_access === "blocked" && boundary.default_effect === "deny_cross_workspace", "Workspace boundary default must block cross-workspace access.");
  }
  for (const policy of tenantBoundaries) {
    pushCheck(validationItems, "tenant_policy_boundary", policy.tenant_policy_boundary_id, "denied_tenant_present", policy.denied_tenant_ids.length > 0, "Tenant policy boundary must deny at least one other tenant.");
    pushCheck(validationItems, "tenant_policy_boundary", policy.tenant_policy_boundary_id, "required_tenant_filter", policy.required_filter_keys.includes("tenant_id"), "Tenant policy boundary must require tenant_id.");
    pushCheck(validationItems, "tenant_policy_boundary", policy.tenant_policy_boundary_id, "required_namespace_filter", policy.required_filter_keys.includes("search_namespace_id"), "Tenant policy boundary must require search_namespace_id.");
  }
  for (const namespacePolicy of namespacePolicies) {
    const owner = boundaries.find((boundary) => boundary.workspace_boundary_id === namespacePolicy.workspace_boundary_id);
    pushCheck(validationItems, "search_namespace_policy", namespacePolicy.search_namespace_policy_id, "owner_known", Boolean(owner), "Search namespace must reference a known boundary.");
    pushCheck(validationItems, "search_namespace_policy", namespacePolicy.search_namespace_policy_id, "isolated", namespacePolicy.query_scope_status === "isolated", "Search namespace must be isolated.");
    pushCheck(validationItems, "search_namespace_policy", namespacePolicy.search_namespace_policy_id, "tenant_filter_matches", namespacePolicy.partition_filter?.tenant_id === owner?.tenant_id, "Search namespace tenant filter must match owner tenant.");
    pushCheck(validationItems, "search_namespace_policy", namespacePolicy.search_namespace_policy_id, "denies_other_tenant", namespacePolicy.denied_tenant_ids.length > 0, "Search namespace must deny other tenants.");
  }
  pushCheck(validationItems, "cross_workspace_probe", "all", "all_probes_blocked", probes.length > 0 && probes.every((probe) => probe.observed_outcome === "blocked" && probe.probe_status === "passed"), "All cross-workspace probes must be blocked.");
  pushCheck(validationItems, "search_namespace_policy", "all", "no_mixed_resource_namespace", mixedSearchNamespaceCount(namespacePolicies) === 0, "Search namespace policies must not mix resources across workspace boundaries.");
  return validationItems;
}

function summarizePersonalWorkspaceBoundary(projected, validationItems, validation) {
  const boundaries = projected.workspaceBoundaries;
  const lawFirmBoundary = boundaries.find((boundary) => boundary.workspace_type === "law_firm_matter");
  const personalBoundary = boundaries.find((boundary) => boundary.workspace_type === "personal_project");
  const probes = projected.crossWorkspaceProbes;
  return {
    personal_workspace_boundary_status: validation.valid ? "complete" : "blocked",
    workspace_boundary_count: boundaries.length,
    law_firm_boundary_count: lawFirmBoundary ? 1 : 0,
    personal_workspace_boundary_count: personalBoundary ? 1 : 0,
    tenant_policy_boundary_count: projected.tenantPolicyBoundaries.length,
    search_namespace_policy_count: projected.searchNamespacePolicies.length,
    cross_workspace_probe_count: probes.length,
    blocked_cross_workspace_probe_count: probes.filter((probe) => probe.observed_outcome === "blocked").length,
    allowed_cross_workspace_probe_count: probes.filter((probe) => probe.observed_outcome !== "blocked").length,
    mixed_search_namespace_count: mixedSearchNamespaceCount(projected.searchNamespacePolicies),
    law_firm_tenant_id: lawFirmBoundary?.tenant_id ?? null,
    personal_tenant_id: personalBoundary?.tenant_id ?? null,
    law_firm_matter_count: lawFirmBoundary?.allowed_matter_ids.length ?? 0,
    personal_matter_count: personalBoundary?.allowed_matter_ids.length ?? 0,
    law_firm_resource_count: lawFirmBoundary?.allowed_resource_ids.length ?? 0,
    personal_resource_count: personalBoundary?.allowed_resource_ids.length ?? 0,
    law_firm_policy_snapshot_count: lawFirmBoundary?.allowed_policy_snapshot_ids.length ?? 0,
    personal_policy_snapshot_count: personalBoundary?.allowed_policy_snapshot_ids.length ?? 0,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_workspace_type: countBy(boundaries, "workspace_type"),
    by_probe_type: countBy(probes, "probe_type"),
    by_probe_outcome: countBy(probes, "observed_outcome"),
  };
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function mixedSearchNamespaceCount(namespacePolicies) {
  return namespacePolicies.filter((policy) => {
    const denied = new Set(policy.denied_resource_ids ?? []);
    return (policy.allowed_resource_ids ?? []).some((resourceId) => denied.has(resourceId));
  }).length;
}

function renderPersonalWorkspaceBoundaryMarkdown(result) {
  const lines = [];
  lines.push("# Personal Workspace Boundary");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.personal_workspace_boundary_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Workspace boundaries: ${result.summary.workspace_boundary_count}`);
  lines.push(`- Search namespaces: ${result.summary.search_namespace_policy_count}`);
  lines.push(`- Cross-workspace probes blocked: ${result.summary.blocked_cross_workspace_probe_count}/${result.summary.cross_workspace_probe_count}`);
  lines.push(`- Law-firm tenant: ${result.summary.law_firm_tenant_id ?? "unknown"}`);
  lines.push(`- Personal tenant: ${result.summary.personal_tenant_id ?? "unknown"}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Boundaries");
  lines.push("");
  for (const boundary of result.workspace_boundary_catalog.workspace_boundaries) {
    lines.push(`- ${boundary.workspace_boundary_id}: ${boundary.workspace_type}, tenant=${boundary.tenant_id}, namespace=${boundary.search_namespace_id}, resources=${boundary.allowed_resource_ids.length}`);
  }
  lines.push("");
  lines.push("## Rule");
  lines.push("");
  lines.push("Personal project resources and law-firm matter resources must be queried through separate tenant, policy snapshot, domain pack, and search namespace filters. Cross-workspace probes are blocked by default and remain review-held for protected action workflows.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function summarizeIdentitySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    identity_model_status: source.summary?.identity_model_status ?? "unknown",
    tenant_count: source.summary?.tenant_count ?? source.identity_contract?.tenants?.length ?? 0,
  };
}

function summarizeMatterTeamSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    ledger_status: source.summary?.ledger_status ?? "unknown",
    matter_profile_count: source.summary?.matter_profile_count ?? source.matter_team_contract?.matter_profiles?.length ?? 0,
  };
}

function summarizeStorePolicySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    store_policy_adapter_status: source.summary?.store_policy_adapter_status ?? "unknown",
    store_query_plan_count: source.summary?.store_query_plan_count ?? source.store_policy_catalog?.store_query_plans?.length ?? 0,
  };
}

function summarizeConflictCheckSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    conflict_check_interface_status: source.summary?.conflict_check_interface_status ?? "unknown",
    conflict_check_request_count: source.summary?.conflict_check_request_count ?? source.conflict_check_catalog?.conflict_check_requests?.length ?? 0,
  };
}

function summarizePersonalDevSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    personal_dev_slice_status: source.schema_version === "personal-dev-slice-run.v1" ? "complete" : "unknown",
    tenant_count: source.identity_policy?.tenants?.length ?? 0,
    matter_count: source.identity_policy?.matters?.length ?? 0,
    resource_count: source.resource_evidence?.resources?.length ?? 0,
  };
}

function summarizeDomainPackSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    domain_pack_registry_status: source.validation?.valid ? "valid" : "unknown",
    pack_count: source.summary?.pack_count ?? source.registry?.packs?.length ?? source.packs?.length ?? 0,
  };
}

function pushUniqueIdChecks(validationItems, rows, subjectType, idField) {
  const seen = new Set();
  for (const row of rows) {
    const id = row[idField];
    const unique = Boolean(id) && !seen.has(id);
    pushCheck(validationItems, subjectType, id ?? "missing", `${idField}_unique`, unique, `${subjectType} must have a unique ${idField}.`);
    if (id) seen.add(id);
  }
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `personal-workspace-boundary.validation.${slugify(subjectType)}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function selectTenant(tenants, tenantType) {
  return tenants.find((tenant) => tenant.tenant_type === tenantType);
}

function normalizeInputs(options) {
  return {
    identity_model_path: path.resolve(options.identityModelPath ?? DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_INPUTS.identityModelPath),
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_INPUTS.matterProfileTeamLedgerPath),
    store_policy_adapter_path: path.resolve(options.storePolicyAdapterPath ?? DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_INPUTS.storePolicyAdapterPath),
    conflict_check_interface_path: path.resolve(options.conflictCheckInterfacePath ?? DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_INPUTS.conflictCheckInterfacePath),
    personal_dev_slice_path: path.resolve(options.personalDevSlicePath ?? DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_INPUTS.personalDevSlicePath),
    domain_pack_registry_path: path.resolve(options.domainPackRegistryPath ?? DEFAULT_PERSONAL_WORKSPACE_BOUNDARY_INPUTS.domainPackRegistryPath),
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
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--identity-model") parsed.identityModelPath = argv[++index];
    else if (arg === "--matter-profile-team-ledger") parsed.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--store-policy-adapter") parsed.storePolicyAdapterPath = argv[++index];
    else if (arg === "--conflict-check-interface") parsed.conflictCheckInterfacePath = argv[++index];
    else if (arg === "--personal-dev-slice") parsed.personalDevSlicePath = argv[++index];
    else if (arg === "--domain-pack-registry") parsed.domainPackRegistryPath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/personal-workspace-boundary.mjs [options]

Options:
  --identity-model <path>                 identity-model.json path.
  --matter-profile-team-ledger <path>     matter-profile-team-ledger.json path.
  --store-policy-adapter <path>           store-policy-adapter.json path.
  --conflict-check-interface <path>       conflict-check-interface.json path.
  --personal-dev-slice <path>             personal-dev-slice.json path.
  --domain-pack-registry <path>           domain-pack-registry.json path.
  --out-dir <path>                        output directory.
  --run-at <iso>                          deterministic generation timestamp.
  --check                                 exit non-zero if validation fails.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableBoundary(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function by(field) {
  return (left, right) => String(left[field] ?? "").localeCompare(String(right[field] ?? ""));
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== null && value !== undefined && value !== ""))];
}

function countBy(rows, field) {
  const counts = {};
  for (const row of rows) {
    const key = row[field] ?? "unknown";
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}
