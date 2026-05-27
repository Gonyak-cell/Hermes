import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_OUT_DIR = "artifacts/workflow-post-run-gates/latest";
export const DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS = {
  workflowInRunGateFrameworkPath: "artifacts/workflow-in-run-gates/latest/workflow-in-run-gate-framework.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  evidenceCoverageScorePath: "artifacts/evidence-coverage/latest/evidence-coverage-score.json",
  citationObjectStorePath: "artifacts/citation-object-store/latest/citation-object-store.json",
  evidenceRegressionTestsPath: "artifacts/evidence-regression-tests/latest/evidence-regression-tests.json",
  approvalAuthorityLedgerPath: "artifacts/approval-authority/latest/approval-authority-ledger.json",
  outputDestinationPolicyEnforcementPath: "artifacts/output-destination-policy/latest/output-destination-policy-enforcement.json",
  protectedDeliveryQueuePath: "artifacts/delivery-queue/latest/protected-delivery-queue.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const POST_RUN_GATE_FRAMEWORK_CONTRACT_ID = "workflow-post-run-gate-framework.v1";
const POST_RUN_GATE_RECORD_SCHEMA_VERSION = "workflow-post-run-gate-record.v1";
const POST_RUN_GATE_DECISION_SCHEMA_VERSION = "workflow-post-run-gate-decision.v1";
const POST_RUN_GUARD_SCHEMA_VERSION = "workflow-post-run-guard.v1";
const REQUIRED_POST_RUN_GATE_TYPES = ["evidence_gate", "citation_gate", "test_gate", "approval_gate", "delivery_gate"];

export async function runWorkflowPostRunGateFramework(options = {}) {
  const result = await buildWorkflowPostRunGateFramework(options);
  if (options.write !== false) await writeWorkflowPostRunGateFramework(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow post-run gate framework validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowPostRunGateFramework(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowInRunGateFramework = await readJson(inputs.workflow_in_run_gate_framework_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const evidenceCoverageScore = await readJson(inputs.evidence_coverage_score_path);
  const citationObjectStore = await readJson(inputs.citation_object_store_path);
  const evidenceRegressionTests = await readJson(inputs.evidence_regression_tests_path);
  const approvalAuthorityLedger = await readJson(inputs.approval_authority_ledger_path);
  const outputDestinationPolicyEnforcement = await readJson(inputs.output_destination_policy_enforcement_path);
  const protectedDeliveryQueue = await readJson(inputs.protected_delivery_queue_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const buildResult = buildPostRunGateRecords({
    agentRunLedger,
    evidenceCoverageScore,
    citationObjectStore,
    evidenceRegressionTests,
    approvalAuthorityLedger,
    outputDestinationPolicyEnforcement,
    protectedDeliveryQueue,
    generatedAt,
  });
  const validationItems = validateWorkflowPostRunGateFramework({
    workflowInRunGateFramework,
    agentRunLedger,
    evidenceCoverageScore,
    citationObjectStore,
    evidenceRegressionTests,
    approvalAuthorityLedger,
    outputDestinationPolicyEnforcement,
    protectedDeliveryQueue,
    packageJson,
    roadmapText,
    buildResult,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-post-run-gate-framework.v1",
    generated_at: generatedAt,
    workflow_post_run_gate_framework_id: `workflow-post-run-gate-framework.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_in_run_gate_framework: sourceSummary(workflowInRunGateFramework, "workflow_in_run_gate_framework_status"),
      agent_run_ledger: sourceSummary(agentRunLedger, "agent_run_ledger_status"),
      evidence_coverage_score: sourceSummary(evidenceCoverageScore, "evidence_coverage_status"),
      citation_object_store: sourceSummary(citationObjectStore, "citation_object_store_status"),
      evidence_regression_tests: sourceSummary(evidenceRegressionTests, "evidence_regression_status"),
      approval_authority_ledger: sourceSummary(approvalAuthorityLedger, "approval_authority_status"),
      output_destination_policy_enforcement: sourceSummary(outputDestinationPolicyEnforcement, "output_destination_policy_status"),
      protected_delivery_queue: {
        schema_version: protectedDeliveryQueue.schema_version ?? null,
        generated_at: protectedDeliveryQueue.generated_at ?? null,
        status: protectedDeliveryQueue.summary?.ready_action_count === 0 && protectedDeliveryQueue.summary?.delivered_action_count === 0 ? "blocked_for_review" : "unknown",
        validation_error_count: protectedDeliveryQueue.validation?.errors?.length ?? 0,
      },
    },
    post_run_gate_framework_contract: buildPostRunGateFrameworkContract(generatedAt),
    post_run_gate_records: buildResult.postRunGateRecords,
    post_run_gate_decision_records: buildResult.postRunGateDecisionRecords,
    post_run_guard_records: buildResult.postRunGuardRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowPostRunGateFramework({
      workflowInRunGateFramework,
      agentRunLedger,
      evidenceCoverageScore,
      citationObjectStore,
      evidenceRegressionTests,
      approvalAuthorityLedger,
      outputDestinationPolicyEnforcement,
      protectedDeliveryQueue,
      buildResult,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowPostRunGateFrameworkMarkdown(result),
  };
}

export async function writeWorkflowPostRunGateFramework(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-post-run-gate-framework.json"), serializablePostRunGateFramework(result));
  await writeJson(path.join(outDir, "post-run-gate-records.json"), {
    schema_version: "workflow-post-run-gate-records.v1",
    generated_at: result.generated_at,
    post_run_gate_record_count: result.post_run_gate_records.length,
    post_run_gate_records: result.post_run_gate_records,
  });
  await writeJson(path.join(outDir, "post-run-gate-decisions.json"), {
    schema_version: "workflow-post-run-gate-decision-records.v1",
    generated_at: result.generated_at,
    post_run_gate_decision_record_count: result.post_run_gate_decision_records.length,
    post_run_gate_decision_records: result.post_run_gate_decision_records,
  });
  await writeJson(path.join(outDir, "post-run-gate-guards.json"), {
    schema_version: "workflow-post-run-guard-records.v1",
    generated_at: result.generated_at,
    post_run_guard_record_count: result.post_run_guard_records.length,
    post_run_guard_records: result.post_run_guard_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-post-run-gate-framework-validation-report.v1",
    generated_at: result.generated_at,
    workflow_post_run_gate_framework_id: result.workflow_post_run_gate_framework_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowPostRunGateFrameworkCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowPostRunGateFramework(args);
    console.log(`Workflow post-run gate framework ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_post_run_gate_framework_status}`);
    console.log(`Gate records: ${result.summary.post_run_gate_record_count}`);
    console.log(`Gate sets: ${result.summary.agent_run_with_post_run_gate_set_count}`);
    console.log(`Held decisions: ${result.summary.held_for_human_review_decision_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildPostRunGateRecords({
  agentRunLedger,
  evidenceCoverageScore,
  citationObjectStore,
  evidenceRegressionTests,
  approvalAuthorityLedger,
  outputDestinationPolicyEnforcement,
  protectedDeliveryQueue,
  generatedAt,
}) {
  const agentRuns = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const coverageScoresByMatter = groupBy(evidenceCoverageScore.evidence_coverage_catalog?.coverage_scores ?? [], "matter_id");
  const citationsByMatter = groupBy(citationObjectStore.citation_catalog?.citations ?? [], "matter_id");
  const regressionCasesByMatter = groupBy(evidenceRegressionTests.evidence_regression_catalog?.regression_test_cases ?? [], "matter_id");
  const artifactAuthorityByOutput = groupBy(approvalAuthorityLedger.approval_authority_catalog?.artifact_authority_decisions ?? [], "output_artifact_id");
  const deliveryAuthorityByOutput = groupBy(approvalAuthorityLedger.approval_authority_catalog?.delivery_action_authority_decisions ?? [], "output_artifact_id");
  const approvalRequestsByOutput = groupBy(approvalAuthorityLedger.approval_authority_catalog?.approval_request_authority_decisions ?? [], "output_artifact_id");
  const artifactDestinationGatesByOutput = groupBy(outputDestinationPolicyEnforcement.output_destination_policy_catalog?.artifact_destination_gates ?? [], "output_artifact_id");
  const deliveryDestinationGatesByOutput = groupBy(outputDestinationPolicyEnforcement.output_destination_policy_catalog?.delivery_action_destination_gates ?? [], "output_artifact_id");
  const protectedDeliveryActionsByOutput = groupBy(protectedDeliveryQueue.delivery_actions ?? [], "artifact_id");

  const postRunGateRecords = [];
  const postRunGateDecisionRecords = [];
  const postRunGuardRecords = [];

  for (const agentRun of [...agentRuns].sort(by("agent_run_id"))) {
    const context = {
      agentRun,
      coverageScores: coverageScoresByMatter.get(agentRun.matter_id) ?? [],
      citations: citationsByMatter.get(agentRun.matter_id) ?? [],
      regressionCases: regressionCasesByMatter.get(agentRun.matter_id) ?? [],
      artifactAuthorityDecisions: artifactAuthorityByOutput.get(agentRun.output_ref) ?? [],
      deliveryAuthorityDecisions: deliveryAuthorityByOutput.get(agentRun.output_ref) ?? [],
      approvalRequestAuthorityDecisions: approvalRequestsByOutput.get(agentRun.output_ref) ?? [],
      artifactDestinationGates: artifactDestinationGatesByOutput.get(agentRun.output_ref) ?? [],
      deliveryDestinationGates: deliveryDestinationGatesByOutput.get(agentRun.output_ref) ?? [],
      protectedDeliveryActions: protectedDeliveryActionsByOutput.get(agentRun.output_ref) ?? [],
      evidenceRegressionTests,
      generatedAt,
    };
    const gateRecords = [
      buildEvidencePostRunGateRecord(context),
      buildCitationPostRunGateRecord(context),
      buildTestPostRunGateRecord(context),
      buildApprovalPostRunGateRecord(context),
      buildDeliveryPostRunGateRecord(context),
    ];
    postRunGateRecords.push(...gateRecords);
    const decisionRecord = buildPostRunGateDecisionRecord(agentRun, gateRecords, generatedAt);
    postRunGateDecisionRecords.push(decisionRecord);
    postRunGuardRecords.push(buildPostRunGuardRecord(agentRun, gateRecords, decisionRecord, generatedAt));
  }

  return {
    postRunGateRecords,
    postRunGateDecisionRecords,
    postRunGuardRecords,
  };
}

function buildEvidencePostRunGateRecord(context) {
  const { agentRun, coverageScores, generatedAt } = context;
  const requiresEvidence = hasGate(agentRun, "evidence_coverage_gate") || agentRun.domain_pack === "law-firm";
  const missingRequired = sum(coverageScores.map((score) => score.missing_required_dimension_count ?? 0));
  const matchingCoverage = coverageScores.length > 0;
  const reviewRequired = requiresEvidence || missingRequired > 0 || coverageScores.some((score) => score.human_review_required);
  const gateStatus = reviewRequired ? "review_required" : "passed";
  return buildPostRunGateRecord({
    agentRun,
    gateType: "evidence_gate",
    gateDecision: gateStatus === "passed" ? "allow" : "review",
    gateStatus,
    humanReviewRequired: reviewRequired,
    sourceRecordIds: coverageScores.map((score) => score.coverage_score_id).filter(Boolean),
    sourceStatuses: unique(coverageScores.map((score) => score.coverage_status)),
    reasonCodes: [
      matchingCoverage ? "matter_coverage_scores_resolved" : "no_matter_coverage_scores_for_output",
      requiresEvidence ? "agent_run_requires_evidence_coverage_gate" : "agent_run_evidence_gate_not_required_by_source",
      missingRequired > 0 ? "required_evidence_dimensions_missing" : "required_evidence_dimensions_covered_or_not_applicable",
      "attorney_review_required_before_client_facing_use",
    ],
    generatedAt,
    metadata: {
      matching_coverage_score_count: coverageScores.length,
      missing_required_dimension_count: missingRequired,
      full_coverage_score_count: coverageScores.filter((score) => score.coverage_status === "complete").length,
      partial_coverage_score_count: coverageScores.filter((score) => score.coverage_status === "partial").length,
    },
  });
}

function buildCitationPostRunGateRecord(context) {
  const { agentRun, citations, generatedAt } = context;
  const requiresCitation = hasGate(agentRun, "citation_gate") || agentRun.domain_pack === "law-firm";
  const boundCitationCount = citations.filter((citation) => citation.source_binding_status === "bound").length;
  const unboundCitationCount = citations.filter((citation) => citation.source_binding_status !== "bound").length;
  const reviewRequired = requiresCitation || citations.some((citation) => citation.human_review_required || citation.citation_status === "needs_review");
  const gateStatus = reviewRequired ? "review_required" : "passed";
  return buildPostRunGateRecord({
    agentRun,
    gateType: "citation_gate",
    gateDecision: gateStatus === "passed" ? "allow" : "review",
    gateStatus,
    humanReviewRequired: reviewRequired,
    sourceRecordIds: citations.map((citation) => citation.citation_id).filter(Boolean),
    sourceStatuses: unique(citations.map((citation) => citation.citation_status)),
    reasonCodes: [
      citations.length > 0 ? "matter_citations_resolved" : "no_matter_citations_for_output",
      requiresCitation ? "agent_run_requires_citation_gate" : "agent_run_citation_gate_not_required_by_source",
      unboundCitationCount === 0 ? "all_matching_citations_source_bound" : "unbound_citation_detected",
      "citation_review_required_before_client_facing_use",
    ],
    generatedAt,
    metadata: {
      matching_citation_count: citations.length,
      source_span_bound_citation_count: boundCitationCount,
      unbound_citation_count: unboundCitationCount,
      needs_review_citation_count: citations.filter((citation) => citation.citation_status === "needs_review").length,
    },
  });
}

function buildTestPostRunGateRecord(context) {
  const { agentRun, regressionCases, evidenceRegressionTests, generatedAt } = context;
  const failedCaseCount = evidenceRegressionTests.summary?.failed_regression_case_count ?? regressionCases.filter((item) => item.status !== "passed").length;
  const suiteStatus = evidenceRegressionTests.summary?.evidence_regression_status ?? "unknown";
  const gateStatus = suiteStatus === "complete" && failedCaseCount === 0 ? "passed" : "blocked";
  return buildPostRunGateRecord({
    agentRun,
    gateType: "test_gate",
    gateDecision: gateStatus === "passed" ? "allow" : "block",
    gateStatus,
    humanReviewRequired: agentRun.verification_status !== "verified",
    sourceRecordIds: regressionCases.map((item) => item.regression_test_case_id).filter(Boolean),
    sourceStatuses: unique(regressionCases.map((item) => item.status)),
    reasonCodes: [
      suiteStatus === "complete" ? "evidence_regression_suite_complete" : "evidence_regression_suite_not_complete",
      failedCaseCount === 0 ? "post_run_regression_tests_passed" : "post_run_regression_tests_failed",
      hasGate(agentRun, "test_gate") ? "agent_run_requires_test_gate" : "agent_run_test_gate_not_required_by_source",
    ],
    generatedAt,
    metadata: {
      matching_regression_case_count: regressionCases.length,
      failed_regression_case_count: failedCaseCount,
      passed_regression_case_count: regressionCases.filter((item) => item.status === "passed").length,
    },
  });
}

function buildApprovalPostRunGateRecord(context) {
  const { agentRun, artifactAuthorityDecisions, deliveryAuthorityDecisions, approvalRequestAuthorityDecisions, generatedAt } = context;
  const decisions = [...artifactAuthorityDecisions, ...deliveryAuthorityDecisions, ...approvalRequestAuthorityDecisions];
  const pendingApproval = decisions.some((decision) => String(decision.approval_status ?? decision.request_status ?? "").startsWith("pending"));
  const assignmentRequired = decisions.some((decision) => String(decision.assignment_status ?? decision.decision_status ?? "").includes("required"));
  const humanRequired = decisions.some((decision) => decision.human_authority_required || decision.nonhuman_authority_blocked)
    || agentRun.verification_status !== "verified";
  const gateStatus = humanRequired || pendingApproval || assignmentRequired ? "review_required" : "passed";
  return buildPostRunGateRecord({
    agentRun,
    gateType: "approval_gate",
    gateDecision: gateStatus === "passed" ? "allow" : "review",
    gateStatus,
    humanReviewRequired: gateStatus !== "passed",
    sourceRecordIds: decisions.map((decision) => decision.artifact_authority_decision_id ?? decision.delivery_action_authority_decision_id ?? decision.approval_request_authority_decision_id).filter(Boolean),
    sourceStatuses: unique(decisions.map((decision) => decision.gate_status ?? decision.decision_status ?? decision.request_status ?? decision.approval_status).filter(Boolean)),
    reasonCodes: [
      decisions.length > 0 ? "approval_authority_decisions_resolved" : "approval_authority_decision_not_scoped_to_output",
      pendingApproval ? "approval_pending" : "approval_not_pending",
      assignmentRequired ? "approval_authority_assignment_required" : "approval_authority_assignment_not_required",
      humanRequired ? "human_authority_required" : "human_authority_not_required",
    ],
    generatedAt,
    metadata: {
      artifact_authority_decision_count: artifactAuthorityDecisions.length,
      delivery_authority_decision_count: deliveryAuthorityDecisions.length,
      approval_request_authority_decision_count: approvalRequestAuthorityDecisions.length,
      pending_approval_count: decisions.filter((decision) => String(decision.approval_status ?? decision.request_status ?? "").startsWith("pending")).length,
      nonhuman_authority_blocked_count: decisions.filter((decision) => decision.nonhuman_authority_blocked).length,
    },
  });
}

function buildDeliveryPostRunGateRecord(context) {
  const { agentRun, artifactDestinationGates, deliveryDestinationGates, protectedDeliveryActions, generatedAt } = context;
  const gates = [...artifactDestinationGates, ...deliveryDestinationGates];
  const protectedAction = protectedDeliveryActions.some((action) => action.protected_action) || gates.some((gate) => gate.protected_action || gate.protected_delivery_action_count > 0);
  const executed = gates.some((gate) => gate.executed) || protectedDeliveryActions.some((action) => action.delivery_status === "delivered");
  const readyForDelivery = gates.some((gate) => gate.ready_for_delivery) || protectedDeliveryActions.some((action) => action.delivery_status === "ready");
  const pendingOrBlocked = gates.some((gate) => String(gate.gate_status ?? gate.final_action_status ?? "").includes("requires") || String(gate.final_action_status ?? gate.delivery_state ?? "").includes("blocked"))
    || protectedDeliveryActions.some((action) => String(action.delivery_status ?? "").includes("blocked"));
  const gateStatus = executed || readyForDelivery || pendingOrBlocked || protectedAction ? "review_required" : "passed";
  return buildPostRunGateRecord({
    agentRun,
    gateType: "delivery_gate",
    gateDecision: gateStatus === "passed" ? "allow" : "review",
    gateStatus,
    humanReviewRequired: gateStatus !== "passed",
    sourceRecordIds: [
      ...gates.map((gate) => gate.artifact_destination_gate_id ?? gate.delivery_action_destination_gate_id),
      ...protectedDeliveryActions.map((action) => action.delivery_action_id),
    ].filter(Boolean),
    sourceStatuses: unique([
      ...gates.map((gate) => gate.gate_status ?? gate.final_action_status ?? gate.delivery_state),
      ...protectedDeliveryActions.map((action) => action.delivery_status),
    ].filter(Boolean)),
    reasonCodes: [
      gates.length > 0 || protectedDeliveryActions.length > 0 ? "delivery_destination_gates_resolved" : "delivery_destination_gate_not_scoped_to_output",
      protectedAction ? "protected_delivery_action_present" : "protected_delivery_action_absent",
      executed ? "delivery_action_executed" : "delivery_action_not_executed",
      readyForDelivery ? "delivery_ready_detected" : "delivery_not_ready",
      pendingOrBlocked ? "delivery_pending_or_blocked_for_review" : "delivery_not_pending_or_blocked",
    ],
    generatedAt,
    metadata: {
      artifact_destination_gate_count: artifactDestinationGates.length,
      delivery_destination_gate_count: deliveryDestinationGates.length,
      protected_delivery_action_count: protectedDeliveryActions.length,
      executed_delivery_count: Number(executed),
      ready_for_delivery_count: Number(readyForDelivery),
    },
  });
}

function buildPostRunGateRecord({
  agentRun,
  gateType,
  gateDecision,
  gateStatus,
  humanReviewRequired,
  sourceRecordIds,
  sourceStatuses,
  reasonCodes,
  generatedAt,
  metadata,
}) {
  const recordBase = {
    schema_version: POST_RUN_GATE_RECORD_SCHEMA_VERSION,
    post_run_gate_record_id: `post-run-gate.${slugify(agentRun.agent_run_id)}.${gateType.replace(/_/g, "-")}`,
    post_run_gate_framework_contract_id: POST_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    gate_type: gateType,
    gate_stage: "post_run",
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    run_ledger_id: agentRun.run_ledger_id ?? null,
    matter_id: agentRun.matter_id,
    domain_pack: agentRun.domain_pack,
    runtime_id: agentRun.runtime_id,
    capability_id: agentRun.capability_id,
    output_ref: agentRun.output_ref,
    source_required_gates: [...(agentRun.required_gates ?? [])].sort(),
    source_record_ids: sourceRecordIds,
    source_statuses: sourceStatuses,
    post_run_gate_decision: gateDecision,
    post_run_gate_status: gateStatus,
    execution_allowed: false,
    execution_performed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    client_facing_ready: false,
    delivery_ready: false,
    final_action_executed: false,
    human_review_required: Boolean(humanReviewRequired),
    required_after_execution: true,
    reason_codes: unique(reasonCodes.filter(Boolean)),
    recorded_at: generatedAt,
    metadata,
  };
  return {
    ...recordBase,
    post_run_gate_hash: hashValue(recordBase),
  };
}

function buildPostRunGateDecisionRecord(agentRun, gateRecords, generatedAt) {
  const blockedCount = gateRecords.filter((record) => record.post_run_gate_status === "blocked").length;
  const reviewCount = gateRecords.filter((record) => record.post_run_gate_status === "review_required").length;
  const decision = blockedCount > 0 ? "blocked_after_run" : reviewCount > 0 ? "hold_for_human_review" : "ready_after_post_run_gates";
  const decisionBase = {
    schema_version: POST_RUN_GATE_DECISION_SCHEMA_VERSION,
    post_run_gate_decision_record_id: `post-run-gate-decision.${slugify(agentRun.agent_run_id)}`,
    post_run_gate_framework_contract_id: POST_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    matter_id: agentRun.matter_id,
    domain_pack: agentRun.domain_pack,
    runtime_id: agentRun.runtime_id,
    output_ref: agentRun.output_ref,
    required_gate_types: REQUIRED_POST_RUN_GATE_TYPES,
    resolved_gate_types: unique(gateRecords.map((record) => record.gate_type)),
    post_run_gate_record_ids: gateRecords.map((record) => record.post_run_gate_record_id),
    post_run_gate_decision: decision,
    post_run_gate_set_status: blockedCount > 0 ? "blocked" : reviewCount > 0 ? "review_required" : "passed",
    passed_gate_count: gateRecords.filter((record) => record.post_run_gate_status === "passed").length,
    review_required_gate_count: reviewCount,
    blocked_gate_count: blockedCount,
    execution_allowed: false,
    execution_performed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    client_facing_ready: false,
    delivery_ready: false,
    final_action_executed: false,
    human_review_required: true,
    post_run_only: true,
    decided_at: generatedAt,
  };
  return {
    ...decisionBase,
    post_run_gate_decision_hash: hashValue(decisionBase),
  };
}

function buildPostRunGuardRecord(agentRun, gateRecords, decisionRecord, generatedAt) {
  const missingGateTypes = REQUIRED_POST_RUN_GATE_TYPES.filter((gateType) => !gateRecords.some((record) => record.gate_type === gateType));
  const guardBase = {
    schema_version: POST_RUN_GUARD_SCHEMA_VERSION,
    post_run_guard_record_id: `post-run-guard.${slugify(agentRun.agent_run_id)}`,
    post_run_gate_framework_contract_id: POST_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    agent_run_id: agentRun.agent_run_id,
    workflow_run_id: agentRun.workflow_run_id,
    matter_id: agentRun.matter_id,
    domain_pack: agentRun.domain_pack,
    runtime_id: agentRun.runtime_id,
    output_ref: agentRun.output_ref,
    post_run_gate_decision_record_id: decisionRecord.post_run_gate_decision_record_id,
    required_gate_types: REQUIRED_POST_RUN_GATE_TYPES,
    missing_gate_types: missingGateTypes,
    gate_record_count: gateRecords.length,
    evidence_gate_status: gateRecords.find((record) => record.gate_type === "evidence_gate")?.post_run_gate_status ?? "missing",
    citation_gate_status: gateRecords.find((record) => record.gate_type === "citation_gate")?.post_run_gate_status ?? "missing",
    test_gate_status: gateRecords.find((record) => record.gate_type === "test_gate")?.post_run_gate_status ?? "missing",
    approval_gate_status: gateRecords.find((record) => record.gate_type === "approval_gate")?.post_run_gate_status ?? "missing",
    delivery_gate_status: gateRecords.find((record) => record.gate_type === "delivery_gate")?.post_run_gate_status ?? "missing",
    post_run_guard_status: missingGateTypes.length === 0 && gateRecords.every((record) => record.post_run_gate_status !== "blocked") ? "passed" : "blocked",
    post_run_gate_set_status: decisionRecord.post_run_gate_set_status,
    execution_allowed: false,
    execution_performed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    client_facing_ready: false,
    delivery_ready: false,
    final_action_executed: false,
    human_review_required: true,
    recorded_at: generatedAt,
  };
  return {
    ...guardBase,
    post_run_guard_hash: hashValue(guardBase),
  };
}

function validateWorkflowPostRunGateFramework({
  workflowInRunGateFramework,
  agentRunLedger,
  evidenceCoverageScore,
  citationObjectStore,
  evidenceRegressionTests,
  approvalAuthorityLedger,
  outputDestinationPolicyEnforcement,
  protectedDeliveryQueue,
  packageJson,
  roadmapText,
  buildResult,
}) {
  const items = [];
  const agentRuns = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const gateRecords = buildResult.postRunGateRecords;
  const decisionRecords = buildResult.postRunGateDecisionRecords;
  const guardRecords = buildResult.postRunGuardRecords;
  const gatesByAgentRun = groupBy(gateRecords, "agent_run_id");

  pushCheck(items, "source.workflow_in_run_gate_framework", "workflow_in_run_gate_framework_complete", workflowInRunGateFramework.summary?.workflow_in_run_gate_framework_status === "complete" && workflowInRunGateFramework.validation?.valid !== false, "Workflow in-run gate framework must be complete.");
  pushCheck(items, "source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunLedger.validation?.valid !== false, "Agent run ledger must be complete.");
  pushCheck(items, "source.evidence_coverage_score", "evidence_coverage_complete", evidenceCoverageScore.summary?.evidence_coverage_status === "complete" && evidenceCoverageScore.validation?.valid !== false, "Evidence coverage score must be complete.");
  pushCheck(items, "source.citation_object_store", "citation_object_store_complete", citationObjectStore.summary?.citation_object_store_status === "complete" && citationObjectStore.validation?.valid !== false, "Citation object store must be complete.");
  pushCheck(items, "source.evidence_regression_tests", "evidence_regression_complete", evidenceRegressionTests.summary?.evidence_regression_status === "complete" && evidenceRegressionTests.validation?.valid !== false, "Evidence regression tests must be complete.");
  pushCheck(items, "source.approval_authority_ledger", "approval_authority_complete", approvalAuthorityLedger.summary?.approval_authority_status === "complete" && approvalAuthorityLedger.validation?.valid !== false, "Approval authority ledger must be complete.");
  pushCheck(items, "source.output_destination_policy", "output_destination_policy_complete", outputDestinationPolicyEnforcement.summary?.output_destination_policy_status === "complete" && outputDestinationPolicyEnforcement.validation?.valid !== false, "Output destination policy enforcement must be complete.");
  pushCheck(items, "source.protected_delivery_queue", "protected_delivery_queue_blocks_final_action", protectedDeliveryQueue.summary?.delivered_action_count === 0 && protectedDeliveryQueue.summary?.ready_action_count === 0, "Protected delivery queue must not have delivered or ready final actions.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:post-run-gates"]), "package.json must expose npm run workflows:post-run-gates.");
  pushCheck(items, "roadmap.phase_189", "phase_189_documented", roadmapText.includes("P189") && roadmapText.includes("post-run gate"), "Phase ledger must keep the P189 post-run gate slot visible.");
  pushCheck(items, "post_run_gate_records", "five_gates_per_agent_run", gateRecords.length === agentRuns.length * REQUIRED_POST_RUN_GATE_TYPES.length, "Every agent run must have evidence, citation, test, approval, and delivery post-run gates.");
  pushCheck(items, "post_run_gate_records", "required_gate_set_complete", agentRuns.every((agentRun) => sameSet((gatesByAgentRun.get(agentRun.agent_run_id) ?? []).map((record) => record.gate_type), REQUIRED_POST_RUN_GATE_TYPES)), "Each agent run must resolve all required post-run gates.");
  pushCheck(items, "post_run_gate_records", "test_gate_passed", gateRecords.filter((record) => record.gate_type === "test_gate").every((record) => record.post_run_gate_status === "passed"), "Post-run test gates must pass regression coverage.");
  pushCheck(items, "post_run_gate_records", "post_run_gates_do_not_execute", gateRecords.every((record) => !record.execution_allowed && !record.execution_performed && !record.external_transfer_allowed && !record.protected_action_execution_allowed && !record.client_facing_ready && !record.delivery_ready && !record.final_action_executed), "Post-run gate records must not execute tools, transfers, protected actions, delivery, or client-facing release.");
  pushCheck(items, "post_run_gate_decision_records", "decision_per_agent_run", decisionRecords.length === agentRuns.length, "Every agent run must have one post-run decision record.");
  pushCheck(items, "post_run_gate_decision_records", "decisions_hold_for_review", decisionRecords.length > 0 && decisionRecords.every((record) => record.post_run_gate_decision === "hold_for_human_review" && record.post_run_only && !record.execution_allowed && !record.final_action_executed), "Post-run decisions must hold for human review without final action.");
  pushCheck(items, "post_run_guard_records", "guard_per_agent_run", guardRecords.length === agentRuns.length, "Every agent run must have one post-run guard record.");
  pushCheck(items, "post_run_guard_records", "guards_pass_required_presence", guardRecords.every((record) => record.missing_gate_types.length === 0 && record.post_run_guard_status === "passed"), "Post-run guards must pass required gate presence checks.");
  pushCheck(items, "post_run_guard_records", "guards_hold_delivery", guardRecords.every((record) => record.human_review_required && !record.client_facing_ready && !record.delivery_ready && !record.final_action_executed), "Post-run guards must require human review and avoid delivery.");
  return items;
}

function summarizeWorkflowPostRunGateFramework({
  workflowInRunGateFramework,
  agentRunLedger,
  evidenceCoverageScore,
  citationObjectStore,
  evidenceRegressionTests,
  approvalAuthorityLedger,
  outputDestinationPolicyEnforcement,
  protectedDeliveryQueue,
  buildResult,
  validation,
  validationItems,
}) {
  const gateRecords = buildResult.postRunGateRecords;
  const decisionRecords = buildResult.postRunGateDecisionRecords;
  const guardRecords = buildResult.postRunGuardRecords;
  const gateTypeCounts = countByObject(gateRecords, "gate_type");
  return {
    workflow_post_run_gate_framework_status: validation.errors.length === 0 ? "complete" : "blocked",
    post_run_gate_framework_contract_id: POST_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    source_workflow_in_run_gate_framework_status: workflowInRunGateFramework.summary?.workflow_in_run_gate_framework_status ?? "unknown",
    source_agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    source_evidence_coverage_status: evidenceCoverageScore.summary?.evidence_coverage_status ?? "unknown",
    source_citation_object_store_status: citationObjectStore.summary?.citation_object_store_status ?? "unknown",
    source_evidence_regression_status: evidenceRegressionTests.summary?.evidence_regression_status ?? "unknown",
    source_approval_authority_status: approvalAuthorityLedger.summary?.approval_authority_status ?? "unknown",
    source_output_destination_policy_status: outputDestinationPolicyEnforcement.summary?.output_destination_policy_status ?? "unknown",
    source_delivery_queue_ready_action_count: protectedDeliveryQueue.summary?.ready_action_count ?? 0,
    source_delivery_queue_delivered_action_count: protectedDeliveryQueue.summary?.delivered_action_count ?? 0,
    source_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? agentRunLedger.agent_run_catalog?.agent_run_records?.length ?? 0,
    source_in_run_guard_count: workflowInRunGateFramework.summary?.in_run_guard_count ?? 0,
    source_coverage_score_count: evidenceCoverageScore.summary?.coverage_score_count ?? 0,
    source_missing_required_dimension_count: evidenceCoverageScore.summary?.missing_required_dimension_count ?? 0,
    source_citation_count: citationObjectStore.summary?.citation_count ?? 0,
    source_regression_case_count: evidenceRegressionTests.summary?.regression_test_case_count ?? 0,
    source_failed_regression_case_count: evidenceRegressionTests.summary?.failed_regression_case_count ?? 0,
    source_authority_decision_count: approvalAuthorityLedger.summary?.authority_decision_count ?? 0,
    source_delivery_action_count: outputDestinationPolicyEnforcement.summary?.delivery_action_count ?? protectedDeliveryQueue.summary?.delivery_action_count ?? 0,
    post_run_gate_record_count: gateRecords.length,
    post_run_gate_decision_count: decisionRecords.length,
    post_run_guard_count: guardRecords.length,
    agent_run_with_post_run_gate_set_count: guardRecords.length,
    evidence_gate_count: gateTypeCounts.evidence_gate ?? 0,
    citation_gate_count: gateTypeCounts.citation_gate ?? 0,
    test_gate_count: gateTypeCounts.test_gate ?? 0,
    approval_gate_count: gateTypeCounts.approval_gate ?? 0,
    delivery_gate_count: gateTypeCounts.delivery_gate ?? 0,
    passed_gate_count: gateRecords.filter((record) => record.post_run_gate_status === "passed").length,
    review_required_gate_count: gateRecords.filter((record) => record.post_run_gate_status === "review_required").length,
    blocked_gate_count: gateRecords.filter((record) => record.post_run_gate_status === "blocked").length,
    human_review_required_gate_count: gateRecords.filter((record) => record.human_review_required).length,
    test_gate_passed_count: gateRecords.filter((record) => record.gate_type === "test_gate" && record.post_run_gate_status === "passed").length,
    all_required_gate_set_count: guardRecords.filter((record) => record.missing_gate_types.length === 0).length,
    post_run_guard_passed_count: guardRecords.filter((record) => record.post_run_guard_status === "passed").length,
    held_for_human_review_decision_count: decisionRecords.filter((record) => record.post_run_gate_decision === "hold_for_human_review").length,
    ready_after_post_run_gate_decision_count: decisionRecords.filter((record) => record.post_run_gate_decision === "ready_after_post_run_gates").length,
    blocked_after_run_decision_count: decisionRecords.filter((record) => record.post_run_gate_decision === "blocked_after_run").length,
    execution_allowed_count: gateRecords.filter((record) => record.execution_allowed).length + decisionRecords.filter((record) => record.execution_allowed).length + guardRecords.filter((record) => record.execution_allowed).length,
    execution_performed_count: gateRecords.filter((record) => record.execution_performed).length + decisionRecords.filter((record) => record.execution_performed).length + guardRecords.filter((record) => record.execution_performed).length,
    external_transfer_allowed_count: gateRecords.filter((record) => record.external_transfer_allowed).length + decisionRecords.filter((record) => record.external_transfer_allowed).length + guardRecords.filter((record) => record.external_transfer_allowed).length,
    protected_action_executed_count: gateRecords.filter((record) => record.protected_action_execution_allowed).length + decisionRecords.filter((record) => record.protected_action_execution_allowed).length + guardRecords.filter((record) => record.protected_action_execution_allowed).length,
    client_facing_ready_count: gateRecords.filter((record) => record.client_facing_ready).length + decisionRecords.filter((record) => record.client_facing_ready).length + guardRecords.filter((record) => record.client_facing_ready).length,
    delivery_ready_count: gateRecords.filter((record) => record.delivery_ready).length + decisionRecords.filter((record) => record.delivery_ready).length + guardRecords.filter((record) => record.delivery_ready).length,
    final_action_executed_count: gateRecords.filter((record) => record.final_action_executed).length + decisionRecords.filter((record) => record.final_action_executed).length + guardRecords.filter((record) => record.final_action_executed).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_gate_type: gateTypeCounts,
    by_post_run_gate_status: countByObject(gateRecords, "post_run_gate_status"),
    by_post_run_gate_decision: countByObject(decisionRecords, "post_run_gate_decision"),
    by_post_run_guard_status: countByObject(guardRecords, "post_run_guard_status"),
  };
}

function buildPostRunGateFrameworkContract(generatedAt) {
  return {
    schema_version: "workflow-post-run-gate-framework-contract.v1",
    generated_at: generatedAt,
    post_run_gate_framework_contract_id: POST_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    post_run_gate_record_schema_version: POST_RUN_GATE_RECORD_SCHEMA_VERSION,
    post_run_gate_decision_schema_version: POST_RUN_GATE_DECISION_SCHEMA_VERSION,
    post_run_guard_schema_version: POST_RUN_GUARD_SCHEMA_VERSION,
    required_gate_types: REQUIRED_POST_RUN_GATE_TYPES,
    evidence_rule: "post-run output candidates must preserve evidence coverage and hold missing or review-required coverage for human review.",
    citation_rule: "post-run output candidates must preserve source-bound citations and hold review-required citations before client-facing release.",
    test_rule: "post-run test gates pass only when regression suites are complete with zero failed cases.",
    approval_rule: "post-run approval gates hold pending authority assignment or human approval before final action.",
    delivery_rule: "post-run delivery gates preserve draft/final-action separation and never execute delivery from the gate artifact.",
  };
}

function renderWorkflowPostRunGateFrameworkMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Post-run Gate Framework");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_post_run_gate_framework_status}`);
  lines.push("");
  lines.push(`- Gate records: ${summary.post_run_gate_record_count}`);
  lines.push(`- Gate sets: ${summary.agent_run_with_post_run_gate_set_count}`);
  lines.push(`- Review-required gates: ${summary.review_required_gate_count}`);
  lines.push(`- Held decisions: ${summary.held_for_human_review_decision_count}`);
  lines.push(`- Client/delivery/final action ready: ${summary.client_facing_ready_count}/${summary.delivery_ready_count}/${summary.final_action_executed_count}`);
  lines.push(`- Execution/external/protected: ${summary.execution_performed_count}/${summary.external_transfer_allowed_count}/${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Gate Sets");
  lines.push("");
  for (const guard of result.post_run_guard_records) {
    lines.push(`- ${guard.post_run_guard_record_id}: ${guard.post_run_guard_status}, set=${guard.post_run_gate_set_status}, gates=${guard.gate_record_count}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    workflow_in_run_gate_framework_path: path.resolve(options.workflowInRunGateFrameworkPath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.workflowInRunGateFrameworkPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.agentRunLedgerPath),
    evidence_coverage_score_path: path.resolve(options.evidenceCoverageScorePath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.evidenceCoverageScorePath),
    citation_object_store_path: path.resolve(options.citationObjectStorePath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.citationObjectStorePath),
    evidence_regression_tests_path: path.resolve(options.evidenceRegressionTestsPath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.evidenceRegressionTestsPath),
    approval_authority_ledger_path: path.resolve(options.approvalAuthorityLedgerPath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.approvalAuthorityLedgerPath),
    output_destination_policy_enforcement_path: path.resolve(options.outputDestinationPolicyEnforcementPath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.outputDestinationPolicyEnforcementPath),
    protected_delivery_queue_path: path.resolve(options.protectedDeliveryQueuePath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.protectedDeliveryQueuePath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowInRunGateFrameworkPath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.workflowInRunGateFrameworkPath,
    agentRunLedgerPath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.agentRunLedgerPath,
    evidenceCoverageScorePath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.evidenceCoverageScorePath,
    citationObjectStorePath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.citationObjectStorePath,
    evidenceRegressionTestsPath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.evidenceRegressionTestsPath,
    approvalAuthorityLedgerPath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.approvalAuthorityLedgerPath,
    outputDestinationPolicyEnforcementPath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.outputDestinationPolicyEnforcementPath,
    protectedDeliveryQueuePath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.protectedDeliveryQueuePath,
    packagePath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_POST_RUN_GATE_FRAMEWORK_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-in-run-gates") parsed.workflowInRunGateFrameworkPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--evidence-coverage") parsed.evidenceCoverageScorePath = argv[++index];
    else if (arg === "--citation-store") parsed.citationObjectStorePath = argv[++index];
    else if (arg === "--evidence-regression") parsed.evidenceRegressionTestsPath = argv[++index];
    else if (arg === "--approval-authority") parsed.approvalAuthorityLedgerPath = argv[++index];
    else if (arg === "--output-destination-policy") parsed.outputDestinationPolicyEnforcementPath = argv[++index];
    else if (arg === "--protected-delivery-queue") parsed.protectedDeliveryQueuePath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else if (arg === "--out-dir" || arg === "--out") parsed.outDir = argv[++index];
    else if (arg === "--run-at") parsed.runAt = argv[++index];
    else if (arg === "--check") {
      parsed.check = true;
      parsed.write = false;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/workflow-post-run-gate-framework.mjs [options]

Options:
  --workflow-in-run-gates <path> workflow-in-run-gate-framework.json path.
  --agent-run-ledger <path> agent-run-ledger.json path.
  --evidence-coverage <path> evidence-coverage-score.json path.
  --citation-store <path> citation-object-store.json path.
  --evidence-regression <path> evidence-regression-tests.json path.
  --approval-authority <path> approval-authority-ledger.json path.
  --output-destination-policy <path> output-destination-policy-enforcement.json path.
  --protected-delivery-queue <path> protected-delivery-queue.json path.
  --package <path> package.json path.
  --roadmap <path> final completion phase ledger path.
  --out-dir <path> output directory.
  --run-at <iso> deterministic generated_at timestamp.
  --check validate only without writing artifacts.
`);
}

function hasGate(agentRun, gateId) {
  return (agentRun.required_gates ?? []).includes(gateId);
}

function serializablePostRunGateFramework(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "passed")
    .map((item) => ({ path: item.path, message: item.message }));
  return { valid: errors.length === 0, errors };
}

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sourceSummary(artifact, statusKey) {
  return {
    schema_version: artifact.schema_version ?? null,
    generated_at: artifact.generated_at ?? null,
    status: artifact.summary?.[statusKey] ?? artifact.ledger_status ?? (artifact.validation?.valid === true ? "complete" : "unknown"),
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
  };
}

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function dateStamp(iso) {
  return iso.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function slugify(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function by(key) {
  return (left, right) => String(left[key] ?? "").localeCompare(String(right[key] ?? ""));
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items ?? []) {
    const groupKey = item?.[key];
    if (groupKey == null) continue;
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push(item);
  }
  return groups;
}

function countByObject(items, key) {
  const counts = {};
  for (const item of items ?? []) {
    const value = item?.[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null))];
}

function sameSet(actual, expected) {
  const actualSet = new Set(actual);
  return actualSet.size === expected.length && expected.every((value) => actualSet.has(value));
}

function sum(values) {
  return values.reduce((total, value) => total + Number(value ?? 0), 0);
}
