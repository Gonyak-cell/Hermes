import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentCapabilityRegistry } from "./platform-agent-capability-registry.mjs";

export const DEFAULT_PLATFORM_AGENT_DOMAIN_ROLLOUT_OUT_DIR = "artifacts/platform-agent-domain-rollout/latest";
export const DEFAULT_PLATFORM_AGENT_DOMAIN_ROLLOUT_INPUTS = {
  schemaPath: "schemas/platform-agent-domain-rollout.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-domain-rollout";
const SOURCE_COMMAND_NAME = "platform:agent-capability-registry";
const SCHEMA_VERSION = "platform-agent-domain-rollout.v1";
const CAPABILITY_ID = "platform.agent_operations.domain_rollout";
const PROGRAM_RANGE = "P1041-P1121";
const PHASE_RANGE = "P1089-P1112";
const PHASE_SLOT = "P1089";
const PREVIOUS_PHASE_SLOT = "P1088";
const NEXT_PHASE_SLOT = "P1113";
const READY_STATUS = "ready_for_agent_domain_rollout";

const DOMAIN_ROUTE_PREFIX = {
  platform: "/api/agent/platform",
  "personal-dev": "/api/agent/personal-dev",
  "law-firm": "/api/agent/law-firm",
  "creative-document": "/api/agent/creative-document",
  "connectors-resource": "/api/agent/connectors-resource",
  trading: "/api/agent/trading",
  "project.zendd": "/api/agent/project-zendd",
};

const DOMAIN_ROLLOUT_FOCUS = {
  platform: ["claim_gap_detector", "evidence_candidate_indexer", "gate_packet_drafter", "recovery_draft_router"],
  "personal-dev": ["work_order_intake", "patch_plan_candidate", "command_candidate", "release_note_draft"],
  "law-firm": ["matter_triage_candidate", "ldd_vdr_evidence_candidate", "contract_review_draft", "attorney_review_packet"],
  "creative-document": ["template_mapping_candidate", "style_check_draft", "layout_plan_candidate", "export_quality_packet"],
  "connectors-resource": ["ingestion_candidate", "classification_candidate", "quarantine_review_packet", "source_span_evidence"],
  trading: ["research_packet_candidate", "backtest_plan_candidate", "safety_fixture_review", "risk_report_draft"],
  "project.zendd": ["work_order_candidate", "patch_plan_candidate", "command_evidence_candidate", "vdr_ldd_bridge_candidate", "release_sandbox_candidate"],
};

const HUMAN_REVIEW_DOMAINS = new Set(["law-firm", "trading", "project.zendd"]);

const PROTECTED_ROLLOUT_BLOCKS = [
  ["platform.final_pass_refresh", "agent_final_pass_forbidden", "route through platform freeze adjudication"],
  ["personal-dev.release_execution", "release_execution_forbidden", "create release execution packet with human receipt only"],
  ["law-firm.legal_final_advice", "legal_final_judgment", "route to attorney review and receipt"],
  ["creative-document.client_delivery", "protected_output_without_receipt", "queue export receipt before delivery"],
  ["connectors-resource.raw_material_export", "raw_restricted_payload_export", "use quarantine review packet"],
  ["trading.live_order_submission", "unsafe_live_order_submission", "keep live adapter and broker write disabled"],
  ["project.zendd.external_checkout_write", "direct_zendd_mutation", "use external adapter safe patch lane with receipt"],
  ["project.zendd.raw_vdr_read", "raw_client_or_vdr_exposure", "use VDR/LDD source-span refs only"],
];

export async function runPlatformAgentDomainRollout(options = {}) {
  const result = await buildPlatformAgentDomainRollout(options);
  if (options.write !== false) await writePlatformAgentDomainRollout(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent domain rollout failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentDomainRollout(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_DOMAIN_ROLLOUT_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.agent_operations_phase_ledger_path);
  const capabilityRegistry = await buildPlatformAgentCapabilityRegistry({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });

  const rolloutPolicy = buildRolloutPolicy(generatedAt, capabilityRegistry);
  const domainRolloutRows = buildDomainRolloutRows(capabilityRegistry);
  const capabilityRolloutRows = buildCapabilityRolloutRows(capabilityRegistry, domainRolloutRows);
  const zenddBridgeRows = buildZenddBridgeRows(capabilityRolloutRows);
  const operatorSurfaceRows = buildOperatorSurfaceRows(domainRolloutRows);
  const humanGateRows = buildHumanGateRows(domainRolloutRows);
  const protectedBlockRows = buildProtectedBlockRows();
  const claimRows = buildClaimRows({ domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows });
  const closeoutRows = buildCloseoutRows({ rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, capabilityRegistry, rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, capabilityRegistry, rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_domain_rollout_id: `platform-agent-domain-rollout.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_domain_rollout_anchor: anchor,
    source_agent_capability_registry_summary: capabilityRegistry.summary,
    agent_domain_rollout_policy: rolloutPolicy,
    domain_agent_rollout_rows: domainRolloutRows,
    domain_agent_capability_rollout_rows: capabilityRolloutRows,
    project_zendd_agent_bridge_rows: zenddBridgeRows,
    domain_agent_operator_surface_rows: operatorSurfaceRows,
    domain_agent_human_gate_rows: humanGateRows,
    protected_agent_rollout_block_rows: protectedBlockRows,
    agent_domain_rollout_claim_rows: claimRows,
    agent_domain_rollout_closeout_rows: closeoutRows,
    agent_domain_rollout_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_domain_rollout")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows, gateRows, validation: result.validation });
  result.summary.platform_agent_domain_rollout_id = result.platform_agent_domain_rollout_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentDomainRollout(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-domain-rollout.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-domain-rollout-policy.json"), result.agent_domain_rollout_policy);
  await writeJson(path.join(outDir, "domain-agent-rollout-rows.json"), collectionEnvelope("domain-agent-rollout-rows.v1", "domain_agent_rollout_rows", result.domain_agent_rollout_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-capability-rollout-rows.json"), collectionEnvelope("domain-agent-capability-rollout-rows.v1", "domain_agent_capability_rollout_rows", result.domain_agent_capability_rollout_rows, result.generated_at));
  await writeJson(path.join(outDir, "project-zendd-agent-bridge-rows.json"), collectionEnvelope("project-zendd-agent-bridge-rows.v1", "project_zendd_agent_bridge_rows", result.project_zendd_agent_bridge_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-operator-surface-rows.json"), collectionEnvelope("domain-agent-operator-surface-rows.v1", "domain_agent_operator_surface_rows", result.domain_agent_operator_surface_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-human-gate-rows.json"), collectionEnvelope("domain-agent-human-gate-rows.v1", "domain_agent_human_gate_rows", result.domain_agent_human_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "protected-agent-rollout-block-rows.json"), collectionEnvelope("protected-agent-rollout-block-rows.v1", "protected_agent_rollout_block_rows", result.protected_agent_rollout_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-rollout-claim-rows.json"), collectionEnvelope("agent-domain-rollout-claim-rows.v1", "agent_domain_rollout_claim_rows", result.agent_domain_rollout_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-rollout-closeout-rows.json"), collectionEnvelope("agent-domain-rollout-closeout-rows.v1", "agent_domain_rollout_closeout_rows", result.agent_domain_rollout_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-domain-rollout-gate-rows.json"), collectionEnvelope("agent-domain-rollout-gate-rows.v1", "agent_domain_rollout_gate_rows", result.agent_domain_rollout_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-domain-rollout-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentDomainRolloutCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentDomainRollout(args);
    console.log(`Platform agent domain rollout ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_domain_rollout_status}`);
    console.log(`Domains: ${result.summary.domain_count}`);
    console.log(`Capability rollout rows: ${result.summary.capability_rollout_count}`);
    console.log(`Zendd bridge rows: ${result.summary.project_zendd_bridge_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.runtime_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRolloutPolicy(generatedAt, capabilityRegistry) {
  return {
    schema_version: "platform-agent-domain-rollout-policy.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_agent_capability_registry_ref: capabilityRegistry.platform_agent_capability_registry_id,
    source_agent_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    rollout_mode: "multi_domain_candidate_packets",
    current_global_ceiling: "L2",
    zendd_integration_mode: "external_project_adapter",
    domain_pack_hardcoding_allowed: false,
    source_tree_movement_allowed: false,
    runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    api_server_start_allowed_now: false,
    cron_or_gateway_start_allowed_now: false,
    provider_secret_configuration_allowed_now: false,
    raw_secret_context_allowed: false,
    raw_client_or_vdr_context_allowed: false,
    direct_zendd_mutation_allowed: false,
    legal_final_judgment_allowed: false,
    live_order_submission_allowed: false,
    protected_output_finalization_allowed: false,
    agent_may_create_final_pass: false,
    agent_may_apply_human_receipt: false,
    agent_may_execute_protected_action: false,
    verdict_authority: "harness_only",
    next_allowed_action: "advance to P1113 top-level adoption freeze after domain rollout packets are operator-visible",
    created_at: generatedAt,
  };
}

function buildDomainRolloutRows(capabilityRegistry) {
  return capabilityRegistry.domain_agent_registry_rows.map((domain, index) => ({
    schema_version: "domain-agent-rollout-row.v1",
    row_id: `domain-agent-rollout.row.${String(index + 1).padStart(3, "0")}`,
    domain_id: domain.domain_id,
    domain_pack_id: domain.domain_pack_id,
    current_verdict: "pass",
    rollout_status: "ready_for_candidate_rollout",
    rollout_level: domain.current_rollout_level,
    max_rollout_level: domain.max_rollout_level,
    capability_registry_ref: domain.row_id,
    adapter_sdk_ref: `adapter_sdk.${domain.domain_id}`,
    operator_surface_route_prefix: DOMAIN_ROUTE_PREFIX[domain.domain_id],
    rollout_focus: DOMAIN_ROLLOUT_FOCUS[domain.domain_id],
    human_review_required: HUMAN_REVIEW_DOMAINS.has(domain.domain_id),
    protected_action_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    terminal_execution_allowed_now: false,
    raw_secret_context_allowed: false,
    raw_client_or_vdr_context_allowed: false,
    final_pass_by_agent_allowed: false,
    verdict_authority: "harness_only",
    evidence_ref: `evidence.platform.agent.domain_rollout.domain.${domain.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_domain_rollout_domain",
    hard_gate_ref: `gate.platform.agent.domain_rollout.domain.${domain.domain_id}`,
    responsible_owner: domain.responsible_owner,
    next_allowed_action: "surface rollout packet to operator dashboard without runtime execution",
  }));
}

function buildCapabilityRolloutRows(capabilityRegistry, domainRolloutRows) {
  return capabilityRegistry.domain_agent_capability_rows.map((capability, index) => {
    const domain = domainRolloutRows.find((row) => row.domain_id === capability.domain_id);
    return {
      schema_version: "domain-agent-capability-rollout-row.v1",
      row_id: `domain-agent-capability-rollout.row.${String(index + 1).padStart(3, "0")}`,
      domain_id: capability.domain_id,
      capability_id: capability.capability_id,
      capability_name: capability.capability_name,
      current_verdict: "pass",
      rollout_status: "ready_as_candidate_only",
      rollout_level: capability.rollout_level,
      source_capability_ref: capability.row_id,
      source_domain_rollout_ref: domain.row_id,
      allowed_output_mode: "draft_or_candidate_only",
      operator_surface_visible: true,
      claim_binding_required: true,
      evidence_binding_required: true,
      reviewer_gate_binding_required: true,
      human_receipt_required: domain.human_review_required || capability.protected_level,
      receipt_payload_present: false,
      runtime_execution_allowed_now: false,
      terminal_execution_allowed_now: false,
      mcp_connection_allowed_now: false,
      provider_secret_configuration_allowed_now: false,
      raw_secret_context_allowed: false,
      raw_client_or_vdr_context_allowed: false,
      direct_domain_mutation_allowed: false,
      protected_action_execution_allowed_now: false,
      final_pass_by_agent_allowed: false,
      verdict_authority: "harness_only",
      evidence_ref: `evidence.platform.agent.domain_rollout.capability.${capability.domain_id}.${capability.capability_name}`,
      reviewer_ref: "reviewer.platform.agent_domain_rollout_capability",
      hard_gate_ref: `gate.platform.agent.domain_rollout.capability.${capability.domain_id}.${capability.capability_name}`,
      responsible_owner: capability.responsible_owner,
      next_allowed_action: "draft candidate packet only; require human receipt before protected execution",
    };
  });
}

function buildZenddBridgeRows(capabilityRolloutRows) {
  return capabilityRolloutRows
    .filter((row) => row.domain_id === "project.zendd")
    .map((row, index) => ({
      schema_version: "project-zendd-agent-bridge-row.v1",
      row_id: `project-zendd-agent-bridge.row.${String(index + 1).padStart(3, "0")}`,
      project_id: "project.zendd",
      capability_id: row.capability_id,
      capability_name: row.capability_name,
      current_verdict: "pass",
      integration_mode: "external_project_adapter",
      source_tree_move_allowed: false,
      source_tree_copy_allowed: false,
      external_checkout_write_allowed: false,
      command_execution_allowed_now: false,
      raw_vdr_read_allowed: false,
      raw_client_payload_allowed: false,
      protected_action_execution_allowed_now: false,
      operator_surface_visible: true,
      source_capability_rollout_ref: row.row_id,
      evidence_ref: `evidence.platform.agent.domain_rollout.zendd.${row.capability_name}`,
      reviewer_ref: "reviewer.platform.agent_domain_rollout_zendd",
      hard_gate_ref: `gate.platform.agent.domain_rollout.zendd.${row.capability_name}`,
      responsible_owner: "project_zendd_owner",
      next_allowed_action: "route through Zendd external adapter packet without moving or mutating the checkout",
    }));
}

function buildOperatorSurfaceRows(domainRolloutRows) {
  return domainRolloutRows.map((domain, index) => ({
    schema_version: "domain-agent-operator-surface-row.v1",
    row_id: `domain-agent-operator-surface.row.${String(index + 1).padStart(3, "0")}`,
    domain_id: domain.domain_id,
    route_prefix: domain.operator_surface_route_prefix,
    current_verdict: "pass",
    planned_routes: [
      `${domain.operator_surface_route_prefix}/claims`,
      `${domain.operator_surface_route_prefix}/capabilities`,
      `${domain.operator_surface_route_prefix}/missing-inputs`,
      `${domain.operator_surface_route_prefix}/next-actions`,
      `${domain.operator_surface_route_prefix}/gates`,
    ],
    route_mode: "read_only_planned_surface",
    server_started: false,
    mutation_route_count: 0,
    protected_action_route_count: 0,
    raw_material_route_count: 0,
    evidence_ref: `evidence.platform.agent.domain_rollout.operator_surface.${domain.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_domain_rollout_operator_surface",
    hard_gate_ref: `gate.platform.agent.domain_rollout.operator_surface.${domain.domain_id}`,
    responsible_owner: domain.responsible_owner,
    next_allowed_action: "wire to dashboard/API only after P1113 adoption freeze",
  }));
}

function buildHumanGateRows(domainRolloutRows) {
  return domainRolloutRows.map((domain, index) => ({
    schema_version: "domain-agent-human-gate-row.v1",
    row_id: `domain-agent-human-gate.row.${String(index + 1).padStart(3, "0")}`,
    domain_id: domain.domain_id,
    current_verdict: "pass",
    human_gate_required_for_protected_output: true,
    human_gate_required_for_runtime_execution: true,
    human_gate_required_for_receipt_application: true,
    receipt_template_ref: `receipt.platform.agent.domain_rollout.${domain.domain_id}`,
    receipt_payload_present: false,
    protected_output_finalization_allowed_now: false,
    runtime_execution_allowed_now: false,
    evidence_ref: `evidence.platform.agent.domain_rollout.human_gate.${domain.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_domain_rollout_human_gate",
    hard_gate_ref: `gate.platform.agent.domain_rollout.human_gate.${domain.domain_id}`,
    responsible_owner: domain.responsible_owner,
    next_allowed_action: "collect domain owner receipt before any protected runtime or output finalization",
  }));
}

function buildProtectedBlockRows() {
  return PROTECTED_ROLLOUT_BLOCKS.map(([protectedActionId, blockReason, nextAction], index) => ({
    schema_version: "protected-agent-rollout-block-row.v1",
    row_id: `protected-agent-rollout-block.row.${String(index + 1).padStart(3, "0")}`,
    protected_action_id: protectedActionId,
    current_verdict: "blocked",
    block_reason: blockReason,
    evidence_ref: `evidence.platform.agent.domain_rollout.protected_block.${protectedActionId}`,
    reviewer_ref: "reviewer.platform.agent_domain_rollout_protected_block",
    hard_gate_ref: `gate.platform.agent.domain_rollout.protected_block.${protectedActionId}`,
    responsible_owner: ownerForProtectedAction(protectedActionId),
    next_allowed_action: nextAction,
    human_receipt_required: true,
    receipt_payload_present: false,
    protected_action_execution_allowed_now: false,
    final_pass_by_agent_allowed: false,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaimRows({ domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows }) {
  const passRows = [
    ...domainRolloutRows.map((row) => passClaim("domain_agent_rollout", `claim.platform.agent.domain_rollout.domain.${row.domain_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...capabilityRolloutRows.map((row) => passClaim("domain_agent_capability_rollout", `claim.platform.agent.domain_rollout.capability.${row.domain_id}.${row.capability_name}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...zenddBridgeRows.map((row) => passClaim("project_zendd_agent_bridge", `claim.platform.agent.domain_rollout.zendd.${row.capability_name}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...operatorSurfaceRows.map((row) => passClaim("domain_agent_operator_surface", `claim.platform.agent.domain_rollout.operator_surface.${row.domain_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...humanGateRows.map((row) => passClaim("domain_agent_human_gate", `claim.platform.agent.domain_rollout.human_gate.${row.domain_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action, row.receipt_template_ref)),
  ];
  const blockedRows = protectedBlockRows.map((row) => blockedClaim("protected_agent_rollout_block", `claim.platform.agent.domain_rollout.protected_block.${row.protected_action_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.block_reason, row.next_allowed_action));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-domain-rollout-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows }) {
  const rows = [
    ["source_registry_ready", rolloutPolicy.source_agent_capability_registry_status === "ready_for_agent_capability_registry", "agent_domain_rollout_policy"],
    ["domains_ready", domainRolloutRows.length === 7 && domainRolloutRows.every((row) => row.current_verdict === "pass"), "domain_agent_rollout_rows"],
    ["capabilities_ready", capabilityRolloutRows.length >= 29 && capabilityRolloutRows.every((row) => row.current_verdict === "pass"), "domain_agent_capability_rollout_rows"],
    ["zendd_bridge_external_only", zenddBridgeRows.length === 5 && zenddBridgeRows.every((row) => row.integration_mode === "external_project_adapter" && row.external_checkout_write_allowed === false), "project_zendd_agent_bridge_rows"],
    ["operator_surfaces_read_only", operatorSurfaceRows.every((row) => row.server_started === false && row.mutation_route_count === 0), "domain_agent_operator_surface_rows"],
    ["human_gates_ready_without_payload", humanGateRows.every((row) => row.receipt_payload_present === false && row.protected_output_finalization_allowed_now === false), "domain_agent_human_gate_rows"],
    ["protected_blocks_documented", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "protected_agent_rollout_block_rows"],
    ["no_runtime_or_raw_exposure", rolloutPolicy.runtime_execution_allowed_now === false && rolloutPolicy.raw_client_or_vdr_context_allowed === false && rolloutPolicy.raw_secret_context_allowed === false, "agent_domain_rollout_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_domain_rollout_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-domain-rollout-closeout-row.v1",
    row_id: `agent-domain-rollout-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    evidence_ref: `evidence.platform.agent.domain_rollout.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_domain_rollout_closeout",
    hard_gate_ref: `gate.platform.agent.domain_rollout.closeout.${closeoutId}`,
    source_ref: sourceRef,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1112 closeout`,
  }));
}

function buildAnchor({ packageJson, phaseLedger, capabilityRegistry, rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-domain-rollout-anchor.v1",
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
    source_agent_capability_registry_status: capabilityRegistry.summary.platform_agent_capability_registry_status,
    rollout_mode: rolloutPolicy.rollout_mode,
    domain_count: domainRolloutRows.length,
    capability_rollout_count: capabilityRolloutRows.length,
    project_zendd_bridge_count: zenddBridgeRows.length,
    operator_surface_count: operatorSurfaceRows.length,
    human_gate_count: humanGateRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, phaseLedger, capabilityRegistry, rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_capability_registry", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["phase_ledger_declares_rollout", phaseLedger.available && ["P1089-P1112", COMMAND_NAME, "Multi-Domain And Zendd Rollout"].every((token) => phaseLedger.text.includes(token)), "docs/hermes-agent-operations-phase-ledger.md"],
    ["source_registry_ready", capabilityRegistry.summary.platform_agent_capability_registry_status === "ready_for_agent_capability_registry", "source_agent_capability_registry_summary"],
    ["domain_rollouts_ready", domainRolloutRows.length === 7 && domainRolloutRows.every((row) => row.current_verdict === "pass"), "domain_agent_rollout_rows"],
    ["capability_rollouts_ready", capabilityRolloutRows.length >= 29 && capabilityRolloutRows.every((row) => row.current_verdict === "pass"), "domain_agent_capability_rollout_rows"],
    ["zendd_bridge_external_only", zenddBridgeRows.length === 5 && zenddBridgeRows.every((row) => row.source_tree_move_allowed === false && row.external_checkout_write_allowed === false), "project_zendd_agent_bridge_rows"],
    ["operator_surface_read_only", operatorSurfaceRows.every((row) => row.server_started === false && row.mutation_route_count === 0), "domain_agent_operator_surface_rows"],
    ["human_gates_no_payload", humanGateRows.every((row) => row.receipt_payload_present === false), "domain_agent_human_gate_rows"],
    ["protected_blocks_documented", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "protected_agent_rollout_block_rows"],
    ["no_runtime_secret_or_raw_context", rolloutPolicy.runtime_execution_allowed_now === false && rolloutPolicy.raw_secret_context_allowed === false && rolloutPolicy.raw_client_or_vdr_context_allowed === false, "agent_domain_rollout_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_domain_rollout_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_domain_rollout_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-domain-rollout-gate-row.v1",
    row_id: `agent-domain-rollout-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.domain_rollout.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_domain_rollout_gate",
    hard_gate_ref: `gate.platform.agent.domain_rollout.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    runtime_execution_performed_by_gate: false,
    terminal_execution_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    raw_material_exposed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1112 closeout`,
  }));
}

function buildValidationItems({ gateRows, rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All domain rollout gates must be ready."],
    ["policy.no_runtime", rolloutPolicy.runtime_execution_allowed_now === false && rolloutPolicy.terminal_execution_allowed_now === false, "Domain rollout must not enable runtime or terminal execution."],
    ["policy.no_raw", rolloutPolicy.raw_secret_context_allowed === false && rolloutPolicy.raw_client_or_vdr_context_allowed === false, "Domain rollout must not expose raw material."],
    ["domains.complete", domainRolloutRows.length === 7, "All registered domains must have rollout rows."],
    ["capabilities.complete", capabilityRolloutRows.length >= 29, "Registry capabilities must have rollout rows."],
    ["zendd.external_only", zenddBridgeRows.length === 5 && zenddBridgeRows.every((row) => row.integration_mode === "external_project_adapter" && row.external_checkout_write_allowed === false), "Zendd rollout must remain external adapter only."],
    ["operator.read_only", operatorSurfaceRows.every((row) => row.server_started === false && row.mutation_route_count === 0), "Operator surfaces must remain read-only planned surfaces."],
    ["human_gates.no_payload", humanGateRows.every((row) => row.receipt_payload_present === false), "Human gates must not contain payloads."],
    ["protected.blocks", protectedBlockRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Protected actions must remain documented BLOCK."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_domain_rollout", passed, message));
}

function passClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, nextAllowedAction, humanReceiptRef = null) {
  return {
    schema_version: "agent-domain-rollout-claim-row.v1",
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

function blockedClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, blockReason, nextAllowedAction) {
  return {
    schema_version: "agent-domain-rollout-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "blocked",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: null,
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

function ownerForProtectedAction(protectedActionId) {
  if (protectedActionId.startsWith("project.zendd")) return "project_zendd_owner";
  if (protectedActionId.startsWith("law-firm")) return "legal_domain_owner";
  if (protectedActionId.startsWith("trading")) return "trading_safety_owner";
  if (protectedActionId.startsWith("personal-dev")) return "personal_dev_owner";
  if (protectedActionId.startsWith("creative-document")) return "creative_document_owner";
  if (protectedActionId.startsWith("connectors-resource")) return "resource_connector_owner";
  return "platform_agent_owner";
}

function buildSummary({ rolloutPolicy, domainRolloutRows, capabilityRolloutRows, zenddBridgeRows, operatorSurfaceRows, humanGateRows, protectedBlockRows, claimRows, closeoutRows, gateRows, validation }) {
  return {
    platform_agent_domain_rollout_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    rollout_mode: rolloutPolicy.rollout_mode,
    domain_count: domainRolloutRows.length,
    capability_rollout_count: capabilityRolloutRows.length,
    project_zendd_bridge_count: zenddBridgeRows.length,
    operator_surface_count: operatorSurfaceRows.length,
    human_gate_count: humanGateRows.length,
    protected_block_count: protectedBlockRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    runtime_execution_allowed_now: rolloutPolicy.runtime_execution_allowed_now,
    terminal_execution_allowed_now: rolloutPolicy.terminal_execution_allowed_now,
    protected_action_execution_allowed_now: rolloutPolicy.agent_may_execute_protected_action,
    raw_secret_context_allowed: rolloutPolicy.raw_secret_context_allowed,
    raw_client_or_vdr_context_allowed: rolloutPolicy.raw_client_or_vdr_context_allowed,
    direct_zendd_mutation_allowed: rolloutPolicy.direct_zendd_mutation_allowed,
    source_tree_movement_allowed: rolloutPolicy.source_tree_movement_allowed,
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Domain Rollout",
    "",
    `Status: ${result.summary.platform_agent_domain_rollout_status}`,
    `Phase: ${result.summary.phase_range}`,
    `Domains: ${result.summary.domain_count}`,
    `Capability rollout rows: ${result.summary.capability_rollout_count}`,
    `Zendd bridge rows: ${result.summary.project_zendd_bridge_count}`,
    `Claims: ${result.summary.pass_claim_count} PASS / ${result.summary.blocked_claim_count} BLOCK`,
    "",
    "## Frozen Runtime",
    "",
    "- Runtime execution allowed now: false",
    "- Terminal execution allowed now: false",
    "- Direct Zendd mutation allowed: false",
    "- Raw client/VDR context allowed: false",
    "",
    "## Next Allowed Action",
    "",
    result.agent_domain_rollout_policy.next_allowed_action,
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
  const defaults = DEFAULT_PLATFORM_AGENT_DOMAIN_ROLLOUT_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-domain-rollout.mjs [--check] [--out-dir DIR]\n\nCreates the P1089-P1112 multi-domain and Zendd Agent rollout packets without running Hermes Agent.`);
}
