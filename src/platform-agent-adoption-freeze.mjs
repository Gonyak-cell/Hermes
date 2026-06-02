import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentAuthorityFreeze } from "./platform-agent-authority-freeze.mjs";
import { buildPlatformAgentCapabilityRegistry } from "./platform-agent-capability-registry.mjs";
import { buildPlatformAgentDomainRollout } from "./platform-agent-domain-rollout.mjs";
import { buildPlatformAgentInstallTrustGate } from "./platform-agent-install-trust-gate.mjs";
import { buildPlatformAgentIsolatedInstallGate } from "./platform-agent-isolated-install-gate.mjs";

export const DEFAULT_PLATFORM_AGENT_ADOPTION_FREEZE_OUT_DIR = "artifacts/platform-agent-adoption-freeze/latest";
export const DEFAULT_PLATFORM_AGENT_ADOPTION_FREEZE_INPUTS = {
  schemaPath: "schemas/platform-agent-adoption-freeze.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-adoption-freeze";
const SOURCE_COMMAND_NAME = "platform:agent-domain-rollout";
const SCHEMA_VERSION = "platform-agent-adoption-freeze.v1";
const CAPABILITY_ID = "platform.agent_operations.adoption_freeze";
const PROGRAM_RANGE = "P1041-P1121";
const PHASE_RANGE = "P1113-P1121";
const PHASE_SLOT = "P1113";
const PREVIOUS_PHASE_SLOT = "P1112";
const NEXT_PHASE_SLOT = "P1122";
const READY_STATUS = "ready_for_agent_adoption_freeze";

const SOURCE_SPECS = [
  {
    source_id: "agent_authority_freeze",
    phase_range: "P1041-P1044",
    command_name: "platform:agent-authority-freeze",
    expected_status: "ready_for_agent_authority_freeze",
    summary_status_key: "platform_agent_authority_freeze_status",
    result_id_key: "platform_agent_authority_freeze_id",
    claim_rows_key: "agent_authority_claim_rows",
  },
  {
    source_id: "agent_install_trust_gate",
    phase_range: "P1045-P1056",
    command_name: "platform:agent-install-trust-gate",
    expected_status: "ready_for_agent_install_trust_gate",
    summary_status_key: "platform_agent_install_trust_gate_status",
    result_id_key: "platform_agent_install_trust_gate_id",
    claim_rows_key: "agent_install_trust_claim_rows",
  },
  {
    source_id: "agent_isolated_install_gate",
    phase_range: "P1057-P1064",
    command_name: "platform:agent-isolated-install-gate",
    expected_status: "ready_for_agent_isolated_install_gate",
    summary_status_key: "platform_agent_isolated_install_gate_status",
    result_id_key: "platform_agent_isolated_install_gate_id",
    claim_rows_key: "agent_isolated_install_claim_rows",
  },
  {
    source_id: "agent_capability_registry",
    phase_range: "P1065-P1088",
    command_name: "platform:agent-capability-registry",
    expected_status: "ready_for_agent_capability_registry",
    summary_status_key: "platform_agent_capability_registry_status",
    result_id_key: "platform_agent_capability_registry_id",
    claim_rows_key: "agent_capability_registry_claim_rows",
  },
  {
    source_id: "agent_domain_rollout",
    phase_range: "P1089-P1112",
    command_name: "platform:agent-domain-rollout",
    expected_status: "ready_for_agent_domain_rollout",
    summary_status_key: "platform_agent_domain_rollout_status",
    result_id_key: "platform_agent_domain_rollout_id",
    claim_rows_key: "agent_domain_rollout_claim_rows",
  },
];

const INVARIANT_SPECS = [
  ["no_install_execution", "install_execution_allowed_now"],
  ["no_runtime_execution", "runtime_execution_allowed_now"],
  ["no_terminal_execution", "terminal_execution_allowed_now"],
  ["no_mcp_connection", "mcp_connection_allowed_now"],
  ["no_api_server_start", "api_server_start_allowed_now"],
  ["no_cron_gateway_start", "cron_or_gateway_start_allowed_now"],
  ["no_provider_secret_configuration", "provider_secret_configuration_allowed_now"],
  ["no_raw_secret_context", "raw_secret_context_allowed"],
  ["no_raw_client_vdr_context", "raw_client_or_vdr_context_allowed"],
  ["no_direct_zendd_mutation", "direct_zendd_mutation_allowed"],
  ["no_source_tree_movement", "source_tree_movement_allowed"],
  ["no_agent_final_pass", "agent_may_create_final_pass"],
  ["no_protected_output_finalization", "protected_output_finalization_allowed"],
  ["no_live_order_submission", "live_order_submission_allowed"],
  ["no_yolo_or_approval_off", "yolo_or_approval_off_allowed"],
  ["no_secret_forwarding", "secret_forwarding_allowed"],
];

const PROTECTED_BLOCK_SPECS = [
  ["install_execution_without_receipt", "missing_human_receipt", "collect install human receipt and rerun isolated install gate"],
  ["doctor_smoke_without_install", "install_not_yet_performed", "complete approved isolated install before doctor smoke"],
  ["runtime_execution_without_freeze", "runtime_not_authorized", "create runtime execution packet with human receipt"],
  ["terminal_execution_without_receipt", "terminal_execution_forbidden", "route command through command-candidate evidence packet"],
  ["mcp_connection_without_review", "unreviewed_mcp_connection", "review MCP server policy and collect owner receipt"],
  ["api_server_start_without_freeze", "api_server_start_forbidden", "publish read-only API start packet after freeze refresh"],
  ["cron_gateway_start_without_freeze", "cron_or_gateway_start_forbidden", "publish scheduler/gateway packet after freeze refresh"],
  ["raw_secret_context", "raw_secret_access", "replace raw secrets with secret-handle refs"],
  ["raw_client_vdr_context", "raw_client_or_vdr_exposure", "replace raw client/VDR data with source-span evidence refs"],
  ["direct_zendd_mutation", "direct_zendd_mutation", "use external Zendd adapter safe patch lane with receipt"],
  ["legal_final_judgment", "legal_final_judgment", "route legal output to attorney review and receipt"],
  ["live_order_submission", "unsafe_live_order_submission", "keep live broker write route disabled"],
  ["protected_output_finalization", "protected_output_without_receipt", "collect domain owner receipt before finalization"],
  ["agent_final_pass", "direct_pass_authority", "route PASS through harness freeze adjudication"],
  ["yolo_approval_off", "yolo_or_approval_off", "keep approval policy enforced and document tool policy"],
  ["secret_forwarding", "secret_forwarding", "disable secret forwarding and use scoped handles only"],
];

const OPERATOR_SURFACE_ROUTES = [
  "/api/agent/adoption-freeze/sources",
  "/api/agent/adoption-freeze/claim-audit",
  "/api/agent/adoption-freeze/invariants",
  "/api/agent/adoption-freeze/protected-blocks",
  "/api/agent/adoption-freeze/next-actions",
];

export async function runPlatformAgentAdoptionFreeze(options = {}) {
  const result = await buildPlatformAgentAdoptionFreeze(options);
  if (options.write !== false) await writePlatformAgentAdoptionFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent adoption freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentAdoptionFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_ADOPTION_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.agent_operations_phase_ledger_path);
  const sources = await buildSources(generatedAt, inputs);

  const freezePolicy = buildFreezePolicy(generatedAt, sources);
  const sourceRows = buildSourceRows(sources);
  const claimAuditRows = buildClaimAuditRows(sources);
  const invariantRows = buildInvariantRows(freezePolicy);
  const protectedBlockRows = buildProtectedBlockRows();
  const operatorSurfaceRows = buildOperatorSurfaceRows();
  const claimRows = buildClaimRows({ sourceRows, claimAuditRows, invariantRows, operatorSurfaceRows, protectedBlockRows });
  const closeoutRows = buildCloseoutRows({ freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_adoption_freeze_id: `platform-agent-adoption-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_adoption_freeze_anchor: anchor,
    source_agent_operation_summaries: sourceRows.map((row) => ({
      source_id: row.source_id,
      command_name: row.command_name,
      phase_range: row.phase_range,
      source_result_ref: row.source_result_ref,
      source_status: row.source_status,
      claim_count: row.claim_count,
      pass_claim_count: row.pass_claim_count,
      blocked_claim_count: row.blocked_claim_count,
    })),
    agent_adoption_freeze_policy: freezePolicy,
    agent_adoption_source_rows: sourceRows,
    agent_adoption_claim_audit_rows: claimAuditRows,
    agent_adoption_invariant_rows: invariantRows,
    agent_adoption_protected_block_rows: protectedBlockRows,
    agent_adoption_operator_surface_rows: operatorSurfaceRows,
    agent_adoption_claim_rows: claimRows,
    agent_adoption_closeout_rows: closeoutRows,
    agent_adoption_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_adoption_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows, gateRows, validation: result.validation });
  result.summary.platform_agent_adoption_freeze_id = result.platform_agent_adoption_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentAdoptionFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-adoption-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-adoption-freeze-policy.json"), result.agent_adoption_freeze_policy);
  await writeJson(path.join(outDir, "agent-adoption-source-rows.json"), collectionEnvelope("agent-adoption-source-rows.v1", "agent_adoption_source_rows", result.agent_adoption_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-adoption-claim-audit-rows.json"), collectionEnvelope("agent-adoption-claim-audit-rows.v1", "agent_adoption_claim_audit_rows", result.agent_adoption_claim_audit_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-adoption-invariant-rows.json"), collectionEnvelope("agent-adoption-invariant-rows.v1", "agent_adoption_invariant_rows", result.agent_adoption_invariant_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-adoption-protected-block-rows.json"), collectionEnvelope("agent-adoption-protected-block-rows.v1", "agent_adoption_protected_block_rows", result.agent_adoption_protected_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-adoption-operator-surface-rows.json"), collectionEnvelope("agent-adoption-operator-surface-rows.v1", "agent_adoption_operator_surface_rows", result.agent_adoption_operator_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-adoption-claim-rows.json"), collectionEnvelope("agent-adoption-claim-rows.v1", "agent_adoption_claim_rows", result.agent_adoption_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-adoption-closeout-rows.json"), collectionEnvelope("agent-adoption-closeout-rows.v1", "agent_adoption_closeout_rows", result.agent_adoption_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-adoption-gate-rows.json"), collectionEnvelope("agent-adoption-gate-rows.v1", "agent_adoption_gate_rows", result.agent_adoption_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-adoption-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentAdoptionFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentAdoptionFreeze(args);
    console.log(`Platform agent adoption freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_adoption_freeze_status}`);
    console.log(`Sources: ${result.summary.source_count}`);
    console.log(`Source claims audited: ${result.summary.source_claim_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.runtime_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

async function buildSources(generatedAt, inputs) {
  const common = {
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  };
  const results = [
    await buildPlatformAgentAuthorityFreeze(common),
    await buildPlatformAgentInstallTrustGate(common),
    await buildPlatformAgentIsolatedInstallGate(common),
    await buildPlatformAgentCapabilityRegistry(common),
    await buildPlatformAgentDomainRollout(common),
  ];
  return SOURCE_SPECS.map((spec, index) => ({ spec, result: results[index] }));
}

function buildFreezePolicy(generatedAt, sources) {
  return {
    schema_version: "platform-agent-adoption-freeze-policy.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    freeze_mode: "top_level_agent_adoption_freeze",
    source_status_refs: sources.map(({ spec, result }) => ({
      source_id: spec.source_id,
      command_name: spec.command_name,
      result_ref: result[spec.result_id_key],
      status: result.summary[spec.summary_status_key],
    })),
    install_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_or_gateway_start_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    raw_secret_context_allowed: false,
    raw_client_or_vdr_context_allowed: false,
    direct_zendd_mutation_allowed: false,
    source_tree_movement_allowed: false,
    legal_final_judgment_allowed: false,
    live_order_submission_allowed: false,
    protected_output_finalization_allowed: false,
    agent_may_create_final_pass: false,
    agent_may_apply_human_receipt: false,
    agent_may_execute_protected_action: false,
    yolo_mode_allowed: false,
    approval_off_allowed: false,
    yolo_or_approval_off_allowed: false,
    secret_forwarding_allowed: false,
    verdict_authority: "harness_only",
    next_allowed_action: "keep Agent adoption freeze evidence attached; future install or runtime operation requires human receipt and explicit freeze refresh",
    created_at: generatedAt,
  };
}

function buildSourceRows(sources) {
  return sources.map(({ spec, result }, index) => {
    const claimRows = result[spec.claim_rows_key] ?? [];
    return {
      schema_version: "agent-adoption-source-row.v1",
      row_id: `agent-adoption-source.row.${String(index + 1).padStart(3, "0")}`,
      source_id: spec.source_id,
      phase_range: spec.phase_range,
      command_name: spec.command_name,
      source_result_ref: result[spec.result_id_key],
      source_status: result.summary[spec.summary_status_key],
      expected_status: spec.expected_status,
      current_verdict: result.summary[spec.summary_status_key] === spec.expected_status ? "pass" : "blocked",
      claim_count: claimRows.length,
      pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
      blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
      validation_error_count: result.summary.validation_error_count,
      evidence_ref: `evidence.platform.agent.adoption_freeze.source.${spec.source_id}`,
      reviewer_ref: "reviewer.platform.agent_adoption_freeze_source",
      hard_gate_ref: `gate.platform.agent.adoption_freeze.source.${spec.source_id}`,
      block_reason: result.summary[spec.summary_status_key] === spec.expected_status ? null : "source_status_not_ready",
      responsible_owner: "platform_agent_owner",
      next_allowed_action: result.summary[spec.summary_status_key] === spec.expected_status ? "keep source gate evidence attached" : `rerun ${spec.command_name} -- --check before adoption freeze`,
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildClaimAuditRows(sources) {
  return sources.map(({ spec, result }, index) => {
    const claimRows = result[spec.claim_rows_key] ?? [];
    const supported = claimRows.every((row) => isSupportedClaimState(row));
    return {
      schema_version: "agent-adoption-claim-audit-row.v1",
      row_id: `agent-adoption-claim-audit.row.${String(index + 1).padStart(3, "0")}`,
      source_id: spec.source_id,
      source_claim_rows_ref: spec.claim_rows_key,
      current_verdict: supported ? "pass" : "blocked",
      audited_claim_count: claimRows.length,
      pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
      blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
      unsupported_claim_count: claimRows.filter((row) => !isSupportedClaimState(row)).length,
      pass_requires_evidence_reviewer_gate: true,
      block_requires_reason_owner_next_action: true,
      verdict_authority_required: "harness_only",
      evidence_ref: `evidence.platform.agent.adoption_freeze.claim_audit.${spec.source_id}`,
      reviewer_ref: "reviewer.platform.agent_adoption_freeze_claim_audit",
      hard_gate_ref: `gate.platform.agent.adoption_freeze.claim_audit.${spec.source_id}`,
      block_reason: supported ? null : "unsupported_claim_state",
      responsible_owner: "platform_agent_owner",
      next_allowed_action: supported ? "keep claim audit evidence attached" : `repair unsupported claims in ${spec.command_name}`,
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    };
  });
}

function buildInvariantRows(freezePolicy) {
  return INVARIANT_SPECS.map(([invariantId, policyField], index) => {
    const pass = freezePolicy[policyField] === false;
    return {
      schema_version: "agent-adoption-invariant-row.v1",
      row_id: `agent-adoption-invariant.row.${String(index + 1).padStart(3, "0")}`,
      invariant_id: invariantId,
      policy_field: policyField,
      current_verdict: pass ? "pass" : "blocked",
      expected_value: false,
      observed_value: freezePolicy[policyField],
      evidence_ref: `evidence.platform.agent.adoption_freeze.invariant.${invariantId}`,
      reviewer_ref: "reviewer.platform.agent_adoption_freeze_invariant",
      hard_gate_ref: `gate.platform.agent.adoption_freeze.invariant.${invariantId}`,
      block_reason: pass ? null : `unsafe_${policyField}`,
      responsible_owner: "platform_agent_owner",
      next_allowed_action: pass ? "keep invariant evidence attached" : `disable ${policyField} before adoption freeze`,
      unsafe_flags_false: pass,
      verdict_authority: "harness_only",
    };
  });
}

function buildProtectedBlockRows() {
  return PROTECTED_BLOCK_SPECS.map(([protected_action_id, blockReason, nextAllowedAction], index) => ({
    schema_version: "agent-adoption-protected-block-row.v1",
    row_id: `agent-adoption-protected-block.row.${String(index + 1).padStart(3, "0")}`,
    protected_action_id,
    current_verdict: "blocked",
    block_reason: blockReason,
    documented_human_gate_required: true,
    human_receipt_ref: `receipt.template.platform.agent.adoption_freeze.${protected_action_id}`,
    receipt_payload_present: false,
    evidence_ref: `evidence.platform.agent.adoption_freeze.protected_block.${protected_action_id}`,
    reviewer_ref: "reviewer.platform.agent_adoption_freeze_protected_block",
    hard_gate_ref: `gate.platform.agent.adoption_freeze.protected_block.${protected_action_id}`,
    responsible_owner: ownerForProtectedAction(protected_action_id),
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildOperatorSurfaceRows() {
  return OPERATOR_SURFACE_ROUTES.map((routePath, index) => ({
    schema_version: "agent-adoption-operator-surface-row.v1",
    row_id: `agent-adoption-operator-surface.row.${String(index + 1).padStart(3, "0")}`,
    route_path: routePath,
    current_verdict: "pass",
    route_mode: "read_only_planned_surface",
    server_started: false,
    mutation_route_count: 0,
    protected_action_route_count: 0,
    raw_material_route_count: 0,
    evidence_ref: `evidence.platform.agent.adoption_freeze.operator_surface.${routePath.replaceAll("/", ".").slice(1)}`,
    reviewer_ref: "reviewer.platform.agent_adoption_freeze_operator_surface",
    hard_gate_ref: `gate.platform.agent.adoption_freeze.operator_surface.${String(index + 1).padStart(3, "0")}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "wire read-only dashboard/API surface after adoption freeze remains green",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ sourceRows, claimAuditRows, invariantRows, operatorSurfaceRows, protectedBlockRows }) {
  const passRows = [
    ...sourceRows.map((row) => passClaim("agent_adoption_source", `claim.platform.agent.adoption_freeze.source.${row.source_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...claimAuditRows.map((row) => passClaim("agent_adoption_claim_audit", `claim.platform.agent.adoption_freeze.claim_audit.${row.source_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...invariantRows.map((row) => passClaim("agent_adoption_invariant", `claim.platform.agent.adoption_freeze.invariant.${row.invariant_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...operatorSurfaceRows.map((row) => passClaim("agent_adoption_operator_surface", `claim.platform.agent.adoption_freeze.operator_surface.${row.route_path}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
  ];
  const blockedRows = protectedBlockRows.map((row) => blockedClaim("agent_adoption_protected_block", `claim.platform.agent.adoption_freeze.protected_block.${row.protected_action_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.block_reason, row.next_allowed_action, row.human_receipt_ref));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-adoption-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows }) {
  const rows = [
    ["source_statuses_ready", sourceRows.every((row) => row.current_verdict === "pass"), "agent_adoption_source_rows"],
    ["source_claim_count_frozen", total(sourceRows, "claim_count") === 211, "agent_adoption_source_rows"],
    ["source_pass_block_totals_frozen", total(sourceRows, "pass_claim_count") === 164 && total(sourceRows, "blocked_claim_count") === 47, "agent_adoption_source_rows"],
    ["source_claims_supported", claimAuditRows.every((row) => row.current_verdict === "pass" && row.unsupported_claim_count === 0), "agent_adoption_claim_audit_rows"],
    ["invariants_pass", invariantRows.every((row) => row.current_verdict === "pass"), "agent_adoption_invariant_rows"],
    ["protected_blocks_documented", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.responsible_owner && row.next_allowed_action), "agent_adoption_protected_block_rows"],
    ["operator_surface_read_only", operatorSurfaceRows.every((row) => row.server_started === false && row.mutation_route_count === 0 && row.raw_material_route_count === 0), "agent_adoption_operator_surface_rows"],
    ["no_runtime_install_secret_raw_or_mutation", allPolicyUnsafeFlagsFalse(freezePolicy), "agent_adoption_freeze_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_adoption_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-adoption-closeout-row.v1",
    row_id: `agent-adoption-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.adoption_freeze.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_adoption_freeze_closeout",
    hard_gate_ref: `gate.platform.agent.adoption_freeze.closeout.${closeoutId}`,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1121 closeout`,
  }));
}

function buildAnchor({ packageJson, phaseLedger, freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-adoption-freeze-anchor.v1",
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
    phase_ledger_present: phaseLedger.available,
    freeze_mode: freezePolicy.freeze_mode,
    source_count: sourceRows.length,
    source_claim_count: total(sourceRows, "claim_count"),
    source_pass_claim_count: total(sourceRows, "pass_claim_count"),
    source_blocked_claim_count: total(sourceRows, "blocked_claim_count"),
    claim_audit_count: claimAuditRows.length,
    invariant_count: invariantRows.length,
    protected_block_count: protectedBlockRows.length,
    operator_surface_count: operatorSurfaceRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, phaseLedger, freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_domain_rollout", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["phase_ledger_declares_freeze", phaseLedger.available && ["P1113-P1121", COMMAND_NAME, "Agent Adoption Freeze"].every((token) => phaseLedger.text.includes(token)), "docs/hermes-agent-operations-phase-ledger.md"],
    ["source_statuses_ready", sourceRows.length === 5 && sourceRows.every((row) => row.current_verdict === "pass"), "agent_adoption_source_rows"],
    ["source_claim_totals_frozen", total(sourceRows, "claim_count") === 211 && total(sourceRows, "pass_claim_count") === 164 && total(sourceRows, "blocked_claim_count") === 47, "agent_adoption_source_rows"],
    ["source_claims_supported", claimAuditRows.length === 5 && claimAuditRows.every((row) => row.current_verdict === "pass" && row.unsupported_claim_count === 0), "agent_adoption_claim_audit_rows"],
    ["invariants_ready", invariantRows.length === 16 && invariantRows.every((row) => row.current_verdict === "pass"), "agent_adoption_invariant_rows"],
    ["protected_blocks_documented", protectedBlockRows.length === 16 && protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "agent_adoption_protected_block_rows"],
    ["operator_surface_read_only", operatorSurfaceRows.length === 5 && operatorSurfaceRows.every((row) => row.server_started === false && row.mutation_route_count === 0 && row.raw_material_route_count === 0), "agent_adoption_operator_surface_rows"],
    ["no_runtime_install_secret_or_raw_context", allPolicyUnsafeFlagsFalse(freezePolicy), "agent_adoption_freeze_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_adoption_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_adoption_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-adoption-gate-row.v1",
    row_id: `agent-adoption-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.adoption_freeze.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_adoption_freeze_gate",
    hard_gate_ref: `gate.platform.agent.adoption_freeze.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    runtime_execution_performed_by_gate: false,
    terminal_execution_performed_by_gate: false,
    install_execution_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    raw_material_exposed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1121 closeout`,
  }));
}

function buildValidationItems({ gateRows, freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All adoption freeze gates must be ready."],
    ["sources.ready", sourceRows.length === 5 && sourceRows.every((row) => row.current_verdict === "pass"), "All source Agent phases must be ready."],
    ["sources.claim_totals", total(sourceRows, "claim_count") === 211 && total(sourceRows, "pass_claim_count") === 164 && total(sourceRows, "blocked_claim_count") === 47, "Source claim totals must be frozen."],
    ["claims.source_audited", claimAuditRows.every((row) => row.unsupported_claim_count === 0), "Every source claim must be PASS or documented BLOCK."],
    ["policy.no_unsafe_flags", allPolicyUnsafeFlagsFalse(freezePolicy), "Adoption freeze must keep unsafe policy flags false."],
    ["invariants.pass", invariantRows.length === 16 && invariantRows.every((row) => row.current_verdict === "pass"), "All invariants must pass."],
    ["protected.blocks", protectedBlockRows.length === 16 && protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Protected actions must remain documented BLOCK."],
    ["operator.read_only", operatorSurfaceRows.every((row) => row.server_started === false && row.mutation_route_count === 0 && row.raw_material_route_count === 0), "Operator surface must remain read-only."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Adoption freeze claims must be supported."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_adoption_freeze", passed, message));
}

function passClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, nextAllowedAction, humanReceiptRef = null) {
  return {
    schema_version: "agent-adoption-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "pass",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: null,
    responsible_owner: responsibleOwner,
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, blockReason, nextAllowedAction, humanReceiptRef = null) {
  return {
    schema_version: "agent-adoption-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "blocked",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: blockReason,
    responsible_owner: responsibleOwner,
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
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

function allPolicyUnsafeFlagsFalse(policy) {
  return [
    "install_execution_allowed_now",
    "runtime_execution_allowed_now",
    "terminal_execution_allowed_now",
    "mcp_connection_allowed_now",
    "api_server_start_allowed_now",
    "cron_or_gateway_start_allowed_now",
    "provider_secret_configuration_allowed_now",
    "raw_secret_context_allowed",
    "raw_client_or_vdr_context_allowed",
    "direct_zendd_mutation_allowed",
    "source_tree_movement_allowed",
    "legal_final_judgment_allowed",
    "live_order_submission_allowed",
    "protected_output_finalization_allowed",
    "agent_may_create_final_pass",
    "agent_may_apply_human_receipt",
    "agent_may_execute_protected_action",
    "yolo_mode_allowed",
    "approval_off_allowed",
    "yolo_or_approval_off_allowed",
    "secret_forwarding_allowed",
  ].every((field) => policy[field] === false);
}

function ownerForProtectedAction(protectedActionId) {
  if (protectedActionId.includes("zendd")) return "project_zendd_owner";
  if (protectedActionId.includes("legal")) return "legal_domain_owner";
  if (protectedActionId.includes("live_order")) return "trading_safety_owner";
  if (protectedActionId.includes("secret")) return "security_owner";
  if (protectedActionId.includes("raw_client") || protectedActionId.includes("raw_secret")) return "data_boundary_owner";
  if (protectedActionId.includes("install") || protectedActionId.includes("runtime") || protectedActionId.includes("terminal")) return "platform_agent_runtime_owner";
  return "platform_agent_owner";
}

function buildSummary({ freezePolicy, sourceRows, claimAuditRows, invariantRows, protectedBlockRows, operatorSurfaceRows, claimRows, closeoutRows, gateRows, validation }) {
  return {
    platform_agent_adoption_freeze_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    freeze_mode: freezePolicy.freeze_mode,
    source_count: sourceRows.length,
    source_claim_count: total(sourceRows, "claim_count"),
    source_pass_claim_count: total(sourceRows, "pass_claim_count"),
    source_blocked_claim_count: total(sourceRows, "blocked_claim_count"),
    claim_audit_count: claimAuditRows.length,
    invariant_count: invariantRows.length,
    protected_block_count: protectedBlockRows.length,
    operator_surface_count: operatorSurfaceRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    install_execution_allowed_now: freezePolicy.install_execution_allowed_now,
    runtime_execution_allowed_now: freezePolicy.runtime_execution_allowed_now,
    terminal_execution_allowed_now: freezePolicy.terminal_execution_allowed_now,
    mcp_connection_allowed_now: freezePolicy.mcp_connection_allowed_now,
    api_server_start_allowed_now: freezePolicy.api_server_start_allowed_now,
    cron_or_gateway_start_allowed_now: freezePolicy.cron_or_gateway_start_allowed_now,
    provider_secret_configuration_allowed_now: freezePolicy.provider_secret_configuration_allowed_now,
    raw_secret_context_allowed: freezePolicy.raw_secret_context_allowed,
    raw_client_or_vdr_context_allowed: freezePolicy.raw_client_or_vdr_context_allowed,
    direct_zendd_mutation_allowed: freezePolicy.direct_zendd_mutation_allowed,
    source_tree_movement_allowed: freezePolicy.source_tree_movement_allowed,
    legal_final_judgment_allowed: freezePolicy.legal_final_judgment_allowed,
    live_order_submission_allowed: freezePolicy.live_order_submission_allowed,
    protected_output_finalization_allowed: freezePolicy.protected_output_finalization_allowed,
    agent_may_create_final_pass: freezePolicy.agent_may_create_final_pass,
    yolo_or_approval_off_allowed: freezePolicy.yolo_or_approval_off_allowed,
    secret_forwarding_allowed: freezePolicy.secret_forwarding_allowed,
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Adoption Freeze",
    "",
    `Status: ${result.summary.platform_agent_adoption_freeze_status}`,
    `Phase: ${result.summary.phase_range}`,
    `Sources: ${result.summary.source_count}`,
    `Source claims audited: ${result.summary.source_claim_count}`,
    `Freeze claims: ${result.summary.pass_claim_count} PASS / ${result.summary.blocked_claim_count} BLOCK`,
    "",
    "## Frozen Boundaries",
    "",
    "- Install execution allowed now: false",
    "- Runtime execution allowed now: false",
    "- Terminal execution allowed now: false",
    "- MCP/API/cron start allowed now: false",
    "- Raw secret/client/VDR context allowed: false",
    "- Direct Zendd mutation allowed: false",
    "- Agent-created final PASS allowed: false",
    "",
    "## Next Allowed Action",
    "",
    result.agent_adoption_freeze_policy.next_allowed_action,
  ];
  return `${lines.join("\n")}\n`;
}

function collectionEnvelope(schemaVersion, key, rows, generatedAt) {
  return {
    schema_version: schemaVersion,
    generated_at: generatedAt,
    [key]: rows,
  };
}

function validateChainIncludes(packageJson, commandName) {
  const validate = packageJson.data?.scripts?.validate ?? "";
  return validate.includes(`npm run ${commandName} -- --check`);
}

function validationItem(id, category, passed, message) {
  return {
    id,
    category,
    passed,
    message: passed ? "ok" : message,
  };
}

function summarizeValidation(items) {
  const errors = items
    .filter((item) => !item.passed)
    .map((item) => ({ path: item.id, message: item.message }));
  return {
    valid: errors.length === 0,
    errors,
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_PLATFORM_AGENT_ADOPTION_FREEZE_INPUTS;
  return {
    schema_path: path.resolve(options.schemaPath ?? defaults.schemaPath),
    package_path: path.resolve(options.packagePath ?? defaults.packagePath),
    agent_operations_phase_ledger_path: path.resolve(options.agentOperationsPhaseLedgerPath ?? defaults.agentOperationsPhaseLedgerPath),
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

function total(rows, key) {
  return rows.reduce((sum, row) => sum + (row[key] ?? 0), 0);
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
    } else if (arg === "--phase-ledger") {
      args.agentOperationsPhaseLedgerPath = argv[++index];
    } else if (arg === "--run-at") {
      args.runAt = argv[++index];
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/platform-agent-adoption-freeze.mjs [--check] [--out-dir DIR]\n\nCreates the P1113-P1121 top-level Agent adoption freeze without installing or running Hermes Agent.`);
}
