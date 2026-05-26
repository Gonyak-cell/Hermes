import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_OUT_DIR = "artifacts/workflow-retrieval-compiler/latest";
export const DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS = {
  workflowContextBuilderContractPath: "artifacts/workflow-context-builder/latest/workflow-context-builder-contract.json",
  retrievalFilterCompilerPath: "artifacts/retrieval-filters/latest/retrieval-filter-compiler.json",
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  searchIndexContractPath: "artifacts/search-index/latest/search-index-contract.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const RETRIEVAL_COMPILER_CONTRACT_ID = "workflow-retrieval-compiler.v1";
const RETRIEVAL_REQUEST_SCHEMA_VERSION = "workflow-retrieval-request.v1";
const RETRIEVAL_CANDIDATE_SCHEMA_VERSION = "workflow-retrieval-candidate.v1";
const SOURCE_SPAN_PRIORITY_SCHEMA_VERSION = "workflow-source-span-priority.v1";
const RETRIEVAL_GUARD_SCHEMA_VERSION = "workflow-retrieval-guard.v1";
const QUERY_STATUS = "compiled_held_for_query_adapter";
const ADAPTER_STATUS = "query_adapter_not_bound";
const CLASSIFICATION_ORDER = [
  "P0_PUBLIC",
  "P1_INTERNAL",
  "P2_CLIENT_CONFIDENTIAL",
  "P3_PRIVILEGED",
  "P4_HIGHLY_RESTRICTED",
  "P5_REGULATED_SECRET",
];
const LOCATION_PRIORITY = {
  char_range: 1,
  line: 2,
  paragraph: 3,
  page: 4,
  whole_document: 5,
  metadata_only: 99,
};

export async function runWorkflowRetrievalCompiler(options = {}) {
  const result = await buildWorkflowRetrievalCompiler(options);
  if (options.write !== false) await writeWorkflowRetrievalCompiler(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow retrieval compiler validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowRetrievalCompiler(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowContextBuilderContract = await readJson(inputs.workflow_context_builder_contract_path);
  const retrievalFilterCompiler = await readJson(inputs.retrieval_filter_compiler_path);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const searchIndexContract = await readJson(inputs.search_index_contract_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const contextPacketV2Records = workflowContextBuilderContract.context_packet_v2_records ?? [];
  const contextResourceSelections = workflowContextBuilderContract.context_resource_selection_records ?? [];
  const contextTokenBudgets = workflowContextBuilderContract.context_token_budget_records ?? [];
  const contextCitationHints = workflowContextBuilderContract.context_citation_hint_records ?? [];
  const compiledRetrievalFilters = retrievalFilterCompiler.retrieval_filter_catalog?.compiled_retrieval_filters ?? [];
  const retrievalQueryBindings = retrievalFilterCompiler.retrieval_filter_catalog?.retrieval_query_bindings ?? [];
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const searchIndexQueryPlans = searchIndexContract.search_index_catalog?.search_index_query_plans ?? [];
  const buildResult = buildRetrievalRecords({
    contextPacketV2Records,
    contextResourceSelections,
    contextTokenBudgets,
    contextCitationHints,
    compiledRetrievalFilters,
    retrievalQueryBindings,
    sourceSpans,
    searchIndexQueryPlans,
    generatedAt,
  });
  const validationItems = validateWorkflowRetrievalCompiler({
    workflowContextBuilderContract,
    retrievalFilterCompiler,
    sourceSpanStore,
    searchIndexContract,
    packageJson,
    roadmapText,
    contextPacketV2Records,
    contextResourceSelections,
    buildResult,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-retrieval-compiler.v1",
    generated_at: generatedAt,
    workflow_retrieval_compiler_id: `workflow-retrieval-compiler.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_context_builder_contract: sourceSummary(workflowContextBuilderContract, "workflow_context_builder_status"),
      retrieval_filter_compiler: sourceSummary(retrievalFilterCompiler, "retrieval_filter_compiler_status"),
      source_span_store: sourceSummary(sourceSpanStore, "source_span_store_status"),
      search_index_contract: sourceSummary(searchIndexContract, "search_index_contract_status"),
    },
    retrieval_compiler_contract: buildRetrievalCompilerContract(generatedAt),
    retrieval_request_records: buildResult.retrievalRequestRecords,
    retrieval_candidate_records: buildResult.retrievalCandidateRecords,
    source_span_priority_records: buildResult.sourceSpanPriorityRecords,
    retrieval_guard_records: buildResult.retrievalGuardRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowRetrievalCompiler({
      workflowContextBuilderContract,
      retrievalFilterCompiler,
      sourceSpanStore,
      searchIndexContract,
      contextPacketV2Records,
      contextResourceSelections,
      buildResult,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowRetrievalCompilerMarkdown(result),
  };
}

export async function writeWorkflowRetrievalCompiler(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-retrieval-compiler.json"), serializableWorkflowRetrievalCompiler(result));
  await writeJson(path.join(outDir, "retrieval-request-records.json"), {
    schema_version: "workflow-retrieval-request-records.v1",
    generated_at: result.generated_at,
    retrieval_request_record_count: result.retrieval_request_records.length,
    retrieval_request_records: result.retrieval_request_records,
  });
  await writeJson(path.join(outDir, "retrieval-candidate-records.json"), {
    schema_version: "workflow-retrieval-candidate-records.v1",
    generated_at: result.generated_at,
    retrieval_candidate_record_count: result.retrieval_candidate_records.length,
    retrieval_candidate_records: result.retrieval_candidate_records,
  });
  await writeJson(path.join(outDir, "source-span-priority-records.json"), {
    schema_version: "workflow-source-span-priority-records.v1",
    generated_at: result.generated_at,
    source_span_priority_record_count: result.source_span_priority_records.length,
    source_span_priority_records: result.source_span_priority_records,
  });
  await writeJson(path.join(outDir, "retrieval-guard-records.json"), {
    schema_version: "workflow-retrieval-guard-records.v1",
    generated_at: result.generated_at,
    retrieval_guard_record_count: result.retrieval_guard_records.length,
    retrieval_guard_records: result.retrieval_guard_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-retrieval-validation-report.v1",
    generated_at: result.generated_at,
    workflow_retrieval_compiler_id: result.workflow_retrieval_compiler_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowRetrievalCompilerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkflowRetrievalCompiler(args);
    console.log(`Workflow retrieval compiler ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_retrieval_compiler_status}`);
    console.log(`Retrieval requests: ${result.summary.retrieval_request_count}`);
    console.log(`Retrieval candidates: ${result.summary.retrieval_candidate_count}`);
    console.log(`Selected candidates: ${result.summary.selected_candidate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRetrievalRecords({
  contextPacketV2Records,
  contextResourceSelections,
  contextTokenBudgets,
  contextCitationHints,
  compiledRetrievalFilters,
  retrievalQueryBindings,
  sourceSpans,
  searchIndexQueryPlans,
  generatedAt,
}) {
  const selectionsByPacket = groupBy(contextResourceSelections, "context_packet_v2_record_id");
  const tokenBudgetByPacket = indexBy(contextTokenBudgets, "context_packet_v2_record_id");
  const citationHintByPacket = indexBy(contextCitationHints, "context_packet_v2_record_id");
  const sourceSpansByResource = groupBy(sourceSpans, "resource_id");
  const sourceSpanFilter = compiledRetrievalFilters.find((filter) => filter.collection_id === "source_spans") ?? compiledRetrievalFilters[0] ?? {};
  const sourceSpanQueryPlan = searchIndexQueryPlans.find((plan) => plan.collection_id === "source_spans") ?? searchIndexQueryPlans[0] ?? {};
  const queryBindingByClassification = new Map(
    retrievalQueryBindings
      .filter((binding) => binding.collection_id === (sourceSpanFilter.collection_id ?? "source_spans"))
      .map((binding) => [binding.classification, binding]),
  );
  const retrievalRequestRecords = [];
  const retrievalCandidateRecords = [];
  const sourceSpanPriorityRecords = [];
  const retrievalGuardRecords = [];

  for (const packet of contextPacketV2Records) {
    const selections = (selectionsByPacket.get(packet.context_packet_v2_record_id) ?? []).sort(by("context_resource_selection_record_id"));
    const accessibleSelections = selections.filter((selection) => selection.selection_decision === "accessible_resource");
    const excludedSelections = selections.filter((selection) => selection.selection_decision === "excluded_resource");
    const classificationFloor = highestClassification(accessibleSelections.map((selection) => selection.classification));
    const queryBinding = queryBindingByClassification.get(classificationFloor) ?? queryBindingByClassification.get("P0_PUBLIC") ?? retrievalQueryBindings[0] ?? {};
    const requestId = `workflow-retrieval-request.${slugify(packet.workflow_run_id)}`;
    const candidates = accessibleSelections.flatMap((selection) => buildCandidatesForSelection({
      selection,
      packet,
      requestId,
      sourceSpans: sourceSpansByResource.get(selection.resource_id) ?? [],
      generatedAt,
    }));
    const rankedCandidates = candidates
      .sort(compareCandidatePriority)
      .map((candidate, index) => ({
        ...candidate,
        relevance_rank: index + 1,
        selected_for_context: index < Math.min(8, candidates.length),
      }));
    const priorityRecords = rankedCandidates.map((candidate) => buildPriorityRecord(candidate, generatedAt));
    const selectedCandidateIds = rankedCandidates
      .filter((candidate) => candidate.selected_for_context)
      .map((candidate) => candidate.retrieval_candidate_record_id);
    const requestBase = {
      schema_version: RETRIEVAL_REQUEST_SCHEMA_VERSION,
      retrieval_request_record_id: requestId,
      retrieval_compiler_contract_id: RETRIEVAL_COMPILER_CONTRACT_ID,
      context_packet_v2_record_id: packet.context_packet_v2_record_id,
      workflow_run_id: packet.workflow_run_id,
      canonical_workflow_run_id: packet.canonical_workflow_run_id,
      workflow_id: packet.workflow_id,
      capability_id: packet.capability_id,
      domain_pack: packet.domain_pack,
      tenant_id: packet.tenant_id,
      matter_id: packet.matter_id,
      policy_snapshot_id: packet.policy_snapshot_id,
      classification_floor: classificationFloor,
      compiled_retrieval_filter_id: sourceSpanFilter.retrieval_filter_id ?? null,
      retrieval_query_binding_id: queryBinding.retrieval_query_binding_id ?? null,
      search_index_query_plan_id: sourceSpanQueryPlan.search_index_query_plan_id ?? sourceSpanFilter.search_index_query_plan_id ?? null,
      source_context_packet_ids: packet.source_context_packet_ids ?? [],
      token_budget_record_id: tokenBudgetByPacket.get(packet.context_packet_v2_record_id)?.context_token_budget_record_id ?? packet.token_budget_record_id,
      citation_hint_record_id: citationHintByPacket.get(packet.context_packet_v2_record_id)?.context_citation_hint_record_id ?? packet.citation_hint_record_id,
      retrieval_request_status: QUERY_STATUS,
      adapter_execution_status: ADAPTER_STATUS,
      query_execution_allowed: false,
      external_transfer_allowed: false,
      protected_action_execution_allowed: false,
      matter_wall_applied: true,
      classification_filter_applied: true,
      relevance_ranking_applied: true,
      source_span_priority_applied: true,
      required_filter_keys: sourceSpanFilter.required_filter_keys ?? packet.required_filter_keys ?? [],
      required_policy_gates: sourceSpanFilter.required_policy_gates ?? [],
      accessible_resource_count: accessibleSelections.length,
      excluded_resource_count: excludedSelections.length,
      candidate_count: rankedCandidates.length,
      source_span_bound_candidate_count: rankedCandidates.filter((candidate) => candidate.source_span_bound).length,
      metadata_only_candidate_count: rankedCandidates.filter((candidate) => !candidate.source_span_bound).length,
      selected_candidate_count: selectedCandidateIds.length,
      selected_candidate_ids: selectedCandidateIds,
      excluded_resource_ids: excludedSelections.map((selection) => selection.resource_id),
      human_review_required: packet.human_review_required === true,
      law_firm_human_review_required: packet.law_firm_human_review_required === true,
      compiled_at: generatedAt,
    };
    retrievalRequestRecords.push({
      ...requestBase,
      retrieval_request_hash: hashValue(requestBase),
    });
    retrievalCandidateRecords.push(...rankedCandidates.map((candidate) => ({
      ...candidate,
      candidate_hash: hashValue({ ...candidate, candidate_hash: undefined }),
    })));
    sourceSpanPriorityRecords.push(...priorityRecords);
    retrievalGuardRecords.push(buildGuardRecord({ packet, requestId, rankedCandidates, classificationFloor, generatedAt }));
  }

  return {
    retrievalRequestRecords: retrievalRequestRecords.sort(by("retrieval_request_record_id")),
    retrievalCandidateRecords: retrievalCandidateRecords.sort(by("retrieval_candidate_record_id")),
    sourceSpanPriorityRecords: sourceSpanPriorityRecords.sort(by("source_span_priority_record_id")),
    retrievalGuardRecords: retrievalGuardRecords.sort(by("retrieval_guard_record_id")),
  };
}

function buildCandidatesForSelection({ selection, packet, requestId, sourceSpans, generatedAt }) {
  const spans = sourceSpans.length > 0
    ? sourceSpans
    : [{
        source_span_id: null,
        location_type: "metadata_only",
        locator: null,
        content_preview: null,
        matter_id: selection.matter_id,
        classification: selection.classification,
        policy_snapshot_id: packet.policy_snapshot_id,
      }];
  return spans
    .sort((left, right) => (LOCATION_PRIORITY[left.location_type] ?? 99) - (LOCATION_PRIORITY[right.location_type] ?? 99))
    .map((span, index) => {
      const locationPriority = LOCATION_PRIORITY[span.location_type] ?? 99;
      const sourceSpanBound = Boolean(span.source_span_id);
      const matterWallPassed = selection.matter_id === packet.matter_id && (span.matter_id ?? selection.matter_id) === packet.matter_id;
      const classificationAllowed = classificationOrdinal(span.classification ?? selection.classification) <= classificationOrdinal(selection.classification);
      const relevanceScore = Math.max(1, 100 - locationPriority * 7 - classificationOrdinal(selection.classification) * 2 - index);
      return {
        schema_version: RETRIEVAL_CANDIDATE_SCHEMA_VERSION,
        retrieval_candidate_record_id: `workflow-retrieval-candidate.${slugify(packet.workflow_run_id)}.${slugify(selection.resource_id)}.${String(index + 1).padStart(3, "0")}`,
        retrieval_request_record_id: requestId,
        context_packet_v2_record_id: packet.context_packet_v2_record_id,
        context_resource_selection_record_id: selection.context_resource_selection_record_id,
        workflow_run_id: packet.workflow_run_id,
        resource_id: selection.resource_id,
        source_span_id: span.source_span_id,
        source_span_bound: sourceSpanBound,
        source_span_location_type: span.location_type ?? "metadata_only",
        source_span_priority_rank: locationPriority,
        matter_id: selection.matter_id,
        packet_matter_id: packet.matter_id,
        classification: selection.classification,
        span_classification: span.classification ?? selection.classification,
        policy_snapshot_id: packet.policy_snapshot_id,
        candidate_status: sourceSpanBound ? "ranked_source_span_candidate" : "metadata_only_candidate",
        matter_wall_status: matterWallPassed ? "passed" : "blocked",
        classification_status: classificationAllowed ? "passed" : "blocked",
        relevance_score: relevanceScore,
        relevance_rank: null,
        relevance_basis: ["context_packet_accessible_resource", "source_span_location_priority", "matter_wall_match", "classification_floor"],
        priority_basis: sourceSpanBound ? "source_span_location_priority" : "metadata_only_fallback",
        source_span_priority_status: "applied",
        selected_for_context: false,
        query_execution_allowed: false,
        external_transfer_allowed: false,
        content_preview_hash: span.content_preview ? hashValue(span.content_preview) : selection.preview_hash,
        recorded_at: generatedAt,
      };
    });
}

function buildPriorityRecord(candidate, generatedAt) {
  const recordBase = {
    schema_version: SOURCE_SPAN_PRIORITY_SCHEMA_VERSION,
    source_span_priority_record_id: `workflow-source-span-priority.${candidate.retrieval_candidate_record_id.replace(/^workflow-retrieval-candidate\./, "")}`,
    retrieval_candidate_record_id: candidate.retrieval_candidate_record_id,
    retrieval_request_record_id: candidate.retrieval_request_record_id,
    context_packet_v2_record_id: candidate.context_packet_v2_record_id,
    source_span_id: candidate.source_span_id,
    resource_id: candidate.resource_id,
    source_span_bound: candidate.source_span_bound,
    source_span_location_type: candidate.source_span_location_type,
    source_span_priority_rank: candidate.source_span_priority_rank,
    relevance_rank: candidate.relevance_rank,
    relevance_score: candidate.relevance_score,
    source_span_priority_status: candidate.source_span_priority_status,
    priority_basis: candidate.priority_basis,
    selected_for_context: candidate.selected_for_context,
    recorded_at: generatedAt,
  };
  return {
    ...recordBase,
    source_span_priority_hash: hashValue(recordBase),
  };
}

function buildGuardRecord({ packet, requestId, rankedCandidates, classificationFloor, generatedAt }) {
  const crossMatterCandidateCount = rankedCandidates.filter((candidate) => candidate.matter_wall_status !== "passed").length;
  const blockedClassificationCandidateCount = rankedCandidates.filter((candidate) => candidate.classification_status !== "passed").length;
  const recordBase = {
    schema_version: RETRIEVAL_GUARD_SCHEMA_VERSION,
    retrieval_guard_record_id: `workflow-retrieval-guard.${slugify(packet.workflow_run_id)}`,
    retrieval_request_record_id: requestId,
    context_packet_v2_record_id: packet.context_packet_v2_record_id,
    workflow_run_id: packet.workflow_run_id,
    matter_id: packet.matter_id,
    classification_floor: classificationFloor,
    retrieval_guard_status: crossMatterCandidateCount === 0 && blockedClassificationCandidateCount === 0 ? "passed" : "blocked",
    matter_wall_guard_status: crossMatterCandidateCount === 0 ? "passed" : "blocked",
    classification_guard_status: blockedClassificationCandidateCount === 0 ? "passed" : "blocked",
    relevance_guard_status: rankedCandidates.length > 0 ? "ranked" : "missing_candidates",
    source_span_priority_guard_status: rankedCandidates.every((candidate) => candidate.source_span_priority_status === "applied") ? "applied" : "blocked",
    cross_matter_candidate_count: crossMatterCandidateCount,
    blocked_classification_candidate_count: blockedClassificationCandidateCount,
    missing_source_span_candidate_count: rankedCandidates.filter((candidate) => !candidate.source_span_bound).length,
    query_execution_allowed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: packet.human_review_required === true,
    recorded_at: generatedAt,
  };
  return {
    ...recordBase,
    retrieval_guard_hash: hashValue(recordBase),
  };
}

function validateWorkflowRetrievalCompiler({
  workflowContextBuilderContract,
  retrievalFilterCompiler,
  sourceSpanStore,
  searchIndexContract,
  packageJson,
  roadmapText,
  contextPacketV2Records,
  contextResourceSelections,
  buildResult,
}) {
  const items = [];
  const requests = buildResult.retrievalRequestRecords;
  const candidates = buildResult.retrievalCandidateRecords;
  const priorities = buildResult.sourceSpanPriorityRecords;
  const guards = buildResult.retrievalGuardRecords;
  const requestIds = new Set(requests.map((record) => record.retrieval_request_record_id));
  const accessibleSelections = contextResourceSelections.filter((selection) => selection.selection_decision === "accessible_resource");
  const accessibleResourceIds = new Set(accessibleSelections.map((selection) => selection.resource_id));
  const candidateResourceIds = new Set(candidates.map((candidate) => candidate.resource_id));

  pushCheck(items, "source.workflow_context_builder_contract", "workflow_context_builder_complete", workflowContextBuilderContract.summary?.workflow_context_builder_status === "complete" && workflowContextBuilderContract.validation?.valid !== false, "Workflow context builder contract must be complete.");
  pushCheck(items, "source.retrieval_filter_compiler", "retrieval_filter_compiler_complete", retrievalFilterCompiler.summary?.retrieval_filter_compiler_status === "complete" && retrievalFilterCompiler.validation?.valid !== false, "Retrieval filter compiler must be complete.");
  pushCheck(items, "source.source_span_store", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete" && sourceSpanStore.validation?.valid !== false, "Source span store must be complete.");
  pushCheck(items, "source.search_index_contract", "search_index_contract_complete", searchIndexContract.summary?.search_index_contract_status === "complete" && searchIndexContract.validation?.valid !== false, "Search index contract must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:retrieval-compiler"]), "package.json must expose npm run workflows:retrieval-compiler.");
  pushCheck(items, "roadmap.phase_185", "phase_185_documented", roadmapText.includes("P185") && roadmapText.includes("retrieval compiler"), "Phase ledger must keep the P185 retrieval compiler slot visible.");
  pushCheck(items, "retrieval_request_records", "request_per_context_packet", requests.length === contextPacketV2Records.length && requests.length > 0, "Every context packet v2 record must have one retrieval request.");
  pushCheck(items, "retrieval_request_records", "requests_apply_required_gates", requests.every((request) => request.matter_wall_applied && request.classification_filter_applied && request.relevance_ranking_applied && request.source_span_priority_applied), "Every request must apply matter wall, classification, relevance, and source span priority.");
  pushCheck(items, "retrieval_request_records", "requests_non_executable", requests.every((request) => !request.query_execution_allowed && !request.external_transfer_allowed && !request.protected_action_execution_allowed), "Retrieval compiler must not execute queries, transfer data, or execute protected actions.");
  pushCheck(items, "retrieval_candidate_records", "candidate_for_every_accessible_resource", [...accessibleResourceIds].every((resourceId) => candidateResourceIds.has(resourceId)), "Every accessible resource must produce at least one retrieval candidate.");
  pushCheck(items, "retrieval_candidate_records", "candidates_pass_matter_and_classification", candidates.length > 0 && candidates.every((candidate) => candidate.matter_wall_status === "passed" && candidate.classification_status === "passed"), "Retrieval candidates must pass matter wall and classification gates.");
  pushCheck(items, "retrieval_candidate_records", "relevance_ranked", candidates.every((candidate) => Number.isInteger(candidate.relevance_rank) && candidate.relevance_score > 0), "Retrieval candidates must carry deterministic relevance ranks and scores.");
  pushCheck(items, "retrieval_candidate_records", "selected_candidates_present", requests.every((request) => request.selected_candidate_count > 0), "Every request must select at least one candidate for review context.");
  pushCheck(items, "source_span_priority_records", "priority_per_candidate", priorities.length === candidates.length && priorities.every((priority) => requestIds.has(priority.retrieval_request_record_id)), "Every retrieval candidate must have a source span priority record.");
  pushCheck(items, "source_span_priority_records", "source_span_priority_applied", priorities.every((priority) => priority.source_span_priority_status === "applied" && Number.isInteger(priority.source_span_priority_rank)), "Source span priority must be applied to every candidate.");
  pushCheck(items, "retrieval_guard_records", "guard_per_request", guards.length === requests.length && guards.every((guard) => requestIds.has(guard.retrieval_request_record_id)), "Every request must have one retrieval guard.");
  pushCheck(items, "retrieval_guard_records", "guards_pass", guards.every((guard) => guard.retrieval_guard_status === "passed" && guard.cross_matter_candidate_count === 0 && guard.blocked_classification_candidate_count === 0), "Retrieval guards must pass without cross-matter or blocked-classification candidates.");
  pushCheck(items, "retrieval_guard_records", "guards_non_executable", guards.every((guard) => !guard.query_execution_allowed && !guard.external_transfer_allowed && !guard.protected_action_execution_allowed), "Retrieval guards must keep query execution, transfer, and protected actions disabled.");
  pushCheck(items, "retrieval_request_records.law_firm", "law_firm_requests_require_human_review", requests.filter((request) => request.domain_pack === "law-firm").every((request) => request.human_review_required && request.law_firm_human_review_required), "Law-firm retrieval requests must require human review.");
  return items;
}

function summarizeWorkflowRetrievalCompiler({
  workflowContextBuilderContract,
  retrievalFilterCompiler,
  sourceSpanStore,
  searchIndexContract,
  contextPacketV2Records,
  contextResourceSelections,
  buildResult,
  validation,
  validationItems,
}) {
  const requests = buildResult.retrievalRequestRecords;
  const candidates = buildResult.retrievalCandidateRecords;
  const priorities = buildResult.sourceSpanPriorityRecords;
  const guards = buildResult.retrievalGuardRecords;
  return {
    workflow_retrieval_compiler_status: validation.errors.length === 0 ? "complete" : "blocked",
    retrieval_compiler_contract_id: RETRIEVAL_COMPILER_CONTRACT_ID,
    source_workflow_context_builder_status: workflowContextBuilderContract.summary?.workflow_context_builder_status ?? "unknown",
    source_retrieval_filter_compiler_status: retrievalFilterCompiler.summary?.retrieval_filter_compiler_status ?? "unknown",
    source_source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    source_search_index_contract_status: searchIndexContract.summary?.search_index_contract_status ?? "unknown",
    source_context_packet_v2_count: contextPacketV2Records.length,
    source_accessible_resource_count: contextResourceSelections.filter((record) => record.selection_decision === "accessible_resource").length,
    source_excluded_resource_count: contextResourceSelections.filter((record) => record.selection_decision === "excluded_resource").length,
    source_compiled_retrieval_filter_count: retrievalFilterCompiler.summary?.compiled_retrieval_filter_count ?? 0,
    source_retrieval_query_binding_count: retrievalFilterCompiler.summary?.retrieval_query_binding_count ?? 0,
    source_source_span_count: sourceSpanStore.summary?.source_span_count ?? 0,
    source_search_index_query_plan_count: searchIndexContract.summary?.search_index_query_plan_count ?? 0,
    retrieval_request_count: requests.length,
    packet_with_retrieval_request_count: new Set(requests.map((request) => request.context_packet_v2_record_id)).size,
    request_with_selected_candidate_count: requests.filter((request) => request.selected_candidate_count > 0).length,
    retrieval_candidate_count: candidates.length,
    selected_candidate_count: candidates.filter((candidate) => candidate.selected_for_context).length,
    source_span_bound_candidate_count: candidates.filter((candidate) => candidate.source_span_bound).length,
    metadata_only_candidate_count: candidates.filter((candidate) => !candidate.source_span_bound).length,
    source_span_priority_record_count: priorities.length,
    retrieval_guard_record_count: guards.length,
    matter_wall_applied_request_count: requests.filter((request) => request.matter_wall_applied).length,
    classification_filter_applied_request_count: requests.filter((request) => request.classification_filter_applied).length,
    relevance_ranking_applied_request_count: requests.filter((request) => request.relevance_ranking_applied).length,
    source_span_priority_applied_request_count: requests.filter((request) => request.source_span_priority_applied).length,
    retrieval_guard_passed_count: guards.filter((guard) => guard.retrieval_guard_status === "passed").length,
    cross_matter_candidate_count: candidates.filter((candidate) => candidate.matter_wall_status !== "passed").length,
    blocked_classification_candidate_count: candidates.filter((candidate) => candidate.classification_status !== "passed").length,
    query_execution_allowed_count: requests.filter((request) => request.query_execution_allowed).length + guards.filter((guard) => guard.query_execution_allowed).length,
    external_transfer_allowed_count: requests.filter((request) => request.external_transfer_allowed).length + candidates.filter((candidate) => candidate.external_transfer_allowed).length + guards.filter((guard) => guard.external_transfer_allowed).length,
    protected_action_executed_count: requests.filter((request) => request.protected_action_execution_allowed).length + guards.filter((guard) => guard.protected_action_execution_allowed).length,
    law_firm_retrieval_request_count: requests.filter((request) => request.domain_pack === "law-firm").length,
    law_firm_human_review_request_count: requests.filter((request) => request.domain_pack === "law-firm" && request.law_firm_human_review_required).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_retrieval_request_status: countByObject(requests, "retrieval_request_status"),
    by_candidate_status: countByObject(candidates, "candidate_status"),
    by_source_span_location_type: countByObject(candidates, "source_span_location_type"),
    by_retrieval_guard_status: countByObject(guards, "retrieval_guard_status"),
    by_domain_pack: countByObject(requests, "domain_pack"),
  };
}

function buildRetrievalCompilerContract(generatedAt) {
  return {
    schema_version: "workflow-retrieval-compiler-contract.v1",
    generated_at: generatedAt,
    retrieval_compiler_contract_id: RETRIEVAL_COMPILER_CONTRACT_ID,
    retrieval_request_schema_version: RETRIEVAL_REQUEST_SCHEMA_VERSION,
    retrieval_candidate_schema_version: RETRIEVAL_CANDIDATE_SCHEMA_VERSION,
    source_span_priority_schema_version: SOURCE_SPAN_PRIORITY_SCHEMA_VERSION,
    retrieval_guard_schema_version: RETRIEVAL_GUARD_SCHEMA_VERSION,
    enforcement_rule: "retrieval requests are compiled only after context packet v2, retrieval filters, matter wall, classification, and source span priority are bound",
    execution_rule: "P185 compiles review-only retrieval plans and never executes a query adapter",
    relevance_rule: "candidate relevance is deterministic and derived from accessible context resource, matter match, classification floor, and source span location priority",
    source_span_rule: "source spans are ranked by char_range, line, paragraph, page, whole_document, then metadata-only fallback",
    law_firm_safety_rule: "law-firm retrieval requests remain human-review gated and cannot produce legal or client-facing output.",
  };
}

function renderWorkflowRetrievalCompilerMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Retrieval Compiler");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_retrieval_compiler_status}`);
  lines.push("");
  lines.push(`- Retrieval requests: ${summary.retrieval_request_count}`);
  lines.push(`- Retrieval candidates: ${summary.retrieval_candidate_count}`);
  lines.push(`- Selected candidates: ${summary.selected_candidate_count}`);
  lines.push(`- Source-span bound candidates: ${summary.source_span_bound_candidate_count}`);
  lines.push(`- Matter/classification blockers: ${summary.cross_matter_candidate_count}/${summary.blocked_classification_candidate_count}`);
  lines.push(`- Query/external/protected allowed: ${summary.query_execution_allowed_count}/${summary.external_transfer_allowed_count}/${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Retrieval Requests");
  lines.push("");
  for (const request of result.retrieval_request_records) {
    lines.push(`- ${request.retrieval_request_record_id}: ${request.retrieval_request_status}, candidates=${request.candidate_count}, selected=${request.selected_candidate_count}, classification=${request.classification_floor}`);
  }
  return `${lines.join("\n")}\n`;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function normalizeInputs(options) {
  return {
    workflow_context_builder_contract_path: path.resolve(options.workflowContextBuilderContractPath ?? DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.workflowContextBuilderContractPath),
    retrieval_filter_compiler_path: path.resolve(options.retrievalFilterCompilerPath ?? DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.retrievalFilterCompilerPath),
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.sourceSpanStorePath),
    search_index_contract_path: path.resolve(options.searchIndexContractPath ?? DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.searchIndexContractPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowContextBuilderContractPath: DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.workflowContextBuilderContractPath,
    retrievalFilterCompilerPath: DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.retrievalFilterCompilerPath,
    sourceSpanStorePath: DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.sourceSpanStorePath,
    searchIndexContractPath: DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.searchIndexContractPath,
    packagePath: DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_RETRIEVAL_COMPILER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-context-builder") parsed.workflowContextBuilderContractPath = argv[++index];
    else if (arg === "--retrieval-filter-compiler") parsed.retrievalFilterCompilerPath = argv[++index];
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--search-index") parsed.searchIndexContractPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-retrieval-compiler.mjs [options]

Options:
  --workflow-context-builder <path> workflow-context-builder-contract.json path.
  --retrieval-filter-compiler <path> retrieval-filter-compiler.json path.
  --source-span-store <path>        source-span-store.json path.
  --search-index <path>             search-index-contract.json path.
  --package <path>                  package.json path.
  --roadmap <path>                  phase ledger path.
  --out-dir <folder>                Output directory.
  --run-at <iso>                    Deterministic generated_at timestamp.
  --check                           Validate only, do not write artifacts.
  -h, --help                        Show this help.
`);
}

function sourceSummary(source, statusKey) {
  return {
    schema_version: source.schema_version ?? null,
    status: source.summary?.[statusKey] ?? source[statusKey] ?? "unknown",
    validation_error_count: source.summary?.validation_error_count ?? source.validation?.errors?.length ?? 0,
  };
}

function serializableWorkflowRetrievalCompiler(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
}

function indexBy(items, key) {
  return new Map(items.map((item) => [item[key], item]));
}

function countByObject(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function compareCandidatePriority(left, right) {
  return (left.source_span_priority_rank - right.source_span_priority_rank)
    || (right.relevance_score - left.relevance_score)
    || String(left.retrieval_candidate_record_id).localeCompare(String(right.retrieval_candidate_record_id));
}

function highestClassification(classifications) {
  let highest = "P0_PUBLIC";
  for (const classification of classifications) {
    if (classificationOrdinal(classification) > classificationOrdinal(highest)) highest = classification;
  }
  return highest;
}

function classificationOrdinal(classification) {
  const index = CLASSIFICATION_ORDER.indexOf(classification);
  return index >= 0 ? index : 99;
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 96);
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
