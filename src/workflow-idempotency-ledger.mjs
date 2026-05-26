import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_OUT_DIR = "artifacts/workflow-idempotency/latest";
export const DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS = {
  workflowQueueRetryBackoffPath: "artifacts/workflow-queue-retry-backoff/latest/workflow-queue-retry-backoff-contract.json",
  workflowStateMachineRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const IDEMPOTENCY_CONTRACT_ID = "workflow-idempotency-ledger.v1";

export async function runWorkflowIdempotencyLedger(options = {}) {
  const result = await buildWorkflowIdempotencyLedger(options);
  if (options.write !== false) await writeWorkflowIdempotencyLedger(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow idempotency ledger validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowIdempotencyLedger(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowQueueRetryBackoff = await readJson(inputs.workflow_queue_retry_backoff_path);
  const workflowStateMachineRunner = await readJson(inputs.workflow_state_machine_runner_path);
  const workflowRunLedger = await readJson(inputs.workflow_run_ledger_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");
  const workflowQueueRecords = workflowQueueRetryBackoff.workflow_queue_records
    ?? workflowQueueRetryBackoff.workflow_queue_retry_backoff_contract?.workflow_queue_records
    ?? [];
  const runnerPlans = workflowStateMachineRunner.workflow_runner_plans
    ?? workflowStateMachineRunner.workflow_state_machine_runner?.workflow_runner_plans
    ?? [];
  const workflowRunRecords = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const idempotencyKeyRecords = buildIdempotencyKeyRecords({
    workflowQueueRecords,
    workflowRunRecords,
    generatedAt,
  });
  const idempotencyDecisionRecords = buildIdempotencyDecisionRecords({
    idempotencyKeyRecords,
    generatedAt,
  });
  const duplicateProbeRecords = buildDuplicateProbeRecords({
    idempotencyKeyRecords,
    idempotencyDecisionRecords,
    generatedAt,
  });
  const validationItems = validateWorkflowIdempotencyLedger({
    workflowQueueRetryBackoff,
    workflowStateMachineRunner,
    workflowRunLedger,
    packageJson,
    roadmapText,
    workflowQueueRecords,
    runnerPlans,
    workflowRunRecords,
    idempotencyKeyRecords,
    idempotencyDecisionRecords,
    duplicateProbeRecords,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-idempotency-ledger.v1",
    generated_at: generatedAt,
    workflow_idempotency_ledger_id: `workflow-idempotency-ledger.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_queue_retry_backoff_contract: {
        schema_version: workflowQueueRetryBackoff.schema_version ?? null,
        workflow_queue_retry_backoff_status: workflowQueueRetryBackoff.summary?.workflow_queue_retry_backoff_status ?? "unknown",
        workflow_queue_record_count: workflowQueueRetryBackoff.summary?.workflow_queue_record_count ?? workflowQueueRecords.length,
        retry_classification_count: workflowQueueRetryBackoff.summary?.retry_classification_count ?? 0,
        backoff_policy_count: workflowQueueRetryBackoff.summary?.backoff_policy_count ?? 0,
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
    workflow_idempotency_contract: buildIdempotencyContract(generatedAt),
    idempotency_key_records: idempotencyKeyRecords,
    idempotency_decision_records: idempotencyDecisionRecords,
    duplicate_probe_records: duplicateProbeRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowIdempotencyLedger({
      workflowQueueRetryBackoff,
      workflowStateMachineRunner,
      workflowRunLedger,
      workflowQueueRecords,
      runnerPlans,
      workflowRunRecords,
      idempotencyKeyRecords,
      idempotencyDecisionRecords,
      duplicateProbeRecords,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowIdempotencyLedgerMarkdown(result),
  };
}

export async function writeWorkflowIdempotencyLedger(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-idempotency-ledger.json"), serializableWorkflowIdempotencyLedger(result));
  await writeJson(path.join(outDir, "idempotency-key-records.json"), {
    schema_version: "workflow-idempotency-key-records.v1",
    generated_at: result.generated_at,
    idempotency_key_record_count: result.idempotency_key_records.length,
    idempotency_key_records: result.idempotency_key_records,
  });
  await writeJson(path.join(outDir, "idempotency-decision-records.json"), {
    schema_version: "workflow-idempotency-decision-records.v1",
    generated_at: result.generated_at,
    idempotency_decision_record_count: result.idempotency_decision_records.length,
    idempotency_decision_records: result.idempotency_decision_records,
  });
  await writeJson(path.join(outDir, "duplicate-probe-records.json"), {
    schema_version: "workflow-duplicate-probe-records.v1",
    generated_at: result.generated_at,
    duplicate_probe_record_count: result.duplicate_probe_records.length,
    duplicate_probe_records: result.duplicate_probe_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-idempotency-validation-report.v1",
    generated_at: result.generated_at,
    workflow_idempotency_ledger_id: result.workflow_idempotency_ledger_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowIdempotencyLedgerCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runWorkflowIdempotencyLedger(args);
    console.log(`Workflow idempotency ledger written to ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_idempotency_status}`);
    console.log(`Idempotency keys: ${result.summary.idempotency_key_count}`);
    console.log(`Duplicate probes: ${result.summary.duplicate_probe_count}`);
    console.log(`Skipped duplicates: ${result.summary.skipped_duplicate_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildIdempotencyKeyRecords({ workflowQueueRecords, workflowRunRecords, generatedAt }) {
  const runById = new Map(workflowRunRecords.map((record) => [record.workflow_run_id, record]));
  return workflowQueueRecords.map((queueRecord) => {
    const runRecord = runById.get(queueRecord.workflow_run_id) ?? {};
    const keyMaterial = {
      workflow_run_id: queueRecord.workflow_run_id,
      workflow_id: queueRecord.workflow_id,
      capability_id: queueRecord.capability_id,
      domain_pack: queueRecord.domain_pack,
      current_dsl_state: queueRecord.current_dsl_state,
      next_dsl_state: queueRecord.next_dsl_state,
      transition_guard_id: queueRecord.transition_guard_id,
      policy_snapshot_id: queueRecord.policy_snapshot_id,
      queue_status: queueRecord.queue_status,
    };
    const fingerprintHash = hashValue(keyMaterial);
    const idempotencyKey = `idem_${fingerprintHash.slice(0, 32)}`;
    const record = {
      schema_version: "workflow-idempotency-key-record.v1",
      idempotency_key_record_id: `workflow-idempotency-key.${slugify(queueRecord.workflow_run_id)}`,
      idempotency_key: idempotencyKey,
      idempotency_key_hash: `sha256:${fingerprintHash}`,
      key_scope: "workflow_run_transition",
      key_status: "registered_existing_run",
      source_workflow_queue_record_id: queueRecord.workflow_queue_record_id,
      workflow_run_id: queueRecord.workflow_run_id,
      canonical_workflow_run_id: queueRecord.workflow_run_id,
      run_ledger_id: queueRecord.run_ledger_id ?? runRecord.run_ledger_id ?? null,
      workflow_id: queueRecord.workflow_id,
      capability_id: queueRecord.capability_id,
      domain_pack: queueRecord.domain_pack,
      matter_id: runRecord.matter_id ?? null,
      policy_snapshot_id: queueRecord.policy_snapshot_id ?? runRecord.policy_snapshot_id ?? null,
      queue_status: queueRecord.queue_status,
      dequeue_policy: queueRecord.dequeue_policy,
      duplicate_policy: "same_run_or_skipped_duplicate",
      request_fingerprint_hash: `sha256:${fingerprintHash}`,
      key_material: keyMaterial,
      auto_enqueue_allowed: false,
      protected_action_execution_allowed: false,
      recorded_at: generatedAt,
    };
    return {
      ...record,
      record_hash: hashValue(record),
    };
  }).sort(by("idempotency_key_record_id"));
}

function buildIdempotencyDecisionRecords({ idempotencyKeyRecords, generatedAt }) {
  const records = [];
  for (const keyRecord of idempotencyKeyRecords) {
    const primaryDecision = {
      schema_version: "workflow-idempotency-decision-record.v1",
      idempotency_decision_record_id: `workflow-idempotency-decision.primary.${slugify(keyRecord.workflow_run_id)}`,
      idempotency_key_record_id: keyRecord.idempotency_key_record_id,
      idempotency_key: keyRecord.idempotency_key,
      source_workflow_queue_record_id: keyRecord.source_workflow_queue_record_id,
      workflow_run_id: keyRecord.workflow_run_id,
      canonical_workflow_run_id: keyRecord.canonical_workflow_run_id,
      request_kind: "primary_queue_request",
      request_status: "registered_existing_run",
      idempotency_decision: "same_run",
      duplicate_detected: false,
      new_run_created: false,
      skipped_duplicate: false,
      decision_reason: "first_request_reuses_event_backed_workflow_run",
      auto_enqueue_allowed: false,
      protected_action_execution_allowed: false,
      decided_at: generatedAt,
    };
    const duplicateDecision = {
      schema_version: "workflow-idempotency-decision-record.v1",
      idempotency_decision_record_id: `workflow-idempotency-decision.duplicate.${slugify(keyRecord.workflow_run_id)}`,
      idempotency_key_record_id: keyRecord.idempotency_key_record_id,
      idempotency_key: keyRecord.idempotency_key,
      source_workflow_queue_record_id: keyRecord.source_workflow_queue_record_id,
      workflow_run_id: keyRecord.workflow_run_id,
      canonical_workflow_run_id: keyRecord.canonical_workflow_run_id,
      request_kind: "duplicate_probe_request",
      request_status: "duplicate_skipped",
      idempotency_decision: "skipped_duplicate",
      duplicate_detected: true,
      new_run_created: false,
      skipped_duplicate: true,
      decision_reason: "matching_idempotency_key_resolves_to_existing_workflow_run",
      auto_enqueue_allowed: false,
      protected_action_execution_allowed: false,
      decided_at: generatedAt,
    };
    records.push(
      { ...primaryDecision, decision_hash: hashValue(primaryDecision) },
      { ...duplicateDecision, decision_hash: hashValue(duplicateDecision) },
    );
  }
  return records.sort(by("idempotency_decision_record_id"));
}

function buildDuplicateProbeRecords({ idempotencyKeyRecords, idempotencyDecisionRecords, generatedAt }) {
  const duplicateDecisionByKey = new Map(
    idempotencyDecisionRecords
      .filter((decision) => decision.idempotency_decision === "skipped_duplicate")
      .map((decision) => [decision.idempotency_key_record_id, decision]),
  );
  return idempotencyKeyRecords.map((keyRecord) => {
    const decision = duplicateDecisionByKey.get(keyRecord.idempotency_key_record_id) ?? {};
    const probe = {
      schema_version: "workflow-duplicate-probe-record.v1",
      duplicate_probe_record_id: `workflow-duplicate-probe.${slugify(keyRecord.workflow_run_id)}`,
      idempotency_key_record_id: keyRecord.idempotency_key_record_id,
      idempotency_decision_record_id: decision.idempotency_decision_record_id ?? null,
      idempotency_key: keyRecord.idempotency_key,
      source_workflow_queue_record_id: keyRecord.source_workflow_queue_record_id,
      attempted_workflow_run_id: keyRecord.workflow_run_id,
      resolved_workflow_run_id: keyRecord.canonical_workflow_run_id,
      duplicate_probe_status: "skipped_duplicate",
      duplicate_detected: true,
      new_run_created: false,
      skipped_duplicate: true,
      protected_action_execution_allowed: false,
      probed_at: generatedAt,
    };
    return {
      ...probe,
      duplicate_probe_hash: hashValue(probe),
    };
  }).sort(by("duplicate_probe_record_id"));
}

function validateWorkflowIdempotencyLedger({
  workflowQueueRetryBackoff,
  workflowStateMachineRunner,
  workflowRunLedger,
  packageJson,
  roadmapText,
  workflowQueueRecords,
  runnerPlans,
  workflowRunRecords,
  idempotencyKeyRecords,
  idempotencyDecisionRecords,
  duplicateProbeRecords,
}) {
  const items = [];
  const keySet = new Set(idempotencyKeyRecords.map((record) => record.idempotency_key));
  const queueIds = new Set(workflowQueueRecords.map((record) => record.workflow_queue_record_id));
  const keyQueueIds = new Set(idempotencyKeyRecords.map((record) => record.source_workflow_queue_record_id));
  const primaryDecisions = idempotencyDecisionRecords.filter((record) => record.idempotency_decision === "same_run");
  const duplicateDecisions = idempotencyDecisionRecords.filter((record) => record.idempotency_decision === "skipped_duplicate");
  const decisionKeyIds = new Set(idempotencyDecisionRecords.map((record) => record.idempotency_key_record_id));
  const probeDecisionIds = new Set(duplicateProbeRecords.map((record) => record.idempotency_decision_record_id));
  const duplicateDecisionIds = new Set(duplicateDecisions.map((record) => record.idempotency_decision_record_id));
  const crossWorkflowCollisionCount = countCrossWorkflowKeyCollisions(idempotencyKeyRecords);
  pushCheck(items, "source.workflow_queue_retry_backoff_contract", "workflow_queue_retry_backoff_complete", workflowQueueRetryBackoff.summary?.workflow_queue_retry_backoff_status === "complete" && workflowQueueRetryBackoff.validation?.valid !== false, "Workflow queue/retry/backoff contract must be complete.");
  pushCheck(items, "source.workflow_state_machine_runner", "workflow_state_machine_runner_complete", workflowStateMachineRunner.summary?.workflow_state_machine_runner_status === "complete" && workflowStateMachineRunner.validation?.valid !== false, "Workflow state machine runner must be complete.");
  pushCheck(items, "source.workflow_run_ledger", "workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete" && workflowRunLedger.validation?.valid !== false, "Workflow run ledger must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:idempotency"]), "package.json must expose npm run workflows:idempotency.");
  pushCheck(items, "roadmap.phase_182", "phase_182_documented", roadmapText.includes("P182") && roadmapText.includes("idempotency"), "Roadmap must keep the P182 idempotency slot visible.");
  pushCheck(items, "idempotency_key_records", "key_covers_every_queue_record", idempotencyKeyRecords.length === workflowQueueRecords.length && idempotencyKeyRecords.length > 0 && [...queueIds].every((id) => keyQueueIds.has(id)), "Every workflow queue record must have one idempotency key.");
  pushCheck(items, "idempotency_key_records.keys", "idempotency_keys_are_unique", keySet.size === idempotencyKeyRecords.length, "Idempotency keys must be unique across distinct workflow queue records.");
  pushCheck(items, "idempotency_key_records.collisions", "no_cross_workflow_key_collision", crossWorkflowCollisionCount === 0, "Different workflow runs must not share the same idempotency key.");
  pushCheck(items, "idempotency_key_records.source", "key_count_matches_runner_plan_count", idempotencyKeyRecords.length === runnerPlans.length && idempotencyKeyRecords.length === workflowRunRecords.length, "Idempotency keys must align with runner plans and workflow run records.");
  pushCheck(items, "idempotency_decision_records", "primary_and_duplicate_decision_per_key", primaryDecisions.length === idempotencyKeyRecords.length && duplicateDecisions.length === idempotencyKeyRecords.length && decisionKeyIds.size === idempotencyKeyRecords.length, "Each idempotency key must have one primary same-run decision and one duplicate-skip decision.");
  pushCheck(items, "duplicate_probe_records", "duplicate_probe_per_key", duplicateProbeRecords.length === idempotencyKeyRecords.length, "Each idempotency key must have one deterministic duplicate probe.");
  pushCheck(items, "duplicate_probe_records.decisions", "duplicate_probes_bind_to_skip_decisions", duplicateProbeRecords.every((probe) => duplicateDecisionIds.has(probe.idempotency_decision_record_id)) && probeDecisionIds.size === duplicateProbeRecords.length, "Duplicate probes must bind to skipped-duplicate decisions.");
  pushCheck(items, "idempotency_decision_records.same_run", "primary_requests_reuse_same_run", primaryDecisions.every((decision) => decision.idempotency_decision === "same_run" && !decision.new_run_created && decision.workflow_run_id === decision.canonical_workflow_run_id), "Primary requests must resolve to the existing workflow run.");
  pushCheck(items, "duplicate_probe_records.skipped", "duplicates_are_skipped_without_new_run", duplicateProbeRecords.every((probe) => probe.duplicate_probe_status === "skipped_duplicate" && probe.skipped_duplicate && !probe.new_run_created), "Duplicate requests must be skipped without creating a new run.");
  pushCheck(items, "idempotency_decision_records.execution", "no_auto_enqueue_or_protected_action", idempotencyKeyRecords.every((record) => !record.auto_enqueue_allowed && !record.protected_action_execution_allowed) && idempotencyDecisionRecords.every((record) => !record.auto_enqueue_allowed && !record.protected_action_execution_allowed) && duplicateProbeRecords.every((record) => !record.protected_action_execution_allowed), "Idempotency manager must not auto-enqueue or execute protected actions.");
  pushCheck(items, "idempotency_key_records.law_firm", "law_firm_duplicates_hold", idempotencyKeyRecords.filter((record) => record.domain_pack === "law-firm").every((record) => record.queue_status === "held_for_human_review"), "Law-firm idempotency keys must preserve held queue status.");
  return items;
}

function summarizeWorkflowIdempotencyLedger({
  workflowQueueRetryBackoff,
  workflowStateMachineRunner,
  workflowRunLedger,
  workflowQueueRecords,
  runnerPlans,
  workflowRunRecords,
  idempotencyKeyRecords,
  idempotencyDecisionRecords,
  duplicateProbeRecords,
  validation,
  validationItems,
}) {
  const uniqueKeyCount = new Set(idempotencyKeyRecords.map((record) => record.idempotency_key)).size;
  const duplicateCollisionCount = idempotencyKeyRecords.length - uniqueKeyCount;
  const crossWorkflowKeyCollisionCount = countCrossWorkflowKeyCollisions(idempotencyKeyRecords);
  return {
    workflow_idempotency_status: validation.errors.length === 0 ? "complete" : "blocked",
    idempotency_contract_id: IDEMPOTENCY_CONTRACT_ID,
    source_workflow_queue_retry_backoff_status: workflowQueueRetryBackoff.summary?.workflow_queue_retry_backoff_status ?? "unknown",
    source_workflow_state_machine_runner_status: workflowStateMachineRunner.summary?.workflow_state_machine_runner_status ?? "unknown",
    source_workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
    source_workflow_queue_record_count: workflowQueueRetryBackoff.summary?.workflow_queue_record_count ?? workflowQueueRecords.length,
    source_runner_plan_count: workflowStateMachineRunner.summary?.runner_plan_count ?? runnerPlans.length,
    source_workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunRecords.length,
    idempotency_key_count: idempotencyKeyRecords.length,
    unique_idempotency_key_count: uniqueKeyCount,
    duplicate_collision_count: duplicateCollisionCount,
    cross_workflow_key_collision_count: crossWorkflowKeyCollisionCount,
    idempotency_decision_count: idempotencyDecisionRecords.length,
    primary_decision_count: idempotencyDecisionRecords.filter((record) => record.request_kind === "primary_queue_request").length,
    duplicate_decision_count: idempotencyDecisionRecords.filter((record) => record.request_kind === "duplicate_probe_request").length,
    same_run_resolution_count: idempotencyDecisionRecords.filter((record) => record.idempotency_decision === "same_run").length,
    skipped_duplicate_count: idempotencyDecisionRecords.filter((record) => record.idempotency_decision === "skipped_duplicate").length,
    duplicate_probe_count: duplicateProbeRecords.length,
    duplicate_probe_skipped_count: duplicateProbeRecords.filter((record) => record.duplicate_probe_status === "skipped_duplicate").length,
    new_run_created_count: idempotencyDecisionRecords.filter((record) => record.new_run_created).length + duplicateProbeRecords.filter((record) => record.new_run_created).length,
    held_queue_key_count: idempotencyKeyRecords.filter((record) => record.queue_status === "held_for_human_review").length,
    law_firm_key_count: idempotencyKeyRecords.filter((record) => record.domain_pack === "law-firm").length,
    law_firm_skipped_duplicate_count: duplicateProbeRecords.filter((probe) => {
      const keyRecord = idempotencyKeyRecords.find((record) => record.idempotency_key_record_id === probe.idempotency_key_record_id);
      return keyRecord?.domain_pack === "law-firm" && probe.duplicate_probe_status === "skipped_duplicate";
    }).length,
    auto_enqueue_allowed_count: idempotencyKeyRecords.filter((record) => record.auto_enqueue_allowed).length + idempotencyDecisionRecords.filter((record) => record.auto_enqueue_allowed).length,
    protected_action_executed_count: idempotencyKeyRecords.filter((record) => record.protected_action_execution_allowed).length
      + idempotencyDecisionRecords.filter((record) => record.protected_action_execution_allowed).length
      + duplicateProbeRecords.filter((record) => record.protected_action_execution_allowed).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_key_status: countByObject(idempotencyKeyRecords, "key_status"),
    by_idempotency_decision: countByObject(idempotencyDecisionRecords, "idempotency_decision"),
    by_duplicate_probe_status: countByObject(duplicateProbeRecords, "duplicate_probe_status"),
    by_queue_status: countByObject(idempotencyKeyRecords, "queue_status"),
    by_domain_pack: countByObject(idempotencyKeyRecords, "domain_pack"),
  };
}

function buildIdempotencyContract(generatedAt) {
  return {
    schema_version: "workflow-idempotency-contract.v1",
    generated_at: generatedAt,
    idempotency_contract_id: IDEMPOTENCY_CONTRACT_ID,
    deterministic_key_manager: true,
    key_scope: "workflow_run_transition",
    duplicate_policy: "same_run_or_skipped_duplicate",
    new_run_on_duplicate_allowed: false,
    automatic_enqueue_allowed: false,
    protected_action_execution_allowed: false,
    key_material_fields: [
      "workflow_run_id",
      "workflow_id",
      "capability_id",
      "domain_pack",
      "current_dsl_state",
      "next_dsl_state",
      "transition_guard_id",
      "policy_snapshot_id",
      "queue_status",
    ],
    duplicate_resolution_rule: "A request with the same idempotency key resolves to the canonical workflow run and is recorded as skipped_duplicate when replayed.",
  };
}

function renderWorkflowIdempotencyLedgerMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow Idempotency Ledger");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_idempotency_status}`);
  lines.push("");
  lines.push(`- Idempotency keys: ${summary.idempotency_key_count}`);
  lines.push(`- Duplicate probes: ${summary.duplicate_probe_count}`);
  lines.push(`- Same-run resolutions: ${summary.same_run_resolution_count}`);
  lines.push(`- Skipped duplicates: ${summary.skipped_duplicate_count}`);
  lines.push(`- New runs created from duplicates: ${summary.new_run_created_count}`);
  lines.push(`- Cross-workflow key collisions: ${summary.cross_workflow_key_collision_count}`);
  lines.push(`- Protected actions executed: ${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Idempotency Keys");
  lines.push("");
  for (const record of result.idempotency_key_records) {
    lines.push(`- ${record.workflow_run_id}: ${record.idempotency_key} (${record.queue_status}, ${record.duplicate_policy})`);
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
    workflow_queue_retry_backoff_path: path.resolve(options.workflowQueueRetryBackoffPath ?? DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.workflowQueueRetryBackoffPath),
    workflow_state_machine_runner_path: path.resolve(options.workflowStateMachineRunnerPath ?? DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.workflowStateMachineRunnerPath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.workflowRunLedgerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowQueueRetryBackoffPath: DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.workflowQueueRetryBackoffPath,
    workflowStateMachineRunnerPath: DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.workflowStateMachineRunnerPath,
    workflowRunLedgerPath: DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.workflowRunLedgerPath,
    packagePath: DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_IDEMPOTENCY_LEDGER_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
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
  console.log(`Usage: node scripts/workflow-idempotency-ledger.mjs [options]

Options:
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

function serializableWorkflowIdempotencyLedger(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function countCrossWorkflowKeyCollisions(idempotencyKeyRecords) {
  const workflowsByKey = new Map();
  for (const record of idempotencyKeyRecords) {
    if (!workflowsByKey.has(record.idempotency_key)) workflowsByKey.set(record.idempotency_key, new Set());
    workflowsByKey.get(record.idempotency_key).add(record.workflow_run_id);
  }
  return [...workflowsByKey.values()].filter((workflowIds) => workflowIds.size > 1).length;
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
