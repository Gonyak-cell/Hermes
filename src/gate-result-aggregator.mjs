import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_GATE_RESULT_AGGREGATOR_OUT_DIR = "artifacts/gate-result-aggregator/latest";
export const DEFAULT_GATE_RESULT_AGGREGATOR_INPUTS = {
  workflowPreRunGateFrameworkPath: "artifacts/workflow-pre-run-gates/latest/workflow-pre-run-gate-framework.json",
  workflowInRunGateFrameworkPath: "artifacts/workflow-in-run-gates/latest/workflow-in-run-gate-framework.json",
  workflowPostRunGateFrameworkPath: "artifacts/workflow-post-run-gates/latest/workflow-post-run-gate-framework.json",
  gateApprovalContractFreezePath: "artifacts/gate-approval-contract-freeze/latest/gate-approval-contract-freeze.json",
  workflowRunLedgerPath: "artifacts/workflow-run-ledger/latest/workflow-run-ledger.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const GATE_RESULT_AGGREGATOR_CONTRACT_ID = "gate-result-aggregator.v1";
const GATE_AGGREGATE_RECORD_SCHEMA_VERSION = "gate-aggregate-record.v1";
const WORKFLOW_GATE_STATUS_SCHEMA_VERSION = "workflow-gate-status.v1";

export async function runGateResultAggregator(options = {}) {
  const result = await buildGateResultAggregator(options);
  if (options.write !== false) await writeGateResultAggregator(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Gate result aggregator validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildGateResultAggregator(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_GATE_RESULT_AGGREGATOR_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowPreRunGateFramework = await readJson(inputs.workflow_pre_run_gate_framework_path);
  const workflowInRunGateFramework = await readJson(inputs.workflow_in_run_gate_framework_path);
  const workflowPostRunGateFramework = await readJson(inputs.workflow_post_run_gate_framework_path);
  const gateApprovalContractFreeze = await readJson(inputs.gate_approval_contract_freeze_path);
  const workflowRunLedger = await readJson(inputs.workflow_run_ledger_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const aggregateRecords = buildGateAggregateRecords({
    workflowPreRunGateFramework,
    workflowInRunGateFramework,
    workflowPostRunGateFramework,
    gateApprovalContractFreeze,
    generatedAt,
  });
  const workflowGateStatuses = buildWorkflowGateStatuses({
    aggregateRecords,
    workflowRunLedger,
    generatedAt,
  });
  const validationItems = validateGateResultAggregator({
    workflowPreRunGateFramework,
    workflowInRunGateFramework,
    workflowPostRunGateFramework,
    gateApprovalContractFreeze,
    workflowRunLedger,
    agentRunLedger,
    packageJson,
    roadmapText,
    aggregateRecords,
    workflowGateStatuses,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "gate-result-aggregator.v1",
    generated_at: generatedAt,
    gate_result_aggregator_id: `gate-result-aggregator.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_pre_run_gate_framework: sourceSummary(workflowPreRunGateFramework, "workflow_pre_run_gate_framework_status"),
      workflow_in_run_gate_framework: sourceSummary(workflowInRunGateFramework, "workflow_in_run_gate_framework_status"),
      workflow_post_run_gate_framework: sourceSummary(workflowPostRunGateFramework, "workflow_post_run_gate_framework_status"),
      gate_approval_contract_freeze: sourceSummary(gateApprovalContractFreeze, "freeze_status"),
      workflow_run_ledger: sourceSummary(workflowRunLedger, "workflow_run_ledger_status"),
      agent_run_ledger: sourceSummary(agentRunLedger, "agent_run_ledger_status"),
    },
    gate_result_aggregator_contract: buildGateResultAggregatorContract(generatedAt),
    gate_aggregate_records: aggregateRecords,
    workflow_gate_status_records: workflowGateStatuses,
    validation_items: validationItems,
    validation,
    summary: summarizeGateResultAggregator({
      workflowPreRunGateFramework,
      workflowInRunGateFramework,
      workflowPostRunGateFramework,
      gateApprovalContractFreeze,
      workflowRunLedger,
      agentRunLedger,
      aggregateRecords,
      workflowGateStatuses,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderGateResultAggregatorMarkdown(result),
  };
}

export async function writeGateResultAggregator(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "gate-result-aggregator.json"), serializableGateResultAggregator(result));
  await writeJson(path.join(outDir, "gate-aggregate-records.json"), {
    schema_version: "gate-aggregate-records.v1",
    generated_at: result.generated_at,
    gate_aggregate_record_count: result.gate_aggregate_records.length,
    gate_aggregate_records: result.gate_aggregate_records,
  });
  await writeJson(path.join(outDir, "workflow-gate-statuses.json"), {
    schema_version: "workflow-gate-status-records.v1",
    generated_at: result.generated_at,
    workflow_gate_status_count: result.workflow_gate_status_records.length,
    workflow_gate_status_records: result.workflow_gate_status_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "gate-result-aggregator-validation-report.v1",
    generated_at: result.generated_at,
    gate_result_aggregator_id: result.gate_result_aggregator_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runGateResultAggregatorCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runGateResultAggregator(args);
    console.log(`Gate result aggregator ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.gate_result_aggregator_status}`);
    console.log(`Aggregate records: ${result.summary.gate_aggregate_record_count}`);
    console.log(`Workflow statuses: ${result.summary.workflow_gate_status_count}`);
    console.log(`Manual-review workflows: ${result.summary.manual_review_required_workflow_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildGateAggregateRecords({
  workflowPreRunGateFramework,
  workflowInRunGateFramework,
  workflowPostRunGateFramework,
  gateApprovalContractFreeze,
  generatedAt,
}) {
  const records = [];
  const addRecord = (record) => records.push({
    ...record,
    gate_aggregate_record_hash: sha256(record),
  });

  for (const gate of workflowPreRunGateFramework.pre_run_gate_records ?? []) {
    addRecord(buildGateAggregateRecord({
      generatedAt,
      sourceArtifactId: "workflow_pre_run_gate_framework",
      sourceRecordId: gate.pre_run_gate_record_id,
      sourceSchemaVersion: gate.schema_version,
      sourceGateContractId: gate.pre_run_gate_framework_contract_id,
      aggregateGateStage: "pre_run",
      aggregateGateType: gate.gate_type,
      aggregateGateState: normalizeGateState(gate.pre_run_gate_status, {
        humanReviewRequired: gate.human_review_required,
        blocking: gate.pre_run_gate_status === "blocked",
      }),
      sourceGateStatus: gate.pre_run_gate_status,
      sourceGateDecision: gate.pre_run_gate_decision,
      workflowRunId: gate.workflow_run_id,
      matterId: gate.matter_id,
      domainPack: gate.domain_pack ?? null,
      capabilityId: null,
      runtimeId: null,
      gateId: gate.gate_type,
      reasonCodes: gate.reason_codes,
      humanReviewRequired: gate.human_review_required,
      blocking: gate.pre_run_gate_status === "blocked",
      executionAllowed: gate.execution_allowed,
      executionPerformed: false,
      externalTransferAllowed: gate.external_transfer_allowed,
      protectedActionExecutionAllowed: gate.protected_action_execution_allowed,
      clientFacingReady: false,
      deliveryReady: false,
      finalActionExecuted: false,
    }));
  }

  for (const gate of workflowInRunGateFramework.in_run_gate_records ?? []) {
    addRecord(buildGateAggregateRecord({
      generatedAt,
      sourceArtifactId: "workflow_in_run_gate_framework",
      sourceRecordId: gate.in_run_gate_record_id,
      sourceSchemaVersion: gate.schema_version,
      sourceGateContractId: gate.in_run_gate_framework_contract_id,
      aggregateGateStage: "in_run",
      aggregateGateType: gate.gate_type,
      aggregateGateState: normalizeInRunGateState(gate),
      sourceGateStatus: gate.in_run_gate_status,
      sourceGateDecision: gate.in_run_gate_decision,
      workflowRunId: gate.workflow_run_id,
      agentRunId: gate.agent_run_id,
      toolInvocationId: gate.tool_invocation_id,
      matterId: gate.matter_id,
      domainPack: gate.domain_pack,
      runtimeId: gate.runtime_id,
      gateId: gate.gate_type,
      reasonCodes: gate.reason_codes,
      humanReviewRequired: gate.human_review_required,
      blocking: gate.in_run_gate_status === "blocked",
      executionAllowed: gate.execution_allowed,
      executionPerformed: gate.execution_performed,
      externalTransferAllowed: gate.external_transfer_allowed,
      protectedActionExecutionAllowed: gate.protected_action_execution_allowed,
      clientFacingReady: false,
      deliveryReady: false,
      finalActionExecuted: false,
    }));
  }

  for (const block of workflowInRunGateFramework.in_run_block_records ?? []) {
    addRecord(buildGateAggregateRecord({
      generatedAt,
      sourceArtifactId: "workflow_in_run_gate_framework",
      sourceRecordId: block.in_run_block_record_id,
      sourceSchemaVersion: block.schema_version,
      sourceGateContractId: block.in_run_gate_framework_contract_id,
      aggregateGateStage: "in_run",
      aggregateGateType: block.gate_type,
      aggregateGateState: "warn",
      sourceGateStatus: block.in_run_block_status,
      sourceGateDecision: "block",
      workflowRunId: block.workflow_run_id,
      agentRunId: block.agent_run_id,
      toolInvocationId: block.tool_invocation_id,
      matterId: block.matter_id,
      domainPack: block.domain_pack,
      runtimeId: block.runtime_id,
      gateId: block.gate_type,
      reasonCodes: block.block_reason_codes,
      humanReviewRequired: block.human_review_required,
      blocking: true,
      executionAllowed: block.execution_allowed,
      executionPerformed: block.execution_performed,
      externalTransferAllowed: block.external_transfer_allowed,
      protectedActionExecutionAllowed: block.protected_action_execution_allowed,
      clientFacingReady: false,
      deliveryReady: false,
      finalActionExecuted: false,
      metadata: {
        in_run_block_type: block.in_run_block_type,
        source_permission_status: block.source_permission_status,
      },
    }));
  }

  for (const gate of workflowPostRunGateFramework.post_run_gate_records ?? []) {
    addRecord(buildGateAggregateRecord({
      generatedAt,
      sourceArtifactId: "workflow_post_run_gate_framework",
      sourceRecordId: gate.post_run_gate_record_id,
      sourceSchemaVersion: gate.schema_version,
      sourceGateContractId: gate.post_run_gate_framework_contract_id,
      aggregateGateStage: "post_run",
      aggregateGateType: gate.gate_type,
      aggregateGateState: normalizeGateState(gate.post_run_gate_status, {
        humanReviewRequired: gate.human_review_required,
        blocking: gate.post_run_gate_status === "blocked",
      }),
      sourceGateStatus: gate.post_run_gate_status,
      sourceGateDecision: gate.post_run_gate_decision,
      workflowRunId: gate.workflow_run_id,
      agentRunId: gate.agent_run_id,
      matterId: gate.matter_id,
      domainPack: gate.domain_pack,
      capabilityId: gate.capability_id,
      runtimeId: gate.runtime_id,
      gateId: gate.gate_type,
      reasonCodes: gate.reason_codes,
      humanReviewRequired: gate.human_review_required,
      blocking: gate.post_run_gate_status === "blocked",
      executionAllowed: gate.execution_allowed,
      executionPerformed: gate.execution_performed,
      externalTransferAllowed: gate.external_transfer_allowed,
      protectedActionExecutionAllowed: gate.protected_action_execution_allowed,
      clientFacingReady: gate.client_facing_ready,
      deliveryReady: gate.delivery_ready,
      finalActionExecuted: gate.final_action_executed,
    }));
  }

  for (const gate of gateApprovalContractFreeze.gate_approval_contract?.gate_results ?? []) {
    addRecord(buildGateAggregateRecord({
      generatedAt,
      sourceArtifactId: "gate_approval_contract_freeze",
      sourceRecordId: gate.gate_result_id,
      sourceSchemaVersion: gate.schema_version,
      sourceGateContractId: gateApprovalContractFreeze.gate_approval_contract?.schema_version ?? gateApprovalContractFreeze.schema_version,
      aggregateGateStage: gate.gate_stage,
      aggregateGateType: gate.gate_id,
      aggregateGateState: normalizeGateResultState(gate),
      sourceGateStatus: gate.source_status ?? gate.gate_outcome,
      sourceGateDecision: gate.gate_outcome,
      workflowRunId: gate.workflow_run_id,
      matterId: gate.matter_id,
      domainPack: gate.domain_pack,
      capabilityId: gate.capability_id,
      gateResultId: gate.gate_result_id,
      gateId: gate.gate_id,
      reasonCodes: (gate.findings ?? []).map((finding) => finding.finding_id).filter(Boolean),
      humanReviewRequired: gate.human_approval_gate || gate.separated_approval_object_required,
      blocking: gate.blocking,
      executionAllowed: false,
      executionPerformed: false,
      externalTransferAllowed: false,
      protectedActionExecutionAllowed: false,
      clientFacingReady: false,
      deliveryReady: false,
      finalActionExecuted: false,
      metadata: {
        event_type: gate.event_type ?? null,
        linked_approval_request_count: gate.linked_approval_request_count ?? 0,
        approval_separation_status: gate.approval_separation_status ?? null,
      },
    }));
  }

  return records.sort((left, right) => left.gate_aggregate_record_id.localeCompare(right.gate_aggregate_record_id));
}

function buildGateAggregateRecord({
  generatedAt,
  sourceArtifactId,
  sourceRecordId,
  sourceSchemaVersion,
  sourceGateContractId,
  aggregateGateStage,
  aggregateGateType,
  aggregateGateState,
  sourceGateStatus,
  sourceGateDecision,
  workflowRunId,
  agentRunId = null,
  toolInvocationId = null,
  matterId = null,
  domainPack = null,
  capabilityId = null,
  runtimeId = null,
  gateResultId = null,
  gateId = null,
  reasonCodes = [],
  humanReviewRequired = false,
  blocking = false,
  executionAllowed = false,
  executionPerformed = false,
  externalTransferAllowed = false,
  protectedActionExecutionAllowed = false,
  clientFacingReady = false,
  deliveryReady = false,
  finalActionExecuted = false,
  metadata = {},
}) {
  const record = {
    schema_version: GATE_AGGREGATE_RECORD_SCHEMA_VERSION,
    gate_aggregate_record_id: `gate-aggregate.${slug(sourceArtifactId)}.${slug(sourceRecordId)}`,
    gate_result_aggregator_contract_id: GATE_RESULT_AGGREGATOR_CONTRACT_ID,
    source_artifact_id: sourceArtifactId,
    source_record_id: sourceRecordId,
    source_schema_version: sourceSchemaVersion ?? null,
    source_gate_contract_id: sourceGateContractId ?? null,
    aggregate_gate_stage: aggregateGateStage ?? "unknown",
    aggregate_gate_type: aggregateGateType ?? "unknown",
    aggregate_gate_state: aggregateGateState,
    source_gate_status: sourceGateStatus ?? null,
    source_gate_decision: sourceGateDecision ?? null,
    workflow_run_id: workflowRunId ?? null,
    agent_run_id: agentRunId,
    tool_invocation_id: toolInvocationId,
    matter_id: matterId,
    domain_pack: domainPack,
    capability_id: capabilityId,
    runtime_id: runtimeId,
    gate_result_id: gateResultId,
    gate_id: gateId ?? aggregateGateType ?? null,
    human_review_required: Boolean(humanReviewRequired),
    blocking: Boolean(blocking),
    execution_allowed: Boolean(executionAllowed),
    execution_performed: Boolean(executionPerformed),
    external_transfer_allowed: Boolean(externalTransferAllowed),
    protected_action_execution_allowed: Boolean(protectedActionExecutionAllowed),
    client_facing_ready: Boolean(clientFacingReady),
    delivery_ready: Boolean(deliveryReady),
    final_action_executed: Boolean(finalActionExecuted),
    reason_codes: [...new Set(reasonCodes ?? [])].filter(Boolean),
    recorded_at: generatedAt,
    metadata,
  };
  return record;
}

function buildWorkflowGateStatuses({ aggregateRecords, workflowRunLedger, generatedAt }) {
  const workflowRuns = workflowRunLedger.workflow_run_catalog?.workflow_run_records ?? [];
  const recordsByWorkflowRun = groupBy(aggregateRecords, "workflow_run_id");
  const workflowRunIds = new Set([
    ...workflowRuns.map((run) => run.workflow_run_id).filter(Boolean),
    ...aggregateRecords.map((record) => record.workflow_run_id).filter(Boolean),
  ]);

  return [...workflowRunIds].sort().map((workflowRunId) => {
    const workflowRun = workflowRuns.find((run) => run.workflow_run_id === workflowRunId) ?? {};
    const records = recordsByWorkflowRun.get(workflowRunId) ?? [];
    const passCount = records.filter((record) => record.aggregate_gate_state === "pass").length;
    const warnCount = records.filter((record) => record.aggregate_gate_state === "warn").length;
    const manualCount = records.filter((record) => record.aggregate_gate_state === "manual").length;
    const failCount = records.filter((record) => record.aggregate_gate_state === "fail").length;
    const status = failCount > 0
      ? "blocked"
      : manualCount > 0
        ? "manual_review_required"
        : warnCount > 0
          ? "warning"
          : "passed";
    const record = {
      schema_version: WORKFLOW_GATE_STATUS_SCHEMA_VERSION,
      workflow_gate_status_id: `workflow-gate-status.${slug(workflowRunId)}`,
      gate_result_aggregator_contract_id: GATE_RESULT_AGGREGATOR_CONTRACT_ID,
      workflow_run_id: workflowRunId,
      workflow_run_record_id: workflowRun.workflow_run_record_id ?? null,
      workflow_id: workflowRun.workflow_id ?? null,
      run_ledger_id: workflowRun.run_ledger_id ?? null,
      matter_id: workflowRun.matter_id ?? first(records.map((item) => item.matter_id)),
      domain_pack: workflowRun.domain_pack ?? first(records.map((item) => item.domain_pack)),
      capability_id: workflowRun.capability_id ?? first(records.map((item) => item.capability_id)),
      source_run_status: workflowRun.run_status ?? null,
      source_terminal_state: workflowRun.terminal_state ?? null,
      workflow_gate_status: status,
      gate_aggregate_record_count: records.length,
      passed_gate_count: passCount,
      warning_gate_count: warnCount,
      manual_gate_count: manualCount,
      failed_gate_count: failCount,
      human_review_required: manualCount > 0 || records.some((record) => record.human_review_required),
      ready_for_execution: false,
      ready_for_delivery: false,
      final_action_allowed: false,
      execution_allowed_count: records.filter((record) => record.execution_allowed).length,
      execution_performed_count: records.filter((record) => record.execution_performed).length,
      external_transfer_allowed_count: records.filter((record) => record.external_transfer_allowed).length,
      protected_action_executed_count: records.filter((record) => record.protected_action_execution_allowed).length,
      client_facing_ready_count: records.filter((record) => record.client_facing_ready).length,
      delivery_ready_count: records.filter((record) => record.delivery_ready).length,
      final_action_executed_count: records.filter((record) => record.final_action_executed).length,
      reason_codes: buildWorkflowStatusReasonCodes({ passCount, warnCount, manualCount, failCount }),
      recorded_at: generatedAt,
    };
    return {
      ...record,
      workflow_gate_status_hash: sha256(record),
    };
  });
}

function normalizeGateState(status, { humanReviewRequired = false, blocking = false } = {}) {
  if (status === "passed" || status === "allow") return "pass";
  if (status === "review_required" || status === "pending" || humanReviewRequired) return "manual";
  if (status === "blocked" || status === "failed" || blocking) return "fail";
  return "warn";
}

function normalizeInRunGateState(gate) {
  if (gate.in_run_gate_status === "passed") return "pass";
  if (gate.in_run_gate_status === "blocked") return "warn";
  if (gate.human_review_required) return "manual";
  return "warn";
}

function normalizeGateResultState(gate) {
  if (gate.gate_outcome === "passed") return "pass";
  if (gate.human_approval_gate || gate.separated_approval_object_required || gate.gate_outcome === "pending") return "manual";
  if (gate.gate_outcome === "failed" || gate.gate_outcome === "blocked" || gate.blocking) return "fail";
  return "warn";
}

function buildWorkflowStatusReasonCodes({ passCount, warnCount, manualCount, failCount }) {
  const reasonCodes = [];
  if (passCount > 0) reasonCodes.push("passing_gates_present");
  if (warnCount > 0) reasonCodes.push("runtime_blocks_projected_as_warnings");
  if (manualCount > 0) reasonCodes.push("human_review_required_before_release");
  if (failCount > 0) reasonCodes.push("failed_gate_present");
  if (failCount === 0) reasonCodes.push("no_failed_gate_results");
  reasonCodes.push("no_execution_or_delivery_authorized_by_aggregate");
  return reasonCodes;
}

function validateGateResultAggregator({
  workflowPreRunGateFramework,
  workflowInRunGateFramework,
  workflowPostRunGateFramework,
  gateApprovalContractFreeze,
  workflowRunLedger,
  agentRunLedger,
  packageJson,
  roadmapText,
  aggregateRecords,
  workflowGateStatuses,
}) {
  const items = [];
  const gateResults = gateApprovalContractFreeze.gate_approval_contract?.gate_results ?? [];
  const expectedAggregateRecordCount = (workflowPreRunGateFramework.pre_run_gate_records?.length ?? 0)
    + (workflowInRunGateFramework.in_run_gate_records?.length ?? 0)
    + (workflowInRunGateFramework.in_run_block_records?.length ?? 0)
    + (workflowPostRunGateFramework.post_run_gate_records?.length ?? 0)
    + gateResults.length;
  const workflowRunRecordCount = workflowRunLedger.workflow_run_catalog?.workflow_run_records?.length ?? 0;
  const stateCounts = countBy(aggregateRecords, "aggregate_gate_state");
  const statusCounts = countBy(workflowGateStatuses, "workflow_gate_status");
  const unsafeCounts = countUnsafeAggregateStates(aggregateRecords, workflowGateStatuses);

  pushCheck(items, "source.workflow_pre_run_gate_framework", "workflow_pre_run_gate_framework_complete", workflowPreRunGateFramework.summary?.workflow_pre_run_gate_framework_status === "complete" && workflowPreRunGateFramework.validation?.valid !== false, "Workflow pre-run gate framework must be complete.");
  pushCheck(items, "source.workflow_in_run_gate_framework", "workflow_in_run_gate_framework_complete", workflowInRunGateFramework.summary?.workflow_in_run_gate_framework_status === "complete" && workflowInRunGateFramework.validation?.valid !== false, "Workflow in-run gate framework must be complete.");
  pushCheck(items, "source.workflow_post_run_gate_framework", "workflow_post_run_gate_framework_complete", workflowPostRunGateFramework.summary?.workflow_post_run_gate_framework_status === "complete" && workflowPostRunGateFramework.validation?.valid !== false, "Workflow post-run gate framework must be complete.");
  pushCheck(items, "source.gate_approval_contract_freeze", "gate_approval_contract_freeze_complete", gateApprovalContractFreeze.summary?.freeze_status === "complete" && gateApprovalContractFreeze.validation?.valid !== false, "Gate approval contract freeze must be complete.");
  pushCheck(items, "source.workflow_run_ledger", "workflow_run_ledger_complete", workflowRunLedger.summary?.workflow_run_ledger_status === "complete" && workflowRunLedger.validation?.valid !== false, "Workflow run ledger must be complete.");
  pushCheck(items, "source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunLedger.validation?.valid !== false, "Agent run ledger must be complete.");
  pushCheck(items, "package.scripts.workflows_gate_results", "package_script_registered", Boolean(packageJson.scripts?.["workflows:gate-results"]), "package.json must expose workflows:gate-results.");
  pushCheck(items, "roadmap.p190", "roadmap_slot_present", roadmapText.includes("P190") && roadmapText.includes("gate result aggregator"), "P190 gate result aggregator roadmap slot must be present.");
  pushCheck(items, "aggregate.records.count", "aggregate_count_matches_sources", aggregateRecords.length === expectedAggregateRecordCount, "Aggregate records must cover pre/in/post-run gates, in-run block records, and GateResult v2 rows.", {
    expectedAggregateRecordCount,
    actualAggregateRecordCount: aggregateRecords.length,
  });
  pushCheck(items, "aggregate.records.states", "aggregate_states_resolved", aggregateRecords.every((record) => ["pass", "warn", "manual", "fail"].includes(record.aggregate_gate_state)), "Every gate aggregate record must normalize to pass/warn/manual/fail.");
  pushCheck(items, "aggregate.records.pass", "passing_gates_present", (stateCounts.pass ?? 0) > 0, "Aggregate must include passing gates.");
  pushCheck(items, "aggregate.records.warn", "warning_gates_present", (stateCounts.warn ?? 0) > 0, "Aggregate must preserve warning gates from runtime blocks.");
  pushCheck(items, "aggregate.records.manual", "manual_gates_present", (stateCounts.manual ?? 0) > 0, "Aggregate must preserve human-review gates.");
  pushCheck(items, "aggregate.records.fail", "no_failed_gate_results", (stateCounts.fail ?? 0) === 0, "Current safe demo should not introduce failed aggregate gates.");
  pushCheck(items, "workflow.statuses.count", "workflow_status_count_matches_ledger", workflowGateStatuses.length === workflowRunRecordCount, "Workflow gate statuses must cover every workflow run ledger record.", {
    workflowRunRecordCount,
    workflowGateStatusCount: workflowGateStatuses.length,
  });
  pushCheck(items, "workflow.statuses.manual", "manual_workflows_present", (statusCounts.manual_review_required ?? 0) > 0, "At least one workflow must remain manual-review required.");
  pushCheck(items, "workflow.statuses.blocked", "no_failed_workflow_gate_status", (statusCounts.blocked ?? 0) === 0, "P190 aggregate should not turn human-review holds into failed workflow statuses.");
  pushCheck(items, "safety.execution", "no_execution_or_delivery_authorized", unsafeCounts.total === 0, "Gate aggregate must not authorize execution, delivery, protected action, or final action.", unsafeCounts);
  return items;
}

function summarizeGateResultAggregator({
  workflowPreRunGateFramework,
  workflowInRunGateFramework,
  workflowPostRunGateFramework,
  gateApprovalContractFreeze,
  workflowRunLedger,
  agentRunLedger,
  aggregateRecords,
  workflowGateStatuses,
  validation,
  validationItems,
}) {
  const stateCounts = countBy(aggregateRecords, "aggregate_gate_state");
  const stageCounts = countBy(aggregateRecords, "aggregate_gate_stage");
  const sourceCounts = countBy(aggregateRecords, "source_artifact_id");
  const statusCounts = countBy(workflowGateStatuses, "workflow_gate_status");
  const unsafeCounts = countUnsafeAggregateStates(aggregateRecords, workflowGateStatuses);
  return {
    gate_result_aggregator_status: validation.valid ? "complete" : "needs_attention",
    gate_result_aggregator_contract_id: GATE_RESULT_AGGREGATOR_CONTRACT_ID,
    source_workflow_pre_run_gate_framework_status: workflowPreRunGateFramework.summary?.workflow_pre_run_gate_framework_status ?? "unknown",
    source_workflow_in_run_gate_framework_status: workflowInRunGateFramework.summary?.workflow_in_run_gate_framework_status ?? "unknown",
    source_workflow_post_run_gate_framework_status: workflowPostRunGateFramework.summary?.workflow_post_run_gate_framework_status ?? "unknown",
    source_gate_approval_contract_freeze_status: gateApprovalContractFreeze.summary?.freeze_status ?? "unknown",
    source_workflow_run_ledger_status: workflowRunLedger.summary?.workflow_run_ledger_status ?? "unknown",
    source_agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    source_pre_run_gate_record_count: workflowPreRunGateFramework.summary?.pre_run_gate_record_count ?? 0,
    source_in_run_gate_record_count: workflowInRunGateFramework.summary?.in_run_gate_record_count ?? 0,
    source_in_run_block_record_count: workflowInRunGateFramework.summary?.in_run_block_record_count ?? 0,
    source_post_run_gate_record_count: workflowPostRunGateFramework.summary?.post_run_gate_record_count ?? 0,
    source_gate_result_count: gateApprovalContractFreeze.summary?.gate_result_count ?? gateApprovalContractFreeze.gate_approval_contract?.gate_results?.length ?? 0,
    source_workflow_run_record_count: workflowRunLedger.summary?.workflow_run_record_count ?? workflowRunLedger.workflow_run_catalog?.workflow_run_records?.length ?? 0,
    source_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? 0,
    gate_aggregate_record_count: aggregateRecords.length,
    workflow_gate_status_count: workflowGateStatuses.length,
    passed_gate_count: stateCounts.pass ?? 0,
    warning_gate_count: stateCounts.warn ?? 0,
    manual_gate_count: stateCounts.manual ?? 0,
    failed_gate_count: stateCounts.fail ?? 0,
    pre_run_aggregate_count: stageCounts.pre_run ?? 0,
    in_run_aggregate_count: stageCounts.in_run ?? 0,
    post_run_aggregate_count: stageCounts.post_run ?? 0,
    gate_result_contract_aggregate_count: sourceCounts.gate_approval_contract_freeze ?? 0,
    passed_workflow_gate_status_count: statusCounts.passed ?? 0,
    warning_workflow_gate_status_count: statusCounts.warning ?? 0,
    manual_review_required_workflow_count: statusCounts.manual_review_required ?? 0,
    blocked_workflow_gate_status_count: statusCounts.blocked ?? 0,
    execution_allowed_count: unsafeCounts.execution_allowed_count,
    execution_performed_count: unsafeCounts.execution_performed_count,
    external_transfer_allowed_count: unsafeCounts.external_transfer_allowed_count,
    protected_action_executed_count: unsafeCounts.protected_action_executed_count,
    client_facing_ready_count: unsafeCounts.client_facing_ready_count,
    delivery_ready_count: unsafeCounts.delivery_ready_count,
    final_action_executed_count: unsafeCounts.final_action_executed_count,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_aggregate_gate_state: stateCounts,
    by_aggregate_gate_stage: stageCounts,
    by_source_artifact: sourceCounts,
    by_workflow_gate_status: statusCounts,
  };
}

function countUnsafeAggregateStates(aggregateRecords, workflowGateStatuses) {
  const counts = {
    execution_allowed_count: aggregateRecords.filter((record) => record.execution_allowed).length,
    execution_performed_count: aggregateRecords.filter((record) => record.execution_performed).length,
    external_transfer_allowed_count: aggregateRecords.filter((record) => record.external_transfer_allowed).length,
    protected_action_executed_count: aggregateRecords.filter((record) => record.protected_action_execution_allowed).length,
    client_facing_ready_count: aggregateRecords.filter((record) => record.client_facing_ready).length,
    delivery_ready_count: aggregateRecords.filter((record) => record.delivery_ready).length,
    final_action_executed_count: aggregateRecords.filter((record) => record.final_action_executed).length,
    ready_for_execution_count: workflowGateStatuses.filter((record) => record.ready_for_execution).length,
    ready_for_delivery_count: workflowGateStatuses.filter((record) => record.ready_for_delivery).length,
    final_action_allowed_count: workflowGateStatuses.filter((record) => record.final_action_allowed).length,
  };
  counts.total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return counts;
}

function buildGateResultAggregatorContract(generatedAt) {
  return {
    schema_version: "gate-result-aggregator-contract.v1",
    generated_at: generatedAt,
    gate_result_aggregator_contract_id: GATE_RESULT_AGGREGATOR_CONTRACT_ID,
    state_mapping: {
      pass: ["passed gate", "GateResult v2 passed"],
      warn: ["in-run runtime block record", "blocked in-run safety gate without execution"],
      manual: ["review_required gate", "pending human approval GateResult v2"],
      fail: ["explicit failed or blocked non-review gate"],
    },
    workflow_status_order: ["blocked", "manual_review_required", "warning", "passed"],
    safety_controls: {
      execution_authorization: "never_authorized_by_aggregate",
      delivery_authorization: "never_authorized_by_aggregate",
      final_action_authorization: "never_authorized_by_aggregate",
      human_review_required_for_manual_state: true,
    },
  };
}

function serializableGateResultAggregator(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function renderGateResultAggregatorMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Gate Result Aggregator");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.gate_result_aggregator_status}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Aggregate records: ${summary.gate_aggregate_record_count}`);
  lines.push(`- Workflow statuses: ${summary.workflow_gate_status_count}`);
  lines.push(`- Pass/warn/manual/fail gates: ${summary.passed_gate_count}/${summary.warning_gate_count}/${summary.manual_gate_count}/${summary.failed_gate_count}`);
  lines.push(`- Manual-review workflows: ${summary.manual_review_required_workflow_count}`);
  lines.push(`- Execution/delivery/final action: ${summary.execution_performed_count}/${summary.delivery_ready_count}/${summary.final_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Safety note");
  lines.push("");
  lines.push("This artifact aggregates gate state for review and workflow status projection only. It does not approve execution, delivery, protected actions, client-facing release, or final legal work product.");
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_GATE_RESULT_AGGREGATOR_INPUTS;
  return {
    workflow_pre_run_gate_framework_path: path.resolve(options.workflowPreRunGateFrameworkPath ?? defaults.workflowPreRunGateFrameworkPath),
    workflow_in_run_gate_framework_path: path.resolve(options.workflowInRunGateFrameworkPath ?? defaults.workflowInRunGateFrameworkPath),
    workflow_post_run_gate_framework_path: path.resolve(options.workflowPostRunGateFrameworkPath ?? defaults.workflowPostRunGateFrameworkPath),
    gate_approval_contract_freeze_path: path.resolve(options.gateApprovalContractFreezePath ?? defaults.gateApprovalContractFreezePath),
    workflow_run_ledger_path: path.resolve(options.workflowRunLedgerPath ?? defaults.workflowRunLedgerPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? defaults.agentRunLedgerPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? defaults.roadmapPath),
  };
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
    else if (arg === "--workflow-pre-run-gates") parsed.workflowPreRunGateFrameworkPath = argv[++index];
    else if (arg === "--workflow-in-run-gates") parsed.workflowInRunGateFrameworkPath = argv[++index];
    else if (arg === "--workflow-post-run-gates") parsed.workflowPostRunGateFrameworkPath = argv[++index];
    else if (arg === "--gate-approval-contract-freeze") parsed.gateApprovalContractFreezePath = argv[++index];
    else if (arg === "--workflow-run-ledger") parsed.workflowRunLedgerPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--package") parsed.packagePath = argv[++index];
    else if (arg === "--roadmap") parsed.roadmapPath = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage: node scripts/gate-result-aggregator.mjs [options]

Options:
  --check                                  Validate without tolerating failed checks.
  --out-dir <path>                         Output directory.
  --run-at <iso>                           Stable generated_at timestamp.
  --workflow-pre-run-gates <path>          Workflow pre-run gate framework artifact.
  --workflow-in-run-gates <path>           Workflow in-run gate framework artifact.
  --workflow-post-run-gates <path>         Workflow post-run gate framework artifact.
  --gate-approval-contract-freeze <path>   Gate/approval contract freeze artifact.
  --workflow-run-ledger <path>             Workflow run ledger artifact.
  --agent-run-ledger <path>                Agent run ledger artifact.
  --package <path>                         package.json path.
  --roadmap <path>                         final completion phase ledger path.
`);
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
    status: artifact.summary?.[statusKey] ?? artifact[statusKey] ?? (artifact.validation?.valid === true ? "complete" : "unknown"),
    validation_error_count: artifact.summary?.validation_error_count ?? artifact.validation?.errors?.length ?? 0,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed");
  return {
    valid: errors.length === 0,
    errors: errors.map((item) => ({
      path: item.path,
      check_id: item.check_id,
      message: item.message,
      metadata: item.metadata ?? {},
    })),
  };
}

function pushCheck(items, path, checkId, passed, message, metadata = {}) {
  items.push({
    path,
    check_id: checkId,
    status: passed ? "passed" : "failed",
    message,
    metadata,
  });
}

function countBy(items, key) {
  const counts = {};
  for (const item of items) {
    const value = item[key] ?? "unknown";
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
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

function first(values) {
  return values.find((value) => value !== undefined && value !== null) ?? null;
}

function slug(value) {
  return String(value ?? "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "unknown";
}

function dateStamp(isoString) {
  return isoString.replace(/[-:.TZ]/g, "").slice(0, 14);
}

function sha256(value) {
  return `sha256:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}
