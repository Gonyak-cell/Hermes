import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_OUT_DIR = "artifacts/workflow-queue-retry-backoff/latest";
export const DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS = {
  workflowStateMachineRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  errorRetryLedgerPath: "artifacts/error-retry-ledger/latest/error-retry-ledger.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const CONTRACT_ID = "workflow-queue-retry-backoff.v1";
const QUEUE_RECORD_SCHEMA_VERSION = "workflow-queue-record.v1";
const RETRY_CLASSIFICATION_SCHEMA_VERSION = "workflow-retry-classification.v1";
const BACKOFF_POLICY_SCHEMA_VERSION = "workflow-backoff-policy.v1";

export async function runWorkflowQueueRetryBackoffContract(options = {}) {
  const result = await buildWorkflowQueueRetryBackoffContract(options);
  if (options.write !== false) await writeWorkflowQueueRetryBackoffContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow queue/retry/backoff contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowQueueRetryBackoffContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowStateMachineRunner = await readJson(inputs.workflow_state_machine_runner_path);
  const errorRetryLedger = await readJson(inputs.error_retry_ledger_path);
  const workflowRunLedger = await readJson(inputs.workflow_run_ledger_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const runnerPlans = workflowStateMachineRunner.workflow_runner_plans
    ?? workflowStateMachineRunner.workflow_state_machine_runner?.workflow_runner_plans
    ?? [];
  const transitionGuards = workflowStateMachineRunner.transition_guard_records
    ?? workflowStateMachineRunner.workflow_state_machine_runner?.transition_guard_records
    ?? [];
  const projectedErrors = errorRetryLedger.error_retry_ledger_catalog?.projected_error_records ?? [];
  const retryRecords = errorRetryLedger.error_retry_ledger_catalog?.retry_records ?? [];
  const resumeStateRecords = errorRetryLedger.error_retry_ledger_catalog?.resume_state_records ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];

  const retryClassificationRecords = buildRetryClassificationRecords({
    projectedErrors,
    retryRecords,
    resumeStateRecords,
    generatedAt,
  });
  const backoffPolicyRecords = buildBackoffPolicyRecords({
    retryClassificationRecords,
    generatedAt,
  });
  const workflowQueueRecords = buildWorkflowQueueRecords({
    runnerPlans,
    transitionGuards,
    workflowRunRecords,
    retryClassificationRecords,
    backoffPolicyRecords,
    generatedAt,
  });
  const validationItems = validateWorkflowQueueRetryBackoff({
    workflowStateMachineRunner,
    errorRetryLedger,
    workflowRunLedger,
    packageJson,
    roadmapText,
    runnerPlans,
    workflowQueueRecords,
    retryClassificationRecords,
    backoffPolicyRecords,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-queue-retry-backoff-contract.v1",
    generated_at: generatedAt,
    workflow_queue_retry_backoff_contract_id: `workflow-queue-retry-backoff.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_state_machine_runner: {
        schema_version: workflowStateMachineRunner.schema_version ?? null,
        workflow_state_machine_runner_status: workflowStateMachineRunner.summary?.workflow_state_machine_runner_status ?? "unknown",
        runner_plan_count: workflowStateMachineRunner.summary?.runner_plan_count ?? runnerPlans.length,
        transition_guard_count: workflowStateMachineRunner.summary?.transition_guard_count ?? transitionGuards.length,
        validation_error_count: workflowStateMachineRunner.summary?.validation_error_count ?? workflowStateMachineRunner.validation?.errors?.length ?? 0,
      },
      error_retry_ledger: {
        schema_version: errorRetryLedger.schema_version ?? null,
        error_retry_ledger_status: errorRetryLedger.summary?.error_retry_ledger_status ?? "unknown",
        retry_record_count: errorRetryLedger.summary?.retry_record_count ?? retryRecords.length,
        retryable_error_count: errorRetryLedger.summary?.retryable_error_count ?? retryRecords.filter((record) => record.retryable).length,
        non_retryable_error_count: errorRetryLedger.summary?.non_retryable_error_count ?? retryRecords.filter((record) => !record.retryable).length,
        validation_error_count: errorRetryLedger.summary?.validation_error_count ?? errorRetryLedger.validation?.errors?.length ?? 0,
      },
      workflow_run_ledger: {
        schema_version: workflowRunLedger.schema_version ?? null,
        workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
        workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
        validation_error_count: workflowRunLedger.summary?.validation_error_count ?? workflowRunLedger.validation?.errors?.length ?? 0,
      },
    },
    workflow_queue_retry_backoff_contract: buildQueueRetryBackoffContract(generatedAt),
    workflow_queue_records: workflowQueueRecords,
    retry_classification_records: retryClassificationRecords,
    backoff_policy_records: backoffPolicyRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowQueueRetryBackoff({
      workflowStateMachineRunner,
      errorRetryLedger,
      workflowRunLedger,
      runnerPlans,
      workflowQueueRecords,
      retryClassificationRecords,
      backoffPolicyRecords,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowQueueRetryBackoffMarkdown(result),
  };
}

export async function writeWorkflowQueueRetryBackoffContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-queue-retry-backoff-contract.json"), serializableWorkflowQueueRetryBackoff(result));
  await writeJson(path.join(outDir, "workflow-queue-records.json"), {
    schema_version: "workflow-queue-records.v1",
    generated_at: result.generated_at,
    workflow_queue_record_count: result.workflow_queue_records.length,
    workflow_queue_records: result.workflow_queue_records,
  });
  await writeJson(path.join(outDir, "retry-classification-records.json"), {
    schema_version: "workflow-retry-classification-records.v1",
    generated_at: result.generated_at,
    retry_classification_record_count: result.retry_classification_records.length,
    retry_classification_records: result.retry_classification_records,
  });
  await writeJson(path.join(outDir, "backoff-policy-records.json"), {
    schema_version: "workflow-backoff-policy-records.v1",
    generated_at: result.generated_at,
    backoff_policy_record_count: result.backoff_policy_records.length,
    backoff_policy_records: result.backoff_policy_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-queue-retry-backoff-validation-report.v1",
    generated_at: result.generated_at,
    workflow_queue_retry_backoff_contract_id: result.workflow_queue_retry_backoff_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowQueueRetryBackoffContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowQueueRetryBackoffContract(args);
    console.log(`Workflow queue/retry/backoff contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_queue_retry_backoff_status}`);
    console.log(`Queue records: ${result.summary.workflow_queue_record_count}`);
    console.log(`Retry classifications: ${result.summary.retry_classification_count}`);
    console.log(`Backoff policies: ${result.summary.backoff_policy_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildRetryClassificationRecords({
  projectedErrors,
  retryRecords,
  resumeStateRecords,
  generatedAt,
}) {
  const errorById = new Map(projectedErrors.map((record) => [record.source_error_record_id, record]));
  const resumeById = new Map(resumeStateRecords.map((record) => [record.source_error_record_id, record]));
  return retryRecords.map((retryRecord) => {
    const error = errorById.get(retryRecord.source_error_record_id) ?? {};
    const resume = resumeById.get(retryRecord.source_error_record_id) ?? {};
    const retryClass = classifyRetry({ retryRecord, error, resume });
    const retryable = Boolean(retryRecord.retryable);
    const backoffPolicyId = retryable
      ? `workflow-backoff-policy.${slugify(retryRecord.source_error_record_id)}`
      : null;
    const classification = {
      schema_version: RETRY_CLASSIFICATION_SCHEMA_VERSION,
      retry_classification_id: `workflow-retry-classification.${slugify(retryRecord.source_error_record_id)}`,
      source_retry_record_id: retryRecord.retry_record_id,
      source_projected_error_record_id: retryRecord.projected_error_record_id,
      source_error_record_id: retryRecord.source_error_record_id,
      workflow_run_id: retryRecord.workflow_run_id,
      run_ledger_id: retryRecord.run_ledger_id,
      correlation_trace_id: retryRecord.correlation_trace_id,
      observability_trace_id: retryRecord.observability_trace_id,
      capability_id: error.capability_id ?? null,
      domain_pack: error.domain_pack ?? null,
      matter_id: error.matter_id ?? null,
      policy_snapshot_id: error.policy_snapshot_id ?? null,
      error_kind: retryRecord.error_kind,
      error_type: retryRecord.error_type,
      error_status: error.error_status ?? null,
      failure_state: error.failure_state ?? null,
      resume_state: resume.resume_state ?? error.resume_state ?? null,
      retryable,
      retry_class: retryClass,
      retry_state: retryRecord.retry_state,
      retry_status: retryRecord.retry_status,
      retry_policy_status: retryRecord.retry_policy_status,
      queue_retry_status: queueRetryStatus({ retryRecord, retryClass }),
      requires_human_before_retry: Boolean(retryRecord.requires_human_before_retry),
      backoff_policy_id: backoffPolicyId,
      backoff_applicable: retryable,
      non_retryable_reason: retryable ? null : nonRetryableReason({ retryRecord, error, resume }),
      auto_retry_scheduled: false,
      protected_action_execution_allowed: false,
      recorded_at: generatedAt,
    };
    return {
      ...classification,
      retry_classification_hash: hashValue(classification),
    };
  }).sort(by("retry_classification_id"));
}

function buildBackoffPolicyRecords({ retryClassificationRecords, generatedAt }) {
  return retryClassificationRecords
    .filter((classification) => classification.retryable)
    .map((classification) => {
      const requiresHuman = classification.requires_human_before_retry;
      const policy = {
        schema_version: BACKOFF_POLICY_SCHEMA_VERSION,
        backoff_policy_id: classification.backoff_policy_id,
        retry_classification_id: classification.retry_classification_id,
        source_retry_record_id: classification.source_retry_record_id,
        source_error_record_id: classification.source_error_record_id,
        workflow_run_id: classification.workflow_run_id,
        run_ledger_id: classification.run_ledger_id,
        domain_pack: classification.domain_pack,
        capability_id: classification.capability_id,
        backoff_policy_status: requiresHuman ? "pending_human_gate" : "ready_for_manual_schedule",
        schedule_status: "not_scheduled",
        backoff_strategy: "exponential",
        initial_delay_seconds: 300,
        max_delay_seconds: 3600,
        multiplier: 2,
        max_attempts: 3,
        jitter_strategy: "deterministic_none",
        requires_human_before_schedule: requiresHuman,
        next_retry_not_before: null,
        auto_retry_scheduled: false,
        protected_action_execution_allowed: false,
        retry_gate_reason: requiresHuman ? "human_approval_required_before_backoff_schedule" : "manual_retry_gate_required",
        recorded_at: generatedAt,
      };
      return {
        ...policy,
        backoff_policy_hash: hashValue(policy),
      };
    }).sort(by("backoff_policy_id"));
}

function buildWorkflowQueueRecords({
  runnerPlans,
  transitionGuards,
  workflowRunRecords,
  retryClassificationRecords,
  backoffPolicyRecords,
  generatedAt,
}) {
  const guardById = new Map(transitionGuards.map((guard) => [guard.transition_guard_id, guard]));
  const workflowById = new Map(workflowRunRecords.map((record) => [record.workflow_run_id, record]));
  const classificationsByWorkflow = groupBy(retryClassificationRecords, "workflow_run_id");
  const backoffByClassification = new Map(backoffPolicyRecords.map((policy) => [policy.retry_classification_id, policy]));
  return runnerPlans.map((plan) => {
    const guard = guardById.get(plan.transition_guard_id) ?? {};
    const workflow = workflowById.get(plan.workflow_run_id) ?? {};
    const classifications = classificationsByWorkflow.get(plan.workflow_run_id) ?? [];
    const backoffPolicies = classifications
      .map((classification) => backoffByClassification.get(classification.retry_classification_id))
      .filter(Boolean);
    const queueStatus = queueStatusForPlan(plan, guard);
    const queueRecord = {
      schema_version: QUEUE_RECORD_SCHEMA_VERSION,
      workflow_queue_record_id: `workflow-queue.${slugify(plan.workflow_run_id)}`,
      workflow_run_id: plan.workflow_run_id,
      run_ledger_id: workflow.run_ledger_id ?? null,
      workflow_id: plan.workflow_id,
      capability_id: plan.capability_id,
      domain_pack: plan.domain_pack,
      current_dsl_state: plan.current_dsl_state,
      next_dsl_state: plan.next_dsl_state,
      workflow_runner_plan_id: plan.workflow_runner_plan_id,
      transition_guard_id: plan.transition_guard_id,
      queue_status: queueStatus,
      queue_reason: queueReasonForPlan(plan, guard),
      dequeue_policy: dequeuePolicyForQueueStatus(queueStatus),
      human_review_required: Boolean(guard.requires_human_review),
      law_firm_human_review_required: Boolean(guard.law_firm_human_review_required),
      auto_dequeue_allowed: false,
      protected_action_execution_allowed: false,
      retry_classification_ids: classifications.map((classification) => classification.retry_classification_id).sort(),
      retryable_classification_count: classifications.filter((classification) => classification.retryable).length,
      non_retryable_classification_count: classifications.filter((classification) => !classification.retryable).length,
      blocking_retry_classification_count: classifications.filter((classification) => classification.failure_state === "blocking_failure").length,
      backoff_policy_ids: backoffPolicies.map((policy) => policy.backoff_policy_id).sort(),
      backoff_policy_count: backoffPolicies.length,
      auto_retry_scheduled: false,
      event_envelope_ids: workflow.event_envelope_ids ?? guard.event_envelope_ids ?? [],
      policy_snapshot_id: workflow.policy_snapshot_id ?? guard.policy_snapshot_id ?? null,
      recorded_at: generatedAt,
    };
    return {
      ...queueRecord,
      workflow_queue_record_hash: hashValue(queueRecord),
    };
  }).sort(by("workflow_queue_record_id"));
}

function classifyRetry({ retryRecord, error, resume }) {
  if (retryRecord.retryable && retryRecord.requires_human_before_retry) return "retryable_requires_human_gate";
  if (retryRecord.retryable) return "retryable_manual_gate";
  if (resume.resume_blocked || error.blocking) return "not_retryable_human_hold";
  return "not_retryable_closed_or_terminal";
}

function queueRetryStatus({ retryRecord, retryClass }) {
  if (retryClass === "retryable_requires_human_gate") return "eligible_after_human_gate";
  if (retryClass === "retryable_manual_gate") return "eligible_after_manual_gate";
  if (retryRecord.retryable) return "eligible_after_gate";
  return "not_retryable";
}

function nonRetryableReason({ retryRecord, error, resume }) {
  if (resume.resume_blocked || error.blocking) return "human_or_operator_resolution_required";
  return retryRecord.retry_policy_status ?? "not_retryable";
}

function queueStatusForPlan(plan, guard) {
  if (plan.runner_plan_status === "waiting" || guard.transition_guard_status === "waiting") return "held_for_human_review";
  if (plan.runner_plan_status === "ready" || guard.transition_guard_status === "allowed") return "ready_for_manual_dequeue";
  if (plan.runner_plan_status === "terminal" || guard.transition_guard_status === "terminal") return "terminal_noop";
  return "blocked";
}

function queueReasonForPlan(plan, guard) {
  if (guard.guard_reason) return guard.guard_reason;
  if (plan.next_action === "await_human_review") return "human_review_pending";
  return plan.next_action ?? "unknown";
}

function dequeuePolicyForQueueStatus(queueStatus) {
  if (queueStatus === "held_for_human_review") return "human_review_required";
  if (queueStatus === "ready_for_manual_dequeue") return "manual_dequeue_required";
  if (queueStatus === "terminal_noop") return "no_op_terminal";
  return "inspect_blocker";
}

function validateWorkflowQueueRetryBackoff({
  workflowStateMachineRunner,
  errorRetryLedger,
  workflowRunLedger,
  packageJson,
  roadmapText,
  runnerPlans,
  workflowQueueRecords,
  retryClassificationRecords,
  backoffPolicyRecords,
}) {
  const items = [];
  const queueByWorkflow = new Set(workflowQueueRecords.map((record) => record.workflow_run_id));
  const classificationIds = new Set(retryClassificationRecords.map((record) => record.retry_classification_id));
  const backoffIds = new Set(backoffPolicyRecords.map((record) => record.backoff_policy_id));
  const backoffClassificationIds = new Set(backoffPolicyRecords.map((record) => record.retry_classification_id));
  const retryableClassifications = retryClassificationRecords.filter((record) => record.retryable);
  const nonRetryableClassifications = retryClassificationRecords.filter((record) => !record.retryable);
  const nonRetryableBackoffPolicyCount = nonRetryableClassifications.filter((record) => record.backoff_policy_id !== null).length;
  const summary = summarizeWorkflowQueueRetryBackoff({
    workflowStateMachineRunner,
    errorRetryLedger,
    workflowRunLedger,
    runnerPlans,
    workflowQueueRecords,
    retryClassificationRecords,
    backoffPolicyRecords,
    validation: { errors: [] },
    validationItems: [],
  });
  pushCheck(items, "source.workflow_state_machine_runner", "workflow_state_machine_runner_complete", workflowStateMachineRunner.summary?.workflow_state_machine_runner_status === "complete" && workflowStateMachineRunner.validation?.valid !== false, "Workflow state machine runner must be complete.");
  pushCheck(items, "source.error_retry_ledger", "error_retry_ledger_complete", errorRetryLedger.summary?.error_retry_ledger_status === "complete" && errorRetryLedger.validation?.valid !== false, "Error/retry ledger must be complete.");
  pushCheck(items, "source.workflow_run_ledger", "workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete" && workflowRunLedger.validation?.valid !== false, "Workflow run ledger must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:queue-retry"]), "package.json must expose npm run workflows:queue-retry.");
  pushCheck(items, "roadmap.phase_181", "phase_181_documented", roadmapText.includes("P181") && roadmapText.includes("queue/retry/backoff"), "Roadmap must keep the P181 queue/retry/backoff slot visible.");
  pushCheck(items, "workflow_queue_records", "queue_covers_every_runner_plan", workflowQueueRecords.length === runnerPlans.length && workflowQueueRecords.length > 0, "Every workflow runner plan must have one queue record.");
  pushCheck(items, "workflow_queue_records.workflow", "queue_workflows_are_unique", queueByWorkflow.size === workflowQueueRecords.length, "Workflow queue records must be unique per workflow run.");
  pushCheck(items, "retry_classification_records", "retry_classification_count_matches_source", retryClassificationRecords.length === (errorRetryLedger.summary?.retry_record_count ?? 0), "Every source retry record must have one retry classification.");
  pushCheck(items, "retry_classification_records.retryable", "retryable_split_matches_source", summary.retryable_classification_count === (errorRetryLedger.summary?.retryable_error_count ?? 0) && summary.non_retryable_classification_count === (errorRetryLedger.summary?.non_retryable_error_count ?? 0), "Retryable and non-retryable classification counts must match the source error/retry ledger.");
  pushCheck(items, "retry_classification_records.ids", "retry_classification_ids_are_unique", classificationIds.size === retryClassificationRecords.length, "Retry classification ids must be unique.");
  pushCheck(items, "backoff_policy_records", "backoff_only_for_retryable_classifications", backoffPolicyRecords.length === retryableClassifications.length && nonRetryableClassifications.every((record) => record.backoff_policy_id === null), "Backoff policies must only attach to retryable classifications.");
  pushCheck(items, "backoff_policy_records.non_retryable", "non_retryable_classifications_have_no_backoff", nonRetryableBackoffPolicyCount === 0, "Non-retryable classifications must not receive a backoff policy.");
  pushCheck(items, "backoff_policy_records.classification", "every_retryable_classification_has_backoff", retryableClassifications.every((record) => backoffClassificationIds.has(record.retry_classification_id)), "Every retryable classification must have a matching backoff policy.");
  pushCheck(items, "backoff_policy_records.ids", "backoff_policy_ids_are_unique", backoffIds.size === backoffPolicyRecords.length, "Backoff policy ids must be unique.");
  pushCheck(items, "backoff_policy_records.human_gate", "backoff_requires_human_gate_before_schedule", backoffPolicyRecords.every((record) => record.requires_human_before_schedule), "Backoff policies must remain behind a human gate before scheduling.");
  pushCheck(items, "backoff_policy_records.schedule", "backoff_policies_are_unscheduled", backoffPolicyRecords.every((record) => record.schedule_status === "not_scheduled"), "P181 must not schedule retry backoff automatically.");
  pushCheck(items, "workflow_queue_records.classification", "queue_records_have_retry_classifications", workflowQueueRecords.every((record) => record.retry_classification_ids.length > 0), "Every workflow queue record must reference retry classification rows.");
  pushCheck(items, "workflow_queue_records.waiting", "waiting_queue_records_hold", workflowQueueRecords.filter((record) => record.queue_status === "held_for_human_review").every((record) => record.human_review_required && !record.auto_dequeue_allowed), "Held queue records must require human review and avoid auto-dequeue.");
  pushCheck(items, "workflow_queue_records.law_firm", "law_firm_queue_records_hold", workflowQueueRecords.filter((record) => record.law_firm_human_review_required).every((record) => record.queue_status === "held_for_human_review"), "Law-firm human-review queue records must remain held.");
  pushCheck(items, "retry_classification_records.auto_retry", "no_auto_retry_scheduled", retryClassificationRecords.every((record) => !record.auto_retry_scheduled) && backoffPolicyRecords.every((record) => !record.auto_retry_scheduled), "P181 must not schedule automatic retries.");
  pushCheck(items, "workflow_queue_records.auto_dequeue", "no_auto_dequeue_allowed", workflowQueueRecords.every((record) => !record.auto_dequeue_allowed), "P181 must not auto-dequeue workflow queue records.");
  pushCheck(items, "workflow_queue_records.protected_actions", "no_protected_action_execution", workflowQueueRecords.every((record) => !record.protected_action_execution_allowed) && retryClassificationRecords.every((record) => !record.protected_action_execution_allowed) && backoffPolicyRecords.every((record) => !record.protected_action_execution_allowed), "Queue/retry/backoff contract must not execute protected actions.");
  return items;
}

function summarizeWorkflowQueueRetryBackoff({
  workflowStateMachineRunner,
  errorRetryLedger,
  workflowRunLedger,
  runnerPlans,
  workflowQueueRecords,
  retryClassificationRecords,
  backoffPolicyRecords,
  validation,
  validationItems,
}) {
  const queueRecordWithoutRetryClassificationCount = workflowQueueRecords.filter((record) => record.retry_classification_ids.length === 0).length;
  const retryableClassifications = retryClassificationRecords.filter((record) => record.retryable);
  const nonRetryableClassifications = retryClassificationRecords.filter((record) => !record.retryable);
  const nonRetryableBackoffPolicyCount = nonRetryableClassifications.filter((record) => record.backoff_policy_id !== null).length;
  return {
    workflow_queue_retry_backoff_status: validation.errors.length === 0 ? "complete" : "blocked",
    queue_contract_id: CONTRACT_ID,
    source_workflow_state_machine_runner_status: workflowStateMachineRunner.summary?.workflow_state_machine_runner_status ?? "unknown",
    source_error_retry_ledger_status: errorRetryLedger.summary?.error_retry_ledger_status ?? "unknown",
    source_workflow_run_ledger_status: workflowRunLedger?.summary?.workflow_run_ledger_status ?? "unknown",
    source_runner_plan_count: workflowStateMachineRunner.summary?.runner_plan_count ?? runnerPlans.length,
    source_retry_record_count: errorRetryLedger.summary?.retry_record_count ?? 0,
    workflow_runner_plan_count: runnerPlans.length,
    workflow_queue_record_count: workflowQueueRecords.length,
    held_queue_record_count: workflowQueueRecords.filter((record) => record.queue_status === "held_for_human_review").length,
    ready_queue_record_count: workflowQueueRecords.filter((record) => record.queue_status === "ready_for_manual_dequeue").length,
    blocked_queue_record_count: workflowQueueRecords.filter((record) => record.queue_status === "blocked").length,
    terminal_queue_record_count: workflowQueueRecords.filter((record) => record.queue_status === "terminal_noop").length,
    human_review_queue_record_count: workflowQueueRecords.filter((record) => record.human_review_required).length,
    law_firm_held_queue_record_count: workflowQueueRecords.filter((record) => record.law_firm_human_review_required && record.queue_status === "held_for_human_review").length,
    queue_record_with_retry_classification_count: workflowQueueRecords.length - queueRecordWithoutRetryClassificationCount,
    queue_record_without_retry_classification_count: queueRecordWithoutRetryClassificationCount,
    retry_classification_count: retryClassificationRecords.length,
    retryable_classification_count: retryableClassifications.length,
    non_retryable_classification_count: nonRetryableClassifications.length,
    human_gate_required_retry_count: retryClassificationRecords.filter((record) => record.requires_human_before_retry).length,
    backoff_policy_count: backoffPolicyRecords.length,
    retryable_backoff_policy_count: backoffPolicyRecords.length,
    non_retryable_backoff_policy_count: nonRetryableBackoffPolicyCount,
    human_gate_required_backoff_count: backoffPolicyRecords.filter((record) => record.requires_human_before_schedule).length,
    scheduled_backoff_policy_count: backoffPolicyRecords.filter((record) => record.schedule_status !== "not_scheduled").length,
    auto_retry_scheduled_count: retryClassificationRecords.filter((record) => record.auto_retry_scheduled).length + backoffPolicyRecords.filter((record) => record.auto_retry_scheduled).length,
    auto_dequeue_allowed_count: workflowQueueRecords.filter((record) => record.auto_dequeue_allowed).length,
    protected_action_executed_count: workflowQueueRecords.filter((record) => record.protected_action_execution_allowed).length
      + retryClassificationRecords.filter((record) => record.protected_action_execution_allowed).length
      + backoffPolicyRecords.filter((record) => record.protected_action_execution_allowed).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_queue_status: countByObject(workflowQueueRecords, "queue_status"),
    by_retry_class: countByObject(retryClassificationRecords, "retry_class"),
    by_queue_retry_status: countByObject(retryClassificationRecords, "queue_retry_status"),
    by_backoff_policy_status: countByObject(backoffPolicyRecords, "backoff_policy_status"),
    by_domain_pack: countByObject(workflowQueueRecords, "domain_pack"),
  };
}

function buildQueueRetryBackoffContract(generatedAt) {
  return {
    schema_version: "workflow-queue-retry-backoff-contract.v1",
    generated_at: generatedAt,
    queue_contract_id: CONTRACT_ID,
    deterministic_queue: true,
    protected_action_execution_allowed: false,
    automatic_dequeue_allowed: false,
    automatic_retry_allowed: false,
    queue_states: ["held_for_human_review", "ready_for_manual_dequeue", "blocked", "terminal_noop"],
    retry_classes: [
      "retryable_requires_human_gate",
      "retryable_manual_gate",
      "not_retryable_human_hold",
      "not_retryable_closed_or_terminal",
    ],
    backoff_policy_rule: "Backoff policy rows are only generated for retryable classifications and remain unscheduled until a later explicit gate approves retry.",
    non_retryable_rule: "Non-retryable human-hold errors do not receive backoff policies; they remain queue-held until a human resolution artifact exists.",
    law_firm_safety_rule: "Law-firm human-review workflow queue records must remain held and must not auto-dequeue or execute protected actions.",
  };
}

function renderWorkflowQueueRetryBackoffMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Queue/Retry/Backoff Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_queue_retry_backoff_status}`);
  lines.push("");
  lines.push(`- Queue records: ${summary.workflow_queue_record_count}`);
  lines.push(`- Retry classifications: ${summary.retry_classification_count}`);
  lines.push(`- Retryable/non-retryable classifications: ${summary.retryable_classification_count}/${summary.non_retryable_classification_count}`);
  lines.push(`- Backoff policies: ${summary.backoff_policy_count}`);
  lines.push(`- Held queue records: ${summary.held_queue_record_count}`);
  lines.push(`- Law-firm held queue records: ${summary.law_firm_held_queue_record_count}`);
  lines.push(`- Auto retries scheduled: ${summary.auto_retry_scheduled_count}`);
  lines.push(`- Protected actions executed: ${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Queue Records");
  lines.push("");
  for (const record of result.workflow_queue_records) {
    lines.push(`- ${record.workflow_run_id}: ${record.queue_status}, retryable=${record.retryable_classification_count}, non_retryable=${record.non_retryable_classification_count}, backoff=${record.backoff_policy_count}`);
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

function normalizeInputs(options) {
  return {
    workflow_state_machine_runner_path: path.resolve(options.workflowStateMachineRunnerPath ?? DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.workflowStateMachineRunnerPath),
    error_retry_ledger_path: path.resolve(options.errorRetryLedgerPath ?? DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.errorRetryLedgerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.workflowRunLedgerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowStateMachineRunnerPath: DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.workflowStateMachineRunnerPath,
    errorRetryLedgerPath: DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.errorRetryLedgerPath,
    workflowRunLedgerPath: DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.workflowRunLedgerPath,
    packagePath: DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_QUEUE_RETRY_BACKOFF_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-state-machine-runner") parsed.workflowStateMachineRunnerPath = argv[++index];
    else if (arg === "--error-retry-ledger") parsed.errorRetryLedgerPath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
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
  console.log(`Usage: node scripts/workflow-queue-retry-backoff-contract.mjs [options]

Options:
  --workflow-state-machine-runner <path>  workflow-state-machine-runner.json path.
  --error-retry-ledger <path>             error-retry-ledger.json path.
  --workflow-run-ledger <path>            workflow-run-ledger.json path.
  --package <path>                        package.json path.
  --roadmap <path>                        phase ledger path.
  --out-dir <folder>                      Output directory.
  --run-at <iso>                          Deterministic generated_at timestamp.
  --check                                 Validate only, do not write artifacts.
  -h, --help                              Show this help.
`);
}

function serializableWorkflowQueueRetryBackoff(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function groupBy(items, key) {
  const groups = new Map();
  for (const item of items) {
    const value = item[key];
    if (!groups.has(value)) groups.set(value, []);
    groups.get(value).push(item);
  }
  return groups;
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

function hashValue(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function by(key) {
  return (left, right) => String(left[key]).localeCompare(String(right[key]));
}

function slugify(value) {
  return String(value ?? "unknown").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
}

function dateStamp(isoTimestamp) {
  return String(isoTimestamp).replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
