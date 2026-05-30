import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_CREATIVE_DOCUMENT_E2E_REPORT_OUT_DIR = "artifacts/creative-document-e2e-report/latest";
export const DEFAULT_CREATIVE_DOCUMENT_E2E_REPORT_INPUTS = {
  personalDevE2eReportPath: "artifacts/personal-dev-e2e-report/latest/personal-dev-e2e-report.json",
  creativeDocumentFreezePath: "artifacts/creative-document-freeze/latest/creative-document-freeze.json",
  templateRegistryPath: "artifacts/template-registry/latest/template-registry.json",
  docxRendererPath: "artifacts/docx-renderer/latest/docx-renderer.json",
  pptxRendererPath: "artifacts/pptx-renderer/latest/pptx-renderer.json",
  pdfHtmlRendererPath: "artifacts/pdf-html-renderer/latest/pdf-html-renderer.json",
  layoutValidatorPath: "artifacts/layout-validator/latest/layout-validator.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  outputDeliveryContractFreezePath: "artifacts/output-delivery-contract-freeze/latest/output-delivery-contract-freeze.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "creative-document-e2e-report.v1";
const CAPABILITY_ID = "creative_document.e2e.report";
const PHASE_SLOT = "P307";
const PREVIOUS_PHASE_SLOT = "P306";
const NEXT_PHASE_SLOT = "P308";
const REQUIRED_CHAIN_STAGES = ["template", "render", "layout", "approval", "output_artifact"];

const SOURCE_DEFINITIONS = [
  sourceDefinition("personal_dev_e2e_report", "Personal Dev E2E Report", "personal_dev_e2e_report_status", "complete", "P306", "P307"),
  sourceDefinition("creative_document_freeze", "Creative Document Freeze", "creative_document_freeze_status", "complete", null, null),
  sourceDefinition("template_registry", "Template Registry", "template_registry_status", "complete", null, null),
  sourceDefinition("docx_renderer", "DOCX Renderer", "docx_renderer_status", "complete", null, null),
  sourceDefinition("pptx_renderer", "PPTX Renderer", "pptx_renderer_status", "complete", null, null),
  sourceDefinition("pdf_html_renderer", "PDF/HTML Renderer", "pdf_html_renderer_status", "complete", null, null),
  sourceDefinition("layout_validator", "Layout Validator", "layout_validator_status", "complete", null, null),
  sourceDefinition("gate_approval_contract_freeze", "Gate Approval Contract Freeze", "freeze_status", "complete", null, null),
  sourceDefinition("output_delivery_contract_freeze", "Output Delivery Contract Freeze", "freeze_status", "complete", null, null),
];

export async function runCreativeDocumentE2eReport(options = {}) {
  const result = await buildCreativeDocumentE2eReport(options);
  if (options.write !== false) await writeCreativeDocumentE2eReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Creative document E2E report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildCreativeDocumentE2eReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_CREATIVE_DOCUMENT_E2E_REPORT_OUT_DIR);
  const reportId = `creative-document-e2e-report.${dateStamp(generatedAt)}`;
  const inputs = normalizeInputs(options);
  const sources = {
    personal_dev_e2e_report: await readJsonSource(inputs.personal_dev_e2e_report_path),
    creative_document_freeze: await readJsonSource(inputs.creative_document_freeze_path),
    template_registry: await readJsonSource(inputs.template_registry_path),
    docx_renderer: await readJsonSource(inputs.docx_renderer_path),
    pptx_renderer: await readJsonSource(inputs.pptx_renderer_path),
    pdf_html_renderer: await readJsonSource(inputs.pdf_html_renderer_path),
    layout_validator: await readJsonSource(inputs.layout_validator_path),
    gate_approval_contract_freeze: await readJsonSource(inputs.gate_approval_contract_freeze_path),
    output_delivery_contract_freeze: await readJsonSource(inputs.output_delivery_contract_freeze_path),
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
  const scenarioRows = buildScenarioRows(chainStages, generatedAt);
  const gateResults = buildGateResults(sourceStatuses, scenarioRows, chainStages, generatedAt);
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({ sources, support, sourceStatuses, chainStages, scenarioRows, gateResults, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sources, sourceStatuses, chainStages, scenarioRows, gateResults, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    creative_document_e2e_report_id: reportId,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    creative_document_e2e_report_contract: buildContract(generatedAt),
    creative_document_e2e_scenario_rows: scenarioRows,
    creative_document_e2e_chain_stages: chainStages,
    creative_document_e2e_gate_results: gateResults,
    creative_document_e2e_report_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary: {
      ...summary,
      creative_document_e2e_report_id: reportId,
    },
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writeCreativeDocumentE2eReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "creative-document-e2e-report.json"), serializable);
  await writeJson(path.join(outDir, "creative-document-e2e-sources.json"), collectionEnvelope("creative-document-e2e-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "creative-document-e2e-scenario-rows.json"), collectionEnvelope("creative-document-e2e-scenario-rows.v1", "creative_document_e2e_scenario_rows", result.creative_document_e2e_scenario_rows, result.generated_at));
  await writeJson(path.join(outDir, "creative-document-e2e-chain-stages.json"), collectionEnvelope("creative-document-e2e-chain-stages.v1", "creative_document_e2e_chain_stages", result.creative_document_e2e_chain_stages, result.generated_at));
  await writeJson(path.join(outDir, "creative-document-e2e-gate-results.json"), collectionEnvelope("creative-document-e2e-gate-results.v1", "creative_document_e2e_gate_results", result.creative_document_e2e_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "creative-document-e2e-report-boundary.json"), result.creative_document_e2e_report_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "creative-document-e2e-report-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildContract(generatedAt) {
  return {
    schema_version: "creative-document-e2e-report-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    scenario: "template_to_render_to_layout_to_approval_to_output_artifact",
    source_of_truth: "creative_document_e2e_report_phase_artifacts",
    execution_model: "deterministic_read_only_report",
    human_review_rule: "creative and document outputs remain draft-only, approval-gated, and not client-facing",
    windows_baseline_rule: "P307 is valid only after the P306 Windows baseline stability posture is preserved",
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
    const failedCheckpointCount = summary.failed_checkpoint_count ?? summary.failed_validation_item_count ?? 0;
    const phaseMatches = definition.expected_phase_slot === null || actualPhaseSlot === definition.expected_phase_slot;
    const nextPhaseMatches = definition.expected_next_phase_slot === null || actualNextPhaseSlot === definition.expected_next_phase_slot;
    const row = {
      schema_version: "creative-document-e2e-source-status.v1",
      source_status_id: `creative-document-e2e.source.${definition.source_id}`,
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
      failed_checkpoint_count: failedCheckpointCount,
      source_status: source?.available && actualStatus === definition.expected_status && phaseMatches && nextPhaseMatches && validationErrorCount === 0 && failedCheckpointCount === 0 ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildChainStages(sources, generatedAt) {
  const template = summaryOf(sources.template_registry.data);
  const freeze = summaryOf(sources.creative_document_freeze.data);
  const docx = summaryOf(sources.docx_renderer.data);
  const pptx = summaryOf(sources.pptx_renderer.data);
  const pdfHtml = summaryOf(sources.pdf_html_renderer.data);
  const layout = summaryOf(sources.layout_validator.data);
  const approval = summaryOf(sources.gate_approval_contract_freeze.data);
  const output = summaryOf(sources.output_delivery_contract_freeze.data);
  const renderJobCount = (docx.docx_render_job_count ?? 0) + (pptx.pptx_render_job_count ?? 0) + (pdfHtml.pdf_html_render_job_count ?? 0);
  const completedRenderJobCount = (docx.completed_render_job_count ?? 0) + (pptx.completed_render_job_count ?? 0) + (pdfHtml.completed_render_job_count ?? 0);
  const renderedOutputArtifactCount = (docx.docx_output_artifact_count ?? 0) + (pptx.pptx_output_artifact_count ?? 0) + (pdfHtml.pdf_html_output_artifact_count ?? 0);
  const formatValidationCount = (docx.docx_format_validation_result_count ?? 0) + (pptx.pptx_format_validation_result_count ?? 0) + (pdfHtml.pdf_html_format_validation_result_count ?? 0);
  const passedFormatValidationCount = (docx.passed_format_validation_result_count ?? 0) + (pptx.passed_format_validation_result_count ?? 0) + (pdfHtml.passed_format_validation_result_count ?? 0);
  return [
    chainStage({
      generatedAt,
      stageId: "template",
      label: "Template registry",
      sourceId: "template_registry",
      passed: template.template_registry_status === "complete"
        && (template.template_count ?? 0) >= 1
        && (template.registered_template_count ?? 0) === (template.template_count ?? -1)
        && (template.covered_format_count ?? 0) >= 4
        && (template.human_review_required_template_count ?? 0) === (template.template_count ?? -1)
        && template.template_file_write_allowed === false,
      recordCount: template.template_count ?? 0,
      linkCount: template.pack_binding_count ?? 0,
      evidence: "Registered DOCX/PPTX/HTML/email templates are metadata-only, format-covered, and human-review gated.",
    }),
    chainStage({
      generatedAt,
      stageId: "render",
      label: "Deterministic render",
      sourceId: "docx_renderer,pptx_renderer,pdf_html_renderer",
      passed: docx.docx_renderer_status === "complete"
        && pptx.pptx_renderer_status === "complete"
        && pdfHtml.pdf_html_renderer_status === "complete"
        && renderJobCount > 0
        && completedRenderJobCount === renderJobCount
        && renderedOutputArtifactCount > 0
        && passedFormatValidationCount === formatValidationCount
        && docx.external_renderer_execution_performed === false
        && pptx.external_renderer_execution_performed === false
        && pdfHtml.external_renderer_execution_performed === false
        && docx.delivery_execution_performed === false
        && pptx.delivery_execution_performed === false
        && pdfHtml.delivery_execution_performed === false,
      recordCount: renderJobCount,
      linkCount: renderedOutputArtifactCount,
      evidence: "DOCX, PPTX, HTML, and PDF draft outputs exist with passed format checks and no external renderer or delivery execution.",
    }),
    chainStage({
      generatedAt,
      stageId: "layout",
      label: "Layout validation",
      sourceId: "layout_validator",
      passed: layout.layout_validator_status === "complete"
        && (layout.layout_validation_result_count ?? 0) > 0
        && layout.passed_layout_validation_result_count === layout.layout_validation_result_count
        && (layout.failed_layout_validation_result_count ?? 1) === 0
        && layout.layout_validation_report_only === true
        && layout.delivery_execution_performed === false,
      recordCount: layout.layout_validation_result_count ?? 0,
      linkCount: layout.layout_target_count ?? 0,
      evidence: "Rendered outputs pass page, overflow, and broken-table layout checks without runtime or delivery execution.",
    }),
    chainStage({
      generatedAt,
      stageId: "approval",
      label: "Approval gate",
      sourceId: "gate_approval_contract_freeze",
      passed: approval.freeze_status === "complete"
        && (approval.approval_request_count ?? 0) > 0
        && (approval.gate_result_count ?? 0) > 0
        && (approval.separated_approval_request_count ?? 0) === (approval.approval_request_count ?? -1)
        && (approval.validation_error_count ?? 0) === 0
        && (approval.failed_validation_item_count ?? 0) === 0
        && (freeze.passed_path_count ?? 0) === (freeze.path_count ?? -1),
      recordCount: approval.approval_request_count ?? 0,
      linkCount: approval.output_approval_request_count ?? 0,
      evidence: "Creative/document output approvals remain separated, pending, and human-review gated.",
    }),
    chainStage({
      generatedAt,
      stageId: "output_artifact",
      label: "Output artifact boundary",
      sourceId: "output_delivery_contract_freeze",
      passed: output.freeze_status === "complete"
        && (output.validation_error_count ?? 0) === 0
        && (output.failed_validation_item_count ?? 0) === 0,
      recordCount: output.output_artifact_count ?? 0,
      linkCount: freeze.draft_output_artifact_count ?? 0,
      evidence: "Output artifact rows are linked and draft-only while all delivery actions remain blocked or pending approval.",
    }),
  ];
}

function buildScenarioRows(chainStages, generatedAt) {
  const stageById = new Map(chainStages.map((stage) => [stage.chain_stage, stage]));
  const row = {
    schema_version: "creative-document-e2e-scenario-row.v1",
    creative_document_e2e_scenario_id: "creative-document-e2e.scenario.template-render-layout-approval-output-artifact",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    scenario_kind: "creative_document_template_render_layout_approval_output_artifact",
    template_gate_passed: stageById.get("template")?.stage_status === "passed",
    render_gate_passed: stageById.get("render")?.stage_status === "passed",
    layout_gate_passed: stageById.get("layout")?.stage_status === "passed",
    approval_gate_passed: stageById.get("approval")?.stage_status === "passed",
    output_artifact_gate_passed: stageById.get("output_artifact")?.stage_status === "passed",
    human_review_required: true,
    approval_required_before_delivery: true,
    template_mutation_performed: false,
    style_mutation_performed: false,
    asset_mutation_performed: false,
    source_artifact_mutation_performed: false,
    renderer_execution_performed: false,
    external_renderer_execution_performed: false,
    document_runtime_mutation_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    mutation_performed: false,
    generated_at: generatedAt,
  };
  row.scenario_status = REQUIRED_CHAIN_STAGES.every((stage) => stageById.get(stage)?.stage_status === "passed") ? "passed" : "failed";
  row.scenario_hash = sha256(row);
  return [row];
}

function buildGateResults(sourceStatuses, scenarioRows, chainStages, generatedAt) {
  return [
    gateResult("source_integrity", "Source integrity", sourceStatuses.every((source) => source.source_status === "passed"), "P306 baseline and creative-document sources are available and validation-clean.", generatedAt),
    gateResult("template_render_layout", "Template/render/layout chain", REQUIRED_CHAIN_STAGES.slice(0, 3).every((stage) => chainStages.find((row) => row.chain_stage === stage)?.stage_status === "passed"), "Template, render, and layout stages pass.", generatedAt),
    gateResult("approval_output_boundary", "Approval/output boundary", REQUIRED_CHAIN_STAGES.slice(3).every((stage) => chainStages.find((row) => row.chain_stage === stage)?.stage_status === "passed"), "Approval and output artifact stages remain human-review and delivery gated.", generatedAt),
    gateResult("scenario_path", "Scenario path", scenarioRows.every((row) => row.scenario_status === "passed"), "Representative template-to-output artifact scenario passes.", generatedAt),
    gateResult("no_client_delivery", "No client delivery", scenarioRows.every((row) => !row.delivery_execution_performed && !row.client_facing_output_generated && !row.protected_action_executed), "No delivery, protected action, legal advice, or client-facing output is generated.", generatedAt),
  ];
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "creative-document-e2e-report-boundary.v1",
    boundary_id: "creative-document-e2e-report.boundary",
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    deterministic: true,
    source_artifact_read_performed: true,
    source_artifact_mutation_performed: false,
    template_mutation_performed: false,
    style_mutation_performed: false,
    asset_mutation_performed: false,
    renderer_execution_performed: false,
    external_renderer_execution_performed: false,
    document_runtime_mutation_performed: false,
    workflow_transition_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    approval_required_before_delivery: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    generated_at: generatedAt,
  };
}

function buildValidationItems({ sources, support, sourceStatuses, chainStages, scenarioRows, gateResults, boundary }) {
  const packageScripts = support.package_json?.data?.scripts ?? {};
  const ledgerText = support.final_completion_ledger?.text ?? "";
  const roadmapText = support.implementation_roadmap?.text ?? "";
  const dashboardText = support.review_dashboard_source?.text ?? "";
  const apiText = support.review_api_source?.text ?? "";
  const apiDocText = support.review_api_doc?.text ?? "";
  const loopText = support.control_plane_loop_source?.text ?? "";
  const previous = summaryOf(sources.personal_dev_e2e_report.data);
  return [
    validationItem("previous_phase_baseline", previous.personal_dev_e2e_report_status === "complete" && previous.phase_slot === PREVIOUS_PHASE_SLOT && previous.next_phase_slot === PHASE_SLOT, "P306 Personal Dev E2E Report is the accepted previous Windows baseline."),
    validationItem("source_statuses_passed", sourceStatuses.every((source) => source.source_status === "passed"), "All P307 source artifacts are available and validation-clean."),
    validationItem("chain_stages_passed", chainStages.length === REQUIRED_CHAIN_STAGES.length && chainStages.every((stage) => stage.stage_status === "passed"), "template->render->layout->approval->output artifact chain stages pass."),
    validationItem("scenario_rows_passed", scenarioRows.length >= 1 && scenarioRows.every((row) => row.scenario_status === "passed"), "Representative creative-document E2E scenario rows pass."),
    validationItem("gate_results_passed", gateResults.every((gate) => gate.gate_status === "passed" && gate.gate_violation === false), "All P307 E2E gate results pass."),
    validationItem("boundary_enforced", boundary.boundary_status === "enforced" && boundary.read_only && boundary.report_only && !boundary.delivery_execution_performed && !boundary.client_facing_output_generated, "P307 boundary is read-only/report-only with no delivery or client-facing output."),
    validationItem("package_script_registered", Boolean(packageScripts["creative-document:e2e-report"]), "package.json registers creative-document:e2e-report."),
    validationItem("ledger_phase_present", ledgerText.includes("| P307 |") && ledgerText.includes("creative-document E2E report"), "Final completion ledger records the P307 creative-document E2E report slot."),
    validationItem("roadmap_phase_present", roadmapText.includes("Phase 307") && roadmapText.includes("Creative Document E2E Report"), "Implementation roadmap records Phase 307 Creative Document E2E Report."),
    validationItem("dashboard_registered", dashboardText.includes("creativeDocumentE2eReportPath") && dashboardText.includes("buildCreativeDocumentE2eReportStage"), "Review Dashboard declares the creative_document_e2e_report source and stage."),
    validationItem("review_api_registered", apiText.includes("/api/creative-document-e2e-reports") && apiText.includes("creative_document_e2e_report"), "Review API exposes Creative Document E2E Report routes."),
    validationItem("review_api_doc_registered", apiDocText.includes("/api/creative-document-e2e-reports") && apiDocText.includes("Creative Document E2E Report"), "Review API docs include Creative Document E2E Report routes."),
    validationItem("control_plane_loop_registered", loopText.includes("creative_document_e2e_report") && loopText.includes("creative-document:e2e-report"), "Control Plane Loop declares the creative_document_e2e_report step."),
    validationItem("windows_stability_guard", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability and Mac/Windows completion-instability guards are preserved."),
  ];
}

function buildSummary({ sources, sourceStatuses, chainStages, scenarioRows, gateResults, boundary, validation }) {
  const personalDev = summaryOf(sources.personal_dev_e2e_report.data);
  const freeze = summaryOf(sources.creative_document_freeze.data);
  const template = summaryOf(sources.template_registry.data);
  const docx = summaryOf(sources.docx_renderer.data);
  const pptx = summaryOf(sources.pptx_renderer.data);
  const pdfHtml = summaryOf(sources.pdf_html_renderer.data);
  const layout = summaryOf(sources.layout_validator.data);
  const approval = summaryOf(sources.gate_approval_contract_freeze.data);
  const output = summaryOf(sources.output_delivery_contract_freeze.data);
  const stagePassedCount = (stage) => chainStages.filter((row) => row.chain_stage === stage && row.stage_status === "passed").length;
  const renderedOutputArtifactCount = (docx.docx_output_artifact_count ?? 0) + (pptx.pptx_output_artifact_count ?? 0) + (pdfHtml.pdf_html_output_artifact_count ?? 0);
  return {
    schema_version: "creative-document-e2e-report-summary.v1",
    creative_document_e2e_report_status: validation.valid ? "complete" : "blocked",
    creative_document_e2e_report_id: null,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_personal_dev_e2e_report_status: personalDev.personal_dev_e2e_report_status ?? "unknown",
    source_personal_dev_e2e_report_phase_slot: personalDev.phase_slot ?? null,
    source_personal_dev_e2e_report_next_phase_slot: personalDev.next_phase_slot ?? null,
    source_creative_document_freeze_status: freeze.creative_document_freeze_status ?? "unknown",
    source_creative_document_freeze_phase_range: freeze.phase_range ?? null,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((source) => source.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((source) => source.source_status !== "passed").length,
    scenario_row_count: scenarioRows.length,
    passed_scenario_row_count: scenarioRows.filter((row) => row.scenario_status === "passed").length,
    failed_scenario_row_count: scenarioRows.filter((row) => row.scenario_status !== "passed").length,
    chain_stage_count: chainStages.length,
    passed_chain_stage_count: chainStages.filter((stage) => stage.stage_status === "passed").length,
    failed_chain_stage_count: chainStages.filter((stage) => stage.stage_status !== "passed").length,
    template_stage_passed_count: stagePassedCount("template"),
    render_stage_passed_count: stagePassedCount("render"),
    layout_stage_passed_count: stagePassedCount("layout"),
    approval_stage_passed_count: stagePassedCount("approval"),
    output_artifact_stage_passed_count: stagePassedCount("output_artifact"),
    template_to_output_artifact_path_complete: REQUIRED_CHAIN_STAGES.every((stage) => stagePassedCount(stage) > 0),
    template_count: template.template_count ?? 0,
    covered_format_count: template.covered_format_count ?? 0,
    render_job_count: (docx.docx_render_job_count ?? 0) + (pptx.pptx_render_job_count ?? 0) + (pdfHtml.pdf_html_render_job_count ?? 0),
    rendered_output_artifact_count: renderedOutputArtifactCount,
    format_validation_result_count: (docx.docx_format_validation_result_count ?? 0) + (pptx.pptx_format_validation_result_count ?? 0) + (pdfHtml.pdf_html_format_validation_result_count ?? 0),
    passed_format_validation_result_count: (docx.passed_format_validation_result_count ?? 0) + (pptx.passed_format_validation_result_count ?? 0) + (pdfHtml.passed_format_validation_result_count ?? 0),
    layout_validation_result_count: layout.layout_validation_result_count ?? 0,
    passed_layout_validation_result_count: layout.passed_layout_validation_result_count ?? 0,
    failed_layout_validation_result_count: layout.failed_layout_validation_result_count ?? 0,
    approval_request_count: approval.approval_request_count ?? 0,
    output_approval_request_count: approval.output_approval_request_count ?? 0,
    pending_approval_request_count: approval.pending_approval_request_count ?? 0,
    output_delivery_artifact_count: output.output_artifact_count ?? 0,
    draft_output_artifact_count: freeze.draft_output_artifact_count ?? 0,
    source_output_delivery_executed_delivery_action_count: output.executed_delivery_action_count ?? 0,
    source_output_delivery_ready_delivery_action_count: output.ready_delivery_action_count ?? 0,
    executed_delivery_action_count: 0,
    ready_delivery_action_count: 0,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.filter((gate) => gate.gate_status === "passed").length,
    failed_gate_result_count: gateResults.filter((gate) => gate.gate_status !== "passed").length,
    gate_violation_count: gateResults.filter((gate) => gate.gate_violation).length,
    read_only: boundary.read_only,
    report_only: boundary.report_only,
    source_artifact_read_performed: boundary.source_artifact_read_performed,
    source_artifact_mutation_performed: boundary.source_artifact_mutation_performed,
    template_mutation_performed: boundary.template_mutation_performed,
    style_mutation_performed: boundary.style_mutation_performed,
    asset_mutation_performed: boundary.asset_mutation_performed,
    renderer_execution_performed: boundary.renderer_execution_performed,
    external_renderer_execution_performed: boundary.external_renderer_execution_performed,
    document_runtime_mutation_performed: boundary.document_runtime_mutation_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    protected_action_executed: boundary.protected_action_executed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    client_facing_ready: boundary.client_facing_ready,
    human_review_required: boundary.human_review_required,
    approval_required_before_delivery: boundary.approval_required_before_delivery,
    desktop_read_only: boundary.desktop_read_only,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validation.items.length,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function chainStage({ generatedAt, stageId, label, sourceId, passed, recordCount, linkCount, evidence }) {
  const row = {
    schema_version: "creative-document-e2e-chain-stage.v1",
    chain_stage_id: `creative-document-e2e.chain.${stageId}`,
    chain_stage: stageId,
    label,
    source_id: sourceId,
    phase_slot: PHASE_SLOT,
    stage_status: passed ? "passed" : "failed",
    record_count: recordCount,
    link_count: linkCount,
    read_only: true,
    mutation_performed: false,
    human_review_required: true,
    evidence,
    generated_at: generatedAt,
  };
  return { ...row, chain_stage_hash: sha256(row) };
}

function gateResult(gateId, label, passed, message, generatedAt) {
  const row = {
    schema_version: "creative-document-e2e-gate-result.v1",
    gate_result_id: `creative-document-e2e.gate.${gateId}`,
    gate_id: gateId,
    label,
    gate_status: passed ? "passed" : "failed",
    gate_violation: !passed,
    message,
    human_review_required: true,
    generated_at: generatedAt,
  };
  return { ...row, gate_result_hash: sha256(row) };
}

function validationItem(checkId, passed, message) {
  return {
    schema_version: "creative-document-e2e-validation-item.v1",
    validation_id: `creative-document-e2e.validation.${checkId}`,
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
  }));
  return { valid: errors.length === 0, errors, items };
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

function summaryOf(data) {
  return data?.summary ?? {};
}

async function readJsonSource(filePath) {
  const absolutePath = path.resolve(filePath);
  try {
    const text = await readFile(absolutePath, "utf8");
    return { available: true, path: absolutePath, content_hash: `sha256:${hashString(text)}`, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: absolutePath, content_hash: null, data: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const absolutePath = path.resolve(filePath);
  try {
    const text = await readFile(absolutePath, "utf8");
    return { available: true, path: absolutePath, content_hash: `sha256:${hashString(text)}`, text };
  } catch (error) {
    return { available: false, path: absolutePath, content_hash: null, text: "", error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_CREATIVE_DOCUMENT_E2E_REPORT_INPUTS;
  return {
    personal_dev_e2e_report_path: path.resolve(options.personalDevE2eReportPath ?? defaults.personalDevE2eReportPath),
    creative_document_freeze_path: path.resolve(options.creativeDocumentFreezePath ?? defaults.creativeDocumentFreezePath),
    template_registry_path: path.resolve(options.templateRegistryPath ?? defaults.templateRegistryPath),
    docx_renderer_path: path.resolve(options.docxRendererPath ?? defaults.docxRendererPath),
    pptx_renderer_path: path.resolve(options.pptxRendererPath ?? defaults.pptxRendererPath),
    pdf_html_renderer_path: path.resolve(options.pdfHtmlRendererPath ?? defaults.pdfHtmlRendererPath),
    layout_validator_path: path.resolve(options.layoutValidatorPath ?? defaults.layoutValidatorPath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? defaults.gateApprovalContractFreezePath),
    output_delivery_contract_freeze_path: path.resolve(options.outputDeliveryContractFreezePath ?? defaults.outputDeliveryContractFreezePath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    final_completion_ledger_path: path.resolve(options.finalCompletionLedgerPath ?? defaults.finalCompletionLedgerPath),
    implementation_roadmap_path: path.resolve(options.implementationRoadmapPath ?? defaults.implementationRoadmapPath),
    review_dashboard_source_path: path.resolve(options.reviewDashboardSourcePath ?? defaults.reviewDashboardSourcePath),
    review_api_source_path: path.resolve(options.reviewApiSourcePath ?? defaults.reviewApiSourcePath),
    review_api_doc_path: path.resolve(options.reviewApiDocPath ?? defaults.reviewApiDocPath),
    control_plane_loop_source_path: path.resolve(options.controlPlaneLoopSourcePath ?? defaults.controlPlaneLoopSourcePath),
  };
}

function renderMarkdown(result) {
  const lines = [];
  lines.push("# Creative Document E2E Report");
  lines.push("");
  lines.push(`Status: ${result.summary.creative_document_e2e_report_status}`);
  lines.push(`Phase: ${result.summary.phase_slot}`);
  lines.push(`Previous phase: ${result.summary.previous_phase_slot}`);
  lines.push(`Next phase: ${result.summary.next_phase_slot}`);
  lines.push("");
  lines.push("## Chain");
  for (const stage of result.creative_document_e2e_chain_stages) {
    lines.push(`- ${stage.chain_stage}: ${stage.stage_status} (${stage.record_count} records, ${stage.link_count} links)`);
  }
  lines.push("");
  lines.push("## Boundary");
  lines.push(`- Read-only/report-only: ${result.summary.read_only}/${result.summary.report_only}`);
  lines.push(`- Delivery/client-facing output: ${result.summary.delivery_execution_performed}/${result.summary.client_facing_output_generated}`);
  lines.push(`- Human review required: ${result.summary.human_review_required}`);
  lines.push(`- Windows baseline stability preserved: ${result.summary.windows_baseline_stability_preserved}`);
  return `${lines.join("\n")}\n`;
}

function sha256(value) {
  return `sha256:${hashString(JSON.stringify(value))}`;
}

function hashString(value) {
  return createHash("sha256").update(value).digest("hex");
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export async function runCreativeDocumentE2eReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runCreativeDocumentE2eReport(args);
    console.log(`Creative document E2E report written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.creative_document_e2e_report_status}`);
    console.log(`Scenario rows: ${result.summary.passed_scenario_row_count}/${result.summary.scenario_row_count}`);
    console.log(`Chain stages: ${result.summary.passed_chain_stage_count}/${result.summary.chain_stage_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    }
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--personal-dev-e2e-report") parsed.personalDevE2eReportPath = argv[++index];
    else if (arg === "--creative-document-freeze") parsed.creativeDocumentFreezePath = argv[++index];
    else if (arg === "--template-registry") parsed.templateRegistryPath = argv[++index];
    else if (arg === "--docx-renderer") parsed.docxRendererPath = argv[++index];
    else if (arg === "--pptx-renderer") parsed.pptxRendererPath = argv[++index];
    else if (arg === "--pdf-html-renderer") parsed.pdfHtmlRendererPath = argv[++index];
    else if (arg === "--layout-validator") parsed.layoutValidatorPath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--output-delivery-contract-freeze") parsed.outputDeliveryContractFreezePath = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/creative-document-e2e-report.mjs [options]

Options:
  --check                                      fail when validation does not pass
  --out-dir <path>                            output directory
  --personal-dev-e2e-report <path>            P306 personal-dev E2E report
  --creative-document-freeze <path>           creative document freeze artifact
  --template-registry <path>                  template registry artifact
  --docx-renderer <path>                      DOCX renderer artifact
  --pptx-renderer <path>                      PPTX renderer artifact
  --pdf-html-renderer <path>                  PDF/HTML renderer artifact
  --layout-validator <path>                   layout validator artifact
  --gate-approval-contract-freeze <path>      gate approval contract freeze artifact
  --output-delivery-contract-freeze <path>    output delivery contract freeze artifact
`);
}
