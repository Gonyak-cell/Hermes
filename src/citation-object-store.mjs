import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CITATION_OBJECT_STORE_OUT_DIR = "artifacts/citation-object-store/latest";
export const DEFAULT_CITATION_OBJECT_STORE_INPUTS = {
  issueGraphStorePath: "artifacts/issue-graph-store/latest/issue-graph-store.json",
  packagePath: "package.json",
  roadmapPath: "docs/implementation-roadmap.md",
};

const CITATION_OBJECT_STORE_CONTRACT_ID = "citation-object-store.v1";
const CITATION_SCHEMA_VERSION = "citation.v2";
const OUTPUT_PARAGRAPH_SCHEMA_VERSION = "output-paragraph.v1";
const PARAGRAPH_SOURCE_BINDING_SCHEMA_VERSION = "paragraph-source-binding.v1";

export async function runCitationObjectStore(options = {}) {
  const result = await buildCitationObjectStore(options);
  if (options.write !== false) await writeCitationObjectStore(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Citation object store failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCitationObjectStore(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CITATION_OBJECT_STORE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const issueGraphStore = await readJson(inputs.issue_graph_store_path);
  const packageText = await readText(inputs.package_path);
  const roadmapText = await readText(inputs.roadmap_path);
  const issues = issueGraphStore.issue_graph_catalog?.issues ?? [];
  const outputParagraphs = issues.map((issue) => buildOutputParagraph(issue, generatedAt));
  const citations = outputParagraphs.flatMap((paragraph) => buildCitationsForParagraph(paragraph, generatedAt));
  const citationsByParagraphId = groupBy(citations, "output_paragraph_id");
  const paragraphsWithCitations = outputParagraphs.map((paragraph) => attachCitationIds(paragraph, citationsByParagraphId));
  const paragraphSourceBindings = citations.map((citation) => buildParagraphSourceBinding(citation, generatedAt));
  const reviewQueueItems = citations.map((citation) => buildReviewQueueItem(citation, generatedAt));
  const citationIndexes = buildCitationIndexes(paragraphsWithCitations, citations, paragraphSourceBindings, reviewQueueItems, generatedAt);
  const validationItems = validateCitationObjectStore({
    packageText,
    roadmapText,
    issueGraphStore,
    issues,
    outputParagraphs: paragraphsWithCitations,
    citations,
    paragraphSourceBindings,
    reviewQueueItems,
    citationIndexes,
  });
  const validation = summarizeValidation(validationItems);
  const summary = summarizeStore({
    issueGraphStore,
    issues,
    outputParagraphs: paragraphsWithCitations,
    citations,
    paragraphSourceBindings,
    reviewQueueItems,
    validationItems,
    validation,
  });
  const result = {
    schema_version: "citation-object-store.v1",
    generated_at: generatedAt,
    citation_object_store_id: `citation-object-store.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_issue_graph_store: summarizeSource("issue_graph_store", issueGraphStore),
    citation_object_store_contract: buildStoreContract(generatedAt),
    citation_catalog: {
      schema_version: "citation-catalog.v1",
      generated_at: generatedAt,
      output_paragraphs: paragraphsWithCitations,
      citations,
      paragraph_source_bindings: paragraphSourceBindings,
      review_queue_items: reviewQueueItems,
      citation_indexes: citationIndexes,
    },
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderCitationObjectStoreMarkdown(result),
  };
}

export async function writeCitationObjectStore(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableStore(result);
  await writeJson(path.join(outDir, "citation-object-store.json"), serializable);
  await writeJson(path.join(outDir, "output-paragraphs.json"), {
    generated_at: result.generated_at,
    output_paragraph_count: result.citation_catalog.output_paragraphs.length,
    output_paragraphs: result.citation_catalog.output_paragraphs,
  });
  await writeJson(path.join(outDir, "citations.json"), {
    generated_at: result.generated_at,
    citation_count: result.citation_catalog.citations.length,
    citations: result.citation_catalog.citations,
  });
  await writeJson(path.join(outDir, "paragraph-source-bindings.json"), {
    generated_at: result.generated_at,
    paragraph_source_binding_count: result.citation_catalog.paragraph_source_bindings.length,
    paragraph_source_bindings: result.citation_catalog.paragraph_source_bindings,
  });
  await writeJson(path.join(outDir, "citation-review-queue.json"), {
    generated_at: result.generated_at,
    review_queue_item_count: result.citation_catalog.review_queue_items.length,
    review_queue_items: result.citation_catalog.review_queue_items,
  });
  await writeJson(path.join(outDir, "citation-indexes.json"), {
    generated_at: result.generated_at,
    citation_indexes: result.citation_catalog.citation_indexes,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    citation_object_store_id: result.citation_object_store_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runCitationObjectStoreCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runCitationObjectStore(args);
    console.log(`Citation object store written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.citation_object_store_status}`);
    console.log(`Issues: ${result.summary.issue_count}`);
    console.log(`Output paragraphs: ${result.summary.output_paragraph_count}`);
    console.log(`Citations: ${result.summary.citation_count}`);
    console.log(`Paragraph-source bindings: ${result.summary.paragraph_source_binding_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildStoreContract(generatedAt) {
  return {
    schema_version: "citation-object-store-contract.v1",
    citation_object_store_contract_id: CITATION_OBJECT_STORE_CONTRACT_ID,
    generated_at: generatedAt,
    issue_schema_version: "issue.v2",
    output_paragraph_schema_version: OUTPUT_PARAGRAPH_SCHEMA_VERSION,
    citation_schema_version: CITATION_SCHEMA_VERSION,
    paragraph_source_binding_schema_version: PARAGRAPH_SOURCE_BINDING_SCHEMA_VERSION,
    source_inputs: ["issue-graph-store.v1", "issue.v2"],
    required_identity_fields: ["tenant_id", "matter_id", "classification", "policy_snapshot_id"],
    required_lineage_links: ["issue_id", "fact_id", "evidence_item_id", "source_span_id", "output_paragraph_id"],
    citation_rule: "each_review_pending_issue_candidate_creates_a_review_pending_output_paragraph_with_source_bound_citation_objects",
    output_rule: "output_paragraphs_are_not_client_facing_and_require_attorney_review_before_delivery",
    source_binding_rule: "each_citation_object_must_bind_one_output_paragraph_to_one_source_span",
    matter_boundary_rule: "citations_inherit_matter_boundary_from_linked_issue_candidate",
  };
}

function buildOutputParagraph(issue, generatedAt) {
  const sourceSpanIds = issue.metadata?.source_span_ids ?? [];
  const citationIds = sourceSpanIds.map((sourceSpanId, index) => citationIdFor(issue.issue_id, sourceSpanId, index));
  return {
    schema_version: OUTPUT_PARAGRAPH_SCHEMA_VERSION,
    output_paragraph_id: `output-paragraph.${slugify(issue.issue_id)}`,
    draft_artifact_id: "draft-artifact.citation-object-store",
    paragraph_type: "issue_candidate_summary",
    paragraph_text: buildParagraphText(issue),
    tenant_id: issue.tenant_id ?? null,
    matter_id: issue.matter_id ?? null,
    classification: issue.classification ?? null,
    policy_snapshot_id: issue.policy_snapshot_id ?? null,
    issue_id: issue.issue_id,
    linked_fact_ids: issue.linked_fact_ids ?? [],
    linked_fact_count: issue.linked_fact_count ?? issue.linked_fact_ids?.length ?? 0,
    evidence_item_ids: issue.evidence_item_ids ?? [],
    evidence_item_count: issue.evidence_item_count ?? issue.evidence_item_ids?.length ?? 0,
    source_span_ids: sourceSpanIds,
    source_span_count: sourceSpanIds.length,
    citation_ids: citationIds,
    citation_count: citationIds.length,
    review_status: "needs_review",
    approval_status: "not_requested",
    client_facing_status: "not_client_facing",
    created_at: generatedAt,
    metadata: {
      source_schema_version: issue.schema_version ?? null,
      issue_type: issue.issue_type ?? null,
      risk_severity: issue.risk_severity ?? null,
      verification_state: issue.verification_state ?? null,
      issue_title: issue.title ?? null,
      attorney_review_note: "This paragraph is a machine-bound citation candidate and is not client-facing until attorney approval.",
    },
  };
}

function buildCitationsForParagraph(paragraph, generatedAt) {
  return paragraph.source_span_ids.map((sourceSpanId, index) => ({
    schema_version: CITATION_SCHEMA_VERSION,
    citation_id: paragraph.citation_ids[index],
    output_paragraph_id: paragraph.output_paragraph_id,
    issue_id: paragraph.issue_id,
    fact_id: paragraph.linked_fact_ids[index] ?? paragraph.linked_fact_ids[0] ?? null,
    evidence_item_id: paragraph.evidence_item_ids[index] ?? paragraph.evidence_item_ids[0] ?? null,
    source_span_id: sourceSpanId,
    lineage_id: `lineage.citation.${slugify(paragraph.citation_ids[index])}`,
    tenant_id: paragraph.tenant_id,
    matter_id: paragraph.matter_id,
    classification: paragraph.classification,
    policy_snapshot_id: paragraph.policy_snapshot_id,
    citation_style: "source_span_reference",
    citation_status: "needs_review",
    verification_status: "source_span_bound_pending_review",
    source_binding_status: sourceSpanId ? "bound" : "broken",
    human_review_required: true,
    client_facing_ready: false,
    created_at: generatedAt,
    metadata: {
      paragraph_type: paragraph.paragraph_type,
      issue_type: paragraph.metadata.issue_type,
      risk_severity: paragraph.metadata.risk_severity,
      source_locator_required: true,
      output_rule: "draft_only_until_human_approval",
    },
  }));
}

function attachCitationIds(paragraph, citationsByParagraphId) {
  const citations = citationsByParagraphId.get(paragraph.output_paragraph_id) ?? [];
  return {
    ...paragraph,
    citation_ids: citations.map((citation) => citation.citation_id),
    citation_count: citations.length,
  };
}

function buildParagraphSourceBinding(citation, generatedAt) {
  return {
    schema_version: PARAGRAPH_SOURCE_BINDING_SCHEMA_VERSION,
    paragraph_source_binding_id: `paragraph-source-binding.${slugify(citation.output_paragraph_id)}.${slugify(citation.source_span_id)}`,
    output_paragraph_id: citation.output_paragraph_id,
    citation_id: citation.citation_id,
    issue_id: citation.issue_id,
    fact_id: citation.fact_id,
    evidence_item_id: citation.evidence_item_id,
    source_span_id: citation.source_span_id,
    binding_status: citation.source_binding_status,
    tenant_id: citation.tenant_id,
    matter_id: citation.matter_id,
    classification: citation.classification,
    policy_snapshot_id: citation.policy_snapshot_id,
    matter_preserved: Boolean(citation.matter_id),
    classification_preserved: Boolean(citation.classification),
    policy_snapshot_preserved: Boolean(citation.policy_snapshot_id),
    issue_link_preserved: Boolean(citation.issue_id),
    created_at: generatedAt,
  };
}

function buildReviewQueueItem(citation, generatedAt) {
  return {
    schema_version: "citation-review-queue-item.v1",
    review_queue_item_id: `citation-review-queue-item.${slugify(citation.citation_id)}`,
    subject_type: "citation",
    subject_id: citation.citation_id,
    output_paragraph_id: citation.output_paragraph_id,
    citation_id: citation.citation_id,
    issue_id: citation.issue_id,
    source_span_id: citation.source_span_id,
    matter_id: citation.matter_id,
    classification: citation.classification,
    review_status: "needs_review",
    review_required: true,
    approval_required_before_output: true,
    queue_reason: "machine_bound_citation_candidate",
    assigned_role: "attorney_reviewer",
    created_at: generatedAt,
  };
}

function buildCitationIndexes(outputParagraphs, citations, paragraphSourceBindings, reviewQueueItems, generatedAt) {
  return {
    schema_version: "citation-indexes.v1",
    generated_at: generatedAt,
    by_matter_id: countBy(citations, "matter_id"),
    by_classification: countBy(citations, "classification"),
    by_review_status: countBy(reviewQueueItems, "review_status"),
    by_citation_status: countBy(citations, "citation_status"),
    by_verification_status: countBy(citations, "verification_status"),
    by_source_binding_status: countBy(citations, "source_binding_status"),
    by_client_facing_ready: countBy(citations, "client_facing_ready"),
    by_client_facing_status: countBy(outputParagraphs, "client_facing_status"),
    by_issue_type: countByNested(outputParagraphs, "metadata", "issue_type"),
    by_risk_severity: countByNested(outputParagraphs, "metadata", "risk_severity"),
    by_paragraph_binding_status: countBy(paragraphSourceBindings, "binding_status"),
  };
}

function validateCitationObjectStore({
  packageText,
  roadmapText,
  issueGraphStore,
  issues,
  outputParagraphs,
  citations,
  paragraphSourceBindings,
  reviewQueueItems,
  citationIndexes,
}) {
  const validationItems = [];
  const packageJson = JSON.parse(packageText);
  const issueById = new Map(issues.map((issue) => [issue.issue_id, issue]));
  const paragraphById = new Map(outputParagraphs.map((paragraph) => [paragraph.output_paragraph_id, paragraph]));
  const citationsByIssueId = groupBy(citations, "issue_id");
  const citationsByParagraphId = groupBy(citations, "output_paragraph_id");
  const bindingByCitationId = new Map(paragraphSourceBindings.map((binding) => [binding.citation_id, binding]));
  const reviewByCitationId = new Map(reviewQueueItems.map((item) => [item.citation_id, item]));

  pushCheck(validationItems, "contract", "package_script_registered", Boolean(packageJson.scripts?.["resource:citations"]), "package.json must expose resource:citations.");
  pushCheck(validationItems, "contract", "roadmap_phase_documented", roadmapText.includes("## Phase 142: Citation Object Store"), "Implementation roadmap must document Phase 142.");
  pushCheck(validationItems, "source", "issue_graph_store_complete", issueGraphStore.summary?.issue_graph_store_status === "complete", "Issue Graph Store must be complete.");
  pushCheck(validationItems, "catalog", "issues_present", issues.length > 0, "At least one issue candidate is required.");
  pushCheck(validationItems, "catalog", "output_paragraphs_present", outputParagraphs.length > 0, "At least one output paragraph must be materialized.");
  pushCheck(validationItems, "catalog", "citations_present", citations.length > 0, "At least one citation must be materialized.");
  pushCheck(validationItems, "catalog", "paragraph_count_matches_issue", outputParagraphs.length === issues.length, "Every issue must produce one output paragraph candidate.");
  pushCheck(validationItems, "catalog", "citation_count_covers_paragraphs", citations.length >= outputParagraphs.length, "Each output paragraph must have at least one citation.");
  pushCheck(validationItems, "catalog", "binding_count_matches_citation", paragraphSourceBindings.length === citations.length, "Every citation must have one paragraph source binding.");
  pushCheck(validationItems, "catalog", "review_queue_count_matches_citation", reviewQueueItems.length === citations.length, "Every citation must have one review queue item.");
  pushCheck(validationItems, "catalog", "citation_index_present", Boolean(citationIndexes.by_source_binding_status), "Citation indexes must be present.");

  for (const issue of issues) {
    const issueCitations = citationsByIssueId.get(issue.issue_id) ?? [];
    pushCheck(validationItems, `issues.${issue.issue_id}`, "citation_created", issueCitations.length > 0, "Issue must have at least one citation object.");
    pushCheck(validationItems, `issues.${issue.issue_id}`, "citation_count_matches_source_spans", issueCitations.length === (issue.metadata?.source_span_ids?.length ?? 0), "Issue citation count must match source span count.");
  }

  for (const paragraph of outputParagraphs) {
    const issue = issueById.get(paragraph.issue_id);
    const paragraphCitations = citationsByParagraphId.get(paragraph.output_paragraph_id) ?? [];
    const pathPrefix = `output_paragraphs.${paragraph.output_paragraph_id}`;
    pushCheck(validationItems, pathPrefix, "schema_version_canonical", paragraph.schema_version === OUTPUT_PARAGRAPH_SCHEMA_VERSION, "Output paragraph must use output-paragraph.v1.");
    pushCheck(validationItems, pathPrefix, "issue_link_resolves", Boolean(issue), "Output paragraph must link to an issue.");
    pushCheck(validationItems, pathPrefix, "citation_ids_match_rows", paragraph.citation_count === paragraphCitations.length && paragraph.citation_ids.every((citationId) => paragraphCitations.some((citation) => citation.citation_id === citationId)), "Output paragraph citation ids must resolve.");
    pushCheck(validationItems, pathPrefix, "source_span_links_present", paragraph.source_span_count > 0 && paragraph.source_span_count === paragraph.source_span_ids.length, "Output paragraph must preserve source span ids.");
    pushCheck(validationItems, pathPrefix, "matter_preserved", Boolean(issue && issue.matter_id === paragraph.matter_id), "Output paragraph must preserve matter_id from issue.");
    pushCheck(validationItems, pathPrefix, "classification_preserved", Boolean(issue && issue.classification === paragraph.classification), "Output paragraph must preserve classification from issue.");
    pushCheck(validationItems, pathPrefix, "policy_snapshot_preserved", Boolean(issue && issue.policy_snapshot_id === paragraph.policy_snapshot_id), "Output paragraph must preserve policy snapshot from issue.");
    pushCheck(validationItems, pathPrefix, "not_client_facing", paragraph.client_facing_status === "not_client_facing" && paragraph.review_status === "needs_review", "Machine output paragraph must stay not client-facing and pending review.");
  }

  for (const citation of citations) {
    const issue = issueById.get(citation.issue_id);
    const paragraph = paragraphById.get(citation.output_paragraph_id);
    const binding = bindingByCitationId.get(citation.citation_id);
    const review = reviewByCitationId.get(citation.citation_id);
    const pathPrefix = `citations.${citation.citation_id}`;
    pushCheck(validationItems, pathPrefix, "schema_version_canonical", citation.schema_version === CITATION_SCHEMA_VERSION, "Citation must use citation.v2.");
    pushCheck(validationItems, pathPrefix, "issue_link_resolves", Boolean(issue), "Citation must link to an issue.");
    pushCheck(validationItems, pathPrefix, "paragraph_link_resolves", Boolean(paragraph), "Citation must link to an output paragraph.");
    pushCheck(validationItems, pathPrefix, "source_span_link_present", Boolean(citation.source_span_id) && citation.source_binding_status === "bound", "Citation must bind a source span.");
    pushCheck(validationItems, pathPrefix, "fact_link_present", Boolean(citation.fact_id), "Citation must preserve fact link.");
    pushCheck(validationItems, pathPrefix, "evidence_link_present", Boolean(citation.evidence_item_id), "Citation must preserve evidence item link.");
    pushCheck(validationItems, pathPrefix, "matter_preserved", Boolean(issue && issue.matter_id === citation.matter_id && paragraph?.matter_id === citation.matter_id), "Citation must preserve matter_id.");
    pushCheck(validationItems, pathPrefix, "classification_preserved", Boolean(issue && issue.classification === citation.classification && paragraph?.classification === citation.classification), "Citation must preserve classification.");
    pushCheck(validationItems, pathPrefix, "policy_snapshot_preserved", Boolean(issue && issue.policy_snapshot_id === citation.policy_snapshot_id && paragraph?.policy_snapshot_id === citation.policy_snapshot_id), "Citation must preserve policy snapshot.");
    pushCheck(validationItems, pathPrefix, "human_review_required", citation.human_review_required === true && citation.citation_status === "needs_review", "Citation must require human review.");
    pushCheck(validationItems, pathPrefix, "not_client_facing_ready", citation.client_facing_ready === false, "Citation must not be client-facing ready.");
    pushCheck(validationItems, pathPrefix, "binding_row_present", binding?.binding_status === "bound", "Citation must have a bound paragraph source binding.");
    pushCheck(validationItems, pathPrefix, "review_queue_present", review?.review_required === true, "Citation must have a review queue item.");
  }

  return validationItems;
}

function pushCheck(validationItems, pathLabel, checkId, passed, message) {
  validationItems.push({
    validation_id: `citation-object-store-validation.${slugify(pathLabel)}.${checkId}`,
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

function summarizeStore({ issueGraphStore, issues, outputParagraphs, citations, paragraphSourceBindings, reviewQueueItems, validationItems, validation }) {
  return {
    citation_object_store_status: validation.valid ? "complete" : "blocked",
    citation_object_store_contract_id: CITATION_OBJECT_STORE_CONTRACT_ID,
    citation_schema_version: CITATION_SCHEMA_VERSION,
    output_paragraph_schema_version: OUTPUT_PARAGRAPH_SCHEMA_VERSION,
    paragraph_source_binding_schema_version: PARAGRAPH_SOURCE_BINDING_SCHEMA_VERSION,
    issue_graph_store_status: issueGraphStore.summary?.issue_graph_store_status ?? "unknown",
    issue_count: issues.length,
    output_paragraph_count: outputParagraphs.length,
    citation_count: citations.length,
    paragraph_source_binding_count: paragraphSourceBindings.length,
    review_queue_item_count: reviewQueueItems.length,
    source_span_bound_citation_count: citations.filter((citation) => citation.source_binding_status === "bound" && citation.source_span_id).length,
    issue_linked_citation_count: citations.filter((citation) => citation.issue_id).length,
    paragraph_linked_citation_count: citations.filter((citation) => citation.output_paragraph_id).length,
    fact_linked_citation_count: citations.filter((citation) => citation.fact_id).length,
    evidence_linked_citation_count: citations.filter((citation) => citation.evidence_item_id).length,
    matter_preserved_citation_count: paragraphSourceBindings.filter((binding) => binding.matter_preserved).length,
    classification_preserved_citation_count: paragraphSourceBindings.filter((binding) => binding.classification_preserved).length,
    policy_snapshot_preserved_citation_count: paragraphSourceBindings.filter((binding) => binding.policy_snapshot_preserved).length,
    issue_link_preserved_citation_count: paragraphSourceBindings.filter((binding) => binding.issue_link_preserved).length,
    needs_review_count: citations.filter((citation) => citation.citation_status === "needs_review").length,
    approved_count: citations.filter((citation) => citation.citation_status === "approved").length,
    client_facing_ready_count: citations.filter((citation) => citation.client_facing_ready === true).length,
    not_client_facing_paragraph_count: outputParagraphs.filter((paragraph) => paragraph.client_facing_status === "not_client_facing").length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status === "failed").length,
    validation_error_count: validation.errors.length,
    by_matter_id: countBy(citations, "matter_id"),
    by_classification: countBy(citations, "classification"),
    by_review_status: countBy(reviewQueueItems, "review_status"),
    by_citation_status: countBy(citations, "citation_status"),
    by_verification_status: countBy(citations, "verification_status"),
    by_source_binding_status: countBy(citations, "source_binding_status"),
  };
}

function renderCitationObjectStoreMarkdown(result) {
  const lines = [];
  lines.push("# Citation Object Store");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.citation_object_store_status}`);
  lines.push("");
  lines.push(`- Contract: ${result.summary.citation_object_store_contract_id}`);
  lines.push(`- Issues: ${result.summary.issue_count}`);
  lines.push(`- Output paragraphs: ${result.summary.output_paragraph_count}`);
  lines.push(`- Citations: ${result.summary.citation_count}`);
  lines.push(`- Paragraph-source bindings: ${result.summary.paragraph_source_binding_count}`);
  lines.push(`- Review queue items: ${result.summary.review_queue_item_count}`);
  lines.push(`- Source-span bound citations: ${result.summary.source_span_bound_citation_count}`);
  lines.push(`- Needs review: ${result.summary.needs_review_count}`);
  lines.push(`- Auto approved: ${result.summary.approved_count}`);
  lines.push(`- Client-facing ready: ${result.summary.client_facing_ready_count}`);
  lines.push(`- Not client-facing paragraphs: ${result.summary.not_client_facing_paragraph_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Validation Errors");
    for (const error of result.validation.errors) lines.push(`- ${error.path}: ${error.message}`);
  }
  return `${lines.join("\n")}\n`;
}

function buildParagraphText(issue) {
  const title = String(issue.title ?? issue.issue_id).replace(/\s+/g, " ").trim();
  return `Review issue candidate "${title}" against linked source material before legal or client-facing use.`;
}

function citationIdFor(issueId, sourceSpanId, index) {
  return `citation.${slugify(issueId)}.${slugify(sourceSpanId)}.${index + 1}`;
}

function normalizeInputs(options) {
  return {
    issue_graph_store_path: path.resolve(options.issueGraphStorePath ?? DEFAULT_CITATION_OBJECT_STORE_INPUTS.issueGraphStorePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CITATION_OBJECT_STORE_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_CITATION_OBJECT_STORE_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--issue-graph-store") parsed.issueGraphStorePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/citation-object-store.mjs [options]

Options:
  --issue-graph-store <path>          issue-graph-store.json path.
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

function serializableStore(result) {
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

function groupBy(items, key) {
  return items.reduce((groups, item) => {
    const value = item[key] ?? "unknown";
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
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

function countByNested(items, objectKey, nestedKey) {
  return Object.fromEntries(
    [...items.reduce((counts, item) => {
      const value = item[objectKey]?.[nestedKey] ?? "unknown";
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
