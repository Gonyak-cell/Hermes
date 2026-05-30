import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_BOUNDARY_SLICE_OUT_DIR = "artifacts/matter-boundary-slice/latest";
export const DEFAULT_MATTER_BOUNDARY_SLICE_INPUTS = {
  resourceIngestPath: "artifacts/resource-ingest/latest/resource-ingest.json",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  accessAuditProjectionPath: "artifacts/access-audit/latest/access-audit-projection.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  policyOperationsSurfacePath: "artifacts/policy-operations-surface/latest/policy-operations-surface.json",
};

const REQUIRED_STORE_FILTER_KEYS = ["tenant_id", "matter_id", "classification", "policy_snapshot_id", "access_audit_record_id"];
const NEGATIVE_PROBE_TYPES = ["missing_matter_filter", "missing_classification_filter", "missing_policy_snapshot_filter", "cross_matter_filter", "unfiltered_query"];

export async function runMatterBoundarySlice(options = {}) {
  const result = await buildMatterBoundarySlice(options);
  if (options.write !== false) await writeMatterBoundarySlice(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter boundary slice failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterBoundarySlice(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_BOUNDARY_SLICE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    resourceIngest: await readJson(inputs.resource_ingest_path),
    resourceContractFreeze: await readJson(inputs.resource_contract_freeze_path),
    matterAccessPolicyEvaluator: await readJson(inputs.matter_access_policy_evaluator_path),
    accessAuditProjection: await readJson(inputs.access_audit_projection_path),
    storePolicyAdapter: await readJson(inputs.store_policy_adapter_path),
    policyOperationsSurface: await readJson(inputs.policy_operations_surface_path),
  };
  const projected = projectMatterBoundarySlice(sources, generatedAt);
  const validationItems = validateMatterBoundarySlice(sources, projected);
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "matter-boundary-slice.v1",
    generated_at: generatedAt,
    matter_boundary_slice_id: `matter-boundary-slice.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_statuses: {
      resource_ingest: sourceStatus(sources.resourceIngest, "gate_status"),
      resource_contract_freeze: sourceStatus(sources.resourceContractFreeze, "freeze_status"),
      matter_access_policy_evaluator: sourceStatus(sources.matterAccessPolicyEvaluator, "access_policy_status"),
      access_audit_projection: sourceStatus(sources.accessAuditProjection, "access_audit_projection_status"),
      store_policy_adapter: sourceStatus(sources.storePolicyAdapter, "store_policy_adapter_status"),
      policy_operations_surface: sourceStatus(sources.policyOperationsSurface, "policy_operations_surface_status"),
    },
    boundary_catalog: {
      schema_version: "matter-boundary-catalog.v1",
      generated_at: generatedAt,
      resource_boundary_paths: projected.resourceBoundaryPaths,
      retrieval_gate_checks: projected.retrievalGateChecks,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeMatterBoundarySlice(projected, validationItems, validation),
  };
  return {
    ...result,
    markdown: renderMatterBoundarySliceMarkdown(result),
  };
}

export async function writeMatterBoundarySlice(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterBoundarySlice(result);
  await writeJson(path.join(outDir, "matter-boundary-slice.json"), serializable);
  await writeJson(path.join(outDir, "resource-boundary-paths.json"), {
    generated_at: result.generated_at,
    resource_boundary_path_count: result.boundary_catalog.resource_boundary_paths.length,
    resource_boundary_paths: result.boundary_catalog.resource_boundary_paths,
  });
  await writeJson(path.join(outDir, "retrieval-gate-checks.json"), {
    generated_at: result.generated_at,
    retrieval_gate_check_count: result.boundary_catalog.retrieval_gate_checks.length,
    retrieval_gate_checks: result.boundary_catalog.retrieval_gate_checks,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    matter_boundary_slice_id: result.matter_boundary_slice_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterBoundarySliceCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterBoundarySlice(args);
    console.log(`Matter boundary slice written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_boundary_slice_status}`);
    console.log(`Resource paths: ${result.summary.resource_boundary_path_count}`);
    console.log(`Retrieval gates: ${result.summary.retrieval_gate_check_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectMatterBoundarySlice(sources, generatedAt) {
  const ingestedResources = sources.resourceIngest.resource_evidence?.resources ?? [];
  const resources = sources.resourceContractFreeze.resource_contract?.resources ?? [];
  const resourceAccessDecisions = sources.matterAccessPolicyEvaluator.matter_access_policy?.resource_access_decisions ?? [];
  const accessAuditRecords = sources.accessAuditProjection.access_audit_catalog?.access_audit_records ?? [];
  const storeQueryPlans = sources.storePolicyAdapter.store_policy_catalog?.store_query_plans ?? [];
  const enforcementProbes = sources.storePolicyAdapter.store_policy_catalog?.enforcement_probes ?? [];
  const policyRows = sources.policyOperationsSurface.policy_operations_catalog?.policy_decision_rows ?? [];
  const policyViolations = sources.policyOperationsSurface.policy_operations_catalog?.policy_violation_rows ?? [];
  const pendingApprovals = sources.policyOperationsSurface.policy_operations_catalog?.policy_pending_approval_rows ?? [];

  const ingestedByResourceId = new Map(ingestedResources.map((resource) => [resource.id, resource]));
  const decisionsByResourceId = groupBy(resourceAccessDecisions, "resource_id");
  const auditsBySourceDecisionId = new Map(accessAuditRecords.map((record) => [record.source_decision_id, record]));
  const auditsByResourceId = groupBy(accessAuditRecords.filter((record) => record.target_type === "resource"), "target_resource_id");
  const plansByAuditRecordId = new Map(storeQueryPlans.map((plan) => [plan.access_audit_record_id, plan]));
  const plansByResourceId = groupBy(storeQueryPlans.filter((plan) => plan.target_type === "resource"), "target_resource_id");
  const probesByPlanId = groupBy(enforcementProbes, "store_query_plan_id");
  const policyRowsByResourceId = groupBy(policyRows.filter((row) => row.resource_id), "resource_id");
  const policyViolationsByResourceId = groupBy(policyViolations.filter((row) => row.resource_id), "resource_id");
  const pendingApprovalsByResourceId = groupBy(pendingApprovals.filter((row) => row.resource_id), "resource_id");

  const retrievalGateChecks = storeQueryPlans
    .filter((plan) => plan.target_type === "resource")
    .map((plan) => buildRetrievalGateCheck({ plan, probes: probesByPlanId.get(plan.store_query_plan_id) ?? [], generatedAt }))
    .sort(by("retrieval_gate_check_id"));
  const gateChecksByResourceId = groupBy(retrievalGateChecks, "resource_id");

  const resourceBoundaryPaths = resources.map((resource) => buildResourceBoundaryPath({
    resource,
    ingestedResource: ingestedByResourceId.get(resource.resource_id),
    accessDecisions: decisionsByResourceId.get(resource.resource_id) ?? [],
    accessAuditRecords: auditsByResourceId.get(resource.resource_id) ?? [],
    storeQueryPlans: plansByResourceId.get(resource.resource_id) ?? [],
    policyDecisionRows: policyRowsByResourceId.get(resource.resource_id) ?? [],
    policyViolationRows: policyViolationsByResourceId.get(resource.resource_id) ?? [],
    pendingApprovalRows: pendingApprovalsByResourceId.get(resource.resource_id) ?? [],
    retrievalGateChecks: gateChecksByResourceId.get(resource.resource_id) ?? [],
    auditsBySourceDecisionId,
    plansByAuditRecordId,
    generatedAt,
  })).sort(by("boundary_path_id"));

  return {
    ingestedResources,
    resources,
    resourceAccessDecisions,
    accessAuditRecords,
    storeQueryPlans,
    enforcementProbes,
    policyRows,
    policyViolations,
    pendingApprovals,
    resourceBoundaryPaths,
    retrievalGateChecks,
  };
}

function buildResourceBoundaryPath({
  resource,
  ingestedResource,
  accessDecisions,
  accessAuditRecords,
  storeQueryPlans,
  policyDecisionRows,
  policyViolationRows,
  pendingApprovalRows,
  retrievalGateChecks,
  auditsBySourceDecisionId,
  plansByAuditRecordId,
  generatedAt,
}) {
  const unassignedResource = isUnassignedMatter(resource.matter_id);
  const accessDecisionCount = accessDecisions.length;
  const accessAuditRecordCount = accessAuditRecords.length;
  const storeQueryPlanCount = storeQueryPlans.length;
  const executableCount = storeQueryPlans.filter((plan) => plan.query_status === "executable").length;
  const heldCount = storeQueryPlans.filter((plan) => plan.query_status === "held_for_human_confirmation").length;
  const blockedCount = storeQueryPlans.filter((plan) => plan.query_status === "blocked").length;
  const allAccessDecisionsAudited = accessDecisions.every((decision) => auditsBySourceDecisionId.has(decision.resource_access_decision_id));
  const allAuditsCompiled = accessAuditRecords.every((record) => plansByAuditRecordId.has(record.access_audit_record_id));
  const allRequiredFiltersEnforced = storeQueryPlans.every(hasRequiredBoundaryFilters);
  const allNegativeProbesBlocked = retrievalGateChecks.every((check) => check.negative_probe_status === "blocked");
  const anyMatterTaggingRequired = accessDecisions.some((decision) => decision.reason_codes?.includes("resource_matter_tagging_required"))
    || accessAuditRecords.some((record) => record.matter_tagging_status === "pending_human_confirmation")
    || storeQueryPlans.some((plan) => plan.matter_tagging_required);
  const boundaryStatus = deriveBoundaryStatus({
    unassignedResource,
    executableCount,
    heldCount,
    blockedCount,
    allAccessDecisionsAudited,
    allAuditsCompiled,
    allRequiredFiltersEnforced,
    allNegativeProbesBlocked,
    anyMatterTaggingRequired,
  });

  return {
    schema_version: "resource-boundary-path.v1",
    boundary_path_id: `resource-boundary-path.${slugify(resource.resource_id)}`,
    resource_id: resource.resource_id,
    source_resource_id: ingestedResource?.id ?? null,
    resource_version_id: resource.latest_resource_version_id,
    tenant_id: resource.tenant_id,
    resource_matter_id: resource.matter_id,
    target_matter_ids: unique(accessDecisions.map((decision) => decision.target_matter_id)),
    classification: resource.classification,
    policy_snapshot_id: resource.policy_snapshot_id,
    source_system: resource.source_system,
    source_uri: resource.source_uri,
    ingest_status: ingestedResource ? "promoted" : "missing",
    matter_tagging_status: unassignedResource ? "pending_human_confirmation" : "assigned",
    access_decision_count: accessDecisionCount,
    access_audit_record_count: accessAuditRecordCount,
    store_query_plan_count: storeQueryPlanCount,
    executable_query_plan_count: executableCount,
    held_query_plan_count: heldCount,
    blocked_query_plan_count: blockedCount,
    policy_decision_row_count: policyDecisionRows.length,
    policy_violation_row_count: policyViolationRows.length,
    pending_approval_row_count: pendingApprovalRows.length,
    retrieval_gate_check_count: retrievalGateChecks.length,
    negative_probe_blocked_count: retrievalGateChecks.reduce((sum, check) => sum + check.blocked_negative_probe_count, 0),
    expected_negative_probe_count: retrievalGateChecks.reduce((sum, check) => sum + check.expected_negative_probe_count, 0),
    all_access_decisions_audited: allAccessDecisionsAudited,
    all_audits_compiled_to_store_query: allAuditsCompiled,
    all_required_store_filters_enforced: allRequiredFiltersEnforced,
    all_negative_retrieval_probes_blocked: allNegativeProbesBlocked,
    boundary_status: boundaryStatus,
    generated_at: generatedAt,
    metadata: {
      unassigned_resource: unassignedResource,
      any_matter_tagging_required: anyMatterTaggingRequired,
      source_expansion_item_id: resource.metadata?.source_expansion_item_id ?? ingestedResource?.metadata?.source_expansion_item_id ?? null,
    },
  };
}

function buildRetrievalGateCheck({ plan, probes, generatedAt }) {
  const negativeProbes = probes.filter((probe) => NEGATIVE_PROBE_TYPES.includes(probe.probe_type));
  const blockedNegativeProbeCount = negativeProbes.filter((probe) => probe.observed_outcome === "blocked" && probe.enforcement_status === "passed").length;
  const missingRequiredFilterKeys = unique([
    ...plan.missing_filter_keys,
    ...REQUIRED_STORE_FILTER_KEYS.filter((key) => !plan.required_filter_keys.includes(key)),
  ]);
  const baselineProbe = probes.find((probe) => probe.probe_type === "baseline_required_filters") ?? null;
  const gateDecision = plan.query_status === "executable"
    ? "allow"
    : plan.query_status === "held_for_human_confirmation"
      ? "review"
      : "deny";
  return {
    schema_version: "retrieval-gate-check.v1",
    retrieval_gate_check_id: `retrieval-gate-check.${slugify(plan.store_query_plan_id)}`,
    store_query_plan_id: plan.store_query_plan_id,
    access_audit_record_id: plan.access_audit_record_id,
    source_decision_id: plan.source_decision_id,
    source_decision_type: plan.source_decision_type,
    user_id: plan.user_id,
    runtime_id: plan.runtime_id,
    tenant_id: plan.tenant_id,
    target_matter_id: plan.target_matter_id,
    resource_id: plan.target_resource_id,
    classification: plan.classification_floor,
    policy_snapshot_id: plan.policy_snapshot_id,
    query_status: plan.query_status,
    gate_decision: gateDecision,
    rls_enforced: Boolean(plan.rls_enforced),
    required_filter_keys: plan.required_filter_keys,
    missing_required_filter_keys: missingRequiredFilterKeys,
    baseline_probe_outcome: baselineProbe?.observed_outcome ?? "missing",
    expected_negative_probe_count: NEGATIVE_PROBE_TYPES.length,
    blocked_negative_probe_count: blockedNegativeProbeCount,
    negative_probe_status: blockedNegativeProbeCount === NEGATIVE_PROBE_TYPES.length ? "blocked" : "attention",
    retrieval_gate_status: missingRequiredFilterKeys.length === 0 && Boolean(plan.rls_enforced) && blockedNegativeProbeCount === NEGATIVE_PROBE_TYPES.length
      ? "passed"
      : "failed",
    human_gate_required: plan.query_status === "held_for_human_confirmation" || Boolean(plan.requires_human_review),
    matter_tagging_required: Boolean(plan.matter_tagging_required),
    generated_at: generatedAt,
  };
}

function validateMatterBoundarySlice(sources, projected) {
  const items = [];
  const resourceIngestStatus = sources.resourceIngest.summary?.gate_status;
  const promotedResourceCount = sources.resourceIngest.summary?.promoted_resource_count ?? projected.ingestedResources.length;
  addValidation(
    items,
    "source.resource_ingest",
    "promoted_ingest_resources_available",
    ["passed", "blocked"].includes(resourceIngestStatus) && promotedResourceCount > 0,
    "Resource ingest must provide promoted resources; quarantined or blocked non-promoted items stay outside the boundary slice.",
  );
  addValidation(items, "source.resource_contract_freeze", "resource_contract_complete", sources.resourceContractFreeze.summary?.freeze_status === "complete", "Resource contract freeze must be complete.");
  addValidation(items, "source.matter_access_policy_evaluator", "matter_access_complete", sources.matterAccessPolicyEvaluator.summary?.access_policy_status === "complete", "Matter access policy evaluator must be complete.");
  addValidation(items, "source.access_audit_projection", "access_audit_complete", sources.accessAuditProjection.summary?.access_audit_projection_status === "complete", "Access audit projection must be complete.");
  addValidation(items, "source.store_policy_adapter", "store_policy_complete", sources.storePolicyAdapter.summary?.store_policy_adapter_status === "complete", "Store policy adapter must be complete.");
  addValidation(items, "source.policy_operations_surface", "policy_surface_complete", sources.policyOperationsSurface.summary?.policy_operations_surface_status === "complete", "Policy operations surface must be complete.");
  addValidation(items, "resource_boundary_paths", "resource_paths_present", projected.resourceBoundaryPaths.length > 0, `${projected.resourceBoundaryPaths.length} resource boundary path(s) projected.`);
  addValidation(items, "retrieval_gate_checks", "retrieval_gate_checks_present", projected.retrievalGateChecks.length > 0, `${projected.retrievalGateChecks.length} retrieval gate check(s) projected.`);

  const ingestedResourceIds = new Set(projected.ingestedResources.map((resource) => resource.id));
  const resourceIds = new Set(projected.resources.map((resource) => resource.resource_id));
  addValidation(items, "resource_contract.resources", "ingested_resources_preserved", projected.resources.every((resource) => ingestedResourceIds.has(resource.resource_id)), "Every Resource v2 row must originate from resource ingest.");
  addValidation(items, "resource_ingest.resources", "promoted_resource_coverage", projected.ingestedResources.every((resource) => resourceIds.has(resource.id)), "Every promoted ingest resource must be preserved in Resource v2.");

  for (const pathRow of projected.resourceBoundaryPaths) {
    addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "ingest_promoted", pathRow.ingest_status === "promoted", "Resource boundary path must start from a promoted ingest resource.");
    addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "access_decisions_present", pathRow.access_decision_count > 0, "Resource boundary path must include resource access decisions.");
    addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "access_audited", pathRow.all_access_decisions_audited && pathRow.access_audit_record_count === pathRow.access_decision_count, "Every resource access decision must have an access audit record.");
    addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "store_query_compiled", pathRow.all_audits_compiled_to_store_query && pathRow.store_query_plan_count === pathRow.access_audit_record_count, "Every resource access audit record must compile to a store query plan.");
    addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "store_filters_enforced", pathRow.all_required_store_filters_enforced, "Every store query plan must enforce tenant, matter, classification, policy snapshot, access audit, and resource filters.");
    addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "negative_retrieval_probes_blocked", pathRow.all_negative_retrieval_probes_blocked && pathRow.negative_probe_blocked_count === pathRow.expected_negative_probe_count, "Every dangerous retrieval probe must be blocked.");
    addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "policy_surface_visible", pathRow.policy_decision_row_count > 0, "Resource boundary path must be visible in the policy operations surface.");
    if (pathRow.matter_tagging_status === "pending_human_confirmation") {
      addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "unassigned_not_executable", pathRow.executable_query_plan_count === 0, "Unassigned resources must not become executable before matter tagging.");
      addValidation(items, `resource_boundary_path.${pathRow.resource_id}`, "unassigned_human_gate_visible", pathRow.held_query_plan_count > 0 && pathRow.pending_approval_row_count > 0, "Unassigned resources must be held behind human matter tagging or approval gate.");
    }
  }

  for (const gateCheck of projected.retrievalGateChecks) {
    addValidation(items, `retrieval_gate_check.${gateCheck.retrieval_gate_check_id}`, "retrieval_gate_passed", gateCheck.retrieval_gate_status === "passed", "Retrieval gate check must pass.");
    addValidation(items, `retrieval_gate_check.${gateCheck.retrieval_gate_check_id}`, "required_filters_present", gateCheck.missing_required_filter_keys.length === 0, "Retrieval gate check must not miss required filters.");
    addValidation(items, `retrieval_gate_check.${gateCheck.retrieval_gate_check_id}`, "negative_probes_blocked", gateCheck.blocked_negative_probe_count === gateCheck.expected_negative_probe_count, "Negative retrieval probes must be blocked.");
  }

  return items;
}

function summarizeMatterBoundarySlice(projected, validationItems, validation) {
  const paths = projected.resourceBoundaryPaths;
  const gates = projected.retrievalGateChecks;
  return {
    matter_boundary_slice_status: validation.valid ? "complete" : "blocked",
    source_resource_count: projected.ingestedResources.length,
    resource_boundary_path_count: paths.length,
    retrieval_gate_check_count: gates.length,
    promoted_resource_path_count: paths.filter((row) => row.ingest_status === "promoted").length,
    access_decision_covered_resource_count: paths.filter((row) => row.access_decision_count > 0).length,
    access_audited_resource_count: paths.filter((row) => row.all_access_decisions_audited).length,
    store_compiled_resource_count: paths.filter((row) => row.all_audits_compiled_to_store_query).length,
    required_store_filter_resource_count: paths.filter((row) => row.all_required_store_filters_enforced).length,
    negative_probe_blocked_resource_count: paths.filter((row) => row.all_negative_retrieval_probes_blocked).length,
    policy_surface_visible_resource_count: paths.filter((row) => row.policy_decision_row_count > 0).length,
    unassigned_resource_count: paths.filter((row) => row.matter_tagging_status === "pending_human_confirmation").length,
    unassigned_executable_query_plan_count: paths.filter((row) => row.matter_tagging_status === "pending_human_confirmation").reduce((sum, row) => sum + row.executable_query_plan_count, 0),
    held_for_matter_tagging_resource_count: paths.filter((row) => row.boundary_status === "held_for_matter_tagging").length,
    retrieval_ready_resource_count: paths.filter((row) => row.boundary_status === "retrieval_ready").length,
    blocked_resource_count: paths.filter((row) => row.boundary_status === "blocked").length,
    executable_query_plan_count: paths.reduce((sum, row) => sum + row.executable_query_plan_count, 0),
    held_query_plan_count: paths.reduce((sum, row) => sum + row.held_query_plan_count, 0),
    blocked_query_plan_count: paths.reduce((sum, row) => sum + row.blocked_query_plan_count, 0),
    passed_retrieval_gate_check_count: gates.filter((gate) => gate.retrieval_gate_status === "passed").length,
    failed_retrieval_gate_check_count: gates.filter((gate) => gate.retrieval_gate_status === "failed").length,
    negative_probe_expected_count: gates.reduce((sum, gate) => sum + gate.expected_negative_probe_count, 0),
    negative_probe_blocked_count: gates.reduce((sum, gate) => sum + gate.blocked_negative_probe_count, 0),
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_boundary_status: countBy(paths, "boundary_status"),
    by_query_status: countBy(projected.storeQueryPlans.filter((plan) => plan.target_type === "resource"), "query_status"),
    by_classification: countBy(paths, "classification"),
  };
}

function deriveBoundaryStatus({
  unassignedResource,
  executableCount,
  heldCount,
  blockedCount,
  allAccessDecisionsAudited,
  allAuditsCompiled,
  allRequiredFiltersEnforced,
  allNegativeProbesBlocked,
  anyMatterTaggingRequired,
}) {
  if (!allAccessDecisionsAudited || !allAuditsCompiled || !allRequiredFiltersEnforced || !allNegativeProbesBlocked) return "blocked";
  if (unassignedResource || anyMatterTaggingRequired) return executableCount === 0 && heldCount > 0 ? "held_for_matter_tagging" : "blocked";
  if (executableCount > 0) return "retrieval_ready";
  if (heldCount > 0) return "held_for_human_review";
  if (blockedCount > 0) return "blocked";
  return "blocked";
}

function hasRequiredBoundaryFilters(plan) {
  return Boolean(plan.rls_enforced)
    && REQUIRED_STORE_FILTER_KEYS.every((key) => plan.required_filter_keys.includes(key) && plan.query_filters?.[key])
    && (plan.target_type !== "resource" || (plan.required_filter_keys.includes("resource_id") && plan.query_filters?.resource_id))
    && (plan.missing_filter_keys ?? []).length === 0;
}

function addValidation(items, itemPath, checkId, passed, message) {
  items.push({
    validation_item_id: `matter-boundary-slice.${slugify(itemPath)}.${checkId}`,
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
  return { valid: errors.length === 0, errors };
}

function renderMatterBoundarySliceMarkdown(result) {
  const lines = [];
  lines.push("# Matter Boundary Slice");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_boundary_slice_status}`);
  lines.push("");
  lines.push(`- Resource boundary paths: ${result.summary.resource_boundary_path_count}`);
  lines.push(`- Retrieval gate checks: ${result.summary.retrieval_gate_check_count}`);
  lines.push(`- Held for matter tagging resources: ${result.summary.held_for_matter_tagging_resource_count}`);
  lines.push(`- Retrieval-ready resources: ${result.summary.retrieval_ready_resource_count}`);
  lines.push(`- Negative probes blocked: ${result.summary.negative_probe_blocked_count}/${result.summary.negative_probe_expected_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Resource Boundary Paths");
  for (const row of result.boundary_catalog.resource_boundary_paths.slice(0, 16)) {
    lines.push(`- ${row.resource_id}: ${row.boundary_status}, ${row.store_query_plan_count} store plan(s), ${row.pending_approval_row_count} pending approval row(s)`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function sourceStatus(artifact, key) {
  return {
    schema_version: artifact.schema_version ?? null,
    status: artifact.summary?.[key] ?? "unknown",
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
    generated_at: artifact.generated_at ?? null,
  };
}

function normalizeInputs(options) {
  return {
    resource_ingest_path: path.resolve(options.resourceIngestPath ?? DEFAULT_MATTER_BOUNDARY_SLICE_INPUTS.resourceIngestPath),
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? DEFAULT_MATTER_BOUNDARY_SLICE_INPUTS.resourceContractFreezePath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_MATTER_BOUNDARY_SLICE_INPUTS.matterAccessPolicyEvaluatorPath),
    access_audit_projection_path: path.resolve(options.accessAuditProjectionPath ?? DEFAULT_MATTER_BOUNDARY_SLICE_INPUTS.accessAuditProjectionPath),
    store_policy_adapter_path: path.resolve(options.storePolicyAdapterPath ?? DEFAULT_MATTER_BOUNDARY_SLICE_INPUTS.storePolicyAdapterPath),
    policy_operations_surface_path: path.resolve(options.policyOperationsSurfacePath ?? DEFAULT_MATTER_BOUNDARY_SLICE_INPUTS.policyOperationsSurfacePath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--resource-ingest") parsed.resourceIngestPath = argv[++index];
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--access-audit-projection") parsed.accessAuditProjectionPath = argv[++index];
    else if (arg === "--store-policy") parsed.storePolicyAdapterPath = argv[++index];
    else if (arg === "--policy-operations-surface") parsed.policyOperationsSurfacePath = argv[++index];
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
  console.log(`Usage: node scripts/matter-boundary-slice.mjs [options]

Options:
  --resource-ingest <path>            resource-ingest.json path.
  --resource-contract-freeze <path>   resource-contract-freeze.json path.
  --matter-access-policy <path>       matter-access-policy-evaluator.json path.
  --access-audit-projection <path>    access-audit-projection.json path.
  --store-policy <path>               store-policy-adapter.json path.
  --policy-operations-surface <path>  policy-operations-surface.json path.
  --out-dir <path>                    Output directory.
  --run-at <iso>                      Fixed generation timestamp.
  --check                             Exit non-zero when validation fails.
  -h, --help                          Show this help.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableMatterBoundarySlice(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function isUnassignedMatter(matterId) {
  return !matterId || String(matterId).includes(".unassigned.");
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items) {
    const value = typeof key === "function" ? key(item) : item[key];
    const normalized = value ?? "unknown";
    grouped.set(normalized, [...(grouped.get(normalized) ?? []), item]);
  }
  return grouped;
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

function unique(values = []) {
  return [...new Set(values.filter(Boolean))].sort();
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
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
