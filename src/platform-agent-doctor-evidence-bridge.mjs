import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentInstallPacket } from "./platform-agent-install-packet.mjs";

export const DEFAULT_PLATFORM_AGENT_DOCTOR_EVIDENCE_BRIDGE_OUT_DIR = "artifacts/platform-agent-doctor-evidence-bridge/latest";
export const DEFAULT_PLATFORM_AGENT_DOCTOR_EVIDENCE_BRIDGE_INPUTS = {
  schemaPath: "schemas/platform-agent-doctor-evidence-bridge.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-doctor-evidence-bridge";
const SOURCE_COMMAND_NAME = "platform:agent-install-packet";
const SCHEMA_VERSION = "platform-agent-doctor-evidence-bridge.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.doctor_evidence_bridge";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1151-P1160";
const PHASE_SLOT = "P1151";
const PREVIOUS_PHASE_SLOT = "P1150";
const NEXT_PHASE_SLOT = "P1161";
const READY_STATUS = "ready_for_agent_doctor_evidence_bridge";
const PROBE_BLOCK_REASON = "install_not_yet_performed";
const OUTPUT_BLOCK_REASON = "missing_doctor_output";

const SAFETY_RULE_SPECS = [
  ["redacted_summary_only", "Doctor outputs must be stored as redacted summaries and hashes only."],
  ["no_raw_stdout_storage", "Raw stdout and stderr are not accepted as persistent evidence."],
  ["no_provider_secret_probe", "Doctor probes cannot request or configure provider secrets."],
  ["no_raw_secret_context", "Doctor evidence cannot include raw provider keys or secret values."],
  ["no_raw_client_or_vdr_context", "Doctor evidence cannot include client, VDR, or domain raw material."],
  ["no_runtime_start", "Doctor evidence cannot imply a running Hermes Agent runtime."],
  ["no_tool_enablement", "Tool help output cannot enable terminal, MCP, browser, or write tools."],
  ["no_agent_final_pass", "Doctor evidence cannot produce final PASS or approval decisions."],
];

export async function runPlatformAgentDoctorEvidenceBridge(options = {}) {
  const result = await buildPlatformAgentDoctorEvidenceBridge(options);
  if (options.write !== false) await writePlatformAgentDoctorEvidenceBridge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent doctor evidence bridge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentDoctorEvidenceBridge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_DOCTOR_EVIDENCE_BRIDGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const installPacket = await buildPlatformAgentInstallPacket({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    write: false,
  });

  const templateRows = buildTemplateRows(installPacket);
  const probeGateRows = buildProbeGateRows(installPacket);
  const outputBindingRows = buildOutputBindingRows(installPacket);
  const safetyRows = buildSafetyRows();
  const claimRows = buildClaimRows({ templateRows, probeGateRows, outputBindingRows, safetyRows });
  const closeoutRows = buildCloseoutRows({ installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_doctor_evidence_bridge_id: `platform-agent-doctor-evidence-bridge.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_doctor_evidence_bridge_anchor: anchor,
    source_agent_install_packet_summary: installPacket.summary,
    agent_doctor_evidence_template_rows: templateRows,
    agent_doctor_probe_gate_rows: probeGateRows,
    agent_doctor_output_binding_rows: outputBindingRows,
    agent_doctor_evidence_safety_rows: safetyRows,
    agent_doctor_evidence_claim_rows: claimRows,
    agent_doctor_evidence_closeout_rows: closeoutRows,
    agent_doctor_evidence_gate_rows: gateRows,
    agent_doctor_evidence_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_doctor_evidence_bridge")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_doctor_evidence_bridge_id = result.platform_agent_doctor_evidence_bridge_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentDoctorEvidenceBridge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-doctor-evidence-bridge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-doctor-evidence-template-rows.json"), collectionEnvelope("agent-doctor-evidence-template-rows.v1", "agent_doctor_evidence_template_rows", result.agent_doctor_evidence_template_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-probe-gate-rows.json"), collectionEnvelope("agent-doctor-probe-gate-rows.v1", "agent_doctor_probe_gate_rows", result.agent_doctor_probe_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-output-binding-rows.json"), collectionEnvelope("agent-doctor-output-binding-rows.v1", "agent_doctor_output_binding_rows", result.agent_doctor_output_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-evidence-safety-rows.json"), collectionEnvelope("agent-doctor-evidence-safety-rows.v1", "agent_doctor_evidence_safety_rows", result.agent_doctor_evidence_safety_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-evidence-claim-rows.json"), collectionEnvelope("agent-doctor-evidence-claim-rows.v1", "agent_doctor_evidence_claim_rows", result.agent_doctor_evidence_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-evidence-closeout-rows.json"), collectionEnvelope("agent-doctor-evidence-closeout-rows.v1", "agent_doctor_evidence_closeout_rows", result.agent_doctor_evidence_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-evidence-gate-rows.json"), collectionEnvelope("agent-doctor-evidence-gate-rows.v1", "agent_doctor_evidence_gate_rows", result.agent_doctor_evidence_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-doctor-evidence-boundary.json"), result.agent_doctor_evidence_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-doctor-evidence-bridge-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentDoctorEvidenceBridgeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentDoctorEvidenceBridge(args);
    console.log(`Platform agent doctor evidence bridge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_doctor_evidence_bridge_status}`);
    console.log(`Templates: ${result.summary.template_count}`);
    console.log(`Probe gates: ${result.summary.probe_gate_count}`);
    console.log(`Output bindings: ${result.summary.output_binding_count}`);
    console.log(`Command execution performed: ${result.summary.command_execution_performed}`);
    console.log(`Raw output stored: ${result.summary.raw_output_stored}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildTemplateRows(installPacket) {
  return installPacket.agent_install_packet_doctor_preflight_rows.map((row, index) => ({
    schema_version: "agent-doctor-evidence-template-row.v1",
    row_id: `agent-doctor-evidence-template.row.${String(index + 1).padStart(3, "0")}`,
    evidence_template_id: `evidence_template.platform.agent.doctor.${row.smoke_id}`,
    smoke_id: row.smoke_id,
    install_mode_id: row.install_mode_id,
    command_candidate: row.command_candidate,
    current_verdict: "pass",
    template_status: "ready_for_future_probe_output",
    source_doctor_preflight_ref: row.row_id,
    required_output_fields: ["redacted_summary", "stdout_sha256", "stderr_sha256", "exit_code", "observed_version", "missing_dependency_summary", "tool_policy_summary"],
    raw_stdout_storage_allowed: false,
    raw_stderr_storage_allowed: false,
    redacted_summary_required: true,
    output_hash_required: true,
    provider_secret_required: false,
    command_execution_performed: false,
    evidence_ref: `evidence.platform.agent.doctor.template.${row.smoke_id}`,
    reviewer_ref: "reviewer.platform.agent_doctor_evidence_template",
    hard_gate_ref: `gate.platform.agent.doctor.template.${row.smoke_id}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "run only after approved install packet execution, then bind redacted output and hashes",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildProbeGateRows(installPacket) {
  return installPacket.agent_install_packet_doctor_preflight_rows.map((row, index) => ({
    schema_version: "agent-doctor-probe-gate-row.v1",
    row_id: `agent-doctor-probe-gate.row.${String(index + 1).padStart(3, "0")}`,
    smoke_id: row.smoke_id,
    install_mode_id: row.install_mode_id,
    command_candidate: row.command_candidate,
    current_verdict: "blocked",
    block_reason: PROBE_BLOCK_REASON,
    source_doctor_preflight_ref: row.row_id,
    install_execution_required_first: true,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    runtime_started: false,
    terminal_execution_performed: false,
    raw_stdout_storage_allowed: false,
    provider_secret_configuration_allowed_now: false,
    evidence_ref: `evidence.platform.agent.doctor.probe_gate.${row.smoke_id}`,
    reviewer_ref: "reviewer.platform.agent_doctor_probe_gate",
    hard_gate_ref: `gate.platform.agent.doctor.probe_gate.${row.smoke_id}`,
    rollback_target_ref: row.rollback_target_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "complete approved install packet execution before running this doctor probe",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildOutputBindingRows(installPacket) {
  return installPacket.agent_install_packet_doctor_preflight_rows.map((row, index) => ({
    schema_version: "agent-doctor-output-binding-row.v1",
    row_id: `agent-doctor-output-binding.row.${String(index + 1).padStart(3, "0")}`,
    smoke_id: row.smoke_id,
    install_mode_id: row.install_mode_id,
    current_verdict: "blocked",
    block_reason: OUTPUT_BLOCK_REASON,
    source_doctor_preflight_ref: row.row_id,
    output_payload_present: false,
    redacted_summary_present: false,
    stdout_hash_present: false,
    stderr_hash_present: false,
    raw_stdout_stored: false,
    raw_stderr_stored: false,
    provider_secret_observed: false,
    raw_client_or_vdr_observed: false,
    pass_promoted_from_output: false,
    evidence_ref: `evidence.platform.agent.doctor.output_binding.${row.smoke_id}`,
    reviewer_ref: "reviewer.platform.agent_doctor_output_binding",
    hard_gate_ref: `gate.platform.agent.doctor.output_binding.${row.smoke_id}`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "capture redacted output summary and hashes after the probe is approved and executed",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildSafetyRows() {
  return SAFETY_RULE_SPECS.map(([ruleId, description], index) => ({
    schema_version: "agent-doctor-evidence-safety-row.v1",
    row_id: `agent-doctor-evidence-safety.row.${String(index + 1).padStart(3, "0")}`,
    safety_rule_id: ruleId,
    current_verdict: "pass",
    safety_status: "ready_for_future_doctor_evidence_review",
    description,
    command_execution_performed: false,
    raw_output_stored: false,
    provider_secret_configuration_allowed_now: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_exposed: false,
    runtime_started: false,
    tool_enablement_allowed_now: false,
    agent_final_pass_allowed_now: false,
    evidence_ref: `evidence.platform.agent.doctor.safety.${ruleId}`,
    reviewer_ref: "reviewer.platform.agent_doctor_safety",
    hard_gate_ref: `gate.platform.agent.doctor.safety.${ruleId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "keep safety rule attached before accepting doctor output evidence",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ templateRows, probeGateRows, outputBindingRows, safetyRows }) {
  const passRows = [
    ...templateRows.map((row) => passClaim("doctor_evidence_template", `claim.platform.agent.doctor.template.${row.smoke_id}`, row)),
    ...safetyRows.map((row) => passClaim("doctor_evidence_safety_rule", `claim.platform.agent.doctor.safety.${row.safety_rule_id}`, row)),
  ];
  const blockedRows = [
    ...probeGateRows.map((row) => blockedClaim("doctor_probe_execution", `claim.platform.agent.doctor.probe.${row.smoke_id}`, row)),
    ...outputBindingRows.map((row) => blockedClaim("doctor_output_binding", `claim.platform.agent.doctor.output.${row.smoke_id}`, row)),
  ];
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-doctor-evidence-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-doctor-evidence-claim-row.v1",
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
    schema_version: "agent-doctor-evidence-claim-row.v1",
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
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function buildCloseoutRows({ installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows }) {
  const rows = [
    ["source_install_packet_ready", installPacket.summary.platform_agent_install_packet_status === "ready_for_agent_install_packet", "source_agent_install_packet_summary"],
    ["templates_ready", templateRows.length === 5 && templateRows.every((row) => row.current_verdict === "pass"), "agent_doctor_evidence_template_rows"],
    ["probe_execution_blocked", probeGateRows.every((row) => row.current_verdict === "blocked" && row.command_execution_performed === false), "agent_doctor_probe_gate_rows"],
    ["output_bindings_blocked", outputBindingRows.every((row) => row.current_verdict === "blocked" && row.output_payload_present === false), "agent_doctor_output_binding_rows"],
    ["safety_rules_ready", safetyRows.length === 8 && safetyRows.every((row) => row.current_verdict === "pass"), "agent_doctor_evidence_safety_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_doctor_evidence_claim_rows"],
    ["no_runtime_or_tool_enablement", safetyRows.every((row) => row.runtime_started === false && row.tool_enablement_allowed_now === false), "agent_doctor_evidence_safety_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-doctor-evidence-closeout-row.v1",
    row_id: `agent-doctor-evidence-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.doctor.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_doctor_closeout",
    hard_gate_ref: `gate.platform.agent.doctor.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1160 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-doctor-evidence-bridge-anchor.v1",
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
    source_install_packet_status: installPacket.summary.platform_agent_install_packet_status,
    template_count: templateRows.length,
    probe_gate_count: probeGateRows.length,
    output_binding_count: outputBindingRows.length,
    safety_rule_count: safetyRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_install_packet", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_doctor_bridge", runtimePilotLedger.available && ["P1151-P1160", COMMAND_NAME, "Doctor/Smoke Evidence Bridge"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_install_packet_ready", installPacket.summary.platform_agent_install_packet_status === "ready_for_agent_install_packet", "source_agent_install_packet_summary"],
    ["templates_ready", templateRows.length === 5 && templateRows.every((row) => row.current_verdict === "pass"), "agent_doctor_evidence_template_rows"],
    ["probe_execution_blocked", probeGateRows.every((row) => row.current_verdict === "blocked" && row.command_execution_allowed_now === false), "agent_doctor_probe_gate_rows"],
    ["output_bindings_blocked", outputBindingRows.every((row) => row.current_verdict === "blocked" && row.output_payload_present === false), "agent_doctor_output_binding_rows"],
    ["safety_rows_ready", safetyRows.length === 8 && safetyRows.every((row) => row.current_verdict === "pass"), "agent_doctor_evidence_safety_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_doctor_evidence_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_doctor_evidence_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-doctor-evidence-gate-row.v1",
    row_id: `agent-doctor-evidence-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.doctor.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_doctor_gate",
    hard_gate_ref: `gate.platform.agent.doctor.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    command_execution_performed_by_gate: false,
    raw_output_stored_by_gate: false,
    runtime_started_by_gate: false,
    tool_enablement_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1160 closeout`,
  }));
}

function buildBoundary({ generatedAt, installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-doctor-evidence-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_install_packet_ref: installPacket.platform_agent_install_packet_id,
    template_count: templateRows.length,
    probe_gate_count: probeGateRows.length,
    output_binding_count: outputBindingRows.length,
    safety_rule_count: safetyRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    output_payload_present: false,
    redacted_summary_present: false,
    stdout_hash_present: false,
    stderr_hash_present: false,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    raw_stdout_stored: false,
    raw_stderr_stored: false,
    provider_secret_configuration_allowed_now: false,
    provider_secret_observed: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_exposed: false,
    runtime_started: false,
    terminal_execution_performed: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    tool_enablement_allowed_now: false,
    protected_action_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
    pass_promoted_from_output: false,
  };
}

function buildValidationItems({ installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All doctor evidence gates must be ready."],
    ["source.install_packet_ready", installPacket.summary.platform_agent_install_packet_status === "ready_for_agent_install_packet", "P1141-P1150 install packet source must be ready."],
    ["templates.ready", templateRows.length === 5 && templateRows.every((row) => row.current_verdict === "pass"), "Doctor evidence templates must be ready."],
    ["probes.blocked", probeGateRows.every((row) => row.current_verdict === "blocked" && row.block_reason === PROBE_BLOCK_REASON), "Doctor probe execution must stay blocked."],
    ["outputs.blocked", outputBindingRows.every((row) => row.current_verdict === "blocked" && row.block_reason === OUTPUT_BLOCK_REASON), "Output bindings must stay blocked until output exists."],
    ["safety.ready", safetyRows.length === 8 && safetyRows.every((row) => row.current_verdict === "pass"), "Safety rows must be ready."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.no_execution", allBoundaryUnsafeFlagsFalse(boundary), "P1151-P1160 must not execute commands, store raw output, start runtime, enable tools, expose secrets, or promote PASS."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_doctor_evidence_bridge", passed, message));
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
    "output_payload_present",
    "redacted_summary_present",
    "stdout_hash_present",
    "stderr_hash_present",
    "command_execution_allowed_now",
    "command_execution_performed",
    "raw_stdout_stored",
    "raw_stderr_stored",
    "provider_secret_configuration_allowed_now",
    "provider_secret_observed",
    "raw_secret_exposed",
    "raw_client_or_vdr_exposed",
    "runtime_started",
    "terminal_execution_performed",
    "mcp_connection_allowed_now",
    "api_server_start_allowed_now",
    "cron_gateway_start_allowed_now",
    "tool_enablement_allowed_now",
    "protected_action_execution_allowed_now",
    "agent_final_pass_allowed_now",
    "pass_promoted_from_output",
  ].every((field) => boundary[field] === false);
}

function buildSummary({ installPacket, templateRows, probeGateRows, outputBindingRows, safetyRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_doctor_evidence_bridge_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_install_packet_status: installPacket.summary.platform_agent_install_packet_status,
    template_count: templateRows.length,
    probe_gate_count: probeGateRows.length,
    output_binding_count: outputBindingRows.length,
    safety_rule_count: safetyRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    output_payload_present: boundary.output_payload_present,
    command_execution_performed: boundary.command_execution_performed,
    raw_output_stored: boundary.raw_stdout_stored || boundary.raw_stderr_stored,
    runtime_started: boundary.runtime_started,
    tool_enablement_allowed_now: boundary.tool_enablement_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Doctor Evidence Bridge",
    "",
    `Status: ${result.summary.platform_agent_doctor_evidence_bridge_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Source install packet: ${result.summary.source_install_packet_status}`,
    `Templates: ${result.summary.template_count}`,
    `Probe gates: ${result.summary.probe_gate_count}`,
    `Output bindings: ${result.summary.output_binding_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "Doctor, version, config, help, and tool-policy probes remain unexecuted. Output evidence is accepted only as future redacted summaries and hashes.",
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
  const defaults = DEFAULT_PLATFORM_AGENT_DOCTOR_EVIDENCE_BRIDGE_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    agent_operations_phase_ledger_path: path.resolve(options.agentOperationsPhaseLedgerPath ?? defaults.agentOperationsPhaseLedgerPath),
    agent_runtime_pilot_ledger_path: path.resolve(options.agentRuntimePilotLedgerPath ?? defaults.agentRuntimePilotLedgerPath),
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
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-doctor-evidence-bridge.mjs [--check] [--out-dir DIR]\n\nCreates the P1151-P1160 Agent doctor evidence bridge without executing doctor, version, config, help, or tool probes.`);
}
