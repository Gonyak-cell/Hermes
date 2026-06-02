import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildPlatformAgentAuthorityFreeze } from "./platform-agent-authority-freeze.mjs";
import { buildPlatformAgentIsolatedInstallGate } from "./platform-agent-isolated-install-gate.mjs";

export const DEFAULT_PLATFORM_AGENT_CAPABILITY_REGISTRY_OUT_DIR = "artifacts/platform-agent-capability-registry/latest";
export const DEFAULT_PLATFORM_AGENT_CAPABILITY_REGISTRY_INPUTS = {
  schemaPath: "schemas/platform-agent-capability-registry.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-capability-registry";
const SOURCE_COMMAND_NAME = "platform:agent-isolated-install-gate";
const AUTHORITY_COMMAND_NAME = "platform:agent-authority-freeze";
const SCHEMA_VERSION = "platform-agent-capability-registry.v1";
const CAPABILITY_ID = "platform.agent_operations.capability_registry";
const PROGRAM_RANGE = "P1041-P1121";
const PHASE_RANGE = "P1065-P1088";
const PHASE_SLOT = "P1065";
const PREVIOUS_PHASE_SLOT = "P1064";
const NEXT_PHASE_SLOT = "P1089";
const READY_STATUS = "ready_for_agent_capability_registry";

const ROLLOUT_LEVELS = [
  {
    rollout_level: "L0",
    label: "observe_only",
    allowed_actions: ["read_registry", "summarize_status", "draft_missing_input_list"],
    forbidden_actions: ["tool_execution", "write_mutation", "protected_output", "final_pass"],
    protected: false,
  },
  {
    rollout_level: "L1",
    label: "draft_candidates",
    allowed_actions: ["draft_work_order", "draft_evidence_candidate", "draft_review_packet"],
    forbidden_actions: ["command_execution", "receipt_application", "client_delivery", "release_execution"],
    protected: false,
  },
  {
    rollout_level: "L2",
    label: "command_candidates",
    allowed_actions: ["propose_command", "bind_command_to_evidence_ref", "draft_rollback_target"],
    forbidden_actions: ["terminal_execution", "package_install", "secret_read", "raw_material_copy"],
    protected: false,
  },
  {
    rollout_level: "L3",
    label: "human_gated_execution_packet",
    allowed_actions: ["assemble_execution_packet", "attach_human_receipt_template", "capture_redaction_plan"],
    forbidden_actions: ["self_approve", "direct_execution", "secret_forwarding", "raw_stdout_storage"],
    protected: true,
  },
  {
    rollout_level: "L4",
    label: "operator_supervised_runtime",
    allowed_actions: ["operator_visible_run_status", "bounded_tool_invocation_request", "rollback_packet"],
    forbidden_actions: ["background_mutation_without_receipt", "unreviewed_mcp", "approval_off", "yolo_mode"],
    protected: true,
  },
  {
    rollout_level: "L5",
    label: "production_protected_delegation",
    allowed_actions: ["documented_delegation_request", "post_run_evidence_packet", "freeze_reconciliation"],
    forbidden_actions: ["agent_final_judgment", "legal_final_advice", "release_or_deploy_without_receipt", "live_order_submission"],
    protected: true,
  },
];

const DOMAIN_DEFINITIONS = [
  {
    domain_id: "platform",
    domain_pack_id: "platform",
    max_rollout_level: "L5",
    current_rollout_level: "L2",
    default_owner: "platform_agent_owner",
    domain_boundary_ref: "boundary.platform.agent_operations",
    data_classes: ["platform_claim_registry", "gate_status", "operator_surface_status"],
    forbidden_data_classes: ["raw_secret", "raw_client_vdr_payload", "unredacted_terminal_stdout"],
    capability_templates: [
      ["claim_gap_detector", "L1", ["claim_registry", "freeze_status"], ["missing_evidence_report", "next_allowed_action_draft"]],
      ["evidence_candidate_indexer", "L1", ["artifact_metadata", "command_check_summary"], ["evidence_candidate_ref"]],
      ["gate_packet_drafter", "L2", ["gate_status", "reviewer_policy"], ["review_packet_draft", "human_receipt_template_ref"]],
      ["recovery_draft_router", "L2", ["blocked_claim", "rollback_target_ref"], ["recovery_draft", "rollback_plan_candidate"]],
    ],
  },
  {
    domain_id: "personal-dev",
    domain_pack_id: "personal-dev",
    max_rollout_level: "L4",
    current_rollout_level: "L2",
    default_owner: "personal_dev_owner",
    domain_boundary_ref: "boundary.personal_dev.agent_operations",
    data_classes: ["issue_intake", "diff_summary", "test_result_summary"],
    forbidden_data_classes: ["secret_env", "credential_material", "unscoped_worktree_write"],
    capability_templates: [
      ["work_order_intake", "L1", ["issue_text", "repo_status_summary"], ["work_order_draft"]],
      ["patch_plan_candidate", "L2", ["diff_summary", "test_gap_summary"], ["patch_plan_candidate", "rollback_note"]],
      ["command_candidate", "L2", ["package_scripts", "test_contract"], ["command_candidate_ref"]],
      ["release_note_draft", "L1", ["accepted_diff_summary"], ["release_note_draft"]],
    ],
  },
  {
    domain_id: "law-firm",
    domain_pack_id: "law-firm",
    max_rollout_level: "L4",
    current_rollout_level: "L1",
    default_owner: "legal_domain_owner",
    domain_boundary_ref: "boundary.law_firm.agent_operations",
    data_classes: ["matter_metadata", "citation_refs", "review_gate_status"],
    forbidden_data_classes: ["raw_client_payload", "privileged_unredacted_material", "legal_final_advice"],
    capability_templates: [
      ["matter_triage_candidate", "L1", ["matter_metadata", "intake_summary"], ["triage_candidate"]],
      ["ldd_vdr_evidence_candidate", "L1", ["source_span_refs", "vdr_index_refs"], ["evidence_candidate_ref"]],
      ["contract_review_draft", "L1", ["clause_refs", "issue_refs"], ["review_draft"]],
      ["attorney_review_packet", "L2", ["claim_refs", "citation_refs"], ["attorney_review_packet_draft", "human_receipt_template_ref"]],
    ],
  },
  {
    domain_id: "creative-document",
    domain_pack_id: "creative-document",
    max_rollout_level: "L4",
    current_rollout_level: "L2",
    default_owner: "creative_document_owner",
    domain_boundary_ref: "boundary.creative_document.agent_operations",
    data_classes: ["template_metadata", "style_token_summary", "artifact_manifest"],
    forbidden_data_classes: ["client_confidential_payload", "unapproved_export_payload", "raw_secret"],
    capability_templates: [
      ["template_mapping_candidate", "L1", ["template_manifest", "style_tokens"], ["template_mapping_candidate"]],
      ["style_check_draft", "L1", ["document_summary", "brand_rule_refs"], ["style_check_draft"]],
      ["layout_plan_candidate", "L2", ["artifact_manifest", "page_summary"], ["layout_plan_candidate"]],
      ["export_quality_packet", "L2", ["render_summary", "quality_gate_status"], ["quality_packet_draft"]],
    ],
  },
  {
    domain_id: "connectors-resource",
    domain_pack_id: "connectors-resource",
    max_rollout_level: "L4",
    current_rollout_level: "L2",
    default_owner: "resource_connector_owner",
    domain_boundary_ref: "boundary.connectors_resource.agent_operations",
    data_classes: ["resource_metadata", "classification_summary", "quarantine_status"],
    forbidden_data_classes: ["raw_secret", "raw_restricted_payload", "external_transfer_payload"],
    capability_templates: [
      ["ingestion_candidate", "L1", ["resource_metadata", "adapter_status"], ["ingestion_candidate"]],
      ["classification_candidate", "L1", ["resource_summary", "source_span_refs"], ["classification_candidate"]],
      ["quarantine_review_packet", "L2", ["quarantine_status", "policy_refs"], ["quarantine_review_packet"]],
      ["source_span_evidence", "L2", ["source_span_refs", "confidence_summary"], ["evidence_candidate_ref"]],
    ],
  },
  {
    domain_id: "trading",
    domain_pack_id: "trading",
    max_rollout_level: "L3",
    current_rollout_level: "L1",
    default_owner: "trading_safety_owner",
    domain_boundary_ref: "boundary.trading.agent_operations",
    data_classes: ["strategy_summary", "backtest_summary", "risk_gate_status"],
    forbidden_data_classes: ["broker_secret", "live_order_route", "credential_material", "live_adapter_payload"],
    capability_templates: [
      ["research_packet_candidate", "L1", ["market_research_summary", "strategy_refs"], ["research_packet_candidate"]],
      ["backtest_plan_candidate", "L1", ["signal_summary", "risk_policy_refs"], ["backtest_plan_candidate"]],
      ["safety_fixture_review", "L1", ["safety_fixture_status", "blocked_route_refs"], ["safety_review_draft"]],
      ["risk_report_draft", "L1", ["risk_gate_status", "model_eval_summary"], ["risk_report_draft"]],
    ],
  },
  {
    domain_id: "project.zendd",
    domain_pack_id: "law-firm",
    max_rollout_level: "L3",
    current_rollout_level: "L2",
    default_owner: "project_zendd_owner",
    domain_boundary_ref: "boundary.project_zendd.external_adapter",
    data_classes: ["external_checkout_metadata", "work_order_summary", "vdr_ldd_refs", "command_evidence_summary"],
    forbidden_data_classes: ["raw_vdr_payload", "raw_client_payload", "external_checkout_write", "secret_env"],
    capability_templates: [
      ["work_order_candidate", "L1", ["zendd_request_summary", "external_status_summary"], ["work_order_candidate"]],
      ["patch_plan_candidate", "L2", ["dirty_tree_summary", "safe_scope_policy"], ["patch_plan_candidate", "rollback_note"]],
      ["command_evidence_candidate", "L2", ["command_candidate_refs", "test_contract"], ["command_evidence_packet"]],
      ["vdr_ldd_bridge_candidate", "L1", ["source_span_refs", "ldd_gate_summary"], ["vdr_ldd_bridge_candidate"]],
      ["release_sandbox_candidate", "L2", ["release_candidate_summary", "client_output_gate_status"], ["release_sandbox_packet"]],
    ],
  },
];

const UNSAFE_CAPABILITY_BLOCKS = [
  ["agent_direct_pass", "direct_pass_authority", "require harness freeze adjudication"],
  ["agent_direct_approval", "direct_approval_authority", "require validated human receipt"],
  ["agent_legal_final_judgment", "legal_final_judgment", "route to attorney review packet"],
  ["agent_release_or_deploy", "release_or_deploy_authority", "create protected execution packet only"],
  ["agent_live_order_submission", "unsafe_live_order_submission", "keep trading live order routes disabled"],
  ["agent_secret_forwarding", "secret_forwarding", "use reference-only secret handles"],
  ["agent_raw_client_vdr_read", "raw_client_or_vdr_exposure", "use source refs and redacted spans only"],
  ["agent_direct_zendd_mutation", "direct_zendd_mutation", "use external adapter work order lane"],
  ["agent_yolo_or_approval_off", "yolo_or_approval_off", "keep approval policy enforced"],
  ["agent_unreviewed_mcp", "unreviewed_mcp_connection", "register MCP connection plan behind human gate"],
];

export async function runPlatformAgentCapabilityRegistry(options = {}) {
  const result = await buildPlatformAgentCapabilityRegistry(options);
  if (options.write !== false) await writePlatformAgentCapabilityRegistry(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent capability registry failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentCapabilityRegistry(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_CAPABILITY_REGISTRY_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.agent_operations_phase_ledger_path);
  const authorityFreeze = await buildPlatformAgentAuthorityFreeze({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });
  const isolatedInstall = await buildPlatformAgentIsolatedInstallGate({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    agentOperationsPhaseLedgerPath: inputs.agent_operations_phase_ledger_path,
    write: false,
  });

  const registryPolicy = buildRegistryPolicy(generatedAt, authorityFreeze, isolatedInstall);
  const rolloutRows = buildRolloutRows();
  const domainRows = buildDomainRows(authorityFreeze);
  const capabilityRows = buildCapabilityRows(domainRows);
  const adapterSdkRows = buildAdapterSdkRows(domainRows);
  const toolPolicyRows = buildToolPolicyRows(domainRows);
  const unsafeCapabilityRows = buildUnsafeCapabilityRows();
  const claimRows = buildClaimRows({ domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows });
  const closeoutRows = buildCloseoutRows({ registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, authorityFreeze, isolatedInstall, registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, authorityFreeze, isolatedInstall, registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_capability_registry_id: `platform-agent-capability-registry.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_capability_registry_anchor: anchor,
    source_agent_authority_freeze_summary: authorityFreeze.summary,
    source_agent_isolated_install_gate_summary: isolatedInstall.summary,
    agent_capability_registry_policy: registryPolicy,
    agent_rollout_level_rows: rolloutRows,
    domain_agent_registry_rows: domainRows,
    domain_agent_capability_rows: capabilityRows,
    domain_agent_adapter_sdk_rows: adapterSdkRows,
    domain_agent_tool_policy_rows: toolPolicyRows,
    unsafe_agent_capability_block_rows: unsafeCapabilityRows,
    agent_capability_registry_claim_rows: claimRows,
    agent_capability_registry_closeout_rows: closeoutRows,
    agent_capability_registry_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_capability_registry")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows, gateRows, validation: result.validation });
  result.summary.platform_agent_capability_registry_id = result.platform_agent_capability_registry_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentCapabilityRegistry(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-capability-registry.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-capability-registry-policy.json"), result.agent_capability_registry_policy);
  await writeJson(path.join(outDir, "agent-rollout-level-rows.json"), collectionEnvelope("agent-rollout-level-rows.v1", "agent_rollout_level_rows", result.agent_rollout_level_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-registry-rows.json"), collectionEnvelope("domain-agent-registry-rows.v1", "domain_agent_registry_rows", result.domain_agent_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-capability-rows.json"), collectionEnvelope("domain-agent-capability-rows.v1", "domain_agent_capability_rows", result.domain_agent_capability_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-adapter-sdk-rows.json"), collectionEnvelope("domain-agent-adapter-sdk-rows.v1", "domain_agent_adapter_sdk_rows", result.domain_agent_adapter_sdk_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-tool-policy-rows.json"), collectionEnvelope("domain-agent-tool-policy-rows.v1", "domain_agent_tool_policy_rows", result.domain_agent_tool_policy_rows, result.generated_at));
  await writeJson(path.join(outDir, "unsafe-agent-capability-block-rows.json"), collectionEnvelope("unsafe-agent-capability-block-rows.v1", "unsafe_agent_capability_block_rows", result.unsafe_agent_capability_block_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-capability-registry-claim-rows.json"), collectionEnvelope("agent-capability-registry-claim-rows.v1", "agent_capability_registry_claim_rows", result.agent_capability_registry_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-capability-registry-closeout-rows.json"), collectionEnvelope("agent-capability-registry-closeout-rows.v1", "agent_capability_registry_closeout_rows", result.agent_capability_registry_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-capability-registry-gate-rows.json"), collectionEnvelope("agent-capability-registry-gate-rows.v1", "agent_capability_registry_gate_rows", result.agent_capability_registry_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-capability-registry-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentCapabilityRegistryCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentCapabilityRegistry(args);
    console.log(`Platform agent capability registry ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_capability_registry_status}`);
    console.log(`Domains: ${result.summary.domain_count}`);
    console.log(`Capabilities: pass ${result.summary.pass_capability_count}, blocked ${result.summary.blocked_capability_count}`);
    console.log(`Adapter SDK rows: ${result.summary.adapter_sdk_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Runtime execution allowed: ${result.summary.runtime_execution_allowed_now}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildRegistryPolicy(generatedAt, authorityFreeze, isolatedInstall) {
  return {
    schema_version: "platform-agent-capability-registry-policy.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_agent_authority_freeze_ref: authorityFreeze.platform_agent_authority_freeze_id,
    source_agent_authority_freeze_status: authorityFreeze.summary.platform_agent_authority_freeze_status,
    source_agent_isolated_install_gate_ref: isolatedInstall.platform_agent_isolated_install_gate_id,
    source_agent_isolated_install_gate_status: isolatedInstall.summary.platform_agent_isolated_install_gate_status,
    registry_mode: "declarative_contract_only",
    capability_expansion_allowed: true,
    adapter_sdk_required: true,
    rollout_level_model: "L0-L5",
    current_global_ceiling: "L2",
    protected_level_ceiling_without_receipt: "L2",
    verdict_authority: "harness_only",
    agent_may_create_final_pass: false,
    agent_may_apply_human_receipt: false,
    agent_may_execute_protected_action: false,
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
    live_order_submission_allowed: false,
    yolo_mode_allowed: false,
    approval_off_allowed: false,
    secret_forwarding_allowed: false,
    next_allowed_action: "advance to P1089 domain rollout only through registered capability rows and adapter SDK guards",
    created_at: generatedAt,
  };
}

function buildRolloutRows() {
  return ROLLOUT_LEVELS.map((level, index) => ({
    schema_version: "agent-rollout-level-row.v1",
    row_id: `agent-rollout-level.row.${String(index + 1).padStart(3, "0")}`,
    ...level,
    current_verdict: "pass",
    human_receipt_required: level.protected,
    execution_allowed_without_receipt: false,
    evidence_ref: `evidence.platform.agent.capability_registry.rollout.${level.rollout_level}`,
    reviewer_ref: "reviewer.platform.agent_capability_registry_rollout",
    hard_gate_ref: `gate.platform.agent.capability_registry.rollout.${level.rollout_level}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: level.protected
      ? "keep protected levels registry-only until human receipt and execution packet exist"
      : "use for registry-scoped agent capability declarations",
  }));
}

function buildDomainRows(authorityFreeze) {
  const scopeByDomain = new Map(authorityFreeze.domain_agent_scope_seed_rows.map((row) => [row.domain_id, row]));
  return DOMAIN_DEFINITIONS.map((domain, index) => {
    const scope = scopeByDomain.get(domain.domain_id);
    return {
      schema_version: "domain-agent-registry-row.v1",
      row_id: `domain-agent-registry.row.${String(index + 1).padStart(3, "0")}`,
      domain_id: domain.domain_id,
      domain_pack_id: domain.domain_pack_id,
      current_verdict: "pass",
      initial_rollout_level: scope?.initial_rollout_level ?? "L0",
      current_rollout_level: domain.current_rollout_level,
      max_rollout_level: domain.max_rollout_level,
      capability_registry_required: true,
      adapter_sdk_required: true,
      verdict_authority: "harness_only",
      default_owner: domain.default_owner,
      domain_boundary_ref: domain.domain_boundary_ref,
      data_classes: domain.data_classes,
      forbidden_data_classes: domain.forbidden_data_classes,
      raw_secret_context_allowed: false,
      raw_client_or_vdr_context_allowed: false,
      protected_action_execution_allowed_now: false,
      final_pass_by_agent_allowed: false,
      source_scope_seed_ref: scope?.row_id ?? "missing_scope_seed",
      capability_count: domain.capability_templates.length,
      evidence_ref: `evidence.platform.agent.capability_registry.domain.${domain.domain_id}`,
      reviewer_ref: "reviewer.platform.agent_capability_registry_domain",
      hard_gate_ref: `gate.platform.agent.capability_registry.domain.${domain.domain_id}`,
      responsible_owner: domain.default_owner,
      next_allowed_action: "register or update capabilities through adapter SDK contract before rollout expansion",
    };
  });
}

function buildCapabilityRows(domainRows) {
  const rows = [];
  for (const domain of DOMAIN_DEFINITIONS) {
    const domainRow = domainRows.find((row) => row.domain_id === domain.domain_id);
    for (const [shortId, rolloutLevel, allowedInputs, allowedOutputs] of domain.capability_templates) {
      const protectedLevel = rolloutLevelRank(rolloutLevel) >= rolloutLevelRank("L3");
      rows.push({
        schema_version: "domain-agent-capability-row.v1",
        row_id: `domain-agent-capability.row.${String(rows.length + 1).padStart(3, "0")}`,
        domain_id: domain.domain_id,
        domain_pack_id: domain.domain_pack_id,
        capability_id: `${domain.domain_id}.agent.${shortId}`,
        capability_name: shortId,
        current_verdict: "pass",
        rollout_level: rolloutLevel,
        max_rollout_level: domain.max_rollout_level,
        protected_level: protectedLevel,
        agent_feature_refs: featureRefsForCapability(shortId),
        allowed_inputs: allowedInputs,
        forbidden_inputs: domain.forbidden_data_classes,
        allowed_outputs: allowedOutputs,
        forbidden_outputs: forbiddenOutputsForDomain(domain.domain_id),
        tool_policy_ref: `tool_policy.${domain.domain_id}.agent`,
        evidence_contract_ref: `evidence_contract.${domain.domain_id}.${shortId}`,
        human_gate_policy_ref: protectedLevel ? `human_gate.${domain.domain_id}.${shortId}` : `human_gate.${domain.domain_id}.not_required_for_${rolloutLevel}`,
        adapter_sdk_ref: `adapter_sdk.${domain.domain_id}`,
        domain_boundary_ref: domain.domain_boundary_ref,
        source_domain_registry_ref: domainRow.row_id,
        verdict_authority: "harness_only",
        agent_may_create_final_pass: false,
        agent_may_execute_protected_action: false,
        raw_secret_context_allowed: false,
        raw_client_or_vdr_context_allowed: false,
        terminal_execution_allowed_now: false,
        mcp_connection_allowed_now: false,
        api_server_start_allowed_now: false,
        cron_or_gateway_start_allowed_now: false,
        evidence_ref: `evidence.platform.agent.capability_registry.capability.${domain.domain_id}.${shortId}`,
        reviewer_ref: "reviewer.platform.agent_capability_registry_capability",
        hard_gate_ref: `gate.platform.agent.capability_registry.capability.${domain.domain_id}.${shortId}`,
        responsible_owner: domain.default_owner,
        next_allowed_action: "surface as candidate-only domain Agent capability in P1089 rollout planning",
      });
    }
  }
  return rows;
}

function buildAdapterSdkRows(domainRows) {
  const requiredMethods = [
    "normalize_input_refs",
    "enforce_forbidden_inputs",
    "draft_agent_prompt_packet",
    "sanitize_agent_output",
    "bind_claim_evidence_reviewer_gate",
    "attach_human_receipt_requirement",
    "bind_rollback_target",
    "emit_operator_surface_row",
  ];
  return domainRows.map((domain, index) => ({
    schema_version: "domain-agent-adapter-sdk-row.v1",
    row_id: `domain-agent-adapter-sdk.row.${String(index + 1).padStart(3, "0")}`,
    adapter_sdk_id: `adapter_sdk.${domain.domain_id}`,
    domain_id: domain.domain_id,
    domain_pack_id: domain.domain_pack_id,
    current_verdict: "pass",
    required_methods: requiredMethods,
    required_input_shape_fields: ["domain_id", "capability_id", "run_ref", "source_refs", "forbidden_input_scan"],
    required_output_shape_fields: ["claim_id", "evidence_ref", "reviewer_ref", "hard_gate_ref", "current_verdict", "next_allowed_action"],
    forbidden_output_fields: ["raw_secret", "raw_client_payload", "raw_vdr_payload", "final_pass", "approved_by_agent"],
    claim_binding_required: true,
    evidence_binding_required: true,
    reviewer_gate_binding_required: true,
    protected_receipt_binding_required: true,
    rollback_binding_required: true,
    operator_surface_binding_required: true,
    direct_domain_mutation_allowed: false,
    verdict_authority: "harness_only",
    evidence_ref: `evidence.platform.agent.capability_registry.adapter_sdk.${domain.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_capability_registry_adapter_sdk",
    hard_gate_ref: `gate.platform.agent.capability_registry.adapter_sdk.${domain.domain_id}`,
    responsible_owner: domain.responsible_owner,
    next_allowed_action: "implement concrete adapter using this SDK contract before enabling runtime-backed capability",
  }));
}

function buildToolPolicyRows(domainRows) {
  return domainRows.map((domain, index) => ({
    schema_version: "domain-agent-tool-policy-row.v1",
    row_id: `domain-agent-tool-policy.row.${String(index + 1).padStart(3, "0")}`,
    tool_policy_id: `tool_policy.${domain.domain_id}.agent`,
    domain_id: domain.domain_id,
    current_verdict: "pass",
    allowed_tool_classes: ["registry_read", "artifact_metadata_read", "operator_surface_read", "draft_generation"],
    blocked_tool_classes: ["package_install", "terminal_execution", "mcp_connect", "api_server_start", "cron_start", "secret_read", "raw_material_read", "domain_mutation"],
    terminal_backend_policy: "candidate_commands_only",
    browser_policy: "no_browser_session_without_registered_task",
    memory_policy: "domain_scoped_summary_only",
    profile_policy: "domain_profile_must_bind_to_capability_id",
    skill_policy: "domain_skill_must_emit_claim_packet",
    mcp_policy: "blocked_until_registered_human_gate",
    provider_secret_policy: "no_provider_secret_configuration_in_registry_phase",
    yolo_mode_allowed: false,
    approval_off_allowed: false,
    secret_forwarding_allowed: false,
    raw_client_or_vdr_context_allowed: false,
    evidence_ref: `evidence.platform.agent.capability_registry.tool_policy.${domain.domain_id}`,
    reviewer_ref: "reviewer.platform.agent_capability_registry_tool_policy",
    hard_gate_ref: `gate.platform.agent.capability_registry.tool_policy.${domain.domain_id}`,
    responsible_owner: domain.responsible_owner,
    next_allowed_action: "keep tool use blocked until capability-specific receipt and execution packet exist",
  }));
}

function buildUnsafeCapabilityRows() {
  return UNSAFE_CAPABILITY_BLOCKS.map(([unsafeId, blockReason, nextAction], index) => ({
    schema_version: "unsafe-agent-capability-block-row.v1",
    row_id: `unsafe-agent-capability-block.row.${String(index + 1).padStart(3, "0")}`,
    unsafe_capability_id: unsafeId,
    current_verdict: "blocked",
    block_reason: blockReason,
    evidence_ref: `evidence.platform.agent.capability_registry.unsafe.${unsafeId}`,
    reviewer_ref: "reviewer.platform.agent_capability_registry_unsafe",
    hard_gate_ref: `gate.platform.agent.capability_registry.unsafe.${unsafeId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAction,
    verdict_authority: "harness_only",
    agent_may_create_final_pass: false,
    protected_action_execution_allowed_now: false,
    unsafe_flags_false: true,
  }));
}

function buildClaimRows({ domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows }) {
  const passRows = [
    ...domainRows.map((row) => passClaim("domain_registry", `claim.platform.agent.capability_registry.domain.${row.domain_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...capabilityRows.map((row) => passClaim("domain_agent_capability", `claim.platform.agent.capability_registry.capability.${row.domain_id}.${row.capability_name}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...adapterSdkRows.map((row) => passClaim("adapter_sdk_contract", `claim.platform.agent.capability_registry.adapter_sdk.${row.domain_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
    ...toolPolicyRows.map((row) => passClaim("tool_policy_contract", `claim.platform.agent.capability_registry.tool_policy.${row.domain_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.next_allowed_action)),
  ];
  const blockedRows = unsafeCapabilityRows.map((row) => blockedClaim("unsafe_agent_capability", `claim.platform.agent.capability_registry.unsafe.${row.unsafe_capability_id}`, row.row_id, row.evidence_ref, row.reviewer_ref, row.hard_gate_ref, row.responsible_owner, row.block_reason, row.next_allowed_action));
  return [...passRows, ...blockedRows].map((row, index) => ({
    ...row,
    row_id: `agent-capability-registry-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows }) {
  const rows = [
    ["registry_policy_freezes_authority", registryPolicy.verdict_authority === "harness_only" && registryPolicy.agent_may_create_final_pass === false, "agent_capability_registry_policy"],
    ["rollout_levels_defined", rolloutRows.length === 6 && rolloutRows.every((row) => row.current_verdict === "pass"), "agent_rollout_level_rows"],
    ["all_seed_domains_registered", domainRows.length === DOMAIN_DEFINITIONS.length && domainRows.every((row) => row.current_verdict === "pass"), "domain_agent_registry_rows"],
    ["capabilities_registered_for_each_domain", domainRows.every((domain) => capabilityRows.some((row) => row.domain_id === domain.domain_id)), "domain_agent_capability_rows"],
    ["adapter_sdk_contracts_present", adapterSdkRows.length === domainRows.length && adapterSdkRows.every((row) => row.current_verdict === "pass"), "domain_agent_adapter_sdk_rows"],
    ["tool_policies_present", toolPolicyRows.length === domainRows.length && toolPolicyRows.every((row) => row.current_verdict === "pass"), "domain_agent_tool_policy_rows"],
    ["unsafe_capabilities_blocked", unsafeCapabilityRows.length >= 10 && unsafeCapabilityRows.every((row) => row.current_verdict === "blocked" && row.block_reason), "unsafe_agent_capability_block_rows"],
    ["no_runtime_or_secret_enablement", registryPolicy.runtime_execution_allowed_now === false && registryPolicy.provider_secret_configuration_allowed_now === false && registryPolicy.raw_secret_context_allowed === false, "agent_capability_registry_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_capability_registry_claim_rows"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-capability-registry-closeout-row.v1",
    row_id: `agent-capability-registry-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    evidence_ref: `evidence.platform.agent.capability_registry.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_capability_registry_closeout",
    hard_gate_ref: `gate.platform.agent.capability_registry.closeout.${closeoutId}`,
    source_ref: sourceRef,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "keep closeout evidence attached" : `repair ${closeoutId} before P1088 closeout`,
  }));
}

function buildAnchor({ packageJson, phaseLedger, authorityFreeze, isolatedInstall, registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-capability-registry-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    source_command_name: SOURCE_COMMAND_NAME,
    authority_command_name: AUTHORITY_COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    phase_ledger_present: phaseLedger.available,
    source_agent_authority_freeze_status: authorityFreeze.summary.platform_agent_authority_freeze_status,
    source_agent_isolated_install_gate_status: isolatedInstall.summary.platform_agent_isolated_install_gate_status,
    registry_mode: registryPolicy.registry_mode,
    rollout_level_count: rolloutRows.length,
    domain_count: domainRows.length,
    capability_count: capabilityRows.length,
    adapter_sdk_count: adapterSdkRows.length,
    tool_policy_count: toolPolicyRows.length,
    unsafe_block_count: unsafeCapabilityRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
  };
}

function buildGateRows({ packageJson, phaseLedger, authorityFreeze, isolatedInstall, registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const sourceCommand = `npm run ${SOURCE_COMMAND_NAME} -- --check`;
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["runs_after_isolated_install_gate", validate.indexOf(command) > validate.indexOf(sourceCommand) && validate.indexOf(sourceCommand) >= 0, "package.json scripts.validate"],
    ["phase_ledger_declares_registry", phaseLedger.available && ["P1065-P1088", COMMAND_NAME, "Domain Agent Capability Registry"].every((token) => phaseLedger.text.includes(token)), "docs/hermes-agent-operations-phase-ledger.md"],
    ["source_authority_ready", authorityFreeze.summary.platform_agent_authority_freeze_status === "ready_for_agent_authority_freeze", "source_agent_authority_freeze_summary"],
    ["source_isolated_install_ready", isolatedInstall.summary.platform_agent_isolated_install_gate_status === "ready_for_agent_isolated_install_gate", "source_agent_isolated_install_gate_summary"],
    ["rollout_levels_ready", rolloutRows.length === 6 && rolloutRows.every((row) => row.current_verdict === "pass"), "agent_rollout_level_rows"],
    ["domains_cover_seed_scope", domainRows.length === 7 && domainRows.every((row) => row.verdict_authority === "harness_only"), "domain_agent_registry_rows"],
    ["capabilities_cover_domains", domainRows.every((domain) => capabilityRows.some((row) => row.domain_id === domain.domain_id)), "domain_agent_capability_rows"],
    ["adapter_sdk_ready", adapterSdkRows.length === domainRows.length && adapterSdkRows.every((row) => row.claim_binding_required && row.evidence_binding_required), "domain_agent_adapter_sdk_rows"],
    ["tool_policy_blocks_mutation", toolPolicyRows.every((row) => row.blocked_tool_classes.includes("terminal_execution") && row.yolo_mode_allowed === false), "domain_agent_tool_policy_rows"],
    ["unsafe_capabilities_blocked", unsafeCapabilityRows.every((row) => row.current_verdict === "blocked" && row.next_allowed_action), "unsafe_agent_capability_block_rows"],
    ["no_runtime_secret_or_raw_context", registryPolicy.runtime_execution_allowed_now === false && registryPolicy.raw_secret_context_allowed === false && registryPolicy.raw_client_or_vdr_context_allowed === false, "agent_capability_registry_policy"],
    ["claims_supported", claimRows.every((row) => isSupportedClaimState(row)), "agent_capability_registry_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_capability_registry_closeout_rows"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-capability-registry-gate-row.v1",
    row_id: `agent-capability-registry-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.capability_registry.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_capability_registry_gate",
    hard_gate_ref: `gate.platform.agent.capability_registry.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    install_execution_performed_by_gate: false,
    runtime_execution_performed_by_gate: false,
    terminal_execution_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before P1088 closeout`,
  }));
}

function buildValidationItems({ gateRows, registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All capability registry gates must be ready."],
    ["policy.harness_only", registryPolicy.verdict_authority === "harness_only" && registryPolicy.agent_may_create_final_pass === false, "Registry policy must preserve harness-only verdict authority."],
    ["policy.no_runtime", registryPolicy.runtime_execution_allowed_now === false && registryPolicy.terminal_execution_allowed_now === false, "Registry phase must not enable Agent runtime or terminal execution."],
    ["policy.no_secret_raw", registryPolicy.raw_secret_context_allowed === false && registryPolicy.raw_client_or_vdr_context_allowed === false, "Registry phase must not expose raw secret/client/VDR context."],
    ["rollout.complete", rolloutRows.length === 6, "L0-L5 rollout rows must be present."],
    ["domains.complete", domainRows.length === DOMAIN_DEFINITIONS.length, "All seed domains must be registered."],
    ["capabilities.cover_domains", domainRows.every((domain) => capabilityRows.some((row) => row.domain_id === domain.domain_id)), "Every domain must have at least one Agent capability."],
    ["capabilities.harness_only", capabilityRows.every((row) => row.verdict_authority === "harness_only" && row.agent_may_create_final_pass === false), "Capabilities must not create final PASS."],
    ["adapter_sdk.ready", adapterSdkRows.every((row) => row.claim_binding_required && row.operator_surface_binding_required), "Adapter SDK rows must bind claims and operator surfaces."],
    ["tool_policy.blocks", toolPolicyRows.every((row) => row.blocked_tool_classes.includes("secret_read") && row.blocked_tool_classes.includes("domain_mutation")), "Tool policies must block secrets and mutation."],
    ["unsafe.blocks", unsafeCapabilityRows.every((row) => row.current_verdict === "blocked" && row.block_reason && row.next_allowed_action), "Unsafe capabilities must be documented BLOCK."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_capability_registry", passed, message));
}

function passClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, nextAllowedAction) {
  return {
    schema_version: "agent-capability-registry-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "pass",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: null,
    block_reason: null,
    responsible_owner: responsibleOwner,
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim(claimType, claimId, sourceRef, evidenceRef, reviewerRef, hardGateRef, responsibleOwner, blockReason, nextAllowedAction) {
  return {
    schema_version: "agent-capability-registry-claim-row.v1",
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

function buildSummary({ registryPolicy, rolloutRows, domainRows, capabilityRows, adapterSdkRows, toolPolicyRows, unsafeCapabilityRows, claimRows, closeoutRows, gateRows, validation }) {
  return {
    platform_agent_capability_registry_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    registry_mode: registryPolicy.registry_mode,
    domain_count: domainRows.length,
    rollout_level_count: rolloutRows.length,
    capability_count: capabilityRows.length,
    pass_capability_count: capabilityRows.filter((row) => row.current_verdict === "pass").length,
    blocked_capability_count: unsafeCapabilityRows.filter((row) => row.current_verdict === "blocked").length,
    adapter_sdk_count: adapterSdkRows.length,
    tool_policy_count: toolPolicyRows.length,
    unsafe_block_count: unsafeCapabilityRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    install_execution_allowed_now: registryPolicy.install_execution_allowed_now,
    runtime_execution_allowed_now: registryPolicy.runtime_execution_allowed_now,
    terminal_execution_allowed_now: registryPolicy.terminal_execution_allowed_now,
    protected_action_execution_allowed_now: registryPolicy.agent_may_execute_protected_action,
    final_pass_by_agent_allowed: registryPolicy.agent_may_create_final_pass,
    raw_secret_context_allowed: registryPolicy.raw_secret_context_allowed,
    raw_client_or_vdr_context_allowed: registryPolicy.raw_client_or_vdr_context_allowed,
    direct_zendd_mutation_allowed: registryPolicy.direct_zendd_mutation_allowed,
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function featureRefsForCapability(shortId) {
  const refs = ["profiles", "skills", "memory", "context_files"];
  if (shortId.includes("command") || shortId.includes("patch") || shortId.includes("rollback")) refs.push("terminal_backends");
  if (shortId.includes("evidence") || shortId.includes("source") || shortId.includes("vdr")) refs.push("toolsets");
  if (shortId.includes("operator") || shortId.includes("review")) refs.push("api_server");
  return refs;
}

function forbiddenOutputsForDomain(domainId) {
  const common = ["final_pass", "approval", "protected_action_execution", "raw_secret", "unredacted_stdout"];
  if (domainId === "law-firm" || domainId === "project.zendd") return [...common, "legal_final_advice", "raw_client_payload", "raw_vdr_payload"];
  if (domainId === "trading") return [...common, "live_order_submission", "broker_write", "credential_payload"];
  if (domainId === "connectors-resource") return [...common, "external_transfer_payload", "raw_restricted_payload"];
  return common;
}

function rolloutLevelRank(level) {
  return Number(level.replace("L", ""));
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Capability Registry",
    "",
    `Status: ${result.summary.platform_agent_capability_registry_status}`,
    `Phase: ${result.summary.phase_range}`,
    `Domains: ${result.summary.domain_count}`,
    `Capabilities: ${result.summary.pass_capability_count} PASS / ${result.summary.blocked_capability_count} BLOCK`,
    `Claims: ${result.summary.pass_claim_count} PASS / ${result.summary.blocked_claim_count} BLOCK`,
    "",
    "## Frozen Authority",
    "",
    "- Verdict authority: harness_only",
    "- Agent final PASS allowed: false",
    "- Runtime execution allowed now: false",
    "- Raw client/VDR context allowed: false",
    "- Direct Zendd mutation allowed: false",
    "",
    "## Next Allowed Action",
    "",
    result.agent_capability_registry_policy.next_allowed_action,
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
  const defaults = DEFAULT_PLATFORM_AGENT_CAPABILITY_REGISTRY_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-capability-registry.mjs [--check] [--out-dir DIR]\n\nCreates the P1065-P1088 domain Agent capability registry and adapter SDK contract without running Hermes Agent.`);
}
