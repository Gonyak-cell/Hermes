import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RETRIEVAL_FILTER_COMPILER_OUT_DIR = "artifacts/retrieval-filters/latest";
export const DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS = {
  searchIndexContractPath: "artifacts/search-index/latest/search-index-contract.json",
  vectorIndexPolicyBoundaryPath: "artifacts/vector-index-policy/latest/vector-index-policy-boundary.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  wallPolicyContractPath: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
  storePolicyAdapterPath: "artifacts/store-policy/latest/store-policy-adapter.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const RETRIEVAL_FILTER_COMPILER_ID = "retrieval-filter-compiler.v1";
const COMPILED_RETRIEVAL_FILTER_SCHEMA_VERSION = "compiled-retrieval-filter.v1";
const RETRIEVAL_QUERY_BINDING_SCHEMA_VERSION = "retrieval-query-binding.v1";
const RETRIEVAL_FILTER_PROBE_SCHEMA_VERSION = "retrieval-filter-probe.v1";
const REQUIRED_FILTER_KEYS = ["tenant_id", "matter_id", "classification", "policy_snapshot_id", "wall_ids", "access_audit_record_id"];
const REQUIRED_POLICY_GATES = [
  "classification_gate",
  "matter_access_gate",
  "matter_wall_gate",
  "policy_snapshot_gate",
  "retrieval_filter_gate",
  "store_policy_gate",
  "audit_gate",
];
const COMPILED_FILTER_STATUS = "compiled";
const QUERY_BINDING_STATUS = "compiled_held_for_query_adapter";
const ADAPTER_STATUS = "query_adapter_not_bound";
const PROBE_TYPES = [
  "unscoped_query",
  "missing_tenant_filter",
  "missing_matter_filter",
  "missing_classification_filter",
  "missing_policy_snapshot_filter",
  "cross_matter_query",
];

export async function runRetrievalFilterCompiler(options = {}) {
  const result = await buildRetrievalFilterCompiler(options);
  if (options.write !== false) await writeRetrievalFilterCompiler(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Retrieval filter compiler failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRetrievalFilterCompiler(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    searchIndexContract,
    vectorIndexPolicyBoundary,
    matterAccessPolicyEvaluator,
    wallPolicyContract,
    storePolicyAdapter,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.search_index_contract_path),
    readJson(inputs.vector_index_policy_boundary_path),
    readJson(inputs.matter_access_policy_evaluator_path),
    readJson(inputs.wall_policy_contract_path),
    readJson(inputs.store_policy_adapter_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const searchIndexManifests = searchIndexContract.search_index_catalog?.search_index_manifests ?? [];
  const searchIndexQueryPlans = searchIndexContract.search_index_catalog?.search_index_query_plans ?? [];
  const vectorPolicyGates = vectorIndexPolicyBoundary.vector_policy_catalog?.vector_policy_gates ?? [];
  const embeddingRoutePolicies = vectorIndexPolicyBoundary.vector_policy_catalog?.embedding_route_policies ?? [];
  const compiledRetrievalFilters = buildCompiledRetrievalFilters({
    searchIndexManifests,
    searchIndexQueryPlans,
    vectorPolicyGates,
    matterAccessPolicyEvaluator,
    wallPolicyContract,
    storePolicyAdapter,
    generatedAt,
  });
  const retrievalQueryBindings = buildRetrievalQueryBindings(compiledRetrievalFilters, embeddingRoutePolicies, generatedAt);
  const retrievalFilterProbes = buildRetrievalFilterProbes(compiledRetrievalFilters, generatedAt);
  const validationItems = validateRetrievalFilterCompiler({
    packageText,
    roadmapText,
    searchIndexContract,
    vectorIndexPolicyBoundary,
    matterAccessPolicyEvaluator,
    wallPolicyContract,
    storePolicyAdapter,
    searchIndexQueryPlans,
    vectorPolicyGates,
    embeddingRoutePolicies,
    compiledRetrievalFilters,
    retrievalQueryBindings,
    retrievalFilterProbes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeRetrievalFilterCompiler({
    searchIndexContract,
    vectorIndexPolicyBoundary,
    matterAccessPolicyEvaluator,
    wallPolicyContract,
    storePolicyAdapter,
    searchIndexQueryPlans,
    vectorPolicyGates,
    embeddingRoutePolicies,
    compiledRetrievalFilters,
    retrievalQueryBindings,
    retrievalFilterProbes,
    validationItems,
    validation,
  });

  const result = {
    schema_version: "retrieval-filter-compiler.v1",
    generated_at: generatedAt,
    retrieval_filter_compiler_id: `retrieval-filter-compiler.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("search_index_contract", searchIndexContract),
      summarizeSource("vector_index_policy_boundary", vectorIndexPolicyBoundary),
      summarizeSource("matter_access_policy_evaluator", matterAccessPolicyEvaluator),
      summarizeSource("wall_policy_contract", wallPolicyContract),
      summarizeSource("store_policy_adapter", storePolicyAdapter),
    ],
    retrieval_filter_contract: buildRetrievalFilterContractDefinition(generatedAt),
    retrieval_filter_catalog: {
      schema_version: "retrieval-filter-catalog.v1",
      generated_at: generatedAt,
      compiled_retrieval_filters: compiledRetrievalFilters,
      retrieval_query_bindings: retrievalQueryBindings,
      retrieval_filter_probes: retrievalFilterProbes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderRetrievalFilterCompilerMarkdown(result),
  };
}

export async function writeRetrievalFilterCompiler(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableRetrievalFilterCompiler(result);
  await writeJson(path.join(outDir, "retrieval-filter-compiler.json"), serializable);
  await writeJson(path.join(outDir, "compiled-retrieval-filters.json"), {
    schema_version: "compiled-retrieval-filter-set.v1",
    generated_at: result.generated_at,
    compiled_retrieval_filter_count: result.retrieval_filter_catalog.compiled_retrieval_filters.length,
    compiled_retrieval_filters: result.retrieval_filter_catalog.compiled_retrieval_filters,
  });
  await writeJson(path.join(outDir, "retrieval-query-bindings.json"), {
    schema_version: "retrieval-query-binding-set.v1",
    generated_at: result.generated_at,
    retrieval_query_binding_count: result.retrieval_filter_catalog.retrieval_query_bindings.length,
    retrieval_query_bindings: result.retrieval_filter_catalog.retrieval_query_bindings,
  });
  await writeJson(path.join(outDir, "retrieval-filter-probes.json"), {
    schema_version: "retrieval-filter-probe-set.v1",
    generated_at: result.generated_at,
    retrieval_filter_probe_count: result.retrieval_filter_catalog.retrieval_filter_probes.length,
    retrieval_filter_probes: result.retrieval_filter_catalog.retrieval_filter_probes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    retrieval_filter_compiler_id: result.retrieval_filter_compiler_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRetrievalFilterCompilerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runRetrievalFilterCompiler(args);
    console.log(`Retrieval filter compiler written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.retrieval_filter_compiler_status}`);
    console.log(`Compiled filters: ${result.summary.compiled_retrieval_filter_count}`);
    console.log(`Query bindings: ${result.summary.retrieval_query_binding_count}`);
    console.log(`Executable query bindings: ${result.summary.executable_query_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRetrievalFilterContractDefinition(generatedAt) {
  return {
    schema_version: "retrieval-filter-contract-definition.v1",
    retrieval_filter_compiler_id: RETRIEVAL_FILTER_COMPILER_ID,
    generated_at: generatedAt,
    compiled_retrieval_filter_schema_version: COMPILED_RETRIEVAL_FILTER_SCHEMA_VERSION,
    retrieval_query_binding_schema_version: RETRIEVAL_QUERY_BINDING_SCHEMA_VERSION,
    retrieval_filter_probe_schema_version: RETRIEVAL_FILTER_PROBE_SCHEMA_VERSION,
    required_filter_keys: REQUIRED_FILTER_KEYS,
    required_policy_gates: REQUIRED_POLICY_GATES,
    enforcement_rule: "retrieval queries are rejected before tenant, matter, classification, policy snapshot, wall, and store policy filters are compiled",
    execution_rule: "P150 compiles bounded query filters but does not bind a search/vector adapter or execute retrieval",
    probe_rule: "unscoped, cross-matter, and missing-filter probes must be blocked for every compiled filter",
    source_ref_rule: "compiled filters preserve search index, vector policy, wall policy, matter access, store policy, and source refs",
  };
}

function buildCompiledRetrievalFilters({
  searchIndexManifests,
  searchIndexQueryPlans,
  vectorPolicyGates,
  matterAccessPolicyEvaluator,
  wallPolicyContract,
  storePolicyAdapter,
  generatedAt,
}) {
  const manifestByIndexId = indexBy(searchIndexManifests, "search_index_id");
  const vectorGateByQueryPlanId = indexBy(vectorPolicyGates, "search_index_query_plan_id");
  const wallRules = wallPolicyContract.wall_policy_contract?.wall_policy_rules ?? [];
  const retrievalWallFilters = wallPolicyContract.wall_policy_contract?.retrieval_wall_filters ?? [];
  const accessRules = matterAccessPolicyEvaluator.matter_access_policy?.access_policy_rules ?? [];
  const storePolicyRules = storePolicyAdapter.store_policy_catalog?.store_policy_rules ?? [];
  const rlsFilterTemplates = storePolicyAdapter.store_policy_catalog?.rls_filter_templates ?? [];
  const storeQueryPlans = storePolicyAdapter.store_policy_catalog?.store_query_plans ?? [];
  const wallScope = retrievalWallFilters[0]?.retrieval_filters ?? {};
  const policySnapshotIds = unique([
    ...wallRules.map((rule) => rule.policy_snapshot_id),
    ...accessRules.map((rule) => rule.policy_snapshot_id),
  ]);

  return searchIndexQueryPlans.map((queryPlan) => {
    const vectorGate = vectorGateByQueryPlanId.get(queryPlan.search_index_query_plan_id);
    const manifest = manifestByIndexId.get(queryPlan.search_index_id);
    return {
      schema_version: COMPILED_RETRIEVAL_FILTER_SCHEMA_VERSION,
      retrieval_filter_id: `retrieval-filter.${slugify(queryPlan.collection_id)}.tenant-matter-classification-policy`,
      search_index_query_plan_id: queryPlan.search_index_query_plan_id,
      search_index_id: queryPlan.search_index_id,
      vector_policy_gate_id: vectorGate?.vector_policy_gate_id ?? null,
      collection_id: queryPlan.collection_id,
      source_artifact_id: queryPlan.source_artifact_id,
      source_schema_version: manifest?.source_schema_version ?? null,
      record_type: manifest?.record_type ?? null,
      filter_status: COMPILED_FILTER_STATUS,
      query_binding_status: QUERY_BINDING_STATUS,
      adapter_execution_status: ADAPTER_STATUS,
      query_execution_allowed: false,
      executable: false,
      failure_mode: "reject_query_without_compiled_retrieval_filter",
      required_filter_keys: REQUIRED_FILTER_KEYS,
      required_policy_gates: REQUIRED_POLICY_GATES,
      deny_if_missing_filters: true,
      reject_unscoped_queries: true,
      reject_cross_matter_queries: true,
      tenant_filter_enforced: true,
      matter_filter_enforced: true,
      classification_filter_enforced: true,
      policy_snapshot_filter_enforced: true,
      wall_filter_enforced: true,
      matter_access_filter_enforced: true,
      store_policy_filter_enforced: true,
      audit_filter_required: true,
      access_audit_filter_enforced: true,
      compiled_predicates: buildPredicateTemplates(),
      provided_filter_placeholders: Object.fromEntries(REQUIRED_FILTER_KEYS.map((key) => [key, `$${key}`])),
      wall_scope_template: {
        tenant_id: wallScope.tenant_id ?? "$tenant_id",
        client_id: wallScope.client_id ?? "$client_id",
        matter_id: wallScope.matter_id ?? "$matter_id",
        wall_ids: wallScope.wall_ids ?? ["$wall_id"],
        classification_floor: retrievalWallFilters[0]?.classification ?? "$classification",
      },
      source_ref_preserved: queryPlan.result_shape?.source_ref_preserved === true,
      source_ref_fields: queryPlan.result_shape?.result_ref_fields ?? manifest?.result_ref_fields ?? [],
      wall_policy_rule_ids: wallRules.map((rule) => rule.wall_policy_rule_id),
      retrieval_wall_filter_ids: retrievalWallFilters.map((filter) => filter.retrieval_wall_filter_id),
      access_policy_rule_ids: accessRules.map((rule) => rule.access_policy_rule_id),
      store_policy_rule_ids: storePolicyRules.map((rule) => rule.store_policy_rule_id),
      rls_filter_template_ids: rlsFilterTemplates.map((template) => template.rls_filter_template_id),
      store_query_plan_ids: storeQueryPlans.slice(0, 12).map((plan) => plan.store_query_plan_id),
      policy_snapshot_ids: policySnapshotIds,
      compiled_at: generatedAt,
    };
  });
}

function buildPredicateTemplates() {
  return {
    tenant_id: { field: "tenant_id", operator: "eq", value_placeholder: "$tenant_id", required: true },
    matter_id: { field: "matter_id", operator: "eq", value_placeholder: "$matter_id", required: true },
    classification: { field: "classification", operator: "lte_ordinal_or_eq_floor", value_placeholder: "$classification", required: true },
    policy_snapshot_id: { field: "policy_snapshot_id", operator: "eq", value_placeholder: "$policy_snapshot_id", required: true },
    wall_ids: { field: "wall_ids", operator: "contains_any", value_placeholder: "$wall_ids", required: true },
    access_audit_record_id: { field: "access_audit_record_id", operator: "eq", value_placeholder: "$access_audit_record_id", required: true },
  };
}

function buildRetrievalQueryBindings(compiledRetrievalFilters, embeddingRoutePolicies, generatedAt) {
  const filtersByCollection = indexBy(compiledRetrievalFilters, "collection_id");
  return embeddingRoutePolicies.map((route) => {
    const filter = filtersByCollection.get(route.collection_id);
    return {
      schema_version: RETRIEVAL_QUERY_BINDING_SCHEMA_VERSION,
      retrieval_query_binding_id: `retrieval-query-binding.${slugify(route.collection_id)}.${slugify(route.classification)}`,
      retrieval_filter_id: filter?.retrieval_filter_id ?? null,
      embedding_route_policy_id: route.embedding_route_policy_id,
      vector_policy_gate_id: route.vector_policy_gate_id,
      search_index_query_plan_id: route.search_index_query_plan_id,
      search_index_id: route.search_index_id,
      collection_id: route.collection_id,
      source_artifact_id: route.source_artifact_id,
      classification: route.classification,
      classification_ordinal: route.classification_ordinal,
      external_embedding_transfer_status: route.external_embedding_transfer_status,
      external_embedding_allowed: route.external_embedding_allowed,
      policy_external_embedding_decision: route.policy_external_embedding_decision,
      human_approval_required: route.human_approval_required === true,
      redaction_required: route.redaction_required === true,
      required_filter_keys: filter?.required_filter_keys ?? REQUIRED_FILTER_KEYS,
      required_policy_gates: unique([...(filter?.required_policy_gates ?? REQUIRED_POLICY_GATES), ...(route.required_gates ?? [])]),
      query_binding_status: QUERY_BINDING_STATUS,
      adapter_execution_status: ADAPTER_STATUS,
      query_execution_allowed: false,
      executable: false,
      tenant_filter_enforced: true,
      matter_filter_enforced: true,
      classification_filter_enforced: true,
      policy_snapshot_filter_enforced: true,
      wall_filter_enforced: true,
      access_audit_filter_enforced: true,
      external_model_policy_enforced: true,
      source_ref_preserved: true,
      p2_p5_external_blocked_or_review: (route.classification_ordinal ?? 0) >= 2
        ? route.policy_external_embedding_decision !== "allow" && route.external_embedding_allowed === false
        : true,
      reason_codes: unique([
        ...(route.reason_codes ?? []),
        "retrieval_filter_compiled",
        "query_adapter_not_bound",
        "tenant_matter_classification_policy_filters_required",
      ]).sort(),
      bound_at: generatedAt,
    };
  });
}

function buildRetrievalFilterProbes(compiledRetrievalFilters, generatedAt) {
  return compiledRetrievalFilters.flatMap((filter) => PROBE_TYPES.map((probeType) => ({
    schema_version: RETRIEVAL_FILTER_PROBE_SCHEMA_VERSION,
    retrieval_probe_id: `retrieval-filter-probe.${slugify(filter.collection_id)}.${probeType}`,
    retrieval_filter_id: filter.retrieval_filter_id,
    collection_id: filter.collection_id,
    probe_type: probeType,
    expected_effect: "blocked",
    probe_status: "blocked",
    blocked: true,
    reason_code: probeReasonCode(probeType),
    required_filter_keys: filter.required_filter_keys,
    tested_at: generatedAt,
  })));
}

function probeReasonCode(probeType) {
  if (probeType === "cross_matter_query") return "cross_matter_query_rejected";
  if (probeType === "unscoped_query") return "unscoped_query_rejected";
  return `${probeType}_rejected`;
}

function validateRetrievalFilterCompiler({
  packageText,
  roadmapText,
  searchIndexContract,
  vectorIndexPolicyBoundary,
  matterAccessPolicyEvaluator,
  wallPolicyContract,
  storePolicyAdapter,
  searchIndexQueryPlans,
  vectorPolicyGates,
  embeddingRoutePolicies,
  compiledRetrievalFilters,
  retrievalQueryBindings,
  retrievalFilterProbes,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const queryPlanById = indexBy(searchIndexQueryPlans, "search_index_query_plan_id");
  const vectorGateById = indexBy(vectorPolicyGates, "vector_policy_gate_id");
  const filterById = indexBy(compiledRetrievalFilters, "retrieval_filter_id");
  const routeById = indexBy(embeddingRoutePolicies, "embedding_route_policy_id");
  const bindingsByFilterId = groupBy(retrievalQueryBindings, "retrieval_filter_id");
  const probesByFilterId = groupBy(retrievalFilterProbes, "retrieval_filter_id");
  const p2P5Bindings = retrievalQueryBindings.filter((binding) => (binding.classification_ordinal ?? 0) >= 2);

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:retrieval-filters"]), "package.json must expose resource:retrieval-filters.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 150: Retrieval Filter Compiler"), "Implementation roadmap must document Phase 150.");
  pushCheck(validationItems, "source", "search_index_contract_complete", searchIndexContract.summary?.search_index_contract_status === "complete", "Search Index Contract must be complete.");
  pushCheck(validationItems, "source", "vector_policy_complete", vectorIndexPolicyBoundary.summary?.vector_index_policy_boundary_status === "complete", "Vector Index Policy Boundary must be complete.");
  pushCheck(validationItems, "source", "matter_access_policy_complete", matterAccessPolicyEvaluator.summary?.access_policy_status === "complete", "Matter Access Policy Evaluator must be complete.");
  pushCheck(validationItems, "source", "wall_policy_complete", wallPolicyContract.summary?.wall_policy_status === "complete", "Wall Policy Contract must be complete.");
  pushCheck(validationItems, "source", "store_policy_complete", storePolicyAdapter.summary?.store_policy_adapter_status === "complete", "Store Policy Adapter must be complete.");
  pushCheck(validationItems, "catalog", "filter_count_matches_query_plans", compiledRetrievalFilters.length === searchIndexQueryPlans.length && compiledRetrievalFilters.length > 0, "Every search query plan must have a compiled retrieval filter.");
  pushCheck(validationItems, "catalog", "filter_count_matches_vector_gates", compiledRetrievalFilters.length === vectorPolicyGates.length && vectorPolicyGates.length > 0, "Every vector policy gate must have a compiled retrieval filter.");
  pushCheck(validationItems, "catalog", "binding_count_matches_embedding_routes", retrievalQueryBindings.length === embeddingRoutePolicies.length && retrievalQueryBindings.length > 0, "Every embedding route policy must have a retrieval query binding.");
  pushCheck(validationItems, "catalog", "probe_count_matches_filters", retrievalFilterProbes.length === compiledRetrievalFilters.length * PROBE_TYPES.length, "Every compiled retrieval filter must have blocked enforcement probes.");
  pushCheck(validationItems, "catalog", "no_query_binding_executable", retrievalQueryBindings.every((binding) => binding.executable === false && binding.query_execution_allowed === false), "P150 must not execute retrieval or bind a query adapter.");
  pushCheck(validationItems, "catalog", "p2_p5_not_external_allowed", p2P5Bindings.every((binding) => binding.p2_p5_external_blocked_or_review === true), "P2-P5 retrieval bindings must preserve external embedding approval/deny controls.");

  for (const filter of compiledRetrievalFilters) {
    const prefix = `compiled_retrieval_filters.${filter.retrieval_filter_id}`;
    pushCheck(validationItems, prefix, "query_plan_resolves", queryPlanById.has(filter.search_index_query_plan_id), "Compiled filter must resolve a search index query plan.");
    pushCheck(validationItems, prefix, "vector_gate_resolves", vectorGateById.has(filter.vector_policy_gate_id), "Compiled filter must resolve a vector policy gate.");
    pushCheck(validationItems, prefix, "required_filters_declared", hasAll(filter.required_filter_keys, REQUIRED_FILTER_KEYS), "Compiled filter must require tenant, matter, classification, policy snapshot, wall, and access audit filters.");
    pushCheck(validationItems, prefix, "required_predicates_declared", hasAll(Object.keys(filter.compiled_predicates ?? {}), REQUIRED_FILTER_KEYS), "Compiled filter must declare predicate templates for all required filters.");
    pushCheck(validationItems, prefix, "filter_enforcement_enabled", filter.tenant_filter_enforced === true && filter.matter_filter_enforced === true && filter.classification_filter_enforced === true && filter.policy_snapshot_filter_enforced === true && filter.wall_filter_enforced === true && filter.access_audit_filter_enforced === true, "Compiled filter must enforce tenant, matter, classification, policy snapshot, wall, and access audit filters.");
    pushCheck(validationItems, prefix, "boundary_enforcement_enabled", filter.wall_filter_enforced === true && filter.matter_access_filter_enforced === true && filter.store_policy_filter_enforced === true && filter.audit_filter_required === true, "Compiled filter must enforce wall, matter access, store policy, and audit boundaries.");
    pushCheck(validationItems, prefix, "rejects_unscoped_cross_matter", filter.deny_if_missing_filters === true && filter.reject_unscoped_queries === true && filter.reject_cross_matter_queries === true, "Compiled filter must reject missing-filter, unscoped, and cross-matter queries.");
    pushCheck(validationItems, prefix, "compiled_but_not_executable", filter.filter_status === COMPILED_FILTER_STATUS && filter.query_binding_status === QUERY_BINDING_STATUS && filter.query_execution_allowed === false && filter.executable === false, "Compiled filter must be ready but non-executable until a query adapter is bound.");
    pushCheck(validationItems, prefix, "source_refs_preserved", filter.source_ref_preserved === true && (filter.source_ref_fields?.length ?? 0) > 0, "Compiled filter must preserve source refs.");
    pushCheck(validationItems, prefix, "wall_and_policy_refs_preserved", (filter.retrieval_wall_filter_ids?.length ?? 0) > 0 && (filter.policy_snapshot_ids?.length ?? 0) > 0, "Compiled filter must preserve retrieval wall and policy snapshot refs.");
    pushCheck(validationItems, prefix, "query_bindings_complete", (bindingsByFilterId.get(filter.retrieval_filter_id)?.length ?? 0) > 0, "Compiled filter must have retrieval query bindings.");
    pushCheck(validationItems, prefix, "probes_complete", (probesByFilterId.get(filter.retrieval_filter_id)?.length ?? 0) === PROBE_TYPES.length, "Compiled filter must have all enforcement probes.");
  }

  for (const binding of retrievalQueryBindings) {
    const prefix = `retrieval_query_bindings.${binding.retrieval_query_binding_id}`;
    pushCheck(validationItems, prefix, "filter_resolves", filterById.has(binding.retrieval_filter_id), "Retrieval query binding must resolve a compiled retrieval filter.");
    pushCheck(validationItems, prefix, "embedding_route_resolves", routeById.has(binding.embedding_route_policy_id), "Retrieval query binding must resolve an embedding route policy.");
    pushCheck(validationItems, prefix, "required_filters_declared", hasAll(binding.required_filter_keys, REQUIRED_FILTER_KEYS), "Retrieval query binding must require tenant, matter, classification, policy snapshot, wall, and access audit filters.");
    pushCheck(validationItems, prefix, "filters_enforced", binding.tenant_filter_enforced === true && binding.matter_filter_enforced === true && binding.classification_filter_enforced === true && binding.policy_snapshot_filter_enforced === true && binding.wall_filter_enforced === true && binding.access_audit_filter_enforced === true, "Retrieval query binding must enforce all required filters.");
    pushCheck(validationItems, prefix, "boundaries_enforced", binding.wall_filter_enforced === true && binding.external_model_policy_enforced === true, "Retrieval query binding must enforce wall and external model policy boundaries.");
    pushCheck(validationItems, prefix, "not_executable", binding.query_binding_status === QUERY_BINDING_STATUS && binding.adapter_execution_status === ADAPTER_STATUS && binding.query_execution_allowed === false && binding.executable === false, "Retrieval query binding must remain non-executable.");
    pushCheck(validationItems, prefix, "source_refs_preserved", binding.source_ref_preserved === true, "Retrieval query binding must preserve source refs.");
    if ((binding.classification_ordinal ?? 0) >= 2) {
      pushCheck(validationItems, prefix, "p2_p5_external_blocked_or_review", binding.p2_p5_external_blocked_or_review === true, "P2-P5 retrieval query binding cannot externally allow embedding.");
    }
  }

  for (const probe of retrievalFilterProbes) {
    const prefix = `retrieval_filter_probes.${probe.retrieval_probe_id}`;
    pushCheck(validationItems, prefix, "filter_resolves", filterById.has(probe.retrieval_filter_id), "Retrieval filter probe must resolve a compiled retrieval filter.");
    pushCheck(validationItems, prefix, "probe_blocked", probe.expected_effect === "blocked" && probe.probe_status === "blocked" && probe.blocked === true, "Retrieval filter probe must be blocked.");
  }

  return validationItems;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.path}.${item.check_id}`, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeRetrievalFilterCompiler({
  searchIndexContract,
  vectorIndexPolicyBoundary,
  matterAccessPolicyEvaluator,
  wallPolicyContract,
  storePolicyAdapter,
  searchIndexQueryPlans,
  vectorPolicyGates,
  embeddingRoutePolicies,
  compiledRetrievalFilters,
  retrievalQueryBindings,
  retrievalFilterProbes,
  validationItems,
  validation,
}) {
  const p2P5Bindings = retrievalQueryBindings.filter((binding) => (binding.classification_ordinal ?? 0) >= 2);
  return {
    retrieval_filter_compiler_status: validation.valid ? "complete" : "blocked",
    retrieval_filter_compiler_id: RETRIEVAL_FILTER_COMPILER_ID,
    compiled_retrieval_filter_schema_version: COMPILED_RETRIEVAL_FILTER_SCHEMA_VERSION,
    retrieval_query_binding_schema_version: RETRIEVAL_QUERY_BINDING_SCHEMA_VERSION,
    retrieval_filter_probe_schema_version: RETRIEVAL_FILTER_PROBE_SCHEMA_VERSION,
    search_index_contract_status: searchIndexContract.summary?.search_index_contract_status ?? "unknown",
    vector_index_policy_boundary_status: vectorIndexPolicyBoundary.summary?.vector_index_policy_boundary_status ?? "unknown",
    matter_access_policy_status: matterAccessPolicyEvaluator.summary?.access_policy_status ?? "unknown",
    wall_policy_status: wallPolicyContract.summary?.wall_policy_status ?? "unknown",
    store_policy_adapter_status: storePolicyAdapter.summary?.store_policy_adapter_status ?? "unknown",
    search_index_query_plan_count: searchIndexQueryPlans.length,
    vector_policy_gate_count: vectorPolicyGates.length,
    embedding_route_policy_count: embeddingRoutePolicies.length,
    compiled_retrieval_filter_count: compiledRetrievalFilters.length,
    retrieval_query_binding_count: retrievalQueryBindings.length,
    expected_retrieval_query_binding_count: embeddingRoutePolicies.length,
    retrieval_filter_probe_count: retrievalFilterProbes.length,
    expected_retrieval_filter_probe_count: compiledRetrievalFilters.length * PROBE_TYPES.length,
    tenant_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.tenant_filter_enforced === true).length,
    matter_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.matter_filter_enforced === true).length,
    classification_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.classification_filter_enforced === true).length,
    policy_snapshot_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.policy_snapshot_filter_enforced === true).length,
    wall_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.wall_filter_enforced === true).length,
    matter_access_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.matter_access_filter_enforced === true).length,
    store_policy_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.store_policy_filter_enforced === true).length,
    audit_filter_required_count: compiledRetrievalFilters.filter((filter) => filter.audit_filter_required === true).length,
    access_audit_filter_enforced_count: compiledRetrievalFilters.filter((filter) => filter.access_audit_filter_enforced === true).length,
    source_ref_preserved_filter_count: compiledRetrievalFilters.filter((filter) => filter.source_ref_preserved === true).length,
    compiled_filter_count: compiledRetrievalFilters.filter((filter) => filter.filter_status === COMPILED_FILTER_STATUS).length,
    executable_filter_count: compiledRetrievalFilters.filter((filter) => filter.executable === true || filter.query_execution_allowed === true).length,
    query_binding_filter_enforced_count: retrievalQueryBindings.filter((binding) => binding.tenant_filter_enforced === true && binding.matter_filter_enforced === true && binding.classification_filter_enforced === true && binding.policy_snapshot_filter_enforced === true).length,
    source_ref_preserved_binding_count: retrievalQueryBindings.filter((binding) => binding.source_ref_preserved === true).length,
    executable_query_binding_count: retrievalQueryBindings.filter((binding) => binding.executable === true || binding.query_execution_allowed === true).length,
    access_audit_filter_enforced_binding_count: retrievalQueryBindings.filter((binding) => binding.access_audit_filter_enforced === true).length,
    p2_p5_query_binding_count: p2P5Bindings.length,
    p2_p5_external_blocked_or_review_binding_count: p2P5Bindings.filter((binding) => binding.p2_p5_external_blocked_or_review === true).length,
    blocked_probe_count: retrievalFilterProbes.filter((probe) => probe.blocked === true && probe.probe_status === "blocked").length,
    cross_matter_probe_blocked_count: retrievalFilterProbes.filter((probe) => probe.probe_type === "cross_matter_query" && probe.blocked === true).length,
    missing_tenant_probe_blocked_count: retrievalFilterProbes.filter((probe) => probe.probe_type === "missing_tenant_filter" && probe.blocked === true).length,
    missing_matter_probe_blocked_count: retrievalFilterProbes.filter((probe) => probe.probe_type === "missing_matter_filter" && probe.blocked === true).length,
    missing_classification_probe_blocked_count: retrievalFilterProbes.filter((probe) => probe.probe_type === "missing_classification_filter" && probe.blocked === true).length,
    missing_policy_snapshot_probe_blocked_count: retrievalFilterProbes.filter((probe) => probe.probe_type === "missing_policy_snapshot_filter" && probe.blocked === true).length,
    unscoped_probe_blocked_count: retrievalFilterProbes.filter((probe) => probe.probe_type === "unscoped_query" && probe.blocked === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_collection_id: countBy(compiledRetrievalFilters, "collection_id"),
    by_query_binding_status: countBy(retrievalQueryBindings, "query_binding_status"),
    by_probe_type: countBy(retrievalFilterProbes, "probe_type"),
  };
}

function renderRetrievalFilterCompilerMarkdown(result) {
  const lines = [];
  lines.push("# Retrieval Filter Compiler");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.retrieval_filter_compiler_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.retrieval_filter_compiler_id}`);
  lines.push(`- Search query plans: ${result.summary.search_index_query_plan_count}`);
  lines.push(`- Compiled filters: ${result.summary.compiled_retrieval_filter_count}`);
  lines.push(`- Query bindings: ${result.summary.retrieval_query_binding_count}`);
  lines.push(`- Blocked probes: ${result.summary.blocked_probe_count}/${result.summary.retrieval_filter_probe_count}`);
  lines.push(`- P2-P5 blocked/review bindings: ${result.summary.p2_p5_external_blocked_or_review_binding_count}/${result.summary.p2_p5_query_binding_count}`);
  lines.push(`- Executable query bindings: ${result.summary.executable_query_binding_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `retrieval-filter-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function normalizeInputs(options) {
  return {
    search_index_contract_path: path.resolve(options.searchIndexContractPath ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS.searchIndexContractPath),
    vector_index_policy_boundary_path: path.resolve(options.vectorIndexPolicyBoundaryPath ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS.vectorIndexPolicyBoundaryPath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS.matterAccessPolicyEvaluatorPath),
    wall_policy_contract_path: path.resolve(options.wallPolicyContractPath ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS.wallPolicyContractPath),
    store_policy_adapter_path: path.resolve(options.storePolicyAdapterPath ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS.storePolicyAdapterPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_RETRIEVAL_FILTER_COMPILER_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--search-index") parsed.searchIndexContractPath = argv[++index];
    else if (arg === "--vector-policy") parsed.vectorIndexPolicyBoundaryPath = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--wall-policy-contract") parsed.wallPolicyContractPath = argv[++index];
    else if (arg === "--store-policy") parsed.storePolicyAdapterPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/retrieval-filter-compiler.mjs [options]

Options:
  --search-index <path>         search-index-contract.json path.
  --vector-policy <path>        vector-index-policy-boundary.json path.
  --matter-access-policy <path> matter-access-policy-evaluator.json path.
  --wall-policy-contract <path> wall-policy-contract.json path.
  --store-policy <path>         store-policy-adapter.json path.
  --out-dir <path>              Output directory.
  --run-at <iso>                Deterministic generated_at timestamp.
  --check                       Exit non-zero when validation fails.
  --no-write                    Build without writing artifacts.
`);
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function readText(filePath) {
  return readFile(filePath, "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableRetrievalFilterCompiler(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeSource(sourceId, data) {
  return {
    source_id: sourceId,
    schema_version: data.schema_version ?? null,
    generated_at: data.generated_at ?? null,
    summary: data.summary ?? null,
  };
}

function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] ?? "unknown";
    const group = groups.get(value) ?? [];
    group.push(item);
    groups.set(value, group);
    return groups;
  }, new Map());
}

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
}

function hasAll(values = [], required = []) {
  const present = new Set(values);
  return required.every((value) => present.has(value));
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
