import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_MATTER_KNOWLEDGE_GRAPH_OUT_DIR = "artifacts/matter-knowledge-graph/latest";
export const DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS = {
  matterTaskBoardPath: "artifacts/matter-task-board/latest/matter-task-board.json",
  matterDocumentIndexPath: "artifacts/matter-document-index/latest/matter-document-index.json",
  matterTimelinePath: "artifacts/matter-timeline/latest/matter-timeline.json",
  matterOsProfilePath: "artifacts/matter-os-profile/latest/matter-os-profile.json",
  matterFiles: [
    "examples/project-alpha-matter.json",
    "examples/project-beta-litigation-matter.json",
  ],
  outputCatalogPath: "artifacts/output-catalog/latest/output-catalog.json",
  deliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "matter-knowledge-graph.v1";
const SOURCE_OF_TRUTH = "matter_files_timeline_document_index_task_board_and_output_artifacts";

export async function runMatterKnowledgeGraph(options = {}) {
  const result = await buildMatterKnowledgeGraph(options);
  if (options.write !== false) await writeMatterKnowledgeGraph(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Matter knowledge graph validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildMatterKnowledgeGraph(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const matterFileReads = sourceReads.filter((source) => source.source_kind === "matter_file");
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);

  const matterTaskBoard = sourceById.matter_task_board;
  const matterDocumentIndex = sourceById.matter_document_index;
  const matterTimeline = sourceById.matter_timeline;
  const matterOsProfile = sourceById.matter_os_profile;
  const outputCatalog = sourceById.output_catalog;
  const deliveryQueue = sourceById.delivery_queue;

  const documentByMatterAndSource = buildDocumentByMatterAndSource(matterDocumentIndex);
  const taskByMatter = groupBy(matterTaskBoard?.task_records ?? [], "matter_id");
  const graph = buildKnowledgeGraph({
    generatedAt,
    matterFileReads,
    documentByMatterAndSource,
    taskByMatter,
  });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    matterTaskBoard,
    matterDocumentIndex,
    matterTimeline,
    matterOsProfile,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    nodes: graph.nodes,
    edges: graph.edges,
    matterSummaries: graph.matterSummaries,
    desktopBoundary,
  });
  const validationItems = checkpoints.map(({ checkpoint_id: checkpointId, status, message, ...rest }) => ({
    path: checkpointId,
    check_id: checkpointId,
    status,
    message,
    ...rest,
  }));
  const validation = summarizeValidation(validationItems);
  const summary = summarizeMatterKnowledgeGraph({
    matterTaskBoard,
    matterDocumentIndex,
    matterTimeline,
    matterOsProfile,
    outputCatalog,
    deliveryQueue,
    matterFileReads,
    nodes: graph.nodes,
    edges: graph.edges,
    matterSummaries: graph.matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    matter_knowledge_graph_id: `matter-knowledge-graph.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    matter_knowledge_graph_status: summary.matter_knowledge_graph_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    matter_knowledge_graph_contract: buildContract(generatedAt),
    graph_nodes: graph.nodes,
    graph_edges: graph.edges,
    matter_knowledge_summaries: graph.matterSummaries,
    matter_knowledge_graph_desktop_boundary: desktopBoundary,
    matter_knowledge_graph_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderMatterKnowledgeGraphMarkdown(result),
  };
}

export async function writeMatterKnowledgeGraph(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableMatterKnowledgeGraph(result);
  await writeJson(path.join(outDir, "matter-knowledge-graph.json"), serializable);
  await writeJson(path.join(outDir, "matter-knowledge-nodes.json"), {
    schema_version: "matter-knowledge-nodes.v1",
    generated_at: result.generated_at,
    graph_node_count: result.graph_nodes.length,
    graph_nodes: result.graph_nodes,
  });
  await writeJson(path.join(outDir, "matter-knowledge-edges.json"), {
    schema_version: "matter-knowledge-edges.v1",
    generated_at: result.generated_at,
    graph_edge_count: result.graph_edges.length,
    graph_edges: result.graph_edges,
  });
  await writeJson(path.join(outDir, "matter-knowledge-matter-summaries.json"), {
    schema_version: "matter-knowledge-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.matter_knowledge_summaries.length,
    matter_knowledge_summaries: result.matter_knowledge_summaries,
  });
  await writeJson(path.join(outDir, "matter-knowledge-graph-boundary.json"), {
    schema_version: "matter-knowledge-graph-boundary-artifact.v1",
    generated_at: result.generated_at,
    matter_knowledge_graph_desktop_boundary: result.matter_knowledge_graph_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "matter-knowledge-graph-validation-report.v1",
    generated_at: result.generated_at,
    matter_knowledge_graph_id: result.matter_knowledge_graph_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runMatterKnowledgeGraphCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runMatterKnowledgeGraph(args);
    console.log(`Matter knowledge graph ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.matter_knowledge_graph_status}`);
    console.log(`Matters: ${result.summary.matter_count}`);
    console.log(`Nodes: ${result.summary.graph_node_count}`);
    console.log(`Edges: ${result.summary.graph_edge_count}`);
    console.log(`Fact/Issue/Theory/Evidence: ${result.summary.fact_node_count}/${result.summary.issue_node_count}/${result.summary.legal_theory_node_count}/${result.summary.evidence_node_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "matter-knowledge-graph-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    graph_rule: "facts_issues_legal_theory_placeholders_and_evidence_are_materialized_as_matter_scoped_read_only_nodes",
    legal_theory_rule: "legal_theory_nodes_are_review_placeholders_only_and_do_not_state_legal_conclusions_or_advice",
    evidence_rule: "evidence_nodes_bind_to_source_records_and_document_index_records_when available",
    matter_boundary_rule: "every_node_and_edge_carries_one_matter_id_and_never_merges_confidential_context_across_matters",
    attorney_review_rule: "all_knowledge_graph_nodes_and_edges_remain_pending_review_or_review_required_for_human_attorney_review",
    desktop_companion_rule: "desktop_companion_reads_nodes_edges_matter_summaries_and_boundary_status_only",
    mutation_policy: "this_artifact_does_not_write_matter_data_change_task_state_transition_workflows_execute_runtime_actions_or_deliver_outputs",
    created_at: generatedAt,
  };
}

function buildKnowledgeGraph({ generatedAt, matterFileReads, documentByMatterAndSource, taskByMatter }) {
  const nodeMap = new Map();
  const edges = [];
  const matterSummaries = [];

  for (const matterRead of matterFileReads) {
    const matter = matterRead.value;
    if (!matter?.matter_id) continue;
    const matterId = matter.matter_id;
    const matterNode = buildNode({
      generatedAt,
      matterId,
      nodeType: "matter",
      sourceKind: "matter_file",
      sourceId: matterRead.source_id,
      sourcePath: matterRead.path,
      sourceRecordId: matterId,
      label: matter.title ?? matterId,
      status: "active",
      confidence: "source_record",
      metadata: {
        client: matter.client ?? null,
        practice_area: matter.practice_area ?? null,
        responsible_partner: matter.matter_profile?.responsible_partner ?? null,
        confidentiality_level: matter.confidentiality?.level ?? null,
      },
    });
    addNode(nodeMap, matterNode);

    const issueNodes = buildIssueNodes({ matter, matterRead, generatedAt });
    const evidenceNodes = buildEvidenceNodes({
      matter,
      matterRead,
      generatedAt,
      documentByMatterAndSource,
    });
    const factNodes = buildFactNodes({ matter, matterRead, generatedAt });
    const legalTheoryNodes = buildLegalTheoryNodes({ matter, matterRead, generatedAt, issueNodes });

    for (const node of [...issueNodes, ...evidenceNodes, ...factNodes, ...legalTheoryNodes]) {
      addNode(nodeMap, node);
      addEdge(edges, {
        generatedAt,
        matterId,
        fromNodeId: matterNode.node_id,
        toNodeId: node.node_id,
        edgeType: "matter_contains_node",
        label: "Matter contains graph node",
      });
    }

    const nodesForMatter = [...nodeMap.values()].filter((node) => node.matter_id === matterId);
    const issueByKey = new Map(issueNodes.map((node) => [node.metadata.issue_key, node]));
    const evidenceBySourceRecord = new Map(evidenceNodes.map((node) => [node.source_record_id, node]));

    for (const evidenceNode of evidenceNodes) {
      const issueNode = issueByKey.get(evidenceNode.metadata.issue_key);
      if (issueNode) {
        addEdge(edges, {
          generatedAt,
          matterId,
          fromNodeId: evidenceNode.node_id,
          toNodeId: issueNode.node_id,
          edgeType: evidenceNode.metadata.evidence_status === "missing" ? "evidence_gap_for_issue" : "evidence_relates_to_issue",
          label: "Evidence relates to issue",
        });
      }
    }

    for (const factNode of factNodes) {
      const evidenceNode = evidenceBySourceRecord.get(factNode.source_record_id)
        ?? evidenceBySourceRecord.get(factNode.metadata.source_document_id)
        ?? evidenceBySourceRecord.get(factNode.metadata.source_communication_id);
      if (evidenceNode) {
        addEdge(edges, {
          generatedAt,
          matterId,
          fromNodeId: factNode.node_id,
          toNodeId: evidenceNode.node_id,
          edgeType: "fact_supported_by_evidence",
          label: "Fact source evidence",
        });
      }
      const issueNode = issueByKey.get(factNode.metadata.issue_key);
      if (issueNode) {
        addEdge(edges, {
          generatedAt,
          matterId,
          fromNodeId: factNode.node_id,
          toNodeId: issueNode.node_id,
          edgeType: "fact_relates_to_issue",
          label: "Fact relates to issue",
        });
      }
    }

    for (const theoryNode of legalTheoryNodes) {
      const issueNode = issueByKey.get(theoryNode.metadata.issue_key);
      if (issueNode) {
        addEdge(edges, {
          generatedAt,
          matterId,
          fromNodeId: theoryNode.node_id,
          toNodeId: issueNode.node_id,
          edgeType: "legal_theory_frames_issue",
          label: "Attorney-review placeholder frames issue",
        });
      }
    }

    for (const task of taskByMatter.get(matterId) ?? []) {
      const issueKey = issueKeyFromTask(task);
      const issueNode = issueByKey.get(issueKey);
      if (issueNode) {
        addEdge(edges, {
          generatedAt,
          matterId,
          fromNodeId: issueNode.node_id,
          toNodeId: matterNode.node_id,
          edgeType: "issue_has_task_board_context",
          label: "Issue has read-only task board context",
          metadata: {
            task_id: task.task_id,
            task_status: task.task_status,
            task_owner: task.task_owner,
            due_date: task.due_date,
          },
        });
      }
    }

    matterSummaries.push(buildMatterSummary({
      generatedAt,
      matter,
      matterRead,
      nodes: nodesForMatter,
      edges: edges.filter((edge) => edge.matter_id === matterId),
    }));
  }

  const nodes = [...nodeMap.values()].sort(compareNodes);
  const sortedEdges = edges.sort(compareEdges).map((edge, index) => ({
    ...edge,
    sequence_number: index + 1,
  }));
  return {
    nodes,
    edges: sortedEdges,
    matterSummaries: matterSummaries.sort((left, right) => left.matter_id.localeCompare(right.matter_id)),
  };
}

function buildIssueNodes({ matter, matterRead, generatedAt }) {
  const nodes = [];
  const matterId = matter.matter_id;
  for (const risk of matter.risks ?? []) {
    nodes.push(issueNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: risk.id,
      label: risk.title,
      issueKey: issueKeyFromText(risk.title, risk.source),
      status: risk.status ?? "open",
      severity: risk.severity ?? "unknown",
      sourceLabel: "risks",
    }));
  }
  for (const document of matter.documents ?? []) {
    if (!document.issue) continue;
    nodes.push(issueNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: `document.${document.id}.issue`,
      label: `Document issue: ${document.issue}`,
      issueKey: issueKeyFromText(document.issue),
      status: document.status ?? "open",
      severity: "document",
      sourceLabel: "documents.issue",
    }));
  }
  for (const request of matter.deal_control?.vdr_requests ?? []) {
    nodes.push(issueNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: request.id,
      label: request.issue ? `VDR issue: ${request.issue}` : request.title,
      issueKey: issueKeyFromText(request.issue ?? request.title),
      status: request.status ?? "open",
      severity: "diligence",
      sourceLabel: "deal_control.vdr_requests",
    }));
  }
  for (const point of matter.deal_control?.negotiation_points ?? []) {
    nodes.push(issueNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: point.id,
      label: point.open_issue ?? point.clause,
      issueKey: issueKeyFromText(point.open_issue ?? point.clause),
      status: point.status ?? "open",
      severity: point.severity ?? "negotiation",
      sourceLabel: "deal_control.negotiation_points",
    }));
  }
  for (const claim of matter.litigation_control?.claims ?? []) {
    nodes.push(issueNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: claim.id,
      label: claim.title,
      issueKey: issueKeyFromText(claim.title, claim.id),
      status: claim.status ?? "open",
      severity: "claim",
      sourceLabel: "litigation_control.claims",
      metadata: { claim_id: claim.id },
    }));
  }
  return uniqueNodes(nodes);
}

function buildEvidenceNodes({ matter, matterRead, generatedAt, documentByMatterAndSource }) {
  const nodes = [];
  const matterId = matter.matter_id;
  for (const communication of matter.communications ?? []) {
    nodes.push(evidenceNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: communication.id,
      label: `Communication source: ${communication.source ?? communication.id}`,
      status: "received",
      issueKey: issueKeyFromText(communication.summary, communication.source),
      sourceLabel: "communications",
      metadata: {
        communication_date: communication.date ?? null,
        pending_question_count: (communication.pending_questions ?? []).length,
      },
    }));
  }
  for (const document of matter.documents ?? []) {
    const documentRecord = documentByMatterAndSource.get(`${matterId}|${document.id}`);
    nodes.push(evidenceNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: document.id,
      label: document.title,
      status: document.status ?? "unknown",
      issueKey: issueKeyFromText(document.issue ?? document.type ?? document.title),
      sourceLabel: "documents",
      documentRecord,
      metadata: {
        document_type: document.type ?? null,
        document_issue: document.issue ?? null,
      },
    }));
  }
  for (const item of matter.litigation_control?.evidence ?? []) {
    if (nodes.some((node) => node.source_record_id === item.id)) continue;
    const documentRecord = documentByMatterAndSource.get(`${matterId}|${item.id}`);
    nodes.push(evidenceNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: item.id,
      label: item.title,
      status: item.status ?? "unknown",
      issueKey: issueKeyFromText(item.type ?? item.title),
      sourceLabel: "litigation_control.evidence",
      documentRecord,
      metadata: {
        evidence_type: item.type ?? null,
      },
    }));
  }
  for (const item of matter.deal_control?.cp_checklist ?? []) {
    if (!item.evidence) continue;
    const documentRecord = documentByMatterAndSource.get(`${matterId}|${item.evidence}`);
    nodes.push(evidenceNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: item.evidence,
      label: `CP evidence: ${item.title}`,
      status: item.status ?? "unknown",
      issueKey: issueKeyFromText(item.title),
      sourceLabel: "deal_control.cp_checklist",
      documentRecord,
      metadata: {
        checklist_id: item.id,
        checklist_status: item.status ?? null,
      },
    }));
  }
  for (const binding of matter.litigation_control?.claim_evidence ?? []) {
    for (const missing of binding.missing_evidence ?? []) {
      nodes.push(evidenceNode({
        generatedAt,
        matterRead,
        matterId,
        sourceRecordId: `${binding.claim_id}.missing.${slugify(missing)}`,
        label: `Missing evidence: ${missing}`,
        status: "missing",
        issueKey: issueKeyFromText(binding.claim_id),
        sourceLabel: "litigation_control.claim_evidence.missing_evidence",
        metadata: {
          claim_id: binding.claim_id,
          owner: binding.owner ?? null,
        },
      }));
    }
  }
  return uniqueNodes(nodes);
}

function buildFactNodes({ matter, matterRead, generatedAt }) {
  const nodes = [];
  const matterId = matter.matter_id;
  for (const communication of matter.communications ?? []) {
    nodes.push(factNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: communication.id,
      label: communication.summary,
      status: "source_summary",
      issueKey: issueKeyFromText(communication.summary, communication.source),
      sourceLabel: "communications.summary",
      metadata: {
        source_communication_id: communication.id,
        communication_date: communication.date ?? null,
      },
    }));
    for (const [index, question] of (communication.pending_questions ?? []).entries()) {
      nodes.push(factNode({
        generatedAt,
        matterRead,
        matterId,
        sourceRecordId: `${communication.id}.question.${index + 1}`,
        label: question,
        status: "pending_question",
        issueKey: issueKeyFromText(question),
        sourceLabel: "communications.pending_questions",
        metadata: {
          source_communication_id: communication.id,
        },
      }));
    }
  }
  for (const item of matter.litigation_control?.chronology ?? []) {
    nodes.push(factNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: item.source,
      label: item.fact,
      status: item.verified === true ? "verified_source_fact" : "unverified_source_fact",
      issueKey: issueKeyFromText(item.fact, item.source),
      sourceLabel: "litigation_control.chronology",
      metadata: {
        fact_date: item.date ?? null,
        source_document_id: item.source ?? null,
        verified: item.verified === true,
      },
    }));
  }
  return uniqueNodes(nodes);
}

function buildLegalTheoryNodes({ matter, matterRead, generatedAt, issueNodes }) {
  const matterId = matter.matter_id;
  const issueCandidates = issueNodes.length > 0
    ? issueNodes
    : [issueNode({
      generatedAt,
      matterRead,
      matterId,
      sourceRecordId: `${matterId}.general-issue`,
      label: `${matter.practice_area ?? "matter"} review issue`,
      issueKey: issueKeyFromText(matter.practice_area ?? matter.title),
      status: "open",
      severity: "general",
      sourceLabel: "matter_profile",
    })];
  return uniqueNodes(issueCandidates.map((issue) => buildNode({
    generatedAt,
    matterId,
    nodeType: "legal_theory",
    sourceKind: "derived",
    sourceId: matterRead.source_id,
    sourcePath: matterRead.path,
    sourceRecordId: `legal_theory.${issue.source_record_id}`,
    label: `Attorney review placeholder: ${issue.label}`,
    status: "placeholder_pending_review",
    confidence: "derived_from_issue",
    metadata: {
      issue_key: issue.metadata.issue_key,
      source_issue_node_id: issue.node_id,
      legal_theory_kind: "review_placeholder",
      legal_conclusion_provided: false,
    },
  })));
}

function issueNode({ generatedAt, matterRead, matterId, sourceRecordId, label, issueKey, status, severity, sourceLabel, metadata = {} }) {
  return buildNode({
    generatedAt,
    matterId,
    nodeType: "issue",
    sourceKind: "matter_file",
    sourceId: matterRead.source_id,
    sourcePath: matterRead.path,
    sourceRecordId,
    label,
    status,
    confidence: "source_record",
    metadata: {
      issue_key: issueKey,
      severity,
      source_label: sourceLabel,
      ...metadata,
    },
  });
}

function evidenceNode({ generatedAt, matterRead, matterId, sourceRecordId, label, status, issueKey, sourceLabel, documentRecord = null, metadata = {} }) {
  return buildNode({
    generatedAt,
    matterId,
    nodeType: "evidence",
    sourceKind: "matter_file",
    sourceId: matterRead.source_id,
    sourcePath: matterRead.path,
    sourceRecordId,
    label,
    status,
    confidence: documentRecord ? "document_index_bound" : "source_record",
    metadata: {
      issue_key: issueKey,
      source_label: sourceLabel,
      evidence_status: status,
      document_record_id: documentRecord?.document_id ?? null,
      document_family_id: documentRecord?.document_family_id ?? null,
      ...metadata,
    },
  });
}

function factNode({ generatedAt, matterRead, matterId, sourceRecordId, label, status, issueKey, sourceLabel, metadata = {} }) {
  return buildNode({
    generatedAt,
    matterId,
    nodeType: "fact",
    sourceKind: "matter_file",
    sourceId: matterRead.source_id,
    sourcePath: matterRead.path,
    sourceRecordId,
    label,
    status,
    confidence: status.startsWith("verified") ? "verified_source_record" : "source_record_pending_review",
    metadata: {
      issue_key: issueKey,
      source_label: sourceLabel,
      ...metadata,
    },
  });
}

function buildNode({ generatedAt, matterId, nodeType, sourceKind, sourceId, sourcePath, sourceRecordId, label, status, confidence, metadata = {} }) {
  return {
    schema_version: "matter-knowledge-node.v1",
    node_id: `matter-knowledge-${nodeType}.${slugify(matterId)}.${slugify(sourceRecordId)}`,
    matter_id: matterId,
    node_type: nodeType,
    label: String(label ?? sourceRecordId),
    node_status: status ?? "pending_review",
    source_kind: sourceKind,
    source_id: sourceId,
    source_path: sourcePath ?? null,
    source_record_id: String(sourceRecordId),
    review_status: "pending_review",
    attorney_review_required: true,
    human_review_required: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    default_output_status: "pending_review",
    confidence,
    created_at: generatedAt,
    metadata,
  };
}

function addNode(nodeMap, node) {
  if (!nodeMap.has(node.node_id)) nodeMap.set(node.node_id, node);
}

function addEdge(edges, { generatedAt, matterId, fromNodeId, toNodeId, edgeType, label, metadata = {} }) {
  if (!fromNodeId || !toNodeId) return;
  const edgeId = `matter-knowledge-edge.${slugify(matterId)}.${slugify(edgeType)}.${sha256(`${fromNodeId}|${toNodeId}|${edgeType}`).slice(0, 12)}`;
  if (edges.some((edge) => edge.edge_id === edgeId)) return;
  edges.push({
    schema_version: "matter-knowledge-edge.v1",
    edge_id: edgeId,
    matter_id: matterId,
    from_node_id: fromNodeId,
    to_node_id: toNodeId,
    edge_type: edgeType,
    label,
    edge_status: "active",
    review_status: "pending_review",
    attorney_review_required: true,
    human_review_required: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    protected_action_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    created_at: generatedAt,
    metadata,
  });
}

function buildMatterSummary({ generatedAt, matter, matterRead, nodes, edges }) {
  return {
    schema_version: "matter-knowledge-summary.v1",
    matter_id: matter.matter_id,
    matter_title: matter.title ?? matter.matter_id,
    source_id: matterRead.source_id,
    source_path: matterRead.path,
    matter_knowledge_status: "complete",
    graph_node_count: nodes.length,
    graph_edge_count: edges.length,
    fact_node_count: nodes.filter((node) => node.node_type === "fact").length,
    issue_node_count: nodes.filter((node) => node.node_type === "issue").length,
    legal_theory_node_count: nodes.filter((node) => node.node_type === "legal_theory").length,
    evidence_node_count: nodes.filter((node) => node.node_type === "evidence").length,
    matter_id_scoped_node_count: nodes.filter((node) => node.matter_id === matter.matter_id).length,
    attorney_review_required_node_count: nodes.filter((node) => node.attorney_review_required === true).length,
    human_review_required_node_count: nodes.filter((node) => node.human_review_required === true).length,
    legal_advice_provided: nodes.some((node) => node.legal_advice_provided === true) || edges.some((edge) => edge.legal_advice_provided === true),
    client_facing_output_generated: nodes.some((node) => node.client_facing_output_generated === true) || edges.some((edge) => edge.client_facing_output_generated === true),
    created_at: generatedAt,
  };
}

function buildDocumentByMatterAndSource(matterDocumentIndex) {
  const records = new Map();
  for (const record of matterDocumentIndex?.document_records ?? []) {
    if (!record.matter_id || !record.source_record_id) continue;
    records.set(`${record.matter_id}|${record.source_record_id}`, record);
  }
  return records;
}

function buildCheckpoints({
  sourceReads,
  packageJson,
  roadmapText,
  matterTaskBoard,
  matterDocumentIndex,
  matterTimeline,
  matterOsProfile,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  nodes,
  edges,
  matterSummaries,
  desktopBoundary,
}) {
  const nodeIds = new Set(nodes.map((node) => node.node_id));
  const factCount = nodes.filter((node) => node.node_type === "fact").length;
  const issueCount = nodes.filter((node) => node.node_type === "issue").length;
  const theoryCount = nodes.filter((node) => node.node_type === "legal_theory").length;
  const evidenceCount = nodes.filter((node) => node.node_type === "evidence").length;
  const matterCount = matterSummaries.length;
  const roadmapMentionsP236 = typeof roadmapText === "string" && roadmapText.includes("P236");
  const packageHasScript = Boolean(packageJson?.scripts?.["matter:knowledge-graph"]);
  return [
    checkpoint("source_matter_task_board_complete", matterTaskBoard?.summary?.matter_task_board_status === "complete", "Matter Task Board source is complete."),
    checkpoint("source_matter_document_index_complete", matterDocumentIndex?.summary?.matter_document_index_status === "complete", "Matter Document Index source is complete."),
    checkpoint("source_matter_timeline_complete", matterTimeline?.summary?.matter_timeline_status === "complete", "Matter Timeline source is complete."),
    checkpoint("source_matter_os_profile_complete", matterOsProfile?.summary?.matter_os_profile_status === "complete", "Matter OS Profile source is complete."),
    checkpoint("source_output_catalog_available", outputCatalog?.schema_version === "output-artifact-catalog.v1", "Output Catalog source is available."),
    checkpoint("source_delivery_queue_available", deliveryQueue?.schema_version === "protected-delivery-queue.v1", "Protected Delivery Queue source is available."),
    checkpoint("matter_files_available", matterFileReads.length > 0 && matterFileReads.every((source) => source.available && source.value?.matter_id), "Matter files are available and matter-scoped."),
    checkpoint("source_files_available", sourceReads.every((source) => source.available), "All source artifacts and files are available."),
    checkpoint("graph_nodes_created", nodes.length > 0, "Knowledge graph nodes are created."),
    checkpoint("graph_edges_created", edges.length > 0, "Knowledge graph edges are created."),
    checkpoint("matter_summaries_created", matterCount > 0 && matterCount === matterFileReads.filter((source) => source.value?.matter_id).length, "Each matter has a knowledge summary."),
    checkpoint("fact_nodes_present", factCount > 0, "Fact nodes are present."),
    checkpoint("issue_nodes_present", issueCount > 0, "Issue nodes are present."),
    checkpoint("legal_theory_nodes_present", theoryCount > 0, "Legal theory placeholder nodes are present."),
    checkpoint("evidence_nodes_present", evidenceCount > 0, "Evidence nodes are present."),
    checkpoint("each_matter_has_fact_issue_theory_evidence", matterSummaries.every((summary) => summary.fact_node_count > 0 && summary.issue_node_count > 0 && summary.legal_theory_node_count > 0 && summary.evidence_node_count > 0), "Each matter has fact, issue, legal theory, and evidence nodes."),
    checkpoint("nodes_matter_id_scoped", nodes.every((node) => Boolean(node.matter_id)), "Every node carries a matter_id."),
    checkpoint("edges_matter_id_scoped", edges.every((edge) => Boolean(edge.matter_id)), "Every edge carries a matter_id."),
    checkpoint("edges_link_existing_nodes", edges.every((edge) => nodeIds.has(edge.from_node_id) && nodeIds.has(edge.to_node_id)), "Every edge links existing nodes."),
    checkpoint("attorney_review_preserved", nodes.every((node) => node.attorney_review_required === true) && edges.every((edge) => edge.attorney_review_required === true), "Attorney review is required for all graph rows."),
    checkpoint("human_review_preserved", nodes.every((node) => node.human_review_required === true) && edges.every((edge) => edge.human_review_required === true), "Human review is required for all graph rows."),
    checkpoint("legal_theory_placeholders_only", nodes.filter((node) => node.node_type === "legal_theory").every((node) => node.metadata.legal_theory_kind === "review_placeholder" && node.metadata.legal_conclusion_provided === false), "Legal theory nodes are placeholders only."),
    checkpoint("no_legal_or_client_output", nodes.every((node) => node.legal_advice_provided === false && node.client_facing_output_generated === false) && edges.every((edge) => edge.legal_advice_provided === false && edge.client_facing_output_generated === false), "No legal advice or client-facing output is generated."),
    checkpoint("desktop_boundary_enforced", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.mutation_allowed === false, "Desktop boundary is read-only."),
    checkpoint("no_mutating_actions_allowed", desktopBoundary.matter_data_write_allowed === false && desktopBoundary.task_state_write_allowed === false && desktopBoundary.workflow_transition_allowed === false && desktopBoundary.runtime_execution_allowed === false && desktopBoundary.delivery_execution_allowed === false && desktopBoundary.protected_action_allowed === false, "Matter data writes, task writes, workflow transitions, runtime, delivery, and protected actions are disallowed."),
    checkpoint("package_script_registered", packageHasScript, "matter:knowledge-graph package script is registered."),
    checkpoint("roadmap_slot_present", roadmapMentionsP236, "Roadmap ledger still tracks P236 until promotion."),
  ];
}

function summarizeMatterKnowledgeGraph({
  matterTaskBoard,
  matterDocumentIndex,
  matterTimeline,
  matterOsProfile,
  outputCatalog,
  deliveryQueue,
  matterFileReads,
  nodes,
  edges,
  matterSummaries,
  desktopBoundary,
  checkpoints,
  validation,
}) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const graphNodeCount = nodes.length;
  const graphEdgeCount = edges.length;
  const matterCount = matterSummaries.length;
  const factNodeCount = nodes.filter((node) => node.node_type === "fact").length;
  const issueNodeCount = nodes.filter((node) => node.node_type === "issue").length;
  const legalTheoryNodeCount = nodes.filter((node) => node.node_type === "legal_theory").length;
  const evidenceNodeCount = nodes.filter((node) => node.node_type === "evidence").length;
  const complete = validation.valid
    && failedCheckpointCount === 0
    && matterCount > 0
    && graphNodeCount > 0
    && graphEdgeCount > 0
    && factNodeCount > 0
    && issueNodeCount > 0
    && legalTheoryNodeCount > 0
    && evidenceNodeCount > 0
    && matterSummaries.every((summary) => summary.fact_node_count > 0 && summary.issue_node_count > 0 && summary.legal_theory_node_count > 0 && summary.evidence_node_count > 0)
    && nodes.every((node) => node.matter_id && node.attorney_review_required === true && node.human_review_required === true)
    && edges.every((edge) => edge.matter_id && edge.attorney_review_required === true && edge.human_review_required === true);
  return {
    matter_knowledge_graph_status: complete ? "complete" : "blocked",
    matter_knowledge_graph_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_task_board_status: matterTaskBoard?.summary?.matter_task_board_status ?? "unknown",
    source_matter_document_index_status: matterDocumentIndex?.summary?.matter_document_index_status ?? "unknown",
    source_matter_timeline_status: matterTimeline?.summary?.matter_timeline_status ?? "unknown",
    source_matter_os_profile_status: matterOsProfile?.summary?.matter_os_profile_status ?? "unknown",
    source_output_catalog_status: outputCatalog?.schema_version === "output-artifact-catalog.v1" ? "complete" : "unknown",
    source_delivery_queue_status: deliveryQueue?.schema_version === "protected-delivery-queue.v1" ? "complete" : "unknown",
    matter_file_count: matterFileReads.length,
    available_matter_file_count: matterFileReads.filter((source) => source.available).length,
    matter_count: matterCount,
    matter_summary_count: matterSummaries.length,
    graph_node_count: graphNodeCount,
    graph_edge_count: graphEdgeCount,
    matter_node_count: nodes.filter((node) => node.node_type === "matter").length,
    fact_node_count: factNodeCount,
    issue_node_count: issueNodeCount,
    legal_theory_node_count: legalTheoryNodeCount,
    evidence_node_count: evidenceNodeCount,
    matter_with_fact_count: matterSummaries.filter((summary) => summary.fact_node_count > 0).length,
    matter_with_issue_count: matterSummaries.filter((summary) => summary.issue_node_count > 0).length,
    matter_with_legal_theory_count: matterSummaries.filter((summary) => summary.legal_theory_node_count > 0).length,
    matter_with_evidence_count: matterSummaries.filter((summary) => summary.evidence_node_count > 0).length,
    matter_id_scoped_node_count: nodes.filter((node) => Boolean(node.matter_id)).length,
    matter_id_scoped_edge_count: edges.filter((edge) => Boolean(edge.matter_id)).length,
    attorney_review_required_node_count: nodes.filter((node) => node.attorney_review_required === true).length,
    attorney_review_required_edge_count: edges.filter((edge) => edge.attorney_review_required === true).length,
    human_review_required_node_count: nodes.filter((node) => node.human_review_required === true).length,
    human_review_required_edge_count: edges.filter((edge) => edge.human_review_required === true).length,
    legal_theory_placeholder_count: nodes.filter((node) => node.node_type === "legal_theory" && node.metadata.legal_theory_kind === "review_placeholder").length,
    fact_evidence_edge_count: edges.filter((edge) => edge.edge_type === "fact_supported_by_evidence").length,
    issue_evidence_edge_count: edges.filter((edge) => edge.edge_type === "evidence_relates_to_issue" || edge.edge_type === "evidence_gap_for_issue").length,
    legal_theory_issue_edge_count: edges.filter((edge) => edge.edge_type === "legal_theory_frames_issue").length,
    task_context_edge_count: edges.filter((edge) => edge.edge_type === "issue_has_task_board_context").length,
    legal_advice_provided: nodes.some((node) => node.legal_advice_provided === true) || edges.some((edge) => edge.legal_advice_provided === true),
    client_facing_output_generated: nodes.some((node) => node.client_facing_output_generated === true) || edges.some((edge) => edge.client_facing_output_generated === true),
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.mutation_allowed,
    desktop_source_of_truth: desktopBoundary.source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    failed_checkpoint_count: failedCheckpointCount,
    validation_item_count: checkpoints.length,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    protected_mutation_executed: false,
    secret_material_exposed: false,
    provider_key_visible: false,
  };
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "matter-knowledge-graph-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    mutation_allowed: false,
    source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    legal_advice_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    allowed_operations: [
      "read_graph_nodes",
      "read_graph_edges",
      "read_matter_summaries",
      "read_boundary_status",
    ],
    blocked_operations: [
      "write_matter_data",
      "mutate_task_state",
      "transition_workflow_state",
      "execute_runtime_action",
      "deliver_output",
      "provide_legal_advice",
      "generate_client_facing_output_without_attorney_review",
    ],
    created_at: generatedAt,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  const contracts = {};
  for (const source of sourceReads) {
    contracts[source.source_id] = {
      schema_version: source.value?.schema_version ?? null,
      source_kind: source.source_kind,
      path: source.path,
      available: source.available,
      content_hash: source.content_hash,
      error: source.error,
    };
  }
  contracts.package_json = {
    schema_version: null,
    path: packageJson.path,
    available: packageJson.available,
    content_hash: packageJson.content_hash,
    error: packageJson.error,
  };
  contracts.roadmap = {
    schema_version: null,
    path: roadmapText.path,
    available: roadmapText.available,
    content_hash: roadmapText.content_hash,
    error: roadmapText.error,
  };
  return contracts;
}

async function readSourceArtifacts(inputs) {
  const sources = [
    { source_id: "matter_task_board", source_kind: "artifact", path: inputs.matter_task_board_path },
    { source_id: "matter_document_index", source_kind: "artifact", path: inputs.matter_document_index_path },
    { source_id: "matter_timeline", source_kind: "artifact", path: inputs.matter_timeline_path },
    { source_id: "matter_os_profile", source_kind: "artifact", path: inputs.matter_os_profile_path },
    { source_id: "output_catalog", source_kind: "artifact", path: inputs.output_catalog_path },
    { source_id: "delivery_queue", source_kind: "artifact", path: inputs.delivery_queue_path },
    ...inputs.matter_files.map((matterPath, index) => ({
      source_id: `matter_file_${index + 1}`,
      source_kind: "matter_file",
      path: matterPath,
    })),
  ];
  return Promise.all(sources.map(readSource));
}

async function readSource(source) {
  const result = await readJsonOrError(source.path);
  return {
    ...source,
    available: result.available,
    value: result.value,
    error: result.error,
    content_hash: result.content_hash,
  };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      value: JSON.parse(raw),
      error: null,
      content_hash: `sha256:${sha256(raw)}`,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: null,
      error: error.message,
      content_hash: null,
    };
  }
}

async function readTextOrError(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return {
      path: filePath,
      available: true,
      value: raw,
      error: null,
      content_hash: `sha256:${sha256(raw)}`,
    };
  } catch (error) {
    return {
      path: filePath,
      available: false,
      value: null,
      error: error.message,
      content_hash: null,
    };
  }
}

function normalizeInputs(options) {
  return {
    matter_task_board_path: path.resolve(options.matterTaskBoardPath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.matterTaskBoardPath),
    matter_document_index_path: path.resolve(options.matterDocumentIndexPath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.matterDocumentIndexPath),
    matter_timeline_path: path.resolve(options.matterTimelinePath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.matterTimelinePath),
    matter_os_profile_path: path.resolve(options.matterOsProfilePath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.matterOsProfilePath),
    matter_files: (options.matterFiles ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.matterFiles).map((matterPath) => path.resolve(matterPath)),
    output_catalog_path: path.resolve(options.outputCatalogPath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.outputCatalogPath),
    delivery_queue_path: path.resolve(options.deliveryQueuePath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.deliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_MATTER_KNOWLEDGE_GRAPH_INPUTS.roadmapPath),
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
    else if (arg === "--matter-task-board") parsed.matterTaskBoardPath = argv[++index];
    else if (arg === "--matter-document-index") parsed.matterDocumentIndexPath = argv[++index];
    else if (arg === "--matter-timeline") parsed.matterTimelinePath = argv[++index];
    else if (arg === "--matter-os-profile") parsed.matterOsProfilePath = argv[++index];
    else if (arg === "--matter-file") {
      parsed.matterFiles = parsed.matterFiles ?? [];
      parsed.matterFiles.push(argv[++index]);
    } else if (arg === "--output-catalog") parsed.outputCatalogPath = argv[++index];
    else if (arg === "--delivery-queue") parsed.deliveryQueuePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/matter-knowledge-graph.mjs [options]

Options:
  --check                         Fail if validation does not pass
  --out-dir <path>                Output directory
  --matter-task-board <path>      Matter Task Board artifact
  --matter-document-index <path>  Matter Document Index artifact
  --matter-timeline <path>        Matter Timeline artifact
  --matter-os-profile <path>      Matter OS Profile artifact
  --matter-file <path>            Matter file; may be repeated
  --output-catalog <path>         Output catalog artifact
  --delivery-queue <path>         Protected delivery queue artifact
  --package <path>                package.json path
  --roadmap <path>                roadmap/ledger path
  --run-at <iso>                  Deterministic generated_at timestamp
`);
}

function renderMatterKnowledgeGraphMarkdown(result) {
  const lines = [];
  lines.push("# Matter Knowledge Graph");
  lines.push("");
  lines.push(`Generated at: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.matter_knowledge_graph_status}`);
  lines.push(`Matters: ${result.summary.matter_count}`);
  lines.push(`Nodes: ${result.summary.graph_node_count}`);
  lines.push(`Edges: ${result.summary.graph_edge_count}`);
  lines.push(`Fact / Issue / Legal theory / Evidence: ${result.summary.fact_node_count} / ${result.summary.issue_node_count} / ${result.summary.legal_theory_node_count} / ${result.summary.evidence_node_count}`);
  lines.push(`Desktop boundary: ${result.summary.desktop_boundary_status}, read-only=${result.summary.desktop_read_only}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("| Matter | Facts | Issues | Legal theories | Evidence | Edges |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const summary of result.matter_knowledge_summaries) {
    lines.push(`| ${summary.matter_id} | ${summary.fact_node_count} | ${summary.issue_node_count} | ${summary.legal_theory_node_count} | ${summary.evidence_node_count} | ${summary.graph_edge_count} |`);
  }
  lines.push("");
  lines.push("Human review note: Matter Knowledge Graph rows are operational context only. Legal theory nodes are attorney-review placeholders, not legal conclusions or advice. This artifact does not generate client-facing output, write matter data, mutate task state, transition workflow state, execute runtime actions, or deliver outputs.");
  return `${lines.join("\n")}\n`;
}

function serializableMatterKnowledgeGraph(result) {
  const { markdown: _markdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
      status: item.status,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    checkpoint_id: checkpointId,
    checkpoint_status: passed ? "passed" : "failed",
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

function issueKeyFromTask(task) {
  return issueKeyFromText(task.metadata?.issue ?? task.task_title ?? task.task_category ?? task.source_record_id);
}

function issueKeyFromText(...values) {
  const text = values.filter(Boolean).join(" ").toLowerCase();
  if (text.includes("attendance") || text.includes("travel") || text.includes("board minutes") || text.includes("cl-001")) return "attendance";
  if (text.includes("causation") || text.includes("loss") || text.includes("damages") || text.includes("cl-002")) return "causation";
  if (text.includes("tax") || text.includes("related-party") || text.includes("related party")) return "tax";
  if (text.includes("disclosure") || text.includes("bring-down") || text.includes("schedule")) return "closing";
  if (text.includes("indemnity") || text.includes("escrow") || text.includes("cap")) return "indemnity";
  if (text.includes("certificate")) return "closing";
  return slugify(values.find(Boolean) ?? "general");
}

function uniqueNodes(nodes) {
  const map = new Map();
  for (const node of nodes) {
    if (!map.has(node.node_id)) map.set(node.node_id, node);
  }
  return [...map.values()];
}

function groupBy(items, key) {
  const grouped = new Map();
  for (const item of items ?? []) {
    const value = item?.[key];
    if (!value) continue;
    const list = grouped.get(value) ?? [];
    list.push(item);
    grouped.set(value, list);
  }
  return grouped;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function compareNodes(left, right) {
  return String(left.matter_id).localeCompare(String(right.matter_id))
    || String(left.node_type).localeCompare(String(right.node_type))
    || String(left.node_id).localeCompare(String(right.node_id));
}

function compareEdges(left, right) {
  return String(left.matter_id).localeCompare(String(right.matter_id))
    || String(left.edge_type).localeCompare(String(right.edge_type))
    || String(left.edge_id).localeCompare(String(right.edge_id));
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}
