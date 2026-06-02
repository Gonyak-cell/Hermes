import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentCapabilityRegistry } from "./platform-agent-capability-registry.mjs";
import { buildPlatformAgentToolPolicyMatrix } from "./platform-agent-tool-policy-matrix.mjs";

export const DEFAULT_PLATFORM_AGENT_DOMAIN_ADAPTER_SDK_OUT_DIR = "artifacts/platform-agent-domain-adapter-sdk/latest";
export const DEFAULT_PLATFORM_AGENT_DOMAIN_ADAPTER_SDK_INPUTS = {
  schemaPath: "schemas/platform-agent-domain-adapter-sdk.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-domain-adapter-sdk";
const SOURCE_COMMAND_NAME = "platform:agent-tool-policy-matrix";
const REGISTRY_COMMAND_NAME = "platform:agent-capability-registry";
const SCHEMA_VERSION = "platform-agent-domain-adapter-sdk.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.domain_adapter_sdk";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1171-P1180";
const PHASE_SLOT = "P1171";
const PREVIOUS_PHASE_SLOT = "P1170";
const NEXT_PHASE_SLOT = "P1181";
const READY_STATUS = "ready_for_agent_domain_adapter_sdk";

const SDK_METHOD_SPECS = [
  ["normalize_input_refs", "Normalize domain source refs without reading raw restricted payloads."],
  ["enforce_forbidden_inputs", "Block raw secret, raw client, raw VDR, and cross-domain inputs."],
  ["draft_agent_prompt_packet", "Draft prompt packets from refs and policy rows only."],
  ["sanitize_agent_output", "Remove raw material, pass-like claims, and unsafe tool suggestions."],
  ["bind_claim_evidence_reviewer_gate", "Bind every output claim to evidence, reviewer, and hard gate refs."],
  ["attach_human_receipt_requirement", "Attach receipt requirements for protected outputs and actions."],
  ["bind_rollback_target", "Attach rollback target refs for any future mutation or execution packet."],
  ["emit_operator_surface_row", "Emit operator-visible verdict, block reason, missing input, and next action."],
];

const PROTECTED_ADAPTER_BLOCKS = [
  ["raw_secret_input", "raw_secret_access", "replace raw secret with secret-handle evidence ref"],
  ["raw_client_or_vdr_input", "raw_client_or_vdr_exposure", "replace raw material with source-span refs"],
  ["unscoped_domain_input", "domain_scope_missing", "bind domain_id and source refs before adapter use"],
  ["adapter_direct_mutation", "domain_mutation_forbidden", "emit work order and receipt packet instead"],
  ["adapter_direct_zendd_write", "direct_zendd_mutation", "use Zendd external safe patch lane"],
  ["adapter_final_pass", "agent_final_pass_forbidden", "route through readiness freeze"],
  ["adapter_missing_reviewer_gate", "missing_reviewer_or_gate", "attach reviewer_ref and hard_gate_ref"],
  ["adapter_missing_human_receipt", "missing_validated_human_receipt", "collect scoped human receipt for protected outputs"],
];

export async function runPlatformAgentDomainAdapterSdk(options = {}) {
  const result = await buildPlatformAgentDomainAdapterSdk(options);
  if (options.write !== false) await writePlatformAgentDomainAdapterSdk(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent domain adapter SDK failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentDomainAdapterSdk(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_DOMAIN_ADAPTER_SDK_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const toolPolicyMatrix = await buildPlatformAgentToolPolicyMatrix({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    write: false,
  });
  const capabilityRegistry = await buildPlatformAgentCapabilityRegistry({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });

  const registryAdapterRows = capabilityRegistry.domain_agent_adapter_sdk_rows;
  const adapterContractRows = buildAdapterContractRows(registryAdapterRows, toolPolicyMatrix);
  const methodRows = buildMethodRows(adapterContractRows);
  const outputContractRows = buildOutputContractRows(adapterContractRows);
  const protectedBlockRows = buildProtectedBlockRows();
  const claimRows = buildClaimRows({ adapterContractRows, methodRows, outputContractRows, protectedBlockRows });
  const closeoutRows = buildCloseoutRows({ toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_domain_adapter_sdk_id: `platform-agent-domain-adapter-sdk.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_domain_adapter_sdk_anchor: anchor,
    source_agent_tool_policy_matrix_summary: toolPolicyMatrix.summary,
    source_agent_capability_registry_summary: capabilityRegistry.summary,
    agent_domain_adapter_contract_rows: adapterContractRows,
    agent_domain_adapter_method_rows: methodRows,
    agent_domain_adapter_output_contract_rows: outputContractRows,
    agent_domain_adapter_protected_block_rows: protectedBlockRows,
    agent_domain_adapter_claim_rows: claimRows,
    agent_domain_adapter_closeout_rows: closeoutRows,
    agent_domain_adapter_gate_rows: gateRows,
    agent_domain_adapter_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_domain_adapter_sdk")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_domain_adapter_sdk_id = result.platform_agent_domain_adapter_sdk_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentDomainAdapterSdk(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-domain-adapter-sdk.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-domain-adapter-contract-rows.json"), collectionEnvelope("agent-domain-adapter-contract-rows.v1", "agent_domain_adapter_contract_rows", result.agent_domain_adapter_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-adapter-method-rows.json"), collectionEnvelope("agent-domain-adapter-method-rows.v1", "agent_domain_adapter_method_rows", result.agent_domain_adapter_method_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-adapter-output-contract-rows.json"), collectionEnvelope("agent-domain-adapter-output-contract-rows.v1", "agent_domain_adapter_output_contract_rows", result.agent_domain_adapter_output_contract_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-adapter-protected-block-rows.json"), collectionEnvelope("agent-domain-adapter-protected-block-rows.v1", "agent_domain_adapter_protected_block_rows", result.agent_domain_adapter_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-adapter-claim-rows.json"), collectionEnvelope("agent-domain-adapter-claim-rows.v1", "agent_domain_adapter_claim_rows", result.agent_domain_adapter_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-adapter-closeout-rows.json"), collectionEnvelope("agent-domain-adapter-closeout-rows.v1", "agent_domain_adapter_closeout_rows", result.agent_domain_adapter_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-adapter-gate-rows.json"), collectionEnvelope("agent-domain-adapter-gate-rows.v1", "agent_domain_adapter_gate_rows", result.agent_domain_adapter_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-adapter-boundary.json"), result.agent_domain_adapter_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-domain-adapter-sdk-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentDomainAdapterSdkCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentDomainAdapterSdk(args);
    console.log(`Platform agent domain adapter SDK ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_domain_adapter_sdk_status}`);
    console.log(`Adapters: ${result.summary.adapter_contract_count}`);
    console.log(`Methods: ${result.summary.method_count}`);
    console.log(`Output contracts: ${result.summary.output_contract_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Direct mutation allowed: ${result.summary.direct_domain_mutation_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAdapterContractRows(registryAdapterRows, toolPolicyMatrix) {
  return registryAdapterRows.map((row, index) => ({
    schema_version: "agent-domain-adapter-contract-row.v1",
    row_id: `agent-domain-adapter-contract.row.${String(index + 1).padStart(3, "0")}`,
    adapter_sdk_id: row.adapter_sdk_id,
    domain_id: row.domain_id,
    domain_pack_id: row.domain_pack_id,
    current_verdict: "pass",
    source_registry_adapter_ref: row.row_id,
    source_tool_policy_matrix_ref: toolPolicyMatrix.platform_agent_tool_policy_matrix_id,
    required_methods: SDK_METHOD_SPECS.map(([methodId]) => methodId),
    required_input_shape_fields: ["domain_id", "capability_id", "run_ref", "source_refs", "tool_policy_refs", "forbidden_input_scan"],
    required_output_shape_fields: ["claim_id", "current_verdict", "evidence_ref", "reviewer_ref", "hard_gate_ref", "next_allowed_action", "operator_surface_row"],
    forbidden_input_fields: ["raw_secret", "raw_client_payload", "raw_vdr_payload", "cross_domain_payload"],
    forbidden_output_fields: ["final_pass", "approved_by_agent", "raw_secret", "raw_client_payload", "raw_vdr_payload", "unreviewed_tool_execution"],
    tool_policy_matrix_required: true,
    claim_binding_required: true,
    evidence_binding_required: true,
    reviewer_gate_binding_required: true,
    protected_receipt_binding_required: true,
    rollback_binding_required: true,
    operator_surface_binding_required: true,
    direct_domain_mutation_allowed_now: false,
    adapter_execution_allowed_now: false,
    evidence_ref: `evidence.platform.agent.adapter_sdk.contract.${row.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_adapter_sdk_contract",
    hard_gate_ref: `gate.platform.agent.adapter_sdk.contract.${row.domain_id}`,
    responsible_owner: row.responsible_owner,
    next_allowed_action: "implement concrete adapter methods as deterministic wrappers before runtime-backed use",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildMethodRows(adapterContractRows) {
  const rows = [];
  for (const adapter of adapterContractRows) {
    for (const [methodId, description] of SDK_METHOD_SPECS) {
      rows.push({
        schema_version: "agent-domain-adapter-method-row.v1",
        row_id: `agent-domain-adapter-method.row.${String(rows.length + 1).padStart(3, "0")}`,
        adapter_sdk_id: adapter.adapter_sdk_id,
        domain_id: adapter.domain_id,
        method_id: methodId,
        current_verdict: "pass",
        method_status: "contract_required_not_executed",
        description,
        deterministic_wrapper_required: true,
        raw_input_allowed: false,
        raw_output_allowed: false,
        direct_mutation_allowed_now: false,
        protected_action_execution_allowed_now: false,
        evidence_ref: `evidence.platform.agent.adapter_sdk.method.${adapter.domain_id}.${methodId}`,
        reviewer_ref: "reviewer.platform.agent_adapter_sdk_method",
        hard_gate_ref: `gate.platform.agent.adapter_sdk.method.${adapter.domain_id}.${methodId}`,
        responsible_owner: adapter.responsible_owner,
        next_allowed_action: "bind method implementation to adapter contract test before runtime use",
        unsafe_flags_false: true,
        verdict_authority: "harness_only",
      });
    }
  }
  return rows;
}

function buildOutputContractRows(adapterContractRows) {
  return adapterContractRows.map((adapter, index) => ({
    schema_version: "agent-domain-adapter-output-contract-row.v1",
    row_id: `agent-domain-adapter-output-contract.row.${String(index + 1).padStart(3, "0")}`,
    adapter_sdk_id: adapter.adapter_sdk_id,
    domain_id: adapter.domain_id,
    current_verdict: "pass",
    output_contract_status: "ready_for_sanitized_claim_packet",
    required_claim_fields: ["claim_id", "claim_type", "current_verdict", "evidence_ref", "reviewer_ref", "hard_gate_ref", "responsible_owner", "next_allowed_action"],
    blocked_claim_outputs: ["complete_without_evidence", "approved_by_agent", "final_pass_by_agent", "legal_final_advice", "release_or_deploy_decision"],
    sanitized_output_required: true,
    operator_surface_binding_required: true,
    human_receipt_required_for_protected_output: true,
    rollback_target_required_for_mutation_candidate: true,
    raw_secret_output_allowed: false,
    raw_client_or_vdr_output_allowed: false,
    final_pass_output_allowed_now: false,
    evidence_ref: `evidence.platform.agent.adapter_sdk.output.${adapter.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_adapter_sdk_output",
    hard_gate_ref: `gate.platform.agent.adapter_sdk.output.${adapter.domain_id}`,
    responsible_owner: adapter.responsible_owner,
    next_allowed_action: "use sanitized output contract before any adapter candidate reaches operator surface",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildProtectedBlockRows() {
  return PROTECTED_ADAPTER_BLOCKS.map(([blockId, blockReason, nextAction], index) => ({
    schema_version: "agent-domain-adapter-protected-block-row.v1",
    row_id: `agent-domain-adapter-protected-block.row.${String(index + 1).padStart(3, "0")}`,
    protected_block_id: blockId,
    current_verdict: "blocked",
    block_reason: blockReason,
    adapter_execution_allowed_now: false,
    direct_domain_mutation_allowed_now: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_exposed: false,
    final_pass_output_allowed_now: false,
    evidence_ref: `evidence.platform.agent.adapter_sdk.block.${blockId}`,
    reviewer_ref: "reviewer.platform.agent_adapter_sdk_block",
    hard_gate_ref: `gate.platform.agent.adapter_sdk.block.${blockId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ adapterContractRows, methodRows, outputContractRows, protectedBlockRows }) {
  const passRows = [
    ...adapterContractRows.map((row) => passClaim("domain_adapter_contract", `claim.platform.agent.adapter_sdk.contract.${row.domain_id}`, row)),
    ...methodRows.map((row) => passClaim("domain_adapter_method", `claim.platform.agent.adapter_sdk.method.${row.domain_id}.${row.method_id}`, row)),
    ...outputContractRows.map((row) => passClaim("domain_adapter_output_contract", `claim.platform.agent.adapter_sdk.output.${row.domain_id}`, row)),
  ];
  const blockedRows = protectedBlockRows.map((row) => blockedClaim("domain_adapter_protected_block", `claim.platform.agent.adapter_sdk.block.${row.protected_block_id}`, row));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-domain-adapter-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-domain-adapter-claim-row.v1",
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
    schema_version: "agent-domain-adapter-claim-row.v1",
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

function buildCloseoutRows({ toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows }) {
  const rows = [
    ["source_tool_policy_ready", toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status === "ready_for_agent_tool_policy_matrix", "source_agent_tool_policy_matrix_summary"],
    ["source_capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "source_agent_capability_registry_summary"],
    ["adapter_contracts_ready", adapterContractRows.length === 7 && adapterContractRows.every((row) => row.current_verdict === "pass"), "agent_domain_adapter_contract_rows"],
    ["method_contracts_ready", methodRows.length === 56 && methodRows.every((row) => row.current_verdict === "pass"), "agent_domain_adapter_method_rows"],
    ["output_contracts_ready", outputContractRows.length === 7 && outputContractRows.every((row) => row.current_verdict === "pass"), "agent_domain_adapter_output_contract_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 8 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "agent_domain_adapter_protected_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_domain_adapter_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-domain-adapter-closeout-row.v1",
    row_id: `agent-domain-adapter-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.adapter_sdk.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_adapter_sdk_closeout",
    hard_gate_ref: `gate.platform.agent.adapter_sdk.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1180 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-domain-adapter-sdk-anchor.v1",
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
    source_tool_policy_matrix_status: toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status,
    source_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    adapter_contract_count: adapterContractRows.length,
    method_count: methodRows.length,
    output_contract_count: outputContractRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_tool_policy_matrix", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_adapter_sdk", runtimePilotLedger.available && ["P1171-P1180", COMMAND_NAME, "Domain Adapter SDK v1"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_tool_policy_ready", toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status === "ready_for_agent_tool_policy_matrix", "source_agent_tool_policy_matrix_summary"],
    ["source_capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "source_agent_capability_registry_summary"],
    ["adapter_contracts_ready", adapterContractRows.length === 7 && adapterContractRows.every((row) => row.current_verdict === "pass"), "agent_domain_adapter_contract_rows"],
    ["method_contracts_ready", methodRows.length === 56 && methodRows.every((row) => row.current_verdict === "pass"), "agent_domain_adapter_method_rows"],
    ["output_contracts_ready", outputContractRows.length === 7 && outputContractRows.every((row) => row.current_verdict === "pass"), "agent_domain_adapter_output_contract_rows"],
    ["protected_blocks_ready", protectedBlockRows.length === 8 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "agent_domain_adapter_protected_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_domain_adapter_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_domain_adapter_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-domain-adapter-gate-row.v1",
    row_id: `agent-domain-adapter-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.adapter_sdk.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_adapter_sdk_gate",
    hard_gate_ref: `gate.platform.agent.adapter_sdk.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    adapter_execution_performed_by_gate: false,
    direct_mutation_performed_by_gate: false,
    raw_material_exposed_by_gate: false,
    final_pass_created_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1180 closeout`,
  }));
}

function buildBoundary({ generatedAt, toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-domain-adapter-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_tool_policy_matrix_ref: toolPolicyMatrix.platform_agent_tool_policy_matrix_id,
    source_capability_registry_ref: capabilityRegistry.platform_agent_capability_registry_id,
    adapter_contract_count: adapterContractRows.length,
    method_count: methodRows.length,
    output_contract_count: outputContractRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    adapter_execution_allowed_now: false,
    adapter_execution_performed: false,
    direct_domain_mutation_allowed_now: false,
    direct_domain_mutation_performed: false,
    direct_zendd_mutation_allowed_now: false,
    raw_secret_input_allowed: false,
    raw_secret_output_allowed: false,
    raw_secret_exposed: false,
    raw_client_or_vdr_input_allowed: false,
    raw_client_or_vdr_output_allowed: false,
    raw_client_or_vdr_exposed: false,
    protected_action_execution_allowed_now: false,
    final_pass_output_allowed_now: false,
    final_pass_created_by_agent: false,
    human_receipt_applied_by_agent: false,
  };
}

function buildValidationItems({ toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All adapter SDK gates must be ready."],
    ["source.tool_policy_ready", toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status === "ready_for_agent_tool_policy_matrix", "P1161-P1170 source must be ready."],
    ["source.capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "Capability registry source must be ready."],
    ["adapters.ready", adapterContractRows.length === 7 && adapterContractRows.every((row) => row.current_verdict === "pass"), "Seven adapter contracts must be ready."],
    ["methods.ready", methodRows.length === 56 && methodRows.every((row) => row.current_verdict === "pass"), "Eight methods per domain must be ready."],
    ["outputs.ready", outputContractRows.length === 7 && outputContractRows.every((row) => row.current_verdict === "pass"), "Output contracts must be ready."],
    ["blocks.documented", protectedBlockRows.length === 8 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "Protected adapter blocks must be documented."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.no_execution_or_raw", allBoundaryUnsafeFlagsFalse(boundary), "P1171-P1180 must not execute adapters, expose raw material, mutate domains, apply receipts, or create final PASS."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_domain_adapter_sdk", passed, message));
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
    "adapter_execution_allowed_now",
    "adapter_execution_performed",
    "direct_domain_mutation_allowed_now",
    "direct_domain_mutation_performed",
    "direct_zendd_mutation_allowed_now",
    "raw_secret_input_allowed",
    "raw_secret_output_allowed",
    "raw_secret_exposed",
    "raw_client_or_vdr_input_allowed",
    "raw_client_or_vdr_output_allowed",
    "raw_client_or_vdr_exposed",
    "protected_action_execution_allowed_now",
    "final_pass_output_allowed_now",
    "final_pass_created_by_agent",
    "human_receipt_applied_by_agent",
  ].every((field) => boundary[field] === false);
}

function buildSummary({ toolPolicyMatrix, capabilityRegistry, adapterContractRows, methodRows, outputContractRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_domain_adapter_sdk_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_tool_policy_matrix_status: toolPolicyMatrix.summary.platform_agent_tool_policy_matrix_status,
    source_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    adapter_contract_count: adapterContractRows.length,
    method_count: methodRows.length,
    output_contract_count: outputContractRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    adapter_execution_allowed_now: boundary.adapter_execution_allowed_now,
    direct_domain_mutation_allowed_now: boundary.direct_domain_mutation_allowed_now,
    raw_secret_exposed: boundary.raw_secret_exposed,
    raw_client_or_vdr_exposed: boundary.raw_client_or_vdr_exposed,
    final_pass_created_by_agent: boundary.final_pass_created_by_agent,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Domain Adapter SDK",
    "",
    `Status: ${result.summary.platform_agent_domain_adapter_sdk_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Adapter contracts: ${result.summary.adapter_contract_count}`,
    `Method contracts: ${result.summary.method_count}`,
    `Output contracts: ${result.summary.output_contract_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "Domain adapters are defined as deterministic contracts only. No adapter execution, raw material exposure, direct mutation, receipt application, or Agent-created final PASS is allowed.",
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
  const defaults = DEFAULT_PLATFORM_AGENT_DOMAIN_ADAPTER_SDK_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-domain-adapter-sdk.mjs [--check] [--out-dir DIR]\n\nCreates the P1171-P1180 Agent domain adapter SDK contract without executing adapters, exposing raw material, mutating domains, or applying receipts.`);
}
