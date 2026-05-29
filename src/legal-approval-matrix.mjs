import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LEGAL_APPROVAL_MATRIX_OUT_DIR = "artifacts/legal-approval-matrix/latest";
export const DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS = {
  lddRfiGeneratorPath: "artifacts/ldd-rfi-generator/latest/ldd-rfi-generator.json",
  lddReportDraftPath: "artifacts/ldd-report-draft/latest/ldd-report-draft.json",
  litigationBriefDraftPath: "artifacts/litigation-brief-draft/latest/litigation-brief-draft.json",
  meetingMinutesWorkflowPath: "artifacts/meeting-minutes-workflow/latest/meeting-minutes-workflow.json",
  contractDraftWorkflowPath: "artifacts/contract-draft-workflow/latest/contract-draft-workflow.json",
  providedMaterialReviewPath: "artifacts/provided-material-review/latest/provided-material-review-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "legal-approval-matrix.v1";
const SOURCE_OF_TRUTH = "law_firm_draft_and_review_artifacts";
const SOURCE_DEFINITIONS = [
  sourceDefinition("ldd_rfi_generator", "LDD RFI Generator", "lddRfiGeneratorPath", "ldd_rfi_generator_status", "rfi_draft", "rfi_question_count", "attorney_review_required_question_count"),
  sourceDefinition("ldd_report_draft", "LDD Report Draft", "lddReportDraftPath", "ldd_report_draft_status", "ldd_report_draft", "paragraph_count", "attorney_review_required_paragraph_count"),
  sourceDefinition("litigation_brief_draft", "Litigation Brief Draft", "litigationBriefDraftPath", "litigation_brief_draft_status", "litigation_brief_draft", "claim_count", "attorney_review_required_claim_count"),
  sourceDefinition("meeting_minutes_workflow", "Meeting Minutes Workflow", "meetingMinutesWorkflowPath", "meeting_minutes_workflow_status", "meeting_minutes_workflow", "action_item_count", "attorney_review_required_count"),
  sourceDefinition("contract_draft_workflow", "Contract Draft Workflow", "contractDraftWorkflowPath", "contract_draft_workflow_status", "contract_draft_workflow", "clause_draft_count", "attorney_review_gate_count"),
  sourceDefinition("provided_material_review", "Provided Material Review Ledger", "providedMaterialReviewPath", "provided_material_review_status", "provided_material_review", "material_review_item_count", "review_gate_count"),
];
const MATRIX_RULES = [
  matrixRule("source_capture", "Source capture", "Law-firm draft and review artifacts remain read-only inputs."),
  matrixRule("output_inventory", "Output inventory", "Every selected law-firm output artifact receives one approval matrix row."),
  matrixRule("attorney_review_required", "Attorney review required", "Every output row requires attorney/human review before legal or client-facing use."),
  matrixRule("partner_approval_required", "Partner approval required", "Every output row requires partner approval before external or final use."),
  matrixRule("approval_decision_not_recorded", "Approval decision not recorded", "The matrix records requirements only and does not approve, reject, finalize, or deliver outputs."),
  matrixRule("desktop_read_only", "Desktop read-only", "Desktop views are read-only projections and are not the source of truth."),
];

export async function runLegalApprovalMatrix(options = {}) {
  const result = await buildLegalApprovalMatrix(options);
  if (options.write !== false) await writeLegalApprovalMatrix(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Legal approval matrix validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLegalApprovalMatrix(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LEGAL_APPROVAL_MATRIX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sourceReads = await readSourceArtifacts(inputs);
  const packageJson = await readJsonOrError(inputs.package_path);
  const roadmapText = await readTextOrError(inputs.roadmap_path);
  const rules = buildMatrixRules(generatedAt);
  const outputRows = buildOutputRows(sourceReads, generatedAt);
  const requirementRows = buildRequirementRows(outputRows, generatedAt);
  const gateLinks = buildGateLinks(outputRows, requirementRows, generatedAt);
  const matterSummaries = buildMatterSummaries(outputRows, requirementRows, gateLinks, generatedAt);
  const desktopBoundary = buildDesktopBoundary(generatedAt);
  const checkpoints = buildCheckpoints({
    sourceReads,
    packageJson: packageJson.value,
    roadmapText: roadmapText.text,
    rules,
    outputRows,
    requirementRows,
    gateLinks,
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
  const summary = summarizeLegalApprovalMatrix({
    sourceReads,
    rules,
    outputRows,
    requirementRows,
    gateLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  });
  const result = {
    schema_version: CONTRACT_ID,
    generated_at: generatedAt,
    legal_approval_matrix_id: `legal-approval-matrix.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    legal_approval_matrix_status: summary.legal_approval_matrix_status,
    safe_handling: buildSafeHandling(),
    inputs,
    source_contracts: buildSourceContracts(sourceReads, packageJson, roadmapText),
    legal_approval_matrix_contract: buildContract(generatedAt),
    legal_approval_matrix_rules: rules,
    legal_approval_output_rows: outputRows,
    legal_approval_requirements: requirementRows,
    legal_approval_gate_links: gateLinks,
    legal_approval_matter_summaries: matterSummaries,
    legal_approval_matrix_desktop_boundary: desktopBoundary,
    legal_approval_matrix_checkpoints: checkpoints,
    validation_items: validationItems,
    validation,
    summary,
  };
  return {
    ...result,
    markdown: renderLegalApprovalMatrixMarkdown(result),
  };
}

export async function writeLegalApprovalMatrix(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = serializableLegalApprovalMatrix(result);
  await writeJson(path.join(outDir, "legal-approval-matrix.json"), serializable);
  await writeJson(path.join(outDir, "legal-approval-matrix-rules.json"), {
    schema_version: "legal-approval-matrix-rules.v1",
    generated_at: result.generated_at,
    legal_approval_rule_count: result.legal_approval_matrix_rules.length,
    legal_approval_matrix_rules: result.legal_approval_matrix_rules,
  });
  await writeJson(path.join(outDir, "legal-approval-output-rows.json"), {
    schema_version: "legal-approval-output-rows.v1",
    generated_at: result.generated_at,
    legal_approval_output_count: result.legal_approval_output_rows.length,
    legal_approval_output_rows: result.legal_approval_output_rows,
  });
  await writeJson(path.join(outDir, "legal-approval-requirements.json"), {
    schema_version: "legal-approval-requirements.v1",
    generated_at: result.generated_at,
    legal_approval_requirement_count: result.legal_approval_requirements.length,
    legal_approval_requirements: result.legal_approval_requirements,
  });
  await writeJson(path.join(outDir, "legal-approval-gate-links.json"), {
    schema_version: "legal-approval-gate-links.v1",
    generated_at: result.generated_at,
    legal_approval_gate_link_count: result.legal_approval_gate_links.length,
    legal_approval_gate_links: result.legal_approval_gate_links,
  });
  await writeJson(path.join(outDir, "legal-approval-matter-summaries.json"), {
    schema_version: "legal-approval-matter-summaries.v1",
    generated_at: result.generated_at,
    legal_approval_matter_summary_count: result.legal_approval_matter_summaries.length,
    legal_approval_matter_summaries: result.legal_approval_matter_summaries,
  });
  await writeJson(path.join(outDir, "legal-approval-matrix-boundary.json"), {
    schema_version: "legal-approval-matrix-boundary-artifact.v1",
    generated_at: result.generated_at,
    legal_approval_matrix_desktop_boundary: result.legal_approval_matrix_desktop_boundary,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "legal-approval-matrix-validation-report.v1",
    generated_at: result.generated_at,
    legal_approval_matrix_id: result.legal_approval_matrix_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runLegalApprovalMatrixCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runLegalApprovalMatrix(args);
    console.log(`Legal approval matrix ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.legal_approval_matrix_status}`);
    console.log(`Outputs/requirements: ${result.summary.legal_approval_output_count}/${result.summary.legal_approval_requirement_count}`);
    console.log(`Gate links/matters: ${result.summary.legal_approval_gate_link_count}/${result.summary.matter_count}`);
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
    schema_version: "legal-approval-matrix-contract.v1",
    contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    output_rule: "each law-firm draft or review output receives one matrix row",
    attorney_review_rule: "attorney and human review are required for every output before legal or client-facing use",
    partner_approval_rule: "partner approval is required before any external, final, client-facing, filing, or delivery use",
    decision_rule: "the matrix records pending requirements only and records no approval decision",
    client_output_rule: "client-facing and final use stay blocked until attorney review and partner approval are recorded elsewhere",
    desktop_companion_rule: "Desktop views are read-only projections and are not the source of truth",
    mutation_policy: "no matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, approval decision, legal advice, legal conclusion, or client-facing output is performed",
    created_at: generatedAt,
  };
}

function buildMatrixRules(generatedAt) {
  return MATRIX_RULES.map((rule, index) => ({
    schema_version: "legal-approval-matrix-rule.v1",
    legal_approval_rule_id: `legal-approval-rule.${rule.rule_type}`,
    legal_approval_rule_type: rule.rule_type,
    rule_label: rule.label,
    rule_description: rule.description,
    rule_priority: index + 1,
    rule_status: "active",
    deterministic_only: true,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    created_at: generatedAt,
  }));
}

function buildOutputRows(sourceReads, generatedAt) {
  return sourceReads.map((source, index) => {
    const summary = source.value?.summary ?? {};
    const matterId = deriveMatterId(source.value, summary);
    const sourceStatus = source.status === "complete" && summary[source.definition.status_field] === "complete" ? "complete" : "attention";
    const sourceOutputCount = summary[source.definition.output_count_field] ?? 0;
    const nativeGateCount = summary[source.definition.native_gate_count_field] ?? 0;
    return {
      schema_version: "legal-approval-output-row.v1",
      legal_approval_output_id: `legal-approval-output.${source.source_id}`,
      matter_id: matterId,
      source_artifact_id: source.source_id,
      source_artifact_label: source.definition.label,
      source_artifact_schema_version: source.value?.schema_version ?? null,
      source_artifact_status: sourceStatus,
      source_phase_status: summary[source.definition.status_field] ?? "unknown",
      legal_approval_output_kind: source.definition.output_kind,
      source_output_count: sourceOutputCount,
      native_review_gate_count: nativeGateCount,
      approval_requirement_status: "attorney_and_partner_approval_required",
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required_before_client_use: true,
      client_use_blocked_until_approval: true,
      finalization_blocked_until_approval: true,
      delivery_blocked_until_approval: true,
      filing_blocked_until_approval: true,
      approval_decision_recorded: false,
      attorney_approval_recorded: false,
      partner_approval_recorded: false,
      final_review_decision_recorded: false,
      client_facing_ready: false,
      client_facing_output_generated: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      matter_data_write_allowed: false,
      task_state_write_allowed: false,
      workflow_transition_allowed: false,
      runtime_execution_allowed: false,
      delivery_execution_allowed: false,
      protected_action_allowed: false,
      source_refs: [
        sourceRef(source.source_id, source.path, source.definition.status_field),
        sourceRef(source.source_id, source.path, source.definition.native_gate_count_field),
      ],
      source_ref_count: 2,
      created_at: generatedAt,
      sequence_number: index + 1,
    };
  });
}

function buildRequirementRows(outputRows, generatedAt) {
  return outputRows.flatMap((row) => [
    requirementRow(row, "attorney_review", "attorney_reviewer", "attorney_review", generatedAt),
    requirementRow(row, "partner_approval", "partner", "partner_approval", generatedAt),
  ]);
}

function requirementRow(outputRow, requirementType, requiredActor, approvalLevel, generatedAt) {
  return {
    schema_version: "legal-approval-requirement.v1",
    legal_approval_requirement_id: `legal-approval-requirement.${outputRow.source_artifact_id}.${requirementType}`,
    legal_approval_output_id: outputRow.legal_approval_output_id,
    matter_id: outputRow.matter_id,
    source_artifact_id: outputRow.source_artifact_id,
    legal_approval_output_kind: outputRow.legal_approval_output_kind,
    approval_requirement_type: requirementType,
    required_actor: requiredActor,
    required_approval_level: approvalLevel,
    approval_requirement_status: "pending_required",
    gate_status: "blocked_until_human_approval",
    approval_decision_recorded: false,
    approval_granted: false,
    approval_rejected: false,
    client_use_blocked_until_approval: true,
    finalization_blocked_until_approval: true,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    client_facing_ready: false,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    source_refs: [sourceRef("legal_approval_output_row", outputRow.legal_approval_output_id, "approval_requirement_status")],
    source_ref_count: 1,
    created_at: generatedAt,
  };
}

function buildGateLinks(outputRows, requirementRows, generatedAt) {
  const requirementsByOutput = groupBy(requirementRows, (row) => row.legal_approval_output_id);
  return outputRows.map((row) => {
    const linkedRequirements = requirementsByOutput.get(row.legal_approval_output_id) ?? [];
    return {
      schema_version: "legal-approval-gate-link.v1",
      legal_approval_gate_link_id: `legal-approval-gate-link.${row.source_artifact_id}`,
      legal_approval_output_id: row.legal_approval_output_id,
      matter_id: row.matter_id,
      source_artifact_id: row.source_artifact_id,
      legal_approval_output_kind: row.legal_approval_output_kind,
      native_review_gate_count: row.native_review_gate_count,
      linked_requirement_count: linkedRequirements.length,
      gate_link_status: row.native_review_gate_count > 0 && linkedRequirements.length === 2 ? "linked_pending_approval" : "attention",
      attorney_requirement_linked: linkedRequirements.some((requirement) => requirement.approval_requirement_type === "attorney_review"),
      partner_requirement_linked: linkedRequirements.some((requirement) => requirement.approval_requirement_type === "partner_approval"),
      client_use_blocked_until_approval: true,
      finalization_blocked_until_approval: true,
      approval_decision_recorded: false,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      source_refs: [
        sourceRef("legal_approval_output_row", row.legal_approval_output_id, "native_review_gate_count"),
        ...linkedRequirements.map((requirement) => sourceRef("legal_approval_requirement", requirement.legal_approval_requirement_id, "approval_requirement_status")),
      ],
      source_ref_count: 1 + linkedRequirements.length,
      created_at: generatedAt,
    };
  });
}

function buildMatterSummaries(outputRows, requirementRows, gateLinks, generatedAt) {
  const byMatter = groupBy(outputRows, (row) => row.matter_id);
  return [...byMatter.entries()].map(([matterId, rows]) => {
    const rowIds = new Set(rows.map((row) => row.legal_approval_output_id));
    const requirements = requirementRows.filter((requirement) => rowIds.has(requirement.legal_approval_output_id));
    const links = gateLinks.filter((link) => rowIds.has(link.legal_approval_output_id));
    return {
      schema_version: "legal-approval-matter-summary.v1",
      legal_approval_matter_summary_id: `legal-approval-summary.${slugify(matterId)}`,
      matter_id: matterId,
      legal_approval_matter_status: "pending_attorney_and_partner_approval",
      legal_approval_output_count: rows.length,
      legal_approval_requirement_count: requirements.length,
      legal_approval_gate_link_count: links.length,
      attorney_review_required_output_count: rows.filter((row) => row.attorney_review_required).length,
      partner_approval_required_output_count: rows.filter((row) => row.partner_approval_required_before_client_use).length,
      client_use_blocked_output_count: rows.filter((row) => row.client_use_blocked_until_approval).length,
      finalization_blocked_output_count: rows.filter((row) => row.finalization_blocked_until_approval).length,
      approval_decision_recorded_count: 0,
      client_facing_ready_count: 0,
      attorney_review_required: true,
      human_review_required: true,
      partner_approval_required_before_client_use: true,
      client_facing_ready: false,
      legal_conclusion_asserted: false,
      legal_advice_provided: false,
      source_refs: [sourceRef("legal_approval_output_row", rows[0]?.legal_approval_output_id, "approval_requirement_status")],
      source_ref_count: 1,
      created_at: generatedAt,
    };
  });
}

function buildDesktopBoundary(generatedAt) {
  return {
    schema_version: "legal-approval-matrix-desktop-boundary.v1",
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
    approval_decision_write_allowed: false,
    client_facing_output_allowed_without_attorney_review: false,
    partner_approval_bypass_allowed: false,
    generated_at: generatedAt,
  };
}

function buildCheckpoints(context) {
  const {
    sourceReads,
    packageJson,
    roadmapText,
    rules,
    outputRows,
    requirementRows,
    gateLinks,
    matterSummaries,
    desktopBoundary,
  } = context;
  const sourceStatus = Object.fromEntries(sourceReads.map((source) => [source.source_id, source.status === "complete" && source.value?.summary?.[source.definition.status_field] === "complete"]));
  const outputIds = new Set(outputRows.map((row) => row.legal_approval_output_id));
  const attorneyRequirementIds = new Set(requirementRows.filter((row) => row.approval_requirement_type === "attorney_review").map((row) => row.legal_approval_output_id));
  const partnerRequirementIds = new Set(requirementRows.filter((row) => row.approval_requirement_type === "partner_approval").map((row) => row.legal_approval_output_id));
  const linkedGateOutputIds = new Set(gateLinks.filter((link) => link.gate_link_status === "linked_pending_approval").map((link) => link.legal_approval_output_id));
  return [
    ...SOURCE_DEFINITIONS.map((definition) => checkpoint(`source.${definition.source_id}`, sourceStatus[definition.source_id], `${definition.label} source loaded.`)),
    checkpoint("package.script", Boolean(packageJson?.scripts?.["law-firm:approval-matrix"]), "Package script law-firm:approval-matrix is registered."),
    checkpoint("roadmap.p251", /P251|Phase 251/i.test(roadmapText ?? ""), "Roadmap or ledger tracks P251."),
    checkpoint("rules.minimum", rules.length >= 6, "Legal approval matrix rules are present."),
    checkpoint("output.count", outputRows.length === SOURCE_DEFINITIONS.length, "Every selected law-firm output has one approval matrix row."),
    checkpoint("requirement.count", requirementRows.length === outputRows.length * 2, "Each output has attorney and partner approval requirement rows."),
    checkpoint("attorney.requirement.coverage", outputRows.every((row) => attorneyRequirementIds.has(row.legal_approval_output_id)), "Each output has an attorney review requirement."),
    checkpoint("partner.requirement.coverage", outputRows.every((row) => partnerRequirementIds.has(row.legal_approval_output_id)), "Each output has a partner approval requirement."),
    checkpoint("gate.link.coverage", outputRows.every((row) => linkedGateOutputIds.has(row.legal_approval_output_id)), "Each output is linked to native gates and matrix requirements."),
    checkpoint("approval.blocking", outputRows.every((row) => row.client_use_blocked_until_approval && row.finalization_blocked_until_approval && row.delivery_blocked_until_approval && row.filing_blocked_until_approval), "Every output is blocked from client/final use until approval."),
    checkpoint("review.required", outputRows.every((row) => row.attorney_review_required && row.human_review_required && row.partner_approval_required_before_client_use), "Every output requires attorney, human, and partner approval."),
    checkpoint("source.refs", [...outputRows, ...requirementRows, ...gateLinks, ...matterSummaries].every((row) => (row.source_ref_count ?? 0) > 0), "Every generated row has source references."),
    checkpoint("matter.scope", matterSummaries.length >= 2 && outputRows.every((row) => row.matter_id), "Matrix rows remain matter scoped across law-firm matters."),
    checkpoint("no.approval.decision", [...outputRows, ...requirementRows, ...gateLinks].every((row) => row.approval_decision_recorded === false), "No approval decision is recorded."),
    checkpoint("no.legal.output", [...outputRows, ...requirementRows, ...gateLinks, ...matterSummaries].every((row) => row.legal_conclusion_asserted === false && row.legal_advice_provided === false && row.client_facing_ready === false), "No legal advice, conclusion, or client-facing-ready output is produced."),
    checkpoint("no.mutation", outputRows.every((row) => row.matter_data_write_allowed === false && row.task_state_write_allowed === false && row.workflow_transition_allowed === false && row.runtime_execution_allowed === false && row.delivery_execution_allowed === false && row.protected_action_allowed === false) && desktopBoundary.approval_decision_write_allowed === false && desktopBoundary.protected_action_allowed === false, "No matter/task/workflow/runtime/delivery/protected or approval-decision mutation is allowed."),
    checkpoint("desktop.boundary", desktopBoundary.boundary_status === "enforced" && desktopBoundary.read_only === true && desktopBoundary.desktop_mutation_allowed === false && desktopBoundary.desktop_source_of_truth === false, "Desktop boundary is read-only and not source-of-truth."),
  ];
}

function summarizeLegalApprovalMatrix(context) {
  const {
    sourceReads,
    rules,
    outputRows,
    requirementRows,
    gateLinks,
    matterSummaries,
    desktopBoundary,
    checkpoints,
    validation,
  } = context;
  const failedCheckpointCount = checkpoints.filter((item) => item.status !== "passed").length;
  const sourceStatus = Object.fromEntries(sourceReads.map((source) => [`source_${source.source_id}_status`, source.status]));
  const sourcePhaseStatus = Object.fromEntries(sourceReads.map((source) => [`source_${source.source_id}_phase_status`, source.value?.summary?.[source.definition.status_field] ?? "unknown"]));
  return {
    legal_approval_matrix_status: validation.valid ? "complete" : "attention",
    legal_approval_matrix_contract_id: CONTRACT_ID,
    source_of_truth: SOURCE_OF_TRUTH,
    ...sourceStatus,
    ...sourcePhaseStatus,
    legal_approval_rule_count: rules.length,
    legal_approval_output_count: outputRows.length,
    legal_approval_requirement_count: requirementRows.length,
    legal_approval_gate_link_count: gateLinks.length,
    matter_count: matterSummaries.length,
    attorney_review_requirement_count: requirementRows.filter((row) => row.approval_requirement_type === "attorney_review").length,
    partner_approval_requirement_count: requirementRows.filter((row) => row.approval_requirement_type === "partner_approval").length,
    attorney_review_required_output_count: outputRows.filter((row) => row.attorney_review_required).length,
    human_review_required_output_count: outputRows.filter((row) => row.human_review_required).length,
    partner_approval_required_output_count: outputRows.filter((row) => row.partner_approval_required_before_client_use).length,
    output_with_native_gate_count: outputRows.filter((row) => row.native_review_gate_count > 0).length,
    output_with_gate_link_count: gateLinks.filter((row) => row.gate_link_status === "linked_pending_approval").length,
    client_use_blocked_output_count: outputRows.filter((row) => row.client_use_blocked_until_approval).length,
    finalization_blocked_output_count: outputRows.filter((row) => row.finalization_blocked_until_approval).length,
    delivery_blocked_output_count: outputRows.filter((row) => row.delivery_blocked_until_approval).length,
    filing_blocked_output_count: outputRows.filter((row) => row.filing_blocked_until_approval).length,
    approval_decision_recorded_count: [...outputRows, ...requirementRows, ...gateLinks].filter((row) => row.approval_decision_recorded).length,
    attorney_approval_recorded_count: outputRows.filter((row) => row.attorney_approval_recorded).length,
    partner_approval_recorded_count: outputRows.filter((row) => row.partner_approval_recorded).length,
    client_facing_ready_count: [...outputRows, ...requirementRows, ...gateLinks, ...matterSummaries].filter((row) => row.client_facing_ready).length,
    legal_conclusion_asserted_count: [...outputRows, ...requirementRows, ...gateLinks, ...matterSummaries].filter((row) => row.legal_conclusion_asserted).length,
    legal_advice_provided: [...outputRows, ...requirementRows, ...gateLinks, ...matterSummaries].some((row) => row.legal_advice_provided),
    client_facing_output_generated: outputRows.some((row) => row.client_facing_output_generated),
    matter_data_write_allowed: desktopBoundary.matter_data_write_allowed || outputRows.some((row) => row.matter_data_write_allowed),
    task_state_write_allowed: desktopBoundary.task_state_write_allowed || outputRows.some((row) => row.task_state_write_allowed),
    workflow_transition_allowed: desktopBoundary.workflow_transition_allowed || outputRows.some((row) => row.workflow_transition_allowed),
    runtime_execution_allowed: desktopBoundary.runtime_execution_allowed || outputRows.some((row) => row.runtime_execution_allowed),
    delivery_execution_allowed: desktopBoundary.delivery_execution_allowed || outputRows.some((row) => row.delivery_execution_allowed),
    protected_action_allowed: desktopBoundary.protected_action_allowed || outputRows.some((row) => row.protected_action_allowed),
    approval_decision_write_allowed: desktopBoundary.approval_decision_write_allowed,
    client_facing_output_allowed_without_attorney_review: desktopBoundary.client_facing_output_allowed_without_attorney_review,
    partner_approval_bypass_allowed: desktopBoundary.partner_approval_bypass_allowed,
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
    deterministic_approval_matrix_performed: true,
    approval_decision_recorded: false,
    attorney_approval_recorded: false,
    partner_approval_recorded: false,
    final_review_decision_recorded: false,
    attorney_review_required: true,
    human_review_required: true,
    partner_approval_required_before_client_use: true,
    legal_conclusion_asserted: false,
    legal_advice_provided: false,
    client_facing_ready: false,
    client_facing_output_generated: false,
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
    sources: sourceReads.map(({ value, definition, ...source }) => ({
      ...source,
      source_label: definition.label,
      schema_version: value?.schema_version ?? null,
      phase_status: value?.summary?.[definition.status_field] ?? null,
    })),
    package_script_present: Boolean(packageJson.value?.scripts?.["law-firm:approval-matrix"]),
    roadmap_p251_present: /P251|Phase 251/i.test(roadmapText.text ?? ""),
  };
}

function renderLegalApprovalMatrixMarkdown(result) {
  const lines = [];
  lines.push("# Legal Approval Matrix");
  lines.push("");
  lines.push(`Status: ${result.summary.legal_approval_matrix_status}`);
  lines.push(`Outputs: ${result.summary.legal_approval_output_count}`);
  lines.push(`Requirements: ${result.summary.legal_approval_requirement_count}`);
  lines.push(`Gate links: ${result.summary.legal_approval_gate_link_count}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("Human review note: this matrix records attorney and partner approval requirements only. It does not approve, reject, finalize, file, deliver, or make any client-facing output.");
  lines.push("No legal advice, legal conclusion, approval decision, matter data write, task state write, workflow transition, runtime execution, delivery execution, protected action, or client-facing output is performed.");
  return `${lines.join("\n")}\n`;
}

function serializableLegalApprovalMatrix(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readSourceArtifacts(inputs) {
  const reads = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const read = await readJsonOrError(inputs[definition.input_field]);
    reads.push(sourceRead(definition, inputs[definition.input_field], read));
  }
  return reads;
}

function sourceRead(definition, sourcePath, result) {
  return {
    source_id: definition.source_id,
    source_kind: "artifact",
    definition,
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
    ldd_rfi_generator_path: path.resolve(options.lddRfiGeneratorPath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.lddRfiGeneratorPath),
    ldd_report_draft_path: path.resolve(options.lddReportDraftPath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.lddReportDraftPath),
    litigation_brief_draft_path: path.resolve(options.litigationBriefDraftPath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.litigationBriefDraftPath),
    meeting_minutes_workflow_path: path.resolve(options.meetingMinutesWorkflowPath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.meetingMinutesWorkflowPath),
    contract_draft_workflow_path: path.resolve(options.contractDraftWorkflowPath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.contractDraftWorkflowPath),
    provided_material_review_path: path.resolve(options.providedMaterialReviewPath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.providedMaterialReviewPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_LEGAL_APPROVAL_MATRIX_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--no-write") parsed.write = false;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--ldd-rfi-generator") parsed.lddRfiGeneratorPath = argv[++index];
    else if (arg === "--ldd-report-draft") parsed.lddReportDraftPath = argv[++index];
    else if (arg === "--litigation-brief-draft") parsed.litigationBriefDraftPath = argv[++index];
    else if (arg === "--meeting-minutes-workflow") parsed.meetingMinutesWorkflowPath = argv[++index];
    else if (arg === "--contract-draft-workflow") parsed.contractDraftWorkflowPath = argv[++index];
    else if (arg === "--provided-material-review") parsed.providedMaterialReviewPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/legal-approval-matrix.mjs [options]

Options:
  --check                          fail when validation has errors
  --no-write                       build without writing files
  --out-dir <path>                 output directory
  --ldd-rfi-generator <path>       LDD RFI generator artifact path
  --ldd-report-draft <path>        LDD report draft artifact path
  --litigation-brief-draft <path>  litigation brief draft artifact path
  --meeting-minutes-workflow <path> meeting minutes workflow artifact path
  --contract-draft-workflow <path> contract draft workflow artifact path
  --provided-material-review <path> provided material review artifact path
  --package <path>                 package.json path
  --roadmap <path>                 roadmap or ledger path
  --run-at <iso>                   generated_at override
  --help                           show this help`);
}

function deriveMatterId(artifact, summary) {
  if (summary.source_matter_id) return summary.source_matter_id;
  const matterSummary = artifact?.provided_material_matter_summaries?.[0]
    ?? artifact?.contract_draft_matter_summaries?.[0]
    ?? artifact?.meeting_minutes_matter_summaries?.[0]
    ?? artifact?.litigation_brief_matter_summaries?.[0]
    ?? artifact?.ldd_report_matter_summaries?.[0]
    ?? artifact?.ldd_rfi_matter_summaries?.[0];
  return matterSummary?.matter_id ?? "unknown";
}

function sourceDefinition(sourceId, label, optionKey, statusField, outputKind, outputCountField, nativeGateCountField) {
  return {
    source_id: sourceId,
    label,
    input_field: `${sourceId}_path`,
    option_key: optionKey,
    status_field: statusField,
    output_kind: outputKind,
    output_count_field: outputCountField,
    native_gate_count_field: nativeGateCountField,
  };
}

function matrixRule(ruleType, label, description) {
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

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
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
