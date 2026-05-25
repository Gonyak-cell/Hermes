import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_OUT_DIR = "artifacts/vector-index-policy/latest";
export const DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS = {
  searchIndexContractPath: "artifacts/search-index/latest/search-index-contract.json",
  matterAccessPolicyEvaluatorPath: "artifacts/matter-access-policy/latest/matter-access-policy-evaluator.json",
  wallPolicyContractPath: "artifacts/wall-policy-contract/latest/wall-policy-contract.json",
  dataClassificationRuleEnginePath: "artifacts/data-classification-rules/latest/data-classification-rule-engine.json",
  modelPolicyEnforcementPath: "artifacts/model-policy-enforcement/latest/model-policy-enforcement.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const VECTOR_POLICY_BOUNDARY_ID = "vector-index-policy-boundary.v1";
const VECTOR_POLICY_GATE_SCHEMA_VERSION = "vector-policy-gate.v1";
const EMBEDDING_ROUTE_POLICY_SCHEMA_VERSION = "embedding-route-policy.v1";
const VECTOR_POLICY_GATE_STATUS = "held_for_vector_policy";
const RETRIEVAL_QUERY_STATUS = "held_for_retrieval_filter_compiler";
const REQUIRED_QUERY_FILTERS = ["tenant_id", "matter_id", "classification", "policy_snapshot_id"];
const REQUIRED_VECTOR_GATES = [
  "classification_gate",
  "matter_access_gate",
  "matter_wall_gate",
  "external_model_gate",
  "model_policy_gate",
  "policy_snapshot_gate",
  "vector_policy_gate",
  "retrieval_filter_gate",
  "audit_gate",
];

export async function runVectorIndexPolicyBoundary(options = {}) {
  const result = await buildVectorIndexPolicyBoundary(options);
  if (options.write !== false) await writeVectorIndexPolicyBoundary(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Vector index policy boundary failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildVectorIndexPolicyBoundary(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    searchIndexContract,
    matterAccessPolicyEvaluator,
    wallPolicyContract,
    dataClassificationRuleEngine,
    modelPolicyEnforcement,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.search_index_contract_path),
    readJson(inputs.matter_access_policy_evaluator_path),
    readJson(inputs.wall_policy_contract_path),
    readJson(inputs.data_classification_rule_engine_path),
    readJson(inputs.model_policy_enforcement_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const searchIndexManifests = searchIndexContract.search_index_catalog?.search_index_manifests ?? [];
  const searchIndexQueryPlans = searchIndexContract.search_index_catalog?.search_index_query_plans ?? [];
  const classificationModelGates = modelPolicyEnforcement.model_policy_gate_catalog?.classification_model_gates ?? [];
  const vectorPolicyGates = buildVectorPolicyGates({
    searchIndexManifests,
    searchIndexQueryPlans,
    wallPolicyContract,
    matterAccessPolicyEvaluator,
    classificationModelGates,
    generatedAt,
  });
  const embeddingRoutePolicies = buildEmbeddingRoutePolicies(vectorPolicyGates, classificationModelGates, generatedAt);
  const validationItems = validateVectorIndexPolicyBoundary({
    packageText,
    roadmapText,
    searchIndexContract,
    matterAccessPolicyEvaluator,
    wallPolicyContract,
    dataClassificationRuleEngine,
    modelPolicyEnforcement,
    searchIndexQueryPlans,
    classificationModelGates,
    vectorPolicyGates,
    embeddingRoutePolicies,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeVectorIndexPolicyBoundary({
    searchIndexContract,
    matterAccessPolicyEvaluator,
    wallPolicyContract,
    dataClassificationRuleEngine,
    modelPolicyEnforcement,
    searchIndexQueryPlans,
    classificationModelGates,
    vectorPolicyGates,
    embeddingRoutePolicies,
    validationItems,
    validation,
  });

  const result = {
    schema_version: "vector-index-policy-boundary.v1",
    generated_at: generatedAt,
    vector_index_policy_boundary_id: `vector-index-policy-boundary.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("search_index_contract", searchIndexContract),
      summarizeSource("matter_access_policy_evaluator", matterAccessPolicyEvaluator),
      summarizeSource("wall_policy_contract", wallPolicyContract),
      summarizeSource("data_classification_rule_engine", dataClassificationRuleEngine),
      summarizeSource("model_policy_enforcement", modelPolicyEnforcement),
    ],
    vector_index_policy_contract: buildVectorIndexPolicyContractDefinition(generatedAt),
    vector_policy_catalog: {
      schema_version: "vector-policy-catalog.v1",
      generated_at: generatedAt,
      vector_policy_gates: vectorPolicyGates,
      embedding_route_policies: embeddingRoutePolicies,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderVectorIndexPolicyBoundaryMarkdown(result),
  };
}

export async function writeVectorIndexPolicyBoundary(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableVectorIndexPolicyBoundary(result);
  await writeJson(path.join(outDir, "vector-index-policy-boundary.json"), serializable);
  await writeJson(path.join(outDir, "vector-policy-gates.json"), {
    schema_version: "vector-policy-gate-set.v1",
    generated_at: result.generated_at,
    vector_policy_gate_count: result.vector_policy_catalog.vector_policy_gates.length,
    vector_policy_gates: result.vector_policy_catalog.vector_policy_gates,
  });
  await writeJson(path.join(outDir, "embedding-route-policies.json"), {
    schema_version: "embedding-route-policy-set.v1",
    generated_at: result.generated_at,
    embedding_route_policy_count: result.vector_policy_catalog.embedding_route_policies.length,
    embedding_route_policies: result.vector_policy_catalog.embedding_route_policies,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    vector_index_policy_boundary_id: result.vector_index_policy_boundary_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runVectorIndexPolicyBoundaryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runVectorIndexPolicyBoundary(args);
    console.log(`Vector index policy boundary written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.vector_index_policy_boundary_status}`);
    console.log(`Vector gates: ${result.summary.vector_policy_gate_count}`);
    console.log(`Embedding route policies: ${result.summary.embedding_route_policy_count}`);
    console.log(`Executable vector routes: ${result.summary.executable_vector_route_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildVectorIndexPolicyContractDefinition(generatedAt) {
  return {
    schema_version: "vector-index-policy-contract-definition.v1",
    vector_index_policy_boundary_id: VECTOR_POLICY_BOUNDARY_ID,
    generated_at: generatedAt,
    vector_policy_gate_schema_version: VECTOR_POLICY_GATE_SCHEMA_VERSION,
    embedding_route_policy_schema_version: EMBEDDING_ROUTE_POLICY_SCHEMA_VERSION,
    required_query_filters: REQUIRED_QUERY_FILTERS,
    required_policy_gates: REQUIRED_VECTOR_GATES,
    enforcement_rule: "embedding and vector retrieval are rejected before matter wall, classification, external model, and policy snapshot gates are bound",
    execution_rule: "vector indexes and embedding routes remain non-executable until a later retrieval compiler provides scoped filters and approved model routes",
    source_ref_rule: "vector candidates must preserve search index, source artifact, source record, matter, classification, and policy snapshot refs",
    output_rule: "vector hits are evidence candidates only and do not authorize legal analysis or client-facing output",
  };
}

function buildVectorPolicyGates({
  searchIndexManifests,
  searchIndexQueryPlans,
  wallPolicyContract,
  matterAccessPolicyEvaluator,
  classificationModelGates,
  generatedAt,
}) {
  const manifestByIndexId = indexBy(searchIndexManifests, "search_index_id");
  const wallRules = wallPolicyContract.wall_policy_contract?.wall_policy_rules ?? [];
  const retrievalWallFilters = wallPolicyContract.wall_policy_contract?.retrieval_wall_filters ?? [];
  const accessRules = matterAccessPolicyEvaluator.matter_access_policy?.access_policy_rules ?? [];
  const policySnapshotIds = unique([
    ...wallRules.map((rule) => rule.policy_snapshot_id),
    ...accessRules.map((rule) => rule.policy_snapshot_id),
  ]);
  const classificationModelGateIds = classificationModelGates.map((gate) => gate.classification_model_gate_id);
  const externalPolicyDecisions = unique(classificationModelGates.map((gate) => gate.external_model_decision));

  return searchIndexQueryPlans.map((queryPlan) => {
    const manifest = manifestByIndexId.get(queryPlan.search_index_id);
    return {
      schema_version: VECTOR_POLICY_GATE_SCHEMA_VERSION,
      vector_policy_gate_id: `vector-policy-gate.${slugify(queryPlan.collection_id)}.embedding-retrieval-boundary`,
      search_index_query_plan_id: queryPlan.search_index_query_plan_id,
      search_index_id: queryPlan.search_index_id,
      collection_id: queryPlan.collection_id,
      source_artifact_id: queryPlan.source_artifact_id,
      source_schema_version: manifest?.source_schema_version ?? null,
      record_type: manifest?.record_type ?? null,
      required_filters: REQUIRED_QUERY_FILTERS,
      blocked_without_filters: ["matter_id", "classification", "policy_snapshot_id"],
      required_gates: REQUIRED_VECTOR_GATES,
      gate_status: VECTOR_POLICY_GATE_STATUS,
      vector_materialization_status: "not_materialized",
      embedding_execution_status: VECTOR_POLICY_GATE_STATUS,
      retrieval_execution_status: queryPlan.query_status ?? RETRIEVAL_QUERY_STATUS,
      route_compilation_status: "not_compiled",
      executable: false,
      failure_mode: "reject_embedding_or_vector_lookup_before_policy_boundary",
      tenant_filter_required: true,
      matter_filter_required: true,
      classification_filter_required: true,
      policy_snapshot_filter_required: true,
      pre_retrieval_gate_required: true,
      matter_wall_enforced: true,
      external_model_policy_enforced: true,
      classification_policy_enforced: true,
      policy_snapshot_bound: true,
      redaction_gate_required: true,
      human_approval_gate_required: true,
      audit_required: true,
      source_ref_preserved: queryPlan.result_shape?.source_ref_preserved === true,
      source_ref_fields: queryPlan.result_shape?.result_ref_fields ?? manifest?.result_ref_fields ?? [],
      wall_policy_rule_ids: wallRules.map((rule) => rule.wall_policy_rule_id),
      retrieval_wall_filter_ids: retrievalWallFilters.map((filter) => filter.retrieval_wall_filter_id),
      access_policy_rule_ids: accessRules.map((rule) => rule.access_policy_rule_id),
      classification_model_gate_ids: classificationModelGateIds,
      external_model_decisions: externalPolicyDecisions,
      policy_snapshot_ids: policySnapshotIds,
      created_at: generatedAt,
    };
  });
}

function buildEmbeddingRoutePolicies(vectorPolicyGates, classificationModelGates, generatedAt) {
  return vectorPolicyGates.flatMap((vectorPolicyGate) => classificationModelGates.map((modelGate) => {
    const externalDecision = modelGate.external_model_decision ?? "deny";
    return {
      schema_version: EMBEDDING_ROUTE_POLICY_SCHEMA_VERSION,
      embedding_route_policy_id: `embedding-route-policy.${slugify(vectorPolicyGate.collection_id)}.${slugify(modelGate.classification)}`,
      vector_policy_gate_id: vectorPolicyGate.vector_policy_gate_id,
      search_index_query_plan_id: vectorPolicyGate.search_index_query_plan_id,
      search_index_id: vectorPolicyGate.search_index_id,
      collection_id: vectorPolicyGate.collection_id,
      source_artifact_id: vectorPolicyGate.source_artifact_id,
      classification_model_gate_id: modelGate.classification_model_gate_id,
      classification_rule_id: modelGate.classification_rule_id,
      classification: modelGate.classification,
      classification_ordinal: modelGate.classification_ordinal,
      sensitive_data: modelGate.sensitive_data === true,
      external_model_policy: modelGate.external_model_policy,
      policy_external_embedding_decision: externalDecision,
      external_embedding_transfer_status: externalEmbeddingTransferStatus(modelGate),
      external_embedding_allowed: externalDecision === "allow",
      local_embedding_policy: modelGate.local_model_policy,
      redaction_policy: modelGate.redaction_policy,
      redaction_required: modelGate.requires_redaction === true,
      human_approval_required: modelGate.human_approval_required === true,
      audit_required: modelGate.audit_required === true,
      required_filters: vectorPolicyGate.required_filters,
      required_gates: unique([...vectorPolicyGate.required_gates, ...(modelGate.required_gates ?? [])]),
      matter_wall_enforced: true,
      external_model_policy_enforced: true,
      classification_policy_enforced: true,
      policy_snapshot_bound: true,
      source_ref_preserved: true,
      route_status: VECTOR_POLICY_GATE_STATUS,
      embedding_execution_status: VECTOR_POLICY_GATE_STATUS,
      retrieval_execution_status: vectorPolicyGate.retrieval_execution_status,
      route_executable: false,
      execution_block_reason: "vector_adapter_not_bound",
      reason_codes: routeReasonCodes(modelGate),
      decided_at: generatedAt,
      metadata: {
        source_gate_status: modelGate.gate_status ?? "unknown",
        source_enforcement_mode: modelGate.enforcement_mode ?? "unknown",
      },
    };
  }));
}

function externalEmbeddingTransferStatus(modelGate) {
  if (modelGate.external_model_decision === "allow") return "allowed_with_audit";
  if (modelGate.external_model_decision === "review") return "approval_required";
  return "forbidden";
}

function routeReasonCodes(modelGate) {
  const reasonCodes = new Set(modelGate.reason_codes ?? []);
  reasonCodes.add("vector_route_policy_bound");
  reasonCodes.add("matter_wall_required_before_retrieval");
  reasonCodes.add("policy_snapshot_required_before_retrieval");
  if (modelGate.external_model_decision === "allow") reasonCodes.add("external_embedding_allowed_only_after_audit");
  if (modelGate.external_model_decision === "review") reasonCodes.add("external_embedding_requires_approval");
  if (modelGate.external_model_decision === "deny") reasonCodes.add("external_embedding_forbidden");
  reasonCodes.add("vector_route_not_executable_until_compiler");
  return [...reasonCodes].sort();
}

function validateVectorIndexPolicyBoundary({
  packageText,
  roadmapText,
  searchIndexContract,
  matterAccessPolicyEvaluator,
  wallPolicyContract,
  dataClassificationRuleEngine,
  modelPolicyEnforcement,
  searchIndexQueryPlans,
  classificationModelGates,
  vectorPolicyGates,
  embeddingRoutePolicies,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const queryPlanById = indexBy(searchIndexQueryPlans, "search_index_query_plan_id");
  const gateById = indexBy(vectorPolicyGates, "vector_policy_gate_id");
  const classificationGateById = indexBy(classificationModelGates, "classification_model_gate_id");
  const routeGroups = groupBy(embeddingRoutePolicies, "vector_policy_gate_id");
  const p2P5Routes = embeddingRoutePolicies.filter((route) => (route.classification_ordinal ?? 0) >= 2);

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:vector-policy"]), "package.json must expose resource:vector-policy.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 149: Vector Index Policy Boundary"), "Implementation roadmap must document Phase 149.");
  pushCheck(validationItems, "source", "search_index_contract_complete", searchIndexContract.summary?.search_index_contract_status === "complete", "Search Index Contract must be complete.");
  pushCheck(validationItems, "source", "matter_access_policy_complete", matterAccessPolicyEvaluator.summary?.access_policy_status === "complete", "Matter Access Policy Evaluator must be complete.");
  pushCheck(validationItems, "source", "wall_policy_contract_complete", wallPolicyContract.summary?.wall_policy_status === "complete", "Wall Policy Contract must be complete.");
  pushCheck(validationItems, "source", "data_classification_rule_engine_complete", dataClassificationRuleEngine.summary?.classification_rule_engine_status === "complete", "Data Classification Rule Engine must be complete.");
  pushCheck(validationItems, "source", "model_policy_enforcement_complete", modelPolicyEnforcement.summary?.model_policy_enforcement_status === "complete", "Model Policy Enforcement must be complete.");
  pushCheck(validationItems, "catalog", "vector_gate_count_matches_query_plans", vectorPolicyGates.length === searchIndexQueryPlans.length && vectorPolicyGates.length > 0, "Every search index query plan must have a vector policy gate.");
  pushCheck(validationItems, "catalog", "embedding_route_count_covers_classifications", embeddingRoutePolicies.length === vectorPolicyGates.length * classificationModelGates.length && embeddingRoutePolicies.length > 0, "Every vector gate must have one embedding route policy per classification model gate.");
  pushCheck(validationItems, "catalog", "p2_p5_routes_not_allowed_external", p2P5Routes.every((route) => route.policy_external_embedding_decision !== "allow" && route.external_embedding_allowed === false), "P2-P5 embedding routes must require approval or be denied for external transfer.");
  pushCheck(validationItems, "catalog", "no_executable_vector_routes", embeddingRoutePolicies.every((route) => route.route_executable === false) && vectorPolicyGates.every((gate) => gate.executable === false), "P149 must not create executable vector routes.");

  for (const gate of vectorPolicyGates) {
    const prefix = `vector_policy_gates.${gate.vector_policy_gate_id}`;
    pushCheck(validationItems, prefix, "query_plan_resolves", queryPlanById.has(gate.search_index_query_plan_id), "Vector policy gate must resolve a search index query plan.");
    pushCheck(validationItems, prefix, "required_filters_declared", hasAll(gate.required_filters, REQUIRED_QUERY_FILTERS), "Vector policy gate must require tenant, matter, classification, and policy snapshot filters.");
    pushCheck(validationItems, prefix, "required_gates_declared", hasAll(gate.required_gates, REQUIRED_VECTOR_GATES), "Vector policy gate must require matter, model, classification, vector, retrieval, and audit gates.");
    pushCheck(validationItems, prefix, "policy_boundaries_enforced", gate.matter_wall_enforced === true && gate.external_model_policy_enforced === true && gate.classification_policy_enforced === true && gate.policy_snapshot_bound === true, "Vector policy gate must enforce matter wall, model policy, classification, and policy snapshot boundaries.");
    pushCheck(validationItems, prefix, "filters_required", gate.tenant_filter_required === true && gate.matter_filter_required === true && gate.classification_filter_required === true && gate.policy_snapshot_filter_required === true, "Vector policy gate must require all access filters.");
    pushCheck(validationItems, prefix, "not_executable", gate.gate_status === VECTOR_POLICY_GATE_STATUS && gate.executable === false && gate.vector_materialization_status === "not_materialized", "Vector policy gate must remain held and non-materialized.");
    pushCheck(validationItems, prefix, "wall_refs_preserved", (gate.wall_policy_rule_ids?.length ?? 0) > 0 && (gate.retrieval_wall_filter_ids?.length ?? 0) > 0, "Vector policy gate must preserve wall policy and retrieval wall filter refs.");
    pushCheck(validationItems, prefix, "policy_snapshot_refs_preserved", (gate.policy_snapshot_ids?.length ?? 0) > 0, "Vector policy gate must preserve policy snapshot refs.");
    pushCheck(validationItems, prefix, "source_ref_preserved", gate.source_ref_preserved === true && (gate.source_ref_fields?.length ?? 0) > 0, "Vector policy gate must preserve source refs.");
    pushCheck(validationItems, prefix, "route_group_complete", (routeGroups.get(gate.vector_policy_gate_id)?.length ?? 0) === classificationModelGates.length, "Vector policy gate must have embedding route policies for every classification model gate.");
  }

  for (const route of embeddingRoutePolicies) {
    const prefix = `embedding_route_policies.${route.embedding_route_policy_id}`;
    pushCheck(validationItems, prefix, "vector_gate_resolves", gateById.has(route.vector_policy_gate_id), "Embedding route policy must resolve a vector policy gate.");
    pushCheck(validationItems, prefix, "classification_gate_resolves", classificationGateById.has(route.classification_model_gate_id), "Embedding route policy must resolve a classification model gate.");
    pushCheck(validationItems, prefix, "policy_boundaries_enforced", route.matter_wall_enforced === true && route.external_model_policy_enforced === true && route.classification_policy_enforced === true && route.policy_snapshot_bound === true, "Embedding route must enforce matter wall, model policy, classification, and policy snapshot boundaries.");
    pushCheck(validationItems, prefix, "not_executable", route.route_status === VECTOR_POLICY_GATE_STATUS && route.route_executable === false && route.embedding_execution_status === VECTOR_POLICY_GATE_STATUS, "Embedding route must remain held and non-executable.");
    pushCheck(validationItems, prefix, "source_ref_preserved", route.source_ref_preserved === true, "Embedding route must preserve source refs.");
    if ((route.classification_ordinal ?? 0) >= 2) {
      pushCheck(validationItems, prefix, "sensitive_external_not_allowed", route.policy_external_embedding_decision !== "allow" && route.external_embedding_allowed === false, "Sensitive embedding route cannot be externally allowed.");
    }
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

function summarizeVectorIndexPolicyBoundary({
  searchIndexContract,
  matterAccessPolicyEvaluator,
  wallPolicyContract,
  dataClassificationRuleEngine,
  modelPolicyEnforcement,
  searchIndexQueryPlans,
  classificationModelGates,
  vectorPolicyGates,
  embeddingRoutePolicies,
  validationItems,
  validation,
}) {
  const p2P5Routes = embeddingRoutePolicies.filter((route) => (route.classification_ordinal ?? 0) >= 2);
  return {
    vector_index_policy_boundary_status: validation.valid ? "complete" : "blocked",
    vector_index_policy_boundary_id: VECTOR_POLICY_BOUNDARY_ID,
    vector_policy_gate_schema_version: VECTOR_POLICY_GATE_SCHEMA_VERSION,
    embedding_route_policy_schema_version: EMBEDDING_ROUTE_POLICY_SCHEMA_VERSION,
    search_index_contract_status: searchIndexContract.summary?.search_index_contract_status ?? "unknown",
    matter_access_policy_status: matterAccessPolicyEvaluator.summary?.access_policy_status ?? "unknown",
    wall_policy_status: wallPolicyContract.summary?.wall_policy_status ?? "unknown",
    classification_rule_engine_status: dataClassificationRuleEngine.summary?.classification_rule_engine_status ?? "unknown",
    model_policy_enforcement_status: modelPolicyEnforcement.summary?.model_policy_enforcement_status ?? "unknown",
    search_index_query_plan_count: searchIndexQueryPlans.length,
    classification_model_gate_count: classificationModelGates.length,
    vector_policy_gate_count: vectorPolicyGates.length,
    covered_search_query_plan_count: vectorPolicyGates.filter((gate) => searchIndexQueryPlans.some((plan) => plan.search_index_query_plan_id === gate.search_index_query_plan_id)).length,
    embedding_route_policy_count: embeddingRoutePolicies.length,
    expected_embedding_route_policy_count: vectorPolicyGates.length * classificationModelGates.length,
    matter_wall_enforced_gate_count: vectorPolicyGates.filter((gate) => gate.matter_wall_enforced === true).length,
    external_model_policy_enforced_gate_count: vectorPolicyGates.filter((gate) => gate.external_model_policy_enforced === true).length,
    classification_policy_enforced_gate_count: vectorPolicyGates.filter((gate) => gate.classification_policy_enforced === true).length,
    policy_snapshot_bound_gate_count: vectorPolicyGates.filter((gate) => gate.policy_snapshot_bound === true).length,
    held_vector_policy_gate_count: vectorPolicyGates.filter((gate) => gate.gate_status === VECTOR_POLICY_GATE_STATUS).length,
    non_materialized_vector_gate_count: vectorPolicyGates.filter((gate) => gate.vector_materialization_status === "not_materialized").length,
    source_ref_preserved_gate_count: vectorPolicyGates.filter((gate) => gate.source_ref_preserved === true).length,
    executable_vector_gate_count: vectorPolicyGates.filter((gate) => gate.executable === true).length,
    matter_wall_enforced_route_count: embeddingRoutePolicies.filter((route) => route.matter_wall_enforced === true).length,
    external_model_policy_enforced_route_count: embeddingRoutePolicies.filter((route) => route.external_model_policy_enforced === true).length,
    classification_policy_enforced_route_count: embeddingRoutePolicies.filter((route) => route.classification_policy_enforced === true).length,
    policy_snapshot_bound_route_count: embeddingRoutePolicies.filter((route) => route.policy_snapshot_bound === true).length,
    held_embedding_route_count: embeddingRoutePolicies.filter((route) => route.route_status === VECTOR_POLICY_GATE_STATUS).length,
    executable_vector_route_count: embeddingRoutePolicies.filter((route) => route.route_executable === true).length,
    source_ref_preserved_route_count: embeddingRoutePolicies.filter((route) => route.source_ref_preserved === true).length,
    external_embedding_policy_allow_route_count: embeddingRoutePolicies.filter((route) => route.policy_external_embedding_decision === "allow").length,
    external_embedding_review_route_count: embeddingRoutePolicies.filter((route) => route.policy_external_embedding_decision === "review").length,
    external_embedding_deny_route_count: embeddingRoutePolicies.filter((route) => route.policy_external_embedding_decision === "deny").length,
    p2_p5_embedding_route_count: p2P5Routes.length,
    p2_p5_external_blocked_or_review_route_count: p2P5Routes.filter((route) => route.policy_external_embedding_decision !== "allow" && route.external_embedding_allowed === false).length,
    human_approval_required_route_count: embeddingRoutePolicies.filter((route) => route.human_approval_required === true).length,
    redaction_required_route_count: embeddingRoutePolicies.filter((route) => route.redaction_required === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_collection_id: countBy(vectorPolicyGates, "collection_id"),
    by_external_embedding_transfer_status: countBy(embeddingRoutePolicies, "external_embedding_transfer_status"),
    by_classification: countBy(embeddingRoutePolicies, "classification"),
  };
}

function renderVectorIndexPolicyBoundaryMarkdown(result) {
  const lines = [];
  lines.push("# Vector Index Policy Boundary");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.vector_index_policy_boundary_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.vector_index_policy_boundary_id}`);
  lines.push(`- Search query plans covered: ${result.summary.covered_search_query_plan_count}/${result.summary.search_index_query_plan_count}`);
  lines.push(`- Vector policy gates: ${result.summary.vector_policy_gate_count}`);
  lines.push(`- Embedding route policies: ${result.summary.embedding_route_policy_count}`);
  lines.push(`- Matter-wall enforced gates: ${result.summary.matter_wall_enforced_gate_count}`);
  lines.push(`- External-model enforced gates: ${result.summary.external_model_policy_enforced_gate_count}`);
  lines.push(`- P2-P5 blocked/review routes: ${result.summary.p2_p5_external_blocked_or_review_route_count}/${result.summary.p2_p5_embedding_route_count}`);
  lines.push(`- Executable vector gates: ${result.summary.executable_vector_gate_count}`);
  lines.push(`- Executable vector routes: ${result.summary.executable_vector_route_count}`);
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
    validation_id: `vector-policy-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function normalizeInputs(options) {
  return {
    search_index_contract_path: path.resolve(options.searchIndexContractPath ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS.searchIndexContractPath),
    matter_access_policy_evaluator_path: path.resolve(options.matterAccessPolicyEvaluatorPath ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS.matterAccessPolicyEvaluatorPath),
    wall_policy_contract_path: path.resolve(options.wallPolicyContractPath ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS.wallPolicyContractPath),
    data_classification_rule_engine_path: path.resolve(options.dataClassificationRuleEnginePath ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS.dataClassificationRuleEnginePath),
    model_policy_enforcement_path: path.resolve(options.modelPolicyEnforcementPath ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS.modelPolicyEnforcementPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_VECTOR_INDEX_POLICY_BOUNDARY_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--search-index") parsed.searchIndexContractPath = argv[++index];
    else if (arg === "--matter-access-policy") parsed.matterAccessPolicyEvaluatorPath = argv[++index];
    else if (arg === "--wall-policy-contract") parsed.wallPolicyContractPath = argv[++index];
    else if (arg === "--data-classification-rules") parsed.dataClassificationRuleEnginePath = argv[++index];
    else if (arg === "--model-policy-enforcement") parsed.modelPolicyEnforcementPath = argv[++index];
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
  console.log(`Usage: node scripts/vector-index-policy-boundary.mjs [options]

Options:
  --search-index <path>             search-index-contract.json path.
  --matter-access-policy <path>     matter-access-policy-evaluator.json path.
  --wall-policy-contract <path>     wall-policy-contract.json path.
  --data-classification-rules <path>
                                    data-classification-rule-engine.json path.
  --model-policy-enforcement <path> model-policy-enforcement.json path.
  --out-dir <path>                  Output directory.
  --run-at <iso>                    Deterministic generated_at timestamp.
  --check                           Exit non-zero when validation fails.
  --no-write                        Build without writing artifacts.
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

function serializableVectorIndexPolicyBoundary(result) {
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
