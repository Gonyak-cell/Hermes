import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentCapabilityRegistry } from "./platform-agent-capability-registry.mjs";
import { buildPlatformAgentZenddCandidateBridge } from "./platform-agent-zendd-candidate-bridge.mjs";

export const DEFAULT_PLATFORM_AGENT_DELEGATION_CONTRACT_OUT_DIR = "artifacts/platform-agent-delegation-contract/latest";
export const DEFAULT_PLATFORM_AGENT_DELEGATION_CONTRACT_INPUTS = {
  schemaPath: "schemas/platform-agent-delegation-contract.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-delegation-contract";
const SOURCE_COMMAND_NAME = "platform:agent-zendd-candidate-bridge";
const REGISTRY_COMMAND_NAME = "platform:agent-capability-registry";
const SCHEMA_VERSION = "platform-agent-delegation-contract.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.delegation_contract";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1189-P1194";
const PHASE_SLOT = "P1189";
const PREVIOUS_PHASE_SLOT = "P1188";
const NEXT_PHASE_SLOT = "P1195";
const READY_STATUS = "ready_for_agent_delegation_contract";

const DELEGATION_ROLE_SPECS = [
  ["domain_observer", "L0", "Summarize domain status and missing input refs only."],
  ["work_order_planner", "L1", "Draft scoped work orders and next actions without mutation."],
  ["evidence_packet_drafter", "L1", "Draft evidence packets from refs and redacted spans only."],
  ["review_packet_drafter", "L2", "Draft reviewer packets with human gate and rollback refs."],
];

const PROTECTED_DELEGATION_BLOCKS = [
  ["autonomous_subagent_spawn", "subagent_spawn_forbidden", "keep subagent execution disabled until dry-run simulation freeze"],
  ["background_agent_loop", "background_runtime_loop_forbidden", "document loop plan without starting API, cron, or worker"],
  ["cross_domain_data_forwarding", "cross_domain_data_boundary", "route through domain-specific adapter contract and owner review"],
  ["raw_secret_forwarding", "raw_secret_access", "use secret-handle references only"],
  ["raw_client_vdr_forwarding", "raw_client_or_vdr_exposure", "use source-span refs and redacted summaries only"],
  ["terminal_execution_delegate", "terminal_execution_requires_human_receipt", "create execution packet and human receipt before any terminal action"],
  ["mcp_connection_delegate", "unreviewed_mcp_connection", "register MCP plan behind operator and human gate"],
  ["api_server_start_delegate", "api_server_start_forbidden", "keep API/server start disabled for runtime pilot"],
  ["cron_start_delegate", "cron_start_forbidden", "keep scheduled/background startup disabled"],
  ["direct_zendd_mutation_delegate", "direct_zendd_mutation", "use Zendd external safe patch lane and receipt"],
  ["protected_action_execution_delegate", "protected_action_requires_human_receipt", "queue protected action receipt and reviewer gate"],
  ["agent_final_approval_or_legal_judgment", "agent_final_authority_forbidden", "route final PASS, approval, legal judgment, and release decisions through human gate and freeze"],
];

export async function runPlatformAgentDelegationContract(options = {}) {
  const result = await buildPlatformAgentDelegationContract(options);
  if (options.write !== false) await writePlatformAgentDelegationContract(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent delegation contract failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentDelegationContract(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_DELEGATION_CONTRACT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const zenddCandidateBridge = await buildPlatformAgentZenddCandidateBridge({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  });
  const capabilityRegistry = await buildPlatformAgentCapabilityRegistry({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });

  const roleRows = buildDelegationRoleRows(capabilityRegistry.domain_agent_registry_rows);
  const handoffRows = buildHandoffChannelRows(capabilityRegistry.domain_agent_registry_rows);
  const zenddDelegationRows = buildZenddDelegationRows(zenddCandidateBridge.agent_zendd_candidate_packet_rows);
  const protectedBlockRows = buildProtectedBlockRows();
  const claimRows = buildClaimRows({ roleRows, handoffRows, zenddDelegationRows, protectedBlockRows });
  const closeoutRows = buildCloseoutRows({ zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_delegation_contract_id: `platform-agent-delegation-contract.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_delegation_contract_anchor: anchor,
    source_agent_zendd_candidate_bridge_summary: zenddCandidateBridge.summary,
    source_agent_capability_registry_summary: capabilityRegistry.summary,
    agent_delegation_role_rows: roleRows,
    agent_delegation_handoff_channel_rows: handoffRows,
    agent_zendd_delegation_packet_rows: zenddDelegationRows,
    agent_delegation_protected_block_rows: protectedBlockRows,
    agent_delegation_claim_rows: claimRows,
    agent_delegation_closeout_rows: closeoutRows,
    agent_delegation_gate_rows: gateRows,
    agent_delegation_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_delegation_contract")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_delegation_contract_id = result.platform_agent_delegation_contract_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentDelegationContract(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-delegation-contract.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-delegation-role-rows.json"), collectionEnvelope("agent-delegation-role-rows.v1", "agent_delegation_role_rows", result.agent_delegation_role_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-delegation-handoff-channel-rows.json"), collectionEnvelope("agent-delegation-handoff-channel-rows.v1", "agent_delegation_handoff_channel_rows", result.agent_delegation_handoff_channel_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-delegation-packet-rows.json"), collectionEnvelope("agent-zendd-delegation-packet-rows.v1", "agent_zendd_delegation_packet_rows", result.agent_zendd_delegation_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-delegation-protected-block-rows.json"), collectionEnvelope("agent-delegation-protected-block-rows.v1", "agent_delegation_protected_block_rows", result.agent_delegation_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-delegation-claim-rows.json"), collectionEnvelope("agent-delegation-claim-rows.v1", "agent_delegation_claim_rows", result.agent_delegation_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-delegation-closeout-rows.json"), collectionEnvelope("agent-delegation-closeout-rows.v1", "agent_delegation_closeout_rows", result.agent_delegation_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-delegation-gate-rows.json"), collectionEnvelope("agent-delegation-gate-rows.v1", "agent_delegation_gate_rows", result.agent_delegation_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-delegation-boundary.json"), result.agent_delegation_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-delegation-contract-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentDelegationContractCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentDelegationContract(args);
    console.log(`Platform agent delegation contract ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_delegation_contract_status}`);
    console.log(`Delegation roles: ${result.summary.delegation_role_count}`);
    console.log(`Handoff channels: ${result.summary.handoff_channel_count}`);
    console.log(`Zendd delegation packets: ${result.summary.zendd_delegation_packet_count}`);
    console.log(`Protected blocks: ${result.summary.protected_block_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Subagent spawn allowed: ${result.summary.subagent_spawn_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildDelegationRoleRows(domainRows) {
  const rows = [];
  for (const domain of domainRows) {
    for (const [roleId, maxRolloutLevel, description] of DELEGATION_ROLE_SPECS) {
      rows.push({
        schema_version: "agent-delegation-role-row.v1",
        row_id: `agent-delegation-role.row.${String(rows.length + 1).padStart(2, "0")}`,
        delegation_role_id: `delegation.role.${domain.domain_id}.${roleId}`,
        role_id: roleId,
        domain_id: domain.domain_id,
        domain_pack_id: domain.domain_pack_id,
        max_rollout_level_for_role: maxRolloutLevel,
        current_domain_rollout_level: domain.current_rollout_level,
        current_verdict: "pass",
        delegation_contract_status: "contract_defined_runtime_disabled",
        description,
        allowed_payload_refs: ["claim_ref", "evidence_ref", "reviewer_ref", "hard_gate_ref", "human_receipt_ref", "rollback_target_ref", "next_allowed_action"],
        forbidden_payload_fields: ["raw_secret", "raw_client_payload", "raw_vdr_payload", "provider_key", "final_pass", "approved_by_agent", "legal_final_judgment"],
        subagent_spawn_allowed_now: false,
        autonomous_execution_allowed_now: false,
        tool_invocation_allowed_now: false,
        terminal_execution_allowed_now: false,
        mcp_connection_allowed_now: false,
        cross_domain_data_access_allowed_now: false,
        raw_secret_forwarding_allowed_now: false,
        raw_client_or_vdr_forwarding_allowed_now: false,
        protected_action_execution_allowed_now: false,
        final_pass_or_approval_allowed_now: false,
        evidence_ref: `evidence.platform.agent.delegation.role.${domain.domain_id}.${roleId}`,
        reviewer_ref: "reviewer.platform.agent_delegation_contract",
        hard_gate_ref: `gate.platform.agent.delegation.role.${domain.domain_id}.${roleId}`,
        responsible_owner: domain.responsible_owner,
        next_allowed_action: "bind role to dry-run simulation before any subagent runtime spawn",
        unsafe_flags_false: true,
        verdict_authority: "harness_only",
      });
    }
  }
  return rows;
}

function buildHandoffChannelRows(domainRows) {
  return domainRows.map((domain, index) => ({
    schema_version: "agent-delegation-handoff-channel-row.v1",
    row_id: `agent-delegation-handoff-channel.row.${String(index + 1).padStart(2, "0")}`,
    handoff_channel_id: `delegation.channel.${domain.domain_id}`,
    domain_id: domain.domain_id,
    domain_pack_id: domain.domain_pack_id,
    current_verdict: "pass",
    handoff_status: "channel_contract_ready_runtime_disabled",
    allowed_handoff_payload_fields: ["domain_id", "candidate_packet_ref", "claim_id", "current_verdict", "evidence_ref", "reviewer_ref", "hard_gate_ref", "human_receipt_ref", "rollback_target_ref", "next_allowed_action"],
    forbidden_handoff_payload_fields: ["raw_secret", "raw_client_payload", "raw_vdr_payload", "credential_material", "unredacted_terminal_stdout", "final_pass", "approved_by_agent"],
    owner_scope_ref: domain.domain_boundary_ref,
    source_data_classes: domain.data_classes,
    forbidden_data_classes: domain.forbidden_data_classes,
    cross_domain_handoff_allowed_now: false,
    raw_material_forwarding_allowed_now: false,
    secret_forwarding_allowed_now: false,
    subagent_runtime_spawn_allowed_now: false,
    evidence_ref: `evidence.platform.agent.delegation.handoff.${domain.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_delegation_handoff",
    hard_gate_ref: `gate.platform.agent.delegation.handoff.${domain.domain_id}`,
    responsible_owner: domain.responsible_owner,
    next_allowed_action: "attach handoff channel to dry-run simulation and operator surface",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildZenddDelegationRows(candidatePacketRows) {
  return candidatePacketRows.map((packet, index) => ({
    schema_version: "agent-zendd-delegation-packet-row.v1",
    row_id: `agent-zendd-delegation-packet.row.${String(index + 1).padStart(2, "0")}`,
    delegation_packet_id: `delegation.packet.${packet.candidate_packet_type}`,
    candidate_packet_id: packet.candidate_packet_id,
    candidate_packet_type: packet.candidate_packet_type,
    domain_id: "project.zendd",
    current_verdict: "pass",
    delegation_packet_status: "handoff_contract_ready_not_executed",
    source_candidate_packet_ref: packet.row_id,
    source_evidence_ref: packet.evidence_ref,
    reviewer_ref: packet.reviewer_ref,
    hard_gate_ref: `gate.platform.agent.delegation.zendd.${packet.candidate_packet_type}`,
    human_receipt_required_before_delegation: true,
    human_receipt_ref: `human_receipt.pending.agent.delegation.zendd.${packet.candidate_packet_type}`,
    rollback_target_ref: packet.rollback_target_ref,
    responsible_owner: packet.responsible_owner,
    next_allowed_action: "include delegation packet in dry-run simulation without spawning a subagent",
    subagent_spawn_allowed_now: false,
    command_execution_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    raw_client_or_vdr_forwarding_allowed_now: false,
    protected_action_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
    evidence_ref: `evidence.platform.agent.delegation.zendd.${packet.candidate_packet_type}`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildProtectedBlockRows() {
  return PROTECTED_DELEGATION_BLOCKS.map(([blockId, blockReason, nextAction], index) => ({
    schema_version: "agent-delegation-protected-block-row.v1",
    row_id: `agent-delegation-protected-block.row.${String(index + 1).padStart(2, "0")}`,
    protected_block_id: blockId,
    current_verdict: "blocked",
    block_reason: blockReason,
    evidence_ref: `evidence.platform.agent.delegation.block.${blockId}`,
    reviewer_ref: "reviewer.platform.agent_delegation_block",
    hard_gate_ref: `gate.platform.agent.delegation.block.${blockId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAction,
    documented_human_gate_ref: `human_gate.platform.agent.delegation.${blockId}`,
    subagent_spawn_allowed_now: false,
    autonomous_execution_allowed_now: false,
    background_loop_allowed_now: false,
    cross_domain_data_access_allowed_now: false,
    raw_secret_forwarding_allowed_now: false,
    raw_client_or_vdr_forwarding_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_start_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    final_pass_or_approval_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ roleRows, handoffRows, zenddDelegationRows, protectedBlockRows }) {
  const passRows = [
    ...roleRows.map((row) => passClaim("delegation_role", `claim.platform.agent.delegation.role.${row.domain_id}.${row.role_id}`, row)),
    ...handoffRows.map((row) => passClaim("delegation_handoff_channel", `claim.platform.agent.delegation.handoff.${row.domain_id}`, row)),
    ...zenddDelegationRows.map((row) => passClaim("zendd_delegation_packet", `claim.platform.agent.delegation.zendd.${row.candidate_packet_type}`, row)),
  ];
  const blockedRows = protectedBlockRows.map((row) => blockedClaim("delegation_protected_block", `claim.platform.agent.delegation.block.${row.protected_block_id}`, row));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-delegation-claim.row.${String(index + 1).padStart(2, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-delegation-claim-row.v1",
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
    schema_version: "agent-delegation-claim-row.v1",
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

function buildCloseoutRows({ zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows }) {
  const rows = [
    ["source_zendd_candidate_ready", zenddCandidateBridge.summary.platform_agent_zendd_candidate_bridge_status === "ready_for_agent_zendd_candidate_bridge", "source_agent_zendd_candidate_bridge_summary"],
    ["source_capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "source_agent_capability_registry_summary"],
    ["delegation_roles_ready", roleRows.length === 28 && roleRows.every((row) => row.current_verdict === "pass"), "agent_delegation_role_rows"],
    ["handoff_channels_ready", handoffRows.length === 7 && handoffRows.every((row) => row.current_verdict === "pass"), "agent_delegation_handoff_channel_rows"],
    ["zendd_delegation_packets_ready", zenddDelegationRows.length === 5 && zenddDelegationRows.every((row) => row.current_verdict === "pass"), "agent_zendd_delegation_packet_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 12 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "agent_delegation_protected_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_delegation_claim_rows"],
    ["subagent_execution_disabled", roleRows.every((row) => row.subagent_spawn_allowed_now === false) && zenddDelegationRows.every((row) => row.subagent_spawn_allowed_now === false), "agent_delegation_boundary"],
    ["cross_domain_and_raw_forwarding_disabled", handoffRows.every((row) => row.cross_domain_handoff_allowed_now === false && row.raw_material_forwarding_allowed_now === false), "agent_delegation_boundary"],
    ["final_authority_disabled", protectedBlockRows.some((row) => row.protected_block_id === "agent_final_approval_or_legal_judgment"), "agent_delegation_protected_block_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-delegation-closeout-row.v1",
    row_id: `agent-delegation-closeout.row.${String(index + 1).padStart(2, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.delegation.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_delegation_closeout",
    hard_gate_ref: `gate.platform.agent.delegation.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1194 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-delegation-contract-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    registry_command_name: REGISTRY_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    runtime_pilot_ledger_present: runtimePilotLedger.available,
    source_zendd_candidate_bridge_status: zenddCandidateBridge.summary.platform_agent_zendd_candidate_bridge_status,
    source_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    domain_count: capabilityRegistry.domain_agent_registry_rows.length,
    delegation_role_count: roleRows.length,
    handoff_channel_count: handoffRows.length,
    zendd_delegation_packet_count: zenddDelegationRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_zendd_candidate_bridge", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_delegation_contract", runtimePilotLedger.available && ["P1189-P1194", COMMAND_NAME, "Delegation/Subagent Contract"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_zendd_candidate_ready", zenddCandidateBridge.summary.platform_agent_zendd_candidate_bridge_status === "ready_for_agent_zendd_candidate_bridge", "source_agent_zendd_candidate_bridge_summary"],
    ["source_capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "source_agent_capability_registry_summary"],
    ["delegation_roles_ready", roleRows.length === 28 && roleRows.every((row) => row.current_verdict === "pass"), "agent_delegation_role_rows"],
    ["handoff_channels_ready", handoffRows.length === 7 && handoffRows.every((row) => row.current_verdict === "pass"), "agent_delegation_handoff_channel_rows"],
    ["zendd_delegation_packets_ready", zenddDelegationRows.length === 5 && zenddDelegationRows.every((row) => row.current_verdict === "pass"), "agent_zendd_delegation_packet_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 12 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "agent_delegation_protected_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_delegation_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_delegation_closeout_rows"],
    ["subagent_and_final_authority_disabled", roleRows.every((row) => row.subagent_spawn_allowed_now === false && row.final_pass_or_approval_allowed_now === false), "agent_delegation_boundary"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-delegation-gate-row.v1",
    row_id: `agent-delegation-gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.delegation.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_delegation_gate",
    hard_gate_ref: `gate.platform.agent.delegation.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1194 closeout`,
    unsafe_flags_false: true,
  }));
}

function buildBoundary({ generatedAt, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-delegation-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    delegation_role_count: roleRows.length,
    handoff_channel_count: handoffRows.length,
    zendd_delegation_packet_count: zenddDelegationRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    delegation_packet_generation_allowed: true,
    subagent_spawn_allowed_now: false,
    autonomous_execution_allowed_now: false,
    background_loop_allowed_now: false,
    tool_invocation_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_start_allowed_now: false,
    cross_domain_data_access_allowed_now: false,
    raw_secret_forwarding_allowed_now: false,
    raw_client_or_vdr_forwarding_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    final_pass_or_approval_allowed_now: false,
    legal_final_judgment_allowed_now: false,
    release_decision_allowed_now: false,
  };
}

function buildValidationItems({ zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All delegation contract gates must be ready."],
    ["source.zendd_candidate_ready", zenddCandidateBridge.summary.platform_agent_zendd_candidate_bridge_status === "ready_for_agent_zendd_candidate_bridge", "P1181-P1188 source must be ready."],
    ["source.capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "Capability registry source must be ready."],
    ["roles.ready", roleRows.length === 28 && roleRows.every((row) => row.current_verdict === "pass"), "Four delegation roles per domain must be ready."],
    ["handoff.ready", handoffRows.length === 7 && handoffRows.every((row) => row.current_verdict === "pass"), "One handoff channel per domain must be ready."],
    ["zendd.packets_ready", zenddDelegationRows.length === 5 && zenddDelegationRows.every((row) => row.current_verdict === "pass"), "Five Zendd delegation packets must be ready."],
    ["blocks.documented", protectedBlockRows.length === 12 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "Protected delegation blocks must be documented."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.false", allBoundaryUnsafeFlagsFalse(boundary), "P1189-P1194 must not spawn subagents, invoke tools, start services, forward raw data, execute protected actions, or create final authority."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_delegation_contract", passed, message));
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
    "subagent_spawn_allowed_now",
    "autonomous_execution_allowed_now",
    "background_loop_allowed_now",
    "tool_invocation_allowed_now",
    "terminal_execution_allowed_now",
    "mcp_connection_allowed_now",
    "api_server_start_allowed_now",
    "cron_start_allowed_now",
    "cross_domain_data_access_allowed_now",
    "raw_secret_forwarding_allowed_now",
    "raw_client_or_vdr_forwarding_allowed_now",
    "provider_secret_configuration_allowed_now",
    "direct_zendd_mutation_allowed_now",
    "protected_action_execution_allowed_now",
    "final_pass_or_approval_allowed_now",
    "legal_final_judgment_allowed_now",
    "release_decision_allowed_now",
  ].every((field) => boundary[field] === false);
}

function buildSummary({ zenddCandidateBridge, capabilityRegistry, roleRows, handoffRows, zenddDelegationRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_delegation_contract_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_zendd_candidate_bridge_status: zenddCandidateBridge.summary.platform_agent_zendd_candidate_bridge_status,
    source_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    domain_count: capabilityRegistry.domain_agent_registry_rows.length,
    delegation_role_count: roleRows.length,
    handoff_channel_count: handoffRows.length,
    zendd_delegation_packet_count: zenddDelegationRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    delegation_packet_generation_allowed: boundary.delegation_packet_generation_allowed,
    subagent_spawn_allowed_now: boundary.subagent_spawn_allowed_now,
    autonomous_execution_allowed_now: boundary.autonomous_execution_allowed_now,
    terminal_execution_allowed_now: boundary.terminal_execution_allowed_now,
    mcp_connection_allowed_now: boundary.mcp_connection_allowed_now,
    api_server_start_allowed_now: boundary.api_server_start_allowed_now,
    cron_start_allowed_now: boundary.cron_start_allowed_now,
    cross_domain_data_access_allowed_now: boundary.cross_domain_data_access_allowed_now,
    raw_secret_forwarding_allowed_now: boundary.raw_secret_forwarding_allowed_now,
    raw_client_or_vdr_forwarding_allowed_now: boundary.raw_client_or_vdr_forwarding_allowed_now,
    direct_zendd_mutation_allowed_now: boundary.direct_zendd_mutation_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    final_pass_or_approval_allowed_now: boundary.final_pass_or_approval_allowed_now,
    legal_final_judgment_allowed_now: boundary.legal_final_judgment_allowed_now,
    release_decision_allowed_now: boundary.release_decision_allowed_now,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Delegation Contract",
    "",
    `Status: ${result.summary.platform_agent_delegation_contract_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Delegation roles: ${result.summary.delegation_role_count}`,
    `Handoff channels: ${result.summary.handoff_channel_count}`,
    `Zendd delegation packets: ${result.summary.zendd_delegation_packet_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "Delegation contracts are ready for dry-run simulation only. No subagent spawn, tool invocation, terminal/MCP/API/cron start, raw forwarding, protected action execution, or Agent final authority is allowed.",
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
  const defaults = DEFAULT_PLATFORM_AGENT_DELEGATION_CONTRACT_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-delegation-contract.mjs [--check] [--out-dir DIR]\n\nCreates the P1189-P1194 Agent delegation/subagent contract without spawning subagents, invoking tools, starting services, forwarding raw data, executing protected actions, or granting Agent final authority.`);
}
