import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LINEAGE_GRAPH_OUT_DIR = "artifacts/lineage-graph/latest";
export const DEFAULT_LINEAGE_GRAPH_INPUTS = {
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  factClaimStorePath: "artifacts/fact-claim-store/latest/fact-claim-store.json",
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const LINEAGE_GRAPH_CONTRACT_ID = "lineage-graph-builder.v1";
const LINEAGE_NODE_SCHEMA_VERSION = "lineage-node.v1";
const LINEAGE_EDGE_SCHEMA_VERSION = "lineage-edge.v1";
const LINEAGE_PATH_SCHEMA_VERSION = "lineage-path.v1";
const PATH_EDGE_TYPES = [
  "source_span_supports_evidence",
  "evidence_supports_fact",
  "fact_raises_issue",
  "issue_drafts_output",
  "source_span_cited_by_output",
];

export async function runLineageGraphBuilder(options = {}) {
  const result = await buildLineageGraphBuilder(options);
  if (options.write !== false) await writeLineageGraphBuilder(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Lineage graph builder failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLineageGraphBuilder(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LINEAGE_GRAPH_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceSpanStore = await readJson(inputs.source_span_store_path);
  const evidenceItemStore = await readJson(inputs.evidence_item_store_path);
  const factClaimStore = await readJson(inputs.fact_claim_store_path);
  const issueGraphStore = await readJson(inputs.issue_graph_store_path);
  const citationObjectStore = await readJson(inputs.citation_object_store_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);

  const catalogs = buildCatalogLookups({
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
  });
  const graph = buildLineageGraph(catalogs, generatedAt);
  const validationItems = validateLineageGraphBuilder({
    packageText,
    roadmapText,
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
    catalogs,
    graph,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeGraph({
    sourceSpanStore,
    evidenceItemStore,
    factClaimStore,
    issueGraphStore,
    citationObjectStore,
    graph,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "lineage-graph-builder.v1",
    generated_at: generatedAt,
    lineage_graph_id: `lineage-graph.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      summarizeSource("source_span_store", sourceSpanStore),
      summarizeSource("evidence_item_store", evidenceItemStore),
      summarizeSource("fact_claim_store", factClaimStore),
      summarizeSource("issue_graph_store", issueGraphStore),
      summarizeSource("citation_object_store", citationObjectStore),
    ],
    lineage_graph_contract: buildGraphContract(generatedAt),
    lineage_graph_catalog: {
      schema_version: "lineage-graph-catalog.v1",
      generated_at: generatedAt,
      lineage_nodes: graph.lineageNodes,
      lineage_edges: graph.lineageEdges,
      lineage_paths: graph.lineagePaths,
      lineage_indexes: graph.lineageIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLineageGraphMarkdown(result),
  };
}

export async function writeLineageGraphBuilder(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableGraph(result);
  await writeJson(path.join(outDir, "lineage-graph.json"), serializable);
  await writeJson(path.join(outDir, "lineage-nodes.json"), {
    schema_version: "lineage-nodes.v1",
    generated_at: result.generated_at,
    lineage_node_count: result.lineage_graph_catalog.lineage_nodes.length,
    lineage_nodes: result.lineage_graph_catalog.lineage_nodes,
  });
  await writeJson(path.join(outDir, "lineage-edges.json"), {
    schema_version: "lineage-edges.v1",
    generated_at: result.generated_at,
    lineage_edge_count: result.lineage_graph_catalog.lineage_edges.length,
    lineage_edges: result.lineage_graph_catalog.lineage_edges,
  });
  await writeJson(path.join(outDir, "lineage-paths.json"), {
    schema_version: "lineage-paths.v1",
    generated_at: result.generated_at,
    lineage_path_count: result.lineage_graph_catalog.lineage_paths.length,
    lineage_paths: result.lineage_graph_catalog.lineage_paths,
  });
  await writeJson(path.join(outDir, "lineage-indexes.json"), {
    schema_version: "lineage-indexes.v1",
    generated_at: result.generated_at,
    lineage_indexes: result.lineage_graph_catalog.lineage_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    lineage_graph_id: result.lineage_graph_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLineageGraphBuilderCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLineageGraphBuilder(args);
    console.log(`Lineage graph written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.lineage_graph_status}`);
    console.log(`Nodes: ${result.summary.lineage_node_count}`);
    console.log(`Edges: ${result.summary.lineage_edge_count}`);
    console.log(`Paths: ${result.summary.lineage_path_count}`);
    console.log(`Complete paths: ${result.summary.complete_lineage_path_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildGraphContract(generatedAt) {
  return {
    schema_version: "lineage-graph-contract.v1",
    lineage_graph_contract_id: LINEAGE_GRAPH_CONTRACT_ID,
    generated_at: generatedAt,
    lineage_node_schema_version: LINEAGE_NODE_SCHEMA_VERSION,
    lineage_edge_schema_version: LINEAGE_EDGE_SCHEMA_VERSION,
    lineage_path_schema_version: LINEAGE_PATH_SCHEMA_VERSION,
    source_inputs: ["source-span-store.v1", "evidence-item-store.v1", "fact-claim-store.v1", "issue-graph-store.v1", "citation-object-store.v1"],
    required_path_order: ["source_span", "evidence_item", "fact_claim", "issue", "output_paragraph"],
    required_identity_fields: ["tenant_id", "matter_id", "classification", "policy_snapshot_id"],
    path_rule: "each_citation_object_must_reconstruct_a_source_to_output_lineage_path",
    edge_rule: "each_complete_path_has_source_evidence_fact_issue_output_edges_and_a_direct_citation_edge",
    output_rule: "lineage_paths_remain_review_pending_and_not_client_facing_until_human_approval",
  };
}

function buildCatalogLookups({ sourceSpanStore, evidenceItemStore, factClaimStore, issueGraphStore, citationObjectStore }) {
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const evidenceItems = evidenceItemStore.evidence_item_catalog?.evidence_items ?? [];
  const factClaims = factClaimStore.fact_claim_catalog?.fact_claims ?? [];
  const issues = issueGraphStore.issue_graph_catalog?.issues ?? [];
  const outputParagraphs = citationObjectStore.citation_catalog?.output_paragraphs ?? [];
  const citations = citationObjectStore.citation_catalog?.citations ?? [];
  const paragraphSourceBindings = citationObjectStore.citation_catalog?.paragraph_source_bindings ?? [];
  return {
    sourceSpans,
    evidenceItems,
    factClaims,
    issues,
    outputParagraphs,
    citations,
    paragraphSourceBindings,
    sourceSpanById: indexBy(sourceSpans, "source_span_id"),
    evidenceById: indexBy(evidenceItems, "evidence_id"),
    factById: indexBy(factClaims, "fact_id"),
    issueById: indexBy(issues, "issue_id"),
    outputById: indexBy(outputParagraphs, "output_paragraph_id"),
    bindingByCitationId: indexBy(paragraphSourceBindings, "citation_id"),
  };
}

function buildLineageGraph(catalogs, generatedAt) {
  const nodeBySubjectKey = new Map();
  const edgeById = new Map();
  const lineagePaths = [];

  for (const citation of catalogs.citations) {
    const source = catalogs.sourceSpanById.get(citation.source_span_id);
    const evidence = catalogs.evidenceById.get(citation.evidence_item_id);
    const fact = catalogs.factById.get(citation.fact_id);
    const issue = catalogs.issueById.get(citation.issue_id);
    const output = catalogs.outputById.get(citation.output_paragraph_id);
    const binding = catalogs.bindingByCitationId.get(citation.citation_id);
    const sourceNode = upsertNode(nodeBySubjectKey, "source_span", citation.source_span_id, source, generatedAt);
    const evidenceNode = upsertNode(nodeBySubjectKey, "evidence_item", citation.evidence_item_id, evidence, generatedAt);
    const factNode = upsertNode(nodeBySubjectKey, "fact_claim", citation.fact_id, fact, generatedAt);
    const issueNode = upsertNode(nodeBySubjectKey, "issue", citation.issue_id, issue, generatedAt);
    const outputNode = upsertNode(nodeBySubjectKey, "output_paragraph", citation.output_paragraph_id, output, generatedAt);
    const lineagePathId = `lineage-path.${slugify(citation.citation_id)}`;
    const missingRefIds = missingRefs({
      source_span: source,
      evidence_item: evidence,
      fact_claim: fact,
      issue,
      output_paragraph: output,
      paragraph_source_binding: binding,
    });
    const edgeInputs = [
      edgeInput(lineagePathId, citation, sourceNode, evidenceNode, "source_span_supports_evidence", source, evidence),
      edgeInput(lineagePathId, citation, evidenceNode, factNode, "evidence_supports_fact", evidence, fact),
      edgeInput(lineagePathId, citation, factNode, issueNode, "fact_raises_issue", fact, issue),
      edgeInput(lineagePathId, citation, issueNode, outputNode, "issue_drafts_output", issue, output),
      edgeInput(lineagePathId, citation, sourceNode, outputNode, "source_span_cited_by_output", source, output),
    ];
    for (const input of edgeInputs) {
      if (!edgeById.has(input.lineage_edge_id)) edgeById.set(input.lineage_edge_id, buildEdge(input, generatedAt));
    }
    const edgeIds = edgeInputs.map((input) => input.lineage_edge_id);
    lineagePaths.push(buildLineagePath({
      citation,
      binding,
      source,
      evidence,
      fact,
      issue,
      output,
      nodes: [sourceNode, evidenceNode, factNode, issueNode, outputNode],
      edgeIds,
      missingRefIds,
      lineagePathId,
      generatedAt,
    }));
  }

  const lineageNodes = [...nodeBySubjectKey.values()].sort((a, b) => a.lineage_node_id.localeCompare(b.lineage_node_id));
  const lineageEdges = [...edgeById.values()].sort((a, b) => a.lineage_edge_id.localeCompare(b.lineage_edge_id));
  return {
    lineageNodes,
    lineageEdges,
    lineagePaths,
    lineageIndexes: buildLineageIndexes(lineageNodes, lineageEdges, lineagePaths, generatedAt),
  };
}

function upsertNode(nodeBySubjectKey, nodeType, subjectId, sourceObject, generatedAt) {
  const key = `${nodeType}:${subjectId ?? "unknown"}`;
  if (nodeBySubjectKey.has(key)) return nodeBySubjectKey.get(key);
  const node = {
    schema_version: LINEAGE_NODE_SCHEMA_VERSION,
    lineage_node_id: `lineage-node.${slugify(nodeType)}.${slugify(subjectId)}`,
    node_type: nodeType,
    subject_id: subjectId ?? null,
    label: nodeLabel(nodeType, sourceObject, subjectId),
    tenant_id: sourceObject?.tenant_id ?? null,
    matter_id: sourceObject?.matter_id ?? null,
    classification: sourceObject?.classification ?? null,
    policy_snapshot_id: sourceObject?.policy_snapshot_id ?? null,
    source_schema_version: sourceObject?.schema_version ?? null,
    review_status: sourceObject?.review_status ?? sourceObject?.citation_status ?? "unknown",
    node_status: sourceObject ? "resolved" : "missing",
    created_at: generatedAt,
    metadata: nodeMetadata(nodeType, sourceObject),
  };
  nodeBySubjectKey.set(key, node);
  return node;
}

function buildEdge(input, generatedAt) {
  return {
    schema_version: LINEAGE_EDGE_SCHEMA_VERSION,
    lineage_edge_id: input.lineage_edge_id,
    lineage_path_id: input.lineage_path_id,
    citation_id: input.citation.citation_id,
    edge_type: input.edgeType,
    relation: input.edgeType,
    from_node_id: input.fromNode.lineage_node_id,
    to_node_id: input.toNode.lineage_node_id,
    from_subject_id: input.fromNode.subject_id,
    to_subject_id: input.toNode.subject_id,
    tenant_id: input.citation.tenant_id,
    matter_id: input.citation.matter_id,
    classification: input.citation.classification,
    policy_snapshot_id: input.citation.policy_snapshot_id,
    edge_status: input.fromObject && input.toObject ? "complete" : "broken",
    created_at: generatedAt,
    metadata: {
      from_node_type: input.fromNode.node_type,
      to_node_type: input.toNode.node_type,
      client_facing_ready: input.citation.client_facing_ready,
      citation_status: input.citation.citation_status,
    },
  };
}

function buildLineagePath({ citation, binding, source, evidence, fact, issue, output, nodes, edgeIds, missingRefIds, lineagePathId, generatedAt }) {
  const pathStatus = missingRefIds.length === 0 && citation.source_binding_status === "bound" && binding?.binding_status === "bound" ? "complete" : "broken";
  return {
    schema_version: LINEAGE_PATH_SCHEMA_VERSION,
    lineage_path_id: lineagePathId,
    citation_id: citation.citation_id,
    paragraph_source_binding_id: binding?.paragraph_source_binding_id ?? null,
    source_span_id: citation.source_span_id,
    evidence_item_id: citation.evidence_item_id,
    fact_id: citation.fact_id,
    issue_id: citation.issue_id,
    output_paragraph_id: citation.output_paragraph_id,
    node_ids: nodes.map((node) => node.lineage_node_id),
    edge_ids: edgeIds,
    path_order: ["source_span", "evidence_item", "fact_claim", "issue", "output_paragraph"],
    path_status: pathStatus,
    missing_ref_ids: missingRefIds,
    tenant_id: citation.tenant_id,
    matter_id: citation.matter_id,
    classification: citation.classification,
    policy_snapshot_id: citation.policy_snapshot_id,
    matter_preserved: sameField("matter_id", citation.matter_id, [source, evidence, fact, issue, output]),
    classification_preserved: sameField("classification", citation.classification, [source, evidence, fact, issue, output]),
    policy_snapshot_preserved: sameField("policy_snapshot_id", citation.policy_snapshot_id, [source, evidence, fact, issue, output]),
    review_status: citation.citation_status,
    output_client_facing_status: output?.client_facing_status ?? null,
    client_facing_ready: citation.client_facing_ready === true || output?.client_facing_status !== "not_client_facing",
    created_at: generatedAt,
    metadata: {
      source_binding_status: citation.source_binding_status,
      paragraph_binding_status: binding?.binding_status ?? "missing",
      issue_type: output?.metadata?.issue_type ?? citation.metadata?.issue_type ?? null,
      risk_severity: output?.metadata?.risk_severity ?? citation.metadata?.risk_severity ?? null,
    },
  };
}

function buildLineageIndexes(lineageNodes, lineageEdges, lineagePaths, generatedAt) {
  return {
    schema_version: "lineage-indexes.v1",
    generated_at: generatedAt,
    by_node_type: countBy(lineageNodes, "node_type"),
    by_edge_type: countBy(lineageEdges, "edge_type"),
    by_path_status: countBy(lineagePaths, "path_status"),
    by_matter_id: countBy(lineagePaths, "matter_id"),
    by_classification: countBy(lineagePaths, "classification"),
    by_review_status: countBy(lineagePaths, "review_status"),
    by_output_client_facing_status: countBy(lineagePaths, "output_client_facing_status"),
    by_client_facing_ready: countBy(lineagePaths, "client_facing_ready"),
  };
}

function validateLineageGraphBuilder({
  packageText,
  roadmapText,
  sourceSpanStore,
  evidenceItemStore,
  factClaimStore,
  issueGraphStore,
  citationObjectStore,
  catalogs,
  graph,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const edgeById = new Map(graph.lineageEdges.map((edge) => [edge.lineage_edge_id, edge]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:lineage-graph"]), "package.json must expose resource:lineage-graph.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 143: Lineage Graph Builder"), "Implementation roadmap must document Phase 143.");
  pushCheck(validationItems, "source", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store must be complete.");
  pushCheck(validationItems, "source", "evidence_item_store_complete", evidenceItemStore.summary?.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(validationItems, "source", "fact_claim_store_complete", factClaimStore.summary?.fact_claim_store_status === "complete", "Fact Claim Store must be complete.");
  pushCheck(validationItems, "source", "issue_graph_store_complete", issueGraphStore.summary?.issue_graph_store_status === "complete", "Issue Graph Store must be complete.");
  pushCheck(validationItems, "source", "citation_object_store_complete", citationObjectStore.summary?.citation_object_store_status === "complete", "Citation Object Store must be complete.");
  pushCheck(validationItems, "catalog", "citations_present", catalogs.citations.length > 0, "At least one citation object is required.");
  pushCheck(validationItems, "catalog", "paths_present", graph.lineagePaths.length > 0, "At least one lineage path must be materialized.");
  pushCheck(validationItems, "catalog", "path_count_matches_citations", graph.lineagePaths.length === catalogs.citations.length, "Every citation must produce one lineage path.");
  pushCheck(validationItems, "catalog", "edge_count_matches_paths", graph.lineageEdges.length === graph.lineagePaths.length * PATH_EDGE_TYPES.length, "Every lineage path must produce the canonical five edges.");
  pushCheck(validationItems, "catalog", "node_types_present", hasAllNodeTypes(graph.lineageNodes), "Lineage graph must include source, evidence, fact, issue, and output nodes.");

  for (const node of graph.lineageNodes) {
    pushCheck(validationItems, `nodes.${node.lineage_node_id}`, "schema_version_canonical", node.schema_version === LINEAGE_NODE_SCHEMA_VERSION, "Lineage node must use lineage-node.v1.");
    pushCheck(validationItems, `nodes.${node.lineage_node_id}`, "node_resolved", node.node_status === "resolved", "Lineage node must resolve to a source store object.");
  }

  for (const edge of graph.lineageEdges) {
    pushCheck(validationItems, `edges.${edge.lineage_edge_id}`, "schema_version_canonical", edge.schema_version === LINEAGE_EDGE_SCHEMA_VERSION, "Lineage edge must use lineage-edge.v1.");
    pushCheck(validationItems, `edges.${edge.lineage_edge_id}`, "edge_type_canonical", PATH_EDGE_TYPES.includes(edge.edge_type), "Lineage edge type must be canonical.");
    pushCheck(validationItems, `edges.${edge.lineage_edge_id}`, "edge_complete", edge.edge_status === "complete", "Lineage edge must be complete.");
  }

  for (const lineagePath of graph.lineagePaths) {
    const pathPrefix = `paths.${lineagePath.lineage_path_id}`;
    const edgeRows = lineagePath.edge_ids.map((edgeId) => edgeById.get(edgeId));
    pushCheck(validationItems, pathPrefix, "schema_version_canonical", lineagePath.schema_version === LINEAGE_PATH_SCHEMA_VERSION, "Lineage path must use lineage-path.v1.");
    pushCheck(validationItems, pathPrefix, "path_complete", lineagePath.path_status === "complete" && lineagePath.missing_ref_ids.length === 0, "Lineage path must be complete.");
    pushCheck(validationItems, pathPrefix, "canonical_path_order", arrayEqual(lineagePath.path_order, ["source_span", "evidence_item", "fact_claim", "issue", "output_paragraph"]), "Lineage path order must be source -> evidence -> fact -> issue -> output.");
    pushCheck(validationItems, pathPrefix, "edge_ids_resolve", edgeRows.length === PATH_EDGE_TYPES.length && edgeRows.every(Boolean), "Lineage path edge ids must resolve.");
    pushCheck(validationItems, pathPrefix, "edge_types_complete", PATH_EDGE_TYPES.every((edgeType) => edgeRows.some((edge) => edge?.edge_type === edgeType)), "Lineage path must include every canonical edge type.");
    pushCheck(validationItems, pathPrefix, "source_resolves", Boolean(catalogs.sourceSpanById.get(lineagePath.source_span_id)), "Lineage path source span must resolve.");
    pushCheck(validationItems, pathPrefix, "evidence_resolves", Boolean(catalogs.evidenceById.get(lineagePath.evidence_item_id)), "Lineage path evidence item must resolve.");
    pushCheck(validationItems, pathPrefix, "fact_resolves", Boolean(catalogs.factById.get(lineagePath.fact_id)), "Lineage path fact claim must resolve.");
    pushCheck(validationItems, pathPrefix, "issue_resolves", Boolean(catalogs.issueById.get(lineagePath.issue_id)), "Lineage path issue must resolve.");
    pushCheck(validationItems, pathPrefix, "output_resolves", Boolean(catalogs.outputById.get(lineagePath.output_paragraph_id)), "Lineage path output paragraph must resolve.");
    pushCheck(validationItems, pathPrefix, "matter_preserved", lineagePath.matter_preserved === true, "Lineage path must preserve matter_id.");
    pushCheck(validationItems, pathPrefix, "classification_preserved", lineagePath.classification_preserved === true, "Lineage path must preserve classification.");
    pushCheck(validationItems, pathPrefix, "policy_snapshot_preserved", lineagePath.policy_snapshot_preserved === true, "Lineage path must preserve policy snapshot.");
    pushCheck(validationItems, pathPrefix, "not_client_facing", lineagePath.output_client_facing_status === "not_client_facing" && lineagePath.client_facing_ready === false, "Lineage path must stay not client-facing.");
    pushCheck(validationItems, pathPrefix, "review_pending", lineagePath.review_status === "needs_review", "Lineage path must remain pending review.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `lineage-graph-validation.${slugify(pathLabel)}.${checkId}`,
    path: pathLabel,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
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

function summarizeGraph({ sourceSpanStore, evidenceItemStore, factClaimStore, issueGraphStore, citationObjectStore, graph, validationItems, validation }) {
  const paths = graph.lineagePaths;
  const nodesByType = countBy(graph.lineageNodes, "node_type");
  return {
    lineage_graph_status: validation.valid ? "complete" : "blocked",
    lineage_graph_contract_id: LINEAGE_GRAPH_CONTRACT_ID,
    lineage_node_schema_version: LINEAGE_NODE_SCHEMA_VERSION,
    lineage_edge_schema_version: LINEAGE_EDGE_SCHEMA_VERSION,
    lineage_path_schema_version: LINEAGE_PATH_SCHEMA_VERSION,
    source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    evidence_item_store_status: evidenceItemStore.summary?.evidence_item_store_status ?? "unknown",
    fact_claim_store_status: factClaimStore.summary?.fact_claim_store_status ?? "unknown",
    issue_graph_store_status: issueGraphStore.summary?.issue_graph_store_status ?? "unknown",
    citation_object_store_status: citationObjectStore.summary?.citation_object_store_status ?? "unknown",
    citation_count: citationObjectStore.summary?.citation_count ?? 0,
    by_node_type: graph.lineageIndexes.by_node_type,
    by_edge_type: graph.lineageIndexes.by_edge_type,
    lineage_node_count: graph.lineageNodes.length,
    source_span_node_count: nodesByType.source_span ?? 0,
    evidence_item_node_count: nodesByType.evidence_item ?? 0,
    fact_claim_node_count: nodesByType.fact_claim ?? 0,
    issue_node_count: nodesByType.issue ?? 0,
    output_paragraph_node_count: nodesByType.output_paragraph ?? 0,
    lineage_edge_count: graph.lineageEdges.length,
    expected_lineage_edge_count: paths.length * PATH_EDGE_TYPES.length,
    lineage_path_count: paths.length,
    complete_lineage_path_count: paths.filter((lineagePath) => lineagePath.path_status === "complete").length,
    broken_lineage_path_count: paths.filter((lineagePath) => lineagePath.path_status !== "complete").length,
    source_to_output_path_count: paths.filter((lineagePath) => lineagePath.path_status === "complete").length,
    citation_bound_lineage_count: paths.filter((lineagePath) => lineagePath.metadata.source_binding_status === "bound" && lineagePath.metadata.paragraph_binding_status === "bound").length,
    matter_preserved_path_count: paths.filter((lineagePath) => lineagePath.matter_preserved).length,
    classification_preserved_path_count: paths.filter((lineagePath) => lineagePath.classification_preserved).length,
    policy_snapshot_preserved_path_count: paths.filter((lineagePath) => lineagePath.policy_snapshot_preserved).length,
    needs_review_path_count: paths.filter((lineagePath) => lineagePath.review_status === "needs_review").length,
    not_client_facing_output_path_count: paths.filter((lineagePath) => lineagePath.output_client_facing_status === "not_client_facing").length,
    client_facing_ready_path_count: paths.filter((lineagePath) => lineagePath.client_facing_ready === true).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(paths, "matter_id"),
    by_classification: countBy(paths, "classification"),
    by_path_status: countBy(paths, "path_status"),
    by_review_status: countBy(paths, "review_status"),
    by_output_client_facing_status: countBy(paths, "output_client_facing_status"),
    by_client_facing_ready: countBy(paths, "client_facing_ready"),
  };
}

function renderLineageGraphMarkdown(result) {
  const lines = [];
  lines.push("# Lineage Graph Builder");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.lineage_graph_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.lineage_graph_contract_id}`);
  lines.push(`- Nodes: ${result.summary.lineage_node_count}`);
  lines.push(`- Edges: ${result.summary.lineage_edge_count}`);
  lines.push(`- Paths: ${result.summary.lineage_path_count}`);
  lines.push(`- Complete paths: ${result.summary.complete_lineage_path_count}`);
  lines.push(`- Broken paths: ${result.summary.broken_lineage_path_count}`);
  lines.push(`- Source-to-output paths: ${result.summary.source_to_output_path_count}`);
  lines.push(`- Needs review paths: ${result.summary.needs_review_path_count}`);
  lines.push(`- Client-facing ready paths: ${result.summary.client_facing_ready_path_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function edgeInput(lineagePathId, citation, fromNode, toNode, edgeType, fromObject, toObject) {
  return {
    lineage_edge_id: `lineage-edge.${slugify(citation.citation_id)}.${slugify(edgeType)}`,
    lineage_path_id: lineagePathId,
    citation,
    fromNode,
    toNode,
    edgeType,
    fromObject,
    toObject,
  };
}

function missingRefs(refs) {
  return Object.entries(refs)
    .filter(([, value]) => !value)
    .map(([key]) => key);
}

function sameField(fieldName, expected, objects) {
  return objects.every((object) => object && object[fieldName] !== undefined)
    ? objects.every((object) => object[fieldName] === expected)
    : false;
}

function hasAllNodeTypes(nodes) {
  const types = new Set(nodes.map((node) => node.node_type));
  return ["source_span", "evidence_item", "fact_claim", "issue", "output_paragraph"].every((nodeType) => types.has(nodeType));
}

function arrayEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function nodeLabel(nodeType, sourceObject, subjectId) {
  if (nodeType === "source_span") return sourceObject?.source_span_id ?? subjectId ?? "source span";
  if (nodeType === "evidence_item") return sourceObject?.summary ?? sourceObject?.evidence_id ?? subjectId ?? "evidence item";
  if (nodeType === "fact_claim") return sourceObject?.statement ?? sourceObject?.fact_id ?? subjectId ?? "fact claim";
  if (nodeType === "issue") return sourceObject?.title ?? sourceObject?.issue_id ?? subjectId ?? "issue";
  if (nodeType === "output_paragraph") return sourceObject?.paragraph_text ?? sourceObject?.output_paragraph_id ?? subjectId ?? "output paragraph";
  return subjectId ?? nodeType;
}

function nodeMetadata(nodeType, sourceObject) {
  if (!sourceObject) return {};
  if (nodeType === "source_span") {
    return {
      resource_id: sourceObject.resource_id ?? null,
      resource_version_id: sourceObject.resource_version_id ?? null,
      location_type: sourceObject.location_type ?? null,
      locator_status: sourceObject.locator_status ?? null,
    };
  }
  if (nodeType === "evidence_item") {
    return {
      evidence_type: sourceObject.evidence_type ?? null,
      reliability: sourceObject.reliability ?? null,
      source_span_ids: sourceObject.source_span_ids ?? [],
    };
  }
  if (nodeType === "fact_claim") {
    return {
      fact_type: sourceObject.fact_type ?? null,
      reliability: sourceObject.reliability ?? null,
      evidence_item_ids: sourceObject.evidence_item_ids ?? [],
    };
  }
  if (nodeType === "issue") {
    return {
      issue_type: sourceObject.issue_type ?? null,
      risk_severity: sourceObject.risk_severity ?? null,
      linked_fact_ids: sourceObject.linked_fact_ids ?? [],
    };
  }
  if (nodeType === "output_paragraph") {
    return {
      paragraph_type: sourceObject.paragraph_type ?? null,
      client_facing_status: sourceObject.client_facing_status ?? null,
      citation_ids: sourceObject.citation_ids ?? [],
    };
  }
  return {};
}

function normalizeInputs(options) {
  return {
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_LINEAGE_GRAPH_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_LINEAGE_GRAPH_INPUTS.evidenceItemStorePath),
    fact_claim_store_path: path.resolve(options.factClaimStorePath ?? DEFAULT_LINEAGE_GRAPH_INPUTS.factClaimStorePath),
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_LINEAGE_GRAPH_INPUTS.issueGraphStorePath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_LINEAGE_GRAPH_INPUTS.citationObjectStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_LINEAGE_GRAPH_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_LINEAGE_GRAPH_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--fact-claim-store") parsed.factClaimStorePath = argv[++index];
    else if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--citation-object-store") parsed.citationObjectStorePath = argv[++index];
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
  console.log(`Usage: node scripts/lineage-graph-builder.mjs [options]

Options:
  --source-span-store <path>          source-span-store.json path.
  --evidence-item-store <path>        evidence-item-store.json path.
  --fact-claim-store <path>           fact-claim-store.json path.
  --issue-graph-store <path>          issue-graph-store.json path.
  --citation-object-store <path>      citation-object-store.json path.
  --out-dir <path>                    Output directory.
  --run-at <iso>                      Deterministic generated_at timestamp.
  --check                             Exit non-zero when validation fails.
  --no-write                          Build without writing artifacts.
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

function serializableGraph(result) {
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

function countBy(items, key) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[key] ?? "unknown";
      counts.set(value, (counts.get(value) ?? 0) + 1);
      return counts;
    }, new Map()).entries()].sort(([a], [b]) => String(a).localeCompare(String(b))),
  );
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
