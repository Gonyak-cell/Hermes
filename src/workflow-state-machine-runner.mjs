import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_OUT_DIR = "artifacts/workflow-state-machine-runner/latest";
export const DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS = {
  workflowDslStateModelPath: "artifacts/workflow-dsl-state-model/latest/workflow-dsl-state-model.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  auditEventLedgerPath: "artifacts/audit-event-ledger/latest/audit-event-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const RUNNER_CONTRACT_ID = "workflow-state-machine-runner.v1";
const RUNNER_ACTOR_ID = "hermes.workflow-state-machine-runner";

export async function runWorkflowStateMachineRunner(options = {}) {
  const result = await buildWorkflowStateMachineRunner(options);
  if (options.write !== false) await writeWorkflowStateMachineRunner(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow state machine runner validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowStateMachineRunner(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_OUT_DIR);
  const inputs = {
    workflow_dsl_state_model_path: path.resolve(options.workflowDslStateModelPath ?? DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.workflowDslStateModelPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.workflowRunLedgerPath),
    audit_event_ledger_path: path.resolve(options.auditEventLedgerPath ?? DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.auditEventLedgerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.roadmapPath),
  };

  const workflowDslStateModel = await readJson(inputs.workflow_dsl_state_model_path);
  const workflowRunLedger = await readJson(inputs.workflow_run_ledger_path);
  const auditEventLedger = await readJson(inputs.audit_event_ledger_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");
  const projections = workflowDslStateModel.workflow_run_state_projections ?? workflowDslStateModel.workflow_dsl_state_model?.workflow_run_state_projections ?? [];
  const blueprints = workflowDslStateModel.workflow_state_blueprints ?? workflowDslStateModel.workflow_dsl_state_model?.workflow_state_blueprints ?? [];
  const transitionRules = workflowDslStateModel.workflow_dsl_transition_rules ?? workflowDslStateModel.workflow_dsl_state_model?.transition_rules ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const transitionGuardRecords = buildTransitionGuardRecords({
    projections,
    blueprints,
    transitionRules,
    workflowRunRecords,
    generatedAt,
  });
  const runnerAuditEventCandidates = buildRunnerAuditEventCandidates({
    transitionGuardRecords,
    auditEventLedger,
    generatedAt,
  });
  const workflowRunnerPlans = buildWorkflowRunnerPlans({
    transitionGuardRecords,
    runnerAuditEventCandidates,
    generatedAt,
  });
  const validationItems = validateWorkflowStateMachineRunner({
    workflowDslStateModel,
    workflowRunLedger,
    auditEventLedger,
    packageJson,
    roadmapText,
    projections,
    transitionGuardRecords,
    runnerAuditEventCandidates,
    workflowRunnerPlans,
  });
  const validation = summarizeValidation(validationItems);
  const runnerContract = buildRunnerContract({ workflowDslStateModel, generatedAt });
  const result = {
    schema_version: "workflow-state-machine-runner.v1",
    generated_at: generatedAt,
    workflow_state_machine_runner_id: `workflow-state-machine-runner.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_dsl_state_model: {
        schema_version: workflowDslStateModel.schema_version ?? null,
        workflow_dsl_state_model_status: workflowDslStateModel.summary?.workflow_dsl_state_model_status ?? "unknown",
        workflow_run_projection_count: workflowDslStateModel.summary?.workflow_run_projection_count ?? projections.length,
        validation_error_count: workflowDslStateModel.summary?.validation_error_count ?? workflowDslStateModel.validation?.errors?.length ?? 0,
      },
      workflow_run_ledger: {
        schema_version: workflowRunLedger.schema_version ?? null,
        workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
        workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
        validation_error_count: workflowRunLedger.summary?.validation_error_count ?? workflowRunLedger.validation?.errors?.length ?? 0,
      },
      audit_event_ledger: {
        schema_version: auditEventLedger.schema_version ?? null,
        audit_event_ledger_status: auditEventLedger.summary?.audit_event_ledger_status ?? "unknown",
        audit_trail_record_count: auditEventLedger.summary?.audit_trail_record_count ?? 0,
        protected_action_executed_audit_record_count: auditEventLedger.summary?.protected_action_executed_audit_record_count ?? 0,
        validation_error_count: auditEventLedger.summary?.validation_error_count ?? auditEventLedger.validation?.errors?.length ?? 0,
      },
    },
    workflow_state_machine_runner: {
      schema_version: "workflow-state-machine-runner.v1",
      runner_contract: runnerContract,
      transition_guard_records: transitionGuardRecords,
      runner_audit_event_candidates: runnerAuditEventCandidates,
      workflow_runner_plans: workflowRunnerPlans,
    },
    runner_contract: runnerContract,
    transition_guard_records: transitionGuardRecords,
    runner_audit_event_candidates: runnerAuditEventCandidates,
    workflow_runner_plans: workflowRunnerPlans,
    summary: summarizeWorkflowStateMachineRunner({
      workflowDslStateModel,
      transitionGuardRecords,
      runnerAuditEventCandidates,
      workflowRunnerPlans,
      validation,
      validationItems,
    }),
    validation_items: validationItems,
    validation,
  };
  return {
    ...result,
    markdown: renderWorkflowStateMachineRunnerMarkdown(result),
  };
}

export async function writeWorkflowStateMachineRunner(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-state-machine-runner.json"), serializableWorkflowStateMachineRunner(result));
  await writeJson(path.join(outDir, "transition-guards.json"), {
    generated_at: result.generated_at,
    transition_guard_count: result.transition_guard_records.length,
    transition_guard_records: result.transition_guard_records,
  });
  await writeJson(path.join(outDir, "runner-audit-events.json"), {
    generated_at: result.generated_at,
    audit_event_candidate_count: result.runner_audit_event_candidates.length,
    runner_audit_event_candidates: result.runner_audit_event_candidates,
  });
  await writeJson(path.join(outDir, "workflow-runner-plans.json"), {
    generated_at: result.generated_at,
    workflow_runner_plan_count: result.workflow_runner_plans.length,
    workflow_runner_plans: result.workflow_runner_plans,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    generated_at: result.generated_at,
    workflow_state_machine_runner_id: result.workflow_state_machine_runner_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowStateMachineRunnerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowStateMachineRunner(args);
    console.log(`Workflow state machine runner written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_state_machine_runner_status}`);
    console.log(`Transition guards: ${result.summary.transition_guard_count}`);
    console.log(`Audit event candidates: ${result.summary.audit_event_candidate_count}`);
    console.log(`Runner plans: ${result.summary.runner_plan_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRunnerContract({ workflowDslStateModel, generatedAt }) {
  return {
    schema_version: "workflow-state-machine-runner-contract.v1",
    generated_at: generatedAt,
    runner_contract_id: RUNNER_CONTRACT_ID,
    source_state_model_version: workflowDslStateModel.summary?.state_model_version ?? "workflow-dsl-state.v1",
    deterministic_runner: true,
    protected_action_execution_allowed: false,
    transition_guard_policy: {
      guard_required_for_every_run_projection: true,
      audit_event_required_for_every_guard: true,
      human_review_states: ["waiting"],
      terminal_states: ["completed", "failed"],
      auto_transition_requires_guard_allow: true,
    },
    audit_event_policy: {
      audit_type: "workflow.transition_guard.evaluated",
      candidate_only: true,
      append_to_event_store: false,
      actor_id: RUNNER_ACTOR_ID,
    },
  };
}

function buildTransitionGuardRecords({ projections, blueprints, transitionRules, workflowRunRecords, generatedAt }) {
  const blueprintByWorkflow = new Map(blueprints.map((blueprint) => [blueprint.workflow_id, blueprint]));
  const recordByRun = new Map(workflowRunRecords.map((record) => [record.workflow_run_id, record]));
  const ruleByEdge = new Map(transitionRules.map((rule) => [`${rule.from_state}->${rule.to_state}`, rule]));
  return projections.map((projection) => {
    const blueprint = blueprintByWorkflow.get(projection.workflow_id);
    const runRecord = recordByRun.get(projection.workflow_run_id);
    const decision = decideNextTransition({ projection, blueprint, ruleByEdge });
    const transitionGuardId = [
      "workflow-transition-guard",
      sanitizeId(projection.workflow_run_id),
      projection.dsl_current_state,
      decision.to_state ?? "terminal",
    ].join(".");
    return {
      schema_version: "workflow-transition-guard.v1",
      transition_guard_id: transitionGuardId,
      workflow_run_id: projection.workflow_run_id,
      workflow_id: projection.workflow_id,
      capability_id: projection.capability_id,
      domain_pack: projection.domain_pack,
      from_dsl_state: projection.dsl_current_state,
      to_dsl_state: decision.to_state,
      transition_rule_id: decision.transition_rule?.transition_rule_id ?? null,
      transition_rule_found: Boolean(decision.transition_rule),
      transition_guard_status: decision.guard_status,
      guard_decision: decision.guard_decision,
      guard_reason: decision.guard_reason,
      transition_allowed: decision.transition_allowed,
      requires_human_review: decision.requires_human_review,
      law_firm_human_review_required: Boolean(projection.law_firm_human_review_required),
      auto_transition_allowed: decision.auto_transition_allowed,
      protected_action_executed: false,
      audit_event_required: true,
      audit_event_candidate_id: `workflow-runner-audit.${sanitizeId(transitionGuardId)}`,
      source_projection_status: projection.state_projection_status,
      source_run_status: projection.source_run_status ?? projection.run_status,
      source_terminal_state: projection.source_terminal_state,
      policy_snapshot_id: runRecord?.policy_snapshot_id ?? null,
      event_envelope_ids: runRecord?.event_envelope_ids ?? [],
      generated_at: generatedAt,
    };
  }).sort((left, right) => left.transition_guard_id.localeCompare(right.transition_guard_id));
}

function decideNextTransition({ projection, blueprint, ruleByEdge }) {
  const fromState = projection.dsl_current_state;
  if (fromState === "completed" || fromState === "failed") {
    return transitionDecision({
      toState: null,
      transitionRule: null,
      guardStatus: "terminal",
      guardDecision: "terminal",
      guardReason: `${fromState}_state_has_no_outgoing_transition`,
      transitionAllowed: false,
      requiresHumanReview: false,
      autoTransitionAllowed: false,
    });
  }
  if (fromState === "waiting") {
    return transitionDecision({
      toState: "approved",
      transitionRule: ruleByEdge.get("waiting->approved"),
      guardStatus: "waiting",
      guardDecision: "hold",
      guardReason: projection.waiting_reason ?? "human_review_pending",
      transitionAllowed: false,
      requiresHumanReview: true,
      autoTransitionAllowed: false,
    });
  }
  if (fromState === "gated") {
    const toState = projection.human_review_required || blueprint?.approval_state_required ? "waiting" : "approved";
    return transitionDecision({
      toState,
      transitionRule: ruleByEdge.get(`gated->${toState}`),
      guardStatus: toState === "waiting" ? "waiting" : "allowed",
      guardDecision: toState === "waiting" ? "hold" : "allow",
      guardReason: toState === "waiting" ? "approval_or_receipt_required" : "gate_approved",
      transitionAllowed: toState !== "waiting",
      requiresHumanReview: toState === "waiting",
      autoTransitionAllowed: toState !== "waiting",
    });
  }
  if (fromState === "approved") {
    return transitionDecision({
      toState: "completed",
      transitionRule: ruleByEdge.get("approved->completed"),
      guardStatus: "allowed",
      guardDecision: "allow",
      guardReason: "all_work_complete",
      transitionAllowed: true,
      requiresHumanReview: false,
      autoTransitionAllowed: true,
    });
  }
  if (fromState === "started") {
    const toState = blueprint?.gate_state_required ? "gated" : "waiting";
    return transitionDecision({
      toState,
      transitionRule: ruleByEdge.get(`started->${toState}`),
      guardStatus: toState === "waiting" ? "waiting" : "allowed",
      guardDecision: toState === "waiting" ? "hold" : "allow",
      guardReason: toState === "waiting" ? "human_input_required" : "gate_required",
      transitionAllowed: toState !== "waiting",
      requiresHumanReview: toState === "waiting",
      autoTransitionAllowed: toState !== "waiting",
    });
  }
  return transitionDecision({
    toState: null,
    transitionRule: null,
    guardStatus: "blocked",
    guardDecision: "reject",
    guardReason: "unknown_dsl_state",
    transitionAllowed: false,
    requiresHumanReview: true,
    autoTransitionAllowed: false,
  });
}

function transitionDecision({
  toState,
  transitionRule,
  guardStatus,
  guardDecision,
  guardReason,
  transitionAllowed,
  requiresHumanReview,
  autoTransitionAllowed,
}) {
  return {
    to_state: toState,
    transition_rule: transitionRule ?? null,
    guard_status: transitionRule || toState === null ? guardStatus : "blocked",
    guard_decision: transitionRule || toState === null ? guardDecision : "reject",
    guard_reason: transitionRule || toState === null ? guardReason : `missing_transition_rule.${toState}`,
    transition_allowed: Boolean(transitionRule && transitionAllowed),
    requires_human_review: requiresHumanReview,
    auto_transition_allowed: Boolean(transitionRule && autoTransitionAllowed),
  };
}

function buildRunnerAuditEventCandidates({ transitionGuardRecords, auditEventLedger, generatedAt }) {
  const sourceAuditStatus = auditEventLedger.summary?.audit_event_ledger_status ?? "unknown";
  return transitionGuardRecords.map((guard) => ({
    schema_version: "workflow-runner-audit-event-candidate.v1",
    audit_event_candidate_id: guard.audit_event_candidate_id,
    transition_guard_id: guard.transition_guard_id,
    workflow_run_id: guard.workflow_run_id,
    workflow_id: guard.workflow_id,
    capability_id: guard.capability_id,
    domain_pack: guard.domain_pack,
    audit_domain: "workflow",
    audit_type: "workflow.transition_guard.evaluated",
    audit_status: sourceAuditStatus === "complete" ? "ready" : "blocked",
    audit_severity: guard.transition_guard_status === "blocked" ? "warning" : "info",
    actor_ref: {
      actor_type: "system",
      actor_id: RUNNER_ACTOR_ID,
    },
    event_time: generatedAt,
    from_dsl_state: guard.from_dsl_state,
    to_dsl_state: guard.to_dsl_state,
    guard_decision: guard.guard_decision,
    transition_guard_status: guard.transition_guard_status,
    guard_reason: guard.guard_reason,
    requires_human_review: guard.requires_human_review,
    law_firm_human_review_required: guard.law_firm_human_review_required,
    auto_transition_allowed: guard.auto_transition_allowed,
    protected_action_executed: false,
    event_store_binding_status: "candidate_not_appended",
    source_audit_event_ledger_status: sourceAuditStatus,
    audit_payload: {
      transition_rule_id: guard.transition_rule_id,
      transition_rule_found: guard.transition_rule_found,
      transition_allowed: guard.transition_allowed,
      policy_snapshot_id: guard.policy_snapshot_id,
      source_run_status: guard.source_run_status,
      source_terminal_state: guard.source_terminal_state,
    },
  })).sort((left, right) => left.audit_event_candidate_id.localeCompare(right.audit_event_candidate_id));
}

function buildWorkflowRunnerPlans({ transitionGuardRecords, runnerAuditEventCandidates, generatedAt }) {
  const auditByGuard = new Map(runnerAuditEventCandidates.map((candidate) => [candidate.transition_guard_id, candidate]));
  return transitionGuardRecords.map((guard) => {
    const auditCandidate = auditByGuard.get(guard.transition_guard_id);
    return {
      schema_version: "workflow-runner-plan.v1",
      workflow_runner_plan_id: `workflow-runner-plan.${sanitizeId(guard.workflow_run_id)}`,
      workflow_run_id: guard.workflow_run_id,
      workflow_id: guard.workflow_id,
      capability_id: guard.capability_id,
      domain_pack: guard.domain_pack,
      current_dsl_state: guard.from_dsl_state,
      next_dsl_state: guard.to_dsl_state,
      transition_guard_id: guard.transition_guard_id,
      audit_event_candidate_id: auditCandidate?.audit_event_candidate_id ?? null,
      runner_plan_status: planStatusForGuard(guard),
      next_action: nextActionForGuard(guard),
      protected_action_execution_allowed: false,
      generated_at: generatedAt,
    };
  }).sort((left, right) => left.workflow_runner_plan_id.localeCompare(right.workflow_runner_plan_id));
}

function planStatusForGuard(guard) {
  if (guard.transition_guard_status === "allowed") return "ready";
  if (guard.transition_guard_status === "terminal") return "terminal";
  if (guard.transition_guard_status === "waiting") return "waiting";
  return "blocked";
}

function nextActionForGuard(guard) {
  if (guard.transition_guard_status === "allowed") return "emit_audit_and_transition";
  if (guard.transition_guard_status === "terminal") return "no_op_terminal";
  if (guard.transition_guard_status === "waiting") return "await_human_review";
  return "inspect_transition_blocker";
}

function validateWorkflowStateMachineRunner({
  workflowDslStateModel,
  workflowRunLedger,
  auditEventLedger,
  packageJson,
  roadmapText,
  projections,
  transitionGuardRecords,
  runnerAuditEventCandidates,
  workflowRunnerPlans,
}) {
  const items = [];
  const guardIds = new Set(transitionGuardRecords.map((guard) => guard.transition_guard_id));
  const auditGuardIds = new Set(runnerAuditEventCandidates.map((candidate) => candidate.transition_guard_id));
  const planGuardIds = new Set(workflowRunnerPlans.map((plan) => plan.transition_guard_id));
  const missingAuditCount = transitionGuardRecords.filter((guard) => !auditGuardIds.has(guard.transition_guard_id)).length;
  const missingPlanCount = transitionGuardRecords.filter((guard) => !planGuardIds.has(guard.transition_guard_id)).length;
  const missingRuleCount = transitionGuardRecords.filter((guard) => guard.to_dsl_state !== null && !guard.transition_rule_found).length;
  pushCheck(items, "source.workflow_dsl_state_model", "workflow_dsl_state_model_complete", workflowDslStateModel.summary?.workflow_dsl_state_model_status === "complete" && workflowDslStateModel.validation?.valid !== false, "Workflow DSL state model must be complete.");
  pushCheck(items, "source.workflow_run_ledger", "workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete" && workflowRunLedger.validation?.valid !== false, "Workflow run ledger must be complete.");
  pushCheck(items, "source.audit_event_ledger", "audit_event_ledger_complete", auditEventLedger.summary?.audit_event_ledger_status === "complete" && auditEventLedger.validation?.valid !== false, "Audit event ledger must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:runner"]), "package.json must expose npm run workflows:runner.");
  pushCheck(items, "roadmap.phase_180", "phase_180_documented", roadmapText.includes("P180") && roadmapText.includes("workflow state machine runner"), "Roadmap must keep the P180 workflow state machine runner slot visible.");
  pushCheck(items, "transition_guard_records", "guard_covers_every_projection", transitionGuardRecords.length === projections.length && transitionGuardRecords.length > 0, "Every workflow run projection must have one transition guard.");
  pushCheck(items, "runner_audit_event_candidates", "audit_event_candidate_for_every_guard", runnerAuditEventCandidates.length === transitionGuardRecords.length && missingAuditCount === 0, "Every transition guard must generate a matching audit event candidate.");
  pushCheck(items, "workflow_runner_plans", "runner_plan_for_every_guard", workflowRunnerPlans.length === transitionGuardRecords.length && missingPlanCount === 0, "Every transition guard must generate a workflow runner plan.");
  pushCheck(items, "transition_guard_records.rules", "all_non_terminal_guards_have_rule", missingRuleCount === 0, "Every non-terminal transition guard must reference a declared DSL transition rule.");
  pushCheck(items, "transition_guard_records.audit_binding", "guard_audit_ids_are_unique", guardIds.size === transitionGuardRecords.length && auditGuardIds.size === runnerAuditEventCandidates.length, "Transition guard and audit event candidate bindings must be unique.");
  pushCheck(items, "transition_guard_records.protected_actions", "runner_does_not_execute_protected_actions", transitionGuardRecords.every((guard) => guard.protected_action_executed === false) && runnerAuditEventCandidates.every((candidate) => candidate.protected_action_executed === false), "Workflow runner must not execute protected actions.");
  pushCheck(items, "transition_guard_records.waiting", "waiting_guards_hold_for_human_review", transitionGuardRecords.filter((guard) => guard.transition_guard_status === "waiting").every((guard) => guard.guard_decision === "hold" && guard.requires_human_review && !guard.auto_transition_allowed), "Waiting guards must hold until human review is supplied.");
  pushCheck(items, "transition_guard_records.law_firm", "law_firm_human_review_guards_hold", transitionGuardRecords.filter((guard) => guard.law_firm_human_review_required).every((guard) => guard.transition_guard_status === "waiting" && guard.guard_decision === "hold"), "Law-firm human-review guards must remain held.");
  return items;
}

function summarizeWorkflowStateMachineRunner({
  workflowDslStateModel,
  transitionGuardRecords,
  runnerAuditEventCandidates,
  workflowRunnerPlans,
  validation,
  validationItems,
}) {
  const transitionGuardWithoutAuditCount = transitionGuardRecords.filter(
    (guard) => !runnerAuditEventCandidates.some((candidate) => candidate.transition_guard_id === guard.transition_guard_id),
  ).length;
  const transitionGuardWithoutRuleCount = transitionGuardRecords.filter((guard) => guard.to_dsl_state !== null && !guard.transition_rule_found).length;
  return {
    workflow_state_machine_runner_status: validation.valid ? "complete" : "blocked",
    runner_contract_id: RUNNER_CONTRACT_ID,
    source_workflow_dsl_state_model_status: workflowDslStateModel.summary?.workflow_dsl_state_model_status ?? "unknown",
    source_state_model_version: workflowDslStateModel.summary?.state_model_version ?? null,
    workflow_run_projection_count: workflowDslStateModel.summary?.workflow_run_projection_count ?? 0,
    runner_plan_count: workflowRunnerPlans.length,
    transition_guard_count: transitionGuardRecords.length,
    guarded_transition_count: transitionGuardRecords.filter((guard) => guard.to_dsl_state !== null).length,
    audit_event_candidate_count: runnerAuditEventCandidates.length,
    guard_audit_binding_count: transitionGuardRecords.length - transitionGuardWithoutAuditCount,
    transition_guard_without_audit_count: transitionGuardWithoutAuditCount,
    transition_guard_without_rule_count: transitionGuardWithoutRuleCount,
    allowed_guard_count: transitionGuardRecords.filter((guard) => guard.transition_guard_status === "allowed").length,
    waiting_guard_count: transitionGuardRecords.filter((guard) => guard.transition_guard_status === "waiting").length,
    blocked_guard_count: transitionGuardRecords.filter((guard) => guard.transition_guard_status === "blocked").length,
    terminal_guard_count: transitionGuardRecords.filter((guard) => guard.transition_guard_status === "terminal").length,
    human_review_guard_count: transitionGuardRecords.filter((guard) => guard.requires_human_review).length,
    law_firm_human_review_guard_count: transitionGuardRecords.filter((guard) => guard.law_firm_human_review_required).length,
    auto_transition_count: transitionGuardRecords.filter((guard) => guard.auto_transition_allowed).length,
    protected_action_executed_count: transitionGuardRecords.filter((guard) => guard.protected_action_executed).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validationItems.filter((item) => item.status !== "passed").length,
    validation_error_count: validation.errors.length,
    by_guard_status: countByObject(transitionGuardRecords, "transition_guard_status"),
    by_runner_plan_status: countByObject(workflowRunnerPlans, "runner_plan_status"),
  };
}

function renderWorkflowStateMachineRunnerMarkdown(result) {
  const lines = [];
  lines.push("# Workflow State Machine Runner");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${result.summary.workflow_state_machine_runner_status}`);
  lines.push("");
  lines.push(`- Transition guards: ${result.summary.transition_guard_count}`);
  lines.push(`- Audit event candidates: ${result.summary.audit_event_candidate_count}`);
  lines.push(`- Runner plans: ${result.summary.runner_plan_count}`);
  lines.push(`- Waiting guards: ${result.summary.waiting_guard_count}`);
  lines.push(`- Law-firm human-review guards: ${result.summary.law_firm_human_review_guard_count}`);
  lines.push(`- Validation errors: ${result.summary.validation_error_count}`);
  lines.push("");
  lines.push("## Guard Decisions");
  lines.push("");
  for (const guard of result.transition_guard_records) {
    lines.push(`- ${guard.workflow_run_id}: ${guard.from_dsl_state} -> ${guard.to_dsl_state ?? "terminal"} (${guard.guard_decision}, ${guard.transition_guard_status})`);
  }
  if (result.validation.errors.length > 0) {
    lines.push("");
    lines.push("## Errors");
    lines.push("");
    for (const error of result.validation.errors) {
      lines.push(`- ${error.path}: ${error.message}`);
    }
  }
  return `${lines.join("\n")}\n`;
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

function pushCheck(items, pathValue, checkId, passed, message) {
  items.push({
    check_id: checkId,
    path: pathValue,
    status: passed ? "passed" : "failed",
    message,
  });
}

function countBy(items, key) {
  const counts = new Map();
  for (const item of items) {
    const value = item[key];
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

function countByObject(items, key) {
  return Object.fromEntries([...countBy(items, key).entries()].sort(([left], [right]) => String(left).localeCompare(String(right))));
}

function serializableWorkflowStateMachineRunner(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function parseArgs(argv) {
  const parsed = {
    workflowDslStateModelPath: DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.workflowDslStateModelPath,
    workflowRunLedgerPath: DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.workflowRunLedgerPath,
    auditEventLedgerPath: DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.auditEventLedgerPath,
    packagePath: DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_STATE_MACHINE_RUNNER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-dsl-state-model") parsed.workflowDslStateModelPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--audit-event-ledger") parsed.auditEventLedgerPath = argv[++index];
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
  console.log(`Usage: node scripts/workflow-state-machine-runner.mjs [options]

Options:
  --workflow-dsl-state-model <path>  workflow-dsl-state-model.json path.
  --workflow-run-ledger <path>       workflow-run-ledger.json path.
  --audit-event-ledger <path>        audit-event-ledger.json path.
  --package <path>                   package.json path.
  --roadmap <path>                   phase ledger path.
  --out-dir <folder>                 Output directory.
  --run-at <iso>                     Deterministic generated_at timestamp.
  --check                            Validate only, do not write artifacts.
  -h, --help                         Show this help.
`);
}

function sanitizeId(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function dateStamp(isoTimestamp) {
  return String(isoTimestamp).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
