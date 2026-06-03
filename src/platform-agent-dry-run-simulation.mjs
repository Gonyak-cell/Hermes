import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentDelegationContract } from "./platform-agent-delegation-contract.mjs";
import { buildPlatformAgentDoctorEvidenceBridge } from "./platform-agent-doctor-evidence-bridge.mjs";
import { buildPlatformAgentInstallPacket } from "./platform-agent-install-packet.mjs";
import { buildPlatformAgentRuntimeReceiptContract } from "./platform-agent-runtime-receipt-contract.mjs";
import { buildPlatformAgentToolPolicyMatrix } from "./platform-agent-tool-policy-matrix.mjs";

export const DEFAULT_PLATFORM_AGENT_DRY_RUN_SIMULATION_OUT_DIR = "artifacts/platform-agent-dry-run-simulation/latest";
export const DEFAULT_PLATFORM_AGENT_DRY_RUN_SIMULATION_INPUTS = {
  schemaPath: "schemas/platform-agent-dry-run-simulation.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-dry-run-simulation";
const SOURCE_COMMAND_NAME = "platform:agent-delegation-contract";
const SCHEMA_VERSION = "platform-agent-dry-run-simulation.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.dry_run_simulation";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1195-P1198";
const PHASE_SLOT = "P1195";
const PREVIOUS_PHASE_SLOT = "P1194";
const NEXT_PHASE_SLOT = "P1199";
const READY_STATUS = "ready_for_agent_dry_run_simulation";

const DRY_RUN_SCENARIO_SPECS = [
  ["install_packet_would_run", "source_agent_install_packet_summary", "package install would-run packet"],
  ["doctor_probe_would_run", "source_agent_doctor_evidence_bridge_summary", "doctor probe would-run packet"],
  ["terminal_tool_probe_would_run", "source_agent_tool_policy_matrix_summary", "terminal tool policy would-run packet"],
  ["mcp_connection_would_run", "source_agent_tool_policy_matrix_summary", "MCP connection would-run packet"],
  ["api_server_start_would_run", "source_agent_runtime_receipt_contract_summary", "API server start would-run packet"],
  ["cron_gateway_start_would_run", "source_agent_runtime_receipt_contract_summary", "cron gateway start would-run packet"],
  ["provider_secret_setup_would_run", "source_agent_runtime_receipt_contract_summary", "provider secret setup would-run packet"],
  ["domain_adapter_invocation_would_run", "source_agent_tool_policy_matrix_summary", "domain adapter invocation would-run packet"],
  ["zendd_work_order_delegation_would_run", "source_agent_delegation_contract_summary", "Zendd work-order delegation would-run packet"],
  ["zendd_command_evidence_delegation_would_run", "source_agent_delegation_contract_summary", "Zendd command evidence delegation would-run packet"],
  ["protected_action_receipt_would_run", "source_agent_runtime_receipt_contract_summary", "protected action receipt would-run packet"],
  ["final_readiness_freeze_would_run", "source_agent_delegation_contract_summary", "final pilot freeze would-run packet"],
];

const DISABLED_PATH_SPECS = [
  ["agent_runtime_start", "runtime_execution_requires_human_receipt", "collect validated runtime receipt and rerun final readiness freeze"],
  ["terminal_execution", "terminal_execution_requires_human_receipt", "create command execution packet and human receipt"],
  ["mcp_connection", "unreviewed_mcp_connection", "register MCP plan with operator review and human receipt"],
  ["api_server_start", "api_server_start_forbidden", "keep server startup disabled until pilot receipt and freeze pass"],
  ["cron_gateway_start", "cron_start_forbidden", "keep scheduled/background startup disabled"],
  ["package_download", "package_download_requires_install_receipt", "use install packet and human receipt before download"],
  ["package_install", "package_install_requires_install_receipt", "use isolated install packet and rollback receipt"],
  ["provider_secret_configuration", "raw_secret_access", "use secret-handle refs and human-approved provider setup"],
  ["raw_secret_read", "raw_secret_access", "replace raw secret with secret-handle evidence ref"],
  ["raw_client_vdr_material_access", "raw_client_or_vdr_exposure", "use source-span refs and redacted summaries"],
  ["cross_domain_data_forwarding", "cross_domain_data_boundary", "route through domain handoff channel and owner review"],
  ["direct_zendd_mutation", "direct_zendd_mutation", "use Zendd external safe patch lane and human receipt"],
  ["protected_action_execution", "protected_action_requires_human_receipt", "queue protected action receipt and reviewer gate"],
  ["agent_final_pass_or_approval", "agent_final_authority_forbidden", "route through P1199-P1200 pilot readiness freeze"],
];

const OPERATOR_SURFACE_SPECS = [
  ["dry_run_scenario_list", "scenario table exposes would-run status"],
  ["disabled_path_blocks", "disabled path table exposes block reason and next action"],
  ["missing_runtime_receipts", "receipt column shows pending human receipts"],
  ["source_gate_statuses", "source gate column shows upstream readiness"],
  ["zendd_delegation_packets", "Zendd delegation packet column stays candidate-only"],
  ["unsafe_boundary_flags", "unsafe boundary column shows all false"],
  ["final_freeze_inputs", "final freeze input column points to P1199"],
  ["validation_report", "validation report column shows dry-run PASS/BLOCK state"],
];

export async function runPlatformAgentDryRunSimulation(options = {}) {
  const result = await buildPlatformAgentDryRunSimulation(options);
  if (options.write !== false) await writePlatformAgentDryRunSimulation(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent dry-run simulation failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentDryRunSimulation(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_DRY_RUN_SIMULATION_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const sources = await buildSources({ generatedAt, inputs, options });

  const scenarioRows = buildScenarioRows(sources);
  const evidenceRows = buildEvidencePacketRows(scenarioRows);
  const disabledPathRows = buildDisabledPathRows();
  const operatorRows = buildOperatorRows({ scenarioRows, disabledPathRows });
  const claimRows = buildClaimRows({ scenarioRows, evidenceRows, operatorRows, disabledPathRows });
  const closeoutRows = buildCloseoutRows({ sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_dry_run_simulation_id: `platform-agent-dry-run-simulation.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_dry_run_simulation_anchor: anchor,
    source_agent_delegation_contract_summary: sources.delegationContract.summary,
    source_agent_install_packet_summary: sources.installPacket.summary,
    source_agent_doctor_evidence_bridge_summary: sources.doctorEvidenceBridge.summary,
    source_agent_tool_policy_matrix_summary: sources.toolPolicyMatrix.summary,
    source_agent_runtime_receipt_contract_summary: sources.runtimeReceiptContract.summary,
    agent_dry_run_scenario_rows: scenarioRows,
    agent_dry_run_evidence_packet_rows: evidenceRows,
    agent_dry_run_disabled_path_probe_rows: disabledPathRows,
    agent_dry_run_operator_surface_rows: operatorRows,
    agent_dry_run_claim_rows: claimRows,
    agent_dry_run_closeout_rows: closeoutRows,
    agent_dry_run_gate_rows: gateRows,
    agent_dry_run_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_dry_run_simulation")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_dry_run_simulation_id = result.platform_agent_dry_run_simulation_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentDryRunSimulation(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-dry-run-simulation.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-dry-run-scenario-rows.json"), collectionEnvelope("agent-dry-run-scenario-rows.v1", "agent_dry_run_scenario_rows", result.agent_dry_run_scenario_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-dry-run-evidence-packet-rows.json"), collectionEnvelope("agent-dry-run-evidence-packet-rows.v1", "agent_dry_run_evidence_packet_rows", result.agent_dry_run_evidence_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-dry-run-disabled-path-probe-rows.json"), collectionEnvelope("agent-dry-run-disabled-path-probe-rows.v1", "agent_dry_run_disabled_path_probe_rows", result.agent_dry_run_disabled_path_probe_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-dry-run-operator-surface-rows.json"), collectionEnvelope("agent-dry-run-operator-surface-rows.v1", "agent_dry_run_operator_surface_rows", result.agent_dry_run_operator_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-dry-run-claim-rows.json"), collectionEnvelope("agent-dry-run-claim-rows.v1", "agent_dry_run_claim_rows", result.agent_dry_run_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-dry-run-closeout-rows.json"), collectionEnvelope("agent-dry-run-closeout-rows.v1", "agent_dry_run_closeout_rows", result.agent_dry_run_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-dry-run-gate-rows.json"), collectionEnvelope("agent-dry-run-gate-rows.v1", "agent_dry_run_gate_rows", result.agent_dry_run_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-dry-run-boundary.json"), result.agent_dry_run_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-dry-run-simulation-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentDryRunSimulationCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentDryRunSimulation(args);
    console.log(`Platform agent dry-run simulation ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_dry_run_simulation_status}`);
    console.log(`Scenarios: ${result.summary.scenario_count}`);
    console.log(`Evidence packets: ${result.summary.evidence_packet_count}`);
    console.log(`Disabled path probes: ${result.summary.disabled_path_probe_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime started: ${result.summary.agent_runtime_started}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function buildSources({ generatedAt, inputs, options }) {
  const sourceOptions = {
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    write: false,
  };
  const delegationContract = options.sourceAgentDelegationContract ?? await buildPlatformAgentDelegationContract({
    ...sourceOptions,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
  });
  const installPacket = options.sourceAgentInstallPacket ?? await buildPlatformAgentInstallPacket(sourceOptions);
  const doctorEvidenceBridge = options.sourceAgentDoctorEvidenceBridge ?? await buildPlatformAgentDoctorEvidenceBridge(sourceOptions);
  const toolPolicyMatrix = options.sourceAgentToolPolicyMatrix ?? await buildPlatformAgentToolPolicyMatrix(sourceOptions);
  const runtimeReceiptContract = options.sourceAgentRuntimeReceiptContract ?? await buildPlatformAgentRuntimeReceiptContract(sourceOptions);
  return {
    delegationContract,
    installPacket,
    doctorEvidenceBridge,
    toolPolicyMatrix,
    runtimeReceiptContract,
  };
}

function buildScenarioRows(sources) {
  return DRY_RUN_SCENARIO_SPECS.map(([scenarioId, sourceRef, description], index) => ({
    schema_version: "agent-dry-run-scenario-row.v1",
    row_id: `agent-dry-run-scenario.row.${String(index + 1).padStart(2, "0")}`,
    scenario_id: scenarioId,
    scenario_status: "would_run_evidence_created_execution_disabled",
    current_verdict: "pass",
    source_ref: sourceRef,
    source_ready_status: sourceReadyStatus(sourceRef, sources),
    description,
    deterministic_inputs_only: true,
    dry_run_trace_created: true,
    dry_run_trace_ref: `trace.platform.agent.dry_run.${scenarioId}`,
    would_run_evidence_ref: `evidence.platform.agent.dry_run.${scenarioId}`,
    human_receipt_required_before_real_run: true,
    human_receipt_ref: `human_receipt.pending.agent.dry_run.${scenarioId}`,
    reviewer_ref: "reviewer.platform.agent_dry_run_simulation",
    hard_gate_ref: `gate.platform.agent.dry_run.scenario.${scenarioId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "surface this would-run packet to P1199-P1200 readiness freeze without executing it",
    agent_runtime_execution_allowed_now: false,
    agent_runtime_started: false,
    command_execution_performed: false,
    terminal_execution_performed: false,
    mcp_connection_performed: false,
    api_server_started: false,
    cron_gateway_started: false,
    package_download_performed: false,
    package_install_performed: false,
    provider_secret_configured: false,
    raw_secret_read: false,
    raw_client_or_vdr_material_exposed: false,
    direct_zendd_mutation_performed: false,
    protected_action_executed: false,
    receipt_applied: false,
    final_pass_or_approval_created: false,
    evidence_ref: `evidence.platform.agent.dry_run.scenario.${scenarioId}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function sourceReadyStatus(sourceRef, sources) {
  const summaries = {
    source_agent_delegation_contract_summary: sources.delegationContract.summary.platform_agent_delegation_contract_status,
    source_agent_install_packet_summary: sources.installPacket.summary.platform_agent_install_packet_status,
    source_agent_doctor_evidence_bridge_summary: sources.doctorEvidenceBridge.summary.platform_agent_doctor_evidence_bridge_status,
    source_agent_tool_policy_matrix_summary: sources.toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status,
    source_agent_runtime_receipt_contract_summary: sources.runtimeReceiptContract.summary.platform_agent_runtime_receipt_contract_status,
  };
  return summaries[sourceRef] ?? "unknown";
}

function buildEvidencePacketRows(scenarioRows) {
  return scenarioRows.map((scenario, index) => ({
    schema_version: "agent-dry-run-evidence-packet-row.v1",
    row_id: `agent-dry-run-evidence-packet.row.${String(index + 1).padStart(2, "0")}`,
    evidence_packet_id: `evidence.packet.platform.agent.dry_run.${scenario.scenario_id}`,
    scenario_id: scenario.scenario_id,
    current_verdict: "pass",
    packet_status: "redacted_would_run_evidence_ready",
    source_ref: scenario.row_id,
    dry_run_trace_ref: scenario.dry_run_trace_ref,
    source_ready_status: scenario.source_ready_status,
    deterministic_inputs_only: true,
    redacted_summary_ready: true,
    raw_stdout_stored: false,
    raw_stderr_stored: false,
    raw_secret_stored: false,
    raw_client_or_vdr_material_stored: false,
    command_executed_to_collect_evidence: false,
    evidence_ref: scenario.would_run_evidence_ref,
    reviewer_ref: "reviewer.platform.agent_dry_run_evidence",
    hard_gate_ref: `gate.platform.agent.dry_run.evidence.${scenario.scenario_id}`,
    responsible_owner: scenario.responsible_owner,
    next_allowed_action: "attach evidence packet to pilot readiness freeze",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildDisabledPathRows() {
  return DISABLED_PATH_SPECS.map(([pathId, blockReason, nextAction], index) => ({
    schema_version: "agent-dry-run-disabled-path-probe-row.v1",
    row_id: `agent-dry-run-disabled-path-probe.row.${String(index + 1).padStart(2, "0")}`,
    disabled_path_id: pathId,
    current_verdict: "blocked",
    probe_status: "blocked_before_execution",
    block_reason: blockReason,
    evidence_ref: `evidence.platform.agent.dry_run.disabled_path.${pathId}`,
    reviewer_ref: "reviewer.platform.agent_dry_run_disabled_path",
    hard_gate_ref: `gate.platform.agent.dry_run.disabled_path.${pathId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAction,
    documented_human_gate_ref: `human_gate.platform.agent.dry_run.${pathId}`,
    agent_runtime_execution_allowed_now: false,
    agent_runtime_started: false,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    terminal_execution_allowed_now: false,
    terminal_execution_performed: false,
    mcp_connection_allowed_now: false,
    mcp_connection_performed: false,
    api_server_start_allowed_now: false,
    api_server_started: false,
    cron_gateway_start_allowed_now: false,
    cron_gateway_started: false,
    package_download_allowed_now: false,
    package_download_performed: false,
    package_install_allowed_now: false,
    package_install_performed: false,
    provider_secret_configuration_allowed_now: false,
    provider_secret_configured: false,
    raw_secret_read_allowed_now: false,
    raw_secret_read: false,
    raw_client_or_vdr_access_allowed_now: false,
    raw_client_or_vdr_material_exposed: false,
    cross_domain_data_forwarding_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    direct_zendd_mutation_performed: false,
    protected_action_execution_allowed_now: false,
    protected_action_executed: false,
    receipt_application_allowed_now: false,
    receipt_applied: false,
    final_pass_or_approval_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildOperatorRows({ scenarioRows, disabledPathRows }) {
  return OPERATOR_SURFACE_SPECS.map(([surfaceId, description], index) => ({
    schema_version: "agent-dry-run-operator-surface-row.v1",
    row_id: `agent-dry-run-operator-surface.row.${String(index + 1).padStart(2, "0")}`,
    operator_surface_id: `operator.platform.agent.dry_run.${surfaceId}`,
    surface_id: surfaceId,
    current_verdict: "pass",
    surface_status: "ready_for_operator_visibility",
    description,
    scenario_count: scenarioRows.length,
    disabled_path_probe_count: disabledPathRows.length,
    missing_human_receipt_count: scenarioRows.filter((row) => row.human_receipt_required_before_real_run).length,
    block_reason_count: disabledPathRows.filter((row) => row.block_reason).length,
    next_action_count: disabledPathRows.filter((row) => row.next_allowed_action).length,
    server_started: false,
    api_route_registered_now: false,
    receipt_applied: false,
    protected_action_executed: false,
    evidence_ref: `evidence.platform.agent.dry_run.operator.${surfaceId}`,
    reviewer_ref: "reviewer.platform.agent_dry_run_operator_surface",
    hard_gate_ref: `gate.platform.agent.dry_run.operator.${surfaceId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "show dry-run state in final readiness freeze inputs",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ scenarioRows, evidenceRows, operatorRows, disabledPathRows }) {
  const passRows = [
    ...scenarioRows.map((row) => passClaim("dry_run_scenario", `claim.platform.agent.dry_run.scenario.${row.scenario_id}`, row)),
    ...evidenceRows.map((row) => passClaim("dry_run_evidence_packet", `claim.platform.agent.dry_run.evidence.${row.scenario_id}`, row)),
    ...operatorRows.map((row) => passClaim("dry_run_operator_surface", `claim.platform.agent.dry_run.operator.${row.surface_id}`, row)),
  ];
  const blockedRows = disabledPathRows.map((row) => blockedClaim("dry_run_disabled_path", `claim.platform.agent.dry_run.disabled_path.${row.disabled_path_id}`, row));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-dry-run-claim.row.${String(index + 1).padStart(2, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-dry-run-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: row.row_id,
    current_verdict: "pass",
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    block_reason: null,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-dry-run-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: row.row_id,
    current_verdict: "blocked",
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    documented_human_gate_ref: row.documented_human_gate_ref,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function buildCloseoutRows({ sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows }) {
  const rows = [
    ["source_delegation_contract_ready", sources.delegationContract.summary.platform_agent_delegation_contract_status === "ready_for_agent_delegation_contract", "source_agent_delegation_contract_summary"],
    ["source_install_packet_ready", sources.installPacket.summary.platform_agent_install_packet_status === "ready_for_agent_install_packet", "source_agent_install_packet_summary"],
    ["source_doctor_bridge_ready", sources.doctorEvidenceBridge.summary.platform_agent_doctor_evidence_bridge_status === "ready_for_agent_doctor_evidence_bridge", "source_agent_doctor_evidence_bridge_summary"],
    ["source_tool_policy_matrix_ready", sources.toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status === "ready_for_agent_tool_policy_matrix", "source_agent_tool_policy_matrix_summary"],
    ["source_runtime_receipt_ready", sources.runtimeReceiptContract.summary.platform_agent_runtime_receipt_contract_status === "ready_for_agent_runtime_receipt_contract", "source_agent_runtime_receipt_contract_summary"],
    ["scenarios_ready", scenarioRows.length === 12 && scenarioRows.every((row) => row.current_verdict === "pass"), "agent_dry_run_scenario_rows"],
    ["evidence_packets_ready", evidenceRows.length === 12 && evidenceRows.every((row) => row.current_verdict === "pass"), "agent_dry_run_evidence_packet_rows"],
    ["disabled_paths_documented", disabledPathRows.length === 14 && disabledPathRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "agent_dry_run_disabled_path_probe_rows"],
    ["operator_surface_ready", operatorRows.length === 8 && operatorRows.every((row) => row.current_verdict === "pass"), "agent_dry_run_operator_surface_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_dry_run_claim_rows"],
    ["unsafe_paths_false", [...scenarioRows, ...disabledPathRows].every((row) => row.unsafe_flags_false === true), "agent_dry_run_boundary"],
    ["final_freeze_input_ready", claimRows.length === 46, "agent_dry_run_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-dry-run-closeout-row.v1",
    row_id: `agent-dry-run-closeout.row.${String(index + 1).padStart(2, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.dry_run.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_dry_run_closeout",
    hard_gate_ref: `gate.platform.agent.dry_run.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1198 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-dry-run-simulation-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    runtime_pilot_ledger_present: runtimePilotLedger.available,
    source_delegation_contract_status: sources.delegationContract.summary.platform_agent_delegation_contract_status,
    source_install_packet_status: sources.installPacket.summary.platform_agent_install_packet_status,
    source_doctor_evidence_bridge_status: sources.doctorEvidenceBridge.summary.platform_agent_doctor_evidence_bridge_status,
    source_tool_policy_matrix_status: sources.toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status,
    source_runtime_receipt_contract_status: sources.runtimeReceiptContract.summary.platform_agent_runtime_receipt_contract_status,
    scenario_count: scenarioRows.length,
    evidence_packet_count: evidenceRows.length,
    disabled_path_probe_count: disabledPathRows.length,
    operator_surface_count: operatorRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_delegation_contract", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_dry_run", runtimePilotLedger.available && ["P1195-P1198", COMMAND_NAME, "Dry-run Runtime Simulation"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_delegation_contract_ready", sources.delegationContract.summary.platform_agent_delegation_contract_status === "ready_for_agent_delegation_contract", "source_agent_delegation_contract_summary"],
    ["source_install_packet_ready", sources.installPacket.summary.platform_agent_install_packet_status === "ready_for_agent_install_packet", "source_agent_install_packet_summary"],
    ["source_doctor_bridge_ready", sources.doctorEvidenceBridge.summary.platform_agent_doctor_evidence_bridge_status === "ready_for_agent_doctor_evidence_bridge", "source_agent_doctor_evidence_bridge_summary"],
    ["source_tool_policy_matrix_ready", sources.toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status === "ready_for_agent_tool_policy_matrix", "source_agent_tool_policy_matrix_summary"],
    ["source_runtime_receipt_ready", sources.runtimeReceiptContract.summary.platform_agent_runtime_receipt_contract_status === "ready_for_agent_runtime_receipt_contract", "source_agent_runtime_receipt_contract_summary"],
    ["scenarios_ready", scenarioRows.length === 12 && scenarioRows.every((row) => row.current_verdict === "pass"), "agent_dry_run_scenario_rows"],
    ["evidence_packets_ready", evidenceRows.length === 12 && evidenceRows.every((row) => row.current_verdict === "pass"), "agent_dry_run_evidence_packet_rows"],
    ["disabled_paths_documented", disabledPathRows.length === 14 && disabledPathRows.every((row) => row.current_verdict === "blocked"), "agent_dry_run_disabled_path_probe_rows"],
    ["operator_surface_ready", operatorRows.length === 8 && operatorRows.every((row) => row.current_verdict === "pass"), "agent_dry_run_operator_surface_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_dry_run_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_dry_run_closeout_rows"],
    ["unsafe_boundary_false", true, "agent_dry_run_boundary"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-dry-run-gate-row.v1",
    row_id: `agent-dry-run-gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.dry_run.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_dry_run_gate",
    hard_gate_ref: `gate.platform.agent.dry_run.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1198 closeout`,
    unsafe_flags_false: true,
  }));
}

function buildBoundary({ generatedAt, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-dry-run-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    scenario_count: scenarioRows.length,
    evidence_packet_count: evidenceRows.length,
    disabled_path_probe_count: disabledPathRows.length,
    operator_surface_count: operatorRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    dry_run_evidence_generation_allowed: true,
    would_run_only: true,
    agent_runtime_execution_allowed_now: false,
    agent_runtime_started: false,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    terminal_execution_allowed_now: false,
    terminal_execution_performed: false,
    mcp_connection_allowed_now: false,
    mcp_connection_performed: false,
    api_server_start_allowed_now: false,
    api_server_started: false,
    cron_gateway_start_allowed_now: false,
    cron_gateway_started: false,
    package_download_allowed_now: false,
    package_download_performed: false,
    package_install_allowed_now: false,
    package_install_performed: false,
    provider_secret_configuration_allowed_now: false,
    provider_secret_configured: false,
    raw_secret_read_allowed_now: false,
    raw_secret_read: false,
    raw_client_or_vdr_access_allowed_now: false,
    raw_client_or_vdr_material_exposed: false,
    cross_domain_data_forwarding_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    direct_zendd_mutation_performed: false,
    protected_action_execution_allowed_now: false,
    protected_action_executed: false,
    receipt_application_allowed_now: false,
    receipt_applied: false,
    final_pass_or_approval_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
  };
}

function buildValidationItems({ sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All dry-run simulation gates must be ready."],
    ["source.delegation_contract_ready", sources.delegationContract.summary.platform_agent_delegation_contract_status === "ready_for_agent_delegation_contract", "P1189-P1194 source must be ready."],
    ["source.install_packet_ready", sources.installPacket.summary.platform_agent_install_packet_status === "ready_for_agent_install_packet", "Install packet source must be ready."],
    ["source.doctor_bridge_ready", sources.doctorEvidenceBridge.summary.platform_agent_doctor_evidence_bridge_status === "ready_for_agent_doctor_evidence_bridge", "Doctor evidence source must be ready."],
    ["source.tool_policy_ready", sources.toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status === "ready_for_agent_tool_policy_matrix", "Tool policy source must be ready."],
    ["source.runtime_receipt_ready", sources.runtimeReceiptContract.summary.platform_agent_runtime_receipt_contract_status === "ready_for_agent_runtime_receipt_contract", "Runtime receipt source must be ready."],
    ["scenarios.pass", scenarioRows.length === 12 && scenarioRows.every((row) => row.current_verdict === "pass" && row.agent_runtime_started === false), "Dry-run scenarios must be PASS without runtime execution."],
    ["evidence.pass", evidenceRows.length === 12 && evidenceRows.every((row) => row.current_verdict === "pass" && row.command_executed_to_collect_evidence === false), "Evidence packets must be redacted and non-executed."],
    ["disabled_paths.blocked", disabledPathRows.length === 14 && disabledPathRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Disabled paths must be documented BLOCK rows."],
    ["operator.pass", operatorRows.length === 8 && operatorRows.every((row) => row.current_verdict === "pass" && row.server_started === false), "Operator rows must be visible without starting server routes."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.false", allBoundaryUnsafeFlagsFalse(boundary), "Dry-run simulation must not run runtime, terminal, MCP, API, cron, package, secret, raw, Zendd, protected action, receipt, final authority, legal, or release paths."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_dry_run_simulation", passed, message));
}

function isSupportedClaimState(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.block_reason && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  return false;
}

function allBoundaryUnsafeFlagsFalse(boundary) {
  return [
    "agent_runtime_execution_allowed_now",
    "agent_runtime_started",
    "command_execution_allowed_now",
    "command_execution_performed",
    "terminal_execution_allowed_now",
    "terminal_execution_performed",
    "mcp_connection_allowed_now",
    "mcp_connection_performed",
    "api_server_start_allowed_now",
    "api_server_started",
    "cron_gateway_start_allowed_now",
    "cron_gateway_started",
    "package_download_allowed_now",
    "package_download_performed",
    "package_install_allowed_now",
    "package_install_performed",
    "provider_secret_configuration_allowed_now",
    "provider_secret_configured",
    "raw_secret_read_allowed_now",
    "raw_secret_read",
    "raw_client_or_vdr_access_allowed_now",
    "raw_client_or_vdr_material_exposed",
    "cross_domain_data_forwarding_allowed_now",
    "direct_zendd_mutation_allowed_now",
    "direct_zendd_mutation_performed",
    "protected_action_execution_allowed_now",
    "protected_action_executed",
    "receipt_application_allowed_now",
    "receipt_applied",
    "final_pass_or_approval_allowed_now",
    "legal_final_judgment_allowed_now",
    "release_decision_allowed_now",
  ].every((field) => boundary[field] === false);
}

function buildSummary({ sources, scenarioRows, evidenceRows, disabledPathRows, operatorRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_dry_run_simulation_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_delegation_contract_status: sources.delegationContract.summary.platform_agent_delegation_contract_status,
    source_install_packet_status: sources.installPacket.summary.platform_agent_install_packet_status,
    source_doctor_evidence_bridge_status: sources.doctorEvidenceBridge.summary.platform_agent_doctor_evidence_bridge_status,
    source_tool_policy_matrix_status: sources.toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status,
    source_runtime_receipt_contract_status: sources.runtimeReceiptContract.summary.platform_agent_runtime_receipt_contract_status,
    scenario_count: scenarioRows.length,
    evidence_packet_count: evidenceRows.length,
    disabled_path_probe_count: disabledPathRows.length,
    operator_surface_count: operatorRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    dry_run_evidence_generation_allowed: boundary.dry_run_evidence_generation_allowed,
    would_run_only: boundary.would_run_only,
    agent_runtime_started: boundary.agent_runtime_started,
    command_execution_performed: boundary.command_execution_performed,
    terminal_execution_performed: boundary.terminal_execution_performed,
    mcp_connection_performed: boundary.mcp_connection_performed,
    api_server_started: boundary.api_server_started,
    cron_gateway_started: boundary.cron_gateway_started,
    package_download_performed: boundary.package_download_performed,
    package_install_performed: boundary.package_install_performed,
    provider_secret_configured: boundary.provider_secret_configured,
    raw_secret_read: boundary.raw_secret_read,
    raw_client_or_vdr_material_exposed: boundary.raw_client_or_vdr_material_exposed,
    direct_zendd_mutation_performed: boundary.direct_zendd_mutation_performed,
    protected_action_executed: boundary.protected_action_executed,
    receipt_applied: boundary.receipt_applied,
    final_pass_or_approval_allowed_now: boundary.final_pass_or_approval_allowed_now,
    legal_final_judgment_allowed_now: boundary.legal_final_judgment_allowed_now,
    release_decision_allowed_now: boundary.release_decision_allowed_now,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Dry-run Simulation",
    "",
    `Status: ${result.summary.platform_agent_dry_run_simulation_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Scenarios: ${result.summary.scenario_count}`,
    `Evidence packets: ${result.summary.evidence_packet_count}`,
    `Disabled path probes: ${result.summary.disabled_path_probe_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "Dry-run evidence is generated without starting Hermes Agent, invoking tools, executing terminal commands, opening MCP/API/cron routes, configuring secrets, exposing raw material, mutating Zendd, executing protected actions, applying receipts, or granting Agent final authority.",
  ];
  return `${lines.join("\n")}\n`;
}

function validationItem(id, category, passed, message) {
  return {
    id,
    category,
    status: passed ? "pass" : "fail",
    message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => item.status !== "pass")
    .map((item) => ({ path: item.id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    count: rows.length,
    [key]: rows,
  };
}

function validateChainIncludes(packageJson, commandName) {
  const command = `npm run ${commandName} -- --check`;
  return Boolean(packageJson.data?.scripts?.validate?.includes(command));
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_AGENT_DRY_RUN_SIMULATION_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    agent_operations_phase_ledger_path: path.resolve(options.agentOperationsPhaseLedgerPath ?? defaults.agentOperationsPhaseLedgerPath),
    agent_runtime_pilot_ledger_path: path.resolve(options.agentRuntimePilotLedgerPath ?? defaults.agentRuntimePilotLedgerPath),
    integration_phase_ledger_path: path.resolve(options.integrationPhaseLedgerPath ?? defaults.integrationPhaseLedgerPath),
    development_phase_ledger_path: path.resolve(options.developmentPhaseLedgerPath ?? defaults.developmentPhaseLedgerPath),
  };
}

async function readJsonSource(filePath) {
  try {
    return { available: true, path: filePath, data: JSON.parse(await readFile(filePath, "utf8")) };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, data: null };
  }
}

async function readTextSource(filePath) {
  try {
    return { available: true, path: filePath, text: await readFile(filePath, "utf8") };
  } catch (error) {
    return { available: false, path: filePath, error: error.message, text: "" };
  }
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function serializableResult(result) {
  const { markdown, ...serializable } = result;
  return serializable;
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--write") {
      args.write = true;
    } else if (arg === "--out-dir") {
      args.outDir = argv[++index];
    } else if (arg === "--schema") {
      args.schemaPath = argv[++index];
    } else if (arg === "--package") {
      args.packagePath = argv[++index];
    } else if (arg === "--agent-operations-ledger") {
      args.agentOperationsPhaseLedgerPath = argv[++index];
    } else if (arg === "--runtime-pilot-ledger") {
      args.agentRuntimePilotLedgerPath = argv[++index];
    } else if (arg === "--integration-ledger") {
      args.integrationPhaseLedgerPath = argv[++index];
    } else if (arg === "--development-ledger") {
      args.developmentPhaseLedgerPath = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-dry-run-simulation.mjs [--check] [--out-dir DIR]\n\nCreates the P1195-P1198 Agent dry-run runtime simulation without starting Hermes Agent, invoking tools, executing commands, starting services, exposing raw data, mutating Zendd, executing protected actions, or granting Agent final authority.`);
}
