import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_EVIDENCE_CONTRACT_FREEZE_OUT_DIR = "artifacts/evidence-contract-freeze/latest";
export const DEFAULT_EVIDENCE_CONTRACT_FREEZE_INPUTS = {
  lawFirmSlicePath: "artifacts/law-firm-ldd-slice/latest/law-firm-ldd-slice.json",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  matterContractFreezePath: "artifacts/matter-contract-freeze/latest/matter-contract-freeze.json",
  policyContractFreezePath: "artifacts/policy-contract-freeze/latest/policy-contract-freeze.json",
};

const CLASSIFICATIONS = new Set([
  "P0_PUBLIC",
  "P1_INTERNAL",
  "P2_CLIENT_CONFIDENTIAL",
  "P3_PRIVILEGED",
  "P4_HIGHLY_RESTRICTED",
  "P5_SECRET",
]);

const SOURCE_SPAN_TYPES = new Set(["page", "paragraph", "line", "cell", "slide", "timestamp", "message", "whole_document"]);
const EVIDENCE_TYPES = new Set(["document_text", "table", "email_statement", "meeting_statement", "metadata", "computed"]);
const RELIABILITY_LEVELS = new Set(["unknown", "client_provided", "counterparty_provided", "public_record", "attorney_verified", "machine_extracted"]);
const REVIEW_STATUSES = new Set(["needs_review", "approved", "rejected", "changes_requested", "waived"]);
const FACT_TYPES = new Set(["party", "date", "amount", "obligation", "approval", "risk_signal", "missing_document", "procedural_event", "general"]);
const ISSUE_TYPES = new Set(["ldd_red_flag", "ldd_yellow_flag", "rfi", "litigation_evidence", "contract_gap", "deadline", "development_task", "general"]);
const SEVERITIES = new Set(["info", "low", "medium", "high", "critical"]);
const ISSUE_STATUSES = new Set(["candidate", "open", "reviewed", "resolved", "rejected"]);
const CITATION_STATUSES = new Set(["candidate", "verified", "needs_review", "rejected"]);
const LINEAGE_RELATIONS = new Set([
  "resource_contains_source_span",
  "source_span_supports_evidence",
  "evidence_supports_fact",
  "fact_raises_issue",
  "source_span_cited_by_citation",
  "evidence_cited_by_citation",
  "fact_cited_by_citation",
  "issue_cited_by_citation",
]);

export async function runEvidenceContractFreeze(options = {}) {
  const result = await buildEvidenceContractFreeze(options);
  if (options.write !== false) await writeEvidenceContractFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Evidence contract freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildEvidenceContractFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_EVIDENCE_CONTRACT_FREEZE_OUT_DIR);
  const inputs = {
    law_firm_slice_path: path.resolve(options.lawFirmSlicePath ?? DEFAULT_EVIDENCE_CONTRACT_FREEZE_INPUTS.lawFirmSlicePath),
    resource_contract_freeze_path: path.resolve(options.resourceContractFreezePath ?? DEFAULT_EVIDENCE_CONTRACT_FREEZE_INPUTS.resourceContractFreezePath),
    matter_contract_freeze_path: path.resolve(options.matterContractFreezePath ?? DEFAULT_EVIDENCE_CONTRACT_FREEZE_INPUTS.matterContractFreezePath),
    policy_contract_freeze_path: path.resolve(options.policyContractFreezePath ?? DEFAULT_EVIDENCE_CONTRACT_FREEZE_INPUTS.policyContractFreezePath),
  };
  const lawFirmSource = await readJson(inputs.law_firm_slice_path);
  const resourceContractFreeze = await readJson(inputs.resource_contract_freeze_path);
  const matterContractFreeze = await readJson(inputs.matter_contract_freeze_path);
  const policyContractFreeze = await readJson(inputs.policy_contract_freeze_path);
  const lawFirmSlice = lawFirmSource.law_firm_slice ?? lawFirmSource;
  const resourceEvidence = lawFirmSlice.schema_version === "resource-evidence.v1"
    ? lawFirmSlice
    : lawFirmSlice.resource_evidence;
  if (!resourceEvidence) throw new Error("Input must be a law-firm slice or resource-evidence.v1 artifact.");

  const projection = projectEvidenceContracts({
    resourceEvidence,
    governanceOutput: lawFirmSlice.governance_output,
    resourceContractFreeze,
    matterContractFreeze,
    policyContractFreeze,
    generatedAt,
  });
  const validationItems = validateEvidenceContracts({
    resourceEvidence,
    resourceContractFreeze,
    matterContractFreeze,
    policyContractFreeze,
    ...projection,
  });
  const validation = summarizeValidation(validationItems, projection);
  const result = {
    schema_version: "evidence-contract-freeze.v1",
    generated_at: generatedAt,
    freeze_id: `evidence-contract-freeze.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      law_firm_slice: {
        schema_version: lawFirmSlice.schema_version ?? resourceEvidence.schema_version,
        resource_evidence_schema_version: resourceEvidence.schema_version,
        governance_output_schema_version: lawFirmSlice.governance_output?.schema_version ?? null,
      },
      resource_contract_freeze: {
        schema_version: resourceContractFreeze.schema_version,
        freeze_id: resourceContractFreeze.freeze_id,
        freeze_status: resourceContractFreeze.summary?.freeze_status ?? null,
      },
      matter_contract_freeze: {
        schema_version: matterContractFreeze.schema_version,
        freeze_id: matterContractFreeze.freeze_id,
        freeze_status: matterContractFreeze.summary?.freeze_status ?? null,
      },
      policy_contract_freeze: {
        schema_version: policyContractFreeze.schema_version,
        freeze_id: policyContractFreeze.freeze_id,
        freeze_status: policyContractFreeze.summary?.freeze_status ?? null,
      },
    },
    contract_versions: {
      source_span_schema_version: "source-span.v2",
      evidence_item_schema_version: "evidence-item.v2",
      fact_claim_schema_version: "fact-claim.v2",
      issue_schema_version: "issue.v2",
      citation_schema_version: "citation.v2",
      lineage_edge_schema_version: "evidence-lineage-edge.v2",
      compatibility_floor: "resource-evidence.v1+governance-output.v1",
    },
    summary: summarizeFreeze(projection, validationItems, validation),
    evidence_contract: {
      schema_version: "evidence-contract.v2",
      generated_at: generatedAt,
      source_spans: projection.sourceSpansV2,
      evidence_items: projection.evidenceItemsV2,
      fact_claims: projection.factClaimsV2,
      issues: projection.issuesV2,
      citations: projection.citationsV2,
      lineage_edges: projection.lineageEdgesV2,
    },
    validation_items: validationItems,
    validation,
  };

  return {
    ...result,
    markdown: renderEvidenceContractFreezeMarkdown(result),
  };
}

export async function writeEvidenceContractFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableFreeze(result);
  await writeJson(path.join(outDir, "evidence-contract-freeze.json"), serializable);
  await writeJson(path.join(outDir, "source-span-v2-fixture.json"), {
    generated_at: result.generated_at,
    source_span_schema_version: result.contract_versions.source_span_schema_version,
    source_span_count: result.evidence_contract.source_spans.length,
    source_spans: result.evidence_contract.source_spans,
  });
  await writeJson(path.join(outDir, "evidence-item-v2-fixture.json"), {
    generated_at: result.generated_at,
    evidence_item_schema_version: result.contract_versions.evidence_item_schema_version,
    evidence_item_count: result.evidence_contract.evidence_items.length,
    evidence_items: result.evidence_contract.evidence_items,
  });
  await writeJson(path.join(outDir, "fact-claim-v2-fixture.json"), {
    generated_at: result.generated_at,
    fact_claim_schema_version: result.contract_versions.fact_claim_schema_version,
    fact_claim_count: result.evidence_contract.fact_claims.length,
    fact_claims: result.evidence_contract.fact_claims,
  });
  await writeJson(path.join(outDir, "issue-v2-fixture.json"), {
    generated_at: result.generated_at,
    issue_schema_version: result.contract_versions.issue_schema_version,
    issue_count: result.evidence_contract.issues.length,
    issues: result.evidence_contract.issues,
  });
  await writeJson(path.join(outDir, "citation-v2-fixture.json"), {
    generated_at: result.generated_at,
    citation_schema_version: result.contract_versions.citation_schema_version,
    citation_count: result.evidence_contract.citations.length,
    citations: result.evidence_contract.citations,
  });
  await writeJson(path.join(outDir, "lineage-edge-v2-fixture.json"), {
    generated_at: result.generated_at,
    lineage_edge_schema_version: result.contract_versions.lineage_edge_schema_version,
    lineage_edge_count: result.evidence_contract.lineage_edges.length,
    lineage_edges: result.evidence_contract.lineage_edges,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    freeze_id: result.freeze_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runEvidenceContractFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runEvidenceContractFreeze(args);
    console.log(`Evidence contract freeze written to ${result.output_dir}`);
    console.log(`Source spans v2: ${result.summary.source_span_count}`);
    console.log(`Evidence items v2: ${result.summary.evidence_item_count}`);
    console.log(`Citations v2: ${result.summary.citation_count}`);
    console.log(`Complete citation paths: ${result.summary.complete_lineage_path_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function projectEvidenceContracts({
  resourceEvidence,
  governanceOutput,
  resourceContractFreeze,
  matterContractFreeze,
  policyContractFreeze,
  generatedAt,
}) {
  const sourceResourcesById = new Map((resourceEvidence.resources ?? []).map((resource) => [resource.id, resource]));
  const sourceVersionsById = new Map((resourceEvidence.resource_versions ?? []).map((version) => [version.id, version]));
  const normalizedByResourceVersion = new Map((resourceEvidence.normalized_texts ?? []).map((text) => [text.resource_version_id, text]));
  const resourceV2ById = new Map((resourceContractFreeze.resource_contract?.resources ?? []).map((resource) => [resource.resource_id, resource]));
  const matterById = new Map((matterContractFreeze.matter_contract?.matters ?? []).map((matter) => [matter.matter_id, matter]));
  const policyReferenceBySubject = new Map((policyContractFreeze.policy_contract?.policy_references ?? []).map((reference) => [`${reference.subject_type}:${reference.subject_id}`, reference]));
  const policySnapshotIds = new Set((policyContractFreeze.policy_contract?.policy_references ?? [])
    .map((reference) => reference.policy_snapshot_id)
    .filter(Boolean));

  const sourceSpansV2 = (resourceEvidence.source_spans ?? []).map((span) => {
    const sourceResource = sourceResourcesById.get(span.resource_id);
    const resource = resourceV2ById.get(span.resource_id);
    const version = sourceVersionsById.get(span.resource_version_id);
    const normalizedText = normalizedByResourceVersion.get(span.resource_version_id);
    const matterId = resource?.matter_id ?? sourceResource?.matter_id ?? null;
    const matter = matterById.get(matterId);
    const policyReference = policyReferenceBySubject.get(`resource:${span.resource_id}`);
    return {
      schema_version: "source-span.v2",
      source_span_id: span.id,
      resource_id: span.resource_id,
      resource_version_id: span.resource_version_id,
      normalized_text_id: normalizedText?.id ?? null,
      tenant_id: resource?.tenant_id ?? sourceResource?.tenant_id ?? matter?.tenant_id ?? null,
      matter_id: matterId,
      classification: resource?.classification ?? sourceResource?.classification ?? null,
      policy_snapshot_id: policyReference?.policy_snapshot_id ?? resource?.policy_snapshot_id ?? null,
      location_type: span.location_type,
      locator: span.locator ?? {},
      text_hash: span.hash,
      content_preview: truncate(span.text, 500),
      lineage_root_id: `lineage-root.${slugify(span.id)}`,
      created_at: version?.created_at ?? sourceResource?.created_at ?? generatedAt,
      metadata: {
        ...(span.metadata ?? {}),
        source_schema_version: span.schema_version,
        text_length: String(span.text ?? "").length,
      },
    };
  }).sort((left, right) => left.source_span_id.localeCompare(right.source_span_id));

  const spanById = new Map(sourceSpansV2.map((span) => [span.source_span_id, span]));
  const evidenceItemsV2 = (resourceEvidence.evidence_items ?? []).map((evidence) => {
    const spans = evidence.source_span_ids.map((spanId) => spanById.get(spanId)).filter(Boolean);
    const primarySpan = spans[0];
    return {
      schema_version: "evidence-item.v2",
      evidence_id: evidence.id,
      tenant_id: primarySpan?.tenant_id ?? matterById.get(evidence.matter_id)?.tenant_id ?? null,
      matter_id: evidence.matter_id,
      classification: primarySpan?.classification ?? null,
      policy_snapshot_id: primarySpan?.policy_snapshot_id ?? null,
      evidence_type: evidence.evidence_type,
      source_span_ids: evidence.source_span_ids,
      source_span_count: evidence.source_span_ids.length,
      summary: evidence.summary,
      reliability: evidence.reliability,
      review_status: evidence.review_status,
      verification_state: verificationStateForEvidence(evidence),
      privilege_flag: Boolean(evidence.metadata?.privilege_flag),
      redaction_state: evidence.metadata?.redaction_state ?? "raw",
      lineage_id: `lineage.evidence.${slugify(evidence.id)}`,
      created_at: generatedAt,
      metadata: {
        ...(evidence.metadata ?? {}),
        source_schema_version: evidence.schema_version,
      },
    };
  }).sort((left, right) => left.evidence_id.localeCompare(right.evidence_id));

  const evidenceById = new Map(evidenceItemsV2.map((evidence) => [evidence.evidence_id, evidence]));
  const factClaimsV2 = (resourceEvidence.facts ?? []).map((fact) => {
    const evidenceItems = fact.evidence_item_ids.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean);
    const primaryEvidence = evidenceItems[0];
    return {
      schema_version: "fact-claim.v2",
      fact_id: fact.id,
      tenant_id: primaryEvidence?.tenant_id ?? matterById.get(fact.matter_id)?.tenant_id ?? null,
      matter_id: fact.matter_id,
      classification: highestClassification(evidenceItems.map((evidence) => evidence.classification)),
      policy_snapshot_id: primaryEvidence?.policy_snapshot_id ?? null,
      evidence_item_ids: fact.evidence_item_ids,
      evidence_item_count: fact.evidence_item_ids.length,
      statement: fact.statement,
      fact_type: fact.fact_type,
      confidence: fact.confidence,
      review_status: fact.review_status,
      verification_state: verificationStateForReview(fact.review_status),
      lineage_id: `lineage.fact.${slugify(fact.id)}`,
      created_at: generatedAt,
      metadata: {
        ...(fact.metadata ?? {}),
        source_schema_version: fact.schema_version,
      },
    };
  }).sort((left, right) => left.fact_id.localeCompare(right.fact_id));

  const factById = new Map(factClaimsV2.map((fact) => [fact.fact_id, fact]));
  const factEvidenceIds = new Map(factClaimsV2.map((fact) => [fact.fact_id, new Set(fact.evidence_item_ids)]));
  const issuesV2 = (resourceEvidence.issues ?? []).map((issue) => {
    const facts = issue.linked_fact_ids.map((factId) => factById.get(factId)).filter(Boolean);
    const evidenceIds = unique(facts.flatMap((fact) => fact.evidence_item_ids)).sort();
    const primaryFact = facts[0];
    return {
      schema_version: "issue.v2",
      issue_id: issue.id,
      tenant_id: primaryFact?.tenant_id ?? matterById.get(issue.matter_id)?.tenant_id ?? null,
      matter_id: issue.matter_id,
      classification: highestClassification(facts.map((fact) => fact.classification)),
      policy_snapshot_id: primaryFact?.policy_snapshot_id ?? null,
      issue_type: issue.issue_type,
      title: issue.title,
      linked_fact_ids: issue.linked_fact_ids,
      linked_fact_count: issue.linked_fact_ids.length,
      evidence_item_ids: evidenceIds,
      evidence_item_count: evidenceIds.length,
      severity: issue.severity,
      status: issue.status,
      lineage_id: `lineage.issue.${slugify(issue.id)}`,
      created_at: generatedAt,
      metadata: {
        ...(issue.metadata ?? {}),
        source_schema_version: issue.schema_version,
      },
    };
  }).sort((left, right) => left.issue_id.localeCompare(right.issue_id));

  const issueById = new Map(issuesV2.map((issue) => [issue.issue_id, issue]));
  const outputArtifactById = new Map((governanceOutput?.output_artifacts ?? []).map((artifact) => [artifact.id, artifact]));
  const citationsV2 = (resourceEvidence.citations ?? []).map((citation) => {
    const evidenceItems = citation.evidence_item_ids.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean);
    const linkedFactIds = factClaimsV2
      .filter((fact) => fact.evidence_item_ids.some((evidenceId) => citation.evidence_item_ids.includes(evidenceId)))
      .map((fact) => fact.fact_id);
    const explicitIssueIds = [citation.metadata?.issue_id].filter(Boolean);
    const linkedIssueIds = unique([
      ...explicitIssueIds,
      ...issuesV2.filter((issue) => issue.linked_fact_ids.some((factId) => linkedFactIds.includes(factId))).map((issue) => issue.issue_id),
    ]).sort();
    const primaryEvidence = evidenceItems[0];
    const outputArtifact = outputArtifactById.get(citation.output_artifact_id);
    const lineagePathIds = unique([
      ...citation.source_span_ids,
      ...citation.evidence_item_ids,
      ...linkedFactIds,
      ...linkedIssueIds,
      citation.id,
    ]);
    return {
      schema_version: "citation.v2",
      citation_id: citation.id,
      tenant_id: outputArtifact?.tenant_id ?? primaryEvidence?.tenant_id ?? null,
      matter_id: outputArtifact?.matter_id ?? primaryEvidence?.matter_id ?? null,
      classification: highestClassification(evidenceItems.map((evidence) => evidence.classification)),
      policy_snapshot_id: primaryEvidence?.policy_snapshot_id ?? null,
      output_artifact_id: citation.output_artifact_id,
      target_path: citation.target_path,
      source_span_ids: citation.source_span_ids,
      evidence_item_ids: citation.evidence_item_ids,
      linked_fact_ids: linkedFactIds.sort(),
      linked_issue_ids: linkedIssueIds,
      citation_status: citation.citation_status,
      citation_binding_status: isCitationBound(citation, { spanById, evidenceById, factEvidenceIds, issueById }) ? "bound" : "broken",
      lineage_path_ids: lineagePathIds,
      created_at: generatedAt,
      metadata: {
        ...(citation.metadata ?? {}),
        source_schema_version: citation.schema_version,
      },
    };
  }).sort((left, right) => left.citation_id.localeCompare(right.citation_id));

  const lineageEdgesV2 = buildLineageEdges({
    sourceSpansV2,
    evidenceItemsV2,
    factClaimsV2,
    issuesV2,
    citationsV2,
    generatedAt,
  });

  return {
    sourceSpansV2,
    evidenceItemsV2,
    factClaimsV2,
    issuesV2,
    citationsV2,
    lineageEdgesV2,
    policySnapshotIds,
  };
}

function buildLineageEdges({ sourceSpansV2, evidenceItemsV2, factClaimsV2, issuesV2, citationsV2, generatedAt }) {
  const spanById = new Map(sourceSpansV2.map((span) => [span.source_span_id, span]));
  const evidenceById = new Map(evidenceItemsV2.map((evidence) => [evidence.evidence_id, evidence]));
  const factById = new Map(factClaimsV2.map((fact) => [fact.fact_id, fact]));
  const edges = [];
  const pushEdge = (fromType, fromId, toType, toId, relation, context = {}) => {
    if (!fromId || !toId) return;
    const edge = {
      schema_version: "evidence-lineage-edge.v2",
      lineage_edge_id: `lineage-edge.${slugify(fromType)}.${slugify(fromId)}.${slugify(relation)}.${slugify(toType)}.${slugify(toId)}`,
      from_type: fromType,
      from_id: fromId,
      to_type: toType,
      to_id: toId,
      relation,
      tenant_id: context.tenant_id ?? null,
      matter_id: context.matter_id ?? null,
      classification: context.classification ?? null,
      edge_status: "linked",
      created_at: generatedAt,
      metadata: context.metadata ?? {},
    };
    edges.push(edge);
  };

  for (const span of sourceSpansV2) {
    pushEdge("resource", span.resource_id, "source_span", span.source_span_id, "resource_contains_source_span", span);
  }
  for (const evidence of evidenceItemsV2) {
    for (const spanId of evidence.source_span_ids) {
      const span = spanById.get(spanId);
      pushEdge("source_span", spanId, "evidence_item", evidence.evidence_id, "source_span_supports_evidence", {
        tenant_id: evidence.tenant_id ?? span?.tenant_id,
        matter_id: evidence.matter_id ?? span?.matter_id,
        classification: evidence.classification ?? span?.classification,
      });
    }
  }
  for (const fact of factClaimsV2) {
    for (const evidenceId of fact.evidence_item_ids) {
      const evidence = evidenceById.get(evidenceId);
      pushEdge("evidence_item", evidenceId, "fact_claim", fact.fact_id, "evidence_supports_fact", {
        tenant_id: fact.tenant_id ?? evidence?.tenant_id,
        matter_id: fact.matter_id ?? evidence?.matter_id,
        classification: fact.classification ?? evidence?.classification,
      });
    }
  }
  for (const issue of issuesV2) {
    for (const factId of issue.linked_fact_ids) {
      const fact = factById.get(factId);
      pushEdge("fact_claim", factId, "issue", issue.issue_id, "fact_raises_issue", {
        tenant_id: issue.tenant_id ?? fact?.tenant_id,
        matter_id: issue.matter_id ?? fact?.matter_id,
        classification: issue.classification ?? fact?.classification,
      });
    }
  }
  for (const citation of citationsV2) {
    for (const spanId of citation.source_span_ids) {
      pushEdge("source_span", spanId, "citation", citation.citation_id, "source_span_cited_by_citation", citation);
    }
    for (const evidenceId of citation.evidence_item_ids) {
      pushEdge("evidence_item", evidenceId, "citation", citation.citation_id, "evidence_cited_by_citation", citation);
    }
    for (const factId of citation.linked_fact_ids) {
      pushEdge("fact_claim", factId, "citation", citation.citation_id, "fact_cited_by_citation", citation);
    }
    for (const issueId of citation.linked_issue_ids) {
      pushEdge("issue", issueId, "citation", citation.citation_id, "issue_cited_by_citation", citation);
    }
  }

  return [...new Map(edges.map((edge) => [edge.lineage_edge_id, edge])).values()]
    .sort((left, right) => left.lineage_edge_id.localeCompare(right.lineage_edge_id));
}

function validateEvidenceContracts({
  resourceEvidence,
  resourceContractFreeze,
  matterContractFreeze,
  policyContractFreeze,
  sourceSpansV2,
  evidenceItemsV2,
  factClaimsV2,
  issuesV2,
  citationsV2,
  lineageEdgesV2,
  policySnapshotIds,
}) {
  const validationItems = [];
  const sourceResourceIds = new Set((resourceEvidence.resources ?? []).map((resource) => resource.id));
  const sourceResourceVersionIds = new Set((resourceEvidence.resource_versions ?? []).map((version) => version.id));
  const resourceV2Ids = new Set((resourceContractFreeze.resource_contract?.resources ?? []).map((resource) => resource.resource_id));
  const matterIds = new Set((matterContractFreeze.matter_contract?.matters ?? []).map((matter) => matter.matter_id));
  const spanIds = new Set(sourceSpansV2.map((span) => span.source_span_id));
  const evidenceIds = new Set(evidenceItemsV2.map((evidence) => evidence.evidence_id));
  const factIds = new Set(factClaimsV2.map((fact) => fact.fact_id));
  const issueIds = new Set(issuesV2.map((issue) => issue.issue_id));
  const citationIds = new Set(citationsV2.map((citation) => citation.citation_id));
  const edgeSubjectIds = new Set([
    ...sourceResourceIds,
    ...spanIds,
    ...evidenceIds,
    ...factIds,
    ...issueIds,
    ...citationIds,
  ]);

  pushCheck(validationItems, "resource_evidence", resourceEvidence.schema_version, "resource_evidence_v1_present", resourceEvidence.schema_version === "resource-evidence.v1", "Source Resource/Evidence must be resource-evidence.v1.");
  pushCheck(validationItems, "resource_contract_freeze", resourceContractFreeze.freeze_id, "resource_contract_freeze_complete", resourceContractFreeze.summary?.freeze_status === "complete", "Resource contract freeze must be complete.");
  pushCheck(validationItems, "matter_contract_freeze", matterContractFreeze.freeze_id, "matter_contract_freeze_complete", matterContractFreeze.summary?.freeze_status === "complete", "Matter contract freeze must be complete.");
  pushCheck(validationItems, "policy_contract_freeze", policyContractFreeze.freeze_id, "policy_contract_freeze_complete", policyContractFreeze.summary?.freeze_status === "complete", "Policy contract freeze must be complete.");

  for (const span of sourceSpansV2) {
    pushCheck(validationItems, "source_span", span.source_span_id, "canonical_schema", span.schema_version === "source-span.v2", "SourceSpan must be projected as source-span.v2.");
    pushCheck(validationItems, "source_span", span.source_span_id, "resource_link_present", sourceResourceIds.has(span.resource_id) && resourceV2Ids.has(span.resource_id), "SourceSpan must link to known source and Resource v2 records.");
    pushCheck(validationItems, "source_span", span.source_span_id, "resource_version_link_present", sourceResourceVersionIds.has(span.resource_version_id), "SourceSpan must link to a known ResourceVersion.");
    pushCheck(validationItems, "source_span", span.source_span_id, "location_type_canonical", SOURCE_SPAN_TYPES.has(span.location_type), "SourceSpan location_type must be canonical.");
    pushCheck(validationItems, "source_span", span.source_span_id, "matter_link_present", Boolean(span.matter_id), "SourceSpan must carry a matter boundary id.");
    pushCheck(validationItems, "source_span", span.source_span_id, "classification_present", CLASSIFICATIONS.has(span.classification), "SourceSpan must preserve a P0-P5 classification.");
    pushCheck(validationItems, "source_span", span.source_span_id, "policy_snapshot_resolved", Boolean(span.policy_snapshot_id && policySnapshotIds.has(span.policy_snapshot_id)), "SourceSpan policy snapshot must resolve through the PolicyReference contract.");
    pushCheck(validationItems, "source_span", span.source_span_id, "text_hash_present", Boolean(span.text_hash), "SourceSpan must carry a stable text hash.");
  }

  for (const evidence of evidenceItemsV2) {
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "canonical_schema", evidence.schema_version === "evidence-item.v2", "EvidenceItem must be projected as evidence-item.v2.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "matter_link_present", Boolean(evidence.matter_id), "EvidenceItem must carry matter_id.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "matter_resolved_or_unassigned", matterIds.has(evidence.matter_id) || evidence.matter_id === "matter.unassigned.resource_expansion", "EvidenceItem matter must resolve or be explicitly unassigned for resource expansion.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "classification_present", CLASSIFICATIONS.has(evidence.classification), "EvidenceItem must inherit a P0-P5 classification.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "policy_snapshot_present", Boolean(evidence.policy_snapshot_id), "EvidenceItem must inherit a policy snapshot id.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "evidence_type_canonical", EVIDENCE_TYPES.has(evidence.evidence_type), "EvidenceItem evidence_type must be canonical.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "reliability_canonical", RELIABILITY_LEVELS.has(evidence.reliability), "EvidenceItem reliability must be canonical.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "review_status_canonical", REVIEW_STATUSES.has(evidence.review_status), "EvidenceItem review_status must be canonical.");
    pushCheck(validationItems, "evidence_item", evidence.evidence_id, "source_span_links_resolve", evidence.source_span_ids.length > 0 && evidence.source_span_ids.every((spanId) => spanIds.has(spanId)), "EvidenceItem source_span_ids must resolve.");
  }

  for (const fact of factClaimsV2) {
    pushCheck(validationItems, "fact_claim", fact.fact_id, "canonical_schema", fact.schema_version === "fact-claim.v2", "FactClaim must be projected as fact-claim.v2.");
    pushCheck(validationItems, "fact_claim", fact.fact_id, "evidence_links_resolve", fact.evidence_item_ids.length > 0 && fact.evidence_item_ids.every((evidenceId) => evidenceIds.has(evidenceId)), "FactClaim evidence_item_ids must resolve.");
    pushCheck(validationItems, "fact_claim", fact.fact_id, "fact_type_canonical", FACT_TYPES.has(fact.fact_type), "FactClaim fact_type must be canonical.");
    pushCheck(validationItems, "fact_claim", fact.fact_id, "confidence_range", typeof fact.confidence === "number" && fact.confidence >= 0 && fact.confidence <= 1, "FactClaim confidence must be between 0 and 1.");
    pushCheck(validationItems, "fact_claim", fact.fact_id, "review_status_canonical", REVIEW_STATUSES.has(fact.review_status), "FactClaim review_status must be canonical.");
  }

  for (const issue of issuesV2) {
    pushCheck(validationItems, "issue", issue.issue_id, "canonical_schema", issue.schema_version === "issue.v2", "Issue must be projected as issue.v2.");
    pushCheck(validationItems, "issue", issue.issue_id, "fact_links_resolve", issue.linked_fact_ids.length > 0 && issue.linked_fact_ids.every((factId) => factIds.has(factId)), "Issue linked_fact_ids must resolve.");
    pushCheck(validationItems, "issue", issue.issue_id, "evidence_links_present", issue.evidence_item_ids.length > 0 && issue.evidence_item_ids.every((evidenceId) => evidenceIds.has(evidenceId)), "Issue must preserve evidence ids through linked facts.");
    pushCheck(validationItems, "issue", issue.issue_id, "issue_type_canonical", ISSUE_TYPES.has(issue.issue_type), "Issue issue_type must be canonical.");
    pushCheck(validationItems, "issue", issue.issue_id, "severity_canonical", SEVERITIES.has(issue.severity), "Issue severity must be canonical.");
    pushCheck(validationItems, "issue", issue.issue_id, "status_canonical", ISSUE_STATUSES.has(issue.status), "Issue status must be canonical.");
  }

  for (const citation of citationsV2) {
    pushCheck(validationItems, "citation", citation.citation_id, "canonical_schema", citation.schema_version === "citation.v2", "Citation must be projected as citation.v2.");
    pushCheck(validationItems, "citation", citation.citation_id, "source_span_links_resolve", citation.source_span_ids.length > 0 && citation.source_span_ids.every((spanId) => spanIds.has(spanId)), "Citation source_span_ids must resolve.");
    pushCheck(validationItems, "citation", citation.citation_id, "evidence_links_resolve", citation.evidence_item_ids.length > 0 && citation.evidence_item_ids.every((evidenceId) => evidenceIds.has(evidenceId)), "Citation evidence_item_ids must resolve.");
    pushCheck(validationItems, "citation", citation.citation_id, "fact_links_resolve", citation.linked_fact_ids.length > 0 && citation.linked_fact_ids.every((factId) => factIds.has(factId)), "Citation must link to one or more FactClaim records.");
    pushCheck(validationItems, "citation", citation.citation_id, "issue_links_resolve", citation.linked_issue_ids.length > 0 && citation.linked_issue_ids.every((issueId) => issueIds.has(issueId)), "Citation must link to one or more Issue records.");
    pushCheck(validationItems, "citation", citation.citation_id, "citation_status_canonical", CITATION_STATUSES.has(citation.citation_status), "Citation citation_status must be canonical.");
    pushCheck(validationItems, "citation", citation.citation_id, "lineage_path_complete", citation.citation_binding_status === "bound", "Citation must preserve a source_span -> evidence -> fact -> issue -> citation path.");
  }

  for (const edge of lineageEdgesV2) {
    pushCheck(validationItems, "lineage_edge", edge.lineage_edge_id, "canonical_schema", edge.schema_version === "evidence-lineage-edge.v2", "LineageEdge must be projected as evidence-lineage-edge.v2.");
    pushCheck(validationItems, "lineage_edge", edge.lineage_edge_id, "relation_canonical", LINEAGE_RELATIONS.has(edge.relation), "LineageEdge relation must be canonical.");
    pushCheck(validationItems, "lineage_edge", edge.lineage_edge_id, "from_resolves", edgeSubjectIds.has(edge.from_id), "LineageEdge from_id must resolve.");
    pushCheck(validationItems, "lineage_edge", edge.lineage_edge_id, "to_resolves", edgeSubjectIds.has(edge.to_id), "LineageEdge to_id must resolve.");
    pushCheck(validationItems, "lineage_edge", edge.lineage_edge_id, "matter_link_present", Boolean(edge.matter_id), "LineageEdge must carry matter_id.");
  }

  return validationItems.sort((left, right) => left.validation_id.localeCompare(right.validation_id));
}

function pushCheck(validationItems, subjectType, subjectId, checkId, passed, message) {
  validationItems.push({
    validation_id: `evidence-contract-validation.${subjectType}.${slugify(subjectId)}.${checkId}`,
    subject_type: subjectType,
    subject_id: subjectId ?? "unknown",
    check_id: checkId,
    status: passed ? "passed" : "failed",
    severity: passed ? "info" : "error",
    message,
  });
}

function summarizeValidation(validationItems, projection) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: `${item.subject_type}.${item.subject_id}.${item.check_id}`, message: item.message }));
  if (projection.sourceSpansV2.length === 0) errors.push({ path: "evidence_contract.source_spans", message: "At least one SourceSpan v2 fixture is required." });
  if (projection.evidenceItemsV2.length === 0) errors.push({ path: "evidence_contract.evidence_items", message: "At least one EvidenceItem v2 fixture is required." });
  if (projection.factClaimsV2.length === 0) errors.push({ path: "evidence_contract.fact_claims", message: "At least one FactClaim v2 fixture is required." });
  if (projection.issuesV2.length === 0) errors.push({ path: "evidence_contract.issues", message: "At least one Issue v2 fixture is required." });
  if (projection.citationsV2.length === 0) errors.push({ path: "evidence_contract.citations", message: "At least one Citation v2 fixture is required." });
  return {
    valid: errors.length === 0,
    errors,
  };
}

function summarizeFreeze(projection, validationItems, validation) {
  return {
    freeze_status: validation.valid ? "complete" : "blocked",
    source_span_schema_version: "source-span.v2",
    evidence_item_schema_version: "evidence-item.v2",
    fact_claim_schema_version: "fact-claim.v2",
    issue_schema_version: "issue.v2",
    citation_schema_version: "citation.v2",
    lineage_edge_schema_version: "evidence-lineage-edge.v2",
    source_span_count: projection.sourceSpansV2.length,
    evidence_item_count: projection.evidenceItemsV2.length,
    fact_claim_count: projection.factClaimsV2.length,
    issue_count: projection.issuesV2.length,
    citation_count: projection.citationsV2.length,
    lineage_edge_count: projection.lineageEdgesV2.length,
    citation_bound_count: projection.citationsV2.filter((citation) => citation.citation_binding_status === "bound").length,
    citation_broken_count: projection.citationsV2.filter((citation) => citation.citation_binding_status !== "bound").length,
    complete_lineage_path_count: projection.citationsV2.filter((citation) => citation.citation_binding_status === "bound").length,
    broken_lineage_path_count: projection.citationsV2.filter((citation) => citation.citation_binding_status !== "bound").length,
    resource_linked_source_span_count: projection.sourceSpansV2.filter((span) => span.resource_id && span.resource_version_id).length,
    matter_linked_evidence_count: projection.evidenceItemsV2.filter((evidence) => evidence.matter_id).length,
    policy_snapshot_linked_evidence_count: projection.evidenceItemsV2.filter((evidence) => evidence.policy_snapshot_id).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(projection.evidenceItemsV2, "matter_id"),
    by_classification: countBy(projection.evidenceItemsV2, "classification"),
    by_review_status: countBy(projection.evidenceItemsV2, "review_status"),
    by_citation_status: countBy(projection.citationsV2, "citation_status"),
  };
}

function renderEvidenceContractFreezeMarkdown(result) {
  const lines = [];
  lines.push("# Evidence Contract Freeze");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.freeze_status}`);
  lines.push("");
  lines.push(`- SourceSpan schema: ${result.summary.source_span_schema_version}`);
  lines.push(`- EvidenceItem schema: ${result.summary.evidence_item_schema_version}`);
  lines.push(`- FactClaim schema: ${result.summary.fact_claim_schema_version}`);
  lines.push(`- Issue schema: ${result.summary.issue_schema_version}`);
  lines.push(`- Citation schema: ${result.summary.citation_schema_version}`);
  lines.push(`- LineageEdge schema: ${result.summary.lineage_edge_schema_version}`);
  lines.push(`- Source spans: ${result.summary.source_span_count}`);
  lines.push(`- Evidence items: ${result.summary.evidence_item_count}`);
  lines.push(`- Fact claims: ${result.summary.fact_claim_count}`);
  lines.push(`- Issues: ${result.summary.issue_count}`);
  lines.push(`- Citations: ${result.summary.citation_count}`);
  lines.push(`- Lineage edges: ${result.summary.lineage_edge_count}`);
  lines.push(`- Complete citation paths: ${result.summary.complete_lineage_path_count}`);
  lines.push(`- Broken citation paths: ${result.summary.broken_lineage_path_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Citation Status");
  for (const [citationStatus, count] of Object.entries(result.summary.by_citation_status)) {
    lines.push(`- ${citationStatus}: ${count}`);
  }
  lines.push("");
  lines.push("## Matters");
  for (const [matterId, count] of Object.entries(result.summary.by_matter_id)) {
    lines.push(`- ${matterId}: ${count}`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function isCitationBound(citation, { spanById, evidenceById, factEvidenceIds, issueById }) {
  const spansResolve = citation.source_span_ids.length > 0 && citation.source_span_ids.every((spanId) => spanById.has(spanId));
  const evidenceResolve = citation.evidence_item_ids.length > 0 && citation.evidence_item_ids.every((evidenceId) => evidenceById.has(evidenceId));
  const factIds = [...factEvidenceIds.entries()]
    .filter(([, evidenceIds]) => citation.evidence_item_ids.some((evidenceId) => evidenceIds.has(evidenceId)))
    .map(([factId]) => factId);
  const issueIds = [citation.metadata?.issue_id].filter(Boolean);
  const issueResolve = issueIds.length > 0 && issueIds.every((issueId) => issueById.has(issueId));
  return spansResolve && evidenceResolve && factIds.length > 0 && issueResolve;
}

function verificationStateForEvidence(evidence) {
  if (evidence.reliability === "attorney_verified" || evidence.review_status === "approved") return "human_verified";
  if (evidence.review_status === "rejected") return "rejected";
  if (evidence.review_status === "changes_requested") return "changes_requested";
  return "machine_extracted_pending_review";
}

function verificationStateForReview(reviewStatus) {
  if (reviewStatus === "approved") return "human_verified";
  if (reviewStatus === "rejected") return "rejected";
  if (reviewStatus === "changes_requested") return "changes_requested";
  return "pending_review";
}

function highestClassification(classifications) {
  const order = ["P0_PUBLIC", "P1_INTERNAL", "P2_CLIENT_CONFIDENTIAL", "P3_PRIVILEGED", "P4_HIGHLY_RESTRICTED", "P5_SECRET"];
  return classifications
    .filter((classification) => CLASSIFICATIONS.has(classification))
    .sort((left, right) => order.indexOf(right) - order.indexOf(left))[0] ?? null;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableFreeze(result) {
  const { markdown, ...serializable } = result;
  return serializable;
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

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function truncate(value, length) {
  const text = String(value ?? "");
  return text.length <= length ? text : `${text.slice(0, length - 3)}...`;
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

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--law-firm-slice") parsed.lawFirmSlicePath = argv[++index];
    else if (arg === "--resource-contract-freeze") parsed.resourceContractFreezePath = argv[++index];
    else if (arg === "--matter-contract-freeze") parsed.matterContractFreezePath = argv[++index];
    else if (arg === "--policy-contract-freeze") parsed.policyContractFreezePath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/evidence-contract-freeze.mjs [options]

Options:
  --out-dir <path>                  Output directory.
  --law-firm-slice <path>           law-firm-ldd-slice.json path.
  --resource-contract-freeze <path> Resource contract freeze path.
  --matter-contract-freeze <path>   Matter contract freeze path.
  --policy-contract-freeze <path>   Policy contract freeze path.
  --run-at <iso>                    Override generated_at.
  --check                           Exit non-zero on validation errors.
  --help                            Show this help.
`);
}
