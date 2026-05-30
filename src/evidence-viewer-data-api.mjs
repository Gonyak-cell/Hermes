import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_VIEWER_DATA_API_OUT_DIR = "artifacts/evidence-viewer-data-api/latest";
export const DEFAULT_EVIDENCE_VIEWER_DATA_API_INPUTS = {
  sourceSpanStorePath: "artifacts/source-span-store/latest/source-span-store.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  lineageGraphPath: "artifacts/lineage-graph/latest/lineage-graph.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const EVIDENCE_VIEWER_DATA_CONTRACT_ID = "evidence-viewer-data-api.v1";

export async function runEvidenceViewerDataApi(options = {}) {
  const result = await buildEvidenceViewerDataApi(options);
  if (options.write !== false) await writeEvidenceViewerDataApi(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence viewer data API failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceViewerDataApi(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_VIEWER_DATA_API_OUT_DIR);
  const inputs = normalizeInputs(options);
  const [
    sourceSpanStore,
    evidenceItemStore,
    lineageGraph,
    packageText,
    roadmapText,
  ] = await Promise.all([
    readJson(inputs.source_span_store_path),
    readJson(inputs.evidence_item_store_path),
    readJson(inputs.lineage_graph_path),
    readText(inputs.package_path),
    readText(inputs.roadmap_path),
  ]);

  const projection = buildEvidenceViewerDataProjection({
    sourceSpanStore,
    evidenceItemStore,
    lineageGraph,
    generatedAt,
    outputDir,
    inputs,
  });
  const validationItems = validateEvidenceViewerDataApi({
    projection,
    sourceSpanStore,
    evidenceItemStore,
    lineageGraph,
    packageText,
    roadmapText,
  });
  const validation = buildValidation(validationItems);
  const summary = buildSummary({
    projection,
    sourceSpanStore,
    evidenceItemStore,
    lineageGraph,
    validation,
    validationItems,
  });
  const result = {
    ...projection,
    summary,
    validation_items: validationItems,
    validation,
  };
  return {
    ...result,
    markdown: renderEvidenceViewerDataApiMarkdown(result),
  };
}

export function buildEvidenceViewerDataProjection({
  sourceSpanStore,
  evidenceItemStore,
  lineageGraph,
  generatedAt,
  outputDir,
  inputs = {},
}) {
  const sourceSpans = sourceSpanStore.source_span_catalog?.source_spans ?? [];
  const evidenceItems = evidenceItemStore.evidence_item_catalog?.evidence_items ?? [];
  const sourceSpanBindings = evidenceItemStore.evidence_item_catalog?.source_span_bindings ?? [];
  const reviewQueueItems = evidenceItemStore.evidence_item_catalog?.review_queue_items ?? [];
  const lineageNodes = lineageGraph.lineage_graph_catalog?.lineage_nodes ?? [];
  const lineageEdges = lineageGraph.lineage_graph_catalog?.lineage_edges ?? [];
  const lineagePaths = lineageGraph.lineage_graph_catalog?.lineage_paths ?? [];

  const sourceSpanById = new Map(sourceSpans.map((span) => [span.source_span_id, span]));
  const evidenceById = new Map(evidenceItems.map((item) => [item.evidence_id, item]));
  const reviewQueueByEvidenceId = new Map(reviewQueueItems.map((item) => [item.evidence_id, item]));
  const nodeById = new Map(lineageNodes.map((node) => [node.lineage_node_id, node]));
  const edgeById = new Map(lineageEdges.map((edge) => [edge.lineage_edge_id, edge]));
  const bindingsBySourceSpanId = groupBy(sourceSpanBindings, "source_span_id");
  const pathsByEvidenceId = groupBy(lineagePaths, "evidence_item_id");
  const pathsBySourceSpanId = groupBy(lineagePaths, "source_span_id");

  const viewerCards = evidenceItems.map((evidenceItem) => buildViewerCard({
    evidenceItem,
    sourceSpanById,
    reviewQueueByEvidenceId,
    pathsByEvidenceId,
    nodeById,
    edgeById,
    generatedAt,
  })).sort(by("viewer_card_id"));

  const sourceSpanPanels = sourceSpans.map((sourceSpan) => buildSourceSpanPanel({
    sourceSpan,
    bindings: bindingsBySourceSpanId.get(sourceSpan.source_span_id) ?? [],
    evidenceById,
    lineagePaths: pathsBySourceSpanId.get(sourceSpan.source_span_id) ?? [],
    generatedAt,
  })).sort(by("source_span_panel_id"));

  const lineagePathPanels = lineagePaths.map((lineagePath) => buildLineagePathPanel({
    lineagePath,
    evidenceItem: evidenceById.get(lineagePath.evidence_item_id),
    sourceSpan: sourceSpanById.get(lineagePath.source_span_id),
    nodeById,
    edgeById,
    generatedAt,
  })).sort(by("lineage_path_panel_id"));

  return {
    schema_version: "evidence-viewer-data-api.v1",
    generated_at: generatedAt,
    evidence_viewer_data_api_id: `evidence-viewer-data-api.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_stores: [
      sourceSummary("source_span_store", sourceSpanStore),
      sourceSummary("evidence_item_store", evidenceItemStore),
      sourceSummary("lineage_graph_builder", lineageGraph),
    ],
    evidence_viewer_data_contract: buildDataContract(generatedAt),
    evidence_viewer_data_catalog: {
      schema_version: "evidence-viewer-data-catalog.v1",
      generated_at: generatedAt,
      viewer_cards: viewerCards,
      source_span_panels: sourceSpanPanels,
      lineage_path_panels: lineagePathPanels,
      viewer_indexes: buildViewerIndexes(viewerCards, sourceSpanPanels, lineagePathPanels),
    },
  };
}

export async function writeEvidenceViewerDataApi(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableEvidenceViewerDataApi(result);
  await writeJson(path.join(outDir, "evidence-viewer-data-api.json"), serializable);
  await writeJson(path.join(outDir, "viewer-cards.json"), {
    schema_version: "evidence-viewer-card-set.v1",
    generated_at: result.generated_at,
    viewer_card_count: result.evidence_viewer_data_catalog.viewer_cards.length,
    viewer_cards: result.evidence_viewer_data_catalog.viewer_cards,
  });
  await writeJson(path.join(outDir, "source-span-panels.json"), {
    schema_version: "evidence-viewer-source-span-panel-set.v1",
    generated_at: result.generated_at,
    source_span_panel_count: result.evidence_viewer_data_catalog.source_span_panels.length,
    source_span_panels: result.evidence_viewer_data_catalog.source_span_panels,
  });
  await writeJson(path.join(outDir, "lineage-path-panels.json"), {
    schema_version: "evidence-viewer-lineage-path-panel-set.v1",
    generated_at: result.generated_at,
    lineage_path_panel_count: result.evidence_viewer_data_catalog.lineage_path_panels.length,
    lineage_path_panels: result.evidence_viewer_data_catalog.lineage_path_panels,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    evidence_viewer_data_api_id: result.evidence_viewer_data_api_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceViewerDataApiCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceViewerDataApi(args);
    console.log(`Evidence viewer data API written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.evidence_viewer_data_status}`);
    console.log(`Viewer cards: ${result.summary.viewer_card_count}`);
    console.log(`Source span panels: ${result.summary.source_span_panel_count}`);
    console.log(`Lineage path panels: ${result.summary.lineage_path_panel_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildViewerCard({
  evidenceItem,
  sourceSpanById,
  reviewQueueByEvidenceId,
  pathsByEvidenceId,
  nodeById,
  edgeById,
  generatedAt,
}) {
  const sourceSpans = (evidenceItem.source_span_ids ?? []).map((sourceSpanId) => sourceSpanById.get(sourceSpanId)).filter(Boolean);
  const primarySourceSpan = sourceSpanById.get(evidenceItem.primary_source_span_id) ?? sourceSpans[0] ?? null;
  const lineagePaths = pathsByEvidenceId.get(evidenceItem.evidence_id) ?? [];
  const reviewQueueItem = reviewQueueByEvidenceId.get(evidenceItem.evidence_id) ?? null;
  return {
    schema_version: "evidence-viewer-card.v1",
    viewer_card_id: `evidence-viewer-card.${slugify(evidenceItem.evidence_id)}`,
    generated_at: generatedAt,
    evidence_id: evidenceItem.evidence_id,
    evidence_type: evidenceItem.evidence_type,
    tenant_id: evidenceItem.tenant_id ?? null,
    matter_id: evidenceItem.matter_id ?? null,
    classification: evidenceItem.classification ?? null,
    policy_snapshot_id: evidenceItem.policy_snapshot_id ?? null,
    review_status: evidenceItem.review_status,
    reliability: evidenceItem.reliability,
    verification_state: evidenceItem.verification_state,
    privilege_flag: Boolean(evidenceItem.privilege_flag),
    redaction_state: evidenceItem.redaction_state,
    source_span_ids: evidenceItem.source_span_ids ?? [],
    primary_source_span_id: evidenceItem.primary_source_span_id,
    source_span_count: evidenceItem.source_span_count ?? sourceSpans.length,
    bound_source_span_count: sourceSpans.length,
    lineage_path_ids: lineagePaths.map((lineagePath) => lineagePath.lineage_path_id),
    lineage_path_count: lineagePaths.length,
    source_preview: primarySourceSpan?.content_preview ?? evidenceItem.summary ?? "",
    source_locator: primarySourceSpan?.locator ?? evidenceItem.locator ?? {},
    summary: evidenceItem.summary,
    source_span: primarySourceSpan ? summarizeSourceSpan(primarySourceSpan) : null,
    lineage_paths: lineagePaths.map((lineagePath) => summarizeLineagePath(lineagePath, nodeById, edgeById)),
    review_queue: reviewQueueItem ? summarizeReviewQueueItem(reviewQueueItem) : null,
    viewer_actions: {
      source_span_view_allowed: Boolean(primarySourceSpan),
      lineage_view_allowed: lineagePaths.length > 0,
      human_review_required: reviewQueueItem?.review_required ?? evidenceItem.review_status === "needs_review",
      output_delivery_allowed: false,
    },
  };
}

function buildSourceSpanPanel({ sourceSpan, bindings, evidenceById, lineagePaths, generatedAt }) {
  const evidenceIds = unique([
    ...bindings.map((binding) => binding.evidence_id),
    ...[...evidenceById.values()]
      .filter((evidenceItem) => (evidenceItem.source_span_ids ?? []).includes(sourceSpan.source_span_id))
      .map((evidenceItem) => evidenceItem.evidence_id),
  ]);
  return {
    schema_version: "evidence-viewer-source-span-panel.v1",
    source_span_panel_id: `evidence-viewer-source-span.${slugify(sourceSpan.source_span_id)}`,
    generated_at: generatedAt,
    source_span_id: sourceSpan.source_span_id,
    tenant_id: sourceSpan.tenant_id ?? null,
    matter_id: sourceSpan.matter_id ?? null,
    classification: sourceSpan.classification ?? null,
    policy_snapshot_id: sourceSpan.policy_snapshot_id ?? null,
    resource_id: sourceSpan.resource_id,
    resource_version_id: sourceSpan.resource_version_id,
    normalized_text_id: sourceSpan.normalized_text_id,
    location_type: sourceSpan.location_type,
    span_status: sourceSpan.span_status,
    review_status: sourceSpan.review_status,
    locator: sourceSpan.locator,
    content_preview: sourceSpan.content_preview,
    evidence_ids: evidenceIds,
    evidence_binding_count: evidenceIds.length,
    lineage_path_ids: lineagePaths.map((lineagePath) => lineagePath.lineage_path_id),
    lineage_path_count: lineagePaths.length,
    binding_status: evidenceIds.length > 0 ? "bound" : "unbound",
  };
}

function buildLineagePathPanel({ lineagePath, evidenceItem, sourceSpan, nodeById, edgeById, generatedAt }) {
  const nodes = (lineagePath.node_ids ?? []).map((nodeId) => nodeById.get(nodeId)).filter(Boolean);
  const edges = (lineagePath.edge_ids ?? []).map((edgeId) => edgeById.get(edgeId)).filter(Boolean);
  return {
    schema_version: "evidence-viewer-lineage-path-panel.v1",
    lineage_path_panel_id: `evidence-viewer-lineage-path.${slugify(lineagePath.lineage_path_id)}`,
    generated_at: generatedAt,
    lineage_path_id: lineagePath.lineage_path_id,
    path_status: lineagePath.path_status,
    citation_id: lineagePath.citation_id,
    source_span_id: lineagePath.source_span_id,
    evidence_id: lineagePath.evidence_item_id,
    fact_id: lineagePath.fact_id,
    issue_id: lineagePath.issue_id,
    output_paragraph_id: lineagePath.output_paragraph_id,
    tenant_id: lineagePath.tenant_id ?? evidenceItem?.tenant_id ?? sourceSpan?.tenant_id ?? null,
    matter_id: lineagePath.matter_id ?? evidenceItem?.matter_id ?? sourceSpan?.matter_id ?? null,
    classification: lineagePath.classification ?? evidenceItem?.classification ?? sourceSpan?.classification ?? null,
    policy_snapshot_id: lineagePath.policy_snapshot_id ?? evidenceItem?.policy_snapshot_id ?? sourceSpan?.policy_snapshot_id ?? null,
    review_status: lineagePath.review_status ?? evidenceItem?.review_status ?? null,
    node_ids: lineagePath.node_ids ?? [],
    edge_ids: lineagePath.edge_ids ?? [],
    node_count: nodes.length,
    edge_count: edges.length,
    node_sequence: nodes.map(summarizeLineageNode),
    edge_sequence: edges.map(summarizeLineageEdge),
    source_preview: sourceSpan?.content_preview ?? evidenceItem?.summary ?? "",
  };
}

function buildDataContract(generatedAt) {
  return {
    schema_version: "evidence-viewer-data-contract.v1",
    evidence_viewer_data_contract_id: EVIDENCE_VIEWER_DATA_CONTRACT_ID,
    generated_at: generatedAt,
    source_inputs: ["source_span_store", "evidence_item_store", "lineage_graph_builder"],
    required_card_links: ["evidence_id", "primary_source_span_id", "lineage_path_ids"],
    required_panel_links: ["source_span_id", "evidence_ids", "lineage_path_ids"],
    api_routes: [
      "/api/evidence-viewer-data",
      "/api/evidence-viewer-cards",
      "/api/evidence-viewer-source-spans",
      "/api/evidence-viewer-lineage-paths",
      "/api/evidence-viewer-data-validations",
    ],
    delivery_rule: "Evidence viewer API data is read-only and cannot approve evidence, send outputs, or release quarantined resources.",
  };
}

function validateEvidenceViewerDataApi({
  projection,
  sourceSpanStore,
  evidenceItemStore,
  lineageGraph,
  packageText,
  roadmapText,
}) {
  const cards = projection.evidence_viewer_data_catalog.viewer_cards;
  const sourceSpanPanels = projection.evidence_viewer_data_catalog.source_span_panels;
  const lineagePathPanels = projection.evidence_viewer_data_catalog.lineage_path_panels;
  const sourceSpanCount = sourceSpanStore.summary?.source_span_count ?? 0;
  const evidenceItemCount = evidenceItemStore.summary?.evidence_item_count ?? 0;
  const lineagePathCount = lineageGraph.summary?.lineage_path_count ?? 0;
  const items = [];
  pushCheck(items, "package_json", "evidence_viewer_data_script_registered", String(packageText).includes("\"evidence:viewer-data\""), "package.json must expose npm run evidence:viewer-data.");
  pushCheck(items, "roadmap", "phase_154_documented", String(roadmapText).includes("## Phase 154: Evidence Viewer Data API"), "Roadmap must document Phase 154.");
  pushCheck(items, "source_span_store", "source_span_store_complete", sourceSpanStore.summary?.source_span_store_status === "complete", "Source Span Store must be complete.");
  pushCheck(items, "evidence_item_store", "evidence_item_store_complete", evidenceItemStore.summary?.evidence_item_store_status === "complete", "Evidence Item Store must be complete.");
  pushCheck(items, "lineage_graph_builder", "lineage_graph_complete", lineageGraph.summary?.lineage_graph_status === "complete", "Lineage Graph Builder must be complete.");
  pushCheck(items, "viewer_cards", "cards_cover_evidence_items", cards.length === evidenceItemCount, "Every evidence item must have one viewer card.");
  pushCheck(items, "viewer_cards", "cards_bind_source_spans", cards.every((card) => card.bound_source_span_count > 0 && card.source_span), "Every viewer card must bind at least one source span.");
  pushCheck(items, "viewer_cards", "cards_bind_lineage_paths", cards.every((card) => card.lineage_path_count > 0), "Every viewer card must bind at least one lineage path.");
  pushCheck(items, "source_span_panels", "panels_cover_source_spans", sourceSpanPanels.length === sourceSpanCount, "Every source span must have one viewer panel.");
  pushCheck(items, "source_span_panels", "panels_bind_evidence", sourceSpanPanels.every((panel) => panel.evidence_binding_count > 0), "Every source span panel must link to evidence.");
  pushCheck(items, "lineage_path_panels", "panels_cover_lineage_paths", lineagePathPanels.length === lineagePathCount, "Every lineage path must have one viewer panel.");
  pushCheck(items, "lineage_path_panels", "lineage_panels_have_sequences", lineagePathPanels.every((panel) => panel.node_count > 0 && panel.edge_count > 0), "Every lineage path panel must expose node and edge sequences.");
  pushCheck(items, "identity_fields", "card_identity_preserved", cards.every(cardIdentityPreserved), "Viewer cards must preserve tenant, matter, classification, and policy snapshot identity between evidence and source span.");
  pushCheck(items, "viewer_actions", "read_only_delivery_blocked", cards.every((card) => card.viewer_actions?.output_delivery_allowed === false), "Viewer data must not authorize output delivery.");
  return items;
}

function buildSummary({
  projection,
  sourceSpanStore,
  evidenceItemStore,
  lineageGraph,
  validation,
  validationItems,
}) {
  const cards = projection.evidence_viewer_data_catalog.viewer_cards;
  const sourceSpanPanels = projection.evidence_viewer_data_catalog.source_span_panels;
  const lineagePathPanels = projection.evidence_viewer_data_catalog.lineage_path_panels;
  return {
    evidence_viewer_data_status: validation.valid ? "complete" : "blocked",
    evidence_viewer_data_contract_id: EVIDENCE_VIEWER_DATA_CONTRACT_ID,
    source_span_store_status: sourceSpanStore.summary?.source_span_store_status ?? "unknown",
    evidence_item_store_status: evidenceItemStore.summary?.evidence_item_store_status ?? "unknown",
    lineage_graph_status: lineageGraph.summary?.lineage_graph_status ?? "unknown",
    source_span_count: sourceSpanStore.summary?.source_span_count ?? 0,
    evidence_item_count: evidenceItemStore.summary?.evidence_item_count ?? 0,
    lineage_path_count: lineageGraph.summary?.lineage_path_count ?? 0,
    viewer_card_count: cards.length,
    card_source_span_bound_count: cards.filter((card) => card.bound_source_span_count > 0).length,
    card_lineage_path_bound_count: cards.filter((card) => card.lineage_path_count > 0).length,
    needs_review_card_count: cards.filter((card) => card.review_status === "needs_review").length,
    source_span_panel_count: sourceSpanPanels.length,
    source_span_panel_bound_count: sourceSpanPanels.filter((panel) => panel.binding_status === "bound").length,
    lineage_path_panel_count: lineagePathPanels.length,
    complete_lineage_path_panel_count: lineagePathPanels.filter((panel) => panel.path_status === "complete").length,
    read_only_card_count: cards.filter((card) => card.viewer_actions?.output_delivery_allowed === false).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(cards, "matter_id"),
    by_classification: countBy(cards, "classification"),
    by_review_status: countBy(cards, "review_status"),
  };
}

function buildViewerIndexes(cards, sourceSpanPanels, lineagePathPanels) {
  return {
    schema_version: "evidence-viewer-indexes.v1",
    by_matter_id: countBy(cards, "matter_id"),
    by_classification: countBy(cards, "classification"),
    by_review_status: countBy(cards, "review_status"),
    source_span_by_location_type: countBy(sourceSpanPanels, "location_type"),
    lineage_by_path_status: countBy(lineagePathPanels, "path_status"),
  };
}

function summarizeSourceSpan(span) {
  return {
    source_span_id: span.source_span_id,
    resource_id: span.resource_id,
    resource_version_id: span.resource_version_id,
    normalized_text_id: span.normalized_text_id,
    tenant_id: span.tenant_id ?? null,
    matter_id: span.matter_id ?? null,
    classification: span.classification ?? null,
    policy_snapshot_id: span.policy_snapshot_id ?? null,
    location_type: span.location_type,
    span_status: span.span_status,
    review_status: span.review_status,
    locator: span.locator,
    content_preview: span.content_preview,
  };
}

function summarizeLineagePath(lineagePath, nodeById, edgeById) {
  const nodes = (lineagePath.node_ids ?? []).map((nodeId) => nodeById.get(nodeId)).filter(Boolean);
  const edges = (lineagePath.edge_ids ?? []).map((edgeId) => edgeById.get(edgeId)).filter(Boolean);
  return {
    lineage_path_id: lineagePath.lineage_path_id,
    path_status: lineagePath.path_status,
    citation_id: lineagePath.citation_id,
    fact_id: lineagePath.fact_id,
    issue_id: lineagePath.issue_id,
    output_paragraph_id: lineagePath.output_paragraph_id,
    node_count: nodes.length,
    edge_count: edges.length,
    node_sequence: nodes.map(summarizeLineageNode),
    edge_sequence: edges.map(summarizeLineageEdge),
  };
}

function summarizeLineageNode(node) {
  return {
    lineage_node_id: node.lineage_node_id,
    node_type: node.node_type,
    subject_id: node.subject_id,
    label: node.label,
    review_status: node.review_status,
    node_status: node.node_status,
  };
}

function summarizeLineageEdge(edge) {
  return {
    lineage_edge_id: edge.lineage_edge_id,
    edge_type: edge.edge_type,
    relation: edge.relation,
    from_subject_id: edge.from_subject_id,
    to_subject_id: edge.to_subject_id,
    edge_status: edge.edge_status,
  };
}

function summarizeReviewQueueItem(item) {
  return {
    review_queue_item_id: item.review_queue_item_id,
    review_status: item.review_status,
    review_required: item.review_required,
    approval_required_before_output: item.approval_required_before_output,
    queue_reason: item.queue_reason,
    assigned_role: item.assigned_role,
  };
}

function cardIdentityPreserved(card) {
  if (!card.source_span) return false;
  return ["tenant_id", "matter_id", "classification", "policy_snapshot_id"].every((key) => (
    (card[key] ?? null) === (card.source_span[key] ?? null)
  ));
}

function sourceSummary(sourceId, artifact) {
  return {
    source_id: sourceId,
    schema_version: artifact.schema_version ?? null,
    generated_at: artifact.generated_at ?? null,
    summary: artifact.summary ?? null,
  };
}

function serializableEvidenceViewerDataApi(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderEvidenceViewerDataApiMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Viewer Data API");
  lines.push("");
  lines.push(`Status: ${result.summary.evidence_viewer_data_status}`);
  lines.push(`Contract: ${result.summary.evidence_viewer_data_contract_id}`);
  lines.push(`Viewer cards: ${result.summary.viewer_card_count}`);
  lines.push(`Source span panels: ${result.summary.source_span_panel_count}`);
  lines.push(`Lineage path panels: ${result.summary.lineage_path_panel_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Routes");
  for (const route of result.evidence_viewer_data_contract.api_routes) {
    lines.push(`- ${route}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.subject_id,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function pushCheck(items, subjectId, checkId, passed, message) {
  items.push({
    schema_version: "validation-item.v1",
    validation_id: `evidence-viewer-data-api.${slugify(subjectId)}.${checkId}`,
    subject_id: subjectId,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
  });
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
    else if (arg === "--source-span-store") parsed.sourceSpanStorePath = argv[++index];
    else if (arg === "--evidence-item-store") parsed.evidenceItemStorePath = argv[++index];
    else if (arg === "--lineage-graph") parsed.lineageGraphPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`
Usage: node scripts/evidence-viewer-data-api.mjs [options]

Options:
  --check                         Exit non-zero when validation fails.
  --out-dir <path>                Output directory.
  --source-span-store <path>      source-span-store.json path.
  --evidence-item-store <path>    evidence-item-store.json path.
  --lineage-graph <path>          lineage-graph.json path.
  --run-at <iso>                  Override generated_at.
  --help                          Show this help.
`);
}

function normalizeInputs(options = {}) {
  return {
    source_span_store_path: path.resolve(options.sourceSpanStorePath ?? DEFAULT_EVIDENCE_VIEWER_DATA_API_INPUTS.sourceSpanStorePath),
    evidence_item_store_path: path.resolve(options.evidenceItemStorePath ?? DEFAULT_EVIDENCE_VIEWER_DATA_API_INPUTS.evidenceItemStorePath),
    lineage_graph_path: path.resolve(options.lineageGraphPath ?? DEFAULT_EVIDENCE_VIEWER_DATA_API_INPUTS.lineageGraphPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_EVIDENCE_VIEWER_DATA_API_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_EVIDENCE_VIEWER_DATA_API_INPUTS.roadmapPath),
  };
}

async function readJson(filePath) {
  return JSON.parse(await readFile(path.resolve(filePath), "utf8"));
}

async function readText(filePath) {
  return readFile(path.resolve(filePath), "utf8");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key] ?? "unknown";
    const group = groups.get(value) ?? [];
    group.push(item);
    groups.set(value, group);
  }
  return groups;
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function unique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null))];
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\..+/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "unknown";
}
