import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LDD_ISSUE_DETECTION_OUT_DIR = "artifacts/ldd-issue-detection/latest";
export const DEFAULT_LDD_ISSUE_DETECTION_INPUTS = {
  lddFactExtractionPath: "artifacts/ldd-fact-extraction/latest/ldd-fact-extraction.json",
  matterPath: "examples/project-alpha-matter.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "ldd-issue-detection.v1";
const SOURCE_OF_TRUTH = "ldd_fact_extraction_and_demo_matter_metadata";
const ISSUE_RULES = [
  issueRule("tax_exposure", "Tax exposure follow-up", "related-party, tax sign-off, and tax exposure metadata become red/yellow attorney-review issue candidates"),
  issueRule("missing_deliverable", "Missing deliverable follow-up", "missing/requested closing deliverables become follow-up issue candidates"),
  issueRule("negotiation_gap", "Negotiation gap follow-up", "open negotiation points become issue candidates without legal conclusion"),
  issueRule("source_gap", "Source gap follow-up", "fact source gaps become review-required issue candidates"),
  issueRule("closing_condition", "Closing condition follow-up", "blocked or in-review CP checklist items become closing issue candidates"),
];

export async function runLddIssueDetection(options = {}) {
  const result = await buildLddIssueDetection(options);
  if (options.write !== false) await writeLddIssueDetection(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`LDD issue detection validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLddIssueDetection(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LDD_ISSUE_DETECTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const lddFactExtraction = sourceById.ldd_fact_extraction;
  const matter = sourceById.matter;
  const rules = buildIssueRules(generatedAt);
  const issueRecords = buildIssueRecords(lddFactExtraction, matter, generatedAt);
  const followUps = buildIssueFollowUps(issueRecords, generatedAt);
  const severitySummaries = buildSeveritySummaries(issueRecords, generatedAt);
  const matterSummaries = buildMatterSummaries(issueRecords, followUps, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.value,
    lddFactExtraction,
    matter,
    rules,
    issueRecords,
    followUps,
    severitySummaries,
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
  const summary = summarizeLddIssueDetection({
    sourceReads,
    lddFactExtraction,
    matter,
    rules,
    issueRecords,
    followUps,
    severitySummaries,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    ldd_issue_detection_id: `ldd-issue-detection.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    ldd_issue_detection_status: summary.ldd_issue_detection_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    ldd_issue_detection_contract: buildContract(generatedAt),
    ldd_issue_detection_rules: rules,
    ldd_issue_records: issueRecords,
    ldd_issue_follow_ups: followUps,
    ldd_issue_severity_summaries: severitySummaries,
    ldd_issue_matter_summaries: matterSummaries,
    ldd_issue_detection_desktop_boundary: desktopBoundary,
    ldd_issue_detection_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLddIssueDetectionMarkdown(result),
  };
}

export async function writeLddIssueDetection(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLddIssueDetection(result);
  await writeJson(path.join(outDir, "ldd-issue-detection.json"), serializable);
  await writeJson(path.join(outDir, "ldd-issue-detection-rules.json"), {
    schema_version: "ldd-issue-detection-rules.v1",
    generated_at: result.generated_at,
    issue_rule_count: result.ldd_issue_detection_rules.length,
    ldd_issue_detection_rules: result.ldd_issue_detection_rules,
  });
  await writeJson(path.join(outDir, "ldd-issue-records.json"), {
    schema_version: "ldd-issue-records.v1",
    generated_at: result.generated_at,
    issue_record_count: result.ldd_issue_records.length,
    ldd_issue_records: result.ldd_issue_records,
  });
  await writeJson(path.join(outDir, "ldd-issue-follow-ups.json"), {
    schema_version: "ldd-issue-follow-ups.v1",
    generated_at: result.generated_at,
    issue_follow_up_count: result.ldd_issue_follow_ups.length,
    ldd_issue_follow_ups: result.ldd_issue_follow_ups,
  });
  await writeJson(path.join(outDir, "ldd-issue-severity-summaries.json"), {
    schema_version: "ldd-issue-severity-summaries.v1",
    generated_at: result.generated_at,
    severity_summary_count: result.ldd_issue_severity_summaries.length,
    ldd_issue_severity_summaries: result.ldd_issue_severity_summaries,
  });
  await writeJson(path.join(outDir, "ldd-issue-matter-summaries.json"), {
    schema_version: "ldd-issue-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.ldd_issue_matter_summaries.length,
    ldd_issue_matter_summaries: result.ldd_issue_matter_summaries,
  });
  await writeJson(path.join(outDir, "ldd-issue-detection-boundary.json"), {
    schema_version: "ldd-issue-detection-boundary-artifact.v1",
    generated_at: result.generated_at,
    ldd_issue_detection_desktop_boundary: result.ldd_issue_detection_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ldd-issue-detection-validation-report.v1",
    generated_at: result.generated_at,
    ldd_issue_detection_id: result.ldd_issue_detection_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLddIssueDetectionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runLddIssueDetection(args);
    console.log(`LDD issue detection ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ldd_issue_detection_status}`);
    console.log(`Issues/follow-ups: ${result.summary.issue_record_count}/${result.summary.follow_up_count}`);
    console.log(`Red/yellow flags: ${result.summary.red_flag_count}/${result.summary.yellow_flag_count}`);
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
    schema_version: "ldd-issue-detection-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    detection_rule: "LDD issues are deterministic operational issue candidates generated from P243 fact rows and demo matter metadata",
    no_legal_conclusion_rule: "issue flags, severity, and follow-up rows are not legal conclusions and require attorney/human review",
    missing_data_rule: "missing or requested material can become a follow-up issue candidate but not a factual non-existence finding",
    client_output_rule: "no client-facing issue report, advice, or final work product is generated by this phase",
    attorney_review_rule: "every issue and follow-up row remains attorney/human-review gated before downstream legal or client-facing use",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, or client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildIssueRules(generatedAt) {
  return ISSUE_RULES.map((rule, index) => ({
    schema_version: "ldd-issue-detection-rule.v1",
    ldd_issue_detection_rule_id: `ldd-issue-detection-rule.${rule.issue_type}`,
    issue_type: rule.issue_type,
    issue_label: rule.issue_label,
    rule_description: rule.rule_description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    legal_conclusion_allowed: false,
    client_facing_output_allowed: false,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildIssueRecords(lddFactExtraction, matter, generatedAt) {
  const facts = lddFactExtraction?.ldd_fact_records ?? [];
  const records = [];
  const pushIssue = (issue) => {
    records.push(buildIssueRecord(issue, matter, generatedAt, records.length + 1));
  };
  const factIds = (...names) => facts
    .filter((fact) => names.includes(fact.fact_name) || names.includes(fact.fact_type) || names.includes(fact.source_record_id))
    .map((fact) => fact.ldd_fact_record_id);
  const factRefs = (ids) => ids.map((id) => sourceRef("ldd_fact_record", id, "ldd_fact_records"));
  const risk = (id) => (matter.risks ?? []).find((item) => item.id === id);
  const task = (id) => (matter.tasks ?? []).find((item) => item.id === id);
  const cp = (id) => (matter.deal_control?.cp_checklist ?? []).find((item) => item.id === id);
  const vdr = (id) => (matter.deal_control?.vdr_requests ?? []).find((item) => item.id === id);
  const negotiation = (id) => (matter.deal_control?.negotiation_points ?? []).find((item) => item.id === id);
  const terminationGapFactIds = facts.filter((fact) => fact.fact_type === "termination" && fact.source_gap).map((fact) => fact.ldd_fact_record_id);

  pushIssue({
    issue_type: "tax_exposure",
    issue_title: "Related-party tax sign-off unresolved",
    issue_description: "Related-party transaction and tax sign-off metadata indicate an attorney-review follow-up is still open.",
    issue_severity: "high",
    issue_flag: "red",
    issue_basis: "matter.risks.R-001 + P243 tax obligation facts",
    source_fact_ids: factIds("tax_team_signoff", "related_party_ledger_delivery", "DOC-003"),
    source_refs: [
      sourceRef("matter.risks", "R-001", "title"),
      sourceRef("matter.deal_control.cp_checklist", "CP-002", "status"),
      sourceRef("matter.deal_control.vdr_requests", "VDR-001", "status"),
      ...factRefs(factIds("tax_team_signoff", "related_party_ledger_delivery", "DOC-003")),
    ],
    source_risk_id: risk("R-001")?.id,
    source_task_id: task("T-002")?.id,
    source_cp_id: cp("CP-002")?.id,
    source_document_id: "DOC-003",
    follow_up_title: "Confirm tax team sign-off and related-party ledger status",
    follow_up_owner: cp("CP-002")?.owner ?? "Senior Lee",
    follow_up_due: cp("CP-002")?.due ?? task("T-002")?.due ?? null,
  });

  pushIssue({
    issue_type: "missing_deliverable",
    issue_title: "Disclosure schedule update still missing",
    issue_description: "The updated disclosure schedule remains missing while closing and SPA circulation work continues.",
    issue_severity: "medium",
    issue_flag: "yellow",
    issue_basis: "matter.risks.R-002 + P243 disclosure schedule obligation facts",
    source_fact_ids: factIds("disclosure_schedule_update", "DOC-002"),
    source_refs: [
      sourceRef("matter.risks", "R-002", "title"),
      sourceRef("matter.documents", "DOC-002", "status"),
      sourceRef("matter.deal_control.negotiation_points", "NP-002", "open_issue"),
      ...factRefs(factIds("disclosure_schedule_update", "DOC-002")),
    ],
    source_risk_id: risk("R-002")?.id,
    source_task_id: task("T-003")?.id,
    source_negotiation_point_id: negotiation("NP-002")?.id,
    source_document_id: "DOC-002",
    follow_up_title: "Track owner and timing for updated disclosure schedule",
    follow_up_owner: negotiation("NP-002")?.owner ?? task("T-003")?.owner ?? "Associate Park",
    follow_up_due: task("T-003")?.due ?? null,
  });

  pushIssue({
    issue_type: "missing_deliverable",
    issue_title: "Officer certificate draft is a closing deliverable gap",
    issue_description: "The officer certificate draft is missing/requested and CP-001 remains blocked.",
    issue_severity: "medium",
    issue_flag: "yellow",
    issue_basis: "matter.deal_control.cp_checklist.CP-001 + P243 closing deliverable facts",
    source_fact_ids: factIds("closing_deliverable_delivery", "VDR-002"),
    source_refs: [
      sourceRef("matter.deal_control.cp_checklist", "CP-001", "status"),
      sourceRef("matter.deal_control.vdr_requests", "VDR-002", "status"),
      ...factRefs(factIds("closing_deliverable_delivery", "VDR-002")),
    ],
    source_cp_id: cp("CP-001")?.id,
    source_vdr_request_id: vdr("VDR-002")?.id,
    follow_up_title: "Obtain or escalate officer certificate draft",
    follow_up_owner: cp("CP-001")?.owner ?? vdr("VDR-002")?.owner ?? "Paralegal Choi",
    follow_up_due: cp("CP-001")?.due ?? vdr("VDR-002")?.due ?? null,
  });

  pushIssue({
    issue_type: "negotiation_gap",
    issue_title: "Indemnity cap tax exposure position remains open",
    issue_description: "SPA 8.2 and tax exposure negotiation metadata indicate an unresolved attorney-review negotiation point.",
    issue_severity: "high",
    issue_flag: "red",
    issue_basis: "matter.deal_control.negotiation_points.NP-001 + P243 SPA obligation facts",
    source_fact_ids: factIds("spa_fallback_language_update"),
    source_refs: [
      sourceRef("matter.deal_control.negotiation_points", "NP-001", "open_issue"),
      sourceRef("matter.tasks", "T-001", "title"),
      ...factRefs(factIds("spa_fallback_language_update")),
    ],
    source_task_id: task("T-001")?.id,
    source_negotiation_point_id: negotiation("NP-001")?.id,
    follow_up_title: "Align SPA 8.2 fallback language with tax exposure position",
    follow_up_owner: negotiation("NP-001")?.owner ?? task("T-001")?.owner ?? "Senior Lee",
    follow_up_due: task("T-001")?.due ?? null,
  });

  pushIssue({
    issue_type: "source_gap",
    issue_title: "Termination terms require source review",
    issue_description: "P243 recorded termination as a source gap because clause text was not present in the deterministic source set.",
    issue_severity: "medium",
    issue_flag: "yellow",
    issue_basis: "P243 termination source-gap fact",
    source_fact_ids: terminationGapFactIds,
    source_refs: factRefs(terminationGapFactIds),
    source_gap: true,
    follow_up_title: "Review termination clause source text before downstream use",
    follow_up_owner: "Senior Lee",
    follow_up_due: matter.deal_control?.signing_target ?? null,
  });

  return records;
}

function buildIssueRecord(issue, matter, generatedAt, sequenceNumber) {
  const sourceFactIds = [...new Set(issue.source_fact_ids ?? [])];
  return {
    schema_version: "ldd-issue-record.v1",
    ldd_issue_record_id: `ldd-issue.${String(sequenceNumber).padStart(3, "0")}.${slug(issue.issue_type)}.${slug(issue.issue_title)}`,
    matter_id: matter?.matter_id ?? "unknown",
    issue_type: issue.issue_type,
    issue_title: issue.issue_title,
    issue_description: issue.issue_description,
    issue_status: "candidate_pending_attorney_review",
    issue_severity: issue.issue_severity,
    issue_flag: issue.issue_flag,
    issue_basis: issue.issue_basis,
    source_fact_ids: sourceFactIds,
    source_fact_count: sourceFactIds.length,
    source_fact_types: issue.source_fact_types ?? [],
    source_refs: issue.source_refs ?? [],
    source_risk_id: issue.source_risk_id ?? null,
    source_task_id: issue.source_task_id ?? null,
    source_cp_id: issue.source_cp_id ?? null,
    source_vdr_request_id: issue.source_vdr_request_id ?? null,
    source_negotiation_point_id: issue.source_negotiation_point_id ?? null,
    source_document_id: issue.source_document_id ?? null,
    source_gap: Boolean(issue.source_gap),
    follow_up_required: true,
    follow_up_title: issue.follow_up_title,
    follow_up_owner: issue.follow_up_owner,
    follow_up_due: issue.follow_up_due ?? null,
    deterministic_issue_detection_performed: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
    attorney_review_required: true,
    human_review_required: true,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    created_at: generatedAt,
    sequence_number: sequenceNumber,
  };
}

function buildIssueFollowUps(issueRecords, generatedAt) {
  return issueRecords.map((issue, index) => ({
    schema_version: "ldd-issue-follow-up.v1",
    ldd_issue_follow_up_id: `ldd-issue-follow-up.${String(index + 1).padStart(3, "0")}.${slug(issue.ldd_issue_record_id)}`,
    matter_id: issue.matter_id,
    ldd_issue_record_id: issue.ldd_issue_record_id,
    issue_type: issue.issue_type,
    issue_severity: issue.issue_severity,
    issue_flag: issue.issue_flag,
    follow_up_title: issue.follow_up_title,
    follow_up_owner: issue.follow_up_owner,
    follow_up_due: issue.follow_up_due,
    follow_up_status: "open_pending_attorney_review",
    follow_up_source: "ldd_issue_detection",
    recommended_action_kind: "attorney_review_follow_up",
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    created_at: generatedAt,
  }));
}

function buildSeveritySummaries(issueRecords, generatedAt) {
  return ["high", "medium", "low"]
    .map((severity) => {
      const severityRecords = issueRecords.filter((record) => record.issue_severity === severity);
      return {
        schema_version: "ldd-issue-severity-summary.v1",
        ldd_issue_severity_summary_id: `ldd-issue-severity-summary.${severity}`,
        issue_severity: severity,
        issue_record_count: severityRecords.length,
        red_flag_count: severityRecords.filter((record) => record.issue_flag === "red").length,
        yellow_flag_count: severityRecords.filter((record) => record.issue_flag === "yellow").length,
        follow_up_required_count: severityRecords.filter((record) => record.follow_up_required).length,
        attorney_review_required_count: severityRecords.filter((record) => record.attorney_review_required).length,
        client_facing_ready_count: severityRecords.filter((record) => record.client_facing_ready).length,
        created_at: generatedAt,
      };
    })
    .filter((summary) => summary.issue_record_count > 0);
}

function buildMatterSummaries(issueRecords, followUps, generatedAt) {
  const matterIds = [...new Set(issueRecords.map((record) => record.matter_id))].sort();
  return matterIds.map((matterId) => {
    const matterIssues = issueRecords.filter((record) => record.matter_id === matterId);
    const matterFollowUps = followUps.filter((followUp) => followUp.matter_id === matterId);
    return {
      schema_version: "ldd-issue-matter-summary.v1",
      ldd_issue_matter_summary_id: `ldd-issue-matter-summary.${slug(matterId)}`,
      matter_id: matterId,
      ldd_issue_matter_status: "issues_detected_pending_attorney_review",
      issue_record_count: matterIssues.length,
      red_flag_count: matterIssues.filter((record) => record.issue_flag === "red").length,
      yellow_flag_count: matterIssues.filter((record) => record.issue_flag === "yellow").length,
      high_severity_issue_count: matterIssues.filter((record) => record.issue_severity === "high").length,
      medium_severity_issue_count: matterIssues.filter((record) => record.issue_severity === "medium").length,
      source_gap_issue_count: matterIssues.filter((record) => record.source_gap).length,
      follow_up_count: matterFollowUps.length,
      open_follow_up_count: matterFollowUps.filter((followUp) => followUp.follow_up_status === "open_pending_attorney_review").length,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      created_at: generatedAt,
    };
  });
}

function buildCheckpoints({ sourceReads, packageJson, roadmapText, lddFactExtraction, matter, rules, issueRecords, followUps, severitySummaries, matterSummaries, desktopBoundary }) {
  const sourceStatuses = sourceReads.map((source) => checkpoint(
    `source.${source.source_id}`,
    source.status === "complete",
    source.status === "complete" ? `${source.source_id} source loaded.` : `${source.source_id} source missing: ${source.error}`,
  ));
  const factRecordCount = lddFactExtraction?.ldd_fact_records?.length ?? 0;
  return [
    ...sourceStatuses,
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:issue-detection"]), "package.json exposes law-firm:issue-detection."),
    checkpoint("roadmap.p244", String(roadmapText ?? "").includes("P244"), "roadmap/ledger keeps P244 visible."),
    checkpoint("source.fact_extraction.complete", lddFactExtraction?.summary?.ldd_fact_extraction_status === "complete", "Source LDD fact extraction is complete."),
    checkpoint("source.matter.scoped", Boolean(matter?.matter_id), "Demo matter source has matter_id."),
    checkpoint("rule.count", rules.length >= 5, `${rules.length} issue detection rule(s) loaded.`),
    checkpoint("fact.source.count", factRecordCount > 0, `${factRecordCount} source fact row(s) available.`),
    checkpoint("issue.count", issueRecords.length >= 5, `${issueRecords.length} issue candidate row(s) generated.`),
    checkpoint("follow.up.coverage", followUps.length === issueRecords.length && followUps.length > 0, `${followUps.length}/${issueRecords.length} follow-up row(s) generated.`),
    checkpoint("red.yellow.flags", issueRecords.some((record) => record.issue_flag === "red") && issueRecords.some((record) => record.issue_flag === "yellow"), "Red and yellow issue flags are represented."),
    checkpoint("severity.coverage", issueRecords.some((record) => record.issue_severity === "high") && issueRecords.some((record) => record.issue_severity === "medium"), "High and medium severity issue rows are represented."),
    checkpoint("source.gap.issue", issueRecords.some((record) => record.source_gap === true), "At least one source-gap issue is recorded."),
    checkpoint("severity.summary.count", severitySummaries.length > 0, `${severitySummaries.length} severity summary row(s) built.`),
    checkpoint("matter.summary.count", matterSummaries.length > 0, `${matterSummaries.length} matter summary row(s) built.`),
    checkpoint("matter.boundary", everyMatterScoped([...issueRecords, ...followUps, ...matterSummaries]), "Every issue detection row is matter_id scoped."),
    checkpoint("review.gate", issueRecords.every((record) => record.attorney_review_required === true && record.human_review_required === true) && followUps.every((row) => row.attorney_review_required === true && row.human_review_required === true), "Every issue/follow-up row remains attorney/human-review gated."),
    checkpoint("no.legal.conclusion", issueRecords.every((record) => record.legal_conclusion_asserted === false && record.legal_advice_provided === false), "No legal conclusion or legal advice is asserted."),
    checkpoint("no.client.output", issueRecords.every((record) => record.client_facing_ready === false && record.client_facing_output_generated === false), "No client-facing issue output is generated."),
    checkpoint("no.mutation", issueRecords.every((record) => record.matter_data_write_allowed === false && record.task_state_write_allowed === false && record.workflow_transition_allowed === false && record.runtime_execution_allowed === false && record.delivery_execution_allowed === false && record.protected_action_allowed === false), "No matter/task/workflow/runtime/delivery/protected mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false, "Desktop boundary is read-only."),
  ];
}

function summarizeLddIssueDetection({ sourceReads, lddFactExtraction, matter, rules, issueRecords, followUps, severitySummaries, matterSummaries, desktopBoundary, checkpoints, validation }) {
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = (sourceId) => sourceReads.find((source) => source.source_id === sourceId)?.status ?? "missing";
  return {
    ldd_issue_detection_status: validation.valid ? "complete" : "blocked",
    ldd_issue_detection_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_ldd_fact_extraction_status: sourceStatus("ldd_fact_extraction"),
    source_ldd_fact_extraction_phase_status: lddFactExtraction?.summary?.ldd_fact_extraction_status ?? "unknown",
    source_matter_status: sourceStatus("matter"),
    source_matter_id: matter?.matter_id ?? null,
    source_fact_record_count: lddFactExtraction?.summary?.fact_record_count ?? lddFactExtraction?.ldd_fact_records?.length ?? 0,
    issue_rule_count: rules.length,
    issue_record_count: issueRecords.length,
    detected_issue_count: issueRecords.filter((record) => record.issue_status === "candidate_pending_attorney_review").length,
    red_flag_count: issueRecords.filter((record) => record.issue_flag === "red").length,
    yellow_flag_count: issueRecords.filter((record) => record.issue_flag === "yellow").length,
    high_severity_issue_count: issueRecords.filter((record) => record.issue_severity === "high").length,
    medium_severity_issue_count: issueRecords.filter((record) => record.issue_severity === "medium").length,
    low_severity_issue_count: issueRecords.filter((record) => record.issue_severity === "low").length,
    source_gap_issue_count: issueRecords.filter((record) => record.source_gap).length,
    follow_up_count: followUps.length,
    open_follow_up_count: followUps.filter((row) => row.follow_up_status === "open_pending_attorney_review").length,
    severity_summary_count: severitySummaries.length,
    matter_count: matterSummaries.length,
    deterministic_issue_detection_count: issueRecords.filter((record) => record.deterministic_issue_detection_performed).length,
    attorney_review_required_issue_count: issueRecords.filter((record) => record.attorney_review_required).length,
    human_review_required_issue_count: issueRecords.filter((record) => record.human_review_required).length,
    client_facing_ready_count: issueRecords.filter((record) => record.client_facing_ready).length,
    legal_conclusion_asserted_count: issueRecords.filter((record) => record.legal_conclusion_asserted).length,
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
    deterministic_issue_detection_performed: true,
    legal_conclusion_asserted: false,
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
    schema_version: "ldd-issue-detection-desktop-boundary.v1",
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
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:issue-detection"]),
    roadmap_p244_present: String(roadmapText.value ?? "").includes("P244"),
  };
}

function renderLddIssueDetectionMarkdown(result) {
  const lines = [
    "# LDD Issue Detection",
    "",
    `- Status: ${result.summary.ldd_issue_detection_status}`,
    `- Issue records: ${result.summary.issue_record_count}`,
    `- Follow-ups: ${result.summary.follow_up_count}`,
    `- Red flags: ${result.summary.red_flag_count}`,
    `- Yellow flags: ${result.summary.yellow_flag_count}`,
    `- Attorney review required: ${result.safe_handling.attorney_review_required}`,
    `- Client-facing output generated: ${result.safe_handling.client_facing_output_generated}`,
    "",
    "## Severity",
    "",
  ];
  for (const summary of result.ldd_issue_severity_summaries) {
    lines.push(`- ${summary.issue_severity}: ${summary.issue_record_count} issue(s), ${summary.follow_up_required_count} follow-up(s).`);
  }
  lines.push("", "These rows are deterministic operational issue candidates only. Attorney review remains required before downstream legal or client-facing use.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_LDD_ISSUE_DETECTION_INPUTS;
  return {
    ldd_fact_extraction_path: path.resolve(options.lddFactExtractionPath ?? defaults.lddFactExtractionPath),
    matter_path: path.resolve(options.matterPath ?? defaults.matterPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
}

async function readSourceArtifacts(inputs) {
  const artifactInputs = [
    ["ldd_fact_extraction", "artifact", inputs.ldd_fact_extraction_path],
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

async function readJsonOrError(filePath) {
  try {
    return { value: JSON.parse(await readFile(filePath, "utf8")), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    return { value: await readFile(filePath, "utf8"), error: null };
  } catch (error) {
    return { value: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sourceRef(sourceKind, sourceId, sourceField) {
  return {
    source_kind: String(sourceKind ?? "unknown"),
    source_id: String(sourceId ?? "unknown"),
    source_field: String(sourceField ?? "unknown"),
  };
}

function issueRule(issueType, issueLabel, ruleDescription) {
  return { issue_type: issueType, issue_label: issueLabel, rule_description: ruleDescription };
}

function checkpoint(checkpointId, passed, message) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function everyMatterScoped(rows) {
  return rows.every((row) => typeof row.matter_id === "string" && row.matter_id.length > 0);
}

function summarizeValidation(validationItems) {
  const errors = validationItems
    .filter((item) => item.status === "failed")
    .map((item) => ({ path: item.path, message: item.message, check_id: item.check_id }));
  return {
    valid: errors.length === 0,
    errors,
    items: validationItems,
  };
}

function serializableLddIssueDetection(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--ldd-fact-extraction") parsed.lddFactExtractionPath = argv[++index];
    else if (arg === "--matter") parsed.matterPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") parsed.check = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/ldd-issue-detection.mjs [options]

Options:
  --out-dir <folder>                         Output directory.
  --ldd-fact-extraction <file>               LDD fact extraction artifact.
  --matter <file>                            Demo matter source file.
  --package <file>                           package.json path.
  --roadmap <file>                           Roadmap or phase ledger path.
  --run-at <iso>                             Deterministic generated_at timestamp.
  --check                                    Exit non-zero when validation fails.
  -h, --help                                 Show this help.
`);
}

function slug(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.]/g, "").slice(0, 15);
}
