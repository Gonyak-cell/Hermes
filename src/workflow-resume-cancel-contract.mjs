import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_RESUME_CANCEL_OUT_DIR = "artifacts/workflow-resume-cancel/latest";
export const DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS = {
  workflowIdempotencyLedgerPath: "artifacts/workflow-idempotency/latest/workflow-idempotency-ledger.json",
  workflowQueueRetryBackoffPath: "artifacts/workflow-queue-retry-backoff/latest/workflow-queue-retry-backoff-contract.json",
  workflowStateMachineRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const RESUME_CANCEL_CONTRACT_ID = "workflow-resume-cancel-contract.v1";
const RESUME_CURSOR_SCHEMA_VERSION = "workflow-resume-cursor-record.v1";
const CANCEL_REQUEST_SCHEMA_VERSION = "workflow-cancel-request-record.v1";
const RESUME_CANCEL_DECISION_SCHEMA_VERSION = "workflow-resume-cancel-decision-record.v1";

export async function runWorkflowResumeCancelContract(options = {}) {
  const result = await buildWorkflowResumeCancelContract(options);
  if (options.write !== false) await writeWorkflowResumeCancelContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow resume/cancel contract validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowResumeCancelContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_RESUME_CANCEL_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowIdempotencyLedger = await readJson(inputs.workflow_idempotency_ledger_path);
  const workflowQueueRetryBackoff = await readJson(inputs.workflow_queue_retry_backoff_path);
  const workflowStateMachineRunner = await readJson(inputs.workflow_state_machine_runner_path);
  const workflowRunLedger = await readJson(inputs.workflow_run_ledger_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const idempotencyKeyRecords = workflowIdempotencyLedger.idempotency_key_records ?? [];
  const workflowQueueRecords = workflowQueueRetryBackoff.workflow_queue_records
    ?? workflowQueueRetryBackoff.workflow_queue_retry_backoff_contract?.workflow_queue_records
    ?? [];
  const runnerPlans = workflowStateMachineRunner.workflow_runner_plans
    ?? workflowStateMachineRunner.workflow_state_machine_runner?.workflow_runner_plans
    ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const resumeCursorRecords = buildResumeCursorRecords({
    idempotencyKeyRecords,
    workflowQueueRecords,
    workflowRunRecords,
    generatedAt,
  });
  const cancelRequestRecords = buildCancelRequestRecords({
    idempotencyKeyRecords,
    workflowQueueRecords,
    workflowRunRecords,
    generatedAt,
  });
  const resumeCancelDecisionRecords = buildResumeCancelDecisionRecords({
    resumeCursorRecords,
    cancelRequestRecords,
    generatedAt,
  });
  const validationItems = validateWorkflowResumeCancelContract({
    workflowIdempotencyLedger,
    workflowQueueRetryBackoff,
    workflowStateMachineRunner,
    workflowRunLedger,
    packageJson,
    roadmapText,
    idempotencyKeyRecords,
    workflowQueueRecords,
    runnerPlans,
    workflowRunRecords,
    resumeCursorRecords,
    cancelRequestRecords,
    resumeCancelDecisionRecords,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-resume-cancel-contract.v1",
    generated_at: generatedAt,
    workflow_resume_cancel_contract_id: `workflow-resume-cancel.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_idempotency_ledger: {
        schema_version: workflowIdempotencyLedger.schema_version ?? null,
        workflow_idempotency_status: workflowIdempotencyLedger.summary?.workflow_idempotency_status ?? "unknown",
        idempotency_key_count: workflowIdempotencyLedger.summary?.idempotency_key_count ?? idempotencyKeyRecords.length,
        validation_error_count: workflowIdempotencyLedger.summary?.validation_error_count ?? workflowIdempotencyLedger.validation?.errors?.length ?? 0,
      },
      workflow_queue_retry_backoff_contract: {
        schema_version: workflowQueueRetryBackoff.schema_version ?? null,
        workflow_queue_retry_backoff_status: workflowQueueRetryBackoff.summary?.workflow_queue_retry_backoff_status ?? "unknown",
        workflow_queue_record_count: workflowQueueRetryBackoff.summary?.workflow_queue_record_count ?? workflowQueueRecords.length,
        held_queue_record_count: workflowQueueRetryBackoff.summary?.held_queue_record_count ?? 0,
        validation_error_count: workflowQueueRetryBackoff.summary?.validation_error_count ?? workflowQueueRetryBackoff.validation?.errors?.length ?? 0,
      },
      workflow_state_machine_runner: {
        schema_version: workflowStateMachineRunner.schema_version ?? null,
        workflow_state_machine_runner_status: workflowStateMachineRunner.summary?.workflow_state_machine_runner_status ?? "unknown",
        runner_plan_count: workflowStateMachineRunner.summary?.runner_plan_count ?? runnerPlans.length,
        validation_error_count: workflowStateMachineRunner.summary?.validation_error_count ?? workflowStateMachineRunner.validation?.errors?.length ?? 0,
      },
      workflow_run_ledger: {
        schema_version: workflowRunLedger.schema_version ?? null,
        workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
        workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
        validation_error_count: workflowRunLedger.summary?.validation_error_count ?? workflowRunLedger.validation?.errors?.length ?? 0,
      },
    },
    workflow_resume_cancel_contract: buildResumeCancelContract(generatedAt),
    resume_cursor_records: resumeCursorRecords,
    cancel_request_records: cancelRequestRecords,
    resume_cancel_decision_records: resumeCancelDecisionRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowResumeCancelContract({
      workflowIdempotencyLedger,
      workflowQueueRetryBackoff,
      workflowStateMachineRunner,
      workflowRunLedger,
      idempotencyKeyRecords,
      workflowQueueRecords,
      runnerPlans,
      workflowRunRecords,
      resumeCursorRecords,
      cancelRequestRecords,
      resumeCancelDecisionRecords,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowResumeCancelMarkdown(result),
  };
}

export async function writeWorkflowResumeCancelContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-resume-cancel-contract.json"), serializableWorkflowResumeCancelContract(result));
  await writeJson(path.join(outDir, "resume-cursor-records.json"), {
    schema_version: "workflow-resume-cursor-records.v1",
    generated_at: result.generated_at,
    resume_cursor_record_count: result.resume_cursor_records.length,
    resume_cursor_records: result.resume_cursor_records,
  });
  await writeJson(path.join(outDir, "cancel-request-records.json"), {
    schema_version: "workflow-cancel-request-records.v1",
    generated_at: result.generated_at,
    cancel_request_record_count: result.cancel_request_records.length,
    cancel_request_records: result.cancel_request_records,
  });
  await writeJson(path.join(outDir, "resume-cancel-decision-records.json"), {
    schema_version: "workflow-resume-cancel-decision-records.v1",
    generated_at: result.generated_at,
    resume_cancel_decision_record_count: result.resume_cancel_decision_records.length,
    resume_cancel_decision_records: result.resume_cancel_decision_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-resume-cancel-validation-report.v1",
    generated_at: result.generated_at,
    workflow_resume_cancel_contract_id: result.workflow_resume_cancel_contract_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowResumeCancelContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkflowResumeCancelContract(args);
    console.log(`Workflow resume/cancel contract written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_resume_cancel_status}`);
    console.log(`Resume cursors: ${result.summary.resume_cursor_count}`);
    console.log(`Cancel requests: ${result.summary.cancel_request_count}`);
    console.log(`Decision records: ${result.summary.resume_cancel_decision_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildResumeCursorRecords({
  idempotencyKeyRecords,
  workflowQueueRecords,
  workflowRunRecords,
  generatedAt,
}) {
  const queueById = new Map(workflowQueueRecords.map((record) => [record.workflow_queue_record_id, record]));
  const runById = new Map(workflowRunRecords.map((record) => [record.workflow_run_id, record]));
  return idempotencyKeyRecords.map((keyRecord) => {
    const queueRecord = queueById.get(keyRecord.source_workflow_queue_record_id) ?? {};
    const runRecord = runById.get(keyRecord.workflow_run_id) ?? {};
    const humanGateRequired = Boolean(queueRecord.human_review_required) || keyRecord.queue_status === "held_for_human_review";
    const lawFirmHumanReviewRequired = Boolean(queueRecord.law_firm_human_review_required) || (keyRecord.domain_pack === "law-firm" && humanGateRequired);
    const cursor = {
      schema_version: RESUME_CURSOR_SCHEMA_VERSION,
      resume_cursor_record_id: `workflow-resume-cursor.${slugify(keyRecord.workflow_run_id)}`,
      idempotency_key_record_id: keyRecord.idempotency_key_record_id,
      idempotency_key: keyRecord.idempotency_key,
      source_workflow_queue_record_id: keyRecord.source_workflow_queue_record_id,
      workflow_run_id: keyRecord.workflow_run_id,
      canonical_workflow_run_id: keyRecord.canonical_workflow_run_id,
      run_ledger_id: keyRecord.run_ledger_id ?? runRecord.run_ledger_id ?? null,
      workflow_id: keyRecord.workflow_id,
      capability_id: keyRecord.capability_id,
      domain_pack: keyRecord.domain_pack,
      matter_id: keyRecord.matter_id ?? runRecord.matter_id ?? null,
      policy_snapshot_id: keyRecord.policy_snapshot_id ?? runRecord.policy_snapshot_id ?? null,
      current_dsl_state: keyRecord.key_material?.current_dsl_state ?? queueRecord.current_dsl_state ?? null,
      next_dsl_state: keyRecord.key_material?.next_dsl_state ?? queueRecord.next_dsl_state ?? null,
      transition_guard_id: keyRecord.key_material?.transition_guard_id ?? queueRecord.transition_guard_id ?? null,
      queue_status: keyRecord.queue_status,
      dequeue_policy: keyRecord.dequeue_policy,
      resume_state: humanGateRequired ? "held_waiting_for_human_gate" : "ready_for_manual_resume",
      resume_required: true,
      resume_blocked: humanGateRequired,
      resume_owner: humanGateRequired ? "attorney_or_designated_reviewer" : "harness_operator",
      resume_preconditions: resumePreconditions({ humanGateRequired }),
      next_resume_action: humanGateRequired ? "record_human_approval_before_resume" : "operator_confirms_manual_resume",
      resume_allowed_after_human_gate: true,
      human_review_required: humanGateRequired,
      law_firm_human_review_required: lawFirmHumanReviewRequired,
      long_running_workflow: true,
      auto_resume_allowed: false,
      new_run_created_on_resume: false,
      protected_action_execution_allowed: false,
      cursor_status: "materialized",
      recorded_at: generatedAt,
    };
    return {
      ...cursor,
      resume_cursor_hash: hashValue(cursor),
    };
  }).sort(by("resume_cursor_record_id"));
}

function buildCancelRequestRecords({
  idempotencyKeyRecords,
  workflowQueueRecords,
  workflowRunRecords,
  generatedAt,
}) {
  const queueById = new Map(workflowQueueRecords.map((record) => [record.workflow_queue_record_id, record]));
  const runById = new Map(workflowRunRecords.map((record) => [record.workflow_run_id, record]));
  return idempotencyKeyRecords.map((keyRecord) => {
    const queueRecord = queueById.get(keyRecord.source_workflow_queue_record_id) ?? {};
    const runRecord = runById.get(keyRecord.workflow_run_id) ?? {};
    const humanGateRequired = Boolean(queueRecord.human_review_required) || keyRecord.queue_status === "held_for_human_review";
    const lawFirmHumanReviewRequired = Boolean(queueRecord.law_firm_human_review_required) || (keyRecord.domain_pack === "law-firm" && humanGateRequired);
    const request = {
      schema_version: CANCEL_REQUEST_SCHEMA_VERSION,
      cancel_request_record_id: `workflow-cancel-request.${slugify(keyRecord.workflow_run_id)}`,
      idempotency_key_record_id: keyRecord.idempotency_key_record_id,
      idempotency_key: keyRecord.idempotency_key,
      source_workflow_queue_record_id: keyRecord.source_workflow_queue_record_id,
      workflow_run_id: keyRecord.workflow_run_id,
      canonical_workflow_run_id: keyRecord.canonical_workflow_run_id,
      run_ledger_id: keyRecord.run_ledger_id ?? runRecord.run_ledger_id ?? null,
      workflow_id: keyRecord.workflow_id,
      capability_id: keyRecord.capability_id,
      domain_pack: keyRecord.domain_pack,
      matter_id: keyRecord.matter_id ?? runRecord.matter_id ?? null,
      policy_snapshot_id: keyRecord.policy_snapshot_id ?? runRecord.policy_snapshot_id ?? null,
      queue_status: keyRecord.queue_status,
      cancel_request_status: humanGateRequired ? "requested_pending_human_review" : "requested_pending_operator_review",
      cancel_state: "cancel_requested_safe_hold",
      cancel_owner: humanGateRequired ? "attorney_or_designated_reviewer" : "harness_operator",
      cancel_preconditions: cancelPreconditions({ humanGateRequired }),
      next_cancel_action: humanGateRequired ? "record_human_cancel_decision" : "operator_confirms_cancel_request",
      cancel_event_append_required: true,
      safe_cancel_request: true,
      held_status_preserved: keyRecord.queue_status === "held_for_human_review",
      human_review_required: humanGateRequired,
      law_firm_human_review_required: lawFirmHumanReviewRequired,
      long_running_workflow: true,
      auto_cancel_allowed: false,
      destructive_mutation_allowed: false,
      new_run_created_on_cancel: false,
      protected_action_execution_allowed: false,
      requested_at: generatedAt,
    };
    return {
      ...request,
      cancel_request_hash: hashValue(request),
    };
  }).sort(by("cancel_request_record_id"));
}

function buildResumeCancelDecisionRecords({ resumeCursorRecords, cancelRequestRecords, generatedAt }) {
  const cancelByRun = new Map(cancelRequestRecords.map((record) => [record.workflow_run_id, record]));
  const decisions = [];
  for (const resume of resumeCursorRecords) {
    const resumeDecision = {
      schema_version: RESUME_CANCEL_DECISION_SCHEMA_VERSION,
      resume_cancel_decision_record_id: `workflow-resume-cancel-decision.resume.${slugify(resume.workflow_run_id)}`,
      request_kind: "resume_request",
      control_decision: resume.resume_blocked ? "resume_held_pending_human_gate" : "resume_ready_for_manual_operator_gate",
      decision_status: resume.resume_blocked ? "held_for_human_gate" : "manual_gate_required",
      resume_cursor_record_id: resume.resume_cursor_record_id,
      cancel_request_record_id: null,
      idempotency_key_record_id: resume.idempotency_key_record_id,
      idempotency_key: resume.idempotency_key,
      workflow_run_id: resume.workflow_run_id,
      canonical_workflow_run_id: resume.canonical_workflow_run_id,
      run_ledger_id: resume.run_ledger_id,
      domain_pack: resume.domain_pack,
      policy_snapshot_id: resume.policy_snapshot_id,
      human_review_required: resume.human_review_required,
      law_firm_human_review_required: resume.law_firm_human_review_required,
      idempotency_decision: "same_run",
      new_run_created: false,
      auto_resume_scheduled: false,
      auto_cancel_executed: false,
      protected_action_executed: false,
      decided_at: generatedAt,
    };
    const cancel = cancelByRun.get(resume.workflow_run_id) ?? {};
    const cancelDecision = {
      schema_version: RESUME_CANCEL_DECISION_SCHEMA_VERSION,
      resume_cancel_decision_record_id: `workflow-resume-cancel-decision.cancel.${slugify(resume.workflow_run_id)}`,
      request_kind: "cancel_request",
      control_decision: "cancel_request_recorded_safe_hold",
      decision_status: "cancel_request_recorded",
      resume_cursor_record_id: resume.resume_cursor_record_id,
      cancel_request_record_id: cancel.cancel_request_record_id ?? null,
      idempotency_key_record_id: resume.idempotency_key_record_id,
      idempotency_key: resume.idempotency_key,
      workflow_run_id: resume.workflow_run_id,
      canonical_workflow_run_id: resume.canonical_workflow_run_id,
      run_ledger_id: resume.run_ledger_id,
      domain_pack: resume.domain_pack,
      policy_snapshot_id: resume.policy_snapshot_id,
      human_review_required: cancel.human_review_required ?? resume.human_review_required,
      law_firm_human_review_required: cancel.law_firm_human_review_required ?? resume.law_firm_human_review_required,
      idempotency_decision: "same_run",
      new_run_created: false,
      auto_resume_scheduled: false,
      auto_cancel_executed: false,
      protected_action_executed: false,
      decided_at: generatedAt,
    };
    decisions.push(
      { ...resumeDecision, decision_hash: hashValue(resumeDecision) },
      { ...cancelDecision, decision_hash: hashValue(cancelDecision) },
    );
  }
  return decisions.sort(by("resume_cancel_decision_record_id"));
}

function validateWorkflowResumeCancelContract({
  workflowIdempotencyLedger,
  workflowQueueRetryBackoff,
  workflowStateMachineRunner,
  workflowRunLedger,
  packageJson,
  roadmapText,
  idempotencyKeyRecords,
  workflowQueueRecords,
  runnerPlans,
  workflowRunRecords,
  resumeCursorRecords,
  cancelRequestRecords,
  resumeCancelDecisionRecords,
}) {
  const items = [];
  const keyIds = new Set(idempotencyKeyRecords.map((record) => record.idempotency_key_record_id));
  const resumeKeyIds = new Set(resumeCursorRecords.map((record) => record.idempotency_key_record_id));
  const cancelKeyIds = new Set(cancelRequestRecords.map((record) => record.idempotency_key_record_id));
  const resumeIds = new Set(resumeCursorRecords.map((record) => record.resume_cursor_record_id));
  const cancelIds = new Set(cancelRequestRecords.map((record) => record.cancel_request_record_id));
  const resumeDecisions = resumeCancelDecisionRecords.filter((record) => record.request_kind === "resume_request");
  const cancelDecisions = resumeCancelDecisionRecords.filter((record) => record.request_kind === "cancel_request");
  const summary = summarizeWorkflowResumeCancelContract({
    workflowIdempotencyLedger,
    workflowQueueRetryBackoff,
    workflowStateMachineRunner,
    workflowRunLedger,
    idempotencyKeyRecords,
    workflowQueueRecords,
    runnerPlans,
    workflowRunRecords,
    resumeCursorRecords,
    cancelRequestRecords,
    resumeCancelDecisionRecords,
    validation: { errors: [] },
    validationItems: [],
  });
  pushCheck(items, "source.workflow_idempotency_ledger", "workflow_idempotency_complete", workflowIdempotencyLedger.summary?.workflow_idempotency_status === "complete" && workflowIdempotencyLedger.validation?.valid !== false, "Workflow idempotency ledger must be complete.");
  pushCheck(items, "source.workflow_queue_retry_backoff_contract", "workflow_queue_retry_backoff_complete", workflowQueueRetryBackoff.summary?.workflow_queue_retry_backoff_status === "complete" && workflowQueueRetryBackoff.validation?.valid !== false, "Workflow queue/retry/backoff contract must be complete.");
  pushCheck(items, "source.workflow_state_machine_runner", "workflow_state_machine_runner_complete", workflowStateMachineRunner.summary?.workflow_state_machine_runner_status === "complete" && workflowStateMachineRunner.validation?.valid !== false, "Workflow state machine runner must be complete.");
  pushCheck(items, "source.workflow_run_ledger", "workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete" && workflowRunLedger.validation?.valid !== false, "Workflow run ledger must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:resume-cancel"]), "package.json must expose npm run workflows:resume-cancel.");
  pushCheck(items, "roadmap.phase_183", "phase_183_documented", roadmapText.includes("P183") && roadmapText.includes("resume/cancel"), "Roadmap must keep the P183 resume/cancel slot visible.");
  pushCheck(items, "resume_cursor_records", "resume_cursor_per_idempotency_key", resumeCursorRecords.length === idempotencyKeyRecords.length && resumeCursorRecords.length > 0 && [...keyIds].every((id) => resumeKeyIds.has(id)), "Every idempotency key must have one resume cursor.");
  pushCheck(items, "cancel_request_records", "cancel_request_per_idempotency_key", cancelRequestRecords.length === idempotencyKeyRecords.length && [...keyIds].every((id) => cancelKeyIds.has(id)), "Every idempotency key must have one cancel request.");
  pushCheck(items, "resume_cancel_decision_records", "resume_and_cancel_decision_per_key", resumeDecisions.length === idempotencyKeyRecords.length && cancelDecisions.length === idempotencyKeyRecords.length, "Each idempotency key must have one resume decision and one cancel decision.");
  pushCheck(items, "resume_cursor_records.source", "resume_count_matches_source_counts", resumeCursorRecords.length === workflowQueueRecords.length && resumeCursorRecords.length === runnerPlans.length && resumeCursorRecords.length === workflowRunRecords.length, "Resume cursor count must align with queue, runner, and workflow run records.");
  pushCheck(items, "resume_cursor_records.idempotency", "resume_uses_canonical_same_run", resumeCursorRecords.every((record) => record.workflow_run_id === record.canonical_workflow_run_id), "Resume must reuse the canonical workflow run.");
  pushCheck(items, "cancel_request_records.idempotency", "cancel_uses_canonical_same_run", cancelRequestRecords.every((record) => record.workflow_run_id === record.canonical_workflow_run_id), "Cancel requests must bind to the canonical workflow run.");
  pushCheck(items, "resume_cursor_records.human_gate", "held_resume_requires_human_gate", resumeCursorRecords.filter((record) => record.queue_status === "held_for_human_review").every((record) => record.resume_blocked && record.human_review_required && !record.auto_resume_allowed), "Held queues must remain blocked behind human review before resume.");
  pushCheck(items, "cancel_request_records.safe_hold", "cancel_requests_are_safe_holds", cancelRequestRecords.every((record) => record.safe_cancel_request && record.cancel_event_append_required && !record.auto_cancel_allowed && !record.destructive_mutation_allowed), "Cancel requests must be safe append-only requests without destructive mutation.");
  pushCheck(items, "resume_cancel_decision_records.bindings", "decisions_bind_to_resume_and_cancel_records", resumeDecisions.every((record) => resumeIds.has(record.resume_cursor_record_id)) && cancelDecisions.every((record) => resumeIds.has(record.resume_cursor_record_id) && cancelIds.has(record.cancel_request_record_id)), "Resume/cancel decisions must bind to their control records.");
  pushCheck(items, "resume_cancel_decision_records.execution", "no_auto_resume_cancel_or_protected_action", summary.auto_resume_allowed_count === 0 && summary.auto_cancel_allowed_count === 0 && summary.protected_action_executed_count === 0 && summary.new_run_created_count === 0, "Resume/cancel semantics must not auto-run, auto-cancel, create new runs, or execute protected actions.");
  pushCheck(items, "resume_cursor_records.law_firm", "law_firm_resume_held", summary.law_firm_resume_held_count === summary.law_firm_resume_cursor_count && summary.law_firm_resume_cursor_count > 0, "Law-firm resume cursors must remain held for human review.");
  pushCheck(items, "cancel_request_records.law_firm", "law_firm_cancel_requests_safe", summary.law_firm_cancel_request_count === summary.law_firm_resume_cursor_count && summary.law_firm_cancel_request_count > 0, "Law-firm cancel requests must be safe request records.");
  return items;
}

function summarizeWorkflowResumeCancelContract({
  workflowIdempotencyLedger,
  workflowQueueRetryBackoff,
  workflowStateMachineRunner,
  workflowRunLedger,
  idempotencyKeyRecords,
  workflowQueueRecords,
  runnerPlans,
  workflowRunRecords,
  resumeCursorRecords,
  cancelRequestRecords,
  resumeCancelDecisionRecords,
  validation,
  validationItems,
}) {
  const resumeDecisions = resumeCancelDecisionRecords.filter((record) => record.request_kind === "resume_request");
  const cancelDecisions = resumeCancelDecisionRecords.filter((record) => record.request_kind === "cancel_request");
  return {
    workflow_resume_cancel_status: validation.errors.length === 0 ? "complete" : "blocked",
    resume_cancel_contract_id: RESUME_CANCEL_CONTRACT_ID,
    source_workflow_idempotency_status: workflowIdempotencyLedger.summary?.workflow_idempotency_status ?? "unknown",
    source_workflow_queue_retry_backoff_status: workflowQueueRetryBackoff.summary?.workflow_queue_retry_backoff_status ?? "unknown",
    source_workflow_state_machine_runner_status: workflowStateMachineRunner.summary?.workflow_state_machine_runner_status ?? "unknown",
    source_workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
    source_idempotency_key_count: workflowIdempotencyLedger.summary?.idempotency_key_count ?? idempotencyKeyRecords.length,
    source_workflow_queue_record_count: workflowQueueRetryBackoff.summary?.workflow_queue_record_count ?? workflowQueueRecords.length,
    source_runner_plan_count: workflowStateMachineRunner.summary?.runner_plan_count ?? runnerPlans.length,
    source_workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
    resume_cursor_count: resumeCursorRecords.length,
    cancel_request_count: cancelRequestRecords.length,
    resume_cancel_decision_count: resumeCancelDecisionRecords.length,
    resume_decision_count: resumeDecisions.length,
    cancel_decision_count: cancelDecisions.length,
    long_running_workflow_count: resumeCursorRecords.filter((record) => record.long_running_workflow).length,
    resume_required_count: resumeCursorRecords.filter((record) => record.resume_required).length,
    resume_blocked_count: resumeCursorRecords.filter((record) => record.resume_blocked).length,
    held_resume_count: resumeCursorRecords.filter((record) => record.resume_state === "held_waiting_for_human_gate").length,
    human_gate_resume_count: resumeCursorRecords.filter((record) => record.human_review_required).length,
    law_firm_resume_cursor_count: resumeCursorRecords.filter((record) => record.domain_pack === "law-firm").length,
    law_firm_resume_held_count: resumeCursorRecords.filter((record) => record.domain_pack === "law-firm" && record.resume_state === "held_waiting_for_human_gate").length,
    safe_cancel_request_count: cancelRequestRecords.filter((record) => record.safe_cancel_request).length,
    cancel_request_pending_human_count: cancelRequestRecords.filter((record) => record.cancel_request_status === "requested_pending_human_review").length,
    cancel_event_append_required_count: cancelRequestRecords.filter((record) => record.cancel_event_append_required).length,
    law_firm_cancel_request_count: cancelRequestRecords.filter((record) => record.domain_pack === "law-firm" && record.safe_cancel_request).length,
    auto_resume_allowed_count: resumeCursorRecords.filter((record) => record.auto_resume_allowed).length,
    auto_cancel_allowed_count: cancelRequestRecords.filter((record) => record.auto_cancel_allowed).length,
    destructive_cancel_mutation_count: cancelRequestRecords.filter((record) => record.destructive_mutation_allowed).length,
    protected_action_executed_count: resumeCursorRecords.filter((record) => record.protected_action_execution_allowed).length
      + cancelRequestRecords.filter((record) => record.protected_action_execution_allowed).length
      + resumeCancelDecisionRecords.filter((record) => record.protected_action_executed).length,
    new_run_created_count: resumeCursorRecords.filter((record) => record.new_run_created_on_resume).length
      + cancelRequestRecords.filter((record) => record.new_run_created_on_cancel).length
      + resumeCancelDecisionRecords.filter((record) => record.new_run_created).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_resume_state: countByObject(resumeCursorRecords, "resume_state"),
    by_cancel_state: countByObject(cancelRequestRecords, "cancel_state"),
    by_cancel_request_status: countByObject(cancelRequestRecords, "cancel_request_status"),
    by_decision_status: countByObject(resumeCancelDecisionRecords, "decision_status"),
    by_domain_pack: countByObject(resumeCursorRecords, "domain_pack"),
  };
}

function buildResumeCancelContract(generatedAt) {
  return {
    schema_version: "workflow-resume-cancel-contract.v1",
    generated_at: generatedAt,
    resume_cancel_contract_id: RESUME_CANCEL_CONTRACT_ID,
    deterministic_control_semantics: true,
    idempotency_required: true,
    resume_policy: {
      cursor_required_for_every_idempotency_key: true,
      human_gate_required_for_held_resume: true,
      new_run_on_resume_allowed: false,
      auto_resume_allowed: false,
    },
    cancel_policy: {
      cancel_request_required_for_every_idempotency_key: true,
      cancel_is_append_only_request: true,
      destructive_mutation_allowed: false,
      auto_cancel_allowed: false,
    },
    protected_action_execution_allowed: false,
    law_firm_safety_rule: "Law-firm workflow resume and cancel controls remain held behind attorney or designated reviewer confirmation.",
  };
}

function resumePreconditions({ humanGateRequired }) {
  const preconditions = ["idempotency_key_match", "canonical_workflow_run_exists"];
  if (humanGateRequired) preconditions.push("human_approval_recorded");
  else preconditions.push("operator_resume_confirmation_recorded");
  return preconditions;
}

function cancelPreconditions({ humanGateRequired }) {
  const preconditions = ["idempotency_key_match", "canonical_workflow_run_exists", "append_cancel_event_before_terminal_state"];
  if (humanGateRequired) preconditions.push("human_cancel_decision_recorded");
  else preconditions.push("operator_cancel_confirmation_recorded");
  return preconditions;
}

function renderWorkflowResumeCancelMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Resume/Cancel Contract");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_resume_cancel_status}`);
  lines.push("");
  lines.push(`- Resume cursors: ${summary.resume_cursor_count}`);
  lines.push(`- Cancel requests: ${summary.cancel_request_count}`);
  lines.push(`- Resume/cancel decisions: ${summary.resume_cancel_decision_count}`);
  lines.push(`- Held resume cursors: ${summary.held_resume_count}`);
  lines.push(`- Law-firm held resume cursors: ${summary.law_firm_resume_held_count}`);
  lines.push(`- Safe cancel requests: ${summary.safe_cancel_request_count}`);
  lines.push(`- Auto resume/cancel allowed: ${summary.auto_resume_allowed_count}/${summary.auto_cancel_allowed_count}`);
  lines.push(`- New runs created: ${summary.new_run_created_count}`);
  lines.push(`- Protected actions executed: ${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Resume Cursors");
  lines.push("");
  for (const record of result.resume_cursor_records) {
    lines.push(`- ${record.workflow_run_id}: ${record.resume_state}, next=${record.next_resume_action}`);
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
    workflow_idempotency_ledger_path: path.resolve(options.workflowIdempotencyLedgerPath ?? DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowIdempotencyLedgerPath),
    workflow_queue_retry_backoff_path: path.resolve(options.workflowQueueRetryBackoffPath ?? DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowQueueRetryBackoffPath),
    workflow_state_machine_runner_path: path.resolve(options.workflowStateMachineRunnerPath ?? DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowStateMachineRunnerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowRunLedgerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowIdempotencyLedgerPath: DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowIdempotencyLedgerPath,
    workflowQueueRetryBackoffPath: DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowQueueRetryBackoffPath,
    workflowStateMachineRunnerPath: DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowStateMachineRunnerPath,
    workflowRunLedgerPath: DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.workflowRunLedgerPath,
    packagePath: DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_RESUME_CANCEL_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_RESUME_CANCEL_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-idempotency") parsed.workflowIdempotencyLedgerPath = argv[++index];
    else if (arg === "--workflow-queue-retry-backoff") parsed.workflowQueueRetryBackoffPath = argv[++index];
    else if (arg === "--workflow-state-machine-runner") parsed.workflowStateMachineRunnerPath = argv[++index];
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
  console.log(`Usage: node scripts/workflow-resume-cancel-contract.mjs [options]

Options:
  --workflow-idempotency <path>          workflow-idempotency-ledger.json path.
  --workflow-queue-retry-backoff <path>  workflow-queue-retry-backoff-contract.json path.
  --workflow-state-machine-runner <path> workflow-state-machine-runner.json path.
  --workflow-run-ledger <path>           workflow-run-ledger.json path.
  --package <path>                       package.json path.
  --roadmap <path>                       phase ledger path.
  --out-dir <folder>                     Output directory.
  --run-at <iso>                         Deterministic generated_at timestamp.
  --check                                Validate only, do not write artifacts.
  -h, --help                             Show this help.
`);
}

function serializableWorkflowResumeCancelContract(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
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
