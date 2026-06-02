import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentAuthorityFreeze } from "./platform-agent-authority-freeze.mjs";
import { buildPlatformAgentDelegationContract } from "./platform-agent-delegation-contract.mjs";
import { buildPlatformAgentDoctorEvidenceBridge } from "./platform-agent-doctor-evidence-bridge.mjs";
import { buildPlatformAgentDomainAdapterSdk } from "./platform-agent-domain-adapter-sdk.mjs";
import { buildPlatformAgentDryRunSimulation } from "./platform-agent-dry-run-simulation.mjs";
import { buildPlatformAgentInstallPacket } from "./platform-agent-install-packet.mjs";
import { buildPlatformAgentInstallTrustGate } from "./platform-agent-install-trust-gate.mjs";
import { buildPlatformAgentRuntimeReceiptContract } from "./platform-agent-runtime-receipt-contract.mjs";
import { buildPlatformAgentToolPolicyMatrix } from "./platform-agent-tool-policy-matrix.mjs";
import { buildPlatformAgentZenddCandidateBridge } from "./platform-agent-zendd-candidate-bridge.mjs";

export const DEFAULT_PLATFORM_AGENT_RUNTIME_PILOT_FREEZE_OUT_DIR = "artifacts/platform-agent-runtime-pilot-freeze/latest";
export const DEFAULT_PLATFORM_AGENT_RUNTIME_PILOT_FREEZE_INPUTS = {
  schemaPath: "schemas/platform-agent-runtime-pilot-freeze.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
  agentRuntimePilotLedgerPath: "docs/hermes-agent-runtime-pilot-phase-ledger.md",
  integrationPhaseLedgerPath: "docs/zendd-hermes-integration-phase-ledger.md",
  developmentPhaseLedgerPath: "docs/zendd-hermes-development-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-runtime-pilot-freeze";
const SOURCE_COMMAND_NAME = "platform:agent-dry-run-simulation";
const SCHEMA_VERSION = "platform-agent-runtime-pilot-freeze.v1";
const CAPABILITY_ID = "platform.agent_runtime_pilot.freeze";
const PROGRAM_RANGE = "P1122-P1200";
const PHASE_RANGE = "P1199-P1200";
const PHASE_SLOT = "P1199";
const PREVIOUS_PHASE_SLOT = "P1198";
const READY_STATUS = "ready_for_human_approved_agent_runtime_pilot";

const SOURCE_SPECS = [
  ["authority_freeze", "P1122-P1124", "platform:agent-authority-freeze", buildPlatformAgentAuthorityFreeze, "platform_agent_authority_freeze_status", "ready_for_agent_authority_freeze", "agent_authority_claim_rows"],
  ["install_trust_gate", "P1125-P1132", "platform:agent-install-trust-gate", buildPlatformAgentInstallTrustGate, "platform_agent_install_trust_gate_status", "ready_for_agent_install_trust_gate", "agent_install_trust_claim_rows"],
  ["runtime_receipt_contract", "P1133-P1140", "platform:agent-runtime-receipt-contract", buildPlatformAgentRuntimeReceiptContract, "platform_agent_runtime_receipt_contract_status", "ready_for_agent_runtime_receipt_contract", "agent_runtime_receipt_claim_rows"],
  ["install_packet", "P1141-P1150", "platform:agent-install-packet", buildPlatformAgentInstallPacket, "platform_agent_install_packet_status", "ready_for_agent_install_packet", "agent_install_packet_claim_rows"],
  ["doctor_evidence_bridge", "P1151-P1160", "platform:agent-doctor-evidence-bridge", buildPlatformAgentDoctorEvidenceBridge, "platform_agent_doctor_evidence_bridge_status", "ready_for_agent_doctor_evidence_bridge", "agent_doctor_evidence_claim_rows"],
  ["tool_policy_matrix", "P1161-P1170", "platform:agent-tool-policy-matrix", buildPlatformAgentToolPolicyMatrix, "platform_agent_tool_policy_matrix_status", "ready_for_agent_tool_policy_matrix", "agent_tool_policy_claim_rows"],
  ["domain_adapter_sdk", "P1171-P1180", "platform:agent-domain-adapter-sdk", buildPlatformAgentDomainAdapterSdk, "platform_agent_domain_adapter_sdk_status", "ready_for_agent_domain_adapter_sdk", "agent_domain_adapter_claim_rows"],
  ["zendd_candidate_bridge", "P1181-P1188", "platform:agent-zendd-candidate-bridge", buildPlatformAgentZenddCandidateBridge, "platform_agent_zendd_candidate_bridge_status", "ready_for_agent_zendd_candidate_bridge", "agent_zendd_candidate_claim_rows"],
  ["delegation_contract", "P1189-P1194", "platform:agent-delegation-contract", buildPlatformAgentDelegationContract, "platform_agent_delegation_contract_status", "ready_for_agent_delegation_contract", "agent_delegation_claim_rows"],
  ["dry_run_simulation", "P1195-P1198", "platform:agent-dry-run-simulation", buildPlatformAgentDryRunSimulation, "platform_agent_dry_run_simulation_status", "ready_for_agent_dry_run_simulation", "agent_dry_run_claim_rows"],
];

const PROTECTED_FREEZE_BLOCKS = [
  ["runtime_execution_without_receipt", "runtime_execution_requires_human_receipt", "collect validated runtime receipt and rerun this freeze"],
  ["package_download_or_install", "package_install_requires_install_receipt", "use install packet, rollback plan, and human receipt"],
  ["terminal_command_execution", "terminal_execution_requires_human_receipt", "create command execution packet and receipt"],
  ["mcp_connection_start", "unreviewed_mcp_connection", "register MCP plan behind operator and human gate"],
  ["api_server_start", "api_server_start_forbidden", "keep API/server start disabled for this freeze"],
  ["cron_gateway_start", "cron_start_forbidden", "keep scheduled/background startup disabled"],
  ["provider_secret_configuration", "raw_secret_access", "use secret-handle refs and human-approved provider setup"],
  ["raw_secret_read", "raw_secret_access", "replace raw secret with secret-handle evidence ref"],
  ["raw_client_vdr_exposure", "raw_client_or_vdr_exposure", "use source-span refs and redacted summaries"],
  ["cross_domain_data_forwarding", "cross_domain_data_boundary", "route through domain handoff channel and owner review"],
  ["direct_zendd_mutation", "direct_zendd_mutation", "use Zendd external safe patch lane and human receipt"],
  ["protected_action_execution", "protected_action_requires_human_receipt", "queue protected action receipt and reviewer gate"],
  ["receipt_application_without_human", "receipt_application_forbidden", "validate a human receipt before any application"],
  ["release_or_deploy_decision", "release_decision_requires_human_receipt", "route release/deploy decision through owner receipt"],
  ["legal_final_judgment", "legal_final_judgment_forbidden", "route legal outputs to qualified human legal review"],
  ["agent_final_pass_or_approval", "agent_final_authority_forbidden", "require human owner approval before any final PASS"],
];

export async function runPlatformAgentRuntimePilotFreeze(options = {}) {
  const result = await buildPlatformAgentRuntimePilotFreeze(options);
  if (options.write !== false) await writePlatformAgentRuntimePilotFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent runtime pilot freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentRuntimePilotFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_RUNTIME_PILOT_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const runtimePilotLedger = await readTextSource(inputs.agent_runtime_pilot_ledger_path);
  const sourceResults = await buildSources({ generatedAt, inputs });

  const sourceRows = buildSourceRows(sourceResults);
  const claimAuditRows = buildClaimAuditRows(sourceResults);
  const protectedBlockRows = buildProtectedBlockRows();
  const claimRows = buildClaimRows({ sourceRows, claimAuditRows, protectedBlockRows });
  const closeoutRows = buildCloseoutRows({ sourceRows, claimAuditRows, protectedBlockRows, claimRows });
  const anchor = buildAnchor({ packageJson, runtimePilotLedger, sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, runtimePilotLedger, sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows });
  const boundary = buildBoundary({ generatedAt, sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows, gateRows });
  const validationItems = buildValidationItems({ sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_runtime_pilot_freeze_id: `platform-agent-runtime-pilot-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_runtime_pilot_freeze_anchor: anchor,
    agent_runtime_pilot_freeze_source_rows: sourceRows,
    agent_runtime_pilot_freeze_claim_audit_rows: claimAuditRows,
    agent_runtime_pilot_freeze_protected_block_rows: protectedBlockRows,
    agent_runtime_pilot_freeze_claim_rows: claimRows,
    agent_runtime_pilot_freeze_closeout_rows: closeoutRows,
    agent_runtime_pilot_freeze_gate_rows: gateRows,
    agent_runtime_pilot_freeze_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_runtime_pilot_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation: result.validation });
  result.summary.platform_agent_runtime_pilot_freeze_id = result.platform_agent_runtime_pilot_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentRuntimePilotFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-runtime-pilot-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-runtime-pilot-freeze-source-rows.json"), collectionEnvelope("agent-runtime-pilot-freeze-source-rows.v1", "agent_runtime_pilot_freeze_source_rows", result.agent_runtime_pilot_freeze_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-pilot-freeze-claim-audit-rows.json"), collectionEnvelope("agent-runtime-pilot-freeze-claim-audit-rows.v1", "agent_runtime_pilot_freeze_claim_audit_rows", result.agent_runtime_pilot_freeze_claim_audit_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-pilot-freeze-protected-block-rows.json"), collectionEnvelope("agent-runtime-pilot-freeze-protected-block-rows.v1", "agent_runtime_pilot_freeze_protected_block_rows", result.agent_runtime_pilot_freeze_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-pilot-freeze-claim-rows.json"), collectionEnvelope("agent-runtime-pilot-freeze-claim-rows.v1", "agent_runtime_pilot_freeze_claim_rows", result.agent_runtime_pilot_freeze_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-pilot-freeze-closeout-rows.json"), collectionEnvelope("agent-runtime-pilot-freeze-closeout-rows.v1", "agent_runtime_pilot_freeze_closeout_rows", result.agent_runtime_pilot_freeze_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-pilot-freeze-gate-rows.json"), collectionEnvelope("agent-runtime-pilot-freeze-gate-rows.v1", "agent_runtime_pilot_freeze_gate_rows", result.agent_runtime_pilot_freeze_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-runtime-pilot-freeze-boundary.json"), result.agent_runtime_pilot_freeze_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-runtime-pilot-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentRuntimePilotFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentRuntimePilotFreeze(args);
    console.log(`Platform agent runtime pilot freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_runtime_pilot_freeze_status}`);
    console.log(`Sources: ${result.summary.source_count}`);
    console.log(`Source claims audited: ${result.summary.source_claim_count}`);
    console.log(`Protected blocks: ${result.summary.protected_block_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.agent_runtime_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function buildSources({ generatedAt, inputs }) {
  const sourceOptions = {
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    agentRuntimePilotLedgerPath: inputs.agent_runtime_pilot_ledger_path,
    integrationPhaseLedgerPath: inputs.integration_phase_ledger_path,
    developmentPhaseLedgerPath: inputs.development_phase_ledger_path,
    write: false,
  };
  const results = [];
  for (const [sourceId, phaseRange, commandName, builder, statusKey, readyStatus, claimRowsKey] of SOURCE_SPECS) {
    const result = await builder(sourceOptions);
    results.push({ sourceId, phaseRange, commandName, statusKey, readyStatus, claimRowsKey, result });
  }
  return results;
}

function buildSourceRows(sourceResults) {
  return sourceResults.map((source, index) => {
    const sourceStatus = source.result.summary[source.statusKey];
    const claims = source.result[source.claimRowsKey] ?? findClaimRows(source.result);
    return {
      schema_version: "agent-runtime-pilot-freeze-source-row.v1",
      row_id: `agent-runtime-pilot-freeze-source.row.${String(index + 1).padStart(2, "0")}`,
      source_id: source.sourceId,
      phase_range: source.phaseRange,
      command_name: source.commandName,
      source_status: sourceStatus,
      ready_status: source.readyStatus,
      current_verdict: sourceStatus === source.readyStatus && source.result.validation.valid ? "pass" : "blocked",
      source_claim_count: claims.length,
      source_pass_claim_count: claims.filter((row) => row.current_verdict === "pass").length,
      source_blocked_claim_count: claims.filter((row) => row.current_verdict === "blocked").length,
      source_validation_error_count: source.result.validation.errors.length,
      evidence_ref: `evidence.platform.agent.runtime_pilot_freeze.source.${source.sourceId}`,
      reviewer_ref: "reviewer.platform.agent_runtime_pilot_freeze_source",
      hard_gate_ref: `gate.platform.agent.runtime_pilot_freeze.source.${source.sourceId}`,
      block_reason: sourceStatus === source.readyStatus && source.result.validation.valid ? null : `source_not_ready.${source.sourceId}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: sourceStatus === source.readyStatus && source.result.validation.valid ? "keep source evidence attached to pilot freeze" : `repair ${source.commandName} before P1200 freeze`,
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildClaimAuditRows(sourceResults) {
  return sourceResults.map((source, index) => {
    const claims = source.result[source.claimRowsKey] ?? findClaimRows(source.result);
    const unsupportedClaims = claims.filter((row) => !isSupportedSourceClaim(row));
    return {
      schema_version: "agent-runtime-pilot-freeze-claim-audit-row.v1",
      row_id: `agent-runtime-pilot-freeze-claim-audit.row.${String(index + 1).padStart(2, "0")}`,
      source_id: source.sourceId,
      phase_range: source.phaseRange,
      command_name: source.commandName,
      claim_rows_ref: source.claimRowsKey,
      current_verdict: unsupportedClaims.length === 0 ? "pass" : "blocked",
      source_claim_count: claims.length,
      source_pass_claim_count: claims.filter((row) => row.current_verdict === "pass").length,
      source_blocked_claim_count: claims.filter((row) => row.current_verdict === "blocked").length,
      unsupported_claim_count: unsupportedClaims.length,
      missing_evidence_count: claims.filter((row) => !row.evidence_ref).length,
      missing_reviewer_count: claims.filter((row) => !row.reviewer_ref).length,
      missing_gate_count: claims.filter((row) => !row.hard_gate_ref).length,
      missing_block_reason_count: claims.filter((row) => row.current_verdict === "blocked" && !row.block_reason).length,
      missing_owner_count: claims.filter((row) => !row.responsible_owner).length,
      missing_next_action_count: claims.filter((row) => !row.next_allowed_action).length,
      evidence_ref: `evidence.platform.agent.runtime_pilot_freeze.claim_audit.${source.sourceId}`,
      reviewer_ref: "reviewer.platform.agent_runtime_pilot_freeze_claim_audit",
      hard_gate_ref: `gate.platform.agent.runtime_pilot_freeze.claim_audit.${source.sourceId}`,
      block_reason: unsupportedClaims.length === 0 ? null : `unsupported_claims.${source.sourceId}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: unsupportedClaims.length === 0 ? "keep claim audit attached to pilot freeze" : `repair unsupported claims in ${source.commandName}`,
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function findClaimRows(result) {
  const entry = Object.entries(result).find(([key, value]) => key.endsWith("_claim_rows") && Array.isArray(value));
  return entry?.[1] ?? [];
}

function isSupportedSourceClaim(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.block_reason && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  return false;
}

function buildProtectedBlockRows() {
  return PROTECTED_FREEZE_BLOCKS.map(([blockId, blockReason, nextAction], index) => ({
    schema_version: "agent-runtime-pilot-freeze-protected-block-row.v1",
    row_id: `agent-runtime-pilot-freeze-protected-block.row.${String(index + 1).padStart(2, "0")}`,
    protected_block_id: blockId,
    current_verdict: "blocked",
    block_reason: blockReason,
    evidence_ref: `evidence.platform.agent.runtime_pilot_freeze.block.${blockId}`,
    reviewer_ref: "reviewer.platform.agent_runtime_pilot_freeze_block",
    hard_gate_ref: `gate.platform.agent.runtime_pilot_freeze.block.${blockId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAction,
    documented_human_gate_ref: `human_gate.platform.agent.runtime_pilot_freeze.${blockId}`,
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

function buildClaimRows({ sourceRows, claimAuditRows, protectedBlockRows }) {
  const passRows = [
    ...sourceRows.map((row) => passClaim("runtime_pilot_source_ready", `claim.platform.agent.runtime_pilot_freeze.source.${row.source_id}`, row)),
    ...claimAuditRows.map((row) => passClaim("runtime_pilot_claim_audit", `claim.platform.agent.runtime_pilot_freeze.claim_audit.${row.source_id}`, row)),
  ];
  const blockedRows = protectedBlockRows.map((row) => blockedClaim("runtime_pilot_protected_block", `claim.platform.agent.runtime_pilot_freeze.block.${row.protected_block_id}`, row));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-runtime-pilot-freeze-claim.row.${String(index + 1).padStart(2, "0")}`,
  }));
}

function passClaim(claimType, claimId, row) {
  return {
    schema_version: "agent-runtime-pilot-freeze-claim-row.v1",
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
    schema_version: "agent-runtime-pilot-freeze-claim-row.v1",
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

function buildCloseoutRows({ sourceRows, claimAuditRows, protectedBlockRows, claimRows }) {
  const rows = [
    ["all_sources_ready", sourceRows.every((row) => row.current_verdict === "pass"), "agent_runtime_pilot_freeze_source_rows"],
    ["all_source_claims_adjudicated", claimAuditRows.every((row) => row.current_verdict === "pass" && row.unsupported_claim_count === 0), "agent_runtime_pilot_freeze_claim_audit_rows"],
    ["final_claims_supported", claimRows.every((row) => isSupportedFreezeClaim(row)), "agent_runtime_pilot_freeze_claim_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 16 && protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "agent_runtime_pilot_freeze_protected_block_rows"],
    ["human_gate_requirements_documented", protectedBlockRows.every((row) => row.documented_human_gate_ref), "agent_runtime_pilot_freeze_protected_block_rows"],
    ["runtime_execution_disabled", protectedBlockRows.every((row) => row.agent_runtime_execution_allowed_now === false), "agent_runtime_pilot_freeze_boundary"],
    ["terminal_mcp_api_cron_disabled", protectedBlockRows.every((row) => row.terminal_execution_allowed_now === false && row.mcp_connection_allowed_now === false && row.api_server_start_allowed_now === false && row.cron_gateway_start_allowed_now === false), "agent_runtime_pilot_freeze_boundary"],
    ["package_install_secret_disabled", protectedBlockRows.every((row) => row.package_install_allowed_now === false && row.provider_secret_configuration_allowed_now === false && row.raw_secret_read_allowed_now === false), "agent_runtime_pilot_freeze_boundary"],
    ["raw_material_zendd_mutation_disabled", protectedBlockRows.every((row) => row.raw_client_or_vdr_access_allowed_now === false && row.direct_zendd_mutation_allowed_now === false), "agent_runtime_pilot_freeze_boundary"],
    ["protected_action_final_authority_disabled", protectedBlockRows.every((row) => row.protected_action_execution_allowed_now === false && row.final_pass_or_approval_allowed_now === false), "agent_runtime_pilot_freeze_boundary"],
    ["dry_run_evidence_ready", claimAuditRows.some((row) => row.source_id === "dry_run_simulation" && row.current_verdict === "pass"), "agent_runtime_pilot_freeze_claim_audit_rows"],
    ["pilot_readiness_freeze_ready", claimRows.length === 36, "agent_runtime_pilot_freeze_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-runtime-pilot-freeze-closeout-row.v1",
    row_id: `agent-runtime-pilot-freeze-closeout.row.${String(index + 1).padStart(2, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.runtime_pilot_freeze.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_runtime_pilot_freeze_closeout",
    hard_gate_ref: `gate.platform.agent.runtime_pilot_freeze.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1200 closeout`,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildAnchor({ packageJson, runtimePilotLedger, sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-runtime-pilot-freeze-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    runtime_pilot_ledger_present: runtimePilotLedger.available,
    source_count: sourceRows.length,
    source_claim_count: claimAuditRows.reduce((sum, row) => sum + row.source_claim_count, 0),
    source_pass_claim_count: claimAuditRows.reduce((sum, row) => sum + row.source_pass_claim_count, 0),
    source_blocked_claim_count: claimAuditRows.reduce((sum, row) => sum + row.source_blocked_claim_count, 0),
    unsupported_claim_count: claimAuditRows.reduce((sum, row) => sum + row.unsupported_claim_count, 0),
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, runtimePilotLedger, sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_dry_run_simulation", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["runtime_pilot_ledger_declares_freeze", runtimePilotLedger.available && ["P1199-P1200", COMMAND_NAME, "Agent Runtime Pilot Readiness Freeze"].every((token) => runtimePilotLedger.text.includes(token)), "docs/hermes-agent-runtime-pilot-phase-ledger.md"],
    ...sourceRows.map((row) => [`source_${row.source_id}_ready`, row.current_verdict === "pass", row.row_id]),
    ["source_claim_audits_pass", claimAuditRows.every((row) => row.current_verdict === "pass"), "agent_runtime_pilot_freeze_claim_audit_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 16 && protectedBlockRows.every((row) => row.current_verdict === "blocked"), "agent_runtime_pilot_freeze_protected_block_rows"],
    ["final_claims_supported", claimRows.every((row) => isSupportedFreezeClaim(row)), "agent_runtime_pilot_freeze_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_runtime_pilot_freeze_closeout_rows"],
    ["unsafe_boundary_false", true, "agent_runtime_pilot_freeze_boundary"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-runtime-pilot-freeze-gate-row.v1",
    row_id: `agent-runtime-pilot-freeze-gate.row.${String(index + 1).padStart(2, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.runtime_pilot_freeze.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_runtime_pilot_freeze_gate",
    hard_gate_ref: `gate.platform.agent.runtime_pilot_freeze.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1200 closeout`,
    unsafe_flags_false: true,
  }));
}

function buildBoundary({ generatedAt, sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows, gateRows }) {
  return {
    schema_version: "agent-runtime-pilot-freeze-boundary.v1",
    generated_at: generatedAt,
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    source_count: sourceRows.length,
    source_claim_count: claimAuditRows.reduce((sum, row) => sum + row.source_claim_count, 0),
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    human_approved_pilot_ready_for_future_receipt: true,
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

function buildValidationItems({ sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All runtime pilot freeze gates must be ready."],
    ["sources.ready", sourceRows.length === 10 && sourceRows.every((row) => row.current_verdict === "pass"), "All P1122-P1198 sources must be ready."],
    ["claim_audits.pass", claimAuditRows.length === 10 && claimAuditRows.every((row) => row.current_verdict === "pass" && row.unsupported_claim_count === 0), "Every source claim must be PASS or documented BLOCK."],
    ["blocks.documented", protectedBlockRows.length === 16 && protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action && row.documented_human_gate_ref), "Protected runtime pilot paths must be documented BLOCK rows."],
    ["claims.supported", claimRows.length === 36 && claimRows.every((row) => isSupportedFreezeClaim(row)), "Freeze claims must be supported."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
    ["boundary.false", allBoundaryUnsafeFlagsFalse(boundary), "Runtime pilot freeze must not enable runtime, tools, services, secrets, raw data, Zendd mutation, protected action execution, final authority, legal judgment, or release decisions."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_runtime_pilot_freeze", passed, message));
}

function isSupportedFreezeClaim(row) {
  if (row.current_verdict === "pass") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
  }
  if (row.current_verdict === "blocked") {
    return Boolean(row.evidence_ref && row.reviewer_ref && row.hard_gate_ref && row.block_reason && row.responsible_owner && row.next_allowed_action && row.verdict_authority === "harness_only");
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

function buildSummary({ sourceRows, claimAuditRows, protectedBlockRows, claimRows, closeoutRows, gateRows, boundary, validation }) {
  return {
    platform_agent_runtime_pilot_freeze_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_count: sourceRows.length,
    source_claim_count: claimAuditRows.reduce((sum, row) => sum + row.source_claim_count, 0),
    source_pass_claim_count: claimAuditRows.reduce((sum, row) => sum + row.source_pass_claim_count, 0),
    source_blocked_claim_count: claimAuditRows.reduce((sum, row) => sum + row.source_blocked_claim_count, 0),
    unsupported_claim_count: claimAuditRows.reduce((sum, row) => sum + row.unsupported_claim_count, 0),
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    human_approved_pilot_ready_for_future_receipt: boundary.human_approved_pilot_ready_for_future_receipt,
    agent_runtime_execution_allowed_now: boundary.agent_runtime_execution_allowed_now,
    terminal_execution_allowed_now: boundary.terminal_execution_allowed_now,
    mcp_connection_allowed_now: boundary.mcp_connection_allowed_now,
    api_server_start_allowed_now: boundary.api_server_start_allowed_now,
    cron_gateway_start_allowed_now: boundary.cron_gateway_start_allowed_now,
    package_install_allowed_now: boundary.package_install_allowed_now,
    provider_secret_configuration_allowed_now: boundary.provider_secret_configuration_allowed_now,
    raw_secret_read_allowed_now: boundary.raw_secret_read_allowed_now,
    raw_client_or_vdr_access_allowed_now: boundary.raw_client_or_vdr_access_allowed_now,
    direct_zendd_mutation_allowed_now: boundary.direct_zendd_mutation_allowed_now,
    protected_action_execution_allowed_now: boundary.protected_action_execution_allowed_now,
    receipt_application_allowed_now: boundary.receipt_application_allowed_now,
    final_pass_or_approval_allowed_now: boundary.final_pass_or_approval_allowed_now,
    legal_final_judgment_allowed_now: boundary.legal_final_judgment_allowed_now,
    release_decision_allowed_now: boundary.release_decision_allowed_now,
    unsafe_flag_count: allBoundaryUnsafeFlagsFalse(boundary) ? 0 : 1,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Runtime Pilot Freeze",
    "",
    `Status: ${result.summary.platform_agent_runtime_pilot_freeze_status}`,
    `Phase: ${PHASE_RANGE}`,
    `Sources: ${result.summary.source_count}`,
    `Source claims audited: ${result.summary.source_claim_count}`,
    `Protected blocks: ${result.summary.protected_block_count}`,
    `Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`,
    "",
    "The runtime pilot is ready for future human-approved receipt intake only. Agent runtime execution, tools, services, package install, secrets, raw material, Zendd mutation, protected actions, final authority, legal final judgment, and release decisions remain disabled or documented BLOCK.",
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
  const defaults = DEFAULT_PLATFORM_AGENT_RUNTIME_PILOT_FREEZE_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-runtime-pilot-freeze.mjs [--check] [--out-dir DIR]\n\nCreates the P1199-P1200 Agent runtime pilot readiness freeze while keeping runtime, tools, services, secrets, raw material, Zendd mutation, protected actions, final authority, legal judgment, and release decisions disabled or documented BLOCK.`);
}
