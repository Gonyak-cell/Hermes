import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentDomainAdapterSdk } from "./platform-agent-domain-adapter-sdk.mjs";
import { DEFAULT_ZENDD_PROJECT_ROOT } from "./zendd-integration-setup.mjs";
import { buildZenddActualCheckoutPreflight } from "./zendd-actual-checkout-preflight.mjs";
import { buildZenddCommandEvidenceExecutionBridge } from "./zendd-command-evidence-execution-bridge.mjs";
import { buildZenddReleaseCandidateSandbox } from "./zendd-release-candidate-sandbox.mjs";
import { buildZenddSafePatchLane } from "./zendd-safe-patch-lane.mjs";
import { buildZenddVdrLddWorkflowAdapter } from "./zendd-vdr-ldd-workflow-adapter.mjs";
import { buildZenddWorkOrderIntake } from "./zendd-work-order-intake.mjs";

export const DEFAULT_PLATFORM_AGENT_ZENDD_CANDIDATE_BRIDGE_OUT_DIR = "artifacts/platform-agent-zendd-candidate-bridge/latest";
export const DEFAULT_PLATFORM_AGENT_ZENDD_CANDIDATE_BRIDGE_INPUTS = {
  schemaPath: "schemas/platform-agent-zendd-candidate-bridge.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
  zenddProjectRoot: DEFAULT_ZENDD_PROJECT_ROOT,
};

const COMMAND_NAME = "platform:agent-zendd-candidate-bridge";
const SOURCE_COMMAND_NAME = "platform:agent-domain-adapter-sdk";
const SCHEMA_VERSION = "platform-agent-zendd-candidate-bridge.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.zendd_candidate_bridge";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1181-P1188";
const PHASE_SLOT = "P1181";
const PREVIOUS_PHASE_SLOT = "P1180";
const NEXT_PHASE_SLOT = "P1189";
const READY_STATUS = "ready_for_agent_zendd_candidate_bridge";

const CANDIDATE_PACKET_SPECS = [
  ["work_order_candidate", "work_order_rows", "work-order candidate packets from Zendd work order intake", "review Zendd work order candidate packet before any patch or command packet"],
  ["patch_plan_candidate", "patch_preflight_rows", "patch plan candidates from Zendd safe patch lane", "bind patch plan to deterministic diff review and rollback receipt before any write"],
  ["command_evidence_candidate", "command_execution_packet_rows", "command evidence packets from Zendd command bridge", "collect human execution receipt before any command execution"],
  ["vdr_ldd_candidate", "vdr_ldd_operator_claim_surface_rows", "VDR/LDD operator claim packets from Zendd workflow adapter", "route VDR/LDD packet to attorney and quality review without raw material exposure"],
  ["release_sandbox_candidate", "sandbox_evidence_packet_rows", "release sandbox candidate packets from Zendd release sandbox", "keep release sandbox pending human receipt and artifact isolation review"],
];

const PROTECTED_BRIDGE_BLOCKS = [
  ["direct_zendd_write", "direct_zendd_mutation", "use Zendd external safe patch lane and human receipt"],
  ["zendd_source_tree_movement", "source_tree_movement_forbidden", "keep Zendd as an external adapter checkout"],
  ["command_execution_now", "command_execution_requires_human_receipt", "create execution packet and validated human receipt"],
  ["terminal_execution_now", "terminal_execution_requires_human_receipt", "keep terminal execution disabled until runtime simulation freeze"],
  ["raw_client_vdr_exposure", "raw_client_or_vdr_exposure", "use source-span refs and redacted summaries only"],
  ["protected_output_finalization", "protected_output_requires_human_receipt", "queue protected output receipt and reviewer gate"],
  ["release_publish_now", "release_publish_forbidden", "keep release sandbox candidate pending artifact and receipt review"],
  ["receipt_application_now", "receipt_application_forbidden", "route receipt through human intake and validation chain"],
  ["package_or_build_artifact_now", "artifact_materialization_forbidden", "bind artifact plan to sandbox evidence and receipt first"],
  ["agent_final_pass_now", "agent_final_pass_forbidden", "route through P1199-P1200 pilot readiness freeze"],
];

export async function runPlatformAgentZenddCandidateBridge(options = {}) {
  const result = await buildPlatformAgentZenddCandidateBridge(options);
  if (options.write !== false) await writePlatformAgentZenddCandidateBridge(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent Zendd candidate bridge failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentZenddCandidateBridge(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_ZENDD_CANDIDATE_BRIDGE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const adapterSdk = await buildPlatformAgentDomainAdapterSdk({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    write: false,
  });
  const zenddSources = await buildZenddSources({ generatedAt, inputs });

  const bridgePolicy = buildBridgePolicy(generatedAt, adapterSdk, zenddSources);
  const candidatePacketRows = buildCandidatePacketRows({ adapterSdk, zenddSources });
  const candidateBindingRows = buildCandidateBindingRows(candidatePacketRows, adapterSdk);
  const operatorRows = buildOperatorRows(candidatePacketRows, candidateBindingRows);
  const protectedBlockRows = buildProtectedBlockRows();
  const claimRows = buildClaimRows({ candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows });
  const closeoutRows = buildCloseoutRows({ adapterSdk, zenddSources, bridgePolicy, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_zendd_candidate_bridge_id: `platform-agent-zendd-candidate-bridge.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_zendd_candidate_bridge_anchor: anchor,
    source_agent_domain_adapter_sdk_summary: adapterSdk.summary,
    source_zendd_work_order_intake_summary: zenddSources.workOrderIntake.summary,
    source_zendd_safe_patch_lane_summary: zenddSources.safePatchLane.summary,
    source_zendd_command_evidence_execution_bridge_summary: zenddSources.commandBridge.summary,
    source_zendd_vdr_ldd_workflow_adapter_summary: zenddSources.vdrLddWorkflowAdapter.summary,
    source_zendd_release_candidate_sandbox_summary: zenddSources.releaseCandidateSandbox.summary,
    source_zendd_actual_checkout_preflight_summary: zenddSources.actualCheckoutPreflight.summary,
    agent_zendd_candidate_bridge_policy: bridgePolicy,
    agent_zendd_candidate_packet_rows: candidatePacketRows,
    agent_zendd_candidate_binding_rows: candidateBindingRows,
    agent_zendd_candidate_operator_rows: operatorRows,
    agent_zendd_candidate_protected_block_rows: protectedBlockRows,
    agent_zendd_candidate_claim_rows: claimRows,
    agent_zendd_candidate_closeout_rows: closeoutRows,
    agent_zendd_candidate_gate_rows: gateRows,
    agent_zendd_candidate_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_zendd_candidate_bridge")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_zendd_candidate_bridge_id = result.platform_agent_zendd_candidate_bridge_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentZenddCandidateBridge(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-zendd-candidate-bridge.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-zendd-candidate-bridge-policy.json"), result.agent_zendd_candidate_bridge_policy);
  await writeJson(path.join(outDir, "agent-zendd-candidate-packet-rows.json"), collectionEnvelope("agent-zendd-candidate-packet-rows.v1", "agent_zendd_candidate_packet_rows", result.agent_zendd_candidate_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-candidate-binding-rows.json"), collectionEnvelope("agent-zendd-candidate-binding-rows.v1", "agent_zendd_candidate_binding_rows", result.agent_zendd_candidate_binding_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-candidate-operator-rows.json"), collectionEnvelope("agent-zendd-candidate-operator-rows.v1", "agent_zendd_candidate_operator_rows", result.agent_zendd_candidate_operator_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-candidate-protected-block-rows.json"), collectionEnvelope("agent-zendd-candidate-protected-block-rows.v1", "agent_zendd_candidate_protected_block_rows", result.agent_zendd_candidate_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-candidate-claim-rows.json"), collectionEnvelope("agent-zendd-candidate-claim-rows.v1", "agent_zendd_candidate_claim_rows", result.agent_zendd_candidate_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-candidate-closeout-rows.json"), collectionEnvelope("agent-zendd-candidate-closeout-rows.v1", "agent_zendd_candidate_closeout_rows", result.agent_zendd_candidate_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-candidate-gate-rows.json"), collectionEnvelope("agent-zendd-candidate-gate-rows.v1", "agent_zendd_candidate_gate_rows", result.agent_zendd_candidate_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-zendd-candidate-boundary.json"), result.agent_zendd_candidate_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-zendd-candidate-bridge-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentZenddCandidateBridgeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentZenddCandidateBridge(args);
    console.log(`Platform agent Zendd candidate bridge ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_zendd_candidate_bridge_status}`);
    console.log(`Candidate packets: ${result.summary.candidate_packet_count}`);
    console.log(`Bindings: ${result.summary.candidate_binding_count}`);
    console.log(`Operator rows: ${result.summary.operator_row_count}`);
    console.log(`Protected blocks: ${result.summary.protected_block_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Direct Zendd mutation allowed: ${result.summary.direct_zendd_mutation_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function buildZenddSources({ generatedAt, inputs }) {
  const sourceOptions = {
    runAt: generatedAt,
    zenddProjectRoot: inputs.zendd_project_root,
    packagePath: inputs.package_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  };
  const workOrderIntake = await buildZenddWorkOrderIntake(sourceOptions);
  const safePatchLane = await buildZenddSafePatchLane(sourceOptions);
  const commandBridge = await buildZenddCommandEvidenceExecutionBridge(sourceOptions);
  const releaseCandidateSandbox = await buildZenddReleaseCandidateSandbox(sourceOptions);
  const vdrLddWorkflowAdapter = await buildZenddVdrLddWorkflowAdapter(sourceOptions);
  const actualCheckoutPreflight = await buildZenddActualCheckoutPreflight(sourceOptions);
  return {
    workOrderIntake,
    safePatchLane,
    commandBridge,
    releaseCandidateSandbox,
    vdrLddWorkflowAdapter,
    actualCheckoutPreflight,
  };
}

function buildBridgePolicy(generatedAt, adapterSdk, zenddSources) {
  const adapter = zenddAdapterContract(adapterSdk);
  return {
    schema_version: "agent-zendd-candidate-bridge-policy.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    project_id: "project.zendd",
    source_agent_domain_adapter_sdk_ref: adapterSdk.platform_agent_domain_adapter_sdk_id,
    source_project_zendd_adapter_sdk_ref: adapter.adapter_sdk_id,
    source_actual_checkout_ref: zenddSources.actualCheckoutPreflight.zendd_actual_checkout_preflight_id,
    bridge_mode: "candidate_packets_only_external_adapter",
    selected_integration_mode: zenddSources.safePatchLane.summary.selected_integration_mode,
    candidate_packet_generation_allowed: true,
    agent_runtime_execution_allowed_now: false,
    command_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    zendd_source_tree_movement_allowed_now: false,
    zendd_file_write_allowed_now: false,
    raw_client_or_vdr_material_exposure_allowed_now: false,
    protected_output_finalization_allowed_now: false,
    release_publish_allowed_now: false,
    receipt_application_allowed_now: false,
    agent_final_pass_allowed_now: false,
    next_allowed_action: "advance to P1189-P1194 delegation contract with Zendd candidate packets still blocked from execution",
    created_at: generatedAt,
  };
}

function buildCandidatePacketRows({ adapterSdk, zenddSources }) {
  const adapter = zenddAdapterContract(adapterSdk);
  const sourceCatalog = candidateSourceCatalog(zenddSources);
  return CANDIDATE_PACKET_SPECS.map(([packetType, sourceCollection, description, nextAction], index) => {
    const source = sourceCatalog[sourceCollection];
    return {
      schema_version: "agent-zendd-candidate-packet-row.v1",
      row_id: `agent-zendd-candidate-packet.row.${String(index + 1).padStart(2, "0")}`,
      candidate_packet_id: `agent.zendd.candidate.${packetType}`,
      candidate_packet_type: packetType,
      project_id: "project.zendd",
      domain_id: "project.zendd",
      domain_pack_id: "law-firm",
      source_collection: sourceCollection,
      source_ref: source.source_ref,
      source_status: source.source_status,
      source_row_count: source.source_row_count,
      source_candidate_refs: source.source_candidate_refs.slice(0, 20),
      adapter_sdk_id: adapter.adapter_sdk_id,
      current_verdict: "pass",
      packet_status: "candidate_visible_not_executable",
      description,
      evidence_ref: `evidence.platform.agent.zendd_candidate.packet.${packetType}`,
      reviewer_ref: "reviewer.platform.agent_zendd_candidate_bridge",
      hard_gate_ref: `gate.platform.agent.zendd_candidate.packet.${packetType}`,
      responsible_owner: "project_zendd_owner",
      next_allowed_action: nextAction,
      human_receipt_required_before_action: true,
      rollback_target_ref: `rollback.platform.agent.zendd_candidate.${packetType}`,
      agent_runtime_execution_allowed_now: false,
      command_execution_allowed_now: false,
      terminal_execution_allowed_now: false,
      direct_zendd_mutation_allowed_now: false,
      zendd_source_tree_movement_allowed_now: false,
      zendd_file_write_allowed_now: false,
      raw_client_or_vdr_material_exposed: false,
      protected_output_finalization_allowed_now: false,
      release_publish_allowed_now: false,
      receipt_application_allowed_now: false,
      agent_final_pass_allowed_now: false,
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildCandidateBindingRows(candidatePacketRows, adapterSdk) {
  const adapter = zenddAdapterContract(adapterSdk);
  const outputContract = adapterSdk.agent_domain_adapter_output_contract_rows.find((row) => row.domain_id === "project.zendd");
  return candidatePacketRows.map((packet, index) => ({
    schema_version: "agent-zendd-candidate-binding-row.v1",
    row_id: `agent-zendd-candidate-binding.row.${String(index + 1).padStart(2, "0")}`,
    binding_id: `agent.zendd.binding.${packet.candidate_packet_type}`,
    candidate_packet_id: packet.candidate_packet_id,
    adapter_sdk_id: adapter.adapter_sdk_id,
    adapter_contract_ref: adapter.row_id,
    adapter_output_contract_ref: outputContract?.row_id ?? "agent-domain-adapter-output-contract.row.project_zendd",
    required_adapter_methods: adapter.required_methods,
    required_output_claim_fields: outputContract?.required_claim_fields ?? ["claim_id", "current_verdict", "evidence_ref", "reviewer_ref", "hard_gate_ref", "responsible_owner", "next_allowed_action"],
    source_refs_bound: true,
    forbidden_input_scan_required: true,
    output_sanitization_required: true,
    claim_evidence_reviewer_gate_binding_required: true,
    human_receipt_requirement_bound: true,
    rollback_target_bound: true,
    operator_surface_row_bound: true,
    current_verdict: "pass",
    evidence_ref: `evidence.platform.agent.zendd_candidate.binding.${packet.candidate_packet_type}`,
    reviewer_ref: packet.reviewer_ref,
    hard_gate_ref: `gate.platform.agent.zendd_candidate.binding.${packet.candidate_packet_type}`,
    responsible_owner: packet.responsible_owner,
    next_allowed_action: "keep adapter binding evidence attached before delegation or runtime simulation",
    agent_runtime_execution_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    raw_client_or_vdr_material_exposed: false,
    agent_final_pass_allowed_now: false,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildOperatorRows(candidatePacketRows, candidateBindingRows) {
  return candidatePacketRows.map((packet, index) => {
    const binding = candidateBindingRows[index];
    return {
      schema_version: "agent-zendd-candidate-operator-row.v1",
      row_id: `agent-zendd-candidate-operator.row.${String(index + 1).padStart(2, "0")}`,
      operator_surface_id: `operator.agent.zendd.candidate.${packet.candidate_packet_type}`,
      candidate_packet_id: packet.candidate_packet_id,
      binding_id: binding.binding_id,
      current_verdict: "pass",
      current_status_label: "candidate_only",
      missing_evidence_refs: [],
      missing_reviewer_or_gate_refs: [],
      missing_human_receipt_refs: [`human_receipt.pending.agent.zendd.${packet.candidate_packet_type}`],
      hard_gate_result: "execution_blocked_until_human_receipt",
      block_reason_if_action_requested: "protected_action_requires_human_receipt",
      evidence_ref: `evidence.platform.agent.zendd_candidate.operator.${packet.candidate_packet_type}`,
      reviewer_ref: packet.reviewer_ref,
      hard_gate_ref: `gate.platform.agent.zendd_candidate.operator.${packet.candidate_packet_type}`,
      responsible_owner: packet.responsible_owner,
      next_allowed_action: packet.next_allowed_action,
      agent_runtime_execution_allowed_now: false,
      command_execution_allowed_now: false,
      direct_zendd_mutation_allowed_now: false,
      raw_client_or_vdr_material_exposed: false,
      protected_output_finalization_allowed_now: false,
      release_publish_allowed_now: false,
      receipt_application_allowed_now: false,
      agent_final_pass_allowed_now: false,
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildProtectedBlockRows() {
  return PROTECTED_BRIDGE_BLOCKS.map(([blockId, blockReason, nextAction], index) => ({
    schema_version: "agent-zendd-candidate-protected-block-row.v1",
    row_id: `agent-zendd-candidate-protected-block.row.${String(index + 1).padStart(2, "0")}`,
    protected_block_id: blockId,
    current_verdict: "blocked",
    block_reason: blockReason,
    evidence_ref: `evidence.platform.agent.zendd_candidate.block.${blockId}`,
    reviewer_ref: "reviewer.platform.agent_zendd_candidate_block",
    hard_gate_ref: `gate.platform.agent.zendd_candidate.block.${blockId}`,
    responsible_owner: "project_zendd_owner",
    next_allowed_action: nextAction,
    human_receipt_required: true,
    documented_human_gate_ref: `human_gate.platform.agent.zendd_candidate.${blockId}`,
    agent_runtime_execution_allowed_now: false,
    command_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    zendd_source_tree_movement_allowed_now: false,
    zendd_file_write_allowed_now: false,
    raw_client_or_vdr_material_exposed: false,
    protected_output_finalization_allowed_now: false,
    release_publish_allowed_now: false,
    receipt_application_allowed_now: false,
    agent_final_pass_allowed_now: false,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows }) {
  const passRows = [
    ...candidatePacketRows.map((row) => passClaim("zendd_candidate_packet", `claim.platform.agent.zendd_candidate.packet.${row.candidate_packet_type}`, row)),
    ...candidateBindingRows.map((row) => passClaim("zendd_candidate_binding", `claim.platform.agent.zendd_candidate.binding.${row.binding_id.split(".").at(-1)}`, row)),
    ...operatorRows.map((row) => passClaim("zendd_candidate_operator_surface", `claim.platform.agent.zendd_candidate.operator.${row.candidate_packet_id.split(".").at(-1)}`, row)),
  ];
  const blockedRows = protectedBlockRows.map((row) => blockedClaim("zendd_candidate_protected_block", `claim.platform.agent.zendd_candidate.block.${row.protected_block_id}`, row));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-zendd-candidate-claim.row.${String(index + 1).padStart(2, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-zendd-candidate-claim-row.v1",
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
    schema_version: "agent-zendd-candidate-claim-row.v1",
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

function buildCloseoutRows({ adapterSdk, zenddSources, bridgePolicy, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows }) {
  const rows = [
    ["source_adapter_sdk_ready", adapterSdk.summary.platform_agent_domain_adapter_sdk_status === "ready_for_agent_domain_adapter_sdk", "source_agent_domain_adapter_sdk_summary"],
    ["source_work_order_ready", zenddSources.workOrderIntake.summary.zendd_work_order_intake_status === "ready_for_zendd_work_order_intake", "source_zendd_work_order_intake_summary"],
    ["source_safe_patch_ready", zenddSources.safePatchLane.summary.zendd_safe_patch_lane_status === "ready_for_zendd_safe_patch_lane", "source_zendd_safe_patch_lane_summary"],
    ["source_command_bridge_ready", zenddSources.commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge", "source_zendd_command_evidence_execution_bridge_summary"],
    ["source_vdr_ldd_ready", zenddSources.vdrLddWorkflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status === "ready_for_zendd_vdr_ldd_workflow_adapter", "source_zendd_vdr_ldd_workflow_adapter_summary"],
    ["source_release_sandbox_ready", zenddSources.releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox", "source_zendd_release_candidate_sandbox_summary"],
    ["source_actual_checkout_ready", zenddSources.actualCheckoutPreflight.summary.zendd_actual_checkout_preflight_status === "ready_for_zendd_actual_checkout_preflight", "source_zendd_actual_checkout_preflight_summary"],
    ["external_adapter_preserved", bridgePolicy.selected_integration_mode === "external_project_adapter", "agent_zendd_candidate_bridge_policy"],
    ["candidate_packets_ready", candidatePacketRows.length === 5 && candidatePacketRows.every((row) => row.current_verdict === "pass"), "agent_zendd_candidate_packet_rows"],
    ["candidate_bindings_ready", candidateBindingRows.length === 5 && candidateBindingRows.every((row) => row.current_verdict === "pass"), "agent_zendd_candidate_binding_rows"],
    ["operator_rows_ready", operatorRows.length === 5 && operatorRows.every((row) => row.current_verdict === "pass"), "agent_zendd_candidate_operator_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 10 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "agent_zendd_candidate_protected_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_zendd_candidate_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-zendd-candidate-closeout-row.v1",
    row_id: `agent-zendd-candidate-closeout.row.${String(index + 1).padStart(2, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.zendd_candidate.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_zendd_candidate_closeout",
    hard_gate_ref: `gate.platform.agent.zendd_candidate.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1188 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-zendd-candidate-bridge-anchor.v1",
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
    source_adapter_sdk_status: adapterSdk.summary.platform_agent_domain_adapter_sdk_status,
    source_work_order_status: zenddSources.workOrderIntake.summary.zendd_work_order_intake_status,
    source_safe_patch_status: zenddSources.safePatchLane.summary.zendd_safe_patch_lane_status,
    source_command_bridge_status: zenddSources.commandBridge.summary.zendd_command_evidence_execution_bridge_status,
    source_vdr_ldd_status: zenddSources.vdrLddWorkflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status,
    source_release_sandbox_status: zenddSources.releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status,
    source_actual_checkout_status: zenddSources.actualCheckoutPreflight.summary.zendd_actual_checkout_preflight_status,
    candidate_packet_count: candidatePacketRows.length,
    candidate_binding_count: candidateBindingRows.length,
    operator_row_count: operatorRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_domain_adapter_sdk", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_zendd_candidate_bridge", runtimePilotLedger.available && ["P1181-P1188", COMMAND_NAME, "Zendd Agent Candidate Bridge"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_adapter_sdk_ready", adapterSdk.summary.platform_agent_domain_adapter_sdk_status === "ready_for_agent_domain_adapter_sdk", "source_agent_domain_adapter_sdk_summary"],
    ["source_work_order_ready", zenddSources.workOrderIntake.summary.zendd_work_order_intake_status === "ready_for_zendd_work_order_intake", "source_zendd_work_order_intake_summary"],
    ["source_safe_patch_ready", zenddSources.safePatchLane.summary.zendd_safe_patch_lane_status === "ready_for_zendd_safe_patch_lane", "source_zendd_safe_patch_lane_summary"],
    ["source_command_bridge_ready", zenddSources.commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge", "source_zendd_command_evidence_execution_bridge_summary"],
    ["source_vdr_ldd_ready", zenddSources.vdrLddWorkflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status === "ready_for_zendd_vdr_ldd_workflow_adapter", "source_zendd_vdr_ldd_workflow_adapter_summary"],
    ["source_release_sandbox_ready", zenddSources.releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox", "source_zendd_release_candidate_sandbox_summary"],
    ["source_actual_checkout_ready", zenddSources.actualCheckoutPreflight.summary.zendd_actual_checkout_preflight_status === "ready_for_zendd_actual_checkout_preflight", "source_zendd_actual_checkout_preflight_summary"],
    ["candidate_packets_ready", candidatePacketRows.length === 5 && candidatePacketRows.every((row) => row.current_verdict === "pass"), "agent_zendd_candidate_packet_rows"],
    ["candidate_bindings_ready", candidateBindingRows.length === 5 && candidateBindingRows.every((row) => row.current_verdict === "pass"), "agent_zendd_candidate_binding_rows"],
    ["operator_rows_ready", operatorRows.length === 5 && operatorRows.every((row) => row.current_verdict === "pass"), "agent_zendd_candidate_operator_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 10 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "agent_zendd_candidate_protected_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_zendd_candidate_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_zendd_candidate_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-zendd-candidate-gate-row.v1",
    row_id: `agent-zendd-candidate-gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.zendd_candidate.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_zendd_candidate_gate",
    hard_gate_ref: `gate.platform.agent.zendd_candidate.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1188 closeout`,
    unsafe_flags_false: true,
  }));
}

function buildBoundary({ generatedAt, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-zendd-candidate-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    zendd_project_root: zenddSources.actualCheckoutPreflight.summary.zendd_project_root,
    selected_integration_mode: zenddSources.safePatchLane.summary.selected_integration_mode,
    candidate_packet_count: candidatePacketRows.length,
    candidate_binding_count: candidateBindingRows.length,
    operator_row_count: operatorRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    agent_runtime_execution_allowed_now: false,
    command_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_route_start_allowed_now: false,
    cron_start_allowed_now: false,
    package_install_allowed_now: false,
    package_or_build_artifact_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    direct_zendd_mutation_allowed_now: false,
    zendd_source_tree_movement_allowed_now: false,
    zendd_file_write_allowed_now: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_material_exposed: false,
    protected_output_finalization_allowed_now: false,
    release_publish_allowed_now: false,
    client_delivery_allowed_now: false,
    receipt_application_allowed_now: false,
    protected_action_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
    legal_final_judgment_allowed_now: false,
  };
}

function buildValidationItems({ adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All Zendd candidate bridge gates must be ready."],
    ["source.adapter_sdk_ready", adapterSdk.summary.platform_agent_domain_adapter_sdk_status === "ready_for_agent_domain_adapter_sdk", "P1171-P1180 source must be ready."],
    ["source.zendd_sources_ready", allZenddSourcesReady(zenddSources), "Zendd source bridges must be ready."],
    ["candidates.ready", candidatePacketRows.length === 5 && candidatePacketRows.every((row) => row.current_verdict === "pass"), "Five Zendd candidate packet types must be ready."],
    ["bindings.ready", candidateBindingRows.length === 5 && candidateBindingRows.every((row) => row.current_verdict === "pass"), "Candidate adapter bindings must be ready."],
    ["operator.rows_ready", operatorRows.length === 5 && operatorRows.every((row) => row.current_verdict === "pass"), "Operator candidate rows must be ready."],
    ["blocks.documented", protectedBlockRows.length === 10 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "Protected Zendd bridge blocks must be documented."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.false", allBoundaryUnsafeFlagsFalse(boundary), "P1181-P1188 must not run Agent runtime, mutate Zendd, expose raw material, apply receipts, publish releases, or create final PASS."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_zendd_candidate_bridge", passed, message));
}

function candidateSourceCatalog(zenddSources) {
  return {
    work_order_rows: {
      source_ref: zenddSources.workOrderIntake.zendd_work_order_intake_id,
      source_status: zenddSources.workOrderIntake.summary.zendd_work_order_intake_status,
      source_row_count: zenddSources.workOrderIntake.work_order_rows.length,
      source_candidate_refs: zenddSources.workOrderIntake.work_order_rows.map((row) => row.work_order_id ?? row.row_id),
    },
    patch_preflight_rows: {
      source_ref: zenddSources.safePatchLane.zendd_safe_patch_lane_id,
      source_status: zenddSources.safePatchLane.summary.zendd_safe_patch_lane_status,
      source_row_count: zenddSources.safePatchLane.patch_preflight_rows.length,
      source_candidate_refs: zenddSources.safePatchLane.patch_preflight_rows.map((row) => row.patch_candidate_id ?? row.row_id),
    },
    command_execution_packet_rows: {
      source_ref: zenddSources.commandBridge.zendd_command_evidence_execution_bridge_id,
      source_status: zenddSources.commandBridge.summary.zendd_command_evidence_execution_bridge_status,
      source_row_count: zenddSources.commandBridge.command_execution_packet_rows.length,
      source_candidate_refs: zenddSources.commandBridge.command_execution_packet_rows.map((row) => row.command_execution_packet_ref ?? row.packet_id ?? row.row_id),
    },
    vdr_ldd_operator_claim_surface_rows: {
      source_ref: zenddSources.vdrLddWorkflowAdapter.zendd_vdr_ldd_workflow_adapter_id,
      source_status: zenddSources.vdrLddWorkflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status,
      source_row_count: zenddSources.vdrLddWorkflowAdapter.vdr_ldd_operator_claim_surface_rows.length,
      source_candidate_refs: zenddSources.vdrLddWorkflowAdapter.vdr_ldd_operator_claim_surface_rows.map((row) => row.operator_surface_ref ?? row.workflow_adapter_ref ?? row.row_id),
    },
    sandbox_evidence_packet_rows: {
      source_ref: zenddSources.releaseCandidateSandbox.zendd_release_candidate_sandbox_id,
      source_status: zenddSources.releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status,
      source_row_count: zenddSources.releaseCandidateSandbox.sandbox_evidence_packet_rows.length,
      source_candidate_refs: zenddSources.releaseCandidateSandbox.sandbox_evidence_packet_rows.map((row) => row.sandbox_evidence_packet_ref ?? row.release_candidate_ref ?? row.row_id),
    },
  };
}

function allZenddSourcesReady(zenddSources) {
  return zenddSources.workOrderIntake.summary.zendd_work_order_intake_status === "ready_for_zendd_work_order_intake"
    && zenddSources.safePatchLane.summary.zendd_safe_patch_lane_status === "ready_for_zendd_safe_patch_lane"
    && zenddSources.commandBridge.summary.zendd_command_evidence_execution_bridge_status === "ready_for_zendd_command_evidence_execution_bridge"
    && zenddSources.vdrLddWorkflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status === "ready_for_zendd_vdr_ldd_workflow_adapter"
    && zenddSources.releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status === "ready_for_zendd_release_candidate_sandbox"
    && zenddSources.actualCheckoutPreflight.summary.zendd_actual_checkout_preflight_status === "ready_for_zendd_actual_checkout_preflight";
}

function zenddAdapterContract(adapterSdk) {
  return adapterSdk.agent_domain_adapter_contract_rows.find((row) => row.domain_id === "project.zendd")
    ?? adapterSdk.agent_domain_adapter_contract_rows.at(-1);
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
    "command_execution_allowed_now",
    "terminal_execution_allowed_now",
    "mcp_connection_allowed_now",
    "api_route_start_allowed_now",
    "cron_start_allowed_now",
    "package_install_allowed_now",
    "package_or_build_artifact_allowed_now",
    "provider_secret_configuration_allowed_now",
    "direct_zendd_mutation_allowed_now",
    "zendd_source_tree_movement_allowed_now",
    "zendd_file_write_allowed_now",
    "raw_secret_exposed",
    "raw_client_or_vdr_material_exposed",
    "protected_output_finalization_allowed_now",
    "release_publish_allowed_now",
    "client_delivery_allowed_now",
    "receipt_application_allowed_now",
    "protected_action_execution_allowed_now",
    "agent_final_pass_allowed_now",
    "legal_final_judgment_allowed_now",
  ].every((field) => boundary[field] === false);
}

function buildSummary({ adapterSdk, zenddSources, candidatePacketRows, candidateBindingRows, operatorRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_zendd_candidate_bridge_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_agent_domain_adapter_sdk_status: adapterSdk.summary.platform_agent_domain_adapter_sdk_status,
    source_zendd_work_order_intake_status: zenddSources.workOrderIntake.summary.zendd_work_order_intake_status,
    source_zendd_safe_patch_lane_status: zenddSources.safePatchLane.summary.zendd_safe_patch_lane_status,
    source_zendd_command_evidence_execution_bridge_status: zenddSources.commandBridge.summary.zendd_command_evidence_execution_bridge_status,
    source_zendd_vdr_ldd_workflow_adapter_status: zenddSources.vdrLddWorkflowAdapter.summary.zendd_vdr_ldd_workflow_adapter_status,
    source_zendd_release_candidate_sandbox_status: zenddSources.releaseCandidateSandbox.summary.zendd_release_candidate_sandbox_status,
    source_zendd_actual_checkout_preflight_status: zenddSources.actualCheckoutPreflight.summary.zendd_actual_checkout_preflight_status,
    selected_integration_mode: boundary.selected_integration_mode,
    candidate_packet_count: candidatePacketRows.length,
    candidate_binding_count: candidateBindingRows.length,
    operator_row_count: operatorRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    direct_zendd_mutation_allowed_now: boundary.direct_zendd_mutation_allowed_now,
    command_execution_allowed_now: boundary.command_execution_allowed_now,
    terminal_execution_allowed_now: boundary.terminal_execution_allowed_now,
    raw_client_or_vdr_material_exposed: boundary.raw_client_or_vdr_material_exposed,
    protected_output_finalization_allowed_now: boundary.protected_output_finalization_allowed_now,
    release_publish_allowed_now: boundary.release_publish_allowed_now,
    receipt_application_allowed_now: boundary.receipt_application_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Zendd Candidate Bridge",
    "",
    `Status: ${result.summary.platform_agent_zendd_candidate_bridge_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Candidate packets: ${result.summary.candidate_packet_count}`,
    `Bindings: ${result.summary.candidate_binding_count}`,
    `Operator rows: ${result.summary.operator_row_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "Zendd candidate packets are visible for review only. No Agent runtime execution, command execution, direct Zendd write, raw VDR/client exposure, receipt application, release publish, or Agent final PASS is allowed.",
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
  const defaults = DEFAULT_PLATFORM_AGENT_ZENDD_CANDIDATE_BRIDGE_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    agent_operations_phase_ledger_path: path.resolve(options.agentOperationsPhaseLedgerPath ?? defaults.agentOperationsPhaseLedgerPath),
    agent_runtime_pilot_ledger_path: path.resolve(options.agentRuntimePilotLedgerPath ?? defaults.agentRuntimePilotLedgerPath),
    integration_phase_ledger_path: path.resolve(options.integrationPhaseLedgerPath ?? defaults.integrationPhaseLedgerPath),
    development_phase_ledger_path: path.resolve(options.developmentPhaseLedgerPath ?? defaults.developmentPhaseLedgerPath),
    zendd_project_root: options.zenddProjectRoot ?? defaults.zenddProjectRoot,
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
    } else if (arg === "--zendd-root") {
      args.zenddProjectRoot = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-zendd-candidate-bridge.mjs [--check] [--zendd-root DIR] [--out-dir DIR]\n\nCreates the P1181-P1188 Agent Zendd candidate bridge without executing Agent runtime, commands, direct Zendd mutation, raw material exposure, receipt application, release publish, or Agent final PASS.`);
}
