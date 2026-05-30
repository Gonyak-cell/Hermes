import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_PERSONAL_DEV_E2E_REPORT_OUT_DIR = "artifacts/personal-dev-e2e-report/latest";
export const DEFAULT_PERSONAL_DEV_E2E_REPORT_INPUTS = {
  lawFirmE2eReportPath: "artifacts/law-firm-e2e-report/latest/law-firm-e2e-report.json",
  personalDevE2eFreezePath: "artifacts/personal-dev-e2e-freeze/latest/personal-dev-e2e-freeze.json",
  issueIntakeAdapterPath: "artifacts/issue-intake-adapter/latest/issue-intake-adapter.json",
  planRequestContractPath: "artifacts/plan-request-contract/latest/plan-request-contract.json",
  planReconciliationPath: "artifacts/plan-reconciliation/latest/plan-reconciliation.json",
  devLaneLedgerPath: "artifacts/dev-lane-ledger/latest/dev-lane-ledger.json",
  implementationPatchCapturePath: "artifacts/implementation-patch-capture/latest/implementation-patch-capture.json",
  diffReviewGatePath: "artifacts/diff-review-gate/latest/diff-review-gate.json",
  canonicalTestMatrixPath: "artifacts/canonical-test-matrix/latest/canonical-test-matrix.json",
  prDraftArtifactPath: "artifacts/pr-draft-artifact/latest/pr-draft-artifact.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "personal-dev-e2e-report.v1";
const CAPABILITY_ID = "personal_dev.e2e.report";
const PHASE_SLOT = "P306";
const PREVIOUS_PHASE_SLOT = "P305";
const NEXT_PHASE_SLOT = "P307";
const REQUIRED_CHAIN_STAGES = ["issue", "plan", "worktree", "diff", "test", "pr_draft", "audit"];

const SOURCE_DEFINITIONS = [
  sourceDefinition("law_firm_e2e_report", "Law Firm E2E Report", "law_firm_e2e_report_status", "complete", "P305", "P306"),
  sourceDefinition("personal_dev_e2e_freeze", "Personal Dev E2E Freeze", "personal_dev_e2e_freeze_status", "complete", null, null),
  sourceDefinition("issue_intake_adapter", "Issue Intake Adapter", "issue_intake_status", "complete", null, null),
  sourceDefinition("plan_request_contract", "Plan Request Contract", "plan_request_status", "complete", null, null),
  sourceDefinition("plan_reconciliation", "Plan Reconciliation", "plan_reconciliation_status", "complete", null, null),
  sourceDefinition("dev_lane_ledger", "Dev Lane Ledger", "dev_lane_ledger_status", "complete", null, null),
  sourceDefinition("implementation_patch_capture", "Implementation Patch Capture", "implementation_patch_capture_status", "complete", null, null),
  sourceDefinition("diff_review_gate", "Diff Review Gate", "diff_review_gate_status", "complete", null, null),
  sourceDefinition("canonical_test_matrix", "Canonical Test Matrix", "canonical_test_matrix_status", "complete", null, null),
  sourceDefinition("pr_draft_artifact", "PR Draft Artifact", "pr_draft_artifact_status", "complete", null, null),
  sourceDefinition("audit_event_ledger", "Audit Event Ledger", "audit_event_ledger_status", "complete", null, null),
];

export async function runPersonalDevE2eReport(options = {}) {
  const result = await buildPersonalDevE2eReport(options);
  if (options.write !== false) await writePersonalDevE2eReport(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Personal dev E2E report validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPersonalDevE2eReport(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PERSONAL_DEV_E2E_REPORT_OUT_DIR);
  const reportId = `personal-dev-e2e-report.${dateStamp(generatedAt)}`;
  const inputs = normalizeInputs(options);
  const sources = {
    law_firm_e2e_report: await readJsonSource(inputs.law_firm_e2e_report_path),
    personal_dev_e2e_freeze: await readJsonSource(inputs.personal_dev_e2e_freeze_path),
    issue_intake_adapter: await readJsonSource(inputs.issue_intake_adapter_path),
    plan_request_contract: await readJsonSource(inputs.plan_request_contract_path),
    plan_reconciliation: await readJsonSource(inputs.plan_reconciliation_path),
    dev_lane_ledger: await readJsonSource(inputs.dev_lane_ledger_path),
    implementation_patch_capture: await readJsonSource(inputs.implementation_patch_capture_path),
    diff_review_gate: await readJsonSource(inputs.diff_review_gate_path),
    canonical_test_matrix: await readJsonSource(inputs.canonical_test_matrix_path),
    pr_draft_artifact: await readJsonSource(inputs.pr_draft_artifact_path),
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
    personal_dev_e2e_report_id: reportId,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    personal_dev_e2e_report_contract: buildContract(generatedAt),
    personal_dev_e2e_scenario_rows: scenarioRows,
    personal_dev_e2e_chain_stages: chainStages,
    personal_dev_e2e_gate_results: gateResults,
    personal_dev_e2e_report_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary: {
      ...summary,
      personal_dev_e2e_report_id: reportId,
    },
  };
  return {
    ...result,
    markdown: renderMarkdown(result),
  };
}

export async function writePersonalDevE2eReport(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "personal-dev-e2e-report.json"), serializable);
  await writeJson(path.join(outDir, "personal-dev-e2e-sources.json"), collectionEnvelope("personal-dev-e2e-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "personal-dev-e2e-scenario-rows.json"), collectionEnvelope("personal-dev-e2e-scenario-rows.v1", "personal_dev_e2e_scenario_rows", result.personal_dev_e2e_scenario_rows, result.generated_at));
  await writeJson(path.join(outDir, "personal-dev-e2e-chain-stages.json"), collectionEnvelope("personal-dev-e2e-chain-stages.v1", "personal_dev_e2e_chain_stages", result.personal_dev_e2e_chain_stages, result.generated_at));
  await writeJson(path.join(outDir, "personal-dev-e2e-gate-results.json"), collectionEnvelope("personal-dev-e2e-gate-results.v1", "personal_dev_e2e_gate_results", result.personal_dev_e2e_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "personal-dev-e2e-report-boundary.json"), result.personal_dev_e2e_report_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "personal-dev-e2e-report-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

function buildContract(generatedAt) {
  return {
    schema_version: "personal-dev-e2e-report-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    scenario: "issue_to_plan_to_worktree_to_diff_to_test_to_pr_draft_to_audit",
    source_of_truth: "personal_dev_e2e_report_phase_artifacts",
    execution_model: "deterministic_read_only_report",
    human_review_rule: "issue mutation, task writes, commands, PR creation, merge, release, rollback, protected writes, and external-agent execution remain human gated",
    windows_baseline_rule: "P306 is valid only after the P305 Windows baseline stability posture is preserved",
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
      schema_version: "personal-dev-e2e-source-status.v1",
      source_status_id: `personal-dev-e2e.source.${definition.source_id}`,
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
  const freeze = summaryOf(sources.personal_dev_e2e_freeze.data);
  const issue = summaryOf(sources.issue_intake_adapter.data);
  const planRequest = summaryOf(sources.plan_request_contract.data);
  const planReconciliation = summaryOf(sources.plan_reconciliation.data);
  const lane = summaryOf(sources.dev_lane_ledger.data);
  const patch = summaryOf(sources.implementation_patch_capture.data);
  const diff = summaryOf(sources.diff_review_gate.data);
  const tests = summaryOf(sources.canonical_test_matrix.data);
  const pr = summaryOf(sources.pr_draft_artifact.data);
  const audit = summaryOf(sources.audit_event_ledger.data);
  const auditRecordCount = effectiveAuditRecordCount(audit);
  return [
    chainStage({
      generatedAt,
      stageId: "issue",
      label: "Issue intake",
      sourceId: "issue_intake_adapter",
      passed: issue.issue_intake_status === "complete" && (issue.issue_record_count ?? 0) >= 1 && (issue.normalized_task_count ?? 0) >= 1 && (issue.bound_issue_task_binding_count ?? 0) === (issue.issue_task_binding_count ?? -1) && (issue.issue_mutation_performed_count ?? 1) === 0,
      recordCount: issue.issue_record_count ?? 0,
      linkCount: issue.issue_task_binding_count ?? 0,
      evidence: "Issue intake normalizes source issues to task records without issue mutation or external fetch.",
    }),
    chainStage({
      generatedAt,
      stageId: "plan",
      label: "Plan reconciliation",
      sourceId: "plan_reconciliation",
      passed: planRequest.plan_request_status === "complete" && planReconciliation.plan_reconciliation_status === "complete" && (planRequest.ready_plan_request_count ?? 0) >= 2 && (planReconciliation.ready_plan_candidate_count ?? 0) >= 2 && (planReconciliation.unresolved_conflict_count ?? 1) === 0 && (planReconciliation.plan_acceptance_performed_count ?? 1) === 0,
      recordCount: planReconciliation.plan_candidate_count ?? 0,
      linkCount: planRequest.shared_context_binding_count ?? 0,
      evidence: "Claude Code and Codex plan candidates share context/constraints and reconcile into human-gated scope.",
    }),
    chainStage({
      generatedAt,
      stageId: "worktree",
      label: "Worktree lane",
      sourceId: "dev_lane_ledger",
      passed: lane.dev_lane_ledger_status === "complete" && (lane.dev_lane_count ?? 0) >= 1 && (lane.branch_record_count ?? 0) >= 1 && (lane.worktree_record_count ?? 0) >= 1 && (lane.git_command_executed_count ?? 1) === 0 && (lane.filesystem_mutation_performed_count ?? 1) === 0,
      recordCount: lane.worktree_record_count ?? 0,
      linkCount: lane.branch_record_count ?? 0,
      evidence: "Frozen scope is bound to branch/worktree lane records while materialization and git commands remain blocked.",
    }),
    chainStage({
      generatedAt,
      stageId: "diff",
      label: "Diff review",
      sourceId: "diff_review_gate",
      passed: patch.implementation_patch_capture_status === "complete" && diff.diff_review_gate_status === "complete" && (patch.patch_record_count ?? 0) >= 1 && (patch.diff_capture_count ?? 0) >= 1 && (diff.passed_with_human_gate_count ?? 0) === (diff.diff_review_result_count ?? -1) && (diff.patch_application_performed_count ?? 1) === 0,
      recordCount: diff.diff_review_result_count ?? 0,
      linkCount: patch.diff_capture_count ?? 0,
      evidence: "Captured implementation diffs are reviewed with human gates and no patch application.",
    }),
    chainStage({
      generatedAt,
      stageId: "test",
      label: "Canonical test matrix",
      sourceId: "canonical_test_matrix",
      passed: tests.canonical_test_matrix_status === "complete" && (tests.required_dimension_count ?? 0) >= 1 && (tests.passed_required_dimension_count ?? 0) === (tests.required_dimension_count ?? -1) && (tests.failed_dimension_count ?? 1) === 0 && (tests.patch_application_performed_count ?? 1) === 0,
      recordCount: tests.required_dimension_count ?? 0,
      linkCount: tests.passed_required_dimension_count ?? 0,
      evidence: "Required canonical test dimensions pass under harness authority without merge or apply permission.",
    }),
    chainStage({
      generatedAt,
      stageId: "pr_draft",
      label: "PR draft",
      sourceId: "pr_draft_artifact",
      passed: pr.pr_draft_artifact_status === "complete" && (pr.pr_draft_output_artifact_count ?? 0) >= 1 && pr.summary_section_present === true && pr.tests_section_present === true && pr.risks_section_present === true && pr.rollback_section_present === true && pr.pull_request_creation_performed === false && pr.github_api_called === false && pr.merge_performed === false,
      recordCount: pr.pr_draft_output_artifact_count ?? 0,
      linkCount: pr.test_evidence_count ?? 0,
      evidence: "PR draft captures summary, tests, risks, and rollback while PR creation/GitHub/merge stay blocked.",
    }),
    chainStage({
      generatedAt,
      stageId: "audit",
      label: "Audit ledger",
      sourceId: "audit_event_ledger",
      passed: audit.audit_event_ledger_status === "complete" && (audit.validation_error_count ?? 0) === 0,
      recordCount: auditRecordCount,
      linkCount: audit.human_review_required_audit_record_count ?? 0,
      evidence: "Separated audit ledger records human-review/protected-action context without protected-action execution.",
    }),
  ];
}

function buildScenarioRows(sources, chainStages, generatedAt) {
  const freeze = summaryOf(sources.personal_dev_e2e_freeze.data);
  const allStagesPassed = chainStages.every((stage) => stage.stage_status === "passed");
  const row = {
    schema_version: "personal-dev-e2e-scenario-row.v1",
    personal_dev_e2e_scenario_id: "personal-dev-e2e.scenario.issue-plan-worktree-diff-test-pr-audit",
    ordinal: 1,
    phase_slot: PHASE_SLOT,
    scenario_kind: "issue_to_plan_to_worktree_to_diff_to_test_to_pr_draft_to_audit",
    source_freeze_id: freeze.personal_dev_e2e_freeze_id ?? null,
    chain_stages: REQUIRED_CHAIN_STAGES,
    issue_gate_passed: freeze.issue_trace_status === "passed" && chainStages.some((stage) => stage.chain_stage === "issue" && stage.stage_status === "passed"),
    plan_gate_passed: freeze.plan_trace_status === "passed" && chainStages.some((stage) => stage.chain_stage === "plan" && stage.stage_status === "passed"),
    worktree_gate_passed: freeze.worktree_trace_status === "passed" && chainStages.some((stage) => stage.chain_stage === "worktree" && stage.stage_status === "passed"),
    diff_gate_passed: freeze.diff_trace_status === "passed" && chainStages.some((stage) => stage.chain_stage === "diff" && stage.stage_status === "passed"),
    test_gate_passed: freeze.test_trace_status === "passed" && chainStages.some((stage) => stage.chain_stage === "test" && stage.stage_status === "passed"),
    pr_draft_gate_passed: freeze.pr_trace_status === "passed" && chainStages.some((stage) => stage.chain_stage === "pr_draft" && stage.stage_status === "passed"),
    audit_gate_passed: chainStages.some((stage) => stage.chain_stage === "audit" && stage.stage_status === "passed"),
    human_review_required: true,
    task_state_write_performed: false,
    issue_mutation_performed: false,
    command_execution_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    pull_request_creation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    merge_performed: false,
    release_performed: false,
    rollback_execution_performed: false,
    patch_application_performed: false,
    protected_mutation_performed: false,
    external_agent_invocation_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    mutation_performed: false,
    scenario_status: allStagesPassed && freeze.personal_dev_e2e_freeze_status === "complete" && freeze.issue_to_pr_path_complete === true ? "passed" : "failed",
    generated_at: generatedAt,
  };
  return [{ ...row, scenario_hash: sha256(row) }];
}

function buildGateResults(sourceStatuses, scenarioRows, chainStages, generatedAt) {
  const gates = [
    gateResult("sources", "All required source artifacts are readable and complete.", sourceStatuses.every((row) => row.source_status === "passed"), generatedAt),
    gateResult("scenario_chain", "Representative personal-dev scenario passes issue->plan->worktree->diff->test->PR draft->audit.", scenarioRows.length > 0 && scenarioRows.every((row) => row.scenario_status === "passed"), generatedAt),
    gateResult("chain_stages", "Every required chain stage is present and passed.", REQUIRED_CHAIN_STAGES.every((stageId) => chainStages.some((stage) => stage.chain_stage === stageId && stage.stage_status === "passed")), generatedAt),
    gateResult("human_review", "Task writes, issue mutation, commands, PR creation, merge, release, rollback, and protected writes remain human gated.", scenarioRows.every((row) => row.human_review_required), generatedAt),
    gateResult("no_execution_or_mutation", "No mutation, command execution, GitHub API, PR creation, merge, release, rollback, protected write, external-agent execution, legal advice, or client-facing output is generated.", scenarioRows.every((row) => !row.task_state_write_performed && !row.issue_mutation_performed && !row.command_execution_performed && !row.git_command_executed && !row.filesystem_mutation_performed && !row.pull_request_creation_performed && !row.github_api_called && !row.branch_push_performed && !row.merge_performed && !row.release_performed && !row.rollback_execution_performed && !row.patch_application_performed && !row.protected_mutation_performed && !row.external_agent_invocation_performed && !row.legal_advice_generated && !row.client_facing_output_generated && !row.mutation_performed), generatedAt),
  ];
  return gates.map((gate, index) => ({ ...gate, ordinal: index + 1 }));
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "personal-dev-e2e-report-boundary.v1",
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    read_only: true,
    report_only: true,
    deterministic_report: true,
    source_artifact_read_performed: true,
    source_content_read_performed: false,
    source_ingest_performed: false,
    task_state_write_performed: false,
    issue_mutation_performed: false,
    command_execution_performed: false,
    git_command_executed: false,
    filesystem_mutation_performed: false,
    filesystem_mutation_performed_outside_artifact_dir: false,
    patch_application_performed: false,
    protected_mutation_performed: false,
    workflow_transition_performed: false,
    runtime_execution_performed: false,
    external_agent_invocation_performed: false,
    pull_request_creation_performed: false,
    github_api_called: false,
    branch_push_performed: false,
    merge_performed: false,
    release_performed: false,
    rollback_execution_performed: false,
    delivery_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    protected_action_executed: false,
    external_transfer_performed: false,
    network_access_performed: false,
    raw_secret_material_exposed: false,
    provider_key_exposed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    human_review_required: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
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
    validationItem("phase_linkage", boundary.phase_slot === PHASE_SLOT && sourceStatuses.some((row) => row.source_id === "law_firm_e2e_report" && row.actual_phase_slot === PREVIOUS_PHASE_SLOT && row.actual_next_phase_slot === PHASE_SLOT), "P306 links directly after the P305 law-firm E2E report baseline."),
    validationItem("sources_passed", sourceStatuses.every((row) => row.source_status === "passed"), "All required P306 source artifacts are readable and complete."),
    validationItem("scenario_rows_passed", scenarioRows.length > 0 && scenarioRows.every((row) => row.scenario_status === "passed"), "Representative personal-dev E2E scenario rows pass."),
    validationItem("chain_stages_passed", REQUIRED_CHAIN_STAGES.every((stageId) => chainStages.some((stage) => stage.chain_stage === stageId && stage.stage_status === "passed")), "Issue, plan, worktree, diff, test, PR draft, and audit stages all pass."),
    validationItem("gate_results_passed", gateResults.every((row) => row.gate_status === "passed"), "P306 gate results all pass."),
    validationItem("boundary_enforced", boundary.boundary_status === "enforced" && boundary.read_only && boundary.report_only && !boundary.command_execution_performed && !boundary.runtime_execution_performed && !boundary.pull_request_creation_performed && !boundary.client_facing_output_generated, "P306 remains read-only/report-only with no execution, mutation, PR creation, or client-facing output."),
    validationItem("human_review_preserved", boundary.human_review_required && scenarioRows.every((row) => row.human_review_required), "Human review gates are preserved for personal-dev protected actions."),
    validationItem("support_sources_read", !support.package_json.error && !support.final_completion_ledger.error && !support.implementation_roadmap.error && !support.review_dashboard_source.error && !support.review_api_source.error && !support.review_api_doc.error && !support.control_plane_loop_source.error && sourceReadErrors.length === 0, "All support contracts and source artifacts are readable."),
    validationItem("package_script_registered", Boolean(packageJson.scripts?.["personal-dev:e2e-report"]), "package.json registers personal-dev:e2e-report."),
    validationItem("ledger_slot_present", finalLedgerText.includes("P306") && finalLedgerText.includes("personal-dev E2E"), "Final completion ledger keeps the P306 personal-dev E2E slot."),
    validationItem("roadmap_phase_present", implementationRoadmapText.includes("Phase 306") && implementationRoadmapText.includes("Personal Dev E2E Report"), "Implementation roadmap records Phase 306 Personal Dev E2E Report."),
    validationItem("dashboard_registered", dashboardText.includes("personalDevE2eReportPath") && dashboardText.includes("buildPersonalDevE2eReportStage"), "Review Dashboard declares the personal_dev_e2e_report source and stage."),
    validationItem("review_api_registered", apiText.includes("/api/personal-dev-e2e-reports") && apiText.includes("personal_dev_e2e_report"), "Review API exposes Personal Dev E2E Report routes."),
    validationItem("review_api_doc_registered", apiDocText.includes("/api/personal-dev-e2e-reports") && apiDocText.includes("Personal Dev E2E Report"), "Review API docs include Personal Dev E2E Report routes."),
    validationItem("control_plane_loop_registered", loopText.includes("personal_dev_e2e_report") && loopText.includes("personal-dev:e2e-report"), "Control Plane Loop declares the personal_dev_e2e_report step."),
  ];
}

function buildSummary({ sourceStatuses, chainStages, scenarioRows, gateResults, boundary, validationItems, validation, sources }) {
  const freeze = summaryOf(sources.personal_dev_e2e_freeze.data);
  const issue = summaryOf(sources.issue_intake_adapter.data);
  const planRequest = summaryOf(sources.plan_request_contract.data);
  const planReconciliation = summaryOf(sources.plan_reconciliation.data);
  const lane = summaryOf(sources.dev_lane_ledger.data);
  const patch = summaryOf(sources.implementation_patch_capture.data);
  const diff = summaryOf(sources.diff_review_gate.data);
  const tests = summaryOf(sources.canonical_test_matrix.data);
  const pr = summaryOf(sources.pr_draft_artifact.data);
  const audit = summaryOf(sources.audit_event_ledger.data);
  const auditRecordCount = effectiveAuditRecordCount(audit);
  return {
    schema_version: "personal-dev-e2e-report-summary.v1",
    personal_dev_e2e_report_status: validation.valid ? "complete" : "blocked",
    personal_dev_e2e_report_id: null,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.filter((row) => row.source_status === "passed").length,
    failed_source_status_count: sourceStatuses.filter((row) => row.source_status !== "passed").length,
    source_law_firm_e2e_report_status: sourceStatuses.find((row) => row.source_id === "law_firm_e2e_report")?.actual_status ?? "unknown",
    source_law_firm_e2e_report_phase_slot: sourceStatuses.find((row) => row.source_id === "law_firm_e2e_report")?.actual_phase_slot ?? null,
    source_law_firm_e2e_report_next_phase_slot: sourceStatuses.find((row) => row.source_id === "law_firm_e2e_report")?.actual_next_phase_slot ?? null,
    scenario_row_count: scenarioRows.length,
    passed_scenario_row_count: scenarioRows.filter((row) => row.scenario_status === "passed").length,
    failed_scenario_row_count: scenarioRows.filter((row) => row.scenario_status !== "passed").length,
    chain_stage_count: chainStages.length,
    passed_chain_stage_count: chainStages.filter((row) => row.stage_status === "passed").length,
    failed_chain_stage_count: chainStages.filter((row) => row.stage_status !== "passed").length,
    issue_stage_passed_count: countStage(chainStages, "issue"),
    plan_stage_passed_count: countStage(chainStages, "plan"),
    worktree_stage_passed_count: countStage(chainStages, "worktree"),
    diff_stage_passed_count: countStage(chainStages, "diff"),
    test_stage_passed_count: countStage(chainStages, "test"),
    pr_draft_stage_passed_count: countStage(chainStages, "pr_draft"),
    audit_stage_passed_count: countStage(chainStages, "audit"),
    issue_to_audit_path_complete: REQUIRED_CHAIN_STAGES.every((stageId) => chainStages.some((stage) => stage.chain_stage === stageId && stage.stage_status === "passed")) && scenarioRows.every((row) => row.scenario_status === "passed"),
    source_personal_dev_e2e_freeze_status: freeze.personal_dev_e2e_freeze_status ?? "unknown",
    source_personal_dev_e2e_freeze_issue_to_pr_path_complete: freeze.issue_to_pr_path_complete ?? false,
    issue_source_count: issue.issue_source_count ?? 0,
    issue_record_count: issue.issue_record_count ?? 0,
    normalized_task_count: issue.normalized_task_count ?? 0,
    issue_task_binding_count: issue.issue_task_binding_count ?? 0,
    plan_request_count: planRequest.plan_request_count ?? 0,
    ready_plan_request_count: planRequest.ready_plan_request_count ?? 0,
    plan_candidate_count: planReconciliation.plan_candidate_count ?? 0,
    ready_plan_candidate_count: planReconciliation.ready_plan_candidate_count ?? 0,
    unresolved_conflict_count: planReconciliation.unresolved_conflict_count ?? 0,
    selected_scope_item_count: planReconciliation.selected_scope_item_count ?? 0,
    dev_lane_count: lane.dev_lane_count ?? 0,
    branch_record_count: lane.branch_record_count ?? 0,
    worktree_record_count: lane.worktree_record_count ?? 0,
    materialized_worktree_count: lane.materialized_worktree_count ?? 0,
    patch_record_count: patch.patch_record_count ?? 0,
    diff_capture_count: patch.diff_capture_count ?? 0,
    diff_review_result_count: diff.diff_review_result_count ?? 0,
    passed_with_human_gate_count: diff.passed_with_human_gate_count ?? 0,
    required_test_dimension_count: tests.required_dimension_count ?? 0,
    passed_required_test_dimension_count: tests.passed_required_dimension_count ?? 0,
    failed_test_dimension_count: tests.failed_dimension_count ?? 0,
    pr_draft_output_artifact_count: pr.pr_draft_output_artifact_count ?? 0,
    pr_draft_section_count: pr.pr_draft_section_count ?? 0,
    test_evidence_count: pr.test_evidence_count ?? 0,
    risk_count: pr.risk_count ?? 0,
    rollback_step_count: pr.rollback_step_count ?? 0,
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
    task_state_write_performed: boundary.task_state_write_performed,
    issue_mutation_performed: boundary.issue_mutation_performed,
    command_execution_performed: boundary.command_execution_performed,
    git_command_executed: boundary.git_command_executed,
    filesystem_mutation_performed: boundary.filesystem_mutation_performed,
    patch_application_performed: boundary.patch_application_performed,
    protected_mutation_performed: boundary.protected_mutation_performed,
    workflow_transition_performed: boundary.workflow_transition_performed,
    runtime_execution_performed: boundary.runtime_execution_performed,
    external_agent_invocation_performed: boundary.external_agent_invocation_performed,
    pull_request_creation_performed: boundary.pull_request_creation_performed,
    github_api_called: boundary.github_api_called,
    branch_push_performed: boundary.branch_push_performed,
    merge_performed: boundary.merge_performed,
    release_performed: boundary.release_performed,
    rollback_execution_performed: boundary.rollback_execution_performed,
    delivery_execution_performed: boundary.delivery_execution_performed,
    route_execution_performed: boundary.route_execution_performed,
    server_started: boundary.server_started,
    protected_action_executed: boundary.protected_action_executed,
    external_transfer_performed: boundary.external_transfer_performed,
    network_access_performed: boundary.network_access_performed,
    raw_secret_material_exposed: boundary.raw_secret_material_exposed,
    provider_key_exposed: boundary.provider_key_exposed,
    legal_advice_generated: boundary.legal_advice_generated,
    client_facing_output_generated: boundary.client_facing_output_generated,
    human_review_required: boundary.human_review_required,
    desktop_read_only: boundary.desktop_read_only,
    desktop_source_of_truth: boundary.desktop_source_of_truth,
    windows_baseline_stability_preserved: boundary.windows_baseline_stability_preserved,
    mac_windows_completion_instability_guard: boundary.mac_windows_completion_instability_guard,
    validation_item_count: validationItems.length,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function chainStage({ generatedAt, stageId, label, sourceId, passed, recordCount, linkCount, evidence }) {
  const row = {
    schema_version: "personal-dev-e2e-chain-stage.v1",
    chain_stage_id: `personal-dev-e2e.chain.${stageId}`,
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
    schema_version: "personal-dev-e2e-gate-result.v1",
    gate_result_id: `personal-dev-e2e.gate.${gateId}`,
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
    schema_version: "personal-dev-e2e-validation-item.v1",
    validation_id: `personal-dev-e2e.validation.${checkId}`,
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
  lines.push("# Personal Dev E2E Report");
  lines.push("");
  lines.push(`Status: ${result.summary.personal_dev_e2e_report_status}`);
  lines.push(`Phase: ${PHASE_SLOT} after ${PREVIOUS_PHASE_SLOT}`);
  lines.push(`Scenario rows: ${result.summary.passed_scenario_row_count}/${result.summary.scenario_row_count}`);
  lines.push(`Chain stages: ${result.summary.passed_chain_stage_count}/${result.summary.chain_stage_count}`);
  lines.push(`Issue->audit complete: ${result.summary.issue_to_audit_path_complete}`);
  lines.push(`Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("This report is read-only. It records no issue mutation, task-state write, command execution, git command, PR creation, GitHub API call, branch push, merge, release, rollback execution, protected mutation, external-agent execution, legal advice, or client-facing output.");
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
  const merged = { ...DEFAULT_PERSONAL_DEV_E2E_REPORT_INPUTS, ...options };
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

export async function runPersonalDevE2eReportCli(argv = process.argv.slice(2)) {
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
  const result = await runPersonalDevE2eReport(options);
  console.log(`Personal dev E2E report written to ${result.output_dir}`);
  console.log(`Status: ${result.summary.personal_dev_e2e_report_status}`);
  console.log(`Scenario rows: ${result.summary.passed_scenario_row_count}/${result.summary.scenario_row_count}`);
  console.log(`Chain stages: ${result.summary.passed_chain_stage_count}/${result.summary.chain_stage_count}`);
  console.log(`Validation errors: ${result.summary.validation_error_count}`);
}
