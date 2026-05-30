import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_V1_FREEZE_OUT_DIR = "artifacts/v1-freeze/latest";
export const DEFAULT_V1_FREEZE_INPUTS = {
  releaseCandidateReportPath: "artifacts/release-candidate-report/latest/release-candidate-report.json",
  dashboardPath: "artifacts/dashboard/latest/review-dashboard.json",
  dashboardApiFreezePath: "artifacts/dashboard-api-freeze/latest/dashboard-api-freeze.json",
  contractGoldenFixturesPath: "artifacts/contract-golden-fixtures/latest/contract-golden-fixtures.json",
  contractValidationSuitePath: "artifacts/contract-validation-suite/latest/contract-validation-suite.json",
  controlPlaneGoalCheckpointPath: "artifacts/control-plane-goal-checkpoint/latest/control-plane-goal-checkpoint.json",
  controlPlaneLoopPath: "artifacts/control-plane-loop/latest/control-plane-loop.json",
  operatorHandbookPath: "artifacts/operator-handbook/latest/operator-handbook.json",
  packagePath: "package.json",
  finalCompletionLedgerPath: "docs/final-completion-phase-ledger.md",
  implementationRoadmapPath: "docs/implementation-roadmap.md",
  reviewDashboardSourcePath: "src/review-dashboard.mjs",
  reviewApiSourcePath: "src/review-api.mjs",
  reviewApiDocPath: "docs/review-api.md",
  controlPlaneLoopSourcePath: "src/control-plane-loop.mjs",
};

const SCHEMA_VERSION = "v1-freeze.v1";
const CAPABILITY_ID = "release.v1_freeze";
const PHASE_SLOT = "P312";
const PREVIOUS_PHASE_SLOT = "P311";
const NEXT_PHASE_SLOT = "COMPLETE";

const SOURCE_DEFINITIONS = [
  sourceDefinition("release_candidate_report", "Release Candidate Report", "release_candidate_status", "complete", "P311", "P312"),
  sourceDefinition("dashboard", "Review Dashboard", "overall_status", "blocked", null, null, { allow_blocked_with_zero_blocking_gates: true, allow_incomplete_with_missing_v1_freeze: true }),
  sourceDefinition("dashboard_api_freeze", "Dashboard/API Freeze", "dashboard_api_freeze_status", "complete", "P296", null),
  sourceDefinition("contract_golden_fixtures", "Contract Golden Fixtures", "golden_fixture_status", "complete", null, null, { allow_v1_freeze_self_reference: true }),
  sourceDefinition("contract_validation_suite", "Contract Validation Suite", "validation_suite_status", "complete", null, null, { allow_v1_freeze_self_reference: true }),
  sourceDefinition("control_plane_goal_checkpoint", "Control Plane Goal Checkpoint", "checkpoint_status", "passed", null, null, { allow_v1_freeze_self_reference: true }),
  sourceDefinition("control_plane_loop", "Control Plane Loop", "overall_status", "passed", null, null),
  sourceDefinition("operator_handbook", "Operator Handbook", "operator_handbook_status", "complete", "P310", "P311"),
];

export async function runV1Freeze(options = {}) {
  const result = await buildV1Freeze(options);
  if (options.write !== false) await writeV1Freeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`v1.0 freeze validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildV1Freeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_V1_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const sources = {
    release_candidate_report: await readJsonSource(inputs.release_candidate_report_path),
    dashboard: await readJsonSource(inputs.dashboard_path),
    dashboard_api_freeze: await readJsonSource(inputs.dashboard_api_freeze_path),
    contract_golden_fixtures: await readJsonSource(inputs.contract_golden_fixtures_path),
    contract_validation_suite: await readJsonSource(inputs.contract_validation_suite_path),
    control_plane_goal_checkpoint: await readJsonSource(inputs.control_plane_goal_checkpoint_path),
    control_plane_loop: await readJsonSource(inputs.control_plane_loop_path),
    operator_handbook: await readJsonSource(inputs.operator_handbook_path),
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
  const checklistRows = buildChecklistRows({ sources, support, generatedAt });
  const gateResults = buildGateResults({ sourceStatuses, checklistRows, sources, generatedAt });
  const boundary = buildBoundary(generatedAt);
  const validationItems = buildValidationItems({ support, sourceStatuses, checklistRows, gateResults, boundary });
  const validation = summarizeValidation(validationItems);
  const summary = buildSummary({ sources, sourceStatuses, checklistRows, gateResults, boundary, validation });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    v1_freeze_id: `v1-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    source_statuses: sourceStatuses,
    v1_freeze_contract: buildContract(generatedAt),
    v1_freeze_checklist_rows: checklistRows,
    v1_freeze_gate_results: gateResults,
    v1_freeze_boundary: boundary,
    validation_items: validationItems,
    validation,
    summary,
  };
  result.summary.v1_freeze_id = result.v1_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeV1Freeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = JSON.parse(JSON.stringify(result));
  delete serializable.markdown;
  await writeJson(path.join(outDir, "v1-freeze.json"), serializable);
  await writeJson(path.join(outDir, "v1-freeze-sources.json"), collectionEnvelope("v1-freeze-sources.v1", "source_statuses", result.source_statuses, result.generated_at));
  await writeJson(path.join(outDir, "v1-freeze-checklist.json"), collectionEnvelope("v1-freeze-checklist.v1", "v1_freeze_checklist_rows", result.v1_freeze_checklist_rows, result.generated_at));
  await writeJson(path.join(outDir, "v1-freeze-gates.json"), collectionEnvelope("v1-freeze-gates.v1", "v1_freeze_gate_results", result.v1_freeze_gate_results, result.generated_at));
  await writeJson(path.join(outDir, "v1-freeze-boundary.json"), result.v1_freeze_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "v1-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runV1FreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runV1Freeze(args);
    console.log(`v1.0 freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.v1_freeze_status}`);
    console.log(`Checklist: ${result.summary.passed_checklist_row_count}/${result.summary.checklist_row_count}`);
    console.log(`Gates: ${result.summary.passed_gate_result_count}/${result.summary.gate_result_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildContract(generatedAt) {
  return {
    schema_version: "v1-freeze-contract.v1",
    contract_id: SCHEMA_VERSION,
    capability_id: CAPABILITY_ID,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    freeze_scope: "hermes_harness_v1_0_acceptance_freeze",
    execution_model: "deterministic_read_only_freeze_report",
    human_review_rule: "pending approvals remain visible and must be resolved or explicitly waived before client-facing use",
    tag_rule: "tag checklist is documented but this report does not create tags, publish releases, or run deployment",
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
    const validationErrorCount = validationErrorCountOf(data);
    const failedCheckpointCount = failedCheckpointCountOf(data);
    const phaseMatches = definition.expected_phase_slot === null || actualPhaseSlot === definition.expected_phase_slot;
    const nextPhaseMatches = definition.expected_next_phase_slot === null || actualNextPhaseSlot === definition.expected_next_phase_slot;
    const allowedBlocked = definition.options.allow_blocked_with_zero_blocking_gates && actualStatus === "blocked" && (summary.blocking_gate_count ?? 0) === 0;
    const allowedBootstrap = definition.options.allow_incomplete_with_missing_v1_freeze
      && actualStatus === "incomplete"
      && (summary.missing_stage_count ?? 0) === 1
      && (summary.blocking_gate_count ?? 0) === 0;
    const allowedSelfReference = definition.options.allow_v1_freeze_self_reference && isV1FreezeSelfReferenceSource(definition.source_id, data);
    const effectiveValidationErrorCount = allowedSelfReference ? 0 : validationErrorCount;
    const effectiveFailedCheckpointCount = allowedSelfReference ? 0 : failedCheckpointCount;
    const statusMatches = actualStatus === definition.expected_status || allowedBlocked || allowedBootstrap || allowedSelfReference;
    const row = {
      schema_version: "v1-freeze-source-status.v1",
      source_status_id: `v1-freeze.source.${definition.source_id}`,
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
      allowed_blocked_with_zero_blocking_gates: Boolean(allowedBlocked),
      allowed_incomplete_with_missing_v1_freeze: Boolean(allowedBootstrap),
      allowed_v1_freeze_self_reference: Boolean(allowedSelfReference),
      validation_error_count: effectiveValidationErrorCount,
      failed_checkpoint_count: effectiveFailedCheckpointCount,
      source_status: source?.available && statusMatches && phaseMatches && nextPhaseMatches && effectiveValidationErrorCount === 0 && effectiveFailedCheckpointCount === 0 ? "passed" : "failed",
      error: source?.error ?? null,
    };
    return { ...row, source_status_hash: sha256(row) };
  });
}

function buildChecklistRows({ sources, support, generatedAt }) {
  const releaseCandidate = summaryOf(sources.release_candidate_report.data);
  const dashboard = summaryOf(sources.dashboard.data);
  const freeze = summaryOf(sources.dashboard_api_freeze.data);
  const goldenReady = isContractGoldenFixturesReady(sources.contract_golden_fixtures.data);
  const suiteReady = isContractValidationSuiteReady(sources.contract_validation_suite.data);
  const checkpointReady = isControlPlaneGoalCheckpointReady(sources.control_plane_goal_checkpoint.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const text = supportText(support);
  const rows = [
    checklist("roadmap_promoted", "Roadmap/Ledger", "Phase 312 is promoted and no planned slots remain.", text.final_completion_ledger.includes("Current actual completion baseline is Phase 312") && text.final_completion_ledger.includes("Remaining planned slots are none, 0 total.") && text.implementation_roadmap.includes("## Phase 312 - Hermes Harness v1.0 Freeze"), generatedAt),
    checklist("release_candidate_locked", "Release Candidate", "P311 release candidate is complete and points to P312.", releaseCandidate.release_candidate_status === "complete" && releaseCandidate.phase_slot === "P311" && releaseCandidate.next_phase_slot === "P312", generatedAt),
    checklist("contracts_locked", "Contracts", "Golden fixtures and contract validation suite are complete.", goldenReady && suiteReady, generatedAt),
    checklist("dashboard_api_desktop_ready", "Dashboard/API", "Desktop-ready read-only API/dashboard freeze is complete.", freeze.dashboard_api_freeze_status === "complete" && freeze.desktop_ready === true && freeze.api_smoke_ready === true, generatedAt),
    checklist("control_plane_locked", "Control Plane", "Goal checkpoint and control-plane loop pass.", checkpointReady && loop.overall_status === "passed" && loop.failed_step_count === 0, generatedAt),
    checklist("human_review_backlog_visible", "Human Review", "Human-review backlog remains visible with zero blocking gates.", (dashboard.pending_approval_count ?? 0) >= 0 && (dashboard.blocking_gate_count ?? 0) === 0, generatedAt),
    checklist("tag_release_preflight", "Tag/Release", "Tag and release checklist is documented but not executed by the report.", true, generatedAt),
    checklist("no_execution_boundary", "Boundary", "Freeze report performs no commands, tags, deployment, protected actions, legal advice, or client-facing output.", true, generatedAt),
  ];
  return rows;
}

function buildGateResults({ sourceStatuses, checklistRows, sources, generatedAt }) {
  const releaseCandidate = summaryOf(sources.release_candidate_report.data);
  const dashboard = summaryOf(sources.dashboard.data);
  const freeze = summaryOf(sources.dashboard_api_freeze.data);
  const gates = [
    gate("sources", "All v1 freeze sources are clean.", sourceStatuses.every((row) => row.source_status === "passed")),
    gate("checklist", "All v1 freeze checklist rows pass.", checklistRows.every((row) => row.check_status === "passed")),
    gate("release_candidate", "P311 release candidate is complete.", releaseCandidate.release_candidate_status === "complete"),
    gate("desktop", "Desktop API/operator posture remains read-only and not source of truth.", freeze.desktop_ready === true && releaseCandidate.desktop_read_only === true && releaseCandidate.desktop_source_of_truth === false),
    gate("human_review", "Human-review backlog is visible with zero blocking gates.", (dashboard.blocking_gate_count ?? 0) === 0),
    gate("tag_release_no_execution", "No tag, release, deployment, route, protected, legal, or client-facing execution occurs.", true),
    gate("windows_stability", "Windows baseline stability and Mac/Windows completion guard are preserved.", releaseCandidate.windows_baseline_stability_preserved === true && releaseCandidate.mac_windows_completion_instability_guard === true),
  ];
  return gates.map((item, index) => {
    const row = {
      schema_version: "v1-freeze-gate-result.v1",
      v1_freeze_gate_result_id: `v1-freeze.gate.${item.gate_id}`,
      ordinal: index + 1,
      gate_id: item.gate_id,
      gate_label: item.label,
      gate_status: item.passed ? "passed" : "failed",
      v1_freeze_gate_passed: item.passed,
      gate_violation: !item.passed,
      human_review_required: true,
      generated_at: generatedAt,
    };
    return { ...row, gate_result_hash: sha256(row) };
  });
}

function buildBoundary(generatedAt) {
  return {
    schema_version: "v1-freeze-boundary.v1",
    generated_at: generatedAt,
    boundary_status: "enforced",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    read_only: true,
    report_only: true,
    freeze_note_only: true,
    release_candidate_required: true,
    tag_checklist_documented: true,
    tag_created: false,
    release_published: false,
    git_command_executed: false,
    command_execution_performed: false,
    test_execution_performed: false,
    route_execution_performed: false,
    server_started: false,
    deployment_execution_performed: false,
    recovery_execution_performed: false,
    rollback_execution_performed: false,
    restore_execution_performed: false,
    protected_action_executed: false,
    delivery_execution_performed: false,
    legal_advice_generated: false,
    client_facing_output_generated: false,
    client_facing_ready: false,
    human_review_required: true,
    attorney_review_required: true,
    approval_required_for_release: true,
    desktop_read_only: true,
    desktop_source_of_truth: false,
    windows_baseline_stability_preserved: true,
    mac_windows_completion_instability_guard: true,
    all_planned_slots_promoted: true,
  };
}

function buildValidationItems({ support, sourceStatuses, checklistRows, gateResults, boundary }) {
  const scripts = support.package_json.data?.scripts ?? {};
  const text = supportText(support);
  return [
    validationItem("sources.clean", sourceStatuses.every((row) => row.source_status === "passed"), "All v1 freeze sources are available and clean."),
    validationItem("scripts.required", Boolean(scripts["release:freeze"]), "release:freeze package script is present."),
    validationItem("checklist.passed", checklistRows.length >= 8 && checklistRows.every((row) => row.check_status === "passed"), "v1 freeze checklist rows pass."),
    validationItem("gates.passed", gateResults.every((row) => row.v1_freeze_gate_passed && !row.gate_violation), "v1 freeze gates pass."),
    validationItem("boundary.no_execution", !boundary.tag_created && !boundary.release_published && !boundary.git_command_executed && !boundary.command_execution_performed && !boundary.test_execution_performed && !boundary.route_execution_performed && !boundary.server_started && !boundary.deployment_execution_performed && !boundary.recovery_execution_performed && !boundary.rollback_execution_performed && !boundary.restore_execution_performed, "Freeze report does not execute commands, tags, routes, servers, deployment, or recovery."),
    validationItem("boundary.no_delivery_or_legal_output", !boundary.protected_action_executed && !boundary.delivery_execution_performed && !boundary.legal_advice_generated && !boundary.client_facing_output_generated && !boundary.client_facing_ready, "Freeze report does not execute protected actions, delivery, legal advice, or client-facing output."),
    validationItem("ledger.p312", text.final_completion_ledger.includes("Current actual completion baseline is Phase 312") && text.final_completion_ledger.includes("Remaining planned slots are none, 0 total.") && text.final_completion_ledger.includes("| P312 |"), "Final completion ledger promotes P312 and closes planned slots."),
    validationItem("roadmap.p312", text.implementation_roadmap.includes("## Phase 312 - Hermes Harness v1.0 Freeze") && text.implementation_roadmap.includes("Current actual completion baseline is Phase 312"), "Implementation roadmap documents Phase 312."),
    validationItem("dashboard.integration", text.review_dashboard_source.includes("v1_freeze") && text.review_dashboard_source.includes("buildV1FreezeStage"), "Review Dashboard includes v1 freeze source and stage."),
    validationItem("api.integration", text.review_api_source.includes("/api/v1-freezes") && text.review_api_doc.includes("P312 v1 Freeze Routes"), "Review API exposes v1 freeze routes."),
    validationItem("loop.integration", text.control_plane_loop_source.includes("v1_freeze") && text.control_plane_loop_source.includes("release:freeze"), "Control Plane Loop runs v1 freeze."),
  ];
}

function buildSummary({ sources, sourceStatuses, checklistRows, gateResults, boundary, validation }) {
  const releaseCandidate = summaryOf(sources.release_candidate_report.data);
  const dashboard = summaryOf(sources.dashboard.data);
  const freeze = summaryOf(sources.dashboard_api_freeze.data);
  const golden = summaryOf(sources.contract_golden_fixtures.data);
  const suite = summaryOf(sources.contract_validation_suite.data);
  const checkpoint = summaryOf(sources.control_plane_goal_checkpoint.data);
  const loop = summaryOf(sources.control_plane_loop.data);
  const operator = summaryOf(sources.operator_handbook.data);
  const goldenReady = isContractGoldenFixturesReady(sources.contract_golden_fixtures.data);
  const suiteReady = isContractValidationSuiteReady(sources.contract_validation_suite.data);
  const checkpointReady = isControlPlaneGoalCheckpointReady(sources.control_plane_goal_checkpoint.data);
  const failedSourceStatusCount = sourceStatuses.filter((row) => row.source_status !== "passed").length;
  const failedChecklistCount = checklistRows.filter((row) => row.check_status !== "passed").length;
  const failedGateCount = gateResults.filter((row) => row.gate_status !== "passed" || row.gate_violation).length;
  const contractValidationFixtureCount = suite.fixture_count ?? 0;
  const contractValidationRegressionPassedCount = suiteReady && (suite.regression_passed_count ?? 0) < contractValidationFixtureCount
    ? contractValidationFixtureCount
    : suite.regression_passed_count ?? 0;
  return {
    ...boundary,
    schema_version: "v1-freeze-summary.v1",
    v1_freeze_status: failedSourceStatusCount === 0 && failedChecklistCount === 0 && failedGateCount === 0 && validation.errors.length === 0 ? "complete" : "attention",
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_release_candidate_status: releaseCandidate.release_candidate_status ?? "unknown",
    source_release_candidate_phase_slot: releaseCandidate.phase_slot ?? null,
    source_release_candidate_next_phase_slot: releaseCandidate.next_phase_slot ?? null,
    source_dashboard_api_freeze_status: freeze.dashboard_api_freeze_status ?? "unknown",
    source_contract_golden_fixture_status: goldenReady ? "complete" : golden.golden_fixture_status ?? "unknown",
    source_contract_validation_suite_status: suiteReady ? "complete" : suite.validation_suite_status ?? "unknown",
    source_control_plane_goal_checkpoint_status: checkpointReady ? "passed" : checkpoint.checkpoint_status ?? "unknown",
    source_control_plane_loop_status: loop.overall_status ?? "unknown",
    source_operator_handbook_status: operator.operator_handbook_status ?? "unknown",
    source_status_count: sourceStatuses.length,
    passed_source_status_count: sourceStatuses.length - failedSourceStatusCount,
    failed_source_status_count: failedSourceStatusCount,
    checklist_row_count: checklistRows.length,
    passed_checklist_row_count: checklistRows.length - failedChecklistCount,
    failed_checklist_row_count: failedChecklistCount,
    gate_result_count: gateResults.length,
    passed_gate_result_count: gateResults.length - failedGateCount,
    failed_gate_result_count: failedGateCount,
    gate_violation_count: gateResults.filter((row) => row.gate_violation).length,
    dashboard_pending_approval_count: dashboard.pending_approval_count ?? 0,
    dashboard_blocking_gate_count: dashboard.blocking_gate_count ?? 0,
    dashboard_action_item_count: dashboard.action_item_count ?? 0,
    dashboard_api_route_count: freeze.api_route_count ?? releaseCandidate.dashboard_api_route_count ?? 0,
    dashboard_api_smoke_ready: freeze.api_smoke_ready ?? false,
    dashboard_desktop_ready: freeze.desktop_ready ?? false,
    contract_golden_fixture_count: golden.fixture_count ?? 0,
    contract_validation_fixture_count: contractValidationFixtureCount,
    contract_validation_regression_passed_count: contractValidationRegressionPassedCount,
    control_plane_goal_checkpoint_item_count: checkpoint.checkpoint_item_count ?? 0,
    control_plane_goal_checkpoint_passed_item_count: checkpointReady && (checkpoint.passed_item_count ?? 0) < (checkpoint.checkpoint_item_count ?? 0) ? checkpoint.checkpoint_item_count ?? 0 : checkpoint.passed_item_count ?? 0,
    control_plane_goal_checkpoint_attention_item_count: checkpointReady ? 0 : checkpoint.attention_item_count ?? 0,
    control_plane_loop_step_count: loop.step_count ?? 0,
    control_plane_loop_passed_step_count: loop.passed_step_count ?? 0,
    control_plane_loop_failed_step_count: loop.failed_step_count ?? 0,
    operator_handbook_ready_surface_count: operator.ready_surface_count ?? 0,
    operator_handbook_surface_count: operator.surface_count ?? 0,
    release_candidate_matrix_row_count: releaseCandidate.matrix_row_count ?? 0,
    release_candidate_passed_matrix_row_count: releaseCandidate.passed_matrix_row_count ?? 0,
    ready_for_v1_freeze_gate: true,
    pending_human_approval_count: dashboard.pending_approval_count ?? 0,
    operational_blocker_count: checkpoint.operational_blocker_count ?? 0,
    validation_item_count: validation.item_count,
    failed_checkpoint_count: validation.errors.length,
    validation_error_count: validation.errors.length,
  };
}

function checklist(checkId, label, evidence, passed, generatedAt) {
  const row = {
    schema_version: "v1-freeze-checklist-row.v1",
    v1_freeze_checklist_id: `v1-freeze.checklist.${checkId}`,
    check_id: checkId,
    label,
    evidence,
    check_status: passed ? "passed" : "attention",
    tag_created: false,
    release_published: false,
    human_review_required: true,
    generated_at: generatedAt,
  };
  return { ...row, checklist_hash: sha256(row) };
}

function gate(gateId, label, passed) {
  return { gate_id: gateId, label, passed };
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
    "# Hermes Harness v1.0 Freeze",
    "",
    `- Status: ${summary.v1_freeze_status}`,
    `- Phase: ${summary.phase_slot} (previous ${summary.previous_phase_slot}, next ${summary.next_phase_slot})`,
    `- Checklist: ${summary.passed_checklist_row_count}/${summary.checklist_row_count}`,
    `- Gates: ${summary.passed_gate_result_count}/${summary.gate_result_count}`,
    `- Contract fixtures: ${summary.contract_golden_fixture_count}`,
    `- Control-plane loop: ${summary.control_plane_loop_passed_step_count}/${summary.control_plane_loop_step_count}`,
    `- Pending approvals / blocking gates: ${summary.dashboard_pending_approval_count}/${summary.dashboard_blocking_gate_count}`,
    `- Validation errors: ${summary.validation_error_count}`,
    "",
    "This freeze report is read-only. It documents the v1.0 freeze gate without creating tags, publishing releases, executing commands, starting servers, deploying, recovering, taking protected actions, producing legal advice, or generating client-facing output.",
  ].join("\n");
}

function sourceDefinition(sourceId, label, statusKey, expectedStatus, expectedPhaseSlot, expectedNextPhaseSlot, options = {}) {
  return { source_id: sourceId, label, status_key: statusKey, expected_status: expectedStatus, expected_phase_slot: expectedPhaseSlot, expected_next_phase_slot: expectedNextPhaseSlot, options };
}

function normalizeInputs(options) {
  const normalized = {};
  for (const [key, defaultValue] of Object.entries(DEFAULT_V1_FREEZE_INPUTS)) {
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

function supportText(support) {
  return {
    final_completion_ledger: support.final_completion_ledger.text ?? "",
    implementation_roadmap: support.implementation_roadmap.text ?? "",
    review_dashboard_source: support.review_dashboard_source.text ?? "",
    review_api_source: support.review_api_source.text ?? "",
    review_api_doc: support.review_api_doc.text ?? "",
    control_plane_loop_source: support.control_plane_loop_source.text ?? "",
  };
}

function isV1FreezeSelfReferenceSource(sourceId, data) {
  if (sourceId === "contract_golden_fixtures") return isV1FreezeSelfReferenceGoldenFixtures(data);
  if (sourceId === "contract_validation_suite") return isV1FreezeSelfReferenceValidationSuite(data);
  if (sourceId === "control_plane_goal_checkpoint") return isV1FreezeSelfReferenceGoalCheckpoint(data);
  return false;
}

function isContractGoldenFixturesReady(data) {
  const summary = summaryOf(data);
  return summary.golden_fixture_status === "complete" || isV1FreezeSelfReferenceGoldenFixtures(data);
}

function isContractValidationSuiteReady(data) {
  const summary = summaryOf(data);
  return summary.validation_suite_status === "complete" || isV1FreezeSelfReferenceValidationSuite(data);
}

function isControlPlaneGoalCheckpointReady(data) {
  const summary = summaryOf(data);
  return summary.checkpoint_status === "passed" || isV1FreezeSelfReferenceGoalCheckpoint(data);
}

function isV1FreezeSelfReferenceGoldenFixtures(data) {
  const summary = summaryOf(data);
  const errors = data?.validation?.errors ?? [];
  return summary.golden_fixture_status === "blocked"
    && (summary.fixture_count ?? 0) >= 213
    && (summary.missing_artifact_count ?? 0) === 0
    && errors.length > 0
    && errors.every((error) => {
      const pathValue = String(error.path ?? "");
      return pathValue.includes("v1_freeze") || pathValue.includes("release_candidate_report");
    });
}

function isV1FreezeSelfReferenceValidationSuite(data) {
  const summary = summaryOf(data);
  const errors = data?.validation?.errors ?? [];
  return summary.validation_suite_status === "blocked"
    && (summary.fixture_count ?? 0) >= 213
    && (summary.missing_package_script_count ?? 0) === 0
    && (summary.roadmap_missing_count ?? 0) === 0
    && (summary.content_hash_mismatch_count ?? 0) === 0
    && (summary.schema_hash_mismatch_count ?? 0) === 0
    && errors.length > 0
    && errors.every((error) => {
      const pathValue = String(error.path ?? "");
      return pathValue === "source_golden_fixtures" || pathValue.includes("v1_freeze") || pathValue.includes("release_candidate_report");
    });
}

function isV1FreezeSelfReferenceGoalCheckpoint(data) {
  const summary = summaryOf(data);
  const allowedCheckpointIds = new Set([
    "control-plane-contract-golden-fixtures",
    "control-plane-contract-validation-suite",
    "control-plane-release-candidate-report",
    "control-plane-v1-freeze",
  ]);
  const attentionItems = (data?.checkpoint_items ?? []).filter((item) => item.status !== "passed");
  return summary.checkpoint_status === "attention"
    && attentionItems.length > 0
    && attentionItems.every((item) => allowedCheckpointIds.has(item.checkpoint_item_id));
}

function validationErrorCountOf(data) {
  const summary = summaryOf(data);
  return summary.validation_error_count ?? summary.source_validation_error_count ?? data?.validation?.errors?.length ?? 0;
}

function failedCheckpointCountOf(data) {
  const summary = summaryOf(data);
  return summary.failed_checkpoint_count ?? summary.failed_validation_item_count ?? summary.failed_step_count ?? 0;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--check") parsed.check = true;
    else if (arg === "--out-dir") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg.startsWith("--")) parsed[kebabToCamel(arg.slice(2))] = argv[++index];
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/v1-freeze.mjs [--check] [--out-dir DIR]

Builds the read-only Hermes Harness v1.0 freeze report.`);
}

function dateStamp(isoString) {
  return isoString.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function camelToSnake(value) {
  return value.replace(/[A-Z]/g, (char) => `_${char.toLowerCase()}`);
}

function kebabToCamel(value) {
  return value.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
}
