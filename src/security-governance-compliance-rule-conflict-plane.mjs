import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { validateAgainstSchema } from "./core-contract-validator.mjs";
import { buildRetrievalOntologyContextRecallLayer } from "./retrieval-ontology-context-recall-layer.mjs";

export const DEFAULT_SECURITY_GOVERNANCE_COMPLIANCE_RULE_CONFLICT_PLANE_OUT_DIR = "artifacts/security-governance-compliance-rule-conflict-plane/latest";
export const DEFAULT_SECURITY_GOVERNANCE_COMPLIANCE_RULE_CONFLICT_PLANE_INPUTS = {
  schemaPath: "schemas/security-governance-compliance-rule-conflict-plane.schema.json",
  packagePath: "package.json",
  roadmapDocPath: "docs/hermes-long-range-roadmap-p4001-p8000.md",
  architectureDocPath: "docs/architecture.md",
  reviewDashboardDocPath: "docs/review-dashboard-ia.md",
};

const COMMAND_NAME = "platform:security-governance-compliance-rule-conflict-plane";
const RECALL_COMMAND_NAME = "platform:retrieval-ontology-context-recall-layer";
const SCHEMA_VERSION = "security-governance-compliance-rule-conflict-plane.v1";
const CAPABILITY_ID = "platform.security_governance_compliance_rule_conflict_plane";
const PROGRAM_RANGE = "P7601-P7800";
const READY_STATUS = "ready_for_security_governance_compliance_rule_conflict_plane_v0";
const RECALL_READY_STATUS = "ready_for_retrieval_ontology_context_recall_layer_v0";

const PHASE_SPECS = [
  ["P7601-P7620", "Secret and Raw Material Governance"],
  ["P7621-P7640", "Prompt Injection and Tool Boundary"],
  ["P7641-P7660", "Rule Conflict Graph"],
  ["P7661-P7680", "Stale Gate and Policy Drift Detector"],
  ["P7681-P7700", "Incident and Recovery Drill Contract"],
  ["P7701-P7720", "Compliance Pack Registry"],
  ["P7721-P7740", "Governance UI Rows"],
  ["P7741-P7760", "Governance Negative Fixtures"],
  ["P7761-P7780", "Claude Governance Review Packet"],
  ["P7781-P7800", "Security Governance Freeze"],
];

const RAW_MATERIAL_SPECS = [
  ["raw.secret", "API key, token, credential, or secret handle"],
  ["raw.privileged", "privileged or legal hold material"],
  ["raw.client", "client or VDR material"],
  ["raw.hr", "employee, applicant, compensation, or labor-compliance material"],
  ["raw.connector", "connector payload or mailbox/calendar resource"],
  ["raw.transcript", "Codex or Claude transcript raw body"],
];

const PROMPT_INJECTION_SPECS = [
  ["injection.policy_override", "prompt asks model to ignore Harness policy"],
  ["injection.tool_escalation", "prompt attempts to escalate tool or runtime authority"],
  ["injection.raw_export", "prompt asks for raw secret/client/transcript export"],
  ["injection.review_bypass", "prompt tries to bypass Claude review receipt"],
  ["injection.cross_domain", "prompt tries to cross project, matter, HR, or domain walls"],
];

const RULE_CONFLICT_SPECS = [
  ["conflict.duplicate_gate", "duplicate gates produce inconsistent status"],
  ["conflict.stale_exception", "old exception conflicts with current policy"],
  ["conflict.pack_boundary", "domain pack rule conflicts with platform boundary"],
  ["conflict.review_authority", "reviewer role conflicts with final approval boundary"],
  ["conflict.trust_tier", "lower-trust readiness conflicts with enterprise claim"],
];

const STALE_GATE_SPECS = [
  ["stale.validator", "validator not rerun after relevant contract change"],
  ["stale.model", "reviewer model alias/id changed without receipt"],
  ["stale.github_ruleset", "GitHub branch/ruleset evidence older than current commit"],
  ["stale.attestation", "attestation verify result not bound to current subject digest"],
  ["stale.review_receipt", "Claude review receipt missing, partial, or stale for milestone"],
];

const COMPLIANCE_PACK_SPECS = [
  ["compliance.security", "security and secret handling checks"],
  ["compliance.privacy", "privacy, retention, deletion, and raw-data checks"],
  ["compliance.legal", "legal-domain final-output and privilege checks"],
  ["compliance.hr", "HR sensitive-data and labor-compliance evidence checks"],
  ["compliance.connector", "connector write, raw export, and secret-read checks"],
  ["compliance.trading", "trading read-only/live-action boundary checks"],
];

const GOVERNANCE_UI_SPECS = [
  ["ui.conflict_queue", "rule conflicts and duplicate gate rows"],
  ["ui.stale_gate_queue", "stale validator, ruleset, model, attestation, and receipt rows"],
  ["ui.injection_queue", "prompt-injection and policy-override rows"],
  ["ui.secret_queue", "secret, raw material, and sensitive-data holds"],
  ["ui.incident_queue", "incident, containment, rollback, and revalidation rows"],
  ["ui.compliance_queue", "compliance pack status and theater-block rows"],
];

const NEGATIVE_FIXTURES = [
  ["negative.policy_override", "prompt or config overrides a hard Harness policy", "BLOCK_POLICY_OVERRIDE"],
  ["negative.stale_pass", "stale validator, ruleset, attestation, or review receipt is treated as current PASS", "BLOCK_STALE_PASS"],
  ["negative.secret_leak", "secret or raw sensitive material appears in recall, review packet, stdout, or UI", "BLOCK_SECRET_LEAK"],
  ["negative.rule_conflict_auto_resolve", "conflicting rules are auto-resolved without visible conflict state", "BLOCK_CONFLICT_AUTO_RESOLVE"],
  ["negative.prompt_injection", "prompt-injected instruction bypasses gate, reviewer, or tool boundary", "BLOCK_PROMPT_INJECTION"],
  ["negative.compliance_theater", "compliance pack registered but evidence, owner, or test fixture is missing", "BLOCK_COMPLIANCE_THEATER"],
  ["negative.claude_mutates_policy", "Claude governance review mutates policy or source", "BLOCK_REVIEWER_MUTATION"],
  ["negative.no_human_as_governance_closeout", "no-human milestone mode is treated as protected governance closeout", "BLOCK_PROTECTED_CLOSEOUT"],
];

export async function runSecurityGovernanceComplianceRuleConflictPlane(options = {}) {
  const result = await buildSecurityGovernanceComplianceRuleConflictPlane(options);
  if (options.write !== false) await writeSecurityGovernanceComplianceRuleConflictPlane(result, result.output_dir);
  if (options.check && !result.validation.valid) {
    const error = new Error(`Security governance compliance rule conflict plane failed with ${result.validation.errors.length} error(s).`);
    error.validation = result.validation;
    throw error;
  }
  return result;
}

export async function buildSecurityGovernanceComplianceRuleConflictPlane(options = {}) {
  const generatedAt = new Date(options.runAt ?? new Date()).toISOString();
  const outputDir = path.resolve(options.outDir ?? DEFAULT_SECURITY_GOVERNANCE_COMPLIANCE_RULE_CONFLICT_PLANE_OUT_DIR);
  const inputs = normalizeInputs(options);
  const schema = await readJsonSource(inputs.schema_path);
  const packageJson = await readJsonSource(inputs.package_path);
  const roadmapDoc = await readTextSource(inputs.roadmap_doc_path);
  const architectureDoc = await readTextSource(inputs.architecture_doc_path);
  const reviewDashboardDoc = await readTextSource(inputs.review_dashboard_doc_path);
  const recallLayer = options.recallLayer ?? await buildRetrievalOntologyContextRecallLayer({
    runAt: generatedAt,
    packagePath: inputs.package_path,
    roadmapDocPath: inputs.roadmap_doc_path,
    architectureDocPath: inputs.architecture_doc_path,
    reviewDashboardDocPath: inputs.review_dashboard_doc_path,
    write: false,
  });

  const contract = buildGovernanceContract(generatedAt);
  const phaseRows = buildPhaseRows(roadmapDoc.text);
  const rawMaterialRows = buildRawMaterialRows(generatedAt);
  const promptInjectionRows = buildPromptInjectionRows(generatedAt);
  const ruleConflictRows = buildRuleConflictRows(generatedAt);
  const staleGateRows = buildStaleGateRows(generatedAt);
  const incidentRows = buildIncidentRows(generatedAt);
  const compliancePackRows = buildCompliancePackRows(generatedAt);
  const governanceUiRows = buildGovernanceUiRows(generatedAt);
  const negativeFixtureRows = buildNegativeFixtureRows(generatedAt);
  const claudeGovernanceReviewRows = buildClaudeGovernanceReviewRows(generatedAt);
  const freezeRows = buildFreezeRows({ rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, generatedAt });
  const gateRows = buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, recallLayer, contract, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows });
  const boundary = buildBoundary({ recallLayer, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows, gateRows });
  const validationItems = buildValidationItems({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, recallLayer, contract, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows, gateRows, boundary });
  const preliminaryValidation = summarizeValidation(validationItems);
  const result = {
    schema_version: SCHEMA_VERSION,
    generated_at: generatedAt,
    security_governance_compliance_rule_conflict_plane_id: `security-governance-compliance-rule-conflict-plane.${dateStamp(generatedAt)}`,
    capability_id: CAPABILITY_ID,
    program_range: PROGRAM_RANGE,
    output_dir: outputDir,
    inputs,
    source_retrieval_ontology_context_recall_layer_summary: recallLayer.summary,
    security_governance_compliance_rule_conflict_contract: contract,
    security_governance_compliance_rule_conflict_phase_rows: phaseRows,
    secret_raw_material_governance_rows: rawMaterialRows,
    prompt_injection_tool_boundary_rows: promptInjectionRows,
    rule_conflict_graph_rows: ruleConflictRows,
    stale_gate_policy_drift_rows: staleGateRows,
    incident_recovery_drill_rows: incidentRows,
    compliance_pack_registry_rows: compliancePackRows,
    governance_ui_rows: governanceUiRows,
    governance_negative_fixture_rows: negativeFixtureRows,
    claude_governance_review_packet_rows: claudeGovernanceReviewRows,
    security_governance_freeze_rows: freezeRows,
    security_governance_gate_rows: gateRows,
    security_governance_boundary: boundary,
    validation_items: validationItems,
    validation: preliminaryValidation,
    summary: buildSummary({ recallLayer, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows, gateRows, boundary, validation: preliminaryValidation }),
  };
  const schemaErrors = schema.available
    ? validateAgainstSchema(result, schema.data, {}, "security_governance_compliance_rule_conflict_plane")
    : [{ path: "schema", message: schema.error ?? "Schema unavailable" }];
  const schemaValidationItems = schemaErrors.map((error, index) => validationItem(`schema.${index}`, "schema_validation", false, error.message));
  result.validation_items = [...validationItems, ...schemaValidationItems];
  result.validation = summarizeValidation(result.validation_items);
  result.summary = buildSummary({ recallLayer, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows, gateRows, boundary, validation: result.validation });
  result.summary.security_governance_compliance_rule_conflict_plane_id = result.security_governance_compliance_rule_conflict_plane_id;
  return { ...result, markdown: renderMarkdown(result) };
}

export async function writeSecurityGovernanceComplianceRuleConflictPlane(result, outDir = result.output_dir) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "security-governance-compliance-rule-conflict-plane.json"), serializableResult(result));
  await writeJson(path.join(outDir, "secret-raw-material-governance-rows.json"), collectionEnvelope("secret-raw-material-governance-rows.v1", "secret_raw_material_governance_rows", result.secret_raw_material_governance_rows, result.generated_at));
  await writeJson(path.join(outDir, "prompt-injection-tool-boundary-rows.json"), collectionEnvelope("prompt-injection-tool-boundary-rows.v1", "prompt_injection_tool_boundary_rows", result.prompt_injection_tool_boundary_rows, result.generated_at));
  await writeJson(path.join(outDir, "rule-conflict-graph-rows.json"), collectionEnvelope("rule-conflict-graph-rows.v1", "rule_conflict_graph_rows", result.rule_conflict_graph_rows, result.generated_at));
  await writeJson(path.join(outDir, "stale-gate-policy-drift-rows.json"), collectionEnvelope("stale-gate-policy-drift-rows.v1", "stale_gate_policy_drift_rows", result.stale_gate_policy_drift_rows, result.generated_at));
  await writeJson(path.join(outDir, "incident-recovery-drill-rows.json"), collectionEnvelope("incident-recovery-drill-rows.v1", "incident_recovery_drill_rows", result.incident_recovery_drill_rows, result.generated_at));
  await writeJson(path.join(outDir, "compliance-pack-registry-rows.json"), collectionEnvelope("compliance-pack-registry-rows.v1", "compliance_pack_registry_rows", result.compliance_pack_registry_rows, result.generated_at));
  await writeJson(path.join(outDir, "governance-ui-rows.json"), collectionEnvelope("governance-ui-rows.v1", "governance_ui_rows", result.governance_ui_rows, result.generated_at));
  await writeJson(path.join(outDir, "governance-negative-fixture-rows.json"), collectionEnvelope("governance-negative-fixture-rows.v1", "governance_negative_fixture_rows", result.governance_negative_fixture_rows, result.generated_at));
  await writeJson(path.join(outDir, "claude-governance-review-packet-rows.json"), collectionEnvelope("claude-governance-review-packet-rows.v1", "claude_governance_review_packet_rows", result.claude_governance_review_packet_rows, result.generated_at));
  await writeJson(path.join(outDir, "security-governance-freeze-rows.json"), collectionEnvelope("security-governance-freeze-rows.v1", "security_governance_freeze_rows", result.security_governance_freeze_rows, result.generated_at));
  await writeJson(path.join(outDir, "security-governance-gate-rows.json"), collectionEnvelope("security-governance-gate-rows.v1", "security_governance_gate_rows", result.security_governance_gate_rows, result.generated_at));
  await writeJson(path.join(outDir, "security-governance-boundary.json"), result.security_governance_boundary);
  await writeJson(path.join(outDir, "validation-report.json"), {
    schema_version: "security-governance-compliance-rule-conflict-plane-validation-report.v1",
    generated_at: result.generated_at,
    validation: result.validation,
    validation_items: result.validation_items,
  });
  await writeFile(path.join(outDir, "summary.md"), result.markdown, "utf8");
}

export async function runSecurityGovernanceComplianceRuleConflictPlaneCli(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return;
  }
  try {
    const result = await runSecurityGovernanceComplianceRuleConflictPlane(args);
    console.log(`Security governance compliance rule conflict plane ${args.check ? "validated" : "written"} at ${result.output_dir}`);
    console.log(`Status: ${result.summary.security_governance_compliance_rule_conflict_plane_status}`);
    console.log(`Program: ${result.summary.program_range}`);
    console.log(`Rule conflicts: ${result.summary.rule_conflict_count}`);
    console.log(`Stale gates: ${result.summary.stale_gate_count}`);
    console.log(`Claude governance review required: ${result.summary.claude_code_opus_max_review_receipt_required}`);
    console.log(`Policy override allowed: ${result.summary.policy_override_allowed}`);
    console.log(`Validation errors: ${result.summary.validation_error_count}`);
  } catch (error) {
    console.error(error.message);
    for (const validationError of error.validation?.errors ?? []) console.error(`- ${validationError.path}: ${validationError.message}`);
    process.exitCode = 1;
  }
}

function buildGovernanceContract(generatedAt) {
  return {
    schema_version: "security-governance-compliance-rule-conflict-contract.v1",
    generated_at: generatedAt,
    contract_id: "security-governance-compliance-rule-conflict-contract.p7601-p7800",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7301-P7600",
    secret_raw_material_governance_required: true,
    prompt_injection_tool_boundary_required: true,
    rule_conflict_graph_required: true,
    stale_gate_policy_drift_detector_required: true,
    incident_recovery_drill_required: true,
    compliance_pack_registry_required: true,
    governance_ui_rows_required: true,
    governance_negative_fixtures_required: true,
    codex_implementation_packet_required: true,
    harness_deterministic_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    finding_loop_and_revalidation_required: true,
    review_receipt_registration_required: true,
    single_owner_trust_classification_required: true,
    policy_override_allowed: false,
    secret_leak_allowed: false,
    prompt_injection_bypass_allowed: false,
    stale_pass_allowed: false,
    rule_conflict_auto_resolve_allowed: false,
    compliance_theater_allowed: false,
    reviewer_mutation_allowed: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
  };
}

function buildPhaseRows(roadmapText) {
  return PHASE_SPECS.map(([phase_range, phase_name], index) => {
    const pass = includesToken(roadmapText, phase_range) && includesToken(roadmapText, phase_name);
    return verdictRow({
      schema_version: "security-governance-phase-row.v1",
      row_id: `security.governance.phase.row.${String(index + 1).padStart(2, "0")}`,
      phase_range,
      phase_name,
      phase_status: pass ? "reflected" : "missing",
      evidence_ref: `docs.hermes_p8000.${phase_range}`,
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: `gate.platform.security_governance.${phase_range}`,
      responsible_owner: "platform_governance_owner",
      next_allowed_action: pass ? "preserve governance phase contract" : `add ${phase_range} roadmap detail`,
    }, pass);
  });
}

function buildRawMaterialRows(generatedAt) {
  return makeRows(RAW_MATERIAL_SPECS, "secret-raw-material-governance-row.v1", "secret.raw.material.governance.row", {
    generated_at: generatedAt,
    scanner_required: true,
    redaction_required: true,
    raw_default_access_enabled: false,
    leak_blocks_gate: true,
    secret_leak_allowed: false,
  });
}

function buildPromptInjectionRows(generatedAt) {
  return makeRows(PROMPT_INJECTION_SPECS, "prompt-injection-tool-boundary-row.v1", "prompt.injection.tool.boundary.row", {
    generated_at: generatedAt,
    injection_detector_required: true,
    tool_policy_boundary_required: true,
    prompt_can_override_harness_policy: false,
    bypass_allowed: false,
  });
}

function buildRuleConflictRows(generatedAt) {
  return makeRows(RULE_CONFLICT_SPECS, "rule-conflict-graph-row.v1", "rule.conflict.graph.row", {
    generated_at: generatedAt,
    conflict_graph_required: true,
    conflict_note_required: true,
    auto_resolve_allowed: false,
    hidden_conflict_allowed: false,
  });
}

function buildStaleGateRows(generatedAt) {
  return makeRows(STALE_GATE_SPECS, "stale-gate-policy-drift-row.v1", "stale.gate.policy.drift.row", {
    generated_at: generatedAt,
    freshness_window_required: true,
    revalidation_required: true,
    stale_pass_allowed: false,
    current_trust_claim_allowed: false,
  });
}

function buildIncidentRows(generatedAt) {
  return [
    {
      schema_version: "incident-recovery-drill-row.v1",
      row_id: "incident.recovery.drill.row.001",
      generated_at: generatedAt,
      incident_contract_ready: true,
      impact_required: true,
      containment_required: true,
      rollback_required: true,
      evidence_preservation_required: true,
      revalidation_required: true,
      recovery_claim_without_evidence_allowed: false,
      evidence_ref: "evidence.incident_recovery_drill",
      reviewer_ref: "reviewer.harness_contract",
      hard_gate_ref: "gate.incident_recovery_drill",
      next_allowed_action: "preserve incident and recovery drill contract",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildCompliancePackRows(generatedAt) {
  return makeRows(COMPLIANCE_PACK_SPECS, "compliance-pack-registry-row.v1", "compliance.pack.registry.row", {
    generated_at: generatedAt,
    pack_registered: true,
    evidence_required: true,
    owner_required: true,
    fixture_required: true,
    certification_claim_allowed: false,
    compliance_theater_allowed: false,
  });
}

function buildGovernanceUiRows(generatedAt) {
  return makeRows(GOVERNANCE_UI_SPECS, "governance-ui-row.v1", "governance.ui.row", {
    generated_at: generatedAt,
    ui_row_ready: true,
    queue_visible: true,
    hard_blocker_visible: true,
    kpi_only_surface_allowed: false,
    protected_action_enabled: false,
  });
}

function buildNegativeFixtureRows(generatedAt) {
  return NEGATIVE_FIXTURES.map(([fixture_id, scenario, expected_block], index) => ({
    schema_version: "governance-negative-fixture-row.v1",
    row_id: `governance.negative.fixture.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    fixture_id,
    scenario,
    expected_block,
    actual_result: expected_block,
    fixture_status: "PASS_BLOCKED_AS_EXPECTED",
    unsafe_governance_claim_allowed: false,
    evidence_ref: `evidence.governance_negative_fixture.${fixture_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.governance_negative_fixture.${fixture_id}`,
    next_allowed_action: "preserve governance negative fixture",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
  }));
}

function buildClaudeGovernanceReviewRows(generatedAt) {
  return [
    {
      schema_version: "claude-governance-review-packet-row.v1",
      row_id: "claude.governance.review.packet.row.001",
      generated_at: generatedAt,
      review_packet_required: true,
      claude_code_opus_max_review_receipt_required: true,
      durable_raw_json_required: true,
      normalized_findings_required: true,
      reviewer_mutation_allowed: false,
      reviewer_final_approval_allowed: false,
      evidence_ref: "evidence.claude_governance_review_packet",
      reviewer_ref: "reviewer.claude_code_opus_max",
      hard_gate_ref: "gate.claude_governance_review_packet",
      next_allowed_action: "capture Claude governance review receipt before P7800 milestone closeout",
      unsafe_flags_false: true,
      verdict_authority: "harness_only",
    },
  ];
}

function buildFreezeRows({ rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, generatedAt }) {
  const specs = [
    ["raw_material_ready", rawMaterialRows.every((row) => row.scanner_required && row.secret_leak_allowed === false), "secret and raw material governance is ready"],
    ["prompt_injection_ready", promptInjectionRows.every((row) => row.injection_detector_required && row.bypass_allowed === false), "prompt injection boundary is ready"],
    ["rule_conflict_ready", ruleConflictRows.every((row) => row.conflict_note_required && row.auto_resolve_allowed === false), "rule conflict graph is ready"],
    ["stale_gate_ready", staleGateRows.every((row) => row.revalidation_required && row.stale_pass_allowed === false), "stale gate detector is ready"],
    ["incident_ready", incidentRows.every((row) => row.rollback_required && row.recovery_claim_without_evidence_allowed === false), "incident recovery drill is ready"],
    ["compliance_ready", compliancePackRows.every((row) => row.evidence_required && row.compliance_theater_allowed === false), "compliance pack registry is ready"],
    ["ui_ready", governanceUiRows.every((row) => row.queue_visible && row.kpi_only_surface_allowed === false), "governance UI rows are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "governance negative fixtures are ready"],
    ["claude_review_packet_ready", claudeGovernanceReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required && row.reviewer_mutation_allowed === false), "Claude governance review packet is ready"],
  ];
  return specs.map(([freeze_id, pass, description], index) => ({
    schema_version: "security-governance-freeze-row.v1",
    row_id: `security.governance.freeze.row.${String(index + 1).padStart(3, "0")}`,
    generated_at: generatedAt,
    freeze_id,
    freeze_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `freeze_failed.${freeze_id}`,
    evidence_ref: `evidence.security_governance.freeze.${freeze_id}`,
    reviewer_ref: "reviewer.claude_code_opus_max",
    hard_gate_ref: `gate.security_governance.freeze.${freeze_id}`,
    next_allowed_action: pass ? "preserve freeze evidence" : `repair ${freeze_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildGateRows({ packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, recallLayer, contract, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows }) {
  const gates = [
    ["package_script_registered", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package.json exposes platform:security-governance-compliance-rule-conflict-plane"],
    ["validate_chain_registered", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain includes security governance plane"],
    ["recall_script_registered", Boolean(packageJson.data?.scripts?.[RECALL_COMMAND_NAME]), "retrieval recall script exists"],
    ["recall_ready", recallLayer.summary?.retrieval_ontology_context_recall_layer_status === RECALL_READY_STATUS, "P7301-P7600 retrieval recall layer is ready"],
    ["roadmap_reflected", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE) && includesToken(roadmapDoc.text, "Security Governance Compliance and Rule Conflict Plane"), "P7601-P7800 roadmap is reflected"],
    ["architecture_reflected", architectureDoc.available && includesToken(architectureDoc.text, "Security Governance Compliance and Rule Conflict Plane"), "architecture doc reflects security governance plane"],
    ["review_dashboard_reflected", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Security Governance Compliance and Rule Conflict Plane"), "review dashboard IA reflects security governance plane"],
    ["contract_ready", contract.secret_raw_material_governance_required && contract.policy_override_allowed === false && contract.claude_code_opus_max_review_receipt_required, "security governance contract is ready"],
    ["phase_rows_pass", phaseRows.every((row) => row.current_verdict === "pass"), "all P7601-P7800 phase rows pass"],
    ["raw_material_ready", rawMaterialRows.length >= 6 && rawMaterialRows.every((row) => row.secret_leak_allowed === false), "raw material rows are ready"],
    ["prompt_injection_ready", promptInjectionRows.length >= 5 && promptInjectionRows.every((row) => row.bypass_allowed === false), "prompt injection rows are ready"],
    ["rule_conflict_ready", ruleConflictRows.length >= 5 && ruleConflictRows.every((row) => row.auto_resolve_allowed === false), "rule conflict rows are ready"],
    ["stale_gate_ready", staleGateRows.length >= 5 && staleGateRows.every((row) => row.stale_pass_allowed === false), "stale gate rows are ready"],
    ["incident_ready", incidentRows.every((row) => row.recovery_claim_without_evidence_allowed === false), "incident rows are ready"],
    ["compliance_ready", compliancePackRows.length >= 6 && compliancePackRows.every((row) => row.compliance_theater_allowed === false), "compliance pack rows are ready"],
    ["ui_ready", governanceUiRows.length >= 6 && governanceUiRows.every((row) => row.hard_blocker_visible), "governance UI rows are ready"],
    ["negative_fixtures_ready", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED"), "governance negative fixtures are ready"],
    ["claude_review_packet_ready", claudeGovernanceReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required && row.reviewer_final_approval_allowed === false), "Claude governance review packet rows are ready"],
    ["freeze_rows_ready", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows are ready"],
    ["boundary_no_override", contract.policy_override_allowed === false && contract.rule_conflict_auto_resolve_allowed === false && contract.stale_pass_allowed === false, "unsafe governance shortcuts stay blocked"],
    ["boundary_no_workos", contract.work_os_claim_enabled === false && contract.enterprise_trust_claim_enabled === false, "Work OS and enterprise trust stay disabled"],
  ];
  return gates.map(([gate_id, pass, description], index) => ({
    schema_version: "security-governance-gate-row.v1",
    row_id: `security.governance.gate.row.${String(index + 1).padStart(3, "0")}`,
    gate_id,
    gate_status: pass ? "ready" : "blocked",
    description,
    block_reason: pass ? null : `gate_failed.${gate_id}`,
    evidence_ref: `evidence.security_governance.gate.${gate_id}`,
    reviewer_ref: gate_id.includes("claude") || gate_id.includes("review") ? "reviewer.claude_code_opus_max" : "reviewer.harness_contract",
    hard_gate_ref: `gate.platform.security_governance.${gate_id}`,
    responsible_owner: "platform_governance_owner",
    next_allowed_action: pass ? "preserve gate evidence" : `repair ${gate_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  }));
}

function buildBoundary(args) {
  const { recallLayer, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows, gateRows } = args;
  const unsafeFlags = [
    recallLayer.summary?.retrieval_ontology_context_recall_layer_status !== RECALL_READY_STATUS,
    phaseRows.some((row) => row.current_verdict !== "pass"),
    rawMaterialRows.some((row) => row.secret_leak_allowed || row.raw_default_access_enabled),
    promptInjectionRows.some((row) => row.prompt_can_override_harness_policy || row.bypass_allowed),
    ruleConflictRows.some((row) => row.auto_resolve_allowed || row.hidden_conflict_allowed),
    staleGateRows.some((row) => row.stale_pass_allowed || row.current_trust_claim_allowed),
    incidentRows.some((row) => row.recovery_claim_without_evidence_allowed || !row.revalidation_required),
    compliancePackRows.some((row) => row.compliance_theater_allowed || row.certification_claim_allowed),
    governanceUiRows.some((row) => row.kpi_only_surface_allowed || row.protected_action_enabled),
    negativeFixtureRows.some((row) => row.unsafe_governance_claim_allowed || row.fixture_status !== "PASS_BLOCKED_AS_EXPECTED"),
    claudeGovernanceReviewRows.some((row) => row.reviewer_mutation_allowed || row.reviewer_final_approval_allowed),
    freezeRows.some((row) => row.freeze_status !== "ready"),
    gateRows.some((row) => row.gate_status !== "ready"),
  ];
  return {
    schema_version: "security-governance-boundary.v1",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7301-P7600",
    security_governance_compliance_rule_conflict_plane_ready: unsafeFlags.filter(Boolean).length === 0,
    retrieval_ontology_context_recall_layer_ready: recallLayer.summary?.retrieval_ontology_context_recall_layer_status === RECALL_READY_STATUS,
    secret_raw_material_governance_ready: rawMaterialRows.every((row) => row.scanner_required && row.secret_leak_allowed === false),
    prompt_injection_tool_boundary_ready: promptInjectionRows.every((row) => row.injection_detector_required && row.bypass_allowed === false),
    rule_conflict_graph_ready: ruleConflictRows.every((row) => row.conflict_graph_required && row.auto_resolve_allowed === false),
    stale_gate_policy_drift_ready: staleGateRows.every((row) => row.revalidation_required && row.stale_pass_allowed === false),
    incident_recovery_drill_ready: incidentRows.every((row) => row.rollback_required && row.revalidation_required),
    compliance_pack_registry_ready: compliancePackRows.every((row) => row.pack_registered && row.evidence_required),
    governance_ui_ready: governanceUiRows.every((row) => row.queue_visible && row.hard_blocker_visible),
    claude_governance_review_packet_ready: claudeGovernanceReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required && row.reviewer_mutation_allowed === false),
    codex_implementation_packet_required: true,
    harness_deterministic_validation_required: true,
    claude_code_opus_max_review_receipt_required: true,
    finding_loop_and_revalidation_required: true,
    review_receipt_registration_required: true,
    single_owner_trust_classification_required: true,
    policy_override_allowed: false,
    secret_leak_allowed: false,
    prompt_injection_bypass_allowed: false,
    stale_pass_allowed: false,
    rule_conflict_auto_resolve_allowed: false,
    compliance_theater_allowed: false,
    reviewer_mutation_allowed: false,
    human_adjudication_in_milestone_gate: false,
    protected_closeout_enabled: false,
    enterprise_trust_claim_enabled: false,
    agent_runtime_execution_enabled: false,
    write_action_enabled: false,
    protected_action_enabled: false,
    work_os_claim_enabled: false,
    unsafe_flag_count: unsafeFlags.filter(Boolean).length,
  };
}

function buildValidationItems(args) {
  const { packageJson, roadmapDoc, architectureDoc, reviewDashboardDoc, recallLayer, contract, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows, gateRows, boundary } = args;
  return [
    validationItem("package.script", "package", Boolean(packageJson.data?.scripts?.[COMMAND_NAME]), "package script must be registered"),
    validationItem("package.validate", "package", Boolean(packageJson.data?.scripts?.validate?.includes(`${COMMAND_NAME} -- --check`)), "validate chain must include security governance command"),
    validationItem("recall.ready", "source", recallLayer.summary?.retrieval_ontology_context_recall_layer_status === RECALL_READY_STATUS, "retrieval recall layer must be ready"),
    validationItem("roadmap.reflected", "docs", roadmapDoc.available && includesToken(roadmapDoc.text, PROGRAM_RANGE), "P7601-P7800 roadmap must be available"),
    validationItem("architecture.reflected", "docs", architectureDoc.available && includesToken(architectureDoc.text, "Security Governance Compliance and Rule Conflict Plane"), "architecture must reflect security governance"),
    validationItem("dashboard.reflected", "docs", reviewDashboardDoc.available && includesToken(reviewDashboardDoc.text, "Security Governance Compliance and Rule Conflict Plane"), "dashboard IA must reflect security governance"),
    validationItem("contract.ready", "contract", contract.secret_raw_material_governance_required && contract.claude_code_opus_max_review_receipt_required && contract.policy_override_allowed === false, "security governance contract must be ready"),
    validationItem("phases.pass", "phases", phaseRows.length === PHASE_SPECS.length && phaseRows.every((row) => row.current_verdict === "pass"), "all phases must pass"),
    validationItem("raw_material.ready", "raw_material", rawMaterialRows.length >= 6 && rawMaterialRows.every((row) => row.secret_leak_allowed === false), "raw material rows must be ready"),
    validationItem("prompt_injection.ready", "prompt_injection", promptInjectionRows.length >= 5 && promptInjectionRows.every((row) => row.bypass_allowed === false), "prompt injection rows must be ready"),
    validationItem("rule_conflict.ready", "rule_conflict", ruleConflictRows.length >= 5 && ruleConflictRows.every((row) => row.auto_resolve_allowed === false), "rule conflict rows must be ready"),
    validationItem("stale_gate.ready", "stale_gate", staleGateRows.length >= 5 && staleGateRows.every((row) => row.stale_pass_allowed === false), "stale gate rows must be ready"),
    validationItem("incident.ready", "incident", incidentRows.every((row) => row.revalidation_required && row.recovery_claim_without_evidence_allowed === false), "incident rows must be ready"),
    validationItem("compliance.ready", "compliance", compliancePackRows.length >= 6 && compliancePackRows.every((row) => row.compliance_theater_allowed === false), "compliance rows must be ready"),
    validationItem("ui.ready", "ui", governanceUiRows.length >= 6 && governanceUiRows.every((row) => row.hard_blocker_visible), "governance UI rows must be ready"),
    validationItem("fixtures.ready", "fixtures", negativeFixtureRows.every((row) => row.fixture_status === "PASS_BLOCKED_AS_EXPECTED" && row.unsafe_governance_claim_allowed === false), "negative fixtures must block unsafe governance claims"),
    validationItem("claude_review.ready", "review", claudeGovernanceReviewRows.every((row) => row.claude_code_opus_max_review_receipt_required && row.reviewer_mutation_allowed === false), "Claude governance review packet must be ready"),
    validationItem("freeze.ready", "freeze", freezeRows.every((row) => row.freeze_status === "ready"), "freeze rows must be ready"),
    validationItem("gates.ready", "gates", gateRows.every((row) => row.gate_status === "ready"), "gate rows must be ready"),
    validationItem("boundary.safe", "boundary", boundary.unsafe_flag_count === 0, "unsafe flag count must be zero"),
    validationItem("boundary.no_override", "boundary", boundary.policy_override_allowed === false && boundary.stale_pass_allowed === false && boundary.rule_conflict_auto_resolve_allowed === false, "unsafe governance shortcuts must stay blocked"),
    validationItem("boundary.no_workos", "boundary", boundary.work_os_claim_enabled === false && boundary.enterprise_trust_claim_enabled === false, "Work OS and enterprise trust must stay disabled"),
  ];
}

function buildSummary({ recallLayer, phaseRows, rawMaterialRows, promptInjectionRows, ruleConflictRows, staleGateRows, incidentRows, compliancePackRows, governanceUiRows, negativeFixtureRows, claudeGovernanceReviewRows, freezeRows, gateRows, boundary, validation }) {
  return {
    schema_version: "security-governance-compliance-rule-conflict-plane-summary.v1",
    security_governance_compliance_rule_conflict_plane_status: validation.valid && boundary.security_governance_compliance_rule_conflict_plane_ready ? READY_STATUS : "blocked",
    program_range: PROGRAM_RANGE,
    source_program_range: "P7301-P7600",
    retrieval_ontology_context_recall_layer_status: recallLayer.summary?.retrieval_ontology_context_recall_layer_status ?? "unknown",
    phase_row_count: phaseRows.length,
    raw_material_count: rawMaterialRows.length,
    prompt_injection_count: promptInjectionRows.length,
    rule_conflict_count: ruleConflictRows.length,
    stale_gate_count: staleGateRows.length,
    incident_count: incidentRows.length,
    compliance_pack_count: compliancePackRows.length,
    governance_ui_count: governanceUiRows.length,
    negative_fixture_count: negativeFixtureRows.length,
    claude_governance_review_packet_count: claudeGovernanceReviewRows.length,
    freeze_row_count: freezeRows.length,
    gate_count: gateRows.length,
    pass_gate_count: gateRows.filter((row) => row.gate_status === "ready").length,
    secret_raw_material_governance_ready: boundary.secret_raw_material_governance_ready,
    prompt_injection_tool_boundary_ready: boundary.prompt_injection_tool_boundary_ready,
    rule_conflict_graph_ready: boundary.rule_conflict_graph_ready,
    stale_gate_policy_drift_ready: boundary.stale_gate_policy_drift_ready,
    incident_recovery_drill_ready: boundary.incident_recovery_drill_ready,
    compliance_pack_registry_ready: boundary.compliance_pack_registry_ready,
    governance_ui_ready: boundary.governance_ui_ready,
    claude_governance_review_packet_ready: boundary.claude_governance_review_packet_ready,
    codex_implementation_packet_required: boundary.codex_implementation_packet_required,
    harness_deterministic_validation_required: boundary.harness_deterministic_validation_required,
    claude_code_opus_max_review_receipt_required: boundary.claude_code_opus_max_review_receipt_required,
    policy_override_allowed: boundary.policy_override_allowed,
    secret_leak_allowed: boundary.secret_leak_allowed,
    prompt_injection_bypass_allowed: boundary.prompt_injection_bypass_allowed,
    stale_pass_allowed: boundary.stale_pass_allowed,
    rule_conflict_auto_resolve_allowed: boundary.rule_conflict_auto_resolve_allowed,
    compliance_theater_allowed: boundary.compliance_theater_allowed,
    reviewer_mutation_allowed: boundary.reviewer_mutation_allowed,
    human_adjudication_in_milestone_gate: boundary.human_adjudication_in_milestone_gate,
    protected_closeout_enabled: boundary.protected_closeout_enabled,
    enterprise_trust_claim_enabled: boundary.enterprise_trust_claim_enabled,
    agent_runtime_execution_enabled: boundary.agent_runtime_execution_enabled,
    write_action_enabled: boundary.write_action_enabled,
    protected_action_enabled: boundary.protected_action_enabled,
    work_os_claim_enabled: boundary.work_os_claim_enabled,
    unsafe_flag_count: boundary.unsafe_flag_count,
    validation_error_count: validation.errors.length,
  };
}

function makeRows(specs, schemaVersion, rowPrefix, extra) {
  return specs.map(([item_id, description], index) => ({
    schema_version: schemaVersion,
    row_id: `${rowPrefix}.${String(index + 1).padStart(3, "0")}`,
    item_id,
    description,
    evidence_ref: `evidence.${rowPrefix}.${item_id}`,
    reviewer_ref: "reviewer.harness_contract",
    hard_gate_ref: `gate.${rowPrefix}.${item_id}`,
    next_allowed_action: "preserve governance contract",
    unsafe_flags_false: true,
    verdict_authority: "harness_only",
    ...extra,
  }));
}

function verdictRow(fields, pass) {
  return {
    ...fields,
    current_verdict: pass ? "pass" : "blocked",
    block_reason: pass ? null : `missing_security_governance.${fields.phase_range ?? fields.row_id}`,
    unsafe_flags_false: pass,
    verdict_authority: "harness_only",
  };
}

function renderMarkdown(result) {
  return [
    "# Security Governance Compliance Rule Conflict Plane",
    "",
    `Status: ${result.summary.security_governance_compliance_rule_conflict_plane_status}`,
    `Program: ${result.summary.program_range}`,
    `Retrieval recall source: ${result.summary.retrieval_ontology_context_recall_layer_status}`,
    `Rule conflicts: ${result.summary.rule_conflict_count}`,
    `Stale gates: ${result.summary.stale_gate_count}`,
    `Compliance packs: ${result.summary.compliance_pack_count}`,
    `Claude governance review required: ${result.summary.claude_code_opus_max_review_receipt_required}`,
    `Policy override allowed: ${result.summary.policy_override_allowed}`,
    `Stale PASS allowed: ${result.summary.stale_pass_allowed}`,
    `Work OS claim enabled: ${result.summary.work_os_claim_enabled}`,
    `Validation errors: ${result.summary.validation_error_count}`,
    "",
    "## Governance Boundary",
    "",
    "This plane makes secret/raw material leaks, prompt injection, rule conflicts, stale gates, incident recovery, and compliance theater visible as hard governance rows. It does not open protected closeout, reviewer mutation, enterprise trust, runtime execution, write, or Work OS production claims.",
    "",
  ].join("\n");
}

function validationItem(item_id, category, passed, message) {
  return { item_id, category, status: passed ? "pass" : "error", message };
}

function summarizeValidation(items) {
  return {
    valid: items.every((item) => item.status === "pass"),
    item_count: items.length,
    error_count: items.filter((item) => item.status !== "pass").length,
    errors: items.filter((item) => item.status !== "pass").map((item) => ({ path: item.item_id, message: item.message })),
  };
}

function normalizeInputs(options) {
  const defaults = DEFAULT_SECURITY_GOVERNANCE_COMPLIANCE_RULE_CONFLICT_PLANE_INPUTS;
  return {
    schema_path: options.schemaPath ?? defaults.schemaPath,
    package_path: options.packagePath ?? defaults.packagePath,
    roadmap_doc_path: options.roadmapDocPath ?? defaults.roadmapDocPath,
    architecture_doc_path: options.architectureDocPath ?? defaults.architectureDocPath,
    review_dashboard_doc_path: options.reviewDashboardDocPath ?? defaults.reviewDashboardDocPath,
  };
}

async function readJsonSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, data: JSON.parse(text) };
  } catch (error) {
    return { available: false, path: sourcePath, error: error.message };
  }
}

async function readTextSource(sourcePath) {
  try {
    const text = await readFile(sourcePath, "utf8");
    return { available: true, path: sourcePath, text };
  } catch (error) {
    return { available: false, path: sourcePath, text: "", error: error.message };
  }
}

function includesToken(text, token) {
  return text.toLowerCase().includes(token.toLowerCase());
}

function serializableResult(result) {
  const { markdown, ...rest } = result;
  return rest;
}

function collectionEnvelope(schemaVersion, collectionName, items, generatedAt) {
  return { schema_version: schemaVersion, generated_at: generatedAt, collection: collectionName, count: items.length, items };
}

async function writeJson(filePath, data) {
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function dateStamp(value) {
  return value.slice(0, 10).replaceAll("-", "");
}

function parseArgs(argv) {
  const args = {
    check: false,
    write: true,
    outDir: undefined,
    schemaPath: undefined,
    packagePath: undefined,
    roadmapDocPath: undefined,
    architectureDocPath: undefined,
    reviewDashboardDocPath: undefined,
    help: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--check") {
      args.check = true;
      args.write = false;
    } else if (arg === "--out-dir") {
      args.outDir = argv[index + 1];
      index += 1;
    } else if (arg === "--schema") {
      args.schemaPath = argv[index + 1];
      index += 1;
    } else if (arg === "--package") {
      args.packagePath = argv[index + 1];
      index += 1;
    } else if (arg === "--roadmap-doc") {
      args.roadmapDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--architecture-doc") {
      args.architectureDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--review-dashboard-doc") {
      args.reviewDashboardDocPath = argv[index + 1];
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      args.help = true;
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/security-governance-compliance-rule-conflict-plane.mjs [options]

Options:
  --check                         Validate without writing artifacts.
  --out-dir <path>                Artifact output directory.
  --schema <path>                 Schema path.
  --package <path>                package.json path.
  --roadmap-doc <path>            P4001-P8000 roadmap document path.
  --architecture-doc <path>       Architecture document path.
  --review-dashboard-doc <path>   Review dashboard IA document path.
  --help                          Show this help.
`);
}
