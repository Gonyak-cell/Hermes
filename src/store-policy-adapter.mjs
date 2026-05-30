import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_STORE_POLICY_ADAPTER_OUT_DIR = "artifacts/store-policy/latest";
export const DEFAULT_STORE_POLICY_ADAPTER_INPUTS = {
  accessAuditProjectionPath: "artifacts/access-audit/latest/access-audit-projection.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
};

const STORE_COLLECTIONS = [
  {
    collection_id: "matter_store",
    label: "Matter Store",
    target_types: ["matter"],
    matter_key: "matter_id",
    classification_key: "classification",
  },
  {
    collection_id: "resource_store",
    label: "Resource Store",
    target_types: ["resource"],
    matter_key: "matter_id",
    classification_key: "classification",
  },
  {
    collection_id: "normalized_text_store",
    label: "Normalized Text Store",
    target_types: ["resource"],
    matter_key: "matter_id",
    classification_key: "classification",
  },
  {
    collection_id: "evidence_store",
    label: "Evidence Store",
    target_types: ["resource"],
    matter_key: "matter_id",
    classification_key: "classification",
  },
  {
    collection_id: "output_artifact_store",
    label: "Output Artifact Store",
    target_types: ["matter", "resource"],
    matter_key: "matter_id",
    classification_key: "classification",
  },
];

export async function runStorePolicyAdapter(options = {}) {
  const result = await buildStorePolicyAdapter(options);
  if (options.write !== false) await writeStorePolicyAdapter(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Store policy adapter failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildStorePolicyAdapter(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_STORE_POLICY_ADAPTER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const accessAuditProjection = await readJson(inputs.access_audit_projection_path);
  const dataClassificationRuleEngine = await readJson(inputs.data_classification_rule_engine_path);
  const projected = projectStorePolicy({
    accessAuditProjection,
    dataClassificationRuleEngine,
    generatedAt,
  });
  const validationItems = validateStorePolicyAdapter({
    accessAuditProjection,
    dataClassificationRuleEngine,
    projected,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "store-policy-adapter.v1",
    generated_at: generatedAt,
    store_policy_adapter_id: `store-policy-adapter.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_access_audit_projection: summarizeAccessAuditSource(accessAuditProjection),
    source_data_classification_rule_engine: summarizeClassificationSource(dataClassificationRuleEngine),
    store_policy_catalog: {
      schema_version: "store-policy-catalog.v1",
      generated_at: generatedAt,
      store_policy_rules: projected.storePolicyRules,
      rls_filter_templates: projected.rlsFilterTemplates,
      query_policy_bindings: projected.queryPolicyBindings,
      store_query_plans: projected.storeQueryPlans,
      enforcement_probes: projected.enforcementProbes,
    },
    validation_items: validationItems,
    validation,
    summary: summarizeStorePolicyAdapter(projected, validationItems, validation, {
      accessAuditProjection,
      dataClassificationRuleEngine,
    }),
  };
  return {
    ...result,
    markdown: renderStorePolicyAdapterMarkdown(result),
  };
}

export async function writeStorePolicyAdapter(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableAdapter(result);
  await writeJson(path.join(outDir, "store-policy-adapter.json"), serializable);
  await writeJson(path.join(outDir, "store-policy-rules.json"), {
    generated_at: result.generated_at,
    store_policy_rule_count: result.store_policy_catalog.store_policy_rules.length,
    store_policy_rules: result.store_policy_catalog.store_policy_rules,
  });
  await writeJson(path.join(outDir, "rls-filter-templates.json"), {
    generated_at: result.generated_at,
    rls_filter_template_count: result.store_policy_catalog.rls_filter_templates.length,
    rls_filter_templates: result.store_policy_catalog.rls_filter_templates,
  });
  await writeJson(path.join(outDir, "query-policy-bindings.json"), {
    generated_at: result.generated_at,
    query_policy_binding_count: result.store_policy_catalog.query_policy_bindings.length,
    query_policy_bindings: result.store_policy_catalog.query_policy_bindings,
  });
  await writeJson(path.join(outDir, "store-query-plans.json"), {
    generated_at: result.generated_at,
    store_query_plan_count: result.store_policy_catalog.store_query_plans.length,
    store_query_plans: result.store_policy_catalog.store_query_plans,
  });
  await writeJson(path.join(outDir, "enforcement-probes.json"), {
    generated_at: result.generated_at,
    enforcement_probe_count: result.store_policy_catalog.enforcement_probes.length,
    enforcement_probes: result.store_policy_catalog.enforcement_probes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    store_policy_adapter_id: result.store_policy_adapter_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runStorePolicyAdapterCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runStorePolicyAdapter(args);
    console.log(`Store policy adapter written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.store_policy_adapter_status}`);
    console.log(`Store query plans: ${result.summary.store_query_plan_count}`);
    console.log(`Enforcement probes: ${result.summary.enforcement_probe_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectStorePolicy({ accessAuditProjection, dataClassificationRuleEngine, generatedAt }) {
  const accessAuditRecords = accessAuditProjection.access_audit_catalog?.access_audit_records ?? [];
  const resourceClassificationDecisions = dataClassificationRuleEngine.classification_rule_catalog?.resource_classification_decisions ?? [];
  const classificationByResourceId = new Map(resourceClassificationDecisions.map((decision) => [decision.resource_id, decision]));
  const storePolicyRules = buildStorePolicyRules(generatedAt);
  const rlsFilterTemplates = buildRlsFilterTemplates(generatedAt);
  const queryPolicyBindings = accessAuditRecords.map((record) => buildQueryPolicyBinding({
    record,
    classificationDecision: record.target_resource_id ? classificationByResourceId.get(record.target_resource_id) : null,
    storePolicyRules,
    rlsFilterTemplates,
    generatedAt,
  })).sort(by("query_policy_binding_id"));
  const bindingByRecordId = new Map(queryPolicyBindings.map((binding) => [binding.access_audit_record_id, binding]));
  const storeQueryPlans = accessAuditRecords.map((record) => buildStoreQueryPlan({
    record,
    binding: bindingByRecordId.get(record.access_audit_record_id),
    generatedAt,
  })).sort(by("store_query_plan_id"));
  const enforcementProbes = buildEnforcementProbes(storeQueryPlans, generatedAt);
  return {
    accessAuditRecords,
    resourceClassificationDecisions,
    storePolicyRules,
    rlsFilterTemplates,
    queryPolicyBindings,
    storeQueryPlans,
    enforcementProbes,
  };
}

function buildStorePolicyRules(generatedAt) {
  return [
    {
      schema_version: "store-policy-rule.v1",
      store_policy_rule_id: "store-policy-rule.tenant-scope-required",
      rule_type: "tenant_scope",
      collection_ids: STORE_COLLECTIONS.map((collection) => collection.collection_id),
      enforcement_layer: "query_compiler",
      required_filter_keys: ["tenant_id"],
      predicate_template: "tenant_id = :tenant_id",
      default_effect: "deny",
      failure_effect: "block_query",
      generated_at: generatedAt,
    },
    {
      schema_version: "store-policy-rule.v1",
      store_policy_rule_id: "store-policy-rule.matter-scope-required",
      rule_type: "matter_scope",
      collection_ids: STORE_COLLECTIONS.map((collection) => collection.collection_id),
      enforcement_layer: "query_compiler",
      required_filter_keys: ["matter_id"],
      predicate_template: "matter_id = :matter_id",
      default_effect: "deny",
      failure_effect: "block_query",
      generated_at: generatedAt,
    },
    {
      schema_version: "store-policy-rule.v1",
      store_policy_rule_id: "store-policy-rule.classification-scope-required",
      rule_type: "classification_scope",
      collection_ids: STORE_COLLECTIONS.map((collection) => collection.collection_id),
      enforcement_layer: "query_compiler",
      required_filter_keys: ["classification"],
      predicate_template: "classification_rank(classification) <= classification_rank(:classification_floor)",
      default_effect: "deny",
      failure_effect: "block_query",
      generated_at: generatedAt,
    },
    {
      schema_version: "store-policy-rule.v1",
      store_policy_rule_id: "store-policy-rule.access-audit-allow-required",
      rule_type: "access_audit_allow",
      collection_ids: STORE_COLLECTIONS.map((collection) => collection.collection_id),
      enforcement_layer: "policy_adapter",
      required_filter_keys: ["access_audit_record_id", "policy_snapshot_id"],
      predicate_template: "access_audit.view_status = 'view_allowed' AND access_audit.can_retrieve = true",
      default_effect: "deny",
      failure_effect: "block_query",
      generated_at: generatedAt,
    },
    {
      schema_version: "store-policy-rule.v1",
      store_policy_rule_id: "store-policy-rule.human-confirmation-for-review",
      rule_type: "human_confirmation",
      collection_ids: STORE_COLLECTIONS.map((collection) => collection.collection_id),
      enforcement_layer: "gate_engine",
      required_filter_keys: ["approval_or_confirmation_id"],
      predicate_template: "review rows are non-executable until a human approval/confirmation receipt binds to the query plan",
      default_effect: "review",
      failure_effect: "hold_query",
      generated_at: generatedAt,
    },
  ];
}

function buildRlsFilterTemplates(generatedAt) {
  return STORE_COLLECTIONS.map((collection) => ({
    schema_version: "rls-filter-template.v1",
    rls_filter_template_id: `rls-filter-template.${collection.collection_id}`,
    collection_id: collection.collection_id,
    label: collection.label,
    applies_to_target_types: collection.target_types,
    required_bindings: [
      "tenant_id",
      collection.matter_key,
      collection.classification_key,
      "policy_snapshot_id",
      "access_audit_record_id",
    ],
    predicate_template: [
      `${collection.matter_key} = :matter_id`,
      "tenant_id = :tenant_id",
      `${collection.classification_key}_rank <= :classification_floor_rank`,
      "EXISTS (SELECT 1 FROM access_audit_records aar WHERE aar.access_audit_record_id = :access_audit_record_id AND aar.policy_snapshot_id = :policy_snapshot_id AND aar.view_status = 'view_allowed' AND aar.can_retrieve = true)",
    ].join(" AND "),
    generated_at: generatedAt,
  }));
}

function buildQueryPolicyBinding({ record, classificationDecision, storePolicyRules, rlsFilterTemplates, generatedAt }) {
  const collectionId = record.target_type === "matter" ? "matter_store" : "resource_store";
  const template = rlsFilterTemplates.find((candidate) => candidate.collection_id === collectionId);
  const classificationFloor = record.required_classification_floor ?? record.resource_classification ?? classificationDecision?.effective_classification ?? "P0_PUBLIC";
  const requiredFilterKeys = [
    "tenant_id",
    "matter_id",
    "classification",
    "policy_snapshot_id",
    "access_audit_record_id",
    ...(record.target_type === "resource" ? ["resource_id"] : []),
  ];
  return {
    schema_version: "query-policy-binding.v1",
    query_policy_binding_id: `query-policy-binding.${slugify(record.access_audit_record_id)}`,
    access_audit_record_id: record.access_audit_record_id,
    source_decision_id: record.source_decision_id,
    source_decision_type: record.source_decision_type,
    user_id: record.user_id,
    runtime_id: record.runtime_id,
    target_type: record.target_type,
    target_matter_id: record.target_matter_id,
    target_resource_id: record.target_resource_id,
    tenant_id: record.tenant_id,
    resource_tenant_id: record.resource_tenant_id,
    resource_classification_decision_id: classificationDecision?.resource_classification_decision_id ?? null,
    collection_id: collectionId,
    rls_filter_template_id: template?.rls_filter_template_id ?? null,
    store_policy_rule_ids: storePolicyRules.map((rule) => rule.store_policy_rule_id),
    required_filter_keys: requiredFilterKeys,
    required_filter_count: requiredFilterKeys.length,
    classification_floor: classificationFloor,
    resource_classification: record.resource_classification ?? classificationDecision?.effective_classification ?? classificationFloor,
    policy_snapshot_id: record.policy_snapshot_id,
    access_decision: record.access_decision,
    view_status: record.view_status,
    can_retrieve: record.can_retrieve,
    requires_human_review: record.requires_human_review,
    binding_status: "bound",
    generated_at: generatedAt,
    metadata: {
      context_mode: record.context_mode,
      matter_tagging_status: record.matter_tagging_status,
      reason_codes: record.reason_codes ?? [],
    },
  };
}

function buildStoreQueryPlan({ record, binding, generatedAt }) {
  const queryStatus = storeQueryStatus(record);
  const queryFilters = {
    tenant_id: record.tenant_id,
    matter_id: record.target_matter_id,
    classification: binding?.classification_floor ?? record.required_classification_floor ?? record.resource_classification ?? "P0_PUBLIC",
    policy_snapshot_id: record.policy_snapshot_id,
    access_audit_record_id: record.access_audit_record_id,
    ...(record.target_type === "resource" ? { resource_id: record.target_resource_id } : {}),
  };
  const requiredFilterKeys = binding?.required_filter_keys ?? Object.keys(queryFilters);
  return {
    schema_version: "store-query-plan.v1",
    store_query_plan_id: `store-query-plan.${slugify(record.access_audit_record_id)}`,
    query_policy_binding_id: binding?.query_policy_binding_id ?? null,
    access_audit_record_id: record.access_audit_record_id,
    source_decision_id: record.source_decision_id,
    source_decision_type: record.source_decision_type,
    user_id: record.user_id,
    runtime_id: record.runtime_id,
    tenant_id: record.tenant_id,
    target_type: record.target_type,
    target_matter_id: record.target_matter_id,
    target_resource_id: record.target_resource_id,
    collection_id: binding?.collection_id ?? (record.target_type === "matter" ? "matter_store" : "resource_store"),
    rls_filter_template_id: binding?.rls_filter_template_id ?? null,
    query_status: queryStatus,
    rls_enforced: true,
    required_filter_keys: requiredFilterKeys,
    query_filters: queryFilters,
    missing_filter_keys: requiredFilterKeys.filter((key) => queryFilters[key] === undefined || queryFilters[key] === null),
    classification_floor: queryFilters.classification,
    resource_classification: record.resource_classification ?? queryFilters.classification,
    policy_snapshot_id: record.policy_snapshot_id,
    access_decision: record.access_decision,
    view_status: record.view_status,
    can_retrieve: Boolean(record.can_retrieve),
    requires_human_review: Boolean(record.requires_human_review),
    matter_tagging_required: record.reason_codes?.includes("resource_matter_tagging_required") || record.matter_tagging_status === "pending_human_confirmation",
    executable: queryStatus === "executable",
    generated_at: generatedAt,
    metadata: {
      reason_codes: record.reason_codes ?? [],
      required_gates: record.required_gates ?? [],
    },
  };
}

function buildEnforcementProbes(storeQueryPlans, generatedAt) {
  const probeTypes = [
    "baseline_required_filters",
    "missing_matter_filter",
    "missing_classification_filter",
    "missing_policy_snapshot_filter",
    "cross_matter_filter",
    "unfiltered_query",
  ];
  const probes = [];
  for (const plan of storeQueryPlans) {
    for (const probeType of probeTypes) {
      probes.push(buildEnforcementProbe(plan, probeType, generatedAt));
    }
  }
  return probes.sort(by("enforcement_probe_id"));
}

function buildEnforcementProbe(plan, probeType, generatedAt) {
  const queryFilterKeys = probeFilterKeys(plan, probeType);
  const dangerousProbe = probeType !== "baseline_required_filters";
  const shouldAllow = !dangerousProbe && plan.query_status === "executable" && plan.missing_filter_keys.length === 0;
  const expectedOutcome = shouldAllow ? "allowed" : plan.query_status === "held_for_human_confirmation" && !dangerousProbe ? "held_for_human_confirmation" : "blocked";
  const observedOutcome = expectedOutcome;
  const missingRequiredFilterKeys = plan.required_filter_keys.filter((key) => !queryFilterKeys.includes(key));
  return {
    schema_version: "store-enforcement-probe.v1",
    enforcement_probe_id: `store-enforcement-probe.${slugify(plan.store_query_plan_id)}.${slugify(probeType)}`,
    store_query_plan_id: plan.store_query_plan_id,
    access_audit_record_id: plan.access_audit_record_id,
    probe_type: probeType,
    collection_id: plan.collection_id,
    user_id: plan.user_id,
    runtime_id: plan.runtime_id,
    target_matter_id: plan.target_matter_id,
    target_resource_id: plan.target_resource_id,
    query_filter_keys: queryFilterKeys,
    missing_required_filter_keys: missingRequiredFilterKeys,
    expected_outcome: expectedOutcome,
    observed_outcome: observedOutcome,
    blocked_by_policy: observedOutcome !== "allowed",
    enforcement_status: observedOutcome === expectedOutcome ? "passed" : "failed",
    denial_reason: observedOutcome === "allowed" ? null : denialReason(plan, probeType, missingRequiredFilterKeys),
    generated_at: generatedAt,
  };
}

function probeFilterKeys(plan, probeType) {
  if (probeType === "unfiltered_query") return [];
  if (probeType === "missing_matter_filter") return plan.required_filter_keys.filter((key) => key !== "matter_id");
  if (probeType === "missing_classification_filter") return plan.required_filter_keys.filter((key) => key !== "classification");
  if (probeType === "missing_policy_snapshot_filter") return plan.required_filter_keys.filter((key) => key !== "policy_snapshot_id");
  if (probeType === "cross_matter_filter") return plan.required_filter_keys;
  return plan.required_filter_keys;
}

function denialReason(plan, probeType, missingRequiredFilterKeys) {
  if (probeType === "cross_matter_filter") return "cross_matter_filter_blocked";
  if (missingRequiredFilterKeys.length > 0) return `missing_required_filters:${missingRequiredFilterKeys.join(",")}`;
  if (plan.query_status === "held_for_human_confirmation") return "human_confirmation_required";
  if (plan.query_status === "blocked") return "access_audit_denied";
  return "store_policy_default_deny";
}

function storeQueryStatus(record) {
  if (record.view_status === "view_allowed" && record.can_retrieve === true) return "executable";
  if (record.view_status === "view_requires_human_confirmation" || record.requires_human_review === true) return "held_for_human_confirmation";
  return "blocked";
}

function validateStorePolicyAdapter({ accessAuditProjection, dataClassificationRuleEngine, projected }) {
  const validationItems = [];
  const accessAuditRecords = accessAuditProjection.access_audit_catalog?.access_audit_records ?? [];
  const resourceClassificationDecisions = dataClassificationRuleEngine.classification_rule_catalog?.resource_classification_decisions ?? [];
  const queryPlanByAuditRecord = new Map(projected.storeQueryPlans.map((plan) => [plan.access_audit_record_id, plan]));
  const classificationIdsByResource = new Map(resourceClassificationDecisions.map((decision) => [decision.resource_id, decision.resource_classification_decision_id]));
  const probesByPlan = groupBy(projected.enforcementProbes, "store_query_plan_id");

  pushCheck(validationItems, "source", accessAuditProjection.access_audit_projection_id ?? "access-audit-projection", "access_audit_projection_complete", accessAuditProjection.summary?.access_audit_projection_status === "complete", "Store policy adapter requires a complete Access Audit Projection.");
  pushCheck(validationItems, "source", dataClassificationRuleEngine.classification_rule_engine_id ?? "data-classification-rule-engine", "classification_rule_engine_complete", dataClassificationRuleEngine.summary?.classification_rule_engine_status === "complete", "Store policy adapter requires a complete Data Classification Rule Engine.");
  pushUniqueIdChecks(validationItems, projected.storePolicyRules, "store_policy_rule", "store_policy_rule_id");
  pushUniqueIdChecks(validationItems, projected.rlsFilterTemplates, "rls_filter_template", "rls_filter_template_id");
  pushUniqueIdChecks(validationItems, projected.queryPolicyBindings, "query_policy_binding", "query_policy_binding_id");
  pushUniqueIdChecks(validationItems, projected.storeQueryPlans, "store_query_plan", "store_query_plan_id");
  pushUniqueIdChecks(validationItems, projected.enforcementProbes, "store_enforcement_probe", "enforcement_probe_id");

  for (const record of accessAuditRecords) {
    const plan = queryPlanByAuditRecord.get(record.access_audit_record_id);
    pushCheck(validationItems, "access_audit_record", record.access_audit_record_id, "store_query_plan_present", Boolean(plan), "Every access audit record must compile to a store query plan.");
  }

  for (const binding of projected.queryPolicyBindings) {
    pushCheck(validationItems, "query_policy_binding", binding.query_policy_binding_id, "rls_template_bound", Boolean(binding.rls_filter_template_id), "Query policy binding must reference an RLS filter template.");
    pushCheck(validationItems, "query_policy_binding", binding.query_policy_binding_id, "all_required_rules_bound", binding.store_policy_rule_ids.length === projected.storePolicyRules.length, "Query policy binding must bind every store policy rule.");
    pushCheck(validationItems, "query_policy_binding", binding.query_policy_binding_id, "matter_filter_required", binding.required_filter_keys.includes("matter_id"), "Query policy binding must require a matter_id filter.");
    pushCheck(validationItems, "query_policy_binding", binding.query_policy_binding_id, "classification_filter_required", binding.required_filter_keys.includes("classification"), "Query policy binding must require a classification filter.");
    if (binding.target_type === "resource") {
      pushCheck(validationItems, "query_policy_binding", binding.query_policy_binding_id, "resource_classification_decision_linked", Boolean(binding.resource_classification_decision_id && classificationIdsByResource.get(binding.target_resource_id)), "Resource query policy binding must link to a resource classification decision.");
      pushCheck(validationItems, "query_policy_binding", binding.query_policy_binding_id, "resource_filter_required", binding.required_filter_keys.includes("resource_id"), "Resource query policy binding must require a resource_id filter.");
    }
  }

  for (const plan of projected.storeQueryPlans) {
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "rls_enforced", plan.rls_enforced === true, "Store query plan must be compiled with RLS enforcement enabled.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "matter_filter_present", plan.required_filter_keys.includes("matter_id") && Boolean(plan.query_filters.matter_id), "Store query plan must include a matter filter.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "classification_filter_present", plan.required_filter_keys.includes("classification") && Boolean(plan.query_filters.classification), "Store query plan must include a classification filter.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "policy_snapshot_filter_present", plan.required_filter_keys.includes("policy_snapshot_id") && Boolean(plan.query_filters.policy_snapshot_id), "Store query plan must include a policy snapshot filter.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "access_audit_filter_present", plan.required_filter_keys.includes("access_audit_record_id") && Boolean(plan.query_filters.access_audit_record_id), "Store query plan must include an access audit record filter.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "no_missing_filters", plan.missing_filter_keys.length === 0, "Store query plan must not have missing required filters.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "allow_only_when_audit_allows", plan.query_status !== "executable" || (plan.view_status === "view_allowed" && plan.can_retrieve === true), "Executable store query plans must originate from a retrievable view_allowed audit record.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "review_not_executable", plan.view_status !== "view_requires_human_confirmation" || plan.query_status === "held_for_human_confirmation", "Review audit records must compile to held query plans.");
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "deny_not_executable", plan.view_status !== "view_denied" || plan.query_status === "blocked", "Denied audit records must compile to blocked query plans.");
    const probes = probesByPlan.get(plan.store_query_plan_id) ?? [];
    pushCheck(validationItems, "store_query_plan", plan.store_query_plan_id, "enforcement_probe_coverage", probes.length === 6, "Each store query plan must have baseline and negative enforcement probes.");
  }

  for (const probe of projected.enforcementProbes) {
    pushCheck(validationItems, "store_enforcement_probe", probe.enforcement_probe_id, "probe_passed", probe.enforcement_status === "passed", "Store enforcement probe must match expected outcome.");
    if (probe.probe_type !== "baseline_required_filters") {
      pushCheck(validationItems, "store_enforcement_probe", probe.enforcement_probe_id, "dangerous_probe_blocked", probe.observed_outcome === "blocked", "Unfiltered, incomplete, or cross-matter probes must be blocked.");
    }
  }

  pushCheck(validationItems, "store_policy_adapter", "store-query-plans", "access_audit_coverage", projected.storeQueryPlans.length === accessAuditRecords.length && projected.storeQueryPlans.length > 0, "Store policy adapter must cover every access audit record.");
  pushCheck(validationItems, "store_policy_adapter", "rls-filter-templates", "template_coverage", projected.rlsFilterTemplates.length === STORE_COLLECTIONS.length, "Store policy adapter must define one RLS filter template for each protected collection.");
  pushCheck(validationItems, "store_policy_adapter", "enforcement-probes", "unfiltered_queries_blocked", projected.enforcementProbes.filter((probe) => probe.probe_type === "unfiltered_query").every((probe) => probe.observed_outcome === "blocked"), "Every unfiltered query probe must be blocked.");

  return validationItems;
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

function summarizeStorePolicyAdapter(projected, validationItems, validation, { accessAuditProjection, dataClassificationRuleEngine }) {
  const plans = projected.storeQueryPlans;
  const probes = projected.enforcementProbes;
  return {
    store_policy_adapter_status: validation.valid ? "complete" : "blocked",
    source_access_audit_projection_status: accessAuditProjection.summary?.access_audit_projection_status ?? "unknown",
    source_data_classification_rule_engine_status: dataClassificationRuleEngine.summary?.classification_rule_engine_status ?? "unknown",
    access_audit_record_count: projected.accessAuditRecords.length,
    resource_classification_decision_count: projected.resourceClassificationDecisions.length,
    store_policy_rule_count: projected.storePolicyRules.length,
    rls_filter_template_count: projected.rlsFilterTemplates.length,
    query_policy_binding_count: projected.queryPolicyBindings.length,
    store_query_plan_count: plans.length,
    enforcement_probe_count: probes.length,
    rls_enforced_query_plan_count: plans.filter((plan) => plan.rls_enforced).length,
    matter_filter_enforced_count: plans.filter((plan) => plan.required_filter_keys.includes("matter_id")).length,
    classification_filter_enforced_count: plans.filter((plan) => plan.required_filter_keys.includes("classification")).length,
    policy_snapshot_filter_enforced_count: plans.filter((plan) => plan.required_filter_keys.includes("policy_snapshot_id")).length,
    access_audit_filter_enforced_count: plans.filter((plan) => plan.required_filter_keys.includes("access_audit_record_id")).length,
    resource_filter_enforced_count: plans.filter((plan) => plan.target_type === "resource" && plan.required_filter_keys.includes("resource_id")).length,
    executable_query_plan_count: plans.filter((plan) => plan.query_status === "executable").length,
    held_query_plan_count: plans.filter((plan) => plan.query_status === "held_for_human_confirmation").length,
    blocked_query_plan_count: plans.filter((plan) => plan.query_status === "blocked").length,
    unfiltered_probe_blocked_count: countBlockedProbe(probes, "unfiltered_query"),
    cross_matter_probe_blocked_count: countBlockedProbe(probes, "cross_matter_filter"),
    missing_matter_filter_probe_blocked_count: countBlockedProbe(probes, "missing_matter_filter"),
    missing_classification_filter_probe_blocked_count: countBlockedProbe(probes, "missing_classification_filter"),
    missing_policy_snapshot_filter_probe_blocked_count: countBlockedProbe(probes, "missing_policy_snapshot_filter"),
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_collection_id: countBy(plans, "collection_id"),
    by_query_status: countBy(plans, "query_status"),
    by_target_type: countBy(plans, "target_type"),
  };
}

function countBlockedProbe(probes, probeType) {
  return probes.filter((probe) => probe.probe_type === probeType && probe.observed_outcome === "blocked").length;
}

function summarizeAccessAuditSource(accessAuditProjection) {
  return {
    schema_version: accessAuditProjection.schema_version ?? null,
    access_audit_projection_id: accessAuditProjection.access_audit_projection_id ?? null,
    access_audit_projection_status: accessAuditProjection.summary?.access_audit_projection_status ?? "unknown",
    access_audit_record_count: accessAuditProjection.summary?.access_audit_record_count ?? 0,
    can_retrieve_count: accessAuditProjection.summary?.can_retrieve_count ?? 0,
    validation_error_count: accessAuditProjection.summary?.validation_error_count ?? accessAuditProjection.validation?.errors?.length ?? 0,
  };
}

function summarizeClassificationSource(dataClassificationRuleEngine) {
  return {
    schema_version: dataClassificationRuleEngine.schema_version ?? null,
    classification_rule_engine_id: dataClassificationRuleEngine.classification_rule_engine_id ?? null,
    classification_rule_engine_status: dataClassificationRuleEngine.summary?.classification_rule_engine_status ?? "unknown",
    resource_classification_decision_count: dataClassificationRuleEngine.summary?.resource_classification_decision_count ?? 0,
    validation_error_count: dataClassificationRuleEngine.summary?.validation_error_count ?? dataClassificationRuleEngine.validation?.errors?.length ?? 0,
  };
}

function renderStorePolicyAdapterMarkdown(result) {
  const lines = [];
  lines.push("# Store Policy Adapter");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.store_policy_adapter_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Store policy rules: ${result.summary.store_policy_rule_count}`);
  lines.push(`- RLS filter templates: ${result.summary.rls_filter_template_count}`);
  lines.push(`- Store query plans: ${result.summary.store_query_plan_count}`);
  lines.push(`- Enforcement probes: ${result.summary.enforcement_probe_count}`);
  lines.push(`- Executable plans: ${result.summary.executable_query_plan_count}`);
  lines.push(`- Held plans: ${result.summary.held_query_plan_count}`);
  lines.push(`- Blocked plans: ${result.summary.blocked_query_plan_count}`);
  lines.push(`- Unfiltered probes blocked: ${result.summary.unfiltered_probe_blocked_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## RLS Rule");
  lines.push("");
  lines.push("The adapter compiles every access-audit row into a query plan requiring tenant, matter, classification, policy snapshot, and access-audit filters. Resource rows also require a resource_id filter. Review and denied rows are not executable.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    access_audit_projection_path: path.resolve(options.accessAuditProjectionPath ?? DEFAULT_STORE_POLICY_ADAPTER_INPUTS.accessAuditProjectionPath),
    data_classification_rule_engine_path: path.resolve(options.dataClassificationRuleEnginePath ?? DEFAULT_STORE_POLICY_ADAPTER_INPUTS.dataClassificationRuleEnginePath),
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
    else if (arg === "--access-audit-projection") args.accessAuditProjectionPath = argv[++index];
    else if (arg === "--data-classification-rules") args.dataClassificationRuleEnginePath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/store-policy-adapter.mjs [options]

Options:
  --access-audit-projection <path>   Access Audit Projection artifact.
  --data-classification-rules <path> Data Classification Rule Engine artifact.
  --out-dir <path>                   Output directory.
  --run-at <iso>                     Deterministic timestamp.
  --check                            Exit non-zero when validation fails.
  --no-write                         Build without writing artifacts.
`);
}

function serializableAdapter(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function pushUniqueIdChecks(validationItems, items, subjectType, key) {
  const owners = new Map();
  for (const item of items) {
    const id = item[key];
    if (owners.has(id)) {
      pushCheck(validationItems, subjectType, id, "id_unique", false, `${subjectType} id ${id} is already present.`);
    } else {
      owners.set(id, true);
      pushCheck(validationItems, subjectType, id, "id_unique", true, `${subjectType} id ${id} is unique in the adapter.`);
    }
  }
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `store-policy-validation.${subjectType}.${slugify(subjectId)}.${slugify(checkId)}`,
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
