import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentCapabilityRegistry } from "./platform-agent-capability-registry.mjs";
import { buildPlatformAgentDoctorEvidenceBridge } from "./platform-agent-doctor-evidence-bridge.mjs";

export const DEFAULT_PLATFORM_AGENT_TOOL_POLICY_MATRIX_OUT_DIR = "artifacts/platform-agent-tool-policy-matrix/latest";
export const DEFAULT_PLATFORM_AGENT_TOOL_POLICY_MATRIX_INPUTS = {
  schemaPath: "schemas/platform-agent-tool-policy-matrix.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-tool-policy-matrix";
const SOURCE_COMMAND_NAME = "platform:agent-doctor-evidence-bridge";
const REGISTRY_COMMAND_NAME = "platform:agent-capability-registry";
const SCHEMA_VERSION = "platform-agent-tool-policy-matrix.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.tool_policy_matrix";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1161-P1170";
const PHASE_SLOT = "P1161";
const PREVIOUS_PHASE_SLOT = "P1160";
const NEXT_PHASE_SLOT = "P1171";
const READY_STATUS = "ready_for_agent_tool_policy_matrix";

const TOOL_CLASS_SPECS = [
  ["terminal_execution", "blocked", "terminal_execution_requires_human_receipt", "terminal commands stay candidate-only until execution packet and receipt exist"],
  ["mcp_connection", "blocked", "unreviewed_mcp_connection", "register MCP connection plan behind human gate"],
  ["browser_session", "pass", null, "browser use is policy-defined as read-only candidate and not started"],
  ["file_write", "blocked", "file_write_requires_adapter_receipt", "route writes through adapter SDK and scoped receipt"],
  ["package_install", "blocked", "package_install_requires_install_receipt", "use install packet receipt and rollback evidence first"],
  ["secret_handle_reference", "pass", null, "secret handles may be referenced; raw secret read remains false"],
  ["raw_material_access", "blocked", "raw_material_access_forbidden", "use source refs, redacted spans, and quarantine review"],
  ["domain_mutation", "blocked", "domain_mutation_forbidden", "use domain adapter work order and human receipt"],
];

const UNSAFE_TOOL_BLOCKS = [
  ["raw_secret_read", "raw_secret_access", "replace raw secret with secret-handle evidence ref"],
  ["raw_client_vdr_read", "raw_client_or_vdr_exposure", "replace raw material with source-span refs"],
  ["terminal_execute_now", "terminal_execution_requires_human_receipt", "create execution packet and receipt"],
  ["mcp_connect_now", "unreviewed_mcp_connection", "register MCP plan and receipt"],
  ["package_install_now", "package_install_requires_install_receipt", "use P1141 install packet receipt"],
  ["domain_write_now", "domain_mutation_forbidden", "route through adapter SDK work order"],
  ["direct_zendd_write_now", "direct_zendd_mutation", "use Zendd external adapter safe patch lane"],
  ["agent_final_pass_now", "agent_final_pass_forbidden", "route through pilot readiness freeze"],
];

export async function runPlatformAgentToolPolicyMatrix(options = {}) {
  const result = await buildPlatformAgentToolPolicyMatrix(options);
  if (options.write !== false) await writePlatformAgentToolPolicyMatrix(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent tool policy matrix failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentToolPolicyMatrix(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_TOOL_POLICY_MATRIX_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const doctorBridge = await buildPlatformAgentDoctorEvidenceBridge({
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

  const domainRows = capabilityRegistry.domain_agent_registry_rows;
  const toolMatrixRows = buildToolMatrixRows(domainRows);
  const sandboxRows = buildSandboxRows(domainRows, toolMatrixRows);
  const unsafeToolRows = buildUnsafeToolRows();
  const claimRows = buildClaimRows({ toolMatrixRows, sandboxRows, unsafeToolRows });
  const closeoutRows = buildCloseoutRows({ doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_tool_policy_matrix_id: `platform-agent-tool-policy-matrix.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_tool_policy_matrix_anchor: anchor,
    source_agent_doctor_evidence_bridge_summary: doctorBridge.summary,
    source_agent_capability_registry_summary: capabilityRegistry.summary,
    agent_tool_policy_matrix_rows: toolMatrixRows,
    agent_tool_policy_sandbox_rows: sandboxRows,
    agent_tool_policy_unsafe_block_rows: unsafeToolRows,
    agent_tool_policy_claim_rows: claimRows,
    agent_tool_policy_closeout_rows: closeoutRows,
    agent_tool_policy_gate_rows: gateRows,
    agent_tool_policy_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_tool_policy_matrix")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_tool_policy_matrix_id = result.platform_agent_tool_policy_matrix_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentToolPolicyMatrix(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-tool-policy-matrix.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-tool-policy-matrix-rows.json"), collectionEnvelope("agent-tool-policy-matrix-rows.v1", "agent_tool_policy_matrix_rows", result.agent_tool_policy_matrix_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-tool-policy-sandbox-rows.json"), collectionEnvelope("agent-tool-policy-sandbox-rows.v1", "agent_tool_policy_sandbox_rows", result.agent_tool_policy_sandbox_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-tool-policy-unsafe-block-rows.json"), collectionEnvelope("agent-tool-policy-unsafe-block-rows.v1", "agent_tool_policy_unsafe_block_rows", result.agent_tool_policy_unsafe_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-tool-policy-claim-rows.json"), collectionEnvelope("agent-tool-policy-claim-rows.v1", "agent_tool_policy_claim_rows", result.agent_tool_policy_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-tool-policy-closeout-rows.json"), collectionEnvelope("agent-tool-policy-closeout-rows.v1", "agent_tool_policy_closeout_rows", result.agent_tool_policy_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-tool-policy-gate-rows.json"), collectionEnvelope("agent-tool-policy-gate-rows.v1", "agent_tool_policy_gate_rows", result.agent_tool_policy_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-tool-policy-boundary.json"), result.agent_tool_policy_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-tool-policy-matrix-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentToolPolicyMatrixCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentToolPolicyMatrix(args);
    console.log(`Platform agent tool policy matrix ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_tool_policy_matrix_status}`);
    console.log(`Domains: ${result.summary.domain_count}`);
    console.log(`Tool matrix rows: ${result.summary.tool_matrix_count}`);
    console.log(`Sandbox rows: ${result.summary.sandbox_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Terminal execution allowed: ${result.summary.terminal_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildToolMatrixRows(domainRows) {
  const rows = [];
  for (const domain of domainRows) {
    for (const [toolClassId, verdict, blockReason, nextAction] of TOOL_CLASS_SPECS) {
      const pass = verdict === "pass";
      rows.push({
        schema_version: "agent-tool-policy-matrix-row.v1",
        row_id: `agent-tool-policy-matrix.row.${String(rows.length + 1).padStart(3, "0")}`,
        tool_policy_id: `tool_policy.${domain.domain_id}.${toolClassId}`,
        domain_id: domain.domain_id,
        domain_pack_id: domain.domain_pack_id,
        current_rollout_level: domain.current_rollout_level,
        max_rollout_level: domain.max_rollout_level,
        tool_class_id: toolClassId,
        current_verdict: pass ? "pass" : "blocked",
        block_reason: pass ? null : blockReason,
        policy_status: pass ? "policy_defined_execution_disabled" : "documented_block",
        execution_allowed_now: false,
        command_execution_allowed_now: false,
        terminal_execution_allowed_now: false,
        mcp_connection_allowed_now: false,
        browser_session_started: false,
        file_write_allowed_now: false,
        package_install_allowed_now: false,
        secret_handle_reference_allowed: toolClassId === "secret_handle_reference",
        raw_secret_read_allowed_now: false,
        raw_material_access_allowed_now: false,
        domain_mutation_allowed_now: false,
        direct_zendd_mutation_allowed_now: false,
        human_receipt_required_for_execution: true,
        evidence_ref: `evidence.platform.agent.tool_policy.matrix.${domain.domain_id}.${toolClassId}`,
        reviewer_ref: "reviewer.platform.agent_tool_policy_matrix",
        hard_gate_ref: `gate.platform.agent.tool_policy.matrix.${domain.domain_id}.${toolClassId}`,
        responsible_owner: domain.responsible_owner,
        next_allowed_action: nextAction,
        unsafe_flags_false: true,
        verdict_authority: "harness_only",
      });
    }
  }
  return rows;
}

function buildSandboxRows(domainRows, toolMatrixRows) {
  return domainRows.map((domain, index) => {
    const matrixRows = toolMatrixRows.filter((row) => row.domain_id === domain.domain_id);
    return {
      schema_version: "agent-tool-policy-sandbox-row.v1",
      row_id: `agent-tool-policy-sandbox.row.${String(index + 1).padStart(3, "0")}`,
      sandbox_profile_id: `sandbox.agent.${domain.domain_id}`,
      domain_id: domain.domain_id,
      domain_pack_id: domain.domain_pack_id,
      current_verdict: "pass",
      current_rollout_level: domain.current_rollout_level,
      pass_tool_policy_refs: matrixRows.filter((row) => row.current_verdict === "pass").map((row) => row.tool_policy_id),
      blocked_tool_policy_refs: matrixRows.filter((row) => row.current_verdict === "blocked").map((row) => row.tool_policy_id),
      allowed_data_classes: domain.data_classes,
      forbidden_data_classes: domain.forbidden_data_classes,
      execution_allowed_now: false,
      command_execution_allowed_now: false,
      terminal_execution_allowed_now: false,
      mcp_connection_allowed_now: false,
      file_write_allowed_now: false,
      package_install_allowed_now: false,
      raw_secret_read_allowed_now: false,
      raw_material_access_allowed_now: false,
      domain_mutation_allowed_now: false,
      direct_zendd_mutation_allowed_now: false,
      browser_session_started: false,
      provider_secret_configuration_allowed_now: false,
      evidence_ref: `evidence.platform.agent.tool_policy.sandbox.${domain.domain_id}`,
      reviewer_ref: "reviewer.platform.agent_tool_policy_sandbox",
      hard_gate_ref: `gate.platform.agent.tool_policy.sandbox.${domain.domain_id}`,
      responsible_owner: domain.responsible_owner,
      next_allowed_action: "bind sandbox profile to adapter SDK before any runtime-backed tool request",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildUnsafeToolRows() {
  return UNSAFE_TOOL_BLOCKS.map(([unsafeToolId, blockReason, nextAction], index) => ({
    schema_version: "agent-tool-policy-unsafe-block-row.v1",
    row_id: `agent-tool-policy-unsafe-block.row.${String(index + 1).padStart(3, "0")}`,
    unsafe_tool_id: unsafeToolId,
    current_verdict: "blocked",
    block_reason: blockReason,
    execution_allowed_now: false,
    raw_secret_read_allowed_now: false,
    raw_material_access_allowed_now: false,
    protected_action_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
    evidence_ref: `evidence.platform.agent.tool_policy.unsafe.${unsafeToolId}`,
    reviewer_ref: "reviewer.platform.agent_tool_policy_unsafe",
    hard_gate_ref: `gate.platform.agent.tool_policy.unsafe.${unsafeToolId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ toolMatrixRows, sandboxRows, unsafeToolRows }) {
  const matrixClaims = toolMatrixRows.map((row) => row.current_verdict === "pass"
    ? passClaim("tool_policy_matrix", `claim.platform.agent.tool_policy.matrix.${row.domain_id}.${row.tool_class_id}`, row)
    : blockedClaim("tool_policy_matrix", `claim.platform.agent.tool_policy.matrix.${row.domain_id}.${row.tool_class_id}`, row));
  const sandboxClaims = sandboxRows.map((row) => passClaim("tool_policy_sandbox", `claim.platform.agent.tool_policy.sandbox.${row.domain_id}`, row));
  const unsafeClaims = unsafeToolRows.map((row) => blockedClaim("unsafe_tool_policy", `claim.platform.agent.tool_policy.unsafe.${row.unsafe_tool_id}`, row));
  return [...matrixClaims, ...sandboxClaims, ...unsafeClaims].map((row, index) => ({
    ...row,
    row_id: `agent-tool-policy-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-tool-policy-claim-row.v1",
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
    schema_version: "agent-tool-policy-claim-row.v1",
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

function buildCloseoutRows({ doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows }) {
  const rows = [
    ["source_doctor_bridge_ready", doctorBridge.summary.platform_agent_doctor_evidence_bridge_status === "ready_for_agent_doctor_evidence_bridge", "source_agent_doctor_evidence_bridge_summary"],
    ["source_capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "source_agent_capability_registry_summary"],
    ["domain_count_ready", domainRows.length === 7, "domain_agent_registry_rows"],
    ["tool_matrix_complete", toolMatrixRows.length === 56, "agent_tool_policy_matrix_rows"],
    ["blocked_tool_classes_documented", toolMatrixRows.filter((row) => row.current_verdict === "blocked").length === 42, "agent_tool_policy_matrix_rows"],
    ["sandbox_profiles_ready", sandboxRows.length === 7 && sandboxRows.every((row) => row.current_verdict === "pass"), "agent_tool_policy_sandbox_rows"],
    ["unsafe_tool_blocks_documented", unsafeToolRows.length === 8 && unsafeToolRows.every((row) => row.current_verdict === "blocked"), "agent_tool_policy_unsafe_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_tool_policy_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-tool-policy-closeout-row.v1",
    row_id: `agent-tool-policy-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.tool_policy.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_tool_policy_closeout",
    hard_gate_ref: `gate.platform.agent.tool_policy.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1170 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-tool-policy-matrix-anchor.v1",
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
    source_doctor_bridge_status: doctorBridge.summary.platform_agent_doctor_evidence_bridge_status,
    source_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    domain_count: domainRows.length,
    tool_matrix_count: toolMatrixRows.length,
    sandbox_count: sandboxRows.length,
    unsafe_tool_block_count: unsafeToolRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_doctor_bridge", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_tool_policy_matrix", runtimePilotLedger.available && ["P1161-P1170", COMMAND_NAME, "Tool Policy And Sandbox Matrix"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ["source_doctor_bridge_ready", doctorBridge.summary.platform_agent_doctor_evidence_bridge_status === "ready_for_agent_doctor_evidence_bridge", "source_agent_doctor_evidence_bridge_summary"],
    ["source_capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "source_agent_capability_registry_summary"],
    ["domain_count_ready", domainRows.length === 7, "domain_agent_registry_rows"],
    ["tool_matrix_complete", toolMatrixRows.length === 56, "agent_tool_policy_matrix_rows"],
    ["blocked_tools_documented", toolMatrixRows.filter((row) => row.current_verdict === "blocked").length === 42, "agent_tool_policy_matrix_rows"],
    ["sandbox_profiles_ready", sandboxRows.length === 7 && sandboxRows.every((row) => row.current_verdict === "pass"), "agent_tool_policy_sandbox_rows"],
    ["unsafe_tool_blocks_ready", unsafeToolRows.length === 8 && unsafeToolRows.every((row) => row.current_verdict === "blocked"), "agent_tool_policy_unsafe_block_rows"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_tool_policy_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_tool_policy_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-tool-policy-gate-row.v1",
    row_id: `agent-tool-policy-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.tool_policy.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_tool_policy_gate",
    hard_gate_ref: `gate.platform.agent.tool_policy.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    terminal_execution_performed_by_gate: false,
    mcp_connection_performed_by_gate: false,
    package_install_performed_by_gate: false,
    raw_material_exposed_by_gate: false,
    domain_mutation_performed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1170 closeout`,
  }));
}

function buildBoundary({ generatedAt, doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-tool-policy-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_doctor_bridge_ref: doctorBridge.platform_agent_doctor_evidence_bridge_id,
    source_capability_registry_ref: capabilityRegistry.platform_agent_capability_registry_id,
    domain_count: domainRows.length,
    tool_matrix_count: toolMatrixRows.length,
    sandbox_count: sandboxRows.length,
    unsafe_tool_block_count: unsafeToolRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    terminal_execution_allowed_now: false,
    terminal_execution_performed: false,
    mcp_connection_allowed_now: false,
    mcp_connection_performed: false,
    browser_session_started: false,
    file_write_allowed_now: false,
    file_write_performed: false,
    package_install_allowed_now: false,
    package_install_performed: false,
    provider_secret_configuration_allowed_now: false,
    raw_secret_read_allowed_now: false,
    raw_secret_exposed: false,
    raw_material_access_allowed_now: false,
    raw_client_or_vdr_exposed: false,
    domain_mutation_allowed_now: false,
    domain_mutation_performed: false,
    direct_zendd_mutation_allowed_now: false,
    protected_action_execution_allowed_now: false,
    agent_final_pass_allowed_now: false,
  };
}

function buildValidationItems({ doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All tool policy gates must be ready."],
    ["source.doctor_bridge_ready", doctorBridge.summary.platform_agent_doctor_evidence_bridge_status === "ready_for_agent_doctor_evidence_bridge", "P1151-P1160 source must be ready."],
    ["source.capability_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "Capability registry source must be ready."],
    ["domains.ready", domainRows.length === 7, "Seven registered domains must be mapped."],
    ["matrix.complete", toolMatrixRows.length === 56, "Eight tool classes per domain must be mapped."],
    ["matrix.blocked_documented", toolMatrixRows.filter((row) => row.current_verdict === "blocked").length === 42, "Blocked tool rows must be documented."],
    ["sandbox.ready", sandboxRows.length === 7 && sandboxRows.every((row) => row.current_verdict === "pass"), "Sandbox profiles must be ready."],
    ["unsafe.blocks", unsafeToolRows.length === 8 && unsafeToolRows.every((row) => row.current_verdict === "blocked"), "Unsafe tool classes must be blocked."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.no_tool_execution", allBoundaryUnsafeFlagsFalse(boundary), "P1161-P1170 must not execute tools, install packages, expose raw material, mutate domains, or create final PASS."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_tool_policy_matrix", passed, message));
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
    "terminal_execution_allowed_now",
    "terminal_execution_performed",
    "mcp_connection_allowed_now",
    "mcp_connection_performed",
    "browser_session_started",
    "file_write_allowed_now",
    "file_write_performed",
    "package_install_allowed_now",
    "package_install_performed",
    "provider_secret_configuration_allowed_now",
    "raw_secret_read_allowed_now",
    "raw_secret_exposed",
    "raw_material_access_allowed_now",
    "raw_client_or_vdr_exposed",
    "domain_mutation_allowed_now",
    "domain_mutation_performed",
    "direct_zendd_mutation_allowed_now",
    "protected_action_execution_allowed_now",
    "agent_final_pass_allowed_now",
  ].every((field) => boundary[field] === false);
}

function buildSummary({ doctorBridge, capabilityRegistry, domainRows, toolMatrixRows, sandboxRows, unsafeToolRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_tool_policy_matrix_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_doctor_bridge_status: doctorBridge.summary.platform_agent_doctor_evidence_bridge_status,
    source_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    domain_count: domainRows.length,
    tool_matrix_count: toolMatrixRows.length,
    pass_tool_matrix_count: toolMatrixRows.filter((row) => row.current_verdict === "pass").length,
    blocked_tool_matrix_count: toolMatrixRows.filter((row) => row.current_verdict === "blocked").length,
    sandbox_count: sandboxRows.length,
    unsafe_tool_block_count: unsafeToolRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    terminal_execution_allowed_now: boundary.terminal_execution_allowed_now,
    mcp_connection_allowed_now: boundary.mcp_connection_allowed_now,
    package_install_allowed_now: boundary.package_install_allowed_now,
    raw_secret_exposed: boundary.raw_secret_exposed,
    raw_client_or_vdr_exposed: boundary.raw_client_or_vdr_exposed,
    domain_mutation_allowed_now: boundary.domain_mutation_allowed_now,
    agent_final_pass_allowed_now: boundary.agent_final_pass_allowed_now,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Tool Policy Matrix",
    "",
    `Status: ${result.summary.platform_agent_tool_policy_matrix_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Domains: ${result.summary.domain_count}`,
    `Tool matrix rows: ${result.summary.tool_matrix_count}`,
    `Sandbox rows: ${result.summary.sandbox_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "Terminal execution, MCP connection, file write, package install, raw material access, domain mutation, Zendd mutation, and Agent final PASS remain disabled.",
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
  const defaults = DEFAULT_PLATFORM_AGENT_TOOL_POLICY_MATRIX_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-tool-policy-matrix.mjs [--check] [--out-dir DIR]\n\nCreates the P1161-P1170 Agent tool policy and sandbox matrix without executing tools, installing packages, exposing raw material, or mutating domains.`);
}
