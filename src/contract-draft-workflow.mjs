import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CONTRACT_DRAFT_WORKFLOW_OUT_DIR = "artifacts/contract-draft-workflow/latest";
export const DEFAULT_CONTRACT_DRAFT_WORKFLOW_INPUTS = {
  matterPath: "examples/project-alpha-matter.json",
  lddRfiGeneratorPath: "artifacts/ldd-rfi-generator/latest/ldd-rfi-generator.json",
  meetingMinutesWorkflowPath: "artifacts/meeting-minutes-workflow/latest/meeting-minutes-workflow.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "contract-draft-workflow.v1";
const SOURCE_OF_TRUTH = "matter_negotiation_points_rfi_and_meeting_minutes_context";
const CONTRACT_DRAFT_RULES = [
  workflowRule("source_capture", "Source capture", "Negotiation points, contract documents, RFI questions, and meeting action items remain read-only source rows."),
  workflowRule("clause_draft_scaffold", "Clause draft scaffold", "Each negotiation point becomes an internal clause scaffold, not final clause language."),
  workflowRule("client_position_capture", "Client position capture", "Client positions are copied from matter records and preserved with source references."),
  workflowRule("clause_consistency_gate", "Clause consistency gate", "Each clause scaffold receives a consistency check against client position, open issue, and source gaps."),
  workflowRule("attorney_review_gate", "Attorney review gate", "Every draft clause requires attorney and human review before use."),
  workflowRule("no_client_delivery", "No client delivery", "No client-facing output or delivery-ready contract language is produced."),
];

export async function runContractDraftWorkflow(options = {}) {
  const result = await buildContractDraftWorkflow(options);
  if (options.write !== false) await writeContractDraftWorkflow(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Contract draft workflow validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildContractDraftWorkflow(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CONTRACT_DRAFT_WORKFLOW_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const sourceById = Object.fromEntries(sourceReads.filter((source) => source.value).map((source) => [source.source_id, source.value]));
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const matter = sourceById.matter;
  const lddRfiGenerator = sourceById.ldd_rfi_generator;
  const meetingMinutesWorkflow = sourceById.meeting_minutes_workflow;

  const rules = buildWorkflowRules(generatedAt);
  const draftPackets = buildDraftPackets({ matter, generatedAt });
  const clientPositions = buildClientPositions({ matter, generatedAt });
  const clauseDrafts = buildClauseDrafts({ matter, draftPackets, clientPositions, generatedAt });
  const consistencyChecks = buildConsistencyChecks({ matter, clauseDrafts, clientPositions, generatedAt });
  const attorneyReviewGates = buildAttorneyReviewGates({ matter, clauseDrafts, consistencyChecks, generatedAt });
  const issueLinks = buildIssueLinks({ matter, lddRfiGenerator, meetingMinutesWorkflow, clauseDrafts, generatedAt });
  attachClauseGateLinks(clauseDrafts, { consistencyChecks, attorneyReviewGates, issueLinks });
  attachPacketCounts(draftPackets, clauseDrafts, clientPositions, consistencyChecks, attorneyReviewGates, issueLinks);
  const matterSummaries = buildMatterSummaries({ matter, draftPackets, clauseDrafts, clientPositions, consistencyChecks, attorneyReviewGates, issueLinks, generatedAt });
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.text,
    matter,
    lddRfiGenerator,
    meetingMinutesWorkflow,
    rules,
    draftPackets,
    clauseDrafts,
    clientPositions,
    consistencyChecks,
    attorneyReviewGates,
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
  const summary = summarizeContractDraftWorkflow({
    sourceReads,
    matter,
    lddRfiGenerator,
    meetingMinutesWorkflow,
    rules,
    draftPackets,
    clauseDrafts,
    clientPositions,
    consistencyChecks,
    attorneyReviewGates,
    issueLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });

  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    contract_draft_workflow_id: `contract-draft-workflow.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    contract_draft_workflow_status: summary.contract_draft_workflow_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    contract_draft_workflow_contract: buildContract(generatedAt),
    contract_draft_rules: rules,
    contract_draft_packets: draftPackets,
    contract_clause_drafts: clauseDrafts,
    contract_client_positions: clientPositions,
    contract_clause_consistency_checks: consistencyChecks,
    contract_attorney_review_gates: attorneyReviewGates,
    contract_draft_issue_links: issueLinks,
    contract_draft_matter_summaries: matterSummaries,
    contract_draft_workflow_desktop_boundary: desktopBoundary,
    contract_draft_workflow_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderContractDraftWorkflowMarkdown(result),
  };
}

export async function writeContractDraftWorkflow(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableContractDraftWorkflow(result);
  await writeJson(path.join(outDir, "contract-draft-workflow.json"), serializable);
  await writeJson(path.join(outDir, "contract-draft-rules.json"), {
    schema_version: "contract-draft-rules.v1",
    generated_at: result.generated_at,
    contract_draft_rule_count: result.contract_draft_rules.length,
    contract_draft_rules: result.contract_draft_rules,
  });
  await writeJson(path.join(outDir, "contract-draft-packets.json"), {
    schema_version: "contract-draft-packets.v1",
    generated_at: result.generated_at,
    draft_packet_count: result.contract_draft_packets.length,
    contract_draft_packets: result.contract_draft_packets,
  });
  await writeJson(path.join(outDir, "contract-clause-drafts.json"), {
    schema_version: "contract-clause-drafts.v1",
    generated_at: result.generated_at,
    clause_draft_count: result.contract_clause_drafts.length,
    contract_clause_drafts: result.contract_clause_drafts,
  });
  await writeJson(path.join(outDir, "contract-client-positions.json"), {
    schema_version: "contract-client-positions.v1",
    generated_at: result.generated_at,
    client_position_count: result.contract_client_positions.length,
    contract_client_positions: result.contract_client_positions,
  });
  await writeJson(path.join(outDir, "contract-clause-consistency-checks.json"), {
    schema_version: "contract-clause-consistency-checks.v1",
    generated_at: result.generated_at,
    consistency_check_count: result.contract_clause_consistency_checks.length,
    contract_clause_consistency_checks: result.contract_clause_consistency_checks,
  });
  await writeJson(path.join(outDir, "contract-attorney-review-gates.json"), {
    schema_version: "contract-attorney-review-gates.v1",
    generated_at: result.generated_at,
    attorney_review_gate_count: result.contract_attorney_review_gates.length,
    contract_attorney_review_gates: result.contract_attorney_review_gates,
  });
  await writeJson(path.join(outDir, "contract-draft-issue-links.json"), {
    schema_version: "contract-draft-issue-links.v1",
    generated_at: result.generated_at,
    issue_link_count: result.contract_draft_issue_links.length,
    contract_draft_issue_links: result.contract_draft_issue_links,
  });
  await writeJson(path.join(outDir, "contract-draft-matter-summaries.json"), {
    schema_version: "contract-draft-matter-summaries.v1",
    generated_at: result.generated_at,
    matter_summary_count: result.contract_draft_matter_summaries.length,
    contract_draft_matter_summaries: result.contract_draft_matter_summaries,
  });
  await writeJson(path.join(outDir, "contract-draft-workflow-boundary.json"), {
    schema_version: "contract-draft-workflow-boundary-artifact.v1",
    generated_at: result.generated_at,
    contract_draft_workflow_desktop_boundary: result.contract_draft_workflow_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "contract-draft-workflow-validation-report.v1",
    generated_at: result.generated_at,
    contract_draft_workflow_id: result.contract_draft_workflow_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runContractDraftWorkflowCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runContractDraftWorkflow(args);
    console.log(`Contract draft workflow ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.contract_draft_workflow_status}`);
    console.log(`Clauses/client positions: ${result.summary.clause_draft_count}/${result.summary.client_position_count}`);
    console.log(`Consistency/review gates: ${result.summary.consistency_check_count}/${result.summary.attorney_review_gate_count}`);
    console.log(`Issue links: ${result.summary.issue_link_count}`);
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
    schema_version: "contract-draft-workflow-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_rule: "matter negotiation points, RFI questions, and meeting action items are read-only inputs and remain source-referenced",
    draft_rule: "clause text is a non-final scaffold for attorney review only",
    client_position_rule: "client positions are captured from matter data and not restated as legal advice",
    consistency_rule: "consistency checks compare source coverage and open issues without resolving legal positions",
    attorney_review_rule: "every clause scaffold, client position, consistency check, and issue link requires attorney/human review",
    client_output_rule: "contract drafts are not client-facing-ready and cannot be delivered without attorney review and partner approval",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, legal advice, legal conclusion, or final client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildWorkflowRules(generatedAt) {
  return CONTRACT_DRAFT_RULES.map((rule, index) => ({
    schema_version: "contract-draft-rule.v1",
    contract_draft_rule_id: `contract-draft-rule.${rule.rule_type}`,
    contract_draft_rule_type: rule.rule_type,
    rule_label: rule.label,
    rule_description: rule.description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    attorney_review_required: true,
    human_review_required: true,
    created_at: generatedAt,
  }));
}

function buildDraftPackets({ matter, generatedAt }) {
  const matterId = matter?.matter_id ?? "unknown-matter";
  const contractDocuments = getContractDocuments(matter);
  const targetDeadline = (matter?.deadlines ?? []).find((deadline) => /draft revised spa/i.test(deadline.title ?? "")) ?? (matter?.deadlines ?? [])[0] ?? null;
  return contractDocuments.slice(0, 1).map((document, index) => ({
    schema_version: "contract-draft-packet.v1",
    contract_draft_packet_id: `contract-draft-packet.${slugify(document.id ?? `document-${index + 1}`)}`,
    matter_id: matterId,
    matter_title: matter?.title ?? null,
    document_id: document.id ?? null,
    document_title: document.title ?? "Contract document",
    document_status: document.status ?? "unknown",
    draft_packet_status: "draft_pending_attorney_review",
    target_deadline_id: targetDeadline?.id ?? null,
    target_deadline: targetDeadline?.date ?? null,
    owner: targetDeadline?.owner ?? matter?.review_workflow?.default_reviewer ?? null,
    source_negotiation_point_count: getNegotiationPoints(matter).length,
    source_contract_document_count: contractDocuments.length,
    clause_draft_count: 0,
    client_position_count: 0,
    consistency_check_count: 0,
    attorney_review_gate_count: 0,
    issue_link_count: 0,
    source_refs: [
      sourceRef("matter", matterId, "deal_control.negotiation_points"),
      sourceRef("matter.documents", document.id, "documents"),
      sourceRef("matter.deadlines", targetDeadline?.id, "deadlines"),
    ],
    source_ref_count: 3,
    draft_only: true,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    client_facing_ready: false,
    contract_delivery_ready: false,
    client_facing_output_generated: false,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    matter_data_write_allowed: false,
    task_state_write_allowed: false,
    workflow_transition_allowed: false,
    runtime_execution_allowed: false,
    delivery_execution_allowed: false,
    protected_action_allowed: false,
    created_at: generatedAt,
  }));
}

function buildClientPositions({ matter, generatedAt }) {
  const matterId = matter?.matter_id ?? "unknown-matter";
  return getNegotiationPoints(matter).map((point, index) => ({
    schema_version: "contract-client-position.v1",
    contract_client_position_id: `contract-client-position.${slugify(point.id ?? `np-${index + 1}`)}`,
    matter_id: matterId,
    negotiation_point_id: point.id ?? null,
    clause_name: point.clause ?? `Negotiation point ${index + 1}`,
    client_position_text: point.position ?? "",
    open_issue_text: point.open_issue ?? "",
    client_position_status: "captured_pending_attorney_review",
    severity: point.severity ?? "unknown",
    source_refs: [
      sourceRef("matter.deal_control.negotiation_points", point.id, "position"),
      sourceRef("matter.deal_control.negotiation_points", point.id, "open_issue"),
    ],
    source_ref_count: 2,
    attorney_review_required: true,
    human_review_required: true,
    client_facing_ready: false,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    created_at: generatedAt,
  }));
}

function buildClauseDrafts({ matter, draftPackets, clientPositions, generatedAt }) {
  const matterId = matter?.matter_id ?? "unknown-matter";
  const packet = draftPackets[0] ?? null;
  const positionByNegotiationPoint = new Map(clientPositions.map((position) => [position.negotiation_point_id, position]));
  return getNegotiationPoints(matter).map((point, index) => {
    const position = positionByNegotiationPoint.get(point.id) ?? null;
    return {
      schema_version: "contract-clause-draft.v1",
      contract_clause_draft_id: `contract-clause-draft.${slugify(point.id ?? `np-${index + 1}`)}`,
      matter_id: matterId,
      contract_draft_packet_id: packet?.contract_draft_packet_id ?? null,
      negotiation_point_id: point.id ?? null,
      clause_name: point.clause ?? `Negotiation point ${index + 1}`,
      clause_type: inferClauseType(point),
      clause_draft_status: "draft_pending_attorney_review",
      draft_clause_text: `Draft clause scaffold for attorney review: ${point.clause ?? "clause"}. Client position: ${point.position ?? "not recorded"}. Open issue: ${point.open_issue ?? "not recorded"}. This is not final clause language and requires attorney review before use.`,
      client_position_id: position?.contract_client_position_id ?? null,
      consistency_check_id: null,
      attorney_review_gate_id: null,
      issue_link_ids: [],
      issue_link_count: 0,
      source_refs: [
        sourceRef("matter.deal_control.negotiation_points", point.id, "clause"),
        sourceRef("matter.deal_control.negotiation_points", point.id, "position"),
        sourceRef("matter.deal_control.negotiation_points", point.id, "open_issue"),
      ],
      source_ref_count: 3,
      draft_only: true,
      deterministic_contract_draft_generation_performed: true,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required_before_client_use: true,
      client_facing_ready: false,
      contract_delivery_ready: false,
      client_facing_output_generated: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
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

function buildConsistencyChecks({ matter, clauseDrafts, clientPositions, generatedAt }) {
  const positionById = new Map(clientPositions.map((position) => [position.contract_client_position_id, position]));
  return clauseDrafts.map((draft, index) => {
    const position = positionById.get(draft.client_position_id) ?? null;
    const sourceGapRefs = findSourceGaps(matter, draft);
    return {
      schema_version: "contract-clause-consistency-check.v1",
      contract_clause_consistency_check_id: `contract-consistency-check.${slugify(draft.negotiation_point_id ?? index + 1)}`,
      matter_id: draft.matter_id,
      contract_clause_draft_id: draft.contract_clause_draft_id,
      contract_client_position_id: draft.client_position_id,
      negotiation_point_id: draft.negotiation_point_id,
      clause_name: draft.clause_name,
      consistency_check_status: "passed_pending_attorney_review",
      clause_consistency_passed: Boolean(position?.client_position_text) && Boolean(position?.open_issue_text),
      client_position_present: Boolean(position?.client_position_text),
      open_issue_present: Boolean(position?.open_issue_text),
      source_gap_count: sourceGapRefs.length,
      source_gap_refs: sourceGapRefs,
      source_refs: [
        sourceRef("contract_clause_draft", draft.contract_clause_draft_id, "draft_clause_text"),
        sourceRef("contract_client_position", draft.client_position_id, "client_position_text"),
        ...sourceGapRefs,
      ],
      source_ref_count: 2 + sourceGapRefs.length,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      created_at: generatedAt,
    };
  });
}

function buildAttorneyReviewGates({ matter, clauseDrafts, consistencyChecks, generatedAt }) {
  const consistencyByClause = new Map(consistencyChecks.map((check) => [check.contract_clause_draft_id, check]));
  return clauseDrafts.map((draft, index) => {
    const consistency = consistencyByClause.get(draft.contract_clause_draft_id) ?? null;
    const point = getNegotiationPoints(matter).find((item) => item.id === draft.negotiation_point_id) ?? null;
    return {
      schema_version: "contract-attorney-review-gate.v1",
      contract_attorney_review_gate_id: `contract-attorney-review-gate.${slugify(draft.negotiation_point_id ?? index + 1)}`,
      matter_id: draft.matter_id,
      contract_clause_draft_id: draft.contract_clause_draft_id,
      contract_clause_consistency_check_id: consistency?.contract_clause_consistency_check_id ?? null,
      negotiation_point_id: draft.negotiation_point_id,
      review_gate_status: "pending_attorney_review",
      required_reviewers: unique([
        point?.owner,
        matter?.review_workflow?.default_reviewer,
        matter?.matter_profile?.responsible_partner,
      ].filter(Boolean)),
      reviewer_count: unique([
        point?.owner,
        matter?.review_workflow?.default_reviewer,
        matter?.matter_profile?.responsible_partner,
      ].filter(Boolean)).length,
      review_reason: "Clause scaffold, client position, source gaps, and consistency check require attorney review before use.",
      partner_approval_required_before_client_use: true,
      source_refs: [
        sourceRef("contract_clause_draft", draft.contract_clause_draft_id, "draft_clause_text"),
        sourceRef("contract_clause_consistency_check", consistency?.contract_clause_consistency_check_id, "consistency_check_status"),
      ],
      source_ref_count: 2,
      attorney_review_required: true,
      human_review_required: true,
      client_facing_ready: false,
      contract_delivery_ready: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      created_at: generatedAt,
    };
  });
}

function buildIssueLinks({ matter, lddRfiGenerator, meetingMinutesWorkflow, clauseDrafts, generatedAt }) {
  const links = [];
  for (const draft of clauseDrafts) {
    const issueSources = findIssueSources({ matter, lddRfiGenerator, meetingMinutesWorkflow, draft }).slice(0, 2);
    for (const issueSource of issueSources) {
      const linkIndex = links.length + 1;
      links.push({
        schema_version: "contract-draft-issue-link.v1",
        contract_draft_issue_link_id: `contract-draft-issue-link.${String(linkIndex).padStart(3, "0")}.${slugify(draft.negotiation_point_id)}.${slugify(issueSource.source_id)}`,
        matter_id: draft.matter_id,
        contract_clause_draft_id: draft.contract_clause_draft_id,
        negotiation_point_id: draft.negotiation_point_id,
        linked_source_kind: issueSource.source_kind,
        linked_source_id: issueSource.source_id,
        linked_source_title: issueSource.source_title,
        contract_issue_link_status: "linked_pending_attorney_review",
        source_refs: [
          sourceRef("contract_clause_draft", draft.contract_clause_draft_id, "draft_clause_text"),
          sourceRef(issueSource.source_kind, issueSource.source_id, issueSource.source_field),
        ],
        source_ref_count: 2,
        attorney_review_required: true,
        human_review_required: true,
        client_facing_ready: false,
        legal_conclusion_asserted: false,
        legal_advice_provided: false,
        created_at: generatedAt,
      });
    }
  }
  return links;
}

function buildMatterSummaries({ matter, draftPackets, clauseDrafts, clientPositions, consistencyChecks, attorneyReviewGates, issueLinks, generatedAt }) {
  return [{
    schema_version: "contract-draft-matter-summary.v1",
    contract_draft_matter_summary_id: `contract-draft-summary.${slugify(matter?.matter_id ?? "unknown")}`,
    matter_id: matter?.matter_id ?? "unknown-matter",
    matter_title: matter?.title ?? null,
    contract_draft_matter_status: "draft_pending_attorney_review",
    draft_packet_count: draftPackets.length,
    clause_draft_count: clauseDrafts.length,
    client_position_count: clientPositions.length,
    consistency_check_count: consistencyChecks.length,
    attorney_review_gate_count: attorneyReviewGates.length,
    issue_link_count: issueLinks.length,
    client_facing_ready_count: clauseDrafts.filter((draft) => draft.client_facing_ready).length,
    contract_delivery_ready_count: clauseDrafts.filter((draft) => draft.contract_delivery_ready).length,
    draft_only: true,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    client_facing_ready: false,
    contract_delivery_ready: false,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    source_refs: [
      sourceRef("matter", matter?.matter_id, "deal_control.negotiation_points"),
      sourceRef("contract_draft_packets", draftPackets[0]?.contract_draft_packet_id, "contract_draft_packets"),
      sourceRef("contract_clause_drafts", clauseDrafts[0]?.contract_clause_draft_id, "contract_clause_drafts"),
    ],
    source_ref_count: 3,
    created_at: generatedAt,
  }];
}

function attachClauseGateLinks(clauseDrafts, { consistencyChecks, attorneyReviewGates, issueLinks }) {
  const consistencyByClause = new Map(consistencyChecks.map((check) => [check.contract_clause_draft_id, check]));
  const reviewByClause = new Map(attorneyReviewGates.map((gate) => [gate.contract_clause_draft_id, gate]));
  const linksByClause = groupBy(issueLinks, (link) => link.contract_clause_draft_id);
  for (const draft of clauseDrafts) {
    draft.consistency_check_id = consistencyByClause.get(draft.contract_clause_draft_id)?.contract_clause_consistency_check_id ?? null;
    draft.attorney_review_gate_id = reviewByClause.get(draft.contract_clause_draft_id)?.contract_attorney_review_gate_id ?? null;
    draft.issue_link_ids = (linksByClause.get(draft.contract_clause_draft_id) ?? []).map((link) => link.contract_draft_issue_link_id);
    draft.issue_link_count = draft.issue_link_ids.length;
  }
}

function attachPacketCounts(draftPackets, clauseDrafts, clientPositions, consistencyChecks, attorneyReviewGates, issueLinks) {
  for (const packet of draftPackets) {
    const clausesForPacket = clauseDrafts.filter((draft) => draft.contract_draft_packet_id === packet.contract_draft_packet_id);
    packet.clause_draft_count = clausesForPacket.length;
    packet.client_position_count = clientPositions.length;
    packet.consistency_check_count = consistencyChecks.length;
    packet.attorney_review_gate_count = attorneyReviewGates.length;
    packet.issue_link_count = issueLinks.length;
  }
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "contract-draft-workflow-desktop-boundary.v1",
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

function buildCheckpoints(context) {
  const {
    sourceReads,
    packageJson,
    roadmapText,
    matter,
    lddRfiGenerator,
    meetingMinutesWorkflow,
    rules,
    draftPackets,
    clauseDrafts,
    clientPositions,
    consistencyChecks,
    attorneyReviewGates,
    issueLinks,
    matterSummaries,
    desktopBoundary,
  } = context;
  const sourceStatus = Object.fromEntries(sourceReads.map((source) => [source.source_id, source.status]));
  const clauseIds = new Set(clauseDrafts.map((draft) => draft.contract_clause_draft_id));
  const clausesWithPosition = new Set(clauseDrafts.filter((draft) => draft.client_position_id).map((draft) => draft.contract_clause_draft_id));
  const clausesWithConsistency = new Set(consistencyChecks.map((check) => check.contract_clause_draft_id));
  const clausesWithReview = new Set(attorneyReviewGates.map((gate) => gate.contract_clause_draft_id));
  const clausesWithIssue = new Set(issueLinks.map((link) => link.contract_clause_draft_id));
  return [
    checkpoint("source.matter", sourceStatus.matter === "complete" && Boolean(matter?.matter_id), "Matter source loaded."),
    checkpoint("source.ldd_rfi_generator", sourceStatus.ldd_rfi_generator === "complete" && lddRfiGenerator?.summary?.ldd_rfi_generator_status === "complete", "LDD RFI Generator source loaded."),
    checkpoint("source.meeting_minutes_workflow", sourceStatus.meeting_minutes_workflow === "complete" && meetingMinutesWorkflow?.summary?.meeting_minutes_workflow_status === "complete", "Meeting Minutes Workflow source loaded."),
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:contract-draft"]), "Package script law-firm:contract-draft is registered."),
    checkpoint("roadmap.p249", /P249|Phase 249/i.test(roadmapText ?? ""), "Roadmap or ledger tracks P249."),
    checkpoint("rules.minimum", rules.length >= 6, "Contract draft workflow rules are present."),
    checkpoint("draft.packet.present", draftPackets.length === 1, "One draft packet is generated for the contract document."),
    checkpoint("clause.count.matches.negotiation.points", clauseDrafts.length === getNegotiationPoints(matter).length && clauseDrafts.length > 0, "One clause draft is generated per negotiation point."),
    checkpoint("client.position.count", clientPositions.length === clauseDrafts.length, "One client position is captured per clause draft."),
    checkpoint("consistency.count", consistencyChecks.length === clauseDrafts.length, "One consistency check is generated per clause draft."),
    checkpoint("review.gate.count", attorneyReviewGates.length === clauseDrafts.length, "One attorney-review gate is generated per clause draft."),
    checkpoint("issue.links.present", issueLinks.length >= clauseDrafts.length && clauseIds.size === clausesWithIssue.size, "Every clause draft is linked to at least one source issue."),
    checkpoint("clause.links.complete", clauseIds.size === clausesWithPosition.size && clauseIds.size === clausesWithConsistency.size && clauseIds.size === clausesWithReview.size, "Every clause draft is linked to client position, consistency check, and attorney-review gate rows."),
    checkpoint("source.refs", [...draftPackets, ...clauseDrafts, ...clientPositions, ...consistencyChecks, ...attorneyReviewGates, ...issueLinks].every((row) => (row.source_ref_count ?? 0) > 0), "Every generated row has source refs."),
    checkpoint("consistency.passed", consistencyChecks.every((check) => check.clause_consistency_passed === true && check.consistency_check_status === "passed_pending_attorney_review"), "Consistency checks pass while remaining attorney-review gated."),
    checkpoint("matter.summary.present", matterSummaries.length === 1 && matterSummaries[0]?.matter_id === matter?.matter_id, "Matter summary is generated within one matter boundary."),
    checkpoint("review.gates", [...draftPackets, ...clauseDrafts, ...clientPositions, ...consistencyChecks, ...attorneyReviewGates, ...issueLinks, ...matterSummaries].every((row) => row.attorney_review_required && row.human_review_required && row.client_facing_ready === false), "All rows remain attorney/human-review gated and not client-facing-ready."),
    checkpoint("no.legal.output", [...clauseDrafts, ...clientPositions, ...consistencyChecks, ...attorneyReviewGates, ...issueLinks, ...matterSummaries].every((row) => row.legal_conclusion_asserted === false && row.legal_advice_provided === false), "No legal advice or legal conclusion is produced."),
    checkpoint("no.client.delivery", [...draftPackets, ...clauseDrafts, ...attorneyReviewGates, ...matterSummaries].every((row) => row.contract_delivery_ready === false) && clauseDrafts.every((row) => row.client_facing_output_generated === false), "No client-facing output or delivery-ready contract draft is produced."),
    checkpoint("no.mutation", clauseDrafts.every((row) => row.matter_data_write_allowed === false && row.task_state_write_allowed === false && row.workflow_transition_allowed === false && row.runtime_execution_allowed === false && row.delivery_execution_allowed === false && row.protected_action_allowed === false) && desktopBoundary.matter_data_write_allowed === false && desktopBoundary.protected_action_allowed === false, "No matter/task/workflow/runtime/delivery/protected mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false && desktopBoundary.desktop_source_of_truth === false, "Desktop boundary is read-only and not source-of-truth."),
  ];
}

function summarizeContractDraftWorkflow(context) {
  const {
    sourceReads,
    matter,
    lddRfiGenerator,
    meetingMinutesWorkflow,
    rules,
    draftPackets,
    clauseDrafts,
    clientPositions,
    consistencyChecks,
    attorneyReviewGates,
    issueLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  } = context;
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceById = Object.fromEntries(sourceReads.map((source) => [source.source_id, source]));
  return {
    contract_draft_workflow_status: validation.valid ? "complete" : "attention",
    contract_draft_workflow_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    source_matter_status: sourceById.matter?.status ?? "missing",
    source_matter_id: matter?.matter_id ?? null,
    source_ldd_rfi_generator_status: sourceById.ldd_rfi_generator?.status ?? "missing",
    source_ldd_rfi_generator_phase_status: lddRfiGenerator?.summary?.ldd_rfi_generator_status ?? "unknown",
    source_ldd_rfi_question_count: lddRfiGenerator?.summary?.rfi_question_count ?? 0,
    source_meeting_minutes_workflow_status: sourceById.meeting_minutes_workflow?.status ?? "missing",
    source_meeting_minutes_workflow_phase_status: meetingMinutesWorkflow?.summary?.meeting_minutes_workflow_status ?? "unknown",
    source_meeting_action_item_count: meetingMinutesWorkflow?.summary?.action_item_count ?? 0,
    source_negotiation_point_count: getNegotiationPoints(matter).length,
    source_contract_document_count: getContractDocuments(matter).length,
    source_qa_item_count: (matter?.deal_control?.qa_items ?? []).length,
    contract_draft_rule_count: rules.length,
    draft_packet_count: draftPackets.length,
    clause_draft_count: clauseDrafts.length,
    client_position_count: clientPositions.length,
    consistency_check_count: consistencyChecks.length,
    attorney_review_gate_count: attorneyReviewGates.length,
    issue_link_count: issueLinks.length,
    matter_count: matterSummaries.length,
    clause_with_client_position_count: clauseDrafts.filter((draft) => draft.client_position_id).length,
    clause_with_consistency_check_count: clauseDrafts.filter((draft) => draft.consistency_check_id).length,
    clause_with_attorney_review_gate_count: clauseDrafts.filter((draft) => draft.attorney_review_gate_id).length,
    clause_with_issue_link_count: clauseDrafts.filter((draft) => draft.issue_link_count > 0).length,
    consistency_passed_count: consistencyChecks.filter((check) => check.clause_consistency_passed).length,
    attorney_review_required_clause_count: clauseDrafts.filter((draft) => draft.attorney_review_required).length,
    human_review_required_clause_count: clauseDrafts.filter((draft) => draft.human_review_required).length,
    client_facing_ready_count: [...draftPackets, ...clauseDrafts, ...clientPositions, ...consistencyChecks, ...attorneyReviewGates, ...issueLinks, ...matterSummaries].filter((row) => row.client_facing_ready).length,
    contract_delivery_ready_count: [...draftPackets, ...clauseDrafts, ...attorneyReviewGates, ...matterSummaries].filter((row) => row.contract_delivery_ready).length,
    legal_conclusion_asserted_count: [...clauseDrafts, ...clientPositions, ...consistencyChecks, ...attorneyReviewGates, ...issueLinks, ...matterSummaries].filter((row) => row.legal_conclusion_asserted).length,
    legal_advice_provided: [...clauseDrafts, ...clientPositions, ...consistencyChecks, ...attorneyReviewGates, ...issueLinks, ...matterSummaries].some((row) => row.legal_advice_provided),
    client_facing_output_generated: clauseDrafts.some((row) => row.client_facing_output_generated),
    deterministic_contract_draft_generation_count: clauseDrafts.filter((row) => row.deterministic_contract_draft_generation_performed).length,
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed || clauseDrafts.some((row) => row.matter_data_write_allowed),
    task_state_write_allowed: desktopBoundary.task_state_write_allowed || clauseDrafts.some((row) => row.task_state_write_allowed),
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed || clauseDrafts.some((row) => row.workflow_transition_allowed),
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed || clauseDrafts.some((row) => row.runtime_execution_allowed),
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed || clauseDrafts.some((row) => row.delivery_execution_allowed),
    protected_action_allowed: desktopBoundary.protected_action_allowed || clauseDrafts.some((row) => row.protected_action_allowed),
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    desktop_boundary_status: desktopBoundary.boundary_status,
    desktop_read_only: desktopBoundary.read_only,
    desktop_mutation_allowed: desktopBoundary.desktop_mutation_allowed,
    desktop_source_of_truth: desktopBoundary.desktop_source_of_truth,
    validation_item_count: checkpoints.length,
    failed_checkpoint_count: failedCheckpointCount,
    validation_error_count: validation.errors.length,
  };
}

function buildSafeHandling() {
  return {
    report_only: true,
    draft_only: true,
    deterministic_contract_draft_generation_performed: true,
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

function buildSourceContracts(sourceReads, packageJson, roadmapText) {
  return {
    source_of_truth: SOURCE_OF_TRUTH,
    sources: sourceReads.map(({ value, ...source }) => ({
      ...source,
      schema_version: value?.schema_version ?? null,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:contract-draft"]),
    roadmap_p249_present: /P249|Phase 249/i.test(roadmapText.text ?? ""),
  };
}

function renderContractDraftWorkflowMarkdown(result) {
  const lines = [];
  lines.push("# Contract Draft Workflow");
  lines.push("");
  lines.push(`Status: ${result.summary.contract_draft_workflow_status}`);
  lines.push(`Draft packets: ${result.summary.draft_packet_count}`);
  lines.push(`Clause drafts: ${result.summary.clause_draft_count}`);
  lines.push(`Client positions: ${result.summary.client_position_count}`);
  lines.push(`Consistency checks: ${result.summary.consistency_check_count}`);
  lines.push(`Attorney review gates: ${result.summary.attorney_review_gate_count}`);
  lines.push(`Issue links: ${result.summary.issue_link_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: contract draft rows are internal operational scaffolds only. Attorney review, source verification, and partner approval are required before client-facing use.");
  lines.push("No legal advice, legal conclusion, matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, delivery-ready contract language, or client-facing output is performed.");
  return `${lines.join("\n")}\n`;
}

function serializableContractDraftWorkflow(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readSourceArtifacts(inputs) {
  const matter = await readJsonOrError(inputs.matter_path);
  const lddRfiGenerator = await readJsonOrError(inputs.ldd_rfi_generator_path);
  const meetingMinutesWorkflow = await readJsonOrError(inputs.meeting_minutes_workflow_path);
  return [
    sourceRead("matter", "matter_file", inputs.matter_path, matter),
    sourceRead("ldd_rfi_generator", "artifact", inputs.ldd_rfi_generator_path, lddRfiGenerator),
    sourceRead("meeting_minutes_workflow", "artifact", inputs.meeting_minutes_workflow_path, meetingMinutesWorkflow),
  ];
}

function sourceRead(sourceId, sourceKind, sourcePath, result) {
  return {
    source_id: sourceId,
    source_kind: sourceKind,
    path: path.resolve(sourcePath),
    status: result.status,
    error: result.error,
    value: result.value,
  };
}

async function readJsonOrError(filePath) {
  try {
    const raw = await readFile(path.resolve(filePath), "utf8");
    return { status: "complete", value: JSON.parse(raw), error: null };
  } catch (error) {
    return { status: "missing", value: null, error: error.message };
  }
}

async function readTextOrError(filePath) {
  try {
    const text = await readFile(path.resolve(filePath), "utf8");
    return { status: "complete", text, value: null, error: null };
  } catch (error) {
    return { status: "missing", text: "", value: null, error: error.message };
  }
}

function normalizeInputs(options) {
  return {
    matter_path: path.resolve(options.matterPath ?? DEFAULT_CONTRACT_DRAFT_WORKFLOW_INPUTS.matterPath),
    ldd_rfi_generator_path: path.resolve(options.lddRfiGeneratorPath ?? DEFAULT_CONTRACT_DRAFT_WORKFLOW_INPUTS.lddRfiGeneratorPath),
    meeting_minutes_workflow_path: path.resolve(options.meetingMinutesWorkflowPath ?? DEFAULT_CONTRACT_DRAFT_WORKFLOW_INPUTS.meetingMinutesWorkflowPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_CONTRACT_DRAFT_WORKFLOW_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_CONTRACT_DRAFT_WORKFLOW_INPUTS.roadmapPath),
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
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--matter") parsed.matterPath = argv[++index];
    else if (arg === "--ldd-rfi-generator") parsed.lddRfiGeneratorPath = argv[++index];
    else if (arg === "--meeting-minutes-workflow") parsed.meetingMinutesWorkflowPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/contract-draft-workflow.mjs [options]

Options:
  --check                         fail when validation has errors
  --no-write                      build without writing files
  --out-dir <path>                output directory
  --matter <path>                 matter JSON path
  --ldd-rfi-generator <path>      LDD RFI generator artifact path
  --meeting-minutes-workflow <path> meeting minutes workflow artifact path
  --package <path>                package.json path
  --roadmap <path>                roadmap or ledger path
  --run-at <iso>                  generated_at override
  --help                          show this help`);
}

function workflowRule(ruleType, label, description) {
  return { rule_type: ruleType, label, description };
}

function sourceRef(sourceKind, sourceId, sourceField) {
  return {
    source_kind: sourceKind,
    source_id: sourceId ?? "unknown",
    source_field: sourceField,
  };
}

function checkpoint(checkpointId, passed, message, extra = {}) {
  return {
    checkpoint_id: checkpointId,
    status: passed ? "passed" : "failed",
    message,
    ...extra,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({
      path: item.path,
      message: item.message,
    }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function getNegotiationPoints(matter) {
  return matter?.deal_control?.negotiation_points ?? [];
}

function getContractDocuments(matter) {
  return (matter?.documents ?? []).filter((document) => /contract/i.test(document.type ?? "") || /spa/i.test(document.title ?? ""));
}

function inferClauseType(point) {
  const text = normalize(`${point?.clause ?? ""} ${point?.open_issue ?? ""}`);
  if (text.includes("indemnity") || text.includes("tax")) return "indemnity_tax_exposure";
  if (text.includes("disclosure")) return "disclosure_schedule";
  return "contract_clause";
}

function findSourceGaps(matter, draft) {
  const text = normalize(`${draft.clause_name} ${draft.draft_clause_text}`);
  const refs = [];
  if (text.includes("tax")) {
    const taxDoc = (matter?.documents ?? []).find((document) => /tax team memo/i.test(document.title ?? ""));
    const cp = (matter?.deal_control?.cp_checklist ?? []).find((item) => /tax/i.test(item.title ?? ""));
    if (taxDoc) refs.push(sourceRef("matter.documents", taxDoc.id, "status"));
    if (cp) refs.push(sourceRef("matter.deal_control.cp_checklist", cp.id, "status"));
  }
  if (text.includes("disclosure")) {
    const disclosureDoc = (matter?.documents ?? []).find((document) => /disclosure schedule/i.test(document.title ?? ""));
    const qa = (matter?.deal_control?.qa_items ?? []).find((item) => /disclosure schedule/i.test(item.question ?? ""));
    if (disclosureDoc) refs.push(sourceRef("matter.documents", disclosureDoc.id, "status"));
    if (qa) refs.push(sourceRef("matter.deal_control.qa_items", qa.id, "status"));
  }
  return refs;
}

function findIssueSources({ matter, lddRfiGenerator, meetingMinutesWorkflow, draft }) {
  const text = normalize(`${draft.clause_name} ${draft.draft_clause_text}`);
  const sources = [];
  const rfiQuestions = lddRfiGenerator?.ldd_rfi_questions ?? [];
  const meetingActions = meetingMinutesWorkflow?.meeting_minutes_action_items ?? [];
  if (text.includes("indemnity") || text.includes("tax")) {
    const rfiQuestion = rfiQuestions.find((question) => /indemnity|tax|related-party/i.test(`${question.issue_title ?? ""} ${question.question_text ?? ""}`));
    const qa = (matter?.deal_control?.qa_items ?? []).find((item) => /escrow|tax/i.test(item.question ?? ""));
    if (rfiQuestion) sources.push(issueSource("ldd_rfi_question", rfiQuestion.ldd_rfi_question_id, rfiQuestion.issue_title, "question_text"));
    if (qa) sources.push(issueSource("matter.deal_control.qa_items", qa.id, qa.question, "question"));
  }
  if (text.includes("disclosure")) {
    const rfiQuestion = rfiQuestions.find((question) => /disclosure schedule/i.test(`${question.issue_title ?? ""} ${question.question_text ?? ""}`));
    const meetingAction = meetingActions.find((action) => /disclosure schedule/i.test(`${action.action_title ?? ""} ${action.action_description ?? ""}`));
    if (rfiQuestion) sources.push(issueSource("ldd_rfi_question", rfiQuestion.ldd_rfi_question_id, rfiQuestion.issue_title, "question_text"));
    if (meetingAction) sources.push(issueSource("meeting_minutes_action_item", meetingAction.meeting_minutes_action_item_id, meetingAction.action_title, "action_description"));
  }
  if (sources.length === 0) {
    sources.push(issueSource("matter.deal_control.negotiation_points", draft.negotiation_point_id, draft.clause_name, "open_issue"));
  }
  return sources;
}

function issueSource(sourceKind, sourceId, sourceTitle, sourceField) {
  return {
    source_kind: sourceKind,
    source_id: sourceId ?? "unknown",
    source_title: sourceTitle ?? null,
    source_field: sourceField,
  };
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function unique(values) {
  return [...new Set(values)];
}

function normalize(value) {
  return String(value ?? "").toLowerCase();
}

function slugify(value) {
  return String(value ?? "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "item";
}

function dateStamp(value) {
  return String(value).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "").replace("T", "T");
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
