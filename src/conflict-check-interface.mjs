import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONFLICT_CHECK_INTERFACE_OUT_DIR = "artifacts/conflict-check/latest";
export const DEFAULT_CONFLICT_CHECK_INTERFACE_INPUTS = {
  clientCounterpartyRegistryPath: "artifacts/client-counterparty-registry/latest/client-counterparty-registry.json",
  matterProfileTeamLedgerPath: "artifacts/matter-profile-team-ledger/latest/matter-profile-team-ledger.json",
  wallPolicyContractPath: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
};

export async function runConflictCheckInterface(options = {}) {
  const result = await buildConflictCheckInterface(options);
  if (options.write !== false) await writeConflictCheckInterface(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Conflict check interface failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildConflictCheckInterface(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONFLICT_CHECK_INTERFACE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const clientCounterpartyRegistry = await readJson(inputs.client_counterparty_registry_path);
  const matterProfileTeamLedger = await readJson(inputs.matter_profile_team_ledger_path);
  const wallPolicyContract = await readJson(inputs.wall_policy_contract_path);
  const storePolicyAdapter = await readJson(inputs.store_policy_adapter_path);
  const projected = projectConflictCheckInterface({
    clientCounterpartyRegistry,
    matterProfileTeamLedger,
    wallPolicyContract,
    storePolicyAdapter,
    generatedAt,
  });
  const validationItems = validateConflictCheckInterface({
    clientCounterpartyRegistry,
    matterProfileTeamLedger,
    wallPolicyContract,
    storePolicyAdapter,
    projected,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "conflict-check-interface.v1",
    generated_at: generatedAt,
    conflict_check_interface_id: `conflict-check-interface.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_client_counterparty_registry: summarizeRegistrySource(clientCounterpartyRegistry),
    source_matter_profile_team_ledger: summarizeMatterTeamSource(matterProfileTeamLedger),
    source_wall_policy_contract: summarizeWallPolicySource(wallPolicyContract),
    source_store_policy_adapter: summarizeStorePolicySource(storePolicyAdapter),
    conflict_check_catalog: {
      schema_version: "conflict-check-catalog.v1",
      generated_at: generatedAt,
      conflict_check_requests: projected.conflictCheckRequests,
      conflict_check_results: projected.conflictCheckResults,
      conflict_signals: projected.conflictSignals,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeConflictCheckInterface(projected, validationItems, validation, {
      clientCounterpartyRegistry,
      matterProfileTeamLedger,
      wallPolicyContract,
      storePolicyAdapter,
    }),
  };
  return {
    ...result,
    markdown: renderConflictCheckInterfaceMarkdown(result),
  };
}

export async function writeConflictCheckInterface(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableInterface(result);
  await writeJson(path.join(outDir, "conflict-check-interface.json"), serializable);
  await writeJson(path.join(outDir, "conflict-check-requests.json"), {
    generated_at: result.generated_at,
    conflict_check_request_count: result.conflict_check_catalog.conflict_check_requests.length,
    conflict_check_requests: result.conflict_check_catalog.conflict_check_requests,
  });
  await writeJson(path.join(outDir, "conflict-check-results.json"), {
    generated_at: result.generated_at,
    conflict_check_result_count: result.conflict_check_catalog.conflict_check_results.length,
    conflict_check_results: result.conflict_check_catalog.conflict_check_results,
  });
  await writeJson(path.join(outDir, "conflict-signals.json"), {
    generated_at: result.generated_at,
    conflict_signal_count: result.conflict_check_catalog.conflict_signals.length,
    conflict_signals: result.conflict_check_catalog.conflict_signals,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    conflict_check_interface_id: result.conflict_check_interface_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runConflictCheckInterfaceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runConflictCheckInterface(args);
    console.log(`Conflict check interface written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.conflict_check_interface_status}`);
    console.log(`Requests: ${result.summary.conflict_check_request_count}`);
    console.log(`Results: ${result.summary.conflict_check_result_count}`);
    console.log(`Signals: ${result.summary.conflict_signal_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectConflictCheckInterface({ clientCounterpartyRegistry, matterProfileTeamLedger, wallPolicyContract, storePolicyAdapter, generatedAt }) {
  const registryContract = clientCounterpartyRegistry.registry_contract ?? {};
  const teamContract = matterProfileTeamLedger.matter_team_contract ?? {};
  const wallContract = wallPolicyContract.wall_policy_contract ?? {};
  const storeCatalog = storePolicyAdapter.store_policy_catalog ?? {};
  const profiles = teamContract.matter_profiles ?? [];
  const conflictReferences = registryContract.conflict_reference_index ?? [];
  const conflictWallBindings = wallContract.conflict_wall_bindings ?? [];
  const queryPlans = storeCatalog.store_query_plans ?? [];
  const conflictRefById = new Map(conflictReferences.map((entry) => [entry.conflict_ref_id, entry]));
  const conflictWallByMatterAndRef = new Map(conflictWallBindings.map((binding) => [`${binding.matter_id}::${binding.conflict_ref_id}`, binding]));
  const queryPlansByResource = groupBy(queryPlans.filter((plan) => plan.target_type === "resource"), "target_resource_id");
  const profileByMatterId = new Map(profiles.map((profile) => [profile.matter_id, profile]));
  const requests = [
    ...profiles.map((profile) => buildMatterIntakeRequest({ profile, conflictRefById, conflictWallByMatterAndRef, generatedAt })),
    ...[...queryPlansByResource.entries()].map(([resourceId, plans]) => buildResourceAccessRequest({
      resourceId,
      plans,
      profile: profileByMatterId.get(plans[0]?.target_matter_id),
      conflictRefById,
      conflictWallByMatterAndRef,
      generatedAt,
    })),
  ].sort(by("conflict_check_request_id"));
  const signals = requests.flatMap((request) => buildConflictSignals({ request, conflictRefById, conflictWallByMatterAndRef, generatedAt })).sort(by("conflict_signal_id"));
  const signalsByRequest = groupBy(signals, "conflict_check_request_id");
  const results = requests.map((request) => buildConflictResult({ request, signals: signalsByRequest.get(request.conflict_check_request_id) ?? [], generatedAt })).sort(by("conflict_check_result_id"));
  return {
    profiles,
    conflictReferences,
    conflictWallBindings,
    queryPlans,
    conflictCheckRequests: requests,
    conflictSignals: signals,
    conflictCheckResults: results,
  };
}

function buildMatterIntakeRequest({ profile, conflictRefById, conflictWallByMatterAndRef, generatedAt }) {
  const conflictRefs = conflictRefsForProfile(profile, conflictRefById);
  const wallBindings = conflictRefs.map((entry) => conflictWallByMatterAndRef.get(`${profile.matter_id}::${entry.conflict_ref_id}`)).filter(Boolean);
  return {
    schema_version: "conflict-check-request.v1",
    conflict_check_request_id: `conflict-check-request.matter-intake.${slugify(profile.matter_id)}`,
    request_type: "matter_intake",
    request_status: "ready_for_review",
    tenant_id: profile.tenant_id,
    client_id: profile.client_id,
    matter_id: profile.matter_id,
    matter_profile_id: profile.matter_profile_id,
    target_resource_id: null,
    requested_by_user_id: profile.responsible_partner_user_ids?.[0] ?? profile.team_member_user_ids?.[0] ?? "unknown",
    requested_stage: "pre_engagement",
    requested_action: "open_or_continue_matter",
    policy_snapshot_id: profile.default_policy_snapshot_id,
    wall_ids: profile.wall_ids ?? [],
    party_ids: profile.party_ids ?? [],
    conflict_ref_ids: conflictRefs.map((entry) => entry.conflict_ref_id).sort(),
    client_conflict_ref_ids: conflictRefs.filter((entry) => entry.party_type === "client").map((entry) => entry.conflict_ref_id).sort(),
    counterparty_conflict_ref_ids: conflictRefs.filter((entry) => entry.party_type !== "client").map((entry) => entry.conflict_ref_id).sort(),
    conflict_wall_binding_ids: wallBindings.map((binding) => binding.conflict_wall_binding_id).sort(),
    store_query_plan_ids: [],
    runtime_ids: [],
    access_subject_user_ids: profile.team_member_user_ids ?? [],
    human_review_required: true,
    created_at: generatedAt,
    metadata: {
      matter_name: profile.matter_name,
      practice_area: profile.practice_area,
      classification: profile.classification,
    },
  };
}

function buildResourceAccessRequest({ resourceId, plans, profile, conflictRefById, conflictWallByMatterAndRef, generatedAt }) {
  const matterId = plans[0]?.target_matter_id ?? profile?.matter_id ?? "unknown";
  const conflictRefs = conflictRefsForProfile(profile ?? {}, conflictRefById);
  const wallBindings = conflictRefs.map((entry) => conflictWallByMatterAndRef.get(`${matterId}::${entry.conflict_ref_id}`)).filter(Boolean);
  return {
    schema_version: "conflict-check-request.v1",
    conflict_check_request_id: `conflict-check-request.resource-access.${slugify(matterId)}.${slugify(resourceId)}`,
    request_type: "resource_access",
    request_status: "ready_for_review",
    tenant_id: plans[0]?.tenant_id ?? profile?.tenant_id ?? "unknown",
    client_id: profile?.client_id ?? null,
    matter_id: matterId,
    matter_profile_id: profile?.matter_profile_id ?? null,
    target_resource_id: resourceId,
    requested_by_user_id: unique(plans.map((plan) => plan.user_id))[0] ?? "unknown",
    requested_stage: "pre_retrieval",
    requested_action: "read_resource",
    policy_snapshot_id: plans[0]?.policy_snapshot_id ?? profile?.default_policy_snapshot_id ?? null,
    wall_ids: profile?.wall_ids ?? [],
    party_ids: profile?.party_ids ?? [],
    conflict_ref_ids: conflictRefs.map((entry) => entry.conflict_ref_id).sort(),
    client_conflict_ref_ids: conflictRefs.filter((entry) => entry.party_type === "client").map((entry) => entry.conflict_ref_id).sort(),
    counterparty_conflict_ref_ids: conflictRefs.filter((entry) => entry.party_type !== "client").map((entry) => entry.conflict_ref_id).sort(),
    conflict_wall_binding_ids: wallBindings.map((binding) => binding.conflict_wall_binding_id).sort(),
    store_query_plan_ids: plans.map((plan) => plan.store_query_plan_id).sort(),
    runtime_ids: unique(plans.map((plan) => plan.runtime_id)),
    access_subject_user_ids: unique(plans.map((plan) => plan.user_id)),
    human_review_required: true,
    created_at: generatedAt,
    metadata: {
      query_statuses: unique(plans.map((plan) => plan.query_status)),
      executable_plan_count: plans.filter((plan) => plan.executable).length,
      held_plan_count: plans.filter((plan) => plan.query_status === "held_for_human_confirmation").length,
      blocked_plan_count: plans.filter((plan) => plan.query_status === "blocked").length,
    },
  };
}

function buildConflictSignals({ request, conflictRefById, conflictWallByMatterAndRef, generatedAt }) {
  return request.conflict_ref_ids.map((conflictRefId) => {
    const conflictRef = conflictRefById.get(conflictRefId);
    const wallBinding = conflictWallByMatterAndRef.get(`${request.matter_id}::${conflictRefId}`);
    const decision = signalDecision(conflictRef, wallBinding);
    return {
      schema_version: "conflict-signal.v1",
      conflict_signal_id: `conflict-signal.${slugify(request.conflict_check_request_id)}.${slugify(conflictRefId)}`,
      conflict_check_request_id: request.conflict_check_request_id,
      request_type: request.request_type,
      tenant_id: request.tenant_id,
      matter_id: request.matter_id,
      client_id: request.client_id,
      target_resource_id: request.target_resource_id,
      conflict_ref_id: conflictRefId,
      stable_party_id: conflictRef?.stable_party_id ?? null,
      party_type: conflictRef?.party_type ?? "unknown",
      display_name: conflictRef?.display_name ?? conflictRefId,
      counterparty_role: conflictRef?.counterparty_role ?? null,
      conflict_wall_binding_id: wallBinding?.conflict_wall_binding_id ?? null,
      conflict_check_status: conflictRef?.conflict_check_status ?? "missing",
      signal_type: signalType(conflictRef),
      signal_decision: decision,
      signal_severity: signalSeverity(decision),
      human_review_required: decision !== "clear",
      reason_codes: signalReasonCodes(conflictRef, wallBinding, decision),
      generated_at: generatedAt,
      metadata: {
        alias_keys: conflictRef?.alias_keys ?? [],
        known_matter_ids: conflictRef?.matter_ids ?? [],
        binding_status: wallBinding?.binding_status ?? null,
      },
    };
  });
}

function buildConflictResult({ request, signals, generatedAt }) {
  const signalDecisions = signals.map((signal) => signal.signal_decision);
  const resultStatus = signalDecisions.includes("block") ? "blocked" : signalDecisions.includes("review") ? "review_required" : "clear";
  return {
    schema_version: "conflict-check-result.v1",
    conflict_check_result_id: `conflict-check-result.${slugify(request.conflict_check_request_id)}`,
    conflict_check_request_id: request.conflict_check_request_id,
    request_type: request.request_type,
    tenant_id: request.tenant_id,
    matter_id: request.matter_id,
    client_id: request.client_id,
    target_resource_id: request.target_resource_id,
    result_status: resultStatus,
    final_access_effect: resultStatus === "clear" ? "conflict_signal_recorded" : resultStatus === "blocked" ? "block_pending_conflict_resolution" : "hold_for_conflict_review",
    signal_count: signals.length,
    clear_signal_count: signals.filter((signal) => signal.signal_decision === "clear").length,
    review_signal_count: signals.filter((signal) => signal.signal_decision === "review").length,
    block_signal_count: signals.filter((signal) => signal.signal_decision === "block").length,
    conflict_signal_ids: signals.map((signal) => signal.conflict_signal_id).sort(),
    policy_snapshot_id: request.policy_snapshot_id,
    human_review_required: resultStatus !== "clear" || request.human_review_required,
    decided_at: generatedAt,
    metadata: {
      requested_stage: request.requested_stage,
      requested_action: request.requested_action,
      store_query_plan_count: request.store_query_plan_ids.length,
    },
  };
}

function validateConflictCheckInterface({ clientCounterpartyRegistry, matterProfileTeamLedger, wallPolicyContract, storePolicyAdapter, projected }) {
  const validationItems = [];
  const requestsById = new Map(projected.conflictCheckRequests.map((request) => [request.conflict_check_request_id, request]));
  const resultsByRequestId = new Map(projected.conflictCheckResults.map((result) => [result.conflict_check_request_id, result]));
  const signalsByRequestId = groupBy(projected.conflictSignals, "conflict_check_request_id");
  const conflictRefIds = new Set(projected.conflictReferences.map((entry) => entry.conflict_ref_id));
  const conflictWallBindingIds = new Set(projected.conflictWallBindings.map((binding) => binding.conflict_wall_binding_id));
  const queryPlanIds = new Set(projected.queryPlans.map((plan) => plan.store_query_plan_id));
  const resourceIds = unique(projected.queryPlans.filter((plan) => plan.target_type === "resource").map((plan) => plan.target_resource_id));

  pushCheck(validationItems, "source", clientCounterpartyRegistry.registry_id ?? "client-counterparty-registry", "registry_complete", clientCounterpartyRegistry.summary?.registry_status === "complete", "Conflict check requires a complete Client/Counterparty Registry.");
  pushCheck(validationItems, "source", matterProfileTeamLedger.ledger_id ?? "matter-profile-team-ledger", "matter_team_ledger_complete", matterProfileTeamLedger.summary?.ledger_status === "complete", "Conflict check requires a complete Matter Profile/Team Ledger.");
  pushCheck(validationItems, "source", wallPolicyContract.wall_policy_ledger_id ?? "wall-policy-contract", "wall_policy_complete", wallPolicyContract.summary?.wall_policy_status === "complete", "Conflict check requires a complete Wall Policy Contract.");
  pushCheck(validationItems, "source", storePolicyAdapter.store_policy_adapter_id ?? "store-policy-adapter", "store_policy_complete", storePolicyAdapter.summary?.store_policy_adapter_status === "complete", "Conflict check requires a complete Store Policy Adapter.");
  pushUniqueIdChecks(validationItems, projected.conflictCheckRequests, "conflict_check_request", "conflict_check_request_id");
  pushUniqueIdChecks(validationItems, projected.conflictCheckResults, "conflict_check_result", "conflict_check_result_id");
  pushUniqueIdChecks(validationItems, projected.conflictSignals, "conflict_signal", "conflict_signal_id");

  for (const profile of projected.profiles) {
    const requestId = `conflict-check-request.matter-intake.${slugify(profile.matter_id)}`;
    pushCheck(validationItems, "matter_profile", profile.matter_profile_id, "matter_intake_request_present", requestsById.has(requestId), "Each matter profile must have a matter intake conflict check request.");
  }

  for (const resourceId of resourceIds) {
    const plans = projected.queryPlans.filter((plan) => plan.target_resource_id === resourceId);
    const matterId = plans[0]?.target_matter_id ?? "unknown";
    const requestId = `conflict-check-request.resource-access.${slugify(matterId)}.${slugify(resourceId)}`;
    pushCheck(validationItems, "resource", resourceId, "resource_access_request_present", requestsById.has(requestId), "Each protected resource must have a resource access conflict check request.");
  }

  for (const request of projected.conflictCheckRequests) {
    const result = resultsByRequestId.get(request.conflict_check_request_id);
    const signals = signalsByRequestId.get(request.conflict_check_request_id) ?? [];
    pushCheck(validationItems, "conflict_check_request", request.conflict_check_request_id, "result_present", Boolean(result), "Every conflict check request must have a result.");
    pushCheck(validationItems, "conflict_check_request", request.conflict_check_request_id, "signals_present", signals.length > 0, "Every conflict check request must have conflict signals.");
    pushCheck(validationItems, "conflict_check_request", request.conflict_check_request_id, "conflict_refs_known", request.conflict_ref_ids.every((id) => conflictRefIds.has(id)), "Conflict check request must reference known conflict refs.");
    pushCheck(validationItems, "conflict_check_request", request.conflict_check_request_id, "policy_snapshot_present", Boolean(request.policy_snapshot_id), "Conflict check request must preserve the policy snapshot.");
    pushCheck(validationItems, "conflict_check_request", request.conflict_check_request_id, "client_ref_present", request.client_conflict_ref_ids.length > 0, "Conflict check request must include client conflict references.");
    pushCheck(validationItems, "conflict_check_request", request.conflict_check_request_id, "counterparty_ref_present", request.counterparty_conflict_ref_ids.length > 0, "Conflict check request must include counterparty conflict references.");
    if (request.request_type === "resource_access") {
      pushCheck(validationItems, "conflict_check_request", request.conflict_check_request_id, "store_query_plans_linked", request.store_query_plan_ids.length > 0 && request.store_query_plan_ids.every((id) => queryPlanIds.has(id)), "Resource access conflict check requests must link store query plans.");
    }
  }

  for (const signal of projected.conflictSignals) {
    pushCheck(validationItems, "conflict_signal", signal.conflict_signal_id, "request_known", requestsById.has(signal.conflict_check_request_id), "Conflict signal must reference a known request.");
    pushCheck(validationItems, "conflict_signal", signal.conflict_signal_id, "conflict_ref_known", conflictRefIds.has(signal.conflict_ref_id), "Conflict signal must reference a known conflict ref.");
    pushCheck(validationItems, "conflict_signal", signal.conflict_signal_id, "wall_binding_known", Boolean(signal.conflict_wall_binding_id && conflictWallBindingIds.has(signal.conflict_wall_binding_id)), "Conflict signal must bind to a ready conflict wall binding.");
    pushCheck(validationItems, "conflict_signal", signal.conflict_signal_id, "counterparty_reviewed", signal.party_type !== "counterparty" || signal.signal_decision === "review", "Counterparty conflict signals must require review.");
  }

  for (const result of projected.conflictCheckResults) {
    const signals = signalsByRequestId.get(result.conflict_check_request_id) ?? [];
    pushCheck(validationItems, "conflict_check_result", result.conflict_check_result_id, "signals_counted", result.signal_count === signals.length && signals.length > 0, "Conflict check result must count its request signals.");
    pushCheck(validationItems, "conflict_check_result", result.conflict_check_result_id, "review_or_block_not_auto_clear", result.result_status !== "clear" || result.human_review_required === false, "Clear result must not require human review; review/block results must hold access.");
    pushCheck(validationItems, "conflict_check_result", result.conflict_check_result_id, "policy_snapshot_present", Boolean(result.policy_snapshot_id), "Conflict check result must preserve policy snapshot.");
  }

  pushCheck(validationItems, "conflict_check_interface", "requests", "request_coverage", projected.conflictCheckRequests.length === projected.profiles.length + resourceIds.length, "Conflict check interface must cover matter intake and resource access requests.");
  pushCheck(validationItems, "conflict_check_interface", "results", "result_coverage", projected.conflictCheckResults.length === projected.conflictCheckRequests.length, "Every conflict check request must have exactly one result.");
  pushCheck(validationItems, "conflict_check_interface", "signals", "counterparty_signal_present", projected.conflictSignals.some((signal) => signal.party_type === "counterparty" && signal.signal_decision === "review"), "At least one counterparty conflict signal must be present and review-gated.");
  pushCheck(validationItems, "conflict_check_interface", "signals", "no_missing_conflict_refs", projected.conflictSignals.every((signal) => signal.conflict_check_status !== "missing"), "Conflict signals must not reference missing conflict refs.");

  return validationItems;
}

function summarizeConflictCheckInterface(projected, validationItems, validation, { clientCounterpartyRegistry, matterProfileTeamLedger, wallPolicyContract, storePolicyAdapter }) {
  const requests = projected.conflictCheckRequests;
  const results = projected.conflictCheckResults;
  const signals = projected.conflictSignals;
  return {
    conflict_check_interface_status: validation.valid ? "complete" : "blocked",
    source_client_counterparty_registry_status: clientCounterpartyRegistry.summary?.registry_status ?? "unknown",
    source_matter_profile_team_ledger_status: matterProfileTeamLedger.summary?.ledger_status ?? "unknown",
    source_wall_policy_contract_status: wallPolicyContract.summary?.wall_policy_status ?? "unknown",
    source_store_policy_adapter_status: storePolicyAdapter.summary?.store_policy_adapter_status ?? "unknown",
    matter_profile_count: projected.profiles.length,
    protected_resource_count: unique(projected.queryPlans.filter((plan) => plan.target_type === "resource").map((plan) => plan.target_resource_id)).length,
    conflict_reference_count: projected.conflictReferences.length,
    conflict_wall_binding_count: projected.conflictWallBindings.length,
    store_query_plan_count: projected.queryPlans.length,
    conflict_check_request_count: requests.length,
    matter_intake_request_count: requests.filter((request) => request.request_type === "matter_intake").length,
    resource_access_request_count: requests.filter((request) => request.request_type === "resource_access").length,
    conflict_check_result_count: results.length,
    clear_result_count: results.filter((result) => result.result_status === "clear").length,
    review_required_result_count: results.filter((result) => result.result_status === "review_required").length,
    blocked_result_count: results.filter((result) => result.result_status === "blocked").length,
    conflict_signal_count: signals.length,
    clear_signal_count: signals.filter((signal) => signal.signal_decision === "clear").length,
    review_signal_count: signals.filter((signal) => signal.signal_decision === "review").length,
    block_signal_count: signals.filter((signal) => signal.signal_decision === "block").length,
    client_signal_count: signals.filter((signal) => signal.party_type === "client").length,
    counterparty_signal_count: signals.filter((signal) => signal.party_type === "counterparty").length,
    store_plan_linked_request_count: requests.filter((request) => request.store_query_plan_ids.length > 0).length,
    missing_conflict_reference_count: signals.filter((signal) => signal.conflict_check_status === "missing").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_request_type: countBy(requests, "request_type"),
    by_result_status: countBy(results, "result_status"),
    by_signal_decision: countBy(signals, "signal_decision"),
  };
}

function summarizeRegistrySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    registry_id: source.registry_id ?? null,
    registry_status: source.summary?.registry_status ?? "unknown",
    conflict_reference_count: source.summary?.conflict_reference_count ?? 0,
    validation_error_count: source.summary?.validation_error_count ?? source.validation?.errors?.length ?? 0,
  };
}

function summarizeMatterTeamSource(source) {
  return {
    schema_version: source.schema_version ?? null,
    ledger_id: source.ledger_id ?? null,
    ledger_status: source.summary?.ledger_status ?? "unknown",
    matter_profile_count: source.summary?.matter_profile_count ?? 0,
    validation_error_count: source.summary?.validation_error_count ?? source.validation?.errors?.length ?? 0,
  };
}

function summarizeWallPolicySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    wall_policy_ledger_id: source.wall_policy_ledger_id ?? null,
    wall_policy_status: source.summary?.wall_policy_status ?? "unknown",
    conflict_wall_binding_count: source.summary?.conflict_wall_binding_count ?? 0,
    validation_error_count: source.summary?.validation_error_count ?? source.validation?.errors?.length ?? 0,
  };
}

function summarizeStorePolicySource(source) {
  return {
    schema_version: source.schema_version ?? null,
    store_policy_adapter_id: source.store_policy_adapter_id ?? null,
    store_policy_adapter_status: source.summary?.store_policy_adapter_status ?? "unknown",
    store_query_plan_count: source.summary?.store_query_plan_count ?? 0,
    validation_error_count: source.summary?.validation_error_count ?? source.validation?.errors?.length ?? 0,
  };
}

function renderConflictCheckInterfaceMarkdown(result) {
  const lines = [];
  lines.push("# Conflict Check Interface");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.conflict_check_interface_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Requests: ${result.summary.conflict_check_request_count}`);
  lines.push(`- Matter intake requests: ${result.summary.matter_intake_request_count}`);
  lines.push(`- Resource access requests: ${result.summary.resource_access_request_count}`);
  lines.push(`- Results: ${result.summary.conflict_check_result_count}`);
  lines.push(`- Signals: ${result.summary.conflict_signal_count}`);
  lines.push(`- Review-required results: ${result.summary.review_required_result_count}`);
  lines.push(`- Counterparty review signals: ${result.summary.counterparty_signal_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("The interface records conflict signals before matter intake or resource access. It does not approve representation, legal advice, filing, or final work product.");
  return `${lines.join("\n")}\n`;
}

function conflictRefsForProfile(profile, conflictRefById) {
  return [...(profile.conflict_ref_ids ?? [])]
    .map((id) => conflictRefById.get(id))
    .filter(Boolean)
    .sort(by("conflict_ref_id"));
}

function signalDecision(conflictRef, wallBinding) {
  if (!conflictRef || !wallBinding || wallBinding.conflict_check_status !== "ready") return "block";
  if (conflictRef.party_type === "counterparty") return "review";
  return "clear";
}

function signalType(conflictRef) {
  if (!conflictRef) return "missing_conflict_reference";
  if (conflictRef.party_type === "client") return "client_party_known";
  if (conflictRef.party_type === "counterparty") return "counterparty_party_known";
  return "related_party_known";
}

function signalSeverity(decision) {
  if (decision === "block") return "critical";
  if (decision === "review") return "warning";
  return "info";
}

function signalReasonCodes(conflictRef, wallBinding, decision) {
  const codes = [];
  if (!conflictRef) codes.push("missing_conflict_reference");
  else codes.push("conflict_reference_known");
  if (!wallBinding) codes.push("missing_conflict_wall_binding");
  else codes.push("conflict_wall_binding_ready");
  if (conflictRef?.party_type === "counterparty") codes.push("counterparty_requires_human_conflict_review");
  if (decision === "clear") codes.push("client_reference_same_matter_recorded");
  if (decision === "block") codes.push("block_until_conflict_data_complete");
  return codes;
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

function normalizeInputs(options) {
  return {
    client_counterparty_registry_path: path.resolve(options.clientCounterpartyRegistryPath ?? DEFAULT_CONFLICT_CHECK_INTERFACE_INPUTS.clientCounterpartyRegistryPath),
    matter_profile_team_ledger_path: path.resolve(options.matterProfileTeamLedgerPath ?? DEFAULT_CONFLICT_CHECK_INTERFACE_INPUTS.matterProfileTeamLedgerPath),
    wall_policy_contract_path: path.resolve(options.wallPolicyContractPath ?? DEFAULT_CONFLICT_CHECK_INTERFACE_INPUTS.wallPolicyContractPath),
    store_policy_adapter_path: path.resolve(options.storePolicyAdapterPath ?? DEFAULT_CONFLICT_CHECK_INTERFACE_INPUTS.storePolicyAdapterPath),
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--check") {
      args.check = true;
      args.write = false;
    }
    else if (arg === "--no-write") args.write = false;
    else if (arg === "--out-dir") args.outDir = argv[++index];
    else if (arg === "--run-at") args.runAt = argv[++index];
    else if (arg === "--client-counterparty-registry") args.clientCounterpartyRegistryPath = argv[++index];
    else if (arg === "--matter-profile-team-ledger") args.matterProfileTeamLedgerPath = argv[++index];
    else if (arg === "--wall-policy-contract") args.wallPolicyContractPath = argv[++index];
    else if (arg === "--store-policy-adapter") args.storePolicyAdapterPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/conflict-check-interface.mjs [options]

Options:
  --client-counterparty-registry <path>  Client/Counterparty Registry artifact.
  --matter-profile-team-ledger <path>    Matter Profile/Team Ledger artifact.
  --wall-policy-contract <path>          Wall Policy Contract artifact.
  --store-policy-adapter <path>          Store Policy Adapter artifact.
  --out-dir <path>                       Output directory.
  --run-at <iso>                         Deterministic timestamp.
  --check                                Exit non-zero when validation fails.
  --no-write                             Build without writing artifacts.
`);
}

function pushUniqueIdChecks(validationItems, items, subjectType, key) {
  const owners = new Map();
  for (const item of items) {
    const id = item[key];
    if (owners.has(id)) {
      pushCheck(validationItems, subjectType, id, "id_unique", false, `${subjectType} id ${id} is already present.`);
    } else {
      owners.set(id, true);
      pushCheck(validationItems, subjectType, id, "id_unique", true, `${subjectType} id ${id} is unique in the interface.`);
    }
  }
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `conflict-check-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
    subject_type: subjectType,
    subject_id: String(subjectId ?? "unknown"),
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

function serializableInterface(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    grouped.set(value, [...(grouped.get(value) ?? []), item]);
  }
  return grouped;
}

function unique(values) {
  return [...new Set((values ?? []).filter((value) => value !== null && value !== undefined))].sort();
}

function slugify(value) {
  return String(value ?? "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
