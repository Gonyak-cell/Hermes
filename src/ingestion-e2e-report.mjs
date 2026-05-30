import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_INGESTION_E2E_REPORT_OUT_DIR = "artifacts/ingestion-e2e-report/latest";
export const DEFAULT_INGESTION_E2E_REPORT_INPUTS = {
  creativeDocumentE2eReportPath: "artifacts/creative-document-e2e-report/latest/creative-document-e2e-report.json",
  connectorFreezePath: "artifacts/connector-freeze/latest/connector-freeze.json",
  resourceExpansionFreezePath: "artifacts/resource-expansion-freeze/latest/resource-expansion-freeze.json",
  backfillJobContractPath: "artifacts/backfill-job-contract/latest/backfill-job-contract.json",
  expansionCursorLedgerPath: "artifacts/expansion-cursor-ledger/latest/expansion-cursor-ledger.json",
  expansionDedupLedgerPath: "artifacts/expansion-dedup-ledger/latest/expansion-dedup-ledger.json",
  expansionQuarantineLedgerPath: "artifacts/expansion-quarantine-ledger/latest/expansion-quarantine-ledger.json",
  evidenceItemStorePath: "artifacts/evidence-item-store/latest/evidence-item-store.json",
  resourceEvidenceDashboardPath: "artifacts/resource-evidence-dashboard/latest/resource-evidence-dashboard-summary.json",
  expansionStatusDashboardPath: "artifacts/expansion-status-dashboard/latest/expansion-status-dashboard.json",
  evidencePlaneFreezePath: "artifacts/evidence-plane-freeze/latest/evidence-plane-freeze.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "ingestion-e2e-report.v1";
const CAPABILITY_ID = "ingestion.e2e.report";
const PHASE_SLOT = "P308";
const PREVIOUS_PHASE_SLOT = "P307";
const NEXT_PHASE_SLOT = "P309";
const REQUIRED_CHAIN_STAGES = ["connector", "backfill", "quarantine", "evidence", "dashboard"];
const SOURCE_DEFINITIONS = [
  sourceDefinition("creative_document_e2e_report", "Creative Document E2E Report", "creative_document_e2e_report_status", "complete", "P307", "P308"),
  sourceDefinition("connector_freeze", "Connector Freeze", "connector_freeze_status", "complete", "P267-P276", "P277"),
  sourceDefinition("resource_expansion_freeze", "Resource Expansion Freeze", "resource_expansion_freeze_status", "complete", "P286", "P287"),
  sourceDefinition("backfill_job_contract", "Backfill Job Contract", "backfill_job_contract_status", "complete", "P277", "P278"),
  sourceDefinition("expansion_cursor_ledger", "Expansion Cursor Ledger", "expansion_cursor_ledger_status", "complete", "P278", "P279"),
  sourceDefinition("expansion_dedup_ledger", "Expansion Dedup Ledger", "expansion_dedup_ledger_status", "complete", "P279", "P280"),
  sourceDefinition("expansion_quarantine_ledger", "Expansion Quarantine Ledger", "expansion_quarantine_ledger_status", "complete", "P280", "P281"),
  sourceDefinition("evidence_item_store", "Evidence Item Store", "evidence_item_store_status", "complete", null, null),
  sourceDefinition("resource_evidence_dashboard", "Resource/Evidence Dashboard", "resource_evidence_dashboard_status", "complete", null, null),
  sourceDefinition("expansion_status_dashboard", "Expansion Status Dashboard", "expansion_status_dashboard_status", "complete", "P285", "P286"),
  sourceDefinition("evidence_plane_freeze", "Evidence Plane Freeze", "evidence_plane_freeze_status", "frozen_with_pending_human_actions", null, null),
];

export async function runIngestionE2eReport(options = {}) {
  const result = await buildIngestionE2eReport(options);
  if (options.write !== false) await writeIngestionE2eReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Ingestion E2E report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildIngestionE2eReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_INGESTION_E2E_REPORT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    creative_document_e2e_report: await readJsonSource(inputs.creative_document_e2e_report_path),
    connector_freeze: await readJsonSource(inputs.connector_freeze_path),
    resource_expansion_freeze: await readJsonSource(inputs.resource_expansion_freeze_path),
    backfill_job_contract: await readJsonSource(inputs.backfill_job_contract_path),
    expansion_cursor_ledger: await readJsonSource(inputs.expansion_cursor_ledger_path),
    expansion_dedup_ledger: await readJsonSource(inputs.expansion_dedup_ledger_path),
    expansion_quarantine_ledger: await readJsonSource(inputs.expansion_quarantine_ledger_path),
    evidence_item_store: await readJsonSource(inputs.evidence_item_store_path),
    resource_evidence_dashboard: await readJsonSource(inputs.resource_evidence_dashboard_path),
    expansion_status_dashboard: await readJsonSource(inputs.expansion_status_dashboard_path),
    evidence_plane_freeze: await readJsonSource(inputs.evidence_plane_freeze_path),
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
  const validationItems = buildValidationItems({ support, sourceStatuses, chainStages, scenarioRows, gateResults, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sources, sourceStatuses, chainStages, scenarioRows, gateResults, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    ingestion_e2e_report_id: `ingestion-e2e-report.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    ingestion_e2e_report_contract: buildContract(generatedAt),
    ingestion_e2e_scenario_rows: scenarioRows,
    ingestion_e2e_chain_stages: chainStages,
    ingestion_e2e_gate_results: gateResults,
    ingestion_e2e_report_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  result.summary.ingestion_e2e_report_id = result.ingestion_e2e_report_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeIngestionE2eReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "ingestion-e2e-report.json"), serializable);
  await writeJson(path.join(outDir, "ingestion-e2e-sources.json"), collectionEnvelope("ingestion-e2e-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "ingestion-e2e-scenario-rows.json"), collectionEnvelope("ingestion-e2e-scenario-rows.v1", "ingestion_e2e_scenario_rows", result.ingestion_e2e_scenario_rows, result.generated_at));
  await writeJson(path.join(outDir, "ingestion-e2e-chain-stages.json"), collectionEnvelope("ingestion-e2e-chain-stages.v1", "ingestion_e2e_chain_stages", result.ingestion_e2e_chain_stages, result.generated_at));
  await writeJson(path.join(outDir, "ingestion-e2e-gate-results.json"), collectionEnvelope("ingestion-e2e-gate-results.v1", "ingestion_e2e_gate_results", result.ingestion_e2e_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "ingestion-e2e-report-boundary.json"), result.ingestion_e2e_report_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "ingestion-e2e-report-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runIngestionE2eReportCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runIngestionE2eReport(args);
    console.log(`Ingestion E2E report ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.ingestion_e2e_report_status}`);
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

function buildContract(generatedAt) {
  return {
    schema_version: "ingestion-e2e-report-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    scenario: "connector_to_backfill_to_quarantine_to_evidence_to_dashboard",
    source_of_truth: "ingestion_e2e_report_phase_artifacts",
    execution_model: "deterministic_read_only_report",
    human_review_rule: "ingested resources, evidence, dashboard panels, and export bundles remain review-gated and not client-facing",
    windows_baseline_rule: "P308 is valid only after the P307 Windows baseline stability posture is preserved",
    created_at: generatedAt,
  };
}

function buildSourceStatuses(sources) {
  return SOURCE_DEFINITIONS.map((definition, index) => {
    const source = sources[definition.source_id];
    const data = source?.data ?? {};
    const summary = summaryOf(data);
    const actualStatus = summary[definition.status_key] ?? data[definition.status_key] ?? "unknown";
    const actualPhaseSlot = summary.phase_slot ?? summary.phase_range ?? data.phase_slot ?? null;
    const actualNextPhaseSlot = summary.next_phase_slot ?? data.next_phase_slot ?? null;
    const validationErrorCount = validationErrorCountOf(data);
    const failedCheckpointCount = failedCheckpointCountOf(data);
    const phaseMatches = definition.expected_phase_slot === null || actualPhaseSlot === definition.expected_phase_slot;
    const nextPhaseMatches = definition.expected_next_phase_slot === null || actualNextPhaseSlot === definition.expected_next_phase_slot;
    const row = {
      schema_version: "ingestion-e2e-source-status.v1",
      source_status_id: `ingestion-e2e.source.${definition.source_id}`,
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
  const connector = summaryOf(sources.connector_freeze.data);
  const resourceFreeze = summaryOf(sources.resource_expansion_freeze.data);
  const backfill = summaryOf(sources.backfill_job_contract.data);
  const cursor = summaryOf(sources.expansion_cursor_ledger.data);
  const dedup = summaryOf(sources.expansion_dedup_ledger.data);
  const quarantine = summaryOf(sources.expansion_quarantine_ledger.data);
  const evidence = summaryOf(sources.evidence_item_store.data);
  const resourceDashboard = summaryOf(sources.resource_evidence_dashboard.data);
  const expansionDashboard = summaryOf(sources.expansion_status_dashboard.data);
  const evidenceFreeze = summaryOf(sources.evidence_plane_freeze.data);
  return [
    chainStage({
      generatedAt,
      stageId: "connector",
      label: "Connector freeze",
      sourceId: "connector_freeze",
      passed: connector.connector_freeze_status === "complete"
        && connector.passed_source_count === connector.source_count
        && (connector.representative_source_ingest_path_count ?? 0) > 0
        && connector.passed_representative_source_ingest_path_count === connector.representative_source_ingest_path_count
        && (connector.connector_resource_candidate_count ?? 0) > 0
        && (connector.credential_material_read_count ?? 1) === 0
        && (connector.raw_secret_material_allowed_count ?? 1) === 0
        && connector.connector_runtime_execution_performed === false
        && connector.source_ingest_performed === false
        && connector.resource_mutation_performed === false,
      recordCount: connector.connector_resource_candidate_count ?? 0,
      linkCount: connector.representative_source_ingest_path_count ?? 0,
      evidence: "Connector contracts and representative source paths are frozen with read-only credentials, cursors, and resource candidates.",
    }),
    chainStage({
      generatedAt,
      stageId: "backfill",
      label: "Resumable backfill",
      sourceId: "resource_expansion_freeze,backfill_job_contract,expansion_cursor_ledger,expansion_dedup_ledger",
      passed: resourceFreeze.resource_expansion_freeze_status === "complete"
        && backfill.backfill_job_contract_status === "complete"
        && cursor.expansion_cursor_ledger_status === "complete"
        && dedup.expansion_dedup_ledger_status === "complete"
        && resourceFreeze.resumable_backfill_dry_run_verified === true
        && resourceFreeze.idempotent_backfill_dry_run_verified === true
        && resourceFreeze.projected_terminal_item_count === resourceFreeze.projected_item_count
        && (resourceFreeze.resource_expansion_failed_count ?? 1) === 0
        && (dedup.dedup_idempotency_key_collision_count ?? 0) === 0
        && backfill.backfill_execution_performed === false
        && resourceFreeze.backfill_execution_performed === false
        && resourceFreeze.state_mutation_performed === false,
      recordCount: resourceFreeze.projected_item_count ?? resourceFreeze.resource_expansion_terminal_count ?? 0,
      linkCount: resourceFreeze.passed_resume_probe_count ?? 0,
      evidence: "Backfill is represented by resumable/idempotent dry-run rows with cursor and dedup ledgers, without executing ingestion.",
    }),
    chainStage({
      generatedAt,
      stageId: "quarantine",
      label: "Quarantine controls",
      sourceId: "expansion_quarantine_ledger,resource_evidence_dashboard",
      passed: quarantine.expansion_quarantine_ledger_status === "complete"
        && (quarantine.quarantine_decision_count ?? 0) > 0
        && quarantine.passed_quarantine_decision_count === quarantine.quarantine_decision_count
        && (quarantine.held_retrieval_allowed_count ?? 0) === 0
        && (quarantine.held_external_transfer_allowed_count ?? 0) === 0
        && (quarantine.held_output_delivery_allowed_count ?? 0) === 0
        && (quarantine.automatic_release_allowed_count ?? 0) === 0
        && (resourceDashboard.quarantine_external_transfer_blocked_count ?? 0) >= (resourceDashboard.quarantine_pending_human_review_count ?? 0)
        && quarantine.quarantine_release_performed === false
        && quarantine.resource_mutation_performed === false,
      recordCount: quarantine.quarantine_decision_count ?? 0,
      linkCount: resourceDashboard.quarantine_pending_human_review_count ?? 0,
      evidence: "Quarantine decisions are deterministic, release is blocked, and dashboard-side held resources remain human-review gated.",
    }),
    chainStage({
      generatedAt,
      stageId: "evidence",
      label: "Evidence materialization",
      sourceId: "evidence_item_store,evidence_plane_freeze",
      passed: evidence.evidence_item_store_status === "complete"
        && (evidence.evidence_item_count ?? 0) > 0
        && evidence.evidence_source_span_binding_count === evidence.evidence_item_count
        && evidence.source_span_linked_evidence_count === evidence.evidence_item_count
        && evidence.needs_review_count === evidence.evidence_item_count
        && (evidence.approved_count ?? 0) === 0
        && evidenceFreeze.evidence_plane_freeze_status === "frozen_with_pending_human_actions"
        && (evidenceFreeze.complete_representative_trace_count ?? 0) >= 1
        && (evidenceFreeze.output_delivery_blocked_count ?? 0) >= 1
        && (evidenceFreeze.attorney_review_required_count ?? 0) >= 1
        && (evidence.validation_error_count ?? 0) === 0
        && (evidenceFreeze.validation_error_count ?? 0) === 0,
      recordCount: evidence.evidence_item_count ?? 0,
      linkCount: evidence.evidence_source_span_binding_count ?? 0,
      evidence: "Evidence items are bound to source spans, preserved by matter/classification/policy, and remain review-gated in the evidence plane.",
    }),
    chainStage({
      generatedAt,
      stageId: "dashboard",
      label: "Evidence dashboards",
      sourceId: "resource_evidence_dashboard,expansion_status_dashboard",
      passed: resourceDashboard.resource_evidence_dashboard_status === "complete"
        && expansionDashboard.expansion_status_dashboard_status === "complete"
        && (resourceDashboard.panel_row_count ?? 0) > 0
        && resourceDashboard.ready_panel_count === resourceDashboard.panel_row_count
        && (resourceDashboard.attention_panel_count ?? 1) === 0
        && (resourceDashboard.regression_failed_case_count ?? 1) === 0
        && (resourceDashboard.export_client_facing_ready_bundle_count ?? 1) === 0
        && (expansionDashboard.api_route_row_count ?? 0) > 0
        && expansionDashboard.queryable_api_route_count === expansionDashboard.api_route_row_count
        && expansionDashboard.queryable_status_panel_count === expansionDashboard.status_panel_row_count
        && expansionDashboard.expansion_execution_performed === false
        && expansionDashboard.client_facing_output_generated === false,
      recordCount: (resourceDashboard.panel_row_count ?? 0) + (expansionDashboard.status_panel_row_count ?? 0),
      linkCount: expansionDashboard.api_route_row_count ?? 0,
      evidence: "Resource/evidence and expansion dashboards expose queryable read-only panels, rollups, routes, and regression evidence.",
    }),
  ];
}

function buildScenarioRows(chainStages, generatedAt) {
  const stageById = new Map(chainStages.map((stage) => [stage.chain_stage, stage]));
  const connectorGatePassed = stageById.get("connector")?.stage_status === "passed";
  const backfillGatePassed = stageById.get("backfill")?.stage_status === "passed";
  const quarantineGatePassed = stageById.get("quarantine")?.stage_status === "passed";
  const evidenceGatePassed = stageById.get("evidence")?.stage_status === "passed";
  const dashboardGatePassed = stageById.get("dashboard")?.stage_status === "passed";
  const scenarioStatus = connectorGatePassed && backfillGatePassed && quarantineGatePassed && evidenceGatePassed && dashboardGatePassed ? "passed" : "failed";
  const row = {
    schema_version: "ingestion-e2e-scenario-row.v1",
    ingestion_e2e_scenario_id: "ingestion-e2e.scenario.connector-to-dashboard",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    scenario_kind: "connector_to_backfill_to_quarantine_to_evidence_dashboard",
    scenario_status: scenarioStatus,
    connector_gate_passed: connectorGatePassed,
    backfill_gate_passed: backfillGatePassed,
    quarantine_gate_passed: quarantineGatePassed,
    evidence_gate_passed: evidenceGatePassed,
    dashboard_gate_passed: dashboardGatePassed,
    connector_to_dashboard_path_complete: scenarioStatus === "passed",
    human_review_required: true,
    attorney_review_required: true,
    source_artifact_read_performed: true,
    connector_runtime_execution_performed: false,
    backfill_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    extraction_retry_performed: false,
    quarantine_release_performed: false,
    evidence_mutation_performed: false,
    dashboard_route_execution_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    mutation_performed: false,
    generated_at: generatedAt,
  };
  return [{ ...row, scenario_hash: sha256(row) }];
}

function buildGateResults(sourceStatuses, scenarioRows, chainStages, generatedAt) {
  const sourceGatePassed = sourceStatuses.every((row) => row.source_status === "passed");
  const stageById = new Map(chainStages.map((stage) => [stage.chain_stage, stage]));
  const gates = [
    gate("sources", "All required source artifacts are present and clean.", sourceGatePassed),
    ...REQUIRED_CHAIN_STAGES.map((stageId) => gate(stageId, `${stageId} chain stage passes.`, stageById.get(stageId)?.stage_status === "passed")),
    gate("scenario", "Representative connector-to-dashboard scenario passes.", scenarioRows.every((row) => row.scenario_status === "passed")),
  ];
  return gates.map((item, index) => {
    const row = {
      schema_version: "ingestion-e2e-gate-result.v1",
      gate_result_id: `ingestion-e2e.gate.${item.gate_id}`,
      ordinal: index + 1,
      gate_id: item.gate_id,
      gate_label: item.label,
      gate_status: item.passed ? "passed" : "failed",
      gate_violation: !item.passed,
      human_review_required: true,
      generated_at: generatedAt,
    };
    return { ...row, gate_result_hash: sha256(row) };
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "ingestion-e2e-report-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    source_artifact_read_performed: true,
    source_artifact_mutation_performed: false,
    connector_runtime_execution_performed: false,
    backfill_execution_performed: false,
    source_ingest_performed: false,
    file_content_read_performed: false,
    extraction_retry_performed: false,
    quarantine_release_performed: false,
    evidence_mutation_performed: false,
    dashboard_route_execution_performed: false,
    source_mutation_performed: false,
    resource_mutation_performed: false,
    state_mutation_performed: false,
    matter_data_write_performed: false,
    external_network_access_performed: false,
    delivery_execution_performed: false,
    protected_action_executed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    attorney_review_required: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
  };
}

function buildValidationItems({ support, sourceStatuses, chainStages, scenarioRows, gateResults, boundary }) {
  const packageScripts = support.package_json.data?.scripts ?? {};
  const text = {
    final_completion_ledger: support.final_completion_ledger.text ?? "",
    implementation_roadmap: support.implementation_roadmap.text ?? "",
    review_dashboard_source: support.review_dashboard_source.text ?? "",
    review_api_source: support.review_api_source.text ?? "",
    review_api_doc: support.review_api_doc.text ?? "",
    control_plane_loop_source: support.control_plane_loop_source.text ?? "",
  };
  const stageIds = new Set(chainStages.map((stage) => stage.chain_stage));
  return [
    validationItem("sources.available", sourceStatuses.every((row) => row.source_available), "All ingestion E2E sources are readable."),
    validationItem("sources.clean", sourceStatuses.every((row) => row.source_status === "passed"), "All ingestion E2E source artifacts are complete and validation-clean."),
    validationItem("stages.required", REQUIRED_CHAIN_STAGES.every((stageId) => stageIds.has(stageId)), "Connector/backfill/quarantine/evidence/dashboard stages are present."),
    validationItem("stages.passed", chainStages.every((stage) => stage.stage_status === "passed"), "All ingestion E2E chain stages pass."),
    validationItem("scenario.passed", scenarioRows.length >= 1 && scenarioRows.every((row) => row.scenario_status === "passed"), "Representative connector-to-dashboard scenario passes."),
    validationItem("gates.passed", gateResults.every((row) => row.gate_status === "passed" && row.gate_violation === false), "All report gates pass with no violations."),
    validationItem("boundary.read_only", boundary.read_only && boundary.report_only && !boundary.connector_runtime_execution_performed && !boundary.backfill_execution_performed && !boundary.source_ingest_performed && !boundary.quarantine_release_performed && !boundary.dashboard_route_execution_performed, "Report remains read-only with no connector/backfill/ingest/quarantine/dashboard execution."),
    validationItem("boundary.no_delivery_or_legal_output", !boundary.delivery_execution_performed && !boundary.protected_action_executed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated && !boundary.client_facing_ready, "Report does not perform delivery, protected action, legal advice, or client-facing output."),
    validationItem("boundary.human_review", boundary.human_review_required && boundary.attorney_review_required, "Ingestion/evidence outputs remain human-review and attorney-review gated."),
    validationItem("boundary.windows_stability", boundary.windows_baseline_stability_preserved && boundary.mac_windows_completion_instability_guard, "Windows baseline stability guard is preserved."),
    validationItem("package.script", Boolean(packageScripts["ingestion:e2e-report"]), "package.json exposes ingestion:e2e-report."),
    validationItem("ledger.p308", text.final_completion_ledger.includes("| P308 |") && text.final_completion_ledger.includes("ingestion_e2e_report"), "Final completion ledger promotes P308 ingestion_e2e_report."),
    validationItem("roadmap.p308", text.implementation_roadmap.includes("## Phase 308") && text.implementation_roadmap.includes("ingestion_e2e_report"), "Implementation roadmap documents Phase 308."),
    validationItem("dashboard.integration", text.review_dashboard_source.includes("ingestion_e2e_report") && text.review_dashboard_source.includes("buildIngestionE2eReportStage"), "Review Dashboard includes ingestion E2E report source and stage."),
    validationItem("api.integration", text.review_api_source.includes("/api/ingestion-e2e-reports") && text.review_api_doc.includes("P308 Ingestion E2E Report Routes"), "Review API exposes ingestion E2E report routes."),
    validationItem("loop.integration", text.control_plane_loop_source.includes("ingestion_e2e_report") && text.control_plane_loop_source.includes("ingestion:e2e-report"), "Control Plane Loop runs ingestion E2E report."),
  ];
}

function buildSummary({ sources, sourceStatuses, chainStages, scenarioRows, gateResults, boundary, validation }) {
  const creative = summaryOf(sources.creative_document_e2e_report.data);
  const connector = summaryOf(sources.connector_freeze.data);
  const resourceFreeze = summaryOf(sources.resource_expansion_freeze.data);
  const backfill = summaryOf(sources.backfill_job_contract.data);
  const cursor = summaryOf(sources.expansion_cursor_ledger.data);
  const dedup = summaryOf(sources.expansion_dedup_ledger.data);
  const quarantine = summaryOf(sources.expansion_quarantine_ledger.data);
  const evidence = summaryOf(sources.evidence_item_store.data);
  const resourceDashboard = summaryOf(sources.resource_evidence_dashboard.data);
  const expansionDashboard = summaryOf(sources.expansion_status_dashboard.data);
  const evidenceFreeze = summaryOf(sources.evidence_plane_freeze.data);
  const stagePassed = (stageId) => chainStages.filter((stage) => stage.chain_stage === stageId && stage.stage_status === "passed").length;
  const failedSourceStatusCount = sourceStatuses.filter((row) => row.source_status !== "passed").length;
  const failedScenarioRowCount = scenarioRows.filter((row) => row.scenario_status !== "passed").length;
  const failedChainStageCount = chainStages.filter((stage) => stage.stage_status !== "passed").length;
  const failedGateCount = gateResults.filter((row) => row.gate_status !== "passed" || row.gate_violation).length;
  return {
    schema_version: "ingestion-e2e-report-summary.v1",
    ingestion_e2e_report_status: failedSourceStatusCount === 0 && failedScenarioRowCount === 0 && failedChainStageCount === 0 && failedGateCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_creative_document_e2e_report_status: creative.creative_document_e2e_report_status ?? "unknown",
    source_creative_document_e2e_report_phase_slot: creative.phase_slot ?? null,
    source_creative_document_e2e_report_next_phase_slot: creative.next_phase_slot ?? null,
    source_connector_freeze_status: connector.connector_freeze_status ?? "unknown",
    source_connector_freeze_phase_range: connector.phase_range ?? null,
    source_resource_expansion_freeze_status: resourceFreeze.resource_expansion_freeze_status ?? "unknown",
    source_resource_expansion_freeze_phase_slot: resourceFreeze.phase_slot ?? null,
    source_resource_expansion_freeze_next_phase_slot: resourceFreeze.next_phase_slot ?? null,
    source_backfill_job_contract_status: backfill.backfill_job_contract_status ?? "unknown",
    source_expansion_quarantine_ledger_status: quarantine.expansion_quarantine_ledger_status ?? "unknown",
    source_evidence_item_store_status: evidence.evidence_item_store_status ?? "unknown",
    source_resource_evidence_dashboard_status: resourceDashboard.resource_evidence_dashboard_status ?? "unknown",
    source_expansion_status_dashboard_status: expansionDashboard.expansion_status_dashboard_status ?? "unknown",
    source_evidence_plane_freeze_status: evidenceFreeze.evidence_plane_freeze_status ?? "unknown",
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.length - failedSourceStatusCount,
    failed_source_status_count: failedSourceStatusCount,
    scenario_row_count: scenarioRows.length,
    passed_scenario_row_count: scenarioRows.length - failedScenarioRowCount,
    failed_scenario_row_count: failedScenarioRowCount,
    chain_stage_count: chainStages.length,
    passed_chain_stage_count: chainStages.length - failedChainStageCount,
    failed_chain_stage_count: failedChainStageCount,
    connector_stage_passed_count: stagePassed("connector"),
    backfill_stage_passed_count: stagePassed("backfill"),
    quarantine_stage_passed_count: stagePassed("quarantine"),
    evidence_stage_passed_count: stagePassed("evidence"),
    dashboard_stage_passed_count: stagePassed("dashboard"),
    connector_to_dashboard_path_complete: failedScenarioRowCount === 0 && failedChainStageCount === 0,
    connector_resource_candidate_count: connector.connector_resource_candidate_count ?? 0,
    representative_source_ingest_path_count: connector.representative_source_ingest_path_count ?? 0,
    passed_representative_source_ingest_path_count: connector.passed_representative_source_ingest_path_count ?? 0,
    credential_material_read_count: connector.credential_material_read_count ?? 0,
    external_network_access_performed_count: connector.external_network_access_performed_count ?? 0,
    projected_item_count: resourceFreeze.projected_item_count ?? 0,
    projected_terminal_item_count: resourceFreeze.projected_terminal_item_count ?? 0,
    resource_expansion_terminal_count: resourceFreeze.resource_expansion_terminal_count ?? 0,
    resource_expansion_failed_count: resourceFreeze.resource_expansion_failed_count ?? 0,
    cursor_resume_checkpoint_count: resourceFreeze.cursor_resume_checkpoint_count ?? cursor.cursor_resume_checkpoint_count ?? 0,
    dedup_idempotency_key_count: resourceFreeze.dedup_idempotency_key_count ?? dedup.dedup_idempotency_key_count ?? 0,
    dedup_idempotency_key_collision_count: resourceFreeze.dedup_idempotency_key_collision_count ?? dedup.dedup_idempotency_key_collision_count ?? 0,
    resumable_backfill_dry_run_verified: resourceFreeze.resumable_backfill_dry_run_verified ?? false,
    idempotent_backfill_dry_run_verified: resourceFreeze.idempotent_backfill_dry_run_verified ?? false,
    quarantine_decision_count: quarantine.quarantine_decision_count ?? 0,
    passed_quarantine_decision_count: quarantine.passed_quarantine_decision_count ?? 0,
    quarantine_hold_count: quarantine.quarantine_hold_count ?? 0,
    quarantine_pending_human_review_count: resourceDashboard.quarantine_pending_human_review_count ?? 0,
    quarantine_external_transfer_blocked_count: resourceDashboard.quarantine_external_transfer_blocked_count ?? 0,
    quarantine_output_delivery_blocked_count: resourceDashboard.quarantine_output_delivery_blocked_count ?? 0,
    automatic_release_allowed_count: quarantine.automatic_release_allowed_count ?? 0,
    evidence_item_count: evidence.evidence_item_count ?? resourceDashboard.evidence_item_count ?? 0,
    evidence_source_span_binding_count: evidence.evidence_source_span_binding_count ?? 0,
    evidence_needs_review_count: evidence.needs_review_count ?? resourceDashboard.evidence_needs_review_count ?? 0,
    evidence_approved_count: evidence.approved_count ?? 0,
    complete_representative_trace_count: evidenceFreeze.complete_representative_trace_count ?? 0,
    attorney_review_required_count: evidenceFreeze.attorney_review_required_count ?? 0,
    output_delivery_blocked_count: evidenceFreeze.output_delivery_blocked_count ?? 0,
    panel_row_count: resourceDashboard.panel_row_count ?? 0,
    ready_panel_count: resourceDashboard.ready_panel_count ?? 0,
    attention_panel_count: resourceDashboard.attention_panel_count ?? 0,
    expansion_status_panel_row_count: expansionDashboard.status_panel_row_count ?? 0,
    queryable_status_panel_count: expansionDashboard.queryable_status_panel_count ?? 0,
    api_route_row_count: expansionDashboard.api_route_row_count ?? 0,
    queryable_api_route_count: expansionDashboard.queryable_api_route_count ?? 0,
    regression_test_case_count: resourceDashboard.regression_test_case_count ?? 0,
    regression_failed_case_count: resourceDashboard.regression_failed_case_count ?? 0,
    export_bundle_count: resourceDashboard.export_bundle_count ?? 0,
    export_delivery_blocked_bundle_count: resourceDashboard.export_delivery_blocked_bundle_count ?? 0,
    export_external_transfer_blocked_bundle_count: resourceDashboard.export_external_transfer_blocked_bundle_count ?? 0,
    export_client_facing_ready_bundle_count: resourceDashboard.export_client_facing_ready_bundle_count ?? 0,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.length - failedGateCount,
    failed_gate_result_count: failedGateCount,
    gate_violation_count: gateResults.filter((row) => row.gate_violation).length,
    ...boundary,
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function chainStage({ generatedAt, stageId, label, sourceId, passed, recordCount, linkCount, evidence }) {
  const row = {
    schema_version: "ingestion-e2e-chain-stage.v1",
    chain_stage_id: `ingestion-e2e.stage.${stageId}`,
    chain_stage: stageId,
    label,
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

function validationItem(pathValue, passed, message) {
  return { path: pathValue, check_id: pathValue, status: passed ? "passed" : "failed", message };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function renderMarkdown(result) {
  const summary = result.summary;
  return [
    "# Ingestion E2E Report",
    "",
    `- Status: ${summary.ingestion_e2e_report_status}`,
    `- Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    `- Chain stages: ${summary.passed_chain_stage_count}/${summary.chain_stage_count}`,
    `- Scenario rows: ${summary.passed_scenario_row_count}/${summary.scenario_row_count}`,
    `- Connector candidates: ${summary.connector_resource_candidate_count}`,
    `- Projected/terminal backfill items: ${summary.projected_terminal_item_count}/${summary.projected_item_count}`,
    `- Quarantine decisions: ${summary.passed_quarantine_decision_count}/${summary.quarantine_decision_count}`,
    `- Evidence items: ${summary.evidence_item_count}`,
    `- Dashboard panels/routes: ${summary.ready_panel_count}/${summary.panel_row_count}, ${summary.queryable_api_route_count}/${summary.api_route_row_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "This report is read-only and does not execute connectors, backfill, ingestion, quarantine release, dashboard routes, delivery, protected actions, legal advice, or client-facing output.",
  ].join("\n");
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
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg.startsWith("--")) parsed[kebabToCamel(arg.slice(2))] = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log("Usage: node scripts/ingestion-e2e-report.mjs [--check] [--out-dir path]");
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot };
}

function gate(gateId, label, passed) {
  return { gate_id: gateId, label, passed };
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_INGESTION_E2E_REPORT_INPUTS)) {
    const snakeKey = camelToSnake(key);
    normalized[snakeKey] = options[key] ?? options[snakeKey] ?? defaultValue;
  }
  return normalized;
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const raw = await readFile(resolvedPath, "utf8");
    return { path: filePath, resolved_path: resolvedPath, available: true, data: JSON.parse(raw), content_hash: `sha256:${createHash("sha256").update(raw).digest("hex")}`, error: null };
  } catch (error) {
    return { path: filePath, resolved_path: resolvedPath, available: false, data: null, content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { path: filePath, resolved_path: resolvedPath, available: true, text, content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
  } catch (error) {
    return { path: filePath, resolved_path: resolvedPath, available: false, text: "", content_hash: null, error: error.message };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function collectionEnvelope(schemaVersion, collectionKey, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [`${collectionKey}_count`]: rows.length, [collectionKey]: rows };
}

function summaryOf(data) {
  return data?.summary ?? data ?? {};
}

function validationErrorCountOf(data) {
  const summary = summaryOf(data);
  return summary.validation_error_count ?? summary.source_validation_error_count ?? data?.validation?.errors?.length ?? 0;
}

function failedCheckpointCountOf(data) {
  const summary = summaryOf(data);
  return summary.failed_checkpoint_count ?? summary.failed_freeze_checkpoint_count ?? summary.failed_validation_item_count ?? 0;
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(value) {
  return value.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function kebabToCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
