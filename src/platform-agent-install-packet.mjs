import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentIsolatedInstallGate } from "./platform-agent-isolated-install-gate.mjs";
import { buildPlatformAgentRuntimeReceiptContract } from "./platform-agent-runtime-receipt-contract.mjs";

export const DEFAULT_PLATFORM_AGENT_INSTALL_PACKET_OUT_DIR = "artifacts/platform-agent-install-packet/latest";
export const DEFAULT_PLATFORM_AGENT_INSTALL_PACKET_INPUTS = {
  schemaPath: "schemas/platform-agent-install-packet.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-install-packet";
const SOURCE_RECEIPT_COMMAND_NAME = "platform:agent-runtime-receipt-contract";
const SOURCE_INSTALL_COMMAND_NAME = "platform:agent-isolated-install-gate";
const SCHEMA_VERSION = "platform-agent-install-packet.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.install_packet";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1141-P1150";
const PHASE_SLOT = "P1141";
const PREVIOUS_PHASE_SLOT = "P1140";
const NEXT_PHASE_SLOT = "P1151";
const READY_STATUS = "ready_for_agent_install_packet";
const BLOCK_MATERIALIZATION_REASON = "install_packet_not_approved";
const BLOCK_EXECUTION_REASON = "missing_validated_human_receipt";
const BLOCK_DOCTOR_REASON = "install_not_yet_performed";

export async function runPlatformAgentInstallPacket(options = {}) {
  const result = await buildPlatformAgentInstallPacket(options);
  if (options.write !== false) await writePlatformAgentInstallPacket(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent install packet failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentInstallPacket(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_INSTALL_PACKET_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const runtimeReceipt = await buildPlatformAgentRuntimeReceiptContract({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    write: false,
  });
  const isolatedInstall = await buildPlatformAgentIsolatedInstallGate({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });

  const packetRows = buildPacketRows(isolatedInstall, runtimeReceipt);
  const evidenceRows = buildEvidenceRows(packetRows, isolatedInstall);
  const materializationRows = buildMaterializationRows(packetRows);
  const executionRows = buildExecutionRows(packetRows);
  const doctorPreflightRows = buildDoctorPreflightRows(isolatedInstall);
  const rollbackRows = buildRollbackRows(packetRows, isolatedInstall);
  const claimRows = buildClaimRows({ packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows });
  const closeoutRows = buildCloseoutRows({ runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_install_packet_id: `platform-agent-install-packet.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_install_packet_anchor: anchor,
    source_agent_runtime_receipt_contract_summary: runtimeReceipt.summary,
    source_agent_isolated_install_gate_summary: isolatedInstall.summary,
    agent_install_packet_rows: packetRows,
    agent_install_packet_evidence_rows: evidenceRows,
    agent_install_packet_materialization_rows: materializationRows,
    agent_install_packet_execution_rows: executionRows,
    agent_install_packet_doctor_preflight_rows: doctorPreflightRows,
    agent_install_packet_rollback_rows: rollbackRows,
    agent_install_packet_claim_rows: claimRows,
    agent_install_packet_closeout_rows: closeoutRows,
    agent_install_packet_gate_rows: gateRows,
    agent_install_packet_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_install_packet")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_install_packet_id = result.platform_agent_install_packet_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentInstallPacket(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-install-packet.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-install-packet-rows.json"), collectionEnvelope("agent-install-packet-rows.v1", "agent_install_packet_rows", result.agent_install_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-evidence-rows.json"), collectionEnvelope("agent-install-packet-evidence-rows.v1", "agent_install_packet_evidence_rows", result.agent_install_packet_evidence_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-materialization-rows.json"), collectionEnvelope("agent-install-packet-materialization-rows.v1", "agent_install_packet_materialization_rows", result.agent_install_packet_materialization_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-execution-rows.json"), collectionEnvelope("agent-install-packet-execution-rows.v1", "agent_install_packet_execution_rows", result.agent_install_packet_execution_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-doctor-preflight-rows.json"), collectionEnvelope("agent-install-packet-doctor-preflight-rows.v1", "agent_install_packet_doctor_preflight_rows", result.agent_install_packet_doctor_preflight_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-rollback-rows.json"), collectionEnvelope("agent-install-packet-rollback-rows.v1", "agent_install_packet_rollback_rows", result.agent_install_packet_rollback_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-claim-rows.json"), collectionEnvelope("agent-install-packet-claim-rows.v1", "agent_install_packet_claim_rows", result.agent_install_packet_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-closeout-rows.json"), collectionEnvelope("agent-install-packet-closeout-rows.v1", "agent_install_packet_closeout_rows", result.agent_install_packet_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-gate-rows.json"), collectionEnvelope("agent-install-packet-gate-rows.v1", "agent_install_packet_gate_rows", result.agent_install_packet_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-install-packet-boundary.json"), result.agent_install_packet_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-install-packet-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentInstallPacketCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentInstallPacket(args);
    console.log(`Platform agent install packet ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_install_packet_status}`);
    console.log(`Install packets: ${result.summary.install_packet_count}`);
    console.log(`Evidence packets: ${result.summary.evidence_packet_count}`);
    console.log(`Execution rows: ${result.summary.execution_row_count}`);
    console.log(`Package download performed: ${result.summary.package_download_performed}`);
    console.log(`Install performed: ${result.summary.install_performed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildPacketRows(isolatedInstall, runtimeReceipt) {
  return isolatedInstall.agent_isolated_install_selection_rows
    .filter((row) => row.current_verdict === "pass")
    .map((row, index) => ({
      schema_version: "agent-install-packet-row.v1",
      row_id: `agent-install-packet.row.${String(index + 1).padStart(3, "0")}`,
      install_packet_id: `agent.install_packet.${row.install_mode_id}`,
      install_mode_id: row.install_mode_id,
      selected: row.selected,
      current_verdict: "pass",
      packet_status: "ready_as_plan_only",
      source_selection_ref: row.row_id,
      source_runtime_receipt_contract_ref: runtimeReceipt.platform_agent_runtime_receipt_contract_id,
      trust_tier: row.trust_tier,
      install_command_candidate: row.install_command_candidate,
      rollback_command_candidate: row.rollback_command_candidate,
      packet_directory_candidate: `artifacts/platform-agent-install-packet/candidates/${row.install_mode_id}`,
      package_download_allowed_now: false,
      package_download_performed: false,
      install_execution_allowed_now: false,
      install_execution_performed: false,
      packet_materialized: false,
      command_execution_performed: false,
      provider_secret_required: false,
      provider_secret_configuration_allowed_now: false,
      human_receipt_required: true,
      human_receipt_ref: `receipt.platform.agent.install.${row.install_mode_id}`,
      receipt_payload_present: false,
      receipt_validated: false,
      evidence_ref: `evidence.platform.agent.install_packet.packet.${row.install_mode_id}`,
      reviewer_ref: "reviewer.platform.agent_install_packet",
      hard_gate_ref: `gate.platform.agent.install_packet.packet.${row.install_mode_id}`,
      rollback_target_ref: `rollback.platform.agent.install.${row.install_mode_id}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: row.selected
        ? "collect validated human receipt before materializing selected install packet"
        : "select this install packet through human receipt before materialization",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    }));
}

function buildEvidenceRows(packetRows, isolatedInstall) {
  const observation = isolatedInstall.agent_isolated_install_policy;
  return packetRows.map((row, index) => ({
    schema_version: "agent-install-packet-evidence-row.v1",
    row_id: `agent-install-packet-evidence.row.${String(index + 1).padStart(3, "0")}`,
    evidence_packet_id: `evidence_packet.platform.agent.install.${row.install_mode_id}`,
    install_packet_id: row.install_packet_id,
    install_mode_id: row.install_mode_id,
    current_verdict: "pass",
    evidence_status: "ready_as_metadata_only",
    package_provenance_ref: "source_agent_install_trust_gate_summary",
    version_pin_ref: "hermes-agent==0.15.2",
    install_command_ref: row.install_command_candidate,
    rollback_target_ref: row.rollback_target_ref,
    receipt_gate_ref: row.human_receipt_ref,
    no_secret_allowlist_ref: "empty_secret_allowlist",
    raw_stdout_storage_allowed: false,
    redacted_summary_required_after_execution: true,
    stdout_hash_required_after_execution: true,
    packet_materialized: false,
    command_execution_performed: false,
    source_install_policy_ref: observation.selected_install_mode,
    evidence_ref: `evidence.platform.agent.install_packet.evidence.${row.install_mode_id}`,
    reviewer_ref: "reviewer.platform.agent_install_packet_evidence",
    hard_gate_ref: `gate.platform.agent.install_packet.evidence.${row.install_mode_id}`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "attach this evidence packet to a human receipt before any install command",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildMaterializationRows(packetRows) {
  return packetRows.map((row, index) => ({
    schema_version: "agent-install-packet-materialization-row.v1",
    row_id: `agent-install-packet-materialization.row.${String(index + 1).padStart(3, "0")}`,
    install_packet_id: row.install_packet_id,
    install_mode_id: row.install_mode_id,
    selected: row.selected,
    current_verdict: "blocked",
    block_reason: BLOCK_MATERIALIZATION_REASON,
    packet_directory_candidate: row.packet_directory_candidate,
    packet_materialized: false,
    file_write_performed: false,
    package_download_allowed_now: false,
    package_download_performed: false,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    human_receipt_required: true,
    human_receipt_ref: row.human_receipt_ref,
    evidence_ref: `evidence.platform.agent.install_packet.materialization.${row.install_mode_id}`,
    reviewer_ref: "reviewer.platform.agent_install_packet_materialization",
    hard_gate_ref: `gate.platform.agent.install_packet.materialization.${row.install_mode_id}`,
    rollback_target_ref: row.rollback_target_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "validate human receipt before creating packet files or downloading packages",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildExecutionRows(packetRows) {
  return packetRows.map((row, index) => ({
    schema_version: "agent-install-packet-execution-row.v1",
    row_id: `agent-install-packet-execution.row.${String(index + 1).padStart(3, "0")}`,
    install_packet_id: row.install_packet_id,
    install_mode_id: row.install_mode_id,
    selected: row.selected,
    current_verdict: "blocked",
    block_reason: BLOCK_EXECUTION_REASON,
    install_command_candidate: row.install_command_candidate,
    install_execution_allowed_now: false,
    package_download_allowed_now: false,
    package_download_performed: false,
    package_install_performed: false,
    runtime_started: false,
    terminal_execution_allowed_now: false,
    terminal_execution_performed: false,
    provider_secret_configuration_allowed_now: false,
    human_receipt_required: true,
    human_receipt_ref: row.human_receipt_ref,
    receipt_payload_present: false,
    receipt_validated: false,
    evidence_ref: `evidence.platform.agent.install_packet.execution.${row.install_mode_id}`,
    reviewer_ref: "reviewer.platform.agent_install_packet_execution",
    hard_gate_ref: `gate.platform.agent.install_packet.execution.${row.install_mode_id}`,
    rollback_target_ref: row.rollback_target_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "keep install execution blocked until validated human receipt and packet materialization evidence exist",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildDoctorPreflightRows(isolatedInstall) {
  return isolatedInstall.agent_doctor_smoke_plan_rows.map((row, index) => ({
    schema_version: "agent-install-packet-doctor-preflight-row.v1",
    row_id: `agent-install-packet-doctor-preflight.row.${String(index + 1).padStart(3, "0")}`,
    smoke_id: row.smoke_id,
    install_mode_id: row.install_mode_id,
    command_candidate: row.command_candidate,
    current_verdict: "blocked",
    block_reason: BLOCK_DOCTOR_REASON,
    source_smoke_plan_ref: row.row_id,
    install_execution_required_first: true,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    raw_stdout_storage_allowed: false,
    redacted_summary_required: true,
    stdout_hash_required_after_execution: true,
    provider_secret_required: false,
    evidence_ref: `evidence.platform.agent.install_packet.doctor_preflight.${row.smoke_id}`,
    reviewer_ref: "reviewer.platform.agent_install_packet_doctor_preflight",
    hard_gate_ref: `gate.platform.agent.install_packet.doctor_preflight.${row.smoke_id}`,
    rollback_target_ref: row.rollback_target_ref,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "execute doctor probe only after approved install packet execution",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildRollbackRows(packetRows, isolatedInstall) {
  const rollbackByMode = new Map(isolatedInstall.agent_install_rollback_binding_rows.map((row) => [row.install_mode_id, row]));
  return packetRows.map((row, index) => {
    const source = rollbackByMode.get(row.install_mode_id);
    return {
      schema_version: "agent-install-packet-rollback-row.v1",
      row_id: `agent-install-packet-rollback.row.${String(index + 1).padStart(3, "0")}`,
      install_packet_id: row.install_packet_id,
      install_mode_id: row.install_mode_id,
      current_verdict: "pass",
      source_rollback_ref: source?.row_id ?? null,
      rollback_target_ref: row.rollback_target_ref,
      rollback_command_candidate: row.rollback_command_candidate,
      rollback_execution_allowed_now: false,
      rollback_execution_performed: false,
      evidence_ref: `evidence.platform.agent.install_packet.rollback.${row.install_mode_id}`,
      reviewer_ref: "reviewer.platform.agent_install_packet_rollback",
      hard_gate_ref: `gate.platform.agent.install_packet.rollback.${row.install_mode_id}`,
      responsible_owner: row.responsible_owner,
      next_allowed_action: "keep rollback binding attached before packet execution",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildClaimRows({ packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows }) {
  const passRows = [
    ...packetRows.map((row) => passClaim("install_packet_plan", `claim.platform.agent.install_packet.plan.${row.install_mode_id}`, row)),
    ...evidenceRows.map((row) => passClaim("install_packet_evidence", `claim.platform.agent.install_packet.evidence.${row.install_mode_id}`, row)),
    ...rollbackRows.map((row) => passClaim("install_packet_rollback", `claim.platform.agent.install_packet.rollback.${row.install_mode_id}`, row)),
  ];
  const blockedRows = [
    ...materializationRows.map((row) => blockedClaim("install_packet_materialization", `claim.platform.agent.install_packet.materialization.${row.install_mode_id}`, row)),
    ...executionRows.map((row) => blockedClaim("install_packet_execution", `claim.platform.agent.install_packet.execution.${row.install_mode_id}`, row)),
    ...doctorPreflightRows.map((row) => blockedClaim("install_packet_doctor_preflight", `claim.platform.agent.install_packet.doctor.${row.smoke_id}`, row)),
  ];
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-install-packet-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-install-packet-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: row.row_id,
    current_verdict: "pass",
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref ?? null,
    block_reason: null,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-install-packet-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: row.row_id,
    current_verdict: "blocked",
    evidence_ref: row.evidence_ref,
    reviewer_ref: row.reviewer_ref,
    hard_gate_ref: row.hard_gate_ref,
    human_receipt_ref: row.human_receipt_ref ?? null,
    block_reason: row.block_reason,
    responsible_owner: row.responsible_owner,
    next_allowed_action: row.next_allowed_action,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function buildCloseoutRows({ runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows }) {
  const rows = [
    ["source_runtime_receipt_ready", runtimeReceipt.summary.platform_agent_runtime_receipt_contract_status === "ready_for_agent_runtime_receipt_contract", "source_agent_runtime_receipt_contract_summary"],
    ["source_isolated_install_ready", isolatedInstall.summary.platform_agent_isolated_install_gate_status === "ready_for_agent_isolated_install_gate", "source_agent_isolated_install_gate_summary"],
    ["packet_plans_ready", packetRows.length === 3 && packetRows.every((row) => row.current_verdict === "pass"), "agent_install_packet_rows"],
    ["evidence_packets_ready", evidenceRows.length === 3 && evidenceRows.every((row) => row.current_verdict === "pass"), "agent_install_packet_evidence_rows"],
    ["materialization_blocked", materializationRows.every((row) => row.current_verdict === "blocked" && row.packet_materialized === false), "agent_install_packet_materialization_rows"],
    ["install_execution_blocked", executionRows.every((row) => row.current_verdict === "blocked" && row.install_execution_allowed_now === false), "agent_install_packet_execution_rows"],
    ["doctor_preflight_deferred", doctorPreflightRows.every((row) => row.current_verdict === "blocked" && row.command_execution_performed === false), "agent_install_packet_doctor_preflight_rows"],
    ["rollback_bindings_ready", rollbackRows.every((row) => row.current_verdict === "pass" && row.rollback_execution_allowed_now === false), "agent_install_packet_rollback_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_install_packet_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-install-packet-closeout-row.v1",
    row_id: `agent-install-packet-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.install_packet.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_install_packet_closeout",
    hard_gate_ref: `gate.platform.agent.install_packet.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1150 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-install-packet-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_receipt_command_name: SOURCE_RECEIPT_COMMAND_NAME,
    source_install_command_name: SOURCE_INSTALL_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    runtime_pilot_ledger_present: runtimePilotLedger.available,
    source_runtime_receipt_contract_status: runtimeReceipt.summary.platform_agent_runtime_receipt_contract_status,
    source_isolated_install_gate_status: isolatedInstall.summary.platform_agent_isolated_install_gate_status,
    install_packet_count: packetRows.length,
    evidence_packet_count: evidenceRows.length,
    materialization_row_count: materializationRows.length,
    execution_row_count: executionRows.length,
    doctor_preflight_count: doctorPreflightRows.length,
    rollback_row_count: rollbackRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceReceiptCommand = `npm run ${SOURCE_RECEIPT_COMMAND_NAME} -- --check`;
  const sourceInstallCommand = `npm run ${SOURCE_INSTALL_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_runtime_receipt_contract", validate.indexOf(command) > validate.indexOf(sourceReceiptCommand) && validate.indexOf(sourceReceiptCommand) >= 0, "package.json scripts.validate"],
    ["isolated_install_source_registered_before_packet", validate.indexOf(command) > validate.indexOf(sourceInstallCommand) && validate.indexOf(sourceInstallCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_install_packet", runtimePilotLedger.available && ["P1141-P1150", COMMAND_NAME, "Isolated Install Packet v2"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_runtime_receipt_ready", runtimeReceipt.summary.platform_agent_runtime_receipt_contract_status === "ready_for_agent_runtime_receipt_contract", "source_agent_runtime_receipt_contract_summary"],
    ["source_isolated_install_ready", isolatedInstall.summary.platform_agent_isolated_install_gate_status === "ready_for_agent_isolated_install_gate", "source_agent_isolated_install_gate_summary"],
    ["packet_rows_ready", packetRows.length === 3 && packetRows.every((row) => row.current_verdict === "pass"), "agent_install_packet_rows"],
    ["evidence_rows_ready", evidenceRows.length === 3 && evidenceRows.every((row) => row.current_verdict === "pass"), "agent_install_packet_evidence_rows"],
    ["materialization_blocked", materializationRows.every((row) => row.current_verdict === "blocked" && row.file_write_performed === false), "agent_install_packet_materialization_rows"],
    ["execution_blocked", executionRows.every((row) => row.current_verdict === "blocked" && row.install_execution_allowed_now === false), "agent_install_packet_execution_rows"],
    ["doctor_preflight_deferred", doctorPreflightRows.every((row) => row.current_verdict === "blocked" && row.command_execution_allowed_now === false), "agent_install_packet_doctor_preflight_rows"],
    ["rollback_rows_ready", rollbackRows.every((row) => row.current_verdict === "pass"), "agent_install_packet_rollback_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_install_packet_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_install_packet_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-install-packet-gate-row.v1",
    row_id: `agent-install-packet-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.install_packet.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_install_packet_gate",
    hard_gate_ref: `gate.platform.agent.install_packet.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    package_download_performed_by_gate: false,
    install_execution_performed_by_gate: false,
    command_execution_performed_by_gate: false,
    packet_materialized_by_gate: false,
    protected_action_executed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1150 closeout`,
  }));
}

function buildBoundary({ generatedAt, runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-install-packet-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_runtime_receipt_contract_ref: runtimeReceipt.platform_agent_runtime_receipt_contract_id,
    source_isolated_install_gate_ref: isolatedInstall.platform_agent_isolated_install_gate_id,
    install_packet_count: packetRows.length,
    evidence_packet_count: evidenceRows.length,
    materialization_row_count: materializationRows.length,
    execution_row_count: executionRows.length,
    doctor_preflight_count: doctorPreflightRows.length,
    rollback_row_count: rollbackRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    receipt_payload_present: false,
    receipt_validated: false,
    receipt_applied: false,
    install_packet_materialized: false,
    file_write_performed: false,
    package_download_allowed_now: false,
    package_download_performed: false,
    install_execution_allowed_now: false,
    install_execution_performed: false,
    command_execution_allowed_now: false,
    command_execution_performed: false,
    doctor_smoke_execution_allowed_now: false,
    doctor_smoke_execution_performed: false,
    rollback_execution_allowed_now: false,
    rollback_execution_performed: false,
    runtime_started: false,
    terminal_execution_allowed_now: false,
    terminal_execution_performed: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_gateway_start_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_exposed: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
  };
}

function buildValidationItems({ runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All install packet gates must be ready."],
    ["source.runtime_receipt_ready", runtimeReceipt.summary.platform_agent_runtime_receipt_contract_status === "ready_for_agent_runtime_receipt_contract", "P1133-P1140 source must be ready."],
    ["source.isolated_install_ready", isolatedInstall.summary.platform_agent_isolated_install_gate_status === "ready_for_agent_isolated_install_gate", "P1057-P1064 source must be ready."],
    ["packets.ready", packetRows.length === 3 && packetRows.every((row) => row.current_verdict === "pass"), "Three install packet plans must be ready."],
    ["evidence.ready", evidenceRows.length === 3 && evidenceRows.every((row) => row.current_verdict === "pass"), "Evidence packets must be metadata-only and ready."],
    ["materialization.blocked", materializationRows.every((row) => row.current_verdict === "blocked" && row.block_reason === BLOCK_MATERIALIZATION_REASON), "Packet materialization must stay blocked."],
    ["execution.blocked", executionRows.every((row) => row.current_verdict === "blocked" && row.block_reason === BLOCK_EXECUTION_REASON), "Install execution must stay blocked."],
    ["doctor.deferred", doctorPreflightRows.every((row) => row.current_verdict === "blocked" && row.block_reason === BLOCK_DOCTOR_REASON), "Doctor probes must stay deferred."],
    ["rollback.ready", rollbackRows.every((row) => row.current_verdict === "pass" && row.rollback_execution_allowed_now === false), "Rollback rows must be ready but not executed."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.no_execution", allBoundaryUnsafeFlagsFalse(boundary), "P1141-P1150 must not materialize, download, install, execute, start, or expose protected material."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_install_packet", passed, message));
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
    "receipt_payload_present",
    "receipt_validated",
    "receipt_applied",
    "install_packet_materialized",
    "file_write_performed",
    "package_download_allowed_now",
    "package_download_performed",
    "install_execution_allowed_now",
    "install_execution_performed",
    "command_execution_allowed_now",
    "command_execution_performed",
    "doctor_smoke_execution_allowed_now",
    "doctor_smoke_execution_performed",
    "rollback_execution_allowed_now",
    "rollback_execution_performed",
    "runtime_started",
    "terminal_execution_allowed_now",
    "terminal_execution_performed",
    "mcp_connection_allowed_now",
    "api_server_start_allowed_now",
    "cron_gateway_start_allowed_now",
    "provider_secret_configuration_allowed_now",
    "raw_secret_exposed",
    "raw_client_or_vdr_exposed",
    "direct_zendd_mutation_allowed_now",
    "protected_action_execution_allowed_now",
    "agent_final_pass_allowed_now",
  ].every((field) => boundary[field] === false);
}

function buildSummary({ runtimeReceipt, isolatedInstall, packetRows, evidenceRows, materializationRows, executionRows, doctorPreflightRows, rollbackRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_install_packet_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_runtime_receipt_contract_status: runtimeReceipt.summary.platform_agent_runtime_receipt_contract_status,
    source_isolated_install_gate_status: isolatedInstall.summary.platform_agent_isolated_install_gate_status,
    install_packet_count: packetRows.length,
    selected_install_packet_count: packetRows.filter((row) => row.selected).length,
    evidence_packet_count: evidenceRows.length,
    materialization_row_count: materializationRows.length,
    execution_row_count: executionRows.length,
    doctor_preflight_count: doctorPreflightRows.length,
    rollback_row_count: rollbackRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    receipt_payload_present: boundary.receipt_payload_present,
    package_download_performed: boundary.package_download_performed,
    install_performed: boundary.install_execution_performed,
    command_execution_performed: boundary.command_execution_performed,
    doctor_smoke_execution_performed: boundary.doctor_smoke_execution_performed,
    runtime_started: boundary.runtime_started,
    protected_action_executed: boundary.protected_action_execution_allowed_now,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Install Packet",
    "",
    `Status: ${result.summary.platform_agent_install_packet_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Source runtime receipt contract: ${result.summary.source_runtime_receipt_contract_status}`,
    `Source isolated install gate: ${result.summary.source_isolated_install_gate_status}`,
    `Install packets: ${result.summary.install_packet_count}`,
    `Evidence packets: ${result.summary.evidence_packet_count}`,
    `Execution rows: ${result.summary.execution_row_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "All package download, packet materialization, install execution, doctor smoke, runtime start, terminal execution, secrets, raw material exposure, and protected actions remain disabled.",
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
  const defaults = DEFAULT_PLATFORM_AGENT_INSTALL_PACKET_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-install-packet.mjs [--check] [--out-dir DIR]\n\nCreates the P1141-P1150 Agent install packet without downloading, materializing, installing, or executing Hermes Agent.`);
}
