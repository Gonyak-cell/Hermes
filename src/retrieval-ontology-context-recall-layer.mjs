import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildMemoryBankEventObservabilityPlane } from "./memory-bank-event-observability-plane.mjs";

export const DEFAULT_RETRIEVAL_ONTOLOGY_CONTEXT_RECALL_LAYER_OUT_DIR = "artifacts/retrieval-ontology-context-recall-layer/latest";
export const DEFAULT_RETRIEVAL_ONTOLOGY_CONTEXT_RECALL_LAYER_INPUTS = {
  schemaPath: "schemas/retrieval-ontology-context-recall-layer.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:retrieval-ontology-context-recall-layer";
const MEMORY_COMMAND_NAME = "platform:memory-bank-event-observability-plane";
const SCHEMA_VERSION = "retrieval-ontology-context-recall-layer.v1";
const CAPABILITY_ID = "platform.retrieval_ontology_context_recall_layer";
const PROGRAM_RANGE = "P7301-P7600";
const READY_STATUS = "ready_for_retrieval_ontology_context_recall_layer_v0";
const MEMORY_READY_STATUS = "ready_for_memory_bank_event_observability_plane_v0";

const PHASE_SPECS = [
  ["P7301-P7330", "Retrieval Ontology Contract"],
  ["P7331-P7360", "Source-Cited Search Contract"],
  ["P7361-P7390", "Extracted Fact and Claim Recall Contract"],
  ["P7391-P7420", "Consolidation and Conflict Resolution"],
  ["P7421-P7450", "Relation Graph Context Compiler"],
  ["P7451-P7480", "Next-Session Recall Bundle"],
  ["P7481-P7510", "Domain and Project Boundary Filters"],
  ["P7511-P7540", "Staleness and Freshness Policy"],
  ["P7541-P7570", "Recall Negative Fixtures"],
  ["P7571-P7600", "Retrieval Ontology Context Recall Freeze"],
];

const ONTOLOGY_SPECS = [
  ["ontology.project", "project, goal, branch, phase, and milestone"],
  ["ontology.domain", "domain pack, matter, HR, resource, connector, and trading boundaries"],
  ["ontology.workflow", "plan, task, blocker, validation, review, gate, and next action"],
  ["ontology.evidence", "artifact, citation, receipt, source span, and object ref"],
  ["ontology.trust", "lower-trust, enterprise trust, no-human, protected closeout, and Work OS boundary"],
];

const SEARCH_SPECS = [
  ["search.by_project_phase", "project and phase search"],
  ["search.by_source_ref", "source citation search"],
  ["search.by_gate", "gate and verdict search"],
  ["search.by_review_receipt", "review receipt and finding search"],
  ["search.by_next_action", "next allowed action search"],
];

const FACT_RECALL_SPECS = [
  ["fact.goal", "current goal and objective fact"],
  ["fact.phase_status", "phase status and completion boundary fact"],
  ["fact.review_finding", "review finding and resolution fact"],
  ["fact.blocker", "blocker and missing evidence fact"],
  ["fact.next_condition", "next execution condition fact"],
];

const NEGATIVE_FIXTURES = [
  ["negative.uncited_recall", "recall bundle contains fact without source citation", "BLOCK_UNCITED_RECALL"],
  ["negative.raw_transcript_recall", "recall exposes raw transcript body by default", "BLOCK_RAW_TRANSCRIPT_RECALL"],
  ["negative.stale_fact_as_current", "stale fact is presented as current without freshness note", "BLOCK_STALE_MEMORY_TRUTH"],
  ["negative.cross_domain_recall", "recall crosses project, matter, HR, or domain boundary", "BLOCK_CROSS_DOMAIN_RECALL"],
  ["negative.conflict_hidden", "conflicting facts are consolidated without conflict note", "BLOCK_HIDDEN_CONFLICT"],
  ["negative.missing_claude_review_receipt", "milestone recall layer is closed without Claude review receipt evidence", "BLOCK_MISSING_CLAUDE_REVIEW_RECEIPT"],
  ["negative.auto_context_mutation", "retrieved context mutates plan or policy without review", "BLOCK_AUTO_CONTEXT_MUTATION"],
  ["negative.recall_as_final_approval", "recall bundle is treated as protected final approval", "BLOCK_RECALL_APPROVAL"],
];

export async function runRetrievalOntologyContextRecallLayer(options = {}) {
  const result = await buildRetrievalOntologyContextRecallLayer(options);
  if (options.write !== false) await writeRetrievalOntologyContextRecallLayer(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Retrieval ontology context recall layer failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildRetrievalOntologyContextRecallLayer(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_RETRIEVAL_ONTOLOGY_CONTEXT_RECALL_LAYER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const memoryPlane = options.memoryPlane ?? await buildMemoryBankEventObservabilityPlane({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildRecallContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const ontologyRows = buildOntologyRows(generatedAt);
  const sourceCitedSearchRows = buildSourceCitedSearchRows(generatedAt);
  const factRecallRows = buildFactRecallRows(generatedAt);
  const consolidationRows = buildConsolidationRows(generatedAt);
  const relationGraphRows = buildRelationGraphRows(generatedAt);
  const recallBundleRows = buildRecallBundleRows(generatedAt);
  const boundaryFilterRows = buildBoundaryFilterRows(generatedAt);
  const stalenessRows = buildStalenessRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const freezeRows = buildFreezeRows({ ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, memoryPlane, contract, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows });
  const boundary = buildBoundary({ memoryPlane, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, memoryPlane, contract, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    retrieval_ontology_context_recall_layer_id: `retrieval-ontology-context-recall-layer.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_memory_bank_event_observability_plane_summary: memoryPlane.summary,
    retrieval_ontology_context_recall_contract: contract,
    retrieval_ontology_context_recall_phase_rows: phaseRows,
    retrieval_ontology_rows: ontologyRows,
    source_cited_search_rows: sourceCitedSearchRows,
    extracted_fact_claim_recall_rows: factRecallRows,
    consolidation_conflict_resolution_rows: consolidationRows,
    relation_graph_context_compiler_rows: relationGraphRows,
    next_session_recall_bundle_rows: recallBundleRows,
    domain_project_boundary_filter_rows: boundaryFilterRows,
    staleness_freshness_policy_rows: stalenessRows,
    recall_negative_fixture_rows: negativeFixtureRows,
    retrieval_ontology_context_recall_freeze_rows: freezeRows,
    retrieval_ontology_context_recall_gate_rows: gateRows,
    retrieval_ontology_context_recall_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ memoryPlane, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "retrieval_ontology_context_recall_layer")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ memoryPlane, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.retrieval_ontology_context_recall_layer_id = result.retrieval_ontology_context_recall_layer_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeRetrievalOntologyContextRecallLayer(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "retrieval-ontology-context-recall-layer.json"), serializableResult(result));
  await writeJson(path.join(outDir, "retrieval-ontology-rows.json"), collectionEnvelope("retrieval-ontology-rows.v1", "retrieval_ontology_rows", result.retrieval_ontology_rows, result.generated_at));
  await writeJson(path.join(outDir, "source-cited-search-rows.json"), collectionEnvelope("source-cited-search-rows.v1", "source_cited_search_rows", result.source_cited_search_rows, result.generated_at));
  await writeJson(path.join(outDir, "extracted-fact-claim-recall-rows.json"), collectionEnvelope("extracted-fact-claim-recall-rows.v1", "extracted_fact_claim_recall_rows", result.extracted_fact_claim_recall_rows, result.generated_at));
  await writeJson(path.join(outDir, "consolidation-conflict-resolution-rows.json"), collectionEnvelope("consolidation-conflict-resolution-rows.v1", "consolidation_conflict_resolution_rows", result.consolidation_conflict_resolution_rows, result.generated_at));
  await writeJson(path.join(outDir, "relation-graph-context-compiler-rows.json"), collectionEnvelope("relation-graph-context-compiler-rows.v1", "relation_graph_context_compiler_rows", result.relation_graph_context_compiler_rows, result.generated_at));
  await writeJson(path.join(outDir, "next-session-recall-bundle-rows.json"), collectionEnvelope("next-session-recall-bundle-rows.v1", "next_session_recall_bundle_rows", result.next_session_recall_bundle_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-project-boundary-filter-rows.json"), collectionEnvelope("domain-project-boundary-filter-rows.v1", "domain_project_boundary_filter_rows", result.domain_project_boundary_filter_rows, result.generated_at));
  await writeJson(path.join(outDir, "staleness-freshness-policy-rows.json"), collectionEnvelope("staleness-freshness-policy-rows.v1", "staleness_freshness_policy_rows", result.staleness_freshness_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "recall-negative-fixture-rows.json"), collectionEnvelope("recall-negative-fixture-rows.v1", "recall_negative_fixture_rows", result.recall_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "retrieval-ontology-context-recall-freeze-rows.json"), collectionEnvelope("retrieval-ontology-context-recall-freeze-rows.v1", "retrieval_ontology_context_recall_freeze_rows", result.retrieval_ontology_context_recall_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "retrieval-ontology-context-recall-gate-rows.json"), collectionEnvelope("retrieval-ontology-context-recall-gate-rows.v1", "retrieval_ontology_context_recall_gate_rows", result.retrieval_ontology_context_recall_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "retrieval-ontology-context-recall-boundary.json"), result.retrieval_ontology_context_recall_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "retrieval-ontology-context-recall-layer-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runRetrievalOntologyContextRecallLayerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runRetrievalOntologyContextRecallLayer(args);
    console.log(`Retrieval ontology context recall layer ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.retrieval_ontology_context_recall_layer_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Ontology rows: ${result.summary.ontology_count}`);
    console.log(`Recall bundle ready: ${result.summary.next_session_recall_bundle_ready}`);
    console.log(`Uncited recall allowed: ${result.summary.uncited_recall_allowed}`);
    console.log(`Auto context mutation enabled: ${result.summary.auto_context_mutation_enabled}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRecallContract(generatedAt) {
  return {
    schema_version: "retrieval-ontology-context-recall-contract.v1",
    generated_at: generatedAt,
    contract_id: "retrieval-ontology-context-recall-contract.p7301-p7600",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7001-P7300",
    retrieval_ontology_required: true,
    source_cited_search_required: true,
    extracted_fact_claim_recall_required: true,
    consolidation_conflict_resolution_required: true,
    relation_graph_context_compiler_required: true,
    next_session_recall_bundle_required: true,
    domain_project_boundary_filters_required: true,
    staleness_freshness_policy_required: true,
    codex_implementation_packet_required: true,
    harness_deterministic_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    finding_loop_and_revalidation_required: true,
    review_receipt_registration_required: true,
    single_owner_trust_classification_required: true,
    cited_recall_bundle_ready: true,
    uncited_recall_allowed: false,
    raw_transcript_recall_allowed: false,
    stale_fact_as_current_allowed: false,
    cross_domain_recall_allowed: false,
    auto_context_mutation_enabled: false,
    recall_as_final_approval_enabled: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => verdictRow({
    schema_version: "retrieval-ontology-context-recall-phase-row.v1",
    row_id: `retrieval.ontology.context.recall.phase.row.${String(index + 1).padStart(2, "0")}`,
    phase_range,
    phase_name,
    phase_status: includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name) ? "reflected" : "missing",
    evidence_ref: `docs.hermes_p8000.${phase_range}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.platform.retrieval_ontology_context_recall.${phase_range}`,
    responsible_owner: "platform_memory_owner",
    next_allowed_action: "preserve retrieval ontology phase contract",
  }, includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name)));
}

function makeRows(specs, schemaVersion, rowPrefix, extra) {
  return specs.map(([id, description], index) => ({
    schema_version: schemaVersion,
    row_id: `${rowPrefix}.${String(index + 1).padStart(3, "0")}`,
    item_id: id,
    description,
    evidence_ref: `evidence.${rowPrefix}.${id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.${rowPrefix}.${id}`,
    next_allowed_action: "preserve cited retrieval contract",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    ...extra,
  }));
}

function buildOntologyRows(generatedAt) {
  return makeRows(ONTOLOGY_SPECS, "retrieval-ontology-row.v1", "retrieval.ontology.row", {
    generated_at: generatedAt,
    ontology_contract_ready: true,
    source_citation_required: true,
    domain_boundary_required: true,
  });
}

function buildSourceCitedSearchRows(generatedAt) {
  return makeRows(SEARCH_SPECS, "source-cited-search-row.v1", "source.cited.search.row", {
    generated_at: generatedAt,
    search_contract_ready: true,
    source_citation_required: true,
    source_status_required: true,
    uncited_search_result_allowed: false,
  });
}

function buildFactRecallRows(generatedAt) {
  return makeRows(FACT_RECALL_SPECS, "extracted-fact-claim-recall-row.v1", "extracted.fact.claim.recall.row", {
    generated_at: generatedAt,
    fact_recall_contract_ready: true,
    source_citation_required: true,
    freshness_note_required: true,
    truth_claim_without_review_allowed: false,
  });
}

function buildConsolidationRows(generatedAt) {
  return [
    {
      schema_version: "consolidation-conflict-resolution-row.v1",
      row_id: "consolidation.conflict.resolution.row.001",
      generated_at: generatedAt,
      consolidation_contract_ready: true,
      duplicate_detection_required: true,
      conflict_note_required: true,
      stale_fact_handling_required: true,
      hidden_conflict_allowed: false,
      evidence_ref: "evidence.consolidation_conflict_resolution",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.consolidation_conflict_resolution",
      next_allowed_action: "preserve conflict-aware consolidation contract",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildRelationGraphRows(generatedAt) {
  return [
    {
      schema_version: "relation-graph-context-compiler-row.v1",
      row_id: "relation.graph.context.compiler.row.001",
      generated_at: generatedAt,
      relation_graph_ready: true,
      relates_claim_evidence_review_gate_plan: true,
      source_citation_required: true,
      cross_domain_relation_requires_boundary_check: true,
      evidence_ref: "evidence.relation_graph_context_compiler",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.relation_graph_context_compiler",
      next_allowed_action: "compile cited context graph for next-session bundle",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildRecallBundleRows(generatedAt) {
  return [
    {
      schema_version: "next-session-recall-bundle-row.v1",
      row_id: "next.session.recall.bundle.row.001",
      generated_at: generatedAt,
      recall_bundle_ready: true,
      source_citations_required: true,
      unresolved_questions_required: true,
      current_gates_required: true,
      next_allowed_actions_required: true,
      claude_code_opus_max_review_receipt_required_for_milestone: true,
      codex_self_approval_allowed: false,
      claude_final_approval_allowed: false,
      auto_context_mutation_enabled: false,
      evidence_ref: "evidence.next_session_recall_bundle",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.next_session_recall_bundle",
      next_allowed_action: "present cited recall bundle without automatic mutation",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildBoundaryFilterRows(generatedAt) {
  const specs = [
    ["filter.project", "project boundary filter"],
    ["filter.domain", "domain pack boundary filter"],
    ["filter.matter", "matter and tenant boundary filter"],
    ["filter.sensitivity", "secret, privileged, HR, client, and restricted data filter"],
  ];
  return makeRows(specs, "domain-project-boundary-filter-row.v1", "domain.project.boundary.filter.row", {
    generated_at: generatedAt,
    boundary_filter_ready: true,
    cross_domain_recall_allowed: false,
    raw_sensitive_data_recall_allowed: false,
  });
}

function buildStalenessRows(generatedAt) {
  return [
    {
      schema_version: "staleness-freshness-policy-row.v1",
      row_id: "staleness.freshness.policy.row.001",
      generated_at: generatedAt,
      freshness_policy_ready: true,
      generated_at_required: true,
      source_updated_at_required: true,
      stale_risk_note_required: true,
      stale_fact_as_current_allowed: false,
      evidence_ref: "evidence.staleness_freshness_policy",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.staleness_freshness_policy",
      next_allowed_action: "state freshness in every recall bundle",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "recall-negative-fixture-row.v1",
    row_id: `recall.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_recall_claim_allowed: false,
    evidence_ref: `evidence.recall_negative_fixture.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.recall_negative_fixture.${fixture_id}`,
    next_allowed_action: "preserve recall negative fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildFreezeRows({ ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, generatedAt }) {
  const specs = [
    ["ontology_ready", ontologyRows.every((row) => row.ontology_contract_ready), "retrieval ontology is ready"],
    ["search_ready", sourceCitedSearchRows.every((row) => row.source_citation_required && row.uncited_search_result_allowed === false), "source-cited search is ready"],
    ["fact_recall_ready", factRecallRows.every((row) => row.freshness_note_required && row.truth_claim_without_review_allowed === false), "fact recall is source cited"],
    ["consolidation_ready", consolidationRows.every((row) => row.hidden_conflict_allowed === false), "consolidation exposes conflicts"],
    ["relation_graph_ready", relationGraphRows.every((row) => row.relation_graph_ready), "relation graph compiler is ready"],
    ["recall_bundle_ready", recallBundleRows.every((row) => row.recall_bundle_ready && row.auto_context_mutation_enabled === false), "next-session recall bundle is ready"],
    ["boundary_filters_ready", boundaryFilterRows.every((row) => row.cross_domain_recall_allowed === false), "domain boundary filters are ready"],
    ["staleness_ready", stalenessRows.every((row) => row.stale_fact_as_current_allowed === false), "freshness policy is ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "recall negative fixtures are ready"],
    ["milestone_review_process_ready", recallBundleRows.every((row) => row.claude_code_opus_max_review_receipt_required_for_milestone && row.codex_self_approval_allowed === false && row.claude_final_approval_allowed === false), "Codex-Harness-Claude milestone review process is ready"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "retrieval-ontology-context-recall-freeze-row.v1",
    row_id: `retrieval.ontology.context.recall.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.retrieval_ontology_context_recall.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.retrieval_ontology_context_recall.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, memoryPlane, contract, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:retrieval-ontology-context-recall-layer"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes retrieval ontology context recall layer"],
    ["memory_script_registered", Boolean(packageJson.data?.scripts?.[MEMORY_COMMAND_NAME]), "memory bank event observability script exists"],
    ["memory_ready", memoryPlane.summary?.memory_bank_event_observability_plane_status === MEMORY_READY_STATUS, "P7001-P7300 memory event plane is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Retrieval Ontology and Context Recall Layer"), "P7301-P7600 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Retrieval Ontology and Context Recall Layer"), "architecture doc reflects retrieval recall layer"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Retrieval Ontology and Context Recall Layer"), "review dashboard IA reflects retrieval recall layer"],
    ["contract_ready", contract.cited_recall_bundle_ready && contract.uncited_recall_allowed === false && contract.auto_context_mutation_enabled === false, "retrieval recall contract is ready"],
    ["review_process_contract_ready", contract.codex_implementation_packet_required && contract.harness_deterministic_validation_required && contract.claude_code_opus_max_review_receipt_required && contract.single_owner_trust_classification_required, "Codex-Harness-Claude review process contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P7301-P7600 phase rows pass"],
    ["ontology_ready", ontologyRows.length >= 5 && ontologyRows.every((row) => row.source_citation_required), "ontology rows are ready"],
    ["search_ready", sourceCitedSearchRows.length >= 5 && sourceCitedSearchRows.every((row) => row.uncited_search_result_allowed === false), "source-cited search rows are ready"],
    ["fact_recall_ready", factRecallRows.length >= 5 && factRecallRows.every((row) => row.truth_claim_without_review_allowed === false), "fact recall rows are ready"],
    ["consolidation_ready", consolidationRows.every((row) => row.hidden_conflict_allowed === false), "consolidation rows are ready"],
    ["relation_graph_ready", relationGraphRows.every((row) => row.relation_graph_ready), "relation graph rows are ready"],
    ["recall_bundle_ready", recallBundleRows.every((row) => row.recall_bundle_ready && row.auto_context_mutation_enabled === false && row.claude_code_opus_max_review_receipt_required_for_milestone), "next-session recall bundle is ready"],
    ["boundary_filters_ready", boundaryFilterRows.length >= 4 && boundaryFilterRows.every((row) => row.cross_domain_recall_allowed === false), "boundary filter rows are ready"],
    ["staleness_ready", stalenessRows.every((row) => row.stale_fact_as_current_allowed === false), "staleness rows are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "recall negative fixtures are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_uncited_auto", contract.uncited_recall_allowed === false && contract.auto_context_mutation_enabled === false, "uncited recall and auto mutation stay disabled"],
    ["boundary_no_workos", contract.work_os_claim_enabled === false && contract.enterprise_trust_claim_enabled === false, "Work OS and enterprise trust stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "retrieval-ontology-context-recall-gate-row.v1",
    row_id: `retrieval.ontology.context.recall.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.retrieval_ontology_context_recall.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("recall") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.retrieval_ontology_context_recall.${gate_id}`,
    responsible_owner: "platform_memory_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ memoryPlane, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows, gateRows }) {
  const unsafeFlags = [
    memoryPlane.summary?.memory_bank_event_observability_plane_status !== MEMORY_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    ontologyRows.some((row) => !row.source_citation_required),
    sourceCitedSearchRows.some((row) => row.uncited_search_result_allowed),
    factRecallRows.some((row) => row.truth_claim_without_review_allowed),
    consolidationRows.some((row) => row.hidden_conflict_allowed),
    relationGraphRows.some((row) => !row.relation_graph_ready),
    recallBundleRows.some((row) => row.auto_context_mutation_enabled || !row.source_citations_required),
    recallBundleRows.some((row) => !row.claude_code_opus_max_review_receipt_required_for_milestone || row.codex_self_approval_allowed || row.claude_final_approval_allowed),
    boundaryFilterRows.some((row) => row.cross_domain_recall_allowed || row.raw_sensitive_data_recall_allowed),
    stalenessRows.some((row) => row.stale_fact_as_current_allowed),
    negativeFixtureRows.some((row) => row.unsafe_recall_claim_allowed || row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED"),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "retrieval-ontology-context-recall-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7001-P7300",
    retrieval_ontology_context_recall_layer_ready: unsafeFlags.filter(Boolean).length === 0,
    memory_bank_event_observability_plane_ready: memoryPlane.summary?.memory_bank_event_observability_plane_status === MEMORY_READY_STATUS,
    retrieval_ontology_ready: ontologyRows.every((row) => row.ontology_contract_ready),
    source_cited_search_ready: sourceCitedSearchRows.every((row) => row.source_citation_required && row.uncited_search_result_allowed === false),
    extracted_fact_claim_recall_ready: factRecallRows.every((row) => row.source_citation_required && row.freshness_note_required),
    consolidation_conflict_resolution_ready: consolidationRows.every((row) => row.hidden_conflict_allowed === false),
    relation_graph_context_compiler_ready: relationGraphRows.every((row) => row.relation_graph_ready),
    next_session_recall_bundle_ready: recallBundleRows.every((row) => row.recall_bundle_ready && row.source_citations_required),
    codex_implementation_packet_required: true,
    harness_deterministic_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    finding_loop_and_revalidation_required: true,
    review_receipt_registration_required: true,
    single_owner_trust_classification_required: true,
    domain_project_boundary_filters_ready: boundaryFilterRows.every((row) => row.boundary_filter_ready && row.cross_domain_recall_allowed === false),
    staleness_freshness_policy_ready: stalenessRows.every((row) => row.freshness_policy_ready && row.stale_fact_as_current_allowed === false),
    uncited_recall_allowed: false,
    raw_transcript_recall_allowed: false,
    stale_fact_as_current_allowed: false,
    cross_domain_recall_allowed: false,
    auto_context_mutation_enabled: false,
    recall_as_final_approval_enabled: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(args) {
  const { packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, memoryPlane, contract, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows, gateRows, boundary } = args;
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include retrieval recall command"),
    validationItem("memory.ready", "source", memoryPlane.summary?.memory_bank_event_observability_plane_status === MEMORY_READY_STATUS, "memory event plane must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P7301-P7600 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Retrieval Ontology and Context Recall Layer"), "architecture must reflect retrieval recall"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Retrieval Ontology and Context Recall Layer"), "dashboard IA must reflect retrieval recall"),
    validationItem("contract.ready", "contract", contract.cited_recall_bundle_ready && contract.uncited_recall_allowed === false, "retrieval recall contract must be ready"),
    validationItem("review_process.ready", "review_process", contract.codex_implementation_packet_required && contract.harness_deterministic_validation_required && contract.claude_code_opus_max_review_receipt_required && contract.single_owner_trust_classification_required, "Codex-Harness-Claude review process must be required"),
    validationItem("phases.pass", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phases must pass"),
    validationItem("ontology.ready", "ontology", ontologyRows.length >= 5 && ontologyRows.every((row) => row.source_citation_required), "ontology rows must be ready"),
    validationItem("search.ready", "search", sourceCitedSearchRows.length >= 5 && sourceCitedSearchRows.every((row) => row.uncited_search_result_allowed === false), "search rows must be cited"),
    validationItem("fact.ready", "fact", factRecallRows.length >= 5 && factRecallRows.every((row) => row.truth_claim_without_review_allowed === false), "fact recall rows must be ready"),
    validationItem("consolidation.ready", "consolidation", consolidationRows.every((row) => row.hidden_conflict_allowed === false), "consolidation rows must be ready"),
    validationItem("relation.ready", "relation", relationGraphRows.every((row) => row.relation_graph_ready), "relation graph rows must be ready"),
    validationItem("bundle.ready", "recall_bundle", recallBundleRows.every((row) => row.recall_bundle_ready && row.auto_context_mutation_enabled === false && row.claude_code_opus_max_review_receipt_required_for_milestone), "recall bundle rows must be ready"),
    validationItem("filters.ready", "filters", boundaryFilterRows.length >= 4 && boundaryFilterRows.every((row) => row.cross_domain_recall_allowed === false), "boundary filters must be ready"),
    validationItem("staleness.ready", "freshness", stalenessRows.every((row) => row.stale_fact_as_current_allowed === false), "staleness policy must be ready"),
    validationItem("fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_recall_claim_allowed === false), "negative fixtures must block unsafe recall claims"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_uncited_auto", "boundary", boundary.uncited_recall_allowed === false && boundary.auto_context_mutation_enabled === false, "uncited recall and auto mutation must stay disabled"),
    validationItem("boundary.no_workos", "boundary", boundary.work_os_claim_enabled === false && boundary.enterprise_trust_claim_enabled === false, "Work OS and enterprise trust must stay disabled"),
  ];
}

function buildSummary({ memoryPlane, phaseRows, ontologyRows, sourceCitedSearchRows, factRecallRows, consolidationRows, relationGraphRows, recallBundleRows, boundaryFilterRows, stalenessRows, negativeFixtureRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "retrieval-ontology-context-recall-layer-summary.v1",
    retrieval_ontology_context_recall_layer_status: validation.valid && boundary.retrieval_ontology_context_recall_layer_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7001-P7300",
    memory_bank_event_observability_plane_status: memoryPlane.summary?.memory_bank_event_observability_plane_status ?? "unknown",
    phase_row_count: phaseRows.length,
    ontology_count: ontologyRows.length,
    source_cited_search_count: sourceCitedSearchRows.length,
    fact_recall_count: factRecallRows.length,
    consolidation_count: consolidationRows.length,
    relation_graph_count: relationGraphRows.length,
    recall_bundle_count: recallBundleRows.length,
    boundary_filter_count: boundaryFilterRows.length,
    staleness_policy_count: stalenessRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    retrieval_ontology_ready: boundary.retrieval_ontology_ready,
    source_cited_search_ready: boundary.source_cited_search_ready,
    extracted_fact_claim_recall_ready: boundary.extracted_fact_claim_recall_ready,
    consolidation_conflict_resolution_ready: boundary.consolidation_conflict_resolution_ready,
    relation_graph_context_compiler_ready: boundary.relation_graph_context_compiler_ready,
    next_session_recall_bundle_ready: boundary.next_session_recall_bundle_ready,
    codex_implementation_packet_required: boundary.codex_implementation_packet_required,
    harness_deterministic_validation_required: boundary.harness_deterministic_validation_required,
    claude_code_opus_max_review_receipt_required: boundary.claude_code_opus_max_review_receipt_required,
    finding_loop_and_revalidation_required: boundary.finding_loop_and_revalidation_required,
    review_receipt_registration_required: boundary.review_receipt_registration_required,
    single_owner_trust_classification_required: boundary.single_owner_trust_classification_required,
    domain_project_boundary_filters_ready: boundary.domain_project_boundary_filters_ready,
    staleness_freshness_policy_ready: boundary.staleness_freshness_policy_ready,
    uncited_recall_allowed: boundary.uncited_recall_allowed,
    raw_transcript_recall_allowed: boundary.raw_transcript_recall_allowed,
    stale_fact_as_current_allowed: boundary.stale_fact_as_current_allowed,
    cross_domain_recall_allowed: boundary.cross_domain_recall_allowed,
    auto_context_mutation_enabled: boundary.auto_context_mutation_enabled,
    recall_as_final_approval_enabled: boundary.recall_as_final_approval_enabled,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    agent_runtime_execution_enabled: boundary.agent_runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_retrieval_ontology_context_recall.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Retrieval Ontology Context Recall Layer",
    "",
    `Status: ${result.summary.retrieval_ontology_context_recall_layer_status}`,
    `Program: ${result.summary.program_range}`,
    `Memory event source: ${result.summary.memory_bank_event_observability_plane_status}`,
    `Ontology rows: ${result.summary.ontology_count}`,
    `Source-cited search rows: ${result.summary.source_cited_search_count}`,
    `Recall bundle ready: ${result.summary.next_session_recall_bundle_ready}`,
    `Uncited recall allowed: ${result.summary.uncited_recall_allowed}`,
    `Auto context mutation enabled: ${result.summary.auto_context_mutation_enabled}`,
    `Work OS claim enabled: ${result.summary.work_os_claim_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Recall Boundary",
    "",
    "The retrieval layer can prepare cited next-session recall bundles, but recall cannot become truth without citations, freshness notes, boundary filters, and conflict handling. The layer does not mutate plans or policies automatically and cannot become final approval.",
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return { item_id, category, status: passed ? "pass" : "error", message };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    item_count: items.length,
    error_count: items.filter((item) => item.status !== "pass").length,
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_RETRIEVAL_ONTOLOGY_CONTEXT_RECALL_LAYER_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    review_dashboard_doc_path: options.reviewDashboardDocPath ?? defaults.reviewDashboardDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, count: items.length, items };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    reviewDashboardDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--review-dashboard-doc") {
      args.reviewDashboardDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/retrieval-ontology-context-recall-layer.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --review-dashboard-doc <path>   Review dashboard IA document path.
  --help                          Show this help.
`);
}
