import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";

export const DEFAULT_PLATFORM_AGENT_AUTHORITY_FREEZE_OUT_DIR = "artifacts/platform-agent-authority-freeze/latest";
export const DEFAULT_PLATFORM_AGENT_AUTHORITY_FREEZE_INPUTS = {
  schemaPath: "schemas/platform-agent-authority-freeze.schema.json",
  packagePath: "package.json",
  agentOperationsPhaseLedgerPath: "docs/hermes-agent-operations-phase-ledger.md",
};

const COMMAND_NAME = "platform:agent-authority-freeze";
const SCHEMA_VERSION = "platform-agent-authority-freeze.v1";
const CAPABILITY_ID = "platform.agent_operations.authority_freeze";
const PROGRAM_RANGE = "P1041-P1121";
const PHASE_RANGE = "P1041-P1044";
const PHASE_SLOT = "P1041";
const PREVIOUS_PHASE_SLOT = "P1040";
const NEXT_PHASE_SLOT = "P1045";
const READY_STATUS = "ready_for_agent_authority_freeze";

const OFFICIAL_SOURCE_ROWS = [
  {
    source_id: "nousresearch_hermes_agent_github",
    source_type: "official_repository",
    source_url: "https://github.com/NousResearch/hermes-agent",
    feature_coverage: ["installation", "cli_tui", "toolsets", "profiles", "skills", "memory", "mcp", "delegation", "cron_gateway", "api_server", "checkpoints_rollback"],
  },
  {
    source_id: "hermes_agent_installation_docs",
    source_type: "official_docs",
    source_url: "https://hermes-agent.nousresearch.com/docs/getting-started/installation",
    feature_coverage: ["installation", "doctor_smoke", "pipx", "docker", "one_line_installer"],
  },
  {
    source_id: "hermes_agent_security_docs",
    source_type: "official_docs",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/security/",
    feature_coverage: ["approval_modes", "yolo_mode", "container_isolation", "mcp_credential_filtering", "supply_chain_advisory"],
  },
  {
    source_id: "hermes_agent_tools_docs",
    source_type: "official_docs",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/tools",
    feature_coverage: ["toolsets", "terminal_backends", "docker_backend", "ssh_backend", "browser_tools"],
  },
  {
    source_id: "hermes_agent_api_server_docs",
    source_type: "official_docs",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server",
    feature_coverage: ["api_server", "openai_compatible_endpoint", "responses_api", "capabilities_endpoint"],
  },
  {
    source_id: "hermes_agent_delegation_docs",
    source_type: "official_docs",
    source_url: "https://hermes-agent.nousresearch.com/docs/guides/delegation-patterns/",
    feature_coverage: ["subagent_delegation", "parallel_work", "restricted_toolsets"],
  },
  {
    source_id: "hermes_agent_checkpoint_docs",
    source_type: "official_docs",
    source_url: "https://hermes-agent.nousresearch.com/docs/user-guide/checkpoints-and-rollback",
    feature_coverage: ["checkpoints", "rollback"],
  },
];

const FEATURE_DEFINITIONS = [
  ["installation", "install and update Hermes Agent", "L0", "documented_block_until_install_trust_gate"],
  ["cli_tui", "operator-facing interactive agent surfaces", "L1", "candidate_generation_only"],
  ["toolsets", "web terminal file browser and media tool policy", "L2", "task_scoped_allowlist_required"],
  ["terminal_backends", "local docker ssh singularity modal daytona backends", "L2", "docker_or_venv_first"],
  ["profiles", "separate agent state per purpose", "L3", "domain_profile_isolation_required"],
  ["skills", "procedural domain instructions", "L3", "human_review_required_for_skill_changes"],
  ["memory", "persistent cross-session context", "L2", "no_secret_or_raw_client_memory"],
  ["context_files", "project context shaping agent runs", "L2", "read_only_context_refs_only"],
  ["mcp", "external tool server integration", "L3", "registry_and_credential_filter_required"],
  ["delegation_subagents", "parallel isolated child agents", "L3", "summary_only_no_final_verdict"],
  ["cron_gateway", "scheduled and messaging-platform operation", "L3", "monitoring_only_until_receipt"],
  ["api_server", "OpenAI-compatible local HTTP endpoint", "L3", "operator_surface_only"],
  ["checkpoints_rollback", "shadow snapshots and rollback support", "L4", "rollback_ref_required_before_patch"],
  ["browser_web", "public web and browser automation", "L2", "public_research_only"],
  ["supply_chain_advisory", "doctor and advisory checks", "L1", "evidence_candidate_only"],
];

const AUTHORITY_RULE_DEFINITIONS = [
  ["direct_pass_authority", "blocked", "agent_final_verdict_forbidden", "Agent cannot produce PASS without harness adjudication.", "keep PASS decisions in claim freeze gates"],
  ["direct_approval_authority", "blocked", "agent_approval_forbidden", "Agent cannot approve protected work.", "collect human receipt through Hermes receipt gates"],
  ["release_or_deploy_authority", "blocked", "agent_release_execution_forbidden", "Agent cannot release, deploy, package, or publish.", "route through release freeze and protected action gates"],
  ["legal_final_judgment", "blocked", "agent_legal_final_judgment_forbidden", "Agent cannot issue final legal advice or attorney approval.", "require attorney receipt and legal-domain review packet"],
  ["protected_output_without_receipt", "blocked", "missing_human_receipt", "Protected outputs cannot be final without human receipt.", "request protected output receipt packet"],
  ["raw_secret_access", "blocked", "secret_boundary_required", "Secrets and env files are not agent context.", "use secrets broker and redacted evidence refs only"],
  ["raw_client_or_vdr_exposure", "blocked", "raw_material_boundary_required", "Raw client and VDR material cannot be copied into agent memory/context/API.", "provide redacted summary refs only"],
  ["yolo_or_approval_off", "blocked", "unsafe_agent_approval_mode", "YOLO or approval-off mode bypasses safety prompts.", "set manual approvals and document doctor evidence"],
  ["secret_forwarding", "blocked", "unsafe_env_forwarding", "Environment forwarding exposes credentials to tool sessions.", "keep env allowlist empty until credential filter gate passes"],
  ["direct_zendd_mutation", "blocked", "external_project_mutation_forbidden", "Zendd remains an external project and cannot be mutated by this phase.", "create work order and patch candidate only"],
  ["domain_pack_scope_expansion", "pass", "expandable_capability_registry_ready", "Domain packs may expand through registered capabilities.", "advance to P1065 Domain Agent Capability Registry"],
  ["candidate_generation", "pass", "candidate_output_authorized", "Agent may generate work, research, command, patch, review, and recovery candidates.", "bind candidates to evidence and reviewer gates"],
];

const DOMAIN_SCOPE_DEFINITIONS = [
  ["platform", "core_harness", ["agent_control_layer", "operator_surface", "freeze_gate"]],
  ["personal-dev", "domain_pack", ["issue_triage", "test_candidate", "diff_review", "release_note_draft", "rollback_draft"]],
  ["law-firm", "domain_pack", ["ldd_vdr_fact_candidate", "citation_gap", "attorney_review_packet", "client_output_gate"]],
  ["creative-document", "domain_pack", ["template_check", "style_diff", "layout_qa", "output_artifact_review"]],
  ["connectors-resource", "domain_pack", ["ingestion_candidate", "quarantine_reason", "source_confidence", "evidence_surface"]],
  ["trading", "domain_pack", ["research_candidate", "paper_only_review", "safety_fixture_summary", "protected_promotion_block"]],
  ["project.zendd", "external_project", ["work_order", "patch_plan", "command_candidate", "vdr_ldd_bridge", "release_sandbox"]],
];

export async function runPlatformAgentAuthorityFreeze(options = {}) {
  const result = await buildPlatformAgentAuthorityFreeze(options);
  if (options.write !== false) await writePlatformAgentAuthorityFreeze(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Platform agent authority freeze failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildPlatformAgentAuthorityFreeze(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_PLATFORM_AGENT_AUTHORITY_FREEZE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const packageJson = await readJsonSource(inputs.package_path);
  const phaseLedger = await readTextSource(inputs.agent_operations_phase_ledger_path);
  const sourceRows = buildOfficialSourceRows();
  const featureRows = buildFeatureInventoryRows(sourceRows);
  const policy = buildAuthorityPolicy(generatedAt);
  const authorityRows = buildAuthorityRuleRows();
  const domainRows = buildDomainScopeRows();
  const claimRows = buildClaimRows({ sourceRows, featureRows, authorityRows, domainRows });
  const closeoutRows = buildCloseoutRows({ policy, sourceRows, featureRows, authorityRows, domainRows, claimRows });
  const anchor = buildAnchor({ packageJson, phaseLedger, sourceRows, featureRows, policy, authorityRows, domainRows, claimRows, closeoutRows });
  const gateRows = buildGateRows({ packageJson, phaseLedger, sourceRows, featureRows, policy, authorityRows, domainRows, claimRows, closeoutRows });
  const validationItems = buildValidationItems({ gateRows, policy, sourceRows, featureRows, authorityRows, domainRows, claimRows, closeoutRows });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    platform_agent_authority_freeze_id: `platform-agent-authority-freeze.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    output_dir: outputDir,
    inputs,
    agent_authority_anchor: anchor,
    agent_official_source_rows: sourceRows,
    agent_feature_inventory_rows: featureRows,
    agent_authority_policy: policy,
    agent_authority_rule_rows: authorityRows,
    domain_agent_scope_seed_rows: domainRows,
    agent_authority_claim_rows: claimRows,
    agent_authority_closeout_rows: closeoutRows,
    agent_authority_gate_rows: gateRows,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ sourceRows, featureRows, authorityRows, domainRows, claimRows, closeoutRows, gateRows, validation: preliminaryValidation }),
  };
  const schema = await readJsonSource(inputs.schema_path);
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "platform_agent_authority_freeze")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ sourceRows, featureRows, authorityRows, domainRows, claimRows, closeoutRows, gateRows, validation: result.validation });
  result.summary.platform_agent_authority_freeze_id = result.platform_agent_authority_freeze_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writePlatformAgentAuthorityFreeze(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "platform-agent-authority-freeze.json"), serializableResult(result));
  await writeJson(path.join(outDir, "agent-official-source-rows.json"), collectionEnvelope("agent-official-source-rows.v1", "agent_official_source_rows", result.agent_official_source_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-feature-inventory-rows.json"), collectionEnvelope("agent-feature-inventory-rows.v1", "agent_feature_inventory_rows", result.agent_feature_inventory_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-authority-policy.json"), result.agent_authority_policy);
  await writeJson(path.join(outDir, "agent-authority-rule-rows.json"), collectionEnvelope("agent-authority-rule-rows.v1", "agent_authority_rule_rows", result.agent_authority_rule_rows, result.generated_at));
  await writeJson(path.join(outDir, "domain-agent-scope-seed-rows.json"), collectionEnvelope("domain-agent-scope-seed-rows.v1", "domain_agent_scope_seed_rows", result.domain_agent_scope_seed_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-authority-claim-rows.json"), collectionEnvelope("agent-authority-claim-rows.v1", "agent_authority_claim_rows", result.agent_authority_claim_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-authority-closeout-rows.json"), collectionEnvelope("agent-authority-closeout-rows.v1", "agent_authority_closeout_rows", result.agent_authority_closeout_rows, result.generated_at));
  await writeJson(path.join(outDir, "agent-authority-gate-rows.json"), collectionEnvelope("agent-authority-gate-rows.v1", "agent_authority_gate_rows", result.agent_authority_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "platform-agent-authority-freeze-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runPlatformAgentAuthorityFreezeCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runPlatformAgentAuthorityFreeze(args);
    console.log(`Platform agent authority freeze ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.platform_agent_authority_freeze_status}`);
    console.log(`Features: ${result.summary.feature_count}`);
    console.log(`Authority rules: pass ${result.summary.pass_authority_rule_count}, blocked ${result.summary.blocked_authority_rule_count}`);
    console.log(`Domain scopes: ${result.summary.domain_scope_count}`);
    console.log(`Claims: pass ${result.summary.pass_claim_count}, blocked ${result.summary.blocked_claim_count}, total ${result.summary.claim_count}`);
    console.log(`Unsafe flags: ${result.summary.unsafe_flag_count}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildAuthorityPolicy(generatedAt) {
  return {
    schema_version: "platform-agent-authority-policy.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    agent_operations_layer_creation_allowed: true,
    official_source_inventory_allowed: true,
    install_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    terminal_command_execution_allowed_now: false,
    mcp_server_connection_allowed_now: false,
    cron_or_gateway_start_allowed_now: false,
    api_server_start_allowed_now: false,
    browser_session_start_allowed_now: false,
    agent_direct_pass_allowed: false,
    agent_direct_approval_allowed: false,
    agent_release_or_deploy_allowed: false,
    agent_legal_final_judgment_allowed: false,
    yolo_mode_allowed: false,
    approval_off_allowed: false,
    secret_forwarding_allowed: false,
    raw_secret_context_allowed: false,
    raw_client_or_vdr_context_allowed: false,
    raw_client_or_vdr_memory_allowed: false,
    protected_output_without_human_receipt_allowed: false,
    zendd_direct_mutation_allowed_now: false,
    domain_capability_expansion_allowed_via_registry: true,
    verdict_authority: "harness_only",
    allowed_agent_outputs: ["work_order", "research_packet", "evidence_candidate", "command_candidate", "patch_plan", "review_draft", "recovery_draft", "next_allowed_action"],
    forbidden_agent_outputs: ["final_pass", "approval", "release_execution", "deployment_execution", "legal_final_judgment", "protected_output_without_receipt", "secret_material", "raw_client_or_vdr_payload"],
    final_pass_requires: ["claim_id", "evidence_ref", "reviewer_ref", "hard_gate_ref", "unsafe_flags_false"],
    blocked_requires: ["block_reason", "responsible_owner", "next_allowed_action"],
    next_allowed_action: "advance to P1045-P1056 supply-chain trust and install mode decision before any Hermes Agent installation",
    created_at: generatedAt,
  };
}

function buildOfficialSourceRows() {
  return OFFICIAL_SOURCE_ROWS.map((row, index) => ({
    schema_version: "agent-official-source-row.v1",
    row_id: `agent-official-source.row.${String(index + 1).padStart(3, "0")}`,
    current_verdict: "pass",
    evidence_ref: `evidence.platform.agent.source.${row.source_id}`,
    reviewer_ref: "reviewer.platform.agent_supply_chain",
    hard_gate_ref: "gate.platform.agent.official_source_inventory",
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "use this source only as inventory evidence until install trust gate passes",
    ...row,
  }));
}

function buildFeatureInventoryRows(sourceRows) {
  const sourceCoverage = new Map();
  for (const source of sourceRows) {
    for (const feature of source.feature_coverage) {
      if (!sourceCoverage.has(feature)) sourceCoverage.set(feature, []);
      sourceCoverage.get(feature).push(source.source_id);
    }
  }
  return FEATURE_DEFINITIONS.map(([featureId, nativeCapability, rolloutLevelCeiling, policyBinding], index) => ({
    schema_version: "agent-feature-inventory-row.v1",
    row_id: `agent-feature-inventory.row.${String(index + 1).padStart(3, "0")}`,
    feature_id: featureId,
    native_capability: nativeCapability,
    rollout_level_ceiling: rolloutLevelCeiling,
    policy_binding: policyBinding,
    source_refs: sourceCoverage.get(featureId) ?? ["nousresearch_hermes_agent_github"],
    allowed_outputs: ["candidate", "draft", "evidence_ref", "next_allowed_action"],
    forbidden_outputs: ["final_pass", "approval", "protected_final_output"],
    current_verdict: "pass",
    evidence_ref: `evidence.platform.agent.feature.${featureId}`,
    reviewer_ref: "reviewer.platform.agent_feature_inventory",
    hard_gate_ref: "gate.platform.agent.feature_authority",
    responsible_owner: "platform_agent_owner",
    next_allowed_action: "bind feature to domain capability registry before rollout expansion",
  }));
}

function buildAuthorityRuleRows() {
  return AUTHORITY_RULE_DEFINITIONS.map(([ruleId, verdict, blockReason, description, nextAllowedAction], index) => {
    const blocked = verdict === "blocked";
    return {
      schema_version: "agent-authority-rule-row.v1",
      row_id: `agent-authority-rule.row.${String(index + 1).padStart(3, "0")}`,
      authority_rule_id: ruleId,
      current_verdict: verdict,
      block_reason: blocked ? blockReason : null,
      rule_description: description,
      responsible_owner: "platform_agent_owner",
      evidence_ref: `evidence.platform.agent.authority.${ruleId}`,
      reviewer_ref: "reviewer.platform.agent_authority",
      hard_gate_ref: `gate.platform.agent.authority.${ruleId}`,
      human_receipt_ref: blocked && isProtectedAuthorityRule(ruleId) ? `receipt.platform.agent.authority.${ruleId}` : null,
      next_allowed_action: nextAllowedAction,
      agent_may_create_final_pass: false,
      agent_may_apply_human_receipt: false,
      agent_may_execute_protected_action: false,
      verdict_authority: "harness_only",
    };
  });
}

function buildDomainScopeRows() {
  return DOMAIN_SCOPE_DEFINITIONS.map(([domainId, domainType, plannedCapabilities], index) => ({
    schema_version: "domain-agent-scope-seed-row.v1",
    row_id: `domain-agent-scope-seed.row.${String(index + 1).padStart(3, "0")}`,
    domain_id: domainId,
    domain_type: domainType,
    initial_rollout_level: "L0",
    max_planned_rollout_level: "L5",
    planned_capabilities: plannedCapabilities,
    capability_registry_required: true,
    tool_policy_required: true,
    evidence_contract_required: true,
    human_gate_policy_required: true,
    protected_output_receipt_required: domainId === "law-firm" || domainId === "project.zendd" || domainId === "trading",
    raw_secret_or_client_material_allowed: false,
    verdict_authority: "harness_only",
    current_verdict: "pass",
    evidence_ref: `evidence.platform.agent.domain_scope.${domainId}`,
    reviewer_ref: `reviewer.platform.agent.domain_scope.${domainId}`,
    hard_gate_ref: `gate.platform.agent.domain_scope.${domainId}`,
    responsible_owner: `${domainId.replaceAll(".", "_").replaceAll("-", "_")}_owner`,
    next_allowed_action: "register concrete capability rows in P1065-P1088 before expanding beyond L0",
  }));
}

function buildClaimRows({ sourceRows, featureRows, authorityRows, domainRows }) {
  const sourceClaims = sourceRows.map((row) => passClaim({
    claimId: `claim.platform.agent.source.${row.source_id}`,
    claimType: "official_source_inventory",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    nextAllowedAction: row.next_allowed_action,
  }));
  const featureClaims = featureRows.map((row) => passClaim({
    claimId: `claim.platform.agent.feature.${row.feature_id}`,
    claimType: "feature_authority_inventory",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    nextAllowedAction: row.next_allowed_action,
  }));
  const authorityClaims = authorityRows.map((row) => row.current_verdict === "pass"
    ? passClaim({
      claimId: `claim.platform.agent.authority.${row.authority_rule_id}`,
      claimType: "authority_rule",
      sourceRef: row.row_id,
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      nextAllowedAction: row.next_allowed_action,
    })
    : blockedClaim({
      claimId: `claim.platform.agent.authority.${row.authority_rule_id}`,
      claimType: "authority_rule",
      sourceRef: row.row_id,
      evidenceRef: row.evidence_ref,
      reviewerRef: row.reviewer_ref,
      hardGateRef: row.hard_gate_ref,
      humanReceiptRef: row.human_receipt_ref,
      blockReason: row.block_reason,
      nextAllowedAction: row.next_allowed_action,
    }));
  const domainClaims = domainRows.map((row) => passClaim({
    claimId: `claim.platform.agent.domain_scope.${row.domain_id}`,
    claimType: "domain_scope_seed",
    sourceRef: row.row_id,
    evidenceRef: row.evidence_ref,
    reviewerRef: row.reviewer_ref,
    hardGateRef: row.hard_gate_ref,
    humanReceiptRef: row.protected_output_receipt_required ? `receipt.platform.agent.domain_scope.${row.domain_id}` : null,
    nextAllowedAction: row.next_allowed_action,
  }));
  return [...sourceClaims, ...featureClaims, ...authorityClaims, ...domainClaims].map((row, index) => ({
    ...row,
    row_id: `agent-authority-claim.row.${String(index + 1).padStart(3, "0")}`,
  }));
}

function buildCloseoutRows({ policy, sourceRows, featureRows, authorityRows, domainRows, claimRows }) {
  const rows = [
    ["official_sources_inventory_complete", sourceRows.length >= 7, "agent_source_inventory"],
    ["general_features_mapped", featureRows.length >= 15, "agent_feature_inventory"],
    ["unsafe_authority_blocked", authorityRows.filter((row) => row.current_verdict === "blocked").length >= 10, "agent_authority_rules"],
    ["candidate_generation_allowed_only", authorityRows.some((row) => row.authority_rule_id === "candidate_generation" && row.current_verdict === "pass"), "agent_authority_rules"],
    ["domain_scope_expandable", domainRows.length >= 7 && domainRows.every((row) => row.capability_registry_required && row.max_planned_rollout_level === "L5"), "domain_scope_seed"],
    ["harness_verdict_authority_only", claimRows.every((row) => row.verdict_authority === "harness_only"), "claim_registry"],
    ["install_and_runtime_disabled", policy.install_execution_allowed_now === false && policy.runtime_execution_allowed_now === false, "authority_policy"],
    ["secret_and_raw_material_blocked", policy.raw_secret_context_allowed === false && policy.raw_client_or_vdr_context_allowed === false, "authority_policy"],
  ];
  return rows.map(([closeoutId, pass, sourceRef], index) => ({
    schema_version: "agent-authority-closeout-row.v1",
    row_id: `agent-authority-closeout.row.${String(index + 1).padStart(3, "0")}`,
    closeout_id: closeoutId,
    current_verdict: pass ? "pass" : "blocked",
    evidence_ref: `evidence.platform.agent.closeout.${closeoutId}`,
    reviewer_ref: "reviewer.platform.agent_closeout",
    hard_gate_ref: `gate.platform.agent.closeout.${closeoutId}`,
    source_ref: sourceRef,
    block_reason: pass ? null : `missing_${closeoutId}`,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: pass ? "advance to next agent authority closeout row" : `repair ${closeoutId} before P1041 closeout`,
  }));
}

function buildAnchor({ packageJson, phaseLedger, sourceRows, featureRows, policy, authorityRows, domainRows, claimRows, closeoutRows }) {
  return {
    schema_version: "platform-agent-authority-anchor.v1",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    previous_phase_slot: PREVIOUS_PHASE_SLOT,
    next_phase_slot: NEXT_PHASE_SLOT,
    command_name: COMMAND_NAME,
    capability_id: CAPABILITY_ID,
    package_script_registered: typeof packageJson.data?.scripts?.[COMMAND_NAME] === "string",
    validation_chain_registered: validateChainIncludes(packageJson, COMMAND_NAME),
    phase_ledger_present: phaseLedger.available,
    source_count: sourceRows.length,
    feature_count: featureRows.length,
    authority_rule_count: authorityRows.length,
    domain_scope_count: domainRows.length,
    claim_count: claimRows.length,
    closeout_count: closeoutRows.length,
    install_execution_allowed_now: policy.install_execution_allowed_now,
    runtime_execution_allowed_now: policy.runtime_execution_allowed_now,
  };
}

function buildGateRows({ packageJson, phaseLedger, sourceRows, featureRows, policy, authorityRows, domainRows, claimRows, closeoutRows }) {
  const scripts = packageJson.data?.scripts ?? {};
  const validate = scripts.validate ?? "";
  const command = `npm run ${COMMAND_NAME} -- --check`;
  const expectedLedgerTokens = [
    "P1041-P1121",
    "P1041-P1044",
    COMMAND_NAME,
    "Domain Agent Capability Registry",
    "L0-L5",
  ];
  const rows = [
    ["package_script_registered", typeof scripts[COMMAND_NAME] === "string", `package.json scripts.${COMMAND_NAME}`],
    ["validation_chain_registered", validate.includes(command), "package.json scripts.validate"],
    ["phase_ledger_declares_p1041", phaseLedger.available && expectedLedgerTokens.every((token) => phaseLedger.text.includes(token)), "docs/hermes-agent-operations-phase-ledger.md"],
    ["official_sources_present", sourceRows.length >= 7 && sourceRows.every((row) => row.source_url.startsWith("https://")), "agent_official_source_rows"],
    ["feature_inventory_complete", featureRows.length >= 15 && featureRows.every((row) => row.current_verdict === "pass"), "agent_feature_inventory_rows"],
    ["unsafe_authority_rules_blocked", authorityRows.filter((row) => row.current_verdict === "blocked").length >= 10 && authorityRows.every((row) => row.verdict_authority === "harness_only"), "agent_authority_rule_rows"],
    ["domain_scopes_expandable", domainRows.length >= 7 && domainRows.every((row) => row.initial_rollout_level === "L0" && row.max_planned_rollout_level === "L5"), "domain_agent_scope_seed_rows"],
    ["claim_rows_adjudicated", claimRows.every((row) => isSupportedClaimState(row)), "agent_authority_claim_rows"],
    ["closeout_rows_pass", closeoutRows.every((row) => row.current_verdict === "pass"), "agent_authority_closeout_rows"],
    ["no_install_or_runtime_execution", policy.install_execution_allowed_now === false && policy.runtime_execution_allowed_now === false && policy.terminal_command_execution_allowed_now === false, "agent_authority_policy"],
    ["secret_and_raw_material_boundary", policy.secret_forwarding_allowed === false && policy.raw_secret_context_allowed === false && policy.raw_client_or_vdr_context_allowed === false, "agent_authority_policy"],
    ["protected_output_gate", policy.protected_output_without_human_receipt_allowed === false && policy.agent_direct_approval_allowed === false, "agent_authority_policy"],
  ];
  return rows.map(([gateId, pass, sourceRef], index) => ({
    schema_version: "agent-authority-gate-row.v1",
    row_id: `agent-authority-gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id: gateId,
    gate_status: pass ? "ready" : "blocked",
    source_ref: sourceRef,
    evidence_ref: `evidence.platform.agent.gate.${gateId}`,
    reviewer_ref: "reviewer.platform.agent_gate",
    hard_gate_ref: `gate.platform.agent.${gateId}`,
    block_reason: pass ? null : `missing_${gateId}`,
    responsible_owner: "platform_agent_owner",
    command_execution_performed_by_gate: false,
    install_execution_performed_by_gate: false,
    protected_action_executed_by_gate: false,
    next_allowed_action: pass ? "keep gate evidence attached" : `repair ${gateId} before declaring P1041 ready`,
  }));
}

function buildValidationItems({ gateRows, policy, sourceRows, featureRows, authorityRows, domainRows, claimRows, closeoutRows }) {
  const checks = [
    ["gates.ready", gateRows.every((row) => row.gate_status === "ready"), "All P1041 agent authority gates must be ready."],
    ["policy.no_install", policy.install_execution_allowed_now === false, "P1041 must not install Hermes Agent."],
    ["policy.no_runtime", policy.runtime_execution_allowed_now === false, "P1041 must not start Hermes Agent runtime."],
    ["policy.harness_verdict_only", policy.verdict_authority === "harness_only", "Verdict authority must remain with Hermes harness."],
    ["sources.official", sourceRows.length >= 7, "Official source inventory must cover the general feature set."],
    ["features.complete", featureRows.length >= 15, "General Hermes Agent features must be inventoried."],
    ["authority.unsafe_blocked", authorityRows.filter((row) => row.current_verdict === "blocked").length >= 10, "Unsafe authority rows must be documented BLOCK."],
    ["domain.expandable", domainRows.every((row) => row.capability_registry_required && row.max_planned_rollout_level === "L5"), "Domain rows must be expandable through registry gates."],
    ["claims.supported", claimRows.every((row) => isSupportedClaimState(row)), "Claims must be PASS or documented BLOCK."],
    ["closeout.pass", closeoutRows.every((row) => row.current_verdict === "pass"), "Closeout rows must pass."],
  ];
  return checks.map(([id, passed, message]) => validationItem(id, "agent_authority_freeze", passed, message));
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

function passClaim({ claimId, claimType, sourceRef, evidenceRef, reviewerRef, hardGateRef, humanReceiptRef = null, nextAllowedAction }) {
  return {
    schema_version: "agent-authority-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "pass",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: null,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function blockedClaim({ claimId, claimType, sourceRef, evidenceRef, reviewerRef, hardGateRef, humanReceiptRef = null, blockReason, nextAllowedAction }) {
  return {
    schema_version: "agent-authority-claim-row.v1",
    claim_id: claimId,
    claim_type: claimType,
    source_ref: sourceRef,
    current_verdict: "blocked",
    evidence_ref: evidenceRef,
    reviewer_ref: reviewerRef,
    hard_gate_ref: hardGateRef,
    human_receipt_ref: humanReceiptRef,
    block_reason: blockReason,
    responsible_owner: "platform_agent_owner",
    next_allowed_action: nextAllowedAction,
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  };
}

function isProtectedAuthorityRule(ruleId) {
  return [
    "direct_approval_authority",
    "release_or_deploy_authority",
    "legal_final_judgment",
    "protected_output_without_receipt",
    "raw_client_or_vdr_exposure",
    "direct_zendd_mutation",
  ].includes(ruleId);
}

function buildSummary({ sourceRows, featureRows, authorityRows, domainRows, claimRows, closeoutRows, gateRows, validation }) {
  const blockedAuthority = authorityRows.filter((row) => row.current_verdict === "blocked").length;
  const passAuthority = authorityRows.filter((row) => row.current_verdict === "pass").length;
  return {
    platform_agent_authority_freeze_status: validation.valid ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    phase_range: PHASE_RANGE,
    phase_slot: PHASE_SLOT,
    source_count: sourceRows.length,
    feature_count: featureRows.length,
    authority_rule_count: authorityRows.length,
    pass_authority_rule_count: passAuthority,
    blocked_authority_rule_count: blockedAuthority,
    domain_scope_count: domainRows.length,
    claim_count: claimRows.length,
    pass_claim_count: claimRows.filter((row) => row.current_verdict === "pass").length,
    blocked_claim_count: claimRows.filter((row) => row.current_verdict === "blocked").length,
    closeout_count: closeoutRows.length,
    gate_count: gateRows.length,
    ready_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    install_execution_allowed_now: false,
    runtime_execution_allowed_now: false,
    terminal_command_execution_allowed_now: false,
    mcp_connection_allowed_now: false,
    protected_output_without_receipt_allowed: false,
    verdict_authority: "harness_only",
    unsafe_flag_count: 0,
    validation_error_count: validation.errors.length,
  };
}

function renderMarkdown(result) {
  const lines = [
    "# Platform Agent Authority Freeze",
    "",
    `Status: ${result.summary.platform_agent_authority_freeze_status}`,
    `Program: ${result.summary.program_range}`,
    `Phase: ${result.summary.phase_range}`,
    `Features inventoried: ${result.summary.feature_count}`,
    `Authority rules: ${result.summary.pass_authority_rule_count} PASS / ${result.summary.blocked_authority_rule_count} BLOCK`,
    `Domain scopes: ${result.summary.domain_scope_count}`,
    `Claims: ${result.summary.pass_claim_count} PASS / ${result.summary.blocked_claim_count} BLOCK`,
    "",
    "## Frozen Policy",
    "",
    "- Agent verdict authority: harness_only",
    "- Install execution allowed now: false",
    "- Runtime execution allowed now: false",
    "- Protected output without receipt allowed: false",
    "- Domain expansion path: capability registry",
    "",
    "## Next Allowed Action",
    "",
    result.agent_authority_policy.next_allowed_action,
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
  const defaults = DEFAULT_PLATFORM_AGENT_AUTHORITY_FREEZE_INPUTS;
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
  console.log(`Usage: node scripts/platform-agent-authority-freeze.mjs [--check] [--out-dir DIR]\n\nCreates the P1041 Agent Authority Freeze inventory without installing or running Hermes Agent.`);
}
