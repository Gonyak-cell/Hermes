import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_OUT_DIR = "artifacts/workflow-in-run-gates/latest";
export const DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS = {
  workflowPreRunGateFrameworkPath: "artifacts/workflow-pre-run-gates/latest/workflow-pre-run-gate-framework.json",
  toolInvocationLedgerPath: "artifacts/tool-invocation-ledger/latest/tool-invocation-ledger.json",
  agentRunLedgerPath: "artifacts/agent-run-ledger/latest/agent-run-ledger.json",
  workflowStateMachineRunnerPath: "artifacts/workflow-state-machine-runner/latest/workflow-state-machine-runner.json",
  packagePath: "package.json",
  roadmapPath: "docs/final-completion-phase-ledger.md",
};

const IN_RUN_GATE_FRAMEWORK_CONTRACT_ID = "workflow-in-run-gate-framework.v1";
const IN_RUN_GATE_RECORD_SCHEMA_VERSION = "workflow-in-run-gate-record.v1";
const IN_RUN_BLOCK_RECORD_SCHEMA_VERSION = "workflow-in-run-block-record.v1";
const IN_RUN_GUARD_SCHEMA_VERSION = "workflow-in-run-guard.v1";
const REQUIRED_IN_RUN_GATE_TYPES = ["dangerous_command_gate", "sensitive_access_gate", "timeout_gate"];
const DANGEROUS_TOOL_IDS = new Set(["terminal.exec", "github.merge", "email.send", "erp.billing.issue"]);

export async function runWorkflowInRunGateFramework(options = {}) {
  const result = await buildWorkflowInRunGateFramework(options);
  if (options.write !== false) await writeWorkflowInRunGateFramework(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Workflow in-run gate framework validation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildWorkflowInRunGateFramework(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const workflowPreRunGateFramework = await readJson(inputs.workflow_pre_run_gate_framework_path);
  const toolInvocationLedger = await readJson(inputs.tool_invocation_ledger_path);
  const agentRunLedger = await readJson(inputs.agent_run_ledger_path);
  const workflowStateMachineRunner = await readJson(inputs.workflow_state_machine_runner_path);
  const packageJson = await readJson(inputs.package_path);
  const roadmapText = await readFile(inputs.roadmap_path, "utf8");

  const buildResult = buildInRunGateRecords({
    workflowPreRunGateFramework,
    toolInvocationLedger,
    agentRunLedger,
    generatedAt,
  });
  const validationItems = validateWorkflowInRunGateFramework({
    workflowPreRunGateFramework,
    toolInvocationLedger,
    agentRunLedger,
    workflowStateMachineRunner,
    packageJson,
    roadmapText,
    buildResult,
  });
  const validation = summarizeValidation(validationItems);
  const result = {
    schema_version: "workflow-in-run-gate-framework.v1",
    generated_at: generatedAt,
    workflow_in_run_gate_framework_id: `workflow-in-run-gate-framework.${dateStamp(generatedAt)}`,
    output_dir: outputDir,
    inputs,
    source_contracts: {
      workflow_pre_run_gate_framework: sourceSummary(workflowPreRunGateFramework, "workflow_pre_run_gate_framework_status"),
      tool_invocation_ledger: sourceSummary(toolInvocationLedger, "tool_invocation_ledger_status"),
      agent_run_ledger: sourceSummary(agentRunLedger, "agent_run_ledger_status"),
      workflow_state_machine_runner: sourceSummary(workflowStateMachineRunner, "workflow_state_machine_runner_status"),
    },
    in_run_gate_framework_contract: buildInRunGateFrameworkContract(generatedAt),
    in_run_gate_records: buildResult.inRunGateRecords,
    in_run_block_records: buildResult.inRunBlockRecords,
    in_run_guard_records: buildResult.inRunGuardRecords,
    validation_items: validationItems,
    validation,
    summary: summarizeWorkflowInRunGateFramework({
      workflowPreRunGateFramework,
      toolInvocationLedger,
      agentRunLedger,
      workflowStateMachineRunner,
      buildResult,
      validation,
      validationItems,
    }),
  };
  return {
    ...result,
    markdown: renderWorkflowInRunGateFrameworkMarkdown(result),
  };
}

export async function writeWorkflowInRunGateFramework(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "workflow-in-run-gate-framework.json"), serializableInRunGateFramework(result));
  await writeJson(path.join(outDir, "in-run-gate-records.json"), {
    schema_version: "workflow-in-run-gate-records.v1",
    generated_at: result.generated_at,
    in_run_gate_record_count: result.in_run_gate_records.length,
    in_run_gate_records: result.in_run_gate_records,
  });
  await writeJson(path.join(outDir, "in-run-block-records.json"), {
    schema_version: "workflow-in-run-block-records.v1",
    generated_at: result.generated_at,
    in_run_block_record_count: result.in_run_block_records.length,
    in_run_block_records: result.in_run_block_records,
  });
  await writeJson(path.join(outDir, "in-run-guard-records.json"), {
    schema_version: "workflow-in-run-guard-records.v1",
    generated_at: result.generated_at,
    in_run_guard_record_count: result.in_run_guard_records.length,
    in_run_guard_records: result.in_run_guard_records,
  });
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "workflow-in-run-gate-framework-validation-report.v1",
    generated_at: result.generated_at,
    workflow_in_run_gate_framework_id: result.workflow_in_run_gate_framework_id,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runWorkflowInRunGateFrameworkCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }

  try {
    const result = await runWorkflowInRunGateFramework(args);
    console.log(`Workflow in-run gate framework ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.workflow_in_run_gate_framework_status}`);
    console.log(`Gate records: ${result.summary.in_run_gate_record_count}`);
    console.log(`Block records: ${result.summary.in_run_block_record_count}`);
    console.log(`Guards: ${result.summary.in_run_guard_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) {
      console.error(`- ${validationError.path}: ${validationError.message}`);
    }
    process.exitCode = 1;
  }
}

function buildInRunGateRecords({
  workflowPreRunGateFramework,
  toolInvocationLedger,
  agentRunLedger,
  generatedAt,
}) {
  const preRunGuards = workflowPreRunGateFramework.pre_run_gate_guard_records ?? [];
  const toolInvocations = toolInvocationLedger.tool_invocation_catalog?.tool_invocation_records ?? [];
  const agentRunsById = new Map((agentRunLedger.agent_run_catalog?.agent_run_records ?? []).map((record) => [record.agent_run_id, record]));
  const preRunGuardsByRun = new Map(preRunGuards.map((record) => [record.workflow_run_id, record]));

  const inRunGateRecords = [];
  const inRunBlockRecords = [];
  const inRunGuardRecords = [];

  for (const invocation of [...toolInvocations].sort(by("tool_invocation_id"))) {
    const agentRun = agentRunsById.get(invocation.agent_run_id) ?? {};
    const preRunGuard = preRunGuardsByRun.get(invocation.workflow_run_id) ?? {};
    const gateRecords = [
      buildDangerousCommandGateRecord(invocation, agentRun, preRunGuard, generatedAt),
      buildSensitiveAccessGateRecord(invocation, agentRun, preRunGuard, generatedAt),
      buildTimeoutGateRecord(invocation, agentRun, preRunGuard, generatedAt),
    ];
    inRunGateRecords.push(...gateRecords);
    for (const gateRecord of gateRecords.filter((record) => record.in_run_gate_status === "blocked")) {
      inRunBlockRecords.push(buildInRunBlockRecord(gateRecord, invocation, generatedAt));
    }
  }

  const gatesByRun = groupBy(inRunGateRecords, "workflow_run_id");
  const blocksByRun = groupBy(inRunBlockRecords, "workflow_run_id");
  const invocationsByRun = groupBy(toolInvocations, "workflow_run_id");
  for (const preRunGuard of [...preRunGuards].sort(by("workflow_run_id"))) {
    inRunGuardRecords.push(buildInRunGuardRecord({
      preRunGuard,
      toolInvocations: invocationsByRun.get(preRunGuard.workflow_run_id) ?? [],
      gateRecords: gatesByRun.get(preRunGuard.workflow_run_id) ?? [],
      blockRecords: blocksByRun.get(preRunGuard.workflow_run_id) ?? [],
      generatedAt,
    }));
  }

  return {
    inRunGateRecords,
    inRunBlockRecords,
    inRunGuardRecords,
  };
}

function buildDangerousCommandGateRecord(invocation, agentRun, preRunGuard, generatedAt) {
  const dangerousTarget = isDangerousInvocation(invocation);
  const gateDecision = dangerousTarget ? "block" : "allow";
  const reasonCodes = [
    DANGEROUS_TOOL_IDS.has(invocation.tool_id) ? "dangerous_tool_id_detected" : "tool_id_not_dangerous",
    invocation.protected_action ? "protected_action_source_invocation" : "not_source_protected_action",
    invocation.permission_status === "blocked" ? "source_permission_blocked" : "source_permission_not_blocked",
    hasGate(invocation, "output_destination_gate") ? "output_destination_gate_present" : null,
  ];
  return buildInRunGateRecord({
    invocation,
    agentRun,
    preRunGuard,
    gateType: "dangerous_command_gate",
    gateDecision,
    gateStatus: dangerousTarget ? "blocked" : "passed",
    blockReasonCodes: reasonCodes.filter((code) => code && code !== "tool_id_not_dangerous" && code !== "not_source_protected_action" && code !== "source_permission_not_blocked"),
    reasonCodes,
    humanReviewRequired: dangerousTarget || invocation.human_approval_required,
    generatedAt,
    metadata: {
      target_dangerous_command: dangerousTarget,
      dangerous_tool_id: DANGEROUS_TOOL_IDS.has(invocation.tool_id),
      source_permission_status: invocation.permission_status ?? "unknown",
      source_invocation_state: invocation.invocation_state ?? "unknown",
      source_protected_action: Boolean(invocation.protected_action),
    },
  });
}

function buildSensitiveAccessGateRecord(invocation, agentRun, preRunGuard, generatedAt) {
  const sensitiveTarget = isSensitiveInvocation(invocation, agentRun, preRunGuard);
  const gateDecision = sensitiveTarget ? "block" : "allow";
  const reasonCodes = [
    invocation.domain_pack === "law-firm" ? "law_firm_domain_pack" : "non_law_firm_domain_pack",
    String(preRunGuard.classification_floor ?? "").startsWith("P2") ? "client_confidential_pre_run_floor" : "non_client_confidential_pre_run_floor",
    hasGate(invocation, "matter_access_gate") ? "matter_access_gate_present" : "matter_access_gate_absent",
    hasGate(invocation, "prompt_injection_gate") ? "prompt_injection_gate_present" : "prompt_injection_gate_absent",
    hasGate(invocation, "protected_file_gate") ? "protected_file_gate_present" : "protected_file_gate_absent",
    invocation.protected_action ? "protected_action_source_invocation" : "not_source_protected_action",
  ];
  return buildInRunGateRecord({
    invocation,
    agentRun,
    preRunGuard,
    gateType: "sensitive_access_gate",
    gateDecision,
    gateStatus: sensitiveTarget ? "blocked" : "passed",
    blockReasonCodes: reasonCodes.filter((code) => code.endsWith("_present") || code === "law_firm_domain_pack" || code === "client_confidential_pre_run_floor" || code === "protected_action_source_invocation"),
    reasonCodes,
    humanReviewRequired: sensitiveTarget || invocation.human_approval_required,
    generatedAt,
    metadata: {
      target_sensitive_access: sensitiveTarget,
      pre_run_classification_floor: preRunGuard.classification_floor ?? null,
      source_domain_pack: invocation.domain_pack ?? null,
      source_matter_id: invocation.matter_id ?? null,
      source_required_gate_count: invocation.required_gates?.length ?? 0,
    },
  });
}

function buildTimeoutGateRecord(invocation, agentRun, preRunGuard, generatedAt) {
  const timeoutSeconds = Number(agentRun.lifecycle_policy?.timeout_seconds ?? 0);
  const timeoutConfigured = Number.isFinite(timeoutSeconds) && timeoutSeconds > 0;
  const gateDecision = timeoutConfigured ? "allow" : "block";
  const reasonCodes = [
    timeoutConfigured ? "agent_run_timeout_configured" : "agent_run_timeout_missing",
    agentRun.lifecycle_policy?.cancellable ? "agent_run_cancellable" : "agent_run_not_cancellable",
    agentRun.lifecycle_policy?.resumable ? "agent_run_resumable" : "agent_run_not_resumable",
  ];
  return buildInRunGateRecord({
    invocation,
    agentRun,
    preRunGuard,
    gateType: "timeout_gate",
    gateDecision,
    gateStatus: timeoutConfigured ? "passed" : "blocked",
    blockReasonCodes: timeoutConfigured ? [] : ["agent_run_timeout_missing"],
    reasonCodes,
    humanReviewRequired: !timeoutConfigured || invocation.human_approval_required,
    generatedAt,
    metadata: {
      timeout_configured: timeoutConfigured,
      timeout_seconds: timeoutConfigured ? timeoutSeconds : 0,
      heartbeat_seconds: Number(agentRun.lifecycle_policy?.heartbeat_seconds ?? 0),
      max_retries: Number(agentRun.lifecycle_policy?.max_retries ?? 0),
    },
  });
}

function buildInRunGateRecord({
  invocation,
  agentRun,
  preRunGuard,
  gateType,
  gateDecision,
  gateStatus,
  blockReasonCodes,
  reasonCodes,
  humanReviewRequired,
  generatedAt,
  metadata,
}) {
  const recordBase = {
    schema_version: IN_RUN_GATE_RECORD_SCHEMA_VERSION,
    in_run_gate_record_id: `in-run-gate.${slugify(invocation.tool_invocation_id)}.${gateType.replace(/_/g, "-")}`,
    in_run_gate_framework_contract_id: IN_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    gate_type: gateType,
    gate_stage: "in_run",
    tool_invocation_id: invocation.tool_invocation_id,
    agent_run_id: invocation.agent_run_id,
    workflow_run_id: invocation.workflow_run_id,
    pre_run_gate_guard_record_id: preRunGuard.pre_run_gate_guard_record_id ?? null,
    matter_id: invocation.matter_id ?? agentRun.matter_id ?? null,
    domain_pack: invocation.domain_pack ?? agentRun.domain_pack ?? null,
    runtime_id: invocation.runtime_id ?? agentRun.runtime_id ?? null,
    tool_id: invocation.tool_id,
    source_permission_status: invocation.permission_status ?? "unknown",
    source_invocation_state: invocation.invocation_state ?? "unknown",
    source_execution_allowed: Boolean(invocation.execution_allowed),
    source_protected_action: Boolean(invocation.protected_action),
    source_human_approval_required: Boolean(invocation.human_approval_required),
    source_required_gates: [...(invocation.required_gates ?? [])].sort(),
    agent_run_risk_level: agentRun.risk_level ?? "unknown",
    agent_run_verification_status: agentRun.verification_status ?? "unknown",
    timeout_seconds: Number(agentRun.lifecycle_policy?.timeout_seconds ?? 0),
    in_run_gate_decision: gateDecision,
    in_run_gate_status: gateStatus,
    execution_allowed: false,
    execution_performed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: Boolean(humanReviewRequired),
    required_during_execution: true,
    block_reason_codes: unique(blockReasonCodes),
    reason_codes: unique(reasonCodes.filter(Boolean)),
    recorded_at: generatedAt,
    metadata,
  };
  return {
    ...recordBase,
    in_run_gate_hash: hashValue(recordBase),
  };
}

function buildInRunBlockRecord(gateRecord, invocation, generatedAt) {
  const recordBase = {
    schema_version: IN_RUN_BLOCK_RECORD_SCHEMA_VERSION,
    in_run_block_record_id: `in-run-block.${slugify(gateRecord.in_run_gate_record_id)}`,
    in_run_gate_framework_contract_id: IN_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    in_run_gate_record_id: gateRecord.in_run_gate_record_id,
    tool_invocation_id: gateRecord.tool_invocation_id,
    agent_run_id: gateRecord.agent_run_id,
    workflow_run_id: gateRecord.workflow_run_id,
    matter_id: gateRecord.matter_id,
    domain_pack: gateRecord.domain_pack,
    runtime_id: gateRecord.runtime_id,
    tool_id: gateRecord.tool_id,
    gate_type: gateRecord.gate_type,
    in_run_block_type: gateRecord.gate_type.replace(/_gate$/, "_block"),
    in_run_block_status: "blocked",
    block_reason_codes: gateRecord.block_reason_codes,
    source_permission_status: invocation.permission_status ?? "unknown",
    source_execution_allowed: Boolean(invocation.execution_allowed),
    execution_allowed: false,
    execution_performed: false,
    continued_execution_allowed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: true,
    recorded_at: generatedAt,
  };
  return {
    ...recordBase,
    in_run_block_hash: hashValue(recordBase),
  };
}

function buildInRunGuardRecord({ preRunGuard, toolInvocations, gateRecords, blockRecords, generatedAt }) {
  const gatesByInvocation = groupBy(gateRecords, "tool_invocation_id");
  const missingGateCount = toolInvocations.filter((invocation) => !sameSet((gatesByInvocation.get(invocation.tool_invocation_id) ?? []).map((record) => record.gate_type), REQUIRED_IN_RUN_GATE_TYPES)).length;
  const timeoutBlockCount = gateRecords.filter((record) => record.gate_type === "timeout_gate" && record.in_run_gate_status === "blocked").length;
  const guardStatus = missingGateCount === 0 && timeoutBlockCount === 0 && preRunGuard.pre_run_guard_status === "passed" ? "passed" : "blocked";
  const recordBase = {
    schema_version: IN_RUN_GUARD_SCHEMA_VERSION,
    in_run_guard_record_id: `in-run-guard.${slugify(preRunGuard.workflow_run_id)}`,
    in_run_gate_framework_contract_id: IN_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    workflow_run_id: preRunGuard.workflow_run_id,
    pre_run_gate_guard_record_id: preRunGuard.pre_run_gate_guard_record_id,
    matter_id: preRunGuard.matter_id,
    classification_floor: preRunGuard.classification_floor,
    pre_run_guard_status: preRunGuard.pre_run_guard_status,
    required_gate_types: REQUIRED_IN_RUN_GATE_TYPES,
    tool_invocation_count: toolInvocations.length,
    gate_record_count: gateRecords.length,
    missing_tool_invocation_gate_count: missingGateCount,
    in_run_block_record_count: blockRecords.length,
    dangerous_command_gate_count: gateRecords.filter((record) => record.gate_type === "dangerous_command_gate").length,
    sensitive_access_gate_count: gateRecords.filter((record) => record.gate_type === "sensitive_access_gate").length,
    timeout_gate_count: gateRecords.filter((record) => record.gate_type === "timeout_gate").length,
    dangerous_command_block_count: blockRecords.filter((record) => record.gate_type === "dangerous_command_gate").length,
    sensitive_access_block_count: blockRecords.filter((record) => record.gate_type === "sensitive_access_gate").length,
    timeout_block_count: blockRecords.filter((record) => record.gate_type === "timeout_gate").length,
    in_run_guard_status: guardStatus,
    no_invocation_scheduled: toolInvocations.length === 0,
    execution_allowed: false,
    execution_performed: false,
    external_transfer_allowed: false,
    protected_action_execution_allowed: false,
    human_review_required: true,
    recorded_at: generatedAt,
  };
  return {
    ...recordBase,
    in_run_guard_hash: hashValue(recordBase),
  };
}

function validateWorkflowInRunGateFramework({
  workflowPreRunGateFramework,
  toolInvocationLedger,
  agentRunLedger,
  workflowStateMachineRunner,
  packageJson,
  roadmapText,
  buildResult,
}) {
  const items = [];
  const preRunGuards = workflowPreRunGateFramework.pre_run_gate_guard_records ?? [];
  const toolInvocations = toolInvocationLedger.tool_invocation_catalog?.tool_invocation_records ?? [];
  const agentRuns = agentRunLedger.agent_run_catalog?.agent_run_records ?? [];
  const gateRecords = buildResult.inRunGateRecords;
  const blockRecords = buildResult.inRunBlockRecords;
  const guardRecords = buildResult.inRunGuardRecords;
  const gateRecordsByInvocation = groupBy(gateRecords, "tool_invocation_id");
  const dangerousTargets = gateRecords.filter((record) => record.gate_type === "dangerous_command_gate" && record.metadata?.target_dangerous_command);
  const sensitiveTargets = gateRecords.filter((record) => record.gate_type === "sensitive_access_gate" && record.metadata?.target_sensitive_access);
  const timeoutGates = gateRecords.filter((record) => record.gate_type === "timeout_gate");

  pushCheck(items, "source.workflow_pre_run_gate_framework", "workflow_pre_run_gate_framework_complete", workflowPreRunGateFramework.summary?.workflow_pre_run_gate_framework_status === "complete" && workflowPreRunGateFramework.validation?.valid !== false, "Workflow pre-run gate framework must be complete.");
  pushCheck(items, "source.tool_invocation_ledger", "tool_invocation_ledger_complete", toolInvocationLedger.summary?.tool_invocation_ledger_status === "complete" && toolInvocationLedger.validation?.valid !== false, "Tool invocation ledger must be complete.");
  pushCheck(items, "source.agent_run_ledger", "agent_run_ledger_complete", agentRunLedger.summary?.agent_run_ledger_status === "complete" && agentRunLedger.validation?.valid !== false, "Agent run ledger must be complete.");
  pushCheck(items, "source.workflow_state_machine_runner", "workflow_state_machine_runner_complete", workflowStateMachineRunner.summary?.workflow_state_machine_runner_status === "complete" && workflowStateMachineRunner.validation?.valid !== false, "Workflow state machine runner must be complete.");
  pushCheck(items, "source.package.scripts", "package_script_registered", Boolean(packageJson.scripts?.["workflows:in-run-gates"]), "package.json must expose npm run workflows:in-run-gates.");
  pushCheck(items, "roadmap.phase_188", "phase_188_documented", roadmapText.includes("P188") && roadmapText.includes("in-run gate"), "Phase ledger must keep the P188 in-run gate slot visible.");
  pushCheck(items, "in_run_gate_records", "three_gates_per_tool_invocation", gateRecords.length === toolInvocations.length * REQUIRED_IN_RUN_GATE_TYPES.length, "Every tool invocation must have dangerous command, sensitive access, and timeout in-run gates.");
  pushCheck(items, "in_run_gate_records", "required_gate_set_complete", toolInvocations.every((invocation) => sameSet((gateRecordsByInvocation.get(invocation.tool_invocation_id) ?? []).map((record) => record.gate_type), REQUIRED_IN_RUN_GATE_TYPES)), "Each tool invocation must resolve all required in-run gates.");
  pushCheck(items, "in_run_gate_records", "dangerous_targets_blocked", dangerousTargets.length > 0 && dangerousTargets.every((record) => record.in_run_gate_status === "blocked"), "Dangerous command targets must be blocked in-run.");
  pushCheck(items, "in_run_gate_records", "sensitive_targets_blocked", sensitiveTargets.length > 0 && sensitiveTargets.every((record) => record.in_run_gate_status === "blocked"), "Sensitive access targets must be blocked in-run.");
  pushCheck(items, "in_run_gate_records", "timeouts_configured", timeoutGates.length === toolInvocations.length && timeoutGates.every((record) => record.in_run_gate_status === "passed" && record.metadata?.timeout_configured), "Every in-run invocation must be bound to a configured timeout gate.");
  pushCheck(items, "in_run_gate_records", "gates_do_not_execute", gateRecords.every((record) => !record.execution_allowed && !record.execution_performed && !record.external_transfer_allowed && !record.protected_action_execution_allowed), "In-run gate records must not execute tools, transfers, or protected actions.");
  pushCheck(items, "in_run_block_records", "block_record_per_blocked_gate", blockRecords.length === gateRecords.filter((record) => record.in_run_gate_status === "blocked").length, "Each blocked in-run gate must produce one block record.");
  pushCheck(items, "in_run_block_records", "blocks_do_not_continue_execution", blockRecords.length > 0 && blockRecords.every((record) => !record.execution_allowed && !record.execution_performed && !record.continued_execution_allowed && !record.external_transfer_allowed && !record.protected_action_execution_allowed), "In-run block records must prevent continued execution, transfers, and protected actions.");
  pushCheck(items, "in_run_guard_records", "guard_per_pre_run_guard", guardRecords.length === preRunGuards.length, "Every pre-run workflow guard must have an in-run guard.");
  pushCheck(items, "in_run_guard_records", "guards_pass_required_presence", guardRecords.every((record) => record.in_run_guard_status === "passed" && record.missing_tool_invocation_gate_count === 0), "In-run guards must pass required gate presence checks.");
  pushCheck(items, "source.agent_run_timeout_policy", "agent_runs_have_timeout_policy", agentRuns.length > 0 && agentRuns.every((record) => Number(record.lifecycle_policy?.timeout_seconds ?? 0) > 0), "Every source agent run must have a timeout policy.");
  return items;
}

function summarizeWorkflowInRunGateFramework({
  workflowPreRunGateFramework,
  toolInvocationLedger,
  agentRunLedger,
  workflowStateMachineRunner,
  buildResult,
  validation,
  validationItems,
}) {
  const gateRecords = buildResult.inRunGateRecords;
  const blockRecords = buildResult.inRunBlockRecords;
  const guardRecords = buildResult.inRunGuardRecords;
  const gateTypeCounts = countByObject(gateRecords, "gate_type");
  const blockTypeCounts = countByObject(blockRecords, "gate_type");
  const dangerousTargets = gateRecords.filter((record) => record.gate_type === "dangerous_command_gate" && record.metadata?.target_dangerous_command);
  const sensitiveTargets = gateRecords.filter((record) => record.gate_type === "sensitive_access_gate" && record.metadata?.target_sensitive_access);
  const timeoutGates = gateRecords.filter((record) => record.gate_type === "timeout_gate");
  return {
    workflow_in_run_gate_framework_status: validation.errors.length === 0 ? "complete" : "blocked",
    in_run_gate_framework_contract_id: IN_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    source_workflow_pre_run_gate_framework_status: workflowPreRunGateFramework.summary?.workflow_pre_run_gate_framework_status ?? "unknown",
    source_tool_invocation_ledger_status: toolInvocationLedger.summary?.tool_invocation_ledger_status ?? "unknown",
    source_agent_run_ledger_status: agentRunLedger.summary?.agent_run_ledger_status ?? "unknown",
    source_workflow_state_machine_runner_status: workflowStateMachineRunner.summary?.workflow_state_machine_runner_status ?? "unknown",
    source_pre_run_gate_guard_count: workflowPreRunGateFramework.summary?.pre_run_gate_guard_count ?? workflowPreRunGateFramework.pre_run_gate_guard_records?.length ?? 0,
    source_tool_invocation_record_count: toolInvocationLedger.summary?.tool_invocation_record_count ?? toolInvocationLedger.tool_invocation_catalog?.tool_invocation_records?.length ?? 0,
    source_agent_run_record_count: agentRunLedger.summary?.agent_run_record_count ?? agentRunLedger.agent_run_catalog?.agent_run_records?.length ?? 0,
    source_runner_plan_count: workflowStateMachineRunner.summary?.runner_plan_count ?? 0,
    in_run_gate_record_count: gateRecords.length,
    in_run_block_record_count: blockRecords.length,
    in_run_guard_count: guardRecords.length,
    dangerous_command_gate_count: gateTypeCounts.dangerous_command_gate ?? 0,
    sensitive_access_gate_count: gateTypeCounts.sensitive_access_gate ?? 0,
    timeout_gate_count: gateTypeCounts.timeout_gate ?? 0,
    dangerous_command_target_count: dangerousTargets.length,
    sensitive_access_target_count: sensitiveTargets.length,
    timeout_configured_count: timeoutGates.filter((record) => record.metadata?.timeout_configured).length,
    passed_gate_count: gateRecords.filter((record) => record.in_run_gate_status === "passed").length,
    blocked_gate_count: gateRecords.filter((record) => record.in_run_gate_status === "blocked").length,
    dangerous_command_block_count: blockTypeCounts.dangerous_command_gate ?? 0,
    sensitive_access_block_count: blockTypeCounts.sensitive_access_gate ?? 0,
    timeout_block_count: blockTypeCounts.timeout_gate ?? 0,
    timeout_gate_passed_count: timeoutGates.filter((record) => record.in_run_gate_status === "passed").length,
    in_run_guard_passed_count: guardRecords.filter((record) => record.in_run_guard_status === "passed").length,
    no_invocation_scheduled_guard_count: guardRecords.filter((record) => record.no_invocation_scheduled).length,
    dangerous_command_allowed_count: dangerousTargets.filter((record) => record.in_run_gate_status !== "blocked").length,
    sensitive_access_allowed_count: sensitiveTargets.filter((record) => record.in_run_gate_status !== "blocked").length,
    timeout_without_gate_count: timeoutGates.filter((record) => !record.metadata?.timeout_configured).length,
    execution_allowed_count: gateRecords.filter((record) => record.execution_allowed).length + blockRecords.filter((record) => record.execution_allowed).length + guardRecords.filter((record) => record.execution_allowed).length,
    execution_performed_count: gateRecords.filter((record) => record.execution_performed).length + blockRecords.filter((record) => record.execution_performed).length + guardRecords.filter((record) => record.execution_performed).length,
    continued_execution_allowed_count: blockRecords.filter((record) => record.continued_execution_allowed).length,
    external_transfer_allowed_count: gateRecords.filter((record) => record.external_transfer_allowed).length + blockRecords.filter((record) => record.external_transfer_allowed).length + guardRecords.filter((record) => record.external_transfer_allowed).length,
    protected_action_executed_count: gateRecords.filter((record) => record.protected_action_execution_allowed).length + blockRecords.filter((record) => record.protected_action_execution_allowed).length + guardRecords.filter((record) => record.protected_action_execution_allowed).length,
    validation_item_count: validationItems.length,
    failed_validation_item_count: validation.errors.length,
    validation_error_count: validation.errors.length,
    by_gate_type: gateTypeCounts,
    by_in_run_gate_status: countByObject(gateRecords, "in_run_gate_status"),
    by_in_run_block_type: countByObject(blockRecords, "in_run_block_type"),
    by_in_run_guard_status: countByObject(guardRecords, "in_run_guard_status"),
  };
}

function buildInRunGateFrameworkContract(generatedAt) {
  return {
    schema_version: "workflow-in-run-gate-framework-contract.v1",
    generated_at: generatedAt,
    in_run_gate_framework_contract_id: IN_RUN_GATE_FRAMEWORK_CONTRACT_ID,
    in_run_gate_record_schema_version: IN_RUN_GATE_RECORD_SCHEMA_VERSION,
    in_run_block_record_schema_version: IN_RUN_BLOCK_RECORD_SCHEMA_VERSION,
    in_run_guard_schema_version: IN_RUN_GUARD_SCHEMA_VERSION,
    required_gate_types: REQUIRED_IN_RUN_GATE_TYPES,
    dangerous_command_rule: "terminal, merge, email, billing, protected, or source-blocked invocations are blocked during execution and converted into block records.",
    sensitive_access_rule: "law-firm, client-confidential, matter-access, prompt-injection, protected-file, or protected-action invocations are blocked during execution for human review.",
    timeout_rule: "every in-run invocation must bind to an agent run timeout policy before the gate can pass.",
    no_execution_rule: "in-run gate artifacts record decisions only and never execute tools, external transfers, or protected actions.",
  };
}

function renderWorkflowInRunGateFrameworkMarkdown(result) {
  const summary = result.summary;
  const lines = [];
  lines.push("# Workflow In-run Gate Framework");
  lines.push("");
  lines.push(`Generated: ${result.generated_at}`);
  lines.push(`Status: ${summary.workflow_in_run_gate_framework_status}`);
  lines.push("");
  lines.push(`- Gate records: ${summary.in_run_gate_record_count}`);
  lines.push(`- Block records: ${summary.in_run_block_record_count}`);
  lines.push(`- Guards: ${summary.in_run_guard_count}`);
  lines.push(`- Dangerous/sensitive/timeout gates: ${summary.dangerous_command_gate_count}/${summary.sensitive_access_gate_count}/${summary.timeout_gate_count}`);
  lines.push(`- Dangerous/sensitive blocks: ${summary.dangerous_command_block_count}/${summary.sensitive_access_block_count}`);
  lines.push(`- Execution/external/protected allowed: ${summary.execution_allowed_count}/${summary.external_transfer_allowed_count}/${summary.protected_action_executed_count}`);
  lines.push(`- Validation errors: ${summary.validation_error_count}`);
  lines.push("");
  lines.push("## Guards");
  lines.push("");
  for (const guard of result.in_run_guard_records) {
    lines.push(`- ${guard.in_run_guard_record_id}: ${guard.in_run_guard_status}, invocations=${guard.tool_invocation_count}, blocks=${guard.in_run_block_record_count}`);
  }
  return `${lines.join("\n")}\n`;
}

function normalizeInputs(options) {
  return {
    workflow_pre_run_gate_framework_path: path.resolve(options.workflowPreRunGateFrameworkPath ?? DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.workflowPreRunGateFrameworkPath),
    tool_invocation_ledger_path: path.resolve(options.toolInvocationLedgerPath ?? DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.toolInvocationLedgerPath),
    agent_run_ledger_path: path.resolve(options.agentRunLedgerPath ?? DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.agentRunLedgerPath),
    workflow_state_machine_runner_path: path.resolve(options.workflowStateMachineRunnerPath ?? DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.workflowStateMachineRunnerPath),
    package_path: path.resolve(options.packagePath ?? DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.packagePath),
    roadmap_path: path.resolve(options.roadmapPath ?? DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.roadmapPath),
  };
}

function parseArgs(argv) {
  const parsed = {
    workflowPreRunGateFrameworkPath: DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.workflowPreRunGateFrameworkPath,
    toolInvocationLedgerPath: DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.toolInvocationLedgerPath,
    agentRunLedgerPath: DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.agentRunLedgerPath,
    workflowStateMachineRunnerPath: DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.workflowStateMachineRunnerPath,
    packagePath: DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.packagePath,
    roadmapPath: DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_INPUTS.roadmapPath,
    outDir: DEFAULT_WORKFLOW_IN_RUN_GATE_FRAMEWORK_OUT_DIR,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg === "--workflow-pre-run-gates") parsed.workflowPreRunGateFrameworkPath = argv[++index];
    else if (arg === "--tool-invocation-ledger") parsed.toolInvocationLedgerPath = argv[++index];
    else if (arg === "--agent-run-ledger") parsed.agentRunLedgerPath = argv[++index];
    else if (arg === "--workflow-runner") parsed.workflowStateMachineRunnerPath = argv[++index];
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
  console.log(`Usage: node scripts/workflow-in-run-gate-framework.mjs [options]

Options:
  --workflow-pre-run-gates <path> workflow-pre-run-gate-framework.json path.
  --tool-invocation-ledger <path> tool-invocation-ledger.json path.
  --agent-run-ledger <path> agent-run-ledger.json path.
  --workflow-runner <path> workflow-state-machine-runner.json path.
  --package <path> package.json path.
  --roadmap <path> final completion phase ledger path.
  --out-dir <path> output directory.
  --run-at <iso> deterministic generated_at timestamp.
  --check validate only without writing artifacts.
`);
}

function isDangerousInvocation(invocation) {
  return DANGEROUS_TOOL_IDS.has(invocation.tool_id)
    || invocation.permission_status === "blocked"
    || invocation.invocation_state === "blocked"
    || Boolean(invocation.protected_action)
    || hasGate(invocation, "output_destination_gate");
}

function isSensitiveInvocation(invocation, agentRun, preRunGuard) {
  return invocation.domain_pack === "law-firm"
    || agentRun.domain_pack === "law-firm"
    || String(preRunGuard.classification_floor ?? "").startsWith("P2")
    || String(invocation.matter_id ?? "").includes("alpha")
    || hasGate(invocation, "matter_access_gate")
    || hasGate(invocation, "prompt_injection_gate")
    || hasGate(invocation, "external_model_gate")
    || hasGate(invocation, "protected_file_gate")
    || Boolean(invocation.protected_action);
}

function hasGate(invocation, gateId) {
  return (invocation.required_gates ?? []).includes(gateId);
}

function serializableInRunGateFramework(result) {
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
