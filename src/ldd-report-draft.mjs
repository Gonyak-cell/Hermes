import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LDD_REPORT_DRAFT_OUT_DIR = "artifacts/ldd-report-draft/latest";
export const DEFAULT_LDD_REPORT_DRAFT_INPUTS = {
  lddRfiGeneratorPath: "artifacts/ldd-rfi-generator/latest/ldd-rfi-generator.json",
  lddIssueDetectionPath: "artifacts/ldd-issue-detection/latest/ldd-issue-detection.json",
  legalCitationVerifierPath: "artifacts/legal-citation-verifier/latest/legal-citation-verifier.json",
  matterPath: "examples/project-alpha-matter.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "ldd-report-draft.v1";
const SOURCE_OF_TRUTH = "ldd_rfi_generator_issue_detection_legal_citation_verifier_and_demo_matter_metadata";
const SECTION_RULES = [
  sectionRule("executive_summary", "Executive summary", "Matter summary counts become draft-only report overview paragraphs"),
  sectionRule("red_flags", "Red flags", "Red/yellow issue candidates become attorney-review issue paragraphs without legal conclusions"),
  sectionRule("open_rfi", "Open RFI", "Draft RFI questions become internal request-summary paragraphs"),
  sectionRule("source_gaps", "Source gaps", "Source-gap issue candidates become source-confirmation paragraphs"),
  sectionRule("attorney_review_gate", "Attorney review gate", "Every draft paragraph and citation placeholder remains attorney/human-review gated"),
];

export async function runLddReportDraft(options = {}) {
  const result = await buildLddReportDraft(options);
  if (options.write !== false) await writeLddReportDraft(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`LDD report draft validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLddReportDraft(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LDD_REPORT_DRAFT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const lddRfiGenerator = sourceById.ldd_rfi_generator;
  const lddIssueDetection = sourceById.ldd_issue_detection;
  const legalCitationVerifier = sourceById.legal_citation_verifier;
  const matter = sourceById.matter;
  const rules = buildSectionRules(generatedAt);
  const sections = buildReportSections({ lddRfiGenerator, lddIssueDetection, matter, generatedAt });
  const paragraphs = buildReportParagraphs({ sections, lddRfiGenerator, lddIssueDetection, legalCitationVerifier, matter, generatedAt });
  attachParagraphsToSections(sections, paragraphs);
  const citationPlaceholders = buildCitationPlaceholders({ paragraphs, legalCitationVerifier, generatedAt });
  attachCitationPlaceholdersToParagraphs(paragraphs, citationPlaceholders);
  attachCitationCountsToSections(sections, paragraphs);
  const issueLinks = buildIssueLinks(paragraphs, generatedAt);
  const matterSummaries = buildMatterSummaries({ sections, paragraphs, citationPlaceholders, issueLinks, lddRfiGenerator, lddIssueDetection, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    lddRfiGenerator,
    lddIssueDetection,
    legalCitationVerifier,
    matter,
    rules,
    sections,
    paragraphs,
    citationPlaceholders,
    issueLinks,
    matterSummaries,
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
  const summary = summarizeLddReportDraft({
    sourceReads,
    lddRfiGenerator,
    lddIssueDetection,
    legalCitationVerifier,
    rules,
    sections,
    paragraphs,
    citationPlaceholders,
    issueLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    ldd_report_draft_id: `ldd-report-draft.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    ldd_report_draft_status: summary.ldd_report_draft_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    ldd_report_draft_contract: buildContract(generatedAt),
    ldd_report_section_rules: rules,
    ldd_report_sections: sections,
    ldd_report_paragraphs: paragraphs,
    ldd_report_citation_placeholders: citationPlaceholders,
    ldd_report_issue_links: issueLinks,
    ldd_report_matter_summaries: matterSummaries,
    ldd_report_draft_desktop_boundary: desktopBoundary,
    ldd_report_draft_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLddReportDraftMarkdown(result),
  };
}

export async function writeLddReportDraft(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLddReportDraft(result);
  await writeJson(path.join(outDir, "ldd-report-draft.json"), serializable);
  await writeJson(path.join(outDir, "ldd-report-section-rules.json"), {
    schema_version: "ldd-report-section-rules.v1",
    generated_at: result.generated_at,
    section_rule_count: result.ldd_report_section_rules.length,
    ldd_report_section_rules: result.ldd_report_section_rules,
  });
  await writeJson(path.join(outDir, "ldd-report-sections.json"), {
    schema_version: "ldd-report-sections.v1",
    generated_at: result.generated_at,
    section_count: result.ldd_report_sections.length,
    ldd_report_sections: result.ldd_report_sections,
  });
  await writeJson(path.join(outDir, "ldd-report-paragraphs.json"), {
    schema_version: "ldd-report-paragraphs.v1",
    generated_at: result.generated_at,
    paragraph_count: result.ldd_report_paragraphs.length,
    ldd_report_paragraphs: result.ldd_report_paragraphs,
  });
  await writeJson(path.join(outDir, "ldd-report-citation-placeholders.json"), {
    schema_version: "ldd-report-citation-placeholders.v1",
    generated_at: result.generated_at,
    citation_placeholder_count: result.ldd_report_citation_placeholders.length,
    ldd_report_citation_placeholders: result.ldd_report_citation_placeholders,
  });
  await writeJson(path.join(outDir, "ldd-report-issue-links.json"), {
    schema_version: "ldd-report-issue-links.v1",
    generated_at: result.generated_at,
    report_issue_link_count: result.ldd_report_issue_links.length,
    ldd_report_issue_links: result.ldd_report_issue_links,
  });
  await writeJson(path.join(outDir, "ldd-report-matter-summaries.json"), {
    schema_version: "ldd-report-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.ldd_report_matter_summaries.length,
    ldd_report_matter_summaries: result.ldd_report_matter_summaries,
  });
  await writeJson(path.join(outDir, "ldd-report-draft-boundary.json"), {
    schema_version: "ldd-report-draft-boundary-artifact.v1",
    generated_at: result.generated_at,
    ldd_report_draft_desktop_boundary: result.ldd_report_draft_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ldd-report-draft-validation-report.v1",
    generated_at: result.generated_at,
    ldd_report_draft_id: result.ldd_report_draft_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLddReportDraftCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLddReportDraft(args);
    console.log(`LDD report draft ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ldd_report_draft_status}`);
    console.log(`Sections/paragraphs: ${result.summary.section_count}/${result.summary.paragraph_count}`);
    console.log(`Citation placeholders: ${result.summary.citation_placeholder_count}`);
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
    schema_version: "ldd-report-draft-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    generation_rule: "LDD report draft sections and paragraphs are deterministic draft-only rows generated from P245 RFI drafts, P244 issue candidates, legal citation verifier gates, and demo matter metadata",
    citation_placeholder_rule: "every report paragraph carries at least one citation placeholder with source refs and currentness/legal-authority review still required",
    issue_link_rule: "draft paragraphs link back to P244 issue candidates where applicable",
    client_output_rule: "report paragraphs are not client-facing-ready and cannot be used externally without attorney/human review and partner approval",
    attorney_review_rule: "every section, paragraph, citation placeholder, and issue link remains attorney/human-review gated",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, legal conclusion, or final client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildSectionRules(generatedAt) {
  return SECTION_RULES.map((rule, index) => ({
    schema_version: "ldd-report-section-rule.v1",
    ldd_report_section_rule_id: `ldd-report-section-rule.${rule.section_type}`,
    section_type: rule.section_type,
    section_label: rule.section_label,
    rule_description: rule.rule_description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    legal_conclusion_allowed: false,
    client_facing_ready_allowed: false,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildReportSections({ lddRfiGenerator, lddIssueDetection, matter, generatedAt }) {
  const matterId = matter?.matter_id ?? lddRfiGenerator?.summary?.source_matter_id ?? "matter.unknown";
  const sectionSpecs = [
    ["executive_summary", "Executive Summary", "Draft overview of issue and RFI counts"],
    ["red_flags", "Red Flags and Priority Issues", "Draft summary of red/yellow issue candidates"],
    ["open_rfi", "Open RFI Items", "Draft summary of internal RFI questions"],
    ["source_gaps", "Source Gaps and Citation Work", "Draft summary of source text and citation confirmation needs"],
    ["attorney_review_gate", "Attorney Review Gate", "Draft summary of review and approval requirements"],
  ];
  return sectionSpecs.map(([sectionType, title, description], index) => ({
    schema_version: "ldd-report-section.v1",
    ldd_report_section_id: `ldd-report-section.${String(index + 1).padStart(2, "0")}.${sectionType}`,
    matter_id: matterId,
    section_type: sectionType,
    section_title: title,
    section_description: description,
    section_order: index + 1,
    section_status: "draft_pending_attorney_review",
    paragraph_ids: [],
    paragraph_count: 0,
    issue_count: 0,
    citation_placeholder_count: 0,
    source_issue_record_count: lddIssueDetection?.summary?.issue_record_count ?? 0,
    source_rfi_question_count: lddRfiGenerator?.summary?.rfi_question_count ?? 0,
    draft_only: true,
    client_facing_ready: false,
    attorney_review_required: true,
    human_review_required: true,
    human_review_note: "Draft section only; attorney review and partner approval are required before any client-facing report use.",
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    created_at: generatedAt,
  }));
}

function buildReportParagraphs({ sections, lddRfiGenerator, lddIssueDetection, legalCitationVerifier, matter, generatedAt }) {
  const issues = lddIssueDetection?.ldd_issue_records ?? [];
  const questions = lddRfiGenerator?.ldd_rfi_questions ?? [];
  const issueIds = issues.map((issue) => issue.ldd_issue_record_id);
  const redIssues = issues.filter((issue) => issue.issue_flag === "red");
  const yellowIssues = issues.filter((issue) => issue.issue_flag === "yellow");
  const sourceGapIssues = issues.filter((issue) => issue.issue_type === "source_gap" || issue.source_gap);
  const highQuestions = questions.filter((question) => question.rfi_question_priority === "high");
  const matterId = matter?.matter_id ?? lddRfiGenerator?.summary?.source_matter_id ?? "matter.unknown";
  const reviewer = matter?.review_workflow?.default_reviewer ?? matter?.matter_profile?.responsible_partner ?? "Senior Lee";
  const sourceRef = (kind, id, field) => ({ source_kind: kind, source_id: id, source_field: field });
  const paragraphSpecs = [
    {
      section_type: "executive_summary",
      paragraph_role: "overview",
      paragraph_text: `${matter?.title ?? matterId} draft LDD report summary identifies ${redIssues.length} red flag issue(s), ${yellowIssues.length} yellow flag issue(s), and ${questions.length} draft RFI question(s) for attorney review; this paragraph is draft-only and does not state legal conclusions.`,
      linked_issue_ids: issueIds,
      linked_rfi_question_ids: questions.map((question) => question.ldd_rfi_question_id),
      source_refs: [
        sourceRef("ldd_rfi_generator", lddRfiGenerator?.ldd_rfi_generator_id, "summary"),
        sourceRef("ldd_issue_detection", lddIssueDetection?.ldd_issue_detection_id, "summary"),
        sourceRef("legal_citation_verifier", legalCitationVerifier?.legal_citation_verifier_id, "summary"),
      ],
    },
    {
      section_type: "red_flags",
      paragraph_role: "issue_summary",
      paragraph_text: `Draft priority issue section notes ${redIssues.map((issue) => issue.issue_title).join("; ") || "no red flag issues"} as attorney-review topics based on issue metadata and RFI links; no legal conclusion is final.`,
      linked_issue_ids: redIssues.map((issue) => issue.ldd_issue_record_id),
      linked_rfi_question_ids: questions.filter((question) => redIssues.some((issue) => issue.ldd_issue_record_id === question.ldd_issue_record_id)).map((question) => question.ldd_rfi_question_id),
      source_refs: redIssues.flatMap((issue) => issue.source_refs ?? []).concat(redIssues.map((issue) => sourceRef("ldd_issue_record", issue.ldd_issue_record_id, "issue_title"))),
    },
    {
      section_type: "open_rfi",
      paragraph_role: "rfi_summary",
      paragraph_text: `Draft RFI section lists ${highQuestions.length} high-priority and ${questions.length - highQuestions.length} other draft request(s), all blocked from client-facing circulation until attorney review and partner approval.`,
      linked_issue_ids: questions.map((question) => question.ldd_issue_record_id).filter(Boolean),
      linked_rfi_question_ids: questions.map((question) => question.ldd_rfi_question_id),
      source_refs: questions.flatMap((question) => question.evidence_refs ?? []).concat(questions.map((question) => sourceRef("ldd_rfi_question", question.ldd_rfi_question_id, "question_text"))),
    },
    {
      section_type: "source_gaps",
      paragraph_role: "source_gap_summary",
      paragraph_text: `Draft source-gap section flags ${sourceGapIssues.map((issue) => issue.issue_title).join("; ") || "no source-gap issue"} for source-text confirmation and citation/currentness review before downstream use.`,
      linked_issue_ids: sourceGapIssues.map((issue) => issue.ldd_issue_record_id),
      linked_rfi_question_ids: questions.filter((question) => sourceGapIssues.some((issue) => issue.ldd_issue_record_id === question.ldd_issue_record_id)).map((question) => question.ldd_rfi_question_id),
      source_refs: sourceGapIssues.flatMap((issue) => issue.source_refs ?? []).concat(sourceRef("legal_citation_verifier", legalCitationVerifier?.legal_citation_verifier_id, "legal_citation_verification_records")),
    },
    {
      section_type: "attorney_review_gate",
      paragraph_role: "review_gate_summary",
      paragraph_text: `Draft review gate section records that ${reviewer} or another designated attorney must confirm sources, legal authority placeholders, currentness, and partner approval before any client-facing LDD report use.`,
      linked_issue_ids: issueIds,
      linked_rfi_question_ids: questions.map((question) => question.ldd_rfi_question_id),
      source_refs: [
        sourceRef("ldd_rfi_generator", lddRfiGenerator?.ldd_rfi_generator_id, "safe_handling"),
        sourceRef("ldd_issue_detection", lddIssueDetection?.ldd_issue_detection_id, "safe_handling"),
        sourceRef("legal_citation_verifier", legalCitationVerifier?.legal_citation_verifier_id, "safe_handling"),
      ],
    },
  ];
  return paragraphSpecs.map((spec, index) => {
    const section = sections.find((item) => item.section_type === spec.section_type);
    const paragraphId = `ldd-report-paragraph.${String(index + 1).padStart(3, "0")}.${slug(spec.section_type)}`;
    const sourceRefs = uniqueRefs(spec.source_refs);
    return {
      schema_version: "ldd-report-paragraph.v1",
      ldd_report_paragraph_id: paragraphId,
      matter_id: matterId,
      ldd_report_section_id: section?.ldd_report_section_id,
      section_type: spec.section_type,
      paragraph_role: spec.paragraph_role,
      paragraph_order: index + 1,
      paragraph_text: spec.paragraph_text,
      paragraph_status: "draft_pending_attorney_review",
      linked_issue_ids: uniqueStrings(spec.linked_issue_ids),
      linked_issue_count: uniqueStrings(spec.linked_issue_ids).length,
      linked_rfi_question_ids: uniqueStrings(spec.linked_rfi_question_ids),
      linked_rfi_question_count: uniqueStrings(spec.linked_rfi_question_ids).length,
      citation_placeholder_ids: [],
      citation_placeholder_count: 0,
      source_refs: sourceRefs,
      source_ref_count: sourceRefs.length,
      draft_only: true,
      deterministic_report_draft_generation_performed: true,
      citation_placeholder_required: true,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required: true,
      human_review_note: "Draft paragraph only; source, citation, legal authority, and currentness review are required before client-facing use.",
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      created_at: generatedAt,
    };
  });
}

function attachParagraphsToSections(sections, paragraphs) {
  for (const section of sections) {
    const sectionParagraphs = paragraphs.filter((paragraph) => paragraph.ldd_report_section_id === section.ldd_report_section_id);
    section.paragraph_ids = sectionParagraphs.map((paragraph) => paragraph.ldd_report_paragraph_id);
    section.paragraph_count = sectionParagraphs.length;
    section.issue_count = new Set(sectionParagraphs.flatMap((paragraph) => paragraph.linked_issue_ids)).size;
  }
}

function buildCitationPlaceholders({ paragraphs, legalCitationVerifier, generatedAt }) {
  const verifierRecords = legalCitationVerifier?.legal_citation_verification_records ?? [];
  return paragraphs.map((paragraph, index) => {
    const verifierRecord = verifierRecords[index % Math.max(verifierRecords.length, 1)];
    return {
      schema_version: "ldd-report-citation-placeholder.v1",
      ldd_report_citation_placeholder_id: `ldd-report-citation-placeholder.${String(index + 1).padStart(3, "0")}.${slug(paragraph.section_type)}`,
      matter_id: paragraph.matter_id,
      ldd_report_paragraph_id: paragraph.ldd_report_paragraph_id,
      ldd_report_section_id: paragraph.ldd_report_section_id,
      section_type: paragraph.section_type,
      placeholder_text: `[CITE:${String(index + 1).padStart(3, "0")}:${paragraph.section_type}]`,
      citation_placeholder_status: "placeholder_pending_attorney_review",
      source_refs: paragraph.source_refs,
      source_ref_count: paragraph.source_ref_count,
      legal_citation_verifier_id: legalCitationVerifier?.legal_citation_verifier_id ?? null,
      legal_citation_verification_record_id: verifierRecord?.legal_citation_verification_record_id ?? null,
      citation_kind: "legal_rule_placeholder",
      source_bound: paragraph.source_ref_count > 0,
      source_check_status: "source_refs_bound_pending_attorney_review",
      currentness_gate_applied: true,
      currentness_verified: false,
      currentness_check_status: "currentness_review_required",
      legal_authority_status: "review_required_not_authoritative",
      verification_status: "source_and_currentness_review_required",
      external_legal_research_performed: false,
      legal_authority_finalized: false,
      client_facing_ready: false,
      attorney_review_required: true,
      human_review_required: true,
      created_at: generatedAt,
    };
  });
}

function attachCitationPlaceholdersToParagraphs(paragraphs, citationPlaceholders) {
  for (const paragraph of paragraphs) {
    const placeholders = citationPlaceholders.filter((placeholder) => placeholder.ldd_report_paragraph_id === paragraph.ldd_report_paragraph_id);
    paragraph.citation_placeholder_ids = placeholders.map((placeholder) => placeholder.ldd_report_citation_placeholder_id);
    paragraph.citation_placeholder_count = placeholders.length;
  }
}

function attachCitationCountsToSections(sections, paragraphs) {
  for (const section of sections) {
    const sectionParagraphs = paragraphs.filter((paragraph) => paragraph.ldd_report_section_id === section.ldd_report_section_id);
    section.citation_placeholder_count = sectionParagraphs.reduce((sum, paragraph) => sum + paragraph.citation_placeholder_count, 0);
  }
}

function buildIssueLinks(paragraphs, generatedAt) {
  const links = [];
  for (const paragraph of paragraphs) {
    for (const issueId of paragraph.linked_issue_ids) {
      links.push({
        schema_version: "ldd-report-issue-link.v1",
        ldd_report_issue_link_id: `ldd-report-issue-link.${slug(paragraph.ldd_report_paragraph_id)}.${slug(issueId)}`,
        matter_id: paragraph.matter_id,
        ldd_report_paragraph_id: paragraph.ldd_report_paragraph_id,
        ldd_report_section_id: paragraph.ldd_report_section_id,
        ldd_issue_record_id: issueId,
        report_issue_link_status: "linked_pending_attorney_review",
        link_basis: "paragraph_issue_or_rfi_source_binding",
        attorney_review_required: true,
        human_review_required: true,
        client_facing_ready: false,
        created_at: generatedAt,
      });
    }
  }
  return links;
}

function buildMatterSummaries({ sections, paragraphs, citationPlaceholders, issueLinks, lddRfiGenerator, lddIssueDetection, generatedAt }) {
  const matterIds = [...new Set(paragraphs.map((paragraph) => paragraph.matter_id))].sort();
  return matterIds.map((matterId) => ({
    schema_version: "ldd-report-matter-summary.v1",
    ldd_report_matter_summary_id: `ldd-report-matter-summary.${slug(matterId)}`,
    matter_id: matterId,
    ldd_report_matter_status: "draft_report_pending_attorney_review",
    section_count: sections.filter((section) => section.matter_id === matterId).length,
    paragraph_count: paragraphs.filter((paragraph) => paragraph.matter_id === matterId).length,
    citation_placeholder_count: citationPlaceholders.filter((placeholder) => placeholder.matter_id === matterId).length,
    issue_link_count: issueLinks.filter((link) => link.matter_id === matterId).length,
    source_issue_record_count: lddIssueDetection?.summary?.issue_record_count ?? 0,
    source_rfi_question_count: lddRfiGenerator?.summary?.rfi_question_count ?? 0,
    draft_only: true,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required: true,
    client_facing_ready: false,
    created_at: generatedAt,
  }));
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, lddRfiGenerator, lddIssueDetection, legalCitationVerifier, matter, rules, sections, paragraphs, citationPlaceholders, issueLinks, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  const issueIds = new Set((lddIssueDetection?.ldd_issue_records ?? []).map((issue) => issue.ldd_issue_record_id));
  const linkedIssueIds = new Set(issueLinks.map((link) => link.ldd_issue_record_id));
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:report-draft"]), "package.json exposes law-firm:report-draft."),
    checkpoint("roadmap.p246", String(roadmapText ?? "").includes("P246"), "P246 roadmap slot is present."),
    checkpoint("source.rfi_generator.complete", lddRfiGenerator?.summary?.ldd_rfi_generator_status === "complete", "Source LDD RFI generator is complete."),
    checkpoint("source.issue_detection.complete", lddIssueDetection?.summary?.ldd_issue_detection_status === "complete", "Source LDD issue detection is complete."),
    checkpoint("source.legal_citation_verifier.complete", legalCitationVerifier?.summary?.legal_citation_verifier_status === "complete", "Source legal citation verifier is complete."),
    checkpoint("source.legal_citation_verifier.placeholders", (legalCitationVerifier?.summary?.legal_rule_placeholder_citation_count ?? 0) > 0, "Legal citation verifier exposes legal rule placeholders."),
    checkpoint("source.matter.scoped", Boolean(matter?.matter_id), "Matter source is scoped by matter_id."),
    checkpoint("rules.present", rules.length >= 5, "LDD report section rules are present."),
    checkpoint("sections.present", sections.length >= 5, "Report sections are generated."),
    checkpoint("paragraphs.cover.sections", sections.every((section) => section.paragraph_count > 0) && paragraphs.length >= sections.length, "Every section has a draft paragraph."),
    checkpoint("paragraphs.have.source.refs", paragraphs.every((paragraph) => paragraph.source_ref_count > 0), "Every report paragraph has source refs."),
    checkpoint("paragraphs.have.placeholders", paragraphs.every((paragraph) => paragraph.citation_placeholder_count > 0), "Every report paragraph has citation placeholders."),
    checkpoint("citations.cover.paragraphs", citationPlaceholders.length === paragraphs.length, "Every paragraph has exactly one citation placeholder."),
    checkpoint("citations.currentness.gated", citationPlaceholders.every((placeholder) => placeholder.currentness_gate_applied && placeholder.currentness_verified === false && placeholder.currentness_check_status === "currentness_review_required"), "Every citation placeholder keeps currentness review required."),
    checkpoint("citations.legal_authority.not_final", citationPlaceholders.every((placeholder) => placeholder.legal_authority_finalized === false && placeholder.legal_authority_status === "review_required_not_authoritative"), "No legal authority placeholder is finalized."),
    checkpoint("issue.links.cover.issues", [...issueIds].every((issueId) => linkedIssueIds.has(issueId)), "Every P244 issue candidate is linked to at least one report paragraph."),
    checkpoint("matter.summary.present", matterSummaries.length > 0, "Matter report summaries are generated."),
    checkpoint("review.gated", [...sections, ...paragraphs, ...citationPlaceholders, ...issueLinks].every((row) => row.attorney_review_required && row.human_review_required && row.client_facing_ready === false), "All report rows are attorney/human-review gated and not client-facing-ready."),
    checkpoint("human.review.note", paragraphs.every((paragraph) => paragraph.human_review_note), "Every report paragraph includes a human review note."),
    checkpoint("no.legal.advice", paragraphs.every((paragraph) => paragraph.legal_advice_provided === false && paragraph.legal_conclusion_asserted === false), "No legal advice or legal conclusion is generated."),
    checkpoint("no.final.client.output", paragraphs.every((paragraph) => paragraph.client_facing_output_generated === false), "No final client-facing output is generated."),
    checkpoint("no.mutation", [...sections, ...paragraphs].every((row) => row.matter_data_write_allowed === false && row.task_state_write_allowed === false && row.workflow_transition_allowed === false && row.runtime_execution_allowed === false && row.delivery_execution_allowed === false && row.protected_action_allowed === false), "No matter/task/workflow/runtime/delivery/protected mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLddReportDraft({ sourceReads, lddRfiGenerator, lddIssueDetection, legalCitationVerifier, rules, sections, paragraphs, citationPlaceholders, issueLinks, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  return {
    ldd_report_draft_status: validation.valid ? "complete" : "blocked",
    ldd_report_draft_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_ldd_rfi_generator_status: sourceStatus("ldd_rfi_generator"),
    source_ldd_rfi_generator_phase_status: lddRfiGenerator?.summary?.ldd_rfi_generator_status ?? "unknown",
    source_ldd_issue_detection_status: sourceStatus("ldd_issue_detection"),
    source_ldd_issue_detection_phase_status: lddIssueDetection?.summary?.ldd_issue_detection_status ?? "unknown",
    source_legal_citation_verifier_status: sourceStatus("legal_citation_verifier"),
    source_legal_citation_verifier_phase_status: legalCitationVerifier?.summary?.legal_citation_verifier_status ?? "unknown",
    source_matter_status: sourceStatus("matter"),
    source_matter_id: paragraphs[0]?.matter_id ?? null,
    source_issue_record_count: lddIssueDetection?.summary?.issue_record_count ?? 0,
    source_rfi_question_count: lddRfiGenerator?.summary?.rfi_question_count ?? 0,
    source_rfi_draft_count: lddRfiGenerator?.summary?.rfi_draft_count ?? 0,
    source_legal_citation_verification_record_count: legalCitationVerifier?.summary?.verification_record_count ?? 0,
    source_legal_rule_placeholder_citation_count: legalCitationVerifier?.summary?.legal_rule_placeholder_citation_count ?? 0,
    source_currentness_verified_count: legalCitationVerifier?.summary?.currentness_verified_count ?? 0,
    section_rule_count: rules.length,
    section_count: sections.length,
    paragraph_count: paragraphs.length,
    citation_placeholder_count: citationPlaceholders.length,
    issue_link_count: issueLinks.length,
    matter_count: matterSummaries.length,
    red_flag_issue_count: (lddIssueDetection?.summary?.red_flag_count ?? 0),
    yellow_flag_issue_count: (lddIssueDetection?.summary?.yellow_flag_count ?? 0),
    high_priority_rfi_question_count: (lddRfiGenerator?.summary?.high_priority_question_count ?? 0),
    paragraph_with_citation_placeholder_count: paragraphs.filter((paragraph) => paragraph.citation_placeholder_count > 0).length,
    paragraph_with_issue_link_count: paragraphs.filter((paragraph) => paragraph.linked_issue_count > 0).length,
    citation_placeholder_with_source_ref_count: citationPlaceholders.filter((placeholder) => placeholder.source_ref_count > 0).length,
    citation_placeholder_currentness_review_required_count: citationPlaceholders.filter((placeholder) => placeholder.currentness_check_status === "currentness_review_required").length,
    citation_placeholder_legal_authority_review_required_count: citationPlaceholders.filter((placeholder) => placeholder.legal_authority_status === "review_required_not_authoritative").length,
    draft_only_count: paragraphs.filter((paragraph) => paragraph.draft_only).length,
    human_review_note_count: paragraphs.filter((paragraph) => paragraph.human_review_note).length,
    deterministic_report_draft_generation_count: paragraphs.filter((paragraph) => paragraph.deterministic_report_draft_generation_performed).length,
    attorney_review_required_paragraph_count: paragraphs.filter((paragraph) => paragraph.attorney_review_required).length,
    human_review_required_paragraph_count: paragraphs.filter((paragraph) => paragraph.human_review_required).length,
    client_facing_ready_count: [...sections, ...paragraphs, ...citationPlaceholders].filter((row) => row.client_facing_ready).length,
    legal_conclusion_asserted_count: paragraphs.filter((paragraph) => paragraph.legal_conclusion_asserted).length,
    legal_advice_provided: false,
    client_facing_output_generated: false,
    external_legal_research_performed: false,
    legal_authority_finalized: false,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed,
    task_state_write_allowed: desktopBoundary.task_state_write_allowed,
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed,
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed,
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed,
    protected_action_allowed: desktopBoundary.protected_action_allowed,
    client_facing_output_allowed_without_attorney_review: false,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    draft_only: true,
    deterministic_report_draft_generation_performed: true,
    citation_placeholder_generation_performed: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    external_legal_research_performed: false,
    legal_authority_finalized: false,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
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
    schema_version: "ldd-report-draft-desktop-boundary.v1",
    boundary_status: "enforced",
    read_only: true,
    desktop_mutation_allowed: false,
    desktop_source_of_truth: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    generated_at: generatedAt,
  };
}

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    sources: sourceReads.map((source) => ({
      source_id: source.source_id,
      source_kind: source.source_kind,
      path: source.path,
      status: source.status,
      schema_version: source.value?.schema_version ?? null,
      error: source.error ?? null,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:report-draft"]),
    roadmap_p246_present: String(roadmapText.value ?? "").includes("P246"),
  };
}

function renderLddReportDraftMarkdown(result) {
  const lines = [
    "# LDD Report Draft",
    "",
    `- Status: ${result.summary.ldd_report_draft_status}`,
    `- Sections: ${result.summary.section_count}`,
    `- Paragraphs: ${result.summary.paragraph_count}`,
    `- Citation placeholders: ${result.summary.citation_placeholder_count}`,
    `- Issue links: ${result.summary.issue_link_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing ready: ${result.safe_handling.client_facing_ready}`,
    "",
  ];
  for (const section of result.ldd_report_sections) {
    lines.push(`## ${section.section_title}`, "");
    for (const paragraph of result.ldd_report_paragraphs.filter((item) => item.ldd_report_section_id === section.ldd_report_section_id)) {
      lines.push(`${paragraph.paragraph_text} ${paragraph.citation_placeholder_ids.map((id) => `[${id}]`).join(" ")}`, "");
    }
  }
  lines.push("These rows are deterministic internal report draft paragraphs only. Attorney review, citation/currentness review, and partner approval remain required before any client-facing use.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LDD_REPORT_DRAFT_INPUTS;
  return {
    ldd_rfi_generator_path: path.resolve(options.lddRfiGeneratorPath ?? defaults.lddRfiGeneratorPath),
    ldd_issue_detection_path: path.resolve(options.lddIssueDetectionPath ?? defaults.lddIssueDetectionPath),
    legal_citation_verifier_path: path.resolve(options.legalCitationVerifierPath ?? defaults.legalCitationVerifierPath),
    matter_path: path.resolve(options.matterPath ?? defaults.matterPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const artifactInputs = [
    ["ldd_rfi_generator", "artifact", inputs.ldd_rfi_generator_path],
    ["ldd_issue_detection", "artifact", inputs.ldd_issue_detection_path],
    ["legal_citation_verifier", "artifact", inputs.legal_citation_verifier_path],
    ["matter", "matter_file", inputs.matter_path],
  ];
  return Promise.all(artifactInputs.map(async ([sourceId, sourceKind, sourcePath]) => {
    const read = await readJsonOrError(sourcePath);
    return {
      source_id: sourceId,
      source_kind: sourceKind,
      path: sourcePath,
      status: read.value ? "complete" : "missing",
      value: read.value,
      error: read.error,
    };
  }));
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path ?? item.check_id, message: item.message, status: item.status }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8") };
  } catch (error) {
    return { error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableLddReportDraft(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function sectionRule(sectionType, sectionLabel, ruleDescription) {
  return { section_type: sectionType, section_label: sectionLabel, rule_description: ruleDescription };
}

function uniqueRefs(refs) {
  const byKey = new Map();
  for (const ref of refs.filter((item) => item?.source_kind && item?.source_id)) {
    byKey.set(`${ref.source_kind}|${ref.source_id}|${ref.source_field ?? ""}`, ref);
  }
  return [...byKey.values()];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

function dateStamp(value) {
  return String(value).replace(/[^0-9]/g, "").slice(0, 14);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--ldd-rfi-generator") parsed.lddRfiGeneratorPath = argv[++index];
    else if (arg === "--ldd-issue-detection") parsed.lddIssueDetectionPath = argv[++index];
    else if (arg === "--legal-citation-verifier") parsed.legalCitationVerifierPath = argv[++index];
    else if (arg === "--matter") parsed.matterPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/ldd-report-draft.mjs [options]

Options:
  --check                                   Exit non-zero if validation fails.
  --out-dir <dir>                           Output directory.
  --ldd-rfi-generator <file>                LDD RFI generator artifact.
  --ldd-issue-detection <file>              LDD issue detection artifact.
  --legal-citation-verifier <file>          Legal citation verifier artifact.
  --matter <file>                           Matter JSON file.
  --package <file>                          package.json path.
  --roadmap <file>                          Phase ledger path.
  --run-at <iso>                            Deterministic timestamp.
`);
}
