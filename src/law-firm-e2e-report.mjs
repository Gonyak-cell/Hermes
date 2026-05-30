import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_LAW_FIRM_E2E_REPORT_OUT_DIR = "artifacts/law-firm-e2e-report/latest";
export const DEFAULT_LAW_FIRM_E2E_REPORT_INPUTS = {
  backupRestoreDrillPath: "artifacts/backup-restore-drill/latest/backup-restore-drill-report.json",
  lawFirmE2eFreezePath: "artifacts/law-firm-e2e-freeze/latest/law-firm-e2e-freeze.json",
  resourceContractFreezePath: "artifacts/resource-contract-freeze/latest/resource-contract-freeze.json",
  evidenceContractFreezePath: "artifacts/evidence-contract-freeze/latest/evidence-contract-freeze.json",
  lddReportDraftPath: "artifacts/ldd-report-draft/latest/ldd-report-draft.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  legalApprovalMatrixPath: "artifacts/legal-approval-matrix/latest/legal-approval-matrix.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "law-firm-e2e-report.v1";
const CAPABILITY_ID = "law_firm.e2e.report";
const PHASE_SLOT = "P305";
const PREVIOUS_PHASE_SLOT = "P304";
const NEXT_PHASE_SLOT = "P306";
const REQUIRED_CHAIN_STAGES = ["matter", "resource", "evidence", "draft", "citation", "approval", "audit"];

const SOURCE_DEFINITIONS = [
  sourceDefinition("backup_restore_drill", "Backup/Restore Drill", "backup_restore_drill_status", "complete", "P304", "P305"),
  sourceDefinition("law_firm_e2e_freeze", "Law Firm E2E Freeze", "law_firm_e2e_freeze_status", "complete", null, null),
  sourceDefinition("resource_contract_freeze", "Resource Contract Freeze", "freeze_status", "complete", null, null),
  sourceDefinition("evidence_contract_freeze", "Evidence Contract Freeze", "freeze_status", "complete", null, null),
  sourceDefinition("ldd_report_draft", "LDD Report Draft", "ldd_report_draft_status", "complete", null, null),
  sourceDefinition("citation_object_store", "Citation Object Store", "citation_object_store_status", "complete", null, null),
  sourceDefinition("legal_approval_matrix", "Legal Approval Matrix", "legal_approval_matrix_status", "complete", null, null),
  sourceDefinition("audit_event_ledger", "Audit Event Ledger", "audit_event_ledger_status", "complete", null, null),
];

export async function runLawFirmE2eReport(options = {}) {
  const result = await buildLawFirmE2eReport(options);
  if (options.write !== false) await writeLawFirmE2eReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Law firm E2E report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildLawFirmE2eReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_LAW_FIRM_E2E_REPORT_OUT_DIR);
  const reportId = `law-firm-e2e-report.${dateStamp(generatedAt)}`;
  const inputs = normalizeInputs(options);
  const sources = {
    backup_restore_drill: await readJsonSource(inputs.backup_restore_drill_path),
    law_firm_e2e_freeze: await readJsonSource(inputs.law_firm_e2e_freeze_path),
    resource_contract_freeze: await readJsonSource(inputs.resource_contract_freeze_path),
    evidence_contract_freeze: await readJsonSource(inputs.evidence_contract_freeze_path),
    ldd_report_draft: await readJsonSource(inputs.ldd_report_draft_path),
    citation_object_store: await readJsonSource(inputs.citation_object_store_path),
    legal_approval_matrix: await readJsonSource(inputs.legal_approval_matrix_path),
    audit_event_ledger: await readJsonSource(inputs.audit_event_ledger_path),
  };
  const support = {
    package_json: await readJsonSource(inputs.package_path),
    final_completion_ledger: await readTextSource(inputs.final_completion_ledger_path),
    implementation_roadmap: await readTextSource(inputs.implementation_roadmap_path),
    review_dashboard_source: await readTextSource(inputs.review_dashboard_source_path),
    review_api_source: await readTextSource(inputs.review_api_source_path),
    review_api_doc: await readTextSource(inputs.review_api_doc_path),
    control_plane_loop_source: await readTextSource(inputs.control_plane_loop_source_path),
  };

  const sourceStatuses = buildSourceStatuses(sources);
  const chainStages = buildChainStages(sources, generatedAt);
  const scenarioRows = buildScenarioRows(sources, chainStages, generatedAt);
  const gateResults = buildGateResults(sourceStatuses, scenarioRows, chainStages, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({
    sources,
    support,
    sourceStatuses,
    chainStages,
    scenarioRows,
    gateResults,
    boundary,
  });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({
    sourceStatuses,
    chainStages,
    scenarioRows,
    gateResults,
    boundary,
    validationItems,
    validation,
    sources,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    law_firm_e2e_report_id: reportId,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    law_firm_e2e_report_contract: buildContract(generatedAt),
    law_firm_e2e_scenario_rows: scenarioRows,
    law_firm_e2e_chain_stages: chainStages,
    law_firm_e2e_gate_results: gateResults,
    law_firm_e2e_report_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary: {
      ...summary,
      law_firm_e2e_report_id: reportId,
    },
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeLawFirmE2eReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "law-firm-e2e-report.json"), serializable);
  await writeJson(path.join(outDir, "law-firm-e2e-sources.json"), collectionEnvelope("law-firm-e2e-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "law-firm-e2e-scenario-rows.json"), collectionEnvelope("law-firm-e2e-scenario-rows.v1", "law_firm_e2e_scenario_rows", result.law_firm_e2e_scenario_rows, result.generated_at));
  await writeJson(path.join(outDir, "law-firm-e2e-chain-stages.json"), collectionEnvelope("law-firm-e2e-chain-stages.v1", "law_firm_e2e_chain_stages", result.law_firm_e2e_chain_stages, result.generated_at));
  await writeJson(path.join(outDir, "law-firm-e2e-gate-results.json"), collectionEnvelope("law-firm-e2e-gate-results.v1", "law_firm_e2e_gate_results", result.law_firm_e2e_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "law-firm-e2e-report-boundary.json"), result.law_firm_e2e_report_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "law-firm-e2e-report-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildContract(generatedAt) {
  return {
    schema_version: "law-firm-e2e-report-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    scenario: "matter_to_resource_to_evidence_to_draft_to_citation_to_approval_to_audit",
    source_of_truth: "law_firm_e2e_report_phase_artifacts",
    execution_model: "deterministic_read_only_report",
    human_review_rule: "legal and client-facing outputs remain attorney and partner approval gated",
    windows_baseline_rule: "P305 is valid only after P304 Windows baseline stability is preserved",
    created_at: generatedAt,
  };
}

function buildSourceStatuses(sources) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const source = sources[definition.source_id];
    const data = source?.data ?? {};
    const summary = summaryOf(data);
    const actualStatus = summary[definition.status_key] ?? data[definition.status_key] ?? "unknown";
    const actualPhaseSlot = summary.phase_slot ?? data.phase_slot ?? null;
    const actualNextPhaseSlot = summary.next_phase_slot ?? data.next_phase_slot ?? null;
    const validationErrorCount = summary.validation_error_count ?? data.validation?.errors?.length ?? 0;
    const phaseMatches = definition.expected_phase_slot === null || actualPhaseSlot === definition.expected_phase_slot;
    const nextPhaseMatches = definition.expected_next_phase_slot === null || actualNextPhaseSlot === definition.expected_next_phase_slot;
    const row = {
      schema_version: "law-firm-e2e-source-status.v1",
      source_status_id: `law-firm-e2e.source.${definition.source_id}`,
      ordinal: index + 1,
      source_id: definition.source_id,
      label: definition.label,
      source_path: source?.path ?? null,
      source_available: Boolean(source?.available),
      source_content_hash: source?.content_hash ?? null,
      expected_status: definition.expected_status,
      actual_status: actualStatus,
      expected_phase_slot: definition.expected_phase_slot,
      actual_phase_slot: actualPhaseSlot,
      expected_next_phase_slot: definition.expected_next_phase_slot,
      actual_next_phase_slot: actualNextPhaseSlot,
      validation_error_count: validationErrorCount,
      source_status: source?.available && actualStatus === definition.expected_status && phaseMatches && nextPhaseMatches && validationErrorCount === 0 ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildChainStages(sources, generatedAt) {
  const backup = summaryOf(sources.backup_restore_drill.data);
  const freeze = summaryOf(sources.law_firm_e2e_freeze.data);
  const resource = summaryOf(sources.resource_contract_freeze.data);
  const evidence = summaryOf(sources.evidence_contract_freeze.data);
  const draft = summaryOf(sources.ldd_report_draft.data);
  const citation = summaryOf(sources.citation_object_store.data);
  const approval = summaryOf(sources.legal_approval_matrix.data);
  const audit = summaryOf(sources.audit_event_ledger.data);
  const auditRecordCount = effectiveAuditRecordCount(audit);
  return [
    chainStage({
      generatedAt,
      stageId: "matter",
      label: "Matter context",
      sourceId: "law_firm_e2e_freeze",
      passed: freeze.law_firm_e2e_freeze_status === "complete" && (freeze.matter_count ?? 0) >= 1 && (freeze.representative_matter_gate_passed_count ?? 0) === (freeze.path_count ?? 0),
      recordCount: freeze.matter_count ?? 0,
      linkCount: freeze.representative_matter_gate_passed_count ?? 0,
      evidence: "Representative law-firm paths preserve matter_id scoped context.",
    }),
    chainStage({
      generatedAt,
      stageId: "resource",
      label: "Resource contract",
      sourceId: "resource_contract_freeze",
      passed: resource.freeze_status === "complete" && (resource.resource_count ?? 0) > 0 && (resource.matter_link_count ?? 0) > 0 && (backup.backup_restore_drill_status === "complete"),
      recordCount: resource.resource_count ?? 0,
      linkCount: resource.matter_link_count ?? 0,
      evidence: "Resource contract freeze keeps matter-linked, hashed resources available after P304 backup/restore baseline.",
    }),
    chainStage({
      generatedAt,
      stageId: "evidence",
      label: "Evidence lineage",
      sourceId: "evidence_contract_freeze",
      passed: evidence.freeze_status === "complete" && (evidence.evidence_item_count ?? 0) > 0 && (evidence.complete_lineage_path_count ?? 0) > 0 && (evidence.broken_lineage_path_count ?? 1) === 0,
      recordCount: evidence.evidence_item_count ?? 0,
      linkCount: evidence.complete_lineage_path_count ?? 0,
      evidence: "Evidence contract freeze keeps resource-linked source spans, evidence items, and complete lineage paths.",
    }),
    chainStage({
      generatedAt,
      stageId: "draft",
      label: "Draft output",
      sourceId: "ldd_report_draft",
      passed: draft.ldd_report_draft_status === "complete" && (draft.paragraph_count ?? 0) > 0 && (draft.draft_only_count ?? 0) === (draft.paragraph_count ?? -1) && (draft.client_facing_ready_count ?? 1) === 0,
      recordCount: draft.paragraph_count ?? 0,
      linkCount: draft.paragraph_with_issue_link_count ?? 0,
      evidence: "LDD report draft is deterministic draft-only work product with human review notes and no client-facing readiness.",
    }),
    chainStage({
      generatedAt,
      stageId: "citation",
      label: "Citation binding",
      sourceId: "citation_object_store",
      passed: citation.citation_object_store_status === "complete" && (citation.citation_count ?? 0) > 0 && (citation.source_span_bound_citation_count ?? 0) === (citation.citation_count ?? -1) && (citation.client_facing_ready_count ?? 1) === 0,
      recordCount: citation.citation_count ?? 0,
      linkCount: citation.source_span_bound_citation_count ?? 0,
      evidence: "Citation object store binds every citation to source spans while retaining review gating.",
    }),
    chainStage({
      generatedAt,
      stageId: "approval",
      label: "Human approval gate",
      sourceId: "legal_approval_matrix",
      passed: approval.legal_approval_matrix_status === "complete" && (approval.legal_approval_requirement_count ?? 0) > 0 && (approval.attorney_review_requirement_count ?? 0) > 0 && (approval.partner_approval_requirement_count ?? 0) > 0 && (approval.approval_decision_recorded_count ?? 1) === 0,
      recordCount: approval.legal_approval_requirement_count ?? 0,
      linkCount: approval.legal_approval_gate_link_count ?? 0,
      evidence: "Legal approval matrix links draft outputs to attorney and partner approval requirements without recording decisions.",
    }),
    chainStage({
      generatedAt,
      stageId: "audit",
      label: "Audit ledger",
      sourceId: "audit_event_ledger",
      passed: audit.audit_event_ledger_status === "complete" && (audit.validation_error_count ?? 0) === 0,
      recordCount: auditRecordCount,
      linkCount: audit.human_review_required_audit_record_count ?? 0,
      evidence: "Audit event ledger separates audit records from observability and records human-review/protected-action context.",
    }),
  ];
}

function buildScenarioRows(sources, chainStages, generatedAt) {
  const freezeArtifact = sources.law_firm_e2e_freeze.data ?? {};
  const paths = Array.isArray(freezeArtifact.law_firm_e2e_paths) ? freezeArtifact.law_firm_e2e_paths : [];
  const allStagesPassed = chainStages.every((stage) => stage.stage_status === "passed");
  return paths.map((pathRow, index) => {
    const row = {
      schema_version: "law-firm-e2e-scenario-row.v1",
      law_firm_e2e_scenario_id: `law-firm-e2e.scenario.${pathRow.path_kind ?? index + 1}`,
      ordinal: index + 1,
      phase_slot: PHASE_SLOT,
      scenario_kind: pathRow.path_kind ?? "representative_law_firm_workflow",
      matter_id: pathRow.matter_id ?? null,
      output_artifact_id: pathRow.output_artifact_id ?? null,
      chain_stages: REQUIRED_CHAIN_STAGES,
      matter_gate_passed: pathRow.matter_gate_passed === true,
      resource_gate_passed: chainStages.some((stage) => stage.chain_stage === "resource" && stage.stage_status === "passed"),
      evidence_gate_passed: pathRow.evidence_gate_passed === true,
      draft_gate_passed: chainStages.some((stage) => stage.chain_stage === "draft" && stage.stage_status === "passed"),
      citation_gate_passed: pathRow.citation_gate_passed === true,
      approval_gate_passed: pathRow.approval_gate_passed === true,
      audit_gate_passed: chainStages.some((stage) => stage.chain_stage === "audit" && stage.stage_status === "passed"),
      human_review_required: pathRow.human_review_required === true,
      attorney_review_required: pathRow.attorney_review_required === true,
      partner_approval_required_before_client_use: pathRow.partner_approval_required_before_client_use === true,
      approval_decision_recorded: false,
      legal_advice_generated: false,
      legal_conclusion_asserted: false,
      client_facing_output_generated: false,
      mutation_performed: false,
      scenario_status: allStagesPassed && pathRow.path_status === "passed" && pathRow.matter_gate_passed && pathRow.evidence_gate_passed && pathRow.citation_gate_passed && pathRow.approval_gate_passed ? "passed" : "failed",
      generated_at: generatedAt,
    };
    return { ...row, scenario_hash: sha256(row) };
  });
}

function buildGateResults(sourceStatuses, scenarioRows, chainStages, generatedAt) {
  const gates = [
    gateResult("sources", "All required source artifacts are readable and complete.", sourceStatuses.every((row) => row.source_status === "passed"), generatedAt),
    gateResult("scenario_chain", "Representative law-firm scenarios pass matter->resource->evidence->draft->citation->approval->audit.", scenarioRows.length > 0 && scenarioRows.every((row) => row.scenario_status === "passed"), generatedAt),
    gateResult("chain_stages", "Every required chain stage is present and passed.", REQUIRED_CHAIN_STAGES.every((stageId) => chainStages.some((stage) => stage.chain_stage === stageId && stage.stage_status === "passed")), generatedAt),
    gateResult("human_review", "Legal and client-facing outputs remain human reviewed and attorney/partner gated.", scenarioRows.every((row) => row.human_review_required && row.attorney_review_required && row.partner_approval_required_before_client_use), generatedAt),
    gateResult("no_client_output", "No legal advice, legal conclusion, approval decision, mutation, or client-facing output is generated.", scenarioRows.every((row) => !row.legal_advice_generated && !row.legal_conclusion_asserted && !row.client_facing_output_generated && !row.approval_decision_recorded && !row.mutation_performed), generatedAt),
  ];
  return gates.map((gate, index) => ({ ...gate, ordinal: index + 1 }));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "law-firm-e2e-report-boundary.v1",
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    deterministic_report: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    matter_data_write_performed: false,
    resource_write_performed: false,
    evidence_write_performed: false,
    draft_write_performed: false,
    citation_write_performed: false,
    approval_decision_recorded: false,
    audit_write_performed: false,
    workflow_transition_performed: false,
    runtime_execution_performed: false,
    delivery_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    protected_action_executed: false,
    external_transfer_performed: false,
    network_access_performed: false,
    legal_advice_generated: false,
    legal_conclusion_asserted: false,
    client_facing_output_generated: false,
    human_review_required: true,
    attorney_review_required: true,
    partner_approval_required_before_client_use: true,
    client_facing_ready: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    generated_at: generatedAt,
  };
}

function buildValidationItems({ sources, support, sourceStatuses, chainStages, scenarioRows, gateResults, boundary }) {
  const packageJson = support.package_json.data ?? {};
  const finalLedgerText = support.final_completion_ledger.text ?? "";
  const implementationRoadmapText = support.implementation_roadmap.text ?? "";
  const dashboardText = support.review_dashboard_source.text ?? "";
  const apiText = support.review_api_source.text ?? "";
  const apiDocText = support.review_api_doc.text ?? "";
  const loopText = support.control_plane_loop_source.text ?? "";
  const sourceReadErrors = Object.values(sources).filter((source) => source.error).map((source) => source.error);
  return [
    validationItem("phase_linkage", boundary.phase_slot === PHASE_SLOT && sourceStatuses.some((row) => row.source_id === "backup_restore_drill" && row.actual_phase_slot === PREVIOUS_PHASE_SLOT && row.actual_next_phase_slot === PHASE_SLOT), "P305 links directly after the P304 backup/restore baseline."),
    validationItem("sources_passed", sourceStatuses.every((row) => row.source_status === "passed"), "All required P305 source artifacts are readable and complete."),
    validationItem("scenario_rows_passed", scenarioRows.length > 0 && scenarioRows.every((row) => row.scenario_status === "passed"), "Representative law-firm E2E scenario rows pass."),
    validationItem("chain_stages_passed", REQUIRED_CHAIN_STAGES.every((stageId) => chainStages.some((stage) => stage.chain_stage === stageId && stage.stage_status === "passed")), "Matter, resource, evidence, draft, citation, approval, and audit stages all pass."),
    validationItem("gate_results_passed", gateResults.every((row) => row.gate_status === "passed"), "P305 gate results all pass."),
    validationItem("boundary_enforced", boundary.boundary_status === "enforced" && boundary.read_only && boundary.report_only && !boundary.workflow_transition_performed && !boundary.runtime_execution_performed && !boundary.client_facing_output_generated, "P305 remains read-only/report-only with no execution, mutation, or client-facing output."),
    validationItem("human_review_preserved", boundary.human_review_required && boundary.attorney_review_required && boundary.partner_approval_required_before_client_use && scenarioRows.every((row) => row.human_review_required && row.attorney_review_required), "Human review, attorney review, and partner approval gates are preserved."),
    validationItem("support_sources_read", !support.package_json.error && !support.final_completion_ledger.error && !support.implementation_roadmap.error && !support.review_dashboard_source.error && !support.review_api_source.error && !support.review_api_doc.error && !support.control_plane_loop_source.error && sourceReadErrors.length === 0, "All support contracts and source artifacts are readable."),
    validationItem("package_script_registered", Boolean(packageJson.scripts?.["law-firm:e2e-report"]), "package.json registers law-firm:e2e-report."),
    validationItem("ledger_slot_present", finalLedgerText.includes("P305") && finalLedgerText.includes("law-firm E2E"), "Final completion ledger keeps the P305 law-firm E2E slot."),
    validationItem("roadmap_phase_present", implementationRoadmapText.includes("Phase 305") && implementationRoadmapText.includes("Law Firm E2E Report"), "Implementation roadmap records Phase 305 Law Firm E2E Report."),
    validationItem("dashboard_registered", dashboardText.includes("lawFirmE2eReportPath") && dashboardText.includes("buildLawFirmE2eReportStage"), "Review Dashboard declares the law_firm_e2e_report source and stage."),
    validationItem("review_api_registered", apiText.includes("/api/law-firm-e2e-reports") && apiText.includes("law_firm_e2e_report"), "Review API exposes Law Firm E2E Report routes."),
    validationItem("review_api_doc_registered", apiDocText.includes("/api/law-firm-e2e-reports") && apiDocText.includes("Law Firm E2E Report"), "Review API docs include Law Firm E2E Report routes."),
    validationItem("control_plane_loop_registered", loopText.includes("law_firm_e2e_report") && loopText.includes("law-firm:e2e-report"), "Control Plane Loop declares the law_firm_e2e_report step."),
  ];
}

function buildSummary({ sourceStatuses, chainStages, scenarioRows, gateResults, boundary, validationItems, validation, sources }) {
  const freeze = summaryOf(sources.law_firm_e2e_freeze.data);
  const resource = summaryOf(sources.resource_contract_freeze.data);
  const evidence = summaryOf(sources.evidence_contract_freeze.data);
  const draft = summaryOf(sources.ldd_report_draft.data);
  const citation = summaryOf(sources.citation_object_store.data);
  const approval = summaryOf(sources.legal_approval_matrix.data);
  const audit = summaryOf(sources.audit_event_ledger.data);
  const auditRecordCount = effectiveAuditRecordCount(audit);
  return {
    schema_version: "law-firm-e2e-report-summary.v1",
    law_firm_e2e_report_status: validation.valid ? "complete" : "blocked",
    law_firm_e2e_report_id: null,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((row) => row.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((row) => row.source_status !== "passed").length,
    source_backup_restore_drill_status: sourceStatuses.find((row) => row.source_id === "backup_restore_drill")?.actual_status ?? "unknown",
    source_backup_restore_drill_phase_slot: sourceStatuses.find((row) => row.source_id === "backup_restore_drill")?.actual_phase_slot ?? null,
    source_backup_restore_drill_next_phase_slot: sourceStatuses.find((row) => row.source_id === "backup_restore_drill")?.actual_next_phase_slot ?? null,
    scenario_row_count: scenarioRows.length,
    passed_scenario_row_count: scenarioRows.filter((row) => row.scenario_status === "passed").length,
    failed_scenario_row_count: scenarioRows.filter((row) => row.scenario_status !== "passed").length,
    chain_stage_count: chainStages.length,
    passed_chain_stage_count: chainStages.filter((row) => row.stage_status === "passed").length,
    failed_chain_stage_count: chainStages.filter((row) => row.stage_status !== "passed").length,
    matter_stage_passed_count: countStage(chainStages, "matter"),
    resource_stage_passed_count: countStage(chainStages, "resource"),
    evidence_stage_passed_count: countStage(chainStages, "evidence"),
    draft_stage_passed_count: countStage(chainStages, "draft"),
    citation_stage_passed_count: countStage(chainStages, "citation"),
    approval_stage_passed_count: countStage(chainStages, "approval"),
    audit_stage_passed_count: countStage(chainStages, "audit"),
    matter_to_audit_path_complete: REQUIRED_CHAIN_STAGES.every((stageId) => chainStages.some((stage) => stage.chain_stage === stageId && stage.stage_status === "passed")) && scenarioRows.every((row) => row.scenario_status === "passed"),
    representative_path_count: freeze.path_count ?? 0,
    representative_matter_gate_passed_count: freeze.representative_matter_gate_passed_count ?? 0,
    representative_evidence_gate_passed_count: freeze.representative_evidence_gate_passed_count ?? 0,
    representative_citation_gate_passed_count: freeze.representative_citation_gate_passed_count ?? 0,
    representative_approval_gate_passed_count: freeze.representative_approval_gate_passed_count ?? 0,
    matter_count: freeze.matter_count ?? 0,
    resource_count: resource.resource_count ?? 0,
    evidence_item_count: evidence.evidence_item_count ?? 0,
    complete_lineage_path_count: evidence.complete_lineage_path_count ?? 0,
    broken_lineage_path_count: evidence.broken_lineage_path_count ?? 0,
    draft_paragraph_count: draft.paragraph_count ?? 0,
    draft_only_count: draft.draft_only_count ?? 0,
    citation_count: citation.citation_count ?? 0,
    source_span_bound_citation_count: citation.source_span_bound_citation_count ?? 0,
    approval_requirement_count: approval.legal_approval_requirement_count ?? 0,
    approval_gate_link_count: approval.legal_approval_gate_link_count ?? 0,
    attorney_review_requirement_count: approval.attorney_review_requirement_count ?? 0,
    partner_approval_requirement_count: approval.partner_approval_requirement_count ?? 0,
    audit_trail_record_count: auditRecordCount,
    separated_audit_record_count: audit.separated_audit_record_count ?? 0,
    human_review_required_audit_record_count: audit.human_review_required_audit_record_count ?? 0,
    protected_action_executed_audit_record_count: audit.protected_action_executed_audit_record_count ?? 0,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.filter((row) => row.gate_status === "passed").length,
    failed_gate_result_count: gateResults.filter((row) => row.gate_status !== "passed").length,
    gate_violation_count: gateResults.filter((row) => row.gate_status !== "passed").length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_content_read_performed: boundary.source_content_read_performed,
    source_ingest_performed: boundary.source_ingest_performed,
    matter_data_write_performed: boundary.matter_data_write_performed,
    resource_write_performed: boundary.resource_write_performed,
    evidence_write_performed: boundary.evidence_write_performed,
    draft_write_performed: boundary.draft_write_performed,
    citation_write_performed: boundary.citation_write_performed,
    approval_decision_recorded: boundary.approval_decision_recorded,
    audit_write_performed: boundary.audit_write_performed,
    workflow_transition_performed: boundary.workflow_transition_performed,
    runtime_execution_performed: boundary.runtime_execution_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    protected_action_executed: boundary.protected_action_executed,
    external_transfer_performed: boundary.external_transfer_performed,
    network_access_performed: boundary.network_access_performed,
    legal_advice_generated: boundary.legal_advice_generated,
    legal_conclusion_asserted: boundary.legal_conclusion_asserted,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    attorney_review_required: boundary.attorney_review_required,
    partner_approval_required_before_client_use: boundary.partner_approval_required_before_client_use,
    client_facing_ready: boundary.client_facing_ready,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validationItems.length,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function chainStage({ generatedAt, stageId, label, sourceId, passed, recordCount, linkCount, evidence }) {
  const row = {
    schema_version: "law-firm-e2e-chain-stage.v1",
    chain_stage_id: `law-firm-e2e.chain.${stageId}`,
    chain_stage: stageId,
    stage_label: label,
    source_id: sourceId,
    stage_status: passed ? "passed" : "failed",
    record_count: recordCount,
    link_count: linkCount,
    evidence,
    read_only: true,
    mutation_performed: false,
    human_review_required: true,
    generated_at: generatedAt,
  };
  return { ...row, chain_stage_hash: sha256(row) };
}

function gateResult(gateId, message, passed, generatedAt) {
  const row = {
    schema_version: "law-firm-e2e-gate-result.v1",
    gate_result_id: `law-firm-e2e.gate.${gateId}`,
    gate_id: gateId,
    gate_status: passed ? "passed" : "failed",
    gate_violation: !passed,
    message,
    generated_at: generatedAt,
  };
  return { ...row, gate_result_hash: sha256(row) };
}

function validationItem(checkId, passed, message) {
  return {
    schema_version: "law-firm-e2e-validation-item.v1",
    validation_id: `law-firm-e2e.validation.${checkId}`,
    check_id: checkId,
    path: checkId,
    status: passed ? "passed" : "failed",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({
    path: item.path,
    message: item.message,
    status: item.status,
  }));
  return {
    valid: errors.length === 0,
    errors,
    items,
  };
}

function renderMarkdown(result) {
  const lines = [];
  lines.push("# Law Firm E2E Report");
  lines.push("");
  lines.push(`Status: ${result.summary.law_firm_e2e_report_status}`);
  lines.push(`Phase: ${PHASE_SLOT} after ${PREVIOUS_PHASE_SLOT}`);
  lines.push(`Scenario rows: ${result.summary.passed_scenario_row_count}/${result.summary.scenario_row_count}`);
  lines.push(`Chain stages: ${result.summary.passed_chain_stage_count}/${result.summary.chain_stage_count}`);
  lines.push(`Matter->audit complete: ${result.summary.matter_to_audit_path_complete}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("This report is read-only. It records no legal advice, legal conclusion, approval decision, workflow transition, delivery action, or client-facing output.");
  return lines.join("\n");
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function countStage(chainStages, stageId) {
  return chainStages.filter((stage) => stage.chain_stage === stageId && stage.stage_status === "passed").length;
}

function effectiveAuditRecordCount(audit) {
  return audit.audit_trail_record_count
    ?? audit.audit_event_v2_record_count
    ?? audit.access_audit_record_count
    ?? audit.approval_audit_record_count
    ?? audit.source_event_audit_run_audit_event_count
    ?? 0;
}

function summaryOf(data) {
  return data?.summary ?? data ?? {};
}

async function readJsonSource(filePath) {
  const absolutePath = path.resolve(filePath);
  try {
    const raw = await readFile(absolutePath, "utf8");
    return {
      path: filePath,
      absolute_path: absolutePath,
      available: true,
      data: JSON.parse(raw),
      content_hash: `sha256:${sha256(raw)}`,
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      absolute_path: absolutePath,
      available: false,
      data: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function readTextSource(filePath) {
  const absolutePath = path.resolve(filePath);
  try {
    const text = await readFile(absolutePath, "utf8");
    return {
      path: filePath,
      absolute_path: absolutePath,
      available: true,
      text,
      content_hash: `sha256:${sha256(text)}`,
      error: null,
    };
  } catch (error) {
    return {
      path: filePath,
      absolute_path: absolutePath,
      available: false,
      text: null,
      content_hash: null,
      error: error.message,
    };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  const merged = { ...DEFAULT_LAW_FIRM_E2E_REPORT_INPUTS, ...options };
  return Object.fromEntries(Object.entries(merged).map(([key, value]) => [camelToSnake(key), value]));
}

function camelToSnake(value) {
  return String(value).replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function sha256(value) {
  const normalized = typeof value === "string" ? value : JSON.stringify(value);
  return createHash("sha256").update(normalized).digest("hex");
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function runLawFirmE2eReportCli(argv = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      options.check = true;
      options.write = false;
    }
    else if (arg === "--out-dir") options.outDir = argv[++index];
    else if (arg === "--run-at") options.runAt = argv[++index];
  }
  const result = await runLawFirmE2eReport(options);
  console.log(`Law firm E2E report written to ${result.output_dir}`);
  console.log(`Status: ${result.summary.law_firm_e2e_report_status}`);
  console.log(`Scenario rows: ${result.summary.passed_scenario_row_count}/${result.summary.scenario_row_count}`);
  console.log(`Chain stages: ${result.summary.passed_chain_stage_count}/${result.summary.chain_stage_count}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}
