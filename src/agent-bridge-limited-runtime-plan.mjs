import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import {
  AUTHORITY_FLAGS,
  classifyProtectedCommand,
} from "./agent-bridge-manifest.mjs";
import { buildAgentBridgeExecutionCandidate } from "./agent-bridge-execution-candidate.mjs";
import { buildAgentBridgeRequestPacketExport } from "./agent-bridge-request-packet-export.mjs";

export const DEFAULT_AGENT_BRIDGE_LIMITED_RUNTIME_PLAN_OUT_DIR = "artifacts/agent-bridge-limited-runtime-plan/latest";
export const DEFAULT_AGENT_BRIDGE_LIMITED_RUNTIME_PLAN_INPUTS = {
  schemaPath: "schemas/agent-bridge-limited-runtime-plan.schema.json",
  packagePath: "package.json",
  sourceAgentBridgeExecutionCandidatePath: "artifacts/agent-bridge-execution-candidate/latest/agent-bridge-execution-candidate.json",
  sourceAgentBridgeRequestPacketExportPath: "artifacts/agent-bridge-request-packet-export/latest/agent-bridge-request-packet-export.json",
  runbookPath: "docs/hermes-agent-bridge-local-operator-runbook-2026-06-16.md",
};

const SCHEMA_VERSION = "agent-bridge-limited-runtime-plan.v1";
const CAPABILITY_ID = "platform.agent_bridge_limited_runtime_plan";
const COMMAND_NAME = "platform:agent-bridge-limited-runtime-plan";
const PROGRAM_RANGE = "AGENT-BRIDGE-L9-L10-SLICE-G";
const READY_STATUS = "ready_for_agent_bridge_limited_runtime_plan";
const BLOCKED_STATUS = "blocked_agent_bridge_limited_runtime_plan";

const PROVIDER_ADAPTER_SPECS = [
  {
    adapter_id: "adapter.agbrowse.chatgpt_review_request",
    target_runtime_id: "runtime.chatgpt.web_agbrowse",
    adapter_kind: "web_ai_review_request",
    request_type: "plan_review",
    adapter_title: "Agbrowse ChatGPT review request adapter",
    packet_match: "plan_review",
    transport_command_template: "agbrowse web-ai query --vendor chatgpt --model pro --inline-only --allow-copy-markdown-fallback --prompt <packet>",
  },
  {
    adapter_id: "adapter.claude_code.read_only_review_request",
    target_runtime_id: "runtime.claude_code.opus_max",
    adapter_kind: "cli_read_only_review_request",
    request_type: "code_review",
    adapter_title: "Claude Code read-only review request adapter",
    packet_match: "code_review",
    transport_command_template: "claude ultrareview main --read-only --prompt <packet>",
  },
  {
    adapter_id: "adapter.codex.task_request_packet",
    target_runtime_id: "runtime.codex.desktop",
    adapter_kind: "codex_task_request_packet",
    request_type: "implementation_proposal",
    adapter_title: "Codex task request adapter",
    packet_match: "implementation_proposal",
    transport_command_template: "codex task --packet <packet>",
  },
];

const L9_BLOCKED_COMMAND_FIXTURES = [
  ["blocked.git_merge", "git merge codex/agent-bridge", "git_merge"],
  ["blocked.git_tag", "git tag v1.0.0", "deploy"],
  ["blocked.gh_release", "gh release create v1.0.0", "deploy"],
  ["blocked.npm_publish", "npm publish", "deploy"],
  ["blocked.npm_version", "npm version patch", "deploy"],
  ["blocked.pr_merge", "gh pr merge 1 --merge", "git_merge"],
  ["blocked.pr_approve", "gh pr review 1 --approve", "approve"],
  ["blocked.apply_patch", "apply_patch <<PATCH", "apply_patch_or_receipt"],
  ["blocked.receipt_apply", "npm run platform:agent-bridge-receipt-import-workspace -- --apply", "apply_patch_or_receipt"],
  ["blocked.env_read", "cat .env", "secret_read"],
  ["blocked.home_secret", "cat ~/.config/hermes/token.json", "secret_read"],
  ["blocked.raw_transcript", "open artifacts/review/raw-output.json", "raw_source_exposure"],
  ["blocked.shell_chain", "sh -c \"npm run validate:core\"", "shell_indirection"],
  ["blocked.sudo", "sudo npm run desktop:build", "destructive_delete"],
];

const L10_PREFLIGHT_SPECS = [
  ["l9_limited_runtime_plan_check", "npm run platform:agent-bridge-limited-runtime-plan -- --check", "platform_check"],
  ["agent_bridge_closeout_check", "npm run platform:agent-bridge-closeout-readiness -- --check", "platform_check"],
  ["desktop_read_model_check", "npm run desktop:read-model -- --check", "desktop_check"],
  ["desktop_agents_smoke", "npm run desktop:smoke:render -- --screen=agents", "desktop_smoke"],
  ["desktop_local_preflight", "npm run desktop:local-preflight", "desktop_preflight"],
  ["agent_bridge_targeted_tests", "node --test test/agent-bridge-manifest.test.mjs test/agent-bridge-request-receipt.test.mjs test/agent-bridge-request-packet-export.test.mjs test/agent-bridge-receipt-import-workspace.test.mjs test/agent-bridge-review-finding-workbench.test.mjs test/agent-bridge-execution-candidate.test.mjs test/agent-bridge-limited-runtime-plan.test.mjs test/agent-bridge-closeout-readiness.test.mjs test/desktop-read-model.test.mjs apps/desktop/test/read-model.test.mjs", "targeted_test"],
  ["core_validation", "npm run validate:core", "core_validation"],
  ["diff_check", "git diff --check", "diff_check"],
];

export async function runAgentBridgeLimitedRuntimePlan(options = {}) {
  const result = await buildAgentBridgeLimitedRuntimePlan(options);
  if (options.write !== false) await writeAgentBridgeLimitedRuntimePlan(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Agent Bridge limited runtime plan failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildAgentBridgeLimitedRuntimePlan(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_AGENT_BRIDGE_LIMITED_RUNTIME_PLAN_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const runbook = await readTextSource(inputs.runbook_path);
  const sourceExecutionCandidate = await resolveExecutionCandidate(options, inputs, generatedAt);
  const sourceRequestPacketExport = await resolveRequestPacketExport(options, inputs, generatedAt);
  const context = {
    generatedAt,
    outputDir,
    inputs,
    packageJson,
    runbook,
    sourceExecutionCandidate,
    sourceRequestPacketExport,
  };
  const contract = buildContract(context);
  const sourceRows = buildSourceRows(context);
  const dryRunRows = buildDryRunExecutorRows(context);
  const ownerGateRows = buildOwnerGateRows(context, dryRunRows);
  const providerRows = buildProviderAdapterRows(context);
  const blockedRows = buildBlockedRuntimeFixtureRows(context);
  const preflightRows = buildPreflightRows(context);
  const gateRows = buildGateRows({
    context,
    sourceRows,
    dryRunRows,
    ownerGateRows,
    providerRows,
    blockedRows,
    preflightRows,
  });
  const boundary = buildBoundary({
    context,
    sourceRows,
    dryRunRows,
    ownerGateRows,
    providerRows,
    blockedRows,
    preflightRows,
    gateRows,
  });
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_agent_bridge_execution_candidate_summary: sourceExecutionCandidate.data?.summary ?? null,
    source_agent_bridge_request_packet_export_summary: sourceRequestPacketExport.data?.summary ?? null,
    agent_bridge_limited_runtime_contract: contract,
    agent_bridge_limited_runtime_source_rows: sourceRows,
    dry_run_executor_rows: dryRunRows,
    owner_limited_execution_gate_rows: ownerGateRows,
    provider_adapter_request_rows: providerRows,
    blocked_runtime_command_fixture_rows: blockedRows,
    l10_preflight_candidate_rows: preflightRows,
    limited_runtime_gate_rows: gateRows,
    limited_runtime_boundary: boundary,
    validation_items: [],
    validation: summarizeValidation([]),
    summary: {},
  };
  result.summary = buildSummary(result);
  const validation = validateAgentBridgeLimitedRuntimePlanResult(result, schema.available ? schema.data : null);
  result.validation_items = validation.validation_items;
  result.validation = validation.validation;
  result.summary = buildSummary(result);
  return { ...result, markdown: renderMarkdown(result) };
}

export function validateAgentBridgeLimitedRuntimePlanResult(result, schema = null) {
  const items = buildValidationItems(result);
  const schemaErrors = schema
    ? validateAgainstSchema(result, schema, {}, "agent_bridge_limited_runtime_plan")
    : [{ path: "schema", message: "Schema unavailable" }];
  const schemaItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, false, error.message, error.path));
  const validationItems = [...items, ...schemaItems];
  return {
    validation_items: validationItems,
    validation: summarizeValidation(validationItems),
  };
}

export async function writeAgentBridgeLimitedRuntimePlan(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  const serializable = { ...result };
  delete serializable.markdown;
  await writeJson(path.join(outDir, "agent-bridge-limited-runtime-plan.json"), serializable);
  await writeJson(path.join(outDir, "dry-run-executor-rows.json"), collectionEnvelope("dry-run-executor-rows.v1", "dry_run_executor_rows", result.dry_run_executor_rows, result.generated_at));
  await writeJson(path.join(outDir, "owner-limited-execution-gate-rows.json"), collectionEnvelope("owner-limited-execution-gate-rows.v1", "owner_limited_execution_gate_rows", result.owner_limited_execution_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "provider-adapter-request-rows.json"), collectionEnvelope("provider-adapter-request-rows.v1", "provider_adapter_request_rows", result.provider_adapter_request_rows, result.generated_at));
  await writeJson(path.join(outDir, "blocked-runtime-command-fixture-rows.json"), collectionEnvelope("blocked-runtime-command-fixture-rows.v1", "blocked_runtime_command_fixture_rows", result.blocked_runtime_command_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "l10-preflight-candidate-rows.json"), collectionEnvelope("l10-preflight-candidate-rows.v1", "l10_preflight_candidate_rows", result.l10_preflight_candidate_rows, result.generated_at));
  await writeJson(path.join(outDir, "limited-runtime-gate-rows.json"), collectionEnvelope("limited-runtime-gate-rows.v1", "limited_runtime_gate_rows", result.limited_runtime_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "limited-runtime-boundary.json"), result.limited_runtime_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "agent-bridge-limited-runtime-plan-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runAgentBridgeLimitedRuntimePlanCli(argv = process.argv.slice(2)) {
  try {
    const args = parseAgentBridgeLimitedRuntimePlanArgs(argv);
    if (args.help) {
      printHelp();
      return;
    }
    const result = await runAgentBridgeLimitedRuntimePlan(args);
    console.log(`Agent Bridge limited runtime plan ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.agent_bridge_limited_runtime_plan_status}`);
    console.log(`Dry-run executor rows: ${result.summary.dry_run_executor_count}`);
    console.log(`Provider adapter requests: ${result.summary.provider_adapter_request_count}`);
    console.log(`Blocked runtime fixtures: ${result.summary.blocked_runtime_command_fixture_count}`);
    console.log(`Execution allowed now: ${result.summary.execution_allowed_now}`);
    console.log(`Command executed now: ${result.summary.command_executed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const item of error.validation?.errors ?? []) console.error(`- ${item.path}: ${item.message}`);
    process.exitCode = 1;
  }
}

function buildContract(context) {
  return {
    schema_version: "agent-bridge-limited-runtime-contract.v1",
    generated_at: context.generatedAt,
    contract_id: "contract.hermes.agent_bridge_limited_runtime.local_only_dry_run",
    source_agent_bridge_execution_candidate_status: context.sourceExecutionCandidate.data?.summary?.agent_bridge_execution_candidate_status ?? "missing",
    source_agent_bridge_request_packet_export_status: context.sourceRequestPacketExport.data?.summary?.agent_bridge_request_packet_export_status ?? "missing",
    local_only: true,
    read_only: true,
    source_of_truth: false,
    dry_run_executor_enabled_now: true,
    owner_limited_execution_gate_enabled_now: true,
    provider_adapter_request_projection_enabled_now: true,
    l10_preflight_candidate_enabled_now: true,
    execution_allowed_now: false,
    command_executed_now: false,
    command_output_captured_now: false,
    mutation_performed: false,
    dry_run_only: true,
    owner_approval_observed: false,
    human_receipt_required_before_execution: true,
    limited_execution_receipt_required: true,
    request_transport_submission_allowed_now: false,
    provider_automation_allowed_now: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    provider_output_authoritative: false,
    ...falseAuthorityFlags(),
  };
}

function buildSourceRows(context) {
  const specs = [
    ["agent_bridge_execution_candidate", context.inputs.source_agent_bridge_execution_candidate_path, context.sourceExecutionCandidate, "agent_bridge_execution_candidate_status", "ready_for_agent_bridge_execution_candidate"],
    ["agent_bridge_request_packet_export", context.inputs.source_agent_bridge_request_packet_export_path, context.sourceRequestPacketExport, "agent_bridge_request_packet_export_status", "ready_for_agent_bridge_request_packet_export"],
    ["runbook", context.inputs.runbook_path, context.runbook, null, null],
  ];
  return specs.map(([sourceId, sourcePath, source, summaryField, readyStatus], index) => {
    const observedStatus = summaryField ? source.data?.summary?.[summaryField] ?? "missing" : source.available ? "parsed" : "missing";
    const ready = source.available === true && source.parse_status === "parsed" && (!readyStatus || observedStatus === readyStatus);
    return verdictRow({
      schema_version: "agent-bridge-limited-runtime-source-row.v1",
      row_id: `agent.bridge.limited.runtime.source.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: context.generatedAt,
      source_id: sourceId,
      source_path: sourcePath,
      source_available: source.available === true,
      source_parse_status: source.parse_status ?? "missing",
      source_hash: source.content_hash ?? null,
      observed_status: observedStatus,
      ready_status: readyStatus ?? "parsed",
      source_ready: ready,
      source_error: source.error ?? null,
      authority_effect: "limited_runtime_evidence_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
    }, ready);
  });
}

function buildDryRunExecutorRows(context) {
  const candidates = context.sourceExecutionCandidate.data?.agent_bridge_execution_candidate_rows ?? [];
  return candidates.map((candidate, index) => {
    const commandText = String(candidate.command_text ?? "");
    return verdictRow({
      schema_version: "agent-bridge-dry-run-executor-row.v1",
      row_id: `agent.bridge.dry.run.executor.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: context.generatedAt,
      candidate_id: String(candidate.candidate_id ?? `candidate.${index + 1}`),
      candidate_type: String(candidate.candidate_type ?? "unknown"),
      command_text: commandText,
      printed_intended_command: `DRY RUN ONLY: ${commandText}`,
      dry_run_trace_created: true,
      dry_run_trace_ref: `trace.agent_bridge.limited_runtime.${index + 1}`,
      executor_adapter_id: "executor.local.no_spawn_dry_run.v1",
      executor_adapter_status: "printed_intended_command_only",
      stdout_preview: `DRY RUN ONLY: ${commandText}`,
      stderr_preview: "",
      stdout_stderr_redacted: true,
      sandbox_profile: String(candidate.sandbox_profile ?? "repo_local_read_only"),
      timeout_ms: Number(candidate.timeout_ms ?? 0),
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      receipt_applied: false,
      authority_effect: "dry_run_trace_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
      next_allowed_action: "collect owner limited-execution receipt before any real command run",
    }, commandText.length > 0);
  });
}

function buildOwnerGateRows(context, dryRunRows) {
  return dryRunRows.map((row, index) => verdictRow({
    schema_version: "agent-bridge-owner-limited-execution-gate-row.v1",
    row_id: `agent.bridge.owner.limited.execution.gate.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    candidate_id: row.candidate_id,
    owner_gate_status: "owner_receipt_required_before_execution",
    owner_approval_observed: false,
    owner_receipt_ref: `owner.receipt.pending.agent_bridge.limited_runtime.${index + 1}`,
    limited_execution_receipt_required: true,
    receipt_scope_required: true,
    receipt_expiry_required: true,
    receipt_revocation_check_required: true,
    execution_allowed_now: false,
    command_executed_now: false,
    command_output_captured_now: false,
    mutation_performed: false,
    authority_effect: "owner_gate_placeholder_only",
    opens_authority: false,
    ...falseAuthorityFlags(),
    next_allowed_action: "owner may approve one harmless local command in a separate receipt lane; this artifact does not approve it",
  }, row.current_verdict === "pass"));
}

function buildProviderAdapterRows(context) {
  const packetRows = context.sourceRequestPacketExport.data?.agent_request_packet_export_rows ?? [];
  return PROVIDER_ADAPTER_SPECS.map((spec, index) => {
    const packet = packetRows.find((row) => row.request_type === spec.packet_match);
    const ready = Boolean(packet?.packet_id);
    return verdictRow({
      schema_version: "agent-bridge-provider-adapter-request-row.v1",
      row_id: `agent.bridge.provider.adapter.request.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: context.generatedAt,
      adapter_id: spec.adapter_id,
      adapter_kind: spec.adapter_kind,
      adapter_title: spec.adapter_title,
      target_runtime_id: spec.target_runtime_id,
      request_type: spec.request_type,
      packet_id: packet?.packet_id ?? null,
      packet_status: packet?.packet_status ?? "missing",
      adapter_request_status: ready ? "request_packet_ready_transport_disabled" : "blocked_missing_request_packet",
      transport_command_template: spec.transport_command_template,
      prompt_body_included: false,
      packet_copy_required: true,
      request_transport_submission_allowed_now: false,
      provider_automation_allowed_now: false,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      receipt_applied: false,
      authority_effect: "adapter_request_projection_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
      next_allowed_action: "copy the redacted request packet and import a normalized receipt; do not let provider output apply authority",
    }, ready);
  });
}

function buildBlockedRuntimeFixtureRows(context) {
  return L9_BLOCKED_COMMAND_FIXTURES.map(([fixtureId, commandText, expectedType], index) => {
    const commandClass = classifyRuntimeCommand(commandText);
    const blocked = commandClass.blocked === true && commandClass.protected_action_type === expectedType;
    return verdictRow({
      schema_version: "agent-bridge-blocked-runtime-command-fixture-row.v1",
      row_id: `agent.bridge.blocked.runtime.command.fixture.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: context.generatedAt,
      fixture_id: fixtureId,
      command_text: commandText,
      command_hash: `sha256:${sha256(commandText)}`,
      expected_protected_action_type: expectedType,
      observed_protected_action_type: commandClass.protected_action_type,
      blocked,
      blocked_reason: commandClass.reason,
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      receipt_applied: false,
      authority_effect: "negative_fixture_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
      next_allowed_action: "remain blocked unless a future protected-action lane explicitly exists",
    }, blocked);
  });
}

function buildPreflightRows(context) {
  const scripts = context.packageJson.data?.scripts ?? {};
  return L10_PREFLIGHT_SPECS.map(([preflightId, commandText, preflightType], index) => {
    const scriptRegistered = commandReferencesRegisteredScript(commandText, scripts);
    return verdictRow({
      schema_version: "agent-bridge-l10-preflight-candidate-row.v1",
      row_id: `agent.bridge.l10.preflight.candidate.row.${String(index + 1).padStart(2, "0")}`,
      generated_at: context.generatedAt,
      preflight_id: preflightId,
      preflight_type: preflightType,
      command_text: commandText,
      package_script_registered: scriptRegistered,
      preflight_status: scriptRegistered ? "candidate_for_manual_preflight" : "blocked_missing_package_script",
      execution_allowed_now: false,
      command_executed_now: false,
      command_output_captured_now: false,
      mutation_performed: false,
      dry_run_only: true,
      authority_effect: "preflight_candidate_only",
      opens_authority: false,
      ...falseAuthorityFlags(),
      next_allowed_action: "run manually outside Desktop when preparing L10 closeout evidence",
    }, scriptRegistered);
  });
}

function buildGateRows({ context, sourceRows, dryRunRows, ownerGateRows, providerRows, blockedRows, preflightRows }) {
  const gates = [
    ["package.script.registered", `${COMMAND_NAME} is registered`, Boolean(context.packageJson.data?.scripts?.[COMMAND_NAME])],
    ["sources.ready", "Execution candidate, request packet export, and runbook sources are ready", sourceRows.every((row) => row.source_ready === true)],
    ["dry_run.rows", "Every execution candidate has a dry-run no-spawn trace", dryRunRows.length >= 13 && dryRunRows.every((row) => row.current_verdict === "pass" && row.command_executed_now === false)],
    ["owner.gates.closed", "Owner limited-execution gates are present and not approved", ownerGateRows.length === dryRunRows.length && ownerGateRows.every((row) => row.owner_approval_observed === false && row.execution_allowed_now === false)],
    ["provider.adapters.projected", "Agbrowse, Claude, and Codex adapter requests are projected with transport closed", providerRows.length === 3 && providerRows.every((row) => row.current_verdict === "pass" && row.request_transport_submission_allowed_now === false)],
    ["blocked.fixtures", "Protected L9 runtime command fixtures are blocked", blockedRows.length >= 14 && blockedRows.every((row) => row.blocked === true)],
    ["l10.preflight.candidates", "L10 preflight candidates are enumerated but not executed", preflightRows.length >= 8 && preflightRows.every((row) => row.current_verdict === "pass" && row.command_executed_now === false)],
    ["authority.closed", "Limited runtime plan does not open execution, transport, receipt, approval, production, enterprise, or protected closeout authority", [...dryRunRows, ...ownerGateRows, ...providerRows, ...blockedRows, ...preflightRows].every(allAuthorityFlagsFalse)],
  ];
  return gates.map(([gateId, description, passed], index) => verdictRow({
    schema_version: "agent-bridge-limited-runtime-gate-row.v1",
    row_id: `agent.bridge.limited.runtime.gate.row.${String(index + 1).padStart(2, "0")}`,
    generated_at: context.generatedAt,
    gate_id: gateId,
    gate_status: passed ? "pass" : "blocked",
    description,
    blocks_limited_runtime_when_failed: true,
    execution_allowed_now: false,
    command_executed_now: false,
    mutation_performed: false,
    authority_effect: "limited_runtime_gate_only",
    opens_authority: false,
    ...falseAuthorityFlags(),
  }, passed));
}

function buildBoundary({ context, sourceRows, dryRunRows, ownerGateRows, providerRows, blockedRows, preflightRows, gateRows }) {
  const contract = buildContract(context);
  const ready = sourceRows.every((row) => row.current_verdict === "pass")
    && dryRunRows.every((row) => row.current_verdict === "pass")
    && ownerGateRows.every((row) => row.current_verdict === "pass")
    && providerRows.every((row) => row.current_verdict === "pass")
    && blockedRows.every((row) => row.current_verdict === "pass")
    && preflightRows.every((row) => row.current_verdict === "pass")
    && gateRows.every((row) => row.current_verdict === "pass");
  const boundary = {
    schema_version: "agent-bridge-limited-runtime-boundary.v1",
    generated_at: context.generatedAt,
    ready_for_l9_dry_run_operator_handoff: ready,
    ready_for_l10_preflight_candidate_handoff: ready,
    ...contract,
  };
  return {
    ...boundary,
    unsafe_flag_count: countUnsafeFlags(boundary),
    source_ready_count: sourceRows.filter((row) => row.source_ready === true).length,
    source_count: sourceRows.length,
    dry_run_executor_count: dryRunRows.length,
    owner_gate_count: ownerGateRows.length,
    provider_adapter_request_count: providerRows.length,
    blocked_runtime_command_fixture_count: blockedRows.length,
    l10_preflight_candidate_count: preflightRows.length,
    gate_pass_count: gateRows.filter((row) => row.current_verdict === "pass").length,
    gate_count: gateRows.length,
  };
}

function buildValidationItems(result) {
  return [
    validationItem("package.script.registered", result.limited_runtime_gate_rows.some((row) => row.gate_id === "package.script.registered" && row.current_verdict === "pass"), `package.json must register ${COMMAND_NAME}`, "package.json"),
    validationItem("sources.ready", result.agent_bridge_limited_runtime_source_rows.every((row) => row.source_ready === true), "Limited runtime source is not ready.", "agent_bridge_limited_runtime_source_rows"),
    validationItem("dry_run.rows", result.dry_run_executor_rows.length >= 13 && result.dry_run_executor_rows.every((row) => row.command_executed_now === false && row.command_output_captured_now === false && row.mutation_performed === false), "Dry-run executor launched or captured command output.", "dry_run_executor_rows"),
    validationItem("owner.gates.closed", result.owner_limited_execution_gate_rows.length === result.dry_run_executor_rows.length && result.owner_limited_execution_gate_rows.every((row) => row.owner_approval_observed === false && row.execution_allowed_now === false), "Owner gate opened execution.", "owner_limited_execution_gate_rows"),
    validationItem("provider.adapters.projected", result.provider_adapter_request_rows.length === 3 && result.provider_adapter_request_rows.every((row) => row.request_transport_submission_allowed_now === false && row.provider_automation_allowed_now === false), "Provider adapter opened transport automation.", "provider_adapter_request_rows"),
    validationItem("blocked.fixtures", result.blocked_runtime_command_fixture_rows.length >= 14 && result.blocked_runtime_command_fixture_rows.every((row) => row.blocked === true), "Protected runtime fixture was not blocked.", "blocked_runtime_command_fixture_rows"),
    validationItem("l10.preflight.candidates", result.l10_preflight_candidate_rows.length >= 8 && result.l10_preflight_candidate_rows.every((row) => row.command_executed_now === false && row.mutation_performed === false), "L10 preflight candidate executed or mutated state.", "l10_preflight_candidate_rows"),
    validationItem("authority.closed", allAuthorityFlagsFalse(result.agent_bridge_limited_runtime_contract) && [result.limited_runtime_boundary, ...result.dry_run_executor_rows, ...result.owner_limited_execution_gate_rows, ...result.provider_adapter_request_rows, ...result.blocked_runtime_command_fixture_rows, ...result.l10_preflight_candidate_rows].every(allAuthorityFlagsFalse), "Limited runtime authority opened.", "limited_runtime_boundary"),
    validationItem("boundary.ready", result.limited_runtime_boundary.ready_for_l9_dry_run_operator_handoff === true && result.limited_runtime_boundary.unsafe_flag_count === 0, "Limited runtime boundary is not ready.", "limited_runtime_boundary"),
    validationItem("gates.pass", result.limited_runtime_gate_rows.every((row) => row.current_verdict === "pass"), "Limited runtime gate row blocked.", "limited_runtime_gate_rows"),
  ];
}

function buildSummary(result) {
  const validation = result.validation ?? summarizeValidation([]);
  return {
    schema_version: "agent-bridge-limited-runtime-plan-summary.v1",
    agent_bridge_limited_runtime_plan_status: validation.valid && result.limited_runtime_boundary?.ready_for_l9_dry_run_operator_handoff ? READY_STATUS : BLOCKED_STATUS,
    program_range: PROGRAM_RANGE,
    source_agent_bridge_execution_candidate_status: result.source_agent_bridge_execution_candidate_summary?.agent_bridge_execution_candidate_status ?? "missing",
    source_agent_bridge_request_packet_export_status: result.source_agent_bridge_request_packet_export_summary?.agent_bridge_request_packet_export_status ?? "missing",
    source_ready_count: result.limited_runtime_boundary?.source_ready_count ?? 0,
    source_count: result.limited_runtime_boundary?.source_count ?? 0,
    dry_run_executor_count: result.limited_runtime_boundary?.dry_run_executor_count ?? 0,
    owner_gate_count: result.limited_runtime_boundary?.owner_gate_count ?? 0,
    provider_adapter_request_count: result.limited_runtime_boundary?.provider_adapter_request_count ?? 0,
    blocked_runtime_command_fixture_count: result.limited_runtime_boundary?.blocked_runtime_command_fixture_count ?? 0,
    l10_preflight_candidate_count: result.limited_runtime_boundary?.l10_preflight_candidate_count ?? 0,
    gate_pass_count: result.limited_runtime_boundary?.gate_pass_count ?? 0,
    gate_count: result.limited_runtime_boundary?.gate_count ?? 0,
    dry_run_executor_enabled_now: result.limited_runtime_boundary?.dry_run_executor_enabled_now === true,
    owner_limited_execution_gate_enabled_now: result.limited_runtime_boundary?.owner_limited_execution_gate_enabled_now === true,
    provider_adapter_request_projection_enabled_now: result.limited_runtime_boundary?.provider_adapter_request_projection_enabled_now === true,
    l10_preflight_candidate_enabled_now: result.limited_runtime_boundary?.l10_preflight_candidate_enabled_now === true,
    execution_allowed_now: false,
    command_executed_now: false,
    command_output_captured_now: false,
    mutation_performed: false,
    dry_run_only: true,
    owner_approval_observed: false,
    human_receipt_required_before_execution: true,
    limited_execution_receipt_required: true,
    request_transport_submission_allowed_now: false,
    provider_automation_allowed_now: false,
    receipt_application_allowed_now: false,
    approval_application_allowed_now: false,
    provider_output_authoritative: false,
    local_only: true,
    read_only: true,
    source_of_truth: false,
    ...falseAuthorityFlags(),
    unsafe_flag_count: result.limited_runtime_boundary?.unsafe_flag_count ?? 0,
    validation_error_count: validation.errors.length,
  };
}

async function resolveExecutionCandidate(options, inputs, generatedAt) {
  if (options.sourceAgentBridgeExecutionCandidate) return normalizeInlineJsonSource("inline.agent_bridge_execution_candidate", options.sourceAgentBridgeExecutionCandidate);
  const source = await readJsonSource(inputs.source_agent_bridge_execution_candidate_path);
  if (source.available && source.data?.schema_version === "agent-bridge-execution-candidate.v1") return source;
  const built = await buildAgentBridgeExecutionCandidate({ runAt: generatedAt, packagePath: inputs.package_path, write: false });
  return normalizeInlineJsonSource("built.agent_bridge_execution_candidate", built);
}

async function resolveRequestPacketExport(options, inputs, generatedAt) {
  if (options.sourceAgentBridgeRequestPacketExport) return normalizeInlineJsonSource("inline.agent_bridge_request_packet_export", options.sourceAgentBridgeRequestPacketExport);
  const source = await readJsonSource(inputs.source_agent_bridge_request_packet_export_path);
  if (source.available && source.data?.schema_version === "agent-bridge-request-packet-export.v1") return source;
  const built = await buildAgentBridgeRequestPacketExport({ runAt: generatedAt, packagePath: inputs.package_path, write: false });
  return normalizeInlineJsonSource("built.agent_bridge_request_packet_export", built);
}

function classifyRuntimeCommand(command) {
  const protectedClass = classifyProtectedCommand(command);
  if (protectedClass.blocked) return protectedClass;
  const normalized = normalizeCommand(command);
  if (/\bnpm\s+publish\b|\bgh\s+release\b|\bgit\s+tag\b|\bnpm\s+version\b/.test(normalized)) {
    return { blocked: true, protected_action_type: "deploy", reason: "Release, publish, or tag command is protected." };
  }
  if (/\bgh\s+pr\s+merge\b|\bgit\s+merge\b/.test(normalized)) {
    return { blocked: true, protected_action_type: "git_merge", reason: "Merge command is protected." };
  }
  if (/\bapply_patch\b|--apply\b|apply-receipt/.test(normalized)) {
    return { blocked: true, protected_action_type: "apply_patch_or_receipt", reason: "Patch or receipt application is protected." };
  }
  if (/\.env|\.ssh|token|credential|secret|keychain/.test(normalized)) {
    return { blocked: true, protected_action_type: "secret_read", reason: "Secret-like source access is blocked." };
  }
  if (/raw-output|raw-transcript|transcript/.test(normalized)) {
    return { blocked: true, protected_action_type: "raw_source_exposure", reason: "Raw transcript or raw provider output access is blocked." };
  }
  if (/\bsudo\b|\brm\s+-rf\b|\bchmod\b|\bchown\b/.test(normalized)) {
    return { blocked: true, protected_action_type: "destructive_delete", reason: "Destructive filesystem or privilege command is blocked." };
  }
  return protectedClass;
}

export function parseAgentBridgeLimitedRuntimePlanArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--out-dir") {
      args.outDir = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--schema-path") {
      args.schemaPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--package-path") {
      args.packagePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-execution-candidate-path") {
      args.sourceAgentBridgeExecutionCandidatePath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--source-agent-bridge-request-packet-export-path") {
      args.sourceAgentBridgeRequestPacketExportPath = readArgValue(argv, index, arg);
      index += 1;
    } else if (arg === "--runbook-path") {
      args.runbookPath = readArgValue(argv, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function normalizeInputs(options) {
  const defaults = DEFAULT_AGENT_BRIDGE_LIMITED_RUNTIME_PLAN_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    source_agent_bridge_execution_candidate_path: options.sourceAgentBridgeExecutionCandidatePath ?? defaults.sourceAgentBridgeExecutionCandidatePath,
    source_agent_bridge_request_packet_export_path: options.sourceAgentBridgeRequestPacketExportPath ?? defaults.sourceAgentBridgeRequestPacketExportPath,
    runbook_path: options.runbookPath ?? defaults.runbookPath,
  };
}

function commandReferencesRegisteredScript(command, scripts) {
  const match = /^npm run ([^ ]+)/.exec(normalizeCommand(command));
  if (!match) return true;
  return Object.prototype.hasOwnProperty.call(scripts, match[1]);
}

function readArgValue(argv, index, arg) {
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
  return value;
}

function printHelp() {
  console.log(`Usage: npm run ${COMMAND_NAME} -- [--check] [--out-dir DIR] [--source-agent-bridge-execution-candidate-path PATH] [--source-agent-bridge-request-packet-export-path PATH]`);
}

async function readJsonSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    try {
      const data = JSON.parse(text);
      return { available: true, path: filePath, resolved_path: resolvedPath, text, data, parse_status: "parsed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
    } catch (error) {
      return { available: false, path: filePath, resolved_path: resolvedPath, text, data: null, parse_status: "malformed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: error.message };
    }
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", data: null, parse_status: "missing", content_hash: null, error: error.message };
  }
}

async function readTextSource(filePath) {
  const resolvedPath = path.resolve(filePath);
  try {
    const text = await readFile(resolvedPath, "utf8");
    return { available: true, path: filePath, resolved_path: resolvedPath, text, parse_status: "parsed", content_hash: `sha256:${createHash("sha256").update(text).digest("hex")}`, error: null };
  } catch (error) {
    return { available: false, path: filePath, resolved_path: resolvedPath, text: "", parse_status: "missing", content_hash: null, error: error.message };
  }
}

function normalizeInlineJsonSource(pathLabel, data) {
  return { available: true, path: pathLabel, data, text: JSON.stringify(data), parse_status: "parsed", content_hash: `sha256:${sha256(data)}`, error: null };
}

function normalizeCommand(command) {
  return String(command ?? "").trim().replace(/\s+/g, " ");
}

function falseAuthorityFlags() {
  return Object.fromEntries(AUTHORITY_FLAGS.map((flag) => [flag, false]));
}

function allAuthorityFlagsFalse(value) {
  return AUTHORITY_FLAGS.every((flag) => value?.[flag] === false);
}

function countUnsafeFlags(value) {
  return AUTHORITY_FLAGS.reduce((sum, flag) => sum + (value?.[flag] === true ? 1 : 0), 0);
}

function verdictRow(row, pass) {
  return {
    ...row,
    current_verdict: pass ? "pass" : "blocked",
    unsafe_flags_false: pass,
    verdict_authority: "harness_deterministic_validator",
  };
}

function validationItem(pathValue, passed, message, evidenceRef = pathValue) {
  return {
    schema_version: "agent-bridge-limited-runtime-plan-validation-item.v1",
    path: pathValue,
    check_id: pathValue,
    status: passed ? "passed" : "failed",
    message: passed ? "ok" : message,
    evidence_ref: evidenceRef,
  };
}

function summarizeValidation(items) {
  const errors = items.filter((item) => item.status !== "passed").map((item) => ({ path: item.path, message: item.message, evidence_ref: item.evidence_ref }));
  return { valid: errors.length === 0, item_count: items.length, error_count: errors.length, errors };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, [`${key}_count`]: rows.length, [key]: rows };
}

function renderMarkdown(result) {
  return [
    "# Agent Bridge Limited Runtime Plan",
    "",
    `- Status: ${result.summary.agent_bridge_limited_runtime_plan_status}`,
    `- Program: ${result.program_range}`,
    `- Sources: ${result.summary.source_ready_count}/${result.summary.source_count}`,
    `- Dry-run executor rows: ${result.summary.dry_run_executor_count}`,
    `- Owner gates: ${result.summary.owner_gate_count}`,
    `- Provider adapter requests: ${result.summary.provider_adapter_request_count}`,
    `- Blocked runtime fixtures: ${result.summary.blocked_runtime_command_fixture_count}`,
    `- L10 preflight candidates: ${result.summary.l10_preflight_candidate_count}`,
    `- Gates: ${result.summary.gate_pass_count}/${result.summary.gate_count}`,
    `- Execution allowed now: ${result.summary.execution_allowed_now}`,
    `- Command executed now: ${result.summary.command_executed_now}`,
    `- Request transport submission allowed now: ${result.summary.request_transport_submission_allowed_now}`,
    `- Production PASS enabled: ${result.summary.production_pass_enabled}`,
    `- Enterprise PASS enabled: ${result.summary.enterprise_pass_enabled}`,
    `- Protected closeout enabled: ${result.summary.protected_closeout_enabled}`,
    `- Validation errors: ${result.summary.validation_error_count}`,
    "",
    "This artifact creates dry-run traces, provider request projections, owner-gate placeholders, and L10 preflight candidates only. It does not execute commands, submit prompts, capture command output, apply receipts, approve work, deploy, publish, create production PASS, create enterprise PASS, or complete protected closeout.",
    "",
  ].join("\n");
}

function writeJson(filePath, value) {
  return writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
}
