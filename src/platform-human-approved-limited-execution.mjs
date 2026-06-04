import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformRuntimeGovernanceRestore } from "./platform-runtime-governance-restore.mjs";

export const DEFAULT_PLATFORM_HUMAN_APPROVED_LIMITED_EXECUTION_OUT_DIR = "artifacts/platform-human-approved-limited-execution/latest";
export const DEFAULT_PLATFORM_HUMAN_APPROVED_LIMITED_EXECUTION_INPUTS = {
  schemaPath: "schemas/platform-human-approved-limited-execution.schema.json",
  packagePath: "package.json",
  runtimeGovernanceLedgerPath: "docs/hermes-runtime-governance-restore.md",
  limitedExecutionLedgerPath: "docs/hermes-human-approved-limited-execution.md",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p1200-p3200.md",
};

const COMMAND_NAME = "platform:human-approved-limited-execution";
const SOURCE_COMMAND_NAME = "platform:runtime-governance-restore";
const SCHEMA_VERSION = "platform-human-approved-limited-execution.v1";
const CAPABILITY_ID = "platform.human_approved_limited_execution";
const READY_STATUS = "ready_for_platform_human_approved_limited_execution";
const SOURCE_READY_STATUS = "ready_for_platform_runtime_governance_restore";
const PROGRAM_RANGE = "P2241-P2400";
const PHASE_RANGE = "P2241-P2400";
const PHASE_SLOT = "P2241";
const PREVIOUS_PHASE_SLOT = "P2240";
const NEXT_PHASE_SLOT = "P2401";

const COMPONENT_SPECS = [
  ["receipt_intake_contract", "Human receipt intake contract for every limited execution candidate"],
  ["allowlist_command_policy", "Allowlisted command policy with no free terminal execution"],
  ["repo_local_sandbox_policy", "Repo-local sandbox policy for command scope and filesystem boundary"],
  ["stdout_stderr_redaction_policy", "Stdout, stderr, env, and raw material redaction policy"],
  ["timeout_policy", "Timeout and hard-kill policy for every candidate command"],
  ["rollback_binding_policy", "Rollback target and pre-execution snapshot binding policy"],
  ["execution_closeout_policy", "Execution receipt closeout, reviewer verdict, and next-condition policy"],
];

const RECEIPT_SPECS = [
  ["command_execution_receipt", "Terminal command execution receipt"],
  ["install_command_receipt", "Install command receipt"],
  ["doctor_smoke_receipt", "Doctor and smoke evidence receipt"],
  ["mcp_health_receipt", "MCP health check receipt"],
  ["job_run_receipt", "Scheduled job run receipt"],
  ["emergency_stop_receipt", "Emergency stop receipt"],
  ["rollback_receipt", "Rollback receipt"],
];

const ALLOWLIST_SPECS = [
  ["git_status_short", "git status --short", "read_only_status"],
  ["git_diff_check", "git diff --check", "read_only_diff_check"],
  ["rg_read_only_search", "rg <pattern>", "read_only_search"],
  ["node_test_targeted", "node --test test/<target>.test.mjs", "targeted_test"],
  ["npm_validate_core", "npm run validate:core", "core_validation"],
  ["platform_check_command", "npm run platform:<command> -- --check", "platform_check"],
  ["doctor_smoke_command", "npm run <doctor-or-smoke> -- --check", "doctor_smoke_check"],
  ["artifact_summary_read", "read artifact summary.md", "artifact_read"],
];

const SANDBOX_SPECS = [
  ["repo_local_workdir", "Command workdir must be the repo or declared project checkout"],
  ["tmp_artifact_dir", "Command temporary output must be routed to declared artifact directories"],
  ["no_global_install", "Global install and system package mutation remain blocked"],
  ["no_home_secret_read", "Home directory secret and credential reads remain blocked"],
  ["no_network_by_default", "Network access remains blocked unless a later receipt lane explicitly opens it"],
];

const REDACTION_SPECS = [
  ["stdout_redaction", "Stdout evidence must be redacted before persistence"],
  ["stderr_redaction", "Stderr evidence must be redacted before persistence"],
  ["env_redaction", "Environment variables must be scanned and summarized without raw values"],
  ["secret_pattern_redaction", "Secret-like patterns must be replaced with evidence-safe markers"],
  ["raw_material_redaction", "Client, VDR, privileged, or domain raw material must not be exposed"],
];

const TIMEOUT_SPECS = [
  ["short_check_timeout", 30000, "Short checks and read-only inspections"],
  ["medium_test_timeout", 120000, "Targeted tests and validation commands"],
  ["long_validation_timeout", 300000, "Long validation commands with explicit closeout"],
  ["hard_kill_timeout", 600000, "Hard cap for a single human-approved execution candidate"],
];

const ROLLBACK_SPECS = [
  ["pre_execution_status_snapshot", "Record pre-execution status before any candidate command"],
  ["artifact_snapshot", "Record artifact paths and hashes expected to change"],
  ["file_restore_plan", "Record file restore plan before controlled mutation phases"],
  ["command_reversal_note", "Record whether the command has a deterministic reversal"],
  ["no_auto_rollback_without_receipt", "Rollback itself requires receipt when it mutates state"],
];

const CLOSEOUT_SPECS = [
  ["evidence_capture_closeout", "Capture redacted command evidence and evidence refs"],
  ["reviewer_verdict_closeout", "Bind reviewer verdict and PASS/BLOCK owner"],
  ["receipt_expiry_closeout", "Record receipt expiry or revocation state"],
  ["pass_block_closeout", "Convert result into PASS/BLOCK with block reason and next action"],
  ["memory_next_condition_closeout", "Record what changes the next execution condition"],
  ["p2401_handoff_closeout", "Freeze handoff to controlled write and console v2"],
];

const HANDOFF_SPECS = [
  ["p2401_controlled_write_console", "P2401-P2560", "Controlled write and operator console can consume the limited execution evidence model."],
  ["p2561_memory_event_plane", "P2561-P2720", "Memory and event plane can consume execution evidence and closeout records."],
  ["p3041_production_freeze", "P3041-P3200", "Production freeze can verify that limited execution was never free-form."],
];

export async function runPlatformHumanApprovedLimitedExecution(options = {}) {
  const result = await buildPlatformHumanApprovedLimitedExecution(options);
  if (options.write !== false) await writePlatformHumanApprovedLimitedExecution(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform human-approved limited execution failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformHumanApprovedLimitedExecution(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_HUMAN_APPROVED_LIMITED_EXECUTION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimeGovernanceLedger = await readTextSource(inputs.runtime_governance_ledger_path);
  const limitedExecutionLedger = await readTextSource(inputs.limited_execution_ledger_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const sourceRuntimeGovernance = options.sourceRuntimeGovernance ?? await buildPlatformRuntimeGovernanceRestore({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    runtimeGovernanceLedgerPath: inputs.runtime_governance_ledger_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    write: false,
  });

  const componentRows = buildComponentRows();
  const receiptRows = buildReceiptRows();
  const allowlistRows = buildAllowlistRows();
  const sandboxRows = buildSandboxRows();
  const redactionRows = buildRedactionRows();
  const timeoutRows = buildTimeoutRows();
  const rollbackRows = buildRollbackRows();
  const closeoutRows = buildCloseoutRows();
  const handoffRows = buildHandoffRows();
  const anchor = buildAnchor({ packageJson, runtimeGovernanceLedger, limitedExecutionLedger, roadmapDoc, sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows });
  const manifest = buildManifest({ generatedAt, sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows });
  const guardRows = buildGuardRows({ sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows });
  const boundary = buildBoundary({ sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows, guardRows });
  const validationItems = buildValidationItems({ packageJson, runtimeGovernanceLedger, limitedExecutionLedger, roadmapDoc, sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows, guardRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_human_approved_limited_execution_id: `platform-human-approved-limited-execution.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    limited_execution_anchor: anchor,
    source_runtime_governance_restore_summary: sourceRuntimeGovernance.summary,
    limited_execution_manifest: manifest,
    limited_execution_component_rows: componentRows,
    execution_receipt_rows: receiptRows,
    allowlist_command_rows: allowlistRows,
    sandbox_policy_rows: sandboxRows,
    redaction_policy_rows: redactionRows,
    timeout_policy_rows: timeoutRows,
    rollback_binding_rows: rollbackRows,
    execution_closeout_rows: closeoutRows,
    limited_execution_handoff_rows: handoffRows,
    limited_execution_guard_rows: guardRows,
    limited_execution_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows, guardRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_human_approved_limited_execution")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows, guardRows, boundary, validation: result.validation });
  result.summary.platform_human_approved_limited_execution_id = result.platform_human_approved_limited_execution_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformHumanApprovedLimitedExecution(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-human-approved-limited-execution.json"), serializableResult(result));
  await writeJson(path.join(outDir, "limited-execution-manifest.json"), result.limited_execution_manifest);
  await writeJson(path.join(outDir, "limited-execution-component-rows.json"), collectionEnvelope("limited-execution-component-rows.v1", "limited_execution_component_rows", result.limited_execution_component_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-receipt-rows.json"), collectionEnvelope("execution-receipt-rows.v1", "execution_receipt_rows", result.execution_receipt_rows, result.generated_at));
  await writeJson(path.join(outDir, "allowlist-command-rows.json"), collectionEnvelope("allowlist-command-rows.v1", "allowlist_command_rows", result.allowlist_command_rows, result.generated_at));
  await writeJson(path.join(outDir, "sandbox-policy-rows.json"), collectionEnvelope("sandbox-policy-rows.v1", "sandbox_policy_rows", result.sandbox_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "redaction-policy-rows.json"), collectionEnvelope("redaction-policy-rows.v1", "redaction_policy_rows", result.redaction_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "timeout-policy-rows.json"), collectionEnvelope("timeout-policy-rows.v1", "timeout_policy_rows", result.timeout_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "rollback-binding-rows.json"), collectionEnvelope("rollback-binding-rows.v1", "rollback_binding_rows", result.rollback_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "execution-closeout-rows.json"), collectionEnvelope("execution-closeout-rows.v1", "execution_closeout_rows", result.execution_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "limited-execution-handoff-rows.json"), collectionEnvelope("limited-execution-handoff-rows.v1", "limited_execution_handoff_rows", result.limited_execution_handoff_rows, result.generated_at));
  await writeJson(path.join(outDir, "limited-execution-guard-rows.json"), collectionEnvelope("limited-execution-guard-rows.v1", "limited_execution_guard_rows", result.limited_execution_guard_rows, result.generated_at));
  await writeJson(path.join(outDir, "limited-execution-boundary.json"), result.limited_execution_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-human-approved-limited-execution-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformHumanApprovedLimitedExecutionCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformHumanApprovedLimitedExecution(args);
    console.log(`Platform human-approved limited execution ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_human_approved_limited_execution_status}`);
    console.log(`Components: ${result.summary.component_count}`);
    console.log(`Receipt rows: ${result.summary.receipt_count}`);
    console.log(`Allowlist commands: ${result.summary.allowlist_command_count}`);
    console.log(`Sandbox policies: ${result.summary.sandbox_policy_count}`);
    console.log(`Redaction policies: ${result.summary.redaction_policy_count}`);
    console.log(`Timeout policies: ${result.summary.timeout_policy_count}`);
    console.log(`Rollback bindings: ${result.summary.rollback_binding_count}`);
    console.log(`P2401 handoff ready: ${result.summary.p2401_ready_as_next_goal}`);
    console.log(`Command executed now: ${result.summary.command_executed_now}`);
    console.log(`Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildComponentRows() {
  return COMPONENT_SPECS.map(([componentId, description], index) => passRow({
    schema_version: "limited-execution-component-row.v1",
    row_id: `limited.execution.component.row.${String(index + 1).padStart(2, "0")}`,
    component_id: componentId,
    component_status: "contract_ready",
    description,
    evidence_ref: `evidence.platform.limited_execution.component.${componentId}`,
    reviewer_ref: "reviewer.platform_limited_execution",
    hard_gate_ref: `gate.platform.limited_execution.component.${componentId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "preserve as limited execution precondition",
  }));
}

function buildReceiptRows() {
  return RECEIPT_SPECS.map(([receiptType, description], index) => passRow({
    schema_version: "execution-receipt-row.v1",
    row_id: `execution.receipt.row.${String(index + 1).padStart(2, "0")}`,
    receipt_type: receiptType,
    receipt_status: "required_before_candidate_execution",
    description,
    requires_human_owner: true,
    requires_scope: true,
    requires_expiry: true,
    requires_revocation_check: true,
    receipt_applied_now: false,
    execution_enabled_by_receipt_now: false,
    evidence_ref: `evidence.platform.limited_execution.receipt.${receiptType}`,
    reviewer_ref: "reviewer.platform_limited_execution_receipt",
    hard_gate_ref: `gate.platform.limited_execution.receipt.${receiptType}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "collect and validate human receipt before candidate execution",
  }));
}

function buildAllowlistRows() {
  return ALLOWLIST_SPECS.map(([commandId, command_template, commandClass], index) => passRow({
    schema_version: "allowlist-command-row.v1",
    row_id: `allowlist.command.row.${String(index + 1).padStart(2, "0")}`,
    command_id: commandId,
    command_template,
    command_class: commandClass,
    allowlist_status: "candidate_only",
    requires_human_receipt: true,
    requires_repo_local_sandbox: true,
    requires_redaction: true,
    requires_timeout: true,
    requires_rollback_binding: true,
    requires_evidence_ref: true,
    command_execution_allowed_now: false,
    mutation_allowed_now: false,
    secret_read_allowed_now: false,
    network_allowed_now: false,
    evidence_ref: `evidence.platform.limited_execution.allowlist.${commandId}`,
    reviewer_ref: "reviewer.platform_limited_execution_allowlist",
    hard_gate_ref: `gate.platform.limited_execution.allowlist.${commandId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "bind validated receipt, sandbox, redaction, timeout, rollback, and closeout before execution",
  }));
}

function buildSandboxRows() {
  return SANDBOX_SPECS.map(([sandboxPolicyId, description], index) => passRow({
    schema_version: "sandbox-policy-row.v1",
    row_id: `sandbox.policy.row.${String(index + 1).padStart(2, "0")}`,
    sandbox_policy_id: sandboxPolicyId,
    sandbox_status: "required_before_execution",
    description,
    repo_local_only: true,
    global_install_allowed: false,
    home_secret_read_allowed: false,
    network_allowed_by_default: false,
    workspace_mutation_allowed_now: false,
    sandbox_enforced_before_execution: true,
    evidence_ref: `evidence.platform.limited_execution.sandbox.${sandboxPolicyId}`,
    reviewer_ref: "reviewer.platform_limited_execution_sandbox",
    hard_gate_ref: `gate.platform.limited_execution.sandbox.${sandboxPolicyId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "prove sandbox scope before any command execution",
  }));
}

function buildRedactionRows() {
  return REDACTION_SPECS.map(([redactionPolicyId, description], index) => passRow({
    schema_version: "redaction-policy-row.v1",
    row_id: `redaction.policy.row.${String(index + 1).padStart(2, "0")}`,
    redaction_policy_id: redactionPolicyId,
    redaction_status: "required_before_evidence_persistence",
    description,
    raw_stdout_allowed: false,
    raw_stderr_allowed: false,
    raw_env_allowed: false,
    raw_secret_allowed: false,
    raw_material_allowed: false,
    redacted_summary_required: true,
    evidence_ref_required: true,
    evidence_ref: `evidence.platform.limited_execution.redaction.${redactionPolicyId}`,
    reviewer_ref: "reviewer.platform_limited_execution_redaction",
    hard_gate_ref: `gate.platform.limited_execution.redaction.${redactionPolicyId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "persist only redacted summary and evidence ref",
  }));
}

function buildTimeoutRows() {
  return TIMEOUT_SPECS.map(([timeoutPolicyId, timeoutMs, description], index) => passRow({
    schema_version: "timeout-policy-row.v1",
    row_id: `timeout.policy.row.${String(index + 1).padStart(2, "0")}`,
    timeout_policy_id: timeoutPolicyId,
    timeout_status: "required_before_execution",
    timeout_ms: timeoutMs,
    description,
    timeout_required: true,
    hard_kill_required: true,
    retry_requires_new_receipt: true,
    command_execution_allowed_now: false,
    evidence_ref: `evidence.platform.limited_execution.timeout.${timeoutPolicyId}`,
    reviewer_ref: "reviewer.platform_limited_execution_timeout",
    hard_gate_ref: `gate.platform.limited_execution.timeout.${timeoutPolicyId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "bind timeout before any candidate execution",
  }));
}

function buildRollbackRows() {
  return ROLLBACK_SPECS.map(([rollbackBindingId, description], index) => passRow({
    schema_version: "rollback-binding-row.v1",
    row_id: `rollback.binding.row.${String(index + 1).padStart(2, "0")}`,
    rollback_binding_id: rollbackBindingId,
    rollback_status: "required_before_execution_or_write",
    description,
    rollback_target_required: true,
    pre_execution_snapshot_required: true,
    auto_rollback_allowed_now: false,
    rollback_mutation_allowed_without_receipt: false,
    evidence_ref: `evidence.platform.limited_execution.rollback.${rollbackBindingId}`,
    reviewer_ref: "reviewer.platform_limited_execution_rollback",
    hard_gate_ref: `gate.platform.limited_execution.rollback.${rollbackBindingId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "bind rollback evidence before execution or controlled write",
  }));
}

function buildCloseoutRows() {
  return CLOSEOUT_SPECS.map(([closeoutId, description], index) => passRow({
    schema_version: "execution-closeout-row.v1",
    row_id: `execution.closeout.row.${String(index + 1).padStart(2, "0")}`,
    closeout_id: closeoutId,
    closeout_status: "required_after_candidate_execution",
    description,
    evidence_ref_required: true,
    reviewer_verdict_required: true,
    pass_block_required: true,
    block_reason_required_when_blocked: true,
    next_condition_required: true,
    closeout_completed_now: false,
    evidence_ref: `evidence.platform.limited_execution.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform_limited_execution_closeout",
    hard_gate_ref: `gate.platform.limited_execution.closeout.${closeoutId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "complete closeout only after receipt-backed candidate execution",
  }));
}

function buildHandoffRows() {
  return HANDOFF_SPECS.map(([handoffId, phaseRange, description], index) => passRow({
    schema_version: "limited-execution-handoff-row.v1",
    row_id: `limited.execution.handoff.row.${String(index + 1).padStart(2, "0")}`,
    handoff_id: handoffId,
    phase_range: phaseRange,
    handoff_status: "ready_as_input",
    description,
    execution_enabled_by_handoff: false,
    write_enabled_by_handoff: false,
    protected_action_enabled_by_handoff: false,
    evidence_ref: `evidence.platform.limited_execution.handoff.${handoffId}`,
    reviewer_ref: "reviewer.platform_limited_execution_handoff",
    hard_gate_ref: `gate.platform.limited_execution.handoff.${handoffId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: "consume in later phase without treating handoff as execution permission",
  }));
}

function buildAnchor({ packageJson, runtimeGovernanceLedger, limitedExecutionLedger, roadmapDoc, sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows }) {
  return {
    schema_version: "limited-execution-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    package_script_registered: Boolean(packageJson.data?.scripts?.[COMMAND_NAME]),
    validation_chain_registered: Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)),
    runtime_governance_ledger_present: runtimeGovernanceLedger.available,
    limited_execution_ledger_present: limitedExecutionLedger.available,
    roadmap_doc_present: roadmapDoc.available,
    source_runtime_governance_status: sourceRuntimeGovernance.summary.platform_runtime_governance_restore_status,
    source_runtime_execution_allowed_now: sourceRuntimeGovernance.summary.runtime_execution_allowed_now,
    source_write_action_allowed_now: sourceRuntimeGovernance.summary.write_action_allowed_now,
    component_count: componentRows.length,
    receipt_count: receiptRows.length,
    allowlist_command_count: allowlistRows.length,
    sandbox_policy_count: sandboxRows.length,
    redaction_policy_count: redactionRows.length,
    timeout_policy_count: timeoutRows.length,
    rollback_binding_count: rollbackRows.length,
    closeout_count: closeoutRows.length,
    handoff_count: handoffRows.length,
  };
}

function buildManifest({ generatedAt, sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows }) {
  return {
    schema_version: "limited-execution-manifest.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_runtime_governance_status: sourceRuntimeGovernance.summary.platform_runtime_governance_restore_status,
    component_count: componentRows.length,
    receipt_count: receiptRows.length,
    allowlist_command_count: allowlistRows.length,
    sandbox_policy_count: sandboxRows.length,
    redaction_policy_count: redactionRows.length,
    timeout_policy_count: timeoutRows.length,
    rollback_binding_count: rollbackRows.length,
    closeout_count: closeoutRows.length,
    handoff_count: handoffRows.length,
    limited_execution_contract_ready: true,
    execution_candidate_allowed_with_receipt: true,
    next_allowed_action: "start P2401-P2560 controlled write and operator console v2 planning",
  };
}

function buildGuardRows({ sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows }) {
  const guards = [
    ["source_runtime_governance_ready", sourceRuntimeGovernance.summary.platform_runtime_governance_restore_status === SOURCE_READY_STATUS, "Source runtime governance restore must be ready"],
    ["source_still_non_executing", sourceRuntimeGovernance.summary.runtime_execution_allowed_now === false && sourceRuntimeGovernance.summary.write_action_allowed_now === false, "Source must still prohibit runtime execution and write"],
    ["components_ready", componentRows.length === 7 && componentRows.every((row) => row.current_verdict === "pass"), "All limited execution components must pass"],
    ["receipts_required_not_applied", receiptRows.length === 7 && receiptRows.every((row) => row.requires_human_owner && row.receipt_applied_now === false), "Receipts must be required and not applied now"],
    ["allowlist_candidate_only", allowlistRows.length === 8 && allowlistRows.every((row) => row.allowlist_status === "candidate_only" && row.command_execution_allowed_now === false), "Allowlist rows must remain candidate-only"],
    ["sandbox_required_before_execution", sandboxRows.length === 5 && sandboxRows.every((row) => row.sandbox_enforced_before_execution === true && row.global_install_allowed === false), "Sandbox policies must be required before execution"],
    ["redaction_required", redactionRows.length === 5 && redactionRows.every((row) => row.redacted_summary_required === true && row.raw_secret_allowed === false), "Redaction policies must block raw secret and raw material exposure"],
    ["timeouts_required", timeoutRows.length === 4 && timeoutRows.every((row) => row.timeout_required === true && row.command_execution_allowed_now === false), "Timeout policies must be required"],
    ["rollback_required", rollbackRows.length === 5 && rollbackRows.every((row) => row.rollback_target_required === true && row.rollback_mutation_allowed_without_receipt === false), "Rollback policies must require targets and receipt for mutation"],
    ["closeout_required", closeoutRows.length === 6 && closeoutRows.every((row) => row.evidence_ref_required === true && row.closeout_completed_now === false), "Closeout policies must be required but not completed now"],
    ["handoffs_no_enablement", handoffRows.every((row) => row.execution_enabled_by_handoff === false && row.write_enabled_by_handoff === false), "Handoffs must not enable execution or write"],
    ["no_runtime_or_write_enabled", true, "This contract does not execute commands, apply receipts, mutate files, or open protected actions"],
  ];
  return guards.map(([guardId, pass, description], index) => ({
    schema_version: "limited-execution-guard-row.v1",
    row_id: `limited.execution.guard.row.${String(index + 1).padStart(2, "0")}`,
    guard_id: guardId,
    guard_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${guardId}`,
    evidence_ref: `evidence.platform.limited_execution.guard.${guardId}`,
    reviewer_ref: "reviewer.platform_limited_execution_guard",
    hard_gate_ref: `gate.platform.limited_execution.guard.${guardId}`,
    responsible_owner: "platform_runtime_owner",
    next_allowed_action: pass ? "preserve guard evidence" : `repair ${guardId} before P2400 freeze`,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary({ sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows, guardRows }) {
  const unsafeFlags = [
    sourceRuntimeGovernance.summary.platform_runtime_governance_restore_status !== SOURCE_READY_STATUS,
    sourceRuntimeGovernance.summary.runtime_execution_allowed_now,
    sourceRuntimeGovernance.summary.write_action_allowed_now,
    componentRows.some((row) => row.current_verdict !== "pass"),
    receiptRows.some((row) => row.receipt_applied_now || row.execution_enabled_by_receipt_now || !row.requires_human_owner),
    allowlistRows.some((row) => row.command_execution_allowed_now || row.mutation_allowed_now || row.secret_read_allowed_now || row.network_allowed_now),
    sandboxRows.some((row) => row.global_install_allowed || row.home_secret_read_allowed || row.network_allowed_by_default || row.workspace_mutation_allowed_now),
    redactionRows.some((row) => row.raw_stdout_allowed || row.raw_stderr_allowed || row.raw_env_allowed || row.raw_secret_allowed || row.raw_material_allowed),
    timeoutRows.some((row) => !row.timeout_required || !row.hard_kill_required || row.command_execution_allowed_now),
    rollbackRows.some((row) => !row.rollback_target_required || row.auto_rollback_allowed_now || row.rollback_mutation_allowed_without_receipt),
    closeoutRows.some((row) => !row.evidence_ref_required || !row.reviewer_verdict_required || row.closeout_completed_now),
    handoffRows.some((row) => row.execution_enabled_by_handoff || row.write_enabled_by_handoff || row.protected_action_enabled_by_handoff),
    guardRows.some((row) => row.guard_status !== "ready"),
  ];
  return {
    schema_version: "limited-execution-boundary.v1",
    source_runtime_governance_status: sourceRuntimeGovernance.summary.platform_runtime_governance_restore_status,
    limited_execution_contract_ready: true,
    limited_execution_lane_ready: unsafeFlags.filter(Boolean).length === 0,
    execution_candidate_allowed_with_receipt: unsafeFlags.filter(Boolean).length === 0,
    command_executed_now: false,
    mutation_performed: false,
    receipt_applied_now: false,
    server_started: false,
    mcp_connection_opened: false,
    job_scheduled_or_run: false,
    runtime_execution_allowed_now: false,
    write_action_allowed_now: false,
    protected_action_execution_allowed_now: false,
    receipt_application_allowed_now: false,
    raw_material_access_allowed_now: false,
    agent_final_pass_allowed_now: false,
    p2401_ready_as_next_goal: unsafeFlags.filter(Boolean).length === 0,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems({ packageJson, runtimeGovernanceLedger, limitedExecutionLedger, roadmapDoc, sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows, guardRows, boundary }) {
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json must register platform:human-approved-limited-execution"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include platform:human-approved-limited-execution -- --check"),
    validationItem("source.runtime_governance", "source_ready", sourceRuntimeGovernance.summary.platform_runtime_governance_restore_status === SOURCE_READY_STATUS, "source runtime governance restore must be ready"),
    validationItem("source.no_execution", "source_ready", sourceRuntimeGovernance.summary.runtime_execution_allowed_now === false && sourceRuntimeGovernance.summary.write_action_allowed_now === false, "source must not enable runtime or write"),
    validationItem("ledger.runtime_governance", "ledger", runtimeGovernanceLedger.available && runtimeGovernanceLedger.text.includes(SOURCE_COMMAND_NAME), "runtime governance ledger must be present"),
    validationItem("ledger.limited_execution", "ledger", limitedExecutionLedger.available && limitedExecutionLedger.text.includes("P2241-P2400") && limitedExecutionLedger.text.includes(COMMAND_NAME), "limited execution ledger must be present"),
    validationItem("roadmap.limited_execution", "roadmap", roadmapDoc.available && roadmapDoc.text.includes("P2241-P2400") && roadmapDoc.text.includes("Human-Approved Limited Execution"), "roadmap must reflect human-approved limited execution"),
    validationItem("components.count", "component_rows", componentRows.length === 7, "all limited execution component rows must exist"),
    validationItem("receipts.count", "receipt_rows", receiptRows.length === 7, "all execution receipt rows must exist"),
    validationItem("allowlist.count", "allowlist_rows", allowlistRows.length === 8, "all allowlist command rows must exist"),
    validationItem("sandbox.count", "sandbox_rows", sandboxRows.length === 5, "all sandbox policy rows must exist"),
    validationItem("redaction.count", "redaction_rows", redactionRows.length === 5, "all redaction policy rows must exist"),
    validationItem("timeouts.count", "timeout_rows", timeoutRows.length === 4, "all timeout policy rows must exist"),
    validationItem("rollback.count", "rollback_rows", rollbackRows.length === 5, "all rollback binding rows must exist"),
    validationItem("closeout.count", "closeout_rows", closeoutRows.length === 6, "all execution closeout rows must exist"),
    validationItem("handoffs.count", "handoff_rows", handoffRows.length === 3, "all limited execution handoff rows must exist"),
    validationItem("allowlist.no_execution", "unsafe_invariants", allowlistRows.every((row) => row.command_execution_allowed_now === false && row.mutation_allowed_now === false), "allowlist rows must not execute or mutate now"),
    validationItem("receipts.not_applied", "unsafe_invariants", receiptRows.every((row) => row.receipt_applied_now === false && row.execution_enabled_by_receipt_now === false), "receipts must not be applied now"),
    validationItem("guards.ready", "guard_rows", guardRows.every((row) => row.guard_status === "ready"), "all limited execution guards must be ready"),
    validationItem("boundary.safe", "unsafe_invariants", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_execution", "unsafe_invariants", boundary.command_executed_now === false && boundary.runtime_execution_allowed_now === false && boundary.write_action_allowed_now === false, "limited execution contract must not perform execution or write"),
  ];
}

function buildSummary({ sourceRuntimeGovernance, componentRows, receiptRows, allowlistRows, sandboxRows, redactionRows, timeoutRows, rollbackRows, closeoutRows, handoffRows, guardRows, boundary, validation }) {
  return {
    schema_version: "platform-human-approved-limited-execution-summary.v1",
    platform_human_approved_limited_execution_status: validation.valid && boundary.p2401_ready_as_next_goal ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    source_runtime_governance_status: sourceRuntimeGovernance.summary.platform_runtime_governance_restore_status,
    component_count: componentRows.length,
    receipt_count: receiptRows.length,
    allowlist_command_count: allowlistRows.length,
    sandbox_policy_count: sandboxRows.length,
    redaction_policy_count: redactionRows.length,
    timeout_policy_count: timeoutRows.length,
    rollback_binding_count: rollbackRows.length,
    closeout_count: closeoutRows.length,
    handoff_count: handoffRows.length,
    guard_count: guardRows.length,
    ready_guard_count: guardRows.filter((row) => row.guard_status === "ready").length,
    limited_execution_contract_ready: boundary.limited_execution_contract_ready,
    limited_execution_lane_ready: boundary.limited_execution_lane_ready,
    execution_candidate_allowed_with_receipt: boundary.execution_candidate_allowed_with_receipt,
    p2401_ready_as_next_goal: boundary.p2401_ready_as_next_goal,
    command_executed_now: boundary.command_executed_now,
    mutation_performed: boundary.mutation_performed,
    receipt_applied_now: boundary.receipt_applied_now,
    runtime_execution_allowed_now: boundary.runtime_execution_allowed_now,
    write_action_allowed_now: boundary.write_action_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    receipt_application_allowed_now: boundary.receipt_application_allowed_now,
    raw_material_access_allowed_now: boundary.raw_material_access_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function passRow(fields) {
  return {
    ...fields,
    current_verdict: "pass",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Platform Human-Approved Limited Execution",
    "",
    `Status: ${result.summary.platform_human_approved_limited_execution_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Source runtime governance status: ${result.summary.source_runtime_governance_status}`,
    `Components: ${result.summary.component_count}`,
    `Receipt rows: ${result.summary.receipt_count}`,
    `Allowlist commands: ${result.summary.allowlist_command_count}`,
    `Sandbox policies: ${result.summary.sandbox_policy_count}`,
    `Redaction policies: ${result.summary.redaction_policy_count}`,
    `Timeout policies: ${result.summary.timeout_policy_count}`,
    `Rollback bindings: ${result.summary.rollback_binding_count}`,
    `Execution closeouts: ${result.summary.closeout_count}`,
    `P2401 ready as next goal: ${result.summary.p2401_ready_as_next_goal}`,
    `Execution candidate allowed with receipt: ${result.summary.execution_candidate_allowed_with_receipt}`,
    `Command executed now: ${result.summary.command_executed_now}`,
    `Receipt applied now: ${result.summary.receipt_applied_now}`,
    `Runtime execution allowed now: ${result.summary.runtime_execution_allowed_now}`,
    `Write action allowed now: ${result.summary.write_action_allowed_now}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Next Allowed Action",
    "",
    "Start P2401-P2560 Controlled Write and Operator Console v2. This program defines the limited execution contract and candidates, but it does not execute commands, apply receipts, mutate files, start servers, connect MCP, run jobs, or open protected actions.",
    "",
  ].join("\n");
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_HUMAN_APPROVED_LIMITED_EXECUTION_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    runtime_governance_ledger_path: options.runtimeGovernanceLedgerPath ?? defaults.runtimeGovernanceLedgerPath,
    limited_execution_ledger_path: options.limitedExecutionLedgerPath ?? defaults.limitedExecutionLedgerPath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function validationItem(item_id, category, passed, message) {
  return {
    item_id,
    category,
    status: passed ? "pass" : "error",
    message,
  };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    collection: collectionName,
    count: items.length,
    items,
  };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    runtimeGovernanceLedgerPath: undefined,
    limitedExecutionLedgerPath: undefined,
    roadmapDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--runtime-governance-ledger") {
      args.runtimeGovernanceLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--limited-execution-ledger") {
      args.limitedExecutionLedgerPath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-human-approved-limited-execution.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --runtime-governance-ledger <path>
  --limited-execution-ledger <path>
  --roadmap-doc <path>            Long-range roadmap document path.
  --help                          Show this help.
`);
}
