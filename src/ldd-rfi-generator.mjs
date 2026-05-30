import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LDD_RFI_GENERATOR_OUT_DIR = "artifacts/ldd-rfi-generator/latest";
export const DEFAULT_LDD_RFI_GENERATOR_INPUTS = {
  lddIssueDetectionPath: "artifacts/ldd-issue-detection/latest/ldd-issue-detection.json",
  lddVdrInventoryPath: "artifacts/ldd-vdr-inventory/latest/ldd-vdr-inventory.json",
  matterPath: "examples/project-alpha-matter.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "ldd-rfi-generator.v1";
const SOURCE_OF_TRUTH = "ldd_issue_detection_vdr_missing_data_and_demo_matter_metadata";
const RFI_RULES = [
  rfiRule("missing_material_request", "Missing material request", "VDR missing/requested rows become draft RFI question support, not factual non-existence findings"),
  rfiRule("issue_follow_up_question", "Issue follow-up question", "P244 issue candidates become attorney-reviewable RFI draft questions"),
  rfiRule("source_gap_request", "Source gap request", "Source-gap issue candidates become source-location or source-text requests"),
  rfiRule("negotiation_position_question", "Negotiation position question", "Open negotiation metadata becomes internal clarification questions without legal advice"),
  rfiRule("attorney_review_gate", "Attorney review gate", "Every RFI draft row remains draft-only until attorney/human review"),
];

export async function runLddRfiGenerator(options = {}) {
  const result = await buildLddRfiGenerator(options);
  if (options.write !== false) await writeLddRfiGenerator(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`LDD RFI generator validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLddRfiGenerator(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LDD_RFI_GENERATOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const lddIssueDetection = sourceById.ldd_issue_detection;
  const lddVdrInventory = sourceById.ldd_vdr_inventory;
  const matter = sourceById.matter;
  const rules = buildRfiRules(generatedAt);
  const questions = buildRfiQuestions({ lddIssueDetection, lddVdrInventory, matter, generatedAt });
  const missingMaterialLinks = buildMissingMaterialLinks(questions, generatedAt);
  const issueLinks = buildIssueLinks(questions, generatedAt);
  const drafts = buildRfiDrafts(questions, missingMaterialLinks, matter, generatedAt);
  const matterSummaries = buildMatterSummaries(drafts, questions, missingMaterialLinks, issueLinks, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    lddIssueDetection,
    lddVdrInventory,
    matter,
    rules,
    drafts,
    questions,
    missingMaterialLinks,
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
  const summary = summarizeLddRfiGenerator({
    sourceReads,
    lddIssueDetection,
    lddVdrInventory,
    rules,
    drafts,
    questions,
    missingMaterialLinks,
    issueLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    ldd_rfi_generator_id: `ldd-rfi-generator.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    ldd_rfi_generator_status: summary.ldd_rfi_generator_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    ldd_rfi_generator_contract: buildContract(generatedAt),
    ldd_rfi_rules: rules,
    ldd_rfi_drafts: drafts,
    ldd_rfi_questions: questions,
    ldd_rfi_missing_material_links: missingMaterialLinks,
    ldd_rfi_issue_links: issueLinks,
    ldd_rfi_matter_summaries: matterSummaries,
    ldd_rfi_generator_desktop_boundary: desktopBoundary,
    ldd_rfi_generator_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLddRfiGeneratorMarkdown(result),
  };
}

export async function writeLddRfiGenerator(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLddRfiGenerator(result);
  await writeJson(path.join(outDir, "ldd-rfi-generator.json"), serializable);
  await writeJson(path.join(outDir, "ldd-rfi-rules.json"), {
    schema_version: "ldd-rfi-rules.v1",
    generated_at: result.generated_at,
    rfi_rule_count: result.ldd_rfi_rules.length,
    ldd_rfi_rules: result.ldd_rfi_rules,
  });
  await writeJson(path.join(outDir, "ldd-rfi-drafts.json"), {
    schema_version: "ldd-rfi-drafts.v1",
    generated_at: result.generated_at,
    rfi_draft_count: result.ldd_rfi_drafts.length,
    ldd_rfi_drafts: result.ldd_rfi_drafts,
  });
  await writeJson(path.join(outDir, "ldd-rfi-questions.json"), {
    schema_version: "ldd-rfi-questions.v1",
    generated_at: result.generated_at,
    rfi_question_count: result.ldd_rfi_questions.length,
    ldd_rfi_questions: result.ldd_rfi_questions,
  });
  await writeJson(path.join(outDir, "ldd-rfi-missing-material-links.json"), {
    schema_version: "ldd-rfi-missing-material-links.v1",
    generated_at: result.generated_at,
    rfi_missing_material_link_count: result.ldd_rfi_missing_material_links.length,
    ldd_rfi_missing_material_links: result.ldd_rfi_missing_material_links,
  });
  await writeJson(path.join(outDir, "ldd-rfi-issue-links.json"), {
    schema_version: "ldd-rfi-issue-links.v1",
    generated_at: result.generated_at,
    rfi_issue_link_count: result.ldd_rfi_issue_links.length,
    ldd_rfi_issue_links: result.ldd_rfi_issue_links,
  });
  await writeJson(path.join(outDir, "ldd-rfi-matter-summaries.json"), {
    schema_version: "ldd-rfi-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.ldd_rfi_matter_summaries.length,
    ldd_rfi_matter_summaries: result.ldd_rfi_matter_summaries,
  });
  await writeJson(path.join(outDir, "ldd-rfi-generator-boundary.json"), {
    schema_version: "ldd-rfi-generator-boundary-artifact.v1",
    generated_at: result.generated_at,
    ldd_rfi_generator_desktop_boundary: result.ldd_rfi_generator_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ldd-rfi-generator-validation-report.v1",
    generated_at: result.generated_at,
    ldd_rfi_generator_id: result.ldd_rfi_generator_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLddRfiGeneratorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLddRfiGenerator(args);
    console.log(`LDD RFI generator ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ldd_rfi_generator_status}`);
    console.log(`Drafts/questions: ${result.summary.rfi_draft_count}/${result.summary.rfi_question_count}`);
    console.log(`Missing-material links: ${result.summary.missing_material_link_count}`);
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
    schema_version: "ldd-rfi-generator-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    generation_rule: "RFI drafts are deterministic draft-only rows generated from P244 issue candidates, P240 VDR missing-data rows, and demo matter metadata",
    issue_link_rule: "every RFI question is linked to a P244 issue candidate",
    evidence_link_rule: "every RFI question carries source evidence references; missing material questions also link to VDR missing-data records",
    missing_data_rule: "missing/requested material remains a follow-up request and is not treated as factual non-existence",
    client_output_rule: "RFI rows are not client-facing-ready and cannot be sent without attorney/human review",
    attorney_review_rule: "every draft, question, missing-material link, and issue link remains attorney/human-review gated",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, or final client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildRfiRules(generatedAt) {
  return RFI_RULES.map((rule, index) => ({
    schema_version: "ldd-rfi-rule.v1",
    ldd_rfi_rule_id: `ldd-rfi-rule.${rule.rfi_rule_type}`,
    rfi_rule_type: rule.rfi_rule_type,
    rule_label: rule.rule_label,
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

function buildRfiQuestions({ lddIssueDetection, lddVdrInventory, matter, generatedAt }) {
  const issues = lddIssueDetection?.ldd_issue_records ?? [];
  const missingRows = lddVdrInventory?.ldd_vdr_missing_data_records ?? [];
  return issues.map((issue, index) => {
    const missingMatches = matchMissingRows(issue, missingRows);
    const questionText = buildQuestionText(issue, missingMatches, matter);
    const evidenceRefs = buildEvidenceRefs(issue, missingMatches);
    return {
      schema_version: "ldd-rfi-question.v1",
      ldd_rfi_question_id: `ldd-rfi-question.${String(index + 1).padStart(3, "0")}.${slug(issue.issue_type)}.${slug(issue.issue_title)}`,
      matter_id: issue.matter_id,
      ldd_issue_record_id: issue.ldd_issue_record_id,
      issue_type: issue.issue_type,
      issue_title: issue.issue_title,
      issue_severity: issue.issue_severity,
      issue_flag: issue.issue_flag,
      rfi_question_type: questionTypeForIssue(issue),
      rfi_question_priority: priorityForIssue(issue),
      question_text: questionText,
      rfi_question_status: "draft_pending_attorney_review",
      missing_material_ids: missingMatches.map((row) => row.ldd_vdr_missing_data_record_id),
      missing_material_count: missingMatches.length,
      source_fact_ids: issue.source_fact_ids ?? [],
      source_fact_count: (issue.source_fact_ids ?? []).length,
      evidence_refs: evidenceRefs,
      evidence_ref_count: evidenceRefs.length,
      question_owner: issue.follow_up_owner ?? matter?.review_workflow?.default_reviewer ?? "Senior Lee",
      requested_due: issue.follow_up_due ?? null,
      draft_only: true,
      deterministic_rfi_generation_performed: true,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      attorney_review_required: true,
      human_review_required: true,
      human_review_note: "Draft only; attorney review and partner approval are required before any client-facing use.",
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      created_at: generatedAt,
      sequence_number: index + 1,
    };
  });
}

function buildQuestionText(issue, missingMatches, matter) {
  const titles = missingMatches.map((row) => row.missing_title).filter(Boolean);
  if (issue.issue_type === "tax_exposure") {
    return "Please provide the FY2024-FY2026 related-party transaction ledger and confirm whether the tax team has signed off on the related-party issue.";
  }
  if (issue.issue_type === "missing_deliverable" && /officer certificate/i.test(issue.issue_title)) {
    return "Please provide the officer certificate draft or confirm the expected delivery date and responsible owner.";
  }
  if (issue.issue_type === "missing_deliverable") {
    return "Please provide the latest updated disclosure schedule and confirm the client-side owner and delivery timing.";
  }
  if (issue.issue_type === "negotiation_gap") {
    const qa = (matter?.deal_control?.qa_items ?? []).find((item) => /escrow|tax exposure/i.test(item.question ?? ""));
    return qa?.question
      ? `Please confirm: ${qa.question}`
      : "Please confirm the current client position on the tax exposure cap and escrow carve-out for SPA 8.2.";
  }
  if (issue.issue_type === "source_gap") {
    return "Please provide the source text or source location for termination terms before downstream use.";
  }
  return titles.length > 0
    ? `Please provide or confirm the following materials: ${titles.join("; ")}.`
    : `Please confirm the requested follow-up for ${issue.issue_title}.`;
}

function buildEvidenceRefs(issue, missingMatches) {
  const refs = [];
  for (const row of missingMatches) {
    refs.push(sourceRef("ldd_vdr_missing_data_record", row.ldd_vdr_missing_data_record_id, "missing_title"));
  }
  for (const factId of issue.source_fact_ids ?? []) {
    refs.push(sourceRef("ldd_fact_record", factId, "ldd_fact_records"));
  }
  for (const ref of issue.source_refs ?? []) {
    refs.push(sourceRef(ref.source_kind, ref.source_id, ref.source_field));
  }
  return uniqueRefs(refs);
}

function buildMissingMaterialLinks(questions, generatedAt) {
  const links = [];
  for (const question of questions) {
    for (const missingMaterialId of question.missing_material_ids) {
      links.push({
        schema_version: "ldd-rfi-missing-material-link.v1",
        ldd_rfi_missing_material_link_id: `ldd-rfi-missing-link.${slug(question.ldd_rfi_question_id)}.${slug(missingMaterialId)}`,
        matter_id: question.matter_id,
        ldd_rfi_question_id: question.ldd_rfi_question_id,
        ldd_issue_record_id: question.ldd_issue_record_id,
        ldd_vdr_missing_data_record_id: missingMaterialId,
        rfi_missing_material_status: "linked_pending_attorney_review",
        evidence_source_kind: "ldd_vdr_missing_data_record",
        link_basis: "source_record_or_issue_metadata_match",
        attorney_review_required: true,
        human_review_required: true,
        client_facing_ready: false,
        created_at: generatedAt,
      });
    }
  }
  return links;
}

function buildIssueLinks(questions, generatedAt) {
  return questions.map((question) => ({
    schema_version: "ldd-rfi-issue-link.v1",
    ldd_rfi_issue_link_id: `ldd-rfi-issue-link.${slug(question.ldd_rfi_question_id)}.${slug(question.ldd_issue_record_id)}`,
    matter_id: question.matter_id,
    ldd_rfi_question_id: question.ldd_rfi_question_id,
    ldd_issue_record_id: question.ldd_issue_record_id,
    issue_type: question.issue_type,
    issue_flag: question.issue_flag,
    rfi_issue_link_status: "linked_pending_attorney_review",
    evidence_ref_count: question.evidence_ref_count,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    created_at: generatedAt,
  }));
}

function buildRfiDrafts(questions, missingMaterialLinks, matter, generatedAt) {
  const matterIds = [...new Set(questions.map((question) => question.matter_id))].sort();
  return matterIds.map((matterId) => {
    const matterQuestions = questions.filter((question) => question.matter_id === matterId);
    const matterMissingLinks = missingMaterialLinks.filter((link) => link.matter_id === matterId);
    return {
      schema_version: "ldd-rfi-draft.v1",
      ldd_rfi_draft_id: `ldd-rfi-draft.${slug(matterId)}.${dateStamp(generatedAt)}`,
      matter_id: matterId,
      draft_title: `Draft RFI questions for ${matter?.title ?? matterId}`,
      rfi_draft_status: "internal_attorney_review_required",
      draft_kind: "internal_rfi_draft_packet",
      question_count: matterQuestions.length,
      missing_material_link_count: matterMissingLinks.length,
      red_flag_question_count: matterQuestions.filter((question) => question.issue_flag === "red").length,
      yellow_flag_question_count: matterQuestions.filter((question) => question.issue_flag === "yellow").length,
      source_gap_question_count: matterQuestions.filter((question) => question.rfi_question_type === "source_request").length,
      draft_question_ids: matterQuestions.map((question) => question.ldd_rfi_question_id),
      human_review_note: "Draft only; attorney review and partner approval are required before any client-facing use.",
      responsible_reviewer: matter?.review_workflow?.default_reviewer ?? matter?.matter_profile?.responsible_partner ?? "Senior Lee",
      partner_approval_required: true,
      draft_only: true,
      client_facing_ready: false,
      client_facing_output_generated: false,
      attorney_review_required: true,
      human_review_required: true,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
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

function buildMatterSummaries(drafts, questions, missingMaterialLinks, issueLinks, generatedAt) {
  const matterIds = [...new Set(questions.map((question) => question.matter_id))].sort();
  return matterIds.map((matterId) => {
    const matterDrafts = drafts.filter((draft) => draft.matter_id === matterId);
    const matterQuestions = questions.filter((question) => question.matter_id === matterId);
    const matterMissingLinks = missingMaterialLinks.filter((link) => link.matter_id === matterId);
    const matterIssueLinks = issueLinks.filter((link) => link.matter_id === matterId);
    return {
      schema_version: "ldd-rfi-matter-summary.v1",
      ldd_rfi_matter_summary_id: `ldd-rfi-matter-summary.${slug(matterId)}`,
      matter_id: matterId,
      ldd_rfi_matter_status: "draft_questions_pending_attorney_review",
      rfi_draft_count: matterDrafts.length,
      rfi_question_count: matterQuestions.length,
      missing_material_link_count: matterMissingLinks.length,
      issue_link_count: matterIssueLinks.length,
      high_priority_question_count: matterQuestions.filter((question) => question.rfi_question_priority === "high").length,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required: true,
      client_facing_ready: false,
      created_at: generatedAt,
    };
  });
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, lddIssueDetection, lddVdrInventory, matter, rules, drafts, questions, missingMaterialLinks, issueLinks, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:rfi-generator"]), "package.json exposes law-firm:rfi-generator."),
    checkpoint("roadmap.p245", String(roadmapText ?? "").includes("P245"), "P245 roadmap slot is present."),
    checkpoint("source.issue_detection.complete", lddIssueDetection?.summary?.ldd_issue_detection_status === "complete", "Source LDD issue detection is complete."),
    checkpoint("source.vdr_inventory.complete", lddVdrInventory?.summary?.ldd_vdr_inventory_status === "complete", "Source LDD VDR inventory is complete."),
    checkpoint("source.matter.scoped", Boolean(matter?.matter_id), "Matter source is scoped by matter_id."),
    checkpoint("rules.present", rules.length >= 5, "RFI generation rules are present."),
    checkpoint("drafts.present", drafts.length > 0, "At least one RFI draft packet is generated."),
    checkpoint("questions.cover.issues", questions.length === (lddIssueDetection?.summary?.issue_record_count ?? 0), "Every P244 issue candidate has one RFI question."),
    checkpoint("questions.issue.linked", questions.every((question) => Boolean(question.ldd_issue_record_id)), "Every RFI question links to an issue candidate."),
    checkpoint("questions.evidence.linked", questions.every((question) => question.evidence_ref_count > 0), "Every RFI question carries evidence/source refs."),
    checkpoint("missing.links.present", missingMaterialLinks.length === (lddVdrInventory?.summary?.rfi_candidate_count ?? 0), "Every VDR RFI candidate is linked to a question."),
    checkpoint("issue.links.cover.questions", issueLinks.length === questions.length, "Every RFI question has an issue link row."),
    checkpoint("matter.summary.present", matterSummaries.length > 0, "Matter RFI summaries are generated."),
    checkpoint("review.gated", [...drafts, ...questions, ...missingMaterialLinks, ...issueLinks].every((row) => row.attorney_review_required && row.human_review_required && row.client_facing_ready === false), "All RFI rows are attorney/human-review gated and not client-facing-ready."),
    checkpoint("human.review.note", drafts.every((draft) => draft.human_review_note), "Every RFI draft includes a human review note."),
    checkpoint("no.legal.advice", [...drafts, ...questions].every((row) => row.legal_advice_provided === false && row.legal_conclusion_asserted === false), "No legal advice or legal conclusion is generated."),
    checkpoint("no.final.client.output", drafts.every((draft) => draft.client_facing_output_generated === false), "No final client-facing output is generated."),
    checkpoint("no.mutation", [...drafts, ...questions].every((row) => row.matter_data_write_allowed === false && row.task_state_write_allowed === false && row.workflow_transition_allowed === false && row.runtime_execution_allowed === false && row.delivery_execution_allowed === false && row.protected_action_allowed === false), "No matter/task/workflow/runtime/delivery/protected mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLddRfiGenerator({ sourceReads, lddIssueDetection, lddVdrInventory, rules, drafts, questions, missingMaterialLinks, issueLinks, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  return {
    ldd_rfi_generator_status: validation.valid ? "complete" : "blocked",
    ldd_rfi_generator_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_ldd_issue_detection_status: sourceStatus("ldd_issue_detection"),
    source_ldd_issue_detection_phase_status: lddIssueDetection?.summary?.ldd_issue_detection_status ?? "unknown",
    source_ldd_vdr_inventory_status: sourceStatus("ldd_vdr_inventory"),
    source_ldd_vdr_inventory_phase_status: lddVdrInventory?.summary?.ldd_vdr_inventory_status ?? "unknown",
    source_matter_status: sourceStatus("matter"),
    source_matter_id: questions[0]?.matter_id ?? null,
    source_issue_record_count: lddIssueDetection?.summary?.issue_record_count ?? 0,
    source_missing_data_record_count: lddVdrInventory?.summary?.missing_data_record_count ?? 0,
    source_rfi_candidate_count: lddVdrInventory?.summary?.rfi_candidate_count ?? 0,
    rfi_rule_count: rules.length,
    rfi_draft_count: drafts.length,
    rfi_question_count: questions.length,
    high_priority_question_count: questions.filter((question) => question.rfi_question_priority === "high").length,
    medium_priority_question_count: questions.filter((question) => question.rfi_question_priority === "medium").length,
    missing_material_question_count: questions.filter((question) => question.missing_material_count > 0).length,
    source_gap_question_count: questions.filter((question) => question.rfi_question_type === "source_request").length,
    clarification_question_count: questions.filter((question) => question.rfi_question_type === "clarification_request").length,
    question_with_issue_link_count: questions.filter((question) => Boolean(question.ldd_issue_record_id)).length,
    question_with_evidence_link_count: questions.filter((question) => question.evidence_ref_count > 0).length,
    missing_material_link_count: missingMaterialLinks.length,
    issue_link_count: issueLinks.length,
    matter_count: matterSummaries.length,
    draft_only_count: drafts.filter((draft) => draft.draft_only).length,
    human_review_note_count: drafts.filter((draft) => draft.human_review_note).length,
    deterministic_rfi_generation_count: questions.filter((question) => question.deterministic_rfi_generation_performed).length,
    attorney_review_required_draft_count: drafts.filter((draft) => draft.attorney_review_required).length,
    attorney_review_required_question_count: questions.filter((question) => question.attorney_review_required).length,
    human_review_required_question_count: questions.filter((question) => question.human_review_required).length,
    client_facing_ready_count: [...drafts, ...questions].filter((row) => row.client_facing_ready).length,
    legal_conclusion_asserted_count: [...drafts, ...questions].filter((row) => row.legal_conclusion_asserted).length,
    legal_advice_provided: false,
    client_facing_output_generated: false,
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
    deterministic_rfi_generation_performed: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
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
    schema_version: "ldd-rfi-generator-desktop-boundary.v1",
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
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:rfi-generator"]),
    roadmap_p245_present: String(roadmapText.value ?? "").includes("P245"),
  };
}

function renderLddRfiGeneratorMarkdown(result) {
  const lines = [
    "# LDD RFI Generator",
    "",
    `- Status: ${result.summary.ldd_rfi_generator_status}`,
    `- Draft packets: ${result.summary.rfi_draft_count}`,
    `- Questions: ${result.summary.rfi_question_count}`,
    `- Missing-material links: ${result.summary.missing_material_link_count}`,
    `- Issue links: ${result.summary.issue_link_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing ready: ${result.safe_handling.client_facing_ready}`,
    "",
    "## Questions",
    "",
  ];
  for (const question of result.ldd_rfi_questions) {
    lines.push(`- ${question.rfi_question_priority}: ${question.question_text}`);
  }
  lines.push("", "These rows are deterministic internal RFI drafts only. Attorney review and partner approval remain required before any client-facing use.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LDD_RFI_GENERATOR_INPUTS;
  return {
    ldd_issue_detection_path: path.resolve(options.lddIssueDetectionPath ?? defaults.lddIssueDetectionPath),
    ldd_vdr_inventory_path: path.resolve(options.lddVdrInventoryPath ?? defaults.lddVdrInventoryPath),
    matter_path: path.resolve(options.matterPath ?? defaults.matterPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const artifactInputs = [
    ["ldd_issue_detection", "artifact", inputs.ldd_issue_detection_path],
    ["ldd_vdr_inventory", "artifact", inputs.ldd_vdr_inventory_path],
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

function matchMissingRows(issue, missingRows) {
  const sourceIds = new Set([
    issue.source_document_id,
    issue.source_vdr_request_id,
    ...(issue.source_refs ?? []).map((ref) => ref.source_id),
  ].filter(Boolean));
  return missingRows.filter((row) => sourceIds.has(row.source_record_id));
}

function questionTypeForIssue(issue) {
  if (issue.issue_type === "source_gap") return "source_request";
  if (issue.issue_type === "negotiation_gap") return "clarification_request";
  return "document_request";
}

function priorityForIssue(issue) {
  if (issue.issue_flag === "red" || issue.issue_severity === "high") return "high";
  if (issue.issue_flag === "yellow" || issue.issue_severity === "medium") return "medium";
  return "low";
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

function serializableLddRfiGenerator(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function rfiRule(rfiRuleType, ruleLabel, ruleDescription) {
  return { rfi_rule_type: rfiRuleType, rule_label: ruleLabel, rule_description: ruleDescription };
}

function sourceRef(sourceKind, sourceId, sourceField) {
  return { source_kind: sourceKind, source_id: sourceId, source_field: sourceField };
}

function uniqueRefs(refs) {
  const byKey = new Map();
  for (const ref of refs.filter((item) => item.source_kind && item.source_id)) {
    byKey.set(`${ref.source_kind}|${ref.source_id}|${ref.source_field ?? ""}`, ref);
  }
  return [...byKey.values()];
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
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--ldd-issue-detection") parsed.lddIssueDetectionPath = argv[++index];
    else if (arg === "--ldd-vdr-inventory") parsed.lddVdrInventoryPath = argv[++index];
    else if (arg === "--matter") parsed.matterPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/ldd-rfi-generator.mjs [options]

Options:
  --check                                   Exit non-zero if validation fails.
  --out-dir <dir>                           Output directory.
  --ldd-issue-detection <file>              LDD issue detection artifact.
  --ldd-vdr-inventory <file>                LDD VDR inventory artifact.
  --matter <file>                           Matter JSON file.
  --package <file>                          package.json path.
  --roadmap <file>                          Phase ledger path.
  --run-at <iso>                            Deterministic timestamp.
`);
}
